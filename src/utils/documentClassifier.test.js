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

// Real decision letters open with a cover page that matches a dozen generic
// CLAIM_LETTER patterns and outscores RATING_DECISION every time; 8 of 8 in
// a real corpus classified as plain correspondence and yielded no conditions.
describe("documentClassifier: decision-letter override", () => {
  const claimLetterBoilerplate =
    "Department of Veterans Affairs Regional Office. Claim Number: 000000000. " +
    "You have 30 days to respond. Please send any additional evidence. " +
    "What happens next: we will review your claim. VA Regional Office. ";

  it("promotes a modern notification letter with per-issue outcomes to RATING_DECISION", () => {
    const text =
      claimLetterBoilerplate +
      "We have included with this letter: 5. Rating Decision. Your Benefit Information: " +
      "Service connection for left hip limited adduction is granted with an evaluation of 10 percent effective September 15, 2023. " +
      "Your combined rating evaluation is: Combined Rating Evaluation Effective Date 80% Sep 15, 2023";
    const result = classifyDocument(text, "ClaimLetter-2024-5-8.pdf", {
      pageCount: 27,
    });
    expect(result.type).toBe(DOCUMENT_TYPES.RATING_DECISION);
    expect(result.confidence).toBeGreaterThanOrEqual(75);
  });

  it("promotes a pre-2015 tabular decision letter to RATING_DECISION", () => {
    const text =
      claimLetterBoilerplate +
      "RATING DECISION enclosed. What We Decided: We determined that the following conditions were related to your military service, so service connection has been granted: " +
      "Medical Description Percent (%) Assigned Effective Date Panic disorder 30% Jun 30, 2007";
    const result = classifyDocument(text, "ClaimLetter-2008-11-28.pdf", {
      pageCount: 5,
    });
    expect(result.type).toBe(DOCUMENT_TYPES.RATING_DECISION);
  });

  it("leaves a dependency-change letter that merely mentions the Rating Decision as CLAIM_LETTER", () => {
    const text =
      claimLetterBoilerplate +
      "We removed your dependent effective April 1, 2011. In making our decision, in addition to the evidence listed in the Rating Decision, we considered VA Form 21-686c.";
    const result = classifyDocument(text, "ClaimLetter-2018-8-22.pdf", {
      pageCount: 14,
    });
    expect(result.type).toBe(DOCUMENT_TYPES.CLAIM_LETTER);
  });

  it("still reclassifies a several-hundred-page consolidated file as C_FILE_MEDICAL before the decision override", () => {
    const text =
      claimLetterBoilerplate +
      "5. Rating Decision. Service connection for tinnitus is granted with an evaluation of 10 percent.";
    const result = classifyDocument(text, "JONES 0000 .pdf", {
      pageCount: 2018,
    });
    expect(result.type).toBe(DOCUMENT_TYPES.C_FILE_MEDICAL);
  });
});
