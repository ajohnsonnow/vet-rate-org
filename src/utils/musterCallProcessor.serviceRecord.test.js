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

    expect(result.lastName).toBe("JOHNSON");
    expect(result.firstName).toBe("ANTHONY");
    expect(result.middleName).toBe("DANIEL");

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
