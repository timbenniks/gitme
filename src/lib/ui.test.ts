import { describe, it, expect, vi, afterEach, beforeEach } from "vite-plus/test";
import { tildify, relativeTime, table, identityBox, profileBadge, hyperlink } from "./ui";

describe("tildify", () => {
  const originalHome = process.env.HOME;

  afterEach(() => {
    process.env.HOME = originalHome;
  });

  it("replaces HOME prefix with ~", () => {
    process.env.HOME = "/Users/testuser";
    expect(tildify("/Users/testuser/projects/foo")).toBe("~/projects/foo");
  });

  it("returns path unchanged when it does not start with HOME", () => {
    process.env.HOME = "/Users/testuser";
    expect(tildify("/opt/data/file.txt")).toBe("/opt/data/file.txt");
  });

  it("returns path unchanged when HOME is unset", () => {
    delete process.env.HOME;
    delete process.env.USERPROFILE;
    expect(tildify("/some/absolute/path")).toBe("/some/absolute/path");
  });
});

describe("relativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for the current time', () => {
    expect(relativeTime(new Date("2025-06-15T12:00:00Z"))).toBe("just now");
  });

  it('returns "5 minutes ago"', () => {
    const fiveMinAgo = new Date("2025-06-15T11:55:00Z");
    expect(relativeTime(fiveMinAgo)).toBe("5 minutes ago");
  });

  it('returns "2 hours ago"', () => {
    const twoHoursAgo = new Date("2025-06-15T10:00:00Z");
    expect(relativeTime(twoHoursAgo)).toBe("2 hours ago");
  });

  it('returns "3 days ago"', () => {
    const threeDaysAgo = new Date("2025-06-12T12:00:00Z");
    expect(relativeTime(threeDaysAgo)).toBe("3 days ago");
  });

  it('returns "1 week ago"', () => {
    const oneWeekAgo = new Date("2025-06-08T12:00:00Z");
    expect(relativeTime(oneWeekAgo)).toBe("1 week ago");
  });

  it('returns "2 months ago"', () => {
    const twoMonthsAgo = new Date("2025-04-15T12:00:00Z");
    expect(relativeTime(twoMonthsAgo)).toBe("2 months ago");
  });

  it('returns "just now" for future dates', () => {
    const future = new Date("2025-06-15T13:00:00Z");
    expect(relativeTime(future)).toBe("just now");
  });
});

describe("table", () => {
  it("produces properly formatted string with padded columns", () => {
    const headers = ["NAME", "AGE"];
    const rows = [
      ["Alice", "30"],
      ["Bob", "7"],
    ];

    const output = table(headers, rows);
    const lines = output.split("\n");

    // header + rule + 2 data rows
    expect(lines).toHaveLength(4);
    // Each line starts with 2-space indent
    for (const line of lines) {
      expect(line.startsWith("  ")).toBe(true);
    }
  });

  it("handles empty rows", () => {
    const output = table(["COL"], []);
    const lines = output.split("\n");
    // header + rule, no data rows
    expect(lines).toHaveLength(2);
  });

  it("handles ANSI-colored cells without breaking alignment", () => {
    const colored = profileBadge("work");
    const headers = ["PROFILE", "VALUE"];
    const rows = [
      [colored, "test"],
      ["plain", "data"],
    ];
    const output = table(headers, rows);
    const lines = output.split("\n");
    // header + rule + 2 data rows
    expect(lines).toHaveLength(4);
    // Contains separator character
    expect(output).toContain("\u2502");
  });

  it("contains rule line with box-drawing characters", () => {
    const output = table(["A", "B"], [["1", "2"]]);
    const lines = output.split("\n");
    // Second line is the rule
    expect(lines[1]).toContain("\u2500");
    expect(lines[1]).toContain("\u253c");
  });
});

describe("identityBox", () => {
  it("wraps content in a rounded box", () => {
    const result = identityBox("hello");
    expect(result).toContain("hello");
    // Rounded corners
    expect(result).toContain("\u256D");
    expect(result).toContain("\u256E");
    expect(result).toContain("\u256F");
    expect(result).toContain("\u2570");
  });

  it("handles multi-line content", () => {
    const result = identityBox("line1\nline2");
    expect(result).toContain("line1");
    expect(result).toContain("line2");
  });
});

describe("profileBadge", () => {
  it("returns a string containing the profile name", () => {
    const badge = profileBadge("personal");
    expect(badge).toContain("personal");
  });

  it("is deterministic for the same name", () => {
    const a = profileBadge("work");
    const b = profileBadge("work");
    expect(a).toBe(b);
  });

  it("contains the name even for various inputs", () => {
    for (const name of ["personal", "work", "freelance", "oss", "client-x"]) {
      expect(profileBadge(name)).toContain(name);
    }
  });
});

describe("hyperlink", () => {
  it("wraps URL in OSC 8 escape sequence", () => {
    const result = hyperlink("https://example.com");
    expect(result).toContain("https://example.com");
    expect(result).toContain("\x1b]8;;");
  });

  it("uses custom display text when provided", () => {
    const result = hyperlink("https://example.com", "Click here");
    expect(result).toContain("Click here");
    expect(result).toContain("https://example.com");
  });

  it("uses URL as display text when no text provided", () => {
    const result = hyperlink("https://example.com");
    // URL appears as both the link target and display text
    const occurrences = result.split("https://example.com").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});
