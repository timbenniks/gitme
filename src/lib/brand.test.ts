import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { printLogo, printWelcome, printWelcomeAnimated, getBanner } from "./brand";

describe("printLogo", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    spy.mockRestore();
  });

  it("prints the logo with gitme text", () => {
    printLogo();
    const output = spy.mock.calls.map((c: unknown[]) => c.join("")).join("\n");
    expect(output).toContain("gitme");
  });

  it("prints 6-line ASCII art", () => {
    printLogo();
    // Find the call that contains the actual logo (multi-line string)
    const logoCall = spy.mock.calls.find((c: unknown[]) => String(c[0]).includes("gitme"));
    expect(logoCall).toBeDefined();
    const lines = String(logoCall![0]).split("\n");
    expect(lines.length).toBe(6);
  });
});

describe("printWelcome", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    spy.mockRestore();
  });

  it("prints the welcome message with Gigi intro", () => {
    printWelcome();
    const output = spy.mock.calls.map((c: unknown[]) => c.join("")).join("\n");
    expect(output).toContain("Gigi");
  });
});

describe("printWelcomeAnimated", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });
  afterEach(() => {
    vi.useRealTimers();
    logSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it("resolves and writes taglines to stdout", async () => {
    const promise = printWelcomeAnimated();
    // Fast-forward all timers to complete the animation
    await vi.runAllTimersAsync();
    await promise;

    // Should have written characters to stdout
    expect(writeSpy).toHaveBeenCalled();
    const allWrites = writeSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("");
    expect(allWrites).toContain("Gigi");
  });
});

describe("getBanner", () => {
  it("returns a string containing gitme", () => {
    const banner = getBanner();
    expect(banner).toContain("gitme");
  });

  it("returns a single-line string", () => {
    const banner = getBanner();
    expect(banner.includes("\n")).toBe(false);
  });
});
