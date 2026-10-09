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
  mergeDD214EvidenceTimeline,
} from "../../utils/veteranKnowledgeBase";

describe("mergeDD214Deployments: ISO date storage", () => {
  it("stores VKB deployment dates as ISO YYYY-MM-DD, not MM/DD/YYYY", () => {
    const vkb = mergeDD214IntoVKB(
      initializeVKB(),
      {
        deployments: [
          {
            location: "AFGHANISTAN",
            startDate: "07/26/2008",
            endDate: "05/22/2009",
            combatZone: true,
          },
        ],
      },
      { fileName: "dd214.pdf" },
    );
    expect(vkb.serviceHistory.deployments[0]).toMatchObject({
      startDate: "2008-07-26",
      endDate: "2009-05-22",
    });
  });

  it("stores the deployment's evidence-timeline entry date as ISO too", () => {
    const vkb = mergeDD214IntoVKB(
      initializeVKB(),
      {
        deployments: [
          {
            location: "AFGHANISTAN",
            startDate: "07/26/2008",
            endDate: "05/22/2009",
            combatZone: true,
          },
        ],
      },
      { fileName: "dd214.pdf" },
    );
    const entry = vkb.evidenceTimeline.find(
      (e) => e.eventType === "deployment",
    );
    expect(entry.date).toBe("2008-07-26");
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
            startDate: "07/26/2008",
            endDate: "05/22/2009",
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
      startDate: "2008-07-26",
      endDate: "2009-05-22",
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
            startDate: "07/26/2008",
            endDate: "05/22/2009",
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
            startDate: "02/28/2010",
            endDate: "03/08/2011",
            combatZone: true,
          },
        ],
      },
      { fileName: "tour2.pdf" },
    );

    expect(vkb.serviceHistory.deployments).toHaveLength(2);
    expect(
      vkb.serviceHistory.deployments.map((d) => d.startDate).sort(),
    ).toEqual(["2008-07-26", "2010-02-28"]);
  });
});

describe("mergeDD214Deployments: Probe C - a few days' difference is the same tour", () => {
  it("treats a startDate 2 days off the one on file as the same tour, not a second one", () => {
    let vkb = initializeVKB();
    vkb = mergeDD214IntoVKB(
      vkb,
      {
        deployments: [
          { location: "AFGHANISTAN", startDate: "07/26/2008", endDate: null },
        ],
      },
      { fileName: "scan1.pdf" },
    );
    vkb = mergeDD214IntoVKB(
      vkb,
      {
        deployments: [
          { location: "AFGHANISTAN", startDate: "07/28/2008", endDate: null },
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
          { location: "AFGHANISTAN", startDate: "07/26/2008", endDate: null },
        ],
      },
      { fileName: "scan1.pdf" },
    );
    vkb = mergeDD214IntoVKB(
      vkb,
      {
        deployments: [
          { location: "AFGHANISTAN", startDate: "09/01/2008", endDate: null },
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
          { location: "AFGHANISTAN", startDate: "07/26/2008", endDate: null },
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
          { location: "AFGHANISTAN", startDate: "07/26/2008", endDate: null },
        ],
      },
      { fileName: "dd214.pdf" },
    );

    expect(vkb.documentation.dd214s).toHaveLength(1);
    expect(vkb.metadata.documentCount).toBe(1);
  });
});

// N2 (final8 QA, 2026-09-24): mergeCFileDeploymentsIntoVKB only ever ran
// mergeDD214Deployments, so a C-File-only second tour reached
// vkb.serviceHistory.deployments but never the Evidence Timeline. It now
// also runs mergeDD214EvidenceTimeline - exercised directly here (both are
// pure functions; mergeCFileDeploymentsIntoVKB itself is IndexedDB-backed
// and not unit-testable in this environment, same gap already documented
// for addDocumentToVKB in vkbDd214DocumentDedup.test.js) - without
// registering a DD214 document, so the double-filing bug D5 already fixed
// doesn't come back.
describe("N2: a deployments-only merge also reaches the Evidence Timeline", () => {
  it("adds a deployment entry to the Evidence Timeline without filing a DD-214 document", () => {
    const vkb = initializeVKB();
    const dd214Data = {
      deployments: [
        { location: "AFGHANISTAN", startDate: "07/26/2008", endDate: null },
      ],
    };
    mergeDD214Deployments(vkb, dd214Data, { fileName: "cfile.pdf" });
    mergeDD214EvidenceTimeline(vkb, dd214Data, { fileName: "cfile.pdf" });

    const entry = vkb.evidenceTimeline.find(
      (e) => e.eventType === "deployment",
    );
    expect(entry).toBeDefined();
    expect(entry.date).toBe("2008-07-26");
    expect(vkb.documentation.dd214s).toHaveLength(0);
    expect(vkb.metadata.documentCount).toBe(0);
  });
});

// N6 (final8 QA, 2026-09-24): the combat flag used to only ever be OR'd
// true on push and never touched again on a later match - a stale value
// (set before the designation table existed, or for a location later
// found to have no sourced designation) persisted forever. It's now
// recomputed from the resolved date on every merge, sharing the same
// date-aware rule musterCallProcessor's own saveDeploymentsToProfile uses
// (dateUtils.isDesignatedCombatZone).
describe("N6: combatZone is recomputed (not just OR'd) on every merge", () => {
  it("corrects a stale true when the resolved date is actually before the designation", () => {
    const vkb = initializeVKB();
    vkb.serviceHistory.deployments.push({
      location: "AFGHANISTAN",
      startDate: "1996-01-01",
      endDate: null,
      combatZone: true,
      operation: "",
      source: "old_scan.pdf",
    });
    mergeDD214Deployments(
      vkb,
      {
        deployments: [
          { location: "AFGHANISTAN", startDate: "1996-01-01", endDate: null },
        ],
      },
      { fileName: "rescan.pdf" },
    );

    expect(vkb.serviceHistory.deployments[0].combatZone).toBe(false);
  });

  it("corrects a stale false once a real start date proves the designation applies", () => {
    const vkb = initializeVKB();
    vkb.serviceHistory.deployments.push({
      location: "AFGHANISTAN",
      startDate: null,
      endDate: null,
      combatZone: false,
      operation: "",
      source: "first_pass.pdf",
    });
    mergeDD214Deployments(
      vkb,
      {
        deployments: [
          { location: "AFGHANISTAN", startDate: "07/26/2008", endDate: null },
        ],
      },
      { fileName: "second_pass.pdf" },
    );

    expect(vkb.serviceHistory.deployments[0].combatZone).toBe(true);
  });
});

// N7 (final8 QA, 2026-09-24): the VKB's own _toIsoDate shared the same gap
// as musterCallProcessor's _toISODateString - "SINAI 12" parsed as a real,
// wrong date via Date.parse's leniency instead of failing.
describe("N7: an unparseable-looking deployment date is stored as null, not guessed", () => {
  it.each([["SINAI 12"], ["SINAI 2004"], ["NGB FORM 2022"]])(
    "stores null for %s instead of a fabricated date",
    (value) => {
      const vkb = mergeDD214IntoVKB(
        initializeVKB(),
        {
          deployments: [{ location: "SINAI", startDate: value, endDate: null }],
        },
        { fileName: "garbled_scan.pdf" },
      );
      expect(vkb.serviceHistory.deployments[0].startDate).toBeNull();
    },
  );
});
