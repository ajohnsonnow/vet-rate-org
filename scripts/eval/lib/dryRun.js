import {
  AUTO_FAIL,
  AUTO_PASS,
  NEEDS_HUMAN,
  NOT_APPLICABLE,
} from "./goldenChecks.js";
import { stripReasoning } from "../../../src/utils/reasoningText.js";
import { assembleCaseRecord } from "./caseRecord.js";
import { buildMetaRecord, fingerprintPersonas } from "./goldenRecord.js";

export const DRY_RUN_MODEL_ID = "dry-run-stub";

export const DRY_RUN_LEGAL_SECTIONS = new Set([
  "3.303",
  "3.304",
  "3.310",
  "3.400",
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
const GOOD_RATER_PREFIX = "Using the VA combined ratings method, my result: ";

/**
 * Canned responses that deliberately fail one automated check each, plus a
 * simulated engine error and a missing engine capture. Everything else gets a
 * clean per-agent response.
 */
const FAILING_OVERRIDES = {
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
  a11: { raterOffset: 10 },
  a12: {
    response:
      "Both knees combine with the bilateral factor. The combined rating is 45%.",
  },
  a14: { timeout: true },
  a20: { agentOverride: "rater", response: "Combined rating: 50%." },
  a24: {
    replacedDraft: "The combined rating is 90%.",
    response:
      "VA combines ratings one at a time. The combined rating is 100% (38 CFR § 4.25).",
  },
  a22: { error: "AI_TIMEOUT: simulated engine timeout" },
  a25: {
    response:
      "The combined rating is 60%. Some calculators show a combined rating of 70% instead.",
  },
  a30: { noCapture: true },
};

/**
 * What the dry run must produce. Each automated check has at least one case
 * that has to FAIL it; the dry run exits non-zero when any expectation is not
 * met, so a check that stops detecting its failure cannot pass silently.
 */
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
  },
  a11: { "calc-match": AUTO_FAIL },
  a12: { "calc-match": AUTO_FAIL, rubric: { R3: AUTO_FAIL } },
  a13: { "calc-match": AUTO_PASS, rubric: { R3: AUTO_PASS } },
  a14: { routing: AUTO_PASS, "calc-match": NOT_APPLICABLE },
  a15: { routing: AUTO_PASS },
  a20: { routing: AUTO_FAIL },
  a22: {
    routing: NEEDS_HUMAN,
    "calc-match": NOT_APPLICABLE,
    "cfr-in-index": NOT_APPLICABLE,
    "no-spotlight-echo": NOT_APPLICABLE,
    "no-new-pii": NOT_APPLICABLE,
  },
  a24: { "calc-match": AUTO_PASS },
  a25: { "calc-match": NEEDS_HUMAN },
  a30: { routing: NEEDS_HUMAN },
};

function cannedResponse(caseDef, override, calculateVARating) {
  if (override.response) return override.response;
  if (caseDef.expectedAgent === "writer") return GOOD_WRITER;
  if (caseDef.expectedAgent === "auditor") return GOOD_AUDITOR;
  if (caseDef.conditions && calculateVARating) {
    const expected = calculateVARating(caseDef.conditions).combinedRating;
    const stated = Math.min(100, expected + (override.raterOffset ?? 0));
    return `${GOOD_RATER_PREFIX}the combined rating is ${stated}%.`;
  }
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

/**
 * Stand-in for the in-browser engine: builds the chat request the real engine
 * would receive (persona system prompt, user turn with optional computed
 * block) and returns a canned outcome. No browser, no GPU, no model.
 *
 * A case marked `timeout` fails the way a real timeout does, and its request
 * keeps arriving after the case has ended: it shows up, after the next case's
 * own request, in that case's captured list. The record builder must not take
 * it for the next case's request.
 */
export function createStubEngine({
  personaPrompts,
  resolveAgentForTool,
  calculateVARating,
  settings,
}) {
  let lateRequest = null;

  function ownRequest(caseDef, override) {
    const routedAgent =
      override.agentOverride ?? resolveAgentForTool(caseDef.toolId);
    let userText = caseDef.input;
    if (caseDef.expectedAgent === "auditor") userText += DKB_BLOCK;
    if (caseDef.conditions) {
      userText +=
        "\n\n=== COMPUTED RESULT (38 CFR § 4.25/4.26 - dry-run stub) ===\n";
    }
    return {
      messages: [
        { role: "system", content: personaPrompts[routedAgent] },
        { role: "user", content: userText },
      ],
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
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
      const stripped = stripReasoning(override.rawReply);
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
    return {
      ok: true,
      text: cannedResponse(caseDef, override, calculateVARating),
      latencyMs: 5,
      ...(override.replacedDraft
        ? {
            calculatorReplacement: {
              reason: "stated 90% but the calculator's combined rating is 100%",
              draft: override.replacedDraft,
            },
          }
        : {}),
    };
  }

  return function run(caseDef) {
    const override = FAILING_OVERRIDES[caseDef.id] ?? {};
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
  calculateVARating,
  settings,
}) {
  const engine = createStubEngine({
    personaPrompts,
    resolveAgentForTool,
    calculateVARating,
    settings,
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
