/**
 * The consolidated-C-File path in musterCallProcessor was unreachable for the
 * life of the code (its routing test read a field quickScanCFile never
 * returned), so three separate shape mismatches sat behind it undetected. Once
 * page-count classification started routing real C-Files through it, they
 * surfaced in sequence: `cFileSummary.categories.join` → `summary.documentBreakdown`
 * → `s.text.substring`.
 *
 * These pin the segment/result contract those callers depend on, so a rename
 * fails here in milliseconds instead of 70 minutes into a 313MB browser run.
 */
import { describe, it, expect } from "vitest";
import {
  segmentCFile,
  quickScanCFile,
  buildInventoryFromSegmentation,
} from "../../utils/cFileSegmentation";

const filler = (label) =>
  `${label} continuation text. `.repeat(20) +
  "Additional narrative body so the segment clears the 200-character minimum length filter applied by _burstIntoSegments.";

const CFILE_FIXTURE = [
  "DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY",
  "CHARACTER OF SERVICE: HONORABLE",
  filler("Service record"),
  "",
  "SERVICE TREATMENT RECORD",
  "CHRONOLOGICAL RECORD OF MEDICAL CARE",
  filler("Treatment record"),
  "",
  "RATING DECISION",
  "The evidence shows service connection is warranted.",
  filler("Decision narrative"),
].join("\n");

// The exact projection buildSegmentedCFileResult applies in
// musterCallProcessor.js. Mirrored rather than imported because that helper is
// module-private; if the segment shape drifts, this throws the same TypeError
// the real caller would.
const mapSegmentsLikeMusterCall = (segments) =>
  segments.segments.map((s) => ({
    type: s.type,
    category: s.category,
    position: s.position,
    length: s.length,
    confidence: s.confidence,
    snippet: s.preview.substring(0, 200),
  }));

describe("segmentCFile segment shape", () => {
  it("produces segments for a multi-document fixture", () => {
    const result = segmentCFile(CFILE_FIXTURE, { parseDocuments: false });
    expect(result.success).toBe(true);
    expect(result.segments.length).toBeGreaterThan(1);
  });

  it("every segment carries preview/category/position/length, and no text/startPage/endPage", () => {
    const result = segmentCFile(CFILE_FIXTURE, { parseDocuments: false });

    for (const segment of result.segments) {
      expect(typeof segment.preview).toBe("string");
      expect(typeof segment.rawText).toBe("string");
      expect(typeof segment.category).toBe("string");
      expect(typeof segment.position).toBe("number");
      expect(typeof segment.length).toBe("number");

      // The three fields the old mapping assumed. `text` threw; the page
      // fields silently emitted undefined on every segment.
      expect(segment).not.toHaveProperty("text");
      expect(segment).not.toHaveProperty("startPage");
      expect(segment).not.toHaveProperty("endPage");
    }
  });

  it("parseDocuments:false leaves parsed null instead of building discarded VA documents", () => {
    const result = segmentCFile(CFILE_FIXTURE, { parseDocuments: false });
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.segments.every((s) => s.parsed === null)).toBe(true);
  });

  it("the musterCallProcessor projection maps without throwing and yields snippets", () => {
    const result = segmentCFile(CFILE_FIXTURE, { parseDocuments: false });
    const mapped = mapSegmentsLikeMusterCall(result);

    expect(mapped).toHaveLength(result.segments.length);
    for (const entry of mapped) {
      expect(typeof entry.snippet).toBe("string");
      expect(entry.snippet.length).toBeGreaterThan(0);
      expect(entry.snippet.length).toBeLessThanOrEqual(200);
      expect(entry.position).not.toBeUndefined();
      expect(entry.category).not.toBeUndefined();
    }
  });
});

describe("segmentCFile result contract", () => {
  it("always exposes a summary key so a failed run cannot read undefined.documentBreakdown", () => {
    const result = segmentCFile("", { parseDocuments: false });
    expect(result).toHaveProperty("summary");
    expect(() => result.summary?.documentBreakdown).not.toThrow();
  });

  it("summary.documentBreakdown is present on success", () => {
    const result = segmentCFile(CFILE_FIXTURE, { parseDocuments: false });
    expect(result.summary).not.toBeNull();
    expect(result.summary.documentBreakdown).toBeTypeOf("object");
    expect(result.summary.totalDocuments).toBe(result.segmentCount);
  });
});

describe("buildInventoryFromSegmentation", () => {
  it("builds an inventory from an existing segmentation without re-segmenting", () => {
    const segments = segmentCFile(CFILE_FIXTURE, { parseDocuments: false });
    const inventory = buildInventoryFromSegmentation(segments);

    expect(inventory.totalDocuments).toBe(segments.segmentCount);
    expect(inventory.inventory).toHaveLength(segments.segments.length);
    expect(inventory.categories).toEqual(segments.summary.documentBreakdown);
    for (const entry of inventory.inventory) {
      expect(entry.preview.endsWith("...")).toBe(true);
    }
  });

  it("degrades to an error object rather than throwing when segmentation produced no summary", () => {
    const broken = { success: false, error: "boom", segmentCount: 0 };
    const inventory = buildInventoryFromSegmentation(broken);

    expect(inventory.totalDocuments).toBe(0);
    expect(inventory.inventory).toEqual([]);
    expect(inventory.error).toBe("boom");
  });
});

describe("short-acronym boundary patterns don't match ordinary prose", () => {
  it('does not classify "...records associated with this information..." as SSOC', () => {
    const text = filler(
      "These records associated with this information are part of the claims file",
    );
    const result = segmentCFile(text, { parseDocuments: false });
    expect(result.segments.some((s) => s.type === "SSOC")).toBe(false);
  });

  it('still classifies a real "SUPPLEMENTAL STATEMENT OF THE CASE" heading as SSOC', () => {
    const text = [
      "SUPPLEMENTAL STATEMENT OF THE CASE",
      filler("Appeal narrative"),
    ].join("\n");
    const result = segmentCFile(text, { parseDocuments: false });
    expect(result.segments.some((s) => s.type === "SSOC")).toBe(true);
  });

  it('does not classify appeal-rights boilerplate containing "represents" as PERFORMANCE_EVAL', () => {
    const text = filler(
      "This letter represents the review options available to you regarding this decision",
    );
    const result = segmentCFile(text, { parseDocuments: false });
    expect(result.segments.some((s) => s.type === "PERFORMANCE_EVAL")).toBe(
      false,
    );
  });

  it("still classifies a real NCOER heading as PERFORMANCE_EVAL", () => {
    const text = [
      "NCOER EVALUATION",
      filler("Duty performance narrative"),
    ].join("\n");
    const result = segmentCFile(text, { parseDocuments: false });
    expect(result.segments.some((s) => s.type === "PERFORMANCE_EVAL")).toBe(
      true,
    );
  });
});

describe("quickScanCFile routing fields", () => {
  it("returns detectedTypes and estimatedPages - the fields the routing test reads", () => {
    const scan = quickScanCFile(CFILE_FIXTURE);

    expect(Array.isArray(scan.detectedTypes)).toBe(true);
    expect(typeof scan.estimatedPages).toBe("number");
    expect(() => scan.detectedTypes.join(", ")).not.toThrow();
  });

  it("does not return the categories/estimatedDocCount fields the old caller read", () => {
    const scan = quickScanCFile(CFILE_FIXTURE);

    // parseCFileDocument used to log `cFileSummary.categories.join(", ")` and
    // branch on `estimatedDocCount > 5`. Neither field has ever existed, so the
    // log threw and the branch was permanently false.
    expect(scan.categories).toBeUndefined();
    expect(scan.estimatedDocCount).toBeUndefined();
  });
});
