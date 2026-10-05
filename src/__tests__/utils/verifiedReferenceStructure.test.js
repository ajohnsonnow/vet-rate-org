import { describe, it, expect } from "vitest";
import {
  sameWords,
  structureText,
} from "../../../scripts/verified-reference/lib/structure.js";
import reference from "../../data/verifiedReference.json";
import flatSource from "./fixtures/verifiedReferenceSource.json";

describe("structureText", () => {
  const flat =
    "Heading Intro sentence. Time period Locations Active service on or after 1990 Duty station in, A B, or C. Duty station in, D. Active service on or after 2001 Duty station in, E. Note: none.";

  it("puts each marked phrase on its own line, as a line, a list item or a new block", () => {
    expect(
      structureText(flat, [
        { at: "Intro sentence", as: "line" },
        { at: "Time period", as: "line" },
        { at: "Active service on or after", as: "block" },
        { at: "Duty station in,", as: "item" },
        { at: "Duty station in,", as: "item" },
        { at: "Active service on or after", as: "block" },
        { at: "Duty station in,", as: "item" },
        { at: "Note:", as: "block" },
      ]),
    ).toBe(
      [
        "Heading",
        "Intro sentence.",
        "Time period Locations",
        "",
        "Active service on or after 1990",
        "- Duty station in, A B, or C.",
        "- Duty station in, D.",
        "",
        "Active service on or after 2001",
        "- Duty station in, E.",
        "",
        "Note: none.",
      ].join("\n"),
    );
  });

  it("finds each phrase after the one before it, so a repeated phrase is taken in turn", () => {
    expect(
      structureText("x cancer y cancer z", [
        { at: "cancer", as: "item" },
        { at: "cancer", as: "item" },
      ]),
    ).toBe("x\n- cancer y\n- cancer z");
  });

  it("can open a list after a blank line", () => {
    expect(
      structureText("Header one two", [
        { at: "one", as: "firstItem" },
        { at: "two", as: "item" },
      ]),
    ).toBe("Header\n\n- one\n- two");
  });

  it("returns the text unchanged when there is nothing to mark", () => {
    expect(structureText(flat, [])).toBe(flat);
  });

  it("fails when a phrase is not found after the previous one", () => {
    expect(() =>
      structureText(flat, [
        { at: "Note:", as: "line" },
        { at: "Time period", as: "line" },
      ]),
    ).toThrow(/"Time period" not found after "Note:"/);
  });

  it("fails rather than break inside a word", () => {
    expect(() =>
      structureText("abcdef ghi", [{ at: "def", as: "line" }]),
    ).toThrow(/inside a word/);
  });

  it("fails on a break style it does not know", () => {
    expect(() => structureText(flat, [{ at: "Note:", as: "tab" }])).toThrow(
      /unknown break/,
    );
  });
});

describe("sameWords", () => {
  it("accepts text that differs only by line breaks and list markers", () => {
    expect(sameWords("a b c d", "a\n- b\n\n- c d")).toBe(true);
  });

  it("rejects an added, dropped, changed or reordered word", () => {
    expect(sameWords("a b c", "a b c d")).toBe(false);
    expect(sameWords("a b c", "a c")).toBe(false);
    expect(sameWords("a b c", "a B c")).toBe(false);
    expect(sameWords("a b c", "a c b")).toBe(false);
  });

  it("does not let a hyphen that belongs to the source pass as a list marker", () => {
    expect(sameWords("a - b", "a\n- b")).toBe(false);
    expect(sameWords("a - b", "a - b")).toBe(true);
  });
});

describe("structured PACT entries against their flattened source", () => {
  const manualEntries = reference.entries.filter((e) =>
    e.id.startsWith("pact-"),
  );

  it("has the flattened source for every PACT entry", () => {
    expect(Object.keys(flatSource.passages).sort()).toEqual(
      manualEntries.map((e) => e.id).sort(),
    );
  });

  it.each(manualEntries)(
    "$id keeps every word of its source, in order",
    (entry) => {
      const source = flatSource.passages[entry.id];
      expect(source.length).toBeGreaterThan(500);
      expect(sameWords(source, entry.text)).toBe(true);
    },
  );

  it.each(manualEntries)("$id is broken into lines", (entry) => {
    expect(entry.text.split("\n").length).toBeGreaterThan(3);
    expect(flatSource.passages[entry.id]).not.toContain("\n- ");
  });
});
