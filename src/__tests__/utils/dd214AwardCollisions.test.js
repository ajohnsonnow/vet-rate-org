/**
 * Award-name collision coverage for parseDD214Text().
 *
 * MASTER_AWARDS merges 780 state/territory National Guard awards on top of the
 * 89 federal ones, producing 12 groups where a state award's name or
 * abbreviation contains a federal award's verbatim (e.g. 39 states have a
 * "<State> Distinguished Service Medal"). Without span-based suppression the
 * federal award gets fabricated from state-only text, with no state
 * affiliation required.
 *
 * Group D is the regression net for the inverse failure: suppression must be
 * driven by ALL occurrences of a match, not just the first, or a document
 * naming an award both nested and standalone silently loses the real award.
 */
import { describe, it, expect } from "vitest";
import { parseDD214Text } from "../../utils/ribbonRackData";

const names = (text, branch = "Army", state = null) =>
  parseDD214Text(text, branch, state).map((a) => a.award.name);

const PAD = "13. DECORATIONS MEDALS BADGES CITATIONS: ";

// [label, stateCode, state award name as it appears in text, state award
//  canonical name, federal award canonical name]
const GROUPS = [
  ["MSM/AK", "AK", "ALASKA MERITORIOUS SERVICE MEDAL", "Alaska Meritorious Service Medal", "Meritorious Service Medal"],
  ["LoM/CA", "CA", "CALIFORNIA LEGION OF MERIT", "California Legion of Merit", "Legion of Merit"],
  ["MoH/TX", "TX", "TEXAS MEDAL OF HONOR", "Texas Legislative Medal of Honor", "Medal of Honor"],
  ["MoH/AR", "AR", "ARKANSAS MEDAL OF HONOR", "Arkansas Medal of Honor", "Medal of Honor"],
  ["DSM/TX", "TX", "TEXAS DISTINGUISHED SERVICE MEDAL", "Lone Star Distinguished Service Medal", "Army Distinguished Service Medal"],
  ["DSC/IN", "IN", "INDIANA DISTINGUISHED SERVICE CROSS", "Indiana Distinguished Service Cross", "Distinguished Service Cross"],
  ["GCM/NM", "NM", "NEW MEXICO GOOD CONDUCT MEDAL", "New Mexico Good Conduct Medal", "Good Conduct Medal (Army)"],
  ["PH/TX", "TX", "TEXAS PURPLE HEART MEDAL", "Texas Purple Heart Medal", "Purple Heart"],
  ["HSM/AK", "AK", "ALASKA HUMANITARIAN SERVICE MEDAL", "Alaska Humanitarian Service Medal", "Humanitarian Service Medal"],
];

describe("A. collision groups: no stateCode must not fabricate the federal award", () => {
  for (const [label, code, textForm, stateName, fedName] of GROUPS) {
    it(`${label}: "${textForm}" with NO stateCode yields neither`, () => {
      const out = names(PAD + textForm);
      expect(out).not.toContain(fedName);
      expect(out).not.toContain(stateName);
    });

    it(`${label}: with stateCode ${code} yields the STATE award and not the federal one`, () => {
      const out = names(PAD + textForm, "Army", code);
      expect(out).toContain(stateName);
      expect(out).not.toContain(fedName);
    });

    it(`${label}: with a MISMATCHED stateCode (WY) yields neither`, () => {
      const out = names(PAD + textForm, "Army", "WY");
      expect(out).not.toContain(fedName);
      expect(out).not.toContain(stateName);
    });
  }
});

describe("B. standalone federal sanity (no state text present)", () => {
  const BARE = [
    ["MEDAL OF HONOR", "Medal of Honor"],
    ["MERITORIOUS SERVICE MEDAL", "Meritorious Service Medal"],
    ["LEGION OF MERIT", "Legion of Merit"],
    ["DISTINGUISHED SERVICE CROSS", "Distinguished Service Cross"],
    ["PURPLE HEART", "Purple Heart"],
    ["HUMANITARIAN SERVICE MEDAL", "Humanitarian Service Medal"],
    ["GOOD CONDUCT MEDAL", "Good Conduct Medal (Army)"],
  ];
  for (const [text, fedName] of BARE) {
    it(`bare "${text}" still matches (no stateCode)`, () => {
      expect(names(PAD + text)).toContain(fedName);
    });
    it(`bare "${text}" still matches WITH an unrelated stateCode (TX)`, () => {
      expect(names(PAD + text, "Army", "TX")).toContain(fedName);
    });
  }
});

describe("C. HSM exact-span abbreviation tie", () => {
  const text = `${PAD}NDSM ASR HSM`;
  it("HI veteran gets the Hawaii HSM, not the federal one", () => {
    const out = names(text, "Army", "HI");
    expect(out).toContain("HING Humanitarian Service Medal");
    expect(out).not.toContain("Humanitarian Service Medal");
  });
  it("no-stateCode veteran gets the federal HSM", () => {
    expect(names(text)).toContain("Humanitarian Service Medal");
  });
  it("Oregon veteran gets the federal HSM and no Hawaii award", () => {
    const out = names(text, "Army", "OR");
    expect(out).toContain("Humanitarian Service Medal");
    expect(out).not.toContain("HING Humanitarian Service Medal");
  });
});

describe("D. DOUBLE OCCURRENCE: federal name appears nested AND standalone", () => {
  it("D1 federal-first order: MEDAL OF HONOR ... TEXAS MEDAL OF HONOR (TX vet gets both)", () => {
    const out = names(`${PAD}MEDAL OF HONOR // TEXAS MEDAL OF HONOR`, "Army", "TX");
    expect(out).toContain("Medal of Honor");
    expect(out).toContain("Texas Legislative Medal of Honor");
  });

  it("D2 state-first order: TEXAS MEDAL OF HONOR ... MEDAL OF HONOR (TX vet must still get both)", () => {
    const out = names(`${PAD}TEXAS MEDAL OF HONOR // MEDAL OF HONOR`, "Army", "TX");
    expect(out).toContain("Texas Legislative Medal of Honor");
    expect(out).toContain("Medal of Honor");
  });

  it("D3 state-first order, federal-only veteran: TEXAS MEDAL OF HONOR ... MEDAL OF HONOR (no stateCode) must still yield the standalone federal MoH", () => {
    const out = names(`${PAD}TEXAS MEDAL OF HONOR // MEDAL OF HONOR`);
    expect(out).toContain("Medal of Honor");
  });

  it("D4 federal-federal, precedence order: DEFENSE MERITORIOUS SERVICE MEDAL then MERITORIOUS SERVICE MEDAL", () => {
    const out = names(
      `${PAD}DEFENSE MERITORIOUS SERVICE MEDAL // MERITORIOUS SERVICE MEDAL // ARMY SERVICE RIBBON`,
    );
    expect(out).toContain("Defense Meritorious Service Medal");
    expect(out).toContain("Meritorious Service Medal");
  });

  it("D5 federal-federal reverse order: MERITORIOUS SERVICE MEDAL then DEFENSE MERITORIOUS SERVICE MEDAL", () => {
    const out = names(
      `${PAD}MERITORIOUS SERVICE MEDAL // DEFENSE MERITORIOUS SERVICE MEDAL`,
    );
    expect(out).toContain("Meritorious Service Medal");
    expect(out).toContain("Defense Meritorious Service Medal");
  });

  it("D6 NGB22 realistic: AK guardsman holding BOTH federal MSM and Alaska MSM, state listed first", () => {
    const out = names(
      `${PAD}ALASKA MERITORIOUS SERVICE MEDAL // MERITORIOUS SERVICE MEDAL // NDSM`,
      "Army",
      "AK",
    );
    expect(out).toContain("Alaska Meritorious Service Medal");
    expect(out).toContain("Meritorious Service Medal");
  });

  it("D7 NGB22 realistic: federal first, state second (AK)", () => {
    const out = names(
      `${PAD}MERITORIOUS SERVICE MEDAL // ALASKA MERITORIOUS SERVICE MEDAL // NDSM`,
      "Army",
      "AK",
    );
    expect(out).toContain("Meritorious Service Medal");
    expect(out).toContain("Alaska Meritorious Service Medal");
  });
});

describe("E. non-colliding controls still behave (no new suppression)", () => {
  it("plain federal Block 13 list parses fully", () => {
    const out = names(
      `${PAD}ARMY COMMENDATION MEDAL // ARMY ACHIEVEMENT MEDAL // NATIONAL DEFENSE SERVICE MEDAL // ARMY SERVICE RIBBON // OVERSEAS SERVICE RIBBON // GLOBAL WAR ON TERRORISM SERVICE MEDAL`,
    );
    expect(out).toContain("Army Commendation Medal");
    expect(out).toContain("Army Achievement Medal");
    expect(out).toContain("National Defense Service Medal");
    expect(out).toContain("Army Service Ribbon");
    expect(out).toContain("Global War on Terrorism Service Medal");
  });

  it("abbreviation-style NGB22 Block 15 list parses fully", () => {
    const out = names(`${PAD}NDSM//ASR//AAM-2//ARCAM//GWOTS//OSR`);
    expect(out).toContain("National Defense Service Medal");
    expect(out).toContain("Army Service Ribbon");
    expect(out).toContain("Army Achievement Medal");
  });

  it("plain non-colliding STATE awards still match with their stateCode", () => {
    const out = names(`${PAD}OREGON NATIONAL GUARD FAITHFUL SERVICE RIBBON`, "Army", "OR");
    expect(out).toContain("Oregon National Guard Faithful Service Ribbon");
  });

  it("mixed federal + non-colliding state list yields both", () => {
    const out = names(
      `${PAD}PURPLE HEART // ARMY SERVICE RIBBON // OREGON NATIONAL GUARD FAITHFUL SERVICE RIBBON`,
      "Army",
      "OR",
    );
    expect(out).toContain("Purple Heart");
    expect(out).toContain("Army Service Ribbon");
    expect(out).toContain("Oregon National Guard Faithful Service Ribbon");
  });

  it("no duplicate award ids are ever returned", () => {
    const parsed = parseDD214Text(
      `${PAD}NDSM // ASR // MERITORIOUS SERVICE MEDAL // ALASKA MERITORIOUS SERVICE MEDAL`,
      "Army",
      "AK",
    );
    const ids = parsed.map((a) => a.awardId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("F. the two widest collision groups (39- and 44-state)", () => {
  it("Army Distinguished Service Medal is not fabricated by a state DSM (no stateCode)", () => {
    const out = names(`${PAD}ALASKA DISTINGUISHED SERVICE MEDAL`);
    expect(out).not.toContain("Army Distinguished Service Medal");
  });

  it("Navy Recruiting Service Ribbon is not fabricated by a state recruiting ribbon", () => {
    const out = names(`${PAD}ALASKA RECRUITING RIBBON`, "Navy");
    expect(out).not.toContain("Navy Recruiting Service Ribbon");
  });

  it("Navy Recruiting Service Ribbon still matches its own standalone text", () => {
    const out = names(`${PAD}NAVY RECRUITING SERVICE RIBBON // GOOD CONDUCT MEDAL`, "Navy");
    expect(out).toContain("Navy Recruiting Service Ribbon");
  });
});
