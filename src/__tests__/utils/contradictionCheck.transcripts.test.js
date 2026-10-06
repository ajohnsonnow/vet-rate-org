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
const LAST_REVIEWED_RUN = "run_2026-10-06_015232";
const ALL_TOPICS = [
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
const isDecoderCase = (record) => golden[record.id]?.entry === "decodeDecision";

// The rule that runs on every answer is measured over every response, with
// its own pinned list, in contradictionCheck.ratings.test.js.
const EVERY_ANSWER_RULE = "ratings-added-together";

function hitsFor(record, topics) {
  const conditions = conditionsOf(record);
  return findContradictions(record.response, {
    topics,
    hasConditions: Array.isArray(conditions) && conditions.length > 0,
  })
    .filter((hit) => hit.rule !== EVERY_ANSWER_RULE)
    .map((hit) => `${record.run} ${record.id} ${hit.rule}`);
}

function decoderFieldHits(record) {
  const decoded = JSON.parse(record.response);
  return Object.entries(decoded).flatMap(([field, value]) =>
    [value]
      .flat()
      .filter((text) => typeof text === "string")
      .flatMap((text) => findContradictions(text, { topics: ALL_TOPICS }))
      .map((hit) => `${record.run} ${record.id} ${field} ${hit.rule}`),
  );
}

describe("contradiction rules over the recorded evaluation answers", () => {
  const answers = shownAnswers();
  const prose = answers.filter((record) => !isDecoderCase(record));

  it("reads every answer that was shown to the user", () => {
    expect(answers).toHaveLength(884);
    expect(prose).toHaveLength(873);
  });

  it("flags only real contradictions, each on the topic of its own question", () => {
    const flagged = prose.flatMap((record) =>
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
      "074624 a13 tdiu-from-percentages",
      "074624 a27 presumptive-needs-exposure-proof",
      "081228 a16 presumptive-needs-exposure-proof",
      "081228 a25 tdiu-from-percentages",
      "090513 a16 presumptive-needs-exposure-proof",
      "094601 a16 presumptive-needs-exposure-proof",
      "094601 a26 higher-level-review-new-evidence",
      "110055 a26 new-and-material-standard",
      "124154 a13 tdiu-from-percentages",
      "125630 a25 tdiu-from-percentages",
      "125630 a26 new-and-material-standard",
      "135040 a13 tdiu-from-percentages",
      "135040 a16 presumptive-needs-exposure-proof",
      "135040 a26 new-and-material-standard",
      "135040 a26 intent-to-file-for-filed-claim",
      "135040 a29 secondary-barred",
      "135908 a26 new-and-material-standard",
      "201248 a13 tdiu-from-percentages",
      "210108 a13 tdiu-from-percentages",
      "210108 a16 coverage-date-for-wrong-place",
      "210108 a26 new-and-material-standard",
      "210108 a26 intent-to-file-for-filed-claim",
      "210108 a27 presumptive-needs-proof",
      "210108 a29 secondary-barred",
      "221648 a26 new-and-material-standard",
      "221648 a26 intent-to-file-for-filed-claim",
      "230321 a26 intent-to-file-for-filed-claim",
      "000014 a26 form-for-another-filing",
      "000820 a16 coverage-date-for-wrong-place",
      "000820 a26 intent-to-file-for-filed-claim",
      "000820 a27 presumptive-needs-exposure-proof",
      "002046 a26 intent-to-file-for-filed-claim",
      "002046 a27 presumptive-needs-exposure-proof",
      "002046 a29 secondary-barred",
      "013549 a26 intent-to-file-for-filed-claim",
      "015232 a26 intent-to-file-for-filed-claim",
    ]);
  });
});

describe("contradiction rules outside the topic of the question", () => {
  const answers = shownAnswers();
  const prose = answers.filter((record) => !isDecoderCase(record));

  it("no longer reaches four real a18 contradictions, because a18 raises no topic", () => {
    const a18 = prose
      .filter((record) => record.id === "a18")
      .flatMap((record) => hitsFor(record, ALL_TOPICS));
    expect(a18).toEqual([
      "071859 a18 higher-level-review-new-evidence",
      "074624 a18 form-for-another-filing",
      "105010 a18 new-and-material-standard",
      "110822 a18 new-and-material-standard",
    ]);
  });

  it("would misfire on quoted legacy decisions if a rule ran outside its topic", () => {
    const outside = prose
      .flatMap((record) => hitsFor(record, ALL_TOPICS))
      .filter((hit) => hit.includes(" a28 "));
    expect(outside).toEqual([
      "071859 a28 new-and-material-standard",
      "074624 a28 new-and-material-standard",
      "090513 a28 new-and-material-standard",
      "094601 a28 new-and-material-standard",
    ]);
  });

  it("flags the wrong filing instructions in the Decision Decoder's own fields", () => {
    const flagged = answers.filter(isDecoderCase).flatMap(decoderFieldHits);
    expect(flagged).toEqual([
      "213230 t08 action_plan files-statement-of-the-case",
      "213230 t08 action_plan higher-level-review-at-the-board",
      "213230 t08 appeal_options files-statement-of-the-case",
      "221648 t08 deadline_warning supplemental-claim-deadline",
      "231514 t08 action_plan form-for-another-filing",
      "000014 t08 deadline_warning review-period-from-wrong-day",
      "002046 t08 action_plan higher-level-review-new-evidence",
      "002046 t08 action_plan higher-level-review-hearing",
      "014319 t08 action_plan review-period-from-wrong-day",
    ]);
  });
});
