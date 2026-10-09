import { describe, it, expect } from "vitest";

// musterCallProcessor transitively imports pdfjs, which references canvas
// globals jsdom doesn't provide. Stub them so the module loads in the test
// environment (same pattern as musterCallReport.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseServiceRecord } = await import("../../utils/musterCallProcessor");
const { parseDD214Text } = await import("../../utils/ribbonRackData");
const { saveVeteranProfile, clearVeteranProfile } =
  await import("../../utils/veteranProfile");

// Synthetic OCR-style text in the layout of an NGB22 Report of Separation
// Block 15. Every "0" here stands in for the letter "O", as OCR produces it.
const SAMPLE_NGB22_BLOCK15_OCR =
  "N0THING F0LL0WS\n\nN0NE\n\n15. DEC0RATI0NS, ,MEDALS,BADGES,C0MMENDATI0NS,CITATI0NS\nAND CREEP RIBB0NS AWARDED THIS PERI0D        (STATE AWARDS MAY\nE INCIU\n\nKDSM//MSM-2//DS0//MF0M//AFEM//N0PDR//\nJSCM//GW0TE//L0M//GW0TS//AFSM//ADSM//\n0KR//0UA-W/M-DEV-2//0IR-2//P0W//N0THING\nF0LL0WS\n\n14. HIGHEST EDUCATI0N LEVEL SUCCESSFULLY C0MPLETED\nSEC0NDARY/HIGH SCH00L_12 YRS (Gr 1-12) C0LLEGE _2_YRS\n";

describe("DD214/NGB22 award parser regression: unclosed-paren + OCR 0/O + E.G./I.E. substring bugs", () => {
  it("Bug 1: an unclosed instructional paren no longer deletes the '//'-delimited Block 15 award list", async () => {
    const result = await parseServiceRecord(SAMPLE_NGB22_BLOCK15_OCR);
    const names = (result.awards || []).map((a) => a.award?.name);
    expect(names).toContain("Korean Defense Service Medal");
    expect(names).toContain("Meritorious Service Medal");
    expect(names).toContain("Armed Forces Expeditionary Medal");
    expect(names).toContain("Joint Service Commendation Medal");
    expect(names).toContain("Armed Forces Service Medal");
    expect(names).toContain("Army Distinguished Service Medal");
  });

  it("Bug 1: normal single-parenthetical instructional text (no '/') still strips correctly", () => {
    const text =
      "13. DECORATIONS (Silver Star, Bronze Star, Air Medal, etc.) NDSM ASR";
    const awards = parseDD214Text(text, "Army").map((a) => a.award.name);
    expect(awards).not.toContain("Silver Star");
    expect(awards).not.toContain("Meritorious Service Medal");
    expect(awards).not.toContain("Air Medal");
    expect(awards).toContain("National Defense Service Medal");
    expect(awards).toContain("Army Service Ribbon");
  });

  it("Bug 2: OCR 0/O garble (zero inside, leading and trailing a token: MF0M, N0PDR, GW0TS, GW0TE, L0M, P0W, 0UA, 0KR, 0IR, DS0) resolves to real award aliases", async () => {
    // State-scoped awards (like the Hawaii awards below) only match with a
    // resolved stateCode (see ribbonRackData.js parseDD214Text) -- this
    // fragment's own OCR text has no Box 2/state field, so the veteran's
    // profile supplies it here, same as it would for the live app.
    saveVeteranProfile({ state: "HI" });
    try {
      const result = await parseServiceRecord(SAMPLE_NGB22_BLOCK15_OCR);
      const names = (result.awards || []).map((a) => a.award?.name);
      expect(names).toContain("Multinational Force and Observers Medal");
      expect(names).toContain("NCO Professional Development Ribbon");
      expect(names).toContain("Global War on Terrorism Service Medal");
      expect(names).toContain("Global War on Terrorism Expeditionary Medal");
      expect(names).toContain("Legion of Merit");
      expect(names).toContain("Prisoner of War Medal");
      expect(names).toContain("Inherent Resolve Campaign Medal");
      expect(names).toContain("HING Outstanding Unit Award");
      expect(names).toContain("HING Operation Kokua Service Ribbon");
      expect(names).toContain("State of Hawaii Distinguished Service Order");
    } finally {
      clearVeteranProfile();
    }
  });

  it("Bug 3: the E.G./I.E. instructional pattern no longer eats 'EG'/'IE' substrings inside real award names", () => {
    const text =
      "13. DECORATIONS: LEGION OF MERIT, SOLDIER'S MEDAL, JOINT SERVICE ACHIEVEMENT MEDAL, e.g. examples of decorations";
    const names = parseDD214Text(text, "Army").map((a) => a.award.name);
    expect(names).toContain("Legion of Merit");
    expect(names).toContain("Joint Service Achievement Medal");
  });

  it("Bug 3 regression guard: MIN_ALIAS_LENGTH still blocks 2-char noise aliases from a garbled OCR field label", () => {
    const garbled =
      "A -- TM TLE 0 107A  0R'GKINAZTRTE SERVCE CAE LL 1 . EE -- . SM -Y --- 13. DEC0RATI0NS. RIBB0NS AWAR LM ST DAS. RACGES. CITATI0NS ANC CAMPAIGN. 14 WIL. TARY FCUCATICN";
    expect(parseDD214Text(garbled, "Army")).toHaveLength(0);
  });

  it("Bug 4: Block 13 award list terminating in 'CONT IN BLOCK 18' (no '//' prefix) still pulls in the Block 18 continuation", async () => {
    const text =
      "1. NAME: DOE, JOHN A\n" +
      "2. DEPARTMENT, COMPONENT AND BRANCH: ARMY\n" +
      "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED: NATIONAL DEFENSE SERVICE MEDAL, ARMY SERVICE RIBBON CONT IN BLOCK 18\n" +
      "14. MILITARY EDUCATION: NONE\n" +
      "18. REMARKS: HUMANITARIAN SERVICE MEDAL, GOOD CONDUCT MEDAL";
    const result = await parseServiceRecord(text);
    const names = (result.awards || []).map((a) => a.award?.name);
    expect(names).toContain("National Defense Service Medal");
    expect(names).toContain("Army Service Ribbon");
    expect(names).toContain("Humanitarian Service Medal");
    expect(names).toContain("Good Conduct Medal (Army)");
  });
});
