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
});

describe("getFormattedDisabilityCount", () => {
  it("returns string without label by default", () => {
    const result = getFormattedDisabilityCount();
    expect(typeof result).toBe("string");
    expect(result).not.toContain("conditions");
  });

  it("returns string with label when requested", () => {
    const result = getFormattedDisabilityCount(true);
    expect(result).toContain("conditions");
  });
});

describe("getDisabilityCountWithValidation", () => {
  it("returns object with count and metadata", () => {
    const result = getDisabilityCountWithValidation();
    expect(result.count).toBeGreaterThan(0);
    expect(result.validated).toBe(true);
    expect(result.source).toBe("38 CFR Part 4");
  });
});
