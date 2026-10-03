/**
 * D22-6: the main-thread on-device engine load (non-Diamond models) must end
 * with a plain message when it stops making progress, not sit on the loading
 * text forever. The engine library is a fake whose load the test controls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const engineApi = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@mlc-ai/web-llm", () => ({
  CreateMLCEngine: engineApi.create,
  CreateWebWorkerMLCEngine: vi.fn(),
  WebWorkerMLCEngineHandler: class {},
  ModelType: {},
  hasModelInCache: vi.fn().mockResolvedValue(false),
  prebuiltAppConfig: { model_list: [] },
}));

const { useLocalAIProviderState } = await import("./useLocalAIProviderState");
const { ENGINE_LOAD_STALL_MS, resetEngineLoadStallBudget } =
  await import("../utils/engineLoadStall");

beforeEach(() => {
  resetEngineLoadStallBudget();
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

const LEGACY_MODEL_ID = "legacy-model-q4f16_1-MLC";

async function loadFor(result, ms) {
  await act(async () => {
    const pending = result.current.initializeEngine(LEGACY_MODEL_ID);
    await vi.advanceTimersByTimeAsync(ms);
    await pending;
  });
}

describe("legacy engine load stall", () => {
  it("shows a plain message and stops loading when progress stops", async () => {
    engineApi.create.mockImplementation((_id, options) => {
      options.initProgressCallback({ progress: 0.99, text: "Fetching 99/100" });
      return new Promise(() => {});
    });
    const { result } = renderHook(() => useLocalAIProviderState());

    await loadFor(result, ENGINE_LOAD_STALL_MS + 1000);

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toMatch(/stopped making progress/);
    expect(result.current.isReady).toBe(false);
  });

  it("does not cut off a load that keeps reporting progress", async () => {
    let finish;
    engineApi.create.mockImplementation((_id, options) => {
      setTimeout(
        () => options.initProgressCallback({ progress: 0.5, text: "shard" }),
        ENGINE_LOAD_STALL_MS * 0.9,
      );
      setTimeout(
        () => finish({ chat: {}, unload: vi.fn() }),
        ENGINE_LOAD_STALL_MS * 1.6,
      );
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const { result } = renderHook(() => useLocalAIProviderState());

    await loadFor(result, ENGINE_LOAD_STALL_MS * 2);

    expect(result.current.error).toBeNull();
    expect(result.current.isReady).toBe(true);
  });
});
