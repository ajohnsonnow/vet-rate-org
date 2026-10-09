/**
 * D20-6: all 4 natural import-time C-File AI failures were a disposed or
 * unloaded engine, and the single retry 1.5 s later failed the same way (or
 * queued behind the abandoned first call). The retry must now rebuild the
 * engine first - bounded, shared, and never able to lose imported data.
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
    reloadSwarmEngine: vi.fn(),
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

const analysisResponse = () => ({
  text: JSON.stringify({ potential_claims: [], exposures: [] }),
});

const routingFor = (onDeviceMode) => ({
  onDeviceReady: true,
  onDeviceMode,
  blockedProviderLabel: null,
});

const callOrder = [];
const disposedEngine = async () => {
  callOrder.push("generate");
  throw new Error("Module has been disposed / engine unloaded");
};

beforeEach(() => {
  vi.clearAllMocks();
  callOrder.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  unifiedAIService.getDocumentAIRouting.mockReturnValue(routingFor("swarm"));
  unifiedAIService.generateAI.mockImplementation(disposedEngine);
  unifiedAIService.reloadSwarmEngine.mockImplementation(async () => {
    callOrder.push("reload");
  });
});

describe("buildSegmentedCFileResult: reload before the single retry", () => {
  it("reloads once between the failed call and the retry, then returns the analysis", async () => {
    unifiedAIService.generateAI
      .mockImplementationOnce(disposedEngine)
      .mockImplementationOnce(async () => {
        callOrder.push("generate");
        return analysisResponse();
      });

    const result = await buildSegmentedCFileResult(CFILE_TEXT, {});

    expect(callOrder).toEqual(["generate", "reload", "generate"]);
    expect(result.aiAnalysis).not.toBeNull();
    expect(result.aiAnalysisNotice).toBeNull();
  }, 15_000);

  it("retries straight after the reload without the old pause", async () => {
    unifiedAIService.generateAI
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(analysisResponse());
    const timeouts = vi.spyOn(globalThis, "setTimeout");

    await buildSegmentedCFileResult(CFILE_TEXT, {});

    const pauses = timeouts.mock.calls.filter(([, ms]) => ms === 1500);
    expect(pauses).toHaveLength(0);
  }, 15_000);

  it("still retries and still surfaces the notice when the reload itself fails, losing no imported data", async () => {
    unifiedAIService.reloadSwarmEngine.mockRejectedValue(
      new Error("GPU process appears wedged"),
    );

    const result = await buildSegmentedCFileResult(CFILE_TEXT, {
      estimatedPages: 1,
    });

    expect(unifiedAIService.generateAI).toHaveBeenCalledTimes(2);
    expect(result.aiAnalysis).toBeNull();
    expect(result.aiAnalysisNotice).toMatch(/AI analysis of this document/);
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.summary).toEqual({ estimatedPages: 1 });
  }, 15_000);

  it("does not reload an engine that has no reload (local server)", async () => {
    unifiedAIService.getDocumentAIRouting.mockReturnValue(
      routingFor("local_server"),
    );
    unifiedAIService.generateAI
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(analysisResponse());

    await buildSegmentedCFileResult(CFILE_TEXT, {});

    expect(unifiedAIService.reloadSwarmEngine).not.toHaveBeenCalled();
  }, 15_000);

  it("shares one rebuild when several imports fail at the same time", async () => {
    let release;
    unifiedAIService.reloadSwarmEngine.mockImplementation(
      () => new Promise((resolve) => (release = resolve)),
    );
    unifiedAIService.generateAI
      .mockRejectedValueOnce(new Error("a"))
      .mockRejectedValueOnce(new Error("b"))
      .mockResolvedValue(analysisResponse());

    const both = Promise.all([
      buildSegmentedCFileResult(CFILE_TEXT, {}),
      buildSegmentedCFileResult(CFILE_TEXT, {}),
    ]);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    release();
    await both;

    expect(unifiedAIService.reloadSwarmEngine).toHaveBeenCalledTimes(1);
  }, 15_000);
});
