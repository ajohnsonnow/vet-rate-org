import { buildCaseRecord } from "./goldenRecord.js";
import { selectOwnRequest } from "./requestCapture.js";
import { TOOL_ENTRIES } from "./toolEntries.js";

/**
 * One transcript record from what happened to one case.
 *
 * outcome: { ok, text, error, latencyMs, captured: request[], rawResponse,
 *            calculatorReplacement, validationErrors, validationWarnings }
 *
 * `response` is the visible text, the field graders score. `rawResponse` is
 * the engine's reply before any reasoning block was removed, present only when
 * it differs. `outputCleanup` says the wrapper tags were removed or a runaway
 * repeat was cut ({ echoRemoved, trimmed }). `calculatorReplacement` carries the reason and the replaced
 * draft when the calculator guard swapped the answer.
 *
 * A tool case (one with `entry`) went through a production function, not
 * straight to generateAI. Its request is found by the case's `match` phrase,
 * and its record adds the entry point, the form inputs (an attached document
 * by name only) and, for a writing tool, which draft the veteran was handed:
 * `draftPath` "model" (the model's wording passed the acceptance check) or
 * "template" (the app-built draft was returned, with `draftRejectReasons`).
 */
const systemTextOf = (request) => {
  const content = request?.messages?.find((m) => m?.role === "system")?.content;
  return typeof content === "string" ? content : null;
};

/**
 * For an entry that sends its own system prompt: whether the engine received
 * it (true or false), or null when no request was captured. Undefined for an
 * entry that relies on the persona prompt.
 */
function ownSystemPromptSeen(caseDef, own) {
  const expected = TOOL_ENTRIES[caseDef.entry]?.ownSystemPrompt;
  if (!expected) return {};
  const system = systemTextOf(own);
  return {
    ownSystemPrompt: system === null ? null : system.startsWith(expected),
  };
}

function toolFields(caseDef, outcome, own) {
  if (!caseDef.entry) return {};
  const { documentText: _documentText, ...formInputs } =
    caseDef.formInputs ?? {};
  return {
    entry: caseDef.entry,
    formInputs,
    ...(caseDef.document ? { document: caseDef.document } : {}),
    draftPath: outcome.tool?.draftPath ?? null,
    draftNote: outcome.tool?.draftNote ?? null,
    draftRejectReasons: outcome.tool?.draftRejectReasons ?? [],
    ...ownSystemPromptSeen(caseDef, own),
  };
}

export function assembleCaseRecord({ caseDef, run, personaPrompts, outcome }) {
  const requests = outcome.captured ?? [];
  const own = selectOwnRequest(requests, caseDef.match ?? caseDef.input);
  const visible = outcome.text ?? "";
  const record = buildCaseRecord({
    caseDef,
    run,
    captured: own,
    personaPrompts,
    response: visible,
    latencyMs: Math.round(outcome.latencyMs),
    error: outcome.ok ? null : (outcome.error ?? "unknown error"),
    extra: {
      engineRequests: requests.length,
      validationErrors: outcome.validationErrors,
      validationWarnings: outcome.validationWarnings,
    },
  });
  const replacement = outcome.calculatorReplacement;
  return {
    ...record,
    thinking: run.thinking ?? null,
    engineThinking: own?.extra_body?.enable_thinking ?? null,
    requestMatch: own ? "matched" : "none",
    ...toolFields(caseDef, outcome, own),
    ...(typeof outcome.rawResponse === "string" &&
    outcome.rawResponse !== visible
      ? { rawResponse: outcome.rawResponse }
      : {}),
    ...(outcome.outputCleanup ? { outputCleanup: outcome.outputCleanup } : {}),
    ...(replacement
      ? {
          calculatorReplacement: {
            reason: replacement.reason ?? null,
            draft: replacement.draft ?? null,
          },
        }
      : {}),
  };
}
