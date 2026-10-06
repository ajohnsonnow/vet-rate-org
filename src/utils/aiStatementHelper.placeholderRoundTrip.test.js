/**
 * Owner decision D (2026-09-28, ADR-008): where an AI feature must produce
 * text containing the veteran's name (a buddy/lay statement written from a
 * witness's perspective necessarily refers to the veteran), the model
 * writes a placeholder ("[Veteran]") instead - it never sees the real name -
 * and the app substitutes the real value locally, after the response, so
 * the veteran-visible/saved statement still reads naturally.
 * substituteVeteranNamePlaceholder did not exist before this pass; this
 * proves both halves of the round trip: the AI provider call is never
 * offered the real name, and the local substitution actually restores it.
 * Fixture values are synthetic, not any real veteran's data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enhanceFormStatement,
  substituteVeteranNamePlaceholder,
  resolveVeteranDisplayName,
} from "./aiStatementHelper";
import { saveVeteranProfile } from "./veteranProfile";

const REAL_NAME = "Jordan Q Faketon";

vi.mock("./unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAnyAIAvailable: () => true,
    getAIStatus: () => ({ statusText: "Local AI" }),
    generateAI: vi.fn(async () => ({
      text: "I have observed [Veteran] struggling with daily tasks since returning from deployment.",
      mode: "local",
    })),
  };
});

beforeEach(() => {
  localStorage.clear();
});

describe("buddy statement placeholder round-trip", () => {
  it("makes no AI provider call at all for a buddy statement", async () => {
    const { generateAI } = await import("./unifiedAIService");

    const result = await enhanceFormStatement("buddy-statement", {
      veteranName: REAL_NAME,
      conditionName: "PTSD",
      whatObserved:
        "I have watched them struggle to get out of bed most mornings.",
      specificExamples: "They used to be very social and now avoid gatherings.",
      dailyImpact: "They can no longer manage household chores alone.",
    });

    expect(generateAI).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.content).toContain(`Veteran's Full Name: ${REAL_NAME}`);
  });

  it("substitutes the placeholder with the real name on the device", () => {
    const finalStatement = substituteVeteranNamePlaceholder(
      "I am writing about [Veteran].",
      REAL_NAME,
    );
    expect(finalStatement).toContain(REAL_NAME);
    expect(finalStatement).not.toContain("[Veteran]");
  });

  it("leaves the placeholder untouched when no veteran name is known (never fabricates one)", () => {
    const text = "I have observed [Veteran] struggling.";
    expect(substituteVeteranNamePlaceholder(text, null)).toBe(text);
    expect(substituteVeteranNamePlaceholder(text, "")).toBe(text);
  });

  it("also matches the '[Veteran Name]' wording used elsewhere in this codebase", () => {
    const text = "Regarding [Veteran Name]'s claim for service connection.";
    expect(substituteVeteranNamePlaceholder(text, REAL_NAME)).toBe(
      `Regarding ${REAL_NAME}'s claim for service connection.`,
    );
  });

  it('also matches the possessive "[Veteran\'s Name]" wording', () => {
    const text = "This statement concerns [Veteran's Name]'s claim.";
    expect(substituteVeteranNamePlaceholder(text, REAL_NAME)).toBe(
      `This statement concerns ${REAL_NAME}'s claim.`,
    );
  });

  it("matches the possessive placeholder with a curly apostrophe too", () => {
    const text = "This statement concerns [Veteran’s Name]'s claim.";
    expect(substituteVeteranNamePlaceholder(text, REAL_NAME)).toBe(
      `This statement concerns ${REAL_NAME}'s claim.`,
    );
  });
});

describe("resolveVeteranDisplayName: legacy profile takes priority over VKB's inverted DD-214 form", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("prefers the legacy profile's natural name order - never reaches VKB's 'LAST, FIRST' form", async () => {
    saveVeteranProfile({ firstName: "Jordan", lastName: "Faketon" });
    // No VKB/IndexedDB set up in this test at all - if the profile weren't
    // checked first, the VKB fallback would throw/hang instead of the
    // name resolving cleanly.
    expect(await resolveVeteranDisplayName()).toBe("Jordan Faketon");
  });

  it("falls back to null (never fabricates a name) when neither source has one", async () => {
    expect(await resolveVeteranDisplayName()).toBeNull();
  });
});
