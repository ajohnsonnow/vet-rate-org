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
