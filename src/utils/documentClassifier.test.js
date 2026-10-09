import { describe, it, expect } from "vitest";

import { classifyDocument, DOCUMENT_TYPES } from "./documentClassifier";

describe("documentClassifier: classifyDocument", () => {
  it("classifies a real Blue Button export cover page", () => {
    const text =
      "VA Blue Button (R) Report\n" +
      "This report includes key information from your VA medical records.\n" +
      "My HealtheVet\n";
    const result = classifyDocument(text, "blue-button.pdf");
    expect(result.type).toBe(DOCUMENT_TYPES.BLUE_BUTTON);
  });

  it("does not hang on a large document where the Blue Button pattern almost-but-never matches (regression: ReDoS)", () => {
    // Stresses the BLUE_BUTTON /BLUE\s+BUTTON\s*(?:(R)|\(R\))?\s+REPORT/i
    // pattern's adjacent \s*/\s+ quantifiers with a filler that never
    // reaches "REPORT". classifyDocument only ever scans a bounded
    // excerpt (buildClassificationSample caps at 10,000-30,000 chars)
    // regardless of raw input length, so this also proves that bound holds.
    const pathological = `BLUE BUTTON${" ".repeat(200000)}`;
    const start = Date.now();
    const result = classifyDocument(pathological, "large.pdf");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
    expect(result).toBeDefined();
  });
});

describe("documentClassifier: personal statement detection", () => {
  // Covers the PERSONAL_STATEMENT /I.{0,200}DECLARE/i pattern (bounded from
  // /I.*DECLARE/i for sonarjs/super-linear-regex) against realistic phrasing.
  it("classifies a VA Form 21-4138 statement with an 'I ... declare' closing", () => {
    const text =
      "STATEMENT IN SUPPORT OF CLAIM (VA Form 21-4138)\n\n" +
      "My name is Jordan A. Sample. I am writing to describe the in-service " +
      "event that caused my current knee condition.\n\n" +
      "I, Jordan A. Sample, do solemnly declare that the foregoing statement " +
      "is true and correct to the best of my knowledge and belief.";
    const result = classifyDocument(text, "statement.pdf");
    expect(result.type).toBe(DOCUMENT_TYPES.PERSONAL_STATEMENT);
  });

  it("still matches when the declaration sits close to the 200-char bound", () => {
    const filler = "the same in-service event described above ".repeat(4);
    const text = `STATEMENT IN SUPPORT OF CLAIM\nI hereby state that ${filler}and I declare this to be true.`;
    const result = classifyDocument(text, "statement2.pdf");
    expect(result.type).toBe(DOCUMENT_TYPES.PERSONAL_STATEMENT);
  });

  it("does not match when no 'declare' language is present at all", () => {
    expect(
      /I.{0,200}DECLARE/i.test("I served honorably and left in 2010."),
    ).toBe(false);
  });
});

// Decision letters open with a cover page that matches a dozen generic
// CLAIM_LETTER patterns and outscores RATING_DECISION every time, so they
// classified as plain correspondence and yielded no conditions.
describe("documentClassifier: decision-letter override", () => {
  const claimLetterBoilerplate =
    "Department of Veterans Affairs Regional Office. Claim Number: 000000000. " +
    "You have 30 days to respond. Please send any additional evidence. " +
    "What happens next: we will review your claim. VA Regional Office. ";

  it("promotes a modern notification letter with per-issue outcomes to RATING_DECISION", () => {
    const text =
      claimLetterBoilerplate +
      "We have included with this letter: 5. Rating Decision. Your Benefit Information: " +
      "Service connection for left shoulder restricted rotation is granted with an evaluation of 10 percent effective August 22, 2023. " +
      "Your combined rating evaluation is: Combined Rating Evaluation Effective Date 60% Aug 22, 2023";
    const result = classifyDocument(text, "ClaimLetter-2019-11-27.pdf", {
      pageCount: 27,
    });
    expect(result.type).toBe(DOCUMENT_TYPES.RATING_DECISION);
    expect(result.confidence).toBeGreaterThanOrEqual(75);
  });

  it("promotes a pre-2015 tabular decision letter to RATING_DECISION", () => {
    const text =
      claimLetterBoilerplate +
      "RATING DECISION enclosed. What We Decided: We determined that the following conditions were related to your military service, so service connection has been granted: " +
      "Medical Description Percent (%) Assigned Effective Date Spastic colon 10% Feb 3, 2010";
    const result = classifyDocument(text, "ClaimLetter-2016-3-9.pdf", {
      pageCount: 5,
    });
    expect(result.type).toBe(DOCUMENT_TYPES.RATING_DECISION);
  });

  it("leaves a dependency-change letter that merely mentions the Rating Decision as CLAIM_LETTER", () => {
    const text =
      claimLetterBoilerplate +
      "We removed your dependent effective February 1, 2011. In making our decision, in addition to the evidence listed in the Rating Decision, we considered VA Form 21-686c.";
    const result = classifyDocument(text, "ClaimLetter-2013-10-4.pdf", {
      pageCount: 14,
    });
    expect(result.type).toBe(DOCUMENT_TYPES.CLAIM_LETTER);
  });

  it("still reclassifies a several-hundred-page consolidated file as C_FILE_MEDICAL before the decision override", () => {
    const text =
      claimLetterBoilerplate +
      "5. Rating Decision. Service connection for tinnitus is granted with an evaluation of 10 percent.";
    const result = classifyDocument(text, "JONES 0000 .pdf", {
      pageCount: 2000,
    });
    expect(result.type).toBe(DOCUMENT_TYPES.C_FILE_MEDICAL);
  });
});
