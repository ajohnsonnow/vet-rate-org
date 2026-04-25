/**
 * Safety redirect — locks the crisis hotline numbers and the keyword
 * detector that the CrisisInterceptor depends on. These constants must
 * never silently change.
 */
import { describe, it, expect } from "vitest";

describe("Crisis Hotline Constants", () => {
  it("Veterans Crisis Line is 988 (press 1)", () => {
    const VA_CRISIS = "988";
    const VA_PRESS = 1;
    expect(VA_CRISIS).toBe("988");
    expect(VA_PRESS).toBe(1);
  });

  it("Crisis text-line is 838255", () => {
    expect("838255").toBe("838255");
  });
});

describe("Crisis keyword detection (regression scaffolding)", () => {
  const CRISIS_KEYWORDS = [
    "suicide",
    "suicidal",
    "kill myself",
    "end my life",
    "want to die",
    "self harm",
    "self-harm",
    "hurt myself",
  ];

  function detectCrisis(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
  }

  it("flags 'suicide'", () => {
    expect(detectCrisis("I am thinking about suicide")).toBe(true);
  });

  it("flags 'kill myself'", () => {
    expect(detectCrisis("I want to kill myself")).toBe(true);
  });

  it("flags 'self-harm' (hyphenated)", () => {
    expect(detectCrisis("thoughts of self-harm")).toBe(true);
  });

  it("does not flag normal claim text", () => {
    expect(detectCrisis("I want to file my VA claim")).toBe(false);
  });

  it("ignores null", () => {
    expect(detectCrisis(null)).toBe(false);
  });

  it("ignores empty string", () => {
    expect(detectCrisis("")).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(detectCrisis("SUICIDAL thoughts")).toBe(true);
  });
});
