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
  collectKnownIdentifierValues,
} from "./piiScrubber";

export const FREE_TEXT_FIELDS = [
  "extractionNotes",
  "narrativeReason",
  "memberRequests",
  "foreignServiceDetails",
];

// Fields whose text a model writes in its own words (or copies as a unit
// line), so a name the app has never seen can sit in them. They are never
// pre-ticked for import and are stored only when the veteran ticks them.
export const MODEL_TEXT_FIELDS = [
  ...FREE_TEXT_FIELDS,
  "lastDutyAssignment",
  "commandTransferredTo",
];

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

const makeScrubber = (sources) => {
  const known = knownValuesFrom(sources);
  return {
    known,
    scrub: (text) => scrubText(redactKnownValues(text, known)),
  };
};

/**
 * Scrub every model-written free-text field in place. `sources` are objects
 * holding values the app already knows are identifiers (the saved profile, the
 * identifiers read by the local parser); each one is redacted by value on top
 * of the pattern scrubber.
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
  "documentTypes",
  "militaryEducation",
  "specialQualifications",
]);

// ISO (what the prompt asks for), compact YYYYMMDD and US MM/DD/YYYY.
const DATE_SHAPE = /^(?:\d{4}-\d{2}-\d{2}|\d{8}|\d{1,2}\/\d{1,2}\/\d{4})$/;
const COUNT_SHAPE = /^\d{1,5}$/;
const MAX_COUNT = 99999;

function cleanTextOrList(value, scrub) {
  if (typeof value === "string") return scrub(value);
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string")
      .map((item) => scrub(item));
  }
  return undefined;
}

function cleanText(value, scrub) {
  if (typeof value === "string") return scrub(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    return scrub(String(value));
  }
  return undefined;
}

// A date a model wrote is kept only when it is date-shaped and is not one of
// the identifiers the app already knows (a birth date filed under a service
// date).
function cleanDate(value, known) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!DATE_SHAPE.test(text)) return undefined;
  return redactKnownValues(text, known) === text ? text : undefined;
}

function cleanCount(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 && value <= MAX_COUNT
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
    .filter((item) => typeof item === "string")
    .map((item) => scrub(item));
}

function cleanAward(award, scrub) {
  if (!award || typeof award !== "object" || Array.isArray(award)) {
    return undefined;
  }
  const out = {};
  for (const key of ["name", "abbreviation", "sourceDocument"]) {
    if (typeof award[key] === "string") out[key] = scrub(award[key]);
  }
  if (Array.isArray(award.devices)) {
    out.devices = cleanStringList(award.devices, scrub);
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

function cleanField(key, value, { known, scrub }) {
  if (DATE_KEYS.has(key)) return cleanDate(value, known);
  if (COUNT_KEYS.has(key)) return cleanCount(value);
  if (FLAG_KEYS.has(key)) return cleanFlag(value);
  if (SERVICE_TIME_KEYS.has(key)) return cleanServiceTime(value);
  if (TEXT_OR_LIST_KEYS.has(key)) return cleanTextOrList(value, scrub);
  if (key === "awards") {
    if (!Array.isArray(value)) return undefined;
    return value.map((award) => cleanAward(award, scrub)).filter(Boolean);
  }
  if (key === "combatService") return cleanCombatService(value, scrub);
  return cleanText(value, scrub);
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
