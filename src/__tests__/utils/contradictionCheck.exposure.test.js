/**
 * Exposure is presumed for covered service, for herbicides as for burn pits.
 * Two graded runs asked a Vietnam veteran for exposure documentation.
 */
import { describe, it, expect } from "vitest";
import { findContradictions } from "../../utils/contradictionCheck";
import quotes from "../../data/verifiedQuotes.json";

const RULE = "presumptive-needs-exposure-proof";
const rules = (text, topics) =>
  findContradictions(text, { topics }).map((hit) => hit.rule);

describe("exposure said to need proving, herbicide service", () => {
  it.each([
    "Action Required: Please provide the veteran's MOS and any documentation regarding toxic exposure (e.g., service in a specific location, MOS hazardous to health, or service in a specific theater).",
    "However, for PACT Act conditions, we need evidence of exposure to a specific toxic agent, not just general herbicide exposure.",
    "Please provide the veteran's service dates and locations or any specific toxic exposure documentation (e.g., DD Form 2799).",
    "- Show documentation of exposure to Agent Orange during service in Vietnam.",
    "To determine which PACT Act conditions apply, the veteran needs to provide evidence of toxic exposure (Agent Orange or other covered substances) and establish a connection to the condition.",
    "To be eligible for presumptive conditions, you must prove that you were exposed.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence, ["herbicide"])).toEqual([RULE]);
  });

  it("quotes the manual line that presumes herbicide exposure", () => {
    const [hit] = findContradictions(
      "We need evidence of exposure to a specific toxic agent.",
      { topics: ["herbicide"] },
    );
    expect(hit.correction).toBe("presumed-herbicide-exposure");
    expect(quotes.corrections["presumed-herbicide-exposure"]).toMatchObject({
      citation: "VA manual M21-1 VIII.i.1.A.1.c",
      text: "Currently, the Department of Veterans Affairs (VA) recognizes a presumption of exposure to herbicides in specific locations and military service experiences as listed in the table below.",
    });
  });

  it("keeps the burn-pit quote for a toxic-exposure question", () => {
    const [hit] = findContradictions(
      "Please ensure that you have documentation (such as service records, C&P exams, or other relevant records) confirming your exposure to these toxic substances during your service in Iraq.",
      { topics: ["toxic-exposure"] },
    );
    expect(hit).toMatchObject({
      rule: RULE,
      correction: "presumed-toxic-exposure",
    });
  });

  it.each([
    "If the veteran has evidence of exposure to a specific toxic agent, please provide the relevant service records.",
    "This exposure is presumed to have occurred without needing direct evidence of exposure.",
    "You do not need to provide evidence of exposure; service in Vietnam is enough.",
    "No documentation of exposure is required for service in the Republic of Vietnam.",
    "Medical Documentation: Provide documentation from a healthcare provider indicating the relationship between the toxic exposure and the current respiratory condition.",
    "For conditions not covered by the presumption, you would need to prove the condition was caused by toxic exposure.",
    "- Documentation of exposure to other toxic substances",
    "Please provide your service dates and locations.",
    "The provided text only covers herbicide exposure (38 CFR 3.307 and 3.309).",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence, ["herbicide", "toxic-exposure"])).toEqual([]);
  });

  it("does not apply to a question that raised neither group", () => {
    expect(
      rules("We need evidence of exposure to a specific toxic agent.", [
        "pact-act",
      ]),
    ).toEqual([]);
  });
});
