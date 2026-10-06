import { buildCaseRecord } from "./goldenRecord.js";
import { selectOwnRequest } from "./requestCapture.js";
import { TOOL_ENTRIES } from "./toolEntries.js";

/**
 * Whether the calculator answered in place of a model, and what the response
 * validator did to the answer, read from the fields generateAI put on its
 * result (`resultFlags`).
 * `validatorBlocked` and `truncated` are null when the case produced no
 * result (an error or a timeout), so "no" is never confused with "not known".
 */
function guardOutcome(flags) {
  if (!flags) {
    return { validatorBlocked: null, truncated: null };
  }
  return {
    validatorBlocked: Boolean(flags.blocked),
    truncated: Boolean(flags.truncated),
    ...(flags.modelCalled === false ? { modelCalled: false } : {}),
    ...(flags.needsRatings ? { needsRatings: true } : {}),
    ...(flags.openAdviceHeld ? { openAdviceHeld: true } : {}),
    ...(flags.ratingsSource ? { ratingsSource: flags.ratingsSource } : {}),
    ...(flags.calculatorLead ? { calculatorLead: flags.calculatorLead } : {}),
    ...(flags.blocked ? { blockedText: flags.blockedText ?? null } : {}),
  };
}

/**
 * One transcript record from what happened to one case.
 *
 * outcome: { ok, text, error, latencyMs, captured: request[], rawResponse,
 *            citationsUnverified, formsUnverified,
 *            validationErrors,
 *            validationWarnings, resultFlags }
 *
 * `response` is the visible text, the field graders score. `rawResponse` is
 * the engine's reply before any reasoning block was removed, present only when
 * it differs. `outputCleanup` says the wrapper tags were removed or a runaway
 * repeat was cut ({ echoRemoved, trimmed }). `citationsUnverified`
 * lists the 38 CFR sections the answer cited that do not exist,
 * `formsUnverified` the VA form numbers it named that are in neither forms
 * list, and
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
 * `passageOutcomes` lists each one (the passage, what the model returned for
 * it, the verdict and the reasons) so a rejected rewording can be read,
 * `draftRejectReasons` says why each rejected one was, and
 * `draftErrorReason` is set when the model could not answer at all.
 * `rewordingOff` is "small-model" when the tool made no model call because
 * a small on-device model would have answered.
 * `modelCalled: false` says the app answered a rating question itself: no
 * engine was called, so the record has no request, no agent and
 * `engineRequests` 0. With `calculatorLead` ({ expected }) `response` is the
 * calculator's text, and `ratingsSource` says whether the ratings were
 * "supplied" as structured conditions or read from the "question". With
 * `needsRatings` it is the fixed answer that asks for the ratings. With
 * `openAdviceHeld` it is the fixed message shown in place of an answer while
 * a small-class model is loaded (ADR-010 section 11). `truncated` says the engine stopped the answer
 * at the length limit (known for WebLLM and Gemini only). `validatorBlocked` says the response validator
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
    passageOutcomes: outcome.tool?.passageOutcomes ?? [],
    rewordingOff: outcome.tool?.rewordingOff ?? null,
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
    ...(outcome.citationsUnverified
      ? { citationsUnverified: outcome.citationsUnverified }
      : {}),
    ...(outcome.formsUnverified
      ? { formsUnverified: outcome.formsUnverified }
      : {}),
    ...(outcome.contradictionsFound
      ? { contradictionsFound: outcome.contradictionsFound }
      : {}),
  };
}
