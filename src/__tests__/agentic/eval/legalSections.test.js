import { describe, it, expect } from "vitest";
import {
  extractCfrSections,
  isGitLfsPointer,
  loadLegalSections,
  parseLegalChunks,
} from "../../../../scripts/eval/lib/legalSections.js";

describe("extractCfrSections", () => {
  it("reads the common citation spellings", () => {
    expect(extractCfrSections("See 38 CFR § 4.25 for the table.")).toEqual([
      "4.25",
    ]);
    expect(extractCfrSections("per 38 C.F.R. 3.304(f)")).toEqual(["3.304"]);
    expect(extractCfrSections("38 CFR 4.71a applies")).toEqual(["4.71a"]);
    expect(extractCfrSections("38CFR §3.310")).toEqual(["3.310"]);
  });

  it("reads a list introduced by one 38 CFR", () => {
    expect(
      extractCfrSections("38 CFR §§ 3.304(f), 3.310 and 4.130, then done"),
    ).toEqual(["3.304", "3.310", "4.130"]);
  });

  it("does not run on into unrelated numbers", () => {
    expect(extractCfrSections("38 CFR § 4.25, which has 20 rows")).toEqual([
      "4.25",
    ]);
  });

  it("ignores a bare Part reference and unprefixed section marks", () => {
    expect(extractCfrSections("38 CFR Part 4 and § 3.304 alone")).toEqual([]);
  });

  it("de-duplicates and lower-cases", () => {
    expect(extractCfrSections("38 CFR 4.71A and 38 CFR 4.71a")).toEqual([
      "4.71a",
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(extractCfrSections("")).toEqual([]);
    expect(extractCfrSections(undefined)).toEqual([]);
  });
});

describe("parseLegalChunks", () => {
  it("collects sections from chunk citations", () => {
    const text = [
      JSON.stringify({ citation: "38 CFR § 4.25", text: "x" }),
      JSON.stringify({ citation: "38 CFR § 4.71a", text: "y" }),
      JSON.stringify({ citation: "38 CFR § 4.25", text: "z" }),
      "not json",
      "",
    ].join("\n");
    const { sections, reason } = parseLegalChunks(text);
    expect(reason).toBeNull();
    expect([...sections].sort()).toEqual(["4.25", "4.71a"]);
  });

  it("refuses a git-lfs pointer instead of treating it as an empty index", () => {
    const pointer =
      "version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 12\n";
    expect(isGitLfsPointer(pointer)).toBe(true);
    const { sections, reason } = parseLegalChunks(pointer);
    expect(sections).toBeNull();
    expect(reason).toMatch(/git-lfs pointer/);
  });

  it("refuses a file with no 38 CFR citations", () => {
    const { sections, reason } = parseLegalChunks(
      JSON.stringify({ citation: "M21-1 III.iv", text: "x" }),
    );
    expect(sections).toBeNull();
    expect(reason).toMatch(/no '38 CFR/);
  });

  it("reports a missing file", () => {
    const { sections, reason } = loadLegalSections("does/not/exist.jsonl");
    expect(sections).toBeNull();
    expect(reason).toMatch(/not found/);
  });
});
