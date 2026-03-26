import * as clack from "@clack/prompts";

/**
 * Check if a clack prompt was cancelled. If so, exit with code 130 (SIGINT).
 * Returns the unwrapped value if not cancelled.
 */
export function unwrap<T>(result: T | symbol): T {
  if (clack.isCancel(result)) {
    clack.outro("Cancelled.");
    process.exit(130);
  }
  return result;
}
