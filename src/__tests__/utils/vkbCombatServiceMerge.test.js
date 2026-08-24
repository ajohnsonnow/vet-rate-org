/**
 * The combat determination has to survive the whole way from a parsed DD214
 * into vkb.serviceHistory and back out through the LLM context every AI tool
 * reads. Before combatService.js there was no producer for this field on the
 * Muster Call path at all, so a veteran with a Combat Action Badge reached
 * every downstream tool as a non-combat veteran.
 */
import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeDD214IntoVKB,
  generateLLMContext,
} from "../../utils/veteranKnowledgeBase";
import { deriveCombatService } from "../../utils/combatService";

const dd214WithCAB = {
  branch: "Army",
  rank: "SGT",
  awards: [
    { name: "Army Achievement Medal", isCombat: false, devices: [] },
    { name: "Combat Action Badge", isCombat: true, devices: [] },
    { name: "Afghanistan Campaign Medal", isCombat: false, devices: [] },
  ],
  combatService: deriveCombatService([
    { name: "Army Achievement Medal" },
    { name: "Combat Action Badge" },
    { name: "Afghanistan Campaign Medal" },
  ]),
};

// Pages 1, 2 and 4 of the same DD214 set: no Block 13, so no decorations.
const dd214NoBlock13 = {
  branch: "Army",
  rank: "SPC",
  awards: [],
  combatService: deriveCombatService([]),
};

describe("VKB combat service merge", () => {
  it("persists the combat determination into serviceHistory", () => {
    const vkb = mergeDD214IntoVKB(initializeVKB(), dd214WithCAB, {
      fileName: "DD214-p3.pdf",
    });
    expect(vkb.serviceHistory.combatService.hasVerifiedCombat).toBe(true);
    expect(vkb.serviceHistory.combatService.indicators).toContain(
      "Combat Action Badge",
    );
  });

  it("records the Combat Action Badge as a combat award, not an ordinary one", () => {
    const vkb = mergeDD214IntoVKB(initializeVKB(), dd214WithCAB, {
      fileName: "DD214-p3.pdf",
    });
    const cab = vkb.serviceHistory.awards.find(
      (a) => a.name === "Combat Action Badge",
    );
    expect(cab.isCombat).toBe(true);
    const campaign = vkb.serviceHistory.awards.find(
      (a) => a.name === "Afghanistan Campaign Medal",
    );
    expect(campaign.isCombat).toBe(false);
  });

  it("does not let a later page of the same DD214 set retract combat", () => {
    let vkb = mergeDD214IntoVKB(initializeVKB(), dd214WithCAB, {
      fileName: "DD214-p3.pdf",
    });
    vkb = mergeDD214IntoVKB(vkb, dd214NoBlock13, { fileName: "DD214-p4.pdf" });
    expect(vkb.serviceHistory.combatService.hasVerifiedCombat).toBe(true);
    expect(vkb.serviceHistory.combatService.indicators).toContain(
      "Combat Action Badge",
    );
  });

  it("keeps isCombat set when the same award arrives again without the flag", () => {
    let vkb = mergeDD214IntoVKB(initializeVKB(), dd214WithCAB, {
      fileName: "DD214-p3.pdf",
    });
    vkb = mergeDD214IntoVKB(
      vkb,
      {
        awards: [{ name: "Combat Action Badge", isCombat: false, devices: [] }],
      },
      { fileName: "NGB22.pdf" },
    );
    const cab = vkb.serviceHistory.awards.find(
      (a) => a.name === "Combat Action Badge",
    );
    expect(cab.isCombat).toBe(true);
  });

  it("surfaces combat service in the LLM context every AI tool reads", () => {
    const vkb = mergeDD214IntoVKB(initializeVKB(), dd214WithCAB, {
      fileName: "DD214-p3.pdf",
    });
    const context = generateLLMContext(vkb);
    expect(context).toContain("COMBAT SERVICE: VERIFIED");
    expect(context).toContain("Combat Action Badge");
  });

  it("says nothing about combat for a record with no qualifying decoration", () => {
    const vkb = mergeDD214IntoVKB(initializeVKB(), dd214NoBlock13, {
      fileName: "DD214-p1.pdf",
    });
    expect(generateLLMContext(vkb)).not.toContain("COMBAT SERVICE: VERIFIED");
  });
});
