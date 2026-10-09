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

const fixtureDecision = {
  type: "rating_decision",
  claimNumber: "000000000",
  combinedRating: 60,
  combinedRatingHistory: [
    { percentage: 50, effectiveDate: "Jan 26, 2021" },
    { percentage: 60, effectiveDate: "Aug 22, 2021" },
  ],
  decisions: [
    {
      condition: "cervical strain",
      outcome: "increased",
      rating: 20,
      priorRating: 10,
      effectiveDate: "August 22, 2021",
    },
    {
      condition: "left shoulder restricted rotation",
      outcome: "granted",
      rating: 10,
      priorRating: null,
      effectiveDate: "August 22, 2021",
    },
    {
      condition: "ganglion cyst, left wrist",
      outcome: "denied",
      rating: null,
      priorRating: null,
      effectiveDate: null,
    },
    {
      condition:
        "an earlier effective date for the 30 percent evaluation of migraine headaches",
      outcome: "denied",
      rating: null,
      priorRating: null,
      effectiveDate: null,
      issue: "effective_date",
    },
  ],
  conditions: [
    {
      name: "cervical strain",
      rating: 20,
      priorRating: 10,
      outcome: "increased",
      effectiveDate: "August 22, 2021",
      diagnosticCode: null,
      serviceConnected: true,
    },
    {
      name: "left shoulder restricted rotation",
      rating: 10,
      outcome: "granted",
      effectiveDate: "August 22, 2021",
      diagnosticCode: null,
      serviceConnected: true,
    },
  ],
  deniedConditions: ["ganglion cyst, left wrist"],
};

describe("veteranKnowledgeBase: mergeRatingDecisionIntoVKB", () => {
  it("upserts rated conditions, records ratings, denials, combined rating and timeline events", () => {
    const vkb = mergeRatingDecisionIntoVKB(initializeVKB(), fixtureDecision, {
      fileName: "ClaimLetter-2019-11-27.pdf",
    });

    expect(
      vkb.medicalConditions.current.map((c) => [c.name, c.ratedPercentage]),
    ).toEqual([
      ["cervical strain", 20],
      ["left shoulder restricted rotation", 10],
    ]);
    expect(vkb.medicalConditions.current.every((c) => c.serviceConnected)).toBe(
      true,
    );
    expect(vkb.vaClaimsHistory.ratings).toHaveLength(2);
    expect(vkb.vaClaimsHistory.currentCombinedRating).toBe(60);
    expect(vkb.vaClaimsHistory.combinedRatingHistory).toHaveLength(2);
    expect(vkb.vaClaimsHistory.claims).toEqual([
      expect.objectContaining({
        status: "denied",
        conditions: ["ganglion cyst, left wrist"],
      }),
    ]);
    expect(vkb.evidenceTimeline.map((e) => [e.date, e.description])).toEqual([
      ["2021-08-22", "Rating increased: cervical strain (20%)"],
      [
        "2021-08-22",
        "Service connection granted: left shoulder restricted rotation (10%)",
      ],
    ]);
  });

  it("is idempotent for the same letter and lets a later letter update a percentage in place", () => {
    const vkb = mergeRatingDecisionIntoVKB(initializeVKB(), fixtureDecision, {
      fileName: "ClaimLetter-2019-11-27.pdf",
    });
    mergeRatingDecisionIntoVKB(vkb, fixtureDecision, {
      fileName: "ClaimLetter-2019-11-27.pdf",
    });
    expect(vkb.medicalConditions.current).toHaveLength(2);
    expect(vkb.vaClaimsHistory.ratings).toHaveLength(2);
    expect(vkb.evidenceTimeline).toHaveLength(2);
    expect(vkb.vaClaimsHistory.claims).toHaveLength(1);

    mergeRatingDecisionIntoVKB(
      vkb,
      {
        type: "rating_decision",
        combinedRating: 70,
        conditions: [
          {
            name: "Cervical Strain",
            rating: 40,
            outcome: "increased",
            effectiveDate: "March 1, 2023",
          },
        ],
        decisions: [],
      },
      { fileName: "ClaimLetter-2021-7-14.pdf" },
    );
    expect(vkb.medicalConditions.current).toHaveLength(2);
    expect(vkb.medicalConditions.current[0].ratedPercentage).toBe(40);
    expect(vkb.vaClaimsHistory.currentCombinedRating).toBe(70);
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
      letter(60, "February 4, 2022"),
      { fileName: "newer.pdf" },
    );
    mergeRatingDecisionIntoVKB(vkb, letter(20, "October 27, 2006"), {
      fileName: "older.pdf",
    });
    expect(vkb.vaClaimsHistory.currentCombinedRating).toBe(60);
    expect(vkb.vaClaimsHistory.currentCombinedRatingSource).toBe("newer.pdf");
  });

  it("lets a newer letter replace an older one, and never lets an undated one replace a dated one", () => {
    const vkb = mergeRatingDecisionIntoVKB(
      initializeVKB(),
      letter(50, "January 26, 2021"),
    );
    mergeRatingDecisionIntoVKB(vkb, letter(60, "February 4, 2022"));
    mergeRatingDecisionIntoVKB(vkb, letter(30, null));
    expect(vkb.vaClaimsHistory.currentCombinedRating).toBe(60);
    expect(vkb.vaClaimsHistory.currentCombinedRatingDate).toBe(
      "February 4, 2022",
    );
  });
});

describe("musterCallProcessor + veteranKnowledgeBase: a real letter's decisionDate reaches a denial's timeline (D2)", () => {
  it("lets the Appeals Lane Advisor find a denial's date from a realistically-worded letter, not just a 'DECISION DATE:' label", async () => {
    const { parseClaimLetter } =
      await import("../../utils/musterCallProcessor");
    const letterText = `Department of Veterans Affairs
Date: February 4, 2022
VA File Number: 123456789

We made a decision on your VA benefits claim.

1. Service connection for tinnitus is denied.
2. Service connection for pinguecula (formerly evaluated as pterygium and pingueculitis not otherwise specified (NOS)) is granted with an evaluation of 20 percent effective March 1, 2022.
`;
    const decisionData = await parseClaimLetter(letterText);
    expect(decisionData.decisionDate).toBe("February 4, 2022");

    const vkb = mergeRatingDecisionIntoVKB(initializeVKB(), decisionData, {
      fileName: "Denial-2019-11-27.pdf",
    });

    expect(vkb.vaClaimsHistory.claims).toEqual([
      expect.objectContaining({
        status: "denied",
        decisionDate: "February 4, 2022",
        conditions: ["tinnitus"],
      }),
    ]);
  });
});

describe("veteranKnowledgeBase: a C-File code sheet feeds the rating record", () => {
  const codeSheetData = {
    type: "c_file",
    ratingSource: "code_sheet",
    combinedRating: 60,
    decisionDate: "2022-02-02",
    decisionDateKind: "letter",
    conditions: [
      {
        name: "Pinguecula",
        rating: 40,
        effectiveDate: "2021-01-26",
        diagnosticCode: "6037",
        outcome: "code_sheet",
      },
      {
        name: "Tinnitus",
        rating: 10,
        effectiveDate: "2021-01-26",
        diagnosticCode: "6260",
        outcome: "code_sheet",
      },
    ],
    deniedConditions: [
      { name: "Sinusitis", decisionDate: "2021-05-09" },
      { name: "Sleep disorder", decisionDate: "2006-10-25" },
    ],
  };

  it("raises a renamed rating and adds a condition only the code sheet lists", () => {
    const vkb = initializeVKB();
    mergeRatingDecisionIntoVKB(vkb, decisionWithRenamedRatingAt20(), {
      fileName: "letter.pdf",
    });
    mergeRatingDecisionIntoVKB(vkb, codeSheetData, { fileName: "cfile.pdf" });

    const current = vkb.medicalConditions.current;
    expect(current).toHaveLength(2);
    expect(
      current.find((c) => /pinguecula/i.test(c.name)).ratedPercentage,
    ).toBe(40);
    expect(current.find((c) => c.name === "Tinnitus").diagnosticCode).toBe(
      "6260",
    );
    expect(
      vkb.evidenceTimeline.some((e) =>
        e.description.startsWith("Rating on VA code sheet: Tinnitus"),
      ),
    ).toBe(true);
  });

  it("dates each denial with its own original denial date", () => {
    const vkb = initializeVKB();
    mergeRatingDecisionIntoVKB(vkb, codeSheetData, { fileName: "cfile.pdf" });
    const denials = Object.fromEntries(
      vkb.vaClaimsHistory.claims.map((c) => [c.conditions[0], c.decisionDate]),
    );
    expect(denials).toEqual({
      Sinusitis: "2021-05-09",
      "Sleep disorder": "2006-10-25",
    });
  });
});

function decisionWithRenamedRatingAt20() {
  return {
    type: "rating_decision",
    decisionDate: "February 4, 2022",
    decisions: [],
    conditions: [
      {
        name: "Pinguecula (formerly evaluated as pterygium)",
        rating: 20,
        effectiveDate: "June 4, 2005",
      },
    ],
  };
}

describe("veteranKnowledgeBase: combined history and renamed ratings across sources", () => {
  it("keeps combined-history rows from every source, one per day, in date order", () => {
    const vkb = initializeVKB();
    mergeRatingDecisionIntoVKB(vkb, {
      combinedRatingHistory: [
        { percentage: 20, effectiveDate: "June 4, 2005" },
        { percentage: 50, effectiveDate: "Jul 8, 2020" },
        { percentage: 90, effectiveDate: "Aug 22, 2021" },
      ],
    });
    mergeRatingDecisionIntoVKB(vkb, {
      combinedRatingHistory: [
        { percentage: 20, effectiveDate: "2005-06-04" },
        { percentage: 60, effectiveDate: "2021-01-26" },
        { percentage: 90, effectiveDate: "2021-08-22" },
      ],
    });
    expect(
      vkb.vaClaimsHistory.combinedRatingHistory.map((r) => r.percentage),
    ).toEqual([20, 50, 60, 90]);
  });

  it("drops the old name once a letter says the rating was renamed", () => {
    const vkb = initializeVKB();
    mergeRatingDecisionIntoVKB(vkb, {
      conditions: [
        { name: "Ankle sprain", rating: 10, effectiveDate: "2006-06-13" },
      ],
    });
    mergeRatingDecisionIntoVKB(vkb, {
      conditions: [
        {
          name: "Plantar fasciitis, right foot",
          rating: 0,
          effectiveDate: "2021-08-22",
        },
        {
          name: "Chronic ankle instability (previously rated as ankle sprain)",
          rating: 20,
          effectiveDate: "2021-08-22",
        },
      ],
    });
    expect(vkb.medicalConditions.current.map((c) => c.name)).toEqual([
      "Chronic ankle instability (previously rated as ankle sprain)",
      "Plantar fasciitis, right foot",
    ]);
  });
});

describe("veteranKnowledgeBase: dated record events from a C-File", () => {
  it("adds each decision and claim to the timeline once", () => {
    const vkb = initializeVKB();
    const data = {
      recordEvents: [
        {
          date: "2021-05-09",
          eventType: "rating_decision",
          description: "VA rating decision",
        },
        {
          date: "2021-06-05",
          eventType: "claim_received",
          description: "Higher Level Review received by VA",
        },
      ],
    };
    mergeRatingDecisionIntoVKB(vkb, data, { fileName: "cfile.pdf" });
    mergeRatingDecisionIntoVKB(vkb, data, { fileName: "cfile.pdf" });
    expect(
      vkb.evidenceTimeline.map((e) => [e.date, e.eventType, e.source]),
    ).toEqual([
      ["2021-05-09", "rating_decision", "cfile.pdf"],
      ["2021-06-05", "claim_received", "cfile.pdf"],
    ]);
  });
});

describe("veteranKnowledgeBase: one record per decision across letters and the code sheet", () => {
  const letter = {
    decisionDate: "February 4, 2022",
    conditions: [
      {
        name: "left shoulder restricted rotation",
        rating: 10,
        effectiveDate: "August 22, 2021",
        outcome: "granted",
      },
    ],
    deniedConditions: ["Ganglion cyst, left wrist"],
  };
  const sheet = {
    decisionDate: "2022-02-02",
    conditions: [
      {
        name: "Left shoulder restricted rotation associated with cervical strain",
        rating: 10,
        effectiveDate: "2021-08-22",
        diagnosticCode: "5201",
        outcome: "code_sheet",
      },
    ],
    deniedConditions: [
      { name: "Ganglion cyst, left wrist", decisionDate: "2022-02-02" },
    ],
  };

  it("keeps the letter's rating event and adds the code sheet's diagnostic code", () => {
    const vkb = initializeVKB();
    mergeRatingDecisionIntoVKB(vkb, sheet, { fileName: "cfile.pdf" });
    mergeRatingDecisionIntoVKB(vkb, letter, { fileName: "letter.pdf" });
    const events = vkb.evidenceTimeline.filter(
      (e) => e.eventType === "rating_decision",
    );
    expect(events.map((e) => [e.date, e.source])).toEqual([
      ["2021-08-22", "letter.pdf"],
    ]);
    expect(vkb.medicalConditions.current[0].diagnosticCode).toBe("5201");
  });

  it("records a denial once when its letter and the code sheet both list it", () => {
    const vkb = initializeVKB();
    mergeRatingDecisionIntoVKB(vkb, letter, { fileName: "letter.pdf" });
    mergeRatingDecisionIntoVKB(vkb, sheet, { fileName: "cfile.pdf" });
    expect(
      vkb.vaClaimsHistory.claims.filter((c) => c.status === "denied"),
    ).toHaveLength(1);
  });

  it("keeps a denial of the same condition years later", () => {
    const vkb = initializeVKB();
    mergeRatingDecisionIntoVKB(
      vkb,
      { deniedConditions: [{ name: "Sinusitis", decisionDate: "2006-10-25" }] },
      { fileName: "a.pdf" },
    );
    mergeRatingDecisionIntoVKB(
      vkb,
      { deniedConditions: [{ name: "Sinusitis", decisionDate: "2021-05-09" }] },
      { fileName: "b.pdf" },
    );
    expect(vkb.vaClaimsHistory.claims).toHaveLength(2);
  });
});

describe("veteranKnowledgeBase: a later-processed decision never overwrites a newer rating", () => {
  it("ignores an older decision that arrives after the current one is already on file", () => {
    const vkb = initializeVKB();
    mergeRatingDecisionIntoVKB(
      vkb,
      {
        conditions: [
          {
            name: "Cervical strain",
            rating: 20,
            effectiveDate: "2021-08-22",
          },
        ],
      },
      { fileName: "newer-letter.pdf" },
    );
    // A code sheet upload processed second, but describing the earlier rating.
    mergeRatingDecisionIntoVKB(
      vkb,
      {
        conditions: [
          {
            name: "Cervical strain",
            rating: 10,
            effectiveDate: "2020-01-01",
          },
        ],
      },
      { fileName: "older-cfile.pdf" },
    );
    expect(vkb.medicalConditions.current).toHaveLength(1);
    expect(vkb.medicalConditions.current[0].ratedPercentage).toBe(20);
    expect(vkb.medicalConditions.current[0].effectiveDate).toBe("2021-08-22");
  });
});

describe("veteranKnowledgeBase: a rating decision's servicePeriods merge like a code sheet's", () => {
  it("adds the decision's active-duty periods to serviceHistory", () => {
    const vkb = initializeVKB();
    mergeRatingDecisionIntoVKB(
      vkb,
      {
        conditions: [],
        servicePeriods: [
          {
            entryDate: "2000-04-27",
            separationDate: "2005-06-03",
            branch: "Army",
            characterOfDischarge: "Honorable",
          },
        ],
      },
      { fileName: "cfile.pdf" },
    );
    expect(vkb.serviceHistory.servicePeriods).toEqual([
      {
        serviceStartDate: "2000-04-27",
        serviceEndDate: "2005-06-03",
        branch: "Army",
        characterOfService: "Honorable",
        source: "cfile.pdf",
        incomplete: false,
        // The code sheet's own dates are printed, never a guess, from the
        // moment this period is first created - see the QA follow-up fix
        // in _upsertVkbServicePeriod's push path.
        serviceStartDateDerived: false,
        datesVerifiedBy: "cfile.pdf",
      },
    ]);
  });
});
