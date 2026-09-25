/**
 * D-8: new Date("YYYY-MM-DD") parses at UTC midnight; toLocaleDateString()
 * then renders the previous calendar day anywhere west of UTC.
 * formatLocalDate must construct the date at LOCAL midnight instead.
 */
import { describe, it, expect } from "vitest";
import {
  formatLocalDate,
  parseExplicitDate,
  isDesignatedCombatZone,
  subtractDuration,
} from "../../utils/dateUtils";

describe("D-8: formatLocalDate", () => {
  it("renders the same calendar day it was given, regardless of local timezone offset", () => {
    const date = formatLocalDate("2026-03-15");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2); // March (0-indexed)
    expect(date.getDate()).toBe(15);
  });

  it("differs from the naive new Date(dateString) parse west of UTC", () => {
    const naive = new Date("2026-03-15");
    const fixed = formatLocalDate("2026-03-15");
    // The naive parse is UTC midnight; the fixed one is local midnight.
    // They should represent different instants unless the runner's TZ is UTC.
    if (naive.getTimezoneOffset() !== 0) {
      expect(fixed.getTime()).not.toBe(naive.getTime());
    }
    expect(fixed.getDate()).toBe(15);
  });

  it("returns an invalid Date for an empty/null input rather than throwing", () => {
    expect(Number.isNaN(formatLocalDate(null).getTime())).toBe(true);
    expect(Number.isNaN(formatLocalDate("").getTime())).toBe(true);
  });

  it.each([["July 31, 2015"], ["07/31/2015"]])(
    "reads the calendar day from a saved non-ISO date (%s)",
    (value) => {
      const date = formatLocalDate(value);
      expect(date.getFullYear()).toBe(2015);
      expect(date.getMonth()).toBe(6);
      expect(date.getDate()).toBe(31);
    },
  );

  it("also handles a full ISO string derived from a date-only input (ClaimNavigator's DateCard pattern)", () => {
    const date = formatLocalDate("2026-03-15T00:00:00.000Z");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(15);
  });
});

// N7 (final8 QA, 2026-09-24): both musterCallProcessor's _toISODateString
// and the VKB's _toIsoDate used to fall back to Date.parse/new Date(),
// which is lenient enough to accept non-date text like "SINAI 12" as a
// real (wrong) date. Shared by both, so this is the one place the accepted
// format list is verified.
describe("N7: parseExplicitDate only accepts explicit date formats", () => {
  it.each([
    ["SINAI 12"],
    ["SINAI 2004"],
    ["NGB FORM 2022"],
    ["GENERAL 2005"],
    ["AFGHANISTAN"],
    ["NOT A REAL DATE"],
    [""],
    [null],
    [undefined],
  ])("rejects %s instead of guessing at a date", (value) => {
    expect(parseExplicitDate(value)).toBeNull();
  });

  it.each([
    ["2004-06-22", "2004-06-22"],
    ["2004-06-22T00:00:00.000Z", "2004-06-22"],
    ["06/22/2004", "2004-06-22"],
    ["6/22/2004", "2004-06-22"],
    ["06-22-2004", "2004-06-22"],
    ["6-22-04", "2004-06-22"],
    ["20040622", "2004-06-22"],
    ["22 JUN 2004", "2004-06-22"],
    ["June 22, 2004", "2004-06-22"],
    ["Jun. 22 2004", "2004-06-22"],
  ])("accepts the explicit format %s", (value, expected) => {
    expect(parseExplicitDate(value)).toBe(expected);
  });
});

// N13 (final9 QA, 2026-09-25): the numeric and compact-YYYYMMDD branches
// built a "YYYY-MM-DD" string straight from whatever digits matched, with
// no check that the result is a real calendar day.
describe("N13: parseExplicitDate rejects impossible calendar dates", () => {
  it.each([
    ["13/01/2004"], // month 13
    ["02/30/2004"], // February 30
    ["20041302"], // compact, month 13
    ["20040230"], // compact, February 30 (not a leap year)
    ["99999999"], // not a date at all
    ["02/29/2005"], // 2005 is not a leap year
  ])("rejects %s instead of rolling it over to a different date", (value) => {
    expect(parseExplicitDate(value)).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(parseExplicitDate("02/29/2004")).toBe("2004-02-29");
    expect(parseExplicitDate("20040229")).toBe("2004-02-29");
  });

  it.each([["1899-12-31"], ["2101-01-01"]])(
    "rejects a year outside 1900-2100 (%s)",
    (value) => {
      expect(parseExplicitDate(value)).toBeNull();
    },
  );
});

describe("subtractDuration", () => {
  it("subtracts a calendar Y/M/D duration from an ISO date", () => {
    expect(subtractDuration("2008-04-04", 10, 8, 5)).toBe("1997-07-30");
  });

  it("borrows across a leap day", () => {
    expect(subtractDuration("2001-03-01", 1, 0, 1)).toBe("2000-02-29");
  });

  it("returns null for a non-ISO input", () => {
    expect(subtractDuration("not a date", 1, 0, 0)).toBeNull();
  });
});

describe("N6: isDesignatedCombatZone shares one date-aware rule", () => {
  it("flags a designated location on or after its designation start date", () => {
    expect(isDesignatedCombatZone("AFGHANISTAN", "2004-08-08")).toBe(true);
    expect(isDesignatedCombatZone("IRAQ", "08/08/2004")).toBe(true);
  });

  it("does not flag a designated location before its designation start date", () => {
    expect(isDesignatedCombatZone("AFGHANISTAN", "1999-01-01")).toBe(false);
  });

  it("never flags an undated deployment or an undesignated location", () => {
    expect(isDesignatedCombatZone("AFGHANISTAN", null)).toBe(false);
    expect(isDesignatedCombatZone("GERMANY", "2004-08-08")).toBe(false);
  });
});
