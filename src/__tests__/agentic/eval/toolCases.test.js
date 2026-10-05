/**
 * Golden-set tool cases: a case that names a production entry point and
 * carries its form inputs. Loader, record, check and report.
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOL_AGENT_MAP } from "../../../utils/diamondSwarm";
import { assembleCaseRecord } from "../../../../scripts/eval/lib/caseRecord.js";
import {
  AUTO_FAIL,
  AUTO_PASS,
  NEEDS_HUMAN,
  NOT_APPLICABLE,
  checkDraftReturned,
  checkNoNewPii,
  checkRouting,
} from "../../../../scripts/eval/lib/goldenChecks.js";
import { renderSummary } from "../../../../scripts/eval/lib/goldenReport.js";
import {
  documentReader,
  isToolCase,
  loadGoldenSet,
  parseGoldenSet,
} from "../../../../scripts/eval/lib/goldenSet.js";
import {
  DECODER_SYSTEM_PROMPT,
  TOOL_ENTRIES,
  TOOL_ENTRY_NAMES,
  isWritingEntry,
  normalizeToolOutcome,
} from "../../../../scripts/eval/lib/toolEntries.js";

const GOLDEN_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "golden-set.jsonl",
);
const GOLDEN = loadGoldenSet(GOLDEN_PATH);
const TOOL_CASES = GOLDEN.filter(isToolCase);
const byId = (id) => GOLDEN.find((c) => c.id === id);

const line = (overrides) =>
  JSON.stringify({
    id: "x01",
    toolId: "personal-statement",
    expectedAgent: "writer",
    expectedCapability: "draft-statement",
    scenario: "test",
    input: "",
    entry: "enhancePersonalStatement",
    match: "two shifts",
    formInputs: { answers: { workImpact: "I miss two shifts a month" } },
    ...overrides,
  });

describe("the golden set", () => {
  it("still opens with the original 30 cases, byte for byte", () => {
    const first30 = readFileSync(GOLDEN_PATH, "utf8")
      .split("\n")
      .slice(0, 30)
      .map((l) => `${l}\n`)
      .join("");
    expect(createHash("sha256").update(first30, "utf8").digest("hex")).toBe(
      "15d6913a7042a4698586968ba195f6283e816ef4b25a5aeddd4dbf3b8af264d8",
    );
    expect(GOLDEN.slice(0, 30).some(isToolCase)).toBe(false);
  });

  it("has a tool case for every writing tool, and one that attaches a document", () => {
    const writerTools = new Set(
      TOOL_CASES.filter((c) => c.expectedAgent === "writer").map(
        (c) => c.toolId,
      ),
    );
    expect([...writerTools].sort()).toEqual([
      "appeal-statement",
      "buddy-statement",
      "nexus-builder",
      "personal-statement",
      "tdiu-narrative",
    ]);
    const attached = TOOL_CASES.filter((c) => c.document);
    expect(attached.map((c) => c.entry)).toEqual(["decodeDecision"]);
    expect(attached[0].formInputs.documentText).toContain(
      "SYNTHETIC TEST FIXTURE - NOT A REAL DOCUMENT",
    );
  });

  it.each(TOOL_CASES)("$id routes to its expected agent", (c) => {
    expect(TOOL_ENTRY_NAMES).toContain(c.entry);
    expect(TOOL_AGENT_MAP[c.toolId]).toBe(c.expectedAgent);
    expect(c.scenario).toMatch(/fictional|synthetic/i);
  });

  it.each(TOOL_CASES.filter((c) => isWritingEntry(c.entry)))(
    "$id puts its match phrase in the request the tool sends",
    (c) => {
      const draft = TOOL_ENTRIES[c.entry].draft(c.formInputs);
      expect(draft.prompt).toContain(c.match);
    },
  );

  it("leaves blanks in the drafts whose forms were left incomplete", () => {
    const draftOf = (id) =>
      TOOL_ENTRIES[byId(id).entry].draft(byId(id).formInputs).template;
    expect(draftOf("t01")).toContain(
      "[what happened during your service that caused or started this condition]",
    );
    expect(draftOf("t05")).toContain(
      "[date of the decision you are appealing]",
    );
    expect(draftOf("t06")).toContain("[your current symptoms]");
    expect(draftOf("t07")).toContain(
      "[the work tasks this stops you from doing, and how often]",
    );
  });
});

describe("parseGoldenSet on tool cases", () => {
  it("accepts a well-formed tool case", () => {
    expect(parseGoldenSet(line({}))[0].entry).toBe("enhancePersonalStatement");
  });

  it.each([
    ["an unknown entry", { entry: "deleteEverything" }, /unknown entry/],
    ["form inputs that are not an object", { formInputs: [] }, /formInputs/],
    ["no match phrase", { match: "" }, /match phrase/],
    [
      "a match phrase that is not in the inputs",
      { match: "not there" },
      /not in its inputs/,
    ],
    [
      "a document with no reader",
      { document: "fixtures/x.txt" },
      /cannot be read/,
    ],
  ])("rejects %s", (_what, overrides, message) => {
    expect(() => parseGoldenSet(line(overrides))).toThrow(message);
  });

  it("reads an attached document into the form inputs", () => {
    const [parsed] = parseGoldenSet(
      line({ document: "letter.txt", match: "Fictional letter" }),
      { readDocument: () => "Fictional letter body" },
    );
    expect(parsed.formInputs.documentText).toBe("Fictional letter body");
  });

  it("will not read a document from outside the golden-set directory", () => {
    const read = documentReader(GOLDEN_PATH);
    expect(() => read("../../../package.json", "x01")).toThrow(
      /must be inside/,
    );
    expect(read("fixtures/fictional-decision-letter.txt", "x01")).toContain(
      "Regional Office of Nowhere (fictional)",
    );
  });
});

describe("normalizeToolOutcome", () => {
  it("reads a statement helper result", () => {
    const outcome = normalizeToolOutcome("enhancePersonalStatement", {
      ok: true,
      latencyMs: 9,
      captured: [],
      toolResult: {
        success: true,
        content: "the draft",
        draftPath: "template",
        draftNote: "note",
        draftRejectReasons: ["not a draft: refusal"],
      },
    });
    expect(outcome).toMatchObject({
      ok: true,
      text: "the draft",
      tool: {
        draftPath: "template",
        draftNote: "note",
        draftRejectReasons: ["not a draft: refusal"],
      },
    });
  });

  it("asks for an engine reset when the tool returned its draft after an engine error", () => {
    const outcome = normalizeToolOutcome("enhanceAppealStatement", {
      ok: true,
      toolResult: {
        success: true,
        content: "the app-built draft",
        draftPath: "template",
        draftErrorReason: "WebGPU inference timed out",
      },
    });
    expect(outcome).toMatchObject({
      ok: true,
      needsRecovery: true,
      text: "the app-built draft",
      tool: { draftErrorReason: "WebGPU inference timed out" },
    });
    expect(
      normalizeToolOutcome("enhanceAppealStatement", {
        ok: true,
        toolResult: { success: true, content: "x", draftPath: "model" },
      }),
    ).not.toHaveProperty("needsRecovery");
  });

  it("turns a helper failure into a case error", () => {
    expect(
      normalizeToolOutcome("enhanceAppealStatement", {
        ok: true,
        toolResult: { success: false, error: "AI cooling down" },
      }),
    ).toMatchObject({ ok: false, error: "AI cooling down", text: "" });
  });

  it("reads the Witness Bench, TDIU and Decision Decoder results", () => {
    const text = (entry, toolResult) =>
      normalizeToolOutcome(entry, { ok: true, toolResult }).text;
    expect(text("compileWitnessStatement", { statement: "S" })).toBe("S");
    expect(text("generateVocationalImpact", { analysis: { a: 1 } })).toBe(
      '{"a":1}',
    );
    expect(text("decodeDecision", { success: true, data: { b: 2 } })).toBe(
      '{"b":2}',
    );
  });

  it("leaves a thrown or timed-out case alone", () => {
    const failed = { ok: false, error: "boom" };
    expect(normalizeToolOutcome("decodeDecision", failed)).toBe(failed);
  });
});

describe("assembleCaseRecord on a tool case", () => {
  const caseDef = byId("t08");
  const request = (text) => ({
    messages: [
      { role: "system", content: `${DECODER_SYSTEM_PROMPT}\n\nKB context` },
      { role: "user", content: text },
    ],
  });
  const record = assembleCaseRecord({
    caseDef,
    run: { modelIdRequested: "m", modelIdLoaded: "m" },
    personaPrompts: {},
    outcome: {
      ok: true,
      text: "{}",
      latencyMs: 12,
      tool: { draftPath: null, draftNote: null, draftRejectReasons: [] },
      captured: [
        request("some other case"),
        request(`Decode this:\n${caseDef.formInputs.documentText}`),
      ],
    },
  });

  it("finds its own request by the match phrase, not the empty input", () => {
    expect(record.requestMatch).toBe("matched");
    expect(record.actualAgent).toBe("unknown");
    expect(record.ownSystemPrompt).toBe(true);
  });

  it("names the entry and the document without copying the document text", () => {
    expect(record).toMatchObject({
      entry: "decodeDecision",
      document: "fixtures/fictional-decision-letter.txt",
      draftPath: null,
    });
    expect(JSON.stringify(record.formInputs)).not.toContain("Nowhere");
  });
});

describe("routing for a tool that sends its own system prompt", () => {
  const t01 = byId("t01");

  it("passes when the engine received that prompt", () => {
    expect(
      checkRouting(t01, { actualAgent: "unknown", ownSystemPrompt: true }),
    ).toMatchObject({
      status: AUTO_PASS,
      detail: "the tool's own system prompt, as in production",
    });
  });

  it("fails when the engine received a persona or another prompt", () => {
    expect(
      checkRouting(t01, { actualAgent: "writer", ownSystemPrompt: false }),
    ).toMatchObject({
      status: AUTO_FAIL,
      detail:
        "expected the tool's own system prompt, engine received the writer persona",
    });
    expect(
      checkRouting(t01, { actualAgent: "unknown", ownSystemPrompt: false })
        .detail,
    ).toMatch(/another prompt/);
  });

  it("is left to a human when the request was not captured", () => {
    expect(
      checkRouting(t01, { actualAgent: null, ownSystemPrompt: null }).status,
    ).toBe(NEEDS_HUMAN);
  });

  it("still means the persona for a tool that sends none", () => {
    expect(checkRouting(byId("t04"), { actualAgent: "writer" }).status).toBe(
      AUTO_PASS,
    );
    expect(checkRouting(byId("t04"), { actualAgent: "auditor" }).status).toBe(
      AUTO_FAIL,
    );
  });
});

describe("checkDraftReturned", () => {
  const t01 = byId("t01");

  it("passes on either path and says which", () => {
    expect(
      checkDraftReturned(t01, { response: "draft", draftPath: "model" }),
    ).toMatchObject({ status: AUTO_PASS, detail: "model draft accepted" });
    expect(
      checkDraftReturned(t01, {
        response: "draft",
        draftPath: "template",
        draftRejectReasons: ["not a draft: refusal"],
      }),
    ).toMatchObject({
      status: AUTO_PASS,
      detail: "app-built draft returned (not a draft: refusal)",
      data: { path: "template" },
    });
  });

  it("fails when the tool handed back nothing", () => {
    expect(
      checkDraftReturned(t01, { response: " ", draftPath: "template" }).status,
    ).toBe(AUTO_FAIL);
    expect(
      checkDraftReturned(t01, { response: "text", draftPath: null }).status,
    ).toBe(AUTO_FAIL);
  });

  it("does not apply to a plain case or the document case", () => {
    expect(checkDraftReturned(byId("a07"), { response: "x" }).status).toBe(
      NOT_APPLICABLE,
    );
    expect(checkDraftReturned(byId("t08"), { response: "x" }).status).toBe(
      NOT_APPLICABLE,
    );
  });
});

describe("no-new-pii on a tool case", () => {
  it("counts the form inputs and attached document as supplied", () => {
    const caseDef = parseGoldenSet(
      line({
        match: "123-45-6789",
        formInputs: { answers: { workImpact: "File note 123-45-6789" } },
      }),
    )[0];
    expect(
      checkNoNewPii(caseDef, { response: "It says 123-45-6789." }).status,
    ).toBe(AUTO_PASS);
    expect(
      checkNoNewPii(caseDef, { response: "It says 987-65-4321." }).status,
    ).toBe(AUTO_FAIL);
  });
});

describe("run summary", () => {
  const runInfo = {
    modelId: "m",
    date: "2026-10-05T00:00:00.000Z",
    gitCommit: "abc",
    gitDirty: false,
    legalIndexNote: "fixture",
    transcriptFile: "run.jsonl",
  };

  it("has no tool section when the run has no tool case", () => {
    const md = renderSummary({
      meta: null,
      runInfo,
      goldenCases: [byId("a07")],
      cases: [],
      grades: [],
    });
    expect(md).not.toContain("## Tool cases");
  });

  it("lists a tool case that was not run", () => {
    const md = renderSummary({
      meta: null,
      runInfo,
      goldenCases: [byId("t01")],
      cases: [],
      grades: [],
    });
    expect(md).toContain("| t01 | enhancePersonalStatement | not run |");
  });
});
