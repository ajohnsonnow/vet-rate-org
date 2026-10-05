/**
 * The golden-set tool cases, run through the real production functions with
 * only the model stubbed. This is what holds the dry run to production: for
 * every case the request the real function sends, and the draft it hands
 * back for a given model reply, must equal what scripts/eval/lib/toolEntries
 * rebuilds for the dry run. It is also the nearest thing to the browser
 * evaluation that runs without a GPU.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isToolCase,
  loadGoldenSet,
} from "../../../../scripts/eval/lib/goldenSet.js";
import {
  TOOL_ENTRIES,
  isWritingEntry,
  normalizeToolOutcome,
} from "../../../../scripts/eval/lib/toolEntries.js";

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
const { _compileStatementWithAI } =
  await import("../../../components/WitnessBench.jsx");
const { _generateVocationalImpact } =
  await import("../../../components/TDIUBuilder.jsx");

// The same table tests/eval/golden-set.spec.ts builds in the page.
const PRODUCTION = {
  enhancePersonalStatement: helper.enhancePersonalStatement,
  enhanceFormStatement: helper.enhanceFormStatement,
  enhanceAppealStatement: helper.enhanceAppealStatement,
  generateNexusLetterRequest: helper.generateNexusLetterRequest,
  compileWitnessStatement: _compileStatementWithAI,
  generateVocationalImpact: _generateVocationalImpact,
  decodeDecision: helper.decodeDecision,
};

const GOLDEN = loadGoldenSet(
  join(dirname(fileURLToPath(import.meta.url)), "..", "golden-set.jsonl"),
);
const WRITING_CASES = GOLDEN.filter(
  (c) => isToolCase(c) && isWritingEntry(c.entry),
);

const REFUSAL =
  "I cannot draft a statement for you because you have not provided the specific facts I would need.";

async function runThroughProduction(caseDef, modelReply) {
  generateAI.mockImplementation(async () => ({
    text: modelReply,
    mode: "swarm",
  }));
  const args = TOOL_ENTRIES[caseDef.entry].args(caseDef.formInputs, {});
  const toolResult = await PRODUCTION[caseDef.entry](...args);
  return normalizeToolOutcome(caseDef.entry, { ok: true, toolResult });
}

beforeEach(() => {
  localStorage.clear();
  generateAI.mockReset();
});

describe("every entry name has a production function", () => {
  it("the two tables name the same entries", () => {
    expect(Object.keys(PRODUCTION).sort()).toEqual(
      Object.keys(TOOL_ENTRIES).sort(),
    );
  });
});

describe.each(WRITING_CASES)("$id through $entry", (caseDef) => {
  const draft = TOOL_ENTRIES[caseDef.entry].draft(caseDef.formInputs);

  it("sends the request the dry run rebuilds, for the case's own tool", async () => {
    await runThroughProduction(caseDef, draft.template);

    expect(generateAI).toHaveBeenCalledTimes(1);
    const [prompt, options] = generateAI.mock.calls[0];
    expect(prompt).toBe(draft.prompt);
    expect(prompt).toContain(caseDef.match);
    expect(options.toolId).toBe(caseDef.toolId);
    expect(options.dataClass).toBe("context");
    expect(options.systemPrompt).toBe(
      TOOL_ENTRIES[caseDef.entry].ownSystemPrompt,
    );
  });

  it("hands back the model's wording when the model returns the draft", async () => {
    const outcome = await runThroughProduction(caseDef, draft.template);

    expect(outcome.ok).toBe(true);
    expect(outcome.tool.draftPath).toBe("model");
    expect(outcome.text).toBe(draft.resolve(draft.template).content);
  });

  it("hands back the app-built draft, with the note, when the model refuses", async () => {
    const outcome = await runThroughProduction(caseDef, REFUSAL);
    const expected = draft.resolve(REFUSAL);

    expect(outcome.ok).toBe(true);
    expect(outcome.tool).toMatchObject({
      draftPath: "template",
      draftNote: expected.draftNote,
      draftRejectReasons: expected.draftRejectReasons,
    });
    expect(outcome.text.length).toBeGreaterThan(100);
    for (const blank of draft.template.match(/\[[^[\]"\\]{2,160}\]/g) ?? []) {
      expect(outcome.text).toContain(blank);
    }
  });
});

describe("t08 through decodeDecision", () => {
  const caseDef = GOLDEN.find((c) => c.id === "t08");

  it("sends the attached document as document-class data and returns the decoded result", async () => {
    const decoded = { decision_type: "Mixed Decision", favorable_findings: [] };
    const outcome = await runThroughProduction(
      caseDef,
      JSON.stringify(decoded),
    );

    const [prompt, options] = generateAI.mock.calls[0];
    expect(prompt).toContain(caseDef.match);
    expect(prompt).toContain("Service connection for a left knee strain");
    expect(options).toMatchObject({
      toolId: "decision-decoder",
      dataClass: "document",
      systemPrompt: TOOL_ENTRIES.decodeDecision.ownSystemPrompt,
    });
    expect(outcome.ok).toBe(true);
    expect(JSON.parse(outcome.text)).toEqual(decoded);
    expect(outcome.tool.draftPath).toBeNull();
  });
});
