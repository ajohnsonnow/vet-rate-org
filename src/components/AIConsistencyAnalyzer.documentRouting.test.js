/**
 * ADR-009 / spec item 5: AI Cross-Examination's "compare" mode is legitimately
 * document-classed (referenceText is pasted evidence/medical-record text),
 * but with only an off-device AI configured it dead-ended with
 * "Analysis failed: <notice>. Please try again." - a double period, and a
 * retry suggestion that can never succeed since the routing decision can't
 * change. This proves the pre-flight check now shows the plain notice
 * without ever calling generateAI, and that a genuinely on-device setup is
 * unaffected.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../utils/unifiedAIService", () => ({
  generateAI: vi.fn(),
  isAnyAIAvailable: vi.fn(() => true),
  getDocumentAIRouting: vi.fn(),
}));

vi.mock("../utils/veteranContextProvider", () => ({
  getVeteranAIContext: vi.fn().mockResolvedValue(""),
  saveAnalysisResults: vi.fn().mockResolvedValue(undefined),
  PACKET_DOC_TYPES: { OTHER: "other" },
}));

const unifiedAIService = await import("../utils/unifiedAIService.js");
const { performConsistencyCheck } = await import("./AIConsistencyAnalyzer.jsx");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("performConsistencyCheck: compare mode off-device handling", () => {
  it("off-device only: shows the plain notice with no dead-end retry wording, and never calls generateAI", async () => {
    unifiedAIService.getDocumentAIRouting.mockReturnValue({
      onDeviceReady: false,
      blockedProviderLabel: "Cloud AI (Gemini)",
    });
    const setError = vi.fn();
    const setLoading = vi.fn();
    const setAnalysis = vi.fn();

    await performConsistencyCheck("compare", "evidence text", "my statement", {
      setLoading,
      setError,
      setAnalysis,
    });

    expect(unifiedAIService.generateAI).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledTimes(1);
    const message = setError.mock.calls[0][0];
    expect(message).not.toMatch(/Please try again/);
    expect(message).not.toMatch(/\.\./); // no doubled punctuation
    expect(message).toMatch(/on-device AI/);
  });

  it("on-device ready: still calls generateAI as document-classed (unaffected by the pre-flight check)", async () => {
    unifiedAIService.getDocumentAIRouting.mockReturnValue({
      onDeviceReady: true,
      blockedProviderLabel: null,
    });
    unifiedAIService.generateAI.mockResolvedValue({
      text: JSON.stringify({ overall_score: 80, issues: [] }),
    });
    const setError = vi.fn();
    const setLoading = vi.fn();
    const setAnalysis = vi.fn();

    await performConsistencyCheck("compare", "evidence text", "my statement", {
      setLoading,
      setError,
      setAnalysis,
    });

    expect(unifiedAIService.generateAI).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith(null);
    expect(setAnalysis).toHaveBeenCalledWith({ overall_score: 80, issues: [] });
  });
});
