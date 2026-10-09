/**
 * Integration coverage for the single-source-of-truth fix
 * (docs/adr/ADR-004-service-entry-date-single-source-of-truth.md): a single
 * veteran edit through the canonical servicePeriods[] editor
 * (updateServicePeriod - the mechanism My Packet's Service tab editor
 * calls) must be visible, with no "(calculated from net service)" marker,
 * to every consumer that used to read its own independent copy: the AI
 * system prompt (aiSystemPrompts.js, previously dd214Data), the exported
 * dossier (dossierExport.js, previously profile.serviceStartDate directly),
 * and the Service tab's own summary (summarizeServicePeriods). Fixture
 * values are synthetic, not any real veteran's data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertServicePeriod,
  updateServicePeriod,
  getServicePeriods,
  getServiceEntry,
  summarizeServicePeriods,
} from "./veteranProfile";
import { buildSystemPrompt } from "./aiSystemPrompts";
import { generateDossierHTML } from "./dossierExport";

const PROFILE_KEY = "vet_rate_veteran_profile";

describe("service entry date: one edit, every consumer agrees", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ fullName: "Jordan Sample" }),
    );
  });

  it("shows the veteran's corrected date, unmarked, everywhere", () => {
    const id = upsertServicePeriod(
      {
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: true,
        serviceEndDate: "2010-06-15",
        branch: "Army National Guard",
        formType: "NGB22",
      },
      { sourceDocument: "ngb22.pdf", confidence: 60 },
    );

    // Before the edit: every consumer calls it calculated.
    expect(getServiceEntry()).toMatchObject({
      date: "2002-03-05",
      derived: true,
    });
    expect(
      buildSystemPrompt({
        includeAppContext: false,
        includeRegulations: false,
      }),
    ).toContain("- Entry Date: 2002-03-05 (calculated from net service)");
    expect(generateDossierHTML()).toContain(
      "2002-03-05 (calculated from net service)",
    );

    // The veteran corrects it (My Packet's Service tab editor).
    updateServicePeriod(id, {
      serviceStartDate: "1998-11-01",
      serviceStartDateDerived: false,
    });

    // After the edit: every consumer shows the veteran's date, unmarked.
    expect(getServiceEntry()).toMatchObject({
      date: "1998-11-01",
      derived: false,
      source: "veteran",
    });

    const prompt = buildSystemPrompt({
      includeAppContext: false,
      includeRegulations: false,
    });
    expect(prompt).toContain("- Entry Date: 1998-11-01\n");
    expect(prompt).not.toContain("calculated from net service");

    const dossier = generateDossierHTML();
    expect(dossier).toContain("1998-11-01");
    expect(dossier).not.toContain("calculated from net service");

    const summary = summarizeServicePeriods(getServicePeriods());
    expect(summary.serviceSpan).toMatchObject({
      start: "1998-11-01",
      startDerived: false,
    });
  });
});

// Mirrors musterCallProcessor.js's _savePrimaryServicePeriod call shape for
// an NGB-22 (same sourceDocument each time - the identity a re-persist or
// re-import shares with the original extraction).
function upsertNgb22Period(serviceStartDate, derived) {
  upsertServicePeriod(
    {
      serviceStartDate,
      serviceStartDateDerived: derived,
      serviceEndDate: "2010-06-15",
      branch: "Army National Guard",
      formType: "NGB22",
    },
    { sourceDocument: "ngb22.pdf", confidence: 60 },
  );
}

describe("D11-1: a Muster Call review correction reaches servicePeriods[] on re-persist", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ fullName: "Jordan Sample" }),
    );
  });

  it("overwrites the calculated period when Verify & Save re-runs persistFormationDocument for the same file", () => {
    // Initial extraction: musterCallProcessor.js's saveServiceRecordToProfile
    // (_savePrimaryServicePeriod) upserts the calculated guess.
    upsertNgb22Period("2002-03-05", true);
    expect(getServiceEntry()).toMatchObject({
      date: "2002-03-05",
      derived: true,
    });

    // Verify & Save re-runs the exact same call for the same file, with the
    // veteran's corrected fields spliced in (useSequentialFormationFlow.js's
    // runVerifyAndSave -> persistFormationDocument -> saveServiceRecordToProfile).
    upsertNgb22Period("2002-03-01", false);

    expect(getServicePeriods()).toHaveLength(1);
    // ADR-007: the corrected date came from the same document re-scanned
    // with a printed (non-derived) value, not a veteran-typed correction -
    // it reports provenance 'printed', not 'veteran'.
    expect(getServiceEntry()).toMatchObject({
      date: "2002-03-01",
      derived: false,
      source: "printed",
    });

    const prompt = buildSystemPrompt({
      includeAppContext: false,
      includeRegulations: false,
    });
    expect(prompt).toContain("- Entry Date: 2002-03-01\n");
    expect(prompt).not.toContain("calculated from net service");

    const dossier = generateDossierHTML();
    expect(dossier).toContain("2002-03-01");
    expect(dossier).not.toContain("calculated from net service");
  });

  it("does not let a later, uncorrected re-import regress an already-corrected period", () => {
    upsertNgb22Period("2002-03-05", true);
    upsertNgb22Period("2002-03-01", false);

    // A later, plain re-import (no correction this time) re-extracts the
    // SAME raw calculated guess it always would from this document.
    upsertNgb22Period("2002-03-05", true);

    expect(getServiceEntry()).toMatchObject({
      date: "2002-03-01",
      derived: false,
    });
  });
});
