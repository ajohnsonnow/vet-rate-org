/**
 * The app runs stock open models guided by role prompts and its knowledge
 * base. Nothing veteran-visible may say the agents are fine-tuned on VA
 * regulations or formats.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("../../utils/diamondSwarm", async (importOriginal) => ({
  ...(await importOriginal()),
  isSwarmReady: vi.fn().mockReturnValue(true),
}));

import {
  AI_MODES,
  getAIDataDisclosure,
  registerSwarmEngine,
  setAIMode,
} from "../../utils/unifiedAIService";
import { TOOL_LLM_RECOMMENDATIONS } from "../../utils/llmRecommendations";

const FINE_TUNED = /fine-?tuned/i;

describe("provenance wording", () => {
  it("the Warrant Council disclosure shown to veterans makes no fine-tuning claim", () => {
    registerSwarmEngine({}, true, false, "auditor");
    setAIMode(AI_MODES.SWARM);

    const disclosure = getAIDataDisclosure();

    expect(disclosure.isDiamond).toBe(true);
    expect(JSON.stringify(disclosure)).not.toMatch(FINE_TUNED);
    expect(disclosure.bullets.join(" ")).toMatch(/role prompts/);
  });

  it("no tool recommendation claims a fine-tuned agent", () => {
    expect(JSON.stringify(TOOL_LLM_RECOMMENDATIONS)).not.toMatch(FINE_TUNED);
  });

  it.each([
    "utils/llmRecommendations.js",
    "utils/unifiedAIService.js",
    "utils/diamondSwarm.js",
  ])("%s does not describe the agents as fine-tuned on VA data", (file) => {
    const source = readFileSync(resolve(process.cwd(), "src", file), "utf8");
    const claims = source
      .split("\n")
      .filter((line) => FINE_TUNED.test(line))
      .filter((line) => !/\b(not|no model|none)\b/i.test(line));

    expect(claims).toEqual([]);
  });
});
