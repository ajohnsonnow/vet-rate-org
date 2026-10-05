import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkPassageRewrite,
  classifyReplyKind,
  findNewFacts,
} from "../../utils/writerDraftCheck";
import VERDICTS from "./fixtures/writerTranscriptVerdicts.json";

/**
 * The check's building blocks against every writer answer recorded in the
 * first golden-set runs (llm-compiler/logs/golden-set-results). Those runs
 * sent a one-line request with no form inputs, and the model answered with
 * a refusal, a request for information, or a draft full of facts nobody
 * supplied. Each answer is judged for what kind of text it is and whether
 * it states unsupplied facts, and then as if it were offered as a rewording
 * of the request it answered.
 *
 * The verdicts in the fixture were read against the answers by hand. The
 * recorded runs contain no faithful rewording, so they pin the reject side
 * only.
 */
const RESULTS_DIR = join(process.cwd(), "llm-compiler/logs/golden-set-results");

const recorded = Object.entries(VERDICTS).flatMap(([run, byCase]) => {
  const records = new Map(
    readFileSync(join(RESULTS_DIR, `${run}.jsonl`), "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line))
      .filter((record) => record.type === "case")
      .map((record) => [record.id, record]),
  );
  return Object.entries(byCase).map(([id, verdict]) => ({
    name: `${run.slice(4, 21)} ${run.slice(22, 32)} ${id}`,
    verdict,
    input: records.get(id)?.input,
    response: records.get(id)?.response,
  }));
});

const verdictOf = (response) => {
  const kind = classifyReplyKind(response);
  if (kind !== "rewording") return kind;
  return findNewFacts(response, "").length > 0
    ? "draft-with-new-facts"
    : "draft";
};

describe("recorded writer answers", () => {
  it("covers every recorded answer", () => {
    expect(recorded).toHaveLength(120);
    expect(
      recorded.every((answer) => typeof answer.response === "string"),
    ).toBe(true);
  });

  it.each(recorded)("$name is $verdict", ({ response, verdict }) => {
    expect(verdictOf(response)).toBe(verdict);
  });

  it("none is a draft that states no unsupplied fact", () => {
    expect(recorded.filter((answer) => answer.verdict === "draft")).toEqual([]);
  });

  it("none would be accepted as a rewording of the request it answered", () => {
    const accepted = recorded.filter(
      ({ input, response }) =>
        checkPassageRewrite({ original: input, rewrite: response }).status ===
        "accepted",
    );
    expect(accepted.map((answer) => answer.name)).toEqual([]);
  });
});
