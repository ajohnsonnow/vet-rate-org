import { describe, it, expect, vi } from "vitest";

import formValidator, {
  validateVAForms,
  safeFormResponse,
  getFormDatabaseStats,
  searchForms,
} from "../../utils/formValidator";

describe("validateVAForms - happy path", () => {
  it("returns isValid=true on text with no form references", () => {
    const result = validateVAForms("PTSD is rated at 70 percent.");
    expect(result.isValid).toBe(true);
    expect(result.validForms).toEqual([]);
    expect(result.invalidForms).toEqual([]);
    expect(result.scanned).toBe(true);
  });

  it("accepts a known good form (21-526EZ)", () => {
    const result = validateVAForms("File VA Form 21-526EZ today.");
    expect(result.isValid).toBe(true);
    expect(result.validForms.some((f) => /21-526/i.test(f))).toBe(true);
    expect(result.invalidForms).toEqual([]);
  });

  it("accepts SF-prefixed federal forms by rule (SF-180)", () => {
    const result = validateVAForms("Submit SF-180 to NPRC.");
    expect(result.isValid).toBe(true);
    expect(result.validForms).toContain("SF-180");
  });

  it("accepts DBQ-prefixed forms by rule (21-0960M-12)", () => {
    const result = validateVAForms("Bring the 21-0960M-12 DBQ.");
    expect(result.isValid).toBe(true);
  });
});

describe("validateVAForms - hallucination blocking", () => {
  it("flags a fabricated form number", () => {
    const result = validateVAForms("Submit VA Form 99-99999X.");
    expect(result.isValid).toBe(false);
    expect(result.invalidForms.length).toBeGreaterThan(0);
    expect(result.error).toContain("Safety System Block");
  });

  it("dedupes repeated form references", () => {
    const result = validateVAForms(
      "99-99999 again 99-99999 once more 99-99999",
    );
    expect(result.invalidForms.length).toBe(1);
  });

  it("returns both valid and invalid forms in mixed text", () => {
    const result = validateVAForms(
      "Use VA Form 21-526EZ for claims and 99-99999X is fake.",
    );
    expect(result.invalidForms.length).toBeGreaterThan(0);
    expect(result.validForms.length).toBeGreaterThan(0);
    expect(result.isValid).toBe(false);
  });
});

describe("safeFormResponse - wrapper behavior", () => {
  it("passes through valid responses unchanged", () => {
    const text = "File VA Form 21-526EZ.";
    const result = safeFormResponse(text);
    expect(result.success).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.text).toBe(text);
  });

  it("blocks responses containing hallucinated forms", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = safeFormResponse("Submit fake form 99-99999X.");
    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.invalidForms.length).toBeGreaterThan(0);
    expect(result.originalResponse).toContain("99-99999X");
  });
});

describe("formValidator default export helpers", () => {
  it("isValidForm returns true for canonical forms", () => {
    expect(formValidator.isValidForm("21-526EZ")).toBe(true);
    expect(formValidator.isValidForm("sf-180")).toBe(true);
  });

  it("isValidForm returns false for fabricated numbers", () => {
    expect(formValidator.isValidForm("99-99999X")).toBe(false);
  });

  it("isValidForm returns false for empty input", () => {
    expect(formValidator.isValidForm("")).toBe(false);
    expect(formValidator.isValidForm(null)).toBe(false);
    expect(formValidator.isValidForm(undefined)).toBe(false);
  });

  it("isValidForm accepts DBQ prefix variants", () => {
    expect(formValidator.isValidForm("21-0960X-99")).toBe(true);
  });
});

describe("searchForms", () => {
  it("returns empty array for null/empty input", () => {
    expect(searchForms(null)).toEqual([]);
    expect(searchForms("")).toEqual([]);
    expect(searchForms(123)).toEqual([]);
  });

  it("matches forms by substring (case-insensitive)", () => {
    const results = searchForms("526");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((f) => f.includes("526"))).toBe(true);
  });

  it("caps results at 10", () => {
    const results = searchForms("21");
    expect(results.length).toBeLessThanOrEqual(10);
  });
});

describe("getFormDatabaseStats", () => {
  it("returns coherent shape", () => {
    const stats = getFormDatabaseStats();
    expect(stats.totalForms).toBeGreaterThan(0);
    expect(stats.categories).toBeGreaterThan(0);
    expect(Array.isArray(stats.dbqPrefixes)).toBe(true);
    expect(stats.dbqPrefixes).toContain("21-0960");
  });
});
