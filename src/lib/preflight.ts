import { execFileSync } from "node:child_process";
import * as clack from "@clack/prompts";

function commandExists(cmd: string): boolean {
  try {
    execFileSync(cmd, ["--version"], { stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch (err: unknown) {
    const e = err as { code?: string };
    // ENOENT = command not found. Other errors = command exists but failed (which is fine)
    return e.code !== "ENOENT";
  }
}

/**
 * Check that required system tools (git, ssh-keygen) are available.
 * Exits with helpful message if not found.
 */
export function checkDependencies(): void {
  if (!commandExists("git")) {
    clack.log.error("git is not installed or not in PATH.");
    clack.log.message("Install git: https://git-scm.com/downloads");
    process.exit(1);
  }

  if (!commandExists("ssh-keygen")) {
    clack.log.error("ssh-keygen is not installed or not in PATH.");
    clack.log.message("Install OpenSSH: https://www.openssh.com");
    process.exit(1);
  }
}
