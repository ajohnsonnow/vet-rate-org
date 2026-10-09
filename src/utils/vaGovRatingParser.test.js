import { describe, it, expect } from "vitest";
import {
  parseVAGovRatings,
  formatParsedRatings,
  EXAMPLE_VA_GOV_TEXT,
} from "./vaGovRatingParser";

// Covers the ratingPattern and "Effective date:" trim regexes bounded for
// sonarjs/super-linear-regex, plus the formatParsedRatings legacy-array
// extraction (cognitive-complexity), against the module's own documented
// synthetic VA.gov paste sample plus a couple of hand-built variants.
describe("vaGovRatingParser: parseVAGovRatings", () => {
  it("parses the documented full-page VA.gov paste sample", () => {
    const result = parseVAGovRatings(EXAMPLE_VA_GOV_TEXT);
    expect(result.combinedRating).toBe(60);
    expect(result.serviceConnected.length).toBeGreaterThan(5);
    expect(result.notServiceConnected.length).toBeGreaterThan(0);

    const tinnitus = result.serviceConnected.find((r) =>
      r.condition.toLowerCase().includes("tinnitus"),
    );
    expect(tinnitus).toBeDefined();
    expect(tinnitus.rating).toBe(10);
    expect(tinnitus.effectiveDate).toBe("2021-03-03");

    const renamed = result.serviceConnected.find((r) =>
      r.condition.toLowerCase().includes("previously rated as knee strain"),
    );
    expect(renamed).toBeUndefined(); // "previously rated as ..." is stripped
  });

  it("parses a minimal synthetic block with a 3-digit-safe rating and short condition", () => {
    const text =
      "Service-connected ratings\n" +
      "50% rating for Migraine headaches\n" +
      "Effective date: June 1, 2021\n" +
      "Learn about VA disability ratings";
    const result = parseVAGovRatings(text);
    expect(result.serviceConnected).toEqual([
      expect.objectContaining({
        rating: 50,
        condition: "Migraine headaches",
        effectiveDate: "2021-06-01",
      }),
    ]);
  });

  it("strips a '(claimed as ...)' qualifier from the condition name", () => {
    const text =
      "Service-connected ratings\n" +
      "0% rating for Chronic sinusitis (claimed as sinus condition and congestion)\n" +
      "Effective date: July 8, 2022";
    const result = parseVAGovRatings(text);
    expect(result.serviceConnected[0].condition).toBe("Chronic sinusitis");
  });
});

describe("vaGovRatingParser: formatParsedRatings (legacy array format)", () => {
  it("formats a legacy flat-array result with a rating and effective date", () => {
    const ratings = [
      { condition: "Tinnitus", rating: 10, effectiveDate: "2023-01-26" },
    ];
    const text = formatParsedRatings(ratings);
    expect(text).toContain("Found 1 rating:");
    expect(text).toContain("1. Tinnitus - 10%");
  });

  it("formats a legacy entry with no rating as needing manual review", () => {
    const ratings = [
      { condition: "Sleep disorder", rating: null, effectiveDate: null },
    ];
    const text = formatParsedRatings(ratings);
    expect(text).toContain("(No rating found, please set manually)");
  });

  it("reports no ratings for an empty legacy array", () => {
    expect(formatParsedRatings([])).toBe("No ratings found in pasted text.");
  });
});
