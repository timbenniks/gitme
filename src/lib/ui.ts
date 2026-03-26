import pc from "picocolors";
import boxen from "boxen";

// Symbols — monochrome Unicode only, no emoji
export const symbols = {
  check: "✓",
  cross: "✗",
  arrow: "→",
  bullet: "•",
  warning: "▲",
  pin: "◆",
  person: "●",
  key: "⚷",
  email: "✉",
  link: "⤷",
  lock: "◈",
  branch: "⎇",
  search: "⊙",
  clipboard: "❐",
  name: "≡",
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

// Boxed identity card for whoami / dashboard
export function identityBox(content: string): string {
  return boxen(content, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: "round",
    borderColor: "gray",
  });
}

// Deterministic color badge for profile names
const profileColors: Array<(s: string) => string> = [
  pc.green,
  pc.cyan,
  pc.magenta,
  pc.yellow,
  pc.blue,
  pc.red,
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function profileBadge(name: string): string {
  const colorFn = profileColors[hashString(name) % profileColors.length] as (s: string) => string;
  return pc.bold(colorFn(name));
}

// Terminal hyperlink (OSC 8) — clickable in iTerm2, Wezterm, modern terminals
export function hyperlink(url: string, text?: string): string {
  const display = text || url;
  return `\x1b]8;;${url}\x1b\\${display}\x1b]8;;\x1b\\`;
}
