/**
 * Part 3 (final19): the import-time C-File AI analysis only completed in
 * 10/17 imports under 4-browser GPU load (6/6 alone) - a contended on-device
 * engine can time out or throw even though routing considered it "ready".
 * analyzeCFileWithAI used to swallow that into a silent `null` - the veteran
 * never learned their AI analysis was skipped, and nothing distinguished
 * "the AI found nothing" from "the AI call failed". This proves
 * buildSegmentedCFileResult now retries once with a longer timeout, and
 * only when that also fails, surfaces a plain notice - while segmentation/
 * codeSheet/deployments (this veteran's imported data) are never lost.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("./unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateAI: vi.fn(),
    getDocumentAIRouting: vi.fn(),
    isAnyAIAvailable: vi.fn(() => true),
  };
});

const unifiedAIService = await import("./unifiedAIService.js");
const { buildSegmentedCFileResult } = await import("./musterCallProcessor.js");

const filler = (label) =>
  `${label} continuation text. `.repeat(20) +
  "Additional narrative body so the segment clears the 200-character minimum length filter.";

const CFILE_TEXT = [
  "DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY",
  "CHARACTER OF SERVICE: HONORABLE",
  filler("Service record"),
  "RATING DECISION",
  "The evidence shows service connection is warranted.",
  filler("Decision narrative"),
].join("\n");

function mockAnalysisResponse() {
  return {
    text: JSON.stringify({ potential_claims: [], exposures: [] }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  unifiedAIService.getDocumentAIRouting.mockReturnValue({
    onDeviceReady: true,
    blockedProviderLabel: null,
  });
});

describe("buildSegmentedCFileResult: AI analysis failure under contention", () => {
  it("retries once and succeeds: no notice, real analysis returned", async () => {
    unifiedAIService.generateAI
      .mockRejectedValueOnce(new Error("WebGPU inference timed out after 120s"))
      .mockResolvedValueOnce(mockAnalysisResponse());

    const result = await buildSegmentedCFileResult(CFILE_TEXT, {});

    expect(unifiedAIService.generateAI).toHaveBeenCalledTimes(2);
    expect(result.aiAnalysis).not.toBeNull();
    expect(result.aiAnalysisNotice).toBeNull();
    expect(result.offDeviceNotice).toBeNull();
  }, 15_000);

  it("retries with a longer timeout on the second attempt", async () => {
    unifiedAIService.generateAI
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(mockAnalysisResponse());

    await buildSegmentedCFileResult(CFILE_TEXT, {});

    const firstCallTimeout =
      unifiedAIService.generateAI.mock.calls[0][1].timeout;
    const secondCallTimeout =
      unifiedAIService.generateAI.mock.calls[1][1].timeout;
    expect(secondCallTimeout).toBeGreaterThan(firstCallTimeout || 0);
    expect(secondCallTimeout).toBeGreaterThanOrEqual(150_000);
  }, 15_000);

  it("both attempts fail: surfaces a plain notice, never silent, and loses no imported data", async () => {
    unifiedAIService.generateAI.mockRejectedValue(
      new Error("WebGPU inference timed out after 120s"),
    );

    const result = await buildSegmentedCFileResult(CFILE_TEXT, {
      estimatedPages: 1,
    });

    expect(unifiedAIService.generateAI).toHaveBeenCalledTimes(2);
    expect(result.aiAnalysis).toBeNull();
    expect(typeof result.aiAnalysisNotice).toBe("string");
    expect(result.aiAnalysisNotice.length).toBeGreaterThan(0);

    // The veteran's actual imported data must survive an AI failure intact.
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.summary).toEqual({ estimatedPages: 1 });
    expect(result.type).toBe("c_file");
  }, 15_000);

  it("off-device-blocked case is unchanged: no AI call attempted, no failure notice", async () => {
    unifiedAIService.getDocumentAIRouting.mockReturnValue({
      onDeviceReady: false,
      blockedProviderLabel: "Cloud AI (Gemini)",
    });

    const result = await buildSegmentedCFileResult(CFILE_TEXT, {});

    expect(unifiedAIService.generateAI).not.toHaveBeenCalled();
    expect(result.offDeviceNotice).toContain("on-device AI");
    expect(result.aiAnalysisNotice).toBeNull();
  });
});
