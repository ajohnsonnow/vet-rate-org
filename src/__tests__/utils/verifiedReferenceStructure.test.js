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

  it("accepts a colon added to the end of a word", () => {
    expect(sameWords("Time period one two", "Time period:\n- one\n- two")).toBe(
      true,
    );
    expect(sameWords("Laos December 1", "Laos: December 1")).toBe(true);
  });

  it("rejects a colon that was dropped, moved or added on its own", () => {
    expect(sameWords("Note: none", "Note none")).toBe(false);
    expect(sameWords("a b", "a : b")).toBe(false);
    expect(sameWords("a b", "a:: b")).toBe(false);
    expect(sameWords("a b", ":a b")).toBe(false);
  });
});

describe("structureText colons", () => {
  it("ends a heading with a colon before its list", () => {
    expect(
      structureText("Intro. Time period first second", [
        { at: "Time period", as: "line" },
        { at: "first", as: "item", colon: true },
        { at: "second", as: "item" },
      ]),
    ).toBe("Intro.\nTime period:\n- first\n- second");
  });

  it("puts a colon between a place and its dates on one line", () => {
    expect(
      structureText("Places Laos December 1, 1965, to September 30, 1969.", [
        { at: "Laos", as: "item" },
        { at: "December 1, 1965", as: "colon" },
      ]),
    ).toBe("Places\n- Laos: December 1, 1965, to September 30, 1969.");
  });
});

describe("the PACT tables as the model reads them", () => {
  const text = (id) => reference.entries.find((e) => e.id === id).text;

  it("labels the two columns of the covered-Veteran table the way its rows are laid out", () => {
    expect(text("pact-toxic")).toContain(
      [
        "Time period:",
        "- 38 CFR 3.320 Locations",
        "- 38 U.S.C. 1119 Locations",
        "",
        "Active service on or after August 2, 1990:",
        "- Duty station in, including airspace above, Bahrain Iraq Kuwait",
      ].join("\n"),
    );
    expect(text("pact-toxic")).toContain(
      "Active service on or after September 11, 2001:\n- Duty station in, including airspace above, Afghanistan Djibouti Syria, or Uzbekistan.\n- Duty station in, including airspace above, Egypt Jordan Lebanon, or Yemen.",
    );
  });

  it("puts each herbicide table label on its own line, above rows laid out the same way", () => {
    expect(text("pact-herbicide")).toContain(
      "\n\nPresumptive exposure provision applies to ...\nAuthority\n\nVeterans who served\n- in the Republic of Vietnam (RVN)",
    );
    expect(text("pact-herbicide")).toContain(
      "\nDisability\nAuthority\n\n- Chloracne",
    );
  });

  it("separates each herbicide location from its dates with a colon", () => {
    const herbicide = text("pact-herbicide");
    expect(herbicide).toContain(
      "Veterans who performed covered service in/on ...: During the period ...",
    );
    for (const row of [
      "the Veteran performed: January 9, 1962, to June 30, 1976.",
      "- Laos: December 1, 1965, to September 30, 1969.",
      "- Cambodia at Mimot or Krek, Kampong Cham Province: April 16, 1969, to April 30, 1969.",
      "- Guam or American Samoa, or in the territorial waters thereof: January 9, 1962, to July 31, 1980.",
      "- Johnston Atoll or on a ship that called at Johnston Atoll: January 1, 1972, to September 30, 1977.",
    ]) {
      expect(herbicide).toContain(row);
    }
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
