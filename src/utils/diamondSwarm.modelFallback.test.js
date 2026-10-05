import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const engineApi = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@mlc-ai/web-llm", () => ({
  CreateWebWorkerMLCEngine: engineApi.create,
  WebWorkerMLCEngineHandler: class {},
}));
vi.mock("./deviceCapabilityDetector", async (importOriginal) => ({
  ...(await importOriginal()),
  detectDeviceCapabilities: vi.fn().mockResolvedValue({
    canUseWebLLM: true,
    tier: "desktop-high",
    recommendedModels: [
      "Qwen3.5-4B-q4f16_1-MLC",
      "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    ],
    contextWindowSize: 12288,
  }),
}));

const terminate = vi.fn();
class FakeWorker {
  terminate() {
    terminate();
  }
}

const { initializeSwarm } = await import("./diamondSwarm.js");
const { resetEngineLoadStallBudget } = await import("./engineLoadStall.js");

beforeEach(() => {
  resetEngineLoadStallBudget();
  vi.clearAllMocks();
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
