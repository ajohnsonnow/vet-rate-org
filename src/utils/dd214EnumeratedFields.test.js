import { describe, it, expect } from "vitest";
import {
  cleanEnumeratedField,
  cleanDocumentTypes,
  dateKeys,
  birthDateKeysFrom,
  isPlausibleDateKey,
} from "./dd214EnumeratedFields";
import { sanitizeModelOutput } from "./dd214ModelOutputGuards";

const NAME = "Zorblax Quindle";

describe("enumerated fields keep every real value", () => {
  it.each([
    [
      "branch",
      [
        "Army",
        "Navy",
        "Air Force",
        "Marines",
        "Marine Corps",
        "Coast Guard",
        "Space Force",
        "U.S. Army",
        "Army National Guard",
      ],
    ],
    ["component", ["RA", "ARNG", "USAR", "USN", "USAF", "USMC", "USCG"]],
    ["componentFull", ["Regular Army", "Army National Guard", "Navy Reserve"]],
    [
      "rank",
      [
        "SGT",
        "Staff Sergeant",
        "PV1",
        "Petty Officer 2nd Class",
        "E-5",
        "Captain",
        "LCpl",
        "Airman First Class",
      ],
    ],
    ["payGrade", ["E-1", "E4", "O-3", "W-2", "O-10", "E-9"]],
    ["mos", ["11B", "68W", "3D0X2", "HM", "25B10", "HM-8404"]],
    ["reentryCode", ["RE-1", "RE-3", "RE-4", "1J", "RE-1A", "3"]],
    ["separationCode", ["MBK", "JFF", "KBK"]],
    ["separationProgramDesignator", ["MBK"]],
    [
      "separationAuthority",
      ["AR 635-200, Chapter 4", "MILPERSMAN 1910-164", "Para 5-8"],
    ],
    [
      "separationType",
      [
        "Honorable Discharge",
        "ETS",
        "Retirement",
        "Release from Active Duty",
        "Medical",
      ],
    ],
    [
      "characterOfService",
      [
        "Honorable",
        "General (Under Honorable Conditions)",
        "OTH",
        "Under Other Than Honorable Conditions",
        "Uncharacterized",
      ],
    ],
    ["giBlStatus", ["eligible", "transferred", "Not eligible", "100%"]],
    ["securityClearance", ["Secret", "Top Secret", "TS/SCI", "None"]],
    ["sglCoverage", ["$400,000", "400000", "Maximum", "None"]],
    ["masterRecordType", ["DD214", "DD 214", "NGB22", "NGB 22", "DD256"]],
  ])("%s accepts its real values", (key, values) => {
    for (const value of values) {
      expect(cleanEnumeratedField(key, value), `${key}=${value}`).toBe(value);
    }
  });
});

describe("enumerated fields drop a name, a sentence or a wrong type", () => {
  it.each([
    "branch",
    "component",
    "componentFull",
    "rank",
    "payGrade",
    "mos",
    "reentryCode",
    "separationCode",
    "separationProgramDesignator",
    "separationAuthority",
    "separationType",
    "characterOfService",
    "giBlStatus",
    "securityClearance",
    "sglCoverage",
    "masterRecordType",
  ])("%s rejects an invented name", (key) => {
    expect(cleanEnumeratedField(key, NAME)).toBeUndefined();
    expect(cleanEnumeratedField(key, "Quindle")).toBeUndefined();
    expect(cleanEnumeratedField(key, 42)).toBeUndefined();
    expect(cleanEnumeratedField(key, { name: NAME })).toBeUndefined();
  });

  it("rejects out-of-range pay grades and over-long values", () => {
    expect(cleanEnumeratedField("payGrade", "E-12")).toBeUndefined();
    expect(cleanEnumeratedField("payGrade", "W-9")).toBeUndefined();
    expect(
      cleanEnumeratedField("branch", `Army ${"x".repeat(80)}`),
    ).toBeUndefined();
  });

  it("rejects an all-letter code that is not a rating", () => {
    expect(cleanEnumeratedField("mos", "SMITH")).toBeUndefined();
  });

  it("keeps only real form names in documentTypes", () => {
    expect(cleanDocumentTypes([NAME, "DD214", "NGB 22", 7])).toEqual([
      "DD214",
      "NGB 22",
    ]);
  });
});

describe("dateKeys reads one date written many ways", () => {
  it.each([
    "1984-03-15",
    "19840315",
    "03/15/1984",
    "3/15/84",
    "03-15-1984",
    "15 Mar 1984",
    "15MAR1984",
    "15MAR84",
    "March 15, 1984",
    "Mar 15, 1984",
  ])("%s is 1984-03-15", (text) => {
    expect(dateKeys(text)).toContain("1984-03-15");
  });

  it("reads an ambiguous numeric date both ways and rejects an impossible one", () => {
    expect(dateKeys("03/04/1984").sort()).toEqual(["1984-03-04", "1984-04-03"]);
    expect(dateKeys("1984-02-30")).toEqual([]);
    expect(dateKeys("13/45/1984")).toEqual([]);
    expect(dateKeys("not a date")).toEqual([]);
  });

  it("finds a birth date held at the top level or under personal", () => {
    const keys = birthDateKeysFrom([
      { dob: "03/15/1984" },
      { personal: { dateOfBirth: "1990-01-02" } },
      null,
    ]);
    expect(keys).toEqual(new Set(["1984-03-15", "1990-01-02"]));
  });

  it("limits dates to a plausible range", () => {
    const now = new Date("2026-10-02T00:00:00Z");
    expect(isPlausibleDateKey("1929-12-31", now)).toBe(false);
    expect(isPlausibleDateKey("2002-03-05", now)).toBe(true);
    expect(isPlausibleDateKey("2042-01-01", now)).toBe(false);
  });
});

describe("sanitizeModelOutput applies the lists and the birth-date check", () => {
  it("drops a birth date in every date key, in any format, from any source", () => {
    const data = {
      masterRecordDate: "1984-03-15",
      dateOfRank: "03/15/1984",
      entryDate: "19840315",
      separationDate: "2010-06-15",
      reserveObligationDate: "2031-06-14",
    };
    sanitizeModelOutput(data, [{ personal: { dateOfBirth: "15 Mar 1984" } }]);
    expect(data).toEqual({
      separationDate: "2010-06-15",
      reserveObligationDate: "2031-06-14",
    });
  });

  it("drops impossible and out-of-range dates", () => {
    const data = { entryDate: "1984-02-30", separationDate: "1800-01-01" };
    sanitizeModelOutput(data, []);
    expect(data).toEqual({});
  });

  it("drops an enumerated value that equals a known name token", () => {
    const data = { separationCode: "LEE", mos: "11B" };
    sanitizeModelOutput(data, [{ fullName: "Casey Lee" }]);
    expect(data).toEqual({ mos: "11B" });
  });
});
