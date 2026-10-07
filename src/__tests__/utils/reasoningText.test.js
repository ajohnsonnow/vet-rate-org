import { describe, it, expect } from "vitest";
import {
  buildThinkingRequestFields,
  createReasoningStreamFilter,
  modelSupportsThinking,
  splitReasoning,
  stripReasoning,
} from "../../utils/reasoningText";

const STRIP_ROWS = [
  {
    name: "no block at all is returned byte-for-byte",
    raw: "  Your rating is 70%.\n\n  Second line.  ",
    text: "  Your rating is 70%.\n\n  Second line.  ",
    hadReasoning: false,
    answered: true,
  },
  {
    name: "empty string",
    raw: "",
    text: "",
    hadReasoning: false,
    answered: true,
  },
  {
    name: "a complete block is removed with the whitespace after it",
    raw: "<think>\nwork it out\n</think>\n\nThe answer is 70%.",
    text: "The answer is 70%.",
    hadReasoning: true,
    answered: true,
  },
  {
    name: "leading whitespace before the block is tolerated",
    raw: "\n  <think>x</think>Answer",
    text: "Answer",
    hadReasoning: true,
    answered: true,
  },
  {
    name: "an empty block (thinking off) leaves the answer",
    raw: "<think>\n\n</think>\n\nAnswer",
    text: "Answer",
    hadReasoning: true,
    answered: true,
  },
  {
    name: "repeated leading blocks are all removed",
    raw: "<think>a</think>\n<think>b</think>\nAnswer",
    text: "Answer",
    hadReasoning: true,
    answered: true,
  },
  {
    name: "a nested tag inside the block does not end it early",
    raw: "<think>a <think>b</think> c</think>Answer",
    text: "Answer",
    hadReasoning: true,
    answered: true,
  },
  {
    name: "a literal <think> later in the answer is left alone",
    raw: "Use the <think> tag like this: <think>x</think> in your prompt.",
    text: "Use the <think> tag like this: <think>x</think> in your prompt.",
    hadReasoning: false,
    answered: true,
  },
  {
    name: "a literal <think> after a stripped block is left alone",
    raw: "<think>r</think>The model writes <think>x</think> here.",
    text: "The model writes <think>x</think> here.",
    hadReasoning: true,
    answered: true,
  },
  {
    name: "a close tag with no opening tag is ordinary text",
    raw: "Answer </think> trailing",
    text: "Answer </think> trailing",
    hadReasoning: false,
    answered: true,
  },
  {
    name: "text that merely starts like the tag is an answer",
    raw: "<thinking> about it",
    text: "<thinking> about it",
    hadReasoning: false,
    answered: true,
  },
  {
    name: "an unterminated block leaves nothing visible",
    raw: "<think>\nstill working on the combined rating and",
    text: "",
    hadReasoning: true,
    unterminated: true,
    answered: false,
  },
  {
    name: "an unterminated nested block leaves nothing visible",
    raw: "<think>a <think>b</think> still going",
    text: "",
    hadReasoning: true,
    unterminated: true,
    answered: false,
  },
  {
    name: "a complete block with no answer after it is not an answer",
    raw: "<think>done</think>\n\n",
    text: "",
    hadReasoning: true,
    answered: false,
  },
];

describe("stripReasoning", () => {
  it.each(STRIP_ROWS)("$name", (row) => {
    const out = stripReasoning(row.raw);
    expect(out.text).toBe(row.text);
    expect(out.raw).toBe(row.raw);
    expect(out.hadReasoning).toBe(row.hadReasoning);
    expect(out.unterminated).toBe(row.unterminated ?? false);
    expect(out.answered).toBe(row.answered);
  });

  it("treats a non-string as an empty reply", () => {
    expect(stripReasoning(undefined)).toMatchObject({ text: "", raw: "" });
  });
});

describe("createReasoningStreamFilter", () => {
  const run = (deltas) => {
    const seen = [];
    const filter = createReasoningStreamFilter((delta, full) =>
      seen.push([delta, full]),
    );
    for (const d of deltas) filter.push(d);
    filter.end();
    return seen;
  };
  const shown = (seen) => seen.map(([d]) => d).join("");

  it("never emits any part of a reasoning block, however it is chunked", () => {
    const raw = "<think>\nsecret working\n</think>\n\nThe answer is 70%.";
    for (const size of [1, 2, 3, 7, 11, raw.length]) {
      const chunks = raw.match(new RegExp(`[\\s\\S]{1,${size}}`, "g"));
      const seen = run(chunks);
      expect(shown(seen), `chunk size ${size}`).toBe("The answer is 70%.");
      expect(seen.every(([d]) => !d.includes("think"))).toBe(true);
    }
  });

  it("passes a reply with no block through unchanged, whatever the chunking", () => {
    const raw = "  <b>Hello</b> world <think>literal</think>";
    for (const size of [1, 2, 5, raw.length]) {
      const chunks = raw.match(new RegExp(`[\\s\\S]{1,${size}}`, "g"));
      expect(shown(run(chunks)), `chunk size ${size}`).toBe(raw);
    }
  });

  it("holds back a partial tag and releases it when it turns out to be text", () => {
    const seen = run(["<thi", "nking> out loud"]);
    expect(shown(seen)).toBe("<thinking> out loud");
  });

  it("flushes a whitespace-only reply at the end", () => {
    expect(shown(run(["  ", "\n"]))).toBe("  \n");
  });

  it("emits nothing for an unterminated block", () => {
    expect(run(["<think>", "never ", "closes"])).toEqual([]);
  });

  it("the full text passed along is the visible text so far", () => {
    const seen = run(["<think>x</think>", "Hel", "lo"]);
    expect(seen).toEqual([
      ["Hel", "Hel"],
      ["lo", "Hello"],
    ]);
  });

  it("agrees with splitReasoning on the final visible text", () => {
    const raw = "<think>a</think><think>b</think>Done";
    expect(shown(run([...raw]))).toBe(splitReasoning(raw).visible);
  });
});

describe("thinking request field", () => {
  it("recognises the Qwen3 family and nothing else", () => {
    expect(modelSupportsThinking("Qwen3.5-4B-q4f16_1-MLC")).toBe(true);
    expect(modelSupportsThinking("Qwen3-4B-q4f16_1-MLC")).toBe(true);
    expect(modelSupportsThinking("Qwen2.5-3B-Instruct-q4f16_1-MLC")).toBe(
      false,
    );
    expect(modelSupportsThinking("Llama-3.2-3B-Instruct-q4f32_1-MLC")).toBe(
      false,
    );
    expect(modelSupportsThinking(null)).toBe(false);
  });

  it("is OFF by default for a thinking-capable model", () => {
    expect(buildThinkingRequestFields("Qwen3.5-4B-q4f16_1-MLC")).toEqual({
      extra_body: { enable_thinking: false },
    });
    expect(
      buildThinkingRequestFields("Qwen3.5-4B-q4f16_1-MLC", undefined),
    ).toEqual({ extra_body: { enable_thinking: false } });
    expect(buildThinkingRequestFields("Qwen3.5-4B-q4f16_1-MLC", false)).toEqual(
      { extra_body: { enable_thinking: false } },
    );
  });

  it("is ON only for an explicit true", () => {
    expect(buildThinkingRequestFields("Qwen3-4B-q4f16_1-MLC", true)).toEqual({
      extra_body: { enable_thinking: true },
    });
    expect(buildThinkingRequestFields("Qwen3-4B-q4f16_1-MLC", "yes")).toEqual({
      extra_body: { enable_thinking: false },
    });
  });

  it("adds no field at all for a model that does not reason", () => {
    expect(
      buildThinkingRequestFields("Qwen2.5-3B-Instruct-q4f16_1-MLC", true),
    ).toEqual({});
    expect(
      buildThinkingRequestFields("Llama-3.2-3B-Instruct-q4f32_1-MLC"),
    ).toEqual({});
  });
});
