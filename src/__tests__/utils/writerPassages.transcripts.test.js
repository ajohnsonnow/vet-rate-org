/**
 * The passage check against every passage of t01 to t06 in the six
 * real-model runs recorded since passage rewording landed
 * (llm-compiler/logs/golden-set-results). This is the first real data for
 * the accept side: 90 passages, of which the model reworded 13 and returned
 * 77 as they were.
 *
 * Each rewording in the fixture was read against its passage by hand and
 * judged for whether it adds, drops or changes a fact. All 13 are faithful,
 * so all 13 must be accepted. The runs hold no unfaithful rewording, so they
 * do not exercise the reject side; writerPassages.test.js does.
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
        ...checkPassageRewrite({ original: before, rewrite: rewrites[i] }),
      }));
    }),
);

describe("passages in the recorded real-model runs", () => {
  it("covers every passage of t01 to t06 in six runs", () => {
    expect(rows).toHaveLength(90);
    expect(rows.every((row) => typeof row.after === "string")).toBe(true);
  });

  it("accepts every rewording judged faithful, and rejects nothing", () => {
    const count = (status) => rows.filter((r) => r.status === status).length;
    expect({
      accepted: count("accepted"),
      unchanged: count("unchanged"),
      rejected: count("rejected"),
    }).toEqual({ accepted: 13, unchanged: 77, rejected: 0 });
  });

  it.each(FIXTURE.rewordings)(
    "$run $id passage $number: $after",
    ({ run, id, number, before, after, judgement }) => {
      const row = rows.find(
        (r) => r.run === run && r.id === id && r.number === number,
      );
      expect(row).toMatchObject({ before, after, status: "accepted" });
      expect(judgement).toBe("faithful");
    },
  );

  it("the fixture lists every rewording there is", () => {
    expect(rows.filter((r) => r.status !== "unchanged")).toHaveLength(
      FIXTURE.rewordings.length,
    );
  });
});
