/**
 * D19-2: the C-File Analyzer's cloud-only fallback used to run ONLY a
 * 4-condition foot-terms grounded scan (surfaceDocumentedConditions) -
 * across 32 real decision letters that found 0 claims and 0 summaries,
 * while the UI still said "Analysis Complete" with empty tabs. This proves
 * the fallback now runs the app's real local document parsers (rating-
 * decision / code-sheet) and surfaces whatever they find, and that a
 * genuinely empty document still gets an honest "found nothing" summary
 * rather than a vacuous success.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// The off-device fallback dynamically imports musterCallProcessor (for
// parseClaimLetter) -> documentAnalyzer -> ocr.js -> advancedOCR.js ->
// pdfjs-dist, which references canvas globals jsdom doesn't provide - same
// recipe as serviceEntryConsistency.integration.test.jsx.
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("./unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateAI: vi.fn(),
    getAIStatus: vi.fn(() => ({ effectiveMode: "cloud" })),
    getDocumentAIRouting: vi.fn(() => ({
      onDeviceReady: false,
      onDeviceMode: null,
      blockedProviderLabel: "Cloud AI (Gemini)",
    })),
    isAnyAIAvailable: vi.fn(() => true),
  };
});

const { analyzeCFile } = await import("./cfileAnalyzer.js");

beforeEach(() => {
  vi.clearAllMocks();
});

// Generic, fabricated rating-decision letter - not a real veteran's record.
// Dot-leader format ("Name .......... NN percent") after a numbered bullet
// mirrors a real itemized decision summary and is what
// vaDocumentParser.js's CONDITION_NAME_BEFORE_SEP_RE actually anchors on.
const RATING_DECISION_FIXTURE = `
DECISION

1. Tinnitus .......................... 10 percent
2. Lumbosacral Strain .......................... 20 percent

EVIDENCE CONSIDERED

VA examination report dated December 1, 2019.
Service treatment records.

REASONS FOR THE DECISION

The evidence shows a current diagnosis and a documented in-service event.
`;

// Generic, fabricated code sheet using the simple "DC - name NN%" list
// format - not a real veteran's record.
const CODE_SHEET_FIXTURE = `
CODE SHEET

5237 - Lumbosacral Strain 20%
6260 - Tinnitus 10%
Combined: 30%

This rating summary reflects the veteran's currently service-connected
conditions as of the most recent rating decision on file.
`;

// Generic prose with enough medical/claims signal words to pass the
// minimum-length gate, but containing no condition name, percentage,
// diagnostic code, or decision language any parser (real or the old
// 4-condition scan) could find.
const NOTHING_FOUND_FIXTURE = `
The veteran attended a routine appointment. The clinician reviewed the
chart and discussed general wellness. No new findings were noted during
this visit. Follow-up was recommended in six months for a general checkup.
`.repeat(3);

describe("analyzeCFile off-device fallback (D19-2): real local parsers replace the narrow 4-condition scan", () => {
  it("finds real conditions from a generic rating-decision letter", async () => {
    const result = await analyzeCFile(
      "fake-api-key",
      RATING_DECISION_FIXTURE,
      () => {},
      null,
      {},
    );

    expect(result.metadata.offDeviceBlocked).toBe(true);
    const names = result.analysis.potential_claims.map((c) =>
      c.condition.toLowerCase(),
    );
    expect(names).toContain("tinnitus");
    expect(names).toContain("lumbosacral strain");
    // Neither condition is one of the old hardcoded foot terms - proves this
    // came from the real parser, not the narrow safety net alone.
    expect(names).not.toContain("pes planus");
    expect(result.analysis.summary).toMatch(/tinnitus/i);
    expect(result.analysis.summary).not.toBe("");
  });

  it("finds real conditions from a generic code sheet", async () => {
    const result = await analyzeCFile(
      "fake-api-key",
      CODE_SHEET_FIXTURE,
      () => {},
      null,
      {},
    );

    expect(result.metadata.offDeviceBlocked).toBe(true);
    const claims = result.analysis.potential_claims;
    const tinnitus = claims.find(
      (c) => c.condition.toLowerCase() === "tinnitus",
    );
    const lumbar = claims.find(
      (c) => c.condition.toLowerCase() === "lumbosacral strain",
    );
    expect(tinnitus).toBeTruthy();
    expect(tinnitus.diagnosticCode).toBe("6260");
    expect(lumbar).toBeTruthy();
    expect(lumbar.diagnosticCode).toBe("5237");
  });

  it("never claims a claim/summary was found when nothing was there", async () => {
    const result = await analyzeCFile(
      "fake-api-key",
      NOTHING_FOUND_FIXTURE,
      () => {},
      null,
      {},
    );

    expect(result.metadata.offDeviceBlocked).toBe(true);
    expect(result.metadata.foundNothing).toBe(true);
    expect(result.analysis.potential_claims).toHaveLength(0);
    expect(result.analysis.summary).toMatch(/did not find/i);
  });
});
