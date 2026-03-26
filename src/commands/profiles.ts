import type { Command } from "commander";
import * as clack from "@clack/prompts";
import { loadConfig } from "../lib/config";
import { loadRegistry } from "../lib/registry";
import { table } from "../lib/ui";

export function listProfiles(): void {
  const config = loadConfig();
  const registry = loadRegistry();
  const profileNames: string[] = Object.keys(config.profiles);

  if (profileNames.length === 0) {
    clack.log.warn("No profiles configured. Run gitme setup.");
    return;
  }

  const repoCounts: Record<string, number> = {};
  for (const entry of Object.values(registry)) {
    repoCounts[entry.profile] = (repoCounts[entry.profile] ?? 0) + 1;
  }

  const headers: string[] = ["PROFILE", "USERNAME", "EMAIL", "REPOS", "DEFAULT"];
  const rows: string[][] = profileNames.map((name) => {
    const p = config.profiles[name];
    if (!p) return [name, "", "", "0", ""];
    return [
      name,
      p.githubUsername || "",
      p.gitEmail || "",
      String(repoCounts[name] ?? 0),
      name === config.defaultProfile ? "\u2713" : "",
    ];
  });

  clack.log.message(table(headers, rows));
}

export function registerProfiles(program: Command): void {
  program.command("profiles").description("List all configured profiles").action(listProfiles);
}
