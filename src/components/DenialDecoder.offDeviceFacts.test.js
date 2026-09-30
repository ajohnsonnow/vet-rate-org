/**
 * "Never present a guess as a printed fact" / "correct value or nothing,
 * never a wrong one": DenialDecoder's off-device fallback used to hard-code
 * urgency: "medium" with no basis, and _saveDenialAnalysis always persisted
 * denialReason/whatWasMissing to VKB's aiInsights + keyFacts even when they
 * were only the UI's "Not determined by the built-in reader..." hedge text -
 * so a guess and a UI instruction ended up presented to later AI contexts
 * (via generateLLMContext's buildKeyFactsContext) as if they were real
 * findings about the veteran's denial letter.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("tesseract.js", () => ({ createWorker: vi.fn() }));
vi.mock("../utils/unifiedAIService", () => ({
  generateAI: vi.fn(),
  isAnyAIAvailable: vi.fn(() => true),
  getAIStatus: vi.fn(() => ({})),
  getDocumentAIRouting: vi.fn(() => ({ onDeviceReady: true })),
}));
vi.mock("../utils/veteranContextProvider", () => ({
  getVeteranAIContext: vi.fn().mockResolvedValue(""),
  saveAnalysisResults: vi.fn().mockResolvedValue(undefined),
  PACKET_DOC_TYPES: { VA_CORRESPONDENCE: "va_correspondence" },
}));
vi.mock("../utils/vaDocumentParser", () => ({
  parseDecisionLetter: vi.fn(),
}));

const veteranContextProvider =
  await import("../utils/veteranContextProvider.js");
const vaDocumentParser = await import("../utils/vaDocumentParser.js");
const { _buildOffDeviceFallbackAnalysis, _saveDenialAnalysis } =
  await import("./DenialDecoder.jsx");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("_buildOffDeviceFallbackAnalysis: no invented urgency", () => {
  it("never guesses urgency: null when the built-in parser found nothing", () => {
    vaDocumentParser.parseDecisionLetter.mockReturnValue({
      reasonsForDenial: [],
      evidenceConsidered: [],
      appealDeadline: null,
    });

    const result = _buildOffDeviceFallbackAnalysis("garbled OCR text");

    expect(result.urgency).toBeNull();
    expect(result._hasRealReason).toBe(false);
  });

  it("marks a real, parser-found reason as real", () => {
    vaDocumentParser.parseDecisionLetter.mockReturnValue({
      reasonsForDenial: ["Lack of Nexus"],
      evidenceConsidered: ["C&P exam dated 2026-01-01"],
      appealDeadline: "2026-12-01",
    });

    const result = _buildOffDeviceFallbackAnalysis("a real denial letter");

    expect(result.denialReason).toBe("Lack of Nexus");
    expect(result._hasRealReason).toBe(true);
    expect(result._hasRealMissing).toBe(true);
  });
});

describe("_saveDenialAnalysis: the UI hedge text is never persisted as a fact", () => {
  it("omits lastDenialReason/keyFacts/denialUrgency for a fallback that found nothing", async () => {
    const fallback = _buildOffDeviceFallbackAnalysisFixture({
      hasRealReason: false,
      hasRealMissing: false,
      urgency: null,
    });

    await _saveDenialAnalysis("garbled OCR text", fallback);

    const [savedArgs] =
      veteranContextProvider.saveAnalysisResults.mock.calls[0];
    expect(savedArgs.vkbMergeData.aiInsights.lastDenialReason).toBeUndefined();
    expect(savedArgs.vkbMergeData.aiInsights.lastDenialMissing).toBeUndefined();
    expect(savedArgs.vkbMergeData.aiInsights.denialUrgency).toBeUndefined();
    expect(savedArgs.vkbMergeData.keyFacts).toEqual([]);
  });

  it("still saves a real AI-produced analysis normally (no regression)", async () => {
    const realAnalysis = {
      denialReason: "Lack of Nexus",
      whatWasMissing: "A medical opinion linking service to the condition",
      urgency: "high",
      appealDeadline: "2026-12-01",
      // No _hasRealReason/_hasRealMissing key - a real AI JSON response.
    };

    await _saveDenialAnalysis("a real denial letter", realAnalysis);

    const [savedArgs] =
      veteranContextProvider.saveAnalysisResults.mock.calls[0];
    expect(savedArgs.vkbMergeData.aiInsights.lastDenialReason).toBe(
      "Lack of Nexus",
    );
    expect(savedArgs.vkbMergeData.aiInsights.denialUrgency).toBe("high");
    expect(savedArgs.vkbMergeData.keyFacts).toHaveLength(1);
  });
});

// Builds a fallback-shaped object directly (bypassing parseDecisionLetter)
// so this test file's second describe block stays independent of the
// first's mock setup.
function _buildOffDeviceFallbackAnalysisFixture({
  hasRealReason,
  hasRealMissing,
  urgency,
}) {
  return {
    denialReason: hasRealReason
      ? "Lack of Nexus"
      : "Not determined by the built-in reader - load the on-device AI for a full analysis.",
    whatWasMissing: hasRealMissing
      ? "Evidence considered: C&P exam"
      : "Not determined by the built-in reader.",
    urgency,
    appealDeadline: "Not specified",
    _hasRealReason: hasRealReason,
    _hasRealMissing: hasRealMissing,
  };
}
