import { vi, describe, it, expect, beforeEach } from "vitest";
import os from "node:os";

const cpMock = vi.hoisted(() => ({
  execFileSync: vi.fn(),
}));

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  chmodSync: vi.fn(),
}));

vi.mock("node:child_process", () => cpMock);

vi.mock("node:fs", () => ({
  default: fsMock,
}));

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  upsertHostBlock,
  removeHostBlock,
  findManagedProfiles,
  keyExists,
  generateKey,
  readPublicKey,
  testConnection,
} from "./ssh";

const home = os.homedir();

beforeEach(() => {
  vi.clearAllMocks();
});

// --- Pure string tests (no mocks needed) ---

describe("upsertHostBlock", () => {
  it("inserts into an empty string", () => {
    const result = upsertHostBlock("", "work", "github.com-work", "~/.ssh/id_work");
    expect(result).toContain("# gitme-begin:work");
    expect(result).toContain("Host github.com-work");
    expect(result).toContain("HostName github.com");
    expect(result).toContain("User git");
    expect(result).toContain(`IdentityFile ${home}/.ssh/id_work`);
    expect(result).toContain("IdentitiesOnly yes");
    expect(result).toContain("# gitme-end:work");
    expect(result.endsWith("\n")).toBe(true);
  });

  it("appends alongside existing non-gitme content", () => {
    const existing = "Host example.com\n  User admin\n";
    const result = upsertHostBlock(
      existing,
      "personal",
      "github.com-personal",
      "~/.ssh/id_personal",
    );

    expect(result).toContain("Host example.com");
    expect(result).toContain("User admin");
    expect(result).toContain("# gitme-begin:personal");
    expect(result).toContain("Host github.com-personal");
    expect(result).toContain("# gitme-end:personal");
  });

  it("replaces an existing gitme block for the same profile", () => {
    const existing = [
      "# gitme-begin:work",
      "Host github.com-work",
      "  HostName github.com",
      "  User git",
      `  IdentityFile ${home}/.ssh/old_key`,
      "  IdentitiesOnly yes",
      "# gitme-end:work",
    ].join("\n");

    const result = upsertHostBlock(existing, "work", "github.com-work", "~/.ssh/new_key");

    expect(result).not.toContain("old_key");
    expect(result).toContain(`IdentityFile ${home}/.ssh/new_key`);

    const beginCount = (result.match(/# gitme-begin:work/g) || []).length;
    expect(beginCount).toBe(1);
  });
});

describe("removeHostBlock", () => {
  const block = [
    "# gitme-begin:work",
    "Host github.com-work",
    "  HostName github.com",
    "  User git",
    "  IdentityFile ~/.ssh/id_work",
    "  IdentitiesOnly yes",
    "# gitme-end:work",
  ].join("\n");

  it("removes an existing block", () => {
    const content = `Some header\n\n${block}\n\nSome footer`;
    const result = removeHostBlock(content, "work");

    expect(result).not.toContain("gitme-begin:work");
    expect(result).not.toContain("gitme-end:work");
    expect(result).not.toContain("github.com-work");
    expect(result).toContain("Some header");
    expect(result).toContain("Some footer");
  });

  it("returns content unchanged when block does not exist", () => {
    const content = "Host example.com\n  User admin\n";
    const result = removeHostBlock(content, "nonexistent");
    expect(result).toBe(content);
  });

  it("preserves non-gitme content", () => {
    const other = "Host gitlab.com\n  User deploy\n";
    const content = `${other}\n${block}\n`;
    const result = removeHostBlock(content, "work");

    expect(result).toContain("Host gitlab.com");
    expect(result).toContain("User deploy");
  });
});

describe("findManagedProfiles", () => {
  it("finds multiple profiles", () => {
    const content = [
      "# gitme-begin:work",
      "Host github.com-work",
      "# gitme-end:work",
      "",
      "# gitme-begin:personal",
      "Host github.com-personal",
      "# gitme-end:personal",
    ].join("\n");

    const profiles = findManagedProfiles(content);
    expect(profiles).toEqual(["work", "personal"]);
  });

  it("returns empty array when no markers present", () => {
    const content = "Host example.com\n  User admin\n";
    expect(findManagedProfiles(content)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(findManagedProfiles("")).toEqual([]);
  });
});

// --- Mock-based tests ---

describe("keyExists", () => {
  it("returns true when file exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    expect(keyExists(`${home}/.ssh/id_work`)).toBe(true);
    expect(fs.existsSync).toHaveBeenCalledWith(`${home}/.ssh/id_work`);
  });

  it("returns false when file doesn't exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(keyExists(`${home}/.ssh/id_work`)).toBe(false);
    expect(fs.existsSync).toHaveBeenCalledWith(`${home}/.ssh/id_work`);
  });

  it("resolves ~ to homedir", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    keyExists("~/.ssh/id_work");
    expect(fs.existsSync).toHaveBeenCalledWith(`${home}/.ssh/id_work`);
  });
});

describe("generateKey", () => {
  it("removes existing files before generating", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(execFileSync).mockReturnValue(Buffer.from(""));

    generateKey("user@example.com", `${home}/.ssh/id_test`);

    expect(fs.unlinkSync).toHaveBeenCalledWith(`${home}/.ssh/id_test`);
    expect(fs.unlinkSync).toHaveBeenCalledWith(`${home}/.ssh/id_test.pub`);
  });

  it("calls ssh-keygen with correct args", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(execFileSync).mockReturnValue(Buffer.from(""));

    const result = generateKey("user@example.com", `${home}/.ssh/id_test`);

    expect(execFileSync).toHaveBeenCalledWith(
      "ssh-keygen",
      ["-t", "ed25519", "-C", "user@example.com", "-f", `${home}/.ssh/id_test`, "-N", ""],
      expect.objectContaining({ stdio: ["pipe", "pipe", "pipe"] }),
    );
    expect(result).toBe(`${home}/.ssh/id_test`);
  });

  it("creates the directory recursively", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(execFileSync).mockReturnValue(Buffer.from(""));

    generateKey("user@example.com", `${home}/.ssh/id_test`);

    expect(fs.mkdirSync).toHaveBeenCalledWith(`${home}/.ssh`, { recursive: true });
  });
});

describe("readPublicKey", () => {
  it("reads .pub file content", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample user@example.com\n",
    );

    const key = readPublicKey(`${home}/.ssh/id_test`);

    expect(fs.readFileSync).toHaveBeenCalledWith(`${home}/.ssh/id_test.pub`, "utf-8");
    expect(key).toBe("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample user@example.com");
  });

  it("resolves ~ in path", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("ssh-ed25519 AAAA key\n");

    readPublicKey("~/.ssh/id_test");

    expect(fs.readFileSync).toHaveBeenCalledWith(`${home}/.ssh/id_test.pub`, "utf-8");
  });
});

describe("testConnection", () => {
  it("returns username on successful auth", () => {
    vi.mocked(execFileSync).mockReturnValue("Hi workuser! You've successfully authenticated");

    const username = testConnection("github.com-work");

    expect(execFileSync).toHaveBeenCalledWith(
      "ssh",
      ["-T", "-o", "StrictHostKeyChecking=accept-new", "git@github.com-work"],
      expect.objectContaining({ encoding: "utf-8", timeout: 15000 }),
    );
    expect(username).toBe("workuser");
  });

  it("returns username from stderr on exit code 1", () => {
    const error = new Error("Process exited with code 1") as Error & { stderr: string };
    error.stderr =
      "Hi workuser! You've successfully authenticated, but GitHub does not provide shell access.";
    vi.mocked(execFileSync).mockImplementation(() => {
      throw error;
    });

    const username = testConnection("github.com-work");
    expect(username).toBe("workuser");
  });

  it("returns null on failure", () => {
    const error = new Error("Connection refused") as Error & { stderr: string };
    error.stderr = "ssh: connect to host github.com-work port 22: Connection refused";
    vi.mocked(execFileSync).mockImplementation(() => {
      throw error;
    });

    const username = testConnection("github.com-work");
    expect(username).toBeNull();
  });

  it("returns null when stderr is empty", () => {
    const error = new Error("timeout") as Error & { stderr: string };
    error.stderr = "";
    vi.mocked(execFileSync).mockImplementation(() => {
      throw error;
    });

    const username = testConnection("github.com-work");
    expect(username).toBeNull();
  });
});
