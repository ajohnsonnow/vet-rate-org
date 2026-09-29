/**
 * D15-4 (final15 QA review, 2026-09-28): _formatOtherDocsSection embedded a
 * rating-decision doc's allow-listed fields as
 * `JSON.stringify(safe).substring(0, 500)` - a fixed character cut with no
 * regard for where a value ended, routinely slicing mid-JSON (an
 * unterminated string, a dangling `"field":` with the rest of its value
 * cut off). `_safeExtractedDataSummary`'s null check was also top-level
 * only, so a nested sub-field (a service-time-shaped
 * `{years:0,months:null,days:5}` object) still printed `"months":null`
 * into the blob even though the top-level field itself was non-null.
 *
 * Fields are now rendered as readable "Label: value" lines: null/undefined/
 * empty values are dropped at EVERY depth (_deepCleanNullish), and a field
 * line is either included whole or dropped whole - never cut mid-value.
 *
 * Fixture identifiers are synthetic.
 */
import { describe, it, expect } from "vitest";
import { _formatOtherDocsSection } from "./myPacketManager";

// Deliberately shaped to reproduce "cut at 500 chars mid-JSON with 7 null
// values" - 7 null leaves across the decisions array plus the top-level
// combinedRatingHistory entry, and a long rationale string that would have
// landed near/past the old 500-char JSON.stringify cutoff.
function ratingDecisionDoc() {
  return {
    fileName: "rating_decision.pdf",
    uploadDate: "2026-02-10T00:00:00.000Z",
    extractedData: {
      type: "rating_decision",
      combinedRating: 70,
      effectiveDate: "2024-01-15",
      combinedRatingHistory: [
        { date: "2020-05-01", rating: 50, priorRating: null },
        { date: "2024-01-15", rating: 70, priorRating: 50 },
      ],
      decisions: [
        {
          issue: "PTSD",
          outcome: "granted",
          rating: 70,
          priorRating: null,
          increaseAmount: null,
          effectiveDate: "2024-01-15",
          deferred: null,
        },
        {
          issue: "Tinnitus",
          outcome: "granted",
          rating: 10,
          priorRating: null,
          increaseAmount: null,
          deferred: null,
        },
      ],
      rationale:
        "The condition PTSD is service-connected based on continuity of symptomatology and a positive nexus opinion linking the current diagnosis to an in-service stressor documented in the service treatment records and buddy statements submitted with the claim, which the rating decision found credible and consistent with the evidence of record as a whole.",
      status: null,
    },
  };
}

function balancedBraces(text) {
  let depth = 0;
  for (const ch of text) {
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

describe("D15-4: rating-decision fields render as readable lines, never truncated JSON", () => {
  it("never contains the JSON null marker or a bare 'null' value", () => {
    const out = _formatOtherDocsSection({
      rating_decision: [ratingDecisionDoc()],
    });

    expect(out).not.toContain('":null');
    expect(out).not.toMatch(/:\s*null\b/i);
  });

  it("never leaves an unbalanced brace (no mid-JSON truncation)", () => {
    const out = _formatOtherDocsSection({
      rating_decision: [ratingDecisionDoc()],
    });
    expect(balancedBraces(out)).toBe(true);
    // Confirms this isn't JSON at all anymore - no stray curly braces.
    expect(out).not.toContain("{");
    expect(out).not.toContain("}");
  });

  it("drops null sub-fields nested inside an array of objects, keeping a real non-null sibling value", () => {
    const out = _formatOtherDocsSection({
      rating_decision: [ratingDecisionDoc()],
    });
    // increaseAmount/deferred are null on EVERY entry in the fixture - must
    // never appear at all.
    expect(out).not.toContain("Increase Amount");
    expect(out).not.toContain("Deferred");
    // priorRating is null on 3 of the 4 entries but a real 50 on the 4th
    // (combinedRatingHistory's second entry) - the null occurrences must be
    // dropped while that one real value survives.
    const priorRatingOccurrences = (out.match(/Prior Rating/g) || []).length;
    expect(priorRatingOccurrences).toBe(1);
    expect(out).toContain("Prior Rating: 50");
  });

  it("drops a null top-level field entirely (status: null)", () => {
    const out = _formatOtherDocsSection({
      rating_decision: [ratingDecisionDoc()],
    });
    expect(out).not.toContain("Status");
  });

  it("keeps the real, non-null facts as readable labeled lines", () => {
    const out = _formatOtherDocsSection({
      rating_decision: [ratingDecisionDoc()],
    });
    expect(out).toContain("Combined Rating: 70");
    expect(out).toContain("Effective Date: 2024-01-15");
    expect(out).toContain("Issue: PTSD");
    expect(out).toContain("Outcome: granted");
    expect(out).toContain("Issue: Tinnitus");
  });

  it("never cuts a value mid-word: the long rationale field is either whole or entirely absent", () => {
    const out = _formatOtherDocsSection({
      rating_decision: [ratingDecisionDoc()],
    });
    if (out.includes("Rationale:")) {
      // The fixture's rationale ends in "as a whole." - if the field line
      // is present at all, it must have survived to its real terminator,
      // not been cut mid-sentence.
      expect(out).toContain("as a whole.");
    }
  });
});
