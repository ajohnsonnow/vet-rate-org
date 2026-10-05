/**
 * A check of the Decision Decoder's "missing" list against the letter it was
 * decoding. It answers one narrow question: does an element name a legal
 * theory that the letter never mentions? If the letter says nothing about
 * aggravation, "evidence of aggravation" is not something the letter found
 * missing.
 *
 * It is deliberately small. What the note says is a plain fact about the
 * letter's words, so it cannot be wrong about the law. It does not try to
 * tell whether an element is already established, or whether the list leaves
 * something out; neither can be read off the text with patterns.
 */

const THEORIES = [
  {
    name: "aggravation",
    inElement: /\baggravat/i,
    inLetter: /\baggravat|\bworsen|\bpermanent(?:ly)? increas/i,
  },
  {
    name: "a presumption",
    inElement: /\bpresumpti/i,
    inLetter: /\bpresum/i,
  },
  {
    name: "secondary service connection",
    inElement: /\bsecondary (?:service )?connection\b|\bsecondary to\b/i,
    inLetter: /\bsecondary\b|\bproximately\b/i,
  },
  {
    name: "a stressor",
    inElement: /\bstressor/i,
    inLetter: /\bstressor/i,
  },
];

const RULE = "missing-element-not-in-letter";

/**
 * Corrections ({ field, rule, note }) for elements of `missing_elements`
 * that name a theory absent from `documentText`, one per theory. Empty when
 * there is no document text to compare with.
 */
export function findUnmentionedTheories(decoded, documentText) {
  const letter = String(documentText ?? "");
  const elements = decoded?.missing_elements;
  if (letter.trim() === "" || !Array.isArray(elements)) return [];
  const notes = [];
  for (const theory of THEORIES) {
    if (theory.inLetter.test(letter)) continue;
    const element = elements.find(
      (item) => typeof item === "string" && theory.inElement.test(item),
    );
    if (!element) continue;
    notes.push({
      field: "missing_elements",
      rule: RULE,
      note: `Vet-Rate check: this list names "${element}" as missing, but the decision letter does not mention ${theory.name}. Read the letter's reasons for the decision before gathering evidence for it.`,
    });
  }
  return notes;
}
