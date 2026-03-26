import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { findRepoRoot, getRemoteURL } from "./git";
import { resolveProfile } from "./profile";
import { parseURL } from "./url";
import * as clack from "@clack/prompts";
import { getRepoContext } from "./repoContext";

vi.mock("./git", () => ({
  findRepoRoot: vi.fn(),
  getRemoteURL: vi.fn(),
}));
vi.mock("./profile", () => ({
  resolveProfile: vi.fn(),
}));
vi.mock("./url", () => ({
  parseURL: vi.fn(),
}));
vi.mock("@clack/prompts", () => ({
  log: { warn: vi.fn(), error: vi.fn(), message: vi.fn() },
}));
vi.mock("./ui", () => ({
  dim: (s: string) => s,
}));
vi.mock("./config", () => ({
  getProfileNames: vi.fn(() => ["personal", "work"]),
}));

const mockFindRepoRoot = findRepoRoot as ReturnType<typeof vi.fn>;
const mockGetRemoteURL = getRemoteURL as ReturnType<typeof vi.fn>;
const mockResolveProfile = resolveProfile as ReturnType<typeof vi.fn>;
const mockParseURL = parseURL as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getRepoContext", () => {
  it("returns null when not in a git repo", () => {
    mockFindRepoRoot.mockReturnValue(null);

    const result = getRepoContext();

    expect(result).toBeNull();
    expect(clack.log.warn).toHaveBeenCalledWith("Not in a git repo.");
  });

  it("returns null when no profile bound", () => {
    mockFindRepoRoot.mockReturnValue("/repo");
    mockResolveProfile.mockReturnValue({ profileName: null, profile: null, source: null });

    const result = getRepoContext();

    expect(result).toBeNull();
    expect(clack.log.warn).toHaveBeenCalledWith(expect.stringContaining("No profile bound."));
  });

  it("returns null when no GitHub token", () => {
    mockFindRepoRoot.mockReturnValue("/repo");
    mockResolveProfile.mockReturnValue({
      profileName: "work",
      profile: {
        githubUsername: "user",
        gitName: "User",
        gitEmail: "user@test.com",
        sshKeyPath: "/key",
        sshHost: "github.com-work",
        githubToken: null,
      },
      source: "registry",
    });

    const result = getRepoContext();

    expect(result).toBeNull();
    expect(clack.log.warn).toHaveBeenCalledWith("No GitHub token configured for this profile.");
  });

  it("returns null when remote URL can't be parsed", () => {
    mockFindRepoRoot.mockReturnValue("/repo");
    mockResolveProfile.mockReturnValue({
      profileName: "work",
      profile: {
        githubUsername: "user",
        gitName: "User",
        gitEmail: "user@test.com",
        sshKeyPath: "/key",
        sshHost: "github.com-work",
        githubToken: "ghp_xxx",
      },
      source: "registry",
    });
    mockGetRemoteURL.mockReturnValue("not-a-url");
    mockParseURL.mockReturnValue(null);

    const result = getRepoContext();

    expect(result).toBeNull();
    expect(clack.log.error).toHaveBeenCalledWith("Could not parse remote URL.");
  });

  it("returns full context when everything is valid", () => {
    const profile = {
      githubUsername: "user",
      gitName: "User",
      gitEmail: "user@test.com",
      sshKeyPath: "/key",
      sshHost: "github.com-work",
      githubToken: "ghp_xxx",
    };
    mockFindRepoRoot.mockReturnValue("/repo");
    mockResolveProfile.mockReturnValue({
      profileName: "work",
      profile,
      source: "registry",
    });
    mockGetRemoteURL.mockReturnValue("git@github.com:acme/app.git");
    mockParseURL.mockReturnValue({
      host: "github.com",
      org: "acme",
      repo: "app",
      original: "git@github.com:acme/app.git",
    });

    const result = getRepoContext();

    expect(result).toEqual({
      repoRoot: "/repo",
      profileName: "work",
      profile,
      org: "acme",
      repo: "app",
    });
  });
});
