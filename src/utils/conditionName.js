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
 * as e.g. "irritable bowel syndrome (formerly evaluated as spastic colon (NOS))"
 * or "cervical strain (previously rated as neck sprain)" — without this link the
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

const SECONDARY_LINK = / (?:associated with|secondary to) /;

/**
 * The condition itself without the "associated with <primary>" or
 * "secondary to <primary>" link VA adds for secondary conditions. The code
 * sheet always spells the link out ("neuropathy, right upper extremity
 * (median) associated with cervical strain, ...") while decision letters
 * often don't, and both name the same rating.
 */
export const primaryConditionKey = (name) => {
  const key = normalizeConditionName(name);
  const link = SECONDARY_LINK.exec(key);
  return link ? key.slice(0, link.index) : key;
};

/**
 * Find the saved row a newly decided condition should update: same name,
 * a row the new name says it replaces, or a row that already records this
 * name as its former name (an older letter processed after a newer one), or
 * the same condition written with or without its secondary link.
 */
export const findRatedConditionMatch = (rows, name, getName) => {
  const key = normalizeConditionName(name);
  if (!key) return null;
  const priors = extractPriorConditionNames(name);
  const base = primaryConditionKey(name);
  return (
    rows.find((r) => normalizeConditionName(getName(r)) === key) ||
    rows.find((r) => priors.includes(normalizeConditionName(getName(r)))) ||
    rows.find((r) => extractPriorConditionNames(getName(r)).includes(key)) ||
    rows.find((r) => primaryConditionKey(getName(r)) === base) ||
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

/**
 * Remove rows another row says it replaced ("irritable bowel syndrome
 * (formerly evaluated as spastic colon ...)" replaces "Spastic colon ..."),
 * so a renamed rating is never counted twice. Mutates `rows` in place and
 * returns how many were removed.
 */
export const dropSupersededConditions = (rows, getName) => {
  const superseded = rows.filter((row) =>
    rows.some(
      (other) =>
        other !== row && isSupersededName(getName(other), getName(row)),
    ),
  );
  for (const row of superseded) rows.splice(rows.indexOf(row), 1);
  return superseded.length;
};

/**
 * "2023-08-22" and "August 22, 2023" as the same YYYY-MM-DD, or null.
 * Date.parse reads the ISO form as UTC midnight and the prose form as local
 * midnight, which west of UTC makes the same day compare as two.
 */
export const calendarDay = (value) => {
  const text = String(value ?? "");
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  if (!text || Number.isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** True when the incoming decision is dated on a strictly earlier day. */
export const isOlderDecision = (incomingDate, existingDate) => {
  const a = calendarDay(incomingDate);
  const b = calendarDay(existingDate);
  return Boolean(a && b) && a < b;
};

// Real VA letters spell out condition names in full, with renames, sided
// extremities and "(claimed as ...)" qualifiers ("radiculopathy, left lower
// extremity (femoral)"), while tools like EvidenceGapVisualizer and
// WebOfConditions key their own static knowledge maps on short canonical
// labels ("PTSD", "Radiculopathy (Sciatic Nerve)"). These pairs bridge that
// gap for the handful of abbreviations a long name uses but a short label's
// words don't literally contain - each pair is VA's own acronym usage (or,
// for the back/spine group, terms VA letters use interchangeably for the
// same condition), not an invented clinical equivalence. Plain word overlap
// (matchConditionToKnownKey's token-containment pass) handles everything
// else - most real names already share literal words with the tool's label
// ("radiculopathy" appears in both), so most conditions need no entry here.
const CONDITION_ALIAS_GROUPS = [
  ["ptsd", "post traumatic stress disorder"],
  [
    "lumbosacral",
    "lumbar",
    "low back",
    "thoracolumbar",
    "back strain",
    "back condition",
    "degenerative disc disease",
    "lumbago",
  ],
  ["copd", "chronic obstructive pulmonary disease"],
  ["gerd", "gastroesophageal reflux disease"],
  ["ibs", "irritable bowel syndrome"],
  ["tbi", "traumatic brain injury"],
  ["cad", "coronary artery disease"],
  ["ckd", "chronic kidney disease"],
  ["tmj", "temporomandibular joint"],
  ["ivds", "intervertebral disc syndrome"],
];

function _expandConditionAliases(normalized) {
  let expanded = normalized;
  for (const group of CONDITION_ALIAS_GROUPS) {
    if (group.some((term) => normalized.includes(term))) {
      expanded += ` ${group.join(" ")}`;
    }
  }
  return expanded;
}

/**
 * Map a long, real-world VA condition name onto one of a tool's own known
 * condition keys. `knownConditions` is an array of `{key, label}` pairs
 * drawn from the tool's own data (evidenceRequirements' `name` fields,
 * WebOfConditions' node labels, etc.) - never an external medical
 * vocabulary. Tries an exact normalized match first, then whether every
 * (non-trivial) word of a known label - after the alias expansion above -
 * appears in the long name, preferring the longest/most-specific label that
 * qualifies. Returns the matching key, or null when nothing lines up.
 */
export const matchConditionToKnownKey = (longName, knownConditions) => {
  const normalizedLong = normalizeConditionName(longName);
  if (!normalizedLong || !Array.isArray(knownConditions)) return null;

  const exact = knownConditions.find(
    (c) => normalizeConditionName(c.label) === normalizedLong,
  );
  if (exact) return exact.key;

  const expandedLong = _expandConditionAliases(normalizedLong);
  let bestKey = null;
  let bestLength = 0;
  for (const { key, label } of knownConditions) {
    const normalizedLabel = normalizeConditionName(label);
    if (!normalizedLabel) continue;
    const tokens = normalizedLabel.split(" ").filter((w) => w.length > 2);
    if (tokens.length === 0) continue;
    const allTokensPresent = tokens.every((t) => expandedLong.includes(t));
    if (allTokensPresent && normalizedLabel.length > bestLength) {
      bestKey = key;
      bestLength = normalizedLabel.length;
    }
  }
  return bestKey;
};
