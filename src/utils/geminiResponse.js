/**
 * Interpret a Gemini `generateContent` API response.
 *
 * Surfaces safety blocks and token-limit truncation instead of a generic
 * "No response generated", so the veteran learns WHY there is no answer (a
 * blocked prompt/response) or that the answer they got is incomplete (C-H05).
 *
 * @param {object} data - parsed JSON body from the Gemini API
 * @returns {string} the response text (with a truncation notice appended if cut off)
 * @throws {Error} when the prompt or the response was blocked
 */
export const interpretGeminiResponse = (data) => {
  const candidate = data?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const blockReason = data?.promptFeedback?.blockReason;

  if (blockReason) {
    throw new Error(
      `Gemini blocked this request (${blockReason}). Try rephrasing, or switch to Local AI for unfiltered, 100% private processing.`,
    );
  }
  if (
    finishReason === "SAFETY" ||
    finishReason === "PROHIBITED_CONTENT" ||
    finishReason === "RECITATION"
  ) {
    throw new Error(
      `Gemini stopped the response (${finishReason}) before it finished. Try rephrasing, or switch to Local AI.`,
    );
  }

  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(
      finishReason
        ? `Gemini returned no usable text (finishReason: ${finishReason}).`
        : "No response generated",
    );
  }

  if (finishReason === "MAX_TOKENS") {
    // Don't hand back truncated output as if it were complete.
    return `${text}\n\n⚠️ [This response was cut off at the output token limit. Raise the token limit in AI settings or ask for a shorter answer.]`;
  }

  return text;
};
