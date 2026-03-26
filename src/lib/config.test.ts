import { vi, describe, it, expect, beforeEach } from "vitest";

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: fsMock,
}));

import fs from "node:fs";
import {
  loadConfig,
  saveConfig,
  hasProfiles,
  getProfile,
  getOrgMapping,
  getConfigDir,
  getDefaultProfile,
  getProfileNames,
  configExists,
} from "./config";

const DEFAULT_CONFIG = {
  version: 1,
  defaultProfile: null,
  profiles: {},
  orgMappings: {},
};

const SAMPLE_CONFIG = {
  version: 1,
  defaultProfile: "work",
  profiles: {
    work: {
      githubUsername: "workuser",
      gitName: "Work User",
      gitEmail: "work@example.com",
      sshKeyPath: "/home/user/.ssh/id_work",
      sshHost: "github.com-work",
      githubToken: null,
    },
  },
  orgMappings: {
    "my-org": "work",
  },
};

const MULTI_PROFILE_CONFIG = {
  version: 1,
  defaultProfile: "work",
  profiles: {
    work: {
      githubUsername: "workuser",
      gitName: "Work User",
      gitEmail: "work@example.com",
      sshKeyPath: "/home/user/.ssh/id_work",
      sshHost: "github.com-work",
      githubToken: null,
    },
    personal: {
      githubUsername: "personaluser",
      gitName: "Personal User",
      gitEmail: "personal@example.com",
      sshKeyPath: "/home/user/.ssh/id_personal",
      sshHost: "github.com-personal",
      githubToken: null,
    },
  },
  orgMappings: {},
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadConfig", () => {
  it("returns default config when file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("parses valid JSON when file exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_CONFIG));

    const config = loadConfig();
    expect(config).toEqual(SAMPLE_CONFIG);
    expect(config.defaultProfile).toBe("work");
    expect(config.profiles.work?.gitEmail).toBe("work@example.com");
  });

  it("returns default config on corrupt JSON", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("not valid json {{{");

    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("returns default config when readFileSync throws", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("EACCES");
    });

    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});

describe("saveConfig", () => {
  it("calls writeFileSync with formatted JSON", () => {
    saveConfig(SAMPLE_CONFIG);

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(SAMPLE_CONFIG, null, 2) + "\n",
      { mode: 0o600 },
    );
  });
});

describe("getConfigDir", () => {
  it("creates directory if missing and returns path", () => {
    const dir = getConfigDir();

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true, mode: 0o700 });
    expect(typeof dir).toBe("string");
    expect(dir).toContain(".gitme");
  });
});

describe("getDefaultProfile", () => {
  it("returns profile with name when default exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_CONFIG));

    const result = getDefaultProfile();
    expect(result).not.toBeNull();
    expect(result!.name).toBe("work");
    expect(result!.githubUsername).toBe("workuser");
    expect(result!.gitEmail).toBe("work@example.com");
  });

  it("returns null when no default set", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ ...DEFAULT_CONFIG, profiles: { work: SAMPLE_CONFIG.profiles.work } }),
    );

    const result = getDefaultProfile();
    expect(result).toBeNull();
  });

  it("returns null when default points to nonexistent profile", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ ...DEFAULT_CONFIG, defaultProfile: "missing" }),
    );

    const result = getDefaultProfile();
    expect(result).toBeNull();
  });
});

describe("getProfileNames", () => {
  it("returns array of profile names", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(MULTI_PROFILE_CONFIG));

    const names = getProfileNames();
    expect(names).toEqual(["work", "personal"]);
  });

  it("returns empty array when no profiles exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const names = getProfileNames();
    expect(names).toEqual([]);
  });
});

describe("configExists", () => {
  it("returns true when config file exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    expect(configExists()).toBe(true);
  });

  it("returns false when config file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(configExists()).toBe(false);
  });
});

describe("hasProfiles", () => {
  it("returns true when profiles exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_CONFIG));

    expect(hasProfiles()).toBe(true);
  });

  it("returns false when profiles are empty", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(hasProfiles()).toBe(false);
  });
});

describe("getProfile", () => {
  it("returns profile by name", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_CONFIG));

    const profile = getProfile("work");
    expect(profile).toEqual(SAMPLE_CONFIG.profiles.work);
  });

  it("returns null when profile not found", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_CONFIG));

    const profile = getProfile("nonexistent");
    expect(profile).toBeNull();
  });
});

describe("getOrgMapping", () => {
  it("returns mapped profile name", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_CONFIG));

    expect(getOrgMapping("my-org")).toBe("work");
  });

  it("returns null when org not mapped", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_CONFIG));

    expect(getOrgMapping("unknown-org")).toBeNull();
  });
});
