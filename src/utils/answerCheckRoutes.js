/**
 * Where the answer checks run. The contradiction block, the citation notice
 * and the form notice add app text to what the model wrote. On an advice
 * surface the veteran reads that text as advice, and a correction belongs
 * with it. Anywhere else the model's text may be the veteran's own words, or
 * may be put straight into a field or a draft (Nexus Builder field help, the
 * Symptom Logger suggestion, every statement tool), and app text added to it
 * would be written into the veteran's statement.
 *
 * So the routes are named, and anything not named gets no check:
 * - the tools below, whose prose result is advice shown as an answer;
 * - a caller that declares an advice surface with `answerChecks: true`
 *   (the assistant chat, Ask the Regs).
 * A writer-persona tool never gets them, whatever the caller passes.
 */

import { TOOL_AGENT_MAP } from "./diamondSwarm";

export const ADVICE_TOOL_IDS = Object.freeze([
  "decision-decoder",
  "denial-decoder",
  "war-room",
  "pact-navigator",
  "red-team",
  "pathfinder",
  "calculator",
  "rating-calculator",
  "tdiu-builder",
  "rating-analyzer",
]);

/**
 * Whether the contradiction rules may run on a result, beyond the route. The
 * rules are sentence patterns built on, and measured against, what the small
 * on-device models write. A larger or cloud model explains in other forms
 * ("Myth: ...", "A common mistake is ...") that the patterns misread, and
 * there is no recorded cloud answer to measure against (ADR-010 section 10).
 * So they run only where an on-device model produced the answer. The
 * citation and form notices are lookups, not patterns, and run either way. A
 * result that does not say who answered gets no block.
 */
export function contradictionRulesApply(result) {
  return result?.onDevice === true;
}

export function answerChecksApply(options) {
  const { toolId, answerChecks } = options ?? {};
  if (TOOL_AGENT_MAP[toolId] === "writer") return false;
  if (typeof answerChecks === "boolean") return answerChecks;
  return ADVICE_TOOL_IDS.includes(toolId);
}
