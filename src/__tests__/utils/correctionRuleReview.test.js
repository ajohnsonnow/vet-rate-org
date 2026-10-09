/**
 * QA's adversarial review of the correction rules: 180 sentences that are
 * true, or a question, or a veteran's own account, written to sit close to
 * each rule's pattern. 106 of them drew a correction when the review was
 * made. No rule may fire on any of them. The recorded true hits the rules
 * must still catch are pinned in contradictionCheck.transcripts.test.js.
 */
import { describe, it, expect } from "vitest";
import { findContradictions } from "../../utils/contradictionCheck";
import { detectReferenceTopics } from "../../utils/verifiedReference";
import { withVerifiedReviewOptions } from "../../utils/reviewOptions";
import review from "./fixtures/correctionRuleReview.json";

const topicsFor = (entry) =>
  entry.topics ??
  detectReferenceTopics(entry.question ?? "", entry.toolId, {
    dataClass: "context",
  });

const rulesFiredOn = (entry) =>
  findContradictions(entry.sentence, {
    topics: topicsFor(entry),
    question: entry.question ?? "",
  }).map((hit) => hit.rule);

describe("QA's must-not-fire sentences", () => {
  it("are all here", () => {
    expect(review.sentences).toHaveLength(180);
    expect(review.sentences.filter((e) => e.firedInReview)).toHaveLength(106);
  });

  it("draw no correction from any rule", () => {
    const fired = review.sentences
      .map((entry) => ({ entry, rules: rulesFiredOn(entry) }))
      .filter(({ rules }) => rules.length > 0)
      .map(({ entry, rules }) => `${rules.join(",")} | ${entry.sentence}`);
    expect(fired).toEqual([]);
  });

  it("draw none with every topic on either, for the rule each was written against", () => {
    const EVERY_TOPIC = [
      "secondary",
      "toxic-exposure",
      "herbicide",
      "pact-act",
      "tdiu",
      "decision-review",
      "supplemental",
      "next-claim-step",
      "intent-to-file",
    ];
    const fired = review.sentences
      .filter((entry) => entry.rule !== "any" && !entry.question)
      .filter((entry) =>
        findContradictions(entry.sentence, { topics: EVERY_TOPIC }).some(
          (hit) => hit.rule === entry.rule,
        ),
      )
      .map((entry) => `${entry.rule} | ${entry.sentence}`);
    expect(fired).toEqual([]);
  });

  it("draw no note beside a Decision Decoder field", () => {
    expect(
      withVerifiedReviewOptions(review.decoderFields).review_corrections,
    ).toBeUndefined();
  });
});
