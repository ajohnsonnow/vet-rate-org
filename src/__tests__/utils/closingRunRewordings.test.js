/**
 * The passage check against every rewording it accepted in the four closing
 * real-model runs. Each was read against its passage by hand and judged
 * faithful or unfaithful (fixtures/closingRunRewordings.json). The check
 * accepted all 29, 13 of them unfaithful. The strict check must accept no
 * unfaithful one; a faithful one it turns down costs polish, not truth.
 */
import { describe, it, expect } from "vitest";
import { checkPassageRewrite } from "../../utils/writerDraftCheck";
import { formStatementPlan, selectPassages } from "../../utils/writerTemplates";
import FIXTURE from "./fixtures/closingRunRewordings.json";

const { rewordings } = FIXTURE;
const verdict = (row) =>
  checkPassageRewrite({ original: row.before, rewrite: row.after });
const count = (rows) => ({
  accepted: rows.filter((row) => verdict(row).status === "accepted").length,
  rejected: rows.filter((row) => verdict(row).status === "rejected").length,
});
const veteran = rewordings.filter((row) => row.writer === "veteran");
const witness = rewordings.filter((row) => row.writer === "witness");

describe("what the check accepted before", () => {
  it("was 29 rewordings, 13 of them unfaithful", () => {
    expect(rewordings).toHaveLength(29);
    expect(
      rewordings.filter((row) => row.judgement === "unfaithful"),
    ).toHaveLength(13);
    expect(veteran).toHaveLength(19);
    expect(
      veteran.filter((row) => row.judgement === "unfaithful"),
    ).toHaveLength(7);
    expect(
      witness.filter((row) => row.judgement === "unfaithful"),
    ).toHaveLength(6);
  });
});

describe("the strict check on the same rewordings", () => {
  it.each(rewordings)(
    "$run $id passage $number ($judgement) is $expected: $after",
    (row) => {
      const result = verdict(row);

      expect([result.status, result.reasons]).toEqual([
        row.expected,
        row.expected === "accepted" ? [] : expect.any(Array),
      ]);
      if (row.expected === "rejected") {
        expect(result.text).toBe(row.before);
        expect(result.reasons.length).toBeGreaterThan(0);
      }
    },
  );

  it("accepts no unfaithful rewording", () => {
    const wronglyAccepted = rewordings.filter(
      (row) =>
        row.judgement === "unfaithful" && verdict(row).status === "accepted",
    );
    expect(wronglyAccepted).toEqual([]);
  });

  it("still accepts 10 of the veteran's 12 faithful rewordings, and rejects all 7 unfaithful", () => {
    expect(count(veteran)).toEqual({ accepted: 10, rejected: 9 });
    expect(
      count(veteran.filter((row) => row.judgement === "faithful")),
    ).toEqual({ accepted: 10, rejected: 2 });
    expect(
      count(veteran.filter((row) => row.judgement === "unfaithful")),
    ).toEqual({ accepted: 0, rejected: 7 });
  });

  it("would reject every witness rewording, though none is sent any more", () => {
    expect(count(witness)).toEqual({ accepted: 0, rejected: 10 });
    const buddy = formStatementPlan("buddy-statement", {
      whatObserved: witness.find((row) => row.id === "t10").before,
    });
    expect(selectPassages(buddy)).toEqual([]);
  });
});
