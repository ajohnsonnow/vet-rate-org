/**
 * WebLLM reports why generation stopped in choices[0].finish_reason: "length"
 * when it ran out of output tokens or filled the context window.
 * generateWithSwarm passes that on as `truncated`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const engineState = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@mlc-ai/web-llm", () => ({
  CreateWebWorkerMLCEngine: vi.fn(async () => ({
    chat: { completions: { create: engineState.create } },
    interruptGenerate: vi.fn(),
  })),
}));

const profile = vi.hoisted(() => ({
  value: {
    canUseWebLLM: true,
    tier: "desktop",
    recommendedModels: ["Qwen2.5-3B-Instruct-q4f16_1-MLC"],
  },
}));
vi.mock("../../utils/deviceCapabilityDetector", () => ({
  detectDeviceCapabilities: vi.fn(async () => profile.value),
  getCachedDeviceProfile: vi.fn(() => profile.value),
}));

import { generateWithSwarm, initializeSwarm } from "../../utils/diamondSwarm";

class FakeWorker {
  terminate() {}
}

const reply = (content, finishReason) => ({
  choices: [{ message: { content }, finish_reason: finishReason }],
});

async function* streamOf(finishReason, ...deltas) {
  for (const content of deltas) {
    yield { choices: [{ delta: { content } }] };
  }
  yield { choices: [{ delta: {}, finish_reason: finishReason }] };
}

beforeEach(async () => {
  engineState.create.mockReset();
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("navigator", {
    ...globalThis.navigator,
    gpu: { requestAdapter: async () => ({}) },
  });
  window._mlc_gpu_patched = true;
  expect(await initializeSwarm("auditor")).toBe(true);
});

describe("generateWithSwarm reports a length stop", () => {
  it.each([
    ["length", true],
    ["stop", false],
  ])("non-streaming, finish_reason %s", async (finish, truncated) => {
    engineState.create.mockResolvedValue(reply("An answer that", finish));
    const out = await generateWithSwarm("Question?");
    expect(out.text).toBe("An answer that");
    expect(out.truncated).toBe(truncated);
  });

  it.each([
    ["length", true],
    ["stop", false],
  ])("streaming, finish_reason %s", async (finish, truncated) => {
    engineState.create.mockResolvedValue(
      streamOf(finish, "An answer ", "that"),
    );
    const out = await generateWithSwarm("Question?", { onStream: vi.fn() });
    expect(out.text).toBe("An answer that");
    expect(out.truncated).toBe(truncated);
  });
});
