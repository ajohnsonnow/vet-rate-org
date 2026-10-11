const MAX_INITIALS = 4;
// A Latin base letter with up to three combining marks counts as one letter,
// so accents that NFKC cannot compose into one character (Q + U+0308) pass.
// Only the plain accents of the Combining Diacritical Marks block are marks
// here: \p{M} also holds combining digits (U+A8E0), combining letters
// (U+0363), enclosing marks (U+20E3) and invisible selectors (U+034F, U+FE0F),
// which would carry an identifier past the digit counter or hide a difference.
const INITIAL_RUN =
  /^(?:(?=\p{L})\p{Script=Latin}[\u0300-\u0341\u0346-\u034E\u0350-\u0362]{0,3}\.?){1,4}$/u;
const LETTER = /\p{L}/gu;
const CASE_REF_PATTERN = /^[A-Za-z0-9 \-_/#.]{1,24}$/;
const DIGIT = /\p{Nd}/gu;
const SSN_DIGITS = 9;
const FILE_NUMBER_DIGITS = 7;
const CAPITALISED_WORD = /^[A-Z][a-z]+$/;

const MESSAGES = Object.freeze({
  required: "Enter a value.",
  initialsFormat:
    "Use 1 to 4 Latin letters only. Periods are allowed after a letter, for example J.D. A hyphen is allowed after a period, for example J.-P.",
  caseRefFormat:
    "Use up to 24 characters: letters, digits, spaces and - _ / # . only.",
  ssn: "This looks like a Social Security number. Labels are visible on screen and in the workspace list, so use your organisation's own case number instead, with 6 digits or fewer.",
  fileNumber:
    "This looks like a VA file number (7 to 9 digits). Labels are visible on screen and in the workspace list, so use your organisation's own case number instead, with 6 digits or fewer.",
  nameLike: "Don't use full names. Use your organisation's case number.",
});

function normalise(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim() : "";
}

function digitCount(value) {
  return (value.match(DIGIT) ?? []).length;
}

// "J.-P." is the one hyphenated form: a single hyphen, only after an initial's
// period, so a bare "J-D" stays refused.
function initialsFormatOk(value) {
  const parts = value.split("-");
  if (parts.length > 2) return false;
  if (parts.length === 2 && !parts[0].endsWith(".")) return false;
  if (!parts.every((part) => INITIAL_RUN.test(part))) return false;
  return (value.match(LETTER) ?? []).length <= MAX_INITIALS;
}

function caseRefFormatOk(value) {
  return CASE_REF_PATTERN.test(value);
}

function privacyErrors(field, digits) {
  if (digits >= SSN_DIGITS) {
    return [{ field, code: "ssn", message: MESSAGES.ssn }];
  }
  if (digits >= FILE_NUMBER_DIGITS) {
    return [{ field, code: "file-number", message: MESSAGES.fileNumber }];
  }
  return [];
}

function looksLikeName(caseRef) {
  const words = caseRef.split(/\s+/);
  for (let i = 1; i < words.length; i += 1) {
    if (
      CAPITALISED_WORD.test(words[i - 1]) &&
      CAPITALISED_WORD.test(words[i])
    ) {
      return true;
    }
  }
  return false;
}

function fieldErrors(field, value, formatOk, formatMessage) {
  if (value === "") {
    return [{ field, code: "required", message: MESSAGES.required }];
  }
  const errors = privacyErrors(field, digitCount(value));
  if (!formatOk(value)) {
    errors.push({ field, code: "format", message: formatMessage });
  }
  return errors;
}

/**
 * Validates the two label fields a VSO types for a veteran. Messages never
 * echo the entered text, and `value` is null unless the fields are accepted,
 * so a rejected SSN-shaped string is not handed back to callers that log.
 */
export function validateLabelFields(fields) {
  const { initials, caseRef } =
    fields !== null && typeof fields === "object" ? fields : {};
  const cleanInitials = normalise(initials);
  const cleanCaseRef = normalise(caseRef);

  const initialsErrors = fieldErrors(
    "initials",
    cleanInitials,
    initialsFormatOk,
    MESSAGES.initialsFormat,
  );
  const caseRefErrors = fieldErrors(
    "caseRef",
    cleanCaseRef,
    caseRefFormatOk,
    MESSAGES.caseRefFormat,
  );
  const errors = [...initialsErrors, ...caseRefErrors];

  const combinedDigits = digitCount(cleanInitials) + digitCount(cleanCaseRef);
  const flagged = errors.some(
    (e) => e.code === "ssn" || e.code === "file-number",
  );
  if (!flagged) {
    errors.push(...privacyErrors("caseRef", combinedDigits));
  }

  const warnings = [];
  if (caseRefErrors.length === 0 && looksLikeName(cleanCaseRef)) {
    warnings.push({
      field: "caseRef",
      code: "name-like",
      message: MESSAGES.nameLike,
    });
  }

  const ok = errors.length === 0;
  return {
    ok,
    errors,
    warnings,
    value: ok ? { initials: cleanInitials, caseRef: cleanCaseRef } : null,
  };
}

export function formatSiloLabel({ initials, caseRef }) {
  return `${initials} \u00b7 ${caseRef}`;
}
