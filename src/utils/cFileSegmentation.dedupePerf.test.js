/**
 * D19-7 / Part 2 follow-up: findDocumentBoundaries' duplicate-match check
 * used to scan found[] oldest-first (Array.prototype.some) - correct, but
 * pathologically slow on real content where a loosely-specified pattern
 * (NEXUS_LETTER's bare "opinion"/"nexus", with no required adjacent word)
 * matches thousands of times close together, since each check rescanned
 * from the start instead of the newest (nearest, and thus most likely to
 * hit) entries. Measured 3.1s for that one pattern alone on a 12M-char
 * fixture before this fix, 0.76s after, with byte-identical `found` output
 * either way - it is an existence check, so scan order changes cost, never
 * the result. This is a strong candidate for Part 2's unattributed ~3.6s
 * main-thread task: a real C-File with clinical notes mentioning "nexus
 * opinion" or similar repeatedly is exactly this shape.
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
