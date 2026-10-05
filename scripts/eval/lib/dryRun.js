import {
  AUTO_FAIL,
  AUTO_PASS,
  NEEDS_HUMAN,
  NOT_APPLICABLE,
} from "./goldenChecks.js";
import {
  buildCaseRecord,
  buildMetaRecord,
  fingerprintPersonas,
} from "./goldenRecord.js";

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

=== 💎 DIAMOND KNOWLEDGE BASE (DKB) CONTEXT ===
(dry-run stub context)
[3 relevant DKB entries provided from dry-run fixture]
=== END DKB CONTEXT ===
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
  a11: { raterOffset: 10 },
  a12: {
    response:
      "Both knees combine with the bilateral factor. The combined rating is 45%.",
  },
  a20: { agentOverride: "rater", response: "Combined rating: 50%." },
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
  a11: { "calc-match": AUTO_FAIL },
  a12: { "calc-match": AUTO_FAIL, rubric: { R3: AUTO_FAIL } },
  a13: { "calc-match": AUTO_PASS, rubric: { R3: AUTO_PASS } },
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

/**
 * Stand-in for the in-browser engine: builds the chat request the real engine
 * would receive (persona system prompt, user turn with optional computed
 * block) and returns a canned response. No browser, no GPU, no model.
 */
export function createStubEngine({
  personaPrompts,
  resolveAgentForTool,
  calculateVARating,
  settings,
}) {
  return function run(caseDef) {
    const override = FAILING_OVERRIDES[caseDef.id] ?? {};
    if (override.error) {
      return {
        captured: null,
        response: "",
        latencyMs: 1,
        error: override.error,
      };
    }
    const routedAgent =
      override.agentOverride ?? resolveAgentForTool(caseDef.toolId);
    let userText = caseDef.input;
    if (caseDef.expectedAgent === "auditor") userText += DKB_BLOCK;
    if (caseDef.conditions) {
      userText +=
        "\n\n=== COMPUTED RESULT (38 CFR § 4.25/4.26 - dry-run stub) ===\n";
    }
    const captured = override.noCapture
      ? null
      : {
          messages: [
            { role: "system", content: personaPrompts[routedAgent] },
            { role: "user", content: userText },
          ],
          max_tokens: settings.maxTokens,
          temperature: settings.temperature,
        };
    return {
      captured,
      response: cannedResponse(caseDef, override, calculateVARating),
      latencyMs: 5,
      error: null,
    };
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
    const out = engine(caseDef);
    return buildCaseRecord({
      caseDef,
      run,
      captured: out.captured,
      personaPrompts,
      response: out.response,
      latencyMs: out.latencyMs,
      error: out.error,
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
