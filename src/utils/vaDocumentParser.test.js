import { describe, it, expect } from "vitest";
import {
  parseDecisionLetter,
  extractBigThree,
} from "./vaDocumentParser";

const SAMPLE_DECISION_LETTER = `
Dear Mr. Smith,

DEPARTMENT OF VETERANS AFFAIRS
Claim Number: C12345678

INTRODUCTION
This letter tells you about the decision we made on your claim.

DECISION
Post-traumatic stress disorder .......................... 70 percent
Tinnitus .................................................. 10 percent
Lumbosacral strain - denied

Service connection for post-traumatic stress disorder is granted, effective
January 1, 2020.
Service connection for tinnitus is granted, effective January 1, 2020.
Service connection for lumbosacral strain is denied.

Your combined evaluation: 70 percent.

EVIDENCE
The following evidence was considered in making this decision:
  - VA medical record dated December 2019
  - Private physician statement dated November 2019
  - C&P exam report dated December 2019

REASONS FOR DECISION
Service connection for lumbosacral strain is denied because the evidence
does not show a current diagnosis related to military service.

APPEAL RIGHTS
If you disagree with this decision, you have one year from the date of
this letter to appeal.
`;

describe("vaDocumentParser: parseDecisionLetter", () => {
  it("extracts veteran info, conditions, and combined rating from a realistic decision letter", () => {
    const result = parseDecisionLetter(SAMPLE_DECISION_LETTER);

    expect(result.success).toBe(true);
    expect(result.combinedRating).toBe(70);

    const names = result.conditions.map((c) => c.name.toLowerCase());
    expect(names.some((n) => n.includes("post-traumatic stress disorder"))).toBe(
      true,
    );
    expect(names.some((n) => n.includes("tinnitus"))).toBe(true);

    const ptsd = result.conditions.find((c) =>
      c.name.toLowerCase().includes("post-traumatic"),
    );
    expect(ptsd.percent).toBe(70);

    const tinnitus = result.conditions.find((c) =>
      c.name.toLowerCase().includes("tinnitus"),
    );
    expect(tinnitus.percent).toBe(10);
  });

  it("extracts evidence considered", () => {
    const result = parseDecisionLetter(SAMPLE_DECISION_LETTER);
    expect(result.evidenceConsidered.length).toBeGreaterThan(0);
    expect(
      result.evidenceConsidered.some((e) =>
        e.toLowerCase().includes("medical record"),
      ),
    ).toBe(true);
  });

  it("returns a well-formed failure result for empty/invalid input", () => {
    expect(parseDecisionLetter("").success).toBe(false);
    expect(parseDecisionLetter(null).success).toBe(false);
  });

  it("does not hang on OCR text with no line breaks (regression: evidence-section ReDoS)", () => {
    const noNewlines =
      "DECISION Service connection granted 70 percent EVIDENCE " +
      " ".repeat(5000) +
      "nothing relevant here";
    const start = Date.now();
    const result = parseDecisionLetter(noNewlines);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on a DECISION section with a long run of unmatched whitespace (regression: condition/percent ReDoS)", () => {
    const pathological =
      "DECISION\n" + " ".repeat(4000) + "\nEVIDENCE\nnothing here";
    const start = Date.now();
    const result = parseDecisionLetter(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on a denied-condition context full of whitespace (regression: denied-condition ReDoS)", () => {
    const pathological =
      "DECISION\nService connection " +
      " ".repeat(2000) +
      " is denied.\nEVIDENCE\nnothing here";
    const start = Date.now();
    const result = parseDecisionLetter(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("vaDocumentParser: extractBigThree", () => {
  it("extracts condition, percent, and effective date together", () => {
    const results = extractBigThree(SAMPLE_DECISION_LETTER);
    expect(results.length).toBeGreaterThan(0);
    const ptsd = results.find((r) =>
      r.condition.toLowerCase().includes("post-traumatic"),
    );
    expect(ptsd).toBeDefined();
    expect(ptsd.percent).toBe(70);
    expect(ptsd.effectiveDate).toMatch(/January 1, 2020/);
  });

  it("does not hang on a large document with no effective date anywhere (regression: unbounded ReDoS)", () => {
    const pathological =
      "PTSD ..... 70 percent" + " ".repeat(20000) + "nothing else";
    const start = Date.now();
    const results = extractBigThree(pathological);
    const elapsed = Date.now() - start;
    expect(Array.isArray(results)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on a large all-whitespace document (regression: unbounded ReDoS)", () => {
    const pathological = " ".repeat(50000);
    const start = Date.now();
    const results = extractBigThree(pathological);
    const elapsed = Date.now() - start;
    expect(results).toEqual([]);
    expect(elapsed).toBeLessThan(1000);
  });
});
