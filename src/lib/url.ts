// GitHub URL parsing and rewriting

import type { ParsedURL } from "../types";

const SSH_RE = /^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/;
const HTTPS_RE = /^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/;
const SHORTHAND_RE = /^([^/]+)\/([^/]+)$/;

/**
 * Parse a GitHub URL (SSH, HTTPS, shorthand, or SSH-alias) into parts.
 * Returns { host, org, repo, original } or null if not parseable.
 */
export function parseURL(url: string): ParsedURL | null {
  if (!url) return null;
  const trimmed = url.trim();

  // SSH: git@github.com:org/repo.git or git@github.com-alias:org/repo.git
  let match = trimmed.match(SSH_RE);
  if (match) {
    return { host: match[1]!, org: match[2]!, repo: match[3]!, original: trimmed };
  }

  // HTTPS: https://github.com/org/repo.git
  match = trimmed.match(HTTPS_RE);
  if (match) {
    return { host: match[1]!, org: match[2]!, repo: match[3]!, original: trimmed };
  }

  // Shorthand: org/repo
  match = trimmed.match(SHORTHAND_RE);
  if (match) {
    return { host: "github.com", org: match[1]!, repo: match[2]!, original: trimmed };
  }

  return null;
}

/**
 * Rebuild as SSH URL with a specific host alias.
 * e.g. toSSH(parsed, 'github.com-work') → git@github.com-work:org/repo.git
 */
export function toSSH(parsed: ParsedURL, sshHost: string): string {
  return `git@${sshHost}:${parsed.org}/${parsed.repo}.git`;
}

/**
 * Rebuild as HTTPS URL.
 */
export function toHTTPS(parsed: ParsedURL): string {
  return `https://github.com/${parsed.org}/${parsed.repo}`;
}

/**
 * Check if a string is a GitHub URL (any format).
 */
export function isGitHubURL(str: string): boolean {
  return parseURL(str) !== null;
}

/**
 * Extract the base hostname from a potentially aliased host.
 * e.g. 'github.com-work' → 'github.com'
 */
export function stripSSHAlias(host: string): string {
  if (host.startsWith("github.com")) return "github.com";
  return host;
}
