import { describe, it, expect } from "vitest";
import {
  deriveCombatService,
  matchCombatDecoration,
  isCombatDecoration,
  mergeCombatService,
  findCombatDecorationsInText,
  COMBAT_PRESUMPTION_CITATION,
} from "../../utils/combatService";

// Shape ribbonRackData.parseDD214Text emits, which is what actually reaches
// the profile/VKB writers on a real Muster Call import.
const rackAward = (name, matchedText = "", devices = []) => ({
  award: { name },
  matchedText,
  devices,
});

describe("combatService - M21-1 VIII.iv.1.A.3.h decoration list", () => {
  it("treats a Combat Action Badge as establishing combat participation", () => {
    const match = matchCombatDecoration(
      rackAward("Combat Action Badge", "CAB"),
    );
    expect(match).toEqual({
      id: "combat_action_badge",
      name: "Combat Action Badge",
    });
  });

  it("still matches the CAB through the zero-for-O substitution a scanned DD214 produces", () => {
    // Shape from a scanned Block 13: "...MEDAUL/C0MBAT\n\nACTI0N BADGE//"
    expect(isCombatDecoration("C0MBAT ACTI0N BADGE")).toBe(true);
  });

  it("matches the NGB22 delimiter form //CAB//", () => {
    expect(isCombatDecoration("//CAB//")).toBe(true);
  });

  it("does not match the alias inside a longer word or OCR garbage", () => {
    // Real Florence hallucinations from this corpus.
    expect(isCombatDecoration("CABEENENT")).toBe(false);
    expect(isCombatDecoration("CABRSTANTS")).toBe(false);
    expect(isCombatDecoration("Combat Life Saver Course")).toBe(false);
  });

  it("does not treat campaign, expeditionary, or service medals as combat decorations", () => {
    for (const name of [
      "Iraq Campaign Medal",
      "Armed Forces Expeditionary Medal",
      "Humanitarian Service Medal",
      "Korea Defense Service Medal",
      "National Defense Service Medal",
    ]) {
      expect(isCombatDecoration(name), name).toBe(false);
    }
  });

  it("requires the valor device on awards VA lists only in their 'V' form", () => {
    expect(isCombatDecoration(rackAward("Bronze Star Medal"))).toBe(false);
    expect(
      isCombatDecoration(
        rackAward("Bronze Star Medal", "BSM", [{ type: "v_device" }]),
      ),
    ).toBe(true);
  });

  it("reads the valor device out of Block 13's inline notation", () => {
    expect(
      isCombatDecoration(rackAward("Army Commendation Medal", "ARCOM W/V")),
    ).toBe(true);
    expect(
      isCombatDecoration(rackAward("Army Commendation Medal", "ARCOM-2")),
    ).toBe(false);
  });

  it("qualifies any meritorious award carrying the 'C' device", () => {
    const match = matchCombatDecoration(
      rackAward("Joint Service Achievement Medal", "JSAM", [
        { type: "c_device" },
      ]),
    );
    expect(match?.id).toBe("c_device");
    expect(match?.name).toContain("Joint Service Achievement Medal");
  });

  it("separates the base Parachutist Badge from the combat jump device", () => {
    expect(isCombatDecoration("Parachutist Badge")).toBe(false);
    expect(
      isCombatDecoration("Parachutist Badge with Combat Jump Device"),
    ).toBe(true);
  });
});

describe("deriveCombatService", () => {
  // A sample Block 13 / NGB22 award set, shaped as stored in
  // vkb.serviceHistory.awards after a bulk C-File import.
  const sampleAwards = [
    rackAward("Joint Service Commendation Medal", "JSCM"),
    rackAward("Combat Action Badge", "CAB"),
    rackAward("Army Commendation Medal", "ARCOM-2"),
    rackAward("National Defense Service Medal", "NDSM"),
    rackAward("Iraq Campaign Medal", "ICM"),
    rackAward("Armed Forces Expeditionary Medal", "AFEM"),
    rackAward("Humanitarian Service Medal", "HSM"),
    rackAward("Good Conduct Medal (Army)", "GCM-W/M-DEV-2", [
      { type: "m_device", position: "center" },
    ]),
    rackAward("Army Service Ribbon", "ASR"),
    rackAward("Meritorious Unit Commendation", "MUC"),
    rackAward("Korea Defense Service Medal", "KDSM"),
    rackAward("Armed Forces Reserve Medal", "AFRM"),
  ];

  it("establishes combat from the sample award set, on the CAB alone", () => {
    const result = deriveCombatService(sampleAwards);
    expect(result.hasVerifiedCombat).toBe(true);
    expect(result.indicators).toEqual(["Combat Action Badge"]);
    expect(result.citation).toBe(COMBAT_PRESUMPTION_CITATION);
  });

  it("reports theater medals as supporting evidence, never as combat indicators", () => {
    const result = deriveCombatService(sampleAwards);
    expect(result.supportingEvidence).toContain("Iraq Campaign Medal");
    expect(result.supportingEvidence).toContain(
      "Armed Forces Expeditionary Medal",
    );
    expect(result.indicators).not.toContain("Iraq Campaign Medal");
  });

  it("returns no combat for a service record with no qualifying decoration", () => {
    const result = deriveCombatService([
      rackAward("Army Service Ribbon", "ASR"),
      rackAward("National Defense Service Medal", "NDSM"),
    ]);
    expect(result.hasVerifiedCombat).toBe(false);
    expect(result.indicators).toEqual([]);
  });

  it("deduplicates a decoration that appears on more than one document", () => {
    const result = deriveCombatService([
      rackAward("Combat Action Badge", "CAB"),
      rackAward("Combat Action Badge", "COMBAT ACTION BADGE"),
      "CAB",
    ]);
    expect(result.indicators).toEqual(["Combat Action Badge"]);
  });

  it("tolerates a null or non-array award list", () => {
    expect(deriveCombatService(null).hasVerifiedCombat).toBe(false);
    expect(deriveCombatService().indicators).toEqual([]);
  });
});

describe("mergeCombatService", () => {
  it("keeps combat established by an earlier document when a later one omits Block 13", () => {
    const established = deriveCombatService([
      rackAward("Combat Action Badge", "CAB"),
    ]);
    const empty = deriveCombatService([
      rackAward("Army Service Ribbon", "ASR"),
    ]);
    const merged = mergeCombatService(established, empty);
    expect(merged.hasVerifiedCombat).toBe(true);
    expect(merged.indicators).toEqual(["Combat Action Badge"]);
  });

  it("unions indicators found across separate documents", () => {
    const merged = mergeCombatService(
      deriveCombatService([rackAward("Combat Action Badge", "CAB")]),
      deriveCombatService([rackAward("Purple Heart", "PH")]),
    );
    expect(merged.indicators).toEqual(["Combat Action Badge", "Purple Heart"]);
  });

  it("adopts the incoming determination when nothing was stored yet", () => {
    const incoming = deriveCombatService([rackAward("Combat Action Badge")]);
    expect(mergeCombatService(null, incoming).hasVerifiedCombat).toBe(true);
    expect(mergeCombatService(incoming, null)).toBe(incoming);
  });

  it("lists two differently-decorated 'C' device awards separately", () => {
    const result = deriveCombatService([
      rackAward("Joint Service Achievement Medal", "JSAM", [
        { type: "c_device" },
      ]),
      rackAward("Army Commendation Medal", "ARCOM", [{ type: "c_device" }]),
    ]);
    expect(result.indicators).toHaveLength(2);
  });
});

describe("findCombatDecorationsInText", () => {
  it("finds a decoration broken across a line break by the scanner", () => {
    // Shape seen on scanned DD214 pages: the award name straddles a blank
    // line and the separator before it degraded from "//" to "/".
    const text =
      "HUMANITARIAN SERVICE MEDAL/G00D C0NDUCT MEDAL/C0MBAT\n\nACTI0N BADGE//IN0THING F0LL0WS";
    expect(findCombatDecorationsInText(text)).toEqual(["Combat Action Badge"]);
  });

  it("does not let a valor device leak across the // separator to another award", () => {
    const text = 'BRONZE STAR MEDAL//ARMY COMMENDATION MEDAL W/ "V" DEVICE';
    expect(findCombatDecorationsInText(text)).toEqual([
      'Army Commendation Medal with "V" Device',
    ]);
  });

  it("ignores Block 14 course titles and campaign medals", () => {
    const text =
      "IRAQ CAMPAIGN MEDAL//HUMANITARIAN SERVICE MEDAL//COMBAT LIFE SAVER COURSE, 1 WEEK, 2013";
    expect(findCombatDecorationsInText(text)).toEqual([]);
  });

  it("returns an empty list for empty or missing text", () => {
    expect(findCombatDecorationsInText("")).toEqual([]);
    expect(findCombatDecorationsInText(null)).toEqual([]);
  });
});
