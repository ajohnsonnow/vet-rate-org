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
import { findUnmentionedTheories } from "./decoderLetterCheck";

export const REVIEW_OPTIONS = quotes.reviewOptions;

const stringsIn = (value) =>
  [value].flat().filter((item) => typeof item === "string");

/**
 * Corrections for filing advice in the model's own fields that contradicts
 * the verified review text: { field, rule, note }, one for each rule a field
 * breaks. Every text field the model returned is checked, whatever its name.
 */
function reviewCorrections(decoded) {
  const notes = [];
  for (const [field, value] of Object.entries(decoded)) {
    const seen = new Set();
    for (const text of stringsIn(value)) {
      for (const hit of findContradictions(text, {
        topics: ["decision-review"],
      })) {
        if (seen.has(hit.rule)) continue;
        seen.add(hit.rule);
        notes.push({
          field,
          rule: hit.rule,
          note: buildContradictionNote(hit),
        });
      }
    }
  }
  return notes;
}

/**
 * A decoded decision with the review options replaced by the verified ones:
 * whatever the model put in `appeal_options` or `review_options` is dropped,
 * `review_options` carries the verified text, and `review_corrections` lists
 * a correction for each contradiction left in the model's other fields. With
 * `documentText` (the letter that was decoded), the "missing" list is also
 * checked against the letter's own words.
 */
export function withVerifiedReviewOptions(decoded, { documentText } = {}) {
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    return decoded;
  }
  const {
    appeal_options: _modelWritten,
    review_options: _notTheModels,
    review_corrections: _norThese,
    ...rest
  } = decoded;
  const corrections = [
    ...reviewCorrections(rest),
    ...findUnmentionedTheories(rest, documentText),
  ];
  return {
    ...rest,
    review_options: REVIEW_OPTIONS,
    ...(corrections.length > 0 ? { review_corrections: corrections } : {}),
  };
}
