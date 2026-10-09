/**
 * Regression: v3 swarm QLoRAs (rater3b/writer3b/auditor3b) were trained with
 * axolotl's `type: alpaca` dataset strategy, which renders plain
 * "### Instruction:\n...\n\n### Response:\n" text and never saw the
 * "<|system|>/<|user|>/<|assistant|>/<|end|>" tags wllamaService previously
 * sent — those tags aren't even in Llama-3.2's tokenizer vocab, so they were
 * shredded into meaningless subword fragments at inference. That mismatch
 * (not the LoRA weights) caused the JSON-tool-call/degenerate-repetition
 * regression. Separately, chatCompletion's real (only) caller passes a
 * plain string and expects {success, text}, but chatCompletion used to
 * iterate the string as an array of messages (dropping the content
 * entirely) and returned a bare string — every real WLLAMA-mode call threw.
 *
 * v4 update: axolotl's `type: alpaca` strategy also silently drops
 * `field_system`, so the persona/anti-hallucination system prompt was never
 * shown to the model either. Retrained (v4) with systemPrompt folded into
 * each training example's instruction field — this must fold it in the same
 * way at serve time or training/serving drift apart again.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateCompletion = vi.fn();
const mockLoadModelFromUrl = vi.fn().mockResolvedValue(undefined);

vi.mock("@wllama/wllama/esm/index.js", () => ({
  // Must be a real function (not an arrow) — wllamaService calls this with
  // `new`, and arrow functions can't be constructors.
  Wllama: vi.fn().mockImplementation(function MockWllama() {
    return {
      loadModelFromUrl: mockLoadModelFromUrl,
      createCompletion: mockCreateCompletion,
    };
  }),
}));

// loadModelFromUrl does a HEAD fetch to pick primary vs fallback URL, then
// resolves modelUrl against window.location.origin.
global.fetch = vi.fn().mockResolvedValue({ ok: true });

let wllamaService;

beforeEach(async () => {
  vi.resetModules();
  mockCreateCompletion.mockReset();
  mockLoadModelFromUrl.mockClear();
  wllamaService = await import("../../utils/wllamaService");
});

describe("wllamaService prompt format", () => {
  it("sends alpaca-format prompt (no fake chat tags) for a promptFormat:'alpaca' model", async () => {
    mockCreateCompletion.mockImplementation(async (_prompt, opts) => {
      opts.onToken("The combined rating is 80%.");
      return undefined;
    });

    const result = await wllamaService.chatCompletion(
      "Calculate my combined rating for: 50% PTSD, 30% back.",
      { modelId: "rater3b" },
    );

    expect(result).toEqual({
      success: true,
      text: "The combined rating is 80%.",
    });

    const [sentPrompt, sentOpts] = mockCreateCompletion.mock.calls[0];
    expect(sentPrompt).toContain(
      "Below is an instruction that describes a task.",
    );
    expect(sentPrompt).toContain("### Instruction:");
    expect(sentPrompt).toContain("### Response:");
    expect(sentPrompt).not.toContain("<|system|>");
    expect(sentPrompt).not.toContain("<|user|>");
    // v4: persona must be folded into the instruction, matching training.
    expect(sentPrompt).toContain(
      wllamaService.WLLAMA_MODELS.rater3b.systemPrompt,
    );
    expect(sentOpts.stopTokens).toEqual(["<|end_of_text|>", "### Instruction"]);
  });

  it("still sends the legacy tag format for non-alpaca (7B) models", async () => {
    mockCreateCompletion.mockImplementation(async (_prompt, opts) => {
      opts.onToken("ok");
      return undefined;
    });

    await wllamaService.chatCompletion("Some request", { modelId: "auditor" });

    const [sentPrompt, sentOpts] = mockCreateCompletion.mock.calls[0];
    expect(sentPrompt).toContain("<|system|>");
    expect(sentPrompt).toContain("<|user|>");
    expect(sentOpts.stopTokens).toEqual(["<|end|>", "<|user|>"]);
  });

  it("returns {success:false} instead of throwing when generation is aborted", async () => {
    mockCreateCompletion.mockImplementation(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });

    const result = await wllamaService.chatCompletion("Some request", {
      modelId: "rater3b",
    });

    expect(result).toEqual({ success: false, error: "Generation aborted" });
  });

  it("returns {success:false, error} instead of throwing on a real generation error", async () => {
    mockCreateCompletion.mockRejectedValue(new Error("model crashed"));

    const result = await wllamaService.chatCompletion("Some request", {
      modelId: "rater3b",
    });

    expect(result).toEqual({ success: false, error: "model crashed" });
  });
});
