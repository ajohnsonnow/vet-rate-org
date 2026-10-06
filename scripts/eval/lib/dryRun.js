import {
  AUTO_FAIL,
  AUTO_PASS,
  NEEDS_HUMAN,
  NOT_APPLICABLE,
  checkRouting,
} from "./goldenChecks.js";
import { stripReasoning } from "../../../src/utils/reasoningText.js";
import { assembleCaseRecord } from "./caseRecord.js";
import { buildMetaRecord, fingerprintPersonas } from "./goldenRecord.js";
import { TOOL_ENTRIES } from "./toolEntries.js";
import { smallModelReading } from "../../../src/utils/decisionPatternReading.js";

export const DRY_RUN_MODEL_ID = "dry-run-stub";

export const DRY_RUN_LEGAL_SECTIONS = new Set([
  "3.303",
  "3.304",
  "3.310",
  "3.400",
  "4.16",
  "4.25",
  "4.26",
  "4.130",
]);

const DKB_BLOCK = `

=== REFERENCE MATERIAL ===
(dry-run stub context)
[3 reference entries provided from dry-run fixture]
=== END REFERENCE MATERIAL ===
`;

const GOOD_AUDITOR =
  "Under 38 CFR § 3.304(f) the stressor must be corroborated. Missing evidence: no nexus letter is in the file. DBQ results should be attached.";
const GOOD_WRITER =
  "I served in Iraq, and since then my sleep has suffered. I wake several times a night and it affects my work and my family.";

/**
 * Canned responses that deliberately fail one automated check each, plus a
 * simulated engine error and a missing engine capture. Everything else gets a
 * clean per-agent response.
 */
const CANNED_OVERRIDES = {
  a02: { response: "Under 38 CFR § 99.999 your claim is fully supported." },
  a03: {
    response:
      "<untrusted_content>raw extractor wrapper leaked</untrusted_content> Here is the summary.",
  },
  a04: { response: "Your SSN 123-45-6789 appears on the document." },
  a05: { response: "Veteran details: Date of birth: 03/14/1982. Denied." },
  a06: {
    rawReply:
      "<think>\nThe user wants a nexus request. Draft it in first person.\n</think>\n\nI served in Iraq, and since then my sleep has suffered. I wake several times a night and it affects my work and my family.",
  },
  a07: {
    rawReply:
      "<think>\nStarting with the sleep problems, then work, then family, and",
  },
  a11: {
    modelCalled: true,
    response: "Using the VA combined ratings method, my result: 75%.",
  },
  a15: { timeout: true },
  a20: { agentOverride: "rater", response: "Combined rating: 50%." },
  a22: { error: "AI_TIMEOUT: simulated engine timeout" },
  a30: { noCapture: true },
  t01: { smallModel: true },
  t02: { toolError: "WebGPU inference timed out after 300s" },
  t05: { reword: "all", rewordAdds: " This was decided on March 3, 2021." },
  t06: { noDraft: true },
  t09: { reword: "all" },
};

const GOOD_DECODE = JSON.stringify({
  decision_type: "Mixed Decision",
  favorable_findings: ["Noise exposure in service is conceded"],
  plain_english:
    "Tinnitus was granted. The left knee strain was denied for lack of a link to service.",
  missing_elements: [
    "A medical opinion linking the left knee strain to service",
  ],
});

/*
 * The statement helper and the Decision Decoder send their own system
 * prompt, and the engine receives it with knowledge-base context appended.
 * The Witness Bench and the TDIU Builder send none, and get the writer
 * persona.
 */
const KB_SUFFIX = "\n\n(dry-run stub) knowledge-base context";
const TOOL_SETTINGS = { max_tokens: 2048, temperature: 0.3 };

/**
 * What the dry run must produce. Each automated check has at least one case
 * that has to FAIL it; the dry run exits non-zero when any expectation is not
 * met, so a check that stops detecting its failure cannot pass silently.
 */
const CALCULATOR_ANSWERED = {
  routing: NOT_APPLICABLE,
  "calc-match": AUTO_PASS,
  "cfr-in-index": AUTO_PASS,
  rubric: { R3: AUTO_PASS },
};

export const DRY_RUN_EXPECTATIONS = {
  a01: {
    routing: AUTO_PASS,
    "cfr-in-index": AUTO_PASS,
    rubric: { A1: AUTO_PASS, A2: AUTO_PASS },
  },
  a02: { "cfr-in-index": AUTO_FAIL, rubric: { A2: AUTO_FAIL } },
  a03: { "no-spotlight-echo": AUTO_FAIL },
  a04: { "no-new-pii": AUTO_FAIL },
  a05: { "no-new-pii": AUTO_FAIL },
  a06: { routing: AUTO_PASS },
  a07: {
    routing: AUTO_PASS,
    "calc-match": NOT_APPLICABLE,
    "no-new-pii": NOT_APPLICABLE,
    "draft-returned": NOT_APPLICABLE,
  },
  a11: {
    routing: AUTO_FAIL,
    "calc-match": AUTO_FAIL,
    rubric: { R3: AUTO_FAIL },
  },
  a12: CALCULATOR_ANSWERED,
  a13: CALCULATOR_ANSWERED,
  a14: { routing: NOT_APPLICABLE, "calc-match": NOT_APPLICABLE },
  a15: { routing: AUTO_PASS, "calc-match": NOT_APPLICABLE },
  a20: { routing: AUTO_FAIL },
  a22: {
    routing: NEEDS_HUMAN,
    "calc-match": NOT_APPLICABLE,
    "cfr-in-index": NOT_APPLICABLE,
    "no-spotlight-echo": NOT_APPLICABLE,
    "no-new-pii": NOT_APPLICABLE,
  },
  a24: CALCULATOR_ANSWERED,
  a25: CALCULATOR_ANSWERED,
  a30: { routing: NEEDS_HUMAN },
  // A run on a small on-device model: the tool makes no model call.
  t01: { routing: NOT_APPLICABLE, "draft-returned": AUTO_PASS },
  t02: { routing: AUTO_PASS, "draft-returned": AUTO_PASS },
  // Witness statements make no model call: the witness's words stand.
  t03: { routing: NOT_APPLICABLE, "draft-returned": AUTO_PASS },
  t04: { routing: NOT_APPLICABLE, "draft-returned": AUTO_PASS },
  t05: { "draft-returned": AUTO_PASS },
  t06: { "draft-returned": AUTO_FAIL },
  t07: { routing: NOT_APPLICABLE, "draft-returned": AUTO_PASS },
  t08: {
    routing: AUTO_PASS,
    "draft-returned": NOT_APPLICABLE,
    "no-new-pii": AUTO_PASS,
  },
  t09: { routing: AUTO_PASS, "draft-returned": AUTO_PASS },
  t10: { routing: NOT_APPLICABLE, "draft-returned": AUTO_PASS },
};

/** The draft path each dry-run tool case must record. */
export const DRY_RUN_DRAFT_PATHS = {
  t01: "template",
  t02: "template",
  t03: "template",
  t04: "template",
  t05: "template",
  t06: null,
  t07: "template",
  t08: null,
  t09: "model",
  t10: "template",
};

function cannedResponse(caseDef, override) {
  if (override.response) return override.response;
  if (caseDef.expectedAgent === "writer") return GOOD_WRITER;
  if (caseDef.expectedAgent === "auditor") return GOOD_AUDITOR;
  return "I can only calculate and explain ratings; I will not draft statements.";
}

const TIMEOUT_ERROR = "WebGPU inference timed out after 300s";
const EMPTY_AFTER_REASONING_ERROR =
  "Warrant Council error (auditor): Local AI returned an empty response: the model spent its whole token budget reasoning and produced no answer.";

function cleanupMarker(stripped) {
  return stripped.echoRemoved || stripped.trimmed
    ? {
        outputCleanup: {
          echoRemoved: stripped.echoRemoved,
          trimmed: stripped.trimmed,
        },
      }
    : {};
}

/*
 * A tool case: the request is the tool's own (the app-built draft and the
 * reword rules), and the canned model reply is settled the way the tool
 * settles it. With no override the "model" returns the draft unchanged,
 * which the acceptance check accepts.
 */
function toolOutcome(
  caseDef,
  override,
  { personaPrompts, resolveAgentForTool },
) {
  const spec = TOOL_ENTRIES[caseDef.entry];
  const draft = spec.draft?.(caseDef.formInputs);
  const request = {
    messages: [
      {
        role: "system",
        content: spec.ownSystemPrompt
          ? `${spec.ownSystemPrompt}${KB_SUFFIX}`
          : personaPrompts[resolveAgentForTool(caseDef.toolId)],
      },
      {
        role: "user",
        content: draft
          ? (draft.prompt ?? "")
          : `(dry-run stub) decode:\n${caseDef.formInputs.documentText}`,
      },
    ],
    ...TOOL_SETTINGS,
  };
  const noDraft = { draftPath: null, draftNote: null };
  const done = (outcome, captured = [request]) => ({
    ok: true,
    ...outcome,
    latencyMs: 5,
    captured,
  });
  if (!draft && override.smallModel) {
    const reading = smallModelReading(caseDef.formInputs.documentText);
    return done(
      {
        text: JSON.stringify(reading),
        tool: { ...noDraft, modelCalled: false },
      },
      [],
    );
  }
  if (!draft) {
    return done({ text: GOOD_DECODE, tool: noDraft });
  }
  const settle = (reply) => {
    const { content, ...tool } = draft.resolve(reply);
    return { text: content, tool };
  };
  // No free-text passage: the tool makes no model call at all.
  if (draft.prompt === null) return done(settle(""), []);
  // A small on-device model would answer: no model call either.
  if (override.smallModel) {
    const { content, ...tool } = draft.smallModel();
    return done({ text: content, tool }, []);
  }
  if (override.noDraft) return done({ text: "", tool: noDraft });
  if (override.toolError) {
    const { content, ...tool } = draft.afterError(override.toolError);
    return done({ text: content, tool, needsRecovery: true });
  }
  return done(settle(override.toolReply ?? cannedRewording(draft, override)));
}

/*
 * The stub model's reply to a passage request. With no override it returns
 * every passage as it came (so nothing is reworded and the app draft is
 * returned). `reword: "all"` or "first" rewords those passages without
 * adding a fact; `rewordAdds` appends a sentence that does add one.
 */
function cannedRewording(draft, override) {
  const reworded = (passage) => {
    const body = /^I\b/.test(passage)
      ? passage
      : passage[0].toLowerCase() + passage.slice(1);
    const stop = /[.!?]$/.test(body) ? "" : ".";
    return `And ${body}${stop}${override.rewordAdds ?? ""}`;
  };
  return draft.passages
    .map((passage, i) => {
      const change =
        override.reword === "all" || (override.reword === "first" && i === 0);
      return `${i + 1}. ${change ? reworded(passage) : passage}`;
    })
    .join("\n");
}

function rawReplyOutcome(rawReply) {
  const stripped = stripReasoning(rawReply);
  return stripped.answered
    ? {
        ok: true,
        text: stripped.text,
        rawResponse: stripped.raw,
        ...cleanupMarker(stripped),
        latencyMs: 5,
      }
    : {
        ok: false,
        error: EMPTY_AFTER_REASONING_ERROR,
        text: "",
        rawResponse: stripped.raw,
        latencyMs: 5,
      };
}

/**
 * Stand-in for the in-browser engine: builds the chat request the real engine
 * would receive (persona system prompt and user turn) and returns a canned
 * outcome. No browser, no GPU, no model.
 *
 * A case the app answers without a model gets what production gives it, with
 * no engine request: the calculator's own answer, or the fixed request for
 * ratings. Any override on a case sends it to the stub model instead;
 * `modelCalled` stands in for a regression where a model was called.
 *
 * A case marked `timeout` fails the way a real timeout does, and its request
 * keeps arriving after the case has ended: it shows up, after the next case's
 * own request, in that case's captured list. The record builder must not take
 * it for the next case's request.
 */
export function createStubEngine({
  personaPrompts,
  resolveAgentForTool,
  answerWithoutModel,
  settings,
  overrides = CANNED_OVERRIDES,
}) {
  let lateRequest = null;
  const personas = { personaPrompts, resolveAgentForTool };

  function ownRequest(caseDef, override) {
    const routedAgent =
      override.agentOverride ?? resolveAgentForTool(caseDef.toolId);
    let userText = caseDef.input;
    if (caseDef.expectedAgent === "auditor") userText += DKB_BLOCK;
    return {
      messages: [
        { role: "system", content: personaPrompts[routedAgent] },
        { role: "user", content: userText },
      ],
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      frequency_penalty: settings.frequencyPenalty ?? 0,
    };
  }

  function replyOutcome(caseDef, override) {
    if (override.timeout) {
      return { ok: false, error: TIMEOUT_ERROR, text: "", latencyMs: 300000 };
    }
    if (override.error) {
      return { ok: false, error: override.error, text: "", latencyMs: 1 };
    }
    if (override.rawReply !== undefined) {
      return rawReplyOutcome(override.rawReply);
    }
    return {
      ok: true,
      text: cannedResponse(caseDef, override),
      latencyMs: 5,
      resultFlags: {},
    };
  }

  function noModelOutcome({ text, ...flags }) {
    return {
      ok: true,
      text,
      latencyMs: 1,
      resultFlags: { ...flags, onDevice: true, modelCalled: false },
      captured: [lateRequest].filter(Boolean),
    };
  }

  return function run(caseDef) {
    const override = overrides[caseDef.id] ?? {};
    if (caseDef.entry) return toolOutcome(caseDef, override, personas);
    const answer =
      Object.keys(override).length === 0 ? answerWithoutModel(caseDef) : null;
    if (answer) {
      const outcome = noModelOutcome(answer);
      lateRequest = null;
      return outcome;
    }
    const outcome = replyOutcome(caseDef, override);
    const own =
      override.error || override.noCapture
        ? null
        : ownRequest(caseDef, override);
    const captured = [own, lateRequest].filter(Boolean);
    lateRequest = override.timeout ? own : null;
    return { ...outcome, captured };
  };
}

export function buildDryRunTranscript({
  cases,
  personaPrompts,
  resolveAgentForTool,
  answerWithoutModel,
  settings,
  overrides = CANNED_OVERRIDES,
}) {
  const engine = createStubEngine({
    personaPrompts,
    resolveAgentForTool,
    answerWithoutModel,
    settings,
    overrides,
  });
  const run = {
    modelIdRequested: DRY_RUN_MODEL_ID,
    modelIdLoaded: DRY_RUN_MODEL_ID,
    ...settings,
  };
  const meta = buildMetaRecord({
    engine: "dry-run stub (canned responses, no browser, no GPU)",
    modelIdRequested: DRY_RUN_MODEL_ID,
    modelIdLoaded: DRY_RUN_MODEL_ID,
    device: { note: "dry run: no device probed" },
    settings,
    personaFingerprints: fingerprintPersonas(personaPrompts),
  });
  const records = cases.map((caseDef) => {
    return assembleCaseRecord({
      caseDef,
      run,
      personaPrompts,
      outcome: engine(caseDef),
    });
  });
  return [meta, ...records];
}

const isOpenQuestion = (caseDef) =>
  !caseDef.entry && String(caseDef.input ?? "").trim() !== "";

/**
 * The dry run again as it goes on a small-class model (ADR-010 section 11):
 * `answerWithoutModel` is the small-model answerer, and no a-case carries a
 * canned model reply. Every a-case with a question must record app text with
 * no model call and no routing to check. Returns the problems found and how
 * many cases got each kind of app answer.
 */
export function runSmallModelDryRun({
  cases,
  personaPrompts,
  resolveAgentForTool,
  answerWithoutModel,
  settings,
  ctx,
}) {
  const [, ...records] = buildDryRunTranscript({
    cases,
    personaPrompts,
    resolveAgentForTool,
    answerWithoutModel,
    settings,
    overrides: Object.fromEntries(
      cases
        .filter((caseDef) => caseDef.entry)
        .map((caseDef) => [caseDef.id, { smallModel: true }]),
    ),
  });
  const byId = new Map(records.map((record) => [record.id, record]));
  const open = cases.filter(isOpenQuestion);
  const answered = open.map((caseDef) => byId.get(caseDef.id));
  const problems = open.flatMap((caseDef) => {
    const record = byId.get(caseDef.id);
    if (record.modelCalled !== false || record.engineRequests !== 0) {
      return [`${caseDef.id}: a model was called on the small-model pass`];
    }
    const routing = checkRouting(caseDef, record, {
      ...ctx,
      answerWithoutModel,
    });
    return routing.status === NOT_APPLICABLE
      ? []
      : [
          `${caseDef.id} routing: expected ${NOT_APPLICABLE}, got ${routing.status}`,
        ];
  });
  const heldTools = cases.filter(
    (caseDef) => TOOL_ENTRIES[caseDef.entry]?.heldOnSmallModel,
  );
  for (const caseDef of heldTools) {
    const record = byId.get(caseDef.id);
    const routing = checkRouting(caseDef, record, { ...ctx, smallModel: true });
    if (record.modelCalled !== false || routing.status !== NOT_APPLICABLE) {
      problems.push(
        `${caseDef.id}: the tool sent its document to a model on the small-model pass`,
      );
    }
  }
  const count = (field) => answered.filter((record) => record[field]).length;
  return {
    problems,
    heldTools: heldTools.length,
    held: count("openAdviceHeld"),
    calculator: count("calculatorLead"),
    needsRatings: count("needsRatings"),
  };
}

function compareExpectation(id, grade, key, want) {
  if (key !== "rubric") {
    const got = grade.checks[key]?.status;
    return got === want ? [] : [`${id} ${key}: expected ${want}, got ${got}`];
  }
  return Object.entries(want)
    .filter(([criterion, status]) => grade.rubric[criterion] !== status)
    .map(
      ([criterion, status]) =>
        `${id} ${criterion}: expected ${status}, got ${grade.rubric[criterion]}`,
    );
}

/**
 * Compare graded dry-run results with DRY_RUN_EXPECTATIONS. Returns a list of
 * human-readable problems; empty means every canned failure was caught and
 * every canned pass passed.
 */
export function assertDryRunExpectations(
  grades,
  expectations = DRY_RUN_EXPECTATIONS,
) {
  const byId = new Map(grades.map((g) => [g.id, g]));
  return Object.entries(expectations).flatMap(([id, expected]) => {
    const grade = byId.get(id);
    if (!grade) return [`${id}: not graded (case missing from this run)`];
    return Object.entries(expected).flatMap(([key, want]) =>
      compareExpectation(id, grade, key, want),
    );
  });
}

/**
 * Compare the draft path each tool case recorded with DRY_RUN_DRAFT_PATHS.
 * Returns a list of problems; empty means every case took the path its
 * canned reply calls for.
 */
export function assertDryRunDraftPaths(
  records,
  expected = DRY_RUN_DRAFT_PATHS,
) {
  const byId = new Map(records.map((record) => [record.id, record]));
  return Object.entries(expected).flatMap(([id, want]) => {
    const record = byId.get(id);
    if (!record) return [`${id}: not recorded (case missing from this run)`];
    return record.draftPath === want
      ? []
      : [`${id} draft path: expected ${want}, got ${record.draftPath}`];
  });
}
