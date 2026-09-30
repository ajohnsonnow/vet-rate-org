/**
 * The C-File off-device fallback's claim-letter signal
 * (_claimsFromClaimLetter) used to read parseClaimLetter's data.conditions,
 * which keeps only RATED_OUTCOMES entries with a non-null rating -
 * excluding denials entirely, even though data.decisions (built by the same
 * call) carries them. A denied condition is exactly the appealable finding
 * a veteran needs to see. This also mislabeled the finding's source as
 * "claim letter" even for a plain rating-decision letter in ordinary prose
 * (the dot-leader/section-header parsers parseDecisionLetter/extractBigThree
 * never match this format, so parseClaimLetter's sentence-level decision
 * scan is the only signal that fires).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// The off-device fallback dynamically imports musterCallProcessor (for
// parseClaimLetter) -> documentAnalyzer -> ocr.js -> advancedOCR.js ->
// pdfjs-dist, which references canvas globals jsdom doesn't provide - same
// recipe as cfileAnalyzer.offDeviceFallback.test.js.
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

// Generic, fabricated rating-decision letter in ordinary sentence prose
// (not the dot-leader "Name .... NN percent" format parseDecisionLetter
// anchors on) - mirrors how most real VA decision letters are actually
// written: "Service connection for X is <outcome> ...".
const PROSE_DECISION_LETTER = `
DECISION

Service connection for tinnitus is granted with an evaluation of 10 percent
effective January 1, 2020.

Service connection for lumbosacral strain is granted with an evaluation of
20 percent effective January 1, 2020.

Service connection for obstructive sleep apnea is denied.

REASONS FOR THE DECISION

The evidence shows a current diagnosis and a documented in-service event
for the granted conditions. The evidence does not establish a nexus
between the current sleep apnea diagnosis and any in-service event.
`;

describe("analyzeCFile off-device fallback: claim-letter signal surfaces denials, not just grants", () => {
  it("includes a denied condition the claim-letter parser's decisions list carries", async () => {
    const result = await analyzeCFile(
      "fake-api-key",
      PROSE_DECISION_LETTER,
      () => {},
      null,
      {},
    );

    const names = result.analysis.potential_claims.map((c) =>
      c.condition.toLowerCase(),
    );
    expect(names).toContain("tinnitus");
    expect(names).toContain("obstructive sleep apnea");

    const denied = result.analysis.potential_claims.find(
      (c) => c.condition.toLowerCase() === "obstructive sleep apnea",
    );
    expect(denied.recommendation).toMatch(/denied/i);
  });

  it("labels the finding's source as decision text, not claim letter", async () => {
    const result = await analyzeCFile(
      "fake-api-key",
      PROSE_DECISION_LETTER,
      () => {},
      null,
      {},
    );

    const tinnitus = result.analysis.potential_claims.find(
      (c) => c.condition.toLowerCase() === "tinnitus",
    );
    expect(tinnitus.source).toBe("local-parser:decision-text");
    expect(tinnitus.recommendation).not.toMatch(/claim letter/i);
  });
});
