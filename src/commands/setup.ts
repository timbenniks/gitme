import type { Command } from "commander";
import type { Profile, Config } from "../types";
import * as clack from "@clack/prompts";
import { loadConfig, saveConfig, getConfigDir, hasProfiles } from "../lib/config";
import { loadRegistry } from "../lib/registry";
import { scanAll } from "../lib/scan";
import { discoverRepos } from "../lib/discover";
import {
  generateKey,
  keyExists,
  readPublicKey,
  testConnection,
  copyToClipboard,
  readSSHConfig,
  writeSSHConfig,
  upsertHostBlock,
} from "../lib/ssh";
import { setupRepoForProfile } from "../lib/repoSetup";
import { dim, symbols, tildify } from "../lib/ui";
import { gigiCelebrates } from "../lib/gigi";
import { getBanner } from "../lib/brand";
import { checkDependencies } from "../lib/preflight";
import { validateProfileName, validateOrgName } from "../lib/validate";
import { unwrap } from "../lib/cancel";

export function registerSetup(program: Command): void {
  program
    .command("setup")
    .description("Interactive setup wizard")
    .action(async () => {
      if (hasProfiles()) {
        await runExistingSetup();
      } else {
        await runFirstTimeSetup();
      }
    });
}

export async function runFirstTimeSetup(): Promise<void> {
  checkDependencies();
  clack.intro(getBanner());

  // Phase 1: Environment Scan
  const s = clack.spinner();
  s.start("Scanning your existing git setup...");
  const scan = scanAll();
  s.stop("Scan complete");

  const hasExisting = !!(scan.gitConfig.name || scan.gitConfig.email || scan.sshKeys.length > 0);

  if (hasExisting) {
    const lines: string[] = [];
    if (scan.gitConfig.name && scan.gitConfig.email) {
      lines.push(`Git user:    ${scan.gitConfig.name} <${scan.gitConfig.email}>`);
    }
    for (const key of scan.sshKeys) {
      const commentInfo = key.comment ? ` (${key.comment})` : "";
      lines.push(`SSH key:     ${tildify(key.path)}${commentInfo}`);
    }
    if (scan.ghUsernames.length > 0) {
      lines.push(`gh CLI auth: ${scan.ghUsernames.join(", ")}`);
    }
    clack.log.info("Found existing configuration:\n" + lines.map((l) => `  ${l}`).join("\n"));
  } else {
    clack.log.info("No existing git configuration found. Let's start fresh!");
  }

  const config: Config = loadConfig();
  let firstProfileCreated = false;

  // Phase 2: Import or create first profile
  if (hasExisting) {
    const importChoice = unwrap(
      await clack.select({
        message: "Import this as your first profile?",
        options: [
          { label: "Yes, import as 'personal'", value: "import" },
          { label: "Yes, but let me customize it", value: "customize" },
          { label: "No, start fresh", value: "fresh" },
        ],
      }),
    );

    if (importChoice === "import" || importChoice === "customize") {
      let profileName = "personal";
      let gitName = scan.gitConfig.name || "";
      let gitEmail = scan.gitConfig.email || "";
      let githubUsername = scan.ghUsernames[0] ?? "";
      let sshKeyPath = scan.sshKeys[0]?.path ?? "";

      if (importChoice === "customize") {
        profileName = unwrap(
          await clack.text({
            message: "Profile name:",
            defaultValue: "personal",
          }),
        );

        githubUsername = unwrap(
          await clack.text({
            message: "GitHub username:",
            defaultValue: githubUsername,
          }),
        );

        gitName = unwrap(
          await clack.text({
            message: "Full name for commits:",
            defaultValue: gitName,
          }),
        );

        gitEmail = unwrap(
          await clack.text({
            message: "Email for commits:",
            defaultValue: gitEmail,
          }),
        );
      } else if (!githubUsername) {
        githubUsername = unwrap(await clack.text({ message: "GitHub username:" }));
      }

      if (!sshKeyPath) {
        sshKeyPath = await setupSSHKey(profileName, gitEmail);
      }

      const sshHost = `github.com-${profileName}`;
      await setupSSHAlias(profileName, sshHost, sshKeyPath);
      await testSSHConnection(sshHost);
      const githubToken = await askForToken();

      config.profiles[profileName] = {
        githubUsername,
        gitName,
        gitEmail,
        sshKeyPath,
        sshHost,
        githubToken,
      };
      config.defaultProfile = profileName;
      firstProfileCreated = true;

      clack.log.success(`Imported profile '${profileName}'`);
    }
  }

  if (!firstProfileCreated) {
    const profile = await createProfileInteractive();
    config.profiles[profile.name] = profile.data;
    config.defaultProfile = profile.name;
  }

  // Phase 4: Additional profiles
  let addMore = unwrap(
    await clack.confirm({
      message: "Set up another GitHub account?",
      initialValue: false,
    }),
  );

  while (addMore) {
    const profile = await createProfileInteractive();
    config.profiles[profile.name] = profile.data;
    addMore = unwrap(
      await clack.confirm({
        message: "Set up another GitHub account?",
        initialValue: false,
      }),
    );
  }

  // Phase 5: Org mappings
  const profileNames = Object.keys(config.profiles);
  const wantOrgMappings = unwrap(
    await clack.confirm({
      message: "Map GitHub orgs to profiles? (helps gitme clone auto-detect)",
      initialValue: true,
    }),
  );

  if (wantOrgMappings) {
    for (const name of profileNames) {
      let mapMore = true;
      while (mapMore) {
        const org = unwrap(
          await clack.text({
            message: `Map an org to '${name}' (enter to skip):`,
            defaultValue: "",
            validate: validateOrgName,
          }),
        );
        if (!org) break;
        config.orgMappings[org] = name;
      }
    }
  }

  saveConfig(config);

  // Phase 6: Scan existing repos
  const wantScan = unwrap(
    await clack.select({
      message: "Scan for existing git repos to register with gitme?",
      options: [
        { label: "Yes, scan common directories", value: "common" },
        { label: "No, I'll add repos later", value: "skip" },
      ],
    }),
  );

  if (wantScan === "common") {
    const scanSpinner = clack.spinner();
    scanSpinner.start("Scanning for git repos...");
    const repos = discoverRepos(config.orgMappings);
    scanSpinner.stop(`Found ${repos.length} git repos`);

    if (repos.length === 0) {
      clack.log.info("No repos found.");
    } else {
      const repoLines = repos.map((repo) => {
        const profileHint = repo.suggestedProfile
          ? `${symbols.arrow} ${repo.suggestedProfile}`
          : `${symbols.arrow} ?`;
        const repoLabel = repo.org && repo.repo ? `${repo.org}/${repo.repo}` : tildify(repo.path);
        return `${tildify(repo.path).padEnd(40)} ${repoLabel.padEnd(30)} ${profileHint}`;
      });
      clack.log.info("Discovered repos:\n" + repoLines.map((l) => `  ${l}`).join("\n"));

      const registerAll = unwrap(
        await clack.confirm({
          message: "Register these repos?",
          initialValue: true,
        }),
      );

      if (registerAll) {
        let count = 0;
        for (const repo of repos) {
          const profileName = repo.suggestedProfile || config.defaultProfile;
          if (!profileName || !config.profiles[profileName]) continue;
          const profile = config.profiles[profileName];
          if (!profile) continue;
          setupRepoForProfile(repo.path, profile, profileName);
          count++;
        }
        clack.log.success(`Registered ${count} repos`);
      }
    }
  }

  printSummary(config);
  clack.outro(gigiCelebrates());
}

export async function runExistingSetup(): Promise<void> {
  const config: Config = loadConfig();
  const profileCount = Object.keys(config.profiles).length;

  clack.intro(getBanner());
  clack.log.message(`${profileCount} profile${profileCount === 1 ? "" : "s"} configured.`);

  const action = unwrap(
    await clack.select({
      message: "What would you like to do?",
      options: [
        { label: "Edit an existing profile", value: "edit" },
        { label: "Add a new profile", value: "add" },
        { label: "Remove a profile", value: "remove" },
        { label: "Re-scan for existing repos", value: "rescan" },
        { label: "Reset everything", value: "reset" },
      ],
    }),
  );

  if (action === "edit") {
    await editProfileInteractive(config);
  } else if (action === "add") {
    const profile = await createProfileInteractive();
    config.profiles[profile.name] = profile.data;
    saveConfig(config);
    clack.log.success(`Profile '${profile.name}' created.`);
  } else if (action === "remove") {
    await removeProfileInteractive(config);
  } else if (action === "rescan") {
    const s = clack.spinner();
    s.start("Scanning for git repos...");
    const repos = discoverRepos(config.orgMappings);
    s.stop("Scan complete");

    const registry = loadRegistry();
    const unregistered = repos.filter((r) => !registry[r.path]);

    if (unregistered.length === 0) {
      clack.log.info("All found repos are already registered.");
    } else {
      clack.log.info(`Found ${unregistered.length} unregistered repos.`);
      const registerAll = unwrap(
        await clack.confirm({ message: "Register them?", initialValue: true }),
      );
      if (registerAll) {
        for (const repo of unregistered) {
          const profileName = repo.suggestedProfile || config.defaultProfile;
          if (!profileName || !config.profiles[profileName]) continue;
          const profile = config.profiles[profileName];
          if (!profile) continue;
          setupRepoForProfile(repo.path, profile, profileName);
        }
        clack.log.success(`Registered ${unregistered.length} repos.`);
      }
    }
  } else if (action === "reset") {
    const sure = unwrap(
      await clack.confirm({
        message: "This will delete all gitme config. Are you sure?",
        initialValue: false,
      }),
    );
    if (sure) {
      const fs = await import("node:fs");
      const configDir = getConfigDir();
      fs.rmSync(configDir, { recursive: true, force: true });
      clack.log.success("gitme config reset. Run gitme to start fresh.");
    }
  }

  clack.outro("Done");
}

async function createProfileInteractive(): Promise<{ name: string; data: Profile }> {
  const name = unwrap(
    await clack.text({
      message: "Profile name (e.g. personal, work):",
      validate: validateProfileName,
    }),
  );

  const githubUsername = unwrap(await clack.text({ message: "GitHub username:" }));

  const gitName = unwrap(await clack.text({ message: "Full name for commits:" }));

  const gitEmail = unwrap(await clack.text({ message: "Email for commits:" }));

  const sshKeyPath = await setupSSHKey(name, gitEmail);
  const sshHost = `github.com-${name}`;
  await setupSSHAlias(name, sshHost, sshKeyPath);
  await testSSHConnection(sshHost);
  const githubToken = await askForToken();

  const wantOrg = unwrap(
    await clack.confirm({
      message: `Map a GitHub org to '${name}'?`,
      initialValue: false,
    }),
  );

  if (wantOrg) {
    const org = unwrap(await clack.text({ message: "Org name:" }));
    if (org) {
      const config: Config = loadConfig();
      config.orgMappings[org] = name;
      saveConfig(config);
    }
  }

  return { name, data: { githubUsername, gitName, gitEmail, sshKeyPath, sshHost, githubToken } };
}

async function editProfileInteractive(config: Config): Promise<void> {
  const profileNames = Object.keys(config.profiles);
  if (profileNames.length === 0) {
    clack.log.warn("No profiles to edit. Run gitme setup to create one.");
    return;
  }

  const name = unwrap(
    await clack.select({
      message: "Which profile to edit?",
      options: profileNames.map((n) => {
        const p = config.profiles[n];
        return { label: n, hint: p?.gitEmail ?? "", value: n };
      }),
    }),
  );

  const existing = config.profiles[name];
  if (!existing) return;

  clack.log.info(
    `Profile: ${name}\n` +
      [
        `  GitHub username: ${existing.githubUsername}`,
        `  Git name:        ${existing.gitName}`,
        `  Git email:       ${existing.gitEmail}`,
        `  SSH key:         ${tildify(existing.sshKeyPath)}`,
        `  SSH host:        ${existing.sshHost}`,
        `  GitHub token:    ${existing.githubToken ? "configured" : "not set"}`,
      ].join("\n"),
  );

  const field = unwrap(
    await clack.select({
      message: "What do you want to change?",
      options: [
        { label: "GitHub username", value: "githubUsername" },
        { label: "Git name (for commits)", value: "gitName" },
        { label: "Git email (for commits)", value: "gitEmail" },
        { label: "SSH key", value: "sshKeyPath" },
        { label: "GitHub API token", value: "githubToken" },
        { label: "Everything (re-configure)", value: "all" },
      ],
    }),
  );

  if (field === "all") {
    const githubUsername = unwrap(
      await clack.text({
        message: "GitHub username:",
        defaultValue: existing.githubUsername,
      }),
    );

    const gitName = unwrap(
      await clack.text({
        message: "Full name for commits:",
        defaultValue: existing.gitName,
      }),
    );

    const gitEmail = unwrap(
      await clack.text({
        message: "Email for commits:",
        defaultValue: existing.gitEmail,
      }),
    );

    const sshKeyPath = await setupSSHKey(name, gitEmail);
    await setupSSHAlias(name, existing.sshHost, sshKeyPath);
    await testSSHConnection(existing.sshHost);
    const githubToken = await askForToken();

    config.profiles[name] = {
      githubUsername,
      gitName,
      gitEmail,
      sshKeyPath,
      sshHost: existing.sshHost,
      githubToken,
    };
  } else if (field === "sshKeyPath") {
    const sshKeyPath = await setupSSHKey(name, existing.gitEmail);
    await setupSSHAlias(name, existing.sshHost, sshKeyPath);
    await testSSHConnection(existing.sshHost);
    existing.sshKeyPath = sshKeyPath;
  } else if (field === "githubToken") {
    const token = await askForToken();
    existing.githubToken = token;
  } else {
    const value = unwrap(
      await clack.text({
        message: `New ${field}:`,
        defaultValue: existing[field as keyof typeof existing] as string,
      }),
    );
    (existing as unknown as Record<string, string | null>)[field] = value;
  }

  saveConfig(config);
  clack.log.success(`Profile '${name}' updated.`);
}

async function removeProfileInteractive(config: Config): Promise<void> {
  const profileNames = Object.keys(config.profiles);
  if (profileNames.length === 0) {
    clack.log.warn("No profiles to remove.");
    return;
  }

  if (profileNames.length === 1) {
    clack.log.warn("Can't remove your only profile. Use 'Reset everything' instead.");
    return;
  }

  const name = unwrap(
    await clack.select({
      message: "Which profile to remove?",
      options: profileNames.map((n) => {
        const p = config.profiles[n];
        return { label: n, hint: p?.gitEmail ?? "", value: n };
      }),
    }),
  );

  const sure = unwrap(
    await clack.confirm({
      message: `Delete profile '${name}'? This removes the SSH config block but keeps the key file.`,
      initialValue: false,
    }),
  );
  if (!sure) return;

  // Remove SSH config block
  const existing = config.profiles[name];
  if (existing) {
    const { removeHostBlock } = await import("../lib/ssh");
    const sshContent = readSSHConfig();
    const updated = removeHostBlock(sshContent, name);
    writeSSHConfig(updated);
    clack.log.info(`Removed SSH alias '${existing.sshHost}' from ~/.ssh/config`);
  }

  // Remove org mappings pointing to this profile
  for (const [org, profile] of Object.entries(config.orgMappings)) {
    if (profile === name) {
      delete config.orgMappings[org];
      clack.log.info(`Removed org mapping: ${org}`);
    }
  }

  // Update default if needed
  if (config.defaultProfile === name) {
    const remaining = Object.keys(config.profiles).filter((n) => n !== name);
    config.defaultProfile = remaining[0] ?? null;
    if (config.defaultProfile) {
      clack.log.info(`Default profile changed to '${config.defaultProfile}'`);
    }
  }

  delete config.profiles[name];
  saveConfig(config);
  clack.log.success(`Profile '${name}' removed.`);
}

async function setupSSHKey(profileName: string, email: string): Promise<string> {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const defaultKeyPath = `${home}/.ssh/gitme_${profileName}`;
  const existingKeyFound = keyExists(defaultKeyPath);

  const options: { label: string; value: string }[] = [];
  if (existingKeyFound) {
    options.push({ label: `Keep existing key (${tildify(defaultKeyPath)})`, value: "keep" });
  }
  options.push({ label: "Generate a new key", value: "generate" });
  options.push({ label: "Use a different existing key", value: "existing" });

  const choice = unwrap(await clack.select({ message: "SSH key for this profile:", options }));

  if (choice === "keep") {
    clack.log.info(`Keeping existing key: ${tildify(defaultKeyPath)}`);
    return defaultKeyPath;
  }

  if (choice === "generate") {
    const keyPath = defaultKeyPath;

    const s = clack.spinner();
    s.start("Generating SSH key...");
    generateKey(email, keyPath);
    s.stop(`Created: ${tildify(keyPath)}`);

    const pubKey = readPublicKey(keyPath);
    const copied = copyToClipboard(pubKey);

    const label = copied ? `${symbols.clipboard} Public key (copied to clipboard):` : "Public key:";
    clack.log.info(`${label}\n  ${pubKey}`);
    clack.log.message(
      `${symbols.arrow} Add this key to GitHub: https://github.com/settings/ssh/new`,
    );

    const openBrowser = unwrap(
      await clack.confirm({ message: "Open browser?", initialValue: true }),
    );
    if (openBrowser) {
      try {
        const { execFileSync } = await import("node:child_process");
        const url = "https://github.com/settings/ssh/new";
        const platform = process.platform;
        if (platform === "darwin") execFileSync("open", [url]);
        else if (platform === "win32") execFileSync("cmd", ["/c", "start", url]);
        else execFileSync("xdg-open", [url]);
      } catch {
        /* ignore — browser open is best-effort */
      }
    }

    unwrap(
      await clack.confirm({
        message: "Have you added the key to GitHub?",
        initialValue: true,
      }),
    );

    return keyPath;
  }

  const keyPath = unwrap(await clack.text({ message: "Path to private SSH key:" }));
  return keyPath;
}

async function setupSSHAlias(profileName: string, sshHost: string, keyPath: string): Promise<void> {
  clack.log.info(
    `${symbols.link} Creating SSH alias '${sshHost}' ${symbols.arrow} ${tildify(keyPath)}`,
  );
  const content = readSSHConfig();
  const updated = upsertHostBlock(content, profileName, sshHost, keyPath);
  writeSSHConfig(updated);
}

async function testSSHConnection(sshHost: string): Promise<void> {
  const wantTest = unwrap(await clack.confirm({ message: "Test connection?", initialValue: true }));
  if (!wantTest) return;

  const s = clack.spinner();
  s.start(`Testing ssh -T git@${sshHost}...`);
  const username = testConnection(sshHost);
  s.stop(
    username
      ? `Authenticated as ${username}`
      : "Could not verify. You may need to add the key to GitHub.",
  );
}

async function askForToken(): Promise<string | null> {
  const wantToken = unwrap(
    await clack.confirm({
      message: "Add a GitHub personal access token? (needed for gitme pr/issue)",
      initialValue: false,
    }),
  );
  if (!wantToken) return null;

  clack.log.message(`${symbols.arrow} Create a token at: https://github.com/settings/tokens`);
  clack.log.message(dim("Scopes needed: repo"));

  const token = unwrap(await clack.text({ message: "Paste token:" }));
  return token || null;
}

function printSummary(config: Config): void {
  const registry = loadRegistry();
  const repoCounts: Record<string, number> = {};
  for (const entry of Object.values(registry)) {
    repoCounts[entry.profile] = (repoCounts[entry.profile] ?? 0) + 1;
  }

  const profileLines = Object.entries(config.profiles).map(([name, profile]) => {
    const count = repoCounts[name] ?? 0;
    const def = name === config.defaultProfile ? " (default)" : "";
    return `${name.padEnd(14)} ${profile.githubUsername.padEnd(14)} ${profile.gitEmail.padEnd(25)} ${count} repos${def}`;
  });
  clack.log.info("Profiles:\n" + profileLines.map((l) => `  ${l}`).join("\n"));

  const orgEntries = Object.entries(config.orgMappings);
  if (orgEntries.length > 0) {
    const orgLines = orgEntries.map(([org, profile]) => `${org} ${symbols.arrow} ${profile}`);
    clack.log.info("Org mappings:\n" + orgLines.map((l) => `  ${l}`).join("\n"));
  }

  clack.log.message(
    dim(
      [
        "Quick reference:",
        "  gitme              Dashboard (in a repo) or menu (outside)",
        "  gitme clone <url>  Clone with the right identity",
        "  gitme whoami       Check current identity",
        "  gitme repos        See all managed repos",
        "  gitme setup        Add another profile",
      ].join("\n"),
    ),
  );
}
