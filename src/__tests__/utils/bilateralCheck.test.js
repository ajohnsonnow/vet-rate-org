import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { calculateVARating } from "../../utils/vaCalculator";
import {
  buildReplacementNotice,
  checkRaterResponse,
  describeMismatch,
  findDeniedBilateralClaims,
  findInventedBilateralClaims,
} from "../../utils/raterGrounding";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(
    join(here, "..", "agentic", "eval", "fixtures", "bilateralAnswers.json"),
    "utf8",
  ),
);
const GOLDEN = Object.fromEntries(
  readFileSync(join(here, "..", "agentic", "golden-set.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((c) => [c.id, c]),
);

// The check as it was before the rework, kept here so the "before" half of the
// confusion table stays reproducible from the same fixture.
const LEGACY_NEGATION =
  /\b(?:no|not|none|neither|nor|without|isn't|aren't|doesn't|don't|didn't|cannot|can't|never|n\/a)\b/i;
const legacyMentions = (sentence, name) =>
  Boolean(name) && new RegExp(`\\b${name}\\b`, "i").test(sentence);
function legacyFindInvented(text, calc) {
  const inPair = calc.bilateralConditions.map((c) => c.name);
  const outside = calc.nonBilateralConditions.map((c) => c.name);
  const hits = [];
  for (const raw of String(text).split(/(?<=[.!?])\s+|\n+/)) {
    const sentence = raw.trim();
    if (!/\bbilateral/i.test(sentence) || LEGACY_NEGATION.test(sentence)) {
      continue;
    }
    const touchesOutside = outside.some((n) => legacyMentions(sentence, n));
    if (calc.bilateralConditions.length === 0) {
      if (touchesOutside) hits.push(sentence);
      continue;
    }
    const touchesPair = inPair.some((n) => legacyMentions(sentence, n));
    if (touchesOutside && !touchesPair) hits.push(sentence);
  }
  return hits;
}

const cond = (name, rating, side = "none", bodyPart = name.toLowerCase()) => ({
  name,
  rating,
  side,
  bodyPart,
});
const FOUR = calculateVARating([
  cond("PTSD", 50, "none", "mental"),
  cond("Tinnitus", 30, "none", "ear"),
  cond("Back", 20, "none", "back"),
  cond("Knee", 10, "none", "knee"),
]);
const KNEES = calculateVARating([
  cond("Left knee", 10, "left", "knee"),
  cond("Right knee", 10, "right", "knee"),
  cond("Back", 30, "none", "back"),
]);

const verdict = (fires, positive) => {
  if (positive) return fires ? "tp" : "fn";
  return fires ? "fp" : "tn";
};

describe("bilateral check against every Rater answer in the results folder", () => {
  const confusion = (detect) => {
    const table = { tp: 0, fp: 0, fn: 0, tn: 0 };
    for (const e of FIXTURE) {
      const calc = calculateVARating(GOLDEN[e.caseId].conditions);
      table[verdict(detect(e.text, calc), e.truth !== "ok")]++;
    }
    return table;
  };

  it("covers a11, a12, a13, a24 and a25 in every transcript, responses and replaced drafts", () => {
    expect(FIXTURE).toHaveLength(70);
    expect(new Set(FIXTURE.map((e) => e.caseId))).toEqual(
      new Set(["a11", "a12", "a13", "a24", "a25"]),
    );
    expect(FIXTURE.filter((e) => e.kind === "replaced draft")).toHaveLength(10);
    expect(new Set(FIXTURE.map((e) => e.transcript)).size).toBe(12);
    expect(FIXTURE.filter((e) => e.truth === "fabricates")).toHaveLength(3);
    expect(FIXTURE.filter((e) => e.truth === "denies")).toHaveLength(0);
  });

  it("before: 2 of 3 invented pairs found, 6 correct answers wrongly flagged", () => {
    expect(confusion((t, c) => legacyFindInvented(t, c).length > 0)).toEqual({
      tp: 2,
      fp: 6,
      fn: 1,
      tn: 61,
    });
  });

  it("after: the same 2 found, no correct answer flagged", () => {
    const detect = (t, c) =>
      findInventedBilateralClaims(t, c).length > 0 ||
      findDeniedBilateralClaims(t, c).length > 0;
    expect(confusion(detect)).toEqual({ tp: 2, fp: 0, fn: 1, tn: 67 });
  });

  it.each(FIXTURE)(
    "$transcript $caseId $kind ($truth): $note",
    ({ caseId, text, truth, transcript }) => {
      const calc = calculateVARating(GOLDEN[caseId].conditions);
      const fires = checkRaterResponse(text, calc).inventedPairs.length > 0;
      const knownMiss = truth === "fabricates" && transcript.includes("081228");
      expect(fires).toBe(truth !== "ok" && !knownMiss);
    },
  );

  it("the one fabricated pairing it cannot decide names no condition, so the answer is kept", () => {
    const miss = FIXTURE.find(
      (e) => e.truth === "fabricates" && e.transcript.includes("081228"),
    );
    const calc = calculateVARating(GOLDEN[miss.caseId].conditions);
    expect(miss.text).toContain("since the highest two are paired");
    expect(findInventedBilateralClaims(miss.text, calc)).toEqual([]);
  });
});

describe("what no longer counts as an invented pair", () => {
  it.each([
    [
      "a generic illustration in an answer that found no pair",
      "There are no matching left/right body parts (e.g., left knee and right knee) listed in your input data.",
      FOUR,
    ],
    [
      "an illustration with a dash rule",
      "Per 38 CFR § 4.26, a 10% bilateral factor applies only when two conditions are paired as bilateral extremities (e.g., left knee and right knee).",
      FOUR,
    ],
    [
      "a hypothetical",
      "If you have a rating for both a left knee and a right knee, those two specific ratings would be paired for the bilateral factor.",
      FOUR,
    ],
    [
      "a combination of the formed group with the remaining condition",
      "Next, we combine the bilateral group rating (21%) with your remaining condition (Back, 30%) using the standard VA combined rating table (38 CFR § 4.25).",
      KNEES,
    ],
    [
      "a combination step, back first",
      "Step 1: Combine the Back (30%) with the Bilateral Group (21%).",
      KNEES,
    ],
    ["the non-bilateral label", "Non-Bilateral: Back (30%).", KNEES],
    [
      "the bilateral factor applied to the knees with the back mentioned as separate",
      "This rating reflects the combined effect of your back disability and the bilateral factor applied to your knee disabilities.",
      KNEES,
    ],
    [
      "a negation about the back",
      "The back is not part of this specific bilateral pairing.",
      KNEES,
    ],
    [
      "the correct pair",
      "The bilateral pair is Left knee and Right knee, giving 21%.",
      KNEES,
    ],
    [
      "a pairing sentence that names no condition",
      "Apply the 10% bonus to the remaining 80% (since the highest two are paired).",
      FOUR,
    ],
  ])("%s", (_name, text, calc) => {
    expect(findInventedBilateralClaims(text, calc)).toEqual([]);
    expect(findDeniedBilateralClaims(text, calc)).toEqual([]);
    expect(checkRaterResponse(text, calc).inventedPairs).toEqual([]);
  });

  it("the example, negation and combination sentences each fired the old check", () => {
    for (const [text, calc] of [
      [
        "Per 38 CFR § 4.26, a 10% bilateral factor applies only when two conditions are paired as bilateral extremities (e.g., left knee and right knee).",
        FOUR,
      ],
      [
        "Next, we combine the bilateral group rating (21%) with your remaining condition (Back, 30%) using the standard VA combined rating table (38 CFR § 4.25).",
        KNEES,
      ],
      ["Step 1: Combine the Back (30%) with the Bilateral Group (21%).", KNEES],
    ]) {
      expect(legacyFindInvented(text, calc).length).toBeGreaterThan(0);
    }
  });
});

describe("what still counts as an invented pair", () => {
  it.each([
    [
      "two of the veteran's conditions presented as a pair when none was formed",
      "- **PTSD (Left Brain) + Tinnitus (Right Ear):** This would be a valid bilateral pair.",
      FOUR,
    ],
    [
      "a pair built from other conditions",
      "The bilateral pair is Back and Knee, so the factor applies.",
      FOUR,
    ],
    [
      "the back paired with a knee when the knees were the pair",
      "The bilateral pair is Left knee and Back.",
      KNEES,
    ],
    [
      "the factor applied to the back and a knee",
      "The bilateral factor applies to the Back and the Left knee, which are paired.",
      KNEES,
    ],
  ])("%s", (_name, text, calc) => {
    expect(findInventedBilateralClaims(text, calc)).toHaveLength(1);
    const out = checkRaterResponse(text, calc);
    expect(out.ok).toBe(false);
    expect(describeMismatch(out)).toContain(
      "presented a bilateral pair the calculator did not find",
    );
    expect(buildReplacementNotice(out)).toContain(
      "described a bilateral pairing that did not match Vet-Rate's calculator",
    );
  });
});

describe("denying the pair the calculator formed", () => {
  it.each([
    ["a plain finding", "No bilateral pair applies to your conditions."],
    [
      "naming both knees",
      "Your Left knee and Right knee do not form a bilateral pair.",
    ],
    ["a not-applicable line", "Bilateral factor: not applicable."],
  ])("flags %s", (_name, text) => {
    expect(findDeniedBilateralClaims(text, KNEES)).toHaveLength(1);
    const out = checkRaterResponse(text, KNEES);
    expect(out.ok).toBe(false);
    expect(describeMismatch(out)).toBe(
      "denied the bilateral pair the calculator found",
    );
    expect(buildReplacementNotice(out)).toContain(
      "denied a bilateral pairing that Vet-Rate's calculator found",
    );
    expect(buildReplacementNotice(out)).not.toContain("combined rating that");
  });

  it.each([
    [
      "the same denial when no pair was formed",
      "No bilateral pair applies.",
      FOUR,
    ],
    [
      "a rule stated about the same side",
      "Two conditions on the SAME side are NOT bilateral.",
      KNEES,
    ],
    [
      "a negation about the back",
      "The back is not part of this specific bilateral pairing.",
      KNEES,
    ],
    [
      "an example",
      "A bilateral pair is not formed by, for example, a knee and an ear.",
      KNEES,
    ],
    [
      "a hypothetical",
      "If there is no bilateral pair, the factor is skipped.",
      KNEES,
    ],
  ])("does not flag %s", (_name, text, calc = KNEES) => {
    expect(findDeniedBilateralClaims(text, calc)).toEqual([]);
  });
});

describe("the recorded reason names the sentence a stated figure came from", () => {
  it("quotes the aside that produced the figure", () => {
    const text =
      "Bilateral adds 10%. Total 30%.\nThe calculator block says the group rating is 21%.";
    const out = checkRaterResponse(text, KNEES);
    expect(out.wrongFigures).toEqual([30]);
    expect(describeMismatch(out)).toBe(
      'stated combined rating 30% but the calculator gives 50% (from: "Total 30%.")',
    );
  });

  it("the real aside in the 4B transcript is quoted, not just the number", () => {
    const row = FIXTURE.find(
      (e) =>
        e.transcript.includes("123216") &&
        e.caseId === "a12" &&
        e.kind === "replaced draft",
    );
    const out = checkRaterResponse(row.text, KNEES);
    expect(describeMismatch(out)).toBe(
      'stated combined rating 30% but the calculator gives 50% (from: "Total 30%.")',
    );
  });
});
