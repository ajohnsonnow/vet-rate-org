import { describe, it, expect } from "vitest";
import {
  getDisabilityCount,
  getFormattedDisabilityCount,
  getDisabilityCountWithValidation,
} from "../../utils/disabilityCount";

describe("getDisabilityCount", () => {
  it("returns a positive number", () => {
    const count = getDisabilityCount();
    expect(count).toBeGreaterThan(0);
  });

  it("returns a number", () => {
    expect(typeof getDisabilityCount()).toBe("number");
  });

  it("returns a reasonable count (100-2000)", () => {
    const count = getDisabilityCount();
    expect(count).toBeGreaterThanOrEqual(100);
    expect(count).toBeLessThanOrEqual(2000);
  });
});

describe("getFormattedDisabilityCount", () => {
  it("returns string without label", () => {
    const result = getFormattedDisabilityCount(false);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^\d+$/);
  });

  it("returns string with label", () => {
    const result = getFormattedDisabilityCount(true);
    expect(result).toContain("conditions");
  });

  it("count matches getDisabilityCount", () => {
    const count = getDisabilityCount();
    const formatted = getFormattedDisabilityCount(false);
    expect(parseInt(formatted)).toBe(count);
  });
});

describe("getDisabilityCountWithValidation", () => {
  it("returns object with count", () => {
    const result = getDisabilityCountWithValidation();
    expect(result.count).toBeGreaterThan(0);
  });

  it("has validated flag", () => {
    const result = getDisabilityCountWithValidation();
    expect(result.validated).toBe(true);
  });

  it("has source reference", () => {
    const result = getDisabilityCountWithValidation();
    expect(result.source).toBe("38 CFR Part 4");
  });

  it("has validation date", () => {
    const result = getDisabilityCountWithValidation();
    expect(result.validationDate).toBeTruthy();
  });
});
