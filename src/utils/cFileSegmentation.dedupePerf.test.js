/**
 * D19-7 / Part 2 follow-up: findDocumentBoundaries' duplicate-match check
 * used to scan found[] oldest-first (Array.prototype.some) - correct, but
 * pathologically slow on real content where a loosely-specified pattern
 * (NEXUS_LETTER's bare "opinion"/"nexus", with no required adjacent word)
 * matches thousands of times close together, since each check rescanned
 * from the start instead of the newest (nearest, and thus most likely to
 * hit) entries. That newest-first reorder only pays off while a signature's
 * FIRST pattern is running, though: for a later pattern (NEXUS_LETTER's own
 * loose `(?:MEDICAL\s*)?(?:NEXUS|OPINION)` is its third), the newest entries
 * in `found` are an *earlier* pattern's matches, decorrelated from this
 * pattern's own candidate positions - so the scan still walks back through
 * roughly all of them, and total cost stays quadratic in match count. A
 * bucket-indexed dedupe (see cFileSegmentation.js's _hasNearbyMatch) fixes
 * this independent of pattern order. The first test below (the original
 * regression test for the oldest-first bug) is too small to expose that
 * this remained: 6,000 paragraphs already runs in ~500ms even with the
 * quadratic scan present, well under its 1,500ms budget. The second test
 * scales up enough to make the O(n^2) plainly visible (measured 1.7s on the
 * pre-bucket-index branch vs ~0.2s after) while still finishing in well
 * under a second post-fix.
 */
import { describe, it, expect } from "vitest";
import { segmentCFile, segmentCFileChunked } from "./cFileSegmentation";

// Deliberately heavy on the exact words NEXUS_LETTER's loosest pattern
// (`/(?:MEDICAL\s*)?(?:NEXUS|OPINION)/i`) matches bare, with no required
// neighbor - real clinical narrative repeats "opinion"/"medical opinion"
// this densely across a large file.
const REPEATED_TERMS = [
  "medical",
  "record",
  "treatment",
  "claim",
  "condition",
  "opinion",
  "nexus",
  "evidence",
];

function buildPathologicalFixture(paragraphCount) {
  let seed = 11;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let text = "";
  for (let p = 0; p < paragraphCount; p++) {
    for (let w = 0; w < 80; w++) {
      text += REPEATED_TERMS[Math.floor(rand() * REPEATED_TERMS.length)] + " ";
    }
    text += "\n";
  }
  return text;
}

const PATHOLOGICAL_FIXTURE = buildPathologicalFixture(6000);

describe("segmentCFile: duplicate-match dedupe does not regress to O(n^2)", () => {
  it("finishes a repeated-common-word fixture well under a second", () => {
    const start = performance.now();
    const result = segmentCFile(PATHOLOGICAL_FIXTURE, {
      parseDocuments: false,
      maxSegments: Infinity,
    });
    const elapsed = performance.now() - start;

    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1500);
  });

  // Twice the paragraph count of the fixture above - a scan that is
  // genuinely O(n) in match count should cost roughly 2x, not ~4x, for a 2x
  // input; catching a revert to the old "scan order doesn't matter across
  // patterns" behavior needs enough matches for that quadratic term to
  // dominate within a tight budget.
  it("does not regress to O(n^2) once a signature's later, looser pattern dominates", () => {
    const fixture = buildPathologicalFixture(12_000);
    const start = performance.now();
    const result = segmentCFile(fixture, {
      parseDocuments: false,
      maxSegments: Infinity,
    });
    const elapsed = performance.now() - start;

    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(800);
  });

  it("chunked path still matches on the same pathological fixture", async () => {
    const sync = segmentCFile(PATHOLOGICAL_FIXTURE, {
      parseDocuments: false,
      maxSegments: Infinity,
    });
    const chunked = await segmentCFileChunked(PATHOLOGICAL_FIXTURE, {
      parseDocuments: false,
      maxSegments: Infinity,
    });
    const { processedAt: _a, ...syncRest } = sync;
    const { processedAt: _b, ...chunkedRest } = chunked;
    expect(chunkedRest).toEqual(syncRest);
  }, 20_000);
});
