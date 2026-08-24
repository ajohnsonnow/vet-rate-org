/**
 * buildSystemPrompt's SERVICE HISTORY section read branch/MOS/dates/combat
 * off the top level of the stored vet_rate_service_history object, but
 * getServiceHistory() nests all of them under dd214Data. The section rendered
 * as a bare header for every veteran, so no AI tool was ever told the branch,
 * MOS, service dates, or combat status of the person it was advising.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { buildSystemPrompt } from "../../utils/aiSystemPrompts";

// The real shape veteranProfile.getServiceHistory() persists.
const storedServiceHistory = {
  deployments: [],
  awards: [{ name: "Combat Action Badge", isCombat: true }],
  servicePeriods: [],
  dutyStations: [],
  dd214Data: {
    branch: "Army",
    mos: "92Y20",
    entryDate: "2004-06-22",
    separationDate: "2007-06-29",
    yearsService: 3,
    characterOfService: "HONORABLE",
    combatService: {
      hasVerifiedCombat: true,
      indicators: ["Combat Action Badge"],
    },
  },
};

const promptWith = (history) => {
  localStorage.setItem("vet_rate_service_history", JSON.stringify(history));
  return buildSystemPrompt({
    includeAppContext: false,
    includeRegulations: false,
  });
};

describe("AI system prompt: SERVICE HISTORY section", () => {
  beforeEach(() => localStorage.clear());

  it("reads branch, MOS, dates and character of service out of dd214Data", () => {
    const prompt = promptWith(storedServiceHistory);
    expect(prompt).toContain("- Branch: Army");
    expect(prompt).toContain("- MOS/Rating: 92Y20");
    expect(prompt).toContain("- Entry Date: 2004-06-22");
    expect(prompt).toContain("- Separation Date: 2007-06-29");
    expect(prompt).toContain("- Character of Service: HONORABLE");
  });

  it("tells the model the combat presumption applies, and on what basis", () => {
    const prompt = promptWith(storedServiceHistory);
    expect(prompt).toContain(
      "- Combat Service: VERIFIED (Combat Action Badge)",
    );
    expect(prompt).toContain("38 U.S.C. 1154(b) applies");
    expect(prompt).toContain("3.304(f)(2)");
  });

  it("derives combat from the stored award list when dd214Data.combatService is absent", () => {
    // This is the real persisted shape: _sanitizeDd214Data (veteranProfile.js)
    // is a strict field whitelist that combatService is not on, so it is
    // dropped on every write. serviceHistory.awards survives and carries the
    // decoration the determination rests on.
    const { combatService, ...withoutCombat } = storedServiceHistory.dd214Data;
    expect(combatService).toBeDefined();
    const prompt = promptWith({
      ...storedServiceHistory,
      dd214Data: withoutCombat,
    });
    expect(prompt).toContain(
      "- Combat Service: VERIFIED (Combat Action Badge)",
    );
    expect(prompt).toContain("38 U.S.C. 1154(b) applies");
  });

  it("says nothing about combat when no decoration established it", () => {
    const prompt = promptWith({
      ...storedServiceHistory,
      awards: [],
      dd214Data: {
        ...storedServiceHistory.dd214Data,
        combatService: { hasVerifiedCombat: false, indicators: [] },
      },
    });
    expect(prompt).toContain("- Branch: Army");
    expect(prompt).not.toContain("Combat Service: VERIFIED");
    expect(prompt).not.toContain("1154(b) applies");
  });

  it("still reads a flat service-history object, which older records used", () => {
    const prompt = promptWith({ branch: "Navy", mos: "HM" });
    expect(prompt).toContain("- Branch: Navy");
    expect(prompt).toContain("- MOS/Rating: HM");
  });
});
