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
      "ae135ca18cd51ac9d7a4c5ee35c923b3abd97ed83ce90e9978ef591a428370a2",
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

  const drafts = TOOL_CASES.filter((c) => isWritingEntry(c.entry)).map((c) => ({
    id: c.id,
    match: c.match,
    draft: TOOL_ENTRIES[c.entry].draft(c.formInputs),
  }));

  it.each(drafts.filter((c) => c.draft.prompt !== null))(
    "$id puts its match phrase in a passage the tool sends",
    ({ match, draft }) => {
      expect(draft.passages.some((passage) => passage.includes(match))).toBe(
        true,
      );
      expect(draft.prompt).toContain(match);
    },
  );

  it("the witness cases and the TDIU case send the model nothing", () => {
    expect(
      drafts.filter((c) => c.draft.prompt === null).map((c) => c.id),
    ).toEqual(["t03", "t04", "t07", "t10"]);
  });

  it("t02 carries a fragment for the model to make into sentences", () => {
    expect(drafts.find((c) => c.id === "t02").draft.passages).toContain(
      "Startle at engine noise, Broken sleep",
    );
  });

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
    expect(outcome.tool.passageOutcomes).toEqual([]);
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

  it("does not apply when the tool had nothing typed to send", () => {
    expect(
      checkRouting(byId("t07"), {
        actualAgent: null,
        passages: { sent: 0, accepted: 0, unchanged: 0, rejected: 0 },
      }),
    ).toMatchObject({
      status: NOT_APPLICABLE,
      detail: "the tool made no model call: nothing typed to reword",
    });
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

  it("passes on either path and says which, with the passage counts", () => {
    expect(
      checkDraftReturned(t01, {
        response: "draft",
        draftPath: "model",
        passages: { sent: 3, accepted: 2, unchanged: 1, rejected: 0 },
      }),
    ).toMatchObject({
      status: AUTO_PASS,
      detail:
        "model rewording placed: 2 of 3 passages reworded, 1 unchanged, 0 rejected",
      data: { path: "model" },
    });
    expect(
      checkDraftReturned(t01, {
        response: "draft",
        draftPath: "template",
        passages: { sent: 2, accepted: 0, unchanged: 0, rejected: 2 },
        draftRejectReasons: ["passage 1: not a rewording: refusal"],
      }),
    ).toMatchObject({
      status: AUTO_PASS,
      detail:
        "app-built draft returned: 0 of 2 passages reworded, 0 unchanged, 2 rejected (passage 1: not a rewording: refusal)",
      data: { path: "template" },
    });
  });

  it("names the error when the model did not answer", () => {
    expect(
      checkDraftReturned(t01, {
        response: "draft",
        draftPath: "template",
        passages: { sent: 3, accepted: 0, unchanged: 0, rejected: 0 },
        draftErrorReason: "WebGPU inference timed out",
      }).detail,
    ).toBe(
      "app-built draft returned: 0 of 3 passages reworded, 0 unchanged, 0 rejected (the model did not answer: WebGPU inference timed out)",
    );
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

describe("fragment cases t09 and t10", () => {
  const passagesOf = (id) =>
    TOOL_ENTRIES[byId(id).entry].draft(byId(id).formInputs).passages;

  it("t01 to t08 are still byte for byte what the recorded runs used", () => {
    const first38 = readFileSync(GOLDEN_PATH, "utf8")
      .split("\n")
      .slice(0, 38)
      .map((l) => `${l}\n`)
      .join("");
    expect(createHash("sha256").update(first38, "utf8").digest("hex")).toBe(
      "04a31db4d828c1449d9383a723ca6e5b9acf025ad06cfb162c848fd9d722035e",
    );
    expect(GOLDEN.map((c) => c.id).slice(30)).toEqual([
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

  it("t09 goes through the Nexus Builder entry with four fragments and one full sentence", () => {
    expect(byId("t09")).toMatchObject({
      entry: "enhancePersonalStatement",
      toolId: "personal-statement",
    });
    expect(passagesOf("t09")).toEqual([
      "14 June 2019 - shoulder gave out lifting a crate, neck locked for three days",
      "Numb fingers, dropping tools, trouble with buttons",
      "Slower on the assembly line at the Placeholder plant",
      "I no longer play catch with my daughter.",
      "Favouring the bad shoulder, so the neck takes the strain",
    ]);
  });

  it("t10 goes through the Forms Helper entry and offers the model nothing", () => {
    expect(byId("t10")).toMatchObject({
      entry: "enhanceFormStatement",
      toolId: "buddy-statement",
    });
    expect(byId("t10").formInputs.formType).toBe("buddy-statement");
    expect(passagesOf("t10")).toEqual([]);
  });

  it("a witness's fragments stay in the draft as typed", () => {
    const draft = (id) =>
      TOOL_ENTRIES[byId(id).entry].draft(byId(id).formInputs);
    for (const fragment of [
      "Lights off at the desk, sunglasses indoors, head down on the bench",
      "Fewer shifts and no overtime since the spring",
      "3 March 2022 - left the line mid-shift, sick in the car park, driven home by me",
    ]) {
      expect(draft("t10").template).toContain(fragment);
    }
    expect(draft("t10").prompt).toBeNull();
    expect(draft("t04").prompt).toBeNull();
    expect(draft("t09").prompt).toContain('for example "I"');
    expect(draft("t09").prompt).not.toMatch(/"they" for the person/);
    expect(draft("t09")).not.toHaveProperty("voice");
  });
});
