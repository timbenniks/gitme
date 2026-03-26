import type { Command } from "commander";
import type { RepoContext } from "../lib/repoContext";
import type { GitHubIssue } from "../lib/github";
import * as clack from "@clack/prompts";
import { getRepoContext } from "../lib/repoContext";
import { createClient } from "../lib/github";
import { dim, bold, table, relativeTime } from "../lib/ui";
import { unwrap } from "../lib/cancel";

export function registerIssue(program: Command): void {
  const issueCmd = program.command("issue").description("Issue commands");

  // gitme issue list
  issueCmd
    .command("list")
    .description("List open issues")
    .action(async () => {
      const ctx: RepoContext | null = getRepoContext();
      if (!ctx) return;

      const s = clack.spinner();
      s.start("Fetching issues...");

      try {
        const client = createClient(ctx.profile.githubToken);
        const issues: GitHubIssue[] = await client.listIssues(ctx.org, ctx.repo);
        // Filter out PRs (GitHub API returns PRs in issues endpoint)
        const realIssues: GitHubIssue[] = issues.filter((i) => !i.pull_request);
        s.stop("Fetched issues");

        if (realIssues.length === 0) {
          clack.log.message(dim("No open issues."));
          return;
        }

        const headers: string[] = ["#", "TITLE", "AUTHOR", "CREATED"];
        const rows: string[][] = realIssues.map((issue) => [
          `#${issue.number}`,
          issue.title.length > 50 ? issue.title.slice(0, 47) + "..." : issue.title,
          issue.user.login,
          relativeTime(issue.created_at),
        ]);
        clack.log.message(table(headers, rows));
      } catch (err: unknown) {
        s.stop("Failed to fetch issues");
        clack.log.error(`Failed to list issues: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  // gitme issue create
  issueCmd
    .command("create")
    .description("Create an issue")
    .option("-t, --title <title>", "Issue title")
    .option("--body <body>", "Issue body")
    .action(async (opts: { title?: string; body?: string }) => {
      const ctx: RepoContext | null = getRepoContext();
      if (!ctx) return;

      let title: string | undefined = opts.title;
      if (!title) {
        const result = unwrap(await clack.text({ message: "Issue title:" }));
        title = result;
      }
      if (!title) {
        clack.log.warn("Title is required.");
        return;
      }

      let body: string | undefined = opts.body;
      if (!body) {
        const result = unwrap(await clack.text({ message: "Issue description (optional):" }));
        body = result;
      }

      const s = clack.spinner();
      s.start("Creating issue...");

      try {
        const client = createClient(ctx.profile.githubToken);
        const issue: GitHubIssue = await client.createIssue(ctx.org, ctx.repo, {
          title,
          body: body || "",
        });
        s.stop("Issue created");
        clack.log.success(`Issue #${issue.number} created: ${issue.html_url}`);
      } catch (err: unknown) {
        s.stop("Failed to create issue");
        clack.log.error(`Failed to create issue: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  // gitme issue view [number]
  issueCmd
    .command("view [number]")
    .description("View issue details")
    .action(async (number?: string) => {
      const ctx: RepoContext | null = getRepoContext();
      if (!ctx) return;

      let issueNumber: string | undefined = number;
      if (!issueNumber) {
        const result = unwrap(await clack.text({ message: "Issue number:" }));
        issueNumber = result;
      }

      const s = clack.spinner();
      s.start("Fetching issue...");

      try {
        const client = createClient(ctx.profile.githubToken);
        const issue: GitHubIssue = await client.getIssue(ctx.org, ctx.repo, issueNumber!);
        s.stop("Fetched issue");

        const lines: string[] = [];
        lines.push(bold(`#${issue.number}: ${issue.title}`));
        lines.push(
          dim(`${issue.state} \u2022 ${issue.user.login} \u2022 ${relativeTime(issue.created_at)}`),
        );
        if (issue.labels && issue.labels.length > 0) {
          lines.push(dim(`Labels: ${issue.labels.map((l) => l.name).join(", ")}`));
        }
        if (issue.body) {
          lines.push("");
          lines.push(issue.body);
        }
        lines.push("");
        lines.push(dim(issue.html_url));

        clack.log.message(lines.join("\n"));
      } catch (err: unknown) {
        s.stop("Failed to fetch issue");
        clack.log.error(`Failed to get issue: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });
}
