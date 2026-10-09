/**
 * QA's second adversarial review. 90 true sentences written the way a
 * careful explainer writes ("Myth: ...", "A common mistake is ...", "Some
 * say ..., in fact ..."), 72 of which drew a block when the review was made:
 * none may. And 24 wrong sentences that carry a word the guard reads; 17 of
 * them were silenced only by an incidental "my", "he", "said" or an older
 * year, and those should fire.
 */
import { describe, it, expect } from "vitest";
import { flagContradictions } from "../../utils/contradictionCheck";
import review from "./fixtures/correctionRuleReview2.json";

const rulesFiredOn = (entry) =>
  flagContradictions(
    { text: entry.text },
    { toolId: entry.toolId, dataClass: "context" },
    entry.question,
  ).contradictionsFound?.map((hit) => hit.rule) ?? [];

describe("QA's 90 fresh true sentences", () => {
  it("are all here", () => {
    expect(review.true).toHaveLength(90);
    expect(review.wrong).toHaveLength(24);
  });

  it("draw no block from any rule", () => {
    const fired = review.true
      .map((entry) => ({ entry, rules: rulesFiredOn(entry) }))
      .filter(({ rules }) => rules.length > 0)
      .map(({ entry, rules }) => `${rules.join(",")} | ${entry.text}`);
    expect(fired).toEqual([]);
  });
});

describe("QA's wrong sentences with an incidental guard word", () => {
  const incidental = review.wrong.filter((e) => e.incidentalGuardWord);

  it("are the 17 the review named", () => {
    expect(incidental).toHaveLength(17);
  });

  it("are caught again", () => {
    const missed = incidental
      .filter((entry) => rulesFiredOn(entry).length === 0)
      .map((entry) => entry.text);
    expect(missed).toEqual([]);
  });

  it("does not lose the four that were caught before", () => {
    const stillCaught = review.wrong
      .filter((entry) => entry.firedInReview)
      .filter((entry) => rulesFiredOn(entry).length > 0);
    expect(stillCaught).toHaveLength(4);
  });
});
