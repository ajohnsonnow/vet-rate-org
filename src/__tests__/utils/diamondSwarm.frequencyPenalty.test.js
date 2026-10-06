/**
 * The frequency penalty sent with an on-device chat request comes from the
 * loaded model's row in the device profile table: the 2B (which ran answers
 * into repetition loops in evaluation) gets a modest penalty, the 4B none.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const engineState = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@mlc-ai/web-llm", () => ({
  CreateWebWorkerMLCEngine: vi.fn(async () => ({
    chat: { completions: { create: engineState.create } },
    interruptGenerate: vi.fn(),
  })),
}));

const profile = vi.hoisted(() => ({ value: null }));
vi.mock("../../utils/deviceCapabilityDetector", async (importOriginal) => ({
  ...(await importOriginal()),
  detectDeviceCapabilities: vi.fn(async () => profile.value),
}));

import { generateWithSwarm, initializeSwarm } from "../../utils/diamondSwarm";
import {
  SMALL_MODEL_FREQUENCY_PENALTY,
  getModelFrequencyPenalty,
} from "../../utils/deviceCapabilityDetector";

class FakeWorker {
  terminate() {}
}

const reply = {
  choices: [{ message: { content: "Fine." }, finish_reason: "stop" }],
};
const sentRequest = () => engineState.create.mock.calls.at(-1)[0];

async function loadModel(modelId) {
  profile.value = {
    canUseWebLLM: true,
    tier: "laptop",
    recommendedModels: [modelId],
  };
  expect(await initializeSwarm("auditor")).toBe(true);
}

beforeEach(() => {
  engineState.create.mockReset();
  engineState.create.mockResolvedValue(reply);
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("navigator", {
    ...globalThis.navigator,
    gpu: { requestAdapter: async () => ({}) },
  });
  window._mlc_gpu_patched = true;
});

describe("per-model frequency penalty table", () => {
  it("starts the 2B at a modest named value and leaves the others at 0", () => {
    expect(SMALL_MODEL_FREQUENCY_PENALTY).toBeCloseTo(0.3, 5);
    expect(getModelFrequencyPenalty("Qwen3.5-2B-q4f16_1-MLC")).toBeCloseTo(
      0.3,
      5,
    );
    expect(getModelFrequencyPenalty("Qwen3.5-4B-q4f16_1-MLC")).toBe(0);
    expect(getModelFrequencyPenalty("Qwen2.5-1.5B-Instruct-q4f16_1-MLC")).toBe(
      0,
    );
    expect(getModelFrequencyPenalty("Some-New-Model-MLC")).toBe(0);
    expect(getModelFrequencyPenalty(null)).toBe(0);
  });
});

describe("chat request frequency_penalty", () => {
  it("is the 2B's penalty for a plain-text answer", async () => {
    await loadModel("Qwen3.5-2B-q4f16_1-MLC");
    await generateWithSwarm("q", { agentId: "auditor" });
    expect(sentRequest().frequency_penalty).toBeCloseTo(0.3, 5);
  });

  it("is 0 on the 4B", async () => {
    await loadModel("Qwen3.5-4B-q4f16_1-MLC");
    await generateWithSwarm("q", { agentId: "auditor" });
    expect(sentRequest().frequency_penalty).toBe(0);
  });

  it("keeps the schema-constrained value for structured output", async () => {
    await loadModel("Qwen3.5-2B-q4f16_1-MLC");
    engineState.create.mockImplementation(async function* () {
      yield { choices: [{ delta: { content: "{}" }, finish_reason: "stop" }] };
    });
    await generateWithSwarm("q", {
      agentId: "auditor",
      responseFormat: { type: "object", properties: {} },
    });
    expect(sentRequest().frequency_penalty).toBeCloseTo(1.15, 5);
  });
});

describe("evaluation override", () => {
  it("replaces the model's value when the caller passes one", async () => {
    await loadModel("Qwen3.5-2B-q4f16_1-MLC");
    await generateWithSwarm("q", { agentId: "auditor", frequencyPenalty: 0 });
    expect(sentRequest().frequency_penalty).toBe(0);
    await generateWithSwarm("q", { agentId: "auditor", frequencyPenalty: 0.7 });
    expect(sentRequest().frequency_penalty).toBeCloseTo(0.7, 5);
  });

  it("applies to the 4B as well", async () => {
    await loadModel("Qwen3.5-4B-q4f16_1-MLC");
    await generateWithSwarm("q", { agentId: "auditor", frequencyPenalty: 0.5 });
    expect(sentRequest().frequency_penalty).toBeCloseTo(0.5, 5);
  });

  it.each([undefined, null, "0.5", Number.NaN, -1, 3])(
    "ignores %j and keeps the per-model value",
    async (bad) => {
      await loadModel("Qwen3.5-2B-q4f16_1-MLC");
      await generateWithSwarm("q", {
        agentId: "auditor",
        frequencyPenalty: bad,
      });
      expect(sentRequest().frequency_penalty).toBeCloseTo(0.3, 5);
    },
  );
});
