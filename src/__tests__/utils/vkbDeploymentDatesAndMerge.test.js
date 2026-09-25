/**
 * S46 QA follow-up (2026-09-24):
 *  - item 6: VKB deployments and the evidence timeline stored deployment
 *    dates as MM/DD/YYYY (musterCallProcessor's own internal convention)
 *    instead of ISO YYYY-MM-DD like every other stored date.
 *  - item 3: mergeDD214Deployments' own dedupe keyed on location + exact
 *    startDate, so a later undated mention of an already-dated deployment
 *    was saved as a second, dateless entry instead of merging.
 *
 * final7 QA follow-up (2026-09-24):
 *  - D5: musterCallProcessor's mergeCFileDeploymentsIntoVKB used to call
 *    the full mergeDD214IntoVKB pipeline, which also runs
 *    mergeDD214Documentation and files the C-File itself as a fabricated
 *    DD-214 document - it now calls mergeDD214Deployments directly.
 *  - Probe C: a startDate a couple of days off the one already on file is
 *    the same tour, not a second one (same tolerance isSameServicePeriod
 *    uses).
 *  - Probe D: an unparseable deployment date string is stored as null, not
 *    kept verbatim.
 * Fixture values are synthetic.
 */
import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeDD214IntoVKB,
  mergeDD214Deployments,
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

describe("mergeDD214Deployments: Probe C - a few days' difference is the same tour", () => {
  it("treats a startDate 2 days off the one on file as the same tour, not a second one", () => {
    let vkb = initializeVKB();
    vkb = mergeDD214IntoVKB(
      vkb,
      {
        deployments: [
          { location: "AFGHANISTAN", startDate: "08/08/2004", endDate: null },
        ],
      },
      { fileName: "scan1.pdf" },
    );
    vkb = mergeDD214IntoVKB(
      vkb,
      {
        deployments: [
          { location: "AFGHANISTAN", startDate: "08/10/2004", endDate: null },
        ],
      },
      { fileName: "scan2.pdf" },
    );

    expect(vkb.serviceHistory.deployments).toHaveLength(1);
  });

  it("still records a tour more than a week off as a genuinely different one", () => {
    let vkb = initializeVKB();
    vkb = mergeDD214IntoVKB(
      vkb,
      {
        deployments: [
          { location: "AFGHANISTAN", startDate: "08/08/2004", endDate: null },
        ],
      },
      { fileName: "scan1.pdf" },
    );
    vkb = mergeDD214IntoVKB(
      vkb,
      {
        deployments: [
          { location: "AFGHANISTAN", startDate: "09/01/2004", endDate: null },
        ],
      },
      { fileName: "scan2.pdf" },
    );

    expect(vkb.serviceHistory.deployments).toHaveLength(2);
  });
});

describe("mergeDD214Deployments: Probe D - an unparseable date is stored as null", () => {
  it("stores null instead of the raw string for a deployment date that isn't a real date", () => {
    const vkb = mergeDD214IntoVKB(
      initializeVKB(),
      {
        deployments: [
          {
            location: "GERMANY",
            startDate: "NOT A REAL DATE",
            endDate: null,
          },
        ],
      },
      { fileName: "garbled_scan.pdf" },
    );

    expect(vkb.serviceHistory.deployments[0].startDate).toBeNull();
  });
});

describe("mergeDD214Deployments: D5 - a deployments-only merge never files a document", () => {
  it("does not add a dd214s record or bump documentCount for a deployments-only source", () => {
    const vkb = initializeVKB();
    mergeDD214Deployments(
      vkb,
      {
        deployments: [
          { location: "AFGHANISTAN", startDate: "08/08/2004", endDate: null },
        ],
      },
      { fileName: "cfile.pdf" },
    );

    expect(vkb.serviceHistory.deployments).toHaveLength(1);
    expect(vkb.documentation.dd214s).toHaveLength(0);
    expect(vkb.metadata.documentCount).toBe(0);
  });

  it("contrasts with the full DD214 pipeline, which does file a document", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(
      vkb,
      {
        deployments: [
          { location: "AFGHANISTAN", startDate: "08/08/2004", endDate: null },
        ],
      },
      { fileName: "dd214.pdf" },
    );

    expect(vkb.documentation.dd214s).toHaveLength(1);
    expect(vkb.metadata.documentCount).toBe(1);
  });
});
