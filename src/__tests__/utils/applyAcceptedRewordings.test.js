/**
 * An accepted rewording is put into the text the veteran has on screen, in
 * place of the passage it rewords. Everything else in the box, edits
 * included, stays as it is.
 */
import { describe, it, expect } from "vitest";
import { applyAcceptedRewordings } from "../../utils/writerDraftCheck";

const BOX = [
  "Effect on my work: I miss two shifts a month.",
  "A line I typed myself.",
  "Effect on my family: stopped coaching.",
].join("\n");

describe("applyAcceptedRewordings", () => {
  it("replaces each accepted passage where it stands and keeps the rest", () => {
    const { text, applied } = applyAcceptedRewordings(BOX, [
      {
        before: "I miss two shifts a month",
        after: "I miss about two shifts each month.",
        verdict: "accepted",
      },
      { before: "stopped coaching", after: "x", verdict: "rejected" },
    ]);

    expect(applied).toBe(1);
    expect(text).toBe(
      [
        "Effect on my work: I miss about two shifts each month.",
        "A line I typed myself.",
        "Effect on my family: stopped coaching.",
      ].join("\n"),
    );
  });

  it("leaves alone a passage the veteran has since changed in the box", () => {
    const { text, applied } = applyAcceptedRewordings(BOX, [
      {
        before: "I miss three shifts a month",
        after: "I miss three shifts each month.",
        verdict: "accepted",
      },
    ]);

    expect(applied).toBe(0);
    expect(text).toBe(BOX);
  });

  it("changes nothing when there is nothing accepted", () => {
    expect(applyAcceptedRewordings(BOX, [])).toEqual({ text: BOX, applied: 0 });
    expect(applyAcceptedRewordings(BOX)).toEqual({ text: BOX, applied: 0 });
    expect(
      applyAcceptedRewordings(BOX, [
        { before: "stopped coaching", after: "", verdict: "accepted" },
        { before: "stopped coaching", after: "x", verdict: "unchanged" },
      ]),
    ).toEqual({ text: BOX, applied: 0 });
  });
});
