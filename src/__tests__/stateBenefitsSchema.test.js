import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import {
  validateStateFile,
  BENEFIT_TYPES,
  STATE_BENEFIT_AUTHORITY_TIER,
} from "../../scripts/state-benefits/schema.mjs";
import { getStateBenefits, stateBenefits } from "../data/stateBenefits.js";

// S36/S37 accuracy floor: the canonical verified state files exist, validate
// against the schema, and every "verified" benefit is grounded in an official
// source. Guards against a verified state silently regressing to
// unverified/fabricated data or a divergent shape reappearing.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATES_DIR = path.resolve(__dirname, "..", "data", "states");
// The 15 highest-veteran-population states: TX/CA/FL (S36) + the next 12 (S37).
const PILOT = ["tx", "ca", "fl"];
const S37 = [
  "pa",
  "va",
  "nc",
  "oh",
  "ga",
  "ny",
  "il",
  "wa",
  "mi",
  "az",
  "co",
  "md",
];
const VERIFIED = [...PILOT, ...S37];

const readState = (code) =>
  JSON.parse(readFileSync(path.join(STATES_DIR, `${code}.json`), "utf8"));

describe("state benefits — canonical verified files (S36/S37)", () => {
  it.each(VERIFIED)("%s.json exists", (code) => {
    expect(existsSync(path.join(STATES_DIR, `${code}.json`))).toBe(true);
  });

  it.each(VERIFIED)(
    "%s.json validates against the canonical schema",
    (code) => {
      const { valid, errors } = validateStateFile(readState(code));
      expect(errors).toEqual([]);
      expect(valid).toBe(true);
    },
  );

  it.each(VERIFIED)("%s is a verified state", (code) => {
    const state = readState(code);
    expect(state.verificationStatus).toBe("verified");
    expect(
      state.benefits.some((b) => b.verificationStatus === "verified"),
    ).toBe(true);
  });

  it.each(VERIFIED)(
    "%s verified benefits are each grounded in an official https source",
    (code) => {
      const offenders = readState(code)
        .benefits.filter((b) => b.verificationStatus === "verified")
        .filter((b) => !/^https:\/\//.test(b.sourceUrl || ""))
        .map((b) => b.id);
      expect(offenders).toEqual([]);
    },
  );

  it.each(VERIFIED)("%s benefits use the reference authority tier", (code) => {
    const bad = readState(code)
      .benefits.filter((b) => b.authorityTier !== STATE_BENEFIT_AUTHORITY_TIER)
      .map((b) => b.id);
    expect(bad).toEqual([]);
  });

  it.each(VERIFIED)("%s benefit types are all in the vocabulary", (code) => {
    const bad = readState(code)
      .benefits.filter((b) => !BENEFIT_TYPES.includes(b.benefitType))
      .map((b) => b.benefitType);
    expect(bad).toEqual([]);
  });
});

describe("state benefits — live consumer wiring (S36)", () => {
  it("stateBenefits.js loads all 51 states without an import error", () => {
    const codes = new Set(stateBenefits.map((b) => b.stateCode));
    expect(codes.size).toBe(51);
  });

  it.each(VERIFIED.map((c) => c.toUpperCase()))(
    "%s flattens through the consumer as verified",
    (code) => {
      const benefits = getStateBenefits(code);
      expect(benefits.length).toBeGreaterThan(0);
      expect(benefits.every((b) => b.verified === true)).toBe(true);
    },
  );
});
