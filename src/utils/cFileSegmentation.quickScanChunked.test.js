/**
 * D19-7 follow-up (reviewer-confirmed defect, low severity): quickScanCFile
 * ran `text.match(pattern)` for every DOCUMENT_SIGNATURES pattern, and a
 * signature that never appears at all (most real C-Files only carry a
 * handful of the 12 document types checked) scans the whole string in one
 * synchronous call - right at parseCFileDocument's own entry point, before
 * the log line the segmentation-latency e2e spec waits on. Measured 26-110ms
 * on real fixtures in the reviewer's evidence (~440ms at 4x). This proves
 * quickScanCFileChunked is byte-identical to quickScanCFile and actually
 * yields instead of running as one whole-text task.
 */
import { describe, it, expect, vi } from "vitest";
import { quickScanCFile, quickScanCFileChunked } from "./cFileSegmentation";

// A counting slicer that never actually suspends - see
// vaCodeSheet.looseScan.test.js's identical helper for why counting calls
// beats asserting on real elapsed-time yields (deterministic, independent
// of how fast the regex work under test happens to run on this machine).
function countingSlicer() {
  const slicer = { calls: 0 };
  slicer.maybeYield = vi.fn(async () => {
    slicer.calls++;
  });
  return slicer;
}

describe("quickScanCFileChunked: byte-identical to quickScanCFile", () => {
  it("matches on plain narrative text with no signatures at all", async () => {
    const text = "Just plain narrative text with no VA signatures. ".repeat(
      50_000,
    );
    const sync = quickScanCFile(text);
    const chunked = await quickScanCFileChunked(text, countingSlicer());
    expect(chunked).toEqual(sync);
    expect(sync.detectedTypes).toEqual([]);
  });

  it("matches when a signature straddles the 200,000-char window boundary", async () => {
    // "DD FORM 214" (DD214's own pattern) starts at 199,990 and ends at
    // 200,001 - straddling the window boundary a naive non-overlapping
    // chunker would cut on.
    const text =
      "X".repeat(199_990) +
      "DD FORM 214 CERTIFICATE OF RELEASE" +
      "X".repeat(500);
    const sync = quickScanCFile(text);
    const chunked = await quickScanCFileChunked(text, countingSlicer());
    expect(chunked).toEqual(sync);
    expect(sync.detectedTypes).toContain("DD214");
  });

  it("matches on a realistic mixed C-File with several signatures present", async () => {
    const text = [
      "X".repeat(50_000),
      "DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE",
      "X".repeat(250_000),
      "RATING DECISION",
      "X".repeat(250_000),
      "DISABILITY BENEFITS QUESTIONNAIRE",
      "X".repeat(50_000),
    ].join(" ");
    const sync = quickScanCFile(text);
    const chunked = await quickScanCFileChunked(text, countingSlicer());
    expect(chunked).toEqual(sync);
    expect(sync.detectedTypes.sort()).toEqual(
      ["DBQ", "DD214", "RATING_DECISION"].sort(),
    );
  });

  it("matches on empty text", async () => {
    const sync = quickScanCFile("");
    const chunked = await quickScanCFileChunked("", countingSlicer());
    expect(chunked).toEqual(sync);
  });
});

describe("quickScanCFileChunked: actually yields to the main thread", () => {
  it("offers many chances to yield on a long text with no signatures", async () => {
    // >1,000,000 chars, no signature present at all - every one of the 12
    // signatures must scan every 200,000-char window, so this must cross
    // the window boundary at least 5 times.
    const text = "Just plain narrative text with no VA signatures. ".repeat(
      25_000,
    );
    expect(text.length).toBeGreaterThan(1_000_000);

    const slicer = countingSlicer();
    await quickScanCFileChunked(text, slicer);
    expect(slicer.calls).toBeGreaterThan(4);
  });
});
