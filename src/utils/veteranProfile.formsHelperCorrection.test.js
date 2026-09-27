/**
 * FormsHelper.jsx's handleSaveProfile writes a veteran's corrected
 * serviceStartDate straight to the flat profile field (with
 * serviceStartDateDerived cleared), never through servicePeriods[] -
 * getServiceEntry() read servicePeriods[] first, so the correction never
 * reached the AI system prompt, the exported dossier, or the Service span:
 * they kept showing the original calculated guess. getServiceEntry() now
 * treats a non-derived profile.serviceStartDate as an override whenever
 * the canonical periods-based answer is missing or still a guess - but
 * never over an already-proven (non-derived) period. Fixture values are
 * synthetic, not any real veteran's data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertServicePeriod,
  updateVeteranProfile,
  saveVeteranProfile,
  getServiceEntry,
} from "./veteranProfile";

describe("getServiceEntry: a real profile.serviceStartDate overrides a still-calculated period", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("prefers FormsHelper's corrected, non-derived profile date over a calculated NGB-22 period", () => {
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

    // FormsHelper.jsx's handleSaveProfile: saveVeteranProfile(veteranProfile)
    // with the veteran's typed date and serviceStartDateDerived: false.
    saveVeteranProfile({
      fullName: "Jordan Sample",
      serviceStartDate: "2001-11-01",
      serviceStartDateDerived: false,
    });

    expect(getServiceEntry()).toMatchObject({
      date: "2001-11-01",
      derived: false,
      source: "veteran",
    });
  });

  it("never overrides an already-printed (non-derived) period with a stale profile field", () => {
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
});
