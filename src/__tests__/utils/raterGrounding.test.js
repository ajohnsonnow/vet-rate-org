import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { calculateVARating } from "../../utils/vaCalculator";
import {
  buildCalculatorExplanation,
  buildTdiuThresholdParagraph,
  mentionsUnemployability,
  TDIU_REGULATION_QUOTES,
  formatCalculatorWorking,
} from "../../utils/raterGrounding";

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
    expect(text).toContain("  Group rating: 48.4 rounds to 48%");
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

describe("buildCalculatorExplanation", () => {
  it("states the calculator's figure and working, and nothing about a draft or a model", () => {
    const calc = calculateVARating(FOUR);
    const text = buildCalculatorExplanation(calc);
    expect(text.startsWith("Your combined rating is 80%.")).toBe(true);
    expect(text).not.toMatch(/draft|AI|model/);
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
