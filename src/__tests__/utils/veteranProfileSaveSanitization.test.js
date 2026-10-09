/**
 * Characterization coverage for saveVeteranProfile's per-field
 * sanitization, added while extracting it into _sanitizeProfileFieldValue
 * to satisfy sonarjs/cognitive-complexity. No existing test exercised
 * every value-type branch (string/boolean/number/array/object) directly.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  saveVeteranProfile,
  getVeteranProfile,
  clearVeteranProfile,
} from "../../utils/veteranProfile";

afterEach(clearVeteranProfile);

describe("saveVeteranProfile: per-field value sanitization", () => {
  it("rejects a non-object profile", () => {
    expect(saveVeteranProfile(null)).toBe(false);
    expect(saveVeteranProfile("nope")).toBe(false);
  });

  it("sanitizes a string field (strips a script tag)", () => {
    saveVeteranProfile({ firstName: "John<script>alert(1)</script>" });
    expect(getVeteranProfile().firstName).toBe("John");
  });

  it("stores a boolean field as-is", () => {
    saveVeteranProfile({ reenlisted: true });
    expect(getVeteranProfile().reenlisted).toBe(true);
  });

  it("stores a number field as-is", () => {
    saveVeteranProfile({ totalServiceYears: 8 });
    expect(getVeteranProfile().totalServiceYears).toBe(8);
  });

  it("stores an array field as-is (already validated on write)", () => {
    const servicePeriods = [{ id: "p1", branch: "Army" }];
    saveVeteranProfile({ servicePeriods });
    expect(getVeteranProfile().servicePeriods).toEqual(servicePeriods);
  });

  it("stores an object field as-is (already validated on write)", () => {
    const combatService = { hasVerifiedCombat: true, indicators: ["CAB"] };
    saveVeteranProfile({ combatService });
    expect(getVeteranProfile().combatService).toEqual(combatService);
  });

  it("drops undefined and empty-string fields rather than storing them", () => {
    saveVeteranProfile({ firstName: undefined, lastName: "" });
    const saved = getVeteranProfile();
    expect(saved).not.toHaveProperty("firstName");
    expect(saved).not.toHaveProperty("lastName");
  });

  it("ignores a field not in the allowlist", () => {
    saveVeteranProfile({ maliciousField: "<script>alert(1)</script>" });
    expect(getVeteranProfile()).not.toHaveProperty("maliciousField");
  });
});
