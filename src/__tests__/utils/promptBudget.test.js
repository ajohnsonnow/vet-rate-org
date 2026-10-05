import { describe, it, expect } from "vitest";
import {
  CHARS_PER_TOKEN,
  MIN_OUTPUT_TOKENS,
  cannotFit,
  fitOutputTokens,
  planPromptFit,
} from "../../utils/promptBudget";
import { buildSystemPrompt } from "../../utils/aiSystemPrompts";
import { SWARM_AGENTS } from "../../utils/diamondSwarm";

const PERSONA = Math.max(
  ...Object.values(SWARM_AGENTS).map((a) => a.systemPrompt.length),
);
const BASE = buildSystemPrompt({ task: "general" }).length;
const QUESTION = 100;
const FIXED = PERSONA + BASE + QUESTION;
const COMPUTED = 800;

describe("the real sizes this budget works with", () => {
  it("the default system prompt is 12,316 characters and the longest persona 2,906", () => {
    expect(BASE).toBe(12316);
    expect(PERSONA).toBe(2906);
  });

  it("uses the same 3 characters per token as the swarm's own truncation guard", () => {
    expect(CHARS_PER_TOKEN).toBe(3);
  });
});

describe("planPromptFit", () => {
  const plan = (contextWindow, requestedOutputTokens, computedChars = 0) =>
    planPromptFit({
      contextWindow,
      requestedOutputTokens,
      fixedChars: FIXED,
      computedChars,
    });

  it("desktop-high (12,288): the whole 4,000-character reference budget fits beside 2,048 output tokens", () => {
    const out = plan(12288, 2048, COMPUTED);
    expect(out.keepComputed).toBe(true);
    expect(out.referenceChars).toBeGreaterThan(4000);
  });

  it("8,192 with 2,048 output tokens leaves about 3,000 characters for reference material", () => {
    expect(plan(8192, 2048)).toEqual({
      keepComputed: true,
      referenceChars: 8192 * 3 - 2048 * 3 - FIXED - 200,
    });
    expect(plan(8192, 2048).referenceChars).toBe(2910);
  });

  it("8,192 with 1,024 output tokens (the evaluation setting) fits the whole budget", () => {
    expect(plan(8192, 1024, COMPUTED).referenceChars).toBeGreaterThan(4000);
  });

  it("the computed block is charged before reference material, so it is the last to go", () => {
    const out = plan(8192, 2048, COMPUTED);
    expect(out.keepComputed).toBe(true);
    expect(out.referenceChars).toBe(2910 - COMPUTED);
  });

  it("drops the computed block only when it cannot fit even with no reference material", () => {
    expect(plan(8192, 2048, 4000)).toEqual({
      keepComputed: false,
      referenceChars: 2910,
    });
  });

  it("reserves no more than 2,048 output tokens when a caller asks for more", () => {
    expect(plan(8192, 4096)).toEqual(plan(8192, 2048));
  });

  it("4,096 cannot hold the persona and the default prompt at all, whatever the output", () => {
    expect(FIXED).toBeGreaterThan(4096 * 3 - 768 * 3);
    expect(plan(4096, 768, COMPUTED)).toEqual({
      keepComputed: false,
      referenceChars: 0,
    });
  });
});

describe("fitOutputTokens", () => {
  it("leaves the request alone when prompt and output fit", () => {
    expect(
      fitOutputTokens({
        contextWindow: 8192,
        requestedOutputTokens: 2048,
        promptChars: 18000,
      }),
    ).toBe(2048);
  });

  it("lowers a large request to what the window has left", () => {
    expect(
      fitOutputTokens({
        contextWindow: 8192,
        requestedOutputTokens: 4096,
        promptChars: 15300,
      }),
    ).toBe(8192 - Math.ceil((15300 + 200) / 3));
  });

  it("never goes below the reserve: past that point the swarm guard shortens the prompt", () => {
    expect(
      fitOutputTokens({
        contextWindow: 8192,
        requestedOutputTokens: 4096,
        promptChars: 24000,
      }),
    ).toBe(2048);
    expect(
      fitOutputTokens({
        contextWindow: 4096,
        requestedOutputTokens: 768,
        promptChars: 24000,
      }),
    ).toBe(768);
  });
});

describe("a backend with no truncation guard (wllama, 4,096 tokens)", () => {
  it("cannot fit the persona and the default prompt", () => {
    expect(
      cannotFit({
        contextWindow: 4096,
        requestedOutputTokens: 2048,
        fixedChars: FIXED,
      }),
    ).toBe(true);
  });

  it("can fit a short caller prompt, with the output lowered to what is left", () => {
    const fixedChars = PERSONA + 4000 + QUESTION;
    expect(
      cannotFit({
        contextWindow: 4096,
        requestedOutputTokens: 2048,
        fixedChars,
      }),
    ).toBe(false);
    const sent = fitOutputTokens({
      contextWindow: 4096,
      requestedOutputTokens: 2048,
      promptChars: fixedChars,
      floorTokens: MIN_OUTPUT_TOKENS,
    });
    expect(sent).toBe(4096 - Math.ceil((fixedChars + 200) / 3));
    expect(sent).toBeGreaterThanOrEqual(MIN_OUTPUT_TOKENS);
  });

  it("the floor never raises a request above what was asked for", () => {
    expect(
      fitOutputTokens({
        contextWindow: 4096,
        requestedOutputTokens: 100,
        promptChars: 20000,
        floorTokens: MIN_OUTPUT_TOKENS,
      }),
    ).toBe(100);
  });
});
