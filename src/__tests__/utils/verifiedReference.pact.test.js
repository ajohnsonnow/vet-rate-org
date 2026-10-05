/**
 * PACT Act selection: a conditions list is only ever shown with the service
 * it covers, and the era or place in the question decides which group is
 * shown.
 */
import { describe, it, expect } from "vitest";
import {
  buildVerifiedReferenceBlock,
  detectReferenceTopics,
  selectVerifiedEntries,
} from "../../utils/verifiedReference";

const BUDGETS = [3400, 5000, 6500, 100000];
const ids = (question, maxChars, toolId = null) =>
  selectVerifiedEntries(question, { toolId, maxChars }).map((e) => e.id);

const HERBICIDE_QUESTIONS = [
  "Vietnam veteran with chronic respiratory issues — what PACT conditions apply?",
  "I was stationed in Thailand in 1970. Which presumptive conditions cover me?",
  "Does the PACT Act help someone who served on the Korean DMZ?",
  "I was exposed to Agent Orange. What is presumptive?",
  "What does the PACT Act say about herbicide exposure on Guam?",
];
const TOXIC_QUESTIONS = [
  "Am I eligible for any PACT Act presumptive conditions based on my Iraq deployment?",
  "Gulf War veteran: which PACT Act conditions are presumptive?",
  "I deployed to Afghanistan in 2010. What presumptive conditions apply?",
  "I worked next to burn pits for a year. What can I claim?",
];
const GENERIC_QUESTIONS = [
  "Which presumptive conditions exist?",
  "What does the PACT Act cover?",
];

describe("PACT Act selection by era and place", () => {
  it.each(HERBICIDE_QUESTIONS)("herbicide entries only: %s", (question) => {
    expect(detectReferenceTopics(question)).toEqual(["herbicide"]);
    for (const maxChars of BUDGETS) {
      const picked = ids(question, maxChars);
      expect(picked[0]).toBe("pact-herbicide");
      expect(picked.every((id) => id.startsWith("pact-herbicide"))).toBe(true);
    }
  });

  it.each(TOXIC_QUESTIONS)("toxic-exposure entries only: %s", (question) => {
    expect(detectReferenceTopics(question)).toEqual(["toxic-exposure"]);
    for (const maxChars of BUDGETS) {
      const picked = ids(question, maxChars);
      expect(picked[0]).toBe("pact-toxic");
      expect(picked.every((id) => id.startsWith("pact-toxic"))).toBe(true);
    }
  });

  it.each(GENERIC_QUESTIONS)("the overview only: %s", (question) => {
    expect(detectReferenceTopics(question)).toEqual(["pact-act"]);
    for (const maxChars of BUDGETS) {
      expect(ids(question, maxChars)).toEqual(["pact-overview"]);
    }
  });

  it("gives the overview for the PACT tool when the question names no service", () => {
    expect(ids("What applies to me?", 3400, "pact-navigator")).toEqual([
      "pact-overview",
    ]);
  });

  it("leads with the overview when the question names both eras", () => {
    const question =
      "PACT Act: I served in Vietnam in 1969 and in Iraq in 1991. What applies?";
    expect(detectReferenceTopics(question)).toEqual([
      "pact-act",
      "toxic-exposure",
      "herbicide",
    ]);
    expect(ids(question, 3400)).toEqual(["pact-overview"]);
    expect(ids(question, 100000).slice(0, 3)).toEqual([
      "pact-overview",
      "pact-toxic",
      "pact-herbicide",
    ]);
  });

  it("does not read a deployment mentioned outside a PACT question as a PACT topic", () => {
    expect(
      detectReferenceTopics(
        "I served with John in Iraq 2008-2009. I witnessed him struck by IED debris.",
        "buddy-statement",
      ),
    ).toEqual([]);
    expect(
      detectReferenceTopics("My father served in Vietnam and I in Korea."),
    ).toEqual([]);
  });
});

describe("PACT Act entries on the on-device budget", () => {
  const ON_DEVICE = 3400;

  it("fits the whole toxic-exposure entry, definition and lists together", () => {
    const block = buildVerifiedReferenceBlock(TOXIC_QUESTIONS[0], {
      toolId: "pact-navigator",
      maxChars: ON_DEVICE,
    });
    expect(block.length).toBeLessThanOrEqual(ON_DEVICE);
    expect(block).toContain("A covered Veteran means any Veteran who");
    expect(block).toContain("Active service on or after August 2, 1990:\n- ");
    expect(block).toContain("\n- chronic obstructive pulmonary disease\n");
    expect(block).not.toContain("Presumptive Herbicide Disabilities");
  });

  it("fits the whole herbicide entry, definition and lists together", () => {
    const block = buildVerifiedReferenceBlock(HERBICIDE_QUESTIONS[0], {
      toolId: "pact-navigator",
      maxChars: ON_DEVICE,
    });
    expect(block.length).toBeLessThanOrEqual(ON_DEVICE);
    expect(block).toContain("\n- in the Republic of Vietnam (RVN)");
    expect(block).toContain("\n- respiratory cancers of the lung");
    expect(block).not.toContain("chronic obstructive pulmonary disease");
    expect(block).not.toContain("38 U.S.C. 1120");
  });

  it("fits the overview and names both articles' change dates", () => {
    const block = buildVerifiedReferenceBlock(GENERIC_QUESTIONS[0], {
      maxChars: ON_DEVICE,
    });
    expect(block.length).toBeGreaterThan(1000);
    expect(block.length).toBeLessThanOrEqual(ON_DEVICE);
    expect(block).toContain(
      "changed June 6, 2025 and September 15, 2025, retrieved 2026-07-19",
    );
  });
});
