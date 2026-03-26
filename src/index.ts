import { Command } from "commander";
import * as clack from "@clack/prompts";
import { checkDependencies } from "./lib/preflight";
import { setVerbose } from "./lib/verbose";
import path from "node:path";
import type { RegistryEntry, Profile } from "./types";
import { registerWhoami } from "./commands/whoami";
import { registerStatus } from "./commands/status";
import { registerProfiles, listProfiles } from "./commands/profiles";
import { registerRepos, listRepos, checkRepos } from "./commands/repos";
import { registerInit } from "./commands/init";
import { registerClone } from "./commands/clone";
import { registerConfig, listOrgMappings } from "./commands/config";
import { registerSetup, runFirstTimeSetup, runExistingSetup } from "./commands/setup";
import { registerPR } from "./commands/pr";
import { registerIssue } from "./commands/issue";
import { registerGigi } from "./commands/gigi";
import { configExists, hasProfiles, loadConfig } from "./lib/config";
import { findRepoInRegistry, loadRegistry } from "./lib/registry";
import { findRepoRoot, getRemoteURL, getBranch, getTrackingBranch } from "./lib/git";
import { selectProfile } from "./lib/prompts";
import { setupRepoForProfile } from "./lib/repoSetup";
import { bold, dim, symbols, identityBox, profileBadge } from "./lib/ui";
import { getBanner, printWelcomeAnimated, printLogo } from "./lib/brand";
import { gigiSays } from "./lib/gigi";
import { unwrap } from "./lib/cancel";

const program = new Command();

program
  .name("gitme")
  .description(
    "Multi-account GitHub CLI — manage SSH keys, git identities, and GitHub auth per repo",
  )
  .version("0.1.0")
  .option("--verbose", "Show detailed output for debugging")
  .addHelpText("beforeAll", "");

// Register commands (for direct CLI use: gitme <command>)
registerWhoami(program);
registerStatus(program);
registerProfiles(program);
registerRepos(program);
registerInit(program);
registerClone(program);
registerConfig(program);
registerSetup(program);
registerPR(program);
registerIssue(program);
registerGigi(program);

// Context-aware default action (bare `gitme` with no subcommand)
program.action(async () => {
  const opts = program.opts();
  if (opts.verbose) setVerbose(true);
  checkDependencies();

  if (!configExists() || !hasProfiles()) {
    await printWelcomeAnimated();
    await runFirstTimeSetup();
    return;
  }

  const cwd = process.cwd();
  const repoRoot = findRepoRoot(cwd);

  if (repoRoot) {
    const registered = findRepoInRegistry(cwd);
    if (registered) {
      showDashboard(repoRoot, registered);
    } else {
      await showAdoptPrompt(repoRoot);
    }
  } else {
    await showHubMenu();
  }
});

function showDashboard(
  repoRoot: string,
  registered: { absPath: string; entry: RegistryEntry },
): void {
  const config = loadConfig();
  const profileName = registered.entry.profile;
  const profile: Profile | undefined = config.profiles[profileName];
  const repoName = path.basename(repoRoot);
  const branch = getBranch(repoRoot) || "unknown";
  const tracking = getTrackingBranch(repoRoot);

  let branchInfo = branch;
  if (tracking) {
    branchInfo += ` \u2190 ${tracking}`;
  }

  console.log(
    identityBox(
      `${symbols.pin} ${bold(repoName)}\n` +
        `${symbols.person}  ${profileBadge(profileName)} (${profile?.gitEmail || "unknown"})\n` +
        `${symbols.branch}  ${branchInfo}`,
    ),
  );

  clack.log.message(gigiSays());

  clack.log.message(
    dim(
      "Quick actions:\n  gitme whoami   Full identity details\n  gitme status   Git status with identity\n  gitme pr list  List PRs",
    ),
  );
}

async function showAdoptPrompt(repoRoot: string): Promise<void> {
  const remote = getRemoteURL(repoRoot);
  let warnMsg = "This repo isn't managed by gitme yet.";
  if (remote) {
    warnMsg += `\n${symbols.search} Detected remote: ${remote}`;
  }
  clack.log.warn(warnMsg);

  const wantSetup = unwrap(await clack.confirm({ message: "Set it up now?", initialValue: true }));
  if (!wantSetup) return;

  const config = loadConfig();
  const profileName = await selectProfile(config);
  const profile = config.profiles[profileName];
  if (!profile) return;

  setupRepoForProfile(repoRoot, profile, profileName);
  clack.log.success("Registered in repo registry.");
}

async function showHubMenu(): Promise<void> {
  clack.intro(getBanner());

  const config = loadConfig();
  const profileCount = Object.keys(config.profiles).length;
  const registry = loadRegistry();
  const repoCount = Object.keys(registry).length;

  clack.log.message(
    bold(
      `${profileCount} profile${profileCount === 1 ? "" : "s"}, ${repoCount} repo${repoCount === 1 ? "" : "s"}`,
    ),
  );

  const action = unwrap(
    await clack.select({
      message: "What would you like to do?",
      options: [
        { label: "Clone a repo", value: "clone" },
        { label: "View all repos", value: "repos" },
        { label: "View profiles", value: "profiles" },
        { label: "Manage profiles", value: "setup" },
        { label: "Manage org mappings", value: "orgs" },
        { label: "Run health check", value: "check" },
      ],
    }),
  );

  switch (action) {
    case "clone": {
      const url = unwrap(await clack.text({ message: "Repo URL:" }));
      if (!url) break;
      // Delegate to commander for clone (it has complex logic with spinners)
      program.parse(["node", "gitme", "clone", url]);
      break;
    }
    case "repos":
      listRepos();
      break;
    case "profiles":
      listProfiles();
      break;
    case "setup":
      await runExistingSetup();
      break;
    case "orgs":
      listOrgMappings();
      break;
    case "check":
      checkRepos();
      break;
  }

  clack.outro(gigiSays());
}

export function run(): void {
  // Only show logo for bare `gitme` (no subcommand), and skip on first-run
  const args = process.argv.slice(2);
  const hasSubcommand = args.length > 0 && !args[0]?.startsWith("-");
  if (!hasSubcommand && configExists() && hasProfiles()) {
    printLogo();
  }
  program.parse();
}
