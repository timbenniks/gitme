import pc from "picocolors";

const g = pc.green;
const c = pc.cyan;
const y = pc.yellow;
const w = pc.white;

function buildLogo(tagline: string[]): string {
  const t = (i: number): string => {
    const line = tagline[i];
    return line ? `   ${line}` : "";
  };

  return [
    g("      \u2584\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2584") + t(0),
    g("    \u2584\u2588") + w("  \u25C9    \u25C9  ") + g("\u2588\u2584") + t(1),
    g("   \u2588\u2588\u2588") +
      w("    \u2580\u2580      ") +
      g("\u2588\u2588\u2588") +
      c("\u2500\u2500\u2500\u2500\u2500") +
      y("\u25CF") +
      t(2),
    g(
      "   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
    ) +
      c("   ") +
      y("\u25CF") +
      t(3),
    g(
      "    \u2580\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2580",
    ) +
      c("  ") +
      y("\u25CF") +
      t(4),
    g("       \u2580\u2588\u2588\u2588\u2580 \u2580\u2588\u2588\u2588") + t(5),
  ].join("\n");
}

const LOGO = buildLogo(["", pc.bold(w("gitme")), pc.dim("multi-account github cli")]);

const WELCOME = buildLogo([
  "",
  pc.bold(w("Hey! I'm Gigi the gitmeleon.")),
  pc.dim("I help you juggle GitHub identities."),
  pc.dim("Set up once, never think about it again."),
]);

/**
 * Print the full logo with project name.
 */
export function printLogo(): void {
  console.log();
  console.log(LOGO);
  console.log();
}

/**
 * Print the welcome mascot for first-run.
 */
export function printWelcome(): void {
  console.log();
  console.log(WELCOME);
  console.log();
}

/**
 * Get the compact logo string for use in clack.intro().
 */
export function getBanner(): string {
  return `${g("\u2588")}${w("\u25C9")}${g("\u2588")}${c("\u2500")}${y("\u25CF")} ${pc.bold(w("gitme"))}`;
}
