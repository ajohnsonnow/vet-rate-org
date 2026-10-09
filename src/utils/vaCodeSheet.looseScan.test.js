/**
 * D19-7 follow-up (reviewer-confirmed defect): parseRatingCodeSheetsChunked's
 * own SC_HEADER search used to be one unyielded `[...flat.matchAll(...)]`
 * over the whole (already-flattened) text - with zero headers (no code
 * sheet at all) there was nothing to yield between, so it ran as one
 * synchronous task regardless of text size. musterCallProcessor's fallback
 * for that same "no sheet found" case called vaDocumentParser's
 * parseCodeSheet(text) directly - another unyielded whole-text scan (its
 * own loose dcPattern matchAll plus a combinedMatch search). Both now go
 * through matchAllChunked, a bounded sliding window that yields between
 * windows even when a pattern has zero matches anywhere in the text.
 */
import { describe, it, expect, vi } from "vitest";
import {
  parseRatingCodeSheets,
  parseRatingCodeSheetsChunked,
  scanLooseRatingLinesChunked,
} from "./vaCodeSheet";
import { parseCodeSheet } from "./vaDocumentParser";
import { createTimeSlicer } from "./mainThreadScheduler";

// A counting slicer that never actually suspends - counts how many chances
// to yield a call offers (one per window), independent of how much real
// wall-clock time each window's own regex work happens to take. That keeps
// the "does this run as one whole-text pass or many bounded windows?"
// assertion deterministic instead of riding on machine-speed-dependent
// elapsed-time budgets (createTimeSlicer's own real-timer behavior is
// already covered by the equivalence tests above and in
// vaCodeSheet.chunked.equivalence.test.js).
function countingSlicer() {
  const slicer = { calls: 0 };
  slicer.maybeYield = vi.fn(async () => {
    slicer.calls++;
  });
  return slicer;
}

const TOKEN = "5000NAME50%";
const EXPECTED_CONDITION = {
  diagnosticCode: "5000",
  name: "NAME",
  percent: 50,
};

// Places an identical TOKEN at each given absolute offset, separated by
// plain "X" filler (a word character, so a single boundary space around
// each token is required for DC_PATTERN's leading `\b` to see a real
// boundary rather than an artifact of where the filler happens to end).
function buildTokenFixture(offsets) {
  let text = "";
  let pos = 0;
  for (const offset of offsets) {
    text += "X".repeat(offset - pos - 1) + " ";
    text += TOKEN;
    pos = offset + TOKEN.length;
  }
  return `${text} ${"X".repeat(500)}`;
}

describe("scanLooseRatingLinesChunked: byte-identical to parseCodeSheet's fallback", () => {
  it("matches on plain narrative text with zero loose-rating matches", async () => {
    const text = "Just plain narrative text with no rating data. ".repeat(
      50_000,
    );
    const expected = parseCodeSheet(text);
    const actual = await scanLooseRatingLinesChunked(text, createTimeSlicer());
    expect(actual.conditions).toEqual(expected.conditions);
    expect(actual.combinedRating).toBe(expected.combinedRating);
    expect(actual.confidence).toBe(expected.confidence);
    expect(actual.success).toBe(expected.success);
    expect(actual.conditions).toEqual([]);
  });

  // DC_PATTERN_WINDOW_CHARS is 20,000 - these offsets straddle the 20,000,
  // 40,000 and 60,000 window boundaries by -25/+25 chars on both sides, the
  // exact case a naive "slice every 20,000 chars" chunker would split,
  // duplicate, or drop.
  it("finds every token even when several straddle a chunk window boundary", async () => {
    const offsets = [50, 19975, 20025, 39975, 40025, 59975, 100_000];
    const text = buildTokenFixture(offsets);
    const expected = parseCodeSheet(text);
    const actual = await scanLooseRatingLinesChunked(text, createTimeSlicer());

    expect(actual.conditions).toEqual(expected.conditions);
    expect(actual.conditions).toEqual(offsets.map(() => EXPECTED_CONDITION));
  });

  it("offers many chances to yield on a long zero-match narrative, not just one", async () => {
    // DC_PATTERN's window is 20,000 chars - a ~980,000-char zero-match text
    // must cross that boundary ~49 times. Pre-fix, the whole dcPattern
    // matchAll (and the combinedMatch search) ran as a single unyielded
    // pass regardless of text size - this would see exactly 0 calls.
    const text = "Just plain narrative text with no rating data. ".repeat(
      20_000,
    );
    expect(text.length).toBeGreaterThan(900_000);

    const slicer = countingSlicer();
    await scanLooseRatingLinesChunked(text, slicer);
    expect(slicer.calls).toBeGreaterThan(40);
  });
});

describe("parseRatingCodeSheetsChunked: yields during the header search itself", () => {
  it("calls maybeYield roughly twice as often as flattenChunked alone would", async () => {
    // ~1,000,000 chars, no SC_HEADER anywhere: flattenChunked's own
    // 200,000-char chunking alone visits 5 windows (5 calls). Pre-fix, the
    // header search was one unyielded matchAll on top of that (still 5
    // calls total). Post-fix, the header search is windowed the same way
    // and must add roughly 5 more (10 total).
    const unit = "Narrative text with no code sheet at all. ";
    const text = unit.repeat(Math.ceil(1_000_000 / unit.length));

    const slicer = countingSlicer();
    const sheets = await parseRatingCodeSheetsChunked(text, slicer);
    expect(sheets).toEqual([]);
    expect(slicer.calls).toBeGreaterThan(8);
  });

  it("still matches parseRatingCodeSheets when a header straddles a 200,000-char window boundary", async () => {
    const header = "SUBJECT TO COMPENSATION (1.SC) ";
    const body =
      "9411 POST-TRAUMATIC STRESS DISORDER Service Connected, Gulf War, " +
      "Incurred 50% from 01/26/2023 COMBINED EVALUATION FOR COMPENSATION : " +
      "50% from 01/26/2023 ______ eSign: certified by ";
    // 199,985 filler chars + header (32 chars) starts at 199,985 and ends
    // at 200,017 - straddling the 200,000-char window boundary.
    const text = "X".repeat(199_985) + header + body + "X".repeat(500);

    const sync = parseRatingCodeSheets(text);
    const chunked = await parseRatingCodeSheetsChunked(
      text,
      createTimeSlicer(),
    );
    expect(chunked).toEqual(sync);
    expect(sync).toHaveLength(1);
    expect(sync[0].conditions).toEqual([
      expect.objectContaining({ diagnosticCode: "9411", rating: 50 }),
    ]);
  });
});
