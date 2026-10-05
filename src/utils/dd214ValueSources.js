/**
 * Where each value of a DD-214 reading came from (ADR-009 decision G). The
 * local parser reads a value from the document by pattern; the on-device model
 * writes values in its own words. Nothing the model read is ever pre-selected:
 * a confident parser value is shown first and is the only thing that may be
 * pre-ticked, a model value appears only where the parser has none, and the
 * veteran sees plainly how many values came from each source.
 */

export const VALUE_SOURCE = {
  PARSER: "parser",
  // A parser value read away from its own printed box, or one the rest of the
  // page contradicts: shown first like any parser value, never pre-selected.
  PARSER_CHECK: "parser-check",
  MODEL: "model",
  VETERAN: "veteran",
};

// Result keys that become a row in the import dialog (or a list row), apart
// from the identifier fields. The parser's value replaces the model's for each
// of them.
export const PARSER_WINS_KEYS = [
  "branch",
  "component",
  "componentFull",
  "rank",
  "payGrade",
  "dateOfRank",
  "mos",
  "mosTitle",
  "lastDutyAssignment",
  "commandTransferredTo",
  "entryDate",
  "separationDate",
  "netActiveService",
  "totalPriorActiveService",
  "totalPriorInactiveService",
  "yearsService",
  "monthsService",
  "daysService",
  "sglCoverage",
  "giBlStatus",
  "reserveObligationDate",
  "daysLost",
  "foreignService",
  "foreignServiceDetails",
  "seaService",
  "separationAuthority",
  "separationCode",
  "reentryCode",
  "separationProgramDesignator",
  "separationType",
  "characterOfService",
  "narrativeReason",
  "memberRequests",
  "securityClearance",
  "militaryEducation",
  "specialQualifications",
  "awards",
  "combatService",
];

// The parser names a few of these differently.
const PARSER_KEY_FOR = { seaService: "seaServiceTime" };

// The dialog's own row names for the two dates.
const IMPORT_KEY_FOR_RESULT_KEY = {
  entryDate: "serviceStartDate",
  separationDate: "serviceEndDate",
};
const RESULT_KEY_FOR_IMPORT_KEY = Object.fromEntries(
  Object.entries(IMPORT_KEY_FOR_RESULT_KEY).map(([result, row]) => [
    row,
    result,
  ]),
);

export const importKeyFor = (resultKey) =>
  IMPORT_KEY_FOR_RESULT_KEY[resultKey] ?? resultKey;
export const resultKeyFor = (importKey) =>
  RESULT_KEY_FOR_IMPORT_KEY[importKey] ?? importKey;

export function hasReadValue(value) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function combatHasValue(combat) {
  return Boolean(
    combat &&
    typeof combat === "object" &&
    (combat.hasVerifiedCombat ||
      combat.indicators?.length > 0 ||
      combat.deployments?.length > 0),
  );
}

// An empty list, or a combat object with nothing in it, is a reading that
// found nothing, not a value that was read.
export function isReadValue(key, value) {
  return key === "combatService" ? combatHasValue(value) : hasReadValue(value);
}

export function parserValueFor(parserFields, resultKey) {
  const value = parserFields?.[PARSER_KEY_FOR[resultKey] ?? resultKey];
  return isReadValue(resultKey, value) ? value : undefined;
}

/**
 * Put the parser's value into `data` for every key it read, whatever the model
 * wrote there. Returns the keys it replaced or filled.
 */
export function applyParserValues(data, parserFields) {
  const applied = [];
  for (const key of PARSER_WINS_KEYS) {
    const value = parserValueFor(parserFields, key);
    if (value === undefined) continue;
    data[key] = value;
    applied.push(key);
  }
  return applied;
}

/**
 * key -> "parser" | "model" for every shown value that has a row. `modelKeys`
 * are the keys the model filled (after its own guards), `parserKeys` the ones
 * the parser read; the parser wins where both did. `checkKeys` are parser keys
 * that need the veteran's check before they are ticked.
 */
export function buildValueSources(
  data,
  { modelKeys, parserKeys, checkKeys = new Set(), rowKeys = PARSER_WINS_KEYS },
) {
  const sources = {};
  const rows = new Set(rowKeys);
  for (const key of new Set([...modelKeys, ...parserKeys])) {
    if (!rows.has(key) || !isReadValue(key, data[key])) continue;
    if (!parserKeys.has(key)) sources[key] = VALUE_SOURCE.MODEL;
    else if (checkKeys.has(key)) sources[key] = VALUE_SOURCE.PARSER_CHECK;
    else sources[key] = VALUE_SOURCE.PARSER;
  }
  return sources;
}

export function sourcesForImportRows(fieldSources, importData) {
  const out = {};
  for (const row of Object.keys(importData || {})) {
    const source = fieldSources?.[resultKeyFor(row)];
    if (source) out[row] = source;
  }
  return out;
}

export function countBySource(sourceByKey) {
  const counts = { parser: 0, model: 0, veteran: 0 };
  for (const source of Object.values(sourceByKey || {})) {
    const bucket =
      source === VALUE_SOURCE.PARSER_CHECK ? VALUE_SOURCE.PARSER : source;
    if (bucket in counts) counts[bucket] += 1;
  }
  return counts;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function describeSourceCounts({ parser, model, veteran }) {
  const parts = [
    `${plural(parser, "value")} read by the app's own parser`,
    `${plural(model, "value")} read by the AI`,
  ];
  if (veteran > 0) parts.push(`${plural(veteran, "value")} typed by you`);
  return parts.join(", ");
}
