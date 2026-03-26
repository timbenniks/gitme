import pc from "picocolors";
import gradient from "gradient-string";

const y = pc.yellow;
const w = pc.white;

const gigiGradient = gradient("#22c55e", "#06b6d4", "#a855f7");

function buildLogo(tagline: string[]): string {
  const t = (i: number): string => {
    const line = tagline[i];
    return line ? `   ${line}` : "";
  };

  const art = [
    "      \u2584\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2584",
    "    \u2584\u2588  \u25C9    \u25C9  \u2588\u2584",
    "   \u2588\u2588\u2588    \u2580\u2580      \u2588\u2588\u2588",
    "   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588",
    "    \u2580\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2580",
    "       \u2580\u2588\u2588\u2588\u2580 \u2580\u2588\u2588\u2588",
  ];

  const coloredArt = gigiGradient.multiline(art.join("\n")).split("\n");

  const tongue = pc.cyan("\u2500\u2500\u2500\u2500\u2500") + y("\u25CF");
  const dot1 = pc.cyan("   ") + y("\u25CF");
  const dot2 = pc.cyan("  ") + y("\u25CF");

  return [
    (coloredArt[0] ?? "") + t(0),
    (coloredArt[1] ?? "") + t(1),
    (coloredArt[2] ?? "") + tongue + t(2),
    (coloredArt[3] ?? "") + dot1 + t(3),
    (coloredArt[4] ?? "") + dot2 + t(4),
    (coloredArt[5] ?? "") + t(5),
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
 * Print the welcome mascot with a typing animation for the taglines.
 */
export async function printWelcomeAnimated(): Promise<void> {
  const taglines = [
    "Hey! I'm Gigi the gitmeleon.",
    "I help you juggle GitHub identities.",
    "Set up once, never think about it again.",
  ];

  // Print the logo part (Gigi art) instantly, without taglines
  const plainLogo = buildLogo(["", "", "", ""]);
  console.log();
  console.log(plainLogo);

  // Type out each tagline
  for (let i = 0; i < taglines.length; i++) {
    const line = taglines[i] as string;
    const styled = i === 0 ? pc.bold(w(line)) : pc.dim(line);

    // Print chars one by one
    for (let j = 0; j < line.length; j++) {
      const partial = line.slice(0, j + 1);
      const styledPartial = i === 0 ? pc.bold(w(partial)) : pc.dim(partial);
      process.stdout.write(`\r   ${styledPartial}`);
      await sleep(25);
    }
    // Finish the line
    process.stdout.write(`\r   ${styled}\n`);
  }

  console.log();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the compact logo string for use in clack.intro().
 */
export function getBanner(): string {
  const g = gigiGradient;
  return `${g("\u2588")}${w("\u25C9")}${g("\u2588")}${pc.cyan("\u2500")}${y("\u25CF")} ${pc.bold(w("gitme"))}`;
}
