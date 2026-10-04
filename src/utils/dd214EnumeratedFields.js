/**
 * Fixed-list and strict-pattern validators for the DD-214 fields a model
 * fills in (ADR-009 section 3). A value that is not on its list or does not
 * match its documented shape is dropped, never shown: an invented name cannot
 * pass through a field that only ever holds a code or a fixed word.
 */

const words = (text) => text.split(/\s+/).filter(Boolean);

const normalizeWords = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9$%/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stripCountry = (text) => text.replace(/^(?:united states|u s|us) /, "");

const BRANCHES = new Set([
  "army",
  "navy",
  "air force",
  "marines",
  "marine corps",
  "usmc",
  "usn",
  "usaf",
  "usa",
  "uscg",
  "ussf",
  "coast guard",
  "space force",
  "army national guard",
  "air national guard",
  "national guard",
  "army reserve",
  "navy reserve",
  "air force reserve",
  "marine corps reserve",
  "coast guard reserve",
]);

const COMPONENTS = new Set([
  "ra",
  "ad",
  "agr",
  "ng",
  "arng",
  "arngus",
  "ang",
  "usar",
  "usn",
  "usnr",
  "usaf",
  "usafr",
  "afres",
  "usmc",
  "usmcr",
  "uscg",
  "uscgr",
  "ussf",
  "regular",
  "active",
  "active duty",
  "reserve",
  "national guard",
  "regular army",
  "regular navy",
  "regular air force",
  "regular marine corps",
  "regular coast guard",
]);

const COMPONENT_FULL_WORDS = new Set([
  "regular",
  "army",
  "navy",
  "air",
  "force",
  "marine",
  "marines",
  "corps",
  "coast",
  "guard",
  "space",
  "national",
  "reserve",
  "reserves",
  "active",
  "duty",
  "component",
  "agr",
  "us",
  "united",
  "states",
]);

const RANK_WORDS = new Set([
  "private",
  "pvt",
  "specialist",
  "corporal",
  "sergeant",
  "staff",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "class",
  "master",
  "major",
  "command",
  "chief",
  "senior",
  "lance",
  "gunnery",
  "gunner",
  "airman",
  "basic",
  "seaman",
  "apprentice",
  "recruit",
  "fireman",
  "petty",
  "officer",
  "warrant",
  "lieutenant",
  "junior",
  "grade",
  "captain",
  "colonel",
  "lieutenant",
  "brigadier",
  "general",
  "admiral",
  "rear",
  "vice",
  "commander",
  "ensign",
  "midshipman",
  "cadet",
  "technical",
  "tech",
  "mate",
  "enlisted",
  "of",
  "the",
  "army",
  "air",
  "force",
  "pfc",
  "spc",
  "cpl",
  "sgt",
  "ssg",
  "sfc",
  "msg",
  "sgm",
  "csm",
  "ssgt",
  "tsgt",
  "msgt",
  "smsgt",
  "cmsgt",
  "sra",
  "amn",
  "a1c",
  "lcpl",
  "gysgt",
  "mgysgt",
  "sgtmaj",
  "sgtmajmc",
  "1stlt",
  "2ndlt",
  "lt",
  "capt",
  "cpt",
  "maj",
  "ltc",
  "lcol",
  "ltcol",
  "ltcmdr",
  "col",
  "bg",
  "mg",
  "ltg",
  "gen",
  "ens",
  "ltjg",
  "lcdr",
  "cdr",
  "cmdr",
  "capt",
  "adm",
  "rdml",
  "radm",
  "vadm",
  "sa",
  "sn",
  "sr",
  "cpo",
  "scpo",
  "mcpo",
  "mcpon",
  "fa",
  "fn",
  "hm",
  "hn",
  "ct",
  "wo",
  "cw",
  "cwo",
  "e",
  "o",
  "w",
]);

// E5, O-3 style grades, SP4 and Navy rates (HM2, BM1), 1SG, 1LT, 2LT.
const RANK_CODE_SHAPE = /^[a-z]{1,3}\d{1,2}$/;
const RANK_ORDINAL_SHAPE = /^\d{1,2}(?:st|nd|rd|th)?(?:lt|sg|sgt)?$/;
const RANK_TOKEN_SHAPE = {
  test: (token) =>
    RANK_CODE_SHAPE.test(token) || RANK_ORDINAL_SHAPE.test(token),
};

const CHARACTER_WORDS = new Set([
  "honorable",
  "general",
  "under",
  "other",
  "than",
  "conditions",
  "dishonorable",
  "bad",
  "conduct",
  "discharge",
  "uncharacterized",
  "uncharacterised",
  "entry",
  "level",
  "separation",
  "void",
  "oth",
  "bcd",
  "dd",
  "medical",
  "release",
  "no",
  "characterization",
  "of",
  "service",
  "or",
]);

const SEPARATION_TYPE_WORDS = new Set([
  ...CHARACTER_WORDS,
  "ets",
  "rtd",
  "retirement",
  "retired",
  "temporary",
  "permanent",
  "disability",
  "physical",
  "evaluation",
  "board",
  "from",
  "active",
  "duty",
  "transfer",
  "transferred",
  "to",
  "reserve",
  "reserves",
  "inactive",
  "ready",
  "early",
  "expiration",
  "term",
  "hardship",
  "convenience",
  "government",
  "completion",
  "required",
  "involuntary",
  "voluntary",
  "administrative",
  "misconduct",
  "obligation",
  "fulfilled",
  "drilling",
  "medically",
  "and",
  "for",
  "in",
  "lieu",
  "trial",
  "by",
  "court",
  "martial",
  "resignation",
  "officer",
  "enlisted",
  "reduction",
  "force",
  "separated",
  "released",
  "discharged",
  "and",
  "the",
  "navy",
  "army",
  "air",
  "marine",
  "corps",
  "coast",
  "guard",
]);

const GI_BILL_WORDS = new Set([
  "eligible",
  "ineligible",
  "transferred",
  "not",
  "yes",
  "no",
  "none",
  "declined",
  "elected",
  "waived",
  "transfer",
  "of",
  "entitlement",
  "dependents",
  "benefits",
  "post",
  "gi",
  "bill",
  "percent",
  "partial",
  "full",
  "unknown",
  "n/a",
]);

const CLEARANCE_WORDS = new Set([
  "none",
  "top",
  "secret",
  "confidential",
  "ts",
  "sci",
  "ts/sci",
  "tssci",
  "q",
  "l",
  "interim",
  "clearance",
  "yes",
  "no",
  "unknown",
  "eligible",
  "active",
  "expired",
  "current",
  "and",
  "with",
  "or",
]);

const SGL_WORDS = new Set([
  "none",
  "maximum",
  "declined",
  "sgli",
  "vgli",
  "yes",
  "no",
  "amount",
  "coverage",
  "full",
  "reduced",
]);
// Real coverage amounts only: a bare run of eight or more digits is an SSN or
// file number, not a dollar amount.
const SGL_TOKEN_SHAPE = /^\$?(?:\d{1,3}(?:,\d{3}){1,2}|\d{3,7})(?:\.\d{2})?k?$/;

const NAVY_RATINGS = new Set(
  (
    "AB AC AD AE AG AM AME AO AS AT AW AZ BM BU CE CM CS CTI CTM CTN CTR CTT " +
    "CU DC DK DM DT EA EM EMN EN EO EOD ET EW FC FT GM GS GSE HM HT IC IS IT " +
    "LN LS MA MC MM MN MR MT MU NC OS PC PH PN PR QM RM RP SB SH SK SM ST STG " +
    "STS SW TM UT UC YN HN FN SN AN CN DN AMT AET AST MST MSD IV HS FS MK ME"
  ).split(" "),
);

const SHORT_CODE = /^[A-Z0-9]{3}$/i;
const REENTRY_CODE = /^(?:RE[- ]?)?(?:[1-4][A-Z]?|R[1-4])$/i;
const PAY_GRADE = /^([EOW])-?(\d{1,2})E?$/i;
const PAY_GRADE_MAX = { E: 9, W: 5, O: 10 };
// Each branch's own code shape, and every shape needs a letter, so a date, an
// SSN fragment or a bare run of digits can never pass as a MOS:
// Army 11B, 11B10, 68W, a warrant officer's 153A; Air Force and Space Force
// 2A551, 3D1X2, an officer's 11M3; Navy and Coast Guard ratings with an
// optional pay-grade digit and NEC (HM, HM2, HM-8404). Marine codes are four
// bare digits and so cannot be told from a year or an SSN fragment: they pass
// only when the same reading's branch is the Marine Corps.
const MARINE_MOS = /^\d{4}$/;
const MARINE_BRANCH = /^(?:marines?|marine corps|usmc|usmcr)$/;
const MOS_SHAPES = [
  /^\d{2}[A-Z]\d{0,2}[A-Z]?$/,
  /^\d{3}[A-Z]\d?$/,
  /^\d[A-Z]\d[0-9X]\d[A-Z]?$/,
];
const SSN_SHAPE = /^\d{3}[- ]?\d{2}[- ]?\d{4}$/;
const FORM_NAME = /^(?:DD|NGB)[ -]?(?:FORM )?\d{2,4}[A-Z]?$/i;
const AUTHORITY_SHAPE = /^[A-Za-z0-9 .,;:§()/-]{3,80}$/;
// A separation authority is a regulation reference: only these words and
// acronyms may appear beside its numbers, so a name or an address cannot.
const AUTHORITY_WORDS = new Set(
  (
    "ar afi afman afr afpd afh dafi dafman milpersman marcorsepman mco secnavinst opnavinst " +
    "dodi dodd dod comdtinst navpers cfr usc ngr arngr angi ngb maradmin alnav navadmin jagman " +
    "persman da dd ucmj rcm spd para paragraph chapter chap ch section sec title art article " +
    "and of the army navy air force marine corps coast guard regulation reg instruction manual " +
    "pt part subpara"
  ).split(" "),
);
const MAX_VOCAB_WORDS = 12;

function onlyWords(text, vocab, tokenShape) {
  const parts = words(normalizeWords(text));
  if (parts.length === 0 || parts.length > MAX_VOCAB_WORDS) return false;
  return parts.every(
    (part) => vocab.has(part) || (tokenShape && tokenShape.test(part)),
  );
}

const inSet = (set) => (text) => set.has(stripCountry(normalizeWords(text)));
const vocabulary = (vocab, tokenShape) => (text) =>
  onlyWords(text, vocab, tokenShape);

function isPayGrade(text) {
  const match = PAY_GRADE.exec(text);
  if (!match) return false;
  const number = Number(match[2]);
  return number >= 1 && number <= PAY_GRADE_MAX[match[1].toUpperCase()];
}

const NAVY_RATING_WITH_GRADE = /^([A-Z]{2,3})[1-9]?(?:-\d{4})?$/;

function isMarineBranch(branch) {
  return (
    typeof branch === "string" && MARINE_BRANCH.test(normalizeWords(branch))
  );
}

function isMos(text, { branch } = {}) {
  const code = text.trim().toUpperCase();
  if (SSN_SHAPE.test(code)) return false;
  if (MOS_SHAPES.some((shape) => shape.test(code))) return true;
  if (MARINE_MOS.test(code)) return isMarineBranch(branch);
  const rating = NAVY_RATING_WITH_GRADE.exec(code);
  return rating !== null && NAVY_RATINGS.has(rating[1]);
}

function isAuthority(text) {
  if (!AUTHORITY_SHAPE.test(text) || !/\d/.test(text)) return false;
  const letterWords = text.match(/[A-Za-z]+/g) ?? [];
  return letterWords.every(
    (word) => AUTHORITY_WORDS.has(word.toLowerCase()) || /^[a-z]$/i.test(word),
  );
}

const RULES = {
  branch: inSet(BRANCHES),
  component: inSet(COMPONENTS),
  componentFull: vocabulary(COMPONENT_FULL_WORDS),
  rank: vocabulary(RANK_WORDS, RANK_TOKEN_SHAPE),
  payGrade: isPayGrade,
  mos: isMos,
  masterRecordType: (text) => FORM_NAME.test(text),
  reentryCode: (text) => REENTRY_CODE.test(text),
  separationCode: (text) => SHORT_CODE.test(text),
  separationProgramDesignator: (text) => SHORT_CODE.test(text),
  separationAuthority: isAuthority,
  separationType: vocabulary(SEPARATION_TYPE_WORDS),
  characterOfService: vocabulary(CHARACTER_WORDS),
  giBlStatus: vocabulary(GI_BILL_WORDS, /^\d{1,3}%?$/),
  securityClearance: vocabulary(CLEARANCE_WORDS),
  sglCoverage: vocabulary(SGL_WORDS, SGL_TOKEN_SHAPE),
};

export const ENUMERATED_KEYS = new Set([
  ...Object.keys(RULES),
  "documentTypes",
]);

/**
 * Returns the trimmed value when it is on the field's list (or matches its
 * shape), otherwise undefined. A non-string never passes.
 */
export function cleanEnumeratedField(key, value, context = {}) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (text === "" || text.length > 80) return undefined;
  return RULES[key]?.(text, context) ? text : undefined;
}

export function cleanDocumentTypes(value) {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item) => typeof item === "string" && FORM_NAME.test(item.trim()))
    .map((item) => item.trim());
}

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const MIN_YEAR = 1930;
const MAX_YEARS_AHEAD = 15;

function daysIn(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function ymd(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const yearChoices = (text) => {
  const year = Number(text);
  return text.length === 4 ? [year] : [1900 + year, 2000 + year];
};

function keysFor(yearText, month, day) {
  return yearChoices(yearText)
    .map((year) => ymd(year, month, day))
    .filter(Boolean);
}

const YEAR_FIRST = /^(\d{4})([-/. ]?)(\d{2})\2(\d{2})$/;
const NUMERIC_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/;
const DAY_MONTH_NAME = /^(\d{1,2})[- ]?([A-Z]{3})[A-Z]*[.,\s-]*(\d{4}|\d{2})$/;
const MONTH_NAME_DAY = /^([A-Z]{3})[A-Z]*\.? (\d{1,2}),? (\d{4}|\d{2})$/;
const TIME_SUFFIX = /[T ]\d{2}:\d{2}[\d:.]*(?:Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Every calendar date a written date could mean, as YYYY-MM-DD keys. A
 * numeric date is read both month-first and day-first, a two-digit year in
 * both centuries, so a birth date in any of the formats the app or a document
 * uses compares equal to the same date written another way.
 */
export function dateKeys(raw) {
  if (typeof raw !== "string") return [];
  const text = raw.trim().toUpperCase().replace(TIME_SUFFIX, "");
  let match = YEAR_FIRST.exec(text);
  if (match) return keysFor(match[1], Number(match[3]), Number(match[4]));
  match = NUMERIC_DATE.exec(text);
  if (match) {
    const [a, b] = [Number(match[1]), Number(match[2])];
    return [...keysFor(match[3], a, b), ...keysFor(match[3], b, a)];
  }
  match = DAY_MONTH_NAME.exec(text);
  if (match && MONTHS.includes(match[2])) {
    return keysFor(match[3], MONTHS.indexOf(match[2]) + 1, Number(match[1]));
  }
  match = MONTH_NAME_DAY.exec(text);
  if (match && MONTHS.includes(match[1])) {
    return keysFor(match[3], MONTHS.indexOf(match[1]) + 1, Number(match[2]));
  }
  return [];
}

const BIRTH_KEY = /^(?:date_?of_?birth|dob|birth_?date)$/i;
const MAX_BIRTH_SEARCH_DEPTH = 4;
const MAX_BIRTH_SEARCH_NODES = 5000;

/**
 * The birth dates held by any source object (a profile, a knowledge base
 * personal block, a document's extracted data, a parser result), under a
 * birth-date key at any nesting up to a few levels (personal,
 * extractedData.fields, a list of documents).
 */
export function birthDateKeysFrom(sources) {
  const found = new Set();
  let budget = MAX_BIRTH_SEARCH_NODES;
  const walk = (node, depth) => {
    if (!node || typeof node !== "object" || depth > MAX_BIRTH_SEARCH_DEPTH) {
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (budget-- <= 0) return;
      if (BIRTH_KEY.test(key)) {
        dateKeys(value).forEach((date) => found.add(date));
      } else {
        walk(value, depth + 1);
      }
    }
  };
  sources.forEach((source) => walk(source, 0));
  return found;
}

export function isPlausibleDateKey(key, now = new Date()) {
  const year = Number(key.slice(0, 4));
  return year >= MIN_YEAR && year <= now.getUTCFullYear() + MAX_YEARS_AHEAD;
}
