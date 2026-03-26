import { describe, it, expect } from "vite-plus/test";
import { parseURL, toSSH, toHTTPS, isGitHubURL, stripSSHAlias } from "./url";

describe("parseURL", () => {
  it("parses SSH URLs", () => {
    const result = parseURL("git@github.com:acme/widget.git");
    expect(result).toEqual({
      host: "github.com",
      org: "acme",
      repo: "widget",
      original: "git@github.com:acme/widget.git",
    });
  });

  it("parses SSH URLs without .git suffix", () => {
    const result = parseURL("git@github.com:acme/widget");
    expect(result).toEqual({
      host: "github.com",
      org: "acme",
      repo: "widget",
      original: "git@github.com:acme/widget",
    });
  });

  it("parses HTTPS URLs", () => {
    const result = parseURL("https://github.com/acme/widget.git");
    expect(result).toEqual({
      host: "github.com",
      org: "acme",
      repo: "widget",
      original: "https://github.com/acme/widget.git",
    });
  });

  it("parses HTTPS URLs without .git suffix", () => {
    const result = parseURL("https://github.com/acme/widget");
    expect(result).toEqual({
      host: "github.com",
      org: "acme",
      repo: "widget",
      original: "https://github.com/acme/widget",
    });
  });

  it("parses shorthand org/repo", () => {
    const result = parseURL("acme/widget");
    expect(result).toEqual({
      host: "github.com",
      org: "acme",
      repo: "widget",
      original: "acme/widget",
    });
  });

  it("parses SSH alias URLs like github.com-work", () => {
    const result = parseURL("git@github.com-work:acme/widget.git");
    expect(result).toEqual({
      host: "github.com-work",
      org: "acme",
      repo: "widget",
      original: "git@github.com-work:acme/widget.git",
    });
  });

  it("returns null for null-ish input", () => {
    expect(parseURL(null as unknown as string)).toBeNull();
    expect(parseURL(undefined as unknown as string)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseURL("")).toBeNull();
  });

  it("returns null for invalid strings", () => {
    expect(parseURL("not-a-url")).toBeNull();
    expect(parseURL("ftp://example.com/foo/bar")).toBeNull();
  });
});

describe("toSSH", () => {
  it("produces git@host:org/repo.git", () => {
    const parsed = { host: "github.com", org: "acme", repo: "widget", original: "" };
    expect(toSSH(parsed, "github.com-work")).toBe("git@github.com-work:acme/widget.git");
  });
});

describe("toHTTPS", () => {
  it("produces https://github.com/org/repo", () => {
    const parsed = { host: "github.com-work", org: "acme", repo: "widget", original: "" };
    expect(toHTTPS(parsed)).toBe("https://github.com/acme/widget");
  });
});

describe("isGitHubURL", () => {
  it("returns true for valid GitHub URLs", () => {
    expect(isGitHubURL("git@github.com:acme/widget.git")).toBe(true);
    expect(isGitHubURL("https://github.com/acme/widget")).toBe(true);
    expect(isGitHubURL("acme/widget")).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isGitHubURL("")).toBe(false);
    expect(isGitHubURL("not-a-url")).toBe(false);
  });
});

describe("stripSSHAlias", () => {
  it("strips alias suffix from github.com-work", () => {
    expect(stripSSHAlias("github.com-work")).toBe("github.com");
  });

  it("returns github.com unchanged", () => {
    expect(stripSSHAlias("github.com")).toBe("github.com");
  });

  it("passes through other hosts unchanged", () => {
    expect(stripSSHAlias("gitlab.com")).toBe("gitlab.com");
  });
});
