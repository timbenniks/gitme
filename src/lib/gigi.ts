import pc from "picocolors";

const quotes = [
  "Blending into your work identity...",
  "A true chameleon never forgets its colors.",
  "One shell, many faces.",
  "Switching skins like it's nothing.",
  "You can't push with the wrong face on.",
  "Identity crisis? Not on my watch.",
  "Different org, different vibe. I got you.",
  "Camouflage: activated.",
  "Your commits, your rules, your identity.",
  "Even chameleons need a good SSH key.",
  "Adapt. Commit. Push. Repeat.",
  "No two repos see the same me.",
  "Profile swapped faster than you can blink.",
  "The secret? Always know which hat you're wearing.",
  "Trust the process. Trust the chameleon.",
];

const celebrations = [
  "Nailed it! Gigi approves.",
  "Another repo, another identity. Flawless.",
  "That went smoother than a color shift.",
  "Chameleon-grade setup complete.",
  "You're all set! Time to blend in.",
  "Perfectly disguised. Happy committing!",
  "SSH keys aligned, identity locked. Beautiful.",
  "Gigi is proud of you.",
];

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)] as string;
}

/** Random chameleon-themed quip for general use. */
export function gigiSays(): string {
  return pc.dim(`~ ${pick(quotes)}`);
}

/** Random celebration quip for success moments. */
export function gigiCelebrates(): string {
  return pc.dim(`~ ${pick(celebrations)}`);
}

/** Sparkle celebration banner for big moments. */
export function gigiSparkle(): string {
  const msg = pick(celebrations);
  const sparkle = pc.dim("  \u30FB\uFF9F\u2727  \u30FB\uFF9F\u2727  \u30FB\uFF9F\u2727");
  const star = pc.yellow("\u2728");
  return [sparkle, `  ${star}  ${pc.bold(msg)}  ${star}`, sparkle].join("\n");
}
