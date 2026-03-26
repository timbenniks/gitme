import type { Command } from "commander";
import pc from "picocolors";
import gradient from "gradient-string";
import { gigiSays } from "../lib/gigi";

const gigiGradient = gradient("#22c55e", "#06b6d4", "#a855f7");

const BIG_GIGI = `
            ▄▄██████████████▄▄
         ▄██                  ██▄
       ▄██   ▄██▄      ▄██▄    ██▄
      ██    █◉  █    █◉  █     ██
     ██     ▀██▀      ▀██▀      ██
     ██                          ██▄▄▄▄▄▄
     ██       ▀▀▀▀▀▀▀▀▀▀        ██──────●
     ██                          ██   ●
      ██                        ██  ●
       ██▄                    ▄██
         ██▄▄            ▄▄██
       ▄██   ██████████████
      ██▀                  ▀██
     ██   ▄▄▄▄▄▄    ▄▄▄▄▄▄  ██
     ██▄▄█      █▄▄█      █▄██
        ▀▀       ▀▀▀       ▀▀
`;

export function registerGigi(program: Command): void {
  program
    .command("gigi")
    .description("Say hi to Gigi")
    .option("-s, --shout", "Gigi has something to say")
    .action((opts: { shout?: boolean }) => {
      console.log(gigiGradient.multiline(BIG_GIGI));

      if (opts.shout) {
        const msg = gigiSays().replace(/^.*~ /, "");
        console.log(pc.bold(pc.yellow(`  "${msg}"`)));
        console.log(pc.dim("      — Gigi the gitmeleon\n"));
      } else {
        console.log(gigiSays());
        console.log();
      }
    });
}
