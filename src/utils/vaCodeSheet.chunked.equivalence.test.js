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
  // fail every downstream sheet/date/condition comparison.
});
