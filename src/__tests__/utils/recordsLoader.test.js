/**
 * WS-7: VKB/claims → calculator bridge.
 * buildConditionCandidates is the pure core behind "Load from My Records" —
 * it must dedup across sources, exclude what's already in My Ratings, and
 * never emit an unusable rating.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeConditionName,
  buildConditionCandidates,
} from "../../utils/veteranContextProvider";

describe("normalizeConditionName", () => {
  it("collapses case, parentheticals, punctuation and whitespace", () => {
    expect(normalizeConditionName("Tinnitus (Service Connected)")).toBe(
      "tinnitus",
    );
    expect(normalizeConditionName("  TINNITUS.  ")).toBe("tinnitus");
    expect(
      normalizeConditionName("Post-Traumatic Stress Disorder (PTSD)"),
    ).toBe("post traumatic stress disorder");
  });

  it("returns empty string for non-strings", () => {
    expect(normalizeConditionName(null)).toBe("");
    expect(normalizeConditionName(42)).toBe("");
  });
});

describe("buildConditionCandidates", () => {
  const claims = [
    {
      conditionName: "Post-Traumatic Stress Disorder (PTSD)",
      selectedRating: 50,
    },
    { conditionName: "Tinnitus", selectedRating: 10 },
    { conditionName: "Lumbosacral Strain", ratingPercent: 20 },
  ];

  it("maps claims to calculator-shaped conditions", () => {
    const out = buildConditionCandidates({ claims });
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ rating: 50, side: "none" });
    expect(out[0].name).toContain("PTSD");
  });

  it("excludes conditions already in My Ratings (normalized match)", () => {
    const out = buildConditionCandidates({
      excludeNames: ["TINNITUS (bilateral)"],
      claims,
    });
    expect(out.map((c) => c.name)).not.toContain("Tinnitus");
    expect(out).toHaveLength(2);
  });

  it("dedups across claims and VKB analyzer output", () => {
    const out = buildConditionCandidates({
      claims,
      vkbClaims: [
        { condition: "tinnitus", rating: 10 },
        { condition: "Pes Planus", rating: 10 },
      ],
    });
    expect(out.filter((c) => /tinnitus/i.test(c.name))).toHaveLength(1);
    expect(out.map((c) => c.name)).toContain("Pes Planus");
  });

  it("drops unusable ratings instead of guessing", () => {
    const out = buildConditionCandidates({
      claims: [
        { conditionName: "No Rating Yet" },
        { conditionName: "Out of Range", selectedRating: 150 },
        { conditionName: "Stringy", selectedRating: "50" },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "Stringy", rating: 50 });
  });

  it("handles empty input", () => {
    expect(buildConditionCandidates()).toEqual([]);
  });
});
