import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as clack from "@clack/prompts";
import type { Config, Profile } from "../types";

const CONFIG_DIR = path.join(os.homedir(), ".gitme");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: Config = {
  version: 1,
  defaultProfile: null,
  profiles: {},
  orgMappings: {},
};

export function getConfigDir(): string {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

export function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<Config>) };
  } catch {
    const backupPath = CONFIG_FILE + ".backup." + Date.now();
    try {
      fs.copyFileSync(CONFIG_FILE, backupPath);
    } catch {
      /* ignore */
    }
    clack.log.warn(`Config file corrupted. Backed up to ${backupPath} and reset to defaults.`);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Config): void {
  getConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}

export function getProfile(name: string): Profile | null {
  const config = loadConfig();
  const profile: Profile | undefined = config.profiles[name];
  return profile ?? null;
}

export function getDefaultProfile(): (Profile & { name: string }) | null {
  const config = loadConfig();
  const name = config.defaultProfile;
  if (!name) return null;
  const profile: Profile | undefined = config.profiles[name];
  if (!profile) return null;
  return { name, ...profile };
}

export function getOrgMapping(org: string): string | null {
  const config = loadConfig();
  const mapping: string | undefined = config.orgMappings[org];
  return mapping ?? null;
}

export function hasProfiles(): boolean {
  const config = loadConfig();
  return Object.keys(config.profiles).length > 0;
}

export function getProfileNames(): string[] {
  const config = loadConfig();
  return Object.keys(config.profiles);
}
