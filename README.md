```
      ▄██████████▄
    ▄█  ◉    ◉  █▄   gitme
   ███    ▀▀      ███─────●   multi-account github cli
   █████████████████   ●
    ▀█████████████▀  ●
       ▀███▀ ▀███
```

# gitme

**Multi-account GitHub CLI** — manage SSH keys, git identities, and GitHub auth per repo so you never commit or push as the wrong person.

Meet **Gigi the gitmeleon** — your identity-switching mascot. Just like a chameleon adapts to its environment, gitme adapts your git identity to each repo automatically.

---

## Why gitme?

If you have both a personal and work GitHub account, every git operation is a landmine. You might commit with the wrong email, push with the wrong SSH key, or clone into a directory configured for the wrong account.

**gitme fixes this permanently.** It configures git and SSH at the repo level — once. After that, every tool just works: VS Code, JetBrains, GitHub Desktop, terminal, Claude Code, CI scripts. No wrappers, no runtime dependency, no environment variables.

gitme is a **setup tool, not a runtime wrapper**. It configures two things that every git tool already respects:

1. **Local `.git/config`** — sets `user.name` and `user.email` per repo, so commits always use the right identity
2. **SSH host aliases** — rewrites remotes to use per-account SSH aliases (e.g., `git@github.com-work:org/repo.git`), so push/pull always use the right key

Set up once, then forget about it.

---

## Install

```bash
npm install -g gitme
```

Requires Node.js 18+. Only depends on `git` and `ssh-keygen` (universally available).

---

## Tutorial: Getting Started

### Step 1: First run

Run `gitme` with no arguments. Gigi greets you and scans your machine for existing git config, SSH keys, and `gh` CLI auth.

```
$ gitme

      ▄██████████▄
    ▄█  ◉    ◉  █▄   Hey! I'm Gigi the gitmeleon.
   ███    ▀▀      ███─────●   I help you juggle GitHub identities.
   █████████████████   ●   Set up once, never think about it again.
    ▀█████████████▀  ●
       ▀███▀ ▀███

┌ █◉█─● gitme ─────────────────────────────────────┐
│                                                    │
│  ●  Scanning your existing git setup...            │
│                                                    │
│  ┌ Found existing configuration ────────────────┐  │
│  │  Git user:    Tim Benniks <tim@gmail.com>     │  │
│  │  SSH key:     ~/.ssh/id_ed25519               │  │
│  │  gh CLI auth: tbenniks                        │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ◇  Import this as your first profile?             │
│  │  > Yes, import as 'personal'                    │
│  │    Yes, but let me customize it                 │
│  │    No, start fresh                              │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Step 2: Add a work account

After importing your personal profile, gitme asks if you want to add another account. Say yes and enter your work details.

```
◇  Set up another GitHub account?
│  Yes

◇  Profile name:
│  work

◇  GitHub username:
│  tim-acme

◇  Full name for commits:
│  Tim Benniks

◇  Email for commits:
│  tim@acme.com

◇  SSH key for this profile:
│  > Generate a new key

●  Generating SSH key...
◆  Created: ~/.ssh/gitme_work

┌ 📋 Public key (copied to clipboard) ─────────────┐
│  ssh-ed25519 AAAAC3Nz... tim@acme.com             │
└───────────────────────────────────────────────────┘

→  Add this key to GitHub: https://github.com/settings/ssh/new

◇  Open browser?  Yes
◇  Have you added the key to GitHub?  Yes

●  Testing ssh -T git@github.com-work...
◆  Authenticated as tim-acme
```

### Step 3: Map organizations

Tell gitme which GitHub orgs belong to which profile. This enables automatic profile detection when cloning.

```
◇  Map GitHub orgs to profiles?
│  Yes

◇  Map an org to 'personal':
│  tbenniks

◇  Map an org to 'work':
│  acme-corp
```

### Step 4: Discover existing repos

gitme scans common directories to find and register your existing repos.

```
●  Scanning for git repos...
◆  Found 7 git repos

┌ Discovered repos ──────────────────────────────────────────────────────────┐
│  ~/work/api-service              acme-corp/api-service       → work        │
│  ~/work/frontend                 acme-corp/frontend          → work        │
│  ~/projects/my-site              tbenniks/my-site            → personal    │
│  ~/projects/dotfiles             tbenniks/dotfiles           → personal    │
└────────────────────────────────────────────────────────────────────────────┘

◇  Register these repos?  Yes
◆  Registered 4 repos

└  Gigi says: you're all set! Happy committing.
```

### Step 5: Clone with the right identity

From now on, just use `gitme clone` instead of `git clone`. It auto-detects the profile.

```
$ gitme clone git@github.com:acme-corp/new-service.git

  ◆  Detected org: acme-corp → profile 'work'
  ●  Cloning acme-corp/new-service...
  ◆  Cloned as 'work' (tim@acme.com)
  ◆  Registered in repo registry
```

### Step 6: Verify your identity

Inside any managed repo, check who you are:

```
$ cd ~/work/api-service
$ gitme whoami

  ┌ 📍 api-service ──────────────────────────────────┐
  │  👤  work (tim@acme.com)                          │
  │  📧  tim@acme.com                                 │
  │  🔑  ~/.ssh/gitme_work (✓ valid)                  │
  │  🔗  git@github.com-work:acme-corp/api-service    │
  └───────────────────────────────────────────────────┘
```

Now every tool — VS Code, terminal, Claude Code, GitHub Desktop — uses the correct identity automatically. **No wrappers. No thinking. It just works.**

---

## Features

### Profiles

A profile is a named GitHub identity: username, name, email, SSH key, and optional API token.

```
$ gitme profiles

  PROFILE     USERNAME    EMAIL                  REPOS  DEFAULT
  personal    tbenniks    tbenniks@gmail.com     5      ✓
  work        tim-acme    tim@acme.com           8
```

Full CRUD:

- **Add**: `gitme setup` → "Add a new profile"
- **Edit**: `gitme setup` → "Edit an existing profile" (change any field, regenerate SSH key, update token)
- **Remove**: `gitme setup` → "Remove a profile" (cleans up SSH config block and org mappings)
- **List**: `gitme profiles`

### Smart clone

`gitme clone` auto-detects the right profile from the org, rewrites the remote, sets local git config, and registers the repo — all in one step.

```
$ gitme clone git@github.com:acme-corp/api-service.git

  ◆  Detected org: acme-corp → profile 'work'
  ●  Cloning acme-corp/api-service...
  ◆  Cloned as 'work' (tim@acme.com)
  ◆  Registered in repo registry
```

If the org isn't mapped, gitme asks which profile to use and offers to remember the mapping.

### Repo registry

A central registry at `~/.gitme/repos.json` — one source of truth for all managed repos. No dotfiles inside repos, no gitignore entries, no pollution.

```
$ gitme repos

  PROFILE     REPO                          PATH                       CLONED
  work        acme-corp/api-service         ~/work/api-service         2 days ago
  work        acme-corp/frontend            ~/work/frontend            1 day ago
  personal    tbenniks/my-site              ~/personal/my-site         2 weeks ago

  3 repos across 2 profiles
```

Full CRUD:

- **Add**: `gitme clone <url>` or `gitme init` (bind existing repo)
- **Remove**: `gitme repos remove` (interactive picker, or `gitme repos remove /path/to/repo`)
- **List**: `gitme repos` (with `--profile <name>` filter, `--json` for scripting)
- **Health check**: `gitme repos --check` (verify repos exist on disk)
- **Clean**: `gitme repos --clean` (remove stale entries)

### Org mappings

Map GitHub organizations to profiles so `gitme clone` auto-detects which account to use.

```
$ gitme config org list

  ORG          PROFILE
  acme-corp    work
  tbenniks     personal
```

Full CRUD:

- **Add**: `gitme config org add <org> <profile>`
- **Remove**: `gitme config org remove <org>`
- **List**: `gitme config org list`

### Identity check

```
$ gitme whoami

  ┌ 📍 api-service ──────────────────────────────────┐
  │  👤  work (tim@acme.com)                          │
  │  📧  tim@acme.com                                 │
  │  🔑  ~/.ssh/gitme_work (✓ valid)                  │
  │  🔗  git@github.com-work:acme-corp/api-service    │
  │  🔐  ✓ token configured                           │
  └───────────────────────────────────────────────────┘
```

### Pull requests and issues

Manage PRs and issues with the correct GitHub account — no `gh` CLI required.

```bash
gitme pr list              # list open PRs
gitme pr create            # create a PR (interactive)
gitme pr view 42           # view PR details
gitme pr status            # PRs you authored + review requests

gitme issue list           # list open issues
gitme issue create         # create an issue
gitme issue view 17        # view issue details
```

Authenticated via personal access tokens stored per profile. SSH-based operations (clone, push, pull) always work without a token.

### Context-aware default

Running bare `gitme` adapts to where you are:

| Context                     | Behavior                                   |
| --------------------------- | ------------------------------------------ |
| First run (no config)       | Gigi greets you + interactive setup wizard |
| Inside a registered repo    | Dashboard with identity + branch info      |
| Inside an unregistered repo | Offers to adopt it with a profile          |
| Outside any repo            | Hub menu with all actions                  |

### Adopt existing repos

Enter any git repo that isn't managed by gitme yet, and run `gitme` or `gitme init`:

```
$ cd ~/random/some-project
$ gitme

  ▲  This repo isn't managed by gitme yet.
     🔍 Detected remote: git@github.com:some-org/some-project.git

  ◇  Set it up now?  Yes

  ◇  Which profile?
  │  > work (tim@acme.com)

  ◆  🔄 Rewriting origin to: git@github.com-work:some-org/some-project.git
  ◆  📧 Set git user to: Tim Benniks <tim@acme.com>
  ◆  Registered in repo registry.
```

---

## Command Reference

### Core commands

| Command                   | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| `gitme`                   | Context-aware default (setup / dashboard / adopt / menu) |
| `gitme setup`             | Interactive setup wizard (add, edit, remove profiles)    |
| `gitme clone <url> [dir]` | Clone with the right identity                            |
| `gitme init [profile]`    | Bind an existing repo to a profile                       |
| `gitme whoami`            | Show current repo identity                               |
| `gitme status`            | Git status with identity info                            |

### Listing

| Command                        | Description                        |
| ------------------------------ | ---------------------------------- |
| `gitme profiles`               | List all profiles with repo counts |
| `gitme repos`                  | List all registered repos          |
| `gitme repos --profile <name>` | Filter repos by profile            |
| `gitme repos --check`          | Verify all repos exist on disk     |
| `gitme repos --clean`          | Remove stale entries               |
| `gitme repos --json`           | Machine-readable JSON output       |

### Managing repos

| Command                     | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `gitme repos remove [path]` | Unregister a repo (interactive picker if no path) |

### Config

| Command                                | Description                   |
| -------------------------------------- | ----------------------------- |
| `gitme config default <profile>`       | Set the default profile       |
| `gitme config org add <org> <profile>` | Map a GitHub org to a profile |
| `gitme config org remove <org>`        | Remove an org mapping         |
| `gitme config org list`                | List all org mappings         |
| `gitme config list`                    | Show all settings             |

### GitHub (requires personal access token)

| Command                     | Description                             |
| --------------------------- | --------------------------------------- |
| `gitme pr list`             | List open pull requests                 |
| `gitme pr create`           | Create a pull request (interactive)     |
| `gitme pr view [number]`    | View pull request details               |
| `gitme pr status`           | Show PRs you authored + review requests |
| `gitme issue list`          | List open issues                        |
| `gitme issue create`        | Create an issue (interactive)           |
| `gitme issue view [number]` | View issue details                      |

---

## How it works under the hood

### SSH host aliases

Each profile gets a unique SSH alias in `~/.ssh/config`, managed by gitme with marker comments:

```
# gitme-begin:work
Host github.com-work
  HostName github.com
  User git
  IdentityFile ~/.ssh/gitme_work
  IdentitiesOnly yes
# gitme-end:work
```

When a repo's remote is `git@github.com-work:org/repo.git`, SSH automatically uses the right key. No agent switching, no environment variables. Every tool that calls `git push` inherits this — VS Code, JetBrains, Claude Code, GitHub Desktop, CI scripts.

### Profile resolution

When gitme needs to determine the active profile for the current directory:

1. **Registry lookup** — resolve the repo root, look up the path in `~/.gitme/repos.json`
2. **Org mapping** — read the remote URL, extract the org, match against configured mappings
3. **Default profile** — fall back to the default profile
4. **Prompt** — if running interactively, ask the user to pick

### Config files

All config lives in `~/.gitme/`:

```
~/.gitme/
├── config.json    # profiles, default profile, org-to-profile mappings
└── repos.json     # central repo registry (path → profile + metadata)
```

Nothing is written inside your repos. Portable, backupable, scriptable.

**`config.json`** structure:

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
    }
  },
  "orgMappings": {
    "acme-corp": "work",
    "tbenniks": "personal"
  }
}
```

---

## Tech stack

- **TypeScript** with strict mode
- **Vite+** unified toolchain (tsdown build, Vitest tests, oxlint linting, oxfmt formatting)
- **@clack/prompts** for beautiful interactive CLI output
- **picocolors** for terminal colors
- **commander** for CLI argument parsing
- Zero runtime dependencies beyond `git` and `ssh-keygen`

## Development

```bash
git clone https://github.com/timbenniks/gitme.git
cd gitme
npm install

npm run dev       # run from source (tsx)
npm run build     # build to dist/ (vp pack)
npm test          # run tests (vp test)
npm run check     # format + lint + typecheck (vp check)
```

## License

MIT
