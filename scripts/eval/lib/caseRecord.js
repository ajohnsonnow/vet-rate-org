import { buildCaseRecord } from "./goldenRecord.js";
import { selectOwnRequest } from "./requestCapture.js";
import { TOOL_ENTRIES } from "./toolEntries.js";

/**
 * What the calculator guard and the response validator did to the answer,
 * read from the fields generateAI put on its result (`resultFlags`). All
 * three flags are null when the case produced no result (an error or a
 * timeout), so "not appended" is never confused with "not known".
 */
function guardOutcome(flags) {
  if (!flags) {
    return {
      calculatorAppended: null,
      tdiuParagraphAppended: null,
      validatorBlocked: null,
    };
  }
  return {
    calculatorAppended: Boolean(flags.calculatorAppended),
    tdiuParagraphAppended: Boolean(flags.tdiuParagraphAppended),
    validatorBlocked: Boolean(flags.blocked),
    ...(flags.calculatorLead ? { calculatorLead: flags.calculatorLead } : {}),
    ...(flags.blocked ? { blockedText: flags.blockedText ?? null } : {}),
  };
}

/**
 * One transcript record from what happened to one case.
 *
 * outcome: { ok, text, error, latencyMs, captured: request[], rawResponse,
 *            calculatorReplacement, citationsUnverified, validationErrors,
 *            validationWarnings, resultFlags }
 *
 * `response` is the visible text, the field graders score. `rawResponse` is
 * the engine's reply before any reasoning block was removed, present only when
 * it differs. `outputCleanup` says the wrapper tags were removed or a runaway
 * repeat was cut ({ echoRemoved, trimmed }). `calculatorReplacement` carries the reason and the replaced
 * draft when the calculator guard swapped the answer. `citationsUnverified`
 * lists the 38 CFR sections the answer cited that do not exist, and
 * `contradictionsFound` the rules and sentences where the answer contradicted
 * the verified text.
 *
 * A tool case (one with `entry`) went through a production function, not
 * straight to generateAI. Its request is found by the case's `match` phrase,
 * and its record adds the entry point, the form inputs (an attached document
 * by name only) and, for a writing tool, which draft the veteran was handed:
 * `draftPath` "model" (at least one typed passage was reworded by the model
 * and accepted) or "template" (the app-built draft was returned as it is).
 * `passages` counts the passages sent, accepted, unchanged and rejected,
 * `draftRejectReasons` says why each rejected one was, and
 * `draftErrorReason` is set when the model could not answer at all.
 * `calculatorAppended` and `tdiuParagraphAppended` say the calculator's line
 * or the TDIU threshold paragraph was appended to a kept answer;
 * `calculatorLead` ({ expected, commentaryKept }) says the answer leads with
 * the calculator's working. `validatorBlocked` says the response validator
 * blocked the answer, in which case `response` is the message shown in its
 * place and `blockedText` is what the model wrote.
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
    draftErrorReason: outcome.tool?.draftErrorReason ?? null,
    passages: outcome.tool?.passages ?? null,
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
    ...guardOutcome(outcome.ok ? outcome.resultFlags : null),
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
    ...(outcome.citationsUnverified
      ? { citationsUnverified: outcome.citationsUnverified }
      : {}),
    ...(outcome.contradictionsFound
      ? { contradictionsFound: outcome.contradictionsFound }
      : {}),
  };
}
