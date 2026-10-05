import { buildCaseRecord } from "./goldenRecord.js";
import { selectOwnRequest } from "./requestCapture.js";

/**
 * One transcript record from what happened to one case.
 *
 * outcome: { ok, text, error, latencyMs, captured: request[], rawResponse,
 *            calculatorReplacement, validationErrors, validationWarnings }
 *
 * `response` is the visible text, the field graders score. `rawResponse` is
 * the engine's reply before any reasoning block was removed, present only when
 * it differs. `calculatorReplacement` carries the reason and the replaced
 * draft when the calculator guard swapped the answer.
 */
export function assembleCaseRecord({ caseDef, run, personaPrompts, outcome }) {
  const requests = outcome.captured ?? [];
  const own = selectOwnRequest(requests, caseDef.input);
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
    ...(typeof outcome.rawResponse === "string" &&
    outcome.rawResponse !== visible
      ? { rawResponse: outcome.rawResponse }
      : {}),
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
