/**
 * Regression: badge aliases were matched with a bare substring test, so the
 * three-letter combat aliases fired inside ordinary words and inside vision-OCR
 * hallucinations. A real scanned DD214 run through Florence-2 produced
 * "CABEENENT OF CABRSTANTS", which fabricated a Combat Action Badge and marked
 * the veteran as having verified combat service (live audit, 2026-08-21).
 */
import { describe, it, expect } from "vitest";
import { parseDD214Badges } from "../../data/badgeData";

describe("parseDD214Badges: alias boundaries", () => {
  it("does not fabricate a Combat Action Badge from vision-OCR garbage", () => {
    const hallucinated =
      "ANTHEN OF FIBREENTOF THE FRANCEFABEET OF FAMENTOF BABRENENT CABEENENT OF CABRSTANTS OF FRARENT";
    const result = parseDD214Badges(hallucinated, "Army");
    expect(result.badges.map((b) => b.name)).not.toContain(
      "Combat Action Badge",
    );
    expect(result.combatIndicators).toEqual([]);
  });

  it("does not fabricate combat badges from ordinary form prose", () => {
    const prose =
      "THE MEMBER IS ELIGIBLE FOR ALL APPLICABLE BENEFITS. CABLE TV ALLOWANCE. CIBORIUM.";
    const result = parseDD214Badges(prose, "Army");
    expect(result.combatIndicators).toEqual([]);
  });

  it("still matches the real '//'-delimited abbreviation block on an NGB22", () => {
    const realAwardBlock = "GWOTS//GWOTE//ACM//AFRM-W/M-DEV-2//CAB//";
    const result = parseDD214Badges(realAwardBlock, "Army");
    expect(result.badges.map((b) => b.name)).toContain("Combat Action Badge");
    expect(result.combatIndicators).toContain("Combat Action Badge");
  });

  it("still matches a spelled-out award name", () => {
    const result = parseDD214Badges(
      "13. DECORATIONS: COMBAT INFANTRYMAN BADGE, ARMY COMMENDATION MEDAL",
      "Army",
    );
    expect(result.badges.map((b) => b.name)).toContain(
      "Combat Infantryman Badge",
    );
  });
});
