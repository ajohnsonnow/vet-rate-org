/**
 * My Packet renders saved claims straight from storage. A record that is not
 * an object, or whose name or status is not text, must not reach the screen
 * as it is, and reading must never change what is stored.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getDisplayableClaims, getClaimStats } from "../../utils/claimsStorage";

const STORAGE_KEY = "vet_rate_saved_claims";
const first = { id: "claim_a", conditionName: "Tinnitus", status: "Drafting" };
const last = { id: "claim_b", conditionName: "Knee strain", status: "Filed" };

describe("getDisplayableClaims", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns valid claims unchanged", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([first, last]));
    expect(getDisplayableClaims()).toEqual([first, last]);
  });

  it.each([null, 7, "text", [], [first]])(
    "skips a record that is not an object (%j) and keeps the others",
    (bad) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([first, bad, last]));
      expect(getDisplayableClaims()).toEqual([first, last]);
    },
  );

  it("turns a name or status that is not text into text", () => {
    const bad = { id: "x", conditionName: { text: "a" }, status: ["b"] };
    const numeric = { id: "y", conditionName: 9411, status: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([bad, numeric, last]));
    expect(getDisplayableClaims()).toEqual([
      { id: "x", conditionName: "", status: "" },
      { id: "y", conditionName: "9411", status: "" },
      last,
    ]);
  });

  it("leaves storage exactly as it was", () => {
    const stored = JSON.stringify([first, null, { conditionName: {} }, last]);
    localStorage.setItem(STORAGE_KEY, stored);
    getDisplayableClaims();
    getClaimStats();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
  });
});

describe("getClaimStats", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("counts by status without throwing on a null record", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([first, null, 7, last]));
    expect(getClaimStats()).toEqual({
      total: 4,
      drafting: 1,
      statementGenerated: 0,
      filed: 1,
    });
  });
});
