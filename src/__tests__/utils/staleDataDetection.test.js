import { describe, it, expect } from "vitest";
import { isStaleData, getDataAgeDays } from "../../utils/staleDataDetection";

describe("staleDataDetection", () => {
  describe("isStaleData", () => {
    it("treats data with no lastVerifiedDate as stale", () => {
      expect(isStaleData({})).toBe(true);
      expect(isStaleData({ name: "PTSD" })).toBe(true);
    });

    it("treats data older than 365 days as stale", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 400);
      expect(isStaleData({ lastVerifiedDate: oldDate.toISOString() })).toBe(
        true,
      );
    });

    it("treats recent data as fresh", () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 30);
      expect(isStaleData({ lastVerifiedDate: recent.toISOString() })).toBe(
        false,
      );
    });

    it("returns boolean for invalid date strings", () => {
      const result = isStaleData({ lastVerifiedDate: "not-a-date" });
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getDataAgeDays", () => {
    it("returns Infinity when no date present", () => {
      expect(getDataAgeDays({})).toBe(Infinity);
    });

    it("returns correct age in days (±1 day jitter)", () => {
      const d = new Date();
      d.setDate(d.getDate() - 100);
      const age = getDataAgeDays({ lastVerifiedDate: d.toISOString() });
      expect(age).toBeGreaterThanOrEqual(99);
      expect(age).toBeLessThanOrEqual(101);
    });

    it("returns a number for invalid input (does not throw)", () => {
      const result = getDataAgeDays({ lastVerifiedDate: "garbage" });
      expect(typeof result).toBe("number");
    });
  });
});
