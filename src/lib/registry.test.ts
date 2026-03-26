import { vi, describe, it, expect, beforeEach } from "vitest";

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  realpathSync: vi.fn((p: string) => p),
}));

const gitMock = vi.hoisted(() => ({
  findRepoRoot: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: fsMock,
}));

vi.mock("./config", () => ({
  getConfigDir: () => "/mock/.gitme",
}));

vi.mock("./git", () => gitMock);

import fs from "node:fs";
import { findRepoRoot } from "./git";
import {
  loadRegistry,
  saveRegistry,
  lookupRepo,
  registerRepo,
  unregisterRepo,
  findRepoInRegistry,
} from "./registry";

const REGISTRY_PATH = "/mock/.gitme/repos.json";

const SAMPLE_ENTRY = {
  profile: "work",
  remote: "git@github.com:org/repo.git",
  org: "org",
  repo: "repo",
  clonedAt: "2025-01-01T00:00:00.000Z",
  lastVerified: "2025-01-01T00:00:00.000Z",
};

const SAMPLE_REGISTRY = {
  "/home/user/projects/repo": SAMPLE_ENTRY,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadRegistry", () => {
  it("returns {} when file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(loadRegistry()).toEqual({});
  });

  it("parses valid JSON", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_REGISTRY));

    expect(loadRegistry()).toEqual(SAMPLE_REGISTRY);
  });

  it("returns {} on corrupt JSON and backs up the file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("corrupt{{{");

    const result = loadRegistry();
    expect(result).toEqual({});
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      REGISTRY_PATH,
      expect.stringContaining(REGISTRY_PATH + ".backup."),
    );
  });
});

describe("saveRegistry", () => {
  it("writes to tmp file then renames (atomic write)", () => {
    saveRegistry(SAMPLE_REGISTRY);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      REGISTRY_PATH + ".tmp",
      JSON.stringify(SAMPLE_REGISTRY, null, 2) + "\n",
      "utf-8",
    );
    expect(fs.renameSync).toHaveBeenCalledWith(REGISTRY_PATH + ".tmp", REGISTRY_PATH);
  });
});

describe("lookupRepo", () => {
  it("finds entry by path", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_REGISTRY));

    const entry = lookupRepo("/home/user/projects/repo");
    expect(entry).toEqual(SAMPLE_ENTRY);
  });

  it("returns null on miss", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_REGISTRY));

    const entry = lookupRepo("/nonexistent/path");
    expect(entry).toBeNull();
  });
});

describe("registerRepo", () => {
  it("adds entry with timestamps and saves", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const now = "2025-06-15T12:00:00.000Z";
    vi.spyOn(Date.prototype, "toISOString").mockReturnValue(now);

    registerRepo("/home/user/projects/new-repo", {
      profile: "personal",
      remote: "git@github.com:user/new-repo.git",
      org: "user",
      repo: "new-repo",
    });

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      REGISTRY_PATH + ".tmp",
      expect.any(String),
      "utf-8",
    );

    const writtenJson = vi.mocked(fs.writeFileSync).mock.calls[0]![1] as string;
    const written = JSON.parse(writtenJson);
    expect(written["/home/user/projects/new-repo"]).toEqual({
      profile: "personal",
      remote: "git@github.com:user/new-repo.git",
      org: "user",
      repo: "new-repo",
      clonedAt: now,
      lastVerified: now,
    });

    expect(fs.renameSync).toHaveBeenCalledWith(REGISTRY_PATH + ".tmp", REGISTRY_PATH);

    vi.spyOn(Date.prototype, "toISOString").mockRestore();
  });

  it("preserves existing clonedAt when provided", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    registerRepo("/home/user/projects/repo", {
      profile: "work",
      remote: "git@github.com:org/repo.git",
      org: "org",
      repo: "repo",
      clonedAt: "2024-01-01T00:00:00.000Z",
    });

    const writtenJson = vi.mocked(fs.writeFileSync).mock.calls[0]![1] as string;
    const written = JSON.parse(writtenJson);
    expect(written["/home/user/projects/repo"].clonedAt).toBe("2024-01-01T00:00:00.000Z");
  });
});

describe("unregisterRepo", () => {
  it("removes entry and saves", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_REGISTRY));

    unregisterRepo("/home/user/projects/repo");

    const writtenJson = vi.mocked(fs.writeFileSync).mock.calls[0]![1] as string;
    const written = JSON.parse(writtenJson);
    expect(written["/home/user/projects/repo"]).toBeUndefined();
    expect(fs.renameSync).toHaveBeenCalled();
  });
});

describe("findRepoInRegistry", () => {
  it("returns entry when findRepoRoot finds a registered path", () => {
    vi.mocked(findRepoRoot).mockReturnValue("/home/user/projects/repo");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_REGISTRY));

    const result = findRepoInRegistry("/home/user/projects/repo/src");
    expect(result).not.toBeNull();
    expect(result!.absPath).toBe("/home/user/projects/repo");
    expect(result!.entry).toEqual(SAMPLE_ENTRY);
  });

  it("returns null when findRepoRoot returns null", () => {
    vi.mocked(findRepoRoot).mockReturnValue(null);

    const result = findRepoInRegistry("/not/a/repo");
    expect(result).toBeNull();
  });

  it("returns null when repo root is not in registry", () => {
    vi.mocked(findRepoRoot).mockReturnValue("/home/user/projects/unregistered");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_REGISTRY));

    const result = findRepoInRegistry("/home/user/projects/unregistered/src");
    expect(result).toBeNull();
  });
});
