/**
 * searchUtils — normalises veteran-typed search terms to match the
 * disability index. Punctuation/case mismatches were the #1 cause of
 * "I can't find my condition" reports before normalisation.
 */
import { describe, it, expect } from "vitest";
import { normalizeSearchTerm } from "../../utils/searchUtils";

describe("normalizeSearchTerm", () => {
  it("lowercases input", () => {
    expect(normalizeSearchTerm("PTSD")).toBe("ptsd");
  });

  it("trims whitespace", () => {
    expect(normalizeSearchTerm("  ankle  ")).toBe("ankle");
  });

  it("replaces hyphens with spaces", () => {
    expect(normalizeSearchTerm("post-traumatic")).toBe("post traumatic");
  });

  it("replaces commas with spaces", () => {
    expect(normalizeSearchTerm("Ankle, ankylosis")).toBe("ankle ankylosis");
  });

  it("replaces slashes with spaces", () => {
    expect(normalizeSearchTerm("knee/leg")).toBe("knee leg");
  });

  it("replaces parentheses with spaces", () => {
    expect(normalizeSearchTerm("tinnitus (ringing)")).toBe("tinnitus ringing");
  });

  it("normalises multiple spaces to a single space", () => {
    expect(normalizeSearchTerm("sleep   apnea")).toBe("sleep apnea");
  });

  it("handles empty string", () => {
    expect(normalizeSearchTerm("")).toBe("");
  });

  it("handles complex medical terms", () => {
    expect(
      normalizeSearchTerm(
        "Degenerative arthritis (hypertrophic/osteoarthritis)",
      ),
    ).toBe("degenerative arthritis hypertrophic osteoarthritis");
  });
});

describe("searchDisabilityData — defensive defaults", () => {
  it("returns empty array for empty query", async () => {
    const { searchDisabilityData } = await import("../../utils/searchUtils");
    expect(searchDisabilityData("", { disabilities: [] })).toEqual([]);
  });

  it("returns empty array for whitespace-only query", async () => {
    const { searchDisabilityData } = await import("../../utils/searchUtils");
    expect(searchDisabilityData("   ", { disabilities: [] })).toEqual([]);
  });

  it("returns empty array for invalid data", async () => {
    const { searchDisabilityData } = await import("../../utils/searchUtils");
    expect(searchDisabilityData("ptsd", null)).toEqual([]);
  });
});
