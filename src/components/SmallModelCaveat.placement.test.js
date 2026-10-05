import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (name) =>
  readFileSync(join(process.cwd(), "src", "components", name), "utf8");

describe("the caveat is on the result view of each AI-answer tool", () => {
  it.each([
    ["DecisionDecoder.jsx", /\{results && <SmallModelCaveat[^>]*\/>\}/],
    ["Pathfinder.jsx", /<SmallModelCaveat \/>\s*<PathfinderStrategyOverview/],
    ["RedTeam.jsx", /<SmallModelCaveat \/>\s*<ScoreCard/],
    ["AIAssistant.jsx", /<SmallModelCaveat \/>\s*\{messages\.map/],
  ])("%s", (file, pattern) => {
    const text = source(file);
    expect(text).toMatch(/import SmallModelCaveat from "\.\/SmallModelCaveat"/);
    expect(text).toMatch(pattern);
  });

  it("names no model id: it reads the device table", () => {
    expect(source("SmallModelCaveat.jsx")).not.toMatch(/Qwen|Llama|MLC/);
  });
});
