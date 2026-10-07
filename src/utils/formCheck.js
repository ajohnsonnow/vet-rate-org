/**
 * Post-generation form check. A model that names forms from memory also
 * invents form numbers; this finds VA form numbers in an answer that are in
 * neither the allowlist (src/data/validVAForms.json) nor the bundled forms
 * table, and says so under the answer. It never rewrites the answer. The
 * lists are not every form VA has, so the notice says the number could not
 * be verified, not that it does not exist.
 */

import { looksStructured } from "./citationCheck";
import { FORMS_LIST_DATE, formMentions, isKnownForm } from "./vaForms";

/** The VA form numbers an answer names that are in neither list, once each. */
export function findUnverifiedForms(text) {
  return [
    ...new Set(
      formMentions(text)
        .map((mention) => mention.number)
        .filter((number) => !isKnownForm(number)),
    ),
  ];
}

function listNumbers(numbers) {
  const [first, ...rest] = numbers;
  if (rest.length === 0) return `VA Form ${first}`;
  const last = rest.pop();
  return `VA Form ${[first, ...rest].join(", ")} and ${last}`;
}

export function buildFormNotice(numbers) {
  const one = numbers.length === 1;
  return `Vet-Rate could not verify ${one ? "a form number" : "form numbers"} in this answer: ${listNumbers(numbers)} ${one ? "is" : "are"} not in its list of VA forms (as of ${FORMS_LIST_DATE}). Check ${one ? "that number" : "those numbers"} at va.gov/find-forms or with a Veterans Service Officer before using ${one ? "it" : "them"}.`;
}

/**
 * Append the notice to a prose answer that names a form number in neither
 * list, and record it on the result (formsUnverified, plus a
 * validationWarnings line). Structured output is returned untouched.
 */
export function flagUnverifiedForms(result, options = {}) {
  const text = result?.text;
  if (typeof text !== "string" || text === "") return result;
  if (options.responseFormat || looksStructured(text)) return result;
  const forms = findUnverifiedForms(text);
  if (forms.length === 0) return result;
  return {
    ...result,
    text: `${text.trimEnd()}\n\n${buildFormNotice(forms)}`,
    validationWarnings: [
      ...(result.validationWarnings || []),
      `Answer names VA form numbers that could not be verified: ${forms.join(", ")}`,
    ],
    formsUnverified: { forms },
  };
}
