/**
 * Restores line structure to manual text the shard stores flattened (tables
 * and bullet lists run together on one line). Only line breaks, "- " list
 * markers and a colon at the end of a word are ever inserted; sameWords
 * proves no word was added, dropped, changed or moved.
 */

const BREAKS = {
  line: "\n",
  item: "\n- ",
  block: "\n\n",
  firstItem: "\n\n- ",
  colon: " ",
};

const quote = (value) => JSON.stringify(value);

/**
 * Break `flat` before each phrase in `steps`, in order. A step is
 * { at, as, colon }: `at` is a phrase copied from the text, searched for
 * after the previous step's phrase, and `as` is "line" (new line), "item"
 * (new line starting "- "), "block" (blank line first), "firstItem" (blank
 * line, then an item) or "colon" (same line, after a colon). `colon: true`
 * on any other step ends the text before the break with a colon, for a
 * label that introduces what follows. The space before the phrase becomes
 * the break. A phrase that is missing, or that does not start at a word
 * boundary, throws, so a change in the source fails the build.
 */
export function structureText(flat, steps) {
  let out = "";
  let cursor = 0;
  let searchFrom = 0;
  let previous = null;
  for (const { at, as, colon = as === "colon" } of steps) {
    if (BREAKS[as] === undefined) throw new Error(`unknown break ${quote(as)}`);
    const lead = `${colon ? ":" : ""}${BREAKS[as]}`;
    const found = flat.indexOf(at, searchFrom);
    if (found === -1) {
      const where = previous ? ` after ${quote(previous)}` : "";
      throw new Error(`${quote(at)} not found${where}`);
    }
    if (found === 0 || flat[found - 1] !== " ") {
      throw new Error(`${quote(at)} would break inside a word`);
    }
    out += flat.slice(cursor, found - 1) + lead;
    cursor = found;
    searchFrom = found + at.length;
    previous = at;
  }
  return out + flat.slice(cursor);
}

const withoutListMarkers = (text) =>
  text
    .split("\n")
    .map((line) => (line.startsWith("- ") ? line.slice(2) : line))
    .join("\n");

const wordsOf = (text) => text.split(/\s+/).filter(Boolean);

/**
 * True when `structured` is `source` with nothing changed but line breaks,
 * "- " markers at the start of a line, and a colon added to the end of a
 * word. Every source word must be there, in order, with its own punctuation.
 */
export function sameWords(source, structured) {
  const original = wordsOf(source);
  const shown = wordsOf(withoutListMarkers(structured));
  return (
    original.length === shown.length &&
    original.every((word, i) => shown[i] === word || shown[i] === `${word}:`)
  );
}
