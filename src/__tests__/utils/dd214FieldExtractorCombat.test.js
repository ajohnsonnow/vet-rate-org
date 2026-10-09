/**
 * The DD214Analyzer upload path (dd214FieldExtractor) and the Muster Call
 * bulk-import path (musterCallProcessor) both decide whether a veteran is a
 * combat veteran. They used different rules and could reach opposite answers
 * on the same document: this path counted any Bronze Star and any campaign
 * medal as combat, and knew only 6 of the 23 decorations on VA's list
 * (M21-1, Part VIII, Subpart iv, 1.A.3.h). Both now share combatService.js.
 */
import { describe, it, expect } from "vitest";
import { extractDD214Fields } from "../../utils/dd214FieldExtractor";

const dd214 = (block13, block18 = "") => `
CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME (Last, First, Middle): SMITH, JOHN A
4a. GRADE, RATE OR RANK: SGT
13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED
${block13}
14. MILITARY EDUCATION: NONE
18. REMARKS: ${block18}
24. CHARACTER OF SERVICE: HONORABLE
`;

const combatOf = (block13, block18) =>
  extractDD214Fields(dd214(block13, block18)).fields.combatService;

describe("dd214FieldExtractor: combat determination", () => {
  it("establishes combat from a Combat Action Badge", () => {
    const cs = combatOf(
      "ARMY SERVICE RIBBON//COMBAT ACTION BADGE//NOTHING FOLLOWS",
    );
    expect(cs.hasVerifiedCombat).toBe(true);
    expect(cs.indicators).toContain("Combat Action Badge");
  });

  it("no longer treats a campaign medal as proof of combat", () => {
    const cs = combatOf(
      "AFGHANISTAN CAMPAIGN MEDAL//GLOBAL WAR ON TERRORISM SERVICE MEDAL//NOTHING FOLLOWS",
    );
    expect(cs.hasVerifiedCombat).toBe(false);
    expect(cs.indicators).toEqual([]);
  });

  it("no longer treats a Bronze Star without the valor device as proof of combat", () => {
    expect(
      combatOf("BRONZE STAR MEDAL//ARMY SERVICE RIBBON").hasVerifiedCombat,
    ).toBe(false);
    expect(
      combatOf('BRONZE STAR MEDAL W/ "V" DEVICE//ARMY SERVICE RIBBON')
        .hasVerifiedCombat,
    ).toBe(true);
  });

  it("recognises decorations the old keyword list did not know", () => {
    for (const [block13, expected] of [
      ["COMBAT ACTION RIBBON//NOTHING FOLLOWS", "Combat Action Ribbon"],
      ["NAVY CROSS//NOTHING FOLLOWS", "Navy Cross"],
      [
        "DISTINGUISHED FLYING CROSS//NOTHING FOLLOWS",
        "Distinguished Flying Cross",
      ],
      ["MEDAL OF HONOR//NOTHING FOLLOWS", "Medal of Honor"],
    ]) {
      const cs = combatOf(block13);
      expect(cs.hasVerifiedCombat, block13).toBe(true);
      expect(cs.indicators, block13).toContain(expected);
    }
  });

  it("reports hostile-area pay without calling it combat participation", () => {
    const cs = combatOf(
      "ARMY SERVICE RIBBON//NOTHING FOLLOWS",
      "SERVED IN IMMINENT DANGER PAY AREA",
    );
    expect(cs.indicators).toContain("Imminent Danger Pay Zone");
    expect(cs.hasVerifiedCombat).toBe(false);
  });

  it("still establishes combat when hostile-area pay accompanies a decoration", () => {
    const cs = combatOf(
      "COMBAT INFANTRYMAN BADGE//NOTHING FOLLOWS",
      "SERVED IN IMMINENT DANGER PAY AREA",
    );
    expect(cs.hasVerifiedCombat).toBe(true);
    expect(cs.indicators).toContain("Combat Infantryman Badge");
    expect(cs.indicators).toContain("Imminent Danger Pay Zone");
  });

  it("finds nothing combat-related on an ordinary peacetime record", () => {
    const cs = combatOf(
      "ARMY SERVICE RIBBON//NATIONAL DEFENSE SERVICE MEDAL//KOREA DEFENSE SERVICE MEDAL",
    );
    expect(cs.hasVerifiedCombat).toBe(false);
    expect(cs.indicators).toEqual([]);
  });
});
