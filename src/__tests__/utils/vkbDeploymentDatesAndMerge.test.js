/**
 * S46 QA follow-up (2026-09-24):
 *  - item 6: VKB deployments and the evidence timeline stored deployment
 *    dates as MM/DD/YYYY (musterCallProcessor's own internal convention)
 *    instead of ISO YYYY-MM-DD like every other stored date.
 *  - item 3: mergeDD214Deployments' own dedupe keyed on location + exact
 *    startDate, so a later undated mention of an already-dated deployment
 *    was saved as a second, dateless entry instead of merging.
 * Fixture values are synthetic.
 */
import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeDD214IntoVKB,
} from "../../utils/veteranKnowledgeBase";

describe("mergeDD214Deployments: ISO date storage", () => {
  it("stores VKB deployment dates as ISO YYYY-MM-DD, not MM/DD/YYYY", () => {
    const vkb = mergeDD214IntoVKB(
      initializeVKB(),
      {
        deployments: [
          {
            location: "AFGHANISTAN",
            startDate: "08/08/2004",
            endDate: "07/27/2005",
            combatZone: true,
          },
        ],
      },
      { fileName: "dd214.pdf" },
    );
    expect(vkb.serviceHistory.deployments[0]).toMatchObject({
      startDate: "2004-08-08",
      endDate: "2005-07-27",
    });
  });

  it("stores the deployment's evidence-timeline entry date as ISO too", () => {
    const vkb = mergeDD214IntoVKB(
      initializeVKB(),
      {
        deployments: [
          {
            location: "AFGHANISTAN",
            startDate: "08/08/2004",
            endDate: "07/27/2005",
            combatZone: true,
          },
        ],
      },
      { fileName: "dd214.pdf" },
    );
    const entry = vkb.evidenceTimeline.find(
      (e) => e.eventType === "deployment",
    );
    expect(entry.date).toBe("2004-08-08");
  });
});

describe("mergeDD214Deployments: undated mention merges into a dated entry", () => {
  it("does not duplicate an already-dated deployment when a later mention has no date", () => {
    let vkb = initializeVKB();
    vkb = mergeDD214IntoVKB(
      vkb,
      {
        deployments: [
          {
            location: "AFGHANISTAN",
            startDate: "08/08/2004",
            endDate: "07/27/2005",
            combatZone: true,
          },
        ],
      },
      { fileName: "dd214_p1.pdf" },
    );
    vkb = mergeDD214IntoVKB(
      vkb,
      {
        deployments: [
          { location: "AFGHANISTAN", startDate: null, endDate: null },
        ],
      },
      { fileName: "cfile_copy.pdf" },
    );

    expect(vkb.serviceHistory.deployments).toHaveLength(1);
    expect(vkb.serviceHistory.deployments[0]).toMatchObject({
      startDate: "2004-08-08",
      endDate: "2005-07-27",
    });
  });

  it("still records a second, genuinely different tour to the same location", () => {
    let vkb = initializeVKB();
    vkb = mergeDD214IntoVKB(
      vkb,
      {
        deployments: [
          {
            location: "AFGHANISTAN",
            startDate: "08/08/2004",
            endDate: "07/27/2005",
            combatZone: true,
          },
        ],
      },
      { fileName: "tour1.pdf" },
    );
    vkb = mergeDD214IntoVKB(
      vkb,
      {
        deployments: [
          {
            location: "AFGHANISTAN",
            startDate: "05/15/2006",
            endDate: "06/02/2007",
            combatZone: true,
          },
        ],
      },
      { fileName: "tour2.pdf" },
    );

    expect(vkb.serviceHistory.deployments).toHaveLength(2);
    expect(
      vkb.serviceHistory.deployments.map((d) => d.startDate).sort(),
    ).toEqual(["2004-08-08", "2006-05-15"]);
  });
});
