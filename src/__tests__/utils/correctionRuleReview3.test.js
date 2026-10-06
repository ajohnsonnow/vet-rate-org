/**
 * QA's third check: five true sentences in the plain style the on-device
 * models write that still drew a block, and three recorded requests that a
 * rule read as statements. None may fire.
 */
import { describe, it, expect } from "vitest";
import { flagContradictions } from "../../utils/contradictionCheck";
import { claimAsserted } from "../../utils/assertionGuard";
import review2 from "./fixtures/correctionRuleReview2.json";

const questionFor = (toolId) =>
  review2.true.find((entry) => entry.toolId === toolId).question;

const rulesFiredOn = (toolId, text, question = questionFor(toolId)) =>
  flagContradictions(
    { text },
    { toolId, dataClass: "context" },
    question,
  ).contradictionsFound?.map((hit) => hit.rule) ?? [];

describe("five true sentences in plain on-device style", () => {
  it.each([
    [
      "tdiu-builder",
      "Being employed does not automatically mean you cannot receive TDIU.",
    ],
    [
      "rating-analyzer",
      "**Bilateral factor check:** Left knee and left hip are the same side, so the bilateral factor needs a right-side condition too.",
    ],
    [
      "rating-analyzer",
      "Your combined rating comes from the Combined Ratings Table, while the higher of two evaluations applies within one disability.",
    ],
    [
      "war-room",
      "To submit new evidence, choose the Board evidence docket over a Higher-Level Review.",
    ],
    [
      "war-room",
      "If the decision is no longer open to review, you cannot appeal it without new evidence.",
    ],
  ])("%s: %s", (toolId, text) => {
    expect(rulesFiredOn(toolId, text)).toEqual([]);
  });

  it("still catches the errors those rules were written for", () => {
    expect(
      rulesFiredOn(
        "tdiu-builder",
        "If you are currently employed, you cannot receive TDIU benefits.",
      ),
    ).toEqual(["tdiu-barred-by-any-employment"]);
    expect(
      rulesFiredOn(
        "war-room",
        "If you do not have new evidence, you cannot appeal the denial without new evidence.",
      ),
    ).toEqual(["appeal-said-to-need-new-evidence"]);
    expect(
      rulesFiredOn(
        "war-room",
        "In the Higher-Level Review, submit a new medical opinion from your doctor.",
      ),
    ).toEqual(["higher-level-review-new-evidence"]);
  });
});

describe("a request to the veteran is not a statement of law", () => {
  const IRAQ =
    "Am I eligible for any PACT Act presumptive conditions based on my Iraq deployment?";

  it.each([
    "Please provide the relevant service records or evidence detailing those exposures.",
    "Action Required: Please provide the veteran's MOS and any documentation regarding toxic exposure (e.g., service in a specific location, MOS hazardous to health, or service in a specific theater).",
    "Please provide the veteran's service dates and locations or any specific toxic exposure documentation (e.g., DD Form 2799, service treatment records noting exposure to specific toxic agents).",
    "To determine which PACT conditions apply, I need the veteran's specific toxic exposure history.",
    "Please upload any evidence of exposure to burn pits.",
    "Please share documentation of your exposure.",
  ])("draws no block: %s", (text) => {
    expect(rulesFiredOn("pact-navigator", text, IRAQ)).toEqual([]);
    expect(claimAsserted(text, { readsDenialItself: true })).toBe(false);
  });

  it("does not excuse a statement that happens to be polite", () => {
    expect(
      rulesFiredOn(
        "pact-navigator",
        "To be eligible for presumptive conditions, you must prove that you were exposed.",
        IRAQ,
      ),
    ).toEqual(["presumptive-needs-exposure-proof"]);
  });
});

describe("five more labels", () => {
  it.each([
    "Not true: ratings are added together.",
    "Rumor: ratings are added together.",
    "Fiction: ratings are added together.",
    "Outdated advice: ratings are added together.",
    "Bad advice: ratings are added together.",
  ])("is not an assertion: %s", (text) => {
    expect(rulesFiredOn("rating-analyzer", text)).toEqual([]);
  });
});
