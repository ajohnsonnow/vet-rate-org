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
  enhanceBuddyStatement,
  substituteVeteranNamePlaceholder,
} from "./aiStatementHelper";

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
  it("never offers the veteran's real name to the AI provider call", async () => {
    const { generateAI } = await import("./unifiedAIService");

    await enhanceBuddyStatement(
      {
        relationship: "Spouse",
        knownDuration: "10 years",
        observations:
          "I have watched them struggle to get out of bed most mornings.",
        changesNoticed: "They used to be very social and now avoid gatherings.",
        dailyImpact: "They can no longer manage household chores alone.",
      },
      "PTSD",
    );

    const [prompt] = generateAI.mock.calls[0];
    expect(prompt).not.toContain(REAL_NAME);
    expect(prompt).not.toContain("Jordan");
    expect(prompt).not.toContain("Faketon");
  });

  it("substitutes the placeholder back to the real name for the veteran-visible result only", async () => {
    const result = await enhanceBuddyStatement(
      {
        relationship: "Spouse",
        knownDuration: "10 years",
        observations:
          "I have watched them struggle to get out of bed most mornings.",
      },
      "PTSD",
    );

    expect(result.success).toBe(true);
    expect(result.content).toContain("[Veteran]");

    const finalStatement = substituteVeteranNamePlaceholder(
      result.content,
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
});
