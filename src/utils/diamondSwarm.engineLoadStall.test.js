/**
 * D22-6: a first-time on-device engine load that stops making progress must
 * end with a plain message, never an endless spinner, while a slow download
 * that keeps advancing is never cut off. The engine is a fake whose load the
 * test controls; timers are fake so minutes pass instantly.
 */
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
    recommendedModels: ["fake-model-a", "fake-model-b"],
    contextWindowSize: 4096,
  }),
}));

const terminate = vi.fn();
class FakeWorker {
  terminate() {
    terminate();
  }
}

const { initializeSwarm, EngineLoadStalledError } =
  await import("./diamondSwarm.js");
const { ENGINE_LOAD_STALL_MS, resetEngineLoadStallBudget } =
  await import("./engineLoadStall.js");

const FAKE_ENGINE = { chat: {} };

beforeEach(() => {
  resetEngineLoadStallBudget();
  vi.useFakeTimers();
  vi.clearAllMocks();
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("engine load stall detection", () => {
  it("ends a load that never reports progress with a plain error, once, without trying another model", async () => {
    engineApi.create.mockReturnValue(new Promise(() => {}));

    const outcome = initializeSwarm({ modelId: "fake-model-a" }).catch(
      (error) => error,
    );
    await vi.advanceTimersByTimeAsync(ENGINE_LOAD_STALL_MS + 1000);

    const error = await outcome;
    expect(error).toBeInstanceOf(EngineLoadStalledError);
    expect(error.message).toMatch(/stopped making progress/);
    expect(error.message).toMatch(/try again/i);
    expect(engineApi.create).toHaveBeenCalledTimes(1);
    expect(terminate).toHaveBeenCalled();
  });

  it("ends a load whose progress stops partway", async () => {
    engineApi.create.mockImplementation((_worker, _id, options) => {
      options.initProgressCallback({ progress: 0.4, text: "Fetching 4/10" });
      return new Promise(() => {});
    });

    const outcome = initializeSwarm({ modelId: "fake-model-a" }).catch(
      (error) => error,
    );
    await vi.advanceTimersByTimeAsync(ENGINE_LOAD_STALL_MS + 1000);

    expect(await outcome).toBeInstanceOf(EngineLoadStalledError);
  });
});

describe("engine load: slow loads and retries", () => {
  it("never cuts off a slow load that keeps advancing, however long it takes", async () => {
    let finish;
    engineApi.create.mockImplementation((_worker, _id, options) => {
      let step = 0;
      const tick = setInterval(() => {
        step += 1;
        options.initProgressCallback({
          progress: step / 100,
          text: `Fetching ${step}/100`,
        });
        if (step === 100) {
          clearInterval(tick);
          finish();
        }
      }, ENGINE_LOAD_STALL_MS / 2);
      return new Promise((resolve) => {
        finish = () => resolve(FAKE_ENGINE);
      });
    });

    const outcome = initializeSwarm({ modelId: "fake-model-a" });
    await vi.advanceTimersByTimeAsync((ENGINE_LOAD_STALL_MS / 2) * 101);

    await expect(outcome).resolves.toBe(true);
    expect(terminate).not.toHaveBeenCalled();
  });

  it("ends a load whose progress stops at 99%", async () => {
    engineApi.create.mockImplementation((_worker, _id, options) => {
      options.initProgressCallback({ progress: 0.99, text: "Fetching 99/100" });
      return new Promise(() => {});
    });

    const outcome = initializeSwarm({ modelId: "fake-model-a" }).catch(
      (error) => error,
    );
    await vi.advanceTimersByTimeAsync(ENGINE_LOAD_STALL_MS + 1000);

    expect(await outcome).toBeInstanceOf(EngineLoadStalledError);
  });

  it("waits through a slow first part: the library reports once per finished weight shard", async () => {
    engineApi.create.mockImplementation((_worker, _id, options) => {
      setTimeout(
        () => options.initProgressCallback({ progress: 0.1, text: "shard 1" }),
        ENGINE_LOAD_STALL_MS * 0.9,
      );
      return new Promise((resolve) => {
        setTimeout(() => resolve(FAKE_ENGINE), ENGINE_LOAD_STALL_MS * 1.7);
      });
    });

    const outcome = initializeSwarm({ modelId: "fake-model-a" });
    await vi.advanceTimersByTimeAsync(ENGINE_LOAD_STALL_MS * 2);

    await expect(outcome).resolves.toBe(true);
    expect(terminate).not.toHaveBeenCalled();
  });
});

describe("engine load: the try after a stall", () => {
  it("waits twice as long on the try after a stall", async () => {
    engineApi.create.mockReturnValue(new Promise(() => {}));
    const first = initializeSwarm({ modelId: "fake-model-a" }).catch(
      (error) => error,
    );
    await vi.advanceTimersByTimeAsync(ENGINE_LOAD_STALL_MS + 1000);
    expect(await first).toBeInstanceOf(EngineLoadStalledError);

    let settled = false;
    const second = initializeSwarm({ modelId: "fake-model-a" }).catch(
      (error) => error,
    );
    second.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(ENGINE_LOAD_STALL_MS + 1000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(ENGINE_LOAD_STALL_MS);
    expect(await second).toBeInstanceOf(EngineLoadStalledError);
  });

  it("starts a clean second load after a stall", async () => {
    engineApi.create.mockReturnValueOnce(new Promise(() => {}));
    const first = initializeSwarm({ modelId: "fake-model-a" }).catch(
      (error) => error,
    );
    await vi.advanceTimersByTimeAsync(ENGINE_LOAD_STALL_MS + 1000);
    expect(await first).toBeInstanceOf(EngineLoadStalledError);

    engineApi.create.mockResolvedValueOnce(FAKE_ENGINE);
    await expect(initializeSwarm({ modelId: "fake-model-a" })).resolves.toBe(
      true,
    );
    expect(engineApi.create).toHaveBeenCalledTimes(2);
  });
});
