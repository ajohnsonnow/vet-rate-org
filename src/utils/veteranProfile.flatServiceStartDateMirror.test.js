/**
 * FormsHelper.jsx's prefill (buildFormsHelperPrefillDefaults) reads
 * profile.serviceStartDate/serviceStartDateDerived directly, not through
 * getServiceEntry() - a My Packet Service tab edit (updateServicePeriod)
 * only ever touched getServiceHistory().servicePeriods[], leaving that flat
 * mirror stale. addServicePeriod/updateServicePeriod/removeServicePeriod
 * now keep it in sync, so FormsHelper sees the correction without needing
 * to change at all. upsertServicePeriod (document ingestion) deliberately
 * does NOT get this treatment - autoPopulateProfile already owns that path
 * with its own never-overwrite-user-edited protection; syncing here too
 * would bypass it. Fixture values are synthetic, not any real veteran's
 * data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  addServicePeriod,
  updateServicePeriod,
  removeServicePeriod,
  updateVeteranProfile,
  getVeteranProfile,
} from "./veteranProfile";

describe("service period editors keep profile.serviceStartDate in sync (for FormsHelper)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("addServicePeriod populates the flat mirror for a brand-new period", () => {
    addServicePeriod({
      serviceStartDate: "2001-11-01",
      serviceStartDateDerived: false,
      serviceEndDate: "2009-11-01",
    });

    const profile = getVeteranProfile();
    expect(profile.serviceStartDate).toBe("2001-11-01");
    expect(profile.serviceStartDateDerived).toBe(false);
  });

  it("updateServicePeriod corrects the flat mirror and clears its derived flag", () => {
    const id = addServicePeriod({
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
      serviceEndDate: "2010-06-15",
    });
    expect(getVeteranProfile().serviceStartDateDerived).toBe(true);

    updateServicePeriod(id, {
      serviceStartDate: "2001-11-01",
      serviceStartDateDerived: false,
    });

    const profile = getVeteranProfile();
    expect(profile.serviceStartDate).toBe("2001-11-01");
    expect(profile.serviceStartDateDerived).toBe(false);
  });

  it("does not let an unrelated field edit on a still-calculated period clobber a real profile date with a guess", () => {
    // Simulates: profile.serviceStartDate already holds FormsHelper's real,
    // non-derived correction, while the canonical period is still an
    // unresolved calculated NGB-22 guess (a different edit path, e.g.
    // Muster Call, never corrected servicePeriods[] itself).
    const id = addServicePeriod({
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
      serviceEndDate: "2010-06-15",
    });
    updateVeteranProfile({
      serviceStartDate: "2001-11-01",
      serviceStartDateDerived: false,
    });

    // My Packet edits an unrelated field on the same (still-calculated)
    // period.
    updateServicePeriod(id, { mos: "11B" });

    const profile = getVeteranProfile();
    expect(profile.serviceStartDate).toBe("2001-11-01");
    expect(profile.serviceStartDateDerived).toBe(false);
  });

  it("removeServicePeriod updates the mirror to the next-earliest remaining period", () => {
    const earliestId = addServicePeriod({
      serviceStartDate: "2001-11-01",
      serviceStartDateDerived: false,
      serviceEndDate: "2005-11-01",
    });
    addServicePeriod({
      serviceStartDate: "2006-01-01",
      serviceStartDateDerived: false,
      serviceEndDate: "2010-01-01",
    });
    expect(getVeteranProfile().serviceStartDate).toBe("2001-11-01");

    removeServicePeriod(earliestId);

    expect(getVeteranProfile().serviceStartDate).toBe("2006-01-01");
  });
});
