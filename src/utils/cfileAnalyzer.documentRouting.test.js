/**
 * ADR-009: analyzeCFile must size chunks/prompts for whichever backend a
 * document call will ACTUALLY dispatch to (getDocumentAIRouting().onDeviceMode),
 * not getAIStatus().effectiveMode - which can report CLOUD even while an
 * on-device engine (Warrant Council) sits ready, because Cloud preferred +
 * a configured key makes getEffectiveAIMode() return CLOUD outright.
 *
 * Before this fix: a Cloud-preferred + Warrant-Council-loaded veteran's
 * C-File was chunked using Gemini's ~2.7M-char budget (the whole file in
 * ONE chunk), generateAI's own document-routing dispatch then silently
 * ran that oversized chunk on-device anyway (ADR-009 forces document calls
 * on-device), the on-device backend's last-resort context-fit truncation
 * silently dropped most of the file, and the result still reported
 * metadata.aiMode: "cloud" with 0 failedChunks - a materially incomplete
 * analysis presented as a complete one, mislabeled.
 *
 * This test proves the chunk COUNT changes (multiple on-device-sized chunks
 * instead of one oversized "cloud" chunk) and the reported aiMode matches
 * the backend that actually ran.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// D19-2: the off-device fallback now dynamically imports musterCallProcessor
// (for parseClaimLetter) -> documentAnalyzer -> ocr.js -> advancedOCR.js ->
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
    getAIStatus: vi.fn(),
    getDocumentAIRouting: vi.fn(),
    isAnyAIAvailable: vi.fn(() => true),
  };
});

vi.mock("./diamondSwarm", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasWebLLMEngine: vi.fn(() => true),
  };
});

const unifiedAIService = await import("./unifiedAIService.js");
const { analyzeCFile, estimateChunks, getContextWindowInfo } =
  await import("./cfileAnalyzer.js");

// 8 pages (< the 10-marker floor screenRelevantPages needs before it screens
// anything, so this exercises splitIntoChunks's char-budget path directly -
// the same getMaxCharsPerChunk(aiMode) call the bug lives in) of real prose
// carrying medical/claims signal terms so no pre-flight gate skips them.
function buildFullText(pageCount, charsPerPage) {
  let text = "";
  for (let i = 1; i <= pageCount; i++) {
    const body =
      `Diagnosis of chronic PTSD, service-connected condition, nexus opinion pending. Continuity of treatment noted. `.repeat(
        Math.ceil(charsPerPage / 110),
      );
    text += `--- PAGE ${i} ---\n${body.slice(0, charsPerPage)}\n`;
  }
  return text;
}

const FULL_TEXT = buildFullText(8, 9000);

function mockChunkResponse() {
  return {
    text: JSON.stringify({
      servicePeriod: {},
      potential_claims: [],
      timeline: [],
    }),
    onDevice: true,
    mode: "swarm",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  unifiedAIService.generateAI.mockImplementation(async () =>
    mockChunkResponse(),
  );
});

describe("analyzeCFile: chunk sizing follows the ACTUAL on-device backend, not the raw preferred mode", () => {
  it("Cloud preferred + Warrant Council ready: chunks for SWARM's small budget (multiple chunks), and metadata.aiMode reports 'swarm', not 'cloud'", async () => {
    unifiedAIService.getAIStatus.mockReturnValue({ effectiveMode: "cloud" });
    unifiedAIService.getDocumentAIRouting.mockReturnValue({
      onDeviceReady: true,
      onDeviceMode: "swarm",
      blockedProviderLabel: null,
    });

    const result = await analyzeCFile(
      "fake-api-key",
      FULL_TEXT,
      () => {},
      null,
      {},
    );

    expect(result.metadata.aiMode).toBe("swarm");
    expect(
      result.metadata.totalChunks ?? result.metadata.chunksProcessed,
    ).toBeGreaterThan(1);
    // Every dispatched chunk asked for local-sized output (temperature 0.1
    // is only used on the isLocalAI branch of _requestChunkAnalysis).
    for (const call of unifiedAIService.generateAI.mock.calls) {
      expect(call[1].temperature).toBeCloseTo(0.1);
    }
  });

  it("Cloud preferred + NOTHING on-device ready: stays on the off-device fallback path (no AI call at all)", async () => {
    unifiedAIService.getAIStatus.mockReturnValue({ effectiveMode: "cloud" });
    unifiedAIService.getDocumentAIRouting.mockReturnValue({
      onDeviceReady: false,
      onDeviceMode: null,
      blockedProviderLabel: "Cloud AI (Gemini)",
    });

    const result = await analyzeCFile(
      "fake-api-key",
      FULL_TEXT,
      () => {},
      null,
      {},
    );

    expect(result.metadata.offDeviceBlocked).toBe(true);
    expect(unifiedAIService.generateAI).not.toHaveBeenCalled();
  });
});

describe("estimateChunks/getContextWindowInfo: pre-flight sizing follows the resolved on-device mode", () => {
  it("Cloud preferred + Warrant Council ready: sizes for SWARM's small budget, not Gemini's", () => {
    unifiedAIService.getAIStatus.mockReturnValue({ effectiveMode: "cloud" });
    unifiedAIService.getDocumentAIRouting.mockReturnValue({
      onDeviceReady: true,
      onDeviceMode: "swarm",
      blockedProviderLabel: null,
    });

    // A Gemini-sized (~2.7M char) budget would report 1 chunk for this;
    // SWARM's ~28K char budget must report many more.
    expect(estimateChunks(300_000)).toBeGreaterThan(1);
    expect(getContextWindowInfo().mode).toBe("Local AI");
  });

  it("nothing on-device ready: falls back to getAIStatus().effectiveMode (cloud)", () => {
    unifiedAIService.getAIStatus.mockReturnValue({ effectiveMode: "cloud" });
    unifiedAIService.getDocumentAIRouting.mockReturnValue({
      onDeviceReady: false,
      onDeviceMode: null,
      blockedProviderLabel: "Cloud AI (Gemini)",
    });

    expect(estimateChunks(300_000)).toBe(1);
    expect(getContextWindowInfo().mode).toBe("Cloud AI (Gemini)");
  });
});
