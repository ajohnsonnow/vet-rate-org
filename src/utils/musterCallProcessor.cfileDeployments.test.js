/**
 * S46 QA follow-up, item 1 (2026-09-24): nothing read deployments from
 * the C-File path - only a directly-uploaded single DD214/NGB22 ever
 * populated extractedData.deployments, even though a real C-File holds
 * several scanned copies of the same DD214/NGB-22 (with garbled Box 18
 * remarks on some copies) and VA's own rating-decision/DBQ restatements
 * of the same dates. All names/dates below are synthetic fixtures, not
 * the real audited veteran's data.
 */
import { describe, it, expect } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { buildSegmentedCFileResult } = await import("./musterCallProcessor");
const { quickScanCFile } = await import("./cFileSegmentation");

const filler = (label) =>
  `${label} continuation text. `.repeat(20) +
  "Additional narrative body so the segment clears the 200-character minimum length filter applied by _burstIntoSegments and sits well clear of the next document boundary.";

const dd214Block = (label, box18) => `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME: DOE, JOHN ROBERT
18. REMARKS: ${box18}
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
${filler(label)}
`;

async function runCFile(text) {
  const summary = quickScanCFile(text);
  return buildSegmentedCFileResult(text, summary);
}

describe("buildSegmentedCFileResult: DD214-segment deployment extraction", () => {
  it("finds a clean FROM/TO deployment from a DD214-signature segment", async () => {
    const text = [
      dd214Block(
        "Tour",
        "SERVICE IN AFGHANISTAN FROM 20040808 TO 20050727. NOTHING FOLLOWS",
      ),
      filler("Trailing padding"),
    ].join("\n\n");
    const result = await runCFile(text);
    expect(result.deployments).toEqual([
      {
        location: "AFGHANISTAN",
        startDate: "08/08/2004",
        endDate: "07/27/2005",
        combatZone: true,
      },
    ]);
  });

  it("de-dupes repeated copies of the same DD214 into one entry, not one per scanned copy", async () => {
    const box18 =
      "SERVICE IN AFGHANISTAN FROM 20040808 TO 20050727. NOTHING FOLLOWS";
    const text = [
      dd214Block("Copy A", box18),
      dd214Block("Copy B", box18),
      dd214Block("Copy C", box18),
    ].join("\n\n");
    const result = await runCFile(text);
    expect(result.deployments).toHaveLength(1);
    expect(result.deployments[0]).toMatchObject({
      location: "AFGHANISTAN",
      startDate: "08/08/2004",
      endDate: "07/27/2005",
    });
  });

  it("keeps two genuinely different tours to the same country separate", async () => {
    const text = [
      dd214Block(
        "First tour",
        "SERVICE IN AFGHANISTAN FROM 20040808 TO 20050727. NOTHING FOLLOWS",
      ),
      dd214Block(
        "Second tour",
        "SOLDIER SERVED IN A DESIGNATED IMMINENT DANGER PAY AREA. AFGHANISTAN 20060515-20070602. NOTHING FOLLOWS",
      ),
    ].join("\n\n");
    const result = await runCFile(text);
    const afghanistan = result.deployments.filter(
      (d) => d.location === "AFGHANISTAN",
    );
    expect(afghanistan).toHaveLength(2);
    expect(afghanistan.map((d) => d.startDate).sort()).toEqual([
      "05/15/2006",
      "08/08/2004",
    ]);
    expect(afghanistan.map((d) => d.endDate).sort()).toEqual([
      "06/02/2007",
      "07/27/2005",
    ]);
  });

  it("records a bare, undated Sinai mention when Box 18 never states a date range", async () => {
    const text = dd214Block(
      "Sinai period",
      "SOLDIER SERVED IN SINAI//NOTHING FOLLOWS",
    );
    const result = await runCFile(text);
    expect(result.deployments).toEqual([
      { location: "SINAI", startDate: null, endDate: null, combatZone: false },
    ]);
  });
});

describe("buildSegmentedCFileResult: does not fabricate a deployment from an award alone", () => {
  it("does not create a deployment from an award alone (MFO medal, no deployment narrative in Box 18)", async () => {
    const text = `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME: DOE, JOHN ROBERT
13. DECORATIONS: ARMY ACHIEVEMENT MEDAL//MULTINATIONAL FORCE AND OBSERVERS MEDAL//NOTHING FOLLOWS
18. REMARKS: MEMBER COMPLETED REQUIRED ACTIVE SERVICE. NOTHING FOLLOWS
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
${filler("Award only")}
`;
    const result = await runCFile(text);
    expect(result.deployments).toEqual([]);
  });
});

describe("buildSegmentedCFileResult: rating-decision/DBQ evidence-segment deployment extraction", () => {
  it("recovers a tour's dates from a rating decision/DBQ's own VA-authored restatement when the DD214's own Box 18 has no isolatable remarks section", async () => {
    const text = `
DISABILITY BENEFITS QUESTIONNAIRE
PERTINENT RECORDS INCLUDE:
DD Form 214 ARMY/ARNGUS 02/16/2006 - 06/29/2007; Service in Afghanistan 05/15/2006-06/02/2007.
${filler("DBQ evidence summary")}
`;
    const result = await runCFile(text);
    expect(result.deployments).toContainEqual({
      location: "AFGHANISTAN",
      startDate: "05/15/2006",
      endDate: "06/02/2007",
      combatZone: true,
    });
  });

  it("never reads a rating decision's generic PACT Act eligibility paragraph as this veteran's own deployment", async () => {
    const text = `
RATING DECISION
Combined evaluation: 70 percent.
Environmental exposure can be described as Veterans who were deployed to the Persian Gulf, Kuwait and other dusty environments were often exposed to sand, dust, and pollution during their service.
${filler("Generic PACT Act eligibility boilerplate")}
`;
    const result = await runCFile(text);
    expect(result.deployments).toEqual([]);
  });
});
