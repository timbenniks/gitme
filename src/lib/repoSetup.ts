import type { Profile } from "../types";
import * as clack from "@clack/prompts";
import { getRemoteURL, setRemoteURL, setLocalConfig, listRemotes } from "./git";
import { registerRepo } from "./registry";
import { parseURL, toSSH, stripSSHAlias } from "./url";
import { symbols } from "./ui";

/**
 * Configure a repo for a profile: rewrite remotes, set local git config, register.
 * Returns the primary remote info or null.
 */
export function setupRepoForProfile(
  repoRoot: string,
  profile: Profile,
  profileName: string,
): { url: string; org: string; repo: string } | null {
  const remotes = listRemotes(repoRoot);
  let primaryRemote: { url: string; org: string; repo: string } | null = null;

  for (const remote of remotes) {
    const url = getRemoteURL(repoRoot, remote);
    if (!url) continue;
    const parsed = parseURL(url);
    if (!parsed) continue;

    if (stripSSHAlias(parsed.host) === "github.com") {
      const newURL = toSSH(parsed, profile.sshHost);
      setRemoteURL(repoRoot, remote, newURL);
      clack.log.info(`\u{1F504} Rewriting ${remote} to: ${newURL}`);

      if (remote === "origin" || !primaryRemote) {
        primaryRemote = { url: newURL, org: parsed.org, repo: parsed.repo };
      }
    }
  }

  setLocalConfig(repoRoot, "user.name", profile.gitName);
  setLocalConfig(repoRoot, "user.email", profile.gitEmail);
  clack.log.info(`${symbols.email} Set git user to: ${profile.gitName} <${profile.gitEmail}>`);

  registerRepo(repoRoot, {
    profile: profileName,
    remote: primaryRemote?.url || getRemoteURL(repoRoot) || "",
    org: primaryRemote?.org || "",
    repo: primaryRemote?.repo || "",
  });

  return primaryRemote;
}
