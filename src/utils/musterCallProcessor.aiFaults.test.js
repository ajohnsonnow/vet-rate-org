/**
 * D21-1 / D21-2: the C-File AI step must never wait forever, and a vanished
 * engine must be treated as the failure it is. Faults are injected at the AI
 * service boundary: a call that never settles, a reload that never resolves,
 * an engine that was running and is gone. buildSegmentedCFileResult itself,
 * the retry and the notice are the real code.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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

const READY = { onDeviceReady: true, onDeviceMode: "swarm" };
const GONE = {
  onDeviceReady: false,
  onDeviceMode: null,
  blockedProviderLabel: null,
};
const analysis = () => ({
  text: JSON.stringify({ potential_claims: [], exposures: [] }),
});

let ai;
let build;

async function load() {
  vi.resetModules();
  ai = await import("./unifiedAIService.js");
  ({ buildSegmentedCFileResult: build } =
    await import("./musterCallProcessor.js"));
  // The mocked module (and its call history) outlives resetModules.
  ai.generateAI.mockReset();
  ai.reloadSwarmEngine.mockReset();
  ai.generateAI.mockResolvedValue(analysis());
  ai.isAnyAIAvailable.mockReturnValue(true);
  ai.getDocumentAIRouting.mockReturnValue(READY);
}

beforeEach(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await load();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("faults that never settle are bounded", () => {
  it("an AI call and an engine reload that never settle still end in the plain notice, with the imported data intact", async () => {
    vi.useFakeTimers();
    ai.generateAI.mockImplementation(() => new Promise(() => {}));
    ai.reloadSwarmEngine.mockImplementation(() => new Promise(() => {}));

    const pending = build(CFILE_TEXT, { estimatedPages: 1 });
    await vi.advanceTimersByTimeAsync(135_000 + 330_000 + 195_000 + 1000);
    const result = await pending;

    expect(result.aiAnalysis).toBeNull();
    expect(result.aiAnalysisNotice).toMatch(/AI analysis of this document/);
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.summary).toEqual({ estimatedPages: 1 });
  });

  it("a reload that never settled is not shared with the next import", async () => {
    vi.useFakeTimers();
    ai.generateAI.mockImplementation(() => new Promise(() => {}));
    ai.reloadSwarmEngine.mockImplementation(() => new Promise(() => {}));

    const first = build(CFILE_TEXT, {});
    await vi.advanceTimersByTimeAsync(135_000 + 330_000 + 195_000 + 1000);
    await first;
    const second = build(CFILE_TEXT, {});
    await vi.advanceTimersByTimeAsync(135_000 + 330_000 + 195_000 + 1000);
    await second;

    expect(ai.reloadSwarmEngine).toHaveBeenCalledTimes(2);
  });
});

describe("an on-device engine that is gone mid-import (D21-2)", () => {
  it("rebuilds it, retries once, and returns the analysis when the rebuild works", async () => {
    await build(CFILE_TEXT, {});
    ai.generateAI.mockReset();
    ai.generateAI.mockResolvedValue(analysis());
    ai.getDocumentAIRouting.mockReturnValue(GONE);
    ai.isAnyAIAvailable.mockReturnValue(false);
    ai.reloadSwarmEngine.mockImplementation(async () => {
      ai.getDocumentAIRouting.mockReturnValue(READY);
      ai.isAnyAIAvailable.mockReturnValue(true);
    });

    const result = await build(CFILE_TEXT, {});

    expect(ai.reloadSwarmEngine).toHaveBeenCalledTimes(1);
    expect(ai.generateAI).toHaveBeenCalledTimes(1);
    expect(result.aiAnalysis).not.toBeNull();
    expect(result.aiAnalysisNotice).toBeNull();
  }, 20_000);

  it("shows the same notice, never a silent skip, when it still cannot run", async () => {
    await build(CFILE_TEXT, {});
    ai.generateAI.mockReset();
    ai.getDocumentAIRouting.mockReturnValue(GONE);
    ai.isAnyAIAvailable.mockReturnValue(false);
    ai.reloadSwarmEngine.mockRejectedValue(new Error("GPU process wedged"));

    const result = await build(CFILE_TEXT, {});

    expect(ai.reloadSwarmEngine).toHaveBeenCalledTimes(1);
    expect(result.aiAnalysis).toBeNull();
    expect(result.aiAnalysisNotice).toMatch(/AI analysis of this document/);
    expect(result.segments.length).toBeGreaterThan(0);
  }, 20_000);

  it("stays silent when no on-device engine was ever running (nothing to rebuild)", async () => {
    ai.getDocumentAIRouting.mockReturnValue(GONE);
    ai.isAnyAIAvailable.mockReturnValue(false);

    const result = await build(CFILE_TEXT, {});

    expect(ai.reloadSwarmEngine).not.toHaveBeenCalled();
    expect(result.aiAnalysis).toBeNull();
    expect(result.aiAnalysisNotice).toBeNull();
    expect(result.offDeviceNotice).toBeNull();
  });
});
