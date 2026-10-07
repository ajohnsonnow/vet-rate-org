/**
 * ADR-007: servicePeriods[] is the one authoritative store; the flat
 * profile.serviceStartDate/serviceStartDateDerived/profileFieldSources
 * mirror is now a PROJECTION, written only by saveServiceHistory's own
 * projection step and saveVeteranProfile's chokepoint - never by a
 * dedicated "sync" call site. Fixture values are synthetic, not any real
 * veteran's data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  addServicePeriod,
  updateServicePeriod,
  removeServicePeriod,
  upsertServicePeriod,
  updateVeteranProfile,
  getVeteranProfile,
  getServiceEntry,
} from "./veteranProfile";

const PROFILE_KEY = "vet_rate_veteran_profile";

// The projection only ever read-modify-writes an EXISTING profile key
// (never creates one) - matches every real caller, which always has a
// profile from onboarding before any service document is imported.
function seedProfile() {
  localStorage.clear();
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ fullName: "Jordan Sample" }),
  );
}

describe("saveServiceHistory's projection keeps profile.serviceStartDate in sync (for FormsHelper)", () => {
  beforeEach(seedProfile);

  it("addServicePeriod (always the veteran's own entry) projects into the flat mirror", () => {
    addServicePeriod({
      serviceStartDate: "2001-11-01",
      serviceEndDate: "2009-11-01",
    });

    const profile = getVeteranProfile();
    expect(profile.serviceStartDate).toBe("2001-11-01");
    expect(profile.serviceStartDateDerived).toBe(false);
    expect(profile.profileFieldSources.serviceStartDate).toBe("user");
  });

  it("updateServicePeriod's start correction re-projects the mirror and clears its derived flag", () => {
    const id = upsertServicePeriod(
      {
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: true,
        serviceEndDate: "2010-06-15",
        formType: "NGB22",
      },
      { sourceDocument: "ngb22.pdf", confidence: 60 },
    );
    expect(getVeteranProfile().serviceStartDateDerived).toBe(true);

    updateServicePeriod(id, { serviceStartDate: "2001-11-01" });

    const profile = getVeteranProfile();
    expect(profile.serviceStartDate).toBe("2001-11-01");
    expect(profile.serviceStartDateDerived).toBe(false);
  });

  it("an unrelated field edit on an already-corrected period never reverts the mirror to a guess", () => {
    const id = upsertServicePeriod(
      {
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: true,
        serviceEndDate: "2010-06-15",
        formType: "NGB22",
      },
      { sourceDocument: "ngb22.pdf", confidence: 60 },
    );
    updateServicePeriod(id, { serviceStartDate: "2001-11-01" });

    // My Packet edits an unrelated field on the same (now veteran-sourced)
    // period - this must never touch the start date the veteran already
    // corrected (invariant I4: ingest, and any non-start-date edit, never
    // changes the effective start of a 'veteran' period).
    updateServicePeriod(id, { mos: "11B" });

    const profile = getVeteranProfile();
    expect(profile.serviceStartDate).toBe("2001-11-01");
    expect(profile.serviceStartDateDerived).toBe(false);
    expect(getServiceEntry()).toMatchObject({
      date: "2001-11-01",
      derived: false,
      source: "veteran",
      periodId: id,
    });
  });
});

describe("saveVeteranProfile chokepoint and removeServicePeriod projection", () => {
  beforeEach(seedProfile);

  it("saveVeteranProfile's chokepoint blocks a stray direct write while a period backs the entry", () => {
    upsertServicePeriod(
      {
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: true,
        serviceEndDate: "2010-06-15",
        formType: "NGB22",
      },
      { sourceDocument: "ngb22.pdf", confidence: 60 },
    );

    // A caller that bypasses setServiceEntryDate and writes the flat field
    // directly (the D12-3 stale-Save-Profile shape) can never overwrite the
    // projection - the chokepoint replaces its payload values instead.
    updateVeteranProfile({
      serviceStartDate: "2001-11-01",
      serviceStartDateDerived: false,
    });

    expect(getVeteranProfile().serviceStartDate).toBe("2002-03-05");
    expect(getVeteranProfile().serviceStartDateDerived).toBe(true);
  });

  it("removeServicePeriod re-projects the mirror onto the next-earliest remaining period", () => {
    const earliestId = addServicePeriod({
      serviceStartDate: "2001-11-01",
      serviceEndDate: "2005-11-01",
    });
    addServicePeriod({
      serviceStartDate: "2006-01-01",
      serviceEndDate: "2010-01-01",
    });
    expect(getVeteranProfile().serviceStartDate).toBe("2001-11-01");

    removeServicePeriod(earliestId);

    expect(getVeteranProfile().serviceStartDate).toBe("2006-01-01");
  });
});
