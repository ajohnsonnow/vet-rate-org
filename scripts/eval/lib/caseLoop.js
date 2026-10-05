export const PAGE_UNANSWERED_ERROR =
  "page did not answer within the case timeout; GPU presumed wedged";

/**
 * Run each case, append its record the moment it finishes, and after any case
 * that timed out or errored bring the engine back to a clean idle state before
 * the next case starts. Without that, the engine keeps working on the failed
 * case, and its late request and slow decode leak into the next case.
 *
 *   attempt(caseDef)         resolves to an outcome, or "timeout" when the page
 *                            never answered
 *   recover()                resets the engine and resolves once it is ready
 *                            and the forced model is loaded again; throws if
 *                            it cannot
 *   toRecord(caseDef, outcome)  builds the transcript record
 *   write(record)            appends it
 *
 * Returns { recorded, stopped }: stopped is null, or why the run ended early.
 */
export async function recordAllCases({
  cases,
  attempt,
  recover,
  toRecord,
  write,
  pageTimeoutMs,
}) {
  let recorded = 0;
  for (const caseDef of cases) {
    const raw = await attempt(caseDef);
    const unanswered = raw === "timeout";
    const outcome = unanswered
      ? {
          ok: false,
          error: PAGE_UNANSWERED_ERROR,
          latencyMs: pageTimeoutMs,
          captured: [],
        }
      : raw;

    write(toRecord(caseDef, outcome));
    recorded++;

    if (!outcome.ok) {
      try {
        await recover();
      } catch (err) {
        return {
          recorded,
          stopped: `engine could not be reset after ${caseDef.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        };
      }
    }
  }
  return { recorded, stopped: null };
}
