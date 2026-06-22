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
const FENCE_TAG = /<\s*\/?\s*untrusted_content\s*>/gi;
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
  mrnLabeled: /\bmedical\s+record\s+(?:#|no\.?|number)?\s*:?\s*\d{6,12}\b/gi,

  // Email — RFC-5322-lite. Runs late because /-chars don't overlap with the
  // numeric patterns above.
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,

  // Dates of birth — labeled or unlabeled numeric. Aggressive only.
  dobLabeled:
    /\b(?:DOB|D\.O\.B\.|date\s+of\s+birth|born(?:\s+on)?)\s*:?\s*(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})\b/gi,
  dob: [
    /\b(0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])[/-](\d{2}|\d{4})\b/g, // MM/DD/YYYY
    /\b(0[1-9]|[12]\d|3[01])[/-](0[1-9]|1[0-2])[/-](\d{2}|\d{4})\b/g, // DD/MM/YYYY
  ],

  // Street addresses — US format. Aggressive only.
  address:
    /\b\d+\s+[A-Za-z0-9\s]+\b(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Court|Ct\.?|Circle|Cir\.?|Way|Plaza|Place|Pl\.?)\b/gi,

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

  return {
    hasPII: piiFound,
    types,
    score,
    riskLevel:
      score === 0 ? "none" : score < 5 ? "low" : score < 10 ? "medium" : "high",
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

export default {
  scrubPII,
  scrubText,
  containsPII,
  analyzePII,
  scrubAndSpotlight,
  spotlight,
};
