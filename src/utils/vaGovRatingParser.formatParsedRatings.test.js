/**
 * Characterization coverage for formatParsedRatings, added while splitting
 * it up to satisfy sonarjs/cognitive-complexity. No existing test exercised
 * this exported display-formatting function.
 */
import { describe, it, expect } from "vitest";
import { formatParsedRatings } from "./vaGovRatingParser";

describe("formatParsedRatings - legacy array format", () => {
  it("reports no ratings for an empty array", () => {
    expect(formatParsedRatings([])).toBe("No ratings found in pasted text.");
  });

  it("formats a rating with a percentage and effective date", () => {
    const text = formatParsedRatings([
      { condition: "Tinnitus", rating: 10, effectiveDate: "2023-08-22" },
    ]);
    expect(text).toContain("Found 1 rating:");
    expect(text).toContain("1. Tinnitus - 10%");
    expect(text).toContain("Effective:");
  });

  it("flags a null rating for manual entry, without an effective date line", () => {
    const text = formatParsedRatings([
      { condition: "PTSD", rating: null, effectiveDate: null },
    ]);
    expect(text).toContain("PTSD - (No rating found, please set manually)");
    expect(text).not.toContain("Effective:");
  });

  it("pluralizes for more than one rating", () => {
    const text = formatParsedRatings([
      { condition: "A", rating: 10, effectiveDate: null },
      { condition: "B", rating: 20, effectiveDate: null },
    ]);
    expect(text).toContain("Found 2 ratings:");
  });
});

describe("formatParsedRatings - new object format", () => {
  it("reports no ratings when both lists are empty", () => {
    const text = formatParsedRatings({
      combinedRating: null,
      serviceConnected: [],
      notServiceConnected: [],
    });
    expect(text).toBe("No ratings found in pasted text.");
  });

  it("shows the combined rating header when present", () => {
    const text = formatParsedRatings({
      combinedRating: 80,
      serviceConnected: [
        { condition: "Tinnitus", rating: 10, effectiveDate: null },
      ],
      notServiceConnected: [],
    });
    expect(text).toContain("Combined VA Disability Rating: 80%");
  });

  it("omits the combined-rating header when null", () => {
    const text = formatParsedRatings({
      combinedRating: null,
      serviceConnected: [
        { condition: "Tinnitus", rating: 10, effectiveDate: null },
      ],
      notServiceConnected: [],
    });
    expect(text).not.toContain("Combined VA Disability Rating");
  });

  it("lists service-connected ratings with a percentage and effective date", () => {
    const text = formatParsedRatings({
      combinedRating: null,
      serviceConnected: [
        { condition: "Tinnitus", rating: 10, effectiveDate: "2023-08-22" },
      ],
      notServiceConnected: [],
    });
    expect(text).toContain("Found 1 service-connected rating:");
    expect(text).toContain("1. Tinnitus - 10%");
    expect(text).toContain("Effective:");
  });

  it("lists non-service-connected conditions in their own section, with a blank-line separator when service-connected ratings precede them", () => {
    const text = formatParsedRatings({
      combinedRating: null,
      serviceConnected: [
        { condition: "Tinnitus", rating: 10, effectiveDate: null },
      ],
      notServiceConnected: [
        { condition: "Acne", rating: null, effectiveDate: null },
      ],
    });
    expect(text).toContain(
      "Found 1 non-service-connected condition:\n(These will not be imported as they have no rating)",
    );
    expect(text).toContain("1. Acne\n");
    // Separator blank line between the two sections
    expect(text).toContain("Tinnitus - 10%\n\nFound 1 non-service-connected");
  });
});

describe("formatParsedRatings - section details", () => {
  it("prints no percentage for a service-connected entry whose rating is null", () => {
    const text = formatParsedRatings({
      combinedRating: null,
      serviceConnected: [
        { condition: "Migraine", rating: null, effectiveDate: null },
      ],
      notServiceConnected: [],
    });
    expect(text).toContain("1. Migraine\n");
    expect(text).not.toContain("%");
    expect(text).not.toContain("null");
  });

  it("pluralizes the service-connected header for two or more ratings", () => {
    const text = formatParsedRatings({
      combinedRating: null,
      serviceConnected: [
        { condition: "A", rating: 10, effectiveDate: null },
        { condition: "B", rating: 20, effectiveDate: null },
      ],
      notServiceConnected: [],
    });
    expect(text).toContain("Found 2 service-connected ratings:");
    expect(text).toContain("2. B - 20%");
  });

  it("pluralizes the non-service-connected header for two or more conditions", () => {
    const text = formatParsedRatings({
      combinedRating: null,
      serviceConnected: [],
      notServiceConnected: [
        { condition: "Acne", rating: null, effectiveDate: null },
        { condition: "Flatfoot", rating: null, effectiveDate: null },
      ],
    });
    expect(text).toContain("Found 2 non-service-connected conditions:");
    expect(text).toContain("2. Flatfoot\n");
  });

  it("omits the separator blank line when there are no service-connected ratings", () => {
    const text = formatParsedRatings({
      combinedRating: null,
      serviceConnected: [],
      notServiceConnected: [
        { condition: "Acne", rating: null, effectiveDate: null },
      ],
    });
    expect(text.startsWith("Found 1 non-service-connected")).toBe(true);
  });
});
