/**
 * The passage check against every passage of t01 to t06 in the six
 * real-model runs recorded since passage rewording landed
 * (llm-compiler/logs/golden-set-results). This is the first real data for
 * the accept side: 90 passages, of which the model reworded 13 and returned
 * 77 as they were.
 *
 * Each rewording in the fixture was read against its passage by hand and
 * judged for whether it adds, drops or changes a fact. All 13 are faithful
 * to the facts. Six of them turn "They" into "The veteran", which would
 * leave one statement calling the same person both; those six are rejected
 * for that and for nothing else, and the other seven are accepted. The runs
 * hold no rewording that is unfaithful to the facts, so they do not
 * exercise that side; writerPassages.test.js does.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOL_ENTRIES } from "../../../scripts/eval/lib/toolEntries.js";
import { stripReasoning } from "../../utils/reasoningText";
import {
  checkPassageRewrite,
  parsePassageReply,
} from "../../utils/writerDraftCheck";
import FIXTURE from "./fixtures/passageRewordings.json";

const RESULTS_DIR = join(process.cwd(), "llm-compiler/logs/golden-set-results");
const GOLDEN = new Map(
  readFileSync(
    join(process.cwd(), "src/__tests__/agentic/golden-set.jsonl"),
    "utf8",
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((caseDef) => [caseDef.id, caseDef]),
);

const rows = FIXTURE.runs.flatMap((run) =>
  readFileSync(join(RESULTS_DIR, `${run}.jsonl`), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((record) => record.type === "case" && /^t0[1-6]$/.test(record.id))
    .flatMap((record) => {
      const draft = TOOL_ENTRIES[GOLDEN.get(record.id).entry].draft(
        record.formInputs,
      );
      const reply = stripReasoning(record.rawResponse ?? "").text;
      const rewrites = parsePassageReply(reply, draft.passages.length);
      return draft.passages.map((before, i) => ({
        run,
        id: record.id,
        number: i + 1,
        before,
        after: rewrites[i],
        ...checkPassageRewrite({
          original: before,
          rewrite: rewrites[i],
          voice: draft.voice,
        }),
      }));
    }),
);

describe("passages in the recorded real-model runs", () => {
  it("covers every passage of t01 to t06 in six runs", () => {
    expect(rows).toHaveLength(90);
    expect(rows.every((row) => typeof row.after === "string")).toBe(true);
  });

  it("accepts the rewordings that keep the writer's pronouns, and rejects the six that do not", () => {
    const count = (status) => rows.filter((r) => r.status === status).length;
    expect({
      accepted: count("accepted"),
      unchanged: count("unchanged"),
      rejected: count("rejected"),
    }).toEqual({ accepted: 7, unchanged: 77, rejected: 6 });
  });

  it.each(FIXTURE.rewordings)(
    "$run $id passage $number is $expected: $after",
    ({ run, id, number, before, after, expected, judgement }) => {
      const row = rows.find(
        (r) => r.run === run && r.id === id && r.number === number,
      );
      expect(row).toMatchObject({ before, after, status: expected });
      expect(judgement).toBe("faithful");
      if (expected === "rejected") {
        expect(row.reasons).toEqual([
          'refers to people differently from the passage: "they" is gone, "veteran" is new',
        ]);
      }
    },
  );

  it("the fixture lists every rewording there is", () => {
    expect(rows.filter((r) => r.status !== "unchanged")).toHaveLength(
      FIXTURE.rewordings.length,
    );
  });
});
