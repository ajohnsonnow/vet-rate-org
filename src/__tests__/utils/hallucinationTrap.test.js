import { describe, it, expect } from "vitest";

import hallucinationTrap, {
  validateDiagnosticCode,
  validateCondition,
  validateConditions,
  annotateConditionVerification,
  validateAIResponse,
  getDatabaseStats,
  searchConditions,
} from "../../utils/hallucinationTrap";

const KNOWN_CODE = "5003";

describe("validateDiagnosticCode", () => {
  it("accepts a real 38 CFR Part 4 code", () => {
    const result = validateDiagnosticCode(KNOWN_CODE);
    expect(result.isValid).toBe(true);
    expect(result.code).toBe(KNOWN_CODE);
    expect(result.officialName).toBeTruthy();
    expect(result.officialRecord).toBeTruthy();
  });

  it("rejects a fabricated code with reason + suggestions", () => {
    const result = validateDiagnosticCode("99999");
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/38 CFR/);
    expect(Array.isArray(result.suggestion)).toBe(true);
  });

  it("rejects empty/whitespace input", () => {
    expect(validateDiagnosticCode("").isValid).toBe(false);
    expect(validateDiagnosticCode("   ").isValid).toBe(false);
  });

  it("coerces numeric input to string", () => {
    const result = validateDiagnosticCode(Number(KNOWN_CODE));
    expect(result.isValid).toBe(true);
  });

  it("returns nearby codes when input is numeric but unknown", () => {
    const result = validateDiagnosticCode("5008");
    if (!result.isValid) {
      expect(result.suggestion.length).toBeLessThanOrEqual(3);
    }
  });
});

describe("validateCondition", () => {
  it("rejects null/non-object input", () => {
    expect(validateCondition(null).isValid).toBe(false);
    expect(validateCondition("string").isValid).toBe(false);
    expect(validateCondition(42).isValid).toBe(false);
  });

  it("validates condition with explicit diagnosticCode", () => {
    const result = validateCondition({
      diagnosticCode: KNOWN_CODE,
      name: "Some AI name",
    });
    expect(result.isValid).toBe(true);
    expect(result.correctedName).toBeTruthy();
    expect(result.aiName).toBe("Some AI name");
  });

  it("accepts the alias field `code`", () => {
    const result = validateCondition({ code: KNOWN_CODE });
    expect(result.isValid).toBe(true);
  });

  it("accepts the alias field `dc`", () => {
    const result = validateCondition({ dc: KNOWN_CODE });
    expect(result.isValid).toBe(true);
  });

  it("returns reason when no code and no matchable name", () => {
    const result = validateCondition({ name: "totally fabricated condition" });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("No diagnostic code provided");
  });

  it("flags fabricated diagnosticCode even with name", () => {
    const result = validateCondition({
      diagnosticCode: "99999",
      name: "Fake",
    });
    expect(result.isValid).toBe(false);
  });
});

describe("validateConditions", () => {
  it("rejects non-array input", () => {
    const result = validateConditions("not an array");
    expect(result.success).toBe(false);
    expect(result.safeData).toEqual([]);
  });

  it("splits valid and rejected entries", () => {
    const result = validateConditions([
      { diagnosticCode: KNOWN_CODE, name: "Test" },
      { diagnosticCode: "99999", name: "Fake" },
    ]);
    expect(result.success).toBe(true);
    expect(result.safeData.length).toBe(1);
    expect(result.rejected.length).toBe(1);
    expect(result.stats.total).toBe(2);
    expect(result.stats.valid).toBe(1);
    expect(result.stats.invalid).toBe(1);
    expect(result.stats.successRate).toBe(50);
  });

  it("emits warnings for name mismatches on valid codes", () => {
    const result = validateConditions([
      { diagnosticCode: KNOWN_CODE, name: "Wrong name from AI" },
    ]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].type).toBe("name_mismatch");
  });

  it("returns 0 successRate for empty input", () => {
    const result = validateConditions([]);
    expect(result.stats.successRate).toBe(0);
  });
});

// D-H09: Blue Button report diagnoses are AI-extracted and may be hallucinated.
// annotateConditionVerification flags each against the official code DB but, unlike
// validateConditions, keeps every condition so real diagnoses are never hidden.
describe("annotateConditionVerification (D-H09)", () => {
  it("returns [] for non-array input", () => {
    expect(annotateConditionVerification(null)).toEqual([]);
    expect(annotateConditionVerification("nope")).toEqual([]);
  });

  it("flags verified vs unverified WITHOUT dropping any condition", () => {
    const result = annotateConditionVerification([
      { standardizedName: "Test", diagnosticCode: KNOWN_CODE },
      { standardizedName: "Totally Fabricated Condition QZX" },
    ]);
    expect(result).toHaveLength(2); // nothing dropped (unlike validateConditions)
    expect(result[0].verified).toBe(true);
    expect(result[0].officialName).toBeTruthy();
    expect(result[1].verified).toBe(false);
    expect(result[1].officialName).toBeNull();
    expect(result[1].standardizedName).toBe("Totally Fabricated Condition QZX");
  });

  it("reads the condition name from `name` when present", () => {
    const [c] = annotateConditionVerification([
      { name: "Test", diagnosticCode: KNOWN_CODE },
    ]);
    expect(c.verified).toBe(true);
  });
});

describe("validateAIResponse", () => {
  it("parses JSON string with markdown fences", () => {
    const ai = '```json\n[{"diagnosticCode":"' + KNOWN_CODE + '"}]\n```';
    const result = validateAIResponse(ai);
    expect(result.success).toBe(true);
    expect(result.safeData.length).toBe(1);
  });

  it("returns parse error on invalid JSON string", () => {
    const result = validateAIResponse("not { valid: json");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/parse/i);
  });

  it("handles nested .conditions wrapper", () => {
    const result = validateAIResponse({
      conditions: [{ diagnosticCode: KNOWN_CODE }],
    });
    expect(result.success).toBe(true);
    expect(result.safeData.length).toBe(1);
  });

  it("handles nested .results wrapper", () => {
    const result = validateAIResponse({
      results: [{ diagnosticCode: KNOWN_CODE }],
    });
    expect(result.success).toBe(true);
  });

  it("handles C-File analyzer .potential_claims wrapper", () => {
    const result = validateAIResponse({
      potential_claims: [{ diagnosticCode: KNOWN_CODE }],
    });
    expect(result.success).toBe(true);
  });

  it("passes through arrays without diagnostic-shape objects", () => {
    const result = validateAIResponse(["one", "two", "three"]);
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.safeData).toEqual(["one", "two", "three"]);
  });

  it("passes through non-condition objects unchanged", () => {
    const result = validateAIResponse({
      summary: "no codes here",
      action: "do thing",
    });
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.safeData.summary).toBe("no codes here");
  });

  it("wraps a single condition-shaped object as array", () => {
    const result = validateAIResponse({ diagnosticCode: KNOWN_CODE });
    expect(result.success).toBe(true);
    expect(result.safeData.length).toBe(1);
  });

  it("rejects unrecognized non-object input", () => {
    const result = validateAIResponse(42);
    expect(result.success).toBe(false);
  });
});

describe("getDatabaseStats", () => {
  it("returns coherent shape", () => {
    const stats = getDatabaseStats();
    expect(stats.totalCodes).toBeGreaterThan(0);
    expect(stats.codeRange.min).toBeLessThan(stats.codeRange.max);
  });
});

describe("searchConditions", () => {
  it("returns empty array for null/empty input", () => {
    expect(searchConditions(null)).toEqual([]);
    expect(searchConditions("")).toEqual([]);
    expect(searchConditions(42)).toEqual([]);
  });

  it("finds exact code match", () => {
    const result = searchConditions(KNOWN_CODE);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].matchType).toBe("exact_code");
  });

  it("finds by name substring", () => {
    const result = searchConditions("arthritis");
    expect(result.length).toBeGreaterThan(0);
  });

  it("respects the limit parameter", () => {
    const result = searchConditions("a", 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

describe("default export shape", () => {
  it("exposes the documented API", () => {
    expect(typeof hallucinationTrap.validateDiagnosticCode).toBe("function");
    expect(typeof hallucinationTrap.validateCondition).toBe("function");
    expect(typeof hallucinationTrap.validateConditions).toBe("function");
    expect(typeof hallucinationTrap.validateAIResponse).toBe("function");
    expect(typeof hallucinationTrap.getDatabaseStats).toBe("function");
    expect(typeof hallucinationTrap.searchConditions).toBe("function");
    expect(hallucinationTrap.VALID_CODES instanceof Set).toBe(true);
  });
});
