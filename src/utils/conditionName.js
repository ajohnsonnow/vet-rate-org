/**
 * Vet-Rate.org - Condition name normalization (shared leaf module)
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * A single, dependency-free normalizer so the VKB write path
 * (veteranKnowledgeBase) and the read path (veteranContextProvider) dedup
 * condition names identically. Kept here — not in either of those modules —
 * so both can import it without a circular dependency, and so the
 * claims-sensitive dedup logic can never drift between writer and reader.
 */

/**
 * Normalize a condition name for duplicate detection.
 * "Tinnitus (Service Connected)" / "TINNITUS" / " tinnitus. " all collapse
 * to "tinnitus" so analyzer output, saved claims, and manual entries merge
 * instead of stacking duplicates.
 */
export const normalizeConditionName = (name) => {
  if (typeof name !== "string") return "";
  const closedRemoved = name.toLowerCase().replace(/\([^)]{0,300}\)/g, " ");
  // Any "(" left is unclosed: a letter's condition text cut off mid-parenthetical.
  const open = closedRemoved.indexOf("(");
  return (open === -1 ? closedRemoved : closedRemoved.slice(0, open))
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const RENAME_MARKER =
  /\b(?:formerly|previously) (?:evaluated|rated|service[- ]connected) as /gi;

/**
 * Names a VA letter says this condition was previously rated under, each
 * normalized with normalizeConditionName. A re-characterized rating arrives
 * as e.g. "PTSD (formerly evaluated as panic disorder ... (NOS))" or
 * "lumbosacral strain (previously rated as lumbago)" — without this link the
 * old and new names stack as two ratings and inflate the combined rating.
 * The parenthetical may be nested or truncated (unclosed). "Also claimed as"
 * is deliberately not a marker: it lists alternate claim names, not a rename.
 */
export const extractPriorConditionNames = (name) => {
  if (typeof name !== "string") return [];
  const priors = [];
  for (const marker of name.replace(/\s+/g, " ").matchAll(RENAME_MARKER)) {
    const text = marker.input;
    const start = marker.index + marker[0].length;
    let depth = 1;
    let end = start;
    while (end < text.length && depth > 0) {
      if (text[end] === "(") depth++;
      else if (text[end] === ")") depth--;
      end++;
    }
    const key = normalizeConditionName(
      text.slice(start, depth === 0 ? end - 1 : end),
    );
    if (key) priors.push(key);
  }
  return priors;
};

/**
 * Find the saved row a newly decided condition should update: same name,
 * a row the new name says it replaces, or a row that already records this
 * name as its former name (an older letter processed after a newer one).
 */
export const findRatedConditionMatch = (rows, name, getName) => {
  const key = normalizeConditionName(name);
  if (!key) return null;
  const priors = extractPriorConditionNames(name);
  return (
    rows.find((r) => normalizeConditionName(getName(r)) === key) ||
    rows.find((r) => priors.includes(normalizeConditionName(getName(r)))) ||
    rows.find((r) => extractPriorConditionNames(getName(r)).includes(key)) ||
    null
  );
};

/**
 * True when the saved row's name says it replaced the incoming name, so the
 * incoming decision is older even if the letter carries no effective date.
 */
export const isSupersededName = (savedName, incomingName) =>
  extractPriorConditionNames(savedName).includes(
    normalizeConditionName(incomingName),
  );

/** True when the incoming decision is dated strictly before the saved one. */
export const isOlderDecision = (incomingDate, existingDate) => {
  const a = Date.parse(incomingDate);
  const b = Date.parse(existingDate);
  return Number.isFinite(a) && Number.isFinite(b) && a < b;
};
