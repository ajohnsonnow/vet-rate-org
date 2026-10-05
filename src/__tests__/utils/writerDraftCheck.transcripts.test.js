import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkWriterDraft } from "../../utils/writerDraftCheck";
import {
  buildBuddyStatementTemplate,
  buildNexusLetterRequestTemplate,
  buildPersonalStatementTemplate,
} from "../../utils/writerTemplates";
import VERDICTS from "./fixtures/writerTranscriptVerdicts.json";

/**
 * The check against every writer answer recorded in the golden-set runs
 * (llm-compiler/logs/golden-set-results). Those runs sent a one-line
 * request and no form inputs, so each answer is judged twice: on its own
 * (is it a draft, does it state facts nobody supplied), and as if it were
 * the reply to its tool's app-built draft for an empty form.
 *
 * The verdicts in the fixture were read against the answers by hand. The
 * recorded runs contain no faithful rewording of an app-built draft, so
 * they pin the reject side only.
 */
const RESULTS_DIR = join(process.cwd(), "llm-compiler/logs/golden-set-results");

const NEXUS = [buildNexusLetterRequestTemplate({}), true];
const PERSONAL = [buildPersonalStatementTemplate({}, ""), false];
const BUDDY = [buildBuddyStatementTemplate({}, ""), false];
const TEMPLATE_FOR_CASE = {
  a06: NEXUS,
  a20: NEXUS,
  a29: NEXUS,
  a07: PERSONAL,
  a08: PERSONAL,
  a09: BUDDY,
  a10: BUDDY,
  a23: BUDDY,
};

const recorded = Object.entries(VERDICTS).flatMap(([run, byCase]) => {
  const answers = new Map(
    readFileSync(join(RESULTS_DIR, `${run}.jsonl`), "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line))
      .filter((record) => record.type === "case")
      .map((record) => [record.id, record.response]),
  );
  return Object.entries(byCase).map(([id, verdict]) => ({
    name: `${run.slice(4, 21)} ${run.slice(22, 32)} ${id}`,
    id,
    verdict,
    response: answers.get(id),
  }));
});

const verdictOf = (response) => {
  const result = checkWriterDraft({ output: response });
  if (result.kind !== "draft") return result.kind;
  return result.newFacts.length > 0 ? "draft-with-new-facts" : "draft";
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

  it("only one is a draft that states no unsupplied fact", () => {
    expect(
      recorded
        .filter((answer) => answer.verdict === "draft")
        .map((a) => a.name),
    ).toEqual(["2026-10-05_081228 Qwen2.5-3B a09"]);
  });

  it("none would replace its tool's app-built draft", () => {
    const accepted = recorded.filter(({ id, response }) => {
      const [template, addressedToReader] = TEMPLATE_FOR_CASE[id];
      return checkWriterDraft({ output: response, template, addressedToReader })
        .accepted;
    });
    expect(accepted.map((answer) => answer.name)).toEqual([]);
  });
});
