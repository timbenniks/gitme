import * as clack from "@clack/prompts";
import type { Config } from "../types";
import { unwrap } from "./cancel";

/**
 * Show an interactive profile picker. Returns the selected profile name.
 */
export async function selectProfile(
  config: Config,
  message: string = "Which profile?",
): Promise<string> {
  const profileNames = Object.keys(config.profiles);
  const result = unwrap(
    await clack.select({
      message,
      options: profileNames.map((name) => {
        const p = config.profiles[name];
        return {
          label: name,
          hint: p?.gitEmail ?? "",
          value: name,
        };
      }),
    }),
  );
  return result as string;
}
