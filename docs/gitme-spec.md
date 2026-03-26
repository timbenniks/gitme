# gitme — Multi-Account GitHub CLI

## Overview

`gitme` is a Node.js CLI tool that makes it painless to work with multiple GitHub accounts on a single machine. It manages SSH keys, git identities, and `gh` CLI auth on a per-repo basis, so you never accidentally commit or push as the wrong person.

### The Key Principle: Transparent to All Tools

**Once a repo is set up with gitme, you never need gitme again for daily operations.** Normal `git commit`, `git push`, VS Code, JetBrains, Claude Code, GitHub Desktop — they all just work, automatically using the correct identity and SSH key.

This works because gitme configures things at the **git and SSH level**, not by wrapping commands:

- **Commits use the right identity** because `gitme` sets `user.name` and `user.email` in the repo's local `.git/config`. Every tool that creates a commit reads this config. Local config always overrides global `~/.gitconfig`.

- **Push/pull use the right SSH key** because the remote URL contains the SSH host alias (e.g., `git@github.com-work:org/repo.git`). When any tool runs `git push`, SSH matches `github.com-work` in `~/.ssh/config` and uses the correct key. No wrappers, no environment variables, no magic.

`gitme` is a **setup and management tool**, not a runtime dependency. Set up once, then forget about it — every IDE, terminal, CI script, and AI assistant respects the configuration automatically.

---

## The Problem

When you have both a personal and work GitHub account, every git operation becomes a landmine. You might commit with the wrong email, push with the wrong SSH key, or clone into a directory that's configured for the wrong account. Existing solutions (conditional `.gitconfig` includes, SSH host aliases) are fragile, invisible when misconfigured, and painful to set up from scratch.

`gitme` solves this by configuring git and SSH at the repo level — setting local identity, rewriting remotes to use per-account SSH host aliases, and maintaining a central repo registry. Once set up, every tool (VS Code, terminal, Claude, etc.) automatically uses the right account. No wrappers, no runtime dependency.

---

## Core Concepts

### Profiles

A **profile** is a named GitHub identity consisting of:

- **Name**: A human-friendly label (e.g., `personal`, `work`)
- **GitHub username**: The GitHub account username
- **Git name**: Full name for commits (e.g., `Tim Benniks`)
- **Git email**: Email for commits (e.g., `tbenniks@gmail.com` or `tim@work.com`)
- **SSH key path**: Path to the private SSH key for this account
- **SSH host alias**: The SSH config alias (e.g., `github.com-personal`)
- **GitHub personal access token** (optional): For GitHub API operations (PRs, issues, etc.) under this profile

Profiles are stored in `~/.gitme/config.json`.

### Central Repo Registry

Instead of scattering config files inside each repo, `gitme` maintains a single registry at `~/.gitme/repos.json`. This maps absolute repo paths to profiles:

```json
{
  "/Users/tim/work/api-service": {
    "profile": "work",
    "remote": "git@github.com-work:acme-corp/api-service.git",
    "clonedAt": "2026-03-25T10:30:00Z"
  },
  "/Users/tim/personal/my-site": {
    "profile": "personal",
    "remote": "git@github.com-personal:tbenniks/my-site.git",
    "clonedAt": "2026-03-20T14:00:00Z"
  }
}
```

When you run any `gitme` command, it resolves the current working directory against this registry to determine the active profile.

**Why a central registry instead of per-repo files:**

1. **Bird's-eye view** — `gitme repos` can list all managed repos, their profiles, and status at a glance.
2. **No pollution** — Nothing is written into the repo. No gitignore, no hidden files, no conflicts with team members who don't use gitme.
3. **Survives fresh clones** — If you delete and re-clone a repo to the same path, the mapping persists. (And `gitme clone` always registers automatically.)
4. **Searchable and auditable** — Easy to grep, script against, or build tooling on top of.
5. **Portable** — Back up or sync `~/.gitme/` to share your setup across machines.
6. **Enables future features** — Repo tagging, grouping, bulk operations, health checks across all repos.

**Path resolution:** When looking up the current repo, `gitme` resolves symlinks and normalizes the path before matching. It also traverses up from the current directory to find the repo root (via `.git` detection), so it works from any subdirectory within a repo.

### SSH Host Aliases

This is the core mechanism that makes multi-account SSH work. Instead of all repos using `github.com`, each profile gets its own SSH alias:

```
# ~/.ssh/config (managed by gitme — do not edit this block manually)

# gitme:personal
Host github.com-personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/gitme_personal
  IdentitiesOnly yes

# gitme:work
Host github.com-work
  HostName github.com
  User git
  IdentityFile ~/.ssh/gitme_work
  IdentitiesOnly yes
```

When you clone or set up a repo with `gitme`, it rewrites the remote URL to use the correct alias:

```
git@github.com-work:acme-corp/my-project.git
```

This ensures git uses the right SSH key without any ambient state or agent magic. The `# gitme:<profile>` comments allow gitme to manage its own blocks in the SSH config without touching anything else.

---

## First-Run & Context-Aware Behavior

The bare `gitme` command (no subcommand) is context-aware. It detects where you are and what state gitme is in, and offers the most relevant action. This is the primary entry point for onboarding.

### Decision Tree

```
gitme (no subcommand)
│
├─ No ~/.gitme/ exists?
│  └─ → FIRST-RUN ONBOARDING (full wizard)
│
├─ ~/.gitme/ exists but no profiles configured?
│  └─ → FIRST-RUN ONBOARDING (resume setup)
│
├─ Profiles exist, inside a git repo?
│  ├─ Repo is registered in repos.json?
│  │  └─ → DASHBOARD (show identity + quick status)
│  └─ Repo is NOT registered?
│     └─ → ADOPT PROMPT ("This repo isn't managed by gitme. Set it up?")
│
├─ Profiles exist, NOT inside a git repo?
│  └─ → HUB MENU (interactive menu with all actions)
│
└─ Any command run before first-run complete?
   └─ → Intercept, run FIRST-RUN ONBOARDING first
```

### First-Run Onboarding

Triggered on the very first `gitme` invocation (or any subcommand if `~/.gitme/` doesn't exist). The onboarding is smart — it scans the machine for existing git configuration and offers to import it rather than starting from scratch.

**Phase 1: Environment Scan**

Before asking any questions, gitme silently scans for:

- `~/.gitconfig` — read `user.name` and `user.email` (the current global git identity)
- `~/.ssh/` — find existing SSH keys (id_ed25519, id_rsa, etc.) and parse their comments for emails
- `~/.ssh/config` — detect any existing GitHub host aliases
- `~/.config/gh/hosts.yml` — if present, read existing gh CLI auth to detect GitHub username(s)

This scan takes <1 second and gives gitme the context to make smart suggestions.

**Phase 2: Welcome & Import**

```
$ gitme

  Welcome to gitme! Let's set up your GitHub profiles.

  🔍 Scanning your existing git setup...

  Found existing configuration:
    Git user:    Tim Benniks <tbenniks@gmail.com>
    SSH keys:    ~/.ssh/id_ed25519 (tbenniks@gmail.com)
                 ~/.ssh/id_rsa (old key, no comment)

  ? Import this as your first profile?
    ❯ Yes, import as 'personal'
      Yes, but let me customize it
      No, start fresh

  [User selects "Yes, import as 'personal'"]

  ✓ Imported profile 'personal':
    Username:  tbenniks
    Name:      Tim Benniks
    Email:     tbenniks@gmail.com
    SSH key:   ~/.ssh/id_ed25519 (existing key — will create gitme alias)
```

**Phase 3: SSH Host Alias for Imported Key**

For existing keys, gitme doesn't generate a new key — it creates an SSH host alias pointing to the existing key:

```
  🔗 Creating SSH alias 'github.com-personal' → ~/.ssh/id_ed25519

  ? Test connection? Yes

  ✓ ssh -T git@github.com-personal → authenticated as tbenniks
```

**Phase 4: Additional Profiles**

```
  ? Set up another GitHub account? (e.g., a work account)
    ❯ Yes
      No, I'm done for now

  [User selects "Yes"]

  ? Profile name: work
  ? GitHub username: tim-acme
  ? Full name for commits: Tim Benniks
  ? Email for commits: tim@acme.com

  ? SSH key for this profile:
    ❯ Generate a new key (recommended for separate accounts)
      Use an existing key

  [User selects "Generate a new key"]

  🔑 Generating SSH key...
     Created: ~/.ssh/gitme_work

  📋 Public key (copied to clipboard):

     ssh-ed25519 AAAAC3Nz... tim@acme.com

  → Add this key to GitHub: https://github.com/settings/ssh/new
  ? Open browser? Yes

  [Browser opens]

  ? Have you added the key to GitHub? Yes

  🔗 Testing connection...
     ✓ Authenticated as tim-acme
```

**Phase 5: Org Mappings**

```
  ? Map GitHub orgs to profiles? This lets 'gitme clone' auto-detect
    which account to use.

  ? Map an org to 'work': acme-corp
  ? Map another org to 'work'? (enter to skip):
  ? Map an org to 'personal': tbenniks
  ? Map another org to 'personal'? (enter to skip):
```

**Phase 6: Scan Existing Repos**

This is the key onboarding step — gitme can scan for existing repos and adopt them.

```
  ? Scan for existing git repos to register with gitme?
    ❯ Yes, scan common directories
      Yes, scan a specific directory
      No, I'll add repos later

  [User selects "Yes, scan common directories"]

  🔍 Scanning ~/work, ~/projects, ~/code, ~/dev, ~/src, ~/repos...

  Found 7 git repos:

    ~/work/api-service          origin: acme-corp/api-service       → work (org match)
    ~/work/frontend             origin: acme-corp/frontend          → work (org match)
    ~/work/shared-lib           origin: acme-corp/shared-lib        → work (org match)
    ~/projects/my-site          origin: tbenniks/my-site            → personal (org match)
    ~/projects/dotfiles         origin: tbenniks/dotfiles           → personal (org match)
    ~/projects/oss-contrib      origin: facebook/react              → ? (no org match)
    ~/old-stuff/experiment      origin: tbenniks/experiment         → personal (org match)

  ? Register these repos? (unmatched repos will be assigned your default profile)
    ❯ Yes, register all
      Let me review one by one
      Skip for now

  [User selects "Yes, register all"]

  ✓ Registered 7 repos (5 work, 2 personal)
  ℹ  1 repo (facebook/react) assigned to default profile 'personal'

  🔄 Rewriting remotes to use SSH host aliases...
     ✓ 7/7 remotes updated
  📧 Setting local git config (name/email) on each repo...
     ✓ 7/7 repos configured
```

**Phase 7: Summary**

```
  ✓ gitme is ready!

  Profiles:
    personal    tbenniks    tbenniks@gmail.com     5 repos  ✓ default
    work        tim-acme    tim@acme.com           2 repos

  Org mappings:
    acme-corp → work
    tbenniks  → personal

  Quick reference:
    gitme              Dashboard (in a repo) or menu (outside)
    gitme clone <url>  Clone with the right identity
    gitme whoami       Check current identity
    gitme repos        See all managed repos
    gitme setup        Add another profile
```

### Hub Menu (Outside a Git Repo)

When you run `gitme` with no arguments outside a git repo (and setup is complete), you get an interactive menu:

```
$ gitme

  gitme — 2 profiles, 7 repos

  ? What would you like to do?
    ❯ Clone a repo
      View all repos
      View profiles
      Add a new profile
      Scan for unregistered repos
      Manage org mappings
      Run health check
```

Each option launches the corresponding command interactively.

### Dashboard (Inside a Registered Repo)

When you run `gitme` inside a registered repo, you get a quick dashboard:

```
$ cd ~/work/api-service
$ gitme

  📍 api-service
  👤 work (tim@acme.com)
  🌿 main ← origin/main (up to date)

  Quick actions:
    gitme whoami       Full identity details
    gitme status       Git status with identity
    gitme pr list      List PRs (as tim-acme)
```

### Adopt Prompt (Inside an Unregistered Repo)

When you run `gitme` inside a git repo that isn't in the registry:

```
$ cd ~/random/some-project
$ gitme

  ⚠️  This repo isn't managed by gitme yet.

  🔍 Detected remote: git@github.com:some-org/some-project.git

  ? Set it up now?
    ❯ Yes, assign to a profile
      No, not now

  [User selects "Yes"]

  ? Which profile?
    ❯ personal (tbenniks@gmail.com)
      work (tim@acme.com)

  🔄 Rewriting remote to: git@github.com-personal:some-org/some-project.git
  📧 Set git user to: Tim Benniks <tbenniks@gmail.com>

  ✓ Registered in repo registry.
```

---

## Commands

### `gitme setup`

Interactive setup wizard. On first run, this is triggered automatically (see First-Run above). Can be re-run to add new profiles or reconfigure existing ones.

**When re-running (profiles already exist):**

```
$ gitme setup

  gitme is already configured with 2 profiles.

  ? What would you like to do?
    ❯ Add a new profile
      Edit an existing profile
      Re-scan for existing repos
      Reset everything

  [User selects "Add a new profile"]

  ... (same profile creation flow as first-run Phase 4) ...
```

**Flow for adding a profile:**

1. Ask for profile name (e.g., `personal`, `work`, `freelance`)
2. Ask for GitHub username
3. Ask for full name (for git commits)
4. Ask for email (for git commits)
5. **SSH key:** offer to generate new or use existing
6. **SSH host alias:** configure in `~/.ssh/config` with markers
7. **Test connection:** `ssh -T git@github.com-<profile>`
8. **GitHub API token** (optional): ask if they want PR/issue features, guide them to create a personal access token at `https://github.com/settings/tokens`, store it securely in config
9. **Org mappings:** ask if any GitHub orgs should map to this profile
10. **Default:** ask if this should be the new default profile
11. Write config
12. Offer to scan for repos that match new org mappings

**Output:** Summary of what was configured.

### `gitme clone <repo-url> [directory]`

Smart clone that automatically binds the repo to the right profile.

**Flow:**

1. Parse the repo URL to extract the GitHub org/owner and repo name
2. Check if the org is mapped to a profile in config (org mappings are set during setup or via `gitme config`)
3. If no mapping, ask which profile to use (interactive prompt with profile list)
4. Optionally ask: "Remember this for all `<org>` repos?" → save org mapping
5. Rewrite the clone URL to use the profile's SSH host alias:
   - `git@github.com:acme/repo.git` → `git@github.com-work:acme/repo.git`
   - `https://github.com/acme/repo.git` → `git@github.com-work:acme/repo.git` (always converts to SSH)
6. Run `git clone` with the rewritten URL
7. Set local git config for the repo:
   - `git config user.name "..."`
   - `git config user.email "..."`
8. **Register in `~/.gitme/repos.json`** with the resolved absolute path, profile, remote, and timestamp
9. Display confirmation: "Cloned as **work** (tim@acme.com)"

### `gitme init [profile]`

Bind an **existing** repo (already cloned) to a profile.

**Flow:**

1. Verify current directory is a git repo
2. If profile not specified, show interactive picker
3. Rewrite all remote URLs to use the profile's SSH host alias
4. Set local git config (name, email)
5. **Register in `~/.gitme/repos.json`**
6. Display confirmation

### `gitme whoami`

Show the active identity for the current repo.

**Output example:**

```
📍 Repository: api-service
👤 Profile:    work
🔑 SSH key:    ~/.ssh/gitme_work (✓ loaded)
📧 Git email:  tim@acme.com
📝 Git name:   Tim Benniks
🔗 Remote:     git@github.com-work:acme-corp/api-service.git
🔐 GitHub API: ✓ token configured
```

If not in a git repo or no profile bound:

```
⚠️  Not in a git repo, or no gitme profile bound.
    Run 'gitme init' to bind this repo to a profile.
```

### `gitme status`

Extended status that shows identity info alongside `git status`.

**Output example:**

```
Profile: work (tim@acme.com)

On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

### `gitme profiles`

List all configured profiles with repo counts.

**Output example:**

```
  PROFILE     USERNAME    EMAIL                  REPOS  DEFAULT
  personal    tbenniks    tbenniks@gmail.com     12     ✓
  work        tim-acme    tim@acme.com           8
```

### `gitme repos`

List all registered repos. This is the command that the central registry really enables.

**Output example:**

```
  PROFILE     REPO                          PATH
  work        acme-corp/api-service         ~/work/api-service
  work        acme-corp/frontend            ~/work/frontend
  work        acme-corp/shared-lib          ~/work/shared-lib
  personal    tbenniks/my-site              ~/personal/my-site
  personal    tbenniks/dotfiles             ~/dotfiles
```

**Subcommands / flags:**

- `gitme repos --profile work` — filter by profile
- `gitme repos --check` — verify all registered repos still exist on disk and remotes are reachable (health check)
- `gitme repos --clean` — remove entries for repos that no longer exist on disk
- `gitme repos --json` — output as JSON (for scripting)

### `gitme config`

Manage global settings:

- `gitme config default <profile>` — set the default profile
- `gitme config org <org-name> <profile>` — map a GitHub org to a profile (used by `gitme clone`)
- `gitme config org --list` — show all org mappings
- `gitme config list` — show all settings, profiles, and org mappings

### `gitme pr`

Create and list pull requests using the GitHub API, authenticated as the correct profile. No `gh` CLI needed.

**Subcommands:**

- `gitme pr create` — interactive PR creation (prompts for title, body, base branch)
- `gitme pr create --title "Fix bug" --base main` — non-interactive PR creation
- `gitme pr list` — list open PRs for the current repo
- `gitme pr view [number]` — view PR details
- `gitme pr status` — show PRs relevant to you (created by you, review requested, etc.)

**How it works:**

- Reads the current repo's profile from `repos.json`
- Uses the profile's GitHub personal access token
- Calls GitHub's REST API via Node.js `fetch` (built-in since Node 18)
- Extracts org/repo from the remote URL to construct API calls

Example: `gitme pr create --title "Fix bug"` calls `POST /repos/acme-corp/api-service/pulls` authenticated as the work profile.

### `gitme issue`

View and create issues using the GitHub API.

**Subcommands:**

- `gitme issue list` — list open issues
- `gitme issue create --title "Bug report"` — create an issue
- `gitme issue view [number]` — view issue details

---

## Config File Structure

### `~/.gitme/config.json`

Global configuration: profiles, defaults, and org mappings.

```json
{
  "version": 1,
  "defaultProfile": "personal",
  "profiles": {
    "personal": {
      "githubUsername": "tbenniks",
      "gitName": "Tim Benniks",
      "gitEmail": "tbenniks@gmail.com",
      "sshKeyPath": "~/.ssh/gitme_personal",
      "sshHost": "github.com-personal",
      "githubToken": null
    },
    "work": {
      "githubUsername": "tim-acme",
      "gitName": "Tim Benniks",
      "gitEmail": "tim@acme.com",
      "sshKeyPath": "~/.ssh/gitme_work",
      "sshHost": "github.com-work",
      "githubToken": null
    }
  },
  "orgMappings": {
    "acme-corp": "work",
    "tbenniks": "personal"
  }
}
```

### `~/.gitme/repos.json`

Central repo registry. Maps absolute paths to profile bindings.

```json
{
  "/Users/tim/work/api-service": {
    "profile": "work",
    "remote": "git@github.com-work:acme-corp/api-service.git",
    "org": "acme-corp",
    "repo": "api-service",
    "clonedAt": "2026-03-25T10:30:00Z",
    "lastVerified": "2026-03-25T10:30:00Z"
  },
  "/Users/tim/work/frontend": {
    "profile": "work",
    "remote": "git@github.com-work:acme-corp/frontend.git",
    "org": "acme-corp",
    "repo": "frontend",
    "clonedAt": "2026-03-24T09:00:00Z",
    "lastVerified": "2026-03-25T10:30:00Z"
  },
  "/Users/tim/personal/my-site": {
    "profile": "personal",
    "remote": "git@github.com-personal:tbenniks/my-site.git",
    "org": "tbenniks",
    "repo": "my-site",
    "clonedAt": "2026-03-20T14:00:00Z",
    "lastVerified": "2026-03-22T08:00:00Z"
  }
}
```

**Fields:**

- `profile` — which profile this repo uses
- `remote` — the rewritten remote URL (with SSH host alias)
- `org` — GitHub org/owner (extracted from remote)
- `repo` — repository name
- `clonedAt` — when gitme first registered this repo
- `lastVerified` — last time `gitme repos --check` confirmed this repo exists

---

## Technical Architecture

### Stack

- **Runtime**: Node.js (>=18)
- **CLI framework**: `commander` — lightweight, well-known, supports subcommands
- **Interactive prompts**: `@inquirer/prompts` (modern ESM version of inquirer)
- **Terminal styling**: `chalk` for colors, `ora` for spinners
- **SSH key generation**: Shell out to `ssh-keygen` (universally available)
- **SSH config editing**: Custom parser/writer with marker comments (`# gitme:<profile>`)
- **git operations**: Shell out to `git` via `child_process.execSync` / `spawn`
- **GitHub API**: Node.js built-in `fetch` (available since Node 18) calling GitHub REST API v3 directly. Authenticated via personal access tokens stored per profile. No `gh` CLI dependency.
- **Config storage**: JSON files via `fs` (no database)
- **Path resolution**: `path.resolve` + `fs.realpathSync` for symlink handling

### Package Structure

```
gitme/
├── package.json
├── bin/
│   └── gitme.js              # Entry point, shebang line
├── src/
│   ├── commands/
│   │   ├── setup.js           # Interactive setup wizard
│   │   ├── clone.js           # Smart clone
│   │   ├── init.js            # Bind existing repo
│   │   ├── whoami.js          # Show current identity
│   │   ├── status.js          # Git status + identity
│   │   ├── profiles.js        # List profiles
│   │   ├── repos.js           # List/check/clean repos
│   │   ├── config.js          # Manage settings
│   │   ├── pr.js              # Pull request commands (create, list, view, status)
│   │   └── issue.js           # Issue commands (create, list, view)
│   ├── lib/
│   │   ├── config.js          # Read/write ~/.gitme/config.json
│   │   ├── registry.js        # Read/write ~/.gitme/repos.json (the repo registry)
│   │   ├── profile.js         # Profile resolution: cwd → repo path → registry → profile
│   │   ├── scan.js            # Environment scanner: ~/.gitconfig, ~/.ssh/, gh auth
│   │   ├── discover.js        # Repo discovery: find git repos in common directories
│   │   ├── ssh.js             # SSH key gen, config editing with markers
│   │   ├── git.js             # Git operations helper (clone, config, remote rewriting)
│   │   ├── github.js          # GitHub REST API client (fetch-based, token auth per profile)
│   │   ├── url.js             # GitHub URL parsing (SSH, HTTPS, shorthand → normalized parts)
│   │   └── ui.js              # Shared formatting, colors, symbols, tables
│   └── index.js               # CLI registration (commander setup)
└── README.md
```

### Key Design Decisions

1. **Setup tool, not a runtime wrapper**: gitme configures git's own mechanisms (local `.git/config` for identity, SSH host aliases for auth). After setup, every tool — VS Code, JetBrains, Claude Code, GitHub Desktop, raw `git` — automatically uses the right account. No environment variables to set, no wrapper to remember, no gitme process in the middle. This is the most important design decision in the entire tool.

2. **Central `repos.json` over per-repo dotfiles**: The registry lives in `~/.gitme/repos.json`, not inside each repo. This gives you a full inventory of managed repos, avoids polluting projects, survives fresh clones to the same path, and enables commands like `gitme repos` for auditing. The tradeoff is that if you move a repo on disk, you need to re-run `gitme init` (or we could add a `gitme repos --clean` that auto-detects moves).

3. **SSH host aliases over SSH agent switching**: Host aliases are stateless and per-connection. No risk of "wrong key loaded in agent." Each repo's remote URL encodes which key to use. This is the most reliable approach.

4. **Always convert HTTPS to SSH**: The tool normalizes all remotes to SSH format. This is opinionated but necessary — HTTPS auth with multiple accounts is even more painful than SSH.

5. **Built-in GitHub API, no `gh` dependency**: Instead of wrapping the `gh` CLI (a Go binary that can't be bundled via npm), gitme calls GitHub's REST API directly using Node's built-in `fetch`. Personal access tokens are stored per profile. This means zero external dependencies beyond `git` and `ssh-keygen`, and `gitme pr` / `gitme issue` always authenticate as the correct account automatically.

6. **Marker comments in SSH config**: Gitme-managed blocks in `~/.ssh/config` are wrapped with `# gitme:<profile>` markers. This lets gitme update its own entries without touching any manually configured SSH hosts.

7. **No shell hooks (for now)**: We opted out of the auto-switch hook. Instead, `gitme whoami` is the explicit check. This avoids shell compatibility issues and keeps the tool simple. Can be added later.

---

## Profile Resolution Order

When `gitme` needs to determine the profile for the current directory:

1. **Registry lookup**: Resolve the current directory to a repo root (walk up looking for `.git`), then look up the absolute path in `repos.json`. If found, use that profile.
2. **Remote URL detection** (fallback): If the repo isn't in the registry, read the `origin` remote and check the org against `orgMappings` in config. If matched, auto-register and use that profile.
3. **Default profile** (fallback): If no org mapping matches, use the `defaultProfile` from config.
4. **Prompt** (interactive fallback): If running interactively and nothing matched, prompt the user to pick a profile and optionally register the repo.

---

## User Flows

### First Run — Existing Developer (Has Git Configured)

This is the most common scenario: someone who already has a personal GitHub setup and needs to add a work account.

```
$ npm install -g gitme
$ gitme

  Welcome to gitme! Let's set up your GitHub profiles.

  🔍 Scanning your existing git setup...

  Found existing configuration:
    Git user:    Tim Benniks <tbenniks@gmail.com>
    SSH keys:    ~/.ssh/id_ed25519 (tbenniks@gmail.com)

  ? Import this as your first profile? Yes, import as 'personal'

  ✓ Imported profile 'personal'
  🔗 Created SSH alias 'github.com-personal' → ~/.ssh/id_ed25519
  ✓ Authenticated as tbenniks

  ? Set up another GitHub account? Yes

  ? Profile name: work
  ? GitHub username: tim-acme
  ? Full name for commits: Tim Benniks
  ? Email for commits: tim@acme.com
  ? SSH key: Generate a new key

  🔑 Created: ~/.ssh/gitme_work
  📋 Public key copied to clipboard.
  → Add to GitHub: https://github.com/settings/ssh/new
  ? Open browser? Yes
  ? Added the key? Yes
  ✓ Authenticated as tim-acme

  ? Map 'acme-corp' org to this profile? Yes

  ? Scan for existing repos? Yes, scan common directories

  🔍 Found 7 repos, registered all. (5 work, 2 personal)
  🔄 Remotes and git configs updated.

  ✓ gitme is ready! Run 'gitme' for the menu.
```

### First Run — Brand New Developer (No Git Config)

A colleague who just got their laptop and has nothing configured yet.

```
$ npm install -g gitme
$ gitme

  Welcome to gitme! Let's set up your GitHub profiles.

  🔍 Scanning your existing git setup...

  No existing git configuration found. Let's start fresh!

  ? Profile name: work
  ? GitHub username: jane-acme
  ? Full name for commits: Jane Smith
  ? Email for commits: jane@acme.com
  ? SSH key: Generate a new key

  🔑 Created: ~/.ssh/gitme_work
  📋 Public key copied to clipboard.
  → Add to GitHub: https://github.com/settings/ssh/new
  ? Open browser? Yes
  ? Added the key? Yes
  ✓ Authenticated as jane-acme

  ? Map a GitHub org to this profile? Yes
  ? Org name: acme-corp

  ? Set up another profile? No

  ✓ gitme is ready!

    gitme clone <url>   Clone with the right identity
    gitme repos         See all managed repos
    gitme setup         Add another profile later
```

### Cloning a Work Repo

```
$ gitme clone git@github.com:acme-corp/api-service.git

  🔍 Detected org: acme-corp → profile 'work'
  📥 Cloning acme-corp/api-service...
  ✓ Cloned as 'work' (tim@acme.com)
  ✓ Registered in repo registry
```

### Cloning an Unknown Repo

```
$ gitme clone git@github.com:some-org/some-repo.git

  ? Which profile should be used for some-org/some-repo?
    ❯ personal (tbenniks@gmail.com)
      work (tim@acme.com)

  ? Remember this for all 'some-org' repos? Yes

  📥 Cloning some-org/some-repo...
  ✓ Cloned as 'personal' (tbenniks@gmail.com)
  ✓ Registered in repo registry. Org 'some-org' → personal.
```

### Adopting an Existing Repo

```
$ cd ~/old-projects/legacy-app
$ gitme init

  🔍 Detected remote: git@github.com:acme-corp/legacy-app.git
  🔍 Org 'acme-corp' → profile 'work'

  ? Use profile 'work' for this repo? Yes

  🔄 Rewriting remote to: git@github.com-work:acme-corp/legacy-app.git
  📧 Set git user to: Tim Benniks <tim@acme.com>

  ✓ Registered in repo registry.
```

### Checking Identity

```
$ cd ~/work/api-service
$ gitme whoami

  📍 Repository: api-service
  👤 Profile:    work
  📧 Email:      tim@acme.com
  🔑 SSH key:    ~/.ssh/gitme_work (✓ valid)
  🔗 Remote:     git@github.com-work:acme-corp/api-service.git
```

### Listing All Repos

```
$ gitme repos

  PROFILE     REPO                          PATH                       CLONED
  work        acme-corp/api-service         ~/work/api-service         2 days ago
  work        acme-corp/frontend            ~/work/frontend            1 day ago
  work        acme-corp/shared-lib          ~/work/shared-lib          5 days ago
  personal    tbenniks/my-site              ~/personal/my-site         2 weeks ago
  personal    tbenniks/dotfiles             ~/dotfiles                 1 month ago

  5 repos across 2 profiles
```

### Health Check

```
$ gitme repos --check

  ✓ acme-corp/api-service      ~/work/api-service
  ✓ acme-corp/frontend          ~/work/frontend
  ✗ acme-corp/old-project       ~/work/old-project (directory not found)
  ✓ tbenniks/my-site            ~/personal/my-site

  3/4 repos healthy. Run 'gitme repos --clean' to remove stale entries.
```

---

## Edge Cases and Error Handling

1. **No profile bound**: If running `gitme whoami` in an unregistered repo, attempt auto-detection via remote URL + org mapping. If that fails, show a clear message and suggest `gitme init`.

2. **Repo moved on disk**: The registry entry won't match. `gitme repos --check` detects this. `gitme init` from the new location re-registers.

3. **SSH key not on GitHub**: If `ssh -T` fails during setup, show clear instructions and offer to retry.

4. **No GitHub token configured**: If a user runs `gitme pr` without a token stored for the active profile, show a clear message explaining how to create a personal access token and run `gitme setup` to add it. SSH-based operations (clone, push, pull) always work without a token.

5. **Existing SSH keys**: During setup, ask if the user wants to use an existing key or generate a new one.

6. **Repo already has local git config**: During `gitme init`, warn if `user.email` is already set locally and differs from the profile. Offer to override.

7. **HTTPS remotes**: When running `gitme init` on a repo with HTTPS remotes, offer to convert them to SSH with the right host alias.

8. **Multiple remotes**: Handle repos with multiple remotes (e.g., `origin` + `upstream`). Only rewrite `github.com` remotes. Store primary remote (origin) in registry.

9. **Concurrent access**: Use atomic writes (write to temp file, then rename) for `repos.json` to avoid corruption if two terminals clone simultaneously.

10. **Registry corruption**: If `repos.json` is malformed, back it up and start fresh with a warning.

---

## Future Considerations (Not in V1)

- **Shell prompt integration**: Show active profile in PS1/starship/oh-my-zsh prompt
- **Auto-switch hook**: `cd` hook that warns if you enter an unbound repo
- **`gitme pr`**: Shortcut for creating PRs with the right account
- **Config sync**: Share org mappings across machines via a gist or dotfiles repo
- **GPG signing**: Per-profile GPG key configuration
- **Repo groups/tags**: Tag repos in the registry (e.g., "active", "archived") for filtering
- **Bulk operations**: `gitme repos --profile work --exec "git pull"` to run commands across all work repos
- **`gitme doctor`**: Comprehensive diagnostic that checks SSH keys, git config, gh auth, and registry health all at once

---

## Distribution

- Published to npm: `npm install -g gitme`
- Works on macOS and Linux (Windows WSL should work too)
- Zero external dependencies — only requires `git` and `ssh-keygen` (universally available). GitHub API calls use Node's built-in `fetch`.
- Minimum Node.js 18 (for modern ESM support)
