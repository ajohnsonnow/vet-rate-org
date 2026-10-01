/**
 * Vet-Rate.org - DD214 Field Extractor (Regex-Based)
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * DIAMOND STANDARD: Deterministic DD214 field extraction using regex patterns.
 * This runs AFTER OCR/text extraction and BEFORE AI analysis.
 * Think of this as a safety net — even if the AI misses something,
 * the regex extractor catches it from the raw text.
 *
 * Handles DD214 format variations across eras:
 * - Modern DD214 (post-2000): Digital/typed, standardized layout
 * - Gulf War era (1990s): Mix of typed and dot-matrix
 * - Vietnam/Cold War era: Typewriter, older block numbering
 * - Pre-Vietnam: DD Form 214 with different block layout
 *
 * Also supports: NGB 22, DD256, DD257, DD215
 *
 * All processing is 100% client-side.
 */

import { findCombatDecorationsInText } from "./combatService";

/**
 * All DD214 block field definitions with multiple regex patterns per field.
 * Each pattern is tried in order; first match wins.
 * Patterns handle OCR typos, spacing variations, and era-specific layouts.
 */
// A confident fullName match must not be another box's LABEL text that
// happened to land in the value position - e.g. an empty Block 1 box
// followed immediately by Block 2's own label line ("DEPARTMENT COMPONENT
// AND BRANCH"), or a row-split capture that ran onto a neighbouring box's
// label ("...DOE, JORDAN R SSN"). None of these words can plausibly be
// part of a person's actual name, so their presence means the capture
// landed on the WRONG box - reject outright (empty, never a wrong name)
// rather than show it. Branch names are included since block 2 commonly
// sits immediately after an empty/short block 1 value.
const NAME_LABEL_LEAK_RE =
  // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the reject-keyword alternation count, not backtracking; every alternative is a fixed/bounded literal
  /\b(?:DEPARTMENT|COMPONENT|BRANCH|ARMY|NAVY|MARINE|COAST\s*GUARD|SPACE\s*FORCE|AIR\s*FORCE|SOCIAL\s*SECURITY|SSN|DATE\s*OF\s*BIRTH|PAY\s*GRADE|RESERVE\s*OBLIG|HOME\s*OF\s*RECORD|MAILING\s*ADDRESS|BLOCK|BOX|ITEM|NOTHING\s*FOLLOWS)\b/i;

// D19-4: a box's own printed instructional parenthetical ("(CITY AND
// STATE, OR COMPLETE, , ADDRESS IF KNOWN)") can still land at the START of
// a captured value even though homeOfRecord/mailingAddress's own patterns
// already try to skip one - their skip-group only tolerates WHITESPACE
// immediately before the opening "(", but a real layout commonly prints
// "HOME OF RECORD: (City and State...)" with a colon there instead, so the
// skip never engages and the capture starts at the paren. A real address/
// name value never legitimately STARTS with a parenthetical (one appearing
// later, e.g. "123 MAIN ST (APT 4)", is untouched - only a LEADING one is
// stripped), so this is safe regardless of which exact layout let it
// through. Returns "" when nothing is left after stripping, rather than
// the instruction text - `validate()` (below, per field) then rejects an
// empty/too-short remainder as an empty field, never as a wrong value.
// D19-4 follow-up: the closed-paren strip below depends on a literal ")"
// surviving OCR - it does nothing when OCR drops the closing paren (or
// both of them), leaving the box's own instruction wording itself at the
// start of the value. These recognize that FIXED, known wording directly
// (own parens optional, either side), so a missing paren no longer leaves
// the instruction text - only the real value after it - in the result.
const _HOME_OF_RECORD_HINT_RE =
  /^[\s(]{0,10}CITY\s{1,5}AND\s{1,5}STATE\s{0,5},\s{0,5}OR\s{1,5}COMPLETE\s{0,5}(?:,\s{0,5})?ADDRESS\s{1,5}IF\s{1,5}KNOWN[\s)]{0,10}[:.,-]{0,3}\s{0,5}/i;
const _MAILING_ADDRESS_HINT_RE =
  // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the two-branch hint-wording alternation, not backtracking; every quantifier bounded
  /^[\s(]{0,10}(?:STREET\s{0,5},\s{0,5}CITY\s{0,5},\s{0,5}STATE\s{0,5},\s{0,5}ZIP|INCLUDE\s{1,5}ZIP\s{1,5}CODE)[\s)]{0,10}[:.,-]{0,3}\s{0,5}/i;

function _stripLeadingPrintedInstruction(value) {
  if (!value) return value;
  return value
    .replace(/^\s*\([^)]{0,150}\)\s*[:.,-]*\s*/, "")
    .replace(_HOME_OF_RECORD_HINT_RE, "")
    .replace(_MAILING_ADDRESS_HINT_RE, "");
}

// D20-3: every word a DD-214 prints in its own box labels and instruction
// parentheticals. A captured identifier value made ONLY of these words is the
// form's own wording (e.g. "CITY STATE COMPLETE ADDRESS IF KNOWN ZIP CODE"),
// never the veteran's data, so it is rejected rather than shown.
const PRINTED_LABEL_WORDS = new Set(
  (
    "CITY STATE COMPLETE ADDRESS IF KNOWN ZIP CODE HOME OF RECORD AT TIME ENTRY " +
    "AND OR STREET INCLUDE MAILING AFTER SEPARATION THE NUMBER NAME LAST FIRST " +
    "MIDDLE NEAREST RELATIVE DEPARTMENT COMPONENT BRANCH SOCIAL SECURITY DATE " +
    "BIRTH PLACE ENTERED ACTIVE DUTY TYPED PRINTED INFORMATION REQUIRED FOR TO " +
    "A AN IN BLOCK ITEM BOX NO"
  ).split(" "),
);

// Captions printed in NEIGHBOURING boxes. On a noisy scan one of these can
// land under an identifier label; none occurs in a real name or home address.
const OTHER_BOX_CAPTION_RE =
  // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the alternation count, not backtracking; every alternative is a fixed literal
  /\b(?:STATION\s+WHERE|SEPARATED|SEPARATION|ENTRY\s+INTO|ACTIVE\s+DUTY|PAY\s+GRADE|DATE\s+OF\s+RANK|GRADE\s+RATE|RATE\s+OR\s+RANK|REQUESTS?|SIGNATURE|DIRECTOR\s+OF\s+VETERANS|VETERANS\s+AFFAIRS|MEMBER|YES\s+\S+\s+NO)\b/i;

function _isPrintedLabelVocabulary(value) {
  const words = (value || "").toUpperCase().match(/[A-Z]+/g) || [];
  return (
    words.length === 0 ||
    words.every((w) => PRINTED_LABEL_WORDS.has(w)) ||
    OTHER_BOX_CAPTION_RE.test(value)
  );
}

const _STATE_CODES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|PR|GU|VI|AS|MP|AA|AE|AP";
const _US_STATE_NAMES =
  "ALABAMA|ALASKA|ARIZONA|ARKANSAS|CALIFORNIA|COLORADO|CONNECTICUT|DELAWARE|DISTRICT\\s{1,5}OF\\s{1,5}COLUMBIA|FLORIDA|GEORGIA|HAWAII|IDAHO|ILLINOIS|INDIANA|IOWA|KANSAS|KENTUCKY|LOUISIANA|MAINE|MARYLAND|MASSACHUSETTS|MICHIGAN|MINNESOTA|MISSISSIPPI|MISSOURI|MONTANA|NEBRASKA|NEVADA|NEW\\s{1,5}HAMPSHIRE|NEW\\s{1,5}JERSEY|NEW\\s{1,5}MEXICO|NEW\\s{1,5}YORK|NORTH\\s{1,5}CAROLINA|NORTH\\s{1,5}DAKOTA|OHIO|OKLAHOMA|OREGON|PENNSYLVANIA|RHODE\\s{1,5}ISLAND|SOUTH\\s{1,5}CAROLINA|SOUTH\\s{1,5}DAKOTA|TENNESSEE|TEXAS|UTAH|VERMONT|VIRGINIA|WASHINGTON|WEST\\s{1,5}VIRGINIA|WISCONSIN|WYOMING|PUERTO\\s{1,5}RICO|GUAM|AMERICAN\\s{1,5}SAMOA|VIRGIN\\s{1,5}ISLANDS|NORTHERN\\s{1,5}MARIANA\\s{1,5}ISLANDS|CALIF|MASS|PENN|MICH|MINN|WISC|TENN|MISS|ALA|ARIZ|COLO|CONN|FLA|ILL|IND|KANS|NEBR|NEV|OKLA|ORE|TEX|WASH|WYO|MONT";
// A city-ish word run, then a real state (name, old-style abbreviation or
// USPS code - never just any two letters, so a label tail like "SEPARATED AT"
// is not enough), then an optional ZIP, ending the value. Dots in "N.Y." /
// "D.C." and a trailing period are normalised away before the test.
const _CITY_STATE_SHAPE_RE = new RegExp(
  `[A-Z][A-Z0-9 .'-]{1,60}[,\\s]\\s{0,5}(?:${_STATE_CODES}|${_US_STATE_NAMES})(?:\\s{0,5},?\\s{0,5}\\d{5}(?:-\\d{4})?)?\\s{0,5}$`,
  "i",
);

function _hasCityStateShape(value) {
  const normalized = (value || "").trim().replaceAll(".", "");
  return _CITY_STATE_SHAPE_RE.test(normalized);
}

// A digit alone is not an address: the value must start a street line, be a
// PO box, or end in a ZIP code.
const _STREET_START_RE = /^(?:PO\s?BOX\s?\d|\d{1,6}[A-Z]?\s+[A-Z0-9])/i;
const _ZIP_END_RE = /\b\d{5}(?:-\d{4})?\s*$/;

function _hasStreetShape(value) {
  const trimmed = (value || "").trim().replace(/^P\.\s?O\./i, "PO");
  return _STREET_START_RE.test(trimmed) || _ZIP_END_RE.test(trimmed);
}

const DD214_FIELD_PATTERNS = {
  // ===== BLOCK 1: Name =====
  fullName: {
    block: 1,
    label: "Name",
    patterns: [
      // Same line as the label, with or without the "(Last, First,
      // Middle)" printed hint - the hint is consumed as an optional
      // non-capturing group BEFORE `[:\s.]*` so it can't be captured as
      // the value on its own (which happened when the value was actually
      // on the next line and this pattern's only alternative was to grab
      // the hint text instead of failing outright). `(?:LAST\s*)?NAME`
      // also covers NGB-22's "1. LAST NAME" box wording, not just DD214's
      // plain "1. NAME" - previously only the bare fallback below applied
      // that alternative, so a clean same-line NGB-22 match fell through
      // to the far stricter fallback (or missed entirely). Every label
      // alternative REQUIRES the literal "NAME" text (never a bare
      // "BLOCK 1"/"ITEM 1" alone) - alternation tries left-to-right and
      // stops at the first alternative that lets the OVERALL match
      // succeed, so a bare "ITEM 1" alternative would win on "ITEM 1.
      // LAST NAME: DOE..." before the longer, correct alternative ever
      // got a chance, capturing "LAST NAME" itself as the value. The value
      // class excludes `\n` and `|` (unlike the other block patterns
      // below) - this pattern's whole point is "same line as the label",
      // and letting it cross a newline or a pipe table-border let it eat
      // straight into the NEXT box's label or column value whenever the
      // real value box was empty or pipe-delimited (D16-5 regression).
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the optional parenthetical-hint/label alternation, not backtracking; bounded {0,60} capture
      /(?:BLOCK\s*1|BOX\s*1|ITEM\s*1|1)[.\s]{0,10}(?:LAST\s*)?NAME(?:\s*\([^)\n]{0,60}\))?[ \t:.]*([A-Z][A-Z,;.' \t_-]+)/i,
      // Row-wise/OCR label-above-value layout, tolerant of arbitrary OCR
      // garbage trailing the label (a mangled hint, a stray table-border
      // character) rather than only the one specific "(Last, First,
      // Middle)" parenthetical - bounded and newline-excluded before the
      // required `\n` literal, so an unbounded run of junk still can't
      // overlap the `\n` it precedes and force backtracking through every
      // split point on a long blank run (ReDoS regression class). The
      // captured value itself is also newline/pipe-excluded (see above) -
      // it may only ever be the ONE line/column immediately following the
      // label, never that plus whatever comes after it.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label alternation count, not backtracking; every quantifier bounded
      /(?:BLOCK\s*1|BOX\s*1|ITEM\s*1|1)[.\s]{0,10}(?:LAST\s*)?NAME[^\n]{0,60}\n[ \t]{0,20}([A-Z][A-Z,;.' \t_-]{2,80})/i,
      /NAME[:\s]*(?:\(?LAST,?\s*FIRST,?\s*(?:AND\s*)?MIDDLE\)?)[ \t:.]*([A-Z][A-Z,;.' \t_-]+)/i,
      // Bare "LAST, FIRST[, MIDDLE]" line fallback - anchored via a bounded
      // lookbehind requiring a "1. NAME" (or NGB-22's "1. LAST NAME")
      // label within the preceding 200 chars, so a bare "CITY, STATE" line
      // elsewhere in the document (Box 7b's home of record, an address
      // block) is never mistaken for the veteran's name just because it's
      // the first comma-separated CAPS pair the whole-document scan finds.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the bounded {0,200} lookbehind window, not backtracking (fixed-length alternation inside)
      /(?<=1\.?\s{0,10}(?:LAST\s{0,10})?NAME[\s\S]{0,200})(?:^|\n)\s{0,20}([A-Z]{2,}(?:\s*[,;]\s*[A-Z]{2,}){1,2})\s{0,20}(?:\n|$)/m,
    ],
    // A LABEL-anchored match is trusted even without comma/semicolon
    // punctuation - OCR frequently drops commas/periods entirely, and the
    // capture class already stops at the next box's leading digit, so
    // "DOE JOHN A" (no comma at all) is still a confident match. The bare
    // fallback above doesn't need the word-count branch: its own capture
    // group requires a comma/semicolon by construction, so `hasSeparator`
    // is already true for anything it can possibly match. NAME_LABEL_LEAK_RE
    // rejects a capture that is actually another box's label/branch text
    // (see D16-5 regression comment above) - "correct or empty" over a
    // best-effort guess.
    validate: (val) => {
      const trimmed = (val || "").trim();
      if (trimmed.length < 3 || trimmed.length > 80) return false;
      if (NAME_LABEL_LEAK_RE.test(trimmed)) return false;
      if (_isPrintedLabelVocabulary(trimmed)) return false;
      const hasSeparator = /[,;]/.test(trimmed);
      const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
      return hasSeparator || wordCount >= 2;
    },
    normalize: (val) => val.replace(/[|_]+/g, " ").replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 2: Department, Component, Branch =====
  departmentComponentBranch: {
    block: 2,
    label: "Department/Component/Branch",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the branch/label alternation count, not backtracking; bounded for S8786 above
      /(?:BLOCK\s{0,10}2|BOX\s{0,10}2|2\.\s{0,10}DEPARTMENT)[:\s.]{0,20}([A-Z/\s]{1,60}(?:ARMY|NAVY|AIR\s{0,10}FORCE|MARINE|COAST\s{0,10}GUARD|SPACE\s{0,10}FORCE)[A-Z/\s]{0,60})/i,
      /DEPARTMENT[,\s]*COMPONENT[,\s]*(?:AND\s*)?BRANCH[:\s.]*([A-Z][A-Z/\s]*)/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /((?:ARMY|NAVY|AIR\s*FORCE|MARINES?|COAST\s*GUARD|SPACE\s*FORCE)\s*\/\s*(?:ACTIVE|ARNG|USAR|RESERVE|NATIONAL\s*GUARD|RA|USN|USAF|USMC|USCG))/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim().toUpperCase(),
  },

  // ===== BLOCK 3: SSN =====
  ssn: {
    block: 3,
    label: "Social Security Number",
    patterns: [
      // The box-number alternatives (BLOCK/BOX/ITEM 3) previously stood
      // in for the label text entirely, so a re-numbered form whose real
      // Block 3 is something else ("ITEM 3. SERVICE NUMBER") still matched
      // and handed that field's digits to ssnLast4 - the box number is now
      // only ever an OPTIONAL prefix; the literal SOCIAL text is mandatory
      // regardless. `\b` after the digit also stops "ITEM 3" from
      // partial-matching inside "ITEM 32"/"ITEM 35" etc.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the optional "SECURITY NUMBER" suffix alternation, not backtracking
      /(?:(?:BLOCK|BOX|ITEM)\s*3\b[.\s]{0,10}|3\.\s{0,10})?SOCIAL(?:\s*SECURITY(?:\s*NUMBER)?)?[:\s.]*(\d{3}[\s|.-]*\d{2}[\s|.-]*\d{4})/i,
      // Row-wise/OCR label-above-value layout, tolerant of arbitrary OCR
      // garbage trailing the label line ("SOCIAL SECURITY.N", where OCR
      // mangled "NO." into ".N") rather than only one specific punctuation
      // shape - bounded and newline-excluded before the required `\n`
      // literal, same ReDoS-avoidance reasoning as the other row-split
      // patterns in this file. Same mandatory-label fix as above.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label alternation count, not backtracking; every quantifier bounded
      /(?:(?:BLOCK|BOX|ITEM)\s*3\b[.\s]{0,10}|3\.\s{0,10})?SOCIAL(?:\s*SECURITY)?[^\n]{0,25}\n[ \t]{0,20}(\d{3}[\s|.-]*\d{2}[\s|.-]*\d{4})/i,
      // Label-only row-split, no box number required at all - covers a
      // form (e.g. NGB-22) that numbers this box differently than DD214's
      // Block 3, since the label text itself is what OCR actually printed.
      // The value row is scanned lazily up to 60 chars (not just its
      // leading whitespace) so a shared row that concatenates several
      // fields' printed values before the SSN ("DOE, JOHN ALAN ARMY/RA
      // 123 45 6789") still recovers the last 4 - still label-anchored,
      // unlike the fully-unanchored fallback removed below.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the "NUMBER" suffix alternation, not backtracking; every quantifier bounded
      /(?:SOCIAL\s*SECURITY(?:\s*NUMBER)?|SSN|S\.?S\.?N\.?)[^\n]{0,25}\n[^\n]{0,60}?(\d{3}[\s|.-]*\d{2}[\s|.-]*\d{4})\b/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the optional "NUMBER" suffix alternation, not backtracking
      /(?:SOCIAL\s*SECURITY(?:\s*NUMBER)?|SSN|S\.?S\.?N\.?)[:\s#.]*(\d{3}[\s|.-]*\d{2}[\s|.-]*\d{4})/i,
      // Same-line label-only, lazy bounded scan - recovers a pipe-delimited
      // table cell ("| 3. SOCIAL SECURITY NUMBER | 123-45-6789") where the
      // value isn't immediately adjacent to the label. Still requires the
      // literal label text within 25 chars, so this is not the unanchored
      // fallback removed below.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the optional "NUMBER" suffix alternation, not backtracking; every quantifier bounded
      /(?:SOCIAL\s*SECURITY(?:\s*NUMBER)?|SSN|S\.?S\.?N\.?)[^\n]{0,25}?(\d{3}[\s|.-]*\d{2}[\s|.-]*\d{4})\b/i,
      // D16-5 regression: the previous last-resort fallback here matched
      // ANY bare 9-digit-shaped run anywhere in the document with no label
      // at all - it once grabbed an unrelated number and, because
      // ssnLast4 only fills a gap the model left empty, silently overrode
      // the model with a WRONG last-4. Removed outright rather than
      // tightened: with no label context whatsoever there is no way to be
      // confident it's actually the SSN, and a wrong SSN digit is worse
      // than a blank field (see DD214Analyzer.jsx's identifier-field
      // precedence, which now only trusts a value this parser is
      // confident about).
    ],
    sensitive: true,
    normalize: (val) => {
      const digits = val.replace(/\D/g, "");
      return digits.length === 9 ? digits : val;
    },
    extractLast4: (val) => {
      const digits = val.replace(/\D/g, "");
      return digits.length >= 4 ? digits.slice(-4) : "";
    },
  },

  // ===== BLOCK 4a: Grade/Rate/Rank =====
  rank: {
    block: "4a",
    label: "Grade/Rate/Rank",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*4\s*A|BOX\s*4\s*A|4\s*A\.?\s*(?:GRADE|RANK))[:\s.]*([A-Z0-9]{2,10})/i,
      /(?:GRADE[,\s]*RATE[,\s]*(?:OR\s*)?RANK)[:\s.]*([A-Z]{2,4}\d?)/i,
    ],
    normalize: (val) => val.trim().toUpperCase(),
  },

  // ===== BLOCK 4b: Pay Grade =====
  payGrade: {
    block: "4b",
    label: "Pay Grade",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*4\s*B|BOX\s*4\s*B|4\s*B\.?\s*PAY\s*GRADE)[:\s.]*([EWO]-?\d{1,2})/i,
      /PAY\s*GRADE[:\s.]*([EWO]-?\d{1,2})/i,
      /\b([EWO][- ]?\d{1,2})\b/,
    ],
    normalize: (val) => {
      const clean = val.replace(/\s/g, "").toUpperCase();
      // Normalize E1 -> E-1, O3 -> O-3, etc.
      return clean.replace(/^([EWO])(\d)/, "$1-$2");
    },
  },

  // ===== BLOCK 5: Date of Birth =====
  dateOfBirth: {
    block: 5,
    label: "Date of Birth",
    patterns: [
      // The trailing alternative here (and in every DOB pattern below)
      // adds "DD MMM YYYY" (e.g. "15 JAN 1985") - common on
      // typewriter/Vietnam-Cold-War-era DD214s and NGB-22s, which never
      // print a bare YYYYMMDD-style date at all. A 2-digit year is
      // deliberately not accepted anywhere in this shape - see
      // normalizeDate - guessing the century would be a wrong value.
      // The box-number alternatives (BLOCK/BOX/ITEM 5) previously stood in
      // for the label text entirely, so a re-numbered form whose real
      // Block 5 is something else ("ITEM 5. DATE OF ENLISTMENT") still
      // matched and handed that field's date to dateOfBirth - the box
      // number is now only ever an OPTIONAL prefix; the literal "DATE OF
      // BIRTH" text is mandatory regardless. `\b` after the digit also
      // stops "ITEM 5" from partial-matching inside "ITEM 52"/"ITEM 59".
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:(?:BLOCK|BOX|ITEM)\s*5\b[.\s]{0,10}|5\.\s{0,10})?DATE\s*OF\s*BIRTH(?:\s*\([^)\n]{0,20}\))?[:\s.]*(\d{4}\s*\d{2}\s*\d{2}|\d{8}|\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2}|\d{1,2}\s{1,3}[A-Z]{3}\.?\s{1,3}\d{4})/i,
      // Row-wise/OCR label-above-value layout, tolerant of arbitrary OCR
      // garbage trailing the label (not only the specific "(YYYYMMDD)"
      // hint) before the required `\n` literal - bounded and
      // newline-excluded for the same ReDoS-avoidance reason as the
      // fullName/SSN next-line patterns above. Same mandatory-label fix.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label/value-shape alternation, not backtracking; every quantifier bounded
      /(?:(?:BLOCK|BOX|ITEM)\s*5\b[.\s]{0,10}|5\.\s{0,10})?DATE\s*OF\s*BIRTH[^\n]{0,30}\n[ \t]{0,20}(\d{4}\s*\d{2}\s*\d{2}|\d{8}|\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2}|\d{1,2}\s{1,3}[A-Z]{3}\.?\s{1,3}\d{4})/i,
      // Row-wise OCR can also print an UNRELATED field's short value ("E4"
      // pay grade) before the actual DOB digits on that same value line -
      // skip up to 30 non-newline chars (lazily, so it stops at the
      // EARLIEST 8-digit run rather than the latest) to find the bare
      // YYYYMMDD run, word-bounded on both sides so it can't start or end
      // mid-number. Same mandatory-label fix.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the optional parenthetical-hint alternation, not backtracking; every quantifier bounded
      /(?:(?:BLOCK|BOX|ITEM)\s*5\b[.\s]{0,10}|5\.\s{0,10})?DATE\s*OF\s*BIRTH[^\n]{0,30}\n[^\n]{0,30}?\b(\d{8})\b/i,
      // Label-only row-split, no box number required at all - covers a
      // form (e.g. NGB-22) that numbers this box differently than DD214's
      // Block 5.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the value-shape alternation, not backtracking; every quantifier bounded
      /DATE\s*OF\s*BIRTH[^\n]{0,30}\n[ \t]{0,20}(\d{4}\s*\d{2}\s*\d{2}|\d{8}|\d{2}[/-]\d{2}[/-]\d{4}|\d{1,2}\s{1,3}[A-Z]{3}\.?\s{1,3}\d{4})/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /DATE\s*OF\s*BIRTH(?:\s*\([^)\n]{0,20}\))?[:\s.]*(\d{4}\s*\d{2}\s*\d{2}|\d{8}|\d{2}[/-]\d{2}[/-]\d{4}|\d{1,2}\s{1,3}[A-Z]{3}\.?\s{1,3}\d{4})/i,
    ],
    // A swapped-column OCR layout (this box's VALUE line is actually the
    // NEXT box's, because the values were printed one row higher than
    // their labels) still produces a syntactically valid YYYYMMDD-shaped
    // date, so the shape checks above can't catch it. A birth year that
    // would make the veteran younger than the minimum US enlistment age
    // (17) or older than 100 is implausible for a DD214 - reject rather
    // than show it. This does not recover the true DOB in that layout
    // (there is no reliable signal to do so from text alone) but it does
    // stop the wrong value from ever displaying, per the "correct or
    // empty, never wrong" rule.
    validate: (val) => {
      if (!val) return false;
      const year = Number.parseInt(val.slice(0, 4), 10);
      if (!Number.isFinite(year)) return false;
      const currentYear = new Date().getFullYear();
      return year <= currentYear - 17 && year >= currentYear - 100;
    },
    normalize: (val) => normalizeDate(val),
  },

  // ===== BLOCK 6: Reserve Obligation Termination Date =====
  reserveObligationDate: {
    block: 6,
    label: "Reserve Obligation Termination Date",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*6|BOX\s*6|6\.\s*RESERVE\s*OBLIG)[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the OCR-typo alternation count, not backtracking; bounded for S8786 above
      /RESERVE\s{0,10}(?:OBLIG(?:ATION)?|IBLIGATION)\s{0,10}(?:TERM(?:INATION)?\.?\s{0,10}DATE)?[:\s.]{0,20}(\d{4}[\s|]{0,10}\d{2}[\s|]{0,10}\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeDate(val),
  },

  // ===== BLOCK 7a: Place of Entry into Active Duty =====
  placeOfEntry: {
    block: "7a",
    label: "Place of Entry into Active Duty",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*7\s*A|BOX\s*7\s*A|7\s*A\.?\s*PLACE\s*OF\s*ENTRY)[:\s.]*([A-Z][A-Z,.\s]+(?:,\s*[A-Z]{2}))/i,
      /PLACE\s{0,10}OF\s{0,10}ENTRY\s{0,10}(?:INTO\s{0,10}(?:ACTIVE\s{0,10})?DUTY)?[:\s.]{0,20}([A-Z][A-Z,.\s]{1,100}(?:,\s{0,10}[A-Z]{2,10}))/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 7b: Home of Record =====
  homeOfRecord: {
    block: "7b",
    label: "Home of Record at Time of Entry",
    patterns: [
      // The label's own sub-box letter can appear as "7B." or "7.b" (dot
      // BEFORE the letter), and the full printed label often continues
      // "...AT TIME OF ENTRY" plus a parenthetical hint - both consumed
      // here as optional non-capturing text so neither pollutes the value.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label/"AT TIME OF ENTRY"/parenthetical-hint alternation count, not backtracking; bounded {10,100} capture for S8786 above. `B` (not `[Bb]`) since /i already covers case.
      /(?:BLOCK\s{0,10}7\s{0,10}B|BOX\s{0,10}7\s{0,10}B|ITEM\s{0,10}7\s{0,10}B|7\s{0,10}\.?\s{0,10}B\.?)\s{0,10}HOME\s{0,10}OF\s{0,10}RECORD(?:\s{0,10}AT\s{0,10}TIME\s{0,10}OF\s{0,10}ENTRY)?(?:\s{0,10}\([^)\n]{0,80}\))?[:\s.]{0,20}([\s\S]{10,100}?)(?=\n\s{0,10}(?:BLOCK|BOX|ITEM|8\s{0,10}A|\d+\.))/i,
      // Label-only, no box number required at all - a form (e.g. NGB-22)
      // may number this box differently than DD214's Block 7b, or OCR may
      // simply lose the box number while still printing the label text.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the "AT TIME OF ENTRY"/parenthetical-hint/next-block alternation count, not backtracking; bounded {10,100} capture
      /HOME\s{0,10}OF\s{0,10}RECORD(?:\s{0,10}AT\s{0,10}TIME\s{0,10}OF\s{0,10}ENTRY)?(?:\s{0,10}\([^)\n]{0,80}\))?[:\s.]{0,20}([\s\S]{10,100}?)(?=\n\s{0,10}(?:BLOCK|BOX|ITEM|8|\d+\.))/i,
      // Flattened-OCR fallback: the whole page collapsed onto one line, so
      // there is no `\n` for the two lookahead-based patterns above to
      // anchor on at all. Stops at the next recognizable box/label token
      // (bounded, no `\n` required) or end of string instead, and the
      // capture must start with a letter so it can't grab a label token
      // itself.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label alternation count, not backtracking; every quantifier bounded
      /HOME\s{0,10}OF\s{0,10}RECORD(?:\s{0,10}AT\s{0,10}TIME\s{0,10}OF\s{0,10}ENTRY)?(?:\s{0,10}\([^)\n]{0,80}\))?[:\s.]{0,20}([A-Z][A-Z0-9,.\s'-]{4,80}?)(?=\s{1,10}(?:BLOCK|BOX|ITEM|8\s{0,10}A|\d+\s{0,10}[A-Z]?\.)|$)/i,
    ],
    // D16-5: guards against the "found as OCR junk" failure mode - a
    // multi-line lookahead that skipped past a stray box-number-shaped
    // artifact could truncate the real value and splice in noise, or (on
    // a flattened single-line OCR page) ran straight through the "19.B
    // NEAREST RELATIVE"/"8A. LAST DUTY ASSIGNMENT" boxes that follow this
    // one. A value that's mostly non-letters (digits/symbols), that
    // swallowed another box's own label word, or that absorbed a
    // neighbouring box's content is rejected outright rather than shown.
    // "BOX" is deliberately NOT in the reject list - real addresses
    // legitimately contain it ("PSC 123 BOX 4567 APO AE 09012"), so
    // blocking on it lost correct addresses base found. The letters-ratio
    // floor is intentionally low (not majority-letters): a legitimate
    // street address is often mostly digits (house number, ZIP) - this
    // still catches near-all-digit/symbol OCR junk (ratio 0), just not
    // real numeric-heavy addresses.
    validate: (val) => {
      const trimmed = (val || "").replace(/\s+/g, " ").trim();
      if (trimmed.length < 5 || trimmed.length > 100) return false;
      if (
        /\b(?:BLOCK|ITEM|NOTHING\s*FOLLOWS|NEAREST\s*RELATIVE|LAST\s*DUTY|MAJOR\s*COMMAND)\b/i.test(
          trimmed,
        )
      )
        return false;
      if (_isPrintedLabelVocabulary(trimmed)) return false;
      if (!_hasCityStateShape(trimmed)) return false;
      const letters = (trimmed.match(/[A-Za-z]/g) || []).length;
      return letters / trimmed.length >= 0.2;
    },
    normalize: (val) =>
      _stripLeadingPrintedInstruction(val)
        .replaceAll("\n", ", ")
        .replace(/\s+/g, " ")
        .trim(),
  },

  // ===== BLOCK 8a: Last Duty Assignment =====
  // D19-4 follow-up: the printed box label is "LAST DUTY ASSIGNMENT AND
  // MAJOR COMMAND", not just "LAST DUTY" - neither pattern consumed
  // "ASSIGNMENT"/"AND MAJOR COMMAND" as part of the label, so on the
  // form's own real wording those words (letters, not colon/space/period)
  // stopped the old `[:\s.]*` separator from matching past them, and the
  // VALUE capture started there instead, swallowing "ASSIGNMENT AND MAJOR
  // COMMAND" itself. The value class also had no stopping boundary at all
  // (its own char class allows the newline `\s` matches), so on a
  // newline-separated layout it ran straight through the 8B box too. Both
  // patterns now consume the full label (the "AND MAJOR COMMAND" suffix is
  // optional - some layouts/OCR drop it) and stop the value at the next
  // recognizable box marker or end of string - using `\s{1,10}` rather
  // than a literal `\n` so the SAME pattern stops correctly whether the
  // next box is on its own line or the whole page flattened onto one
  // (mirroring homeOfRecord's own stopping lookahead above).
  lastDutyAssignment: {
    block: "8a",
    label: "Last Duty Assignment and Major Command",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*8\s*A|BOX\s*8\s*A|8\s*A\.?\s*LAST\s*DUT[YE])(?:\s*ASSIGNMENT(?:\s*AND\s*MAJOR\s*COMMAND)?)?[:\s.]*([A-Z0-9][A-Z0-9()\s/,.-]+?)(?=\s{1,10}(?:BLOCK|BOX|ITEM|8\s{0,10}B|STATION\s{0,10}WHERE\s{0,10}SEPARATED|\d+\s{0,10}[A-Z]?\.)|$)/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- same stopping lookahead as the pattern above, same verification
      /LAST\s*DUT[YE]\s*ASSIGNMENT(?:\s*AND\s*MAJOR\s*COMMAND)?[:\s.]*([A-Z0-9][A-Z0-9()\s/,.-]+?)(?=\s{1,10}(?:BLOCK|BOX|ITEM|8\s{0,10}B|STATION\s{0,10}WHERE\s{0,10}SEPARATED|\d+\s{0,10}[A-Z]?\.)|$)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 8b: Station Where Separated =====
  stationWhereSeparated: {
    block: "8b",
    label: "Station Where Separated",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*8\s*B|BOX\s*8\s*B|8\s*B\.?\s*STATION)[:\s.]*([A-Z][A-Z,.\s0-9-]+(?:,\s*[A-Z]{2}))/i,
      /STATION\s*(?:WHERE\s*)?SEPARATED[:\s.]*([A-Z][A-Z,.\s0-9-]+)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 9: Command to Which Transferred =====
  commandTransferredTo: {
    block: 9,
    label: "Command to Which Transferred",
    patterns: [
      /(?:BLOCK\s*9|BOX\s*9|9\.\s*COMMAND)[:\s.]*([A-Z0-9][A-Z0-9()\s/,.-]+)/i,
      /COMMAND\s*(?:TO\s*WHICH\s*)?TRANSFERRED[:\s.]*([A-Z0-9][A-Z0-9()\s/,.-]+)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 10: SGLI Coverage =====
  sglCoverage: {
    block: 10,
    label: "SGLI Coverage Amount",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label alternation count, not backtracking; bounded for S8786 above
      /(?:BLOCK\s{0,10}10|BOX\s{0,10}10|10\.\s{0,10}SGLI?\s{0,10}COVERAGE)[:\s.]{0,20}\$?\s{0,10}([\d,]{1,20}(?:\.\d{2})?)/i,
      /SGLI?\s{0,10}(?:COVERAGE)?[:\s.]{0,20}\$?\s{0,10}([\d,]{1,20}(?:\.\d{2})?)/i,
    ],
    normalize: (val) => val.replace(/\s/g, ""),
  },

  // ===== BLOCK 11: Primary Specialty (MOS) =====
  primarySpecialty: {
    block: 11,
    label: "Primary Specialty (MOS/AFSC/Rating)",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label alternation count, not backtracking; bounded for S8786 above
      /(?:BLOCK\s{0,10}11|BOX\s{0,10}11|11\.\s{0,10}PRIMARY\s{0,10}SPECIALTY)[:\s.]{0,20}([A-Z0-9][A-Z0-9\s/,.-]{1,100000}?)(?=\/\/|NOTHING\s{0,10}FOLLOWS|\n\s{0,10}(?:BLOCK|BOX|12))/i,
      /PRIMARY\s{0,10}SPECIALTY[:\s.]{0,20}([A-Z0-9][A-Z0-9\s/,.-]{1,100000}?)(?=\/\/|NOTHING\s{0,10}FOLLOWS|\n)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
    extractMOS: (val) => {
      // Extract MOS code like 92Y10, 11B30, 68W10
      const mosMatch = val.match(/\b(\d{2}[A-Z]\d{2})\b/);
      return mosMatch ? mosMatch[1] : null;
    },
    extractTitle: (val) => {
      // Remove MOS code and time-in-specialty to get just the title
      const cleaned = val
        .replace(/\b\d{2}[A-Z]\d{2}\s*/i, "")
        // \d{1,3} not \d+: time-in-specialty is always 1-3 digits, and
        // unbounded \d+ is O(n²) on adversarial all-digit input (confirmed
        // 3.5s+ at 50k chars) since `val` inherits primarySpecialty's own
        // unbounded worst case.
        .replace(/\d{1,3}\s*(?:YRS?|MOS?)[\s-]*/gi, "")
        .replace(/\b\d{2}\b/g, "")
        .replace(/\/\/.{0,200}$/i, "")
        .replace(/NOTHING\s*FOLLOWS.*/i, "")
        .replace(/[-–—]+/g, "")
        .trim();
      return cleaned || null;
    },
  },

  // ===== BLOCK 12a: Date Entered Active Duty This Period =====
  entryDate: {
    block: "12a",
    label: "Date Entered Active Duty This Period",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*12\s*A|BOX\s*12\s*A|12\s*A\.?\s*DATE\s*ENTERED)[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the optional-group alternation count, not backtracking; bounded for S8786 above
      /DATE\s{0,10}ENTERED\s{0,10}(?:AD|ACTIVE\s{0,10}DUTY)\s{0,10}(?:THIS\s{0,10}PERIOD)?[:\s.]{0,20}(\d{4}[\s|]{0,10}\d{2}[\s|]{0,10}\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeDate(val),
  },

  // ===== BLOCK 12b: Separation Date =====
  separationDate: {
    block: "12b",
    label: "Separation Date This Period",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*12\s*B|BOX\s*12\s*B|12\s*B\.?\s*SEPARATION\s*DATE)[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the optional-group alternation count, not backtracking; bounded for S8786 above
      /SEPARATION\s{0,10}DATE\s{0,10}(?:THIS\s{0,10}PERIOD)?[:\s.]{0,20}(\d{4}[\s|]{0,10}\d{2}[\s|]{0,10}\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeDate(val),
  },

  // ===== BLOCK 12c: Net Active Service This Period =====
  netActiveService: {
    block: "12c",
    label: "Net Active Service This Period",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*12\s*C|BOX\s*12\s*C|12\s*C\.?\s*NET\s*ACTIVE)[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the optional-group alternation count, not backtracking; bounded for S8786 above
      /NET\s{0,10}ACTIVE\s{0,10}SERVICE\s{0,10}(?:THIS\s{0,10}PERIOD)?[:\s.]{0,20}(\d{4}[\s|]{0,10}\d{2}[\s|]{0,10}\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeServiceTime(val),
  },

  // ===== BLOCK 12d: Total Prior Active Service =====
  totalPriorActiveService: {
    block: "12d",
    label: "Total Prior Active Service",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*12\s*D|BOX\s*12\s*D|12\s*D\.?\s*TOTAL\s*PRIOR\s*ACTIVE)[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      /TOTAL\s*PRIOR\s*ACTIVE\s*SERVICE[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeServiceTime(val),
  },

  // ===== BLOCK 12e: Total Prior Inactive Service =====
  totalPriorInactiveService: {
    block: "12e",
    label: "Total Prior Inactive Service",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*12\s*E|BOX\s*12\s*E|12\s*E\.?\s*TOTAL\s*PRIOR\s*INACTIVE)[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      /TOTAL\s*PRIOR\s*INACTIVE\s*SERVICE[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeServiceTime(val),
  },

  // ===== BLOCK 12f: Foreign Service =====
  foreignServiceTime: {
    block: "12f",
    label: "Foreign Service",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*12\s*F|BOX\s*12\s*F|12\s*F\.?\s*FOREIGN\s*SERVICE)[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the optional-group alternation count, not backtracking; bounded for S8786 above
      /FOREIGN\s{0,10}SERVICE[,\s]{0,10}(?:SEA)?[:\s.]{0,20}(\d{4}[\s|]{0,10}\d{2}[\s|]{0,10}\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeServiceTime(val),
  },

  // ===== BLOCK 12g: Sea Service =====
  seaServiceTime: {
    block: "12g",
    label: "Sea Service",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*12\s*G|BOX\s*12\s*G|12\s*G\.?\s*SEA\s*SERVICE)[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      /SEA\s*SERVICE[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeServiceTime(val),
  },

  // ===== BLOCK 12h: Effective Date of Pay Grade =====
  dateOfRank: {
    block: "12h",
    label: "Effective Date of Pay Grade",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /(?:BLOCK\s*12\s*H|BOX\s*12\s*H|12\s*H\.?\s*EFFECTIVE\s*DATE)[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-terminating values (see 'ReDoS regression — BLOCK 2-12h field patterns')
      /EFFECTIVE\s*DATE\s*(?:OF\s*)?PAY\s*GRADE[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/i,
    ],
    normalize: (val) => normalizeDate(val),
  },

  // ===== BLOCK 13: Awards, Decorations, Medals =====
  awardsRaw: {
    block: 13,
    label: "Decorations, Medals, Badges, Citations",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label/next-block alternation count, not backtracking; bounded {0,5000} capture for S8786 above
      /(?:BLOCK\s{0,10}13|BOX\s{0,10}13|13\.\s{0,10}DECORATIONS)[:\s.]{0,20}([\s\S]{0,5000}?)(?=(?:\n\s{0,10}(?:BLOCK\s{0,10}14|BOX\s{0,10}14|14\.|MILITARY\s{0,10}EDUCATION))|$)/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label/next-block alternation count, not backtracking; bounded {0,5000} capture for S8786 above
      /DECORATIONS[,\s]{0,10}MEDALS[,\s]{0,10}BADGES[,\s]{0,10}(?:CITATIONS)?[:\s.]{0,20}([\s\S]{0,5000}?)(?=(?:\n\s{0,10}(?:BLOCK\s{0,10}14|BOX\s{0,10}14|14\.|MILITARY\s{0,10}EDUCATION))|$)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 14: Military Education =====
  militaryEducation: {
    block: 14,
    label: "Military Education",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label/next-block alternation count, not backtracking; bounded {0,5000} capture for S8786 above
      /(?:BLOCK\s{0,10}14|BOX\s{0,10}14|14\.\s{0,10}MILITARY\s{0,10}EDUCATION)[:\s.]{0,20}([\s\S]{0,5000}?)(?=(?:\n\s{0,10}(?:BLOCK\s{0,10}15|BOX\s{0,10}15|15\.))|$)/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the next-block alternation count, not backtracking; bounded {0,5000} capture for S8786 above
      /MILITARY\s{0,10}EDUCATION[:\s.]{0,20}([\s\S]{0,5000}?)(?=(?:\n\s{0,10}(?:BLOCK\s{0,10}15|BOX\s{0,10}15|15\.))|$)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 18: Remarks =====
  remarks: {
    block: 18,
    label: "Remarks",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label/next-block alternation count, not backtracking; bounded {0,5000} capture for S8786 above
      /(?:BLOCK\s{0,10}18|BOX\s{0,10}18|18\.\s{0,10}REMARKS)[:\s.]{0,20}([\s\S]{0,5000}?)(?=(?:\n\s{0,10}(?:BLOCK\s{0,10}19|BOX\s{0,10}19|19\.|MAILING))|$)/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the next-block alternation count, not backtracking; bounded {0,5000} capture for S8786 above
      /REMARKS[:\s.]{0,20}([\s\S]{0,5000}?)(?=(?:\n\s{0,10}(?:BLOCK\s{0,10}19|BOX\s{0,10}19|19\.|MAILING))|$)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 19: Mailing Address =====
  mailingAddress: {
    block: 19,
    label: "Mailing Address After Separation",
    patterns: [
      // The box number can carry a sub-item letter ("19a.") and this
      // field also covers Block 30's "HOME ADDRESS" wording on layouts
      // that use that numbering instead. "AFTER SEPARATION" and a
      // parenthetical hint ("(INCLUDE ZIP CODE)") are both consumed as
      // part of the label so neither pollutes the captured value.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label/next-block alternation count, not backtracking; bounded {10,150} capture for S8786 above. `[A-Z]` (not `[A-Za-z]`) since /i already covers case.
      /(?:BLOCK\s{0,10}(?:19|30)|BOX\s{0,10}(?:19|30)|ITEM\s{0,10}(?:19|30)|(?:19|30)[A-Z]?\.?\s{0,10}(?:MAILING|HOME)\s{0,10}ADDRESS)(?:\s{0,10}AFTER\s{0,10}SEPARATION)?(?:\s{0,10}\([^)\n]{0,40}\))?[:\s.]{0,20}([\s\S]{10,150}?)(?=\n\s{0,10}(?:19[.\s]{0,10}B|BLOCK\s{0,10}20|BOX\s{0,10}20|ITEM\s{0,10}20|20\.))/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the next-block alternation count, not backtracking; bounded {10,150} capture for S8786 above
      /(?:MAILING|HOME)\s{0,10}ADDRESS(?:\s{0,10}AFTER\s{0,10}SEPARATION)?(?:\s{0,10}\([^)\n]{0,40}\))?[:\s.]{0,20}([\s\S]{10,150}?)(?=\n\s{0,10}(?:19[.\s]{0,10}B|BLOCK\s{0,10}20|BOX\s{0,10}20|ITEM\s{0,10}20|20\.))/i,
      // Flattened-OCR fallback, same reasoning as homeOfRecord above: no
      // `\n` exists at all for the lookahead-based patterns to anchor on.
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label alternation count, not backtracking; every quantifier bounded
      /(?:MAILING|HOME)\s{0,10}ADDRESS(?:\s{0,10}AFTER\s{0,10}SEPARATION)?(?:\s{0,10}\([^)\n]{0,40}\))?[:\s.]{0,20}([A-Z0-9][A-Z0-9,.\s'-]{9,100}?)(?=\s{1,10}(?:19[.\s]{0,10}B|BLOCK|BOX|ITEM|20\s{0,10}[A-Z]?\.)|$)/i,
    ],
    // Addresses skew more numeric than homeOfRecord (street number, ZIP),
    // so the letters-ratio floor is lower - same OCR-junk guard, tuned for
    // this field's shape. "BOX" is deliberately not in the reject list -
    // see homeOfRecord's validate() above for why. "NEAREST RELATIVE" is
    // Block 19.b's own label, immediately following this one on a
    // flattened single-line OCR page - reject a capture that absorbed it
    // rather than show someone else's name/address as the veteran's own.
    validate: (val) => {
      const trimmed = (val || "").replace(/\s+/g, " ").trim();
      if (trimmed.length < 10 || trimmed.length > 150) return false;
      if (
        /\b(?:BLOCK|ITEM|NOTHING\s*FOLLOWS|NEAREST\s*RELATIVE)\b/i.test(trimmed)
      )
        return false;
      if (_isPrintedLabelVocabulary(trimmed)) return false;
      if (!_hasStreetShape(trimmed) && !_hasCityStateShape(trimmed))
        return false;
      const letters = (trimmed.match(/[A-Za-z]/g) || []).length;
      return letters / trimmed.length >= 0.15;
    },
    normalize: (val) =>
      _stripLeadingPrintedInstruction(val)
        .replaceAll("\n", ", ")
        .replace(/\s+/g, " ")
        .trim(),
  },

  // ===== BLOCK 23: Type of Separation =====
  separationType: {
    block: 23,
    label: "Type of Separation",
    patterns: [
      /(?:BLOCK\s*23|BOX\s*23|23\.\s*TYPE\s*OF\s*SEPARATION)[:\s.]*([A-Z][A-Z\s]+)/i,
      /TYPE\s*OF\s*SEPARATION[:\s.]*([A-Z][A-Z\s]+)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 24: Character of Service =====
  characterOfService: {
    block: 24,
    label: "Character of Service",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-matching values (see 'ReDoS regression — discharge/code fields')
      /(?:BLOCK\s*24|BOX\s*24|24\.\s*CHARACTER\s*OF\s*SERVICE)[:\s.]*(HONORABLE|GENERAL(?:\s*UNDER\s*HONORABLE\s*CONDITIONS)?|(?:OTHER\s*THAN\s*HONORABLE|OTH)|DISHONORABLE|BAD\s*CONDUCT|UNCHARACTERIZED)/i,
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on long non-matching values (see 'ReDoS regression — discharge/code fields')
      /CHARACTER\s*OF\s*(?:SERVICE|DISCHARGE)[:\s.]*(HONORABLE|GENERAL(?:\s*UNDER\s*HONORABLE\s*CONDITIONS)?|(?:OTHER\s*THAN\s*HONORABLE|OTH)|DISHONORABLE|BAD\s*CONDUCT|UNCHARACTERIZED)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 25: Separation Authority =====
  separationAuthority: {
    block: 25,
    label: "Separation Authority",
    patterns: [
      /(?:BLOCK\s*25|BOX\s*25|25\.\s*SEPARATION\s*AUTHORITY)[:\s.]*([A-Z0-9][A-Z0-9\s.,()-]+)/i,
      /SEPARATION\s*AUTHORITY[:\s.]*([A-Z0-9][A-Z0-9\s.,()-]+)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 26: Separation Code (SPD) =====
  separationCode: {
    block: 26,
    label: "Separation Code (SPD)",
    patterns: [
      /(?:BLOCK\s*26|BOX\s*26|26\.\s*SEPARATION\s*CODE)[:\s.]*([A-Z]{3})/i,
      /(?:SEPARATION\s*CODE|SPD(?:\s*CODE)?)[:\s.]*([A-Z]{3})/i,
    ],
    normalize: (val) => val.trim().toUpperCase(),
  },

  // ===== BLOCK 27: Reentry Code =====
  reentryCode: {
    block: 27,
    label: "Reentry Code (RE Code)",
    patterns: [
      /(?:BLOCK\s*27|BOX\s*27|27\.\s*REENTRY\s*CODE)[:\s.]*(RE?-?\d|N\/?A|NA)/i,
      /(?:REENTRY|RE-ENTRY|RE)\s{0,10}(?:CODE)?[:\s.]{0,20}(RE?-?\d|N\/?A|NA)/i,
    ],
    normalize: (val) => val.trim().toUpperCase(),
  },

  // ===== BLOCK 28: Narrative Reason for Separation =====
  narrativeReason: {
    block: 28,
    label: "Narrative Reason for Separation",
    patterns: [
      /(?:BLOCK\s*28|BOX\s*28|28\.\s*NARRATIVE\s*REASON)[:\s.]*([A-Z][A-Z\s]+)/i,
      /NARRATIVE\s*REASON\s*(?:FOR\s*)?SEPARATION[:\s.]*([A-Z][A-Z\s]+)/i,
    ],
    normalize: (val) => val.replace(/\s+/g, " ").trim(),
  },

  // ===== BLOCK 29: Dates of Time Lost =====
  daysLost: {
    block: 29,
    label: "Dates of Time Lost",
    patterns: [
      // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label/value alternation count, not backtracking; bounded for S8786 above
      /(?:BLOCK\s{0,10}29|BOX\s{0,10}29|29\.\s{0,10}DATES?\s{0,10}(?:OF\s{0,10})?TIME\s{0,10}LOST)[:\s.]{0,20}(NONE|\d{1,5}(?:\s{0,10}DAYS?)?|[\s\S]{0,500}?)(?=\n\s{0,10}(?:BLOCK\s{0,10}30|BOX\s{0,10}30|30\.))/i,
      /TIME\s*LOST[:\s.]*(NONE|\d+)/i,
    ],
    normalize: (val) => val.trim(),
  },
};

const MONTH_ABBREVIATIONS = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

/**
 * Normalize a date from DD214 format (YYYYMMDD, YYYY|MM|DD, or the
 * typewriter-era "DD MMM YYYY" shape, e.g. "15 JAN 1985") to YYYY-MM-DD.
 */
function normalizeDate(val) {
  if (!val) return null;
  // DD MMM YYYY - checked first since the month abbreviation makes it
  // fail the digit-only paths below cleanly anyway. A 2-digit year is
  // deliberately NOT accepted here - guessing the century would be a
  // wrong value, and this format always prints a 4-digit year when used.
  const monthNameMatch = val.match(
    /(\d{1,2})\s{1,3}([A-Z]{3})\.?\s{1,3}(\d{4})/i,
  );
  if (monthNameMatch) {
    const month = MONTH_ABBREVIATIONS[monthNameMatch[2].toUpperCase()];
    const day = Number.parseInt(monthNameMatch[1]);
    const year = Number.parseInt(monthNameMatch[3]);
    if (month && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return `${year}-${month}-${String(day).padStart(2, "0")}`;
    }
  }
  const cleaned = val.replace(/[\s|.-]/g, "");
  if (cleaned.length === 8 && /^\d{8}$/.test(cleaned)) {
    const y = cleaned.substring(0, 4);
    const m = cleaned.substring(4, 6);
    const d = cleaned.substring(6, 8);
    // Validate
    const year = Number.parseInt(y);
    const month = Number.parseInt(m);
    const day = Number.parseInt(d);
    if (
      year >= 1900 &&
      year <= 2100 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${y}-${m}-${d}`;
    }
  }
  // Try MM/DD/YYYY or MM-DD-YYYY
  const slashMatch = val.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1]}-${slashMatch[2]}`;
  }
  // Try YYYY-MM-DD already
  const isoMatch = val.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  return null;
}

/**
 * Normalize service time from YYYYMMDD format to {years, months, days}
 * DD214s encode service time as YYYYMMDD where YYYY=years, MM=months, DD=days
 */
function normalizeServiceTime(val) {
  if (!val) return null;
  const cleaned = val.replace(/[\s|.-]/g, "");
  if (cleaned.length >= 6 && /^\d+$/.test(cleaned)) {
    // Pad to 8 digits
    const padded = cleaned.padStart(8, "0");
    const years = Number.parseInt(padded.substring(0, 4));
    const months = Number.parseInt(padded.substring(4, 6));
    const days = Number.parseInt(padded.substring(6, 8));
    return { years, months, days };
  }
  return null;
}

/**
 * Extract the continuation text from remarks, trying a strict "CONT FROM
 * BLOCK 13/ITEM 13" match first, then falling back to a broader "just
 * listed" match. Returns the continuation text, or null if neither
 * strategy found anything.
 */
function _extractAwardsContinuationText(remarksText) {
  const contMatch = remarksText.match(
    // eslint-disable-next-line sonarjs/regex-complexity -- flagged on the label alternation count, not backtracking; bounded {0,5000} capture for S8786 above
    /(?:CONT(?:INUED?)?(?:\s{0,10}FROM)?\s{0,10}(?:BLOCK\s{0,10}13|ITEM\s{0,10}13)[:\s]{0,20})([\s\S]{0,5000}?)(?=\/\/\s{0,10}(?:NOTHING\s{0,10}FOLLOWS|$))/i,
  );
  if (contMatch) return contMatch[1];

  const broadMatch = remarksText.match(
    /(?:CONT\s{0,10}(?:FROM|IN)\s{0,10}(?:BLOCK\s{0,10}13))[:\s]{0,20}([\s\S]{0,5000}?)(?=\/\/\s{0,10}NOTHING|$)/i,
  );
  return broadMatch ? broadMatch[1] : null;
}

/**
 * Resolve the full awards text, appending any "CONT IN BLOCK 18"-style
 * continuation found in the remarks text.
 */
function resolveAwardsContinuationText(awardsRaw, remarksText) {
  let fullAwardsText = awardsRaw;

  // Check for continuation in Block 18
  const contPatterns = [
    /CONT(?:INUED?)?\s*(?:IN\s*)?(?:BLOCK\s*18|REMARKS)/i,
    /SEE\s*(?:BLOCK\s*18|REMARKS)/i,
    /CONT\s*(?:FROM|IN)\s*(?:BLOCK\s*13|ITEM\s*13)/i,
  ];

  // If remarks contain continuation, append
  if (remarksText) {
    for (const pat of contPatterns) {
      if (pat.test(awardsRaw) || pat.test(remarksText)) {
        const continuation = _extractAwardsContinuationText(remarksText);
        if (continuation !== null) {
          fullAwardsText += "//" + continuation;
        }
        break;
      }
    }
  }

  return fullAwardsText;
}

/**
 * Parse a single raw award entry into a structured award object,
 * extracting device information (devices/counts) and combat relevance.
 */
function parseSingleAward(raw) {
  const award = {
    raw: raw,
    name: raw,
    abbreviation: "",
    devices: [],
    deviceCount: 0,
    isCombat: false,
  };

  // Extract device information (e.g., "2ND AWARD", "W/ M DEVICE", "W/ 1 OLC")
  // Digit counts are bounded to 1-3 (\d{1,3}, not \d+): award/device counts
  // are always small, and unbounded \d+ with a required-but-possibly-absent
  // suffix is O(n²) on an all-digit adversarial `raw` -- confirmed 1s+ at
  // 50k chars, and `raw` inherits awardsRaw's own unbounded worst case
  // (Block 13 capturing to end-of-document when no Block 14 marker is
  // found). Verified behavior-identical for realistic values.
  const devicePatterns = [
    { pattern: /\((\d{1,3})(?:ST|ND|RD|TH)\s*AWARD\)/i, type: "award_count" },
    { pattern: /(\d{1,3})(?:ST|ND|RD|TH)\s*AWARD/i, type: "award_count" },
    { pattern: /-(\d{1,3})/i, type: "award_count_dash" },
    { pattern: /W\/?\s*'?M'?\s*DEVICE/i, type: "M Device" },
    { pattern: /W\/?\s*'?V'?\s*DEVICE/i, type: "V Device" },
    {
      pattern: /W\/?\s*(\d{1,3})\s*(?:OLC|OAK\s*LEAF)/i,
      type: "Oak Leaf Cluster",
    },
    {
      pattern: /W\/?\s*(\d{1,3})\s*(?:BRONZE\s*)?(?:SERVICE\s*)?STAR/i,
      type: "Bronze Service Star",
    },
  ];

  for (const dp of devicePatterns) {
    const match = raw.match(dp.pattern);
    if (match) {
      if (dp.type === "award_count" || dp.type === "award_count_dash") {
        award.deviceCount = Number.parseInt(match[1]);
        award.name = raw.replace(match[0], "").trim();
      } else if (dp.type === "M Device" || dp.type === "V Device") {
        award.devices.push(dp.type);
        award.name = raw.replace(match[0], "").trim();
      } else {
        const count = Number.parseInt(match[1]) || 1;
        for (let i = 0; i < count; i++) {
          award.devices.push(dp.type);
        }
        award.name = raw.replace(match[0], "").trim();
      }
    }
  }

  // Clean up name
  award.name = award.name
    .replace(/[-–—]{1,500}\s{0,20}$/, "")
    .replace(/\s+/g, " ")
    .trim();

  // Check if combat-related
  const combatIndicators = [
    /COMBAT\s*(?:ACTION|INFANTRY)/i,
    /PURPLE\s*HEART/i,
    /BRONZE\s*STAR/i,
    /SILVER\s*STAR/i,
    /V\s*DEVICE/i,
    /VALOR/i,
    /CAMPAIGN\s*MEDAL/i,
    /EXPEDITIONARY\s*MEDAL/i,
    /IMMINENT\s*DANGER/i,
  ];
  award.isCombat = combatIndicators.some((p) => p.test(raw));

  return award;
}

/**
 * Parse awards string into structured array
 * Handles // delimiters, "CONT IN BLOCK 18", device counts, etc.
 */
function parseAwardsString(awardsRaw, remarksText) {
  if (!awardsRaw) return [];

  const fullAwardsText = resolveAwardsContinuationText(awardsRaw, remarksText);

  // Split by // delimiter. Bounded whitespace either side (not \s*) --
  // awardsRaw above is unbounded in the worst case (no BLOCK 14 marker
  // found), and unbounded \s* adjacent to a literal is O(n²) when no
  // separator is present at all: confirmed 18s+ at 100k chars. Each
  // segment is .trim()'d below regardless, so a bound tighter than any
  // realistic separator gap is behavior-preserving.
  const rawAwards = fullAwardsText
    .split(/\s{0,20}\/\/\s{0,20}/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s &&
        !s.match(/^NOTHING\s*FOLLOWS$/i) &&
        !s.match(/^CONT/i) &&
        s.length > 2,
    );

  // Parse each award
  const awards = rawAwards.map(parseSingleAward);

  return awards;
}

/**
 * Extract deployment information from Block 18 remarks
 */
function extractDeployments(remarksText) {
  if (!remarksText) return [];
  const deployments = [];

  // Pattern: SERVICE IN [LOCATION] FROM YYYYMMDD TO YYYYMMDD
  const deployPatterns = [
    /SERVICE\s*IN\s+([A-Z]+)\s*(?:FROM\s*)?(\d{8})\s*(?:TO|-)\s*(\d{8})/gi,
    /SERVED?\s*IN\s+([A-Z]+)\s*(?:FROM\s*)?(\d{8})\s*(?:TO|-)\s*(\d{8})/gi,
    /(?:SINAI|AFGHANISTAN|IRAQ|KUWAIT|KOREA)\s*(?:FROM\s*)?(\d{8})\s*(?:TO|-)\s*(\d{8})/gi,
    // {1,60} not unbounded +: real multi-word deployment locations are a
    // few words, never remotely close to 60 chars. Unbounded [A-Z\s]+?
    // is genuinely O(n^2) here (confirmed 1.4s+ at 220k chars of repeated
    // "SERVICE IN " with no digits ever following) because the global,
    // unanchored regex retries the lazy expansion-to-end-of-string at
    // every "SERVICE IN" occurrence. Verified match-identical to the
    // unbounded version for realistic location text.
    /SERVICE\s{0,10}IN\s{1,10}([A-Z\s]{1,60}?)\s{1,10}(\d{8})\s{0,10}-\s{0,10}(\d{8})/gi,
  ];

  for (const pattern of deployPatterns) {
    let match;
    while ((match = pattern.exec(remarksText)) !== null) {
      const location = match[1].trim();
      const startDate = normalizeDate(match[2] || match[1]);
      const endDate = normalizeDate(match[3] || match[2]);
      if (location && location.length > 2) {
        deployments.push({
          location,
          startDate,
          endDate,
          raw: match[0],
        });
      }
    }
  }

  // Also check for operation names
  const opPatterns = [
    // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on repeated 'OPERATION' with no match (see 'ReDoS regression — deployment extraction')
    /OPERATION\s+(ENDURING\s*FREEDOM|IRAQI?\s*FREEDOM|NEW\s*DAWN|INHERENT\s*RESOLVE|FREEDOM'?S?\s*SENTINEL)/gi,
    /(?:OEF|OIF|OND|OIR|OFS)/g,
  ];
  for (const pattern of opPatterns) {
    let match;
    while ((match = pattern.exec(remarksText)) !== null) {
      const existing = deployments.find((d) => d.raw?.includes(match[0]));
      if (!existing) {
        deployments.push({
          operation: match[1] || match[0],
          raw: match[0],
        });
      }
    }
  }

  return deployments;
}

/**
 * Extract combat indicators from Block 13 + Block 18
 */
function extractCombatIndicators(awardsText, remarksText) {
  // Shares combatService.js with the Muster Call extraction path so the two
  // cannot reach opposite conclusions about the same veteran. The list this
  // replaced counted any Bronze Star (VA requires the "V" device) and any
  // campaign medal (not on VA's list at all) as proof of combat, while
  // missing most of the decorations that do establish it.
  const combined = `${awardsText || ""}//${remarksText || ""}`;
  const decorations = findCombatDecorationsInText(combined);

  // Not decorations, so not part of the 1.A.3.h presumption. VA treats them
  // as evidence of service in an area of hostile military or terrorist
  // activity (M21-1, Part VIII, Subpart iv, 1.A.3.i), which is a different
  // and weaker showing - they are reported, but they do not by themselves
  // make a veteran a combat veteran.
  const hostileArea = [];
  if (/IMMINENT\s{0,4}DANGER\s{0,4}PAY/i.test(combined)) {
    hostileArea.push("Imminent Danger Pay Zone");
  }
  if (/HOSTILE\s{0,4}FIRE\s{0,4}PAY/i.test(combined)) {
    hostileArea.push("Hostile Fire Pay");
  }

  return { decorations, hostileArea };
}

/**
 * Extract special qualifications from Block 13/18
 */
function extractSpecialQualifications(text) {
  if (!text) return [];
  const quals = [];

  const qualPatterns = [
    { pattern: /AIRBORNE/i, name: "Airborne" },
    { pattern: /RANGER/i, name: "Ranger" },
    { pattern: /SPECIAL\s*FORCES/i, name: "Special Forces" },
    { pattern: /AIR\s*ASSAULT/i, name: "Air Assault" },
    { pattern: /PATHFINDER/i, name: "Pathfinder" },
    { pattern: /SAPPER/i, name: "Sapper" },
    { pattern: /COMBAT\s*DIVER/i, name: "Combat Diver" },
    { pattern: /COMBAT\s*LIFE\s*SAVER/i, name: "Combat Life Saver" },
    { pattern: /EXPERT\s*(?:INFANTRY|FIELD\s*MEDICAL)/i, name: "Expert Badge" },
    { pattern: /SNIPER/i, name: "Sniper" },
    { pattern: /JUMPMASTER/i, name: "Jumpmaster" },
  ];

  for (const qp of qualPatterns) {
    if (qp.pattern.test(text)) {
      quals.push(qp.name);
    }
  }

  return quals;
}

/**
 * Parse branch and component from Block 2 text
 */
function parseBranchComponent(text) {
  if (!text) return { branch: null, component: null, componentFull: null };

  const result = { branch: null, component: null, componentFull: null };

  // Branch detection
  if (/ARMY/i.test(text)) result.branch = "Army";
  else if (/NAVY/i.test(text)) result.branch = "Navy";
  else if (/AIR\s*FORCE/i.test(text)) result.branch = "Air Force";
  else if (/MARINE/i.test(text)) result.branch = "Marines";
  else if (/COAST\s*GUARD/i.test(text)) result.branch = "Coast Guard";
  else if (/SPACE\s*FORCE/i.test(text)) result.branch = "Space Force";

  // Component detection
  if (/ARNG|NATIONAL\s*GUARD/i.test(text)) {
    result.component = "ARNG";
    result.componentFull = `${result.branch || "Army"} National Guard`;
  } else if (/USAR|RESERVE/i.test(text)) {
    result.component = "USAR";
    result.componentFull = `${result.branch || "Army"} Reserve`;
  } else if (/ACTIVE|RA\b|USN\b|USAF\b|USMC\b/i.test(text)) {
    result.component = "RA";
    result.componentFull = `Regular ${result.branch || "Army"}`;
  }

  return result;
}

/**
 * Parse name into components
 */
function parseName(fullName) {
  if (!fullName) return { lastName: null, firstName: null, middleName: null };

  // Format: "LAST, FIRST MIDDLE" or "LAST, FIRST M." - some OCR/scan
  // layouts print the separator as a semicolon instead of a comma.
  const parts = fullName.split(/[,;]/).map((s) => s.trim());
  if (parts.length >= 2) {
    const lastName = parts[0];
    const firstMiddle = parts[1].split(/\s+/);
    return {
      lastName,
      firstName: firstMiddle[0] || null,
      middleName: firstMiddle.slice(1).join(" ") || null,
    };
  }

  // No comma/semicolon at all (OCR commonly drops punctuation entirely) -
  // still "LAST FIRST MIDDLE" order, since that's what every DD214/NGB-22
  // box prints regardless of whether the separator survived OCR. This is
  // NOT the Western "FIRST MIDDLE LAST" convention.
  const words = fullName.split(/\s+/);
  if (words.length >= 2) {
    return {
      lastName: words[0],
      firstName: words[1],
      middleName: words.length > 2 ? words.slice(2).join(" ") : null,
    };
  }

  return { lastName: fullName, firstName: null, middleName: null };
}

// ============================================================
// MAIN EXPORT: extractDD214Fields
// ============================================================

/**
 * Trim, normalize, and validate one field's matched raw value.
 * Returns the processed value, or null if it failed validation.
 */
function _processFieldMatch(fieldDef, rawValue) {
  let value = rawValue.trim();

  if (fieldDef.normalize) {
    value = fieldDef.normalize(value);
  }

  if (fieldDef.validate && !fieldDef.validate(value)) {
    return null;
  }

  return value;
}

/**
 * Run every DD214_FIELD_PATTERNS entry against the given text, returning
 * the extracted field values and a per-field confidence map.
 */
function runFieldPatterns(text) {
  const extractedFields = {};
  const fieldConfidence = {};

  for (const [fieldName, fieldDef] of Object.entries(DD214_FIELD_PATTERNS)) {
    for (const pattern of fieldDef.patterns) {
      const match = text.match(pattern);
      if (!match?.[1]) continue;

      const value = _processFieldMatch(fieldDef, match[1]);
      if (value === null) continue; // Skip invalid matches

      extractedFields[fieldName] = value;
      fieldConfidence[fieldName] = "regex_match";
      break; // First match wins
    }
  }

  return { extractedFields, fieldConfidence };
}

function _deriveNameFields(extractedFields) {
  if (!extractedFields.fullName) return;
  const nameParts = parseName(extractedFields.fullName);
  if (!extractedFields.lastName) extractedFields.lastName = nameParts.lastName;
  if (!extractedFields.firstName)
    extractedFields.firstName = nameParts.firstName;
  if (!extractedFields.middleName)
    extractedFields.middleName = nameParts.middleName;
}

function _deriveBranchFields(extractedFields) {
  if (!extractedFields.departmentComponentBranch) return;
  const branchInfo = parseBranchComponent(
    extractedFields.departmentComponentBranch,
  );
  extractedFields.branch = branchInfo.branch;
  extractedFields.component = branchInfo.component;
  extractedFields.componentFull = branchInfo.componentFull;
}

function _deriveSsnLast4Field(extractedFields, options) {
  if (!extractedFields.ssn) return;
  extractedFields.ssnLast4 = DD214_FIELD_PATTERNS.ssn.extractLast4(
    extractedFields.ssn,
  );
  // Remove full SSN for security — we only keep last 4
  if (!options.keepFullSSN) {
    delete extractedFields.ssn;
  }
}

function _deriveMosFields(extractedFields) {
  if (!extractedFields.primarySpecialty) return;
  const mosCode = DD214_FIELD_PATTERNS.primarySpecialty.extractMOS(
    extractedFields.primarySpecialty,
  );
  const mosTitle = DD214_FIELD_PATTERNS.primarySpecialty.extractTitle(
    extractedFields.primarySpecialty,
  );
  if (mosCode) extractedFields.mos = mosCode;
  if (mosTitle) extractedFields.mosTitle = mosTitle;
}

/**
 * Derive name/branch/component/SSN-last4/MOS fields from the raw
 * regex-extracted values. Mutates `extractedFields` in place.
 */
function derivePersonAndSpecialtyFields(extractedFields, options) {
  _deriveNameFields(extractedFields);
  _deriveBranchFields(extractedFields);
  _deriveSsnLast4Field(extractedFields, options);
  _deriveMosFields(extractedFields);
}

/**
 * Derive awards/deployments/combat/qualifications and service-time
 * rollup fields, then strip internal-only fields. Mutates
 * `extractedFields` and `extractionNotes` in place.
 */
function deriveAwardsAndServiceFields(extractedFields, extractionNotes) {
  // Parse awards
  const awardsRaw = extractedFields.awardsRaw || "";
  const remarksText = extractedFields.remarks || "";
  extractedFields.awards = parseAwardsString(awardsRaw, remarksText);
  if (extractedFields.awards.length > 0) {
    extractionNotes.push(
      `Extracted ${extractedFields.awards.length} awards/decorations`,
    );
  }

  // Extract deployments from remarks
  extractedFields.deployments = extractDeployments(remarksText);
  if (extractedFields.deployments.length > 0) {
    extractionNotes.push(
      `Found ${extractedFields.deployments.length} deployment(s) in remarks`,
    );
  }

  // Extract combat indicators. hasVerifiedCombat keys on the decorations
  // alone - hostile-area pay shows where the veteran was, not that they
  // engaged, and treating it as proof of combat overstates the record.
  const { decorations, hostileArea } = extractCombatIndicators(
    awardsRaw,
    remarksText,
  );
  extractedFields.combatService = {
    hasVerifiedCombat: decorations.length > 0,
    indicators: [...decorations, ...hostileArea],
    deployments: extractedFields.deployments.map((d) =>
      d.location
        ? `${d.location} ${d.startDate || ""}-${d.endDate || ""}`.trim()
        : d.operation,
    ),
  };

  // Extract special qualifications
  const allText = `${awardsRaw} ${remarksText} ${extractedFields.militaryEducation || ""}`;
  extractedFields.specialQualifications = extractSpecialQualifications(allText);

  // Calculate total service
  if (
    extractedFields.netActiveService &&
    typeof extractedFields.netActiveService === "object"
  ) {
    extractedFields.yearsService = extractedFields.netActiveService.years;
    extractedFields.monthsService = extractedFields.netActiveService.months;
    extractedFields.daysService = extractedFields.netActiveService.days;
  }

  // Foreign service detection
  if (extractedFields.foreignServiceTime) {
    const fst = extractedFields.foreignServiceTime;
    extractedFields.foreignService =
      fst.years > 0 || fst.months > 0 || fst.days > 0;
  }

  // Parse military education into array
  if (
    extractedFields.militaryEducation &&
    typeof extractedFields.militaryEducation === "string"
  ) {
    const eduText = extractedFields.militaryEducation;
    extractedFields.militaryEducation = eduText
      .split(/\/\//)
      .map((e) => e.trim())
      .filter(
        (e) => e && !e.match(/^NOTHING\s*FOLLOWS$/i) && !e.match(/^NONE$/i),
      );
  }

  // Clean up internal-only fields
  delete extractedFields.awardsRaw;
  delete extractedFields.departmentComponentBranch;
}

/**
 * Post-process raw regex-extracted fields: derive name/branch/MOS
 * components, parse awards/deployments/combat/qualifications, compute
 * service-time rollups, and strip internal-only fields.
 * Mutates `extractedFields` and `extractionNotes` in place.
 */
function postProcessExtractedFields(extractedFields, extractionNotes, options) {
  derivePersonAndSpecialtyFields(extractedFields, options);
  deriveAwardsAndServiceFields(extractedFields, extractionNotes);
}

/**
 * Extract ALL DD214 fields from raw OCR text using regex patterns.
 * This is a deterministic, AI-free extraction that serves as:
 * 1. Primary extraction when AI is unavailable
 * 2. Validation layer to cross-check AI results
 * 3. Fallback for fields AI misses
 *
 * @param {string} rawText - The raw OCR/extracted text from a DD214
 * @param {Object} options - Configuration options
 * @returns {Object} Structured DD214 data matching the AI output schema
 */
export function extractDD214Fields(rawText, options = {}) {
  if (!rawText || typeof rawText !== "string") {
    return { success: false, error: "No text provided", fields: {} };
  }

  const text = rawText.toUpperCase();
  const extractionNotes = [];

  const { extractedFields, fieldConfidence } = runFieldPatterns(text);

  postProcessExtractedFields(extractedFields, extractionNotes, options);

  return {
    success: true,
    fields: extractedFields,
    fieldConfidence,
    extractionNotes,
    fieldsExtracted: Object.keys(extractedFields).length,
    method: "regex",
  };
}

/**
 * Fill any AI fields missing from `merged` using the regex-extracted
 * values, and correct regex-preferred structured fields when the AI
 * value doesn't look like a valid date. Mutates `merged` and `mergeNotes`.
 */
function fillMissingFieldsFromRegex(
  merged,
  regexFields,
  regexPreferred,
  mergeNotes,
) {
  for (const [key, value] of Object.entries(regexFields)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;

    const aiValue = merged[key];
    const aiMissing =
      aiValue === null ||
      aiValue === undefined ||
      (typeof aiValue === "string" && aiValue.trim() === "");

    if (aiMissing) {
      merged[key] = value;
      mergeNotes.push(`Filled '${key}' from regex (AI missed it)`);
    } else if (regexPreferred.includes(key)) {
      // For structured fields, prefer regex if AI value looks wrong
      if (
        key.includes("Date") &&
        typeof aiValue === "string" &&
        !/^\d{4}-\d{2}-\d{2}$/.test(aiValue)
      ) {
        merged[key] = value;
        mergeNotes.push(
          `Corrected '${key}' with regex value (AI format was wrong)`,
        );
      }
    }
  }
}

/**
 * Ensure `merged.combatService` reflects every combat indicator found by
 * the regex extractor, unioning indicators and OR-ing hasVerifiedCombat.
 * Mutates `merged` and `mergeNotes`.
 */
function mergeCombatServiceIndicators(merged, regexFields, mergeNotes) {
  if (!merged.combatService) merged.combatService = regexFields.combatService;
  else {
    const existingIndicators = new Set(merged.combatService.indicators || []);
    for (const ind of regexFields.combatService.indicators) {
      if (!existingIndicators.has(ind)) {
        merged.combatService.indicators.push(ind);
        mergeNotes.push(`Added combat indicator '${ind}' from regex`);
      }
    }
    if (regexFields.combatService.hasVerifiedCombat) {
      merged.combatService.hasVerifiedCombat = true;
    }
  }
}

/**
 * Merge regex-extracted fields with AI-extracted fields.
 * AI wins for complex fields (awards interpretation, combat assessment).
 * Regex wins for structured fields (dates, codes, SSN).
 * Missing AI fields are filled by regex.
 *
 * @param {Object} aiResult - AI-extracted DD214 data
 * @param {Object} regexResult - Regex-extracted DD214 data (from extractDD214Fields)
 * @returns {Object} Merged result with best-of-both data
 */
export function mergeAIAndRegexResults(aiResult, regexResult) {
  if (!aiResult && !regexResult?.fields) return aiResult || {};
  if (!aiResult) return regexResult.fields;
  if (!regexResult?.fields) return aiResult;

  const merged = { ...aiResult };
  const regexFields = regexResult.fields;
  const mergeNotes = [];

  // Fields where regex is more reliable (structured/format-sensitive)
  const regexPreferred = [
    "ssnLast4",
    "entryDate",
    "separationDate",
    "dateOfBirth",
    "dateOfRank",
    "reserveObligationDate",
    "separationCode",
    "reentryCode",
    "payGrade",
    "netActiveService",
    "totalPriorActiveService",
    "totalPriorInactiveService",
    "foreignServiceTime",
    "seaServiceTime",
  ];

  fillMissingFieldsFromRegex(merged, regexFields, regexPreferred, mergeNotes);

  // Merge deployment arrays (union)
  if (regexFields.deployments?.length > 0 && !merged.deployments?.length) {
    merged.deployments = regexFields.deployments;
    mergeNotes.push(
      `Added ${regexFields.deployments.length} deployment(s) from regex`,
    );
  }

  // Ensure combat indicators are complete
  if (regexFields.combatService?.indicators?.length > 0) {
    mergeCombatServiceIndicators(merged, regexFields, mergeNotes);
  }

  merged._mergeNotes = mergeNotes;
  merged._regexFieldCount = regexResult.fieldsExtracted;
  return merged;
}

/**
 * Detect which DD214 document(s) are present in the text
 * Returns info about each detected document
 */
export function detectDD214Documents(text) {
  const documents = [];

  // Look for form identifiers
  const formPatterns = [
    { pattern: /DD\s*(?:FORM\s*)?214/i, type: "DD214" },
    { pattern: /NGB\s*(?:FORM\s*)?22/i, type: "NGB22" },
    { pattern: /DD\s*(?:FORM\s*)?256/i, type: "DD256" },
    { pattern: /DD\s*(?:FORM\s*)?257/i, type: "DD257" },
    { pattern: /DD\s*(?:FORM\s*)?215/i, type: "DD215" },
  ];

  // Look for separation dates to identify distinct documents
  const sepDatePattern =
    // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test: linear on many repeated near-miss labels (see detectDD214Documents ReDoS regression tests)
    /(?:SEPARATION\s*DATE|12\s*B)[:\s.]*(\d{4}[\s|]*\d{2}[\s|]*\d{2}|\d{8})/gi;
  let match;
  while ((match = sepDatePattern.exec(text)) !== null) {
    const date = normalizeDate(match[1]);
    if (date) {
      let type = "DD214";
      for (const fp of formPatterns) {
        // Check nearby text for form type
        const nearby = text.substring(
          Math.max(0, match.index - 500),
          match.index + 500,
        );
        if (fp.pattern.test(nearby)) {
          type = fp.type;
          break;
        }
      }
      documents.push({ type, separationDate: date, position: match.index });
    }
  }

  return documents;
}

export default {
  extractDD214Fields,
  mergeAIAndRegexResults,
  detectDD214Documents,
  parseAwardsString,
  extractDeployments,
  extractCombatIndicators,
};
