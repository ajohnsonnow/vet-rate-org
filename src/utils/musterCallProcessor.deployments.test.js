/**
 * Regressions from Vera's re-verification of the S46 records sprint
 * (2026-09-24, commits 7667c2b5..f7fd8f5a): deployment dates were never
 * parsed even when the OCR text carried a "FROM ... TO ..." range, a
 * designated combat zone like Afghanistan was stored with no combatZone
 * information at all, and nothing extracted ever reached the Service tab's
 * localStorage store. Dates below are synthetic, not the real veteran's
 * actual deployment dates from the audited document.
 *
 * S46 final6 QA (2026-09-24) found the combat-zone flag itself ignored
 * dates and always flagged Sinai - both updated below to the date-aware,
 * sourced-designations-only behavior (COMBAT_ZONE_DESIGNATIONS), and the
 * Service tab dedupe updated for the undated-mention-merges-into-a-dated-
 * entry fix (see _pushDeployment's own comment for why location-only
 * matching had to become location+date-compatible instead).
 */
import { describe, it, expect, beforeEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseServiceRecord, saveDeploymentsToProfile } =
  await import("./musterCallProcessor");
const { getServiceHistory } = await import("./veteranProfile");

const BOX18_AFGHANISTAN = `
1. NAME (Last, First, Middle): DOE, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
18. REMARKS: SERVICE IN AFGHANISTAN FROM 20100112 TO 20100815.
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
`;

describe("parseServiceRecord: deployment date parsing", () => {
  it("parses the FROM/TO date range out of a Box 18 deployment mention", async () => {
    const result = await parseServiceRecord(BOX18_AFGHANISTAN);
    expect(result.error).toBeUndefined();
    expect(result.deployments).toEqual([
      {
        location: "AFGHANISTAN",
        startDate: "01/12/2010",
        endDate: "08/15/2010",
        combatZone: true,
      },
    ]);
  });

  it("still records a bare location mention with no dates when none are present", async () => {
    const result = await parseServiceRecord(
      "18. REMARKS: SERVICE IN GERMANY. NOTHING FOLLOWS",
    );
    expect(result.error).toBeUndefined();
    expect(result.deployments).toEqual([
      {
        location: "GERMANY",
        startDate: null,
        endDate: null,
        combatZone: false,
      },
    ]);
  });
});

describe("parseServiceRecord: designated combat zones are date-aware", () => {
  it.each([
    ["AFGHANISTAN", "20100112", "20100815"], // after EO 13239 (2001-09-19)
    ["IRAQ", "20050301", "20050901"], // after EO 12744 (1991-01-17)
    ["KUWAIT", "19920101", "19920601"], // after EO 12744 (1991-01-17)
  ])(
    "marks a dated %s deployment as combatZone: true",
    async (country, from, to) => {
      const result = await parseServiceRecord(
        `18. REMARKS: SERVICE IN ${country} FROM ${from} TO ${to}.`,
      );
      expect(result.deployments[0].combatZone).toBe(true);
    },
  );

  it("does not flag an undated mention of a designated location - there are no dates to confirm against", async () => {
    const result = await parseServiceRecord(
      "18. REMARKS: SERVICE IN AFGHANISTAN.",
    );
    expect(result.deployments).toEqual([
      {
        location: "AFGHANISTAN",
        startDate: null,
        endDate: null,
        combatZone: false,
      },
    ]);
  });

  it("does not flag Syria - this codebase has no sourced designation start date for it", async () => {
    const result = await parseServiceRecord(
      "18. REMARKS: SERVICE IN SYRIA FROM 20180101 TO 20180601.",
    );
    expect(result.deployments[0].combatZone).toBe(false);
  });

  it("marks a non-combat-zone location as combatZone: false", async () => {
    const result = await parseServiceRecord("18. REMARKS: SERVICE IN GERMANY.");
    expect(result.deployments[0].combatZone).toBe(false);
  });
});

describe("parseServiceRecord: Sinai / MFO", () => {
  it("still records a 'SERVICE IN SINAI' mention as a deployment, but not a combat zone (no sourced designation)", async () => {
    const result = await parseServiceRecord("18. REMARKS: SERVICE IN SINAI.");
    expect(result.deployments).toEqual([
      { location: "SINAI", startDate: null, endDate: null, combatZone: false },
    ]);
  });

  it("normalizes a bare MFO mention to the same Sinai deployment, still not a combat zone", async () => {
    const result = await parseServiceRecord(
      "18. REMARKS: MULTINATIONAL FORCE AND OBSERVERS MFO PEACEKEEPING DUTY.",
    );
    expect(result.deployments).toEqual([
      { location: "SINAI", startDate: null, endDate: null, combatZone: false },
    ]);
  });
});

describe("saveDeploymentsToProfile: wires extracted deployments into the Service tab store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writes a parsed deployment to the store the Service tab's getServiceHistory() reads", () => {
    saveDeploymentsToProfile(
      { name: "test.pdf" },
      {
        extractedData: {
          deployments: [
            {
              location: "AFGHANISTAN",
              startDate: "01/12/2010",
              endDate: "08/15/2010",
              combatZone: true,
            },
          ],
        },
      },
    );
    const saved = getServiceHistory().deployments;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      theater: "Afghanistan",
      location: "Afghanistan",
      startDate: "2010-01-12",
      endDate: "2010-08-15",
      combat: true,
    });
  });

  it("does not duplicate a deployment already saved for the same location and start date", () => {
    const deployment = {
      location: "IRAQ",
      startDate: "03/01/2005",
      endDate: "09/01/2005",
      combatZone: true,
    };
    const result = { extractedData: { deployments: [deployment] } };
    saveDeploymentsToProfile({ name: "test.pdf" }, result);
    saveDeploymentsToProfile({ name: "test.pdf" }, result);
    expect(getServiceHistory().deployments).toHaveLength(1);
  });
});

// S46 QA follow-up, item 3 (2026-09-24): the old dedupe keyed on location +
// exact startDate, so a bare/undated re-mention of an already-dated
// deployment was saved as a second, dateless entry for the same place.
describe("saveDeploymentsToProfile: undated mentions merge into a dated entry", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("merges a later undated mention into an already-dated entry instead of adding a second, dateless one", () => {
    saveDeploymentsToProfile(
      { name: "dd214_p1.pdf" },
      {
        extractedData: {
          deployments: [
            {
              location: "AFGHANISTAN",
              startDate: "08/08/2004",
              endDate: "07/27/2005",
              combatZone: true,
            },
          ],
        },
      },
    );
    // A different scanned copy of the same DD214, or the C-File's repeated
    // copies, that only recovered the bare location.
    saveDeploymentsToProfile(
      { name: "cfile_copy.pdf" },
      {
        extractedData: {
          deployments: [
            { location: "AFGHANISTAN", startDate: null, endDate: null },
          ],
        },
      },
    );

    const saved = getServiceHistory().deployments;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      location: "Afghanistan",
      startDate: "2004-08-08",
      endDate: "2005-07-27",
    });
  });

  it("still records a second, genuinely different tour to the same location", () => {
    saveDeploymentsToProfile(
      { name: "tour1.pdf" },
      {
        extractedData: {
          deployments: [
            {
              location: "AFGHANISTAN",
              startDate: "08/08/2004",
              endDate: "07/27/2005",
              combatZone: true,
            },
          ],
        },
      },
    );
    saveDeploymentsToProfile(
      { name: "tour2.pdf" },
      {
        extractedData: {
          deployments: [
            {
              location: "AFGHANISTAN",
              startDate: "05/15/2006",
              endDate: "06/02/2007",
              combatZone: true,
            },
          ],
        },
      },
    );

    const saved = getServiceHistory().deployments;
    expect(saved).toHaveLength(2);
    expect(saved.map((d) => d.startDate).sort()).toEqual([
      "2004-08-08",
      "2006-05-15",
    ]);
  });
});
