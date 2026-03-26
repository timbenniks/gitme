import { vi, describe, it, expect, beforeEach } from "vitest";

const cpMock = vi.hoisted(() => ({
  execFileSync: vi.fn(),
}));

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(),
  realpathSync: vi.fn((p: string) => p),
}));

vi.mock("node:child_process", () => cpMock);

vi.mock("node:fs", () => ({
  default: fsMock,
}));

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import {
  getRemoteURL,
  isGitRepo,
  findRepoRoot,
  getBranch,
  setRemoteURL,
  setLocalConfig,
  listRemotes,
  clone,
} from "./git";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRemoteURL", () => {
  it("calls execFileSync with correct args and returns trimmed output", () => {
    vi.mocked(execFileSync).mockReturnValue("  git@github.com:org/repo.git  \n");

    const url = getRemoteURL("/some/repo");
    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      ["remote", "get-url", "origin"],
      expect.objectContaining({ cwd: "/some/repo" }),
    );
    expect(url).toBe("git@github.com:org/repo.git");
  });

  it("returns null when command fails", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("fatal: not a git repository");
    });

    const url = getRemoteURL("/not/a/repo");
    expect(url).toBeNull();
  });
});

describe("isGitRepo", () => {
  it("returns true when .git exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    expect(isGitRepo("/some/repo")).toBe(true);
  });

  it("returns false when .git does not exist anywhere in hierarchy", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(isGitRepo("/some/path")).toBe(false);
  });
});

describe("findRepoRoot", () => {
  it("walks up directories to find .git", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return p === "/home/user/projects/repo/.git";
    });

    const root = findRepoRoot("/home/user/projects/repo/src/lib");
    expect(root).toBe("/home/user/projects/repo");
  });

  it("returns null when no .git found", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const root = findRepoRoot("/some/random/path");
    expect(root).toBeNull();
  });
});

describe("getBranch", () => {
  it("returns branch name from execFileSync output", () => {
    vi.mocked(execFileSync).mockReturnValue("  main\n");

    const branch = getBranch("/some/repo");
    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      expect.objectContaining({ cwd: "/some/repo" }),
    );
    expect(branch).toBe("main");
  });

  it("returns null when command fails", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("fatal");
    });

    expect(getBranch("/not/a/repo")).toBeNull();
  });
});

describe("setRemoteURL", () => {
  it("calls execFileSync with correct args", () => {
    vi.mocked(execFileSync).mockReturnValue("");

    setRemoteURL("/some/repo", "origin", "git@github.com:org/repo.git");

    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      ["remote", "set-url", "origin", "git@github.com:org/repo.git"],
      expect.objectContaining({ cwd: "/some/repo" }),
    );
  });
});

describe("setLocalConfig", () => {
  it("calls execFileSync with correct args", () => {
    vi.mocked(execFileSync).mockReturnValue("");

    setLocalConfig("/some/repo", "user.name", "Test User");

    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      ["config", "--local", "user.name", "Test User"],
      expect.objectContaining({ cwd: "/some/repo" }),
    );
  });
});

describe("listRemotes", () => {
  it("returns array of remote names", () => {
    vi.mocked(execFileSync).mockReturnValue("origin\nupstream\n");

    const remotes = listRemotes("/some/repo");
    expect(remotes).toEqual(["origin", "upstream"]);
    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      ["remote"],
      expect.objectContaining({ cwd: "/some/repo" }),
    );
  });

  it("returns empty array on error", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("fatal: not a git repository");
    });

    const remotes = listRemotes("/not/a/repo");
    expect(remotes).toEqual([]);
  });

  it("returns empty array when no remotes configured", () => {
    vi.mocked(execFileSync).mockReturnValue("");

    const remotes = listRemotes("/some/repo");
    expect(remotes).toEqual([]);
  });
});

describe("clone", () => {
  it("calls execFileSync with clone args and returns resolved path", () => {
    vi.mocked(execFileSync).mockReturnValue("");

    const result = clone("git@github.com:org/repo.git");

    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      ["clone", "git@github.com:org/repo.git"],
      expect.objectContaining({ encoding: "utf-8" }),
    );
    expect(result).toContain("repo");
  });

  it("passes targetDir when provided", () => {
    vi.mocked(execFileSync).mockReturnValue("");

    const result = clone("git@github.com:org/repo.git", "/tmp/my-repo");

    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      ["clone", "git@github.com:org/repo.git", "/tmp/my-repo"],
      expect.objectContaining({ encoding: "utf-8" }),
    );
    expect(result).toContain("my-repo");
  });
});
