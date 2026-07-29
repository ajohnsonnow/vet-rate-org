import { describe, it, expect } from "vitest";
import {
  partHeading,
  contextualizeText,
} from "../../scripts/legal-ingestion/contextualize.mjs";

/**
 * S20 — contextual retrieval. The embedding-time prefix is templated (no
 * LLM call) from metadata already on the chunk; the persisted `text` field
 * must never be touched by this module.
 */
describe("partHeading", () => {
  it("resolves the known Part 4 title", () => {
    expect(partHeading("38 CFR § 4.71a")).toBe(
      "38 CFR Part 4 — Schedule for Rating Disabilities",
    );
  });

  it("falls back to a bare part number for an unfetched/unknown part", () => {
    expect(partHeading("38 CFR § 3.303")).toBe("38 CFR Part 3");
    expect(partHeading("38 CFR § 19.7")).toBe("38 CFR Part 19");
  });

  it("falls back gracefully for a malformed or missing citation", () => {
    expect(partHeading("not a citation")).toBe("38 CFR");
    expect(partHeading(undefined)).toBe("38 CFR");
    expect(partHeading("")).toBe("38 CFR");
  });
});

describe("contextualizeText", () => {
  const chunk = (text, over = {}) => ({
    citation: "38 CFR § 4.71a",
    title: "§ 4.71a Schedule of ratings—musculoskeletal system",
    text,
    ...over,
  });

  it("prepends the section title before the original text, separated by a blank line", () => {
    const out = contextualizeText(chunk("Original prose content."));
    expect(out).toBe(
      "§ 4.71a Schedule of ratings—musculoskeletal system\n\nOriginal prose content.",
    );
  });

  it("deliberately omits the corpus-wide part heading (non-discriminative today)", () => {
    // See contextualize.mjs's comment: the shared "38 CFR Part 4 — Schedule
    // for Rating Disabilities" constant regressed 2 queries in an A/B test
    // for a smaller gain elsewhere — net loss, so it's excluded on purpose.
    const out = contextualizeText(chunk("x"));
    expect(out).not.toContain("Schedule for Rating Disabilities");
  });

  it("marks a table chunk with the (rating table) descriptor", () => {
    const tableText = "| Code | Rating |\n| --- | --- |\n| 5000 | 100 |";
    const out = contextualizeText(chunk(tableText));
    expect(out).toContain("(rating table)");
    expect(out.endsWith(tableText)).toBe(true);
  });

  it("marks a later fragment of a multi-chunk section as (continued)", () => {
    const first = contextualizeText(chunk("part one"), { index: 0, total: 3 });
    const second = contextualizeText(chunk("part two"), { index: 1, total: 3 });
    expect(first).not.toContain("(continued)");
    expect(second).toContain("(continued)");
  });

  it("falls back to the raw text unprefixed when the chunk has no title", () => {
    const out = contextualizeText(chunk("x", { title: "" }));
    expect(out).toBe("x");
  });

  it("never mutates the original chunk object", () => {
    const c = chunk("Immutable check.");
    const before = JSON.stringify(c);
    contextualizeText(c, { index: 1, total: 2 });
    expect(JSON.stringify(c)).toBe(before);
  });
});
