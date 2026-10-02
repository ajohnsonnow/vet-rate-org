/**
 * Guards applied to what an AI model returns for a DD-214 before it is shown
 * or saved (owner decision F, ADR-009 section 3).
 *
 * - A model that echoes the prompt's own placeholder text for any field has
 *   not read the document; that value is rejected, whatever the field.
 * - Free text a model writes (notes, narrative reason) can carry a name or an
 *   SSN-shaped string, so it goes through the PII scrubber plus known-value
 *   redaction. A model-written string is never trusted as written.
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

const SCALAR_LITERAL = /"(\w+)"\s*:\s*"([^"\n]+)"/g;
const ARRAY_LITERAL = /"(\w+)"\s*:\s*\[([^\]\n]*)\]/g;
const QUOTED = /"([^"\n]+)"/g;
// Arrays of descriptive placeholders; the other prompt arrays hold real
// example values ("Airborne", "Purple Heart") a document can legitimately
// contain.
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
]);
const DATE_TEMPLATE = /yyyy|mm-dd/i;
const MANY_ALTERNATIVES = /^[^|]{1,40}(?:\|[^|]{1,40}){2,}$/;

const normalize = (text) => text.trim().replace(/\s+/g, " ").toLowerCase();

function collectPromptPlaceholders(promptTexts) {
  const found = new Set();
  const add = (literal) => {
    if (TEMPLATE_SHAPE.test(literal)) found.add(normalize(literal));
  };
  for (const prompt of promptTexts) {
    for (const [, , literal] of prompt.matchAll(SCALAR_LITERAL)) add(literal);
    for (const [, key, body] of prompt.matchAll(ARRAY_LITERAL)) {
      if (!DESCRIPTIVE_ARRAY_KEYS.has(key)) continue;
      for (const [, literal] of body.matchAll(QUOTED)) add(literal);
    }
  }
  return found;
}

export function buildPlaceholderDetector(promptTexts) {
  const placeholders = collectPromptPlaceholders(promptTexts);

  const isPlaceholderEcho = (value, key = "") => {
    if (typeof value !== "string") return false;
    const text = normalize(value);
    if (text === "") return false;
    return (
      placeholders.has(text) ||
      BARE_ECHO_TOKENS.has(text) ||
      (key !== "" && text === normalize(key)) ||
      DATE_TEMPLATE.test(text) ||
      MANY_ALTERNATIVES.test(text)
    );
  };

  const clean = (value, key) => {
    if (typeof value === "string") {
      return isPlaceholderEcho(value, key) ? undefined : value;
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => clean(item, key))
        .filter((item) => item !== undefined);
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

/**
 * Scrub every model-written free-text field in place. `sources` are objects
 * holding values the app already knows are identifiers (the saved profile, the
 * identifiers read by the local parser); each one is redacted by value on top
 * of the pattern scrubber.
 */
export function scrubModelFreeText(data, sources = []) {
  const known = knownValuesFrom(sources);
  const scrub = (text) => scrubText(redactKnownValues(text, known));

  for (const key of FREE_TEXT_FIELDS) {
    if (!(key in data)) continue;
    const value = data[key];
    if (typeof value === "string") {
      data[key] = scrub(value);
    } else if (Array.isArray(value)) {
      data[key] = value
        .filter((item) => typeof item === "string")
        .map((item) => scrub(item));
    } else {
      delete data[key];
    }
  }
  return data;
}
