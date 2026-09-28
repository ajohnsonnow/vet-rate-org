/**
 * ADR-007: setServiceEntryDate is the one write API every service-entry-date
 * editor (Muster Call review, VKB viewer, My Packet, FormsHelper, the
 * DD214Analyzer import modal) routes through. Fixture values are synthetic,
 * not any real veteran's data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertServicePeriod,
  addServicePeriod,
  updateServicePeriod,
  removeServicePeriod,
  getServicePeriods,
  getServiceEntry,
  getServiceEntryForDocument,
  setServiceEntryDate,
  saveServiceHistory,
  getServiceHistory,
  isKnownServiceEntryDate,
  recordServiceEntryDisagreement,
  importVeteranData,
  getVeteranProfile,
  saveVeteranProfile,
} from "./veteranProfile";

const PROFILE_KEY = "vet_rate_veteran_profile";

function seedProfile() {
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ fullName: "Jordan Sample" }),
  );
}

function upsertNgb22(start, derived, end = "2010-06-15", confidence = 60) {
  return upsertServicePeriod(
    {
      serviceStartDate: start,
      serviceStartDateDerived: derived,
      serviceEndDate: end,
      formType: "NGB22",
    },
    { sourceDocument: "ngb22-synthetic.pdf", confidence },
  );
}

describe("setServiceEntryDate: target resolution", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("targets an explicit periodId", () => {
    const id = upsertNgb22("2002-03-05", true);
    const result = setServiceEntryDate({
      date: "2001-11-01",
      via: "vkb_viewer",
      periodId: id,
    });
    expect(result).toMatchObject({ ok: true, periodId: id });
    expect(getServiceEntry()).toMatchObject({
      date: "2001-11-01",
      source: "veteran",
    });
  });

  it("rejects a periodId that doesn't exist", () => {
    expect(
      setServiceEntryDate({
        date: "2001-11-01",
        via: "vkb_viewer",
        periodId: "nope",
      }),
    ).toMatchObject({ ok: false, reason: "period_not_found" });
  });

  it("targets by sourceDocument, and never falls back to the entry period when ambiguous", () => {
    upsertNgb22("2002-03-05", true, "2010-06-15");
    upsertServicePeriod(
      {
        serviceStartDate: "1998-01-05",
        serviceEndDate: "2001-12-20",
        formType: "DD214",
      },
      { sourceDocument: "dd214-synthetic.pdf", confidence: 90 },
    );
    // "other-file.pdf" has no period at all - must fail, not silently
    // fall back to whichever period the resolver would otherwise pick.
    expect(
      setServiceEntryDate({
        date: "2001-11-01",
        via: "muster_review",
        sourceDocument: "other-file.pdf",
      }),
    ).toMatchObject({ ok: false, reason: "no_period_for_document" });
  });

  it("falls back to the current entry period when no periodId/sourceDocument is given", () => {
    const id = upsertNgb22("2002-03-05", true);
    const result = setServiceEntryDate({
      date: "2001-11-01",
      via: "forms_helper",
    });
    expect(result).toMatchObject({ ok: true, periodId: id });
  });

  it("uses flat-profile mode when no period exists at all", () => {
    const result = setServiceEntryDate({
      date: "2001-11-01",
      via: "forms_helper",
    });
    expect(result).toMatchObject({ ok: true, periodId: null });
    expect(getVeteranProfile()).toMatchObject({
      serviceStartDate: "2001-11-01",
      serviceStartDateDerived: false,
    });
    expect(getVeteranProfile().profileFieldSources.serviceStartDate).toBe(
      "user",
    );
  });
});

describe("setServiceEntryDate: validation", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("rejects an unknown via", () => {
    expect(
      setServiceEntryDate({ date: "2001-11-01", via: "bogus" }),
    ).toMatchObject({
      ok: false,
      reason: "invalid_via",
    });
  });

  it("rejects a date that doesn't parse", () => {
    expect(
      setServiceEntryDate({ date: "not-a-date", via: "my_packet" }),
    ).toMatchObject({ ok: false, reason: "invalid_date" });
  });
});

describe("setServiceEntryDate: revert semantics", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("reverts to the document's own value on an empty date", () => {
    const id = upsertNgb22("2002-03-05", true);
    setServiceEntryDate({ date: "2001-11-01", via: "my_packet", periodId: id });
    expect(getServiceEntry()).toMatchObject({
      date: "2001-11-01",
      source: "veteran",
    });

    const revertResult = setServiceEntryDate({
      date: "",
      via: "my_packet",
      periodId: id,
    });
    expect(revertResult).toMatchObject({ ok: true, periodId: id });
    expect(getServiceEntry()).toMatchObject({
      date: "2002-03-05",
      derived: true,
      source: "calculated",
    });
  });

  it("reverts (and clears the correction marker) when the typed value equals the document's date", () => {
    const id = upsertNgb22("2002-03-05", true);
    setServiceEntryDate({ date: "2001-11-01", via: "my_packet", periodId: id });

    setServiceEntryDate({ date: "2002-03-05", via: "my_packet", periodId: id });
    const period = getServicePeriods().find((p) => p.id === id);
    expect(period.startDateCorrection).toBeNull();
    expect(period.serviceStartDateSource).toBe("calculated");
  });

  it("clears a veteran-created period (no document) on an empty value", () => {
    const id = addServicePeriod({
      serviceStartDate: "2001-11-01",
      serviceEndDate: "2005-11-01",
    });
    const result = setServiceEntryDate({
      date: "",
      via: "my_packet",
      periodId: id,
    });
    expect(result).toMatchObject({ ok: true, periodId: id });
    const period = getServicePeriods().find((p) => p.id === id);
    expect(period.serviceStartDate).toBeNull();
    expect(period.serviceStartDateSource).toBeNull();
  });
});

describe("D12-1b: a correction to a LATER date replaces a calculated start", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("earliest-wins no longer decides once a veteran correction exists", () => {
    const id = upsertNgb22("2002-01-10", true);
    const result = setServiceEntryDate({
      date: "2002-08-01",
      via: "muster_review",
      periodId: id,
    });
    expect(result.ok).toBe(true);
    expect(getServiceEntry()).toMatchObject({
      date: "2002-08-01",
      derived: false,
      source: "veteran",
    });
    // Unedited re-import of the same document must not revert it.
    upsertNgb22("2002-01-10", true);
    expect(getServiceEntry()).toMatchObject({
      date: "2002-08-01",
      derived: false,
    });
  });
});

describe("D12-2: a review correction far from the calculated date leaves exactly one period", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("does not create a second period for the same document/enlistment", () => {
    const id = upsertNgb22("2002-01-10", true);
    setServiceEntryDate({
      date: "2002-08-01",
      via: "muster_review",
      periodId: id,
    });

    const filtered = getServicePeriods().filter((p) => p.formType === "NGB22");
    expect(filtered).toHaveLength(1);

    upsertNgb22("2002-01-10", true);
    expect(
      getServicePeriods().filter((p) => p.formType === "NGB22"),
    ).toHaveLength(1);
  });
});

describe("G6: a legacy My Packet-corrected period re-imported adds no duplicate", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("same-document identity rule matches by (filename, end date) even after a correction", () => {
    const id = upsertNgb22("2002-01-10", true);
    setServiceEntryDate({
      date: "2002-08-01",
      via: "legacy_edit",
      periodId: id,
    });

    // Re-import with no documentDate correction alias needed - the
    // same-document rule (stable filename + matching end date) still finds
    // this exact period.
    upsertNgb22("2002-01-10", true);

    expect(getServicePeriods()).toHaveLength(1);
    expect(getServiceEntry()).toMatchObject({
      date: "2002-08-01",
      source: "veteran",
    });
  });
});

describe("F2: precedence within one enlistment beats chronology", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("a veteran correction outranks a code sheet contributor sharing the same enlistment", () => {
    // A code sheet upsert merges directly onto the SAME period the NGB-22
    // produced (both key on (start, end) within tolerance the first time,
    // before any correction moves the start out of range) - the resulting
    // single period's own source becomes 'code_sheet' until corrected.
    const ngbId = upsertNgb22("2002-03-08", true, "2010-06-15");
    upsertServicePeriod(
      {
        serviceStartDate: "2002-03-01",
        serviceEndDate: "2010-06-15",
        formType: "Code Sheet",
      },
      {
        sourceDocument: "codesheet-synthetic.pdf",
        confidence: 100,
        authoritativeDates: true,
      },
    );
    expect(getServiceEntry()).toMatchObject({
      source: "code_sheet",
      periodId: ngbId,
    });

    setServiceEntryDate({
      date: "2003-01-01",
      via: "my_packet",
      periodId: ngbId,
    });
    expect(getServiceEntry()).toMatchObject({
      date: "2003-01-01",
      source: "veteran",
    });
  });
});

describe("setServiceEntryDate: sourceDocument targeting survives a later source outranking the period's start", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("still resolves by (filename, end date) once a code sheet has moved the period's effective start away from what the NGB-22 itself printed", () => {
    const ngbId = upsertNgb22("2002-03-05", true, "2010-06-15");
    upsertServicePeriod(
      {
        serviceStartDate: "2002-03-01",
        serviceEndDate: "2010-06-15",
        formType: "Code Sheet",
      },
      {
        sourceDocument: "codesheet-synthetic.pdf",
        confidence: 100,
        authoritativeDates: true,
      },
    );
    expect(getServicePeriods()).toHaveLength(1);
    expect(getServiceEntry()).toMatchObject({
      source: "code_sheet",
      periodId: ngbId,
    });

    const result = setServiceEntryDate({
      date: "2002-01-15",
      via: "muster_review",
      sourceDocument: "ngb22-synthetic.pdf",
      documentStartDate: "2002-03-05",
      documentEndDate: "2010-06-15",
    });

    expect(result).toMatchObject({ ok: true, periodId: ngbId });
    expect(getServiceEntry()).toMatchObject({
      date: "2002-01-15",
      source: "veteran",
    });
  });
});

describe("a code sheet for the same enlistment, filed separately, must not override a veteran's correction", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("keeps the veteran's correction as the entry once the far-off code sheet lands as its own period", () => {
    const ngbId = upsertNgb22("2002-03-05", true, "2010-06-15");
    setServiceEntryDate({
      date: "2001-09-10",
      via: "forms_helper",
      periodId: ngbId,
    });

    // >7 days from both the correction and the calculated start, and a
    // different file, so identity matching creates a second period
    // instead of merging onto the NGB-22 period.
    upsertServicePeriod(
      {
        serviceStartDate: "2001-09-01",
        serviceEndDate: "2010-06-15",
        formType: "Code Sheet",
      },
      {
        sourceDocument: "codesheet-synthetic.pdf",
        confidence: 100,
        authoritativeDates: true,
      },
    );

    expect(getServicePeriods()).toHaveLength(2);
    expect(getServiceEntry()).toMatchObject({
      date: "2001-09-10",
      source: "veteran",
      periodId: ngbId,
    });
  });
});

describe("saveServiceHistory: schemaVersion default and round-trip (G9)", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("a save without schemaVersion stores 2, and the next read migrates to 3", () => {
    const history = getServiceHistory();
    delete history.schemaVersion;
    saveServiceHistory(history);

    const raw = JSON.parse(localStorage.getItem("vet_rate_service_history"));
    expect(raw.schemaVersion).toBe(2);

    const reread = getServiceHistory();
    expect(reread.schemaVersion).toBe(3);
  });

  it("round-trips serviceStartDateSource and startDateCorrection", () => {
    const id = upsertNgb22("2002-01-10", true);
    setServiceEntryDate({ date: "2002-08-01", via: "my_packet", periodId: id });

    const period = getServicePeriods().find((p) => p.id === id);
    expect(period.serviceStartDateSource).toBe("veteran");
    expect(period.startDateCorrection).toMatchObject({
      via: "my_packet",
      documentDate: "2002-01-10",
      documentSource: "calculated",
    });
  });
});

describe("G4: the sanitizer keeps 'calculated' for a writer that supplies only serviceStartDateDerived", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("a raw period with serviceStartDateDerived:true and no explicit source stays calculated", () => {
    const history = getServiceHistory();
    history.servicePeriods.push({
      id: "raw_period",
      serviceStartDate: "2002-01-10",
      serviceEndDate: "2010-06-15",
      serviceStartDateDerived: true,
    });
    saveServiceHistory(history);

    const saved = getServicePeriods().find((p) => p.id === "raw_period");
    expect(saved.serviceStartDateSource).toBe("calculated");
    expect(saved.serviceStartDateDerived).toBe(true);
  });
});

describe("recordServiceEntryDisagreement and isKnownServiceEntryDate", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("records a deduplicated conflict on the entry period, and is a no-op with no period", () => {
    expect(recordServiceEntryDisagreement("1990-01-01", "Some source")).toBe(
      false,
    );

    const id = upsertNgb22("2002-01-10", true);
    expect(
      recordServiceEntryDisagreement("1998-05-01", "Earlier DD-214 record"),
    ).toBe(true);
    expect(
      recordServiceEntryDisagreement("1998-05-01", "Earlier DD-214 record"),
    ).toBe(false);

    const period = getServicePeriods().find((p) => p.id === id);
    expect(period.fieldConflicts).toHaveLength(1);
    expect(isKnownServiceEntryDate("1998-05-01")).toBe(true);
  });
});

describe("getServiceEntryForDocument", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("returns the document's own period, distinct from the overall entry", () => {
    upsertNgb22("2002-01-10", true, "2010-06-15");
    upsertServicePeriod(
      {
        serviceStartDate: "1998-01-05",
        serviceEndDate: "2001-12-20",
        formType: "DD214",
      },
      { sourceDocument: "dd214-synthetic.pdf", confidence: 90 },
    );
    // Overall entry is the earlier DD-214 enlistment [DR-1].
    expect(getServiceEntry()).toMatchObject({ date: "1998-01-05" });
    // But the NGB-22 document's own period is unaffected.
    expect(getServiceEntryForDocument("ngb22-synthetic.pdf")).toMatchObject({
      date: "2002-01-10",
      derived: true,
    });
    expect(getServiceEntryForDocument("no-such-file.pdf")).toBeNull();
  });
});

describe("_importProfile: a restored backup's disagreeing flat date is recorded, not silently dropped", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("records a conflict instead of letting the chokepoint silently discard it", () => {
    upsertNgb22("2002-01-10", true);
    const result = importVeteranData(
      {
        profile: {
          fullName: "Jordan Sample",
          serviceStartDate: "1995-01-01",
          serviceStartDateDerived: false,
        },
      },
      "merge",
    );
    expect(result.success).toBe(true);
    expect(isKnownServiceEntryDate("1995-01-01")).toBe(true);
  });
});

describe("property: import order does not change the resolved entry", () => {
  it("NGB-22 then code sheet, and the reverse, converge on the same entry", () => {
    localStorage.clear();
    seedProfile();
    upsertNgb22("2002-03-05", true, "2010-06-15");
    upsertServicePeriod(
      {
        serviceStartDate: "2002-03-01",
        serviceEndDate: "2010-06-15",
        formType: "Code Sheet",
      },
      {
        sourceDocument: "va code sheet",
        confidence: 100,
        authoritativeDates: true,
      },
    );
    const orderA = getServiceEntry();

    localStorage.clear();
    seedProfile();
    upsertServicePeriod(
      {
        serviceStartDate: "2002-03-01",
        serviceEndDate: "2010-06-15",
        formType: "Code Sheet",
      },
      {
        sourceDocument: "va code sheet",
        confidence: 100,
        authoritativeDates: true,
      },
    );
    upsertNgb22("2002-03-05", true, "2010-06-15");
    const orderB = getServiceEntry();

    expect(orderA).toMatchObject({ date: "2002-03-01", source: "code_sheet" });
    expect(orderB).toMatchObject({ date: "2002-03-01", source: "code_sheet" });
  });
});

describe("saveVeteranProfile chokepoint: F3 provenance labels", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("a MOS edit keeps 'calculated'; a review correction reports 'veteran'; a code-sheet start reports 'code_sheet'", () => {
    const id = upsertNgb22("2002-01-10", true);
    updateServicePeriod(id, { mos: "11B" });
    expect(getServiceEntry()).toMatchObject({ source: "calculated" });

    setServiceEntryDate({
      date: "2002-08-01",
      via: "muster_review",
      periodId: id,
    });
    expect(getServiceEntry()).toMatchObject({ source: "veteran" });

    localStorage.clear();
    seedProfile();
    upsertServicePeriod(
      {
        serviceStartDate: "1999-06-01",
        serviceEndDate: "2010-06-15",
        formType: "Code Sheet",
      },
      {
        sourceDocument: "va code sheet",
        confidence: 100,
        authoritativeDates: true,
      },
    );
    expect(getServiceEntry()).toMatchObject({ source: "code_sheet" });
  });
});

describe("removeServicePeriod: deleting a mistaken period must not adopt its date onto another enlistment", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("leaves the calculated NGB-22 entry alone once the veteran's mistaken period is deleted", () => {
    const ngbId = upsertNgb22("2002-03-05", true, "2010-06-15");
    const mistakenId = addServicePeriod({
      serviceStartDate: "2001-01-01",
      serviceEndDate: "2001-12-31",
    });
    expect(getServiceEntry()).toMatchObject({
      date: "2001-01-01",
      periodId: mistakenId,
    });

    removeServicePeriod(mistakenId);

    expect(getServiceEntry()).toMatchObject({
      date: "2002-03-05",
      derived: true,
      source: "calculated",
      periodId: ngbId,
    });
    const ngbPeriod = getServicePeriods().find((p) => p.id === ngbId);
    expect(ngbPeriod.serviceStartDateSource).toBe("calculated");
    expect(ngbPeriod.startDateCorrection).toBeNull();
  });

  it("does not resurrect a deleted DD-214 correction as a spurious conflict on the remaining period", () => {
    const ngbId = upsertNgb22("2002-03-05", true, "2010-06-15");
    const dd214Id = upsertServicePeriod(
      {
        serviceStartDate: "1998-01-05",
        serviceEndDate: "1999-12-20",
        formType: "DD214",
      },
      { sourceDocument: "dd214-synthetic.pdf", confidence: 90 },
    );
    setServiceEntryDate({
      date: "2000-05-01",
      via: "vkb_viewer",
      periodId: dd214Id,
    });

    removeServicePeriod(dd214Id);

    const ngbPeriod = getServicePeriods().find((p) => p.id === ngbId);
    expect(ngbPeriod.serviceStartDateSource).toBe("calculated");
    expect(ngbPeriod.fieldConflicts ?? []).toHaveLength(0);
  });
});

describe("saveVeteranProfile: no side effect when profile save fails validation upstream", () => {
  it("still returns a boolean and never throws", () => {
    localStorage.clear();
    expect(() => saveVeteranProfile(null)).not.toThrow();
    expect(saveVeteranProfile(null)).toBe(false);
  });
});
