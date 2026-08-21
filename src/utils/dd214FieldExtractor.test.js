import { describe, it, expect } from "vitest";
import dd214FieldExtractor, {
  extractDD214Fields,
  detectDD214Documents,
} from "./dd214FieldExtractor";

const { parseAwardsString, extractDeployments } = dd214FieldExtractor;

// Each block starts with a bare "N." - the leading digit isn't in any
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
    const pathological =
      "SEPARATION DATE" + " \n".repeat(50000) + "no date here";
    const start = Date.now();
    const documents = detectDD214Documents(pathological);
    const elapsed = Date.now() - start;
    expect(Array.isArray(documents)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang splitting a document with many near-miss '---PAGE' markers (regression: ReDoS)", () => {
    const pathological = "---PAGE ".repeat(20000);
    const start = Date.now();
    const documents = detectDD214Documents(pathological);
    const elapsed = Date.now() - start;
    expect(Array.isArray(documents)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang scanning many repeated '12 B' separation-date labels with no matching value (regression: ReDoS)", () => {
    const pathological = "12 B ".repeat(20000);
    const start = Date.now();
    const documents = detectDD214Documents(pathological);
    const elapsed = Date.now() - start;
    expect(Array.isArray(documents)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});

// Each case below pairs a field's own BLOCK-label (or plain-label) trigger
// text with a long run of characters shaped like that field's value class
// but missing whatever terminates a real match, forcing every regex tried
// by runFieldPatterns() to actually reach (and fail out of) its own
// worst-case backtracking path rather than short-circuiting on an absent
// literal. All of DD214_FIELD_PATTERNS' entries run against the same text
// in one extractDD214Fields() call, so this table doubles as coverage for
// every BLOCK 2-12h regex flagged by sonarjs/slow-regex + regex-complexity.
describe("dd214FieldExtractor: ReDoS regression - BLOCK 2-12h field patterns", () => {
  const UNTERMINATED_FIELD_CASES = [
    ["2. DEPARTMENT", "B".repeat(30000)],
    ["ARMY", " ".repeat(30000)],
    ["4A. GRADE", "1".repeat(30000)],
    ["4B. PAY GRADE", "E".repeat(30000)],
    ["5. DATE OF BIRTH", "1|".repeat(15000)],
    ["DATE OF BIRTH", "12 ".repeat(15000)],
    ["6. RESERVE OBLIG", "1|".repeat(15000)],
    ["RESERVE OBLIGATION TERM DATE", "12 ".repeat(15000)],
    ["7A. PLACE OF ENTRY", "B".repeat(30000)],
    ["PLACE OF ENTRY INTO ACTIVE DUTY", "B".repeat(30000)],
    ["7B. HOME OF RECORD", "B\n".repeat(15000)],
    ["HOME OF RECORD", "B\n".repeat(15000)],
    ["8A. LAST DUTY", "B1".repeat(15000)],
    ["8B. STATION", "B".repeat(30000)],
    ["10. SGLI COVERAGE", "$" + ",".repeat(30000)],
    ["SGLI COVERAGE", ",".repeat(30000)],
    ["11. PRIMARY SPECIALTY", "B1".repeat(15000)],
    ["12A. DATE ENTERED", "1|".repeat(15000)],
    ["DATE ENTERED AD ACTIVE DUTY", "12 ".repeat(15000)],
    ["12B. SEPARATION DATE", "1|".repeat(15000)],
    ["SEPARATION DATE", "12 ".repeat(15000)],
    ["12C. NET ACTIVE", "1|".repeat(15000)],
    ["NET ACTIVE SERVICE", "12 ".repeat(15000)],
    ["12D. TOTAL PRIOR ACTIVE", "1|".repeat(15000)],
    ["12E. TOTAL PRIOR INACTIVE", "1|".repeat(15000)],
    ["12F. FOREIGN SERVICE", "1|".repeat(15000)],
    ["FOREIGN SERVICE SEA", "12 ".repeat(15000)],
    ["12G. SEA SERVICE", "1|".repeat(15000)],
    ["12H. EFFECTIVE DATE", "1|".repeat(15000)],
    ["EFFECTIVE DATE OF PAY GRADE", "12 ".repeat(15000)],
  ];

  it("does not hang on any BLOCK 2-12h field label followed by a long non-terminating value", () => {
    for (const [label, junk] of UNTERMINATED_FIELD_CASES) {
      const text = `${label} ${junk}`;
      const start = Date.now();
      const result = extractDD214Fields(text);
      const elapsed = Date.now() - start;
      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(1000);
    }
  });
});

describe("dd214FieldExtractor: ReDoS regression - free-text block fields", () => {
  const UNTERMINATED_FREETEXT_CASES = [
    ["13. DECORATIONS", "B".repeat(60000)],
    ["DECORATIONS, MEDALS, BADGES", "B".repeat(60000)],
    ["14. MILITARY EDUCATION", "B".repeat(60000)],
    ["MILITARY EDUCATION", "B".repeat(60000)],
    ["18. REMARKS", "B".repeat(60000)],
    ["REMARKS", "B".repeat(60000)],
    ["19. MAILING ADDRESS", "B\n".repeat(30000)],
    ["MAILING ADDRESS AFTER SEPARATION", "B\n".repeat(30000)],
  ];

  it("does not hang on Block 13/14/18/19 free-text fields with a huge value and no closing block marker", () => {
    for (const [label, junk] of UNTERMINATED_FREETEXT_CASES) {
      const text = `${label} ${junk}`;
      const start = Date.now();
      const result = extractDD214Fields(text);
      const elapsed = Date.now() - start;
      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(1000);
    }
  });
});

describe("dd214FieldExtractor: ReDoS regression - discharge/code fields", () => {
  it("does not hang on Block 24 character-of-service with a long non-matching value", () => {
    const text = `24. CHARACTER OF SERVICE ${"B".repeat(60000)}`;
    const start = Date.now();
    const result = extractDD214Fields(text);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on many near-miss 'RE' occurrences with no valid reentry code", () => {
    const text = "RE ".repeat(30000);
    const start = Date.now();
    const result = extractDD214Fields(text);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on Block 29 days-lost with a huge value and no Block 30 marker", () => {
    const text = `29. DATES OF TIME LOST ${"B".repeat(60000)}`;
    const start = Date.now();
    const result = extractDD214Fields(text);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("dd214FieldExtractor: ReDoS regression - MOS title cleanup", () => {
  it("does not hang cleaning a huge captured primary-specialty title with no '//' delimiter", () => {
    const text = `11. PRIMARY SPECIALTY ${"B".repeat(60000)}\n12. NEXT BLOCK`;
    const start = Date.now();
    const result = extractDD214Fields(text);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(result.fields.mosTitle).toBeTruthy();
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("dd214FieldExtractor: ReDoS regression - awards continuation text resolution", () => {
  it("does not hang resolving a 'CONT FROM BLOCK 13' remarks continuation with no '//' terminator anywhere", () => {
    const text = `13. DECORATIONS SOME AWARD\n18. REMARKS CONT FROM BLOCK 13 ${"B".repeat(60000)}`;
    const start = Date.now();
    const result = extractDD214Fields(text);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("dd214FieldExtractor: ReDoS regression - award name cleanup", () => {
  it("does not hang stripping a huge trailing-dash run from an award name", () => {
    const start = Date.now();
    const awards = parseAwardsString(`SOME AWARD ${"-".repeat(80000)}`, "");
    const elapsed = Date.now() - start;
    expect(Array.isArray(awards)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("dd214FieldExtractor: ReDoS regression - deployment extraction", () => {
  it("does not hang on 'SERVICE IN ' repeated 20000x with no digits ever following (regression: real O(n^2) bug, fixed via bounded quantifier)", () => {
    const text = "SERVICE IN ".repeat(20000);
    const start = Date.now();
    const deployments = extractDeployments(text);
    const elapsed = Date.now() - start;
    expect(deployments).toEqual([]);
    expect(elapsed).toBeLessThan(1000);
  });

  it("still extracts a real multi-word deployment location and date range after the bounded-quantifier fix", () => {
    const deployments = extractDeployments(
      "He had SERVICE IN SOUTHWEST ASIA 20200101-20210101 during this period.",
    );
    expect(deployments.some((d) => d.location === "SOUTHWEST ASIA")).toBe(true);
  });

  it("does not hang on 'OPERATION' repeated with no matching operation name", () => {
    const text = "OPERATION ".repeat(20000);
    const start = Date.now();
    const deployments = extractDeployments(text);
    const elapsed = Date.now() - start;
    expect(Array.isArray(deployments)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});
