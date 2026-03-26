import type { Command } from "commander";
import type { Profile } from "../types";
import path from "node:path";
import * as clack from "@clack/prompts";
import { clone as gitClone, setLocalConfig } from "../lib/git";
import { loadConfig, saveConfig } from "../lib/config";
import { registerRepo } from "../lib/registry";
import { selectProfile } from "../lib/prompts";
import { parseURL, toSSH } from "../lib/url";
import { symbols } from "../lib/ui";
import { gigiCelebrates } from "../lib/gigi";
import { unwrap } from "../lib/cancel";

export function registerClone(program: Command): void {
  program
    .command("clone <url> [directory]")
    .description("Clone a repo with the right identity")
    .action(async (url: string, directory?: string) => {
      const parsed = parseURL(url);
      if (!parsed) {
        clack.log.error(`Could not parse URL: ${url}`);
        clack.log.message(
          "Supported formats:\n  git@github.com:org/repo.git\n  https://github.com/org/repo\n  org/repo",
        );
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

      // Resolve profile via org mapping
      let profileName: string | null = config.orgMappings[parsed.org] ?? null;

      if (profileName) {
        clack.log.info(
          `${symbols.search} Detected org: ${parsed.org} ${symbols.arrow} profile '${profileName}'`,
        );
      } else {
        // Interactive picker
        profileName = await selectProfile(
          config,
          `Which profile for ${parsed.org}/${parsed.repo}?`,
        );

        // Offer to remember org mapping
        const remember = unwrap(
          await clack.confirm({
            message: `Remember this for all '${parsed.org}' repos?`,
            initialValue: true,
          }),
        );

        if (remember) {
          config.orgMappings[parsed.org] = profileName;
          saveConfig(config);
        }
      }

      const profile: Profile | undefined = config.profiles[profileName];
      if (!profile) {
        clack.log.error(`Profile '${profileName}' not found.`);
        process.exitCode = 1;
        return;
      }

      // Rewrite URL to use SSH host alias
      const cloneURL: string = toSSH(parsed, profile.sshHost);

      // Clone
      const s = clack.spinner();
      s.start(`Cloning ${parsed.org}/${parsed.repo}...`);
      let repoDir: string;
      try {
        repoDir = gitClone(cloneURL, directory);
        s.stop(`Cloned ${parsed.org}/${parsed.repo}`);
      } catch (err: unknown) {
        s.stop("Clone failed");
        clack.log.error((err as Error).message);
        process.exitCode = 1;
        return;
      }

      // Set local git config
      const absPath: string = path.resolve(repoDir);
      setLocalConfig(absPath, "user.name", profile.gitName);
      setLocalConfig(absPath, "user.email", profile.gitEmail);

      // Register
      registerRepo(absPath, {
        profile: profileName,
        remote: cloneURL,
        org: parsed.org,
        repo: parsed.repo,
      });

      clack.log.success(`Cloned as '${profileName}' (${profile.gitEmail})`);
      clack.log.success("Registered in repo registry");
      clack.log.message(gigiCelebrates());
    });
}
