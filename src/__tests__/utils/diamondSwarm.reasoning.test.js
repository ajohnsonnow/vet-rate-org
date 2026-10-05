/**
 * generateWithSwarm with thinking models: the reasoning block never reaches
 * a caller (or a streaming callback), an answer-less reply is a failed
 * generation, and the per-request reasoning switch is built correctly.
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
  value: { canUseWebLLM: true, tier: "desktop", recommendedModels: [] },
}));
vi.mock("../../utils/deviceCapabilityDetector", () => ({
  detectDeviceCapabilities: vi.fn(async () => profile.value),
  getCachedDeviceProfile: vi.fn(() => profile.value),
}));

import {
  clearLastSwarmGeneration,
  generateWithSwarm,
  getLastSwarmGeneration,
  initializeSwarm,
} from "../../utils/diamondSwarm";

const QWEN3 = "Qwen3.5-4B-q4f16_1-MLC";
const QWEN25 = "Qwen2.5-3B-Instruct-q4f16_1-MLC";

class FakeWorker {
  terminate() {}
}

async function loadModel(modelId) {
  profile.value = {
    canUseWebLLM: true,
    tier: "desktop",
    recommendedModels: [modelId],
  };
  expect(await initializeSwarm("auditor")).toBe(true);
}

const reply = (content) => ({
  choices: [{ message: { content }, finish_reason: "stop" }],
});

async function* streamOf(...deltas) {
  for (const content of deltas) {
    yield { choices: [{ delta: { content } }] };
  }
  yield { choices: [{ delta: {}, finish_reason: "stop" }] };
}

const sentRequest = () => engineState.create.mock.calls.at(-1)[0];

beforeEach(() => {
  engineState.create.mockReset();
  clearLastSwarmGeneration();
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("navigator", {
    ...globalThis.navigator,
    gpu: { requestAdapter: async () => ({}) },
  });
  window._mlc_gpu_patched = true;
});

describe("reasoning block removal", () => {
  beforeEach(() => loadModel(QWEN3));

  it("returns only the answer after a complete block, and keeps the raw text for diagnostics", async () => {
    const raw =
      "<think>\nthe user asks about 70%\n</think>\n\nYour rating is 70%.";
    engineState.create.mockResolvedValue(reply(raw));

    const result = await generateWithSwarm("q", { agentId: "rater" });

    expect(result.text).toBe("Your rating is 70%.");
    expect(getLastSwarmGeneration()).toMatchObject({
      raw,
      visible: "Your rating is 70%.",
      reasoningRemoved: true,
      unterminated: false,
    });
  });

  it("an unterminated block is a failed generation, not an empty success", async () => {
    engineState.create.mockResolvedValue(
      reply("<think>\nstill reasoning when the budget ran out"),
    );

    await expect(generateWithSwarm("q", { agentId: "rater" })).rejects.toThrow(
      /empty response/,
    );
    expect(getLastSwarmGeneration()).toMatchObject({
      reasoningRemoved: true,
      unterminated: true,
      visible: "",
    });
  });

  it("a block with nothing after it is also a failed generation", async () => {
    engineState.create.mockResolvedValue(reply("<think>done</think>\n"));
    await expect(generateWithSwarm("q", { agentId: "rater" })).rejects.toThrow(
      /empty response/,
    );
  });

  it("never streams the reasoning to onStream", async () => {
    engineState.create.mockResolvedValue(
      streamOf("<thi", "nk>secret ", "work</th", "ink>", "\n\nHello", " there"),
    );
    const seen = [];

    const result = await generateWithSwarm("q", {
      agentId: "auditor",
      onStream: (delta, full) => seen.push([delta, full]),
    });

    expect(result.text).toBe("Hello there");
    expect(seen.map(([d]) => d).join("")).toBe("Hello there");
    expect(seen.at(-1)[1]).toBe("Hello there");
    expect(JSON.stringify(seen)).not.toContain("secret");
    expect(JSON.stringify(seen)).not.toContain("think");
  });

  it("never streams the reasoning on the JSON (grammar) path either", async () => {
    engineState.create.mockResolvedValue(
      streamOf("<think>{not json}</think>", '{"a":', "1}"),
    );
    const seen = [];

    const result = await generateWithSwarm("q", {
      agentId: "auditor",
      responseFormat: { type: "object" },
      onStream: (delta) => seen.push(delta),
    });

    expect(JSON.stringify(seen)).not.toContain("think");
    expect(result.text).toBe('{"a":1}');
  });
});

describe("a model that does not reason", () => {
  beforeEach(() => loadModel(QWEN25));

  it("returns the reply byte-for-byte, including a literal <think> in the answer", async () => {
    for (const raw of [
      "  Plain answer.\n\n  Two lines.  ",
      "Use <think> tags like <think>this</think> sparingly.",
      "",
    ]) {
      engineState.create.mockResolvedValue(reply(raw));
      const result = await generateWithSwarm("q", { agentId: "auditor" });
      expect(result.text).toBe(raw);
      expect(getLastSwarmGeneration()).toMatchObject({
        raw,
        visible: raw,
        reasoningRemoved: false,
      });
    }
  });

  it("streams a reply with no block through unchanged", async () => {
    engineState.create.mockResolvedValue(streamOf("Hel", "lo ", "<b>x</b>"));
    const seen = [];
    const result = await generateWithSwarm("q", {
      agentId: "auditor",
      onStream: (delta) => seen.push(delta),
    });
    expect(result.text).toBe("Hello <b>x</b>");
    expect(seen.join("")).toBe("Hello <b>x</b>");
  });

  it("sends no reasoning field at all, whatever the option", async () => {
    engineState.create.mockResolvedValue(reply("ok"));
    await generateWithSwarm("q", { agentId: "auditor" });
    expect(sentRequest()).not.toHaveProperty("extra_body");
    await generateWithSwarm("q", { agentId: "auditor", thinking: true });
    expect(sentRequest()).not.toHaveProperty("extra_body");
  });
});

describe("the reasoning switch on the engine request", () => {
  beforeEach(() => loadModel(QWEN3));

  it("is off when the option is absent", async () => {
    engineState.create.mockResolvedValue(reply("ok"));
    await generateWithSwarm("q", { agentId: "auditor" });
    expect(sentRequest().extra_body).toEqual({ enable_thinking: false });
  });

  it("is off for an explicit false and on for an explicit true", async () => {
    engineState.create.mockResolvedValue(reply("ok"));
    await generateWithSwarm("q", { agentId: "auditor", thinking: false });
    expect(sentRequest().extra_body).toEqual({ enable_thinking: false });
    await generateWithSwarm("q", { agentId: "auditor", thinking: true });
    expect(sentRequest().extra_body).toEqual({ enable_thinking: true });
  });

  it("is carried on the streaming and JSON requests too", async () => {
    engineState.create.mockResolvedValue(streamOf("hi"));
    await generateWithSwarm("q", { agentId: "auditor", onStream: () => {} });
    expect(sentRequest().extra_body).toEqual({ enable_thinking: false });
    engineState.create.mockResolvedValue(streamOf("{}"));
    await generateWithSwarm("q", {
      agentId: "auditor",
      thinking: true,
      responseFormat: { type: "object" },
    });
    expect(sentRequest().extra_body).toEqual({ enable_thinking: true });
  });
});
