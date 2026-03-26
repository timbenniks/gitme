import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SSH_DIR = path.join(os.homedir(), ".ssh");
const SSH_CONFIG_PATH = path.join(SSH_DIR, "config");

const BEGIN_MARKER = (name: string): string => `# gitme-begin:${name}`;
const END_MARKER = (name: string): string => `# gitme-end:${name}`;

/**
 * Check if an SSH key already exists at the given path.
 */
export function keyExists(keyPath: string): boolean {
  const resolved = keyPath.replace(/^~/, os.homedir());
  return fs.existsSync(resolved);
}

/**
 * Generate an ed25519 SSH key. Overwrites if the file already exists.
 */
export function generateKey(email: string, keyPath: string): string {
  const resolved = keyPath.replace(/^~/, os.homedir());
  const dir = path.dirname(resolved);
  fs.mkdirSync(dir, { recursive: true });

  // Remove existing key files to avoid ssh-keygen overwrite prompt
  if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
  if (fs.existsSync(resolved + ".pub")) fs.unlinkSync(resolved + ".pub");

  execFileSync("ssh-keygen", ["-t", "ed25519", "-C", email, "-f", resolved, "-N", ""], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  fs.chmodSync(resolved, 0o600);
  fs.chmodSync(resolved + ".pub", 0o644);

  return resolved;
}

/**
 * Read the public key file contents.
 */
export function readPublicKey(keyPath: string): string {
  const resolved = keyPath.replace(/^~/, os.homedir()) + ".pub";
  return fs.readFileSync(resolved, "utf-8").trim();
}

/**
 * Test SSH connection to a host alias.
 * Returns the authenticated username or null.
 */
export function testConnection(sshHost: string): string | null {
  try {
    const result = execFileSync(
      "ssh",
      ["-T", "-o", "StrictHostKeyChecking=accept-new", `git@${sshHost}`],
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 15000,
      },
    );
    // ssh -T to github exits with code 1 but prints the username to stderr
    return parseUsername(result);
  } catch (err: unknown) {
    // GitHub returns exit code 1 with "Hi <user>!" in stderr
    const e = err as { stderr?: string; stdout?: string };
    const output = e.stderr || e.stdout || "";
    return parseUsername(output);
  }
}

function parseUsername(output: string): string | null {
  const match = output.match(/Hi ([^!]+)!/);
  return match?.[1] ?? null;
}

/**
 * Read ~/.ssh/config contents.
 */
export function readSSHConfig(): string {
  if (!fs.existsSync(SSH_CONFIG_PATH)) return "";
  return fs.readFileSync(SSH_CONFIG_PATH, "utf-8");
}

/**
 * Write ~/.ssh/config preserving permissions.
 */
export function writeSSHConfig(content: string): void {
  fs.mkdirSync(SSH_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(SSH_CONFIG_PATH, content, { mode: 0o600 });
}

/**
 * Insert or update a gitme-managed Host block in SSH config.
 */
export function upsertHostBlock(
  content: string,
  profileName: string,
  sshHost: string,
  keyPath: string,
): string {
  const resolvedKey = keyPath.replace(/^~/, os.homedir());
  const block = [
    BEGIN_MARKER(profileName),
    `Host ${sshHost}`,
    "  HostName github.com",
    "  User git",
    `  IdentityFile ${resolvedKey}`,
    "  IdentitiesOnly yes",
    END_MARKER(profileName),
  ].join("\n");

  // Remove existing block if present
  const cleaned = removeHostBlock(content, profileName);

  // Append new block
  const trimmed = cleaned.trimEnd();
  return trimmed ? trimmed + "\n\n" + block + "\n" : block + "\n";
}

/**
 * Remove a gitme-managed Host block from SSH config.
 */
export function removeHostBlock(content: string, profileName: string): string {
  const begin = BEGIN_MARKER(profileName);
  const end = END_MARKER(profileName);

  const lines = content.split("\n");
  const result: string[] = [];
  let inside = false;

  for (const line of lines) {
    if (line.trim() === begin) {
      inside = true;
      continue;
    }
    if (line.trim() === end) {
      inside = false;
      continue;
    }
    if (!inside) {
      result.push(line);
    }
  }

  return result.join("\n");
}

/**
 * Find existing gitme-managed profiles in SSH config.
 */
export function findManagedProfiles(content: string): string[] {
  const profiles: string[] = [];
  const re = /^# gitme-begin:(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    profiles.push(match[1]!);
  }
  return profiles;
}

/**
 * Copy text to clipboard. Supports macOS (pbcopy), Linux (xclip), and Windows (clip.exe).
 * Returns true if successful.
 */
export function copyToClipboard(text: string): boolean {
  try {
    const platform = process.platform;
    if (platform === "darwin") {
      execFileSync("pbcopy", [], { input: text, stdio: ["pipe", "pipe", "pipe"] });
    } else if (platform === "win32") {
      execFileSync("clip", [], { input: text, stdio: ["pipe", "pipe", "pipe"] });
    } else {
      execFileSync("xclip", ["-selection", "clipboard"], {
        input: text,
        stdio: ["pipe", "pipe", "pipe"],
      });
    }
    return true;
  } catch {
    return false;
  }
}
