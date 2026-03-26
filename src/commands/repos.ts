import type { Command } from "commander";
import type { RegistryEntry } from "../types";
import fs from "node:fs";
import * as clack from "@clack/prompts";
import { loadRegistry, saveRegistry, unregisterRepo } from "../lib/registry";
import { findRepoRoot } from "../lib/git";
import { table, tildify, relativeTime, dim } from "../lib/ui";
import { unwrap } from "../lib/cancel";

export function listRepos(profileFilter?: string): void {
  const registry = loadRegistry();
  let entries: [string, RegistryEntry][] = Object.entries(registry);

  if (profileFilter) {
    entries = entries.filter(([, e]) => e.profile === profileFilter);
  }

  if (entries.length === 0) {
    clack.log.warn("No repos registered. Use gitme clone or gitme init.");
    return;
  }

  const headers: string[] = ["PROFILE", "REPO", "PATH", "CLONED"];
  const rows: string[][] = entries.map(([absPath, e]) => {
    const repoLabel: string = e.org && e.repo ? `${e.org}/${e.repo}` : absPath;
    return [e.profile, repoLabel, tildify(absPath), e.clonedAt ? relativeTime(e.clonedAt) : ""];
  });

  clack.log.message(table(headers, rows));

  const profiles = new Set(entries.map(([, e]) => e.profile));
  clack.log.message(
    dim(`${entries.length} repos across ${profiles.size} profile${profiles.size === 1 ? "" : "s"}`),
  );
}

export function checkRepos(): void {
  const registry = loadRegistry();
  const entries: [string, RegistryEntry][] = Object.entries(registry);

  if (entries.length === 0) {
    clack.log.warn("No repos registered. Use gitme clone or gitme init.");
    return;
  }

  let healthy = 0;
  let stale = 0;

  for (const [absPath, e] of entries) {
    const exists = fs.existsSync(absPath);
    const repoLabel = e.org && e.repo ? `${e.org}/${e.repo}` : absPath;
    if (exists) {
      clack.log.success(`${repoLabel}  ${tildify(absPath)}`);
      healthy++;
    } else {
      clack.log.error(`${repoLabel}  ${tildify(absPath)} ${dim("(directory not found)")}`);
      stale++;
    }
  }

  if (stale > 0) {
    clack.log.message(
      dim(
        `${healthy}/${entries.length} repos healthy. Run 'gitme repos --clean' to remove stale entries.`,
      ),
    );
  } else {
    clack.log.message(dim(`${healthy}/${entries.length} repos healthy.`));
  }
}

function cleanRepos(): void {
  const registry = loadRegistry();
  const entries: [string, RegistryEntry][] = Object.entries(registry);

  if (entries.length === 0) {
    clack.log.warn("No repos registered.");
    return;
  }

  let removed = 0;
  for (const [absPath] of entries) {
    if (!fs.existsSync(absPath)) {
      delete registry[absPath];
      removed++;
    }
  }

  if (removed > 0) {
    saveRegistry(registry);
    clack.log.success(`Removed ${removed} stale entr${removed === 1 ? "y" : "ies"}.`);
  } else {
    clack.log.message(dim("All repos exist on disk. Nothing to clean."));
  }
}

export function registerRepos(program: Command): void {
  const reposCmd = program
    .command("repos")
    .description("List and manage registered repos")
    .option("-p, --profile <name>", "Filter by profile")
    .option("--check", "Verify all repos exist on disk")
    .option("--clean", "Remove stale entries")
    .option("--json", "Output as JSON")
    .action((opts: { profile?: string; check?: boolean; clean?: boolean; json?: boolean }) => {
      if (opts.json) {
        const registry = loadRegistry();
        let entries: [string, RegistryEntry][] = Object.entries(registry);
        if (opts.profile) entries = entries.filter(([, e]) => e.profile === opts.profile);
        console.log(JSON.stringify(Object.fromEntries(entries), null, 2));
        return;
      }
      if (opts.check) return checkRepos();
      if (opts.clean) return cleanRepos();
      listRepos(opts.profile);
    });

  reposCmd
    .command("remove [path]")
    .alias("rm")
    .description("Unregister a repo (from cwd or by path)")
    .action(async (pathArg?: string) => {
      let repoPath = pathArg;

      if (!repoPath) {
        const repoRoot = findRepoRoot(process.cwd());
        if (repoRoot) repoPath = repoRoot;
      }

      if (!repoPath) {
        const registry = loadRegistry();
        const entries = Object.entries(registry);
        if (entries.length === 0) {
          clack.log.warn("No repos registered.");
          return;
        }

        const selected = unwrap(
          await clack.select({
            message: "Which repo to unregister?",
            options: entries.map(([absPath, e]) => ({
              label: e.org && e.repo ? `${e.org}/${e.repo}` : tildify(absPath),
              hint: tildify(absPath),
              value: absPath,
            })),
          }),
        );
        repoPath = selected as string;
      }

      const registry = loadRegistry();
      if (!registry[repoPath]) {
        clack.log.warn(`Repo not found in registry: ${tildify(repoPath)}`);
        return;
      }

      const entry = registry[repoPath]!;
      const repoLabel = entry.org && entry.repo ? `${entry.org}/${entry.repo}` : tildify(repoPath);

      const sure = unwrap(
        await clack.confirm({
          message: `Unregister ${repoLabel}? (the repo files stay on disk)`,
          initialValue: false,
        }),
      );
      if (!sure) return;

      unregisterRepo(repoPath);
      clack.log.success(`Unregistered ${repoLabel}`);
    });
}
