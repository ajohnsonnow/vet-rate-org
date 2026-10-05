/**
 * Pure text extraction for the verified-reference bundle. Every function
 * takes records already read from the repo's indexed sources (the eCFR legal
 * index and the M21-1 shard) and returns text copied from them; nothing here
 * writes regulation text of its own.
 */

import { isGitLfsPointer } from "../../eval/lib/legalSections.js";

export function parseJsonl(text, label = "file") {
  if (isGitLfsPointer(text)) {
    throw new Error(
      `${label} is a git-lfs pointer, not the real file (run \`git lfs pull\` or pass --source-root <checkout that has it>)`,
    );
  }
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`${label} line ${i + 1} is not JSON: ${err.message}`);
      }
    });
}

/**
 * The index stores eCFR text with spaces around paragraph designators and
 * before punctuation that followed a link ("( b )", "§ 3.160(a) ."). Close
 * those up; words are untouched.
 */
export function tidyRegulationText(text) {
  return String(text)
    .replaceAll("( ", "(")
    .replaceAll(" )", ")")
    .replaceAll(" ,", ",")
    .replaceAll(" .", ".")
    .replaceAll(" ;", ";")
    .trim();
}

const chunkIndex = (record) => Number(/_(\d+)$/.exec(record.id)?.[1] ?? 0);

const byChunkIndex = (a, b) => chunkIndex(a) - chunkIndex(b);

export const sectionRecords = (records, section) =>
  records
    .filter((r) => r.citation === `38 CFR § ${section}`)
    .sort(byChunkIndex);

/**
 * The paragraphs of one indexed 38 CFR section, heading first, in order.
 * Text the index places above the section heading (the part's editorial
 * note) is dropped.
 */
export function sectionParagraphs(records, section) {
  const own = sectionRecords(records, section);
  if (own.length === 0) {
    throw new Error(`38 CFR § ${section} is not in the legal index`);
  }
  const paragraphs = own
    .map((r) => r.text)
    .join("\n\n")
    .split(/\n{2,}/)
    .map(tidyRegulationText)
    .filter(Boolean);
  const heading = paragraphs.findIndex((p) => p.startsWith(`§ ${section} `));
  if (heading === -1) {
    throw new Error(`38 CFR § ${section}: heading paragraph not found`);
  }
  return paragraphs.slice(heading);
}

const OMITTED = "[...]";

function uniqueIndex(paragraphs, prefix) {
  const hits = paragraphs
    .map((p, i) => (p.startsWith(prefix) ? i : -1))
    .filter((i) => i !== -1);
  if (hits.length === 0) {
    throw new Error(`no paragraph starts with ${JSON.stringify(prefix)}`);
  }
  if (hits.length > 1) {
    throw new Error(
      `${hits.length} paragraphs start with ${JSON.stringify(prefix)}; use a longer prefix`,
    );
  }
  return hits[0];
}

function splitAtSentence(paragraph, count) {
  const boundary = /\.\s+(?=[A-Z])/g;
  let cut = -1;
  for (let i = 0; i < count; i += 1) {
    const match = boundary.exec(paragraph);
    if (!match) {
      throw new Error(
        `paragraph ${JSON.stringify(paragraph.slice(0, 40))} has fewer than ${count + 1} sentences`,
      );
    }
    cut = match.index + 1;
  }
  return [paragraph.slice(0, cut), paragraph.slice(cut).trim()];
}

function resolveSelector(paragraphs, selector) {
  if (typeof selector === "string") {
    const index = uniqueIndex(paragraphs, selector);
    return [{ index, text: paragraphs[index] }];
  }
  if (selector.from !== undefined) {
    const first = uniqueIndex(paragraphs, selector.from);
    const last = uniqueIndex(paragraphs, selector.through);
    if (last < first) {
      throw new Error(
        `${JSON.stringify(selector.through)} comes before ${JSON.stringify(selector.from)}`,
      );
    }
    return paragraphs
      .slice(first, last + 1)
      .map((text, offset) => ({ index: first + offset, text }));
  }
  const index = uniqueIndex(paragraphs, selector.start);
  if (selector.firstSentences !== undefined) {
    const [head] = splitAtSentence(paragraphs[index], selector.firstSentences);
    return [{ index, text: head, cutAfter: true }];
  }
  const [, tail] = splitAtSentence(paragraphs[index], selector.afterSentences);
  return [{ index, text: tail, cutBefore: true }];
}

/**
 * Copy the selected paragraphs, in source order, joined by newlines. A
 * selector is the opening words of exactly one paragraph, an inclusive run
 * { from, through }, or part of one paragraph { start, firstSentences } /
 * { start, afterSentences }. "[...]" marks every place where source text
 * between or inside the selected paragraphs was left out.
 */
export function selectParagraphs(paragraphs, selectors) {
  const picked = selectors.flatMap((s) => resolveSelector(paragraphs, s));
  const lines = [];
  picked.forEach((item, i) => {
    const previous = picked[i - 1];
    const gap = previous && item.index > previous.index + 1;
    const alreadyMarked = lines[lines.length - 1] === OMITTED;
    if ((gap || item.cutBefore) && !alreadyMarked) lines.push(OMITTED);
    lines.push(item.text);
    if (item.cutAfter) lines.push(OMITTED);
  });
  return lines.join("\n");
}

const MAX_OVERLAP = 1200;

function overlapLength(previous, next) {
  const max = Math.min(previous.length, next.length, MAX_OVERLAP);
  for (let size = max; size > 0; size -= 1) {
    if (previous.endsWith(next.slice(0, size))) return size;
  }
  return 0;
}

/**
 * Rebuild one article from its shard chunks. Consecutive chunks repeat the
 * tail of the one before; the repeat is dropped.
 */
export function stitchChunks(records) {
  return [...records].sort(byChunkIndex).reduce((text, record) => {
    if (!text) return record.text;
    const overlap = overlapLength(text, record.text);
    return overlap > 0
      ? text + record.text.slice(overlap)
      : `${text} ${record.text}`;
  }, "");
}

/**
 * One topic of a stitched manual article: from its heading up to the next
 * heading, cut at the first stop marker (the "References:" tail) when given.
 * Both headings must be present and the start heading must occur once.
 */
export function sliceTopic(text, { start, end, stopAt = [] }) {
  const from = text.indexOf(start);
  if (from === -1) throw new Error(`topic heading ${start} not found`);
  if (text.indexOf(start, from + start.length) !== -1) {
    throw new Error(`topic heading ${start} occurs more than once`);
  }
  const to = text.indexOf(end, from + start.length);
  if (to === -1) throw new Error(`end marker ${end} not found after ${start}`);
  let body = text.slice(from, to);
  for (const marker of stopAt) {
    const at = body.indexOf(marker);
    if (at !== -1) body = body.slice(0, at);
  }
  return body.trim();
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const plainQuotes = (value) => value.replace(/[\u2018\u2019]/g, "'");
const TRAILING_PUNCTUATION = new Set([",", ".", ";"]);
const bareWord = (word) => {
  let end = word.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(word[end - 1])) end -= 1;
  return word.slice(0, end);
};
const wordKey = (word) => bareWord(word ?? "").toLowerCase();
const MAX_TITLE_WORDS = 24;
const MIN_TITLE_MENTIONS = 2;

function mostCommon(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((x, y) => y[1] - x[1])[0];
}

/**
 * The mentions that agree on the word at one position, or null when fewer
 * than two, or fewer than half, do, or when they move on to the next form
 * in a list ("... Supplemental Claim VA Form 20-0996, ...").
 */
function agreeingMentions(mentions, position) {
  const keys = mentions
    .map((words) => wordKey(words[position]))
    .filter(Boolean);
  if (keys.length === 0) return null;
  const [best, count] = mostCommon(keys);
  if (count < MIN_TITLE_MENTIONS || count * 2 < mentions.length) return null;
  const agreeing = mentions.filter((w) => wordKey(w[position]) === best);
  const nextForm =
    best === "va" && agreeing.some((w) => w[position + 1] === "Form");
  return nextForm ? null : agreeing;
}

/**
 * The title a manual gives a form: the run of words that follows
 * "VA Form <number>, " in most mentions. Mentions that carry on with prose
 * ("VA Form 20-0995, or other prescribed form") start lower-case and are not
 * counted. Returns null unless at least two mentions agree.
 */
export function extractFormTitle(texts, number) {
  const pattern = new RegExp(
    String.raw`VA Form ${escapeRegExp(number)}, ([A-Z][^\n]{0,260})`,
    "g",
  );
  let mentions = texts.flatMap((text) =>
    [...plainQuotes(text).matchAll(pattern)].map((match) =>
      match[1].split(" ").filter(Boolean),
    ),
  );
  const title = [];
  while (title.length < MAX_TITLE_WORDS) {
    const agreeing = agreeingMentions(mentions, title.length);
    if (!agreeing) break;
    mentions = agreeing;
    title.push(mostCommon(mentions.map((w) => w[title.length]))[0]);
  }
  if (title.length === 0) return null;
  return { title: bareWord(title.join(" ")), mentions: mentions.length };
}

const SECTION_CITATION = /^38 CFR § (\d+)\.(\d+)([a-z]?)(?:-(?:\d+\.)?(\d+))?$/;

const sectionOrder = (a, b) => {
  const [, aNum, aLetter] = /\.(\d+)([a-z]?)$/.exec(a);
  const [, bNum, bLetter] = /\.(\d+)([a-z]?)$/.exec(b);
  return Number(aNum) - Number(bNum) || aLetter.localeCompare(bLetter);
};

/**
 * Every section number the legal index holds for the given parts, as
 * "<part>.<section>[letter]". A reserved range ("§§ 3.18-3.19 [Reserved]")
 * contributes each number in the range.
 */
export function collectSections(records, parts) {
  const found = Object.fromEntries(parts.map((part) => [part, new Set()]));
  for (const record of records) {
    const match = SECTION_CITATION.exec(String(record?.citation ?? ""));
    if (!match) continue;
    const [, part, first, letter, last] = match;
    if (!found[part]) continue;
    if (last === undefined) {
      found[part].add(`${part}.${first}${letter}`);
      continue;
    }
    for (let n = Number(first); n <= Number(last); n += 1) {
      found[part].add(`${part}.${n}`);
    }
  }
  return Object.fromEntries(
    Object.entries(found).map(([part, set]) => [
      part,
      [...set].sort(sectionOrder),
    ]),
  );
}
