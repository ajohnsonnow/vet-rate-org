import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const engineApi = vi.hoisted(() => ({
  create: vi.fn(),
  profile: vi.fn(),
}));
vi.mock("@mlc-ai/web-llm", () => ({
  CreateWebWorkerMLCEngine: engineApi.create,
  WebWorkerMLCEngineHandler: class {},
}));
vi.mock("./deviceCapabilityDetector", async (importOriginal) => ({
  ...(await importOriginal()),
  detectDeviceCapabilities: engineApi.profile,
}));

const terminate = vi.fn();
class FakeWorker {
  terminate() {
    terminate();
  }
}

const { initializeSwarm } = await import("./diamondSwarm.js");
const { resetEngineLoadStallBudget } = await import("./engineLoadStall.js");

const TIER_PROFILE = {
  canUseWebLLM: true,
  tier: "desktop-high",
  recommendedModels: [
    "Qwen3.5-4B-q4f16_1-MLC",
    "Qwen2.5-3B-Instruct-q4f16_1-MLC",
  ],
  contextWindowSize: 12288,
};

beforeEach(() => {
  resetEngineLoadStallBudget();
  vi.clearAllMocks();
  engineApi.profile.mockResolvedValue(TIER_PROFILE);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("navigator", {
    ...globalThis.navigator,
    gpu: {
      requestAdapter: async () => ({
        limits: {},
        features: new Set(),
        requestDevice: async () => ({}),
      }),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("model fallback order", () => {
  it("moves to the next model id when the first fails to load, at the tier's window", async () => {
    engineApi.create
      .mockRejectedValueOnce(new Error("device lost: out of memory"))
      .mockResolvedValueOnce({ chat: {} });

    await expect(initializeSwarm({ modelId: "auditor" })).resolves.toBe(true);

    expect(engineApi.create.mock.calls.map((call) => call[1])).toEqual([
      "Qwen3.5-4B-q4f16_1-MLC",
      "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    ]);
    expect(engineApi.create.mock.calls[1][3]).toEqual({
      context_window_size: 12288,
    });
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it("loads only the first model when it succeeds", async () => {
    engineApi.create.mockResolvedValueOnce({ chat: {} });
    await expect(initializeSwarm({ modelId: "auditor" })).resolves.toBe(true);
    expect(engineApi.create).toHaveBeenCalledTimes(1);
  });
});

describe("default model list when a profile lists none", () => {
  it("is the desktop-high list, so no second list can drift", async () => {
    const { DESKTOP_HIGH_MODELS } = await import("./deviceCapabilityDetector");
    engineApi.profile.mockResolvedValue({
      ...TIER_PROFILE,
      recommendedModels: [],
    });
    engineApi.create.mockRejectedValue(new Error("no"));

    await expect(initializeSwarm({ modelId: "auditor" })).resolves.toBe(false);

    expect(engineApi.create.mock.calls.map((call) => call[1])).toEqual(
      DESKTOP_HIGH_MODELS,
    );
    expect(DESKTOP_HIGH_MODELS[0]).toBe("Qwen3.5-4B-q4f16_1-MLC");
  });
});

describe("when every model fails", () => {
  it("returns false and tells onError which model failed with which reason", async () => {
    engineApi.profile.mockResolvedValue({
      ...TIER_PROFILE,
      recommendedModels: ["model-a", "model-b"],
    });
    engineApi.create.mockRejectedValue(
      new Error("UnknownError: Failed to execute 'open' on 'CacheStorage'"),
    );
    const onError = vi.fn();

    await expect(
      initializeSwarm({ modelId: "auditor", onError }),
    ).resolves.toBe(false);

    const error = onError.mock.calls[0][0];
    expect(error.failures.map((f) => f.modelId)).toEqual([
      "model-a",
      "model-b",
    ]);
    expect(error.failures[0].reason).toMatch(/CacheStorage/);
  });
});
