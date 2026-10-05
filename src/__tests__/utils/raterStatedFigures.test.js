import { describe, it, expect } from "vitest";
import { calculateVARating } from "../../utils/vaCalculator";
import {
  buildReplacementNotice,
  checkRaterResponse,
  checkTdiuConclusion,
  describeMismatch,
} from "../../utils/raterGrounding";
import { GOLDEN, raterAnswers } from "./recordedAnswers";

const single60 = calculateVARating(GOLDEN.a25.conditions);
const four = calculateVARating(GOLDEN.a11.conditions);

describe("figures that are not a statement of this veteran's combined rating", () => {
  it.each([
    [
      "a threshold the answer says is not reached",
      "You do not meet the threshold for the second option (combined rating of 70%).",
      single60,
    ],
    [
      "a threshold the answer says is needed",
      "The second threshold requires a combined rating of 70%.",
      single60,
    ],
    [
      "a what-if",
      "(e.g., adding a 10% condition to your 60% would result in a combined rating of 66%, which is still insufficient.",
      single60,
    ],
    [
      "another what-if",
      "If you had a second condition at 30%, your combined rating would be 70%.",
      single60,
    ],
    [
      "a list of the ratings entered",
      "The combined ratings are 50% for PTSD, 30% for tinnitus, 20% for back pain, and 10% for knee pain.",
      four,
    ],
  ])("ignores %s", (_name, text, calc) => {
    expect(checkRaterResponse(text, calc).wrongFigures).toEqual([]);
  });

  it.each([
    [
      "a wrong rating beside a threshold word",
      "Your combined rating is 70%, which meets the threshold.",
      single60,
      [70],
    ],
    [
      "a wrong rating in a sentence that denies a threshold",
      "You do not meet the 70% threshold because your combined rating is 50%.",
      single60,
      [50],
    ],
    [
      "a wrong final rating",
      "Therefore, the final combined disability rating is **70%**.",
      four,
      [70],
    ],
  ])("still reports %s", (_name, text, calc, wrong) => {
    expect(checkRaterResponse(text, calc).wrongFigures).toEqual(wrong);
  });
});

describe("case a25 in run 135040: the notice names only what fired", () => {
  const a25 = raterAnswers().find(
    (a) => a.run === "2026-10-05_135040" && a.id === "a25",
  );
  const check = checkRaterResponse(a25.text, a25.calc);
  const tdiuCheck = checkTdiuConclusion(a25.text, a25.calc);

  it("the draft states 60% and no other combined rating", () => {
    expect(check.stated).toEqual([60]);
    expect(check.wrongFigures).toEqual([]);
  });

  it("the notice gives the TDIU conclusion as the only reason", () => {
    expect(tdiuCheck.contradicted).toBe(true);
    expect(buildReplacementNotice(check, tdiuCheck)).toBe(
      "The AI's draft answer gave a TDIU conclusion that did not match the percentage thresholds of 38 CFR § 4.16(a) applied to the ratings you entered, so it is not shown. This is the calculator's working for the ratings you entered.",
    );
    expect(describeMismatch(check, tdiuCheck)).not.toContain(
      "stated combined rating",
    );
  });
});

describe("combined-rating figures reported over every recorded Rater answer", () => {
  const BEFORE_ONLY = [
    ["2026-10-05_135040", "a25", [70, 66]],
    ["2026-10-05_201248", "a11", [50]],
  ];
  const AFTER = [
    ["2026-10-05_071859", "a11", [70]],
    ["2026-10-05_071859", "a13", [100]],
    ["2026-10-05_074624", "a11", [70]],
    ["2026-10-05_074624", "a12", [58.1, 58]],
    ["2026-10-05_074624", "a13", [99]],
    ["2026-10-05_081228", "a11", [0]],
    ["2026-10-05_081228", "a12", [20, 60]],
    ["2026-10-05_090513", "a12", [52]],
    ["2026-10-05_094601", "a12", [52]],
    ["2026-10-05_123216", "a12", [30]],
    ["2026-10-05_141236", "a13", [60]],
    ["2026-10-05_201248", "a11", [70]],
    ["2026-10-05_201248", "a12", [20, 4.5]],
  ];

  it("3 figures in 2 answers were not statements of the rating; none is reported now and every other one still is", () => {
    const reported = raterAnswers()
      .map((a) => [
        a.run,
        a.id,
        checkRaterResponse(a.text, a.calc).wrongFigures,
      ])
      .filter(([, , wrong]) => wrong.length > 0);
    expect(reported).toEqual(AFTER);
    expect(BEFORE_ONLY.flatMap(([, , figures]) => figures)).toHaveLength(3);
  });
});
