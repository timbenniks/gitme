import type { ResolvedProfile } from "../types";
import { loadConfig } from "./config";
import { findRepoInRegistry } from "./registry";
import { findRepoRoot, getRemoteURL } from "./git";
import { parseURL } from "./url";

/**
 * Resolve the profile for a given working directory.
 *
 * Resolution order:
 * 1. Registry lookup (cwd -> repo root -> repos.json)
 * 2. Remote URL detection (read origin, check orgMappings)
 * 3. Default profile
 * 4. null (no match)
 *
 * Returns { profileName, profile, source } or { profileName: null, profile: null, source: null }
 */
export function resolveProfile(cwd: string): ResolvedProfile {
  const config = loadConfig();

  // 1. Registry lookup
  const registered = findRepoInRegistry(cwd);
  if (registered) {
    const profileName = registered.entry.profile;
    const profile = config.profiles[profileName];
    if (profile) {
      return { profileName, profile, source: "registry" };
    }
  }

  // 2. Remote URL -> org mapping
  const repoRoot = findRepoRoot(cwd);
  if (repoRoot) {
    const remoteURL = getRemoteURL(repoRoot);
    if (remoteURL) {
      const parsed = parseURL(remoteURL);
      if (parsed) {
        const mappedProfile: string | undefined = config.orgMappings[parsed.org];
        if (mappedProfile) {
          const profile = config.profiles[mappedProfile];
          if (profile) {
            return {
              profileName: mappedProfile,
              profile,
              source: "org-mapping",
            };
          }
        }
      }
    }
  }

  // 3. Default profile
  if (config.defaultProfile) {
    const profile = config.profiles[config.defaultProfile];
    if (profile) {
      return {
        profileName: config.defaultProfile,
        profile,
        source: "default",
      };
    }
  }

  // 4. No match
  return { profileName: null, profile: null, source: null };
}
