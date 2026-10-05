/**
 * The contradiction rules over every recorded evaluation answer. Each hit
 * listed here was read by hand and is a real contradiction of the verified
 * text; a new hit on these runs is either a new false positive or a rule
 * that got better, and has to be read before the list changes.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { findContradictions } from "../../utils/contradictionCheck";
import { detectReferenceTopics } from "../../utils/verifiedReference";

const TRANSCRIPT_DIR = "llm-compiler/logs/golden-set-results";
const LAST_REVIEWED_RUN = "run_2026-10-05_210108";
const ALL_TOPICS = [
  "secondary",
  "toxic-exposure",
  "herbicide",
  "pact-act",
  "tdiu",
  "decision-review",
  "supplemental",
  "next-claim-step",
];

const golden = Object.fromEntries(
  readFileSync("src/__tests__/agentic/golden-set.jsonl", "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((c) => [c.id, c]),
);

function shownAnswers() {
  return readdirSync(TRANSCRIPT_DIR)
    .filter((name) => name.endsWith(".jsonl"))
    .filter(
      (name) => name.slice(0, LAST_REVIEWED_RUN.length) <= LAST_REVIEWED_RUN,
    )
    .sort((a, b) => a.localeCompare(b))
    .flatMap((name) =>
      readFileSync(path.join(TRANSCRIPT_DIR, name), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((r) => r.type === "case" && !r.calculatorReplacement)
        .map((r) => ({ run: name.slice(15, 21), ...r })),
    );
}

const conditionsOf = (record) => golden[record.id]?.conditions ?? null;

function hitsFor(record, topics) {
  const conditions = conditionsOf(record);
  return findContradictions(record.response, {
    topics,
    hasConditions: Array.isArray(conditions) && conditions.length > 0,
  }).map((hit) => `${record.run} ${record.id} ${hit.rule}`);
}

describe("contradiction rules over the recorded evaluation answers", () => {
  const answers = shownAnswers();

  it("reads every answer that was shown to the user", () => {
    expect(answers).toHaveLength(508);
  });

  it("flags only real contradictions, each on the topic of its own question", () => {
    const flagged = answers.flatMap((record) =>
      hitsFor(
        record,
        detectReferenceTopics(record.input, record.toolId, {
          conditions: conditionsOf(record),
        }),
      ),
    );
    expect(flagged).toEqual([
      "071859 a13 tdiu-from-percentages",
      "071859 a16 presumptive-needs-exposure-proof",
      "071859 a18 higher-level-review-new-evidence",
      "074624 a13 tdiu-from-percentages",
      "081228 a25 tdiu-from-percentages",
      "090513 a16 presumptive-needs-exposure-proof",
      "094601 a16 presumptive-needs-exposure-proof",
      "094601 a26 higher-level-review-new-evidence",
      "124154 a13 tdiu-from-percentages",
      "125630 a25 tdiu-from-percentages",
      "135040 a13 tdiu-from-percentages",
      "135040 a29 secondary-barred",
      "201248 a13 tdiu-from-percentages",
      "210108 a13 tdiu-from-percentages",
      "210108 a27 presumptive-needs-proof",
      "210108 a29 secondary-barred",
    ]);
  });

  it("flags nothing more when every rule is applied to every answer", () => {
    const flagged = answers.flatMap((record) => hitsFor(record, ALL_TOPICS));
    expect(flagged).toHaveLength(16);
  });
});
