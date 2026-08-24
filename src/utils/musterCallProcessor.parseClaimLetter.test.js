import { describe, it, expect } from "vitest";

// musterCallProcessor transitively imports pdfjs, which references canvas
// globals jsdom doesn't provide. Stub them so the module loads in the test
// environment (same pattern as musterCallProcessor.ratingDecision.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseClaimLetter } = await import("./musterCallProcessor");

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

    expect(result.claimNumber).toBe("123456789");
    expect(result.letterDate).toBe("November 15, 2025");
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
      "Your Benefit Information: l Entitlement to an earlier effective date for the 50 percent evaluation of post-traumatic stress disorder is denied.",
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
      "Medical Description   Percent (%) Assigned Effective Date  Panic disorder without agoraphobia and depressive disorder not otherwise specified (NOS) 30%   Jun 30, 2007 " +
      "Lumbago (also claimed as back strain) 10%   Jun 30, 2008 An examination will be scheduled at a future date. " +
      "We determined that the following conditions were not related to your military service, so service connection couldn't be granted: Medical Description  Allergies Secondary insomnia " +
      "Your overall or combined rating is 30% effective June 30, 2007 and then 40% effective June 30, 2008. We do not add the individual percentages.";
    const result = await parseClaimLetter(text);
    expect(result.decisions).toEqual([
      {
        condition:
          "Panic disorder without agoraphobia and depressive disorder not otherwise specified (NOS)",
        outcome: "granted",
        rating: 30,
        priorRating: null,
        effectiveDate: "Jun 30, 2007",
      },
      {
        condition: "Lumbago (also claimed as back strain)",
        outcome: "granted",
        rating: 10,
        priorRating: null,
        effectiveDate: "Jun 30, 2008",
      },
    ]);
    expect(result.combinedRating).toBe(40);
    expect(result.combinedRatingHistory).toEqual([
      { percentage: 30, effectiveDate: "June 30, 2007" },
      { percentage: 40, effectiveDate: "June 30, 2008" },
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
      "We made a decision on your VA benefits. Your Benefit Information: " +
      "l   Evaluation of lumbosacral strain, degenerative disc disease (previously rated as lumbago), which is currently 10 percent disabling, is increased to 20 percent effective September 15, 2023. " +
      "l   Service connection for left hip limited adduction is granted with an evaluation of 10 percent effective September 15, 2023. " +
      "l   Service connection for right hip limited adduction is granted with an evaluation of 10 percent effective September 15, 2023. " +
      "l   Evaluation of radiculopathy, right lower extremity (femoral), which is currently 10 percent disabling, is continued. " +
      "Page 1";
    const page2 =
      "l   Service connection for reactive airway disease (claimed as lung condition) associated with TERA participation is granted with an evaluation of 0 percent effective September 15, 2023. " +
      "l   Service connection for lipoma, left scalp (claimed as sebaceous cyst) is denied. " +
      "Your combined rating evaluation is: Combined Rating Evaluation   Effective Date  30%   Jun 30, 2007  40%   Jun 30, 2008  70%   Mar 31, 2023  80%   Sep 15, 2023  How VA Combines Percentages " +
      "File Number: 000000000  Page 2";
    const page5 =
      "Rating Decision INTRODUCTION ... DECISION 1. Service connection for left hip limited adduction is granted with an evaluation of 10 percent effective September 15, 2023.";
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
    expect(lumbar.condition).toMatch(/^lumbosacral strain/);
    expect(lumbar.priorRating).toBe(10);
    expect(lumbar.rating).toBe(20);
    expect(lumbar.effectiveDate).toBe("September 15, 2023");
    const radic = result.decisions[3];
    expect(radic.rating).toBe(10);
    const airway = result.decisions[4];
    expect(airway.rating).toBe(0);
    expect(result.decisions[5].rating).toBeNull();

    expect(result.combinedRating).toBe(80);
    expect(result.combinedRatingHistory).toEqual([
      { percentage: 30, effectiveDate: "Jun 30, 2007" },
      { percentage: 40, effectiveDate: "Jun 30, 2008" },
      { percentage: 70, effectiveDate: "Mar 31, 2023" },
      { percentage: 80, effectiveDate: "Sep 15, 2023" },
    ]);
    expect(result.conditions).toHaveLength(5);
    expect(result.conditions.map((c) => c.rating)).toEqual([20, 10, 10, 10, 0]);
    expect(result.claimNumber).toBe("000000000");
    expect(result.status).toBe("mixed");
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
