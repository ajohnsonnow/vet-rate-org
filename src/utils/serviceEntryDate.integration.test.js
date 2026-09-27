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
      serviceStartDate: "2001-11-01",
      serviceStartDateDerived: false,
    });

    // After the edit: every consumer shows the veteran's date, unmarked.
    expect(getServiceEntry()).toMatchObject({
      date: "2001-11-01",
      derived: false,
      source: "veteran",
    });

    const prompt = buildSystemPrompt({
      includeAppContext: false,
      includeRegulations: false,
    });
    expect(prompt).toContain("- Entry Date: 2001-11-01\n");
    expect(prompt).not.toContain("calculated from net service");

    const dossier = generateDossierHTML();
    expect(dossier).toContain("2001-11-01");
    expect(dossier).not.toContain("calculated from net service");

    const summary = summarizeServicePeriods(getServicePeriods());
    expect(summary.serviceSpan).toMatchObject({
      start: "2001-11-01",
      startDerived: false,
    });
  });
});
