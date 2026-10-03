/**
 * Guards applied to what an AI model returns for a DD-214 before it is shown
 * or saved (owner decision F, ADR-009 section 3).
 *
 * - A model that echoes the prompt's own placeholder text for any field has
 *   not read the document; that value is rejected, whatever the field.
 * - Every value a model writes is checked against the type its key allows
 *   (date, count, flag, service time, text) and every string in it goes
 *   through the PII scrubber plus known-value redaction. A model-written
 *   string is never trusted as written, whichever key it is filed under.
 */
import {
  scrubText,
  redactKnownValues,
  redactFileNames,
  collectKnownIdentifierValues,
} from "./piiScrubber";
import {
  ENUMERATED_KEYS,
  birthDateKeysFrom,
  cleanDocumentTypes,
  cleanEnumeratedField,
  dateKeys,
  isPlausibleDateKey,
} from "./dd214EnumeratedFields";
import {
  normaliseModelText,
  removePersonAndPlaceShapes,
} from "./dd214ModelTextScrub";

export const FREE_TEXT_FIELDS = [
  "extractionNotes",
  "narrativeReason",
  "memberRequests",
  "foreignServiceDetails",
];

// Model-written lists and objects the import dialog shows as one text row each
// (never pre-ticked); they are stored only when the veteran ticks that row.
export const MODEL_LIST_FIELDS = ["awards", "combatService"];

// Fields whose text a model writes in its own words (or copies as a unit
// line), so a name the app has never seen can sit in them. They are never
// pre-ticked for import and are stored only when the veteran ticks them.
export const MODEL_TEXT_FIELDS = [
  ...FREE_TEXT_FIELDS,
  "lastDutyAssignment",
  "commandTransferredTo",
  "mosTitle",
  "militaryEducation",
  "specialQualifications",
];

// Sentences and unit lines: a bare "John Smith" is removed from these too.
const PROSE_KEYS = new Set([
  ...FREE_TEXT_FIELDS,
  "lastDutyAssignment",
  "commandTransferredTo",
]);

const SCALAR_LITERAL = /"(\w+)"\s*:\s*"([^"\n]+)"/g;
// Bracketed lists of plain strings, one line or several; a list that holds
// objects or other lists (the awards example) never matches.
const ARRAY_LITERAL = /"(\w+)"\s*:\s*\[([^\][{}]*)\]/g;
const QUOTED = /"([^"\n]+)"/g;
// Arrays of descriptive placeholders; the other prompt arrays hold real
// example values ("Airborne", "Purple Heart") a document can legitimately
// contain, so only the complete example list is an echo.
const DESCRIPTIVE_ARRAY_KEYS = new Set([
  "militaryEducation",
  "extractionNotes",
]);
// A single bare word is a real answer ("DD214"); only text with structure is
// a template.
const TEMPLATE_SHAPE = /[\s|(),]/;
const BARE_ECHO_TOKENS = new Set([
  "number",
  "boolean",
  "string",
  "abbr",
  "etc",
  "null",
  "n/a",
  "true/false",
]);
const DATE_TEMPLATE = /yyyy|mm-dd/i;
const MANY_ALTERNATIVES = /^[^|]{1,40}(?:\|[^|]{1,40}){2,}$/;
// A template shorter than this ("job title") also reads as ordinary text, so
// only an exact match rejects it; a longer one is rejected when it appears
// inside a longer answer ("Block 8: Unit and major command").
const MIN_CONTAINED_TEMPLATE_CHARS = 10;

// Case, spacing, punctuation and a trailing "(Block 8)" are not a real change
// to a template.
const normalize = (text) =>
  text
    .toLowerCase()
    .replace(/\([^)]{0,80}\)/g, " ")
    .replace(/[^a-z0-9|/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isBare = (item) => BARE_ECHO_TOKENS.has(item);

function collectPromptPlaceholders(promptTexts) {
  const exact = new Set();
  const alternativeSets = [];
  const listsByKey = new Map();

  const addLiteral = (literal) => {
    if (!TEMPLATE_SHAPE.test(literal)) return;
    const text = normalize(literal);
    exact.add(text);
    if (text.includes("|")) {
      const parts = text.split("|").map((part) => part.trim());
      alternativeSets.push(
        new Set(parts.filter((part) => part && !isBare(part))),
      );
    }
  };

  for (const prompt of promptTexts) {
    for (const [, , literal] of prompt.matchAll(SCALAR_LITERAL)) {
      addLiteral(literal);
    }
    for (const [, key, body] of prompt.matchAll(ARRAY_LITERAL)) {
      const items = [...body.matchAll(QUOTED)].map(([, item]) => item);
      if (DESCRIPTIVE_ARRAY_KEYS.has(key)) items.forEach(addLiteral);
      const set = new Set(items.map(normalize).filter((item) => !isBare(item)));
      if (set.size < 2) continue;
      listsByKey.set(key, [...(listsByKey.get(key) ?? []), set]);
    }
  }
  return { exact, alternativeSets, listsByKey };
}

export function buildPlaceholderDetector(promptTexts) {
  const { exact, alternativeSets, listsByKey } =
    collectPromptPlaceholders(promptTexts);
  const containedTemplates = [...exact].filter(
    (text) => text.length >= MIN_CONTAINED_TEMPLATE_CHARS,
  );

  const isSubsetOfAlternatives = (text) => {
    if (!text.includes("|")) return false;
    const parts = text.split("|").map((part) => part.trim());
    return (
      parts.length >= 2 &&
      alternativeSets.some((set) => parts.every((part) => set.has(part)))
    );
  };

  const isPlaceholderEcho = (value, key = "") => {
    if (typeof value !== "string") return false;
    const text = normalize(value);
    if (text === "") return false;
    return (
      exact.has(text) ||
      isBare(text) ||
      (key !== "" && text === normalize(key)) ||
      DATE_TEMPLATE.test(value) ||
      MANY_ALTERNATIVES.test(text) ||
      isSubsetOfAlternatives(text) ||
      containedTemplates.some((template) => text.includes(template))
    );
  };

  const isWholeListEcho = (items, key) => {
    const present = new Set(items.map((item) => normalize(String(item))));
    return (listsByKey.get(key) ?? []).some(
      (set) =>
        set.size === present.size && [...present].every((i) => set.has(i)),
    );
  };

  const clean = (value, key) => {
    if (typeof value === "string") {
      return isPlaceholderEcho(value, key) ? undefined : value;
    }
    if (Array.isArray(value)) {
      const items = value
        .map((item) => clean(item, key))
        .filter((item) => item !== undefined);
      const plain = items.every((item) => typeof item === "string");
      return plain && isWholeListEcho(items, key) ? undefined : items;
    }
    if (value && typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        const cleaned = clean(v, k);
        if (cleaned !== undefined) out[k] = cleaned;
      }
      return out;
    }
    return value;
  };

  const rejectPlaceholderEchoes = (data) => {
    for (const key of Object.keys(data)) {
      const cleaned = clean(data[key], key);
      if (cleaned === undefined) delete data[key];
      else data[key] = cleaned;
    }
    if (Array.isArray(data.awards)) {
      data.awards = data.awards.filter(
        (award) => award && typeof award === "object" && award.name,
      );
    }
    return data;
  };

  return { isPlaceholderEcho, rejectPlaceholderEchoes };
}

const _longEnough = (value) =>
  typeof value === "string" && value.trim().length >= 4;

function knownValuesFrom(sources) {
  return sources.flatMap((source) => {
    if (!source || typeof source !== "object") return [];
    const loose = [source.homeOfRecord, source.homeAddress, source.placeOfBirth]
      .filter(_longEnough)
      .map((value) => ({ value: value.trim() }));
    return [...collectKnownIdentifierValues(source), ...loose];
  });
}

const MONTH_NAMES = "JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC";
const WRITTEN_DATE = new RegExp(
  [
    String.raw`(?:${MONTH_NAMES})[A-Z]*\.?[ \t]+\d{1,2},?[ \t]+\d{2,4}`,
    String.raw`\d{1,2}[ \t-]?(?:${MONTH_NAMES})[A-Z]*\.?,?[ \t-]?\d{2,4}`,
    String.raw`\d{4}[-/. ]?\d{2}[-/. ]?\d{2}`,
    String.raw`\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}`,
  ]
    .map((shape) => String.raw`(?<![\p{L}\d])(?:${shape})(?![\p{L}\d])`)
    .join("|"),
  "giu",
);

// A known birth date written out in any common format, however the model
// worded the text around it.
const redactBirthDates = (text, birthDates) =>
  birthDates.size === 0
    ? text
    : text.replace(WRITTEN_DATE, (match) =>
        dateKeys(match).some((key) => birthDates.has(key))
          ? "[REDACTED]"
          : match,
      );

const makeScrubber = (sources) => {
  const known = knownValuesFrom(sources);
  const birthDates = birthDateKeysFrom(sources);
  const base = (raw) => {
    const text = normaliseModelText(raw);
    return scrubText(
      redactKnownValues(redactBirthDates(text, birthDates), known),
    );
  };
  return {
    known,
    birthDates,
    scrub: (text) => removePersonAndPlaceShapes(base(text)),
    scrubShort: (text) =>
      removePersonAndPlaceShapes(base(text), { bare: "short" }),
    scrubProse: (text) =>
      removePersonAndPlaceShapes(base(text), { bare: "prose" }),
  };
};

/**
 * Scrub every model-written free-text field in place. `sources` are objects
 * holding values the app already knows are identifiers (the saved profile, the
 * knowledge base, the identifiers read by the local parser); each one is
 * redacted by value on top of the pattern scrubber, and person-, city- and
 * ZIP-shaped text is removed whether or not the app knew it.
 */
export function scrubModelFreeText(data, sources = []) {
  const { scrub } = makeScrubber(sources);

  for (const key of FREE_TEXT_FIELDS) {
    if (!(key in data)) continue;
    const cleaned = cleanTextOrList(data[key], scrub);
    if (cleaned === undefined) delete data[key];
    else data[key] = cleaned;
  }
  return data;
}

const DATE_KEYS = new Set([
  "masterRecordDate",
  "dateOfRank",
  "entryDate",
  "separationDate",
  "reserveObligationDate",
]);
const COUNT_KEYS = new Set([
  "documentCount",
  "yearsService",
  "monthsService",
  "daysService",
  "daysLost",
  "dd214Count",
]);
const FLAG_KEYS = new Set(["foreignService", "reenlisted"]);
const SERVICE_TIME_KEYS = new Set([
  "netActiveService",
  "totalPriorActiveService",
  "totalPriorInactiveService",
  "seaService",
]);
const TEXT_OR_LIST_KEYS = new Set([
  ...FREE_TEXT_FIELDS,
  "mosTitle",
  "militaryEducation",
  "specialQualifications",
]);

// ISO (what the prompt asks for), compact YYYYMMDD and US MM/DD/YYYY.
const DATE_SHAPE = /^(?:\d{4}-\d{2}-\d{2}|\d{8}|\d{1,2}\/\d{1,2}\/\d{4})$/;
// Lengths of service can be fractional ("8.5" years).
const COUNT_SHAPE = /^\d{1,5}(?:\.\d{1,2})?$/;
const MAX_COUNT = 99999;
// Unit lines, course names, award names: longer, but not a paragraph.
const MAX_TEXT_CHARS = 300;

const fits = (text, max) => text.length <= max;

function cleanTextOrList(value, scrub, max = Infinity) {
  if (typeof value === "string")
    return fits(value, max) ? scrub(value) : undefined;
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string" && fits(item, max))
      .map((item) => scrub(item));
  }
  return undefined;
}

function cleanText(value, scrub, max) {
  const text =
    typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== "string" || !fits(text, max)) return undefined;
  return scrub(text);
}

// A date a model wrote is kept only when it is a real calendar date in a
// plausible range and is not a birth date the app knows in any source, in any
// format or reading (a birth date filed under a service date).
function cleanDate(value, { known, birthDates }) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!DATE_SHAPE.test(text)) return undefined;
  const keys = dateKeys(text).filter((key) => isPlausibleDateKey(key));
  if (keys.length === 0) return undefined;
  if (dateKeys(text).some((key) => birthDates.has(key))) return undefined;
  return redactKnownValues(text, known) === text ? text : undefined;
}

function cleanCount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 && value <= MAX_COUNT
      ? value
      : undefined;
  }
  return typeof value === "string" && COUNT_SHAPE.test(value.trim())
    ? value.trim()
    : undefined;
}

function cleanFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const text = value.trim().toLowerCase();
  if (text === "true") return true;
  return text === "false" ? false : undefined;
}

function cleanServiceTime(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const out = {};
  for (const part of ["years", "months", "days"]) {
    const count = cleanCount(value[part]);
    if (count !== undefined) out[part] = count;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function cleanStringList(value, scrub) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string" && fits(item, MAX_TEXT_CHARS))
    .map((item) => scrub(item));
}

// A source document is a file name, which can carry the veteran's own name.
function cleanAward(award, { scrubProse, scrubShort }) {
  if (!award || typeof award !== "object" || Array.isArray(award)) {
    return undefined;
  }
  const out = {};
  for (const key of ["name", "abbreviation"]) {
    const text = cleanText(award[key], scrubShort, MAX_TEXT_CHARS);
    if (text !== undefined) out[key] = text;
  }
  const source = cleanText(award.sourceDocument, scrubProse, MAX_TEXT_CHARS);
  if (source !== undefined) out.sourceDocument = redactFileNames(source);
  if (Array.isArray(award.devices)) {
    out.devices = cleanStringList(award.devices, scrubShort);
  }
  const deviceCount = cleanCount(award.deviceCount);
  if (deviceCount !== undefined) out.deviceCount = deviceCount;
  const isCombat = cleanFlag(award.isCombat);
  if (isCombat !== undefined) out.isCombat = isCombat;
  return out.name ? out : undefined;
}

// The merge with the local parser pushes into combatService.indicators, so
// both lists always exist.
function cleanCombatService(value, scrub) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const out = {};
  const verified = cleanFlag(value.hasVerifiedCombat);
  if (verified !== undefined) out.hasVerifiedCombat = verified;
  out.indicators = cleanStringList(value.indicators, scrub);
  out.deployments = cleanStringList(value.deployments, scrub);
  return out;
}

// A list or code field keeps a value only when nothing in it is an identifier
// shape (SSN, file number, address, phone) or a known identifier: the shape
// check narrows what the field may hold, this check is the second lock.
function cleanEnumerated(key, value, { known, birthDates }) {
  if (key === "documentTypes") return cleanDocumentTypes(value);
  const asText =
    typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  const text = cleanEnumeratedField(key, asText);
  if (text === undefined) return undefined;
  const unchanged = (changed) => changed === text;
  return unchanged(redactKnownValues(text, known)) &&
    unchanged(redactBirthDates(text, birthDates)) &&
    unchanged(scrubText(text)) &&
    unchanged(removePersonAndPlaceShapes(text))
    ? text
    : undefined;
}

function cleanField(key, value, context) {
  const { scrub, scrubShort, scrubProse } = context;
  if (DATE_KEYS.has(key)) return cleanDate(value, context);
  if (ENUMERATED_KEYS.has(key)) return cleanEnumerated(key, value, context);
  if (COUNT_KEYS.has(key)) return cleanCount(value);
  if (FLAG_KEYS.has(key)) return cleanFlag(value);
  if (SERVICE_TIME_KEYS.has(key)) return cleanServiceTime(value);
  if (FREE_TEXT_FIELDS.includes(key)) {
    return cleanTextOrList(value, scrubProse);
  }
  if (TEXT_OR_LIST_KEYS.has(key)) {
    return cleanTextOrList(value, scrubShort, MAX_TEXT_CHARS);
  }
  if (key === "awards") {
    if (!Array.isArray(value)) return undefined;
    return value.map((award) => cleanAward(award, context)).filter(Boolean);
  }
  if (key === "combatService") return cleanCombatService(value, scrubShort);
  return cleanText(
    value,
    PROSE_KEYS.has(key) ? scrubProse : scrub,
    MAX_TEXT_CHARS,
  );
}

/**
 * Check every key a model returned against the type that key allows and scrub
 * every string in it, in place. A value of the wrong type is dropped, never
 * coerced into something that could carry text. `sources` are the same
 * known-identifier objects scrubModelFreeText takes.
 */
export function sanitizeModelOutput(data, sources = []) {
  const context = makeScrubber(sources);
  for (const key of Object.keys(data)) {
    const cleaned = cleanField(key, data[key], context);
    if (cleaned === undefined) delete data[key];
    else data[key] = cleaned;
  }
  return data;
}
