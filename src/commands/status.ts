import type { Command } from "commander";
import * as clack from "@clack/prompts";
import { findRepoRoot, getStatus } from "../lib/git";
import { resolveProfile } from "../lib/profile";
import { dim } from "../lib/ui";

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Git status with identity info")
    .action(() => {
      const cwd: string = process.cwd();
      const repoRoot: string | null = findRepoRoot(cwd);

      if (!repoRoot) {
        clack.log.warn("Not in a git repo.");
        process.exitCode = 1;
        return;
      }

      const { profileName, profile } = resolveProfile(cwd);

      if (profileName && profile) {
        clack.log.message(`Profile: ${profileName} (${profile.gitEmail})`);
      } else {
        clack.log.message(dim("No gitme profile bound. Run gitme init."));
      }

      const status: string | null = getStatus(repoRoot);
      if (status) {
        clack.log.message(status);
      }
    });
}
