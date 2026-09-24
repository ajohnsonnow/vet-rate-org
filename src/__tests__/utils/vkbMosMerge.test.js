/**
 * MOS entries accumulate across every DD214/NGB22 page a veteran uploads.
 * Re-uploading the same page (or a later page that repeats Block 14) must
 * not duplicate the MOS list, and a Reserve/Guard record's additionalMOS
 * array merges the same way as the primary MOS.
 */
import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeDD214IntoVKB,
} from "../../utils/veteranKnowledgeBase";

describe("VKB MOS merge", () => {
  it("adds a new MOS entry from Block 14", () => {
    const vkb = mergeDD214IntoVKB(initializeVKB(), {
      mos: "11B",
      mosTitle: "Infantryman",
      entryDate: "2010-01-01",
      separationDate: "2014-01-01",
    });
    expect(vkb.serviceHistory.mos).toEqual([
      {
        code: "11B",
        title: "Infantryman",
        dates: { start: "2010-01-01", end: "2014-01-01" },
        hazards: [],
      },
    ]);
  });

  it("does not duplicate the same MOS code across a second uploaded page", () => {
    let vkb = mergeDD214IntoVKB(initializeVKB(), {
      mos: "11B",
      mosTitle: "Infantryman",
    });
    vkb = mergeDD214IntoVKB(vkb, {
      mos: "11B",
      mosTitle: "Infantryman",
    });
    expect(vkb.serviceHistory.mos).toHaveLength(1);
  });

  it("falls back to primaryMOS/primaryMOSTitle when mos/mosTitle are absent", () => {
    const vkb = mergeDD214IntoVKB(initializeVKB(), {
      primaryMOS: "68W",
      primaryMOSTitle: "Combat Medic Specialist",
    });
    expect(vkb.serviceHistory.mos[0]).toMatchObject({
      code: "68W",
      title: "Combat Medic Specialist",
    });
  });

  it("merges additionalMOS entries and skips ones already recorded", () => {
    const vkb = mergeDD214IntoVKB(initializeVKB(), {
      mos: "11B",
      additionalMOS: [{ code: "13B", title: "Cannon Crewmember" }, "11B"],
    });
    expect(vkb.serviceHistory.mos.map((m) => m.code)).toEqual(["11B", "13B"]);
  });

  it("ignores an entry with no MOS code at all", () => {
    const vkb = mergeDD214IntoVKB(initializeVKB(), {
      branch: "Army",
    });
    expect(vkb.serviceHistory.mos).toEqual([]);
  });
});
