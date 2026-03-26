import { describe, it, expect, vi, afterEach, beforeEach } from "vite-plus/test";
import { tildify, relativeTime, table } from "./ui";

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

    expect(lines).toHaveLength(3);
    // Each line starts with 2-space indent
    for (const line of lines) {
      expect(line.startsWith("  ")).toBe(true);
    }
  });

  it("handles empty rows", () => {
    const output = table(["COL"], []);
    const lines = output.split("\n");
    expect(lines).toHaveLength(1);
  });
});
