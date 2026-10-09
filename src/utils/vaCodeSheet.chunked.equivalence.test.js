/**
 * D19-7: parseRatingCodeSheetsChunked (and the latestFromSheets/
 * recordEventsFromSheets pair it composes with) must be byte-identical to
 * parseRatingCodeSheets/latestRatingCodeSheet/codeSheetRecordEvents for the
 * same input. flatten()'s whole-text regex.replace measured ~290ms alone on
 * a real-sized C-File (14.6M chars) - long enough on its own to blow the
 * ~100ms/1x main-thread-task budget - so flattenChunked's chunk-safe cut
 * logic (never inside or adjacent to a run of whitespace) is the thing most
 * at risk of a subtle byte-level divergence; it gets its own direct cases
 * below in addition to the large-fixture comparison.
 */
import { describe, it, expect, vi } from "vitest";
import {
  parseRatingCodeSheets,
  parseRatingCodeSheetsChunked,
  latestRatingCodeSheet,
  latestFromSheets,
  codeSheetRecordEvents,
  recordEventsFromSheets,
  flatten,
  flattenChunked,
} from "./vaCodeSheet";
import { createTimeSlicer } from "./mainThreadScheduler";
import { buildLargeCFileFixture } from "../__tests__/fixtures/largeCFileFixture";

const LARGE_FIXTURE = buildLargeCFileFixture();

describe("parseRatingCodeSheetsChunked: byte-identical to parseRatingCodeSheets", () => {
  it("matches on the large multi-sheet fixture", async () => {
    const sync = parseRatingCodeSheets(LARGE_FIXTURE);
    const chunked = await parseRatingCodeSheetsChunked(
      LARGE_FIXTURE,
      createTimeSlicer(),
    );
    expect(chunked).toEqual(sync);
    expect(sync.length).toBeGreaterThan(5);
  });

  it("matches when there are no code sheets at all", async () => {
    const text = "Just plain narrative text with no rating data. ".repeat(50);
    const sync = parseRatingCodeSheets(text);
    const chunked = await parseRatingCodeSheetsChunked(
      text,
      createTimeSlicer(),
    );
    expect(chunked).toEqual(sync);
    expect(sync).toEqual([]);
  });

  it("matches on empty/non-string input", async () => {
    for (const input of ["", null, undefined]) {
      const sync = parseRatingCodeSheets(input);
      const chunked = await parseRatingCodeSheetsChunked(
        input,
        createTimeSlicer(),
      );
      expect(chunked).toEqual(sync);
    }
  });

  it("derives the same latest sheet and record events from one parse", async () => {
    const sheets = await parseRatingCodeSheetsChunked(
      LARGE_FIXTURE,
      createTimeSlicer(),
    );
    expect(latestFromSheets(sheets)).toEqual(
      latestRatingCodeSheet(LARGE_FIXTURE),
    );
    expect(recordEventsFromSheets(sheets)).toEqual(
      codeSheetRecordEvents(LARGE_FIXTURE),
    );
  });

  it("schedules more than one yield on the large fixture with a tiny budget", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    await parseRatingCodeSheetsChunked(LARGE_FIXTURE, createTimeSlicer(1));
    expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(5);
    setTimeoutSpy.mockRestore();
  });

  // The large fixture above (~7.3M chars) crosses flattenChunked's internal
  // 200,000-char chunk boundary ~36 times through realistic, irregularly-
  // spaced whitespace (page headers, wrapped narrative text, tabular code
  // sheet rows) - the equality assertion in the first test already is the
  // proof that no `\s+` run was ever split across one of those boundaries;
  // a single mis-cut would desync flatten()'s output from that point on and
  // fail every downstream sheet/date/condition comparison. It never
  // exercises tabs, CRLF, NBSP or other non-ASCII whitespace, though - the
  // direct cases below do.
});

// D19-7 follow-up (reviewer-confirmed defect): this file's own header
// promised flattenChunked "gets its own direct cases below", but none
// existed - only the indirect, ASCII-whitespace-only coverage above. These
// fuzz flattenChunked directly against sync flatten() across the exotic
// whitespace a real OCR'd/PDF-extracted C-File can carry (tabs, CRLF, NBSP,
// form feed, vertical tab, the U+2028 line separator, ideographic space,
// a stray BOM) plus surrogate pairs (an emoji or other astral character
// landing exactly on a chunk boundary splits its two UTF-16 code units
// across chunks - harmless only because flatten() never touches a
// non-whitespace code unit, so concatenation reassembles it correctly, but
// that needs proving, not assuming).
describe("flattenChunked: direct fuzz cases against sync flatten()", () => {
  const EXOTIC_WHITESPACE = [
    "\t",
    "\r\n",
    "\r",
    " ", // NBSP
    "\f",
    "\v",
    " ", // line separator
    "　", // ideographic space
    "﻿", // BOM
  ];
  const NON_WHITESPACE_UNITS = [
    "a",
    "Z",
    "9",
    "(",
    ")",
    "-",
    "😀", // surrogate pair - may land split across a chunk boundary
  ];

  // Deterministic PRNG so a failure is reproducible.
  function makeRand(seed) {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }

  // Builds a string of roughly `length` UTF-16 code units by repeatedly
  // appending either a whitespace run (1-6 exotic whitespace units) or a
  // non-whitespace run (1-6 units, letters/digits/punctuation/surrogate
  // pairs), so whitespace/non-whitespace boundaries land at unpredictable
  // offsets relative to FLATTEN_CHUNK_CHARS's 200,000-char cut points.
  function buildFuzzText(rand, length, whitespaceDensity) {
    let text = "";
    while (text.length < length) {
      const runLength = 1 + Math.floor(rand() * 6);
      const isWhitespace = rand() < whitespaceDensity;
      const pool = isWhitespace ? EXOTIC_WHITESPACE : NON_WHITESPACE_UNITS;
      for (let i = 0; i < runLength; i++) {
        text += pool[Math.floor(rand() * pool.length)];
      }
    }
    return text;
  }

  it.each([
    { seed: 1, density: 0.05 },
    { seed: 2, density: 0.3 },
    { seed: 3, density: 0.5 },
    { seed: 4, density: 0.7 },
    { seed: 5, density: 0.95 },
  ])(
    "matches sync flatten() on a ~450,000-char exotic-whitespace fuzz string (density=$density)",
    async ({ seed, density }) => {
      const text = buildFuzzText(makeRand(seed), 450_000, density);
      const sync = flatten(text);
      const chunked = await flattenChunked(text, createTimeSlicer());
      expect(chunked).toEqual(sync);
    },
  );

  it("matches sync flatten() when a surrogate pair lands exactly on a 200,000-char cut", async () => {
    const before = "a".repeat(199_999);
    const after = "b".repeat(500);
    const text = `${before}😀${after}`;
    expect(text.length).toBeGreaterThan(200_000);

    const sync = flatten(text);
    const chunked = await flattenChunked(text, createTimeSlicer());
    expect(chunked).toEqual(sync);
    expect(chunked).toBe(text); // no whitespace at all - flatten is a no-op
  });
});
