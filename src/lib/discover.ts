import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { DiscoveredRepo } from "../types";
import { getRemoteURL } from "./git";
import { parseURL } from "./url";

const HOME = os.homedir();

const COMMON_DIRS = [
  "work",
  "projects",
  "code",
  "dev",
  "src",
  "repos",
  "Documents",
  "Sites",
  "Websites",
  "GitHub",
];

/**
 * Get common project directories that exist on disk.
 */
export function getCommonDirs(): string[] {
  return COMMON_DIRS.map((d) => path.join(HOME, d)).filter((d) => fs.existsSync(d));
}

/**
 * Recursively find git repos in the given directories.
 * maxDepth limits how deep to recurse (default 3).
 */
export function findGitRepos(dirs: string[], maxDepth: number = 3): string[] {
  const repos: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;

    try {
      // If this directory is a git repo, add it and stop recursing
      if (fs.existsSync(path.join(dir, ".git"))) {
        repos.push(dir);
        return;
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        walk(path.join(dir, entry.name), depth + 1);
      }
    } catch {
      /* permission denied, etc */
    }
  }

  for (const dir of dirs) {
    walk(dir, 0);
  }

  return repos;
}

/**
 * Classify a repo path: read its remote, parse the org, and suggest a profile.
 */
export function classifyRepo(
  repoPath: string,
  orgMappings: Record<string, string>,
): DiscoveredRepo {
  const remoteURL = getRemoteURL(repoPath);
  const parsed = remoteURL ? parseURL(remoteURL) : null;

  const result: DiscoveredRepo = {
    path: repoPath,
    remote: remoteURL,
    org: parsed?.org ?? null,
    repo: parsed?.repo ?? null,
    suggestedProfile: null,
  };

  if (parsed) {
    const mapped: string | undefined = orgMappings[parsed.org];
    if (mapped) {
      result.suggestedProfile = mapped;
    }
  }

  return result;
}

/**
 * Discover repos in common directories and classify them.
 */
export function discoverRepos(orgMappings: Record<string, string> = {}): DiscoveredRepo[] {
  const dirs = getCommonDirs();
  const repoPaths = findGitRepos(dirs);
  return repoPaths.map((p) => classifyRepo(p, orgMappings));
}
