const API_BASE = "https://api.github.com";

interface GitHubAPIError extends Error {
  status: number;
  body: string;
}

interface CreatePRParams {
  title: string;
  body: string;
  head: string;
  base: string;
}

interface CreateIssueParams {
  title: string;
  body: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  body?: string;
  user: { login: string };
  head: { ref: string };
  base: { ref: string };
  requested_reviewers?: { login: string }[];
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  body?: string;
  user: { login: string };
  labels?: { name: string }[];
  pull_request?: unknown;
}

export interface GitHubUser {
  login: string;
  name: string;
  email: string;
}

export interface GitHubClient {
  listPRs(org: string, repo: string, state?: string): Promise<GitHubPR[]>;
  createPR(org: string, repo: string, params: CreatePRParams): Promise<GitHubPR>;
  getPR(org: string, repo: string, number: string | number): Promise<GitHubPR>;
  listIssues(org: string, repo: string, state?: string): Promise<GitHubIssue[]>;
  createIssue(org: string, repo: string, params: CreateIssueParams): Promise<GitHubIssue>;
  getIssue(org: string, repo: string, number: string | number): Promise<GitHubIssue>;
  getAuthenticatedUser(): Promise<GitHubUser>;
  getPRStatus(
    org: string,
    repo: string,
    username: string,
  ): Promise<{ authored: GitHubPR[]; reviewRequested: GitHubPR[] }>;
}

/**
 * Create a GitHub API client authenticated with a personal access token.
 */
export function createClient(token: string | null): GitHubClient {
  async function request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${API_BASE}${path}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "gitme-cli",
    };
    if (token) {
      headers.Authorization = `token ${token}`;
    }

    const opts: RequestInit = { method, headers };
    if (body) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);

    if (!res.ok) {
      const errBody = await res.text();
      const err = new Error(`GitHub API error: ${res.status} ${res.statusText}`) as GitHubAPIError;
      err.status = res.status;
      err.body = errBody;
      throw err;
    }

    if (res.status === 204) return null as T;
    return res.json() as Promise<T>;
  }

  return {
    async listPRs(org, repo, state = "open") {
      return request<GitHubPR[]>("GET", `/repos/${org}/${repo}/pulls?state=${state}&per_page=30`);
    },

    async createPR(org, repo, { title, body, head, base }) {
      return request<GitHubPR>("POST", `/repos/${org}/${repo}/pulls`, { title, body, head, base });
    },

    async getPR(org, repo, number) {
      return request<GitHubPR>("GET", `/repos/${org}/${repo}/pulls/${number}`);
    },

    async listIssues(org, repo, state = "open") {
      return request<GitHubIssue[]>(
        "GET",
        `/repos/${org}/${repo}/issues?state=${state}&per_page=30`,
      );
    },

    async createIssue(org, repo, { title, body }) {
      return request<GitHubIssue>("POST", `/repos/${org}/${repo}/issues`, { title, body });
    },

    async getIssue(org, repo, number) {
      return request<GitHubIssue>("GET", `/repos/${org}/${repo}/issues/${number}`);
    },

    async getAuthenticatedUser() {
      return request<GitHubUser>("GET", "/user");
    },

    async getPRStatus(org, repo, username) {
      // Single API call, filter twice
      const prs = await request<GitHubPR[]>(
        "GET",
        `/repos/${org}/${repo}/pulls?state=open&per_page=30`,
      );
      return {
        authored: prs.filter((pr) => pr.user.login === username),
        reviewRequested: prs.filter((pr) =>
          pr.requested_reviewers?.some((r) => r.login === username),
        ),
      };
    },
  };
}
