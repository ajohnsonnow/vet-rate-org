/**
 * Free text and lists the local parser read from a DD-214 (education, awards,
 * qualifications, remarks, unit and duty lines, deployments) get the same
 * treatment as text a model wrote (ADR-009 decision G): a length ceiling per
 * entry, SSN and birth-date shapes removed, the PII scrubber, known-value
 * redaction, and person, city and ZIP shapes removed. An entry that is mostly
 * redaction marks, or longer than a real entry of its kind, is dropped. The
 * parser is deterministic but its block matches can still run on into a
 * neighbouring box, so its text is never trusted as read.
 */
import { makeScrubber } from "./dd214ModelOutputGuards";
import { cleanEnumeratedField } from "./dd214EnumeratedFields";

export const PARSER_TEXT_CAPS = {
  mosTitle: 80,
  lastDutyAssignment: 150,
  commandTransferredTo: 150,
  narrativeReason: 150,
  militaryEducation: 150,
  specialQualifications: 60,
  awardName: 120,
  awardAbbreviation: 20,
  device: 40,
  remarks: 5000,
  placeOfEntry: 80,
  stationWhereSeparated: 100,
  deploymentPlace: 60,
  combatEntry: 100,
};

const MARK = "[REDACTED]";
const MARKS = /\[(?:REDACTED[A-Z_]*|file name)\]/g;
const MAX_REDACTED_SHARE = 0.5;
const MIN_REAL_CHARS = 3;
const MAX_DEVICE_COUNT = 20;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const SSN_SHAPE = /(?<!\d)(?:\d{3}[- ]\d{2}[- ]\d{4}|\d{9})(?!\d)/g;
const BIRTH_LABEL = String.raw`(?:DATE\s{1,5}OF\s{1,5}BIRTH|BIRTH\s{0,3}DATE|DOB|BORN)\W{0,5}`;
const DATE_VALUES = [
  String.raw`\d{8}`,
  String.raw`\d{4}[-/. ]\d{2}[-/. ]\d{2}`,
  String.raw`\d{1,2}[-/. ]\d{1,2}[-/. ]\d{2,4}`,
  String.raw`\d{1,2}[ -][A-Z]{3}[A-Z]{0,6}[ ,.-]{0,3}\d{2,4}`,
];
const LABELLED_BIRTH_DATE = new RegExp(
  `${BIRTH_LABEL}(?:${DATE_VALUES.join("|")})`,
  "gi",
);

const BARE_NUMERIC_DATE = /(?<!\d)\d{1,2}[ ./-]\d{1,2}[ ./-]\d{4}(?!\d)/g;

function removeBirthDateAndSsnShapes(text) {
  return text
    .replace(SSN_SHAPE, MARK)
    .replace(LABELLED_BIRTH_DATE, MARK)
    .replace(BARE_NUMERIC_DATE, MARK);
}

function isMostlyRedacted(text) {
  const marks = text.match(MARKS) ?? [];
  if (marks.length === 0) return false;
  const markChars = marks.join("").length;
  const real = text.replace(MARKS, "").replace(/[^\p{L}\p{N}]+/gu, "");
  return (
    real.length < MIN_REAL_CHARS ||
    markChars >= text.length * MAX_REDACTED_SHARE
  );
}

function cleanItem(value, cap, scrub) {
  if (typeof value !== "string") return undefined;
  const flat = value.replace(/\s+/g, " ").trim();
  if (flat === "" || flat.length > cap) return undefined;
  const text = scrub(removeBirthDateAndSsnShapes(flat));
  return text === "" || isMostlyRedacted(text) ? undefined : text;
}

function cleanList(value, cap, scrub) {
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => cleanItem(item, cap, scrub))
    .filter((item) => item !== undefined);
}

function cleanParserAward(award, scrubShort) {
  if (!award || typeof award !== "object" || Array.isArray(award)) {
    return undefined;
  }
  const name = cleanItem(award.name, PARSER_TEXT_CAPS.awardName, scrubShort);
  if (name === undefined) return undefined;
  const count = award.deviceCount;
  return {
    name,
    abbreviation:
      cleanItem(
        award.abbreviation,
        PARSER_TEXT_CAPS.awardAbbreviation,
        scrubShort,
      ) ?? "",
    devices: cleanList(
      award.devices ?? [],
      PARSER_TEXT_CAPS.device,
      scrubShort,
    ),
    deviceCount:
      Number.isInteger(count) && count >= 0 && count <= MAX_DEVICE_COUNT
        ? count
        : 0,
    isCombat: award.isCombat === true,
  };
}

function cleanParserDeployment(entry, scrubShort) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return undefined;
  }
  const cap = PARSER_TEXT_CAPS.deploymentPlace;
  const location = cleanItem(entry.location, cap, scrubShort);
  const operation = cleanItem(entry.operation, cap, scrubShort);
  if (location === undefined && operation === undefined) return undefined;
  const out = {};
  if (location !== undefined) out.location = location;
  if (operation !== undefined) out.operation = operation;
  for (const key of ["startDate", "endDate"]) {
    if (typeof entry[key] === "string" && ISO_DATE.test(entry[key])) {
      out[key] = entry[key];
    }
  }
  return out;
}

// Built from the cleaned parts, so its dates are not run through the scrubber
// (which reads a date as a birth date or file number).
const describeDeployment = (entry) =>
  entry.location
    ? `${entry.location} ${entry.startDate || ""}-${entry.endDate || ""}`.trim()
    : entry.operation;

function cleanParserCombat(value, scrubShort) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const cap = PARSER_TEXT_CAPS.combatEntry;
  return {
    hasVerifiedCombat: value.hasVerifiedCombat === true,
    indicators: cleanList(value.indicators ?? [], cap, scrubShort),
    deployments: cleanList(value.deployments ?? [], cap, scrubShort),
  };
}

const set = (out, key, value) => {
  if (value === undefined) delete out[key];
  else out[key] = value;
};

const PROSE_KEYS = [
  "lastDutyAssignment",
  "commandTransferredTo",
  "narrativeReason",
  "remarks",
];
const SHORT_TEXT_KEYS = ["mosTitle"];
const PLAIN_TEXT_KEYS = ["placeOfEntry", "stationWhereSeparated"];
const LIST_KEYS = ["militaryEducation", "specialQualifications"];

// The extractor upper-cases the whole page, so a run of capitalised words is
// not a sign of a name the way it is in model text: parser prose is checked
// for short name-length runs only, like a course or award title.
function cleanParserStrings(out, scrubs) {
  const groups = [
    [PROSE_KEYS, scrubs.scrubShort],
    [SHORT_TEXT_KEYS, scrubs.scrubShort],
    [PLAIN_TEXT_KEYS, scrubs.scrub],
  ];
  for (const [keys, scrub] of groups) {
    for (const key of keys) {
      if (key in out) {
        set(out, key, cleanItem(out[key], PARSER_TEXT_CAPS[key], scrub));
      }
    }
  }
  for (const key of LIST_KEYS) {
    if (key in out) {
      set(
        out,
        key,
        cleanList(out[key], PARSER_TEXT_CAPS[key], scrubs.scrubShort),
      );
    }
  }
}

// Fields that hold only a fixed word or a code. They are pre-tickable, so a
// capture that ran on into a name, a date or a street must never get through:
// the value is held to the same list or shape a model's value must match, and
// dropped (the model's own value then fills the row, labelled as read by the
// AI, unticked) when it does not.
const CODED_KEYS = [
  "branch",
  "component",
  "componentFull",
  "rank",
  "payGrade",
  "sglCoverage",
  "giBlStatus",
  "separationAuthority",
  "separationCode",
  "reentryCode",
  "separationProgramDesignator",
  "separationType",
  "characterOfService",
  "securityClearance",
];

function cleanParserCodedFields(out) {
  for (const key of CODED_KEYS) {
    if (key in out) {
      set(
        out,
        key,
        cleanEnumeratedField(key, out[key], { branch: out.branch }),
      );
    }
  }
}

function cleanParserStructures(out, scrubShort) {
  if (Array.isArray(out.awards)) {
    out.awards = out.awards
      .map((award) => cleanParserAward(award, scrubShort))
      .filter(Boolean);
  }
  if (Array.isArray(out.deployments)) {
    out.deployments = out.deployments
      .map((entry) => cleanParserDeployment(entry, scrubShort))
      .filter(Boolean);
  }
  if ("combatService" in out) {
    const combat = cleanParserCombat(out.combatService, scrubShort);
    if (combat && Array.isArray(out.deployments)) {
      combat.deployments = out.deployments.map(describeDeployment);
    }
    set(out, "combatService", combat);
  }
}

/**
 * A copy of the parser's fields with every free-text and list value cleaned.
 * Identifier fields (name, SSN last four, birth date, home of record, mailing
 * address) are left as read: they are what the known-value redaction is built
 * from, and they are never pre-selected or saved without a tick.
 */
export function sanitizeParserFields(fields, sources = []) {
  if (!fields || typeof fields !== "object") return fields;
  const scrubs = makeScrubber(sources);
  const out = { ...fields };
  cleanParserCodedFields(out);
  cleanParserStrings(out, scrubs);
  cleanParserStructures(out, scrubs.scrubShort);
  return out;
}
