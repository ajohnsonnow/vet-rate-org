import { describe, it, expect } from "vitest";
import { extractDD214Fields, detectDD214Documents } from "./dd214FieldExtractor";

// Each block starts with a bare "N." — the leading digit isn't in any
// field's capture character class, so it naturally terminates the previous
// block's greedy capture without needing blank-line padding.
const SAMPLE_DD214_MODERN = `
CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY

1. NAME: SMITH, JOHN, ADAM
2. DEPARTMENT: ARMY / ACTIVE
3. SOCIAL SECURITY: 123-45-6789
4A. GRADE, RATE OR RANK: SGT
4B. PAY GRADE: E-5
5. DATE OF BIRTH: 1990 01 15
12A. DATE ENTERED ACTIVE DUTY: 20080114
12B. SEPARATION DATE: 20180114
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
26. SEPARATION CODE: LBK
27. REENTRY CODE: RE-1
28. NARRATIVE REASON FOR SEPARATION: COMPLETION OF REQUIRED ACTIVE SERVICE
`;

describe("dd214FieldExtractor: extractDD214Fields", () => {
  it("extracts identity, dates, and discharge fields from a realistic modern DD214", () => {
    const result = extractDD214Fields(SAMPLE_DD214_MODERN);

    expect(result.success).toBe(true);
    expect(result.fields.fullName).toMatch(/SMITH/);
    // ssn itself is deliberately deleted after ssnLast4 is derived (PII
    // minimization, see postProcessExtractedFields) -- only last4 survives
    // in the default (non-keepFullSSN) extraction result.
    expect(result.fields.ssnLast4).toBe("6789");
    expect(result.fields.ssn).toBeUndefined();
    expect(result.fields.rank).toBe("SGT");
    expect(result.fields.payGrade).toBe("E-5");
    expect(result.fields.characterOfService).toMatch(/HONORABLE/);
    expect(result.fields.separationCode).toBe("LBK");
    expect(result.fields.reentryCode).toMatch(/RE-?1/);
  });

  it("normalizes dates to YYYY-MM-DD", () => {
    const result = extractDD214Fields(SAMPLE_DD214_MODERN);
    expect(result.fields.entryDate).toBe("2008-01-14");
    expect(result.fields.separationDate).toBe("2018-01-14");
  });

  it("keeps the full SSN only when keepFullSSN is explicitly requested", () => {
    const result = extractDD214Fields(SAMPLE_DD214_MODERN, {
      keepFullSSN: true,
    });
    expect(result.fields.ssn.replace(/\D/g, "")).toBe("123456789");
  });

  it("returns a well-formed failure result for empty/invalid input", () => {
    expect(extractDD214Fields("").success).toBe(false);
    expect(extractDD214Fields(null).success).toBe(false);
  });

  it("does not hang on a document with long runs of ambiguous whitespace between labels and values (regression: ReDoS)", () => {
    const pathological =
      "3. SOCIAL SECURITY" +
      " \n".repeat(3000) +
      "24. CHARACTER OF SERVICE" +
      " \n".repeat(3000) +
      "no valid content follows";
    const start = Date.now();
    const result = extractDD214Fields(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on a 100k-char run of ambiguous whitespace after a block label (regression: ReDoS)", () => {
    const pathological = "3. SOCIAL SECURITY" + " \n".repeat(50000);
    const start = Date.now();
    const result = extractDD214Fields(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("dd214FieldExtractor: detectDD214Documents", () => {
  it("finds a separation-date-anchored document in a realistic DD214", () => {
    const documents = detectDD214Documents(SAMPLE_DD214_MODERN);
    expect(documents.length).toBeGreaterThan(0);
    expect(documents[0].separationDate).toBe("2018-01-14");
  });

  it("finds nothing in an unrelated document", () => {
    expect(
      detectDD214Documents("This is a grocery list.\nMilk\nEggs\nBread"),
    ).toEqual([]);
  });

  it("does not hang scanning a long document with no separation date (regression: ReDoS)", () => {
    const pathological = "SEPARATION DATE" + " \n".repeat(50000) + "no date here";
    const start = Date.now();
    const documents = detectDD214Documents(pathological);
    const elapsed = Date.now() - start;
    expect(Array.isArray(documents)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});
