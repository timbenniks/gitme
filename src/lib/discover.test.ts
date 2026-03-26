import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import fs from "node:fs";
import { getRemoteURL } from "./git";
import { parseURL } from "./url";
import { getCommonDirs, findGitRepos, classifyRepo } from "./discover";

vi.mock("node:fs", () => ({
  default: { existsSync: vi.fn(), readdirSync: vi.fn() },
}));
vi.mock("./git", () => ({
  getRemoteURL: vi.fn(),
}));
vi.mock("./url", () => ({
  parseURL: vi.fn(),
}));

const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
const mockReaddirSync = fs.readdirSync as ReturnType<typeof vi.fn>;
const mockGetRemoteURL = getRemoteURL as ReturnType<typeof vi.fn>;
const mockParseURL = parseURL as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getCommonDirs", () => {
  it("returns only dirs that exist on disk", () => {
    mockExistsSync.mockImplementation((p: string) => {
      return p.endsWith("/projects") || p.endsWith("/code");
    });

    const result = getCommonDirs();

    // Should only include dirs that existsSync returns true for
    expect(result.length).toBe(2);
    expect(result.every((d: string) => d.endsWith("/projects") || d.endsWith("/code"))).toBe(true);
  });
});

describe("findGitRepos", () => {
  it("finds repos with .git directory", () => {
    mockExistsSync.mockImplementation((p: string) => {
      return p === "/projects/repo-a/.git";
    });
    // No subdirectories for repo-a since it has .git
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === "/projects") {
        return [{ name: "repo-a", isDirectory: () => true }];
      }
      return [];
    });

    const result = findGitRepos(["/projects"]);
    expect(result).toEqual(["/projects/repo-a"]);
  });

  it("skips node_modules and dotfiles", () => {
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === "/projects") {
        return [
          { name: "node_modules", isDirectory: () => true },
          { name: ".hidden", isDirectory: () => true },
          { name: "real-dir", isDirectory: () => true },
        ];
      }
      return [];
    });

    findGitRepos(["/projects"]);

    // readdirSync should NOT be called for node_modules or .hidden
    const calledPaths = mockReaddirSync.mock.calls.map((c: unknown[]) => c[0]);
    expect(calledPaths).not.toContain("/projects/node_modules");
    expect(calledPaths).not.toContain("/projects/.hidden");
  });

  it("respects maxDepth", () => {
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockImplementation(() => {
      return [{ name: "sub", isDirectory: () => true }];
    });

    findGitRepos(["/projects"], 1);

    // depth 0: /projects, depth 1: /projects/sub
    // At depth 2 we should stop, so /projects/sub/sub should NOT be read
    const calledPaths = mockReaddirSync.mock.calls.map((c: unknown[]) => c[0]);
    expect(calledPaths).toContain("/projects");
    expect(calledPaths).toContain("/projects/sub");
    expect(calledPaths).not.toContain("/projects/sub/sub");
  });
});

describe("classifyRepo", () => {
  it("returns suggestedProfile when org matches mapping", () => {
    mockGetRemoteURL.mockReturnValue("git@github.com:acme/app.git");
    mockParseURL.mockReturnValue({
      host: "github.com",
      org: "acme",
      repo: "app",
      original: "git@github.com:acme/app.git",
    });

    const result = classifyRepo("/repos/app", { acme: "work" });

    expect(result.suggestedProfile).toBe("work");
    expect(result.org).toBe("acme");
    expect(result.repo).toBe("app");
  });

  it("returns null suggestedProfile when no match", () => {
    mockGetRemoteURL.mockReturnValue("git@github.com:personal/dotfiles.git");
    mockParseURL.mockReturnValue({
      host: "github.com",
      org: "personal",
      repo: "dotfiles",
      original: "git@github.com:personal/dotfiles.git",
    });

    const result = classifyRepo("/repos/dotfiles", { acme: "work" });

    expect(result.suggestedProfile).toBeNull();
  });
});
