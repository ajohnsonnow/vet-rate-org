/**
 * Post-generation citation check. A model that states law from memory also
 * invents section numbers; this finds 38 CFR citations in an answer that are
 * not in the bundled list of sections (generated from the eCFR legal index
 * by scripts/verified-reference/build.mjs, for every part the index holds)
 * and says so under the answer. It never rewrites the answer.
 */

import sections from "../data/cfrSections.json";
import { extractCfrSections } from "./cfrCitations";

const CHECKED_PARTS = Object.keys(sections.parts);
const KNOWN_SECTIONS = new Set(Object.values(sections.parts).flat());

const partOf = (section) => section.slice(0, section.indexOf("."));

/**
 * The 38 CFR sections an answer cites that have no text: numbers that do not
 * exist and numbers that are reserved. Only the parts the bundled list covers
 * are checked; a citation to any other part is left alone.
 */
export function findUnverifiedCitations(text) {
  return extractCfrSections(text).filter(
    (section) =>
      CHECKED_PARTS.includes(partOf(section)) && !KNOWN_SECTIONS.has(section),
  );
}

function listSections(missing) {
  const [first, ...rest] = missing.map((section) => `§ ${section}`);
  if (rest.length === 0) return `38 CFR ${first}`;
  const last = rest.pop();
  return `38 CFR ${[first, ...rest].join(", ")} and ${last}`;
}

function listParts() {
  const parts = [...CHECKED_PARTS];
  const last = parts.pop();
  return parts.length > 0 ? `${parts.join(", ")} and ${last}` : last;
}

export function buildCitationNotice(missing) {
  const one = missing.length === 1;
  return `Vet-Rate could not verify ${one ? "a citation" : "citations"} in this answer: ${listSections(missing)} ${one ? "is" : "are"} missing or reserved, with no text, in its copy of 38 CFR Parts ${listParts()} (as of ${sections.source.retrieved}). Check ${one ? "that citation" : "those citations"} at ecfr.gov or with a Veterans Service Officer before relying on ${one ? "it" : "them"}.`;
}

const looksStructured = (text) => /^\s*(?:```|[{[])/.test(text);

/**
 * Append the notice to a prose answer that cites a section that does not
 * exist, and record it on the result (citationsUnverified, plus a
 * validationWarnings line). Structured output is returned untouched, because
 * a sentence appended to JSON would break the caller that parses it.
 */
export function flagUnverifiedCitations(result, options = {}) {
  const text = result?.text;
  if (typeof text !== "string" || text === "") return result;
  if (options.responseFormat || looksStructured(text)) return result;
  const missing = findUnverifiedCitations(text);
  if (missing.length === 0) return result;
  return {
    ...result,
    text: `${text.trimEnd()}\n\n${buildCitationNotice(missing)}`,
    validationWarnings: [
      ...(result.validationWarnings || []),
      `Answer cites 38 CFR sections that could not be verified: ${missing.join(", ")}`,
    ],
    citationsUnverified: { sections: missing },
  };
}
