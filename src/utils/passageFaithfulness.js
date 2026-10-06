/**
 * Vet-Rate.org - is a rewording faithful to the passage it rewords?
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The strict rules for a model's rewording of a passage a veteran typed
 * about themselves. They exist because a looser check accepted, from real
 * model runs, a dropped fact ("Nightmares wake me" as "I have nightmares"),
 * a lost cause ("so" as "and"), a verb made into a noun ("My favoring is"),
 * and a present symptom moved to the past ("I was slower").
 *
 * A rewording may add only joining words: a subject, an article, a
 * preposition, "and", "while", and a form of "be" or "have" that does not
 * move the tense. Everything else in the passage has to be there, and
 * nothing else may be new. The rules are about words, not meaning, so they
 * turn down some faithful rewordings; then the typed words stand, which is
 * always safe.
 */

const words = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\bcan't\b/g, "can not")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bcannot\b/g, "can not")
    .replace(/n't\b/g, " not")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\b(i|we|they|you)'ve\b/g, "$1 have")
    .replace(/'s\b/g, "")
    .match(/[a-z0-9]+/g) ?? [];

const set = (list) => new Set(list.split(" "));

// Joining words a rewording may add or leave out freely.
const JOINING = set(
  "a an the and or of to in on at by for with from as that which who it its this these those there here while i me my mine myself we us our",
);
const PAST_AUX = set("was were had did");
const PRESENT_AUX = set("am is are have has do does");
const BE_OR_HAVE = set("be been being");
// Words that state a cause, a contrast or an order of events.
const CONNECTIVES = set(
  "so because but after until before since although though unless if when whenever however therefore despite",
);
const IRREGULAR_PAST = set(
  "gave went fell got took came left saw felt lost broke made said told began became ran woke slept kept stood sat threw caught found heard knew did",
);
const NOT_PAST_DESPITE_ED = set("need feed speed bleed indeed exceed proceed");
const DETERMINERS = set("my the a an his her their our this that");
const FIRST_PERSON_SUBJECT = "i";
const FIRST_PERSON_OBJECT = set("me myself");

const isFree = (word) =>
  JOINING.has(word) ||
  PAST_AUX.has(word) ||
  PRESENT_AUX.has(word) ||
  BE_OR_HAVE.has(word);

/* A word's stem, so a change of ending is not a change of word. Crude. */
function stemOf(word) {
  const base = word
    .replace(/ies$/, "y")
    .replace(/(?:ing|ed|es|s)$/, (ending, at) => (at >= 3 ? "" : ending));
  const undoubled = /([b-df-hj-np-tv-z])\1$/.test(base)
    ? base.slice(0, -1)
    : base;
  return undoubled.length > 3 ? undoubled.replace(/e$/, "") : undoubled;
}

const endsInEd = (word) =>
  word.length >= 5 && word.endsWith("ed") && !NOT_PAST_DESPITE_ED.has(word);
const quoted = (list) =>
  [...new Set(list)].map((word) => `"${word}"`).join(", ");

function wordProblems(before, after) {
  const main = (list) => list.filter((word) => !isFree(word));
  const afterStems = new Set(after.map(stemOf));
  const beforeStems = new Set(before.map(stemOf));
  const gone = main(before).filter((word) => !afterStems.has(stemOf(word)));
  const added = main(after).filter((word) => !beforeStems.has(stemOf(word)));
  const problems = [];
  const lost = gone.filter((word) => CONNECTIVES.has(word));
  const dropped = gone.filter((word) => !CONNECTIVES.has(word));
  if (dropped.length > 0) problems.push(`drops ${quoted(dropped)}`);
  if (lost.length > 0) problems.push(`loses ${quoted(lost)}`);
  if (added.length > 0) problems.push(`adds ${quoted(added)}`);
  return problems;
}

function tenseProblems(before, after) {
  const had = new Set(before);
  const passagePast = before.some(
    (word) => PAST_AUX.has(word) || IRREGULAR_PAST.has(word) || endsInEd(word),
  );
  const passagePresent = before.some((word) => PRESENT_AUX.has(word));
  const newPast = after.filter((word) => PAST_AUX.has(word) && !had.has(word));
  const newPresent = after.filter(
    (word) => PRESENT_AUX.has(word) && !had.has(word),
  );
  const problems = [];
  if (newPast.length > 0 && !passagePast) {
    problems.push(`moves the passage to the past: adds ${quoted(newPast)}`);
  }
  if (newPresent.length > 0 && passagePast && !passagePresent) {
    problems.push(
      `moves the passage to the present: adds ${quoted(newPresent)}`,
    );
  }
  return problems;
}

/** Changes of a word's own form: into the past, out of it, or into a noun. */
function formProblems(before, after) {
  const problems = [];
  const formsAfter = (stem) => after.filter((word) => stemOf(word) === stem);
  for (const stem of new Set(before.filter((w) => !isFree(w)).map(stemOf))) {
    const was = before.filter((word) => stemOf(word) === stem);
    const now = formsAfter(stem);
    if (now.length === 0) continue;
    const wasPast = was.some(endsInEd);
    const nowPast = now.filter(endsInEd);
    if (!wasPast && nowPast.length > 0) {
      problems.push(`moves "${was[0]}" to the past (${quoted(nowPast)})`);
    } else if (wasPast && nowPast.length === 0) {
      problems.push(`changes the form of "${was.find(endsInEd)}"`);
    }
  }
  const afterDeterminer = (list, word) =>
    list.some((item, i) => item === word && DETERMINERS.has(list[i - 1]));
  for (const word of new Set(
    before.filter((w) => w.length >= 6 && w.endsWith("ing")),
  )) {
    const made = formsAfter(stemOf(word)).filter((form) =>
      form.endsWith("ing"),
    );
    if (
      made.some((form) => afterDeterminer(after, form)) &&
      !afterDeterminer(before, word)
    ) {
      problems.push(`turns "${word}" into a noun`);
    }
  }
  return problems;
}

/**
 * A passage that speaks of the writer only as "me" has someone or something
 * else as its subject ("Nightmares wake me", "driven home by me"). A
 * rewording that brings in "I" has changed who acts.
 */
function subjectProblems(before, after) {
  const objectOnly =
    before.some((word) => FIRST_PERSON_OBJECT.has(word)) &&
    !before.includes(FIRST_PERSON_SUBJECT);
  return objectOnly && after.includes(FIRST_PERSON_SUBJECT)
    ? ['makes "I" the subject where the passage had only "me"']
    : [];
}

/**
 * Why `rewrite` is not a faithful rewording of `original`, as a list of
 * plain reasons; empty when it passes.
 */
export function faithfulnessProblems(original, rewrite) {
  const before = words(original);
  const after = words(rewrite);
  return [
    ...wordProblems(before, after),
    ...tenseProblems(before, after),
    ...formProblems(before, after),
    ...subjectProblems(before, after),
  ];
}
