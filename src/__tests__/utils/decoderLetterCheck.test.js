/**
 * A narrow check on the Decision Decoder's "missing" list: an element that
 * names a legal theory the decision letter never mentions. In the final-build
 * run the decoder told a veteran that evidence of "aggravation" was missing
 * from a letter that raises no aggravation question.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { findUnmentionedTheories } from "../../utils/decoderLetterCheck";
import { withVerifiedReviewOptions } from "../../utils/reviewOptions";

const LETTER = readFileSync(
  "src/__tests__/agentic/fixtures/fictional-decision-letter.txt",
  "utf8",
);
const AGGRAVATION =
  "Evidence showing the knee condition worsened after the service event (aggravation)";
const FINAL_RUN_MISSING = [
  "Medical evidence or opinion linking the current left knee strain to the service training march",
  AGGRAVATION,
  "Medical records or statements showing continued knee complaints after the initial service visit to support the nexus",
];

describe("findUnmentionedTheories", () => {
  it("flags the aggravation element the fictional letter never raises", () => {
    expect(
      findUnmentionedTheories({ missing_elements: FINAL_RUN_MISSING }, LETTER),
    ).toEqual([
      {
        field: "missing_elements",
        rule: "missing-element-not-in-letter",
        note: `Vet-Rate check: this list names "${AGGRAVATION}" as missing, but the decision letter does not mention aggravation. Read the letter's reasons for the decision before gathering evidence for it.`,
      },
    ]);
  });

  it("leaves the elements the letter does speak to alone", () => {
    expect(
      findUnmentionedTheories(
        { missing_elements: [FINAL_RUN_MISSING[0], FINAL_RUN_MISSING[2]] },
        LETTER,
      ),
    ).toEqual([]);
  });

  it.each([
    [
      "aggravation",
      "The evidence does not show the condition was aggravated by service.",
    ],
    ["aggravation", "There is no evidence the knee worsened during service."],
    [
      "presumption",
      "The condition is not one for which service connection is presumed.",
    ],
    [
      "secondary",
      "Service connection as secondary to the back condition is denied.",
    ],
    ["stressor", "The claimed stressor could not be verified."],
  ])("does not flag %s when the letter raises it", (_theory, sentence) => {
    const missing = [
      "Evidence of aggravation",
      "Evidence that a presumptive condition applies",
      "A nexus opinion for secondary service connection",
      "A verified stressor",
    ];
    const hits = findUnmentionedTheories(
      { missing_elements: missing },
      `${LETTER}\n${sentence}`,
    );
    expect(hits.map((h) => h.note).join(" ")).not.toContain(
      `does not mention ${_theory === "presumption" ? "a presumption" : _theory}`,
    );
  });
});

describe("findUnmentionedTheories limits", () => {
  it("names each unmentioned theory once", () => {
    const hits = findUnmentionedTheories(
      {
        missing_elements: [
          "Evidence of aggravation",
          "More evidence the condition was aggravated",
          "A verified stressor",
        ],
      },
      LETTER,
    );
    expect(hits.map((h) => h.note.split("does not mention ")[1])).toEqual([
      "aggravation. Read the letter's reasons for the decision before gathering evidence for it.",
      "a stressor. Read the letter's reasons for the decision before gathering evidence for it.",
    ]);
  });

  it("checks only the missing list, and only against a real document", () => {
    expect(
      findUnmentionedTheories({ action_plan: ["Show aggravation."] }, LETTER),
    ).toEqual([]);
    expect(
      findUnmentionedTheories({ missing_elements: [AGGRAVATION] }, ""),
    ).toEqual([]);
    expect(
      findUnmentionedTheories({ missing_elements: [AGGRAVATION] }, undefined),
    ).toEqual([]);
    expect(
      findUnmentionedTheories({ missing_elements: "none" }, LETTER),
    ).toEqual([]);
  });
});

describe("withVerifiedReviewOptions with the letter", () => {
  it("adds the letter check to the corrections for the missing list", () => {
    const out = withVerifiedReviewOptions(
      { missing_elements: FINAL_RUN_MISSING },
      { documentText: LETTER },
    );
    expect(out.review_corrections.map((c) => [c.field, c.rule])).toEqual([
      ["missing_elements", "missing-element-not-in-letter"],
    ]);
  });

  it("adds nothing when no letter is passed", () => {
    expect(
      withVerifiedReviewOptions({ missing_elements: FINAL_RUN_MISSING }),
    ).not.toHaveProperty("review_corrections");
  });
});

describe("the letter check over every recorded Decision Decoder answer", () => {
  const DIR = "llm-compiler/logs/golden-set-results";
  const decoded = readdirSync(DIR)
    .filter((name) => name.endsWith(".jsonl"))
    .sort((a, b) => a.localeCompare(b))
    .flatMap((name) =>
      readFileSync(path.join(DIR, name), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((r) => r.type === "case" && r.id === "t08" && r.response)
        .map((r) => ({
          run: name.slice(15, 21),
          data: JSON.parse(r.response),
        })),
    );

  it("reads the recorded t08 answers", () => {
    expect(decoded.map((d) => d.run)).toEqual([
      "213230",
      "221648",
      "230321",
      "231514",
    ]);
  });

  it("flags only the invented aggravation element", () => {
    const flagged = decoded.flatMap((d) =>
      findUnmentionedTheories(d.data, LETTER).map(
        (hit) => `${d.run} ${hit.note.split('"')[1]}`,
      ),
    );
    expect(flagged).toEqual([`230321 ${AGGRAVATION}`]);
  });
});
