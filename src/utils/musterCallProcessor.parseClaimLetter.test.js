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
    const line = `1. Condition is granted effective ${"Z ".repeat(60)}\n`;
    const result = await parseWithinBudget(line.repeat(2000));
    expect(result.decisions).toHaveLength(2000);
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
