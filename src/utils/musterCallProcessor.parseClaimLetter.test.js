import { describe, it, expect } from "vitest";

// musterCallProcessor transitively imports pdfjs, which references canvas
// globals jsdom doesn't provide. Stub them so the module loads in the test
// environment (same pattern as musterCallProcessor.ratingDecision.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseClaimLetter, parseRatingDecision } =
  await import("./musterCallProcessor");

function realDecisionLetterText() {
  return `Department of Veterans Affairs
Date: November 15, 2025
VA File Number: 123456789

We made a decision on the claim you filed.

1. Service connection for tinnitus is granted with an evaluation of 10 percent effective November 1, 2025.
2. Service connection for post-traumatic stress disorder is denied.
3. Evaluation of lumbosacral strain, currently 20 percent disabling, is continued.
`;
}

function developmentLetterText() {
  return `Department of Veterans Affairs

We received your claim for compensation on October 1, 2025.

What we need from you:
We need the following evidence to continue processing your claim:
• Private medical treatment records for your knee condition
• A completed VA Form 21-4142

Please send this evidence within 30 days from the date of this letter.
`;
}

async function parseWithinBudget(text) {
  const start = Date.now();
  const result = await parseClaimLetter(text);
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(1000);
  return result;
}

describe("musterCallProcessor: parseClaimLetter (real letter phrasing)", () => {
  it("extracts per-issue grant/deny/continue outcomes from a real decision letter", async () => {
    const result = await parseClaimLetter(realDecisionLetterText());

    expect(result.vaFileNumber).toBe("123456789");
    expect(result.claimNumber).toBeNull();
    expect(result.letterDate).toBe("November 15, 2025");
    expect(result.decisionDate).toBe("November 15, 2025");
    expect(result.decisions).toHaveLength(3);

    const tinnitus = result.decisions.find((d) =>
      d.condition.toLowerCase().includes("tinnitus"),
    );
    expect(tinnitus.outcome).toBe("granted");
    expect(tinnitus.rating).toBe(10);
    expect(tinnitus.effectiveDate).toBe("November 1, 2025");

    const ptsd = result.decisions.find((d) =>
      d.condition.toLowerCase().includes("post-traumatic"),
    );
    expect(ptsd.outcome).toBe("denied");

    const strain = result.decisions.find((d) =>
      d.condition.toLowerCase().includes("lumbosacral"),
    );
    expect(strain.outcome).toBe("continued");
    expect(strain.rating).toBe(20);

    expect(result.status).toBe("mixed");
  });

  it("extracts evidence-request fields from a real development letter", async () => {
    const result = await parseClaimLetter(developmentLetterText());

    expect(result.claimDate).toBe("October 1, 2025");
    expect(result.evidenceNeeded).toEqual([
      "Private medical treatment records for your knee condition",
      "A completed VA Form 21-4142",
    ]);
    expect(result.responseDeadlineDays).toBe(30);
    expect(result.status).toBe("pending");
  });

  it("falls back to the legacy intake-form CLAIM NUMBER/DATE labels", async () => {
    const text =
      "CLAIM NUMBER: 87654321\nCLAIM DATE: 01-15-2020\nSTATUS: PENDING\n";
    const result = await parseClaimLetter(text);
    expect(result.claimNumber).toBe("87654321");
    expect(result.claimDate).toBe("01-15-2020");
    expect(result.status).toBe("pending");
  });

  it("classifies an all-grant letter as granted, not mixed", async () => {
    const text =
      "1. Service connection for tinnitus is granted with an evaluation of 10 percent.\n" +
      "2. Service connection for hearing loss is granted with an evaluation of 10 percent.\n";
    const result = await parseClaimLetter(text);
    expect(result.status).toBe("granted");
  });
});

describe("musterCallProcessor: parseClaimLetter (ReDoS and layout regressions)", () => {
  it("does not hang on a large all-letters document (regression: ReDoS)", async () => {
    const result = await parseWithinBudget("A".repeat(100000));
    expect(result.decisions).toEqual([]);
  });

  it("does not hang on a single huge line with no match (regression: ReDoS)", async () => {
    const result = await parseWithinBudget(`${"is granted ".repeat(20000)}\n`);
    expect(result).toBeDefined();
  });

  it("does not hang across many decision lines with an unterminated 'effective' clause (regression: ReDoS)", async () => {
    // Stresses the extractPerIssueDecisions dateMatch alternation
    // (letters-then-date vs numeric-date branches) across many lines that
    // each match the outer outcome pattern but never complete a real date.
    const line = `1. Service connection for condition is granted effective ${"Z ".repeat(60)}\n`;
    const result = await parseWithinBudget(line.repeat(2000));
    // Identical (condition, outcome) pairs collapse to one decision - real
    // letters repeat every decision on the cover page and again in the
    // enclosed rating decision - so the count is 1, and the budget
    // assertion inside parseWithinBudget is the regression check.
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0].condition).toBe("condition");
  });

  it("treats an earlier-effective-date denial as a date issue, not a denied condition", async () => {
    const result = await parseClaimLetter(
      "Your Benefit Information: l Entitlement to an earlier effective date for the 10 percent evaluation of migraine headaches is denied.",
    );
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0].issue).toBe("effective_date");
    expect(result.decisions[0].condition).toMatch(/^an earlier effective date/);
    expect(result.conditions).toEqual([]);
  });
});

describe("musterCallProcessor: parseClaimLetter (historic and pdf.js layouts)", () => {
  it("reads the pre-2015 tabular decision format and prose combined-rating history", async () => {
    const text =
      "What We Decided  We determined that the following conditions were related to your military service, so service connection has been granted:  " +
      "Medical Description   Percent (%) Assigned Effective Date  Spastic colon and functional dyspepsia not otherwise specified (NOS) 10%   Mar 12, 2010 " +
      "Neck sprain (also claimed as stiff neck) 10%   Mar 12, 2011 An examination will be scheduled at a future date. " +
      "We determined that the following conditions were not related to your military service, so service connection couldn't be granted: Medical Description  Allergies Pinguecula " +
      "Your overall or combined rating is 10% effective March 12, 2010 and then 20% effective March 12, 2011. We do not add the individual percentages.";
    const result = await parseClaimLetter(text);
    expect(result.decisions).toEqual([
      {
        condition:
          "Spastic colon and functional dyspepsia not otherwise specified (NOS)",
        outcome: "granted",
        rating: 10,
        priorRating: null,
        effectiveDate: "Mar 12, 2010",
      },
      {
        condition: "Neck sprain (also claimed as stiff neck)",
        outcome: "granted",
        rating: 10,
        priorRating: null,
        effectiveDate: "Mar 12, 2011",
      },
    ]);
    expect(result.combinedRating).toBe(20);
    expect(result.combinedRatingHistory).toEqual([
      { percentage: 10, effectiveDate: "March 12, 2010" },
      { percentage: 20, effectiveDate: "March 12, 2011" },
    ]);
  });
});

describe("musterCallProcessor: parseClaimLetter (pdf.js page-line layout)", () => {
  it("extracts every decision from a pdf.js page-line letter with wrapped bullets and a combined-rating table", async () => {
    // Real decision letters arrive from pdf.js as ONE text line per page,
    // bullets rendered as a stray "l", each outcome wrapped across visual
    // lines, and the same decisions repeated in the enclosed rating
    // decision. A line-anchored extractor found one of eleven.
    const page1 =
      "We made a decision on your VA benefits. Benefit Summary: " +
      "l   Evaluation of cervical strain, degenerative arthritis (previously rated as neck sprain), which is currently 20 percent disabling, is increased to 30 percent effective April 14, 2022. " +
      "l   Service connection for left shoulder restricted rotation is granted with an evaluation of 10 percent effective April 14, 2022. " +
      "l   Service connection for right shoulder restricted rotation is granted with an evaluation of 10 percent effective April 14, 2022. " +
      "l   Evaluation of neuropathy, right upper extremity (median), which is currently 10 percent disabling, is continued. " +
      "Page 1";
    const page2 =
      "l   Service connection for chronic sinusitis (claimed as sinus condition) associated with burn pit exposure is granted at 0 percent, effective April 14, 2022. " +
      "l   Service connection for ganglion cyst, left wrist (claimed as wrist lump) is denied. " +
      "Your combined rating evaluation is: Combined Rating Evaluation   Effective Date  20%   Mar 12, 2010  30%   Mar 12, 2011  40%   Oct 2, 2021  50%   Apr 14, 2022  How VA Combines Percentages " +
      "File Number: 000000000  Page 2";
    const page5 =
      "Rating Decision INTRODUCTION ... DECISION 1. Service connection for left shoulder restricted rotation is granted with an evaluation of 10 percent effective April 14, 2022.";
    const result = await parseClaimLetter(
      `--- PAGE 1 ---\n${page1}\n--- PAGE 2 ---\n${page2}\n--- PAGE 5 ---\n${page5}`,
    );

    expect(result.decisions.map((d) => d.outcome)).toEqual([
      "increased",
      "granted",
      "granted",
      "continued",
      "granted",
      "denied",
    ]);
    const lumbar = result.decisions[0];
    expect(lumbar.condition).toMatch(/^cervical strain/);
    expect(lumbar.priorRating).toBe(20);
    expect(lumbar.rating).toBe(30);
    expect(lumbar.effectiveDate).toBe("April 14, 2022");
    const radic = result.decisions[3];
    expect(radic.rating).toBe(10);
    const airway = result.decisions[4];
    expect(airway.rating).toBe(0);
    expect(result.decisions[5].rating).toBeNull();

    expect(result.combinedRating).toBe(50);
    expect(result.combinedRatingHistory).toEqual([
      { percentage: 20, effectiveDate: "Mar 12, 2010" },
      { percentage: 30, effectiveDate: "Mar 12, 2011" },
      { percentage: 40, effectiveDate: "Oct 2, 2021" },
      { percentage: 50, effectiveDate: "Apr 14, 2022" },
    ]);
    // No "Date:" letterhead line anywhere in this letter - decisionDate
    // falls back to the newest effective date it actually states.
    expect(result.decisionDate).toBe("April 14, 2022");
    expect(result.conditions).toHaveLength(5);
    expect(result.conditions.map((c) => c.rating)).toEqual([30, 10, 10, 10, 0]);
    expect(result.vaFileNumber).toBe("000000000");
    expect(result.status).toBe("mixed");
  });

  it("keeps a bilateral pair distinct when both conditions share a >40-char name prefix (regression)", async () => {
    // Real letters grant paired-extremity conditions as two full sentences
    // that differ only in "left foot" / "right foot" at the very end. When
    // that shared prefix is 40+ characters, decisionKey's front-truncated
    // dedup key collapsed the second sentence into the first and dropped a
    // real, separately-rated condition.
    const text =
      "Service connection for Plantar fasciitis with calcaneal spur formation (not heel contusion), left foot is granted at 0 percent, effective August 4, 2022. " +
      "Service connection for Plantar fasciitis with calcaneal spur formation (not heel contusion), right foot is granted at 0 percent, effective August 4, 2022.";
    const result = await parseClaimLetter(text);

    expect(result.decisions).toHaveLength(2);
    expect(result.decisions[0].condition).toMatch(/left foot$/);
    expect(result.decisions[1].condition).toMatch(/right foot$/);
    expect(result.conditions).toHaveLength(2);
  });

  it("does not hang on a large claim letter where the file/date/evidence regexes almost-but-never match (regression: ReDoS)", async () => {
    // Stresses fileNumMatch, receivedMatch (bounded {0,80} filler),
    // claimDateMatch fallback, letterDateMatch, and evidenceSectionMatch
    // (bounded {0,800} body) all in one pass, each pushed right up against
    // its bound without ever completing a real match.
    const pathological =
      `FILE NUMBER: ${"9".repeat(20)}\n` +
      `RECEIVED YOUR CLAIM ${"x".repeat(500)}\n` +
      `Date ${"y".repeat(500)}\n` +
      `WHAT WE NEED FROM YOU ${"z".repeat(50000)}\n`;
    const result = await parseWithinBudget(pathological);
    expect(result).toBeDefined();
  });
});

// pdf.js text items as extractStandardText (advancedOCR.js) sees them: the
// parser's text joins them with spaces, letterheadText keeps the hasEOL breaks.
const LETTERHEAD_ITEMS = [
  { str: "DEPARTMENT OF VETERANS AFFAIRS", hasEOL: true },
  { str: "Veterans Benefits Administration", hasEOL: true },
  { str: "Claim received May 29, 2023", hasEOL: true },
  { str: "February 4, 2024", hasEOL: true },
  { str: "VETERAN NAME", hasEOL: true },
  { str: "We made a decision on your VA benefits claim", hasEOL: true },
  {
    str: "Evaluation of lumbosacral strain, which is currently 10 percent disabling, is increased to 20 percent effective August 22, 2023.",
    hasEOL: false,
  },
];
const spacedLetterText = `--- PAGE 1 ---\n${LETTERHEAD_ITEMS.map((i) => i.str).join(" ")}\n\n`;
const letterheadText = LETTERHEAD_ITEMS.map(
  (i) => i.str + (i.hasEOL ? "\n" : " "),
).join("");

describe("musterCallProcessor: parseClaimLetter letterhead date", () => {
  it("reads the letter's own date from the extractor's letterhead lines, not an effective date", async () => {
    const result = await parseClaimLetter(spacedLetterText, {
      letterheadText,
    });
    expect(result.decisionDate).toBe("February 4, 2024");
    expect(result.decisionDateKind).toBe("letter");
  });

  it("cannot find the letterhead date in the space-joined page text alone", async () => {
    const result = await parseClaimLetter(spacedLetterText);
    expect(result.decisionDate).toBe("August 22, 2023");
    expect(result.decisionDateKind).toBe("effective");
  });

  it("reads the letterhead date for a rating decision too", async () => {
    const result = await parseRatingDecision(spacedLetterText, {
      letterheadText,
    });
    expect(result.decisionDate).toBe("February 4, 2024");
    expect(result.decisionDateKind).toBe("letter");
  });

  it("falls back to the newest effective date and says so when there is no letterhead date", async () => {
    const text =
      "We made a decision on your VA benefits claim\nEvaluation of lumbosacral strain, which is currently 10 percent disabling, is increased to 20 percent effective August 22, 2023.";
    const result = await parseClaimLetter(text);
    expect(result.decisionDate).toBe("August 22, 2023");
    expect(result.decisionDateKind).toBe("effective");
  });
});

describe("musterCallProcessor: ratings a letter restates rather than decides", () => {
  it("reads the rating a Higher-Level Review restates when it only decides an effective date", async () => {
    const result = await parseClaimLetter(
      "DECISION Entitlement to an earlier effective date for the 10 percent evaluation of migraine headaches is denied. " +
        "REASONS FOR DECISION The claim for increase was received on January 26, 2023. " +
        "We have assigned a 10 percent evaluation for your migraine headaches (formerly evaluated as tension headaches) based on: Cramping",
    );
    expect(result.conditions).toEqual([
      expect.objectContaining({
        name: "migraine headaches (formerly evaluated as tension headaches)",
        rating: 10,
        outcome: "continued",
      }),
    ]);
    expect(
      result.decisions.filter((d) => d.outcome === "denied" && !d.issue),
    ).toEqual([]);
  });

  it("keeps the decided rating when the reasons restate it", async () => {
    const result = await parseClaimLetter(
      "1. Evaluation of tinnitus, which is currently 0 percent disabling, is increased to 10 percent effective January 26, 2023. " +
        "We have assigned a 10 percent evaluation for your tinnitus based on: recurrent tinnitus",
    );
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions[0]).toMatchObject({
      rating: 10,
      outcome: "increased",
    });
  });

  it("does not turn payment-table prose into rated conditions", async () => {
    const result = await parseRatingDecision(
      "$180.00 Feb 3, 2010 Original award, 20% Feb 3, 2011 Compensation rating adjusted to 30% Your overall or combined rating is 20% effective Feb 3, 2010",
    );
    expect(result.conditions.map((c) => c.name)).not.toContain(
      "Original award,",
    );
    expect(result.conditions).toEqual([]);
  });
});
