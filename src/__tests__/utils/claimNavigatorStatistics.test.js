/**
 * Characterization coverage for getClaimStatistics, added while splitting
 * it into _tallyClaimByType / _tallyClaimByStatus /
 * _countApproachingDeadlines / _claimCompletenessPercent to satisfy
 * sonarjs/cognitive-complexity. No existing test exercised this function.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  createClaim,
  getClaimStatistics,
  clearAllNavigatorData,
} from "../../utils/claimNavigatorStorage";

afterEach(clearAllNavigatorData);

describe("getClaimStatistics - type and status tallying", () => {
  it("tallies claims by type", () => {
    createClaim({ claimType: "ORIGINAL" });
    createClaim({ claimType: "ORIGINAL" });
    createClaim({ claimType: "INCREASE" });

    const stats = getClaimStatistics();
    expect(stats.totalClaims).toBe(3);
    expect(stats.byType.ORIGINAL).toBe(2);
    expect(stats.byType.INCREASE).toBe(1);
    expect(stats.byType.SECONDARY).toBe(0);
  });

  it("buckets TRIAGE/GATHERING_EVIDENCE as drafting", () => {
    createClaim({ currentPhase: "TRIAGE" });
    createClaim({ currentPhase: "GATHERING_EVIDENCE" });

    const stats = getClaimStatistics();
    expect(stats.byStatus.drafting).toBe(2);
  });

  it("buckets CLAIM_SUBMITTED/INITIAL_REVIEW as submitted", () => {
    createClaim({ currentPhase: "CLAIM_SUBMITTED" });
    createClaim({ currentPhase: "INITIAL_REVIEW" });

    const stats = getClaimStatistics();
    expect(stats.byStatus.submitted).toBe(2);
  });

  it("buckets EVIDENCE_GATHERING/CP_EXAM_SCHEDULED/PREPARATION_FOR_DECISION as pending", () => {
    createClaim({ currentPhase: "EVIDENCE_GATHERING" });
    createClaim({ currentPhase: "CP_EXAM_SCHEDULED" });
    createClaim({ currentPhase: "PREPARATION_FOR_DECISION" });

    const stats = getClaimStatistics();
    expect(stats.byStatus.pending).toBe(3);
  });

  it("buckets a GRANTED decision as granted, regardless of phase", () => {
    createClaim({
      currentPhase: "DECISION_RECEIVED",
      decisionInfo: { outcome: "GRANTED" },
    });

    const stats = getClaimStatistics();
    expect(stats.byStatus.granted).toBe(1);
  });

  it("buckets a DENIED decision as denied, regardless of phase", () => {
    createClaim({
      currentPhase: "DECISION_RECEIVED",
      decisionInfo: { outcome: "DENIED" },
    });

    const stats = getClaimStatistics();
    expect(stats.byStatus.denied).toBe(1);
  });

  it("buckets APPEAL phase as appealing", () => {
    createClaim({ currentPhase: "APPEAL" });

    const stats = getClaimStatistics();
    expect(stats.byStatus.appealing).toBe(1);
  });
});

describe("getClaimStatistics - approaching deadlines", () => {
  it("counts a claim whose appeal deadline is within 30 days as approaching", () => {
    const in10Days = new Date();
    in10Days.setDate(in10Days.getDate() + 10);
    createClaim({
      criticalDates: { appealDeadline: in10Days.toISOString() },
    });

    const stats = getClaimStatistics();
    expect(stats.deadlinesApproaching).toBe(1);
  });

  it("does not count a deadline more than 30 days out", () => {
    const in60Days = new Date();
    in60Days.setDate(in60Days.getDate() + 60);
    createClaim({
      criticalDates: { appealDeadline: in60Days.toISOString() },
    });

    const stats = getClaimStatistics();
    expect(stats.deadlinesApproaching).toBe(0);
  });

  it("counts a claim with both an approaching appeal deadline and ITF expiration twice", () => {
    const in5Days = new Date();
    in5Days.setDate(in5Days.getDate() + 5);
    createClaim({
      criticalDates: {
        appealDeadline: in5Days.toISOString(),
        itfExpirationDate: in5Days.toISOString(),
      },
    });

    const stats = getClaimStatistics();
    expect(stats.deadlinesApproaching).toBe(2);
  });
});

describe("getClaimStatistics - evidence completeness averaging", () => {
  it("averages evidence-checklist completeness across claims, rounded", () => {
    createClaim({
      evidenceChecklist: { a: true, b: true, c: false, d: false }, // 50%
    });
    createClaim({
      evidenceChecklist: { a: true }, // 100%
    });

    const stats = getClaimStatistics();
    expect(stats.averageCompleteness).toBe(75);
  });

  it("a claim with no evidence checklist still counts toward the denominator", () => {
    createClaim({
      evidenceChecklist: { a: true }, // 100%
    });
    createClaim({}); // no checklist -> contributes 0

    const stats = getClaimStatistics();
    expect(stats.totalClaims).toBe(2);
    expect(stats.averageCompleteness).toBe(50);
  });
});
