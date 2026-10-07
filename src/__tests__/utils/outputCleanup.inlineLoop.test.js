import { describe, it, expect } from "vitest";
import { trimRunaway } from "../../utils/outputCleanup";
import { everyRecordedText, recordedCases } from "./recordedAnswers";

const SENTENCE = "Please send the denial letter you received.";
const LONG_SENTENCE =
  "You would need a condition rated at roughly 10% to reach the 70% threshold.";

describe("trimRunaway on a loop inside one line", () => {
  it("keeps one copy of a sentence repeated four times without a line break", () => {
    const text = `Here is what to do. ${Array(4).fill(SENTENCE).join(" ")}`;
    const out = trimRunaway(text);
    expect(out.trimmed.kind).toBe("inline");
    expect(out.trimmed.copies).toBe(4);
    expect(out.text).toBe(`Here is what to do. ${SENTENCE}`);
    expect(out.trimmed.removedChars).toBe(text.length - out.text.length);
  });

  it("leaves the same sentence three times alone", () => {
    const text = Array(3).fill(SENTENCE).join(" ");
    expect(trimRunaway(text).trimmed).toBeNull();
  });

  it("cuts a long sentence at its third copy", () => {
    const text = Array(3).fill(LONG_SENTENCE).join(" ");
    const out = trimRunaway(text);
    expect(out.trimmed.kind).toBe("inline");
    expect(out.text).toBe(LONG_SENTENCE);
  });

  it("cuts a phrase repeated with no punctuation at all", () => {
    const text = `Note: ${"and the rating is combined ".repeat(9)}`;
    const out = trimRunaway(text);
    expect(out.trimmed.kind).toBe("inline");
    expect(out.text).toBe("Note: and the rating is combined");
  });

  it("cuts the arithmetic loop in case a25 of run 135040", () => {
    const a25 = recordedCases().find(
      (c) => c.run === "2026-10-05_135040" && c.id === "a25",
    );
    const draft = a25.calculatorReplacement.draft;
    const unit = "60 + 10*(40)/100 = 64.";
    expect(draft.split(unit).length - 1).toBeGreaterThan(20);
    const out = trimRunaway(draft);
    expect(out.trimmed.kind).toBe("inline");
    expect(out.text.split(unit).length - 1).toBe(1);
    expect(out.text.endsWith(`X = 10. ${unit}`)).toBe(true);
    expect(draft.startsWith(out.text)).toBe(true);
  });

  it.each([
    ["an emphatic word", "This is very, very, very, very, very important."],
    [
      "a short phrase four times",
      "Not rated, not rated, not rated, not rated.",
    ],
    [
      "a list of equal ratings",
      `Each finger is rated ${Array(12).fill("10%").join(", ")}.`,
    ],
    [
      "a table row with the same cell in every column",
      `| ${Array(8).fill("Not service connected").join(" | ")} |`,
    ],
    ["a rule line", "-".repeat(200)],
    ["a table separator", `|${" --- |".repeat(40)}`],
    [
      "sentences that share a long opening",
      "Your left knee is rated under diagnostic code 5260. Your right knee is rated under diagnostic code 5260. Your left ankle is rated under diagnostic code 5271. Your right ankle is rated under diagnostic code 5271.",
    ],
  ])("leaves %s alone", (_name, text) => {
    expect(trimRunaway(text)).toEqual({ text, trimmed: null });
  });
});

describe("the inline rule over every recorded response", () => {
  const texts = everyRecordedText();
  const inline = texts
    .map((text) => ({ text, out: trimRunaway(text) }))
    .filter(({ out }) => out.trimmed?.kind === "inline");

  it("covers every response, raw response and replaced draft on record", () => {
    expect(texts.length).toBeGreaterThan(600);
  });

  it("changes 4 of them, each a real loop, and every cut keeps a prefix", () => {
    expect(inline).toHaveLength(4);
    for (const { text, out } of inline) {
      expect(text.startsWith(out.text)).toBe(true);
      expect(out.trimmed.copies).toBeGreaterThanOrEqual(3);
    }
  });
});
