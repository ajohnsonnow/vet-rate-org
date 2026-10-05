/**
 * The decision review options, as the app states them. A veteran's choices
 * after a decision are fixed by 38 CFR 3.2500, so the Decision Decoder shows
 * them from the bundled verified text (src/data/verifiedQuotes.json, copied
 * from the legal index by scripts/verified-reference/build.mjs) and does not
 * ask the model for them.
 */

import quotes from "../data/verifiedQuotes.json";
import {
  buildContradictionNote,
  findContradictions,
} from "./contradictionCheck";

export const REVIEW_OPTIONS = quotes.reviewOptions;

const MODEL_WRITTEN_FIELDS = [
  "plain_english",
  "va_reasoning",
  "favorable_findings",
  "missing_elements",
  "action_plan",
  "deadline_warning",
];

const stringsIn = (value) =>
  [value].flat().filter((item) => typeof item === "string");

/**
 * Corrections for filing instructions in the model's own fields that name
 * the wrong document or review lane, one per rule.
 */
function reviewCorrections(decoded) {
  const seen = new Set();
  const notes = [];
  for (const field of MODEL_WRITTEN_FIELDS) {
    for (const text of stringsIn(decoded[field])) {
      for (const hit of findContradictions(text, {
        topics: ["decision-review"],
      })) {
        if (seen.has(hit.rule)) continue;
        seen.add(hit.rule);
        notes.push({ rule: hit.rule, note: buildContradictionNote(hit) });
      }
    }
  }
  return notes;
}

/**
 * A decoded decision with the review options replaced by the verified ones:
 * whatever the model put in `appeal_options` is dropped, `review_options`
 * carries the verified text, and `review_corrections` lists a correction for
 * each wrong filing instruction left in the model's other fields.
 */
export function withVerifiedReviewOptions(decoded) {
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    return decoded;
  }
  const { appeal_options: _modelWritten, ...rest } = decoded;
  const corrections = reviewCorrections(rest);
  return {
    ...rest,
    review_options: REVIEW_OPTIONS,
    ...(corrections.length > 0 ? { review_corrections: corrections } : {}),
  };
}
