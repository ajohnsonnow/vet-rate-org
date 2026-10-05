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
 * The output-token limit to send with a prompt of `promptChars`, so prompt
 * and output together fit the window. It is never lowered below the reserve:
 * a prompt too large to leave that much is shortened by the swarm guard.
 */
export function fitOutputTokens({
  contextWindow,
  requestedOutputTokens,
  promptChars,
}) {
  const left =
    contextWindow - Math.ceil((promptChars + SAFETY_CHARS) / CHARS_PER_TOKEN);
  return Math.min(
    requestedOutputTokens,
    Math.max(left, reservedOutputTokens(requestedOutputTokens)),
  );
}
