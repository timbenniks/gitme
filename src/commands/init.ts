import type { Command } from "commander";
import type { Profile } from "../types";
import * as clack from "@clack/prompts";
import { findRepoRoot, getRemoteURL, getLocalConfig } from "../lib/git";
import { loadConfig } from "../lib/config";
import { selectProfile } from "../lib/prompts";
import { setupRepoForProfile } from "../lib/repoSetup";
import { parseURL } from "../lib/url";
import { dim, symbols } from "../lib/ui";

export function registerInit(program: Command): void {
  program
    .command("init [profile]")
    .description("Bind an existing repo to a profile")
    .action(async (profileArg?: string) => {
      const cwd: string = process.cwd();
      const repoRoot: string | null = findRepoRoot(cwd);

      if (!repoRoot) {
        clack.log.warn("Not in a git repo.");
        process.exitCode = 1;
        return;
      }

      const config = loadConfig();
      const profileNames: string[] = Object.keys(config.profiles);

      if (profileNames.length === 0) {
        clack.log.warn("No profiles configured. Run gitme setup first.");
        process.exitCode = 1;
        return;
      }

      // Resolve profile
      let profileName: string | undefined = profileArg;

      if (!profileName) {
        // Try auto-detect via org mapping
        const remote: string | null = getRemoteURL(repoRoot);
        if (remote) {
          const parsed = parseURL(remote);
          if (parsed) {
            clack.log.info(`${symbols.search} Detected remote: ${remote}`);
            const mapped: string | undefined = config.orgMappings[parsed.org];
            if (mapped && config.profiles[mapped]) {
              profileName = mapped;
              clack.log.info(
                `${symbols.search} Org '${parsed.org}' ${symbols.arrow} profile '${mapped}'`,
              );
            }
          }
        }
      }

      if (!profileName) {
        // Interactive picker
        profileName = await selectProfile(config);
      }

      const profile: Profile | undefined = config.profiles[profileName];
      if (!profile) {
        clack.log.warn(`Profile '${profileName}' not found.`);
        process.exitCode = 1;
        return;
      }

      // Check for existing local config that differs
      const existingEmail: string | null = getLocalConfig(repoRoot, "user.email");
      if (existingEmail && existingEmail !== profile.gitEmail) {
        clack.log.message(dim(`Note: overriding existing local email ${existingEmail}`));
      }

      // Rewrite remotes, set local config, register
      setupRepoForProfile(repoRoot, profile, profileName);

      clack.log.success("Registered in repo registry.");
    });
}
