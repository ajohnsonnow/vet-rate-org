/**
 * D12-5 residual (final12 QA re-review, 2026-09-27): mergeDD214Awards
 * dropped an award silently whenever it had no `name` at all, even one
 * carrying a real `abbreviation` (dd214VisionParser's {name: "", abbreviation}
 * shape, DD214Analyzer.jsx's LLM extraction schema) - awardDisplayName has
 * no abbreviation fallback of its own, so `!awardName` skipped the award
 * entirely instead of merging it under its abbreviation. Fixture values are
 * synthetic, not any real veteran's data.
 */
import { describe, it, expect } from "vitest";
import { initializeVKB, mergeDD214IntoVKB } from "./veteranKnowledgeBase";

describe("mergeDD214Awards: abbreviation-only award shape", () => {
  it("merges an award with an empty name but a real abbreviation, instead of dropping it", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(
      vkb,
      { awards: [{ name: "", abbreviation: "ARCOM", devices: [] }] },
      { fileName: "dd214.pdf" },
    );

    expect(vkb.serviceHistory.awards.map((a) => a.name)).toEqual(["ARCOM"]);
  });

  it("still drops an award with neither a name nor an abbreviation", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(
      vkb,
      { awards: [{ name: "", abbreviation: "", devices: [] }] },
      { fileName: "dd214.pdf" },
    );

    expect(vkb.serviceHistory.awards).toEqual([]);
  });

  it("still prefers the real name over the abbreviation when both are present", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(
      vkb,
      {
        awards: [
          {
            name: "Army Commendation Medal",
            abbreviation: "ARCOM",
            devices: [],
          },
        ],
      },
      { fileName: "dd214.pdf" },
    );

    expect(vkb.serviceHistory.awards.map((a) => a.name)).toEqual([
      "Army Commendation Medal",
    ]);
  });
});
