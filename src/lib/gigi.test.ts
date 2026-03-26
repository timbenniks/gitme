import { describe, it, expect } from "vite-plus/test";
import { gigiSays, gigiCelebrates, gigiSparkle } from "./gigi";

describe("gigiSays", () => {
  it("returns a string containing ~", () => {
    const result = gigiSays();
    expect(result).toContain("~");
  });

  it("returns different quotes over multiple calls", () => {
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(gigiSays());
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("gigiCelebrates", () => {
  it("returns a string containing ~", () => {
    const result = gigiCelebrates();
    expect(result).toContain("~");
  });

  it("returns different quotes over multiple calls", () => {
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(gigiCelebrates());
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("gigiSparkle", () => {
  it("returns a multi-line string with sparkle characters", () => {
    const result = gigiSparkle();
    const lines = result.split("\n");
    expect(lines.length).toBe(3);
  });

  it("contains star emoji", () => {
    const result = gigiSparkle();
    expect(result).toContain("\u2728");
  });

  it("contains sparkle characters", () => {
    const result = gigiSparkle();
    expect(result).toContain("\u2727");
  });
});
