import { describe, it, expect } from "vitest";
import { assertCoverageFloor } from "../../scripts/legal-ingestion/fetch-ecfr.mjs";

/**
 * C-H01: fetch-ecfr swallowed every per-section HTTP failure and only guarded
 * against "zero records" — a transient eCFR outage that dropped 40% of Part 4
 * still published the surviving 60% as the new canonical RAG index. The fetch
 * now refuses to publish once the failure rate clears a floor.
 */
describe("eCFR coverage floor (C-H01)", () => {
  it("passes when no sections failed", () => {
    expect(assertCoverageFloor(0, 100, 0.05)).toBe(0);
  });

  it("passes at exactly the threshold", () => {
    expect(assertCoverageFloor(5, 100, 0.05)).toBeCloseTo(0.05);
  });

  it("throws when the failure rate exceeds the floor", () => {
    expect(() => assertCoverageFloor(6, 100, 0.05)).toThrow(
      /coverage floor breached/i,
    );
  });

  it("names the counts when a large slice fails", () => {
    expect(() => assertCoverageFloor(40, 100, 0.05)).toThrow(/40\/100/);
  });

  it("treats an empty section list as non-failing", () => {
    expect(assertCoverageFloor(0, 0, 0.05)).toBe(0);
  });
});
