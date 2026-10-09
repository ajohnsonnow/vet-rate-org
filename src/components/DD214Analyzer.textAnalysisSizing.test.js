/**
 * ADR-009: _runTextAnalysis used to decide "local vs cloud" sizing via
 * `aiStatus.localAvailable && !aiStatus.cloudAvailable` - so a veteran with
 * BOTH a Gemini key configured AND Warrant Council loaded (Cloud preferred)
 * got the full cloud-sized system prompt with no truncation, even though a
 * document call now always dispatches on-device when any engine is ready
 * (never to cloud). getDocumentAIRouting().onDeviceReady is the real
 * answer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/documentAnalyzer", () => ({
  OCR_STATES: {},
  getProgressStyling: () => ({}),
  formatFileSize: (bytes) => `${bytes} bytes`,
  isFileSupported: () => true,
  getAcceptString: () => "",
}));
vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {},
  isSmolVLMSupported: () => false,
}));

vi.mock("../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateAI: vi.fn(),
    getDocumentAIRouting: vi.fn(),
  };
});

const unifiedAIService = await import("../utils/unifiedAIService.js");
const {
  _runTextAnalysis,
  DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL,
  DD214_ANALYSIS_SYSTEM_PROMPT,
} = await import("./DD214Analyzer.jsx");

beforeEach(() => {
  vi.clearAllMocks();
  unifiedAIService.generateAI.mockResolvedValue({ text: "{}" });
});

describe("_runTextAnalysis: sizes for the backend that will actually run", () => {
  it("Cloud preferred + an on-device engine ready: still uses the LOCAL-sized system prompt", async () => {
    unifiedAIService.getDocumentAIRouting.mockReturnValue({
      onDeviceReady: true,
      onDeviceMode: "swarm",
      blockedProviderLabel: null,
    });

    await _runTextAnalysis("some DD214 text", vi.fn());

    expect(unifiedAIService.generateAI.mock.calls[0][1].systemPrompt).toBe(
      DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL,
    );
  });

  it("nothing on-device ready: uses the full (cloud) system prompt", async () => {
    unifiedAIService.getDocumentAIRouting.mockReturnValue({
      onDeviceReady: false,
      onDeviceMode: null,
      blockedProviderLabel: "Cloud AI (Gemini)",
    });

    await _runTextAnalysis("some DD214 text", vi.fn());

    expect(unifiedAIService.generateAI.mock.calls[0][1].systemPrompt).toBe(
      DD214_ANALYSIS_SYSTEM_PROMPT,
    );
  });
});
