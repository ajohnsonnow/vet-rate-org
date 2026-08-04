/**
 * Baseline coverage for ribbonRackData.js: federal-only parsing/precedence,
 * merged state-award (National Guard) parsing/precedence, and the
 * cross-state negative case Wren specified (a Texas veteran's DD214 text
 * must match zero Oregon awards, and vice versa).
 *
 * The 5 tests in dd214AwardParsingBugs.test.js target 4 specific already-shipped
 * OCR/regex bug fixes and are intentionally left untouched — this file is the
 * general baseline that never existed before.
 */
import { describe, it, expect } from "vitest";
import {
  parseDD214Text,
  sortRibbonsByPrecedence,
  getAwardsForBranch,
  getAwardById,
  MASTER_AWARDS,
  STATE_AWARD_CODES,
} from "../../utils/ribbonRackData";

describe("MASTER_AWARDS merge", () => {
  it("includes all 89 federal awards plus all 780 state/territory awards", () => {
    const federal = MASTER_AWARDS.filter((a) => a.scope !== "state");
    const state = MASTER_AWARDS.filter((a) => a.scope === "state");
    expect(federal.length).toBe(89);
    expect(state.length).toBe(780);
  });

  it("covers all 54 states/territories in STATE_AWARD_CODES", () => {
    expect(STATE_AWARD_CODES.size).toBe(54);
    for (const code of ["TX", "OR", "HI", "KS", "DC", "PR", "GU", "VI"]) {
      expect(STATE_AWARD_CODES.has(code)).toBe(true);
    }
  });

  it("assigns every state award a real ribbonColor (no unstyled fallback)", () => {
    const stateAwards = MASTER_AWARDS.filter((a) => a.scope === "state");
    for (const award of stateAwards) {
      expect(award.ribbonColor).not.toBe("bg-gray-400");
    }
  });
});

describe("federal-only parsing (no stateCode passed)", () => {
  const text =
    "13. DECORATIONS, MEDALS, BADGES: NATIONAL DEFENSE SERVICE MEDAL, ARMY SERVICE RIBBON, PURPLE HEART";

  it("matches only federal awards", () => {
    const names = parseDD214Text(text, "Army").map((a) => a.award.name);
    expect(names).toContain("National Defense Service Medal");
    expect(names).toContain("Army Service Ribbon");
    expect(names).toContain("Purple Heart");
    expect(names.every((n) => !n.startsWith("Oregon"))).toBe(true);
  });

  it("never matches a state award even if a stateCode-shaped alias appears in the text", () => {
    // "OR-FSR" is a real Oregon alias, but with no stateCode argument at all
    // it must not surface -- this is the documented default behavior for
    // every existing 2-arg caller of parseDD214Text.
    const withStateAlias = `${text} OR-FSR`;
    const names = parseDD214Text(withStateAlias, "Army").map(
      (a) => a.award.name,
    );
    expect(names).not.toContain(
      "Oregon National Guard Faithful Service Ribbon",
    );
  });

  it("sorts federal awards by branch precedence (Purple Heart before NDSM)", () => {
    const parsed = parseDD214Text(text, "Army");
    const sorted = sortRibbonsByPrecedence(parsed, "Army");
    const order = sorted.map((a) => a.award.name);
    expect(order.indexOf("Purple Heart")).toBeLessThan(
      order.indexOf("National Defense Service Medal"),
    );
  });

  it("getAwardsForBranch(branch) with no stateCode returns federal awards only", () => {
    const armyAwards = getAwardsForBranch("Army");
    expect(armyAwards.length).toBeGreaterThan(0);
    expect(armyAwards.every((a) => a.scope !== "state")).toBe(true);
  });
});

describe("state-scoped parsing (Hawaii, Texas, Kansas — verified entries)", () => {
  it("Hawaii: matches State of Hawaii Medal of Valor only with stateCode HI", () => {
    const text = "13. DECORATIONS: STATE OF HAWAII MEDAL OF VALOR";
    expect(
      parseDD214Text(text, "Army", "HI").map((a) => a.award.name),
    ).toContain("State of Hawaii Medal of Valor");
    expect(parseDD214Text(text, "Army").map((a) => a.award.name)).not.toContain(
      "State of Hawaii Medal of Valor",
    );
  });

  it("Texas: matches Texas Legislative Medal of Honor via its alias with stateCode TX", () => {
    const text = "13. DECORATIONS: TEXAS MEDAL OF HONOR";
    const names = parseDD214Text(text, "Army", "TX").map((a) => a.award.name);
    expect(names).toContain("Texas Legislative Medal of Honor");
  });

  it("Kansas: matches Kansas Medal of Excellence via its KSMOE abbreviation with stateCode KS", () => {
    const text = "13. DECORATIONS: NDSM KSMOE";
    const names = parseDD214Text(text, "Army", "KS").map((a) => a.award.name);
    expect(names).toContain("Kansas Medal of Excellence");
  });

  it("getAwardsForBranch(branch, stateCode) scopes state awards to the requested state only", () => {
    const hiAwards = getAwardsForBranch("Army", "HI");
    const stateEntries = hiAwards.filter((a) => a.scope === "state");
    expect(stateEntries.length).toBeGreaterThan(0);
    expect(stateEntries.every((a) => a.stateCode === "HI")).toBe(true);
  });
});

describe("negative case: a state veteran never matches another state's awards", () => {
  it("a Texas veteran's DD214 text matches zero Oregon awards", () => {
    const text =
      "13. DECORATIONS: NDSM ASR OR-FSR ORNG FSR OREGON FAITHFUL SERVICE";
    const names = parseDD214Text(text, "Army", "TX").map((a) => a.award.name);
    expect(names.filter((n) => n.toLowerCase().includes("oregon"))).toEqual([]);
  });

  it("an Oregon veteran's DD214 text matches zero Texas awards", () => {
    const text = "13. DECORATIONS: NDSM ASR TEXAS MEDAL OF HONOR";
    const names = parseDD214Text(text, "Army", "OR").map((a) => a.award.name);
    expect(names).not.toContain("Texas Legislative Medal of Honor");
  });

  it("getAwardsForBranch never leaks one state's awards into another state's list", () => {
    const txAwards = getAwardsForBranch("Army", "TX").filter(
      (a) => a.scope === "state",
    );
    expect(txAwards.every((a) => a.stateCode === "TX")).toBe(true);
    expect(txAwards.some((a) => a.stateCode === "OR")).toBe(false);
  });
});

describe("precedence sort: state awards always sort after every federal award", () => {
  it("sorts a mixed federal+state list with all federal first, regardless of numeric precedence", () => {
    const purpleHeart = { award: getAwardById("purple_heart") }; // Army precedence 11
    const nato = { award: getAwardById("nato_medal") }; // Army precedence 70 (highest federal)
    const hawaii = { award: getAwardById("hi-hing-recruiting-ribbon") }; // inStatePrecedence 12
    const oregon = {
      award: getAwardById("oregon_national_guard_faithful_service_ribbon"),
    }; // inStatePrecedence null

    const sorted = sortRibbonsByPrecedence(
      [oregon, hawaii, nato, purpleHeart],
      "Army",
    );
    const ids = sorted.map((a) => a.award.id);
    const natoIdx = ids.indexOf("nato_medal");
    const hiIdx = ids.indexOf("hi-hing-recruiting-ribbon");
    const orIdx = ids.indexOf("oregon_national_guard_faithful_service_ribbon");

    expect(ids[0]).toBe("purple_heart");
    // Every federal award (even the lowest-precedence one, NATO) sorts
    // before every state award.
    expect(natoIdx).toBeLessThan(hiIdx);
    expect(natoIdx).toBeLessThan(orIdx);
    // Within the state group, a real inStatePrecedence (Hawaii: 12) sorts
    // before a null one (Oregon: no order asserted).
    expect(hiIdx).toBeLessThan(orIdx);
  });
});
