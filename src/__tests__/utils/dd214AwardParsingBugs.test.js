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

// Verbatim OCR text (minus surrounding page noise) from a real NGB22 Report
// of Separation, captured via Playwright instrumentation against the actual
// production extraction pipeline. Every "0" here is the real OCR output for
// what should read as the letter "O".
const REAL_NGB22_BLOCK15_OCR =
  "N0THING F0LL0WS\n\nN0NE\n\n15. DEC0RATI0NS, ,MEDALS,BADGES,C0MMENDATI0NS,CITATI0NS\nAND CREEP RIBB0NS AWARDED THIS PERI0D        (STATE AWARDS MAY\nE INCIU\n\nNDSM//ASR//ARCAM-2//AAM-2//MF0M//N0PDR//\nGW0TS//GW0TE//ACM//AFRM-W/M-DEV-2//CAB//\nNAT0-MDL//0SR-2//0R-FSR-W/M-DEV-2//N0THING\nF0LL0WS\n\n14. HIGHEST EDUCATI0N LEVEL SUCCESSFULLY C0MPLETED\nSEC0NDARY/HIGH SCH00L_12 YRS (Gr 1-12) C0LLEGE _0_YRS\n";

describe("DD214/NGB22 award parser regression: unclosed-paren + OCR 0/O + E.G./I.E. substring bugs", () => {
  it("Bug 1: an unclosed instructional paren no longer deletes the real '//'-delimited Block 15 award list", async () => {
    const result = await parseServiceRecord(REAL_NGB22_BLOCK15_OCR);
    const names = (result.awards || []).map((a) => a.award?.name);
    expect(names).toContain("National Defense Service Medal");
    expect(names).toContain("Army Service Ribbon");
    expect(names).toContain("Army Achievement Medal");
    expect(names).toContain("Combat Action Badge");
    expect(names).toContain("Armed Forces Reserve Medal");
  });

  it("Bug 1: normal single-parenthetical instructional text (no '/') still strips correctly", () => {
    const text =
      "13. DECORATIONS (Silver Star, Bronze Star, Air Medal, etc.) NDSM ASR";
    const awards = parseDD214Text(text, "Army").map((a) => a.award.name);
    expect(awards).not.toContain("Silver Star");
    expect(awards).not.toContain("Bronze Star Medal");
    expect(awards).not.toContain("Air Medal");
    expect(awards).toContain("National Defense Service Medal");
    expect(awards).toContain("Army Service Ribbon");
  });

  it("Bug 2: OCR 0/O garble (MF0M, N0PDR, GW0TS, GW0TE, 0SR, 0R-FSR, NAT0-MDL) resolves to real award aliases", async () => {
    // State-scoped awards (like the Oregon ribbon below) only match with a
    // resolved stateCode (see ribbonRackData.js parseDD214Text) -- this
    // fragment's own OCR text has no Box 2/state field, so the veteran's own
    // profile (the real, production source for this exact document) supplies
    // it here, same as it would for the live app.
    saveVeteranProfile({ state: "OR" });
    try {
      const result = await parseServiceRecord(REAL_NGB22_BLOCK15_OCR);
      const names = (result.awards || []).map((a) => a.award?.name);
      expect(names).toContain("Multinational Force and Observers Medal");
      expect(names).toContain("NCO Professional Development Ribbon");
      expect(names).toContain("Global War on Terrorism Service Medal");
      expect(names).toContain("Global War on Terrorism Expeditionary Medal");
      expect(names).toContain("Overseas Service Ribbon (Army)");
      expect(names).toContain("Oregon National Guard Faithful Service Ribbon");
      expect(names).toContain("NATO Medal");
    } finally {
      clearVeteranProfile();
    }
  });

  it("Bug 3: the E.G./I.E. instructional pattern no longer eats 'EG'/'IE' substrings inside real award names", () => {
    const text =
      "13. DECORATIONS: LEGION OF MERIT, SOLDIER'S MEDAL, ARMY ACHIEVEMENT MEDAL, e.g. examples of decorations";
    const names = parseDD214Text(text, "Army").map((a) => a.award.name);
    expect(names).toContain("Legion of Merit");
    expect(names).toContain("Army Achievement Medal");
  });

  it("Bug 3 regression guard: MIN_ALIAS_LENGTH still blocks 2-char noise aliases from a garbled OCR field label", () => {
    const garbled =
      "A —— TM TLE 0 107A  0R'GKINAZTRTE SERVCE CAE LL 1 . EE —— . SM —Y ——— 13. DEC0RATI0NS. RIBB0NS AWAR LM ST DAS. RACGES. CITATI0NS ANC CAMPAIGN. 14 WIL. TARY FCUCATICN";
    expect(parseDD214Text(garbled, "Army").length).toBe(0);
  });

  it("Bug 4: Block 13 award list terminating in 'CONT IN BLOCK 18' (no '//' prefix) still pulls in the Block 18 continuation", async () => {
    const text =
      "1. NAME: DOE, JOHN A\n" +
      "2. DEPARTMENT, COMPONENT AND BRANCH: ARMY\n" +
      "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED: NATIONAL DEFENSE SERVICE MEDAL, ARMY SERVICE RIBBON CONT IN BLOCK 18\n" +
      "14. MILITARY EDUCATION: NONE\n" +
      "18. REMARKS: ARMY ACHIEVEMENT MEDAL, GOOD CONDUCT MEDAL";
    const result = await parseServiceRecord(text);
    const names = (result.awards || []).map((a) => a.award?.name);
    expect(names).toContain("National Defense Service Medal");
    expect(names).toContain("Army Service Ribbon");
    expect(names).toContain("Army Achievement Medal");
    expect(names).toContain("Good Conduct Medal (Army)");
  });
});
