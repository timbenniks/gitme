import { vi, describe, it, expect, beforeEach } from "vite-plus/test";
import { loadConfig } from "./config";
import { findRepoInRegistry } from "./registry";
import { findRepoRoot, getRemoteURL } from "./git";
import { parseURL } from "./url";

vi.mock("./config", () => ({
  loadConfig: vi.fn(),
}));

vi.mock("./registry", () => ({
  findRepoInRegistry: vi.fn(),
}));

vi.mock("./git", () => ({
  findRepoRoot: vi.fn(),
  getRemoteURL: vi.fn(),
}));

vi.mock("./url", () => ({
  parseURL: vi.fn(),
}));

import { resolveProfile } from "./profile";

const WORK_PROFILE = {
  githubUsername: "workuser",
  gitName: "Work User",
  gitEmail: "work@example.com",
  sshKeyPath: "/home/user/.ssh/id_work",
  sshHost: "github.com-work",
  githubToken: null,
};

const PERSONAL_PROFILE = {
  githubUsername: "personaluser",
  gitName: "Personal User",
  gitEmail: "personal@example.com",
  sshKeyPath: "/home/user/.ssh/id_personal",
  sshHost: "github.com",
  githubToken: null,
};

const BASE_CONFIG = {
  version: 1,
  defaultProfile: "personal",
  profiles: {
    work: WORK_PROFILE,
    personal: PERSONAL_PROFILE,
  },
  orgMappings: {
    "work-org": "work",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadConfig).mockReturnValue({ ...BASE_CONFIG });
});

describe("resolveProfile", () => {
  it("returns profile from registry when repo is registered", () => {
    vi.mocked(findRepoInRegistry).mockReturnValue({
      absPath: "/home/user/projects/repo",
      entry: {
        profile: "work",
        remote: "git@github.com:work-org/repo.git",
        org: "work-org",
        repo: "repo",
        clonedAt: "2025-01-01T00:00:00.000Z",
        lastVerified: "2025-01-01T00:00:00.000Z",
      },
    });

    const result = resolveProfile("/home/user/projects/repo");
    expect(result).toEqual({
      profileName: "work",
      profile: WORK_PROFILE,
      source: "registry",
    });

    // Should not fall through to git detection
    expect(findRepoRoot).not.toHaveBeenCalled();
  });

  it("falls back to org mapping when not in registry but remote matches", () => {
    vi.mocked(findRepoInRegistry).mockReturnValue(null);
    vi.mocked(findRepoRoot).mockReturnValue("/home/user/projects/repo");
    vi.mocked(getRemoteURL).mockReturnValue("git@github.com:work-org/repo.git");
    vi.mocked(parseURL).mockReturnValue({
      host: "github.com",
      org: "work-org",
      repo: "repo",
      original: "git@github.com:work-org/repo.git",
    });

    const result = resolveProfile("/home/user/projects/repo");
    expect(result).toEqual({
      profileName: "work",
      profile: WORK_PROFILE,
      source: "org-mapping",
    });
  });

  it("falls back to default profile when no org mapping matches", () => {
    vi.mocked(findRepoInRegistry).mockReturnValue(null);
    vi.mocked(findRepoRoot).mockReturnValue("/home/user/projects/repo");
    vi.mocked(getRemoteURL).mockReturnValue("git@github.com:random-org/repo.git");
    vi.mocked(parseURL).mockReturnValue({
      host: "github.com",
      org: "random-org",
      repo: "repo",
      original: "git@github.com:random-org/repo.git",
    });

    const result = resolveProfile("/home/user/projects/repo");
    expect(result).toEqual({
      profileName: "personal",
      profile: PERSONAL_PROFILE,
      source: "default",
    });
  });

  it("returns null when nothing matches", () => {
    vi.mocked(loadConfig).mockReturnValue({
      version: 1,
      defaultProfile: null,
      profiles: {},
      orgMappings: {},
    });
    vi.mocked(findRepoInRegistry).mockReturnValue(null);
    vi.mocked(findRepoRoot).mockReturnValue(null);

    const result = resolveProfile("/some/random/dir");
    expect(result).toEqual({
      profileName: null,
      profile: null,
      source: null,
    });
  });
});
