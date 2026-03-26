import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import type { SSHKeyInfo, ScanResult } from "../types";

const HOME = os.homedir();

/**
 * Read ~/.gitconfig for user.name and user.email.
 */
export function scanGitConfig(): { name: string | null; email: string | null } {
  const result: { name: string | null; email: string | null } = { name: null, email: null };
  try {
    result.name =
      execFileSync("git", ["config", "--global", "--get", "user.name"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim() || null;
  } catch {
    /* not set */
  }
  try {
    result.email =
      execFileSync("git", ["config", "--global", "--get", "user.email"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim() || null;
  } catch {
    /* not set */
  }
  return result;
}

/**
 * List SSH key pairs in ~/.ssh/ and parse .pub comments for emails.
 */
export function scanSSHKeys(): SSHKeyInfo[] {
  const sshDir = path.join(HOME, ".ssh");
  if (!fs.existsSync(sshDir)) return [];

  const files = fs.readdirSync(sshDir);
  const pubFiles = files.filter((f) => f.endsWith(".pub"));
  const keys: SSHKeyInfo[] = [];

  for (const pubFile of pubFiles) {
    const privFile = pubFile.replace(/\.pub$/, "");
    if (!files.includes(privFile)) continue;

    const pubPath = path.join(sshDir, pubFile);
    let comment: string | null = null;
    try {
      const content = fs.readFileSync(pubPath, "utf-8").trim();
      const parts = content.split(/\s+/);
      if (parts.length >= 3) {
        comment = parts.slice(2).join(" ");
      }
    } catch {
      /* skip */
    }

    keys.push({
      name: privFile,
      path: path.join(sshDir, privFile),
      pubPath,
      comment,
    });
  }

  return keys;
}

/**
 * Detect existing GitHub host aliases in ~/.ssh/config.
 */
export function scanSSHConfig(): string[] {
  const configPath = path.join(HOME, ".ssh", "config");
  if (!fs.existsSync(configPath)) return [];

  const content = fs.readFileSync(configPath, "utf-8");
  const aliases: string[] = [];
  const hostRe = /^Host\s+(\S+)/gm;
  let match;

  while ((match = hostRe.exec(content)) !== null) {
    const host = match[1]!;
    if (host.startsWith("github.com") && host !== "github.com") {
      aliases.push(host);
    }
  }

  return aliases;
}

/**
 * Try reading gh CLI auth to detect GitHub usernames.
 */
export function scanGhAuth(): string[] {
  const hostsPath = path.join(HOME, ".config", "gh", "hosts.yml");
  if (!fs.existsSync(hostsPath)) return [];

  try {
    const content = fs.readFileSync(hostsPath, "utf-8");
    const usernames: string[] = [];
    const userRe = /user:\s*(\S+)/g;
    let match;
    while ((match = userRe.exec(content)) !== null) {
      usernames.push(match[1]!);
    }
    return usernames;
  } catch {
    return [];
  }
}

/**
 * Run all scans and return combined results.
 */
export function scanAll(): ScanResult {
  return {
    gitConfig: scanGitConfig(),
    sshKeys: scanSSHKeys(),
    sshAliases: scanSSHConfig(),
    ghUsernames: scanGhAuth(),
  };
}
