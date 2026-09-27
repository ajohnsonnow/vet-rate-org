/**
 * pickServiceEntry used to pick the chronologically EARLIEST period,
 * treating a calculated (derived) guess as equally "proven" as a real,
 * printed/veteran-supplied date. When a correction (Muster Call review, My
 * Packet) lands more than isSameServicePeriod's 7-day tolerance away from
 * the original calculated guess, upsertServicePeriod creates a SECOND
 * period instead of merging - and the stale calculated one, being
 * chronologically earlier, kept winning. A calculated date is a guess, not
 * a proven fact, so it must never outrank a real one just for being
 * earlier. Fixture values are synthetic.
 */
import { describe, it, expect } from "vitest";
import { pickServiceEntry } from "./serviceEntryDate";

describe("pickServiceEntry: a proven period always outranks a calculated one", () => {
  it("prefers a non-derived period even when a derived period is chronologically earlier", () => {
    const periods = [
      {
        id: "a",
        serviceStartDate: "2002-01-10",
        serviceStartDateDerived: true,
      },
      {
        id: "b",
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: false,
      },
    ];

    expect(pickServiceEntry(periods)).toMatchObject({
      date: "2002-03-05",
      derived: false,
      periodId: "b",
    });
  });

  it("still picks the earliest period when both (or neither) are derived", () => {
    const bothCalculated = [
      {
        id: "a",
        serviceStartDate: "2002-01-10",
        serviceStartDateDerived: true,
      },
      {
        id: "b",
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: true,
      },
    ];
    expect(pickServiceEntry(bothCalculated)).toMatchObject({
      date: "2002-01-10",
      periodId: "a",
    });

    const bothPrinted = [
      {
        id: "a",
        serviceStartDate: "2004-01-10",
        serviceStartDateDerived: false,
      },
      {
        id: "b",
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: false,
      },
    ];
    expect(pickServiceEntry(bothPrinted)).toMatchObject({
      date: "2002-03-05",
      periodId: "b",
    });
  });

  it("prefers a veteran-edited correction over a duplicate calculated guess created by a >7-day-away correction", () => {
    // upsertServicePeriod's tolerance couldn't merge a correction this far
    // from the original guess, so both periods exist side by side.
    const periods = [
      {
        id: "calc",
        serviceStartDate: "2002-01-10",
        serviceStartDateDerived: true,
        userEdited: false,
      },
      {
        id: "corrected",
        serviceStartDate: "2002-06-01",
        serviceStartDateDerived: false,
        userEdited: true,
      },
    ];

    expect(pickServiceEntry(periods)).toMatchObject({
      date: "2002-06-01",
      derived: false,
      source: "veteran",
      periodId: "corrected",
    });
  });
});
