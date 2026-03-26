import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { scanGitConfig, scanSSHKeys, scanSSHConfig, scanGhAuth, scanAll } from "./scan";

vi.mock("node:fs", () => ({
  default: { existsSync: vi.fn(), readdirSync: vi.fn(), readFileSync: vi.fn() },
}));
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
const mockReaddirSync = fs.readdirSync as ReturnType<typeof vi.fn>;
const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
const mockExecFileSync = execFileSync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("scanGitConfig", () => {
  it("returns name/email from git config", () => {
    mockExecFileSync.mockReturnValueOnce("Tim Benniks\n").mockReturnValueOnce("tim@example.com\n");

    const result = scanGitConfig();
    expect(result.name).toBe("Tim Benniks");
    expect(result.email).toBe("tim@example.com");
  });

  it("returns null when not configured", () => {
    mockExecFileSync
      .mockImplementationOnce(() => {
        throw new Error("not set");
      })
      .mockImplementationOnce(() => {
        throw new Error("not set");
      });

    const result = scanGitConfig();
    expect(result.name).toBeNull();
    expect(result.email).toBeNull();
  });
});

describe("scanSSHKeys", () => {
  it("lists key pairs from ~/.ssh/", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["id_ed25519", "id_ed25519.pub", "known_hosts"]);
    mockReadFileSync.mockReturnValue("ssh-ed25519 AAAA tim@laptop\n");

    const result = scanSSHKeys();
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("id_ed25519");
  });

  it("parses .pub file comments", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["id_rsa", "id_rsa.pub"]);
    mockReadFileSync.mockReturnValue("ssh-rsa AAAA user@workstation");

    const result = scanSSHKeys();
    expect(result[0]!.comment).toBe("user@workstation");
  });

  it("returns empty array when no .ssh dir", () => {
    mockExistsSync.mockReturnValue(false);

    const result = scanSSHKeys();
    expect(result).toEqual([]);
  });
});

describe("scanSSHConfig", () => {
  it("finds GitHub host aliases", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      "Host github.com-work\n  HostName github.com\n\nHost github.com-personal\n  HostName github.com\n\nHost example.com\n  HostName example.com\n",
    );

    const result = scanSSHConfig();
    expect(result).toEqual(["github.com-work", "github.com-personal"]);
  });
});

describe("scanGhAuth", () => {
  it("reads usernames from gh hosts.yml", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("github.com:\n  user: timbenniks\n  oauth_token: gho_xxx\n");

    const result = scanGhAuth();
    expect(result).toEqual(["timbenniks"]);
  });
});

describe("scanAll", () => {
  it("combines all results", () => {
    // scanGitConfig
    mockExecFileSync.mockReturnValueOnce("Name\n").mockReturnValueOnce("email@test.com\n");
    // scanSSHKeys - existsSync for .ssh dir
    mockExistsSync.mockReturnValue(false);

    const result = scanAll();
    expect(result).toHaveProperty("gitConfig");
    expect(result).toHaveProperty("sshKeys");
    expect(result).toHaveProperty("sshAliases");
    expect(result).toHaveProperty("ghUsernames");
    expect(result.gitConfig.name).toBe("Name");
    expect(result.gitConfig.email).toBe("email@test.com");
  });
});
