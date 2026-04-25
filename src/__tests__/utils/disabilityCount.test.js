/**
 * disabilityCount — guards the marketing number ("748 conditions") and the
 * runtime metadata that drives the SecurityBadge / footer counts.
 */
import { describe, it, expect } from "vitest";
import {
  getDisabilityCount,
  getFormattedDisabilityCount,
  getDisabilityCountWithValidation,
} from "../../utils/disabilityCount";

describe("getDisabilityCount", () => {
  it("returns a positive number", () => {
    expect(getDisabilityCount()).toBeGreaterThan(0);
  });

  it("returns a number type", () => {
    expect(typeof getDisabilityCount()).toBe("number");
  });

  it("falls within the realistic 38 CFR Part 4 range (100..2000)", () => {
    const count = getDisabilityCount();
    expect(count).toBeGreaterThanOrEqual(100);
    expect(count).toBeLessThanOrEqual(2000);
  });
});

describe("getFormattedDisabilityCount", () => {
  it("returns string without label by default", () => {
    const result = getFormattedDisabilityCount();
    expect(typeof result).toBe("string");
    expect(result).not.toContain("conditions");
  });

  it("returns digits-only string when labelled=false", () => {
    expect(getFormattedDisabilityCount(false)).toMatch(/^\d+$/);
  });

  it("returns string with label when requested", () => {
    expect(getFormattedDisabilityCount(true)).toContain("conditions");
  });

  it("formatted count matches getDisabilityCount", () => {
    expect(parseInt(getFormattedDisabilityCount(false), 10)).toBe(
      getDisabilityCount(),
    );
  });
});

describe("getDisabilityCountWithValidation", () => {
  it("returns object with count and metadata", () => {
    const result = getDisabilityCountWithValidation();
    expect(result.count).toBeGreaterThan(0);
    expect(result.validated).toBe(true);
    expect(result.source).toBe("38 CFR Part 4");
  });

  it("includes validation date (citable for veterans)", () => {
    expect(getDisabilityCountWithValidation().validationDate).toBeTruthy();
  });
});
