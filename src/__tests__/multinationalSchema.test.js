import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import {
  validateCategoryFile,
  CATEGORIES,
  DISPLAY_FOR_CATEGORY,
  MULTINATIONAL_AUTHORITY_TIER,
} from "../../scripts/multinational/schema.mjs";
import {
  multinationalProvisions,
  getMultinationalByCategory,
  MULTINATIONAL_STATS,
} from "../data/multinationalContent.js";

// S38 accuracy floor: the four canonical multinational/OCONUS category files
// exist, validate against the schema, and every "verified" provision is grounded
// in an official https source. Guards against a category silently regressing to
// unverified/fabricated content or a divergent shape reappearing.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data", "multinational");

const readCategory = (category) =>
  JSON.parse(readFileSync(path.join(DATA_DIR, `${category}.json`), "utf8"));

describe("multinational content — canonical verified files (S38)", () => {
  it.each(CATEGORIES)("%s.json exists", (category) => {
    expect(existsSync(path.join(DATA_DIR, `${category}.json`))).toBe(true);
  });

  it.each(CATEGORIES)(
    "%s.json validates against the canonical schema",
    (category) => {
      const { valid, errors } = validateCategoryFile(readCategory(category));
      expect(errors).toEqual([]);
      expect(valid).toBe(true);
    },
  );

  it.each(CATEGORIES)("%s is a verified category", (category) => {
    const file = readCategory(category);
    expect(file.verificationStatus).toBe("verified");
    expect(
      file.provisions.some((p) => p.verificationStatus === "verified"),
    ).toBe(true);
  });

  it.each(CATEGORIES)(
    "%s verified provisions are each grounded in an official https source",
    (category) => {
      const offenders = readCategory(category)
        .provisions.filter((p) => p.verificationStatus === "verified")
        .filter((p) => !/^https:\/\//.test(p.sourceUrl || ""))
        .map((p) => p.id);
      expect(offenders).toEqual([]);
    },
  );

  it.each(CATEGORIES)(
    "%s provisions use the reference authority tier",
    (category) => {
      const bad = readCategory(category)
        .provisions.filter(
          (p) => p.authorityTier !== MULTINATIONAL_AUTHORITY_TIER,
        )
        .map((p) => p.id);
      expect(bad).toEqual([]);
    },
  );

  it.each(CATEGORIES)(
    "%s displayCategory matches the derived label",
    (category) => {
      const bad = readCategory(category)
        .provisions.filter(
          (p) => p.displayCategory !== DISPLAY_FOR_CATEGORY[category],
        )
        .map((p) => p.id);
      expect(bad).toEqual([]);
    },
  );
});

describe("multinational content — live consumer wiring (S38)", () => {
  it("multinationalContent.js flattens all four categories without an import error", () => {
    const categories = new Set(multinationalProvisions.map((p) => p.category));
    expect(categories).toEqual(new Set(CATEGORIES));
  });

  it.each(CATEGORIES)(
    "%s flattens through the consumer as verified",
    (category) => {
      const provisions = getMultinationalByCategory(category);
      expect(provisions.length).toBeGreaterThan(0);
      expect(provisions.some((p) => p.verified === true)).toBe(true);
    },
  );

  it("STATS totals match the flattened provisions", () => {
    expect(MULTINATIONAL_STATS.categories).toBe(CATEGORIES.length);
    expect(MULTINATIONAL_STATS.provisions).toBe(multinationalProvisions.length);
    expect(MULTINATIONAL_STATS.verified).toBe(
      multinationalProvisions.filter((p) => p.verified).length,
    );
  });
});
