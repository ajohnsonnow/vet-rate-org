import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WLLAMA_MODELS } from "../../utils/wllamaService";
import { SWARM_AGENTS } from "../../utils/diamondSwarm";

const SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "utils",
    "wllamaService.js",
  ),
  "utf8",
);

describe("wllama persona prompts come from diamondSwarm", () => {
  it.each([
    ["auditor", "AUDITOR"],
    ["writer", "WRITER"],
    ["rater", "RATER"],
  ])("%s uses the swarm persona, word for word", (modelKey, agentKey) => {
    expect(WLLAMA_MODELS[modelKey].systemPrompt).toBe(
      SWARM_AGENTS[agentKey].systemPrompt,
    );
  });

  it("the file carries no second copy of a persona", () => {
    expect(SOURCE).not.toMatch(/You are the VetRate CW\d/);
    expect(SOURCE).not.toContain("SAME body part");
  });

  it("the rater persona states the bilateral rule as 38 CFR 4.26 words it", () => {
    expect(WLLAMA_MODELS.rater.systemPrompt).toContain(
      "each of two paired extremities",
    );
  });

  it.each(["auditor3b", "writer3b", "rater3b"])(
    "%s keeps the prompt it was trained with",
    (modelKey) => {
      const { systemPrompt, promptFormat } = WLLAMA_MODELS[modelKey];
      expect(promptFormat).toBe("alpaca");
      expect(systemPrompt.startsWith("You are VetRate-")).toBe(true);
      expect(
        Object.values(SWARM_AGENTS).map((a) => a.systemPrompt),
      ).not.toContain(systemPrompt);
    },
  );
});
