/**
 * cavcAuthorityTagging - authority metadata for Court of Appeals for Veterans
 * Claims (CAVC) decisions (S43).
 *
 * CAVC's own search UI splits its archive into two categories via
 * IW_DATABASE, and that split IS the precedential signal (see
 * fetch-cavc-historical.mjs's header) - more reliable than parsing each
 * opinion's own "may/may not be cited" sentence:
 *   - PanelDecisions: precedential panel opinions.
 *   - SingleJudgeDecisions: memorandum decisions that "may not be cited as
 *     precedent" under U.S. Vet. App. R. 30(a) - the Court's own rule, not an
 *     inference.
 *
 * Every retrieved CAVC chunk carries decision_type + precedential so the
 * answerer/UI can rank panel opinions above memorandum decisions and never
 * present a single-judge decision as citable precedent.
 *
 * Pure functions, no deps - build-time (build-cavc-shard.mjs bakes these
 * fields into each shard chunk) and runtime importable, fully unit-testable.
 */

/** The rule that makes single-judge memorandum decisions non-precedential. */
export const CAVC_SINGLE_JUDGE_BASIS = "U.S. Vet. App. R. 30(a)";

/** Caveat surfaced wherever a single-judge decision is cited. */
export const CAVC_SINGLE_JUDGE_CAVEAT =
  "Single-judge memorandum decisions may not be cited as precedent (U.S. Vet. App. R. 30(a)) - " +
  "persuasive only, not binding authority in another claim.";

/**
 * Authority tag for one CAVC decision, keyed by which IW_DATABASE it was
 * fetched from.
 * @param {"panel"|"singlejudge"} decisionType
 * @returns {Object} authority tag to bake into the shard chunk
 */
export function tagCavcEntry(decisionType) {
  const isPanel = decisionType === "panel";
  return {
    decision_type: isPanel ? "panel" : "single_judge",
    precedential: isPanel,
    citation_weight: isPanel ? 1.0 : 0.5,
    ...(isPanel
      ? {}
      : {
          caveat: CAVC_SINGLE_JUDGE_CAVEAT,
          authority_basis: CAVC_SINGLE_JUDGE_BASIS,
        }),
  };
}
