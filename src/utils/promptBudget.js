/**
 * Fits an on-device (WebLLM) request to the context window the engine was
 * loaded with. WebLLM throws ContextWindowSizeExceededError when the prompt
 * alone is larger than the window, and stops the answer early when prompt
 * plus output fill it, so the reference material is sized here before the
 * prompt is assembled. Pure functions; sizes are characters and tokens.
 */

// The estimate diamondSwarm's truncation guard uses. Keeping the two equal
// means a prompt planned here is never shortened there.
export const CHARS_PER_TOKEN = 3;

// The most output the guard reserves room for.
export const OUTPUT_RESERVE_TOKENS = 2048;

// Below this an answer is too short to be useful, so a request that cannot
// leave it is refused instead of sent.
export const MIN_OUTPUT_TOKENS = 256;

// Redaction and scrubbing can lengthen a prompt by a few placeholder tokens.
const SAFETY_CHARS = 200;

const reservedOutputTokens = (requested) =>
  Math.min(requested, OUTPUT_RESERVE_TOKENS);

/**
 * How much reference material a request has room for. `fixedChars` is what
 * must be sent whatever happens (the system message, the default prompt and
 * the question). The computed block is charged first, so the keyword block
 * and then the verified block give way before it does; it is dropped only
 * when it cannot fit even with no reference material at all.
 */
export function planPromptFit({
  contextWindow,
  requestedOutputTokens,
  fixedChars,
  computedChars = 0,
}) {
  const room =
    (contextWindow - reservedOutputTokens(requestedOutputTokens)) *
      CHARS_PER_TOKEN -
    fixedChars -
    SAFETY_CHARS;
  const keepComputed = computedChars <= room;
  return {
    keepComputed,
    referenceChars: Math.max(0, keepComputed ? room - computedChars : room),
  };
}

/**
 * True when what must be sent leaves less than the smallest useful answer.
 * For a backend with no truncation guard (wllama) such a request is refused.
 */
export function cannotFit({
  contextWindow,
  requestedOutputTokens,
  fixedChars,
}) {
  const output = Math.min(requestedOutputTokens, MIN_OUTPUT_TOKENS);
  return (contextWindow - output) * CHARS_PER_TOKEN < fixedChars + SAFETY_CHARS;
}

/**
 * The output-token limit to send with a prompt of `promptChars`, so prompt
 * and output together fit the window. It is never lowered below `floorTokens`.
 * By default that is the reserve, because the swarm guard shortens a prompt
 * too large to leave that much; a backend with no guard passes
 * MIN_OUTPUT_TOKENS and refuses what cannotFit reports.
 */
export function fitOutputTokens({
  contextWindow,
  requestedOutputTokens,
  promptChars,
  floorTokens = reservedOutputTokens(requestedOutputTokens),
}) {
  const left =
    contextWindow - Math.ceil((promptChars + SAFETY_CHARS) / CHARS_PER_TOKEN);
  return Math.min(
    requestedOutputTokens,
    Math.max(left, Math.min(floorTokens, requestedOutputTokens)),
  );
}
