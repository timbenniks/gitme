import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { debug } from "./verbose";

interface ExecOptions {
  cwd?: string;
  throwOnError?: boolean;
}

function exec(cmd: string, args: string[], opts: ExecOptions = {}): string | null {
  const { throwOnError = true, cwd } = opts;
  try {
    return (
      execFileSync(cmd, args, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"],
        cwd,
      }) as string
    ).trim();
  } catch (err) {
    debug(`Command failed: ${cmd} ${args.join(" ")}`);
    debug(`Error: ${(err as Error).message}`);
    if (throwOnError) throw err;
    return null;
  }
}

/**
 * Find the git repo root by walking up from dir.
 * Returns absolute path or null.
 */
export function findRepoRoot(dir: string): string | null {
  let current = path.resolve(dir);
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      try {
        return fs.realpathSync(current);
      } catch {
        return current;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function isGitRepo(dir: string): boolean {
  return findRepoRoot(dir) !== null;
}

export function getRemoteURL(dir: string, remote: string = "origin"): string | null {
  return exec("git", ["remote", "get-url", remote], { cwd: dir, throwOnError: false });
}

export function setRemoteURL(dir: string, remote: string, url: string): void {
  exec("git", ["remote", "set-url", remote, url], { cwd: dir });
}

export function listRemotes(dir: string): string[] {
  const output = exec("git", ["remote"], { cwd: dir, throwOnError: false });
  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

export function getLocalConfig(dir: string, key: string): string | null {
  return exec("git", ["config", "--local", "--get", key], { cwd: dir, throwOnError: false });
}

export function setLocalConfig(dir: string, key: string, value: string): void {
  exec("git", ["config", "--local", key, value], { cwd: dir });
}

export function clone(url: string, targetDir?: string): string {
  const args = ["clone", url];
  if (targetDir) args.push(targetDir);
  exec("git", args);
  // Return the resolved directory
  const dir = targetDir || path.basename(url).replace(/\.git$/, "");
  return path.resolve(dir);
}

export function getBranch(dir: string): string | null {
  return exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir, throwOnError: false });
}

export function getStatus(dir: string): string | null {
  return exec("git", ["status"], { cwd: dir, throwOnError: false });
}

export function getTrackingBranch(dir: string): string | null {
  return exec("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], {
    cwd: dir,
    throwOnError: false,
  });
}
