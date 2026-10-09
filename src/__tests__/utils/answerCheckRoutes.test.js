/**
 * The answer checks (contradiction block, citation notice, form notice) add
 * text to what the model wrote. That is right where the text is advice the
 * veteran reads, and wrong where it is the veteran's own words or goes into
 * a field or draft. The checks run on a named list of advice routes and
 * nowhere else.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  ADVICE_TOOL_IDS,
  answerChecksApply,
  contradictionRulesApply,
} from "../../utils/answerCheckRoutes";
import { TOOL_AGENT_MAP } from "../../utils/diamondSwarm";

describe("answerChecksApply", () => {
  it.each(ADVICE_TOOL_IDS)("runs on the advice tool %s", (toolId) => {
    expect(answerChecksApply({ toolId })).toBe(true);
  });

  it("lists no writer tool as an advice tool", () => {
    for (const toolId of ADVICE_TOOL_IDS) {
      expect(TOOL_AGENT_MAP[toolId]).not.toBe("writer");
    }
    expect(ADVICE_TOOL_IDS).toEqual([
      "decision-decoder",
      "denial-decoder",
      "war-room",
      "pact-navigator",
      "red-team",
      "pathfinder",
      "calculator",
      "rating-calculator",
      "tdiu-builder",
      "rating-analyzer",
    ]);
  });

  it.each(
    Object.entries(TOOL_AGENT_MAP)
      .filter(([, agent]) => agent === "writer")
      .map(([toolId]) => toolId),
  )("never runs on the writer tool %s, whatever the caller says", (toolId) => {
    expect(answerChecksApply({ toolId })).toBe(false);
    expect(answerChecksApply({ toolId, answerChecks: true })).toBe(false);
  });

  it("runs where the caller declares an advice surface", () => {
    expect(answerChecksApply({ answerChecks: true })).toBe(true);
  });

  it.each([
    [{}],
    [undefined],
    [{ taskType: "assistant" }],
    [{ toolId: "symptom-logger" }],
    [{ toolId: "dd214-analyzer" }],
    [{ toolId: "cfile-analyzer" }],
    [{ toolId: "blue-button" }],
    [{ toolId: "some-new-tool" }],
    [{ toolId: "pact-navigator", answerChecks: false }],
  ])("does not run by default: %j", (options) => {
    expect(answerChecksApply(options)).toBe(false);
  });
});

describe("contradictionRulesApply", () => {
  it("is true only for an answer an on-device model produced", () => {
    expect(contradictionRulesApply({ text: "x", onDevice: true })).toBe(true);
    expect(contradictionRulesApply({ text: "x", onDevice: false })).toBe(false);
  });

  it("is false when the result does not say who answered", () => {
    expect(contradictionRulesApply({ text: "x" })).toBe(false);
    expect(contradictionRulesApply("x")).toBe(false);
    expect(contradictionRulesApply(null)).toBe(false);
  });
});

describe("which screens declare an advice surface", () => {
  const filesUnder = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        return name === "__tests__" ? [] : filesUnder(full);
      }
      return /\.(?:js|jsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
    });

  it("is the assistant chat and Ask the Regs, and no screen that fills a field", () => {
    const declaring = filesUnder("src")
      .filter((file) => /answerChecks/.test(readFileSync(file, "utf8")))
      .map((file) => file.split(path.sep).join("/"))
      .sort((a, b) => a.localeCompare(b));
    expect(declaring).toEqual([
      "src/components/AIAssistant.jsx",
      "src/components/AskTheRegs.jsx",
      "src/utils/answerCheckRoutes.js",
      "src/utils/unifiedAIService.js",
    ]);
  });
});
