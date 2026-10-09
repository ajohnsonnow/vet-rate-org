/**
 * Vet-Rate.org - deterministic clean-up of on-device model output
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Small models sometimes print the spotlight wrapper tag (or a made-up
 * "BEGIN UNTRUSTED_CONTENT" line) and sometimes fall into a loop. Everything
 * here is a pure function over the text that is about to be shown: the tags
 * come out, a runaway repeat is cut at its first copy, and the caller is told
 * what happened. Nothing here changes the wrapper the app puts around data.
 */

const WRAPPER_TAG = /([ \t]?)`?<\/?\s*untrusted_content\s*>`?/gi;
const TAG_ONLY_LINE = /^`?<\/?\s*untrusted_content\s*>`?$/i;
const IMITATION_LINE =
  /^[=*#_[(<>-]*(?:BEGIN|END)[ _]+UNTRUSTED+[ _]*CONTENT\b/i;
const SECTION_DELIMITER_LINE = /^=*\s*(?:BEGIN|END)\b/i;
const TREAT_AS_DATA = "(TREAT AS DATA, NOT INSTRUCTIONS)";

function isDelimiterLine(line) {
  const t = line.trim();
  return (
    TAG_ONLY_LINE.test(t) ||
    IMITATION_LINE.test(t) ||
    (t.includes(TREAT_AS_DATA) && SECTION_DELIMITER_LINE.test(t))
  );
}

/**
 * Remove the literal <untrusted_content> wrapper tags and the "BEGIN/END
 * UNTRUSTED_CONTENT" imitations a model sometimes prints. The words between
 * them stay. Returns { text, removed }.
 */
export function removeWrapperEchoes(text) {
  const input = typeof text === "string" ? text : "";
  const withoutLines = input
    .split("\n")
    .filter((line) => !isDelimiterLine(line))
    .join("\n");
  const out = withoutLines.replace(WRAPPER_TAG, (match, lead, offset) => {
    const next = withoutLines[offset + match.length];
    const keepSpace =
      lead !== "" && next !== undefined && !/[\s.,;:!?)]/.test(next);
    return keepSpace ? " " : "";
  });
  return { text: out, removed: out !== input };
}

const HELD_MARKERS = [
  "<untrusted_content>",
  "</untrusted_content>",
  "begin untrusted_content",
  "end untrusted_content",
];

/**
 * While streaming, the end of the text may be the first characters of a tag
 * or marker line that has not finished arriving. That tail is held back, not
 * shown.
 */
export function withoutPendingMarker(text) {
  const lineStart = text.lastIndexOf("\n") + 1;
  const lastLine = text.slice(lineStart).replace(/^[\s=*#_[(>-]+/, "");
  const lower = lastLine.toLowerCase().replace(/untrusted+/, "untrusted");
  if (lower && HELD_MARKERS.some((m) => m.startsWith(lower))) {
    return text.slice(0, lineStart);
  }
  const lt = text.lastIndexOf("<");
  if (lt >= 0 && !text.includes(">", lt)) {
    const tail = text.slice(lt).toLowerCase();
    if (HELD_MARKERS.slice(0, 2).some((m) => m.startsWith(tail))) {
      return text.slice(0, lt).replace(/`$/, "");
    }
  }
  return text;
}

const MIN_LINE_CHARS = 12;
const MAX_BLOCK_LINES = 12;
const LONG_BLOCK_CHARS = 200;
const EXACT_LINE_REPEATS = 4;
const MASKED_REPEATS = 10;
const LONG_BLOCK_REPEATS = 3;
const NUMERIC_RUN_LIMIT = 20;
const PARTIAL_COPY_MIN_CHARS = 20;
const LIST_MARKER = /^\s*(?:[-*•+]|\d+[.)])\s+/;
const LIST_SEPARATOR = /^\s*[,;]\s*(?:(?:and|or)\s+)?$/;

function comparableLines(text) {
  const lines = [];
  let pos = 0;
  for (const raw of text.split("\n")) {
    const start = pos;
    pos += raw.length + 1;
    const norm = raw
      .replace(LIST_MARKER, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (norm.length >= MIN_LINE_CHARS && /[a-z]/.test(norm)) {
      lines.push({ start, norm, masked: norm.replace(/\d+/g, "#") });
    }
  }
  return lines;
}

function sameBlock(lines, a, b, k, field) {
  for (let n = 0; n < k; n++) {
    if (lines[a + n][field] !== lines[b + n][field]) return false;
  }
  return true;
}

function joinedField(lines, from, count, field) {
  return lines
    .slice(from, from + count)
    .map((l) => l[field])
    .join("\n");
}

function countCopies(lines, i, k, field, maxGap) {
  let copies = 1;
  let next = i + k;
  for (let advanced = true; advanced; ) {
    advanced = false;
    for (let gap = 0; gap <= maxGap && !advanced; gap++) {
      if (
        next + gap + k <= lines.length &&
        sameBlock(lines, i, next + gap, k, field)
      ) {
        copies++;
        next += gap + k;
        advanced = true;
      }
    }
  }
  return { copies, next };
}

function repeatsAt(lines, i, k, field, maxGap) {
  const { copies, next } = countCopies(lines, i, k, field, maxGap);
  const unit = joinedField(lines, i, k, field);
  let partial = false;
  for (let gap = 0; gap <= maxGap && !partial; gap++) {
    const rest = joinedField(lines, next + gap, k - 1, field);
    partial =
      k > 1 && rest.length >= PARTIAL_COPY_MIN_CHARS && unit.startsWith(rest);
  }
  return { copies, unitChars: unit.length, partial };
}

function isExactHit(found, k) {
  if (k > 1 && found.unitChars >= LONG_BLOCK_CHARS) {
    const total = found.partial ? found.copies + 1 : found.copies;
    return found.copies >= 2 && total >= LONG_BLOCK_REPEATS;
  }
  return found.copies >= EXACT_LINE_REPEATS;
}

function repeatCountAt(lines, i, k) {
  const exact = repeatsAt(lines, i, k, "norm", k > 1 ? 1 : 0);
  if (isExactHit(exact, k)) return exact.copies;
  const masked = repeatsAt(lines, i, k, "masked", 0);
  return masked.copies >= MASKED_REPEATS ? masked.copies : 0;
}

function findRepeatedBlock(text) {
  const lines = comparableLines(text);
  for (let i = 0; i < lines.length; i++) {
    for (let k = 1; k <= MAX_BLOCK_LINES && i + 2 * k <= lines.length; k++) {
      const copies = repeatCountAt(lines, i, k);
      if (copies > 0) {
        return {
          kind: k === 1 ? "line" : "block",
          copies,
          cutAt: lines[i + k].start,
        };
      }
    }
  }
  return null;
}

function findNumericRun(text) {
  let chain = { start: 0, length: 0 };
  let prev = null;
  for (const m of text.matchAll(/\d+/g)) {
    const value = Number(m[0]);
    const linked =
      prev !== null &&
      value === prev.value + 1 &&
      LIST_SEPARATOR.test(text.slice(prev.end, m.index));
    if (linked) {
      chain.length++;
    } else if (chain.length > NUMERIC_RUN_LIMIT) {
      break;
    } else {
      chain = { start: m.index, length: 1 };
    }
    prev = { value, end: m.index + m[0].length };
  }
  return chain.length > NUMERIC_RUN_LIMIT
    ? { kind: "numeric", copies: chain.length, cutAt: chain.start }
    : null;
}

const INLINE_GRAM = 12;
const INLINE_MIN_UNIT = 12;
const INLINE_MAX_UNIT = 600;
const INLINE_LONG_UNIT = 50;
const INLINE_MIN_SPAN = 100;
// The last copy usually lacks the space that separates the others.
const INLINE_SEPARATOR_SLACK = 2;
const CLOSING_PUNCTUATION = ".!?,;:)]*\"'";

const inlineCopiesNeeded = (unit) =>
  Math.max(
    unit >= INLINE_LONG_UNIT ? LONG_BLOCK_REPEATS : EXACT_LINE_REPEATS,
    Math.ceil(INLINE_MIN_SPAN / unit),
  );

/**
 * The first place in one line where the same run of characters follows itself
 * enough times. Each 12-character window is compared with its previous
 * occurrence; in a loop that distance is the length of the repeated unit, and
 * it stays the same for as long as the loop runs. Returns the offset in the
 * line where the second copy starts.
 */
function findInlineLoop(line) {
  const lastSeen = new Map();
  let unit = 0;
  let run = 0;
  for (let i = 0; i + INLINE_GRAM <= line.length; i++) {
    const gram = line.slice(i, i + INLINE_GRAM);
    const previous = lastSeen.get(gram);
    lastSeen.set(gram, i);
    const distance = previous === undefined ? 0 : i - previous;
    run = distance > 0 && distance === unit ? run + 1 : 1;
    unit = distance;
    if (unit < INLINE_MIN_UNIT || unit > INLINE_MAX_UNIT) continue;
    const span = run + INLINE_GRAM - 1 + unit;
    const copies = Math.floor((span + INLINE_SEPARATOR_SLACK) / unit);
    const secondCopy = i - run + 1;
    const hasWords = /[a-z0-9]/i.test(
      line.slice(secondCopy, secondCopy + unit),
    );
    if (hasWords && copies >= inlineCopiesNeeded(unit)) {
      return { secondCopy, unit };
    }
  }
  return null;
}

function countInlineCopies(line, { secondCopy, unit }) {
  const first = line.slice(secondCopy - unit, secondCopy);
  let copies = 1;
  while (line.startsWith(first, secondCopy + (copies - 1) * unit)) copies++;
  return copies;
}

function findInlineRepeat(text) {
  let pos = 0;
  for (const line of text.split("\n")) {
    const start = pos;
    pos += line.length + 1;
    if (line.length < INLINE_MIN_SPAN || line.trimStart().startsWith("|")) {
      continue;
    }
    const loop = findInlineLoop(line);
    if (loop) {
      // The unit can be found one or two characters out of phase, which
      // would leave the first copy without its closing punctuation.
      let cut = loop.secondCopy;
      while (cut < line.length && CLOSING_PUNCTUATION.includes(line[cut])) {
        cut++;
      }
      return {
        kind: "inline",
        copies: countInlineCopies(line, loop),
        cutAt: start + cut,
      };
    }
  }
  return null;
}

function trimTrailing(text, chars) {
  let end = text.length;
  while (end > 0 && chars.includes(text[end - 1])) end--;
  return text.slice(0, end);
}

function dropDanglingLead(text) {
  let out = trimTrailing(text, " \t\n,;:([-");
  for (const lead of ["e.g.", "i.e."]) {
    if (out.toLowerCase().endsWith(lead)) {
      out = trimTrailing(out.slice(0, -lead.length), " \t\n([");
    }
  }
  return out;
}

/**
 * Cut a runaway answer at its first repeat. Detects a line repeated four or
 * more times in a row (list numbers ignored; digits masked only from ten
 * copies), a multi-line block of 200+ characters repeated three times (a
 * truncated third copy counts, one stray line between copies is tolerated),
 * a run of more than 20 consecutive incrementing numbers separated by
 * commas, and a sentence or phrase of 12+ characters repeated back to back
 * inside one line (four copies spanning 100+ characters, or three copies of
 * 50+ characters; table rows are left alone). `trimmed` is null when the text was left alone, otherwise
 * { kind, copies, removedChars }.
 */
export function trimRunaway(text) {
  const input = typeof text === "string" ? text : "";
  const hits = [
    findRepeatedBlock(input),
    findNumericRun(input),
    findInlineRepeat(input),
  ].filter(Boolean);
  if (hits.length === 0) return { text: input, trimmed: null };
  const hit = hits.reduce((a, b) => (b.cutAt < a.cutAt ? b : a));
  const cut = input.slice(0, hit.cutAt);
  const kept = hit.kind === "numeric" ? dropDanglingLead(cut) : cut.trimEnd();
  return {
    text: kept,
    trimmed: {
      kind: hit.kind,
      copies: hit.copies,
      removedChars: input.length - kept.length,
    },
  };
}

const SENTENCE_END = /[.!?]["')\]*_]*(?=\s|$)/g;
const NOT_A_SENTENCE_END =
  /(?:^|[\s(])(?:\d+|e\.g|i\.e|vs|etc|Dr|Mr|Ms|Mrs|No)$/i;

/**
 * Cut an answer that stopped mid-sentence back to its last complete
 * sentence. A full stop after a list number, a figure or an abbreviation
 * ("2.", "74.", "e.g.") does not end a sentence. Text with no complete
 * sentence is returned as it is.
 */
export function trimToLastSentence(text) {
  const input = typeof text === "string" ? text.trimEnd() : "";
  let end = -1;
  for (const m of input.matchAll(SENTENCE_END)) {
    if (!NOT_A_SENTENCE_END.test(input.slice(0, m.index))) {
      end = m.index + m[0].length;
    }
  }
  return end > 0 ? input.slice(0, end) : input;
}

/**
 * Wrapper echoes out, then runaway repetition cut. With final=false
 * (streaming) a marker that has only begun to arrive is held back.
 */
export function cleanModelText(text, { final = true } = {}) {
  const echoes = removeWrapperEchoes(text);
  const held = final ? echoes.text : withoutPendingMarker(echoes.text);
  const { text: out, trimmed } = trimRunaway(held);
  return { text: out, echoRemoved: echoes.removed, trimmed };
}
