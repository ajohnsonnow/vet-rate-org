/**
 * ADR-007: servicePeriods[] is the one authoritative store for the service
 * entry date. pickServiceEntry() groups same-enlistment periods, resolves
 * each group's real source by precedence (veteran > code_sheet > printed >
 * calculated), then resolves across different enlistments by the [DR-1]
 * comparator. Fixture values are synthetic.
 */
import { describe, it, expect } from "vitest";
import {
  pickServiceEntry,
  isSameCalendarDay,
  isStableSourceDocument,
  periodStartSource,
} from "./serviceEntryDate";

describe("pickServiceEntry: same enlistment resolves by precedence, not chronology", () => {
  it("a veteran correction outranks a calculated guess for the SAME enlistment (shared end date, same document)", () => {
    const periods = [
      {
        id: "calc",
        serviceStartDate: "2002-01-10",
        serviceEndDate: "2010-06-15",
        serviceStartDateDerived: true,
        sourceDocument: "ngb22-synthetic.pdf",
        sources: [{ sourceDocument: "ngb22-synthetic.pdf", formType: "NGB22" }],
      },
      {
        id: "corrected",
        serviceStartDate: "2002-08-01",
        serviceEndDate: "2010-06-15",
        serviceStartDateSource: "veteran",
        serviceStartDateDerived: false,
        userEdited: true,
        sources: [],
      },
    ];

    expect(pickServiceEntry(periods)).toMatchObject({
      date: "2002-08-01",
      derived: false,
      source: "veteran",
      periodId: "corrected",
    });
  });

  it("resolves veteran > code_sheet > printed > calculated regardless of which is chronologically earliest", () => {
    const base = { serviceEndDate: "2010-06-15", sources: [] };
    const printedEarlier = {
      ...base,
      id: "printed",
      serviceStartDate: "1999-01-01",
      serviceStartDateSource: "printed",
    };
    const codeSheet = {
      ...base,
      id: "code_sheet",
      serviceStartDate: "2001-01-01",
      serviceStartDateSource: "code_sheet",
    };
    const veteran = {
      ...base,
      id: "veteran",
      serviceStartDate: "2003-01-01",
      serviceStartDateSource: "veteran",
    };
    expect(
      pickServiceEntry([printedEarlier, codeSheet, veteran]),
    ).toMatchObject({
      date: "2003-01-01",
      source: "veteran",
      periodId: "veteran",
    });
    expect(pickServiceEntry([printedEarlier, codeSheet])).toMatchObject({
      date: "2001-01-01",
      source: "code_sheet",
      periodId: "code_sheet",
    });
  });
});

describe("pickServiceEntry: same-enlistment grouping", () => {
  it("a veteran-created period (no document) with the same end date beats a calculated document period", () => {
    const periods = [
      {
        id: "doc",
        serviceStartDate: "2002-01-10",
        serviceEndDate: "2010-06-15",
        serviceStartDateDerived: true,
        sourceDocument: "ngb22-synthetic.pdf",
        sources: [{ sourceDocument: "ngb22-synthetic.pdf", formType: "NGB22" }],
      },
      {
        id: "manual",
        serviceStartDate: "2002-06-01",
        serviceEndDate: "2010-06-15",
        serviceStartDateSource: "veteran",
        userEdited: true,
        sources: [],
      },
    ];
    expect(pickServiceEntry(periods)).toMatchObject({
      date: "2002-06-01",
      source: "veteran",
      periodId: "manual",
    });
  });
});

describe("pickServiceEntry [DR-1]: across genuinely different enlistments, earliest wins", () => {
  it("picks the earlier enlistment even when it is calculated and the later one is printed", () => {
    const periods = [
      {
        id: "later-printed",
        serviceStartDate: "2003-01-10",
        serviceEndDate: "2005-06-15",
        serviceStartDateSource: "printed",
        sourceDocument: "dd214-synthetic.pdf",
      },
      {
        id: "earlier-calculated",
        serviceStartDate: "1998-01-05",
        serviceEndDate: "2001-12-20",
        serviceStartDateDerived: true,
        sourceDocument: "ngb22-synthetic.pdf",
      },
    ];
    expect(pickServiceEntry(periods)).toMatchObject({
      date: "1998-01-05",
      derived: true,
      source: "calculated",
      periodId: "earlier-calculated",
    });
  });

  it("breaks a same-calendar-day tie across enlistments by higher source rank", () => {
    const periods = [
      {
        id: "calculated",
        serviceStartDate: "2002-01-10",
        serviceEndDate: "2005-06-15",
        serviceStartDateDerived: true,
        sourceDocument: "ngb22-synthetic.pdf",
      },
      {
        id: "printed",
        serviceStartDate: "2002-01-10",
        serviceEndDate: "2009-06-15",
        serviceStartDateSource: "printed",
        sourceDocument: "dd214-synthetic.pdf",
      },
    ];
    expect(pickServiceEntry(periods)).toMatchObject({
      date: "2002-01-10",
      source: "printed",
      periodId: "printed",
    });
  });
});

describe("pickServiceEntry: windows and legacy fallback", () => {
  it("never treats a Box-18 window as an entry candidate", () => {
    const periods = [
      {
        id: "window",
        serviceStartDate: "1990-01-01",
        serviceEndDate: "1990-02-01",
        periodScope: "window",
      },
      {
        id: "enlistment",
        serviceStartDate: "2002-03-05",
        serviceEndDate: "2010-06-15",
        serviceStartDateSource: "printed",
      },
    ];
    expect(pickServiceEntry(periods)).toMatchObject({
      date: "2002-03-05",
      periodId: "enlistment",
    });
  });

  it("falls back to the legacy value only when no period has a usable date", () => {
    expect(
      pickServiceEntry([], { date: "2001-05-01", derived: true }),
    ).toMatchObject({
      date: "2001-05-01",
      derived: true,
      source: "calculated",
      periodId: null,
    });
    expect(
      pickServiceEntry([], { date: "2001-05-01", derived: false }),
    ).toMatchObject({
      date: "2001-05-01",
      derived: false,
      source: "printed",
      periodId: null,
    });
    expect(pickServiceEntry([], null)).toMatchObject({
      date: null,
      derived: false,
      source: null,
      periodId: null,
    });
  });
});

describe("periodStartSource", () => {
  it("infers code_sheet from a sources[] contributor, never infers veteran from userEdited", () => {
    expect(
      periodStartSource({
        serviceStartDate: "2002-01-01",
        userEdited: true,
        sources: [{ sourceDocument: "x", formType: "Code Sheet" }],
      }),
    ).toBe("code_sheet");
    expect(
      periodStartSource({ serviceStartDate: "2002-01-01", userEdited: true }),
    ).toBe("printed");
  });
});

describe("isSameCalendarDay", () => {
  it("has no tolerance, unlike dateUtils.isSameDate", () => {
    expect(isSameCalendarDay("2002-01-10", "2002-01-10")).toBe(true);
    expect(isSameCalendarDay("2002-01-10", "01/10/2002")).toBe(true);
    expect(isSameCalendarDay("2002-01-10", "2002-01-11")).toBe(false);
    expect(isSameCalendarDay("2002-01-10", null)).toBe(false);
    expect(isSameCalendarDay(null, null)).toBe(false);
  });
});

describe("isStableSourceDocument", () => {
  it("rejects empty, legacy generic labels, and migration pseudo-sources", () => {
    expect(isStableSourceDocument("")).toBe(false);
    expect(isStableSourceDocument("DD-214")).toBe(false);
    expect(isStableSourceDocument("VA code sheet")).toBe(false);
    expect(isStableSourceDocument("Migrated (manual profile entry)")).toBe(
      false,
    );
    expect(isStableSourceDocument("ngb22-synthetic.pdf")).toBe(true);
  });
});
