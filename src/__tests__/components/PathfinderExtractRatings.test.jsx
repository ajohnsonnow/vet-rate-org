import { describe, it, expect, vi } from "vitest";

// documentAnalyzer pulls in pdfjs-dist, which references DOMMatrix - not
// implemented in jsdom (see Pathfinder.test.jsx for the same mock).
vi.mock("../../utils/documentAnalyzer.js", () => ({
  analyzeDocument: vi.fn(),
  isFileSupported: () => true,
  getFileTypeLabel: () => "file",
  getAcceptString: () => "",
}));

const { _extractRatingsFromText } = await import("../../components/Pathfinder");

// Covers the two rating-extraction regexes bounded for
// sonarjs/super-linear-regex, against realistic AI-summarized condition
// text (synthetic condition names, no real veteran data).
describe("Pathfinder: _extractRatingsFromText", () => {
  it("extracts 'Condition - NN%' pairs", () => {
    const text = "PTSD - 70%\nTinnitus - 10%\nMigraine headaches - 30%";
    const result = _extractRatingsFromText(text);
    expect(result).toEqual(
      expect.arrayContaining([
        { condition: "PTSD", rating: "70" },
        { condition: "Tinnitus", rating: "10" },
        { condition: "Migraine headaches", rating: "30" },
      ]),
    );
  });

  // Pre-existing behavior (not introduced by the regex bounding change):
  // the caller's `match[1] || match[2]` swap assigns this pattern's rating
  // digits to `condition` and its condition text to `rating`, so
  // Number.parseInt(rating) is always NaN here and no entry is pushed.
  // Confirmed identical against the unbounded regex before this change.
  it("does not extract 'NN% for Condition' pairs (pre-existing dead branch)", () => {
    const text = "70% for PTSD\n10% for Tinnitus";
    expect(_extractRatingsFromText(text)).toEqual([]);
  });

  it("returns an empty array when no rating pattern is present", () => {
    expect(_extractRatingsFromText("No ratings mentioned here.")).toEqual([]);
  });
});
