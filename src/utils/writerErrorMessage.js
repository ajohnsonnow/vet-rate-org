/**
 * Vet-Rate.org - why the AI did not reword a draft, in plain words
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * A writing tool shows this beside the draft. Internal codes and engine
 * wording never reach the veteran: an error the app knows is mapped to a
 * plain sentence, and anything else gets one generic sentence. The raw
 * error stays in the result (`draftErrorReason`) and the console.
 */
import { mapAssistantErrorMessage } from "./assistantErrorMessage";

export const AI_ERROR_GENERIC =
  "The AI could not finish this time. Nothing in your draft was changed. You can try again.";

const KNOWN = [
  [
    /AI_CIRCUIT_OPEN|failed \d+ times in a row/i,
    "The AI has stopped answering after several failed tries. Wait a few minutes, then try again.",
  ],
  [
    /timed? ?out|timeout/i,
    "The AI took too long to answer. You can try again.",
  ],
  [
    /out of memory|device (was )?lost|allocation failed/i,
    "The AI ran out of memory on this device. Close other tabs or apps, then try again.",
  ],
];

// Messages the app itself wrote for the veteran; shown as they are.
const ALREADY_PLAIN = /cooling down|please wait \d+ seconds|crisis support/i;

/**
 * @param {string|null|undefined} reason the raw error text
 * @param {(section: string, key: string) => string} t
 */
export function plainAIError(reason, t) {
  const message = String(reason ?? "").trim();
  if (!message) return AI_ERROR_GENERIC;
  if (ALREADY_PLAIN.test(message)) return message;
  const known = KNOWN.find(([pattern]) => pattern.test(message));
  if (known) return known[1];

  const mapped = mapAssistantErrorMessage({ message }, t);
  return mapped === `⚠️ ${message}`
    ? AI_ERROR_GENERIC
    : mapped.replace(/^⚠️\s*/u, "");
}
