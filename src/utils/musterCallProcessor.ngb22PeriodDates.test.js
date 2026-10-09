/**
 * Characterization coverage for _extractNGB22PeriodDates, added while
 * splitting it up to satisfy sonarjs/cognitive-complexity. No existing
 * test exercised the Box 18 IADT/AD activation-period breakdown despite
 * the component-inheritance/reset rules being genuinely subtle (see the
 * comment above the function in musterCallProcessor.js).
 */
import { describe, it, expect } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseServiceRecord } = await import("./musterCallProcessor");

describe("parseServiceRecord (NGB22): Box 18 activation-period breakdown", () => {
  it("labels each segment by its own IADT/AD prefix, inherits across bare continuations, and treats an unrecognized label as unknown (not inherited)", async () => {
    const box18 =
      "IADT: 20100601-20100815//" +
      "AD: 20150101-20151231//" +
      "20160101-20160630//" + // bare continuation -> inherits "Active Duty"
      "1ADT: 20170101-20170228//" + // OCR-garbled "IADT" (digit-for-letter)
      "BOGUS: 20180101-20180201"; // unrecognized label -> component null

    const text = `18. REMARKS: ${box18} 19a. MAILING ADDRESS: NONE`;
    const result = await parseServiceRecord(text, "NGB22");

    expect(result.additionalPeriods).toEqual([
      {
        component: "IADT",
        serviceStartDate: "06/01/2010",
        serviceEndDate: "08/15/2010",
      },
      {
        component: "Active Duty",
        serviceStartDate: "01/01/2015",
        serviceEndDate: "12/31/2015",
      },
      {
        component: "Active Duty",
        serviceStartDate: "01/01/2016",
        serviceEndDate: "06/30/2016",
      },
      {
        component: "IADT",
        serviceStartDate: "01/01/2017",
        serviceEndDate: "02/28/2017",
      },
      {
        component: null,
        serviceStartDate: "01/01/2018",
        serviceEndDate: "02/01/2018",
      },
    ]);
  });

  it("skips a segment that doesn't match the date-range shape without throwing", async () => {
    const text =
      "18. REMARKS: AD: 20150101-20151231//NOTES: some free text 19a. MAILING ADDRESS: NONE";
    const result = await parseServiceRecord(text, "NGB22");

    expect(result.additionalPeriods).toEqual([
      {
        component: "Active Duty",
        serviceStartDate: "01/01/2015",
        serviceEndDate: "12/31/2015",
      },
    ]);
  });

  it("does not populate additionalPeriods for a non-NGB22 form", async () => {
    const text =
      "18. REMARKS: AD: 20150101-20151231 19a. MAILING ADDRESS: NONE";
    const result = await parseServiceRecord(text, "DD214");

    expect(result.additionalPeriods).toEqual([]);
  });
});
