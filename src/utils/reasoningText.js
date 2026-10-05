/**
 * Vet-Rate.org - reasoning-block handling for on-device "thinking" models
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Thinking models (Qwen3 family) open a reply with <think> ... </think> and
 * give the answer after it. Nothing downstream - the UI, the validators, the
 * calculator guard, the JSON parsers - should ever see that block.
 *
 * Only a LEADING block is reasoning. A literal "<think>" later in an answer is
 * ordinary text and is left alone. Blocks nest by tag depth, so a reasoning
 * block that quotes a tag is never cut short and leaked.
 */

const OPEN = "<think>";

const skipWhitespace = (text, from) => {
  let i = from;
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
};

/** Index just past the close tag that balances the open tag at `start`, or -1. */
function endOfBlock(raw, start) {
  const tags = /<\/?think>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let m = tags.exec(raw); m; m = tags.exec(raw)) {
    depth += m[0] === OPEN ? 1 : -1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}

const isPartialOpenTag = (text) =>
  text.length < OPEN.length && OPEN.startsWith(text);

/**
 * Split a model reply into its visible part and what happened to it.
 *
 * status: "none"         no leading block; visible is `raw`, untouched
 *         "complete"     one or more leading blocks removed
 *         "unterminated" a block opened and never closed: there is no answer
 *         "pending"      (streaming only, final=false) too early to tell
 *
 * With final=false a reply that so far is only whitespace or a partial
 * "<thi" is held back as "pending" instead of being shown.
 */
export function splitReasoning(raw, { final = true } = {}) {
  const text = typeof raw === "string" ? raw : "";
  const first = skipWhitespace(text, 0);

  if (!text.startsWith(OPEN, first)) {
    if (!final && isPartialOpenTag(text.slice(first))) {
      return { visible: "", status: "pending" };
    }
    return { visible: text, status: "none" };
  }

  let pos = first;
  for (;;) {
    const end = endOfBlock(text, pos);
    if (end === -1) return { visible: "", status: "unterminated" };
    const next = skipWhitespace(text, end);
    if (text.startsWith(OPEN, next)) {
      pos = next;
      continue;
    }
    const rest = text.slice(next);
    if (!final && rest.length > 0 && isPartialOpenTag(rest)) {
      return { visible: "", status: "complete" };
    }
    return { visible: rest, status: "complete" };
  }
}

/**
 * Remove a leading reasoning block from a finished reply. `answered` is false
 * when the model produced no answer: an unterminated block, or a block with
 * nothing after it.
 */
export function stripReasoning(raw) {
  const { visible, status } = splitReasoning(raw);
  return {
    text: visible,
    raw: typeof raw === "string" ? raw : "",
    hadReasoning: status === "complete" || status === "unterminated",
    unterminated: status === "unterminated",
    answered: status === "none" || visible.trim() !== "",
  };
}

/**
 * Incremental form of splitReasoning for streamed deltas. `emit(delta, full)`
 * receives only visible text, in order, and never any part of a reasoning
 * block. Call end() once the stream is over; it flushes anything that was
 * held back while the reply's first characters were ambiguous.
 */
export function createReasoningStreamFilter(emit) {
  let raw = "";
  let sent = "";

  const flush = (final) => {
    const { visible } = splitReasoning(raw, { final });
    if (visible.length > sent.length && visible.startsWith(sent)) {
      const delta = visible.slice(sent.length);
      sent = visible;
      emit(delta, visible);
    }
  };

  return {
    push(delta) {
      raw += delta;
      flush(false);
    },
    end() {
      flush(true);
      return raw;
    },
  };
}

/** Model ids whose chat template honours WebLLM's enable_thinking switch. */
export const THINKING_CAPABLE_MODEL = /^Qwen3/i;

export const modelSupportsThinking = (modelId) =>
  typeof modelId === "string" && THINKING_CAPABLE_MODEL.test(modelId);

/**
 * Request fields that switch reasoning on or off for one WebLLM request.
 * Reasoning is OFF unless `thinking === true`. Models that cannot reason get
 * no extra field at all, so their request is exactly what it was before.
 */
export function buildThinkingRequestFields(modelId, thinking) {
  if (!modelSupportsThinking(modelId)) return {};
  return { extra_body: { enable_thinking: thinking === true } };
}
