import { describe, it, expect } from "vitest";
import { buildDKBIndex } from "./dkbSearchIndex";

/**
 * D16-7 follow-up: trigram postings must be stored as packed Int32Arrays,
 * not Set<number>, once buildDKBIndex has returned. A Set of boxed JS
 * numbers costs several times the heap of a packed typed array for the
 * same postings - measured live on the real corpus (14,501 distinct
 * trigrams, 3,196,193 text postings): ~85MB for Sets vs. ~13MB for
 * Int32Arrays - see dkbSearchIndex.js's finalizeTrigramIndex comment.
 *
 * This pins the representation only (deterministic, no flaky heap-size
 * assertion); dkbSearchIndex.equivalence.test.js proves the representation
 * change doesn't alter search results or ordering.
 */
describe("D16-7: DKB trigram postings are packed, not boxed", () => {
  it("stores every text-trigram posting list as an Int32Array", async () => {
    const entries = [
      { id: "A", instruction: "tinnitus rating criteria", output: "DC 6260" },
      { id: "B", instruction: "ptsd secondary connection", output: "nexus" },
    ];
    const index = await buildDKBIndex(entries);

    expect(index.textTrigramIndex.size).toBeGreaterThan(0);
    for (const postings of index.textTrigramIndex.values()) {
      expect(postings).toBeInstanceOf(Int32Array);
    }
  });

  it("stores every condition-name-trigram posting list as an Int32Array", async () => {
    const entries = [
      {
        id: "A",
        instruction: "x",
        output: "y",
        metadata: { condition_name: "tinnitus" },
      },
      {
        id: "B",
        instruction: "x",
        output: "y",
        metadata: { condition_name: "ptsd" },
      },
    ];
    const index = await buildDKBIndex(entries);

    expect(index.condTrigramIndex.size).toBeGreaterThan(0);
    for (const postings of index.condTrigramIndex.values()) {
      expect(postings).toBeInstanceOf(Int32Array);
    }
  });
});
