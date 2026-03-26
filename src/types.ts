export interface Profile {
  githubUsername: string;
  gitName: string;
  gitEmail: string;
  sshKeyPath: string;
  sshHost: string;
  githubToken: string | null;
}

export interface Config {
  version: number;
  defaultProfile: string | null;
  profiles: Record<string, Profile>;
  orgMappings: Record<string, string>;
}

export interface RegistryEntry {
  profile: string;
  remote: string;
  org: string;
  repo: string;
  clonedAt: string;
  lastVerified: string;
}

export type Registry = Record<string, RegistryEntry>;

export interface ParsedURL {
  host: string;
  org: string;
  repo: string;
  original: string;
}

export interface SSHKeyInfo {
  name: string;
  path: string;
  pubPath: string;
  comment: string | null;
}

export interface ScanResult {
  gitConfig: { name: string | null; email: string | null };
  sshKeys: SSHKeyInfo[];
  sshAliases: string[];
  ghUsernames: string[];
}

export interface ResolvedProfile {
  profileName: string | null;
  profile: Profile | null;
  source: "registry" | "org-mapping" | "default" | null;
}

export interface DiscoveredRepo {
  path: string;
  remote: string | null;
  org: string | null;
  repo: string | null;
  suggestedProfile: string | null;
}
