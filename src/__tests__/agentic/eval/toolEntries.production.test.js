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
const { _compileWitnessStatement } =
  await import("../../../components/WitnessBench.jsx");
const { _generateVocationalImpact } =
  await import("../../../components/TDIUBuilder.jsx");

// The same table tests/eval/golden-set.spec.ts builds in the page.
const PRODUCTION = {
  enhancePersonalStatement: helper.enhancePersonalStatement,
  enhanceFormStatement: helper.enhanceFormStatement,
  enhanceAppealStatement: helper.enhanceAppealStatement,
  generateNexusLetterRequest: helper.generateNexusLetterRequest,
  compileWitnessStatement: _compileWitnessStatement,
  generateVocationalImpact: _generateVocationalImpact,
  decodeDecision: helper.decodeDecision,
};

const GOLDEN = loadGoldenSet(
  join(dirname(fileURLToPath(import.meta.url)), "..", "golden-set.jsonl"),
);
const WRITING_CASES = GOLDEN.filter(
  (c) => isToolCase(c) && isWritingEntry(c.entry),
).map((c) => ({ ...c, draft: TOOL_ENTRIES[c.entry].draft(c.formInputs) }));
const CALLING_CASES = WRITING_CASES.filter((c) => c.draft.prompt !== null);
const SILENT_CASES = WRITING_CASES.filter((c) => c.draft.prompt === null);

const REFUSAL =
  "I cannot draft a statement for you because you have not provided the specific facts I would need.";
const numbered = (passages) =>
  passages.map((passage, i) => `${i + 1}. ${passage}`).join("\n");
/** Rewords a passage without adding a fact. */
const reword = (passage) => {
  const body = /^I\b/.test(passage)
    ? passage
    : passage[0].toLowerCase() + passage.slice(1);
  return `And ${body}${/[.!?]$/.test(body) ? "" : "."}`;
};

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

  it("the cases that call the model and the one that does not", () => {
    expect(CALLING_CASES.map((c) => c.id)).toEqual([
      "t01",
      "t02",
      "t05",
      "t06",
      "t09",
    ]);
    expect(SILENT_CASES.map((c) => c.id)).toEqual(["t03", "t04", "t07", "t10"]);
  });
});

describe.each(CALLING_CASES)("$id through $entry", (caseDef) => {
  const { draft } = caseDef;

  it("sends only the typed passages, as the dry run rebuilds them", async () => {
    await runThroughProduction(caseDef, numbered(draft.passages));

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

  it("places accepted rewordings, counted as the dry run counts them", async () => {
    const reply = numbered(draft.passages.map(reword));
    const outcome = await runThroughProduction(caseDef, reply);
    const expected = draft.resolve(reply);

    expect(outcome.ok).toBe(true);
    expect(outcome.tool.draftPath).toBe("model");
    expect(outcome.tool.passages).toMatchObject(expected.passages);
    expect(expected.passages.accepted).toBe(draft.passages.length);
    for (const passage of draft.passages) {
      expect(outcome.text).toContain(reword(passage));
    }
  });

  it("hands back the app draft, with no AI claim, when the model only echoes", async () => {
    const outcome = await runThroughProduction(
      caseDef,
      numbered(draft.passages),
    );

    expect(outcome.tool.draftPath).toBe("template");
    expect(outcome.tool.passages).toMatchObject({
      sent: draft.passages.length,
      accepted: 0,
      unchanged: draft.passages.length,
    });
    expect(outcome.tool.draftNote).toBeTruthy();
  });

  it("hands back the app draft when the model refuses", async () => {
    const outcome = await runThroughProduction(caseDef, REFUSAL);
    const expected = draft.resolve(REFUSAL);

    expect(outcome.ok).toBe(true);
    expect(outcome.tool).toMatchObject({
      draftPath: "template",
      draftNote: expected.draftNote,
      draftRejectReasons: expected.draftRejectReasons,
    });
    for (const blank of draft.template.match(/\[[^[\]"\\]{2,160}\]/g) ?? []) {
      expect(outcome.text).toContain(blank);
    }
    for (const passage of draft.passages) {
      expect(outcome.text).toContain(passage);
    }
  });
});

describe.each(SILENT_CASES)("$id through $entry", (caseDef) => {
  it("makes no model call and hands back the app draft", async () => {
    const outcome = await runThroughProduction(caseDef, REFUSAL);

    expect(generateAI).not.toHaveBeenCalled();
    expect(outcome.tool).toMatchObject({
      draftPath: "template",
      passages: { sent: 0 },
    });
    expect(outcome.tool.passageOutcomes).toEqual([]);
    for (const part of caseDef.draft.resolve("").content.split("\n\n")) {
      expect(outcome.text).toContain(part);
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
    const shown = JSON.parse(outcome.text);
    expect(shown).toMatchObject(decoded);
    expect(shown.review_options.lanes.map((lane) => lane.form.number)).toEqual([
      "20-0996",
      "10182",
      "20-0995",
    ]);
    expect(outcome.tool.draftPath).toBeNull();
  });
});
