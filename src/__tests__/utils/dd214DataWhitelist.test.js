/**
 * Q1 (locked, 2026-07-30): _sanitizeDd214Data's whitelist gained exactly 9
 * fields (fullName, rank, payGrade, dateOfBirth, separationAuthority,
 * separationCode, reentryCode, narrativeReason, militaryEducation).
 * ssnFull and serviceNumber must remain excluded no matter what the
 * caller passes in — saveDD214Data assembles them in memory before this
 * sanitizer strips them.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { saveDD214Data, getServiceHistory } from "../../utils/veteranProfile";

describe("Q1: DD214 data whitelist", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists the 9 newly-whitelisted fields", () => {
    saveDD214Data({
      fullName: "WILLIAMS, ROBERT LEE",
      rank: "SGT",
      payGrade: "E-5",
      dateOfBirth: "01/15/1990",
      separationAuthority: "AR 635-200",
      separationCode: "MBK",
      reentryCode: "RE-1",
      narrativeReason: "COMPLETION OF REQUIRED ACTIVE SERVICE",
      militaryEducation: ["BASIC INFANTRY TRAINING COURSE 8 WEEKS"],
    });

    const { dd214Data } = getServiceHistory();
    expect(dd214Data.fullName).toBe("WILLIAMS, ROBERT LEE");
    expect(dd214Data.rank).toBe("SGT");
    expect(dd214Data.payGrade).toBe("E-5");
    expect(dd214Data.dateOfBirth).toBe("01/15/1990");
    expect(dd214Data.separationAuthority).toBe("AR 635-200");
    expect(dd214Data.separationCode).toBe("MBK");
    expect(dd214Data.reentryCode).toBe("RE-1");
    expect(dd214Data.narrativeReason).toBe(
      "COMPLETION OF REQUIRED ACTIVE SERVICE",
    );
    expect(dd214Data.militaryEducation).toEqual([
      "BASIC INFANTRY TRAINING COURSE 8 WEEKS",
    ]);
  });

  it("never persists ssnFull or serviceNumber, even when present on the input", () => {
    saveDD214Data({
      fullName: "WILLIAMS, ROBERT LEE",
      ssnFull: "123-45-6789",
      serviceNumber: "US12345678",
    });

    const { dd214Data } = getServiceHistory();
    expect(dd214Data.ssnFull).toBeUndefined();
    expect(dd214Data.serviceNumber).toBeUndefined();
    expect(JSON.stringify(dd214Data)).not.toContain("123-45-6789");
    expect(JSON.stringify(dd214Data)).not.toContain("US12345678");
  });
});

/**
 * FIX-17 (2026-08-03, Anth-authorized): lastName/firstName/middleName
 * added to the same whitelist as the Q1 expansion above. buildDD214ProfileUpdate
 * (musterCallProcessor.js) already supplied these fields on every DD214
 * import — this whitelist gap silently dropped them before they ever
 * reached serviceHistory.dd214Data, so the Service tab's DD214
 * Information panel had no name to display.
 */
describe("FIX-17: DD214 name fields whitelist", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists lastName/firstName/middleName alongside fullName", () => {
    saveDD214Data({
      fullName: "WILLIAMS, ROBERT LEE",
      lastName: "WILLIAMS",
      firstName: "ROBERT",
      middleName: "LEE",
    });

    const { dd214Data } = getServiceHistory();
    expect(dd214Data.fullName).toBe("WILLIAMS, ROBERT LEE");
    expect(dd214Data.lastName).toBe("WILLIAMS");
    expect(dd214Data.firstName).toBe("ROBERT");
    expect(dd214Data.middleName).toBe("LEE");
  });

  it("still excludes ssnFull/serviceNumber when name fields are also present", () => {
    saveDD214Data({
      lastName: "WILLIAMS",
      firstName: "ROBERT",
      ssnFull: "123-45-6789",
      serviceNumber: "US12345678",
    });

    const { dd214Data } = getServiceHistory();
    expect(dd214Data.lastName).toBe("WILLIAMS");
    expect(dd214Data.firstName).toBe("ROBERT");
    expect(dd214Data.ssnFull).toBeUndefined();
    expect(dd214Data.serviceNumber).toBeUndefined();
  });
});

/**
 * FIX-19 (2026-08-04): fullNameSourceForm added to the same whitelist —
 * saveDD214Data's write path passes dd214Data through TWO separate
 * whitelists (_dd214PersonalFields inside saveDD214Data itself, then
 * _sanitizeDd214Data again inside saveServiceHistory), so a field missing
 * from EITHER one is silently dropped before it ever reaches localStorage.
 * Tracks which form type (DD214/NGB22/DD256/DD257) actually supplied
 * fullName, so the Service tab's Name card can show a real source instead
 * of a hardcoded "DD-214, Block 1" claim regardless of which form type
 * actually won the confidence merge.
 */
describe("FIX-19: fullNameSourceForm whitelist", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists fullNameSourceForm alongside fullName", () => {
    saveDD214Data({
      fullName: "WILLIAMS, ROBERT LEE",
      fullNameSourceForm: "NGB22",
    });

    const { dd214Data } = getServiceHistory();
    expect(dd214Data.fullName).toBe("WILLIAMS, ROBERT LEE");
    expect(dd214Data.fullNameSourceForm).toBe("NGB22");
  });
});
