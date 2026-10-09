const INITIALS_PATTERN = /^(?:\p{L}\.?){1,4}$/u;
const CASE_REF_PATTERN = /^[A-Za-z0-9 \-_/#.]{1,24}$/;
const DIGIT = /\p{Nd}/gu;
const SSN_DIGITS = 9;
const FILE_NUMBER_DIGITS = 8;
const CAPITALISED_WORD = /^[A-Z][a-z]+$/;

const MESSAGES = Object.freeze({
  required: "Enter a value.",
  initialsFormat:
    "Use 1 to 4 letters only. Periods are allowed after a letter, for example J.D.",
  caseRefFormat:
    "Use up to 24 characters: letters, digits, spaces and - _ / # . only.",
  ssn: "This looks like a Social Security number. Labels are visible on screen and in the workspace list, so use your organisation's case number instead.",
  fileNumber:
    "This looks like a VA file number. Labels are visible on screen and in the workspace list, so use your organisation's case number instead.",
  nameLike: "Don't use full names. Use your organisation's case number.",
});

function normalise(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim() : "";
}

function digitCount(value) {
  return (value.match(DIGIT) ?? []).length;
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

function fieldErrors(field, value, formatPattern, formatMessage) {
  if (value === "") {
    return [{ field, code: "required", message: MESSAGES.required }];
  }
  const errors = privacyErrors(field, digitCount(value));
  if (!formatPattern.test(value)) {
    errors.push({ field, code: "format", message: formatMessage });
  }
  return errors;
}

/**
 * Validates the two label fields a VSO types for a veteran. Messages never
 * echo the entered text, and `value` is null unless the fields are accepted,
 * so a rejected SSN-shaped string is not handed back to callers that log.
 */
export function validateLabelFields({ initials, caseRef } = {}) {
  const cleanInitials = normalise(initials);
  const cleanCaseRef = normalise(caseRef);

  const initialsErrors = fieldErrors(
    "initials",
    cleanInitials,
    INITIALS_PATTERN,
    MESSAGES.initialsFormat,
  );
  const caseRefErrors = fieldErrors(
    "caseRef",
    cleanCaseRef,
    CASE_REF_PATTERN,
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
