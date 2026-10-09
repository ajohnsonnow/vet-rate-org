/**
 * Which verified-reference topics the golden-set tool cases raise, measured
 * on the request each production function really sends. A tool case has an
 * empty `input`; the prompt is built by the tool, so the topic can only be
 * read from the call itself.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isToolCase,
  loadGoldenSet,
} from "../../../../scripts/eval/lib/goldenSet.js";
import { TOOL_ENTRIES } from "../../../../scripts/eval/lib/toolEntries.js";
import {
  detectReferenceTopics,
  selectVerifiedEntries,
} from "../../../utils/verifiedReference";

vi.mock("../../../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAnyAIAvailable: () => true,
    getAIStatus: () => ({ statusText: "Local AI" }),
    generateAI: vi.fn(),
  };
});
const { generateAI } = await import("../../../utils/unifiedAIService");
const helper = await import("../../../utils/aiStatementHelper");
const { _compileWitnessStatement } =
  await import("../../../components/WitnessBench.jsx");
const { _generateVocationalImpact } =
  await import("../../../components/TDIUBuilder.jsx");

const PRODUCTION = {
  enhancePersonalStatement: helper.enhancePersonalStatement,
  enhanceFormStatement: helper.enhanceFormStatement,
  enhanceAppealStatement: helper.enhanceAppealStatement,
  generateNexusLetterRequest: helper.generateNexusLetterRequest,
  compileWitnessStatement: _compileWitnessStatement,
  generateVocationalImpact: _generateVocationalImpact,
  decodeDecision: helper.decodeDecision,
};

const TOOL_CASES = loadGoldenSet(
  join(dirname(fileURLToPath(import.meta.url)), "..", "golden-set.jsonl"),
).filter(isToolCase);

async function requestsSentBy(caseDef) {
  generateAI.mockImplementation(async () => ({ text: "{}", mode: "swarm" }));
  const args = TOOL_ENTRIES[caseDef.entry].args(caseDef.formInputs, {});
  await PRODUCTION[caseDef.entry](...args);
  return generateAI.mock.calls.map(([prompt, options]) => ({
    prompt,
    options,
    topics: detectReferenceTopics(prompt, options.toolId, options),
    entries: selectVerifiedEntries(prompt, {
      ...options,
      maxChars: 3400,
    }).map((e) => e.id),
  }));
}

beforeEach(() => {
  localStorage.clear();
  generateAI.mockReset();
});

describe("topics raised by what the tools really send", () => {
  it("covers the ten tool cases", () => {
    expect(TOOL_CASES.map((c) => c.id)).toEqual([
      "t01",
      "t02",
      "t03",
      "t04",
      "t05",
      "t06",
      "t07",
      "t08",
      "t09",
      "t10",
    ]);
  });

  it.each(TOOL_CASES.filter((c) => /^t(?:0[1256]|09)$/.test(c.id)))(
    "$id ($toolId): a rewording request raises no topic",
    async (caseDef) => {
      const requests = await requestsSentBy(caseDef);

      expect(requests).toHaveLength(1);
      expect(requests[0].options.toolId).toBe(caseDef.toolId);
      expect(requests[0].options.dataClass).toBe("context");
      expect(requests[0].prompt).toContain("Rewrite each passage");
      expect(requests[0].topics).toEqual([]);
      expect(requests[0].entries).toEqual([]);
    },
  );

  it.each(TOOL_CASES.filter((c) => /^t(?:03|04|10)$/.test(c.id)))(
    "$id ($toolId): a witness statement makes no model call",
    async (caseDef) => {
      expect(await requestsSentBy(caseDef)).toEqual([]);
    },
  );

  it("t07 (tdiu-narrative): makes no model call, so there is nothing to ground", async () => {
    const t07 = TOOL_CASES.find((c) => c.id === "t07");
    expect(await requestsSentBy(t07)).toEqual([]);
  });

  it("t08 (decision-decoder): the letter raises the review options and nothing else", async () => {
    const t08 = TOOL_CASES.find((c) => c.id === "t08");
    const [request] = await requestsSentBy(t08);

    expect(request.options).toMatchObject({
      toolId: "decision-decoder",
      dataClass: "document",
    });
    expect(request.prompt).toContain("effective date");
    expect(request.prompt).toContain("secondary");
    expect(request.topics).toEqual(["decision-review"]);
    expect(request.entries).toEqual([
      "cfr-3.2500-a",
      "review-forms",
      "cfr-3.2601-f",
      "cfr-20.203",
      "cfr-20.202-a-b",
    ]);
  });
});
