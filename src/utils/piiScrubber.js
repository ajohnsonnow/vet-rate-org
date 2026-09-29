/**
 * PII Scrubber — Client-Side Privacy Firewall
 *
 * Removes personally identifiable information before data leaves the browser
 * (e.g., before being interpolated into an LLM prompt or fed to a model that
 * may emit text to the DOM). Runs 100% locally — nothing is sent to any
 * server for analysis.
 *
 * Veteran-specific PII categories handled in addition to standard:
 *   - VA file number (legacy "C" file numbers + 8–9 digit standalones)
 *   - EDIPI / DOD ID (10 digits)
 *   - MRN (medical record number)
 *
 * Hardening notes:
 *   - Pattern application is ordered longest-first so the SSN 9-digit
 *     catchall can't consume VA files / phones / EDIPIs.
 *   - `containsPII` / `analyzePII` reset `lastIndex` before each `.test()`
 *     call (the /g flag makes `.test()` stateful — a known JS gotcha that
 *     caused intermittent false negatives).
 *   - `scrubAndSpotlight()` is the prompt-assembly path: it scrubs PII and
 *     wraps the result in `<untrusted_content>…</untrusted_content>` so
 *     downstream LLM prompts can rely on the delimiter to treat the content
 *     as data, not instruction (lethal-trifecta defense).
 *   - Input is normalized before scanning (zero-width / soft-hyphen strip +
 *     NFKC) so unicode obfuscation — zero-width chars splitting a number,
 *     full-width digits, NBSP separators — can't slip PII past the ASCII
 *     regexes. See `normalizeForScan`.
 */

const SPOTLIGHT_OPEN = "<untrusted_content>";
const SPOTLIGHT_CLOSE = "</untrusted_content>";

// A-H02: a literal spotlight delimiter embedded in untrusted text (e.g. an OCR'd
// C-File page that contains "</untrusted_content>") would close the fence early
// and let the remaining bytes land in the instruction context. Neutralize any
// untrusted_content tag (any case/whitespace) before wrapping so it can no longer
// be parsed as a delimiter.
const FENCE_TAG = /<(?:\s*\/)?\s*untrusted_content\s*>/gi;
const neutralizeFence = (text) =>
  String(text ?? "").replace(FENCE_TAG, "[untrusted_content]");

// Pattern application order matters: longest / most-specific first so the
// less-specific catchalls don't consume tokens they shouldn't. Listed in the
// order `scrubPII` applies them.
const PII_PATTERNS = {
  // Credit cards — 16 digits with optional separators. Highest specificity.
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

  // Phone numbers (international + US formats). Run before SSN/EDIPI to
  // claim the 10-digit space.
  phone: [
    /\b\+\d{1,2}\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, // +1 (555) 123-4567
    /\(\d{3}\)\s?\d{3}[\s.-]?\d{4}\b/g, // (555) 123-4567
    /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, // 555-123-4567 / 555.123.4567 / 555 123 4567
  ],

  // EDIPI / DOD ID — exactly 10 digits, no separators. Runs before SSN.
  edipi: /\b\d{10}\b/g,

  // VA file numbers — "C" prefix with 8–9 digits is canonical legacy form.
  // D15-1c: OCR'd/typed file numbers commonly re-group the digits with
  // spaces or hyphens between EVERY digit ("C 12 345 678"), not just after
  // the "C" - `\d(?:[-\s]?\d){7,8}` allows an optional single separator
  // before each subsequent digit while still bounding the total digit count
  // to 8-9, so "C12345678" / "C-12345678" / "C 12 345 678" all match, but an
  // unrelated longer digit run (a phone number, a different ID) does not.
  // The negative lookahead excludes the one shape that isn't a re-grouped
  // file number at all: a 4-digit group immediately followed by another
  // separator+digits, which is what a date ("C 2019-03-15"), a year range
  // ("Medicare Part C 2023-2024") or a repeated dosage ("Vitamin C 1000
  // 1000 mg") looks like when "C" happens to precede it. A real re-grouped
  // file number's first group is 1-3 digits, never 4, so this doesn't
  // narrow the D15-1c case above.
  // Standalone 8–9 digit IDs go through `vaFileStandalone` in aggressive mode.
  vaFile: /\bC[-\s]?(?!\d{4}[-\s]\d{2,4}\b)\d(?:[-\s]?\d){7,8}\b/gi,
  vaFileStandalone: /\b\d{8,9}\b/g,

  // SSN — XXX-XX-XXXX is the canonical form. The bare 9-digit form is
  // only enabled in aggressive mode because it false-positives on VA file
  // numbers, claim IDs, etc. (which is exactly why `vaFile` runs first).
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  ssnBare: /\b\d{9}\b/g,

  // MRN — medical record number, labeled or numeric.
  mrn: /\bMRN[:\s#-]*\d{6,12}\b/gi,
  mrnLabeled:
    /\bmedical\s+record\s+(?:(?:#|no\.?|number)\s*)?(?::\s*)?\d{6,12}\b/gi,

  // Email — RFC-5322-lite. Runs late because /-chars don't overlap with the
  // numeric patterns above.
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,

  // Dates of birth — labeled or unlabeled numeric. Aggressive only.
  // Security review note: flagged for high regex complexity (51 vs 20) on a
  // PII-detection pattern; a same-session rewrite risks silently narrowing
  // what counts as a DOB (i.e. a PII leak). Deserves a dedicated pass with
  // fixture-based before/after matching, not a rushed simplification.
  dobLabeled:
    // eslint-disable-next-line sonarjs/regex-complexity -- flagged on alternation count (the 12 month names), not nesting; see docs/SONARQUBE.md S8786 note for the bounding rationale applied here
    /\b(?:DOB|D\.O\.B\.|date\s{1,5}of\s{1,5}birth|born(?:\s{1,5}on)?)\s{0,5}:?\s{0,5}(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]{0,10}\.?\s{1,5}\d{1,2},?\s{1,5}\d{2,4})\b/gi,
  dob: [
    /\b(0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])[/-](\d{2}|\d{4})\b/g, // MM/DD/YYYY
    /\b(0[1-9]|[12]\d|3[01])[/-](0[1-9]|1[0-2])[/-](\d{2}|\d{4})\b/g, // DD/MM/YYYY
  ],

  // Street addresses — US format. Redacted regardless of provider (owner
  // decision D / ADR-008 §2.6 - see `_applyAddressAndLabelRedaction`).
  // Security review note: same as dobLabeled above — high complexity (41 vs
  // 20) on a PII-detection pattern, deserves dedicated fixture-based review
  // rather than a rushed rewrite. The [A-Za-z0-9\s] duplicate (redundant
  // under the /i flag) is left as-is for the same reason: even that "trivial"
  // change touches the address-body match width.
  // D15-1a: an optional trailing APT/UNIT/SUITE/# sub-unit is appended as a
  // non-capturing group so "123 Main St, Apt 4B" / "123 Main St Unit 200"
  // redact as one block instead of leaving the sub-unit exposed after the
  // street line is replaced. The suffix list also covers Terrace/Parkway/
  // Highway/Trail/Loop/Pike/Route, which the original list omitted.
  address:
    // eslint-disable-next-line sonarjs/regex-complexity, sonarjs/duplicates-in-character-class -- flagged on alternation count (the street-suffix list) and the redundant A-Za-z under /i, not on backtracking; bounding below (S8786) addressed separately
    /\b\d{1,6}\s{1,5}[A-Za-z0-9\s]{1,100}\b(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Court|Ct\.?|Circle|Cir\.?|Way|Plaza|Place|Pl\.?|Terrace|Ter\.?|Parkway|Pkwy\.?|Highway|Hwy\.?|Trail|Trl\.?|Loop|Pike|Route|Rte\.?)\b(?:[,.]?\s{1,5}(?:APT|UNIT|SUITE|STE|#)\.?\s{0,5}[A-Za-z0-9-]{1,10})?/gi,

  // PO Box — redacted regardless of provider (see `address` above).
  poBox: /\bP\.?\s*O\.?\s*Box\s+\d+\b/gi,

  // D15-1a: military mailing addresses that use a PSC/CMR/UNIT + BOX line
  // instead of a street name ("PSC 1234 BOX 5678", "UNIT 1234 BOX 5678",
  // "CMR 450 BOX 123") - the plain `address` pattern above requires a
  // street suffix and never matches this shape.
  militaryBoxLine:
    /\b(?:PSC|CMR|UNIT)\s{1,3}\d{1,5}\s{1,3}BOX\s{1,3}\d{1,5}\b/gi,

  // D15-1a: the second line of a US mailing address block - "City, ST
  // 12345" or "City, ST 12345-6789", with or without the comma, and either
  // a 2-letter state/territory abbreviation or a spelled-out state name.
  // No /i flag: the abbreviation branch must match its EXACT case (real
  // addresses print it that way) so common lowercase words that happen to
  // collide with a state code ("in", "or", "va") can't false-positive; the
  // city-name class below spells out both cases instead of relying on /i.
  // The prefix classes use `[ \t]` (never `\n`) so a preceding sentence on
  // its OWN line can't be pulled into the match across a line break.
  cityStateZip:
    // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the 50-state alternation count, not backtracking; each branch is a fixed literal, no nested quantifiers.
    /\b[A-Za-z][A-Za-z \t.'-]{1,40},?[ \t]{1,3}(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|GU|VI|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\s{1,3}Hampshire|New\s{1,3}Jersey|New\s{1,3}Mexico|New\s{1,3}York|North\s{1,3}Carolina|North\s{1,3}Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\s{1,3}Island|South\s{1,3}Carolina|South\s{1,3}Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\s{1,3}Virginia|Wisconsin|Wyoming)\b\.?,?[ \t]{1,3}\d{5}(?:-\d{4})?\b/g,

  // D15-1a: military overseas mailing addresses (APO/FPO/DPO + AA/AE/AP +
  // ZIP), with or without a comma after either segment.
  apoFpoDpo:
    /\b(?:APO|FPO|DPO),?\s{1,3}(?:AA|AE|AP),?\s{1,3}\d{5}(?:-\d{4})?\b/gi,

  // D15-1a: a bare ZIP+4 not already caught as part of a city/state/zip
  // line above (e.g. a ZIP printed alone on its own line). Excludes an NDC
  // (National Drug Code) label's 5-4-2 grouping, which is byte-for-byte the
  // same shape as a ZIP+4 for its first two segments.
  zip4Bare: /(?<!ndc[ \t]{0,5})\b\d{5}-\d{4}\b(?!-\d)/gi,
};

/**
 * Reset a regex's lastIndex before a stateful operation. JavaScript's /g flag
 * makes `.test()` and `.exec()` stateful — calling them in a hot path (or in
 * a `.some()` predicate) can alternate true/false against the same input.
 * @param {RegExp} re
 * @returns {RegExp} the same regex with lastIndex reset
 */
const reset = (re) => {
  re.lastIndex = 0;
  return re;
};

// Zero-width and soft-hyphen characters an attacker can splice inside a number
// (e.g. "1<ZWSP>23-45-6789") to break the ASCII regexes without changing how
// the string renders. Stripped before scanning.
const INVISIBLE_CHARS = /[\u200B-\u200D\uFEFF\u2060\u00AD]/g;

/**
 * Normalize text before PII scanning so unicode obfuscation can't slip a number
 * past the ASCII-only patterns. Two O(n) passes: strip invisible separators,
 * then NFKC-fold (full-width digits → ASCII, NBSP → space, compatibility forms
 * decomposed). NFKC is identity on plain ASCII, so existing behavior is intact.
 * @param {string} text
 * @returns {string}
 */
const normalizeForScan = (text) =>
  text.replace(INVISIBLE_CHARS, "").normalize("NFKC");

// ============================================================
// LABEL-ANCHORED FIRST-MENTION PROTECTION (D15-1b, ADR-008 §4)
// ============================================================
//
// `redactKnownValues` below only catches an identifier the app has ALREADY
// seen (the veteran's own stored name/SSN/DOB/address) - a document's
// FIRST-EVER mention of one has nothing to compare against yet. Running a
// full NER model over every upload just to catch that first mention would
// be a much larger, slower, less predictable dependency than this app
// otherwise carries. Instead, these patterns are anchored to the SPECIFIC
// forms this app ingests - a DD-214/NGB-22's own printed box labels (the
// same BLOCK/BOX vocabulary `dd214FieldExtractor.js` already parses these
// fields with locally - see D15-1d) and a VA decision letter's addressee
// block + file/claim number line - and redact the VALUE after the label,
// keeping the label itself so a downstream local parser or reviewer can
// still see which field it was.
//
// Limits (documented, not silently assumed): a label this app doesn't
// specifically anchor for (a different form's own numbering, a heavily
// OCR-garbled label) still reaches the model on first mention. This is a
// structural limit of label anchoring, not a bug - see ADR-008 §4.

// A label's own trailing hint text - a "(Last, First, Middle)" /
// "(YYYYMMDD)" parenthetical, or a short suffix word like "NO." / "NUMBER"
// / "#" - absorbed as part of the LABEL (group 1) rather than left as
// something the value pattern could backtrack into claiming. Without this,
// a greedy-but-optional hint group and a "value must be >= 2 chars" value
// group compete: when the real value is on the NEXT line, the engine
// backtracks the hint out of the label so the value group can match the
// hint text itself instead, redacting "(Last, First, Middle)" and leaving
// the real name on the next line untouched.
const _LABEL_HINT =
  "(?:[ \\t]{0,10}\\([^)\\n]{0,60}\\))?(?:[ \\t]{0,10}(?:NO\\.?|NUMBER|#))?";

/**
 * Build a "label, then redact the rest of the line" pattern. Group 1 (the
 * label, plus any trailing hint text) is preserved by the caller's
 * replacer; group 2 (the value) is what gets redacted.
 * @param {string} labelAlternatives regex source for the label (no capture groups)
 * @param {Object} [opts]
 * @param {number} [opts.maxValueChars=80]
 * @param {boolean} [opts.numeric=false] restrict the value to an optional
 *   single leading letter (a "C" file-number prefix) plus digits/spaces/
 *   hyphens, so a label that's merely mentioned in prose ("your VA file
 *   number on your evidence...") doesn't have unrelated prose swept up as
 *   if it were the value.
 * @param {string} [opts.flags="gi"]
 * @returns {RegExp}
 */
function _labelValuePattern(labelAlternatives, opts = {}) {
  const { maxValueChars = 80, numeric = false, flags = "gi" } = opts;
  const value = numeric
    ? `(?:[A-Za-z][-\\s]?)?\\d[\\d\\s-]{1,${Math.max(maxValueChars - 1, 4)}}`
    : `[^\\n]{2,${maxValueChars}}`;
  return new RegExp(
    `((?:${labelAlternatives})${_LABEL_HINT}[:.]?[ \\t]{0,10})(${value})`,
    flags,
  );
}

/**
 * Same label matching as `_labelValuePattern`, but for the OCR'd
 * label-above-value layout: the label's line has nothing (or only
 * whitespace/hint text) after it, and the real value is the very next
 * line. Applying this BEFORE the same-line pattern means the same-line
 * pattern never gets a chance to backtrack into the label's own hint text.
 * @param {string} labelAlternatives
 * @param {Object} [opts]
 * @returns {RegExp}
 */
function _labelNextLinePattern(labelAlternatives, opts = {}) {
  const { maxValueChars = 80, flags = "gi" } = opts;
  return new RegExp(
    `((?:${labelAlternatives})${_LABEL_HINT}[:.]?[ \\t]{0,10})\\n([^\\n]{2,${maxValueChars}})`,
    flags,
  );
}

// DD-214/NGB-22 box labels for the fields ADR-008 treats as direct
// identifiers (name, SSN/service number, DOB, home of record, mailing/home
// address). Both forms print the same block VOCABULARY even where the box
// NUMBER differs across revisions (mailing address lands on Block 19 on
// some layouts, Block 30 on others - both are matched), and a sub-item
// letter can appear before or after the number's period ("7B." / "7.b").
//
// Each entry has a `broad` form (a "BLOCK N" / "BOX N" prefix, which
// disambiguates from ordinary prose regardless of case) and, where the form
// also prints a bare "N." prefix, a `strict` form: real box labels print in
// ALL CAPS, so requiring exact case for the bare-number form stops an
// ordinary numbered list item ("1. Name of the medication...") from
// colliding with the DD-214's own "1. NAME" box label.
const BOX_LABEL_DEFS = [
  {
    broad: "(?:BLOCK[ \\t]{0,10}1|BOX[ \\t]{0,10}1)[ \\t]{0,10}NAME",
    strict: "\\b1[A-Za-z]?[ \\t]{0,10}\\.[ \\t]{0,10}NAME",
  },
  {
    broad:
      "(?:BLOCK[ \\t]{0,10}3|BOX[ \\t]{0,10}3)[ \\t]{0,10}(?:SOCIAL[ \\t]{0,10}SECURITY(?:[ \\t]{0,10}NUMBER)?|S\\.?S\\.?N\\.?)",
    strict:
      "\\b3[A-Za-z]?[ \\t]{0,10}\\.[ \\t]{0,10}(?:SOCIAL[ \\t]{0,10}SECURITY(?:[ \\t]{0,10}NUMBER)?|S\\.?S\\.?N\\.?)",
    maxValueChars: 40,
    numeric: true,
  },
  {
    broad:
      "(?:BLOCK[ \\t]{0,10}5|BOX[ \\t]{0,10}5)[ \\t]{0,10}DATE[ \\t]{0,10}OF[ \\t]{0,10}BIRTH",
    strict:
      "\\b5[A-Za-z]?[ \\t]{0,10}\\.[ \\t]{0,10}DATE[ \\t]{0,10}OF[ \\t]{0,10}BIRTH",
    maxValueChars: 40,
  },
  {
    broad:
      "(?:BLOCK[ \\t]{0,10}7[ \\t]{0,10}[Bb]|BOX[ \\t]{0,10}7[ \\t]{0,10}[Bb])[ \\t]{0,10}HOME[ \\t]{0,10}OF[ \\t]{0,10}RECORD",
    strict:
      "\\b7[ \\t]{0,10}\\.?[ \\t]{0,10}[Bb]\\.?[ \\t]{0,10}HOME[ \\t]{0,10}OF[ \\t]{0,10}RECORD",
  },
  {
    broad:
      "(?:BLOCK[ \\t]{0,10}(?:19|30)|BOX[ \\t]{0,10}(?:19|30))[ \\t]{0,10}(?:MAILING|HOME)[ \\t]{0,10}ADDRESS",
    strict:
      "\\b(?:19|30)[A-Za-z]?[ \\t]{0,10}\\.[ \\t]{0,10}(?:MAILING|HOME)[ \\t]{0,10}ADDRESS",
  },
  {
    // VA decision-letter file/claim number line - not a DD-214 box, no bare
    // numbered-box form, but the same "redact the value, keep the label"
    // treatment applies. `\b` before FILE/CLAIM stops "PROFILE NO." or
    // "file now"/"file notice of disagreement" from matching (no word
    // boundary exists between the "O"/"E" that precedes "FILE" there and
    // the label itself), and `\b` after NO/NUMBER stops "file no" from
    // continuing to match into "file now".
    broad:
      "(?:VA[ \\t]{0,10})?\\b(?:FILE[ \\t]{0,10}NO\\.?\\b|FILE[ \\t]{0,10}NUMBER\\b|CLAIM[ \\t]{0,10}NUMBER\\b)",
    strict: null,
    maxValueChars: 40,
    numeric: true,
  },
];

const LABELED_BOX_PATTERNS = BOX_LABEL_DEFS.flatMap((def) => {
  const opts = { maxValueChars: def.maxValueChars, numeric: def.numeric };
  const patterns = [
    _labelNextLinePattern(def.broad, opts),
    _labelValuePattern(def.broad, opts),
  ];
  if (def.strict) {
    const strictOpts = { ...opts, flags: "g" };
    patterns.push(
      _labelNextLinePattern(def.strict, strictOpts),
      _labelValuePattern(def.strict, strictOpts),
    );
  }
  return patterns;
});

/**
 * Redact the value following any recognized DD-214/NGB-22 box label or VA
 * file/claim-number label, keeping the label itself intact. Each label's
 * "value is on the next OCR line" pattern runs before its "value is on the
 * same line" pattern, so the same-line pattern only ever sees text the
 * next-line pattern already decided wasn't its concern.
 * @param {string} text
 * @returns {string}
 */
export const redactLabeledBoxValues = (text) => {
  if (!text || typeof text !== "string") return text;
  let out = text;
  for (const pattern of LABELED_BOX_PATTERNS) {
    out = out.replace(reset(pattern), (_match, label) => `${label}[REDACTED]`);
  }
  return out;
};

// A VA decision letter's date line ("March 15, 2024" or "3/15/2024") sits
// directly above the addressee block; "Dear ..." (or an equivalent
// salutation) sits directly below it. Redacting everything between the LAST
// such date before a given salutation and that salutation catches the
// veteran's name/address block without needing to parse each line. Global
// so a document with several concatenated letters (a C-File chunk, a
// Muster Call segment) has every letter's block - not just the first -
// redacted.
// prettier-ignore
// eslint-disable-next-line sonarjs/regex-complexity -- every quantifier is explicitly bounded ({0,10}/{1,5}/{3,10}); flagged on branch count from the two date shapes, not on backtracking
const LETTER_DATE_LINE = /^[ \t]{0,10}(?:[A-Za-z]{3,10}\.?[ \t]{1,5}\d{1,2},?[ \t]{1,5}\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})[ \t]{0,10}$/gm;
const IN_REPLY_REFER_TO =
  /In[ \t]{1,5}Reply[ \t]{1,5}Refer[ \t]{1,5}To\b[^\n]*/gi;
// prettier-ignore
// eslint-disable-next-line sonarjs/regex-complexity -- every quantifier is explicitly bounded ({0,10}/{0,60}/{1,5}); flagged on branch count from the two salutation shapes, not on backtracking
const SALUTATION_LINE = /^[ \t]{0,10}(Dear\b[^\n]{0,60}|To[ \t]{1,5}Whom[ \t]{1,5}It[ \t]{1,5}May[ \t]{1,5}Concern)[:,]?[ \t]{0,10}$/gim;
// Only redact the salutation when it's addressed to an actual person - a
// courtesy title ("Mr."/"Ms."/"Mrs."/"Miss"/"Dr."/"Mx.") followed by a
// name - never a generic/templated greeting ("Dear Veteran:", "Dear Sir or
// Madam:", "Dear Applicant:") that carries no identifying text at all.
const SALUTATION_NAME =
  /^([ \t]{0,10}Dear[ \t]{1,5}(?:Mr|Mrs|Ms|Miss|Dr|Mx)\.?[ \t]{1,5})([^\n:,]{1,60})/i;

// Find the end index of the last date-line (or "In Reply Refer To" line)
// anchor inside `text.slice(searchStart, searchEnd)` - the region between
// the previous letter's salutation (or the start of the document) and the
// current one. Returns -1 if no anchor is found in that region.
function _findAnchorEnd(text, searchStart, searchEnd) {
  const region = text.slice(searchStart, searchEnd);
  const dateMatches = [...region.matchAll(LETTER_DATE_LINE)];
  if (dateMatches.length > 0) {
    const last = dateMatches[dateMatches.length - 1];
    return searchStart + last.index + last[0].length;
  }
  const referMatches = [...region.matchAll(IN_REPLY_REFER_TO)];
  if (referMatches.length > 0) {
    const last = referMatches[referMatches.length - 1];
    return searchStart + last.index + last[0].length;
  }
  return -1;
}

// Guard against a mis-anchored date far from the real letterhead pulling in
// an implausibly large span - returned unchanged (safe no-op) rather than
// redacting a huge chunk of legitimate content.
function _redactAddresseeSpan(text, start, end) {
  const block = text.slice(start, end);
  if (block.length > 400) return block;
  return block.replace(/[^\n]{2,}/g, (line) =>
    line.trim() ? "[REDACTED]" : line,
  );
}

/**
 * Redact every VA letter's addressee block in `text` - the lines between
 * each letter's date (or "In Reply Refer To" line) and its salutation -
 * without needing to identify which line is the name vs. the street vs.
 * the city/state/ZIP, and redact the surname carried in a "Dear Mr./Ms.
 * <Surname>:" salutation line itself. Handles multiple concatenated
 * letters: each salutation only claims the anchor found after the
 * PREVIOUS letter's salutation, so letter 2's date can't be mistaken for
 * letter 1's and vice versa. A letter with no anchor found in its own
 * region is left alone (safe no-op) rather than guessing.
 * @param {string} text
 * @returns {string}
 */
export const redactLetterAddresseeBlock = (text) => {
  if (!text || typeof text !== "string") return text;

  const salutations = [...text.matchAll(SALUTATION_LINE)];
  if (salutations.length === 0) return text;

  let out = "";
  let cursor = 0;
  let prevSalutationEnd = 0;

  for (const salutation of salutations) {
    const salStart = salutation.index;
    const salEnd = salStart + salutation[0].length;
    const anchorEnd = _findAnchorEnd(text, prevSalutationEnd, salStart);

    if (anchorEnd >= 0) {
      out += text.slice(cursor, anchorEnd);
      out += _redactAddresseeSpan(text, anchorEnd, salStart);
      cursor = salStart;
    }

    const nameMatch = SALUTATION_NAME.exec(salutation[0]);
    if (nameMatch) {
      const [, greeting, name] = nameMatch;
      out += text.slice(cursor, salStart) + greeting + "[REDACTED]";
      cursor = salStart + greeting.length + name.length;
    }

    prevSalutationEnd = salEnd;
  }

  out += text.slice(cursor);
  return out;
};

function _countMatches(text, pattern) {
  const matches = text.match(reset(pattern));
  return matches ? matches.length : 0;
}

// Steps 9-10 of scrubPII below: D15-1b's always-on label/letter-anchored
// protection, plus the full US address block (D15-1a). Extracted so
// scrubPII itself stays under the line-count limit - these steps don't need
// scrubPII's piiFound/details closure, they just report what they touched
// and let the caller merge it in.
//
// Order matters: the letter-addressee and labeled-box passes run FIRST,
// while the date-line/salutation anchors they depend on are still intact.
// The address-block patterns below (a street/PO-Box/city-state-zip run)
// would otherwise be free to consume a date line that sits right next to an
// addressee block, destroying the anchor before `redactLetterAddresseeBlock`
// ever gets to look for it. Running address-block patterns afterward is
// still safe/idempotent against whatever the first two passes already
// turned into `[REDACTED]`.
function _applyAddressAndLabelRedaction(text) {
  let scrubbed = text;
  const hits = [];

  const beforeAddressee = scrubbed;
  scrubbed = redactLetterAddresseeBlock(scrubbed);
  if (scrubbed !== beforeAddressee) {
    hits.push({ type: "Letter Addressee Block", count: 1 });
  }

  const beforeLabeled = scrubbed;
  scrubbed = redactLabeledBoxValues(scrubbed);
  if (scrubbed !== beforeLabeled) {
    hits.push({ type: "Labeled Identifier", count: 1 });
  }

  // D15-1a / ADR-008 §2.6 (owner decision D): the address block is redacted
  // regardless of provider - unlike the DOB/SSN/VA-file bare-digit
  // catchalls in scrubPII below, which stay aggressive-only because they'd
  // otherwise strip legitimate service/exam/treatment dates an on-device
  // C-File analysis depends on. The address patterns require a street
  // suffix, PO Box, city/state/ZIP shape, or military box line - none of
  // which collide with a bare date.
  [
    PII_PATTERNS.address,
    PII_PATTERNS.poBox,
    PII_PATTERNS.militaryBoxLine,
    PII_PATTERNS.cityStateZip,
    PII_PATTERNS.apoFpoDpo,
    PII_PATTERNS.zip4Bare,
  ].forEach((pattern) => {
    const count = _countMatches(scrubbed, pattern);
    if (count === 0) return;
    hits.push({ type: "Address", count });
    scrubbed = scrubbed.replace(reset(pattern), "[REDACTED_ADDRESS]");
  });

  return { scrubbed, hits };
}

/**
 * RT3-4: detect text dominated by non-Latin scripts (Cyrillic, Arabic, Devanagari,
 * Japanese kana, CJK, Hangul). The PII_PATTERNS are US/English-centric
 * (SSN/phone/email/VA-file), so they cannot reliably redact PII inside non-Latin
 * narratives. Latin-script locales (Spanish, Tagalog, Vietnamese) are intentionally
 * NOT flagged — their PII largely matches the existing patterns. Callers use this to
 * apply conservative handling (warn / prefer local AI) on the cloud egress path
 * rather than over-redacting, which would corrupt the analysis.
 * @param {string} text
 * @returns {boolean}
 */
export const containsSignificantNonLatin = (text) => {
  if (!text || typeof text !== "string") return false;
  let nonLatin = 0;
  let meaningful = 0;
  for (const ch of text) {
    if (ch.trim()) meaningful += 1;
    const c = ch.codePointAt(0);
    if (
      (c >= 0x0400 && c <= 0x04ff) || // Cyrillic
      (c >= 0x0600 && c <= 0x06ff) || // Arabic
      (c >= 0x0900 && c <= 0x097f) || // Devanagari
      (c >= 0x3040 && c <= 0x30ff) || // Hiragana + Katakana
      (c >= 0x3400 && c <= 0x9fff) || // CJK (Ext A + Unified)
      (c >= 0xac00 && c <= 0xd7af) // Hangul syllables
    ) {
      nonLatin += 1;
    }
  }
  if (nonLatin === 0) return false;
  return nonLatin >= 8 || nonLatin / (meaningful || 1) >= 0.15;
};

/**
 * Scrub PII from text.
 * @param {string} text
 * @param {Object} options
 * @param {boolean} [options.aggressive=false] also scrub bare SSN, bare VA
 *   file numbers, and bare DOB. The address block (street/PO-Box/military-
 *   box-line/city-state-zip) is redacted regardless of this flag - see
 *   `_applyAddressAndLabelRedaction`.
 * @param {boolean} [options.preservePartial=false] keep last 4 digits of
 *   SSN / phone for human-readable debugging.
 * @param {Array<{pattern: RegExp, label: string}>} [options.customPatterns]
 * @returns {{scrubbedText: string, piiFound: boolean, details: Array<{type: string, count: number}>, originalLength: number, scrubbedLength: number}}
 */
// Steps 2-4 of scrubPII below (phone, MRN, EDIPI, VA file number) -
// extracted so scrubPII itself stays under the line-count limit. Takes the
// caller's `applyPattern` closure directly, so it still mutates scrubPII's
// own `scrubbed`/`piiFound`/`details` state exactly as if inlined.
function _applyPhoneMrnEdipiVaFile(applyPattern, aggressive, preservePartial) {
  // 2. Phones (10 digits with separators or international).
  PII_PATTERNS.phone.forEach((pattern) => {
    applyPattern(pattern, "Phone", (match) => {
      if (!preservePartial) return "[REDACTED_PHONE]";
      const digits = match.replace(/\D/g, "");
      return `XXX-XXX-${digits.slice(-4)}`;
    });
  });

  // 3. MRN labeled forms — run BEFORE EDIPI so "Medical Record Number: NNNN"
  //    keeps the MRN label even when the digits would otherwise match EDIPI.
  applyPattern(PII_PATTERNS.mrn, "MRN", "[REDACTED_MRN]");
  applyPattern(PII_PATTERNS.mrnLabeled, "MRN", "[REDACTED_MRN]");

  // 4. EDIPI (exactly 10 digits, no separator) — after phone + MRN.
  applyPattern(PII_PATTERNS.edipi, "EDIPI/DOD ID", "[REDACTED_DOD_ID]");

  // 4. VA file numbers — "C" prefix form always; bare 8–9 digit form only
  //    in aggressive mode.
  applyPattern(PII_PATTERNS.vaFile, "VA File", "[REDACTED_VAFILE]");
  if (aggressive) {
    applyPattern(PII_PATTERNS.vaFileStandalone, "VA File", "[REDACTED_VAFILE]");
  }
}

export const scrubPII = (text, options = {}) => {
  if (!text || typeof text !== "string") {
    return {
      scrubbedText: text,
      piiFound: false,
      details: [],
      originalLength: 0,
      scrubbedLength: 0,
    };
  }

  const {
    aggressive = false,
    preservePartial = false,
    customPatterns = [],
  } = options;

  let scrubbed = normalizeForScan(text);
  const details = [];
  let piiFound = false;

  const applyPattern = (pattern, type, replacer) => {
    const matches = scrubbed.match(reset(pattern));
    if (!matches) return;
    piiFound = true;
    details.push({ type, count: matches.length });
    scrubbed = scrubbed.replace(reset(pattern), replacer);
  };

  // 1. Credit cards (16 digits) — highest specificity.
  applyPattern(PII_PATTERNS.creditCard, "Credit Card", "[REDACTED_CC]");

  _applyPhoneMrnEdipiVaFile(applyPattern, aggressive, preservePartial);

  // 5. SSN — canonical form always; bare 9-digit form only in aggressive
  //    mode to avoid swallowing veteran-specific IDs already handled above.
  applyPattern(PII_PATTERNS.ssn, "SSN", (match) => {
    if (!preservePartial) return "[REDACTED_SSN]";
    const digits = match.replace(/\D/g, "");
    return `XXX-XX-${digits.slice(-4)}`;
  });
  if (aggressive) {
    applyPattern(PII_PATTERNS.ssnBare, "SSN", "[REDACTED_SSN]");
  }

  // 7. Email — late because @ doesn't overlap with the numeric patterns.
  applyPattern(PII_PATTERNS.email, "Email", (match) => {
    if (!preservePartial) return "[REDACTED_EMAIL]";
    const [user, domain] = match.split("@");
    return `${user[0]}***@${domain}`;
  });

  // 8. DOB — labeled form always, bare numeric only in aggressive mode.
  applyPattern(PII_PATTERNS.dobLabeled, "Date of Birth", "[REDACTED_DOB]");
  if (aggressive) {
    PII_PATTERNS.dob.forEach((pattern) => {
      applyPattern(pattern, "Date of Birth", "[REDACTED_DOB]");
    });
  }

  // 9-10. Always-on label/letter-anchored first-mention protection
  //       (D15-1b) plus the full US address block (D15-1a, also always-on
  //       per owner decision D / ADR-008 §2.6) — see
  //       _applyAddressAndLabelRedaction. The label-anchored patterns are
  //       anchored to a specific DD-214/NGB-22 box label or VA-letter
  //       structural landmark this app ingests, so they don't collide with
  //       the bare dates/numbers in free-form prose.
  const addressAndLabelResult = _applyAddressAndLabelRedaction(scrubbed);
  scrubbed = addressAndLabelResult.scrubbed;
  if (addressAndLabelResult.hits.length > 0) {
    piiFound = true;
    details.push(...addressAndLabelResult.hits);
  }

  // 11. Custom patterns last (project-specific overrides).
  customPatterns.forEach(({ pattern, label }) => {
    applyPattern(
      pattern,
      label || "Custom",
      `[REDACTED_${(label || "INFO").toUpperCase()}]`,
    );
  });

  return {
    scrubbedText: scrubbed,
    piiFound,
    details,
    originalLength: text.length,
    scrubbedLength: scrubbed.length,
  };
};

/**
 * Egress-boundary helper: scrub PII and return ONLY the redacted string.
 * Forces `aggressive` so bare 9-digit SSNs / VA file numbers, DOB, and
 * addresses are redacted before any third-party send. Use this — never the
 * raw object-returning `scrubPII` — when building an outbound payload, so a
 * field can never receive the `{ scrubbedText, originalLength, … }` object
 * (which would both leak the original length and ship `[object Object]`).
 * @param {string} text
 * @param {Object} [options] forwarded to `scrubPII`; `aggressive` is always on.
 * @returns {string} the scrubbed text
 */
export const scrubText = (text, options = {}) =>
  scrubPII(text, { ...options, aggressive: true }).scrubbedText;

/**
 * Quick boolean check — does this text contain any PII?
 * @param {string} text
 * @returns {boolean}
 */
export const containsPII = (text) => {
  if (!text || typeof text !== "string") return false;
  const result = scrubPII(text);
  return result.piiFound;
};

/**
 * Analyze text for PII without modifying it.
 * @param {string} text
 * @returns {{hasPII: boolean, types: string[], score: number, riskLevel: 'none'|'low'|'medium'|'high'}}
 */
export const analyzePII = (text) => {
  if (!text || typeof text !== "string") {
    return { hasPII: false, types: [], score: 0, riskLevel: "none" };
  }

  // Run the full scrubber (in non-aggressive mode) to get an authoritative
  // detail set, then map types to risk scores. This avoids the /g `.test()`
  // statefulness pitfall entirely by going through the same code path as
  // scrubPII.
  const { piiFound, details } = scrubPII(text);

  const SCORES = {
    SSN: 10,
    "Credit Card": 10,
    "VA File": 9,
    "EDIPI/DOD ID": 8,
    MRN: 8,
    Phone: 5,
    Email: 3,
    "Date of Birth": 4,
    Address: 4,
  };

  const types = [...new Set(details.map((d) => d.type))];
  const score = types.reduce((sum, t) => sum + (SCORES[t] || 1), 0);

  let riskLevel;
  if (score === 0) {
    riskLevel = "none";
  } else if (score < 5) {
    riskLevel = "low";
  } else if (score < 10) {
    riskLevel = "medium";
  } else {
    riskLevel = "high";
  }

  return {
    hasPII: piiFound,
    types,
    score,
    riskLevel,
  };
};

/**
 * Scrub PII and wrap the result in spotlight delimiters for safe LLM
 * prompt interpolation. The delimiters tell the model to treat the content
 * as data, never as instructions — the core lethal-trifecta defense.
 *
 * Use this on any text from outside the trusted prompt boundary: OCR
 * output, PDF text, user-pasted content, web-scraped legal sources,
 * past-claim documents.
 *
 * @param {string} text
 * @param {Object} [options] forwarded to `scrubPII`
 * @returns {{scrubbedText: string, piiFound: boolean, details: Array, originalLength: number, scrubbedLength: number, spotlit: string}}
 */
export const scrubAndSpotlight = (text, options = {}) => {
  const result = scrubPII(text, options);
  const spotlit = `${SPOTLIGHT_OPEN}\n${neutralizeFence(result.scrubbedText)}\n${SPOTLIGHT_CLOSE}`;
  return { ...result, spotlit };
};

/**
 * Lower-level: wrap an already-scrubbed string in spotlight delimiters.
 * @param {string} text
 * @returns {string}
 */
export const spotlight = (text) =>
  `${SPOTLIGHT_OPEN}\n${neutralizeFence(text)}\n${SPOTLIGHT_CLOSE}`;

// ============================================================
// KNOWN-VALUE REDACTION (owner decision D, 2026-09-28 / ADR-008)
// ============================================================
//
// scrubPII above is pattern-only: it can find "something shaped like an
// SSN" but has no way to find "this veteran's own name" - a bare name has
// no detectable shape, only a KNOWN VALUE. redactKnownValues replaces
// exact known values (the veteran's own profile/VKB identifiers) instead
// of guessing at a pattern, so it catches what scrubPII structurally
// cannot: a bare name, an ISO-format DOB ("1984-03-15", which none of the
// dob patterns above match), a claim/file number in unlabeled prose, or a
// non-standard address line.

// Underscore is deliberately EXCLUDED from this word-char set (unlike JS's
// own ASCII `\b`, which treats `_` as a word character). A VA-export
// filename joins its tokens with underscores ("Faketon_Jordan_VAFile-
// 6789_DD214.pdf"), so treating `_` as word-continuing would mean a known
// name/number value directly adjacent to one could never satisfy the
// boundary check below and would silently pass through this backstop.
const WORD_CHAR = /[\p{L}\p{N}]/u;

// JS `\b` is ASCII-only - even with the `u` flag - so a value that starts
// or ends on a Unicode letter outside Basic Latin (José, Zoë, Ångström)
// can never satisfy it and silently fails to match instead of being
// redacted. These lookarounds test \p{L}/\p{N} directly (the constructed
// RegExp is built with the "u" flag below) so a boundary is recognized on
// ANY Unicode letter. Only assert the boundary on the side that actually
// borders a word character - a known value legitimately starting/ending on
// punctuation (an address line ending in a comma, say) must still match.
const _leadBoundary = (char) =>
  WORD_CHAR.test(char) ? "(?<![\\p{L}\\p{N}])" : "";
const _tailBoundary = (char) =>
  WORD_CHAR.test(char) ? "(?![\\p{L}\\p{N}])" : "";

const _escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Apostrophe variants (straight/curly/backtick) - "O'Brien" typed or OCR'd
// with one style must still match the same name in another style, or with
// the apostrophe dropped entirely ("OBrien").
const APOSTROPHE_SPLIT = /['‘’`]/;
const APOSTROPHE_CLASS = "['‘’`]?";

function _literalPattern(value) {
  return value
    .split(APOSTROPHE_SPLIT)
    .map(_escapeForRegex)
    .join(APOSTROPHE_CLASS);
}

// A known numeric identifier (SSN/file number/service number) is often
// re-typed or OCR'd with digit-grouping separators the stored value never
// had ("28 345 671" for a stored "28345671") - allow an optional space or
// hyphen between every digit instead of requiring an exact literal match.
function _digitSpacedPattern(value) {
  return [...value].map(_escapeForRegex).join("[\\s-]?");
}

function _valuePattern(value) {
  return /^\d+$/.test(value)
    ? _digitSpacedPattern(value)
    : _literalPattern(value);
}

// D15-1c: NFD-decompose then strip combining diacritical marks (U+0300-
// U+036F), so a stored "José" folds to "Jose" and matches an OCR'd/typed
// "Jose" in the text, and vice versa. Decomposition adds exactly one
// combining mark per precomposed accented letter and stripping removes
// exactly that mark, so for the overwhelming common case (one diacritic per
// character) this is LENGTH-PRESERVING - the folded string has the same
// number of UTF-16 code units as the original, so an index found in the
// folded copy still points at the same character range in the original.
const COMBINING_MARKS = /[̀-ͯ]/g;
const _foldAccents = (value) =>
  value.normalize("NFD").replace(COMBINING_MARKS, "");

// Fold `text` one Unicode code point at a time (rather than as a whole
// string) and track, for every character position IN the folded output,
// which ORIGINAL-string index produced it. Folding a single precomposed
// accented letter is length-preserving ("é" -> "e"), but folding text that
// ALREADY arrives NFD-decomposed (a combining mark as its own character,
// common from macOS/PDF copy-paste) is NOT - the mark disappears entirely,
// shortening that one character's contribution to 0. Building the map
// per-character means a length change ANYWHERE in the string - a
// decomposed input, an unrelated Hangul/CJK character elsewhere in the same
// prompt - no longer disables folding for the whole text, only ever affects
// the specific characters it actually changes.
function _buildFoldMap(text) {
  let folded = "";
  const foldedToOrig = [];
  let origIndex = 0;
  for (const ch of text) {
    const f = _foldAccents(ch);
    for (let i = 0; i < f.length; i += 1) foldedToOrig.push(origIndex);
    origIndex += ch.length;
    folded += f;
  }
  foldedToOrig.push(origIndex);
  return { folded, foldedToOrig };
}

/**
 * Accent-insensitive redaction for a single known value: fold both the
 * value and a working copy of `text` (per-character, via `_buildFoldMap`),
 * find match positions against the FOLDED copy, then map those positions
 * back to the ORIGINAL string's indices before slicing/replacing - so
 * accents/casing elsewhere in the string survive untouched and only the
 * matched span is ever replaced, regardless of whether folding changed the
 * text's overall length.
 * @param {string} text
 * @param {string} value
 * @param {string} lead lookbehind boundary source
 * @param {string} tail lookahead boundary source
 * @param {string} replacement
 * @returns {string}
 */
function _redactAccentFold(text, value, lead, tail, replacement) {
  const { folded: foldedText, foldedToOrig } = _buildFoldMap(text);

  const foldedValue = _foldAccents(value);
  const pattern = _valuePattern(foldedValue);
  const re = new RegExp(`${lead}${pattern}${tail}`, "giu");

  let out = "";
  let cursor = 0;
  let match = re.exec(foldedText);
  while (match) {
    const origStart = foldedToOrig[match.index];
    const origEnd = foldedToOrig[match.index + match[0].length];
    out += text.slice(cursor, origStart) + replacement;
    cursor = origEnd;
    if (match[0].length === 0) re.lastIndex += 1;
    match = re.exec(foldedText);
  }
  out += text.slice(cursor);
  return out;
}

// One known-value entry's redaction pass over the current working copy of
// the text - extracted out of redactKnownValues below to keep its own
// cognitive complexity down to "loop calls a function per entry".
function _redactEntry(out, entry, replacement) {
  const raw = typeof entry === "string" ? entry : entry?.value;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length < 2) return out;

  const pattern = _valuePattern(value);
  const lead = _leadBoundary(value[0]);
  const tail = _tailBoundary(value[value.length - 1]);
  const context = typeof entry === "object" ? entry.context : null;
  const accentFold = typeof entry === "object" && entry.accentFold;

  if (accentFold && !context) {
    return _redactAccentFold(out, value, lead, tail, replacement);
  }
  if (context) {
    const gated = new RegExp(
      `(${context.source})([^\\n]{0,40}?)(${lead}${pattern}${tail})`,
      "giu",
    );
    return out.replace(gated, (_m, ctx, gap) => `${ctx}${gap}${replacement}`);
  }
  const re = new RegExp(`${lead}${pattern}${tail}`, "giu");
  return out.replace(re, replacement);
}

/**
 * Redact every occurrence of each known value from `text`.
 * @param {string} text
 * @param {Array<string|{value: string, context?: RegExp, accentFold?: boolean}>} knownValues
 *   A bare string is redacted unconditionally, word-bounded. An entry with
 *   `context` (e.g. /ssn|social\s*security/i) is only redacted when that
 *   pattern appears within the preceding ~40 characters on the same line -
 *   for values (like a bare last-4 digit run) too generic to redact on
 *   their own. An entry with `accentFold: true` (name tokens) also matches
 *   an accent-differing variant of the same value - see `_redactAccentFold`.
 * @param {string} [replacement]
 * @returns {string}
 */
export const redactKnownValues = (
  text,
  knownValues,
  replacement = "[REDACTED]",
) => {
  if (!text || typeof text !== "string") return text;
  if (!Array.isArray(knownValues) || knownValues.length === 0) return text;

  let out = text;
  for (const entry of knownValues) {
    out = _redactEntry(out, entry, replacement);
  }
  return out;
};

const _nonEmptyString = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const DOB_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ISO ("YYYY-MM-DD", the VKB's own stored format) or US ("MM/DD/YYYY", how
// the legacy profile/VKB viewer can store a typed DOB) are both normalized
// into {y, mo, d} so every variant below is generated regardless of which
// format the veteran's DOB happens to be stored in - previously a
// non-ISO stored DOB got no variants at all, not even the ISO one.
function _parseDobParts(dob) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (iso) return { y: iso[1], mo: iso[2], d: iso[3] };
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dob);
  if (us) {
    return { y: us[3], mo: us[1].padStart(2, "0"), d: us[2].padStart(2, "0") };
  }
  return null;
}

// Military/service records overwhelmingly print DOB as "DD Mon YYYY" (e.g.
// "15 Mar 1984") or the compact "DDMonYY(YY)" form - neither is MM/DD/YYYY,
// so scrubPII's own dob patterns never catch them either.
function _dobVariants(dob) {
  const variants = [dob];
  const parts = _parseDobParts(dob);
  if (!parts) return variants;
  const { y, mo, d } = parts;
  const monthNum = Number(mo);
  const dayNum = Number(d);
  const yy = y.slice(-2);
  const monthName = DOB_MONTHS[monthNum - 1];

  variants.push(
    `${y}-${mo}-${d}`,
    `${mo}/${d}/${y}`,
    `${monthNum}/${dayNum}/${y}`,
  );
  variants.push(
    `${monthNum}/${dayNum}/${yy}`,
    `${mo}-${d}-${y}`,
    `${y}${mo}${d}`,
  );
  if (monthName) {
    const monthUpper = monthName.toUpperCase();
    variants.push(`${monthName} ${dayNum}, ${y}`);
    variants.push(`${dayNum} ${monthName} ${y}`); // military: "15 Mar 1984"
    variants.push(`${d}${monthUpper}${y}`, `${d}${monthUpper}${yy}`); // "15MAR1984" / "15MAR84"
  }
  return variants;
}

// Trailing punctuation stripper for a name token ("Smith," / "Jr.") - a
// hand-rolled loop instead of a trailing-punctuation regex, which
// sonarjs's super-linear-regex check flags regardless of the (here safe,
// two-char class) alphabet size.
function _stripTrailingPunctuation(token) {
  let end = token.length;
  while (end > 0 && (token[end - 1] === "." || token[end - 1] === ",")) {
    end -= 1;
  }
  return token.slice(0, end);
}

// Generational suffixes and short compound-surname particles that, as a
// BARE unconditional redaction target, collide with ordinary words and
// medical terms elsewhere in the same context ("de novo", "Jr ROTC", "Stage
// III chronic kidney disease", "Type II diabetes"). A veteran's own name
// still gets redacted via the OTHER tokens in it; only these specific short
// tokens are excluded from standing alone as a known value.
const NAME_TOKEN_STOPLIST = new Set([
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "jr",
  "sr",
  "de",
  "la",
  "le",
  "el",
  "da",
  "du",
  "al",
  "von",
  "van",
  "der",
  "den",
  "di",
]);

const MIN_BARE_NAME_TOKEN_LENGTH = 3;

function _isRedactableNameToken(token) {
  return (
    token.length >= MIN_BARE_NAME_TOKEN_LENGTH &&
    !NAME_TOKEN_STOPLIST.has(token.toLowerCase())
  );
}

// Falls back to the flat legacy profile's first/middle/last/suffix fields
// when no single fullName/name string is stored - the VKB personal shape
// and the legacy profile shape disagree on which one exists.
function _fullNameFromParts(personal) {
  const parts = [
    personal.firstName,
    personal.middleName || personal.middleInitial,
    personal.lastName,
    personal.suffix,
  ]
    .map(_nonEmptyString)
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function _nameTokenValues(personal) {
  const fullName =
    _nonEmptyString(personal.fullName) ||
    _nonEmptyString(personal.name) ||
    _fullNameFromParts(personal);
  if (!fullName) return [];

  const tokens = fullName
    .split(/\s+/)
    .map(_stripTrailingPunctuation)
    .filter(Boolean);

  const values = [];
  tokens.forEach((token) => {
    // D15-1c: accentFold so a stored "José" matches an OCR'd/typed "Jose"
    // in free text, and vice versa - see _redactAccentFold.
    if (_isRedactableNameToken(token)) {
      values.push({ value: token, accentFold: true });
    }
    // A hyphenated compound name ("Mary-Kate") is one token, but free text
    // may use only one half of it ("Mary reports...").
    if (token.includes("-")) {
      token
        .split("-")
        .filter(_isRedactableNameToken)
        .forEach((part) => values.push({ value: part, accentFold: true }));
    }
  });
  return values;
}

function _ssnValues(personal) {
  const values = [];
  const ssn =
    _nonEmptyString(personal.ssn) || _nonEmptyString(personal.ssnFull);
  const ssnLast4 = _nonEmptyString(personal.ssnLast4);
  const context = /ssn|ssan|social(?:\s*security)?/i;
  if (ssn) {
    const digits = ssn.replace(/\D/g, "");
    if (digits.length >= 9) {
      values.push({ value: digits });
      // A full SSN is known, but free text may only reference its last 4
      // ("SSN ending 6789") - that value was never collected before, so it
      // could never be redacted no matter how it was labeled.
      values.push({ value: digits.slice(-4), context });
    } else if (digits.length >= 4) {
      values.push({ value: digits, context });
    }
  }
  if (ssnLast4) values.push({ value: ssnLast4.replace(/\D/g, ""), context });
  return values;
}

function _fileNumberValues(personal) {
  const values = [];
  const fileNumber =
    _nonEmptyString(personal.veteranFileNumber) ||
    _nonEmptyString(personal.vaFileNumber);
  const context = /file\s*number|va\s*file|c-?file/i;
  if (!fileNumber) return values;
  const digits = fileNumber.replace(/\D/g, "");
  if (digits.length >= 8) values.push({ value: digits });
  else if (digits.length >= 4) values.push({ value: digits, context });
  if (digits.length > 4) values.push({ value: digits.slice(-4), context });
  return values;
}

// Service number - listed in decision (D) alongside SSN/file number, but
// never previously collected at all.
function _serviceNumberValues(personal) {
  const serviceNumber = _nonEmptyString(personal.serviceNumber);
  if (!serviceNumber) return [];
  const context = /service\s*(?:#|no\.?|number)/i;
  return serviceNumber.length >= 6
    ? [{ value: serviceNumber }]
    : [{ value: serviceNumber, context }];
}

function _contactValues(personal) {
  const values = [];
  const email = _nonEmptyString(personal.email);
  if (email) values.push({ value: email });
  [personal.phone, personal.alternatePhone, personal.intlPhone].forEach(
    (raw) => {
      const phone = _nonEmptyString(raw);
      if (!phone) return;
      values.push({ value: phone });
      const digits = phone.replace(/\D/g, "");
      if (digits.length >= 7) values.push({ value: digits });
    },
  );
  return values;
}

function _addressValues(personal) {
  const address = personal.address || {};
  const lines = [
    address.street,
    address.city,
    personal.street,
    personal.city,
    personal.mailingStreet,
    personal.mailingCity,
    address.zip,
    personal.zip,
    personal.mailingZip,
  ];
  return lines
    .map((line) => _nonEmptyString(line))
    .filter((line) => line && line.length >= 4)
    .map((value) => ({ value }));
}

/**
 * Collect the veteran's own known identifier values from a "personal"-shaped
 * object - either VKB's `.personal` (fullName/dateOfBirth/ssn/
 * veteranFileNumber/email/phone/address{street,city,...}) or the flat
 * legacy profile store (fullName/dob/ssn/ssnLast4/vaFileNumber/email/
 * phone/street/city/...). Aliases for both shapes are checked; whichever
 * keys are absent are simply skipped.
 * @param {Object} [personal]
 * @param {Array<string>} [claimNumbers]
 * @returns {Array<{value: string, context?: RegExp}>}
 */
export const collectKnownIdentifierValues = (
  personal = {},
  claimNumbers = [],
) => {
  const p = personal || {};
  const values = [
    ..._nameTokenValues(p),
    ..._ssnValues(p),
    ..._fileNumberValues(p),
    ..._serviceNumberValues(p),
    ..._contactValues(p),
    ..._addressValues(p),
  ];
  const dob = _nonEmptyString(p.dateOfBirth) || _nonEmptyString(p.dob);
  if (dob) _dobVariants(dob).forEach((value) => values.push({ value }));
  (claimNumbers || []).forEach((c) => {
    const value = _nonEmptyString(c);
    if (value) values.push({ value });
  });
  return values;
};

/**
 * ADR-008 single enforcement point: the one function every AI-context
 * builder in this codebase routes its final output through, so a future
 * builder that forgets to scrub free text still can't leak a direct
 * identifier - it just won't get anything past this backstop either.
 * @param {string} text
 * @param {Object} [personal]
 * @param {Array<string>} [claimNumbers]
 * @returns {string}
 */
export const redactVeteranIdentifiers = (text, personal, claimNumbers) =>
  redactKnownValues(text, collectKnownIdentifierValues(personal, claimNumbers));

export default {
  scrubPII,
  scrubText,
  containsPII,
  analyzePII,
  scrubAndSpotlight,
  spotlight,
  redactKnownValues,
  collectKnownIdentifierValues,
  redactVeteranIdentifiers,
  redactLabeledBoxValues,
  redactLetterAddresseeBlock,
};
