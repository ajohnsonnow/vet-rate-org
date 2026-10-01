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

// D16-6: Tesseract's most common label-text misread - a capital "O" comes
// back as a zero ("S0CIAL SECURITY", "H0ME 0F REC0RD", state code "0R"). Only
// applied to specific LABEL/state-code literals below (never to free-running
// prose), so a real "0" a document actually prints elsewhere is untouched -
// this only widens what counts as a match for these fixed, known words.
const _o0 = (word) => word.replace(/O/g, "[O0]");

// Shared 2-letter/spelled-out US state lists - built once and reused by both
// the with-ZIP `cityStateZip` variants and the labeled `stateLabeled` field,
// so "is this actually a state" is answered the same way in both places
// instead of two lists silently drifting apart.
const _STATE_ABBR_SRC = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
  "PR",
  "GU",
  "VI",
]
  .map(_o0)
  .join("|");
const _STATE_NAME_SRC = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New\\s{1,3}Hampshire",
  "New\\s{1,3}Jersey",
  "New\\s{1,3}Mexico",
  "New\\s{1,3}York",
  "North\\s{1,3}Carolina",
  "North\\s{1,3}Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode\\s{1,3}Island",
  "South\\s{1,3}Carolina",
  "South\\s{1,3}Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West\\s{1,3}Virginia",
  "Wisconsin",
  "Wyoming",
].join("|");

const _DOB_MONTH_SRC =
  "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]{0,10}\\.?";
const _DOB_DATE_SRC =
  "(?:" +
  "\\d{4}[/.-]\\d{1,2}[/.-]\\d{1,2}" +
  "|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}" +
  `|\\d{1,2}(?:st|nd|rd|th)?(?:\\s{1,5}of)?[\\s-]{0,5}${_DOB_MONTH_SRC},?[\\s-]{0,5}\\d{2,4}` +
  `|${_DOB_MONTH_SRC}\\s{1,5}\\d{1,2}(?:st|nd|rd|th)?,?\\s{1,5}\\d{2,4}` +
  "|\\d{8}" +
  ")";

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

  // D16-5/D16-6: OCR letter-for-digit substitution inside an SSN's 3-2-4
  // grouping ("l23-O5-678l" for "123-05-6781" - O/o for 0, I/l for 1, S/s
  // for 5, B/b for 8) with a comma/colon added to the separator set
  // (Tesseract sometimes reads a hyphen as either). Always on (not
  // aggressive-only): the grouping shape itself is the anchor, and the
  // replacer below (see scrubPII) additionally requires a majority of the
  // 9 characters to already be real digits before redacting, so it can't
  // sweep up a run of ordinary letters that merely happens to fall into
  // 3-2-4 chunks. Deliberately NOT widened to tolerate a stray space
  // *inside* a group (e.g. typewriter "1 2 3 - 4 5 - 6 7 8 9") - per-digit
  // spacing would mean matching against ordinary space-separated prose
  // instead of a fixed 3-2-4 shape, which is exactly the over-redaction
  // failure mode this task asked to remove elsewhere, not add here.
  //
  // D19-3: two further over-redaction shapes, fixed without loosening the
  // fixtures above.
  //   1) A separator slot that is PURE whitespace (no punctuation at all)
  //      used to be allowed, which caught nothing but an ordinary run of
  //      space-separated numbers - an audiogram row ("500 10 2000 Hz") is
  //      a 3-2-4-shaped digit sequence with exactly that separator. Each
  //      slot now REQUIRES the one OCR-plausible punctuation character
  //      (comma/colon/hyphen/pipe/underscore/period), with at most one
  //      optional space on either side of it - every existing garbled-SSN
  //      fixture (comma, colon, hyphen, spaced-hyphen) still has that
  //      literal character present; only a bare space/run-of-spaces with
  //      NO punctuation stops matching. KNOWN LIMIT (documented, not
  //      silently assumed): an UNLABELED, pure-whitespace-separated SSN in
  //      free-running prose ("Veteran record 123 45 6789 attached") is
  //      byte-for-byte the same shape as the audiogram row above - there is
  //      no regex-level signal that tells them apart, so this stays
  //      unmatched here. A LABELED occurrence of that same shape (an actual
  //      DD-214 "SOCIAL SECURITY: 123 45 6789" box value) is still caught -
  //      see the numeric labelOnly/broad/strict patterns in
  //      `LABELED_BOX_PATTERNS` below, whose value class already tolerates
  //      internal spaces.
  //   2) A citation/section-number LIST ("38 C.F.R. §§ 3.156, 20.203,
  //      20.1103") chains multiple period-joined numbers with ", " between
  //      them - `20.203, 20.1103` on its own is 3-2-4-shaped and ALL real
  //      digits, so it used to match and swallow "20." of the citation
  //      before it into `[REDACTED_SSN]`. A real SSN is never itself part
  //      of a larger dotted-decimal token, so a match whose first group is
  //      immediately preceded by "." (i.e. it's the tail end of a
  //      "NN.NNN"-shaped citation, not a standalone 3-digit group) is
  //      rejected; a digit immediately before the first group is already
  //      excluded by the `\b` word-boundary that follows this lookbehind
  //      (digit-to-digit is never a boundary), so only the period case
  //      needed an explicit guard.
  //
  // D19-3 follow-up: a trailing `(?!\.)` mirroring the lookbehind above was
  // tried and reverted - it does nothing for the citation case (the
  // lookbehind alone already rejects it, verified with the lookahead
  // removed), but it silently broke every garbled SSN that ends a sentence
  // ("Member 123-45-6789.", "id 123.45.6789.") - a period is the single
  // most common character to immediately follow a 9-digit run in ordinary
  // prose, so this was rejecting the majority of real garbled SSNs to guard
  // against a case the lookbehind already handles alone.
  ssnOcrGarbled:
    /(?<!\.)\b[0-9OoIlSsBb]{3}\s?[.\-_|,:]\s?[0-9OoIlSsBb]{2}\s?[.\-_|,:]\s?[0-9OoIlSsBb]{4}\b/g,

  // MRN — medical record number, labeled or numeric.
  mrn: /\bMRN[:\s#-]*\d{6,12}\b/gi,
  mrnLabeled:
    /\bmedical\s+record\s+(?:(?:#|no\.?|number)\s*)?(?::\s*)?\d{6,12}\b/gi,

  // Email — RFC-5322-lite. Runs late because /-chars don't overlap with the
  // numeric patterns above.
  //
  // D19: the previous unbounded `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`
  // is quadratic on '.'-heavy input (~6s for 80,000 chars) - the domain
  // class `[A-Za-z0-9.-]+` includes the literal dot it must later also
  // match as a separate, required `\.`, so on a long run of dots with no
  // real domain after it, the engine backtracks the domain match one
  // character at a time before giving up at THIS start position, then
  // repeats that same O(n) backtrack at every subsequent start position -
  // O(n) positions x O(n) backtrack = O(n²). Bounding every quantifier
  // removes the overlap: a label's char class no longer contains the dot
  // that ends it, so a run of dots can never partially match a label at
  // all, let alone backtrack through one - same fix already applied to
  // `emailOcrSpaced` below. The backtrack cost per anchor is capped at
  // whatever the bound is, not at the input length, so it's the boundedness
  // that matters for the O(n) guarantee, not the specific numbers - a
  // reviewer proved the original RFC-5321-literal bounds (64-octet local
  // part, 8 domain labels) rejected real, if RFC-invalid, OCR/typed input
  // (a 70-char local part, a 9-label domain) outright: `\b` can only anchor
  // once at the true start of a contiguous run, so once the bound is
  // exceeded there's no shorter/later position left to retry from and the
  // whole address goes unmatched, not just partially. Widened to limits
  // generous enough for realistic malformed input (254 = RFC 5321's total
  // envelope max, 32 domain labels) while staying bounded - confirmed still
  // <50ms against the same pathological '.'-heavy inputs above.
  email:
    /\b[A-Za-z0-9._%+-]{1,254}@(?:[A-Za-z0-9-]{1,63}\.){1,32}[A-Za-z]{2,24}\b/g,

  // D16-5/D16-6: OCR-garbled email - small (0-2 char) whitespace runs around
  // "@" and each "." that the strict pattern above doesn't tolerate
  // ("john.smith @ gmail . com"). The "@" stays a required literal, so this
  // can't fire on ordinary prose that merely contains "at"/"dot" text.
  // Narrowed to require the FINAL segment be a real top-level domain from a
  // fixed list, rather than any capitalized word - clinical shorthand for
  // "at" ("limited @ 45. Extension full.", "25 mg @ bedtime. Patient
  // reports...") has the same @-then-word-then-dot-then-word shape but
  // never ends in an actual TLD, so it no longer matches. Every quantifier
  // is bounded ({1,64}/{1,63}/{0,3}) instead of unbounded `+` - both to
  // enforce the TLD anchor and to stop this pattern from re-scanning long
  // pathological runs of word-characters-and-dots from every start
  // position (the quadratic-scan finding).
  emailOcrSpaced:
    // eslint-disable-next-line sonarjs/regex-complexity, sonarjs/duplicates-in-character-class -- flagged on the TLD alternation count and the redundant A-Za-z under /i, not on backtracking; every quantifier bounded (see comment above)
    /\b[A-Za-z0-9._%+-]{1,64}[ \t]{0,2}@[ \t]{0,2}[A-Za-z0-9-]{1,63}(?:[ \t]{0,2}\.[ \t]{0,2}[A-Za-z0-9-]{1,63}){0,3}[ \t]{0,2}\.[ \t]{0,2}(?:com|net|org|edu|gov|mil|io|co|us|info|biz)\b/gi,

  // Dates of birth — labeled or unlabeled numeric. Aggressive only.
  // Security review note: flagged for high regex complexity (51 vs 20) on a
  // PII-detection pattern; a same-session rewrite risks silently narrowing
  // what counts as a DOB (i.e. a PII leak). Deserves a dedicated pass with
  // fixture-based before/after matching, not a rushed simplification.
  // D20-5: a label followed by ANY common date format - ISO (YYYY-MM-DD,
  // YYYY/MM/DD), US/EU numeric, "DD Mon YYYY", "Mon DD, YYYY" and bare
  // YYYYMMDD. The earlier version only knew MM/DD/YYYY and "Mon DD YYYY", so
  // "born 1984-03-15" / "DOB: 15 Mar 1984" went straight through.
  dobLabeled: new RegExp(
    `\\b(?:DOB|D\\.O\\.B\\.?|birth\\s{0,3}date|birthday|date\\s{1,5}of\\s{1,5}birth|born(?:\\s{1,5}(?:on|in))?)(?:\\s{1,5}(?:is|was))?\\s{0,5}[:=-]?\\s{0,5}(?:the\\s{1,5})?${_DOB_DATE_SRC}\\b`,
    "gi",
  ),
  // D20-7: an unlabeled space-separated SSN (3-2-4 digit groups). Whether a
  // match is really an SSN or an audiogram row is decided from its context in
  // `_applyContextualDigitShape`, not by the pattern.
  ssnSpaced:
    /(?<![\d.,/-])\b\d{3}[ \t]{1,2}\d{2}[ \t]{1,2}\d{4}\b(?![.,/-]?\d)/g,
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

  // D15-1a/D16-5/D16-6: the second line of a US mailing address block -
  // "City, ST 12345" or "City, ST 12345-6789". A verifier proved the earlier
  // no-ZIP, unlabeled variants of this pattern (a bare comma then a state
  // code/name, anchored on NOTHING else) fire constantly on ordinary legal
  // and clinical prose - "Accordingly, VA has determined...", "PTSD, MS,
  // and diabetes...", "Camp Lejeune, North Carolina", "GU" (genitourinary),
  // "SC" (service-connected), ", OR" in rating-criteria text, "Georgia" in
  // a burn-pit-exposure country list. A comma followed by a short/common
  // word is simply too weak an anchor on its own. Those no-ZIP/unlabeled
  // variants are REMOVED here, not narrowed - free-running prose has no
  // structural signal left once the ZIP is gone. The "with or without ZIP"
  // ask for a label-anchored address (a DD-214 box, a City:/State:/Zip
  // code: field) is still honored - see the labelOnly HOME OF RECORD /
  // MAILING ADDRESS box patterns and cityLabeled/stateLabeled/zipLabeled
  // below, which get the real anchor a bare comma never had.
  //
  // The ZIP itself is the anchor for what's left, so BOTH variants below
  // (2-letter code, spelled-out name) are safely case-insensitive - a
  // lowercase state word directly followed by 5 digits ("springfield, il
  // 62704") is not realistic ordinary prose. The 2-letter codes also tolerate
  // Tesseract's O-for-0 misread (`_o0`, e.g. Oregon's "OR" read as "0R").
  // The prefix class uses `[ \t]` (never `\n`) so a preceding sentence on
  // its OWN line can't be pulled into the match across a line break.
  cityStateZip: [
    new RegExp(
      `\\b[A-Za-z][A-Za-z \\t.'-]{1,40},?[ \\t]{1,3}(?:${_STATE_ABBR_SRC})\\b\\.?,?[ \\t]{1,3}\\d{5}(?:-\\d{4})?\\b`,
      "gi",
    ),
    new RegExp(
      `\\b[A-Za-z][A-Za-z \\t.'-]{1,40},?[ \\t]{1,3}(?:${_STATE_NAME_SRC})\\b\\.?,?[ \\t]{1,3}\\d{5}(?:-\\d{4})?\\b`,
      "gi",
    ),
  ],

  // D16-5: explicitly labeled "City:"/"State:"/"Zip code:" fields (a form
  // layout, not free-flowing prose) - each redacted independently so a
  // partial block (e.g. City present, State/Zip on lines this app never
  // sees) still gets its own value covered.
  // eslint-disable-next-line sonarjs/duplicates-in-character-class -- the A-Za-z is redundant under /i (flagged), kept explicit for readability
  cityLabeled: /\bCity[ \t]{0,5}:[ \t]{0,5}[A-Za-z][A-Za-z \t.'-]{1,40}\b/gi,
  // D16-6: narrowed to an actual state name/code value - "State:" is also a
  // common clinical-form label for something else entirely ("Emotional
  // State: Anxious and depressed", "Mental state: depressed mood"), so the
  // label alone isn't a safe anchor; requiring the value be a real state is.
  stateLabeled: new RegExp(
    `\\bState[ \\t]{0,5}:[ \\t]{0,5}(?:${_STATE_ABBR_SRC}|${_STATE_NAME_SRC})\\b\\.?`,
    "gi",
  ),
  zipLabeled:
    /\bZip(?:[ \t]{1,3}code)?[ \t]{0,5}:[ \t]{0,5}\d{5}(?:-\d{4})?\b/gi,

  // D15-1a: military overseas mailing addresses (APO/FPO/DPO + AA/AE/AP +
  // ZIP), with or without a comma after either segment.
  apoFpoDpo:
    /\b(?:APO|FPO|DPO),?\s{1,3}(?:AA|AE|AP),?\s{1,3}\d{5}(?:-\d{4})?\b/gi,

  // D15-1a: a bare ZIP+4 not already caught as part of a city/state/zip
  // line above (e.g. a ZIP printed alone on its own line). Excludes an NDC
  // (National Drug Code) label's 5-4-2 grouping, which is byte-for-byte the
  // same shape as a ZIP+4 for its first two segments.
  zip4Bare: /(?<!ndc[ \t]{0,5})\b\d{5}-\d{4}\b(?!-\d)/gi,

  // D16-5/D16-6: "Patient: NAME (NNNN)" - a labeled EHR/medical-record
  // header line pairing a name with a short numeric ID in parentheses.
  // Narrowed to require the value look like a NAME (1-4 capitalized
  // tokens, each starting with an uppercase letter - this also matches an
  // ALL-CAPS name, since the run after the first letter allows any case) -
  // the original free-text value matched an entire clinical sentence
  // ending in a parenthesized year ("Patient: reports worsening tinnitus
  // since discharge (2012)."), which starts with a lowercase word and so no
  // longer qualifies. Case-sensitive on purpose (no /i) so the name-shape
  // check itself can't be defeated by lower-casing "reports worsening...";
  // the label alternation instead lists both cases it can appear in.
  patientLabeled:
    // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the repeated name-token grouping, not backtracking; every quantifier bounded
    /\b(?:Patient|PATIENT)[ \t]{0,5}:[ \t]{0,5}[A-Z][A-Za-z'-]{0,20},?[ \t]{1,3}[A-Z][A-Za-z'-]{0,20}(?:[ \t]{1,3}[A-Z][A-Za-z'-]{0,20}){0,2}[ \t]{0,3}\([ \t]{0,3}\d{2,10}[ \t]{0,3}\)/g,
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
// D16-5: a trailing garbled suffix OCR leaves on the label line itself
// ("SOCIAL SECURITY.N" from a mangled "NO.") - a period then a short run
// of letters. D16-6: that run was originally ANY 0-6 letters, which is
// exactly the shape of a value glued directly to the label with no space
// ("1. NAME.DOE, JOHN A", "7B. HOME OF RECORD.ANYTOWN, TX") - up to 6
// characters of the real name/city leaked into the "label" this way and
// survived redaction. Narrowed to only the letters that are actually a
// prefix of the garbled word this suffix exists for ("NO."/"NUMBER") -
// "DOE"/"ANYTOW"/"ROE" don't start with "N", so they no longer qualify as
// label text and fall through to the value group instead.
const _LABEL_OCR_SUFFIX =
  "(?:[ \\t]{0,10}\\.[ \\t]{0,10}(?:N|NO|NUM|NUMB|NUMBE|NUMBER)\\.?)?";
const _LABEL_HINT =
  "(?:[ \\t]{0,10}\\([^)\\n]{0,60}\\))?(?:[ \\t]{0,10}(?:NO\\.?|NUMBER|#))?" +
  _LABEL_OCR_SUFFIX;

// D16-6: a date-shaped value only - used for the DATE OF BIRTH box label so
// its labelOnly/free-form form can't swallow a full line of unrelated prose
// the way an open `[^\n]{2,N}` value class did ("date of birth\nand then
// evaluated tinnitus under DC 6260." previously redacted the entire next
// line). Mirrors the shapes `dob`/`dobLabeled` already accept elsewhere in
// this file, plus the military "DD Mon YYYY" print format, an ISO
// "YYYY-MM-DD" (the VKB's own stored format - see `_parseDobParts` below,
// which already recognizes it), and a bare 8-digit "YYYYMMDD" -
// deliberately NOT open-ended free text.
const _MONTH_NAME_SRC =
  "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]{0,10}\\.?";
const _DATE_VALUE_SOURCE =
  "(?:" +
  "\\d{4}-\\d{1,2}-\\d{1,2}" + // YYYY-MM-DD (ISO)
  "|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}" + // MM/DD/YYYY or DD/MM/YYYY
  `|${_MONTH_NAME_SRC}[ \\t]{1,5}\\d{1,2},?[ \\t]{1,5}\\d{2,4}` + // Mon DD, YYYY
  `|\\d{1,2}[ \\t]{1,5}${_MONTH_NAME_SRC}[ \\t]{1,5}\\d{2,4}` + // DD Mon YYYY
  "|\\d{8}" + // YYYYMMDD / DDMMYYYY
  ")";

/**
 * Shared value-source builder for `_labelValuePattern`/`_labelNextLinePattern`
 * - D16-6: previously only the same-line builder honored `numeric`/
 * `valueSource`, so the next-line variant always fell back to wide-open
 * free text (`[^\n]{2,N}`) even for a numeric-only field like SSN - "Social
 * Security\ndisability benefits for PTSD..." redacted the entire next
 * line because the OCR'd label-above-value layout never got the same
 * numeric constraint the same-line layout did.
 * @param {Object} [opts]
 * @param {number} [opts.maxValueChars=80]
 * @param {boolean} [opts.numeric=false] restrict the value to an optional
 *   single leading letter (a "C" file-number prefix) plus digits/spaces/
 *   hyphens, so a label that's merely mentioned in prose ("your VA file
 *   number on your evidence...") doesn't have unrelated prose swept up as
 *   if it were the value.
 * @param {string} [opts.valueSource] an explicit value regex source
 *   (e.g. a date shape) overriding the default free-text/numeric value -
 *   for fields (like DATE OF BIRTH) where "anything up to N chars" is too
 *   wide open, so the value itself must look like the thing it claims to be.
 * @returns {string}
 */
function _labelValueSource(opts) {
  const { maxValueChars = 80, numeric = false, valueSource } = opts;
  return (
    valueSource ??
    // D16-6: `[ \t]` not `\s` for the interior run - `\s` matches "\n", so
    // once this same value-source is shared with the next-line builder
    // (below), a greedy numeric value could otherwise run past the end of
    // the OCR'd value line and into a SUBSEQUENT labeled line entirely
    // ("SSN\n123-45-6789\nDOB\n1985-01-01" swallowing the DOB line too).
    (numeric
      ? `(?:[A-Za-z][- \\t]?)?\\d[\\d \\t-]{1,${Math.max(maxValueChars - 1, 4)}}`
      : `[^\\n]{2,${maxValueChars}}`)
  );
}

/**
 * Build a "label, then redact the rest of the line" pattern. Group 1 (the
 * label, plus any trailing hint text) is preserved by the caller's
 * replacer; group 2 (the value) is what gets redacted.
 * @param {string} labelAlternatives regex source for the label (no capture groups)
 * @param {Object} [opts] see `_labelValueSource`
 * @param {string} [opts.flags="gi"]
 * @returns {RegExp}
 */
function _labelValuePattern(labelAlternatives, opts = {}) {
  const { flags = "gi" } = opts;
  const value = _labelValueSource(opts);
  // D16-6: \b on both sides of the label - without it, "DOB" (a labelOnly
  // alternative) matched as a bare substring inside the scrubber's OWN
  // "[REDACTED_DOB]" placeholder (no boundary between "_" and "D") and
  // inside ordinary prose like "Dobutamine" (no boundary between "B" and
  // "u") - both self-collisions this task asked to close.
  return new RegExp(
    `(\\b(?:${labelAlternatives})\\b${_LABEL_HINT}[:.]?[ \\t]{0,10})(${value})`,
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
 * @param {Object} [opts] see `_labelValueSource`
 * @returns {RegExp}
 */
function _labelNextLinePattern(labelAlternatives, opts = {}) {
  const { flags = "gi" } = opts;
  const value = _labelValueSource(opts);
  return new RegExp(
    `(\\b(?:${labelAlternatives})\\b${_LABEL_HINT}[:.]?[ \\t]{0,10})\\n(${value})`,
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
//
// D16-5: `labelOnly` (no box number required at all) closes a gap `broad`/
// `strict` both leave: a form that numbers a box differently than DD214
// (e.g. NGB-22), or OCR that simply loses the box number while still
// printing the label text, previously matched NOTHING for that field. Left
// `null` for NAME specifically - "NAME" alone with no box anchor at all is
// far too generic (it collides with "Trade name:", "Name of medication:",
// and countless other ordinary form fields), so name only ever redacts via
// the box-anchored forms.
const BOX_LABEL_DEFS = [
  {
    broad: "(?:BLOCK[ \\t]{0,10}1|BOX[ \\t]{0,10}1)[ \\t]{0,10}NAME",
    strict: "\\b1[A-Za-z]?[ \\t]{0,10}\\.[ \\t]{0,10}NAME",
    labelOnly: null,
  },
  {
    broad: `(?:BLOCK[ \\t]{0,10}3|BOX[ \\t]{0,10}3)[ \\t]{0,10}(?:${_o0("SOCIAL")}[ \\t]{0,10}SECURITY(?:[ \\t]{0,10}NUMBER)?|S\\.?S\\.?N\\.?)`,
    strict: `\\b3[A-Za-z]?[ \\t]{0,10}\\.[ \\t]{0,10}(?:${_o0("SOCIAL")}[ \\t]{0,10}SECURITY(?:[ \\t]{0,10}NUMBER)?|S\\.?S\\.?N\\.?)`,
    labelOnly: `(?:${_o0("SOCIAL")}[ \\t]{0,10}SECURITY(?:[ \\t]{0,10}NUMBER)?|SSN|S\\.?S\\.?N\\.?)`,
    maxValueChars: 40,
    numeric: true,
  },
  {
    broad:
      "(?:BLOCK[ \\t]{0,10}5|BOX[ \\t]{0,10}5)[ \\t]{0,10}DATE[ \\t]{0,10}OF[ \\t]{0,10}BIRTH",
    strict:
      "\\b5[A-Za-z]?[ \\t]{0,10}\\.[ \\t]{0,10}DATE[ \\t]{0,10}OF[ \\t]{0,10}BIRTH",
    labelOnly: "(?:DATE[ \\t]{0,10}OF[ \\t]{0,10}BIRTH|DOB)\\.?",
    maxValueChars: 40,
    valueSource: _DATE_VALUE_SOURCE,
  },
  {
    // D16-6: the printed DD-214 label is "HOME OF RECORD AT TIME OF ENTRY",
    // not just "HOME OF RECORD" - the trailing "AT TIME OF ENTRY" sat
    // between the label and its own "(City and state...)" hint
    // parenthetical, which meant the hint never matched and the SAME-LINE
    // value pattern instead redacted that descriptive text itself, leaving
    // the real value on the next OCR line untouched. Also tolerates
    // Tesseract's O-for-0 misread inside the label text (`_o0`).
    broad: `(?:BLOCK[ \\t]{0,10}7[ \\t]{0,10}[Bb]|BOX[ \\t]{0,10}7[ \\t]{0,10}[Bb])[ \\t]{0,10}${_o0("HOME")}[ \\t]{0,10}${_o0("OF")}[ \\t]{0,10}${_o0("RECORD")}(?:[ \\t]{0,10}AT[ \\t]{0,10}TIME[ \\t]{0,10}${_o0("OF")}[ \\t]{0,10}ENTRY)?`,
    strict: `\\b7[ \\t]{0,10}\\.?[ \\t]{0,10}[Bb]\\.?[ \\t]{0,10}${_o0("HOME")}[ \\t]{0,10}${_o0("OF")}[ \\t]{0,10}${_o0("RECORD")}(?:[ \\t]{0,10}AT[ \\t]{0,10}TIME[ \\t]{0,10}${_o0("OF")}[ \\t]{0,10}ENTRY)?`,
    labelOnly: `${_o0("HOME")}[ \\t]{0,10}${_o0("OF")}[ \\t]{0,10}${_o0("RECORD")}(?:[ \\t]{0,10}AT[ \\t]{0,10}TIME[ \\t]{0,10}${_o0("OF")}[ \\t]{0,10}ENTRY)?`,
    // D16-6: "home of record" (unlike "SOCIAL SECURITY"/"DATE OF BIRTH") is
    // ordinary phrasing ("The home of record listed on file was updated
    // last year...") - the SAME-LINE labelOnly form redacted the rest of
    // that sentence as if it were a form value. Restricted to the
    // label-alone-then-newline shape only, which a real, unnumbered form
    // field still produces but a sentence mentioning the phrase does not.
    labelOnlyNextLineOnly: true,
  },
  {
    // D16-6: same fix as HOME OF RECORD above - the printed label carries a
    // trailing "AFTER SEPARATION" before its own "(Include ZIP Code)" hint.
    broad: `(?:BLOCK[ \\t]{0,10}(?:19|30)|BOX[ \\t]{0,10}(?:19|30))[ \\t]{0,10}(?:MAILING|${_o0("HOME")})[ \\t]{0,10}ADDRESS(?:[ \\t]{0,10}AFTER[ \\t]{0,10}SEPARATION)?`,
    strict: `\\b(?:19|30)[A-Za-z]?[ \\t]{0,10}\\.[ \\t]{0,10}(?:MAILING|${_o0("HOME")})[ \\t]{0,10}ADDRESS(?:[ \\t]{0,10}AFTER[ \\t]{0,10}SEPARATION)?`,
    labelOnly: `(?:MAILING|${_o0("HOME")})[ \\t]{0,10}ADDRESS(?:[ \\t]{0,10}AFTER[ \\t]{0,10}SEPARATION)?`,
    // D16-6: same reasoning as HOME OF RECORD above - "mailing address"/
    // "home address" are everyday phrases ("your evaluation... sent to
    // your mailing address"; "Veteran confirmed home address unchanged").
    labelOnlyNextLineOnly: true,
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
    labelOnly: null,
    maxValueChars: 40,
    numeric: true,
  },
];

const LABELED_BOX_PATTERNS = BOX_LABEL_DEFS.flatMap((def) => {
  const opts = {
    maxValueChars: def.maxValueChars,
    numeric: def.numeric,
    valueSource: def.valueSource,
  };
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
  if (def.labelOnly) {
    patterns.push(_labelNextLinePattern(def.labelOnly, opts));
    if (!def.labelOnlyNextLineOnly) {
      patterns.push(_labelValuePattern(def.labelOnly, opts));
    }
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
// courtesy title ("Mr."/"Ms."/"Mrs."/"Miss"/"Dr."/"Mx.") or a common
// military-correspondence rank abbreviation, followed by a name - never a
// generic/templated greeting ("Dear Veteran:", "Dear Sir or Madam:", "Dear
// Applicant:") that carries no identifying text at all. The rank list is a
// documented, best-effort common subset (not every service's full rank
// table) - same limit already accepted for GENERIC_SALUTATION_WORDS below.
const _COURTESY_TITLE_SRC =
  "Mr|Mrs|Ms|Miss|Dr|Mx|SSgt|MSgt|Sgt|Sfc|Cpl|Pfc|Pvt|Spc|Capt|Cpt|Lt|Col|Maj|Gen|Adm|Cmdr";
const SALUTATION_NAME = new RegExp(
  `^([ \\t]{0,10}Dear[ \\t]{1,5}(?:${_COURTESY_TITLE_SRC})\\.?[ \\t]{1,5})([^\\n:,]{1,60})`,
  "i",
);

// A short stoplist of generic-but-still-Title-Case greetings ("Dear Claims
// Team:") the no-title pattern above would otherwise redact - there's no
// name dictionary to fall back on, so this is a documented, best-effort
// limit rather than a claim of completeness (see the module-level "Limits"
// note above). "or"/"and" are here specifically because broadening the
// no-title token class to allow ALL-CAPS (D16-6, below) means an ALL-CAPS
// "Dear SIR OR MADAM:" now tokenizes "OR" as a name-shaped word too. The
// courtesy-title/rank words themselves are also included: the titled pass
// (SALUTATION_NAME_G) runs FIRST and, for "Dear Sgt. Smith:", keeps "Sgt."
// as its own preserved greeting text while replacing only "Smith" - without
// this, the no-title pass then ran SECOND against that same leftover
// "Dear Sgt." fragment and mistook the bare rank word for a surname.
const _TITLE_STOPWORDS = _COURTESY_TITLE_SRC
  .split("|")
  .map((t) => t.toLowerCase());
const GENERIC_SALUTATION_WORDS = new Set([
  "veteran",
  "team",
  "customer",
  "claimant",
  "member",
  "resident",
  "applicant",
  "staff",
  "support",
  "sir",
  "madam",
  "friend",
  "claims",
  "or",
  "and",
  ..._TITLE_STOPWORDS,
]);

function _isGenericSalutationName(name) {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.toLowerCase());
  return words.every((w) => GENERIC_SALUTATION_WORDS.has(w));
}

// Global (non-anchored) counterparts of SALUTATION_NAME - for
// redactSalutationNames below - unlike redactLetterAddresseeBlock's
// per-line loop, these don't require the salutation to be its own whole
// line, so they also catch a salutation sitting in the middle of a
// flattened single-line OCR page.
const SALUTATION_NAME_G = new RegExp(
  `(Dear[ \\t]{1,5}(?:${_COURTESY_TITLE_SRC})\\.?[ \\t]{1,5})([^\\n:,]{1,60})`,
  "gi",
);

// D16-5/D16-6: "Dear FIRST LAST:" with NO courtesy title. One-plus
// consecutive name-shaped tokens with no lowercase connector between them -
// a generic/templated greeting essentially never has this shape ("Dear
// Sir or Madam:" has a lowercase "or" breaking the run - still true here).
// Each token is either Title-Case-or-ALL-CAPS (any case after the first
// letter - this also covers an inner capital like "McDonald", which a
// lowercase-only continuation used to truncate at "Mc") or a bare initial
// ("A."). D16-6 also allows a SINGLE token (a bare "Dear Faketon:" surname,
// with no title and no second word) - every candidate, of any word count,
// is still checked against GENERIC_SALUTATION_WORDS below before redacting.
const _SALUTATION_TOKEN_SRC = "(?:[A-Z][A-Za-z'-]{1,20}|[A-Z]\\.)";
const SALUTATION_NAME_NO_TITLE_G = new RegExp(
  `(Dear[ \\t]{1,5})(${_SALUTATION_TOKEN_SRC}(?:[ \\t]{1,3}${_SALUTATION_TOKEN_SRC}){0,3})`,
  "g",
);

/**
 * Redact the name in a "Dear ...:" salutation wherever it appears in
 * `text`, with or without a courtesy title, regardless of whether the
 * salutation sits on its own line (unlike redactLetterAddresseeBlock,
 * which is line-anchored and so can't see a salutation embedded in a
 * flattened single-line OCR page). A generic/templated greeting ("Dear
 * Veteran:") is left alone - see GENERIC_SALUTATION_WORDS.
 * @param {string} text
 * @returns {string}
 */
export const redactSalutationNames = (text) => {
  if (!text || typeof text !== "string") return text;
  let out = text.replace(
    reset(SALUTATION_NAME_G),
    (_m, greeting) => `${greeting}[REDACTED]`,
  );
  out = out.replace(reset(SALUTATION_NAME_NO_TITLE_G), (m, greeting, name) =>
    _isGenericSalutationName(name) ? m : `${greeting}[REDACTED]`,
  );
  return out;
};

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

// D16-5/D16-6: VA-letter page footer pairing a file number with the
// veteran's name and a page number ("File Number: 12345678  DOE, JOHN M
// Page 2"). The trailing "Page N" is captured so it survives the redaction -
// it isn't sensitive on its own, and losing it would make a multi-page
// footer harder to reason about downstream for no privacy benefit.
// D16-6: the file-number value now tolerates a single space/hyphen between
// EACH character (mirroring `vaFile`'s "re-grouped digits" handling above -
// "C 12 345 678", masked "XXX XX 1234") - this MUST run before any other
// step gets a chance to redact the file number first (see `scrubPII`'s step
// 1): the original ran late, by which point the bare-digit/VA-file/labeled-
// box passes earlier in the pipeline had already replaced the number with
// "[REDACTED...]" - a value this pattern's old `[\dA-Za-z-]{4,20}` class
// couldn't match (no "[" / "]"), so the footer never fired for real and the
// name leaked every time.
const LETTER_FOOTER =
  // eslint-disable-next-line sonarjs/regex-complexity, sonarjs/duplicates-in-character-class -- flagged on the label/name-shape alternation count and the redundant A-Za-z under /i, not on backtracking; every quantifier bounded
  /\bFile[ \t]{0,5}Number[ \t]{0,5}:[ \t]{0,5}[\dA-Za-z](?:[ \t-]?[\dA-Za-z]){3,19}[ \t]{1,10}[A-Z][A-Z'-]{1,30},[ \t]{0,5}[A-Z][A-Z'-]{1,30}(?:[ \t]{1,5}[A-Z]\.?)?[ \t]{1,10}(Page[ \t]{1,5}\d{1,4}\b)/gi;

/**
 * Redact a VA-letter page footer's file-number-and-name span, keeping the
 * trailing "Page N" intact.
 * @param {string} text
 * @returns {string}
 */
export const redactLetterFooter = (text) => {
  if (!text || typeof text !== "string") return text;
  return text.replace(
    reset(LETTER_FOOTER),
    (_m, pageGroup) => `[REDACTED] ${pageGroup}`,
  );
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
// D16-5: salutation names (with or without a courtesy title, on their own
// line or embedded in a flattened OCR page) and labeled "Patient: NAME
// (NNNN)" lines - extracted out of _applyAddressAndLabelRedaction so it
// stays under the line-count limit. Neither interacts with the date-line/
// salutation anchors the comment on that function is about, so ordering
// relative to it doesn't matter. D16-6: the letter-footer pass moved OUT of
// here to `scrubPII`'s very first step - see the comment on `LETTER_FOOTER`
// for why it has to run before the bare-digit/VA-file/labeled-box passes,
// not after them.
function _applySalutationAndPatientRedaction(text) {
  let scrubbed = text;
  const hits = [];

  const beforeSalutation = scrubbed;
  scrubbed = redactSalutationNames(scrubbed);
  if (scrubbed !== beforeSalutation) {
    hits.push({ type: "Salutation Name", count: 1 });
  }

  const patientCount = _countMatches(scrubbed, PII_PATTERNS.patientLabeled);
  if (patientCount > 0) {
    hits.push({ type: "Patient Name", count: patientCount });
    scrubbed = scrubbed.replace(
      reset(PII_PATTERNS.patientLabeled),
      "[REDACTED_PATIENT]",
    );
  }

  return { scrubbed, hits };
}

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

  const salutationResult = _applySalutationAndPatientRedaction(scrubbed);
  scrubbed = salutationResult.scrubbed;
  hits.push(...salutationResult.hits);

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
    ...PII_PATTERNS.cityStateZip,
    PII_PATTERNS.cityLabeled,
    PII_PATTERNS.stateLabeled,
    PII_PATTERNS.zipLabeled,
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
function _applyPhoneMrnEdipiVaFile(
  { applyPattern, applyContextual },
  aggressive,
  preservePartial,
) {
  // 2. Phones (10 digits with separators or international) - but not an
  //    audiogram row, which has the same 3-3-4 shape ("250 500 1000").
  PII_PATTERNS.phone.forEach((pattern) => {
    applyContextual(pattern, "Phone", _isAudiogramRow, (match) => {
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

function _ocrSsnDigitDensity(match) {
  const chars = match.replace(/[\s.\-_|,:]/g, "");
  if (chars.length !== 9) return 0;
  const realDigits = [...chars].filter((c) => /\d/.test(c)).length;
  return realDigits / chars.length;
}

// D16-5: only redact an OCR-garbled SSN-shaped run (ssnOcrGarbled above)
// when most of its 9 characters are already real digits - guards against
// sweeping up ordinary text that merely happens to fall into the same
// 3-2-4 chunk shape using the handful of letters the pattern treats as
// digit look-alikes (O/o/I/l). A bespoke step (not the generic
// applyPattern helper) because it needs to know how many matches were
// ACTUALLY plausible, not just how many the regex found.
function _skipGarbledSsn(line, match) {
  return (
    _ocrSsnDigitDensity(match) < 0.55 ||
    (/^[\d\s.\-_|,:]+$/.test(match) && _isAudiogramRow(line, match))
  );
}

// Steps 5/5b of scrubPII: canonical hyphenated and spaced SSN (an audiogram
// row of the same shape is spared), bare 9-digit only in aggressive mode, and
// the OCR-garbled form (always on - the grouping shape plus digit-density
// check is its own anchor; see _skipGarbledSsn).
function _applySsnPatterns(
  { applyPattern, applyContextual },
  aggressive,
  preservePartial,
) {
  const redactSsnMatch = (match) => {
    if (!preservePartial) return "[REDACTED_SSN]";
    const digits = match.replace(/\D/g, "");
    return `XXX-XX-${digits.slice(-4)}`;
  };
  applyContextual(PII_PATTERNS.ssn, "SSN", _isAudiogramRow, redactSsnMatch);
  applyContextual(
    PII_PATTERNS.ssnSpaced,
    "SSN",
    _isAudiogramOrClinicalRow,
    redactSsnMatch,
  );
  if (aggressive) {
    applyPattern(PII_PATTERNS.ssnBare, "SSN", "[REDACTED_SSN]");
  }
  applyContextual(
    PII_PATTERNS.ssnOcrGarbled,
    "SSN",
    _skipGarbledSsn,
    () => "[REDACTED_SSN]",
  );
}

// D20-7: audiogram rows are digit runs shaped exactly like a credit card
// ("1000 2000 3000 4000", the standard frequency header), a phone number
// ("250 500 1000") or an SSN ("500 25 1000" / "500-25-1000", frequency / dB
// threshold / frequency). Real identifiers are told apart by context, never by
// shape alone: every number involved is a standard test frequency or a dB
// threshold (a multiple of 5), or the row carries more than three numbers that
// all are.
const _AUDIOGRAM_FREQS = new Set([
  125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000,
]);
const _AUDIOGRAM_KEYWORDS =
  /\b(?:Hz|kHz|dB|audiogram|audiometry|audiometric|thresholds?|frequenc(?:y|ies)|pure[- ]tone|left|right|ear)\b/i;

const _isAudiogramNumber = (n) =>
  _AUDIOGRAM_FREQS.has(n) || (n % 5 === 0 && n <= 120);

function _lineAround(text, offset, length) {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  const end = text.indexOf("\n", offset + length);
  return text.slice(start, end === -1 ? text.length : end);
}

// A row of nothing but numbers that are all audiogram values can be told from
// a phone number or SSN only by its surroundings: audiogram wording on the
// line, or a long run (more than three numbers) of such values.
function _isAudiogramRow(line, match) {
  const groups = match.match(/\d+/g).map(Number);
  if (!groups.every(_isAudiogramNumber)) return false;
  if (_AUDIOGRAM_KEYWORDS.test(line)) return true;
  const numbers = (line.match(/\d+/g) || []).map(Number);
  return numbers.length > 3 && numbers.every(_isAudiogramNumber);
}

// Lab, vitals and range-of-motion rows carry 3-2-4 digit runs ("Platelets 250
// 45 1300", "BP 140 90 2019") that are not SSNs. A line that names its own
// SSN/social is never spared.
const _CLINICAL_ROW_KEYWORDS =
  // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the keyword alternation count, not backtracking; every alternative is a fixed literal
  /\b(?:platelets?|wbc|rbc|hgb|hct|glucose|creatinine|lab|labs|bp|blood\s+pressure|pulse|heart\s+rate|bpm|mmHg|mg\/dL|ROM|range\s+of\s+motion|flexion|extension|abduction|rotation|degrees)\b/i;
const _SSN_LABEL = /\b(?:SSN|social|SS#)/i;

function _isAudiogramOrClinicalRow(line, match) {
  if (_isAudiogramRow(line, match)) return true;
  return _CLINICAL_ROW_KEYWORDS.test(line) && !_SSN_LABEL.test(line);
}

function _applyContextualDigitShape(
  scrubbed,
  pattern,
  shouldSkip,
  replacement,
) {
  let count = 0;
  const next = scrubbed.replace(reset(pattern), (match, ...rest) => {
    const offset = rest.at(-2);
    if (shouldSkip(_lineAround(scrubbed, offset, match.length), match)) {
      return match;
    }
    count += 1;
    return replacement(match);
  });
  return { scrubbed: next, count };
}

// Steps 1-5 of scrubPII, in their load-bearing order.
function _applyCardDobPhoneSsnPatterns(appliers, aggressive, preservePartial) {
  const { applyPattern, applyContextual } = appliers;
  // 1. Credit cards (16 digits) — highest specificity - except an audiogram
  //    row, which has the same shape (see _isAudiogramRow).
  applyContextual(
    PII_PATTERNS.creditCard,
    "Credit Card",
    _isAudiogramRow,
    () => "[REDACTED_CC]",
  );
  // 1b. A labeled DOB before any bare-digit pattern can claim its digits
  //     (an 8-digit "date of birth 19840315" is a DOB, not a file number).
  applyPattern(PII_PATTERNS.dobLabeled, "Date of Birth", "[REDACTED_DOB]");
  _applyPhoneMrnEdipiVaFile(appliers, aggressive, preservePartial);
  _applySsnPatterns(appliers, aggressive, preservePartial);
}

// Steps 7-8 of scrubPII. Email runs late because @ doesn't overlap with the
// numeric patterns; the labeled DOB form is handled earlier (step 1b), bare
// numeric DOBs only in aggressive mode.
function _applyEmailAndBareDobPatterns(
  applyPattern,
  aggressive,
  preservePartial,
) {
  applyPattern(PII_PATTERNS.email, "Email", (match) => {
    if (!preservePartial) return "[REDACTED_EMAIL]";
    const [user, domain] = match.split("@");
    return `${user[0]}***@${domain}`;
  });
  // OCR-garbled email (spaced-out @ / . characters).
  applyPattern(PII_PATTERNS.emailOcrSpaced, "Email", "[REDACTED_EMAIL]");

  if (aggressive) {
    PII_PATTERNS.dob.forEach((pattern) => {
      applyPattern(pattern, "Date of Birth", "[REDACTED_DOB]");
    });
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

  // 0. D16-6: the VA-letter footer's file-number+name span, before ANY
  //    digit-eating pattern below gets a chance to redact the file number
  //    first - see the comment on `LETTER_FOOTER` for why order here is
  //    load-bearing, not cosmetic.
  const beforeFooter = scrubbed;
  scrubbed = redactLetterFooter(scrubbed);
  if (scrubbed !== beforeFooter) {
    piiFound = true;
    details.push({ type: "Letter Footer", count: 1 });
  }

  const applyPattern = (pattern, type, replacer) => {
    const matches = scrubbed.match(reset(pattern));
    if (!matches) return;
    piiFound = true;
    details.push({ type, count: matches.length });
    scrubbed = scrubbed.replace(reset(pattern), replacer);
  };

  const applyContextual = (pattern, type, shouldSkip, replacement) => {
    const r = _applyContextualDigitShape(
      scrubbed,
      pattern,
      shouldSkip,
      replacement,
    );
    scrubbed = r.scrubbed;
    if (r.count > 0) {
      piiFound = true;
      details.push({ type, count: r.count });
    }
  };

  const appliers = { applyPattern, applyContextual };
  _applyCardDobPhoneSsnPatterns(appliers, aggressive, preservePartial);
  _applyEmailAndBareDobPatterns(applyPattern, aggressive, preservePartial);

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

// D16-6/D19: test-only seam so a perf/no-quadratic-scan test can time these
// patterns directly, isolated from the rest of the full `scrubText()`
// pipeline.
export const _testOnlyPatterns = {
  email: PII_PATTERNS.email,
  emailOcrSpaced: PII_PATTERNS.emailOcrSpaced,
  ssnOcrGarbled: PII_PATTERNS.ssnOcrGarbled,
};

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
  redactSalutationNames,
  redactLetterFooter,
};
