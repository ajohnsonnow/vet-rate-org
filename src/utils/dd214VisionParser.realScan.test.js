/**
 * Regressions from a live audit against real scanned DD214/NGB22 documents
 * (2026-08-21). Fixtures reproduce the OCR text SHAPE observed - Tesseract's
 * letter-O-as-zero substitution, row-wise label-row-then-value-row reading
 * order, and address fragments - with a fictional veteran.
 */
import { describe, it, expect } from "vitest";
import dd214VisionParser from "./dd214VisionParser";

const { extractName, extractAwards, extractBranch, parseDD214Text } =
  dd214VisionParser;

const TESSERACT_DD214_ROW_LAYOUT =
  "CAUTI0N: N0T T0 BE USED F0R IDENTIFICATI0N PURP0SES THIS IS AN IMP0RTANT REC0RD. " +
  "CERTIFICATE 0F RELEASE 0R DISCHARGE FR0M ACTIVE DUTY  " +
  "1. NAME (Last, First, Middle)  2. DEPARTMENT, C0MP0NENT AND BRANCH  3, S0CIAL SECURITY N0. " +
  "WILLIAMS; R0BERT LEE  ARMY/ARNG  000 00 0000 " +
  "4a GRADE, RATE, 0R RANK 1 4.b PAY GRADE  5. DATE 0F BIRTH (YYYYMMDD)  SPC  19900115 " +
  "7.a. PLACE 0F ENTRY INT0 ACTIVE DUTY  7.b H0ME 0F REC0RD AT TIME 0F ENTRY ASHLAND, 0R  " +
  "1127 SE 28TH AV  P0RTLAND, 0R 97214 8b STATI0N WHERE SEPARATED 1420 E MAIN ST, ASHLAND, 0R 97520";

const TESSERACT_NGB22_ROW_LAYOUT =
  "DEPARTMENTS 0F THE ARMY AND THE AIR F0RCE NATI0NAL GUARD BUREAU REP0RT 0F SEPARATI0N AND REC0RD 0F SERVICE " +
  "ARMY NATI0NAL GUARD 0F 0REG0N  RESERVE 0F THE ARMY " +
  "1. LAST NAME - FIRST NAME - MIDDLE NAME  2. DEPARTMENT, C0MP0NENT AND BRANCH  3. S0CIAL SECURITY NUMBER " +
  "WILLIAMS R0BERT LEE  ARNGUS/0RARNG  000-00-0000 " +
  "5a. RANK  0F BIRTH 1997 07 30 SGT  E5 " +
  "8a. STATI0N 0R INSTALLATI0N AT WHICH EFFECTED HHC/41 IBCT. P0RTLAND. 0R 97223 " +
  "10. REC0RD 0F SERVICE (b) PRI0R RESERVE C0MP0NENT SERVICE 6. RESERVE 0BLIG. TERM. DATE";

describe("dd214VisionParser: real-scan OCR shapes", () => {
  it("reads the name from a row-wise Tesseract DD214 where the value row follows the whole label row", () => {
    const name = extractName(
      dd214VisionParser.normalizeOcrText(TESSERACT_DD214_ROW_LAYOUT),
    );
    expect(name.lastName).toBe("WILLIAMS");
    expect(name.firstName).toBe("ROBERT");
    expect(name.middleName).toBe("LEE");
    expect(name.value).toBe("WILLIAMS, ROBERT LEE");
  });

  it("reads the name from an NGB22 whose Block 1 label is 'LAST NAME - FIRST NAME - MIDDLE NAME'", () => {
    const parsed = parseDD214Text(TESSERACT_NGB22_ROW_LAYOUT);
    expect(parsed.fields.lastName).toBe("WILLIAMS");
    expect(parsed.fields.firstName).toBe("ROBERT");
    expect(parsed.fields.middleName).toBe("LEE");
    expect(parsed.fields.branch).toBe("Army");
    expect(parsed.fields.component).toBe("National Guard");
    expect(parsed.fields.documentType).toBe("NGB22");
  });

  it("normalizes Tesseract's letter-O-as-zero inside words but not inside numbers", () => {
    const text = dd214VisionParser.normalizeOcrText(
      "S0CIAL SECURITY N0. J0NES 000 00 0000 DATE 0F BIRTH 19900115 92Y10 UNIT SUPPLY",
    );
    expect(text).toContain("SOCIAL SECURITY NO. JONES 000 00 0000");
    expect(text).toContain("DATE OF BIRTH 19900115");
    expect(text).toContain("92Y10");
  });

  it("never returns an address fragment as the veteran's name", () => {
    const addressesOnly =
      "7.b HOME OF RECORD AT TIME OF ENTRY 1709 SW BLANKENSHIP RD #28 PORTLAND, OR 97068 " +
      "8.b STATION WHERE SEPARATED FORT LEE, VA 23801 CAMP ATTERBURY, INDIANA " +
      "9. COMMAND TO WHICH TRANSFERRED 162D ENGR CO, CP WITHYCOMBE, CLACKAMAS, OR 97015";
    const name = extractName(addressesOnly);
    expect(name.value).toBeNull();
    expect(name.lastName).toBeNull();
    expect(name.confidence).toBe(0);
  });

  it("does not invent a Combat Action Badge from the letters 'cab' inside another word", () => {
    const boilerplate =
      "THE MEMBER IS ELIGIBLE FOR ALL APPLICABLE BENEFITS. CAREER COUNSELOR CONTACTED. DISCARD PRIOR EDITIONS.";
    const names = extractAwards(boilerplate).awards.map((a) => a.name);
    expect(names).not.toContain("Combat Action Badge");
    expect(names).not.toContain("Combat Infantryman Badge");
    expect(names).not.toContain("Combat Action Ribbon");
    expect(
      extractAwards(
        "13. DECORATIONS: COMBAT ACTION BADGE//ARMY COMMENDATION MEDAL",
      ).awards.map((a) => a.name),
    ).toContain("Combat Action Badge");
  });

  it("classifies a National Guard document as National Guard even though every form mentions RESERVE obligations", () => {
    expect(
      extractBranch(
        "6. RESERVE OBLIG. TERM. DATE  DEPARTMENT, COMPONENT AND BRANCH ARMY NATIONAL GUARD",
      ).component,
    ).toBe("National Guard");
    expect(
      extractBranch("DEPARTMENT, COMPONENT AND BRANCH US ARMY / USAR")
        .component,
    ).toBe("Reserve");
    expect(
      extractBranch("ORANGE COUNTY RANGE CONTROL US ARMY ACTIVE DUTY")
        .component,
    ).toBe("Active");
  });
});
