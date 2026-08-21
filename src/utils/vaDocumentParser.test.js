import { describe, it, expect } from "vitest";
import {
  parseDecisionLetter,
  extractBigThree,
  parseDBQReport,
  parseCodeSheet,
  parseBVADecision,
  parseSOC,
  parseHLR,
  VA_SECTION_HEADERS,
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
    expect(
      names.some((n) => n.includes("post-traumatic stress disorder")),
    ).toBe(true);
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
});

describe("vaDocumentParser: parseDecisionLetter (ReDoS regression)", () => {
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

  it("does not hang on a huge document with no effective-date or combined-rating text (regression: unbounded full-text scan ReDoS)", () => {
    const pathological =
      "DECISION\n10 percent\n" + "the quick brown fox jumps ".repeat(4000);
    const start = Date.now();
    const result = parseDecisionLetter(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on percent matches preceded by long non-separator filler (regression: condition-name-separator ReDoS)", () => {
    // No `.`, `-`, or en-dash anywhere in the filler, so
    // CONDITION_NAME_BEFORE_SEP_RE must fully backtrack the lookback window
    // for every single percent match before giving up.
    const chunk = "A ".repeat(245) + "10 percent\n";
    const pathological =
      "DECISION\n" + chunk.repeat(200) + "\nEVIDENCE\nnothing here";
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

describe("vaDocumentParser: VA_SECTION_HEADERS (ReDoS regression)", () => {
  it("does not hang testing any header pattern against pathological non-matching input", () => {
    const pathologicalInputs = [
      "x".repeat(100000),
      " ".repeat(100000),
      // A long run of blank lines (still ~250x more than any real VA
      // document would ever have before a section header) followed by no
      // match anywhere: this is the shape that made the un-bounded `\s*`
      // genuinely O(n^2) before the leading whitespace was capped to
      // `{0,200}` (see the comment above VA_SECTION_HEADERS).
      "\n".repeat(5000) + "x".repeat(95000),
      "A ".repeat(50000),
    ];
    const start = Date.now();
    for (const input of pathologicalInputs) {
      for (const key of Object.keys(VA_SECTION_HEADERS)) {
        VA_SECTION_HEADERS[key].test(input);
      }
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("vaDocumentParser: parseDBQReport (ReDoS regression)", () => {
  it("does not hang on a DIAGNOSIS section full of dash-separated pathological text", () => {
    const pathological = "DIAGNOSIS\n" + "A-B-C ".repeat(2000);
    const start = Date.now();
    const result = parseDBQReport(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on a nexus trigger phrase followed by ~100k chars with no period anywhere (regression: nexus-opinion ReDoS)", () => {
    const unit = "at least as likely as not " + "word ".repeat(370);
    let pathological = "";
    while (pathological.length < 100000) pathological += unit;
    const start = Date.now();
    const result = parseDBQReport(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("vaDocumentParser: parseCodeSheet (ReDoS regression)", () => {
  it("does not hang on a huge document with digit-prefixed dash-heavy text and no percent sign", () => {
    const pathological = ("1234" + "-".repeat(200) + " ").repeat(1000);
    const start = Date.now();
    const result = parseCodeSheet(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("vaDocumentParser: parseBVADecision (ReDoS regression)", () => {
  it("does not hang on many docket/citation triggers with no valid docket number", () => {
    const pathological = ("docket " + "x".repeat(30) + " ").repeat(3000);
    const start = Date.now();
    const result = parseBVADecision(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on a huge FINDINGS OF FACT section with bullets and no period anywhere", () => {
    const bullets = ("1. " + "x".repeat(100)).repeat(3000);
    const pathological =
      "FINDINGS OF FACT\n" +
      bullets +
      " no period ever\nCONCLUSIONS OF LAW\ndone";
    const start = Date.now();
    const result = parseBVADecision(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("vaDocumentParser: parseSOC (ReDoS regression)", () => {
  it("does not hang on an ISSUES ON APPEAL section full of pathological non-terminating text", () => {
    const pathological =
      "ISSUES ON APPEAL\n" + ("Entitlement to " + "x".repeat(80)).repeat(40);
    const start = Date.now();
    const result = parseSOC(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on a huge document with many non-matching '38 ...' CFR-citation triggers (regression: CFR-citation ReDoS)", () => {
    const pathological = ("38 " + "x".repeat(30) + " ").repeat(4000);
    const start = Date.now();
    const result = parseSOC(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("vaDocumentParser: parseHLR (ReDoS regression)", () => {
  it("does not hang on many conference/meeting triggers with no valid date", () => {
    const pathological = ("conference held " + "x".repeat(30) + " ").repeat(
      3000,
    );
    const start = Date.now();
    const result = parseHLR(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on many effective-date triggers with no valid date", () => {
    const pathological = ("effective " + "x".repeat(30) + " ").repeat(3000);
    const start = Date.now();
    const result = parseHLR(pathological);
    const elapsed = Date.now() - start;
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});
