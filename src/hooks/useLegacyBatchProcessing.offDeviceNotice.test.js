/**
 * ADR-009: generateMusterCallReport computes an offDeviceNotice when only an
 * off-device AI is configured, but runBatchOnComplete only ever read
 * reportResult.report - the notice was silently dropped, so the veteran saw
 * the off-device fallback report with no explanation of why it wasn't a
 * real AI analysis.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("../utils/musterCallProcessor", () => ({
  processMusterCallBatch: vi.fn(async (files, { onComplete }) => {
    await onComplete({ results: { summary: {} }, classified: {} });
    return { success: true };
  }),
  autoPopulateProfile: vi.fn().mockResolvedValue({ success: true, count: 0 }),
  generateMusterCallReport: vi.fn(),
  analyzeEvidenceGaps: vi.fn(() => ({ success: true, totalGaps: 0 })),
  extractIntelligenceBriefingData: vi.fn(() => ({})),
  PROCESSING_STATES: { IDLE: "IDLE", COMPLETE: "COMPLETE" },
}));

vi.mock("../utils/unifiedAIService", () => ({
  isAnyAIAvailable: vi.fn(() => true),
  getAIStatus: vi.fn(() => ({})),
}));

const musterCallProcessor = await import("../utils/musterCallProcessor.js");
const { useLegacyBatchProcessing } =
  await import("./useLegacyBatchProcessing.js");

describe("useLegacyBatchProcessing: offDeviceNotice reaches the hook's return value", () => {
  it("surfaces reportResult.offDeviceNotice after a successful off-device-fallback report", async () => {
    musterCallProcessor.generateMusterCallReport.mockResolvedValue({
      success: true,
      report: "Fallback report text",
      offDeviceBlocked: true,
      offDeviceNotice:
        "Your documents are only read by the on-device AI, so this file was not sent to Cloud AI (Gemini).",
    });

    const { result } = renderHook(() =>
      useLegacyBatchProcessing({
        files: [new File(["x"], "a.pdf")],
        setError: vi.fn(),
        setProcessingState: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleStartBatchProcessing();
    });

    await waitFor(() => {
      expect(result.current.offDeviceNotice).toBe(
        "Your documents are only read by the on-device AI, so this file was not sent to Cloud AI (Gemini).",
      );
    });
    expect(result.current.report).toBe("Fallback report text");
  });

  it("clears offDeviceNotice back to null when the AI report succeeds normally", async () => {
    musterCallProcessor.generateMusterCallReport.mockResolvedValue({
      success: true,
      report: "Real AI report",
    });

    const { result } = renderHook(() =>
      useLegacyBatchProcessing({
        files: [new File(["x"], "a.pdf")],
        setError: vi.fn(),
        setProcessingState: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleStartBatchProcessing();
    });

    await waitFor(() => {
      expect(result.current.report).toBe("Real AI report");
    });
    expect(result.current.offDeviceNotice).toBeNull();
  });
});
