import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { getRemoteURL, setRemoteURL, setLocalConfig, listRemotes } from "./git";
import { registerRepo } from "./registry";
import { parseURL, toSSH, stripSSHAlias } from "./url";
import { setupRepoForProfile } from "./repoSetup";
import type { Profile } from "../types";

vi.mock("./git", () => ({
  getRemoteURL: vi.fn(),
  setRemoteURL: vi.fn(),
  setLocalConfig: vi.fn(),
  listRemotes: vi.fn(),
}));
vi.mock("./registry", () => ({
  registerRepo: vi.fn(),
}));
vi.mock("./url", () => ({
  parseURL: vi.fn(),
  toSSH: vi.fn(),
  stripSSHAlias: vi.fn(),
}));
vi.mock("./ui", () => ({
  symbols: { email: "\u{1F4E7}" },
}));
vi.mock("@clack/prompts", () => ({
  log: { info: vi.fn() },
}));

const mockListRemotes = listRemotes as ReturnType<typeof vi.fn>;
const mockGetRemoteURL = getRemoteURL as ReturnType<typeof vi.fn>;
const mockSetRemoteURL = setRemoteURL as ReturnType<typeof vi.fn>;
const mockSetLocalConfig = setLocalConfig as ReturnType<typeof vi.fn>;
const mockRegisterRepo = registerRepo as ReturnType<typeof vi.fn>;
const mockParseURL = parseURL as ReturnType<typeof vi.fn>;
const mockToSSH = toSSH as ReturnType<typeof vi.fn>;
const mockStripSSHAlias = stripSSHAlias as ReturnType<typeof vi.fn>;

const profile: Profile = {
  githubUsername: "timbenniks",
  gitName: "Tim Benniks",
  gitEmail: "tim@example.com",
  sshKeyPath: "/home/tim/.ssh/id_work",
  sshHost: "github.com-work",
  githubToken: "ghp_xxx",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("setupRepoForProfile", () => {
  it("rewrites github.com remotes to use profile SSH host", () => {
    mockListRemotes.mockReturnValue(["origin"]);
    mockGetRemoteURL.mockReturnValue("git@github.com:acme/app.git");
    mockParseURL.mockReturnValue({
      host: "github.com",
      org: "acme",
      repo: "app",
      original: "git@github.com:acme/app.git",
    });
    mockStripSSHAlias.mockReturnValue("github.com");
    mockToSSH.mockReturnValue("git@github.com-work:acme/app.git");

    setupRepoForProfile("/repo", profile, "work");

    expect(mockSetRemoteURL).toHaveBeenCalledWith(
      "/repo",
      "origin",
      "git@github.com-work:acme/app.git",
    );
  });

  it("does not rewrite non-github remotes", () => {
    mockListRemotes.mockReturnValue(["origin"]);
    mockGetRemoteURL.mockReturnValue("git@gitlab.com:acme/app.git");
    mockParseURL.mockReturnValue({
      host: "gitlab.com",
      org: "acme",
      repo: "app",
      original: "git@gitlab.com:acme/app.git",
    });
    mockStripSSHAlias.mockReturnValue("gitlab.com");

    setupRepoForProfile("/repo", profile, "work");

    expect(mockSetRemoteURL).not.toHaveBeenCalled();
  });

  it("sets user.name and user.email via setLocalConfig", () => {
    mockListRemotes.mockReturnValue([]);

    setupRepoForProfile("/repo", profile, "work");

    expect(mockSetLocalConfig).toHaveBeenCalledWith("/repo", "user.name", "Tim Benniks");
    expect(mockSetLocalConfig).toHaveBeenCalledWith("/repo", "user.email", "tim@example.com");
  });

  it("registers repo in registry", () => {
    mockListRemotes.mockReturnValue([]);
    // getRemoteURL called for fallback in registerRepo call
    mockGetRemoteURL.mockReturnValue("");

    setupRepoForProfile("/repo", profile, "work");

    expect(mockRegisterRepo).toHaveBeenCalledWith(
      "/repo",
      expect.objectContaining({
        profile: "work",
      }),
    );
  });

  it("returns primary remote info", () => {
    mockListRemotes.mockReturnValue(["origin"]);
    mockGetRemoteURL.mockReturnValue("git@github.com:acme/app.git");
    mockParseURL.mockReturnValue({
      host: "github.com",
      org: "acme",
      repo: "app",
      original: "git@github.com:acme/app.git",
    });
    mockStripSSHAlias.mockReturnValue("github.com");
    mockToSSH.mockReturnValue("git@github.com-work:acme/app.git");

    const result = setupRepoForProfile("/repo", profile, "work");

    expect(result).toEqual({
      url: "git@github.com-work:acme/app.git",
      org: "acme",
      repo: "app",
    });
  });
});
