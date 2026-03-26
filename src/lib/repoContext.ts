import type { Profile } from "../types";
import * as clack from "@clack/prompts";
import { findRepoRoot, getRemoteURL } from "./git";
import { getProfileNames } from "./config";
import { resolveProfile } from "./profile";
import { parseURL } from "./url";
import { dim } from "./ui";

export interface RepoContext {
  repoRoot: string;
  profileName: string;
  profile: Profile;
  org: string;
  repo: string;
}

/**
 * Resolve the full repo context for the current working directory.
 * Validates: git repo, profile bound, token present, remote parseable.
 * Prints user-facing errors and returns null on failure.
 */
export function getRepoContext(): RepoContext | null {
  const cwd = process.cwd();
  const repoRoot = findRepoRoot(cwd);
  if (!repoRoot) {
    clack.log.warn("Not in a git repo.");
    return null;
  }

  const { profileName, profile } = resolveProfile(cwd);
  if (!profile || !profileName) {
    const names = getProfileNames();
    clack.log.warn(`No profile bound. Run gitme init to choose from: ${names.join(", ")}`);
    return null;
  }

  if (!profile.githubToken) {
    clack.log.warn("No GitHub token configured for this profile.");
    clack.log.message(dim("Run gitme setup to add a personal access token."));
    clack.log.message(dim("Create one at: https://github.com/settings/tokens"));
    return null;
  }

  const remote = getRemoteURL(repoRoot);
  const parsed = remote ? parseURL(remote) : null;
  if (!parsed) {
    clack.log.error("Could not parse remote URL.");
    return null;
  }

  return { repoRoot, profileName, profile, org: parsed.org, repo: parsed.repo };
}
