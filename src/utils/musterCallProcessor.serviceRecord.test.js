import { describe, it, expect } from "vitest";

// musterCallProcessor transitively imports pdfjs, which references canvas
// globals jsdom doesn't provide. Stub them so the module loads in the test
// environment (same pattern as musterCallProcessor.ratingDecision.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseServiceRecord } = await import("./musterCallProcessor");

const REALISTIC_DD214 = `
1. NAME (Last, First, Middle): WILLIAMS, ROBERT LEE
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
4a. GRADE, RATE OR RANK: SGT
4b. PAY GRADE: E-5
5. DATE OF BIRTH: 01/15/1990
7a. PLACE OF ENTRY: PORTLAND OR
8. PLACE OF ENTRY: PORTLAND OR
11. PRIMARY SPECIALTY: 11B INFANTRYMAN
12a. DATE ENTERED AD THIS PERIOD: 06/01/2010
12b. DATE OF SEPARATION: 05/30/2015
12b. NET ACTIVE SERVICE THIS PERIOD: 5 YEARS 0 MONTHS 0 DAYS
13. DECORATIONS, MEDALS, BADGES: ARMY COMMENDATION MEDAL
14. MILITARY EDUCATION: BASIC INFANTRY TRAINING COURSE 8 WEEKS
15. YEARS OF EDUCATION: 12
18. REMARKS: DEPLOYED TO IRAQ.
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
25. SEPARATION AUTHORITY: AR 635-200
26. SEPARATION CODE: MBK
27. REENTRY CODE: RE-1
28. NARRATIVE REASON: COMPLETION OF REQUIRED ACTIVE SERVICE
`;

describe("musterCallProcessor: parseServiceRecord (DD214 parser)", () => {
  it("extracts identity, dates, and separation fields from a realistic DD214", async () => {
    const result = await parseServiceRecord(REALISTIC_DD214);

    expect(result.error).toBeUndefined();
    expect(result.type).toBe("service_record");

    expect(result.lastName).toBe("WILLIAMS");
    expect(result.firstName).toBe("ROBERT");
    expect(result.middleName).toBe("LEE");

    expect(result.branch).toBe("Army");
    expect(result.rank).toBe("SGT");
    expect(result.payGrade).toBe("E-5");

    expect(result.dateOfBirth).toBe("01/15/1990");
    expect(result.serviceStartDate).toBe("06/01/2010");
    expect(result.serviceEndDate).toBe("05/30/2015");
    expect(result.totalActiveService).toBe("5 years, 0 months");

    expect(result.mos).toBe("11B");

    expect(result.dischargeType).toBe("HONORABLE");
    expect(result.spdCode).toBe("MBK");
    expect(result.reentryCode).toBe("RE-1");

    expect(Array.isArray(result.awards)).toBe(true);
    expect(Array.isArray(result.deployments)).toBe(true);
  });

  it("does not throw and returns a partial result for sparse/garbled text", async () => {
    const result = await parseServiceRecord("RANDOM OCR GARBAGE TEXT 12345");
    expect(result.error).toBeUndefined();
    expect(result.type).toBe("service_record");
    expect(result.veteranName).toBeNull();
  });
});

describe("FIX-13: Box 12a/12b service dates no longer come back null on real formatting", () => {
  it("extracts serviceStartDate/serviceEndDate from '12.a.'/'12.b.' (dot before the sub-box letter)", async () => {
    // Real DD214 text renders the sub-box label with a dot BEFORE the
    // letter too ("12.a.", not just "12a."), and the date value itself is a
    // plain whitespace-separated "YYYY MM DD" triplet with no punctuation
    // at all — neither of which the original "12a\.?" + slash/dash-only
    // value regex ever matched.
    const text = `
1. NAME (Last, First, Middle): SMITH, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
12.a. DATE ENTERED AD THIS PERIOD  1999 06 01
12.b. SEPARATION DATE THIS PERIOD  2004 12 15
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.serviceStartDate).toBe("06/01/1999");
    expect(result.serviceEndDate).toBe("12/15/2004");
  });

  it("still extracts serviceStartDate/serviceEndDate from the original '12a.'/'12b.' slash-delimited format (no regression)", async () => {
    const text = `
12a. DATE ENTERED AD THIS PERIOD: 06/01/2010
12b. DATE OF SEPARATION: 05/30/2015
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.serviceStartDate).toBe("06/01/2010");
    expect(result.serviceEndDate).toBe("05/30/2015");
  });
});

describe("FIX-16: Box 1 name extraction survives OCR reading-order scrambling", () => {
  it("extracts the name when '2. DEPARTMENT' (and other boxes) appear BEFORE '1. NAME' in the linearized text", async () => {
    // Real DD214 scans read the form in column/field order, not printed
    // reading order: "2. DEPARTMENT" through "7." routinely appear in the
    // OCR text stream before "1. NAME" does. The old fix required a literal
    // "2. DEPARTMENT"/"2. DEPT" to follow "1. NAME"; when it came first
    // instead, no name was ever extracted even though the text was present.
    const text = `
2. DEPARTMENT, COMPONENT AND BRANCH               3. SOCIAL SECURITY NO.
ARNGUS/TXARNG                                                123-45-6789
4.h PAY GRADE                             5. DATE OF BIRTH (YYYYMMDD)
E4                          19850615
7.a HOME OF RECORD AT TIME OF ENTRY
100 MAIN ST

1. NAME (Last, First, Middle)
SMITH; JOHN ROBERT
4a GRADE, RATE, OR RANK
SPC
7.a. PLACE OF ENTRY INTO ACTIVE DUTY
AUSTIN, TX
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.lastName).toBe("SMITH");
    expect(result.firstName).toBe("JOHN");
    expect(result.middleName).toBe("ROBERT");
  });

  it("stops Box 1 at whichever field boundary comes next, not specifically '2.'", async () => {
    const text = `
1. NAME (Last, First, Middle)
DAVIS; MARIA ELENA
9. COMMAND TO WHICH TRANSFERRED
SOME UNIT
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.lastName).toBe("DAVIS");
    expect(result.firstName).toBe("MARIA");
    expect(result.middleName).toBe("ELENA");
  });

  it("still does not fabricate a name from NGB22 boilerplate when Box 2 precedes Box 1 (no regression)", async () => {
    const text = `
FOR USE OF THIS FORM, SEE NGR (AR 600-200)
2. DEPARTMENT, COMPONENT AND BRANCH
ARNGUS
1. NAME
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.lastName).toBeNull();
    expect(result.firstName).toBeNull();
  });

  it("does not hang when '1. NAME' is followed by a long run of text with no field boundary (regression: ReDoS)", async () => {
    const pathological = "1. NAME\n" + "A".repeat(100000);
    const start = Date.now();
    const result = await parseServiceRecord(pathological);
    const elapsed = Date.now() - start;
    expect(result.error).toBeUndefined();
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on near-miss field-boundary text after '1. NAME' (regression: ReDoS)", async () => {
    const pathological = "1. NAME\n" + "4a ".repeat(50000);
    const start = Date.now();
    const result = await parseServiceRecord(pathological);
    const elapsed = Date.now() - start;
    expect(result.error).toBeUndefined();
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("FIX-15: NGB-22 Box 18 IADT/AD period date ranges", () => {
  it("parses one IADT window and multiple AD windows from a real Box 18 format", async () => {
    const text = `
1. NAME (Last, First, Middle): WILLIAMS, ROBERT LEE
2. DEPARTMENT, COMPONENT AND BRANCH: ARNGUS
18. REMARKS: IADT: 19940115-19940620//AD: 19990920-20000512//20081115-20090630//20110301-20120815//
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
`;
    const result = await parseServiceRecord(text, "NGB22");
    expect(result.error).toBeUndefined();
    expect(result.additionalPeriods).toEqual([
      {
        component: "IADT",
        serviceStartDate: "01/15/1994",
        serviceEndDate: "06/20/1994",
      },
      {
        component: "Active Duty",
        serviceStartDate: "09/20/1999",
        serviceEndDate: "05/12/2000",
      },
      {
        component: "Active Duty",
        serviceStartDate: "11/15/2008",
        serviceEndDate: "06/30/2009",
      },
      {
        component: "Active Duty",
        serviceStartDate: "03/01/2011",
        serviceEndDate: "08/15/2012",
      },
    ]);
  });

  it("never runs on a DD214 (formType defaults to DD214) even with the same Box 18 shape", async () => {
    const text = `
18. REMARKS: IADT: 19940115-19940620//AD: 19990920-20000512//
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.additionalPeriods).toEqual([]);
  });

  it("returns an empty array (no fabrication) when Box 18 can't be isolated", async () => {
    const result = await parseServiceRecord("RANDOM GARBLED TEXT", "NGB22");
    expect(result.error).toBeUndefined();
    expect(result.additionalPeriods).toEqual([]);
  });

  it("skips a segment whose date range is malformed instead of guessing", async () => {
    const text = `
18. REMARKS: IADT: 19940115-19940620//AD: NOT-A-DATE//20081115-20090630//
`;
    const result = await parseServiceRecord(text, "NGB22");
    expect(result.error).toBeUndefined();
    expect(result.additionalPeriods).toEqual([
      {
        component: "IADT",
        serviceStartDate: "01/15/1994",
        serviceEndDate: "06/20/1994",
      },
      {
        component: "Active Duty",
        serviceStartDate: "11/15/2008",
        serviceEndDate: "06/30/2009",
      },
    ]);
  });
});

describe("FIX-18: NGB-22 Box 18 label recognition survives digit-for-letter OCR corruption", () => {
  it("recovers a mangled IADT label ('1A DT' instead of 'IADT') without dropping its date range", async () => {
    const text = `
18. REMARKS: 1A DT: 19940115-19940620//AD: 19990920-20000512//
`;
    const result = await parseServiceRecord(text, "NGB22");
    expect(result.error).toBeUndefined();
    expect(result.additionalPeriods).toEqual([
      {
        component: "IADT",
        serviceStartDate: "01/15/1994",
        serviceEndDate: "06/20/1994",
      },
      {
        component: "Active Duty",
        serviceStartDate: "09/20/1999",
        serviceEndDate: "05/12/2000",
      },
    ]);
  });

  it("keeps a segment's date range when its label doesn't resolve to a known one, marking the component unknown instead of dropping the segment", async () => {
    const text = `
18. REMARKS: IADT: 19940115-19940620//XQ7: 19990920-20000512//20081115-20090630//
`;
    const result = await parseServiceRecord(text, "NGB22");
    expect(result.error).toBeUndefined();
    expect(result.additionalPeriods).toEqual([
      {
        component: "IADT",
        serviceStartDate: "01/15/1994",
        serviceEndDate: "06/20/1994",
      },
      {
        component: null,
        serviceStartDate: "09/20/1999",
        serviceEndDate: "05/12/2000",
      },
      {
        component: null,
        serviceStartDate: "11/15/2008",
        serviceEndDate: "06/30/2009",
      },
    ]);
  });

  it("does not silently inherit the previous segment's component when a LATER label is the one that's unrecognized (symmetric to the IADT case)", async () => {
    const text = `
18. REMARKS: IADT: 19940115-19940620//MD: 19990920-20000512//
`;
    const result = await parseServiceRecord(text, "NGB22");
    expect(result.error).toBeUndefined();
    expect(result.additionalPeriods[1]).toEqual({
      component: null,
      serviceStartDate: "09/20/1999",
      serviceEndDate: "05/12/2000",
    });
  });
});

describe("FIX-20: Box 7a place-of-entry extraction", () => {
  it("extracts Place of Entry from Box 7a, not Box 8 (Last Duty Assignment)", async () => {
    const text = `
1. NAME (Last, First, Middle): WILLIAMS, ROBERT LEE
7.a PLACE OF ENTRY INTO ACTIVE DUTY
SPRINGFIELD, IL
8.a LAST DUTY ASSIGNMENT AND MAJOR COMMAND
SOME UNIT, FORT BENNING, GA
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.placeOfEntry).toBe("SPRINGFIELD, IL");
  });

  it("picks Box 7a's own value over Box 7b's (Home of Record) boilerplate text when both are read ahead of it (real scans interleave the two columns)", async () => {
    const text = `
7.a PLACE OF ENTRY INTO ACTIVE DUTY                       7.b HOME OF RECORD AT TIME OF ENTRY (City and State, or complete
address if known)
100 MAIN ST

RIVERTON, WY                                              CASPER, WY 82601
8.a LAST DUTY ASSIGNMENT
SOME UNIT
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.placeOfEntry).toBe("RIVERTON, WY");
  });

  it("recovers a candidate with digit-for-letter OCR corruption in the city/state text", async () => {
    const text = `
7.a PLACE OF ENTRY INTO ACTIVE DUTY
SPR1NGFIELD, 1L
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.placeOfEntry).toBe("SPRINGFIELD, IL");
  });

  it("does not fabricate a value when no City, ST candidate follows the label (genuine OCR-quality ceiling)", async () => {
    const text = `
7.a PLACE OF ENTRY INTO ACTIVE DUTY
UNREADABLE GARBLED TEXT WITH NO COMMA ANYWHERE NEARBY
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.placeOfEntry).toBeNull();
  });

  it("flags a single-letter OCR misread of a well-known city as low-confidence without blocking extraction (real example: SORTLAND for PORTLAND)", async () => {
    const text = `
7.a PLACE OF ENTRY INTO ACTIVE DUTY
SORTLAND, OR
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.placeOfEntry).toBe("SORTLAND, OR");
    expect(result.placeOfEntryLowConfidence).toBe(true);
  });

  it("does not flag an exact match against a well-known city", async () => {
    const text = `
7.a PLACE OF ENTRY INTO ACTIVE DUTY
PORTLAND, OR
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.placeOfEntry).toBe("PORTLAND, OR");
    expect(result.placeOfEntryLowConfidence).toBe(false);
  });

  it("does not flag a real, uncommon small town that isn't near any well-known city", async () => {
    const text = `
7.a PLACE OF ENTRY INTO ACTIVE DUTY
OSHKOSH, WI
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.placeOfEntry).toBe("OSHKOSH, WI");
    expect(result.placeOfEntryLowConfidence).toBe(false);
  });
});

describe("musterCallProcessor: parseServiceRecord ReDoS regression guards", () => {
  it("does not hang on a long run of letters with no field markers (regression: ReDoS)", async () => {
    const pathological = "A".repeat(100000);
    const start = Date.now();
    const result = await parseServiceRecord(pathological);
    const elapsed = Date.now() - start;
    expect(result.error).toBeUndefined();
    expect(elapsed).toBeLessThan(2000);
  });

  it("does not hang when box labels repeat with long non-terminated runs (regression: ReDoS)", async () => {
    // Stresses the `LABEL[:\s]+(...)+?(?:\s+N\.|$)`-shaped patterns (box
    // 12b/13/23/24/25/28 etc.): each label appears 50x back-to-back with a
    // 2k-char filler and no closing box number, forcing repeated regex
    // restarts each with a full-length lazy-quantifier backtrack.
    const marker = "23. TYPE OF SEPARATION: ";
    const filler = "A".repeat(2000);
    const pathological = (marker + filler + "\n").repeat(50);
    const start = Date.now();
    const result = await parseServiceRecord(pathological);
    const elapsed = Date.now() - start;
    expect(result.error).toBeUndefined();
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on the Box 13 awards block with no terminator (regression: ReDoS)", async () => {
    const marker = "13. DECORATIONS ";
    const filler = "A".repeat(2000);
    const pathological = (marker + filler + "\n").repeat(50);
    const start = Date.now();
    const result = await parseServiceRecord(pathological);
    const elapsed = Date.now() - start;
    expect(result.error).toBeUndefined();
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on unmatched parenthetical-removal input (regression: ReDoS)", async () => {
    const pathological = "(".repeat(100000) + "END";
    const start = Date.now();
    const result = await parseServiceRecord(pathological);
    const elapsed = Date.now() - start;
    expect(result.error).toBeUndefined();
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang when every box label is present with a long non-terminated run (regression: ReDoS)", async () => {
    const labels = [
      "1. NAME",
      "2. DEPARTMENT",
      "4a. GRADE",
      "5. DATE OF BIRTH",
      "8. PLACE OF ENTRY",
      "11. PRIMARY SPECIALTY",
      "12a. DATE ENTERED",
      "12b. SEPARATION",
      "13. DECORATIONS",
      "14. MILITARY EDUCATION",
      "23. TYPE OF SEPARATION",
      "24. CHARACTER OF SERVICE",
      "25. SEPARATION AUTHORITY",
      "28. NARRATIVE REASON",
    ];
    const filler = "A".repeat(5000);
    const pathological = labels.map((l) => `${l}: ${filler}`).join("\n");
    const start = Date.now();
    const result = await parseServiceRecord(pathological);
    const elapsed = Date.now() - start;
    expect(result.error).toBeUndefined();
    expect(elapsed).toBeLessThan(1000);
  });
});
