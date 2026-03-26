import type { Command } from "commander";
import fs from "node:fs";
import * as clack from "@clack/prompts";
import { findRepoRoot, getRemoteURL, getLocalConfig } from "../lib/git";
import { resolveProfile } from "../lib/profile";
import { symbols, success, warn, tildify, bold, identityBox, profileBadge } from "../lib/ui";
import { gigiSays } from "../lib/gigi";
import path from "node:path";

export function registerWhoami(program: Command): void {
  program
    .command("whoami")
    .description("Show the active identity for the current repo")
    .action(() => {
      const cwd: string = process.cwd();
      const repoRoot: string | null = findRepoRoot(cwd);

      if (!repoRoot) {
        clack.log.warn(
          "Not in a git repo, or no gitme profile bound.\n    Run 'gitme init' to bind this repo to a profile.",
        );
        process.exitCode = 1;
        return;
      }

      const { profileName, profile } = resolveProfile(cwd);
      const repoName: string = path.basename(repoRoot);
      const remote: string = getRemoteURL(repoRoot) || "none";
      const localEmail: string | null = getLocalConfig(repoRoot, "user.email");
      const localName: string | null = getLocalConfig(repoRoot, "user.name");

      const lines: string[] = [];
      lines.push(`${symbols.pin} Repository:  ${bold(repoName)}`);

      if (profileName && profile) {
        const keyExists: boolean = profile.sshKeyPath
          ? fs.existsSync(profile.sshKeyPath.replace(/^~/, process.env.HOME ?? ""))
          : false;
        const keyStatus: string = keyExists ? success("valid") : warn("not found");
        const tokenStatus: string = profile.githubToken
          ? success("token configured")
          : "not configured";

        lines.push(`${symbols.person} Profile:     ${profileBadge(profileName)}`);
        lines.push(`${symbols.email} Email:       ${localEmail || profile.gitEmail}`);
        lines.push(`${symbols.name} Name:        ${localName || profile.gitName}`);
        lines.push(
          `${symbols.key} SSH key:     ${tildify(profile.sshKeyPath || "none")} (${keyStatus})`,
        );
        lines.push(`${symbols.link} Remote:      ${remote}`);
        lines.push(`${symbols.lock} GitHub API:  ${tokenStatus}`);
      } else {
        lines.push(`${symbols.person} Profile:     ${warn("none — run gitme init")}`);
        lines.push(`${symbols.email} Email:       ${localEmail || "not set"}`);
        lines.push(`${symbols.name} Name:        ${localName || "not set"}`);
        lines.push(`${symbols.link} Remote:      ${remote}`);
      }

      console.log(identityBox(lines.join("\n")));
      clack.log.message(gigiSays());
    });
}
