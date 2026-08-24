import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeRatingDecisionIntoVKB,
} from "../../utils/veteranKnowledgeBase";

const decision2024 = {
  type: "rating_decision",
  claimNumber: "000000000",
  combinedRating: 80,
  combinedRatingHistory: [
    { percentage: 70, effectiveDate: "Mar 31, 2023" },
    { percentage: 80, effectiveDate: "Sep 15, 2023" },
  ],
  decisions: [
    {
      condition: "lumbosacral strain",
      outcome: "increased",
      rating: 20,
      priorRating: 10,
      effectiveDate: "September 15, 2023",
    },
    {
      condition: "left hip limited adduction",
      outcome: "granted",
      rating: 10,
      priorRating: null,
      effectiveDate: "September 15, 2023",
    },
    {
      condition: "lipoma, left scalp",
      outcome: "denied",
      rating: null,
      priorRating: null,
      effectiveDate: null,
    },
    {
      condition:
        "an earlier effective date for the 50 percent evaluation of post-traumatic stress disorder",
      outcome: "denied",
      rating: null,
      priorRating: null,
      effectiveDate: null,
      issue: "effective_date",
    },
  ],
  conditions: [
    {
      name: "lumbosacral strain",
      rating: 20,
      priorRating: 10,
      outcome: "increased",
      effectiveDate: "September 15, 2023",
      diagnosticCode: null,
      serviceConnected: true,
    },
    {
      name: "left hip limited adduction",
      rating: 10,
      outcome: "granted",
      effectiveDate: "September 15, 2023",
      diagnosticCode: null,
      serviceConnected: true,
    },
  ],
  deniedConditions: ["lipoma, left scalp"],
};

describe("veteranKnowledgeBase: mergeRatingDecisionIntoVKB", () => {
  it("upserts rated conditions, records ratings, denials, combined rating and timeline events", () => {
    const vkb = mergeRatingDecisionIntoVKB(initializeVKB(), decision2024, {
      fileName: "ClaimLetter-2024-5-8.pdf",
    });

    expect(
      vkb.medicalConditions.current.map((c) => [c.name, c.ratedPercentage]),
    ).toEqual([
      ["lumbosacral strain", 20],
      ["left hip limited adduction", 10],
    ]);
    expect(vkb.medicalConditions.current.every((c) => c.serviceConnected)).toBe(
      true,
    );
    expect(vkb.vaClaimsHistory.ratings).toHaveLength(2);
    expect(vkb.vaClaimsHistory.currentCombinedRating).toBe(80);
    expect(vkb.vaClaimsHistory.combinedRatingHistory).toHaveLength(2);
    expect(vkb.vaClaimsHistory.claims).toEqual([
      expect.objectContaining({
        status: "denied",
        conditions: ["lipoma, left scalp"],
      }),
    ]);
    expect(vkb.evidenceTimeline.map((e) => [e.date, e.description])).toEqual([
      ["2023-09-15", "Rating increased: lumbosacral strain (20%)"],
      [
        "2023-09-15",
        "Service connection granted: left hip limited adduction (10%)",
      ],
    ]);
  });

  it("is idempotent for the same letter and lets a later letter update a percentage in place", () => {
    const vkb = mergeRatingDecisionIntoVKB(initializeVKB(), decision2024, {
      fileName: "ClaimLetter-2024-5-8.pdf",
    });
    mergeRatingDecisionIntoVKB(vkb, decision2024, {
      fileName: "ClaimLetter-2024-5-8.pdf",
    });
    expect(vkb.medicalConditions.current).toHaveLength(2);
    expect(vkb.vaClaimsHistory.ratings).toHaveLength(2);
    expect(vkb.evidenceTimeline).toHaveLength(2);
    expect(vkb.vaClaimsHistory.claims).toHaveLength(1);

    mergeRatingDecisionIntoVKB(
      vkb,
      {
        type: "rating_decision",
        combinedRating: 90,
        conditions: [
          {
            name: "Lumbosacral Strain",
            rating: 40,
            outcome: "increased",
            effectiveDate: "March 1, 2025",
          },
        ],
        decisions: [],
      },
      { fileName: "ClaimLetter-2025-3-1.pdf" },
    );
    expect(vkb.medicalConditions.current).toHaveLength(2);
    expect(vkb.medicalConditions.current[0].ratedPercentage).toBe(40);
    expect(vkb.vaClaimsHistory.currentCombinedRating).toBe(90);
    expect(vkb.vaClaimsHistory.ratings).toHaveLength(3);
  });

  it("ignores empty or malformed input", () => {
    const vkb = initializeVKB();
    expect(mergeRatingDecisionIntoVKB(vkb, null)).toBe(vkb);
    expect(
      mergeRatingDecisionIntoVKB(vkb, { type: "rating_decision" })
        .medicalConditions.current,
    ).toEqual([]);
  });
});
