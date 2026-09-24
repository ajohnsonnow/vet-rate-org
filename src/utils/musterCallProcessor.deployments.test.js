/**
 * Regressions from Vera's re-verification of the S46 records sprint
 * (2026-09-24, commits 7667c2b5..f7fd8f5a): deployment dates were never
 * parsed even when the OCR text carried a "FROM ... TO ..." range, a
 * designated combat zone like Afghanistan was stored with no combatZone
 * information at all, and nothing extracted ever reached the Service tab's
 * localStorage store. Dates below are synthetic, not the real veteran's
 * actual deployment dates from the audited document.
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

describe("parseServiceRecord: designated combat zones", () => {
  it.each([["AFGHANISTAN"], ["IRAQ"], ["KUWAIT"], ["SYRIA"]])(
    "marks %s as combatZone: true",
    async (country) => {
      const result = await parseServiceRecord(
        `18. REMARKS: SERVICE IN ${country}.`,
      );
      expect(result.deployments[0].combatZone).toBe(true);
    },
  );

  it("marks a non-combat-zone location as combatZone: false", async () => {
    const result = await parseServiceRecord("18. REMARKS: SERVICE IN GERMANY.");
    expect(result.deployments[0].combatZone).toBe(false);
  });
});

describe("parseServiceRecord: Sinai / MFO", () => {
  it("records a 'SERVICE IN SINAI' mention as a Sinai combat-zone deployment", async () => {
    const result = await parseServiceRecord("18. REMARKS: SERVICE IN SINAI.");
    expect(result.deployments).toEqual([
      { location: "SINAI", startDate: null, endDate: null, combatZone: true },
    ]);
  });

  it("normalizes a bare MFO mention to the same Sinai deployment", async () => {
    const result = await parseServiceRecord(
      "18. REMARKS: MULTINATIONAL FORCE AND OBSERVERS MFO PEACEKEEPING DUTY.",
    );
    expect(result.deployments).toEqual([
      { location: "SINAI", startDate: null, endDate: null, combatZone: true },
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
