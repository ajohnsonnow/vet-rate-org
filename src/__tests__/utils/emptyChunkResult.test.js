import { describe, it, expect } from "vitest";
import { createEmptyChunkResult } from "../../utils/cfileAnalyzer.js";

/**
 * Ab-H01: the empty result for skipped C-File chunks used to be a shared
 * module-level singleton whose nested arrays were mutated in place during
 * aggregation. That bled one veteran's findings into the next analysis in the
 * same session. It must be a factory that returns a fully independent object.
 */
describe("createEmptyChunkResult (Ab-H01 cross-C-File bleed)", () => {
  it("returns a fresh, fully-empty result each call", () => {
    const r = createEmptyChunkResult();
    expect(r.summary).toBe("");
    expect(r.timeline).toEqual([]);
    expect(r.potential_claims).toEqual([]);
    expect(r.mentalHealth.diagnoses).toEqual([]);
  });

  it("does not share nested arrays/objects between calls", () => {
    const a = createEmptyChunkResult();
    const b = createEmptyChunkResult();

    // Top-level and nested references must be distinct.
    expect(a).not.toBe(b);
    expect(a.timeline).not.toBe(b.timeline);
    expect(a.mentalHealth).not.toBe(b.mentalHealth);
    expect(a.mentalHealth.diagnoses).not.toBe(b.mentalHealth.diagnoses);

    // Mutating one must not affect the other (the bleed the fix prevents).
    a.potential_claims.push({ name: "PTSD", veteran: "A" });
    a.mentalHealth.diagnoses.push("MDD");
    expect(b.potential_claims).toEqual([]);
    expect(b.mentalHealth.diagnoses).toEqual([]);
    expect(createEmptyChunkResult().potential_claims).toEqual([]);
  });
});
