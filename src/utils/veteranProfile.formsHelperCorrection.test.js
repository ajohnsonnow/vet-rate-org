/**
 * ADR-007: FormsHelper's handleSaveProfile no longer writes a corrected
 * serviceStartDate straight to the flat profile field - it routes through
 * setServiceEntryDate (via: 'forms_helper'), the one write API every
 * service-entry-date editor shares, which applies the correction directly
 * to the canonical period so every consumer of getServiceEntry() agrees
 * immediately. A stray direct write (saveVeteranProfile/updateVeteranProfile
 * bypassing that API) is blocked by the chokepoint instead of ever reaching
 * getServiceEntry(). Fixture values are synthetic, not any real veteran's
 * data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertServicePeriod,
  updateVeteranProfile,
  setServiceEntryDate,
  getServiceEntry,
} from "./veteranProfile";

describe("getServiceEntry: a FormsHelper correction via setServiceEntryDate reaches a still-calculated period", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("prefers FormsHelper's corrected, non-derived date over a calculated NGB-22 period", () => {
    upsertServicePeriod(
      {
        serviceStartDate: "2002-03-08",
        serviceStartDateDerived: true,
        serviceEndDate: "2010-06-15",
        formType: "NGB22",
      },
      { sourceDocument: "ngb22.pdf", confidence: 60 },
    );
    expect(getServiceEntry()).toMatchObject({
      date: "2002-03-08",
      derived: true,
    });

    // FormsHelper.jsx's handleSaveProfile: setServiceEntryDate with the
    // veteran's typed date, no periodId (falls back to the current entry).
    const result = setServiceEntryDate({
      date: "2001-11-01",
      via: "forms_helper",
    });
    expect(result.ok).toBe(true);

    expect(getServiceEntry()).toMatchObject({
      date: "2001-11-01",
      derived: false,
      source: "veteran",
    });
  });

  it("a stray direct flat write never overrides an already-printed period", () => {
    upsertServicePeriod(
      {
        serviceStartDate: "2004-01-10",
        serviceStartDateDerived: false,
        serviceEndDate: "2010-06-15",
        formType: "DD214",
      },
      { sourceDocument: "dd214.pdf", confidence: 90 },
    );
    updateVeteranProfile({
      serviceStartDate: "1999-01-01",
      serviceStartDateDerived: false,
    });

    expect(getServiceEntry()).toMatchObject({
      date: "2004-01-10",
      derived: false,
    });
  });

  it("rejects an invalid via and an invalid date", () => {
    expect(
      setServiceEntryDate({ date: "2001-11-01", via: "bogus" }),
    ).toMatchObject({ ok: false, reason: "invalid_via" });
    expect(
      setServiceEntryDate({ date: "not a date", via: "forms_helper" }),
    ).toMatchObject({ ok: false, reason: "invalid_date" });
  });
});
