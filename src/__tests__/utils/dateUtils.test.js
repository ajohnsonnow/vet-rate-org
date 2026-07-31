/**
 * D-8: new Date("YYYY-MM-DD") parses at UTC midnight; toLocaleDateString()
 * then renders the previous calendar day anywhere west of UTC.
 * formatLocalDate must construct the date at LOCAL midnight instead.
 */
import { describe, it, expect } from "vitest";
import { formatLocalDate } from "../../utils/dateUtils";

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

  it("also handles a full ISO string derived from a date-only input (ClaimNavigator's DateCard pattern)", () => {
    const date = formatLocalDate("2026-03-15T00:00:00.000Z");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(15);
  });
});
