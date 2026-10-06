/**
 * Under the calculator's working, the threshold paragraph is the only
 * statement on entitlement to TDIU. Commentary that asserts or denies it, in
 * any form, is dropped; so is commentary the contradiction check would flag.
 */
import { describe, it, expect } from "vitest";
import { calculateVARating } from "../../utils/vaCalculator";
import { findCommentaryArithmetic } from "../../utils/raterGrounding";
import {
  CALCULATOR_COMMENTARY_LEAD,
  enforceCalculatorOnResult,
} from "../../utils/unifiedAIService";
import { findContradictions } from "../../utils/contradictionCheck";
import { GOLDEN, commentaryOf, laptopRunCase } from "./recordedAnswers";

const single60 = calculateVARating(GOLDEN.a25.conditions);
const four = calculateVARating(GOLDEN.a11.conditions);
const reasons = (text, calc = single60, options = { tdiu: true }) =>
  findCommentaryArithmetic(text, calc, options);

const lead = (text, id = "a25", extra = {}) =>
  enforceCalculatorOnResult(
    { text },
    { conditions: GOLDEN[id].conditions, toolId: "tdiu-builder", ...extra },
    GOLDEN[id].input,
  );

describe("case a25 on the laptop model", () => {
  const record = laptopRunCase("a25");
  const commentary = commentaryOf(record, CALCULATOR_COMMENTARY_LEAD);

  it("the run kept commentary that says the veteran is eligible", () => {
    expect(record.calculatorLead).toEqual({
      expected: 60,
      commentaryKept: true,
    });
    expect(commentary).toContain("While you are eligible for TDIU");
    expect(commentary).toContain("**Yes, you can.**");
    expect(record.response).toContain(
      'The percentage is only one part. 38 CFR § 4.16(a) also requires that the person be "unable to secure or follow a substantially gainful occupation',
    );
  });

  it("it is dropped now, and the threshold paragraph stands alone", () => {
    expect(reasons(commentary)).toContain("entitlement");
    const out = lead(commentary);
    expect(out.calculatorLead.commentaryKept).toBe(false);
    expect(out.calculatorLead.commentaryDropped).toContain("entitlement");
    expect(out.text).not.toContain("you are eligible for TDIU");
    expect(out.text).not.toContain(CALCULATOR_COMMENTARY_LEAD);
    expect(out.text).toContain(
      "About your question on individual unemployability (TDIU):",
    );
    expect(out.text).toContain("Vet-Rate cannot determine that.");
  });
});

describe("any statement on entitlement to TDIU drops the commentary", () => {
  it.each([
    "You are eligible for TDIU.",
    "Yes, you can qualify.",
    "You may be eligible for TDIU if you cannot work.",
    "It is likely that you qualify for unemployability benefits.",
    "You are entitled to TDIU on these ratings.",
    "TDIU will be granted once the VA reviews your claim.",
    "You are not eligible for TDIU.",
    "Unfortunately this does not qualify you.",
    "You are ineligible for individual unemployability.",
    "You could be awarded TDIU.",
    "You should be approved for TDIU.",
    "VA would deny TDIU here.",
  ])("%s", (text) => {
    expect(reasons(text)).toEqual(["entitlement"]);
    expect(lead(text).calculatorLead.commentaryKept).toBe(false);
  });

  it.each([
    "TDIU also looks at whether you can hold a job, which the calculator cannot judge.",
    "VA Form 21-8940 is the form for individual unemployability.",
    "A Veterans Service Officer can help you gather employment records.",
  ])("commentary that takes no position is kept: %s", (text) => {
    expect(reasons(text)).toEqual([]);
    expect(lead(text).calculatorLead.commentaryKept).toBe(true);
  });

  it("applies whenever the commentary raises TDIU, whatever the question was", () => {
    expect(
      reasons("With 80% you qualify for TDIU.", four, { tdiu: false }),
    ).toContain("entitlement");
  });

  it("the words alone are not a TDIU statement on a question that is not about it", () => {
    expect(
      reasons(
        "You may be eligible for other benefits; a Veterans Service Officer can check.",
        four,
        { tdiu: false },
      ),
    ).toEqual([]);
  });
});

describe("commentary the contradiction check would flag is dropped", () => {
  const text =
    "VA adds your ratings together to get the total, which is why the order matters.";

  it("the check finds it in the commentary on its own", () => {
    expect(findContradictions(text).map((hit) => hit.rule)).toEqual([
      "ratings-added-together",
    ]);
  });

  it("so it is not kept, and the answer carries no contradiction for the later check to find", () => {
    const out = lead(text, "a11", { toolId: "rating-calculator" });
    expect(out.calculatorLead).toEqual({
      expected: 80,
      commentaryKept: false,
      commentaryDropped: ["contradiction: ratings-added-together"],
    });
    expect(out.text).not.toContain("adds your ratings together");
    expect(findContradictions(out.text)).toEqual([]);
  });

  it("the calculator's own text never trips the check", () => {
    for (const id of ["a11", "a12", "a13", "a24", "a25"]) {
      const out = lead("", id);
      expect(findContradictions(out.text, { topics: ["tdiu"] })).toEqual([]);
    }
  });
});
