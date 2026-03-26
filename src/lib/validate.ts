const PROFILE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,29}$/;
const ORG_NAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?$/;

export function isValidProfileName(name: string): boolean {
  return PROFILE_NAME_RE.test(name);
}

export function isValidOrgName(name: string): boolean {
  return ORG_NAME_RE.test(name);
}

export function validateProfileName(name: string | undefined): string | undefined {
  if (!name) return "Profile name is required.";
  if (!PROFILE_NAME_RE.test(name))
    return "Must start with a letter, contain only letters/numbers/dashes/underscores, 1-30 chars.";
  return undefined;
}

export function validateOrgName(name: string | undefined): string | undefined {
  if (!name) return undefined; // empty is OK for "skip" flows
  if (!ORG_NAME_RE.test(name)) return "Must contain only letters, numbers, dashes, or underscores.";
  return undefined;
}
