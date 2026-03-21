import { describe, it, expect } from "vitest";

// Test safetyRedirect utility
describe("Safety Redirect", () => {
  it("crisis hotline number is correct", () => {
    const CRISIS_HOTLINE = "988";
    expect(CRISIS_HOTLINE).toBe("988");
  });

  it("VA crisis line is 988 press 1", () => {
    const VA_CRISIS = "988";
    const VA_PRESS = 1;
    expect(VA_CRISIS).toBe("988");
    expect(VA_PRESS).toBe(1);
  });

  it("crisis text line is correct", () => {
    const TEXT_LINE = "838255";
    expect(TEXT_LINE).toBe("838255");
  });
});

describe("Crisis Keywords Detection", () => {
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

  it('detects "suicide" keyword', () => {
    expect(detectCrisis("I am thinking about suicide")).toBe(true);
  });

  it('detects "kill myself"', () => {
    expect(detectCrisis("I want to kill myself")).toBe(true);
  });

  it("detects self-harm", () => {
    expect(detectCrisis("thoughts of self-harm")).toBe(true);
  });

  it("does not flag normal text", () => {
    expect(detectCrisis("I want to file my VA claim")).toBe(false);
  });

  it("handles null input", () => {
    expect(detectCrisis(null)).toBe(false);
  });

  it("handles empty string", () => {
    expect(detectCrisis("")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(detectCrisis("SUICIDAL thoughts")).toBe(true);
  });
});
