import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { calculateVARating } from "../../utils/vaCalculator";
import {
  buildCalculatorExplanation,
  buildComputedResultBlock,
  buildTdiuThresholdParagraph,
  mentionsUnemployability,
  TDIU_REGULATION_QUOTES,
  checkRaterResponse,
  extractStatedCombinedRatings,
  findInventedBilateralClaims,
  formatCalculatorWorking,
} from "../../utils/raterGrounding";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(
    join(
      here,
      "..",
      "agentic",
      "eval",
      "fixtures",
      "statedCombinedRatings.json",
    ),
    "utf8",
  ),
);

const cond = (name, rating, side = "none", bodyPart = name.toLowerCase()) => ({
  name,
  rating,
  side,
  bodyPart,
});

const FOUR = [
  cond("PTSD", 50, "none", "mental"),
  cond("Tinnitus", 30, "none", "ear"),
  cond("Back", 20, "none", "back"),
  cond("Knee", 10, "none", "knee"),
];
const KNEES = [
  cond("Lumbar strain", 40),
  cond("Left knee strain", 30, "left", "knee"),
  cond("Right knee strain", 20, "right", "knee"),
];

describe("extractStatedCombinedRatings (shared fixture with scripts/eval/lib/goldenChecks.js)", () => {
  it.each(FIXTURE)("$name", ({ text, stated }) => {
    expect(extractStatedCombinedRatings(text)).toEqual(stated);
  });
});

const GOLDEN = Object.fromEntries(
  readFileSync(join(here, "..", "agentic", "golden-set.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((c) => [c.id, c]),
);
const TRANSCRIPT_ENTRIES = FIXTURE.filter((entry) => entry.expected);

describe("Rater responses recorded in the five golden-set transcripts", () => {
  it("covers cases a11, a12, a13, a24 and a25 in each of the five transcripts", () => {
    expect(TRANSCRIPT_ENTRIES).toHaveLength(25);
    expect(new Set(TRANSCRIPT_ENTRIES.map((e) => e.transcript)).size).toBe(5);
    expect(new Set(TRANSCRIPT_ENTRIES.map((e) => e.caseId))).toEqual(
      new Set(["a11", "a12", "a13", "a24", "a25"]),
    );
  });

  it.each(TRANSCRIPT_ENTRIES)("$name", (entry) => {
    const calc = calculateVARating(GOLDEN[entry.caseId].conditions);
    expect(calc.combinedRating).toBe(entry.calculator);
    const check = checkRaterResponse(entry.text, calc);
    let outcome = "no final figure stated";
    if (check.wrongFigures.length > 0) outcome = "contradicts calculator";
    else if (check.stated.includes(calc.combinedRating))
      outcome = "matches calculator";
    expect(outcome).toBe(
      entry.knownMiss ? "no final figure stated" : entry.expected,
    );
  });
});

describe("extractStatedCombinedRatings phrasings and exclusions", () => {
  it.each([
    [
      "subject phrase before the verb, bold figure",
      "The combined rating for the veteran, considering the bilateral factor and the highest-rated condition, is **52%**.",
      [52],
    ],
    ["label then bold figure", "**Final Result:** 52%", [52]],
    ["bold figure after a colon", "Final combined rating: **60%**", [60]],
    [
      "hedge after the verb",
      "Your combined rating is approximately 99%.",
      [99],
    ],
    [
      "TeX escaped percent sign",
      String.raw`\text{Final Combined Rating} = 58\%`,
      [58],
    ],
  ])("finds the figure: %s", (_label, text, stated) => {
    expect(extractStatedCombinedRatings(text)).toEqual(stated);
  });

  it.each([
    ["group value", "Total Group Rating: 22%"],
    ["operand of a sum", "Combined Rating: 10% + 10% = 20%"],
    ["step value", "Final step: 72% combined with 10% = 75%"],
    [
      "condition rating after a clause word",
      "The combined rating applies when the knee is 10%.",
    ],
    [
      "input listed before the verb",
      "Your combined rating uses 50% PTSD and 30% tinnitus.",
    ],
    [
      "total of something else",
      "Total possible rating without any pairing = 100%",
    ],
  ])("does not count: %s", (_label, text) => {
    expect(extractStatedCombinedRatings(text)).toEqual([]);
  });
});

describe("formatCalculatorWorking", () => {
  it("shows every step, the raw value and the single final rounding for 50/30/20/10", () => {
    const lines = formatCalculatorWorking(calculateVARating(FOUR));
    expect(lines).toContain("  Step 1: 50% combined with 30% = 65%");
    expect(lines).toContain("  Step 2: 65% combined with 20% = 72%");
    expect(lines).toContain("  Step 3: 72% combined with 10% = 75%");
    expect(lines).toContain("Combined value before final rounding: 75%");
    expect(lines.at(-1)).toMatch(/38 CFR § 4\.25\(b\)\): 80%$/);
  });

  it("shows the bilateral group working and carries the group rating into the combine", () => {
    const text = formatCalculatorWorking(calculateVARating(KNEES)).join("\n");
    expect(text).toContain(
      "Bilateral group (Left knee strain and Right knee strain",
    );
    expect(text).toContain("  30% combined with 20% = 44%");
    expect(text).toContain("10% of 44% = 4.4, so the group rating is 48%");
    expect(text).toContain("Step 1: 48% combined with 40% = 69%");
    expect(text).toContain("38 CFR § 4.25(b)): 70%");
  });

  it("says there is nothing to combine for a single rating", () => {
    const text = formatCalculatorWorking(
      calculateVARating([cond("PTSD", 100)]),
    ).join("\n");
    expect(text).toContain("nothing to combine");
    expect(text).toContain("100%");
  });
});

describe("buildComputedResultBlock", () => {
  it("keeps the markers and the existing lines the evaluation runner and tests read", () => {
    const block = buildComputedResultBlock(calculateVARating(KNEES));
    expect(block).toContain(
      "=== COMPUTED RESULT (38 CFR § 4.25/4.26 - already calculated, do not recompute) ===",
    );
    expect(block).toContain("=== END COMPUTED RESULT ===");
    expect(block).toContain(
      "Bilateral pair: Left knee strain (left, 30%), Right knee strain (right, 20%)",
    );
    expect(block).toContain("Bilateral group rating: 48");
    expect(block).toContain("Combined rating: 70%");
    expect(block).toContain("This result is final. Restate it exactly");
    expect(block).toContain("Never recompute it");
  });
});

describe("checkRaterResponse", () => {
  const four = calculateVARating(FOUR);

  it("accepts a response that restates the calculator's figure", () => {
    expect(checkRaterResponse("Your combined rating is 80%.", four).ok).toBe(
      true,
    );
  });

  it("accepts a response that states no combined figure", () => {
    expect(
      checkRaterResponse("Here is how VA combines ratings.", four).ok,
    ).toBe(true);
  });

  it("flags a different final rating (baseline a11: 80 restated, then 70)", () => {
    const out = checkRaterResponse(
      "Your combined disability rating is 80%. ... The final combined disability rating is **70%**.",
      four,
    );
    expect(out.ok).toBe(false);
    expect(out.wrongFigures).toEqual([70]);
  });

  it("flags a final rating phrased as a calculation result (baseline a13)", () => {
    const rated = calculateVARating([
      cond("Condition 1", 60),
      cond("Condition 2", 20),
      cond("Condition 3", 20),
      cond("Condition 4", 20),
    ]);
    expect(rated.combinedRating).toBe(80);
    const out = checkRaterResponse(
      "Given that the combined rating calculation results in 100%, you are eligible.",
      rated,
    );
    expect(out.ok).toBe(false);
    expect(out.wrongFigures).toEqual([100]);
  });

  it("flags an unrounded figure that is not part of the working", () => {
    const out = checkRaterResponse("The final combined rating is 74.8%.", four);
    expect(out.ok).toBe(false);
  });

  it("does not treat the calculator's own intermediate values as final claims", () => {
    expect(
      checkRaterResponse(
        "The combined value before rounding is 75%. The final rating is 80%.",
        four,
      ).ok,
    ).toBe(true);
  });

  it("flags a wrong multiple of 10 even when it equals no working value", () => {
    const sixty = calculateVARating([cond("A", 40), cond("B", 30)]);
    expect(sixty.combinedRating).toBe(60);
    expect(checkRaterResponse("The final rating is 60%.", sixty).ok).toBe(true);
    expect(checkRaterResponse("The final rating is 50%.", sixty).ok).toBe(
      false,
    );
  });

  it("ignores a sentence that only states a cap", () => {
    expect(
      checkRaterResponse(
        "Your combined rating is 80%. The maximum combined rating is 100%.",
        four,
      ).ok,
    ).toBe(true);
  });
});

describe("checkRaterResponse bilateral claims", () => {
  const four = calculateVARating(FOUR);

  it("flags an invented bilateral pair when the calculator found none (baseline a11)", () => {
    const out = checkRaterResponse(
      "Your combined rating is 80%.\n- **PTSD (Left Brain) + Tinnitus (Right Ear):** This would be a valid bilateral pair.",
      four,
    );
    expect(out.ok).toBe(false);
    expect(out.inventedPairs).toHaveLength(1);
    expect(out.wrongFigures).toEqual([]);
  });

  it("does not flag statements that no bilateral pair exists", () => {
    const text = [
      "Bilateral pair: none",
      "Since none of the conditions are paired bilaterally, the bilateral factor does not apply.",
      "The bilateral factor is not applicable to PTSD or Tinnitus.",
      "Bilateral means the same body part on both sides.",
      "Your combined rating is 80%.",
    ].join("\n");
    expect(findInventedBilateralClaims(text, four)).toEqual([]);
    expect(checkRaterResponse(text, four).ok).toBe(true);
  });

  it("accepts the real pair and flags a pair built from other conditions", () => {
    const knees = calculateVARating(KNEES);
    const good =
      "The bilateral pair is Left knee strain and Right knee strain, giving 48%. Combined rating: 70%.";
    expect(checkRaterResponse(good, knees).ok).toBe(true);
    const bad =
      "The bilateral pair is Lumbar strain and the knees. Combined rating: 70%.";
    expect(checkRaterResponse(bad, knees).ok).toBe(false);
  });
});

describe("buildCalculatorExplanation", () => {
  it("states the calculator's figure and working, and says the draft was not shown", () => {
    const calc = calculateVARating(FOUR);
    const text = buildCalculatorExplanation(calc, {
      check: checkRaterResponse("Your combined rating is 70%.", calc),
    });
    expect(text).toContain("did not match Vet-Rate's calculator");
    expect(text).toContain("Your combined rating is 80%.");
    expect(text).toContain("Step 3: 72% combined with 10% = 75%");
    expect(text).toContain("No bilateral pair applies");
  });

  it("states the bilateral rule as 38 CFR § 4.26 words it, not as same-body-part only", () => {
    const text = buildCalculatorExplanation(calculateVARating(FOUR));
    expect(text).toContain(
      '"partial disability of compensable degree in each of 2 paired extremities, or paired skeletal muscles" (38 CFR § 4.26(c))',
    );
    expect(text).toContain(
      "a right thigh and a left foot are a pair (38 CFR § 4.26(a))",
    );
    expect(text).toContain("Two conditions on the same side are not a pair");
    expect(text).toContain(
      "the two highest ratings are not automatically a pair",
    );
    expect(text).not.toMatch(/same body part/);
  });

  it("describes a found pair as left and right disabilities of paired extremities", () => {
    const text = buildCalculatorExplanation(calculateVARating(KNEES));
    expect(text).toContain(
      "disabilities of paired extremities, one on the left and one on the right (38 CFR § 4.26)",
    );
    expect(text).not.toMatch(/same body part/);
  });

  it("names the pair when the calculator found one", () => {
    const text = buildCalculatorExplanation(calculateVARating(KNEES));
    expect(text).toContain(
      "applies to Left knee strain (left, 30%), Right knee strain (right, 20%)",
    );
    expect(text).toContain("Your combined rating is 70%.");
  });

  it("is itself consistent with the check, so it is never replaced again", () => {
    for (const set of [FOUR, KNEES, [cond("PTSD", 100)]]) {
      const calc = calculateVARating(set);
      expect(
        checkRaterResponse(buildCalculatorExplanation(calc), calc).ok,
      ).toBe(true);
    }
  });
});

const set = (...ratings) =>
  ratings.map((rating, i) => cond(`Condition ${i + 1}`, rating));
const tdiuText = (...ratings) =>
  buildTdiuThresholdParagraph(calculateVARating(set(...ratings)));

describe("mentionsUnemployability", () => {
  it.each([
    "Am I eligible for TDIU with one 60% rating and three 20% ratings?",
    "Can I qualify for tdiu?",
    "Do I qualify for individual unemployability?",
    "I am unemployable because of my back",
  ])("matches: %s", (prompt) => {
    expect(mentionsUnemployability(prompt)).toBe(true);
  });

  it.each([
    "Calculate my combined rating: just 100% PTSD.",
    "What is my rating with a 60% knee?",
    "",
    undefined,
  ])("does not match: %s", (prompt) => {
    expect(mentionsUnemployability(prompt)).toBe(false);
  });
});

describe("buildTdiuThresholdParagraph", () => {
  it("quotes the thresholds and says the percentage is only one part", () => {
    const text = tdiuText(60);
    expect(text).toContain(TDIU_REGULATION_QUOTES.thresholds);
    expect(text).toContain("The percentage is only one part.");
    expect(text).toContain(TDIU_REGULATION_QUOTES.unable);
    expect(text).toContain("Vet-Rate cannot determine that.");
  });

  it("says plainly that common-origin and single-body-system groupings are not evaluated", () => {
    const text = tdiuText(30, 30, 20);
    expect(text).toContain(TDIU_REGULATION_QUOTES.commonOrigin);
    expect(text).toContain(TDIU_REGULATION_QUOTES.singleSystem);
    expect(text).toContain("Vet-Rate does not evaluate these groupings");
  });

  it("one 60% condition meets the single-disability threshold (case a25)", () => {
    const text = tdiuText(60);
    expect(text).toContain(
      "Condition 1 is rated 60 percent, which meets the threshold for a single disability.",
    );
    expect(text).not.toContain("not met");
  });

  it("one 60% and three 20% meet both thresholds (case a13)", () => {
    const text = tdiuText(60, 20, 20, 20);
    expect(text).toContain(
      "meets the threshold for a single disability, if that is the only disability",
    );
    expect(text).toContain("also met");
    expect(text).toContain("your combined rating is 80 percent");
  });

  it("a 60% condition with a small second one meets the single threshold but not the combined one", () => {
    const text = tdiuText(60, 10);
    expect(text).toContain("meets the threshold for a single disability");
    expect(text).toContain(
      "two or more disabilities is not met on these ratings",
    );
    expect(text).toContain("your combined rating is 60 percent");
  });

  it("50, 30, 20 meets only the two-or-more threshold", () => {
    const text = tdiuText(50, 30, 20);
    expect(text).toContain("the threshold for a single disability is not met");
    expect(text).toContain("two or more disabilities is met");
    expect(text).toContain("your combined rating is 70 percent");
  });

  it("40 and 30 reach a 60 combined rating, below 70, and cite paragraph (b)", () => {
    const text = tdiuText(40, 30);
    expect(text).toContain("neither threshold is met");
    expect(text).toContain("is below the 70 percent figure");
    expect(text).toContain(TDIU_REGULATION_QUOTES.extraSchedular);
  });

  it("all conditions under 40 percent fail both thresholds even when they combine to 70", () => {
    const calc = calculateVARating(set(30, 30, 30, 30));
    expect(calc.combinedRating).toBeGreaterThanOrEqual(70);
    const text = buildTdiuThresholdParagraph(calc);
    expect(text).toContain("neither threshold is met");
    expect(text).toContain("no condition is rated 40 percent or more");
  });

  it("uses the calculator's combined rating, bilateral factor included", () => {
    const calc = calculateVARating(KNEES);
    expect(buildTdiuThresholdParagraph(calc)).toContain(
      `your combined rating is ${calc.combinedRating} percent`,
    );
  });

  it("states no rating figure the check would read as a different combined rating", () => {
    for (const ratings of [
      [60],
      [60, 20, 20, 20],
      [60, 10],
      [50, 30, 20],
      [40, 30],
    ]) {
      const calc = calculateVARating(set(...ratings));
      const text = buildCalculatorExplanation(calc, { tdiu: true });
      expect(checkRaterResponse(text, calc).ok).toBe(true);
    }
  });
});

describe("buildCalculatorExplanation with a TDIU question", () => {
  const calc = calculateVARating(set(60));
  it("leaves the text unchanged unless asked", () => {
    expect(buildCalculatorExplanation(calc)).not.toContain("TDIU");
    expect(buildCalculatorExplanation(calc, { tdiu: false })).toBe(
      buildCalculatorExplanation(calc),
    );
  });

  it("adds the paragraph before the closing advice", () => {
    const text = buildCalculatorExplanation(calc, { tdiu: true });
    expect(text).toContain(
      "About your question on individual unemployability (TDIU):",
    );
    expect(text.indexOf("About your question")).toBeLessThan(
      text.indexOf("Check these figures with a Veterans Service Officer"),
    );
    expect(text).toContain("Your combined rating is 60%.");
  });
});

const ECFR = "public/legal-index/v0.1.0/chunks/ecfr.jsonl";
const ecfrText = existsSync(ECFR) ? readFileSync(ECFR, "utf8") : "";
const ecfrAvailable =
  ecfrText.length > 0 && !ecfrText.startsWith("version https://git-lfs");

describe.skipIf(!ecfrAvailable)("TDIU quotes against the eCFR index", () => {
  const section416 = ecfrAvailable
    ? ecfrText
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((chunk) => chunk.citation === "38 CFR § 4.16")
        .map((chunk) => chunk.text)
        .join(" ")
        .replace(/\s+/g, " ")
    : "";

  it("finds section 4.16 in the index", () => {
    expect(section416).toContain("Total disability ratings for compensation");
  });

  it.each(Object.entries(TDIU_REGULATION_QUOTES))(
    "%s is verbatim in 38 CFR § 4.16",
    (_key, quote) => {
      expect(section416).toContain(quote);
    },
  );
});
