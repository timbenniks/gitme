import type { Command } from "commander";
import type { RepoContext } from "../lib/repoContext";
import type { GitHubPR } from "../lib/github";
import * as clack from "@clack/prompts";
import { getBranch } from "../lib/git";
import { getRepoContext } from "../lib/repoContext";
import { createClient } from "../lib/github";
import { dim, bold, table, relativeTime } from "../lib/ui";
import { unwrap } from "../lib/cancel";

export function registerPR(program: Command): void {
  const prCmd = program.command("pr").description("Pull request commands");

  // gitme pr list
  prCmd
    .command("list")
    .description("List open pull requests")
    .action(async () => {
      const ctx: RepoContext | null = getRepoContext();
      if (!ctx) return;

      const s = clack.spinner();
      s.start("Fetching pull requests...");

      try {
        const client = createClient(ctx.profile.githubToken);
        const prs: GitHubPR[] = await client.listPRs(ctx.org, ctx.repo);
        s.stop("Fetched pull requests");

        if (prs.length === 0) {
          clack.log.message(dim("No open pull requests."));
          return;
        }

        const headers: string[] = ["#", "TITLE", "AUTHOR", "CREATED"];
        const rows: string[][] = prs.map((pr) => [
          `#${pr.number}`,
          pr.title.length > 50 ? pr.title.slice(0, 47) + "..." : pr.title,
          pr.user.login,
          relativeTime(pr.created_at),
        ]);
        clack.log.message(table(headers, rows));
      } catch (err: unknown) {
        s.stop("Failed to fetch pull requests");
        clack.log.error(`Failed to list PRs: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  // gitme pr create
  prCmd
    .command("create")
    .description("Create a pull request")
    .option("-t, --title <title>", "PR title")
    .option("-b, --base <branch>", "Base branch", "main")
    .option("--body <body>", "PR body")
    .action(async (opts: { title?: string; base: string; body?: string }) => {
      const ctx: RepoContext | null = getRepoContext();
      if (!ctx) return;

      const head: string | null = getBranch(ctx.repoRoot);
      if (!head || head === opts.base) {
        clack.log.warn(
          `Current branch (${head}) is the same as base (${opts.base}). Create a feature branch first.`,
        );
        return;
      }

      let title: string | undefined = opts.title;
      if (!title) {
        const result = unwrap(await clack.text({ message: "PR title:" }));
        title = result;
      }
      if (!title) {
        clack.log.warn("Title is required.");
        return;
      }

      let body: string | undefined = opts.body;
      if (!body) {
        const result = unwrap(await clack.text({ message: "PR description (optional):" }));
        body = result;
      }

      const s = clack.spinner();
      s.start("Creating pull request...");

      try {
        const client = createClient(ctx.profile.githubToken);
        const pr: GitHubPR = await client.createPR(ctx.org, ctx.repo, {
          title,
          body: body || "",
          head,
          base: opts.base,
        });
        s.stop("Pull request created");
        clack.log.success(`PR #${pr.number} created: ${pr.html_url}`);
      } catch (err: unknown) {
        s.stop("Failed to create pull request");
        clack.log.error(`Failed to create PR: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  // gitme pr view [number]
  prCmd
    .command("view [number]")
    .description("View pull request details")
    .action(async (number?: string) => {
      const ctx: RepoContext | null = getRepoContext();
      if (!ctx) return;

      let prNumber: string | undefined = number;
      if (!prNumber) {
        const result = unwrap(await clack.text({ message: "PR number:" }));
        prNumber = result;
      }

      const s = clack.spinner();
      s.start("Fetching pull request...");

      try {
        const client = createClient(ctx.profile.githubToken);
        const pr: GitHubPR = await client.getPR(ctx.org, ctx.repo, prNumber!);
        s.stop("Fetched pull request");

        const lines: string[] = [];
        lines.push(bold(`#${pr.number}: ${pr.title}`));
        lines.push(
          dim(`${pr.state} \u2022 ${pr.user.login} \u2022 ${pr.head.ref} \u2192 ${pr.base.ref}`),
        );
        lines.push(dim(`Created ${relativeTime(pr.created_at)}`));
        if (pr.body) {
          lines.push("");
          lines.push(pr.body);
        }
        lines.push("");
        lines.push(dim(pr.html_url));

        clack.log.message(lines.join("\n"));
      } catch (err: unknown) {
        s.stop("Failed to fetch pull request");
        clack.log.error(`Failed to get PR: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  // gitme pr status
  prCmd
    .command("status")
    .description("Show PRs relevant to you")
    .action(async () => {
      const ctx: RepoContext | null = getRepoContext();
      if (!ctx) return;

      const s = clack.spinner();
      s.start("Fetching PR status...");

      try {
        const client = createClient(ctx.profile.githubToken);
        const status: { authored: GitHubPR[]; reviewRequested: GitHubPR[] } =
          await client.getPRStatus(ctx.org, ctx.repo, ctx.profile.githubUsername);
        s.stop("Fetched PR status");

        const authoredLines: string[] = [];
        if (status.authored.length > 0) {
          authoredLines.push(bold("Created by you:"));
          for (const pr of status.authored) {
            authoredLines.push(`  #${pr.number} ${pr.title}`);
          }
        } else {
          authoredLines.push(dim("No open PRs created by you."));
        }
        clack.log.message(authoredLines.join("\n"));

        const reviewLines: string[] = [];
        if (status.reviewRequested.length > 0) {
          reviewLines.push(bold("Review requested:"));
          for (const pr of status.reviewRequested) {
            reviewLines.push(`  #${pr.number} ${pr.title}`);
          }
        } else {
          reviewLines.push(dim("No review requests."));
        }
        clack.log.message(reviewLines.join("\n"));
      } catch (err: unknown) {
        s.stop("Failed to fetch PR status");
        clack.log.error(`Failed to get PR status: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });
}
