/**
 * S46 QA follow-up, item 5 (2026-09-24): two gaps in how musterCallProcessor
 * writes service periods -
 *  - the NGB-22 Box 18 activation-breakdown periods (_saveNGB22AdditionalPeriods)
 *    never carried the DD214's own rank, so every AD/IADT period showed no
 *    rank at all;
 *  - a code sheet upserting onto an already-NGB22-sourced period left that
 *    period's stale formType: "NGB22" in place, so VA's own authoritative
 *    record was mislabeled "(NGB22)" in the UI.
 * Fixture values are synthetic.
 */
import { describe, it, expect, beforeEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const {
  parseServiceRecord,
  saveServiceRecordToProfile,
  saveCodeSheetServicePeriodsToProfile,
} = await import("./musterCallProcessor");
const { getServicePeriods, getUnmatchedServiceRecords } =
  await import("./veteranProfile");

const REALISTIC_NGB22 = `
1. NAME (Last, First, Middle): DOE, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
4a. GRADE, RATE OR RANK: SGT
4b. PAY GRADE: E-5
5. DATE OF BIRTH: 01/15/1980
7a. PLACE OF ENTRY: PORTLAND OR
11. PRIMARY SPECIALTY: 92Y UNIT SUPPLY SPECIALIST
12a. DATE ENTERED AD THIS PERIOD: 06/22/2004
12b. DATE OF SEPARATION: 08/27/2005
13. DECORATIONS, MEDALS, BADGES: ARMY ACHIEVEMENT MEDAL
14. MILITARY EDUCATION: PRIMARY LEADERSHIP DEVELOPMENT COURSE
18. REMARKS: IADT: 20040101-20040301//AD: 20040622-20050827//NOTHING FOLLOWS
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
25. SEPARATION AUTHORITY: AR 635-200
26. SEPARATION CODE: MBK
27. REENTRY CODE: RE-1
28. NARRATIVE REASON: COMPLETION OF REQUIRED ACTIVE SERVICE
`;

describe("saveServiceRecordToProfile: NGB-22 additional-period rank attachment", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("attaches the DD214's rank to the AD period matching its own separation date, not the earlier IADT period", async () => {
    const extractedData = await parseServiceRecord(REALISTIC_NGB22, "NGB22");
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });

    const periods = getServicePeriods();
    const ad = periods.find(
      (p) =>
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27",
    );
    const iadt = periods.find(
      (p) =>
        p.serviceStartDate === "2004-01-01" &&
        p.serviceEndDate === "2004-03-01",
    );

    expect(ad).toBeDefined();
    expect(ad.rank).toBe("SGT");
    expect(iadt).toBeDefined();
    expect(iadt.rank).toBe("");
  });
});

// D-2 (final7 QA, 2026-09-24): candidate.separationDate (Box 12b) isn't
// always extracted from an NGB-22 - when it's missing, the original
// condition (periodEndDate === separationDate) could never match ANY
// additional period, so the rank never attached even when exactly one
// Active Duty period unambiguously deserved it.
const NGB22_NO_SEPARATION_DATE = `
1. NAME (Last, First, Middle): DOE, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
4a. GRADE, RATE OR RANK: SGT
4b. PAY GRADE: E-5
7a. PLACE OF ENTRY: PORTLAND OR
18. REMARKS: IADT: 20040101-20040301//AD: 20040622-20050827//NOTHING FOLLOWS
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
25. SEPARATION AUTHORITY: AR 635-200
26. SEPARATION CODE: MBK
27. REENTRY CODE: RE-1
28. NARRATIVE REASON: COMPLETION OF REQUIRED ACTIVE SERVICE
`;

describe("saveServiceRecordToProfile: NGB-22 rank attachment without a Box 12b date", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("still attaches rank to the sole Active Duty period when the document's own separation date wasn't extracted", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_NO_SEPARATION_DATE,
      "NGB22",
    );
    expect(extractedData.serviceEndDate).toBeFalsy();
    saveServiceRecordToProfile({ name: "ngb22_no_sep.pdf" }, { extractedData });

    const periods = getServicePeriods();
    const ad = periods.find(
      (p) =>
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27",
    );
    const iadt = periods.find(
      (p) =>
        p.serviceStartDate === "2004-01-01" &&
        p.serviceEndDate === "2004-03-01",
    );

    expect(ad).toBeDefined();
    expect(ad.rank).toBe("SGT");
    expect(iadt).toBeDefined();
    expect(iadt.rank).toBe("");
  });
});

// Observation 1 (final10 QA, 2026-09-25): the terminal-AD rank rule
// stopped matching once the NGB-22 gained a separation date that does NOT
// equal the terminal AD window's own end date - a real scenario for a
// Guard member whose overall discharge (Box 12b, the Guard's own final
// separation) post-dates their last individual activation by years of
// ordinary drilling. Same REMARKS windows as REALISTIC_NGB22 above; only
// Box 12b's date changes to one that post-dates the AD window's own end.
const NGB22_SEPARATION_DATE_AFTER_LAST_AD_WINDOW = `
1. NAME (Last, First, Middle): DOE, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
4a. GRADE, RATE OR RANK: SGT
4b. PAY GRADE: E-5
5. DATE OF BIRTH: 01/15/1980
7a. PLACE OF ENTRY: PORTLAND OR
11. PRIMARY SPECIALTY: 92Y UNIT SUPPLY SPECIALIST
12a. DATE ENTERED AD THIS PERIOD: 06/22/2004
12b. DATE OF SEPARATION: 08/27/2007
13. DECORATIONS, MEDALS, BADGES: ARMY ACHIEVEMENT MEDAL
14. MILITARY EDUCATION: PRIMARY LEADERSHIP DEVELOPMENT COURSE
18. REMARKS: IADT: 20040101-20040301//AD: 20040622-20050827//NOTHING FOLLOWS
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
25. SEPARATION AUTHORITY: AR 635-200
26. SEPARATION CODE: MBK
27. REENTRY CODE: RE-1
28. NARRATIVE REASON: COMPLETION OF REQUIRED ACTIVE SERVICE
`;

describe("Observation 1: NGB-22 rank attachment when the separation date post-dates the terminal AD window", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("still attaches rank to the document's own latest AD window, not just an exact separationDate match", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_SEPARATION_DATE_AFTER_LAST_AD_WINDOW,
      "NGB22",
    );
    expect(extractedData.serviceEndDate).toBe("08/27/2007");
    saveServiceRecordToProfile(
      { name: "ngb22_late_separation.pdf" },
      { extractedData },
    );

    const periods = getServicePeriods();
    const ad = periods.find(
      (p) =>
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27",
    );
    const iadt = periods.find(
      (p) =>
        p.serviceStartDate === "2004-01-01" &&
        p.serviceEndDate === "2004-03-01",
    );

    expect(ad).toBeDefined();
    expect(ad.rank).toBe("SGT");
    expect(iadt).toBeDefined();
    expect(iadt.rank).toBe("");
  });
});

describe("saveCodeSheetServicePeriodsToProfile: labels its own source correctly", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("relabels an NGB-22-sourced period as Code Sheet once VA's own record confirms it, instead of keeping the stale NGB22 label", async () => {
    const extractedData = await parseServiceRecord(REALISTIC_NGB22, "NGB22");
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });
    expect(
      getServicePeriods().find((p) => p.serviceStartDate === "2004-06-22")
        .formType,
    ).toBe("NGB22");

    saveCodeSheetServicePeriodsToProfile(
      { name: "cfile_codesheet.pdf" },
      {
        extractedData: {
          ratingSource: "code_sheet",
          servicePeriods: [
            {
              entryDate: "2004-06-22",
              separationDate: "2005-08-27",
              branch: "Army",
              characterOfDischarge: "Honorable",
            },
          ],
        },
      },
    );

    const period = getServicePeriods().find(
      (p) => p.serviceStartDate === "2004-06-22",
    );
    expect(period.formType).toBe("Code Sheet");
    expect(period.characterOfService).toBe("Honorable");
  });
});

// N9c (final9 QA, 2026-09-25): a real NGB-22 never carries a DD-214-style
// Box 12a/12b "date entered"/"separation date" pair - only Item 8's own
// separation date and Item 10's "NET SERVICE THIS PERIOD" duration, which
// that separation date counts back from. Fixture values are synthetic.
const NGB22_WITH_NET_SERVICE = `
1. LAST NAME - FIRST NAME - MIDDLE NAME    2. DEPARTMENT, COMPONENT AND BRANCH
SAMPLE JORDAN TAYLOR                        ARNGUS/CAARNG

5a. RANK
SSG

8a. STATION OR INSTALLATION AT WHICH EFFECTED   YR MO DA
HHC 1-100 IN, ANYTOWN, ST 00000                 DATE 2010 | 06 | 15

9. COMMAND TO WHICH TRANSFERRED    10. RECORD OF SERVICE   YRS MOS DAYS
(a) NET SERVICE THIS PERIOD   08 | 03 | 10

18. REMARKS: IADT: 20030601-20031015//AD: 20090101-20091231//NOTHING FOLLOWS

24. CHARACTER OF SERVICE
HONORABLE
`;

const NGB22_WITHOUT_NET_SERVICE = `
1. LAST NAME - FIRST NAME - MIDDLE NAME    2. DEPARTMENT, COMPONENT AND BRANCH
SAMPLE JORDAN TAYLOR                        ARNGUS/CAARNG

5a. RANK
SSG

8a. STATION OR INSTALLATION AT WHICH EFFECTED   YR MO DA
HHC 1-100 IN, ANYTOWN, ST 00000                 DATE 2010 | 06 | 15

18. REMARKS: IADT: 20030601-20031015//AD: 20090101-20091231//NOTHING FOLLOWS

24. CHARACTER OF SERVICE
HONORABLE
`;

describe("N9c: NGB-22 primary period dates derived from Item 8 + Item 10", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("derives the entry date by counting NET SERVICE THIS PERIOD back from the separation date", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_WITH_NET_SERVICE,
      "NGB22",
    );

    expect(extractedData.serviceStartDate).toBe("2002-03-05");
    expect(extractedData.serviceEndDate).toBe("2010-06-15");
    expect(extractedData.serviceStartDateDerived).toBe(true);
  });

  it("saves the derived dates as their own enlistment-level period, distinct from the Box 18 sub-periods", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_WITH_NET_SERVICE,
      "NGB22",
    );
    saveServiceRecordToProfile(
      { name: "ngb22_net_service.pdf" },
      { extractedData },
    );

    const periods = getServicePeriods();
    // 1 enlistment-level period + 2 Box 18 sub-periods (IADT + AD) = 3
    expect(periods).toHaveLength(3);
    const enlistment = periods.find((p) => p.serviceStartDate === "2002-03-05");
    expect(enlistment).toBeDefined();
    expect(enlistment.serviceEndDate).toBe("2010-06-15");
    expect(enlistment.periodScope).not.toBe("window");
    expect(enlistment.serviceStartDateDerived).toBe(true);
    expect(getUnmatchedServiceRecords()).toHaveLength(0);
  });

  it("never guesses the entry date when NET SERVICE THIS PERIOD is missing", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_WITHOUT_NET_SERVICE,
      "NGB22",
    );

    expect(extractedData.serviceStartDate).toBeFalsy();
    expect(extractedData.serviceEndDate).toBeFalsy();
  });
});

// D-E (final10 QA, 2026-09-25): NET SERVICE THIS PERIOD was never
// range-checked, so an OCR/label misread producing an impossible duration
// (13 months, 45 days) round-tripped straight through subtractDuration as
// if it meant 13 real calendar months. Fixture values are synthetic.
describe("D-E: NGB-22 net-service duration is range-checked before deriving a date", () => {
  const ngbWithNetService = (net) => `
1. LAST NAME - FIRST NAME - MIDDLE NAME    2. DEPARTMENT, COMPONENT AND BRANCH
SAMPLE JORDAN TAYLOR                        ARNGUS/CAARNG

5a. RANK
SSG

8a. STATION OR INSTALLATION AT WHICH EFFECTED   YR MO DA
HHC 1-100 IN, ANYTOWN, ST 00000                 DATE 2010 | 06 | 15

9. COMMAND TO WHICH TRANSFERRED    10. RECORD OF SERVICE   YRS MOS DAYS
(a) NET SERVICE THIS PERIOD   ${net}

24. CHARACTER OF SERVICE
HONORABLE
`;

  it.each([
    ["08 | 13 | 10", "months over 11"],
    ["08 | 03 | 45", "days over 31"],
    ["99 | 03 | 10", "years over the sane career-length ceiling"],
  ])(
    "derives nothing when the net-service duration is invalid (%s: %s)",
    async (net) => {
      const extractedData = await parseServiceRecord(
        ngbWithNetService(net),
        "NGB22",
      );
      expect(extractedData.serviceStartDate).toBeFalsy();
      expect(extractedData.serviceEndDate).toBeFalsy();
      expect(extractedData.serviceStartDateDerived).toBeFalsy();
    },
  );

  it("still derives the date for an in-range duration", async () => {
    const extractedData = await parseServiceRecord(
      ngbWithNetService("08 | 03 | 10"),
      "NGB22",
    );
    expect(extractedData.serviceStartDate).toBe("2002-03-05");
    expect(extractedData.serviceStartDateDerived).toBe(true);
  });
});
