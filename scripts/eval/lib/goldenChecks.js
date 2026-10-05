import { suppliedText } from "./goldenSet.js";
import { extractCfrSections } from "./legalSections.js";
import { isWritingEntry } from "./toolEntries.js";

export const AUTO_PASS = "auto-pass";
export const AUTO_FAIL = "auto-fail";
export const NEEDS_HUMAN = "needs-human";
export const NOT_APPLICABLE = "n/a";

export const AUTOMATED_CHECK_IDS = [
  "routing",
  "calc-match",
  "cfr-in-index",
  "no-spotlight-echo",
  "no-new-pii",
  "draft-returned",
];

export const RUBRIC_CRITERIA = {
  auditor: ["A1", "A2", "A3", "A4", "A5", "A6"],
  writer: ["W1", "W2", "W3", "W4", "W5"],
  rater: ["R1", "R2", "R3", "R4", "R5"],
};

export const PASS_THRESHOLD = { auditor: 5, writer: 4, rater: 4 };

const result = (status, detail = "", data = undefined) => ({
  status,
  detail,
  ...(data ? { data } : {}),
});

export function checkRouting(caseDef, record) {
  const actual = record.actualAgent;
  if (!actual || actual === "unknown") {
    return result(
      NEEDS_HUMAN,
      "actual agent could not be determined from the engine request",
    );
  }
  return actual === caseDef.expectedAgent
    ? result(AUTO_PASS, `${actual}`)
    : result(
        AUTO_FAIL,
        `expected ${caseDef.expectedAgent}, engine received the ${actual} persona`,
      );
}

const NEAR_FILLER = String.raw`(?:[\s:=*~≈]|\b(?:va|disability|rating|evaluation|is|of|would|be|comes|to|equals|at|rounds|approximately|about|roughly|percentage|calculation|results|in)\b){1,12}?`;
const CLAUSE_WORDS = String.raw`when|if|where|because|since|while|which|that|than|group|step|steps|each`;
const FAR_LINK = String.raw`(?:(?!\b(?:${CLAUSE_WORDS})\b)[^\d.!?\n]){0,100}?(?:\b(?:is|are|was|would be|will be|comes? to|equals?|totals?)\b|\\approx|[:=≈])`;
const STATED_COMBINED = new RegExp(
  String.raw`\b(?:(?:combined|overall|final|total)${NEAR_FILLER}|(?:combined|overall|final)${FAR_LINK})[\s*_~:=≈]*(?:(?:about|approximately|roughly|around|nearly|almost)\b[\s*_~]*)?(\d{1,3}(?:\.\d+)?)\s*(?:\\?%|percent)(?!\s*(?:[+×*/÷]\s*\(?\s*\d|or\s+(?:more|higher|greater|better|above|less|lower)\b))`,
  "gi",
);

/**
 * Every distinct combined-rating figure a response states, in order of first
 * appearance. A figure counts when it follows "combined/overall/final/total"
 * either closely ("combined rating of 70%") or after a short subject phrase
 * and a verb or colon ("The combined rating for the veteran, considering the
 * bilateral factor, is **52%**", "Final Result:** 52%"). Ratings merely listed
 * as inputs, group or step values, operands of a sum ("20% + 10% = 30%") and
 * thresholds ("a combined rating of 70 percent or more") do not count.
 */
export function extractStatedCombinedRatings(text) {
  const seen = [];
  const source = String(text ?? "");
  STATED_COMBINED.lastIndex = 0;
  let match;
  while ((match = STATED_COMBINED.exec(source)) !== null) {
    const value = Number(match[1]);
    if (!seen.includes(value)) seen.push(value);
  }
  return seen;
}

export function checkCalcMatch(caseDef, record, ctx) {
  if (!Array.isArray(caseDef.conditions) || caseDef.conditions.length === 0) {
    return result(NOT_APPLICABLE, "no structured conditions for this case");
  }
  if (typeof ctx.calculateVARating !== "function") {
    return result(NEEDS_HUMAN, "no calculator supplied to the checker");
  }
  const expected = ctx.calculateVARating(caseDef.conditions).combinedRating;
  const stated = extractStatedCombinedRatings(record.response);
  if (stated.length === 0) {
    return result(
      NEEDS_HUMAN,
      `no stated combined rating found (calculator: ${expected}%)`,
    );
  }
  if (stated.length > 1) {
    return result(
      NEEDS_HUMAN,
      `response states several combined figures (${stated.join("%, ")}%); calculator: ${expected}%`,
    );
  }
  const value = stated[0];
  const data = { stated: value, expected, multipleOf10: value % 10 === 0 };
  if (!data.multipleOf10) {
    return result(
      AUTO_FAIL,
      `stated ${value}% is not a multiple of 10 (calculator: ${expected}%)`,
      data,
    );
  }
  return value === expected
    ? result(AUTO_PASS, `stated ${value}% equals calculator`, data)
    : result(AUTO_FAIL, `stated ${value}%, calculator ${expected}%`, data);
}

export function checkCfrCitations(record, ctx) {
  const cited = extractCfrSections(record.response);
  if (cited.length === 0) {
    return result(AUTO_PASS, "no 38 CFR section cited");
  }
  if (!(ctx.legalSections instanceof Set)) {
    const note = ctx.legalIndexNote ? ` (${ctx.legalIndexNote})` : "";
    return result(
      NEEDS_HUMAN,
      `cites ${cited.join(", ")}; legal index unavailable${note}`,
    );
  }
  const missing = cited.filter((section) => !ctx.legalSections.has(section));
  if (missing.length === 0) {
    return result(
      AUTO_PASS,
      `all ${cited.length} cited section(s) are indexed`,
    );
  }
  const names = missing.map((section) => `38 CFR ${section}`);
  return result(AUTO_FAIL, `not in legal index: ${names.join(", ")}`);
}

export function checkNoSpotlightEcho(record) {
  return /<\/?untrusted_content\b/i.test(String(record.response ?? ""))
    ? result(AUTO_FAIL, "response contains the literal <untrusted_content> tag")
    : result(AUTO_PASS);
}

const SSN_SHAPED = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b|\b\d{9}\b/g;
const DATE_SHAPED = String.raw`(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})`;
const DOB_SHAPED = new RegExp(
  String.raw`(?:\bd\.?o\.?b\.?\b|date\s+of\s+birth|\bborn\b(?:\s+on)?|birth\s*date|birthday)[^\n\d]{0,20}(${DATE_SHAPED})`,
  "gi",
);

const digitsOnly = (value) => value.replace(/\D/g, "");
const squashed = (value) => value.toLowerCase().replace(/[\s.,]/g, "");

/**
 * Flags SSN-shaped strings (NNN-NN-NNNN with "-" or space, or a bare nine
 * digit run) and date-of-birth-shaped strings (a date introduced by DOB,
 * "date of birth", "born" or "birthday") that do not appear in the case
 * input. An unlabeled date is never flagged: service and exam dates are
 * legitimate in a response, and shape alone cannot tell them from a birth
 * date.
 */
export function findNewPii(response, input) {
  const text = String(response ?? "");
  const inputText = String(input ?? "");
  const inputDigits = digitsOnly(inputText);
  const inputSquashed = squashed(inputText);
  const findings = [];

  for (const match of text.matchAll(SSN_SHAPED)) {
    if (!inputDigits.includes(digitsOnly(match[0]))) {
      findings.push({ kind: "ssn-shaped", value: match[0] });
    }
  }
  for (const match of text.matchAll(DOB_SHAPED)) {
    if (!inputSquashed.includes(squashed(match[1]))) {
      findings.push({ kind: "dob-shaped", value: match[1] });
    }
  }
  return findings;
}

export function checkNoNewPii(caseDef, record) {
  const findings = findNewPii(record.response, suppliedText(caseDef));
  return findings.length === 0
    ? result(AUTO_PASS)
    : result(
        AUTO_FAIL,
        findings.map((f) => `${f.kind} "${f.value}"`).join("; "),
      );
}

/**
 * For a writing-tool case: the veteran was handed a draft, by either path.
 * The detail says which: the model's wording passed the acceptance check, or
 * the app-built draft was returned and why. Every other case is n/a.
 */
export function checkDraftReturned(caseDef, record) {
  if (!isWritingEntry(caseDef.entry)) {
    return result(NOT_APPLICABLE, "not a writing-tool case");
  }
  const path = record.draftPath;
  if (String(record.response ?? "").trim() === "" || !path) {
    return result(AUTO_FAIL, "the tool returned no draft");
  }
  if (path === "model") {
    return result(AUTO_PASS, "model draft accepted", { path });
  }
  const reasons = (record.draftRejectReasons ?? []).join("; ");
  const why = reasons ? ` (${reasons})` : "";
  return result(AUTO_PASS, `app-built draft returned${why}`, { path });
}

const AUTHORITY_CITATIONS = [
  /\b38\s*C\.?F\.?R\.?\s*(?:§|part|\d)/i,
  /\b(?:DBQ|M21-1|BVA)\b/i,
  /\bFed(?:eral|\.)\s*Cir/i,
];
const citesAuthority = (text) =>
  AUTHORITY_CITATIONS.some((pattern) => pattern.test(text));

function rubricVerdicts(caseDef, record, checks) {
  const verdicts = {};
  for (const id of RUBRIC_CRITERIA[caseDef.expectedAgent] ?? []) {
    verdicts[id] = NEEDS_HUMAN;
  }

  if (caseDef.expectedAgent === "auditor" && !record.error) {
    if (citesAuthority(String(record.response ?? ""))) verdicts.A1 = AUTO_PASS;
    verdicts.A2 = checks["cfr-in-index"].status;
  }

  if (caseDef.expectedAgent === "rater" && !record.error) {
    const calc = checks["calc-match"];
    if (calc.status === AUTO_PASS) verdicts.R3 = AUTO_PASS;
    if (calc.data?.multipleOf10 === false) verdicts.R3 = AUTO_FAIL;
  }
  return verdicts;
}

/**
 * Run every automated check for one recorded case. Anything the rubric asks a
 * judge to weigh stays needs-human; only conditions decidable from the text
 * alone are decided here.
 */
export function gradeRecord(caseDef, record, ctx = {}) {
  if (record.error) {
    const skipped = Object.fromEntries(
      AUTOMATED_CHECK_IDS.map((id) => [
        id,
        result(NOT_APPLICABLE, "case ended in an error"),
      ]),
    );
    skipped.routing = checkRouting(caseDef, record);
    return {
      id: caseDef.id,
      checks: skipped,
      rubric: rubricVerdicts(caseDef, record, skipped),
    };
  }

  const checks = {
    routing: checkRouting(caseDef, record),
    "calc-match": checkCalcMatch(caseDef, record, ctx),
    "cfr-in-index": checkCfrCitations(record, ctx),
    "no-spotlight-echo": checkNoSpotlightEcho(record),
    "no-new-pii": checkNoNewPii(caseDef, record),
    "draft-returned": checkDraftReturned(caseDef, record),
  };
  return {
    id: caseDef.id,
    checks,
    rubric: rubricVerdicts(caseDef, record, checks),
  };
}
