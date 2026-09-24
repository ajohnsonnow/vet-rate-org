import { describe, it, expect, afterEach } from "vitest";
import {
  getSafetyUseCount,
  hasUsedPanicFeature,
  createQuickExitButton,
  removeQuickExitButton,
} from "../../utils/safetyRedirect";

// Test safetyRedirect utility
describe("Safety Redirect", () => {
  afterEach(() => {
    localStorage.removeItem("vetrate_safety_use_count");
    removeQuickExitButton();
  });

  it("reports zero uses and hasUsedPanicFeature=false before the panic key is ever triggered", () => {
    expect(getSafetyUseCount()).toBe(0);
    expect(hasUsedPanicFeature()).toBe(false);
  });

  it("hasUsedPanicFeature is true once the usage counter is non-zero", () => {
    localStorage.setItem("vetrate_safety_use_count", "1");
    expect(getSafetyUseCount()).toBe(1);
    expect(hasUsedPanicFeature()).toBe(true);
  });

  it("createQuickExitButton adds an accessible, single-use exit button", () => {
    const button = createQuickExitButton(document.body);
    expect(button.id).toBe("vetrate-quick-exit");
    expect(button.getAttribute("aria-label")).toMatch(/quick exit/i);
    expect(document.getElementById("vetrate-quick-exit")).toBe(button);

    // Calling it again returns the existing button, not a duplicate.
    const again = createQuickExitButton(document.body);
    expect(again).toBe(button);
  });

  it("removeQuickExitButton removes the button from the DOM", () => {
    createQuickExitButton(document.body);
    removeQuickExitButton();
    expect(document.getElementById("vetrate-quick-exit")).toBeNull();
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
