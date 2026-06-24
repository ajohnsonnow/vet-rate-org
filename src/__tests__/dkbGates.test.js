import { describe, it, expect } from "vitest";
import {
  checkRowCountFloor,
  checkStaleness,
} from "../../scripts/validate-dkb.mjs";

/**
 * C-M02 / C-H03: validate-dkb had no absolute floor (a truncated data file
 * passed if its count constant was decremented in lockstep) and no staleness
 * ceiling (a 2020-dated entry passed in 2026, breaking the "verified against the
 * current 38 CFR" promise). These guard the two new gate predicates directly.
 */
describe("DKB row-count floor (C-M02)", () => {
  it("returns no failure when the count meets the floor", () => {
    expect(checkRowCountFloor("disabilityData.json", 748, 700)).toEqual([]);
  });

  it("returns no failure at exactly the floor", () => {
    expect(checkRowCountFloor("web tier", 7000, 7000)).toEqual([]);
  });

  it("flags a truncated file below the floor", () => {
    const out = checkRowCountFloor("disabilityData.json", 12, 700);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/below the floor of 700/);
  });
});

describe("DKB staleness ceiling (C-H03)", () => {
  const NOW = Date.parse("2026-06-22");

  it("passes data verified within the window", () => {
    expect(checkStaleness("2026-01-18", 365, NOW)).toEqual([]);
  });

  it("flags data older than the ceiling", () => {
    const out = checkStaleness("2020-01-01", 365, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/staleness ceiling/);
  });

  it("is a no-op when there is no date", () => {
    expect(checkStaleness(undefined, 365, NOW)).toEqual([]);
  });
});
