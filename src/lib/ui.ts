import pc from "picocolors";

// Symbols for consistent output
export const symbols = {
  check: "✓",
  cross: "✗",
  arrow: "→",
  bullet: "•",
  warning: "▲",
  pin: "📍",
  person: "👤",
  key: "🔑",
  email: "📧",
  link: "🔗",
  lock: "🔐",
  branch: "🌿",
  search: "🔍",
  clipboard: "📋",
};

// Color helpers
export const success = (msg: string): string => pc.green(`✓ ${msg}`);
export const warn = (msg: string): string => pc.yellow(`▲ ${msg}`);
export const error = (msg: string): string => pc.red(`✗ ${msg}`);
export const info = (msg: string): string => pc.blue(msg);
export const dim = (msg: string): string => pc.dim(msg);
export const bold = (msg: string): string => pc.bold(msg);
export const label = (key: string, value: string): string => `  ${pc.dim(key + ":")}  ${value}`;

// Replace $HOME with ~ for display
export function tildify(absPath: string): string {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home && absPath.startsWith(home)) {
    return "~" + absPath.slice(home.length);
  }
  return absPath;
}

// Relative time from a date string or Date
export function relativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months} month${months === 1 ? "" : "s"} ago`;
  if (weeks > 0) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (minutes > 0) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  return "just now";
}

// Simple table formatter with padded columns
export function table(headers: string[], rows: string[][]): string {
  const allRows = [headers, ...rows];
  const colWidths = headers.map((_, i) =>
    Math.max(...allRows.map((row) => String(row[i] || "").length)),
  );

  const headerLine = headers.map((h, i) => pc.dim(String(h).padEnd(colWidths[i] ?? 0))).join("  ");

  const dataLines = rows.map((row) =>
    row.map((cell, i) => String(cell || "").padEnd(colWidths[i] ?? 0)).join("  "),
  );

  return ["  " + headerLine, ...dataLines.map((l) => "  " + l)].join("\n");
}
