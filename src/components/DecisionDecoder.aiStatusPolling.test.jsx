/**
 * aiStatus used to be set once at mount (useState(() => getAIStatus())) and
 * only refreshed inside SmartAILoadButton's onLoadComplete - if AI became
 * available any other way while the dialog was open (AI settings, a cloud
 * key entered, a model loaded elsewhere), the "Load AI" prompt never went
 * away, and if the model unloaded it never came back. DD214Analyzer.jsx's
 * useDD214AIStatus and BlueButtonXRay.jsx's useAIStatusPolling both poll
 * getAIStatus every second in addition to the load-button callback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../utils/ocr", () => ({
  analyzePDF: vi.fn(),
  analyzeImage: vi.fn(),
  OCR_STATES: {},
  formatFileSize: (bytes) => `${bytes} bytes`,
  isImageFile: () => false,
  isPDFFile: () => false,
}));
vi.mock("../utils/aiStatementHelper", () => ({
  decodeDecision: vi.fn(),
  isAIAvailable: () => false,
}));

const mockGetAIStatus = vi.fn(() => ({ anyAvailable: false }));
vi.mock("../utils/unifiedAIService", () => ({
  getAIStatus: () => mockGetAIStatus(),
}));

const { useAIStatusPolling } = await import("./DecisionDecoder.jsx");

describe("useAIStatusPolling: refreshes aiStatus without a load-button click", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetAIStatus.mockReturnValue({ anyAvailable: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("picks up AI becoming available elsewhere (e.g. AI settings) on the next poll tick", () => {
    const { result } = renderHook(() => useAIStatusPolling());
    expect(result.current.aiStatus.anyAvailable).toBe(false);

    mockGetAIStatus.mockReturnValue({ anyAvailable: true });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.aiStatus.anyAvailable).toBe(true);
  });

  it("also picks up AI becoming unavailable again (model unloaded / key removed)", () => {
    mockGetAIStatus.mockReturnValue({ anyAvailable: true });
    const { result } = renderHook(() => useAIStatusPolling());
    expect(result.current.aiStatus.anyAvailable).toBe(true);

    mockGetAIStatus.mockReturnValue({ anyAvailable: false });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.aiStatus.anyAvailable).toBe(false);
  });
});
