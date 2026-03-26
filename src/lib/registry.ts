import fs from "node:fs";
import path from "node:path";
import type { Registry, RegistryEntry } from "../types";
import { getConfigDir } from "./config";
import { findRepoRoot } from "./git";

function getRegistryPath(): string {
  return path.join(getConfigDir(), "repos.json");
}

export function loadRegistry(): Registry {
  const registryPath = getRegistryPath();
  if (!fs.existsSync(registryPath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(registryPath, "utf-8");
    return JSON.parse(raw) as Registry;
  } catch {
    const backupPath = registryPath + ".backup." + Date.now();
    try {
      fs.copyFileSync(registryPath, backupPath);
    } catch {
      /* ignore backup failure */
    }
    return {};
  }
}

export function saveRegistry(registry: Registry): void {
  const registryPath = getRegistryPath();
  const tmpPath = registryPath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(registry, null, 2) + "\n", "utf-8");
  fs.renameSync(tmpPath, registryPath);
}

export function registerRepo(
  absPath: string,
  entry: Partial<RegistryEntry> & { profile: string; remote: string; org: string; repo: string },
): void {
  const registry = loadRegistry();
  registry[absPath] = {
    ...entry,
    clonedAt: entry.clonedAt || new Date().toISOString(),
    lastVerified: new Date().toISOString(),
  };
  saveRegistry(registry);
}

export function unregisterRepo(absPath: string): void {
  const registry = loadRegistry();
  delete registry[absPath];
  saveRegistry(registry);
}

export function lookupRepo(absPath: string): RegistryEntry | null {
  const registry = loadRegistry();
  const entry: RegistryEntry | undefined = registry[absPath];
  return entry ?? null;
}

/**
 * Find the repo root for cwd, then look it up in the registry.
 * Returns { absPath, entry } or null.
 */
export function findRepoInRegistry(cwd: string): { absPath: string; entry: RegistryEntry } | null {
  const repoRoot = findRepoRoot(cwd);
  if (!repoRoot) return null;

  const entry = lookupRepo(repoRoot);
  if (entry) {
    return { absPath: repoRoot, entry };
  }
  return null;
}
