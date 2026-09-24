import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeRatingDecisionIntoVKB,
} from "../../utils/veteranKnowledgeBase";

// musterCallProcessor transitively imports pdfjs, which references canvas
// globals jsdom doesn't provide (same pattern as
// musterCallProcessor.parseClaimLetter.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

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

describe("veteranKnowledgeBase: stated combined rating follows the newest letter", () => {
  const letter = (combinedRating, decisionDate) => ({
    combinedRating,
    decisionDate,
    conditions: [],
  });

  it("keeps the newer letter's combined rating when an older letter is processed after it", () => {
    const vkb = mergeRatingDecisionIntoVKB(
      initializeVKB(),
      letter(80, "May 8, 2024"),
      { fileName: "newer.pdf" },
    );
    mergeRatingDecisionIntoVKB(vkb, letter(30, "November 28, 2008"), {
      fileName: "older.pdf",
    });
    expect(vkb.vaClaimsHistory.currentCombinedRating).toBe(80);
    expect(vkb.vaClaimsHistory.currentCombinedRatingSource).toBe("newer.pdf");
  });

  it("lets a newer letter replace an older one, and never lets an undated one replace a dated one", () => {
    const vkb = mergeRatingDecisionIntoVKB(
      initializeVKB(),
      letter(70, "March 31, 2023"),
    );
    mergeRatingDecisionIntoVKB(vkb, letter(80, "May 8, 2024"));
    mergeRatingDecisionIntoVKB(vkb, letter(40, null));
    expect(vkb.vaClaimsHistory.currentCombinedRating).toBe(80);
    expect(vkb.vaClaimsHistory.currentCombinedRatingDate).toBe("May 8, 2024");
  });
});

describe("musterCallProcessor + veteranKnowledgeBase: a real letter's decisionDate reaches a denial's timeline (D2)", () => {
  it("lets the Appeals Lane Advisor find a denial's date from a realistically-worded letter, not just a 'DECISION DATE:' label", async () => {
    const { parseClaimLetter } =
      await import("../../utils/musterCallProcessor");
    const letterText = `Department of Veterans Affairs
Date: May 8, 2024
VA File Number: 123456789

We made a decision on your VA benefits claim.

1. Service connection for tinnitus is denied.
2. Service connection for post-traumatic stress disorder (formerly evaluated as panic disorder without agoraphobia and depressive disorder not otherwise specified (NOS)) is granted with an evaluation of 50 percent effective March 1, 2024.
`;
    const decisionData = await parseClaimLetter(letterText);
    expect(decisionData.decisionDate).toBe("May 8, 2024");

    const vkb = mergeRatingDecisionIntoVKB(initializeVKB(), decisionData, {
      fileName: "Denial-2024-5-8.pdf",
    });

    expect(vkb.vaClaimsHistory.claims).toEqual([
      expect.objectContaining({
        status: "denied",
        decisionDate: "May 8, 2024",
        conditions: ["tinnitus"],
      }),
    ]);
  });
});
