/**
 * parseServiceRecord against the OCR text SHAPE produced by the Tesseract
 * ensemble on real scanned DD214/NGB22 documents (live audit 2026-08-21):
 * the label row is read before the value row, letter O arrives as zero, and
 * addresses sit right next to the name zone. Fictional veteran.
 */
import { describe, it, expect } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseServiceRecord } = await import("./musterCallProcessor");

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
  "ARMY NATI0NAL GUARD 0F 0REG0N " +
  "1. LAST NAME - FIRST NAME - MIDDLE NAME  2. DEPARTMENT, C0MP0NENT AND BRANCH  3. S0CIAL SECURITY NUMBER " +
  "WILLIAMS R0BERT LEE  ARNGUS/0RARNG  000-00-0000 " +
  "5a. RANK  0F BIRTH 1997 07 30 SGT  E5 " +
  "8a. STATI0N 0R INSTALLATI0N AT WHICH EFFECTED HHC/41 IBCT. P0RTLAND. 0R 97223";

describe("musterCallProcessor: parseServiceRecord on real-scan OCR shapes", () => {
  it("extracts the name from a row-wise DD214 where the value row follows the full label row", async () => {
    const result = await parseServiceRecord(
      TESSERACT_DD214_ROW_LAYOUT,
      "DD214",
    );
    expect(result.lastName).toBe("WILLIAMS");
    expect(result.firstName).toBe("ROBERT");
    expect(result.middleName).toBe("LEE");
    expect(result.veteranName).toBe("WILLIAMS, ROBERT LEE");
    expect(result.branch).toBe("Army");
    expect(result.component).toBe("National Guard");
    expect(result.rank).toBe("SPC");
  });

  it("extracts the name from an NGB22 using its 'LAST NAME - FIRST NAME - MIDDLE NAME' label", async () => {
    const result = await parseServiceRecord(
      TESSERACT_NGB22_ROW_LAYOUT,
      "NGB22",
    );
    expect(result.lastName).toBe("WILLIAMS");
    expect(result.firstName).toBe("ROBERT");
    expect(result.middleName).toBe("LEE");
    expect(result.component).toBe("National Guard");
    expect(result.rank).toBe("SGT");
  });

  it("leaves the name empty rather than returning an address or a branch code", async () => {
    const result = await parseServiceRecord(
      "1. NAME (Last, First, Middle)  2. DEPARTMENT, COMPONENT AND BRANCH  3. SOCIAL SECURITY NO. " +
        "ARNGUS/ORARNG 000-00-0000 4a GRADE 7.b HOME OF RECORD FORT LEE, VA 23801 CAMP ATTERBURY, INDIANA",
      "DD214",
    );
    expect(result.veteranName).toBeNull();
    expect(result.lastName).toBeNull();
  });
});

// Block 13 on a real scan: zeros for letter O throughout, award separators
// degraded from "//" to a single "/" in places, the decoration itself broken
// across a line break, and a "COMBAT LIFE SAVER COURSE" sitting in Block 14
// that must not be mistaken for a combat decoration.
const TESSERACT_BLOCK_13 =
  "13. DEC0RATI0NS, MEDALS. BADGES, CITATI0NS AD CAMPAIGN RIBB0NS AWARDED 0R AUTH0RIZED\n" +
  "ARMY ACHIEVEMENT MEDAL//AFGHANISTAN CAMPAIGN MEDAL//GL0BAL WAR 0N TERR0RISM EXPEDITI0NARY " +
  'MEDAL/GL0BAL WAR 0N TERR0RISM SERVICE MEDAL-2//ARMED F0RCES RESERVE MEDAL W/ "M" DEVICE-2/' +
  "INC0 PR0FESSI0NAL DEVEL0PMENT RIBB0N//ARMY SERVICE RIBB0N//0VERSEAS SERVICE RIBB0N/" +
  "MULTINATI0NAL F0RCES AND 0BSERVERS MEDAUL/C0MBAT\n\nACTI0N BADGE//IN0THING F0LL0WS\n" +
  "14. MILITARY EDUCATI0N (C0urse. title, number 0f weeks and m0nth and year ccmpleted)\n" +
  "C0MBAT LIFE SAVER C0URSE, 1 WEEK, 2004//IN0THING F0LL0WS";

describe("musterCallProcessor: combat determination from a real Block 13", () => {
  it("establishes combat service from a Combat Action Badge broken across a line break", async () => {
    const result = await parseServiceRecord(TESSERACT_BLOCK_13, "DD214");
    expect(result.combatService.hasVerifiedCombat).toBe(true);
    expect(result.combatService.indicators).toContain("Combat Action Badge");
  });

  it("does not count the Block 14 Combat Life Saver Course as a decoration", async () => {
    const result = await parseServiceRecord(TESSERACT_BLOCK_13, "DD214");
    expect(result.combatService.indicators).toEqual(["Combat Action Badge"]);
  });

  it("keeps campaign and expeditionary medals out of the combat indicators", async () => {
    const result = await parseServiceRecord(TESSERACT_BLOCK_13, "DD214");
    for (const name of result.combatService.indicators) {
      expect(name).not.toMatch(/campaign|expeditionary|service medal/i);
    }
  });

  it("emits no combatService field when nothing established combat", async () => {
    const result = await parseServiceRecord(
      TESSERACT_DD214_ROW_LAYOUT,
      "DD214",
    );
    // Null, not an all-negative object: the review screen should not ask the
    // veteran to verify a "Combat Service" row that says nothing, and a
    // silent page must not retract combat another page established.
    expect(result.combatService).toBeNull();
  });
});
