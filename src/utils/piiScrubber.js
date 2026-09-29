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
  // Standalone 8–9 digit IDs go through `vaFileStandalone` in aggressive mode.
  vaFile: /\bC[-\s]?\d{8,9}\b/gi,
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

  // Street addresses — US format. Aggressive only.
  // Security review note: same as dobLabeled above — high complexity (41 vs
  // 20) on a PII-detection pattern, deserves dedicated fixture-based review
  // rather than a rushed rewrite. The [A-Za-z0-9\s] duplicate (redundant
  // under the /i flag) is left as-is for the same reason: even that "trivial"
  // change touches the address-body match width.
  address:
    // eslint-disable-next-line sonarjs/regex-complexity, sonarjs/duplicates-in-character-class -- flagged on alternation count (the street-suffix list) and the redundant A-Za-z under /i, not on backtracking; bounding below (S8786) addressed separately
    /\b\d{1,6}\s{1,5}[A-Za-z0-9\s]{1,100}\b(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Court|Ct\.?|Circle|Cir\.?|Way|Plaza|Place|Pl\.?)\b/gi,

  // PO Box — aggressive only.
  poBox: /\bP\.?\s*O\.?\s*Box\s+\d+\b/gi,
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
 *   file numbers, DOB, addresses, PO Boxes.
 * @param {boolean} [options.preservePartial=false] keep last 4 digits of
 *   SSN / phone for human-readable debugging.
 * @param {Array<{pattern: RegExp, label: string}>} [options.customPatterns]
 * @returns {{scrubbedText: string, piiFound: boolean, details: Array<{type: string, count: number}>, originalLength: number, scrubbedLength: number}}
 */
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

  // 9. Address (aggressive only — high false-positive rate on street-named
  //    proper nouns).
  if (aggressive) {
    applyPattern(PII_PATTERNS.address, "Address", "[REDACTED_ADDRESS]");
    applyPattern(PII_PATTERNS.poBox, "Address", "[REDACTED_ADDRESS]");
  }

  // 10. Custom patterns last (project-specific overrides).
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

const WORD_CHAR = /[\p{L}\p{N}_]/u;

// JS `\b` is ASCII-only - even with the `u` flag - so a value that starts
// or ends on a Unicode letter outside Basic Latin (José, Zoë, Ångström)
// can never satisfy it and silently fails to match instead of being
// redacted. These lookarounds test \p{L}/\p{N} directly (the constructed
// RegExp is built with the "u" flag below) so a boundary is recognized on
// ANY Unicode letter. Only assert the boundary on the side that actually
// borders a word character - a known value legitimately starting/ending on
// punctuation (an address line ending in a comma, say) must still match.
const _leadBoundary = (char) =>
  WORD_CHAR.test(char) ? "(?<![\\p{L}\\p{N}_])" : "";
const _tailBoundary = (char) =>
  WORD_CHAR.test(char) ? "(?![\\p{L}\\p{N}_])" : "";

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

/**
 * Redact every occurrence of each known value from `text`.
 * @param {string} text
 * @param {Array<string|{value: string, context?: RegExp}>} knownValues
 *   A bare string is redacted unconditionally, word-bounded. An entry with
 *   `context` (e.g. /ssn|social\s*security/i) is only redacted when that
 *   pattern appears within the preceding ~40 characters on the same line -
 *   for values (like a bare last-4 digit run) too generic to redact on
 *   their own.
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
    const raw = typeof entry === "string" ? entry : entry?.value;
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length < 2) continue;

    const pattern = _valuePattern(value);
    const lead = _leadBoundary(value[0]);
    const tail = _tailBoundary(value[value.length - 1]);
    const context = typeof entry === "object" ? entry.context : null;

    if (context) {
      const gated = new RegExp(
        `(${context.source})([^\\n]{0,40}?)(${lead}${pattern}${tail})`,
        "giu",
      );
      out = out.replace(gated, (_m, ctx, gap) => `${ctx}${gap}${replacement}`);
    } else {
      const re = new RegExp(`${lead}${pattern}${tail}`, "giu");
      out = out.replace(re, replacement);
    }
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
    if (_isRedactableNameToken(token)) values.push({ value: token });
    // A hyphenated compound name ("Mary-Kate") is one token, but free text
    // may use only one half of it ("Mary reports...").
    if (token.includes("-")) {
      token
        .split("-")
        .filter(_isRedactableNameToken)
        .forEach((part) => values.push({ value: part }));
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
};
