/**
 * getSavedClaims() must survive localStorage holding the literal string
 * "undefined" — which happens when a write path does
 * localStorage.setItem(key, undefined), since the Web Storage API coerces
 * the value via ToString before JSON.parse ever gets a chance to fail loudly.
 * Two such write paths existed in autoBackup.js's restoreFromBackup/
 * importBackupFile (fixed alongside this test) before any guard existed here.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getSavedClaims } from "../../utils/claimsStorage";

const STORAGE_KEY = "vet_rate_saved_claims";

describe("getSavedClaims — corrupted localStorage state", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns [] when the key holds the literal string 'undefined'", () => {
    localStorage.setItem(STORAGE_KEY, "undefined");
    expect(getSavedClaims()).toEqual([]);
  });

  it("returns [] when the key is absent", () => {
    expect(getSavedClaims()).toEqual([]);
  });

  it("still parses valid saved claims normally", () => {
    const claims = [{ id: "claim_1", conditionName: "Tinnitus" }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(claims));
    expect(getSavedClaims()).toEqual(claims);
  });
});
