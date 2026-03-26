import type { Command } from "commander";
import type { Profile } from "../types";
import * as clack from "@clack/prompts";
import { loadConfig, saveConfig } from "../lib/config";
import { isValidOrgName } from "../lib/validate";
import { dim, table } from "../lib/ui";

export function listOrgMappings(): void {
  const config = loadConfig();
  const entries: [string, string][] = Object.entries(config.orgMappings);
  if (entries.length === 0) {
    clack.log.message(dim("No org mappings configured."));
    return;
  }
  const headers: string[] = ["ORG", "PROFILE"];
  const rows: string[][] = entries.map(([o, p]) => [o, p]);
  clack.log.message(table(headers, rows));
}

export function registerConfig(program: Command): void {
  const configCmd = program.command("config").description("Manage global settings");

  // gitme config default <profile>
  configCmd
    .command("default <profile>")
    .description("Set the default profile")
    .action((profileName: string) => {
      const config = loadConfig();
      if (!config.profiles[profileName]) {
        clack.log.error(`Profile '${profileName}' does not exist.`);
        clack.log.message(dim(`Available: ${Object.keys(config.profiles).join(", ")}`));
        process.exitCode = 1;
        return;
      }

      config.defaultProfile = profileName;
      saveConfig(config);
      clack.log.success(`Default profile set to '${profileName}'`);
    });

  // gitme config org
  const orgCmd = configCmd.command("org").description("Manage org-to-profile mappings");

  // gitme config org add <org> <profile>
  orgCmd
    .command("add <org> <profile>")
    .description("Map a GitHub org to a profile")
    .action((org: string, profile: string) => {
      if (!isValidOrgName(org)) {
        clack.log.error("Invalid org name. Use only letters, numbers, dashes, or underscores.");
        process.exitCode = 1;
        return;
      }

      const config = loadConfig();
      if (!config.profiles[profile]) {
        clack.log.error(`Profile '${profile}' does not exist.`);
        process.exitCode = 1;
        return;
      }

      config.orgMappings[org] = profile;
      saveConfig(config);
      clack.log.success(`Mapped org '${org}' \u2192 profile '${profile}'`);
    });

  // gitme config org remove <org>
  orgCmd
    .command("remove <org>")
    .alias("rm")
    .description("Remove an org mapping")
    .action((org: string) => {
      const config = loadConfig();
      if (!config.orgMappings[org]) {
        clack.log.warn(`No mapping found for org '${org}'.`);
        return;
      }

      const profile = config.orgMappings[org];
      delete config.orgMappings[org];
      saveConfig(config);
      clack.log.success(`Removed mapping: ${org} \u2192 ${profile}`);
    });

  // gitme config org list
  orgCmd.command("list").alias("ls").description("List all org mappings").action(listOrgMappings);

  // gitme config list
  configCmd
    .command("list")
    .description("Show all settings")
    .action(() => {
      const config = loadConfig();

      const lines: string[] = [];
      lines.push(`Default profile: ${config.defaultProfile || dim("none")}`);

      const profileNames: string[] = Object.keys(config.profiles);
      if (profileNames.length > 0) {
        lines.push("");
        lines.push("Profiles:");
        for (const name of profileNames) {
          const p: Profile | undefined = config.profiles[name];
          if (!p) continue;
          const def: string = name === config.defaultProfile ? " (default)" : "";
          lines.push(`  ${name}${def} \u2014 ${p.githubUsername} <${p.gitEmail}>`);
        }
      }

      const orgEntries: [string, string][] = Object.entries(config.orgMappings);
      if (orgEntries.length > 0) {
        lines.push("");
        lines.push("Org mappings:");
        for (const [org, profile] of orgEntries) {
          lines.push(`  ${org} \u2192 ${profile}`);
        }
      }

      clack.log.message(lines.join("\n"));
    });
}
