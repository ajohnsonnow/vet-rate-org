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

  it("normalizes multiple spaces to single", () => {
    expect(normalizeSearchTerm("sleep   apnea")).toBe("sleep apnea");
  });

  it("handles empty string", () => {
    expect(normalizeSearchTerm("")).toBe("");
  });

  it("handles complex medical terms", () => {
    const result = normalizeSearchTerm(
      "Degenerative arthritis (hypertrophic/osteoarthritis)",
    );
    expect(result).toBe("degenerative arthritis hypertrophic osteoarthritis");
  });
});

describe("searchDisabilityData", () => {
  // Import dynamically since it needs the data file
  it("returns empty array for empty search", async () => {
    const { searchDisabilityData } = await import("../../utils/searchUtils");
    expect(searchDisabilityData("", { disabilities: [] })).toEqual([]);
  });

  it("returns empty array for whitespace search", async () => {
    const { searchDisabilityData } = await import("../../utils/searchUtils");
    expect(searchDisabilityData("   ", { disabilities: [] })).toEqual([]);
  });

  it("returns empty array for invalid data", async () => {
    const { searchDisabilityData } = await import("../../utils/searchUtils");
    expect(searchDisabilityData("ptsd", null)).toEqual([]);
  });
});
