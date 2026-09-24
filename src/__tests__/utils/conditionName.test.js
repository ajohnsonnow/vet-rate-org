import { describe, expect, it } from "vitest";
import {
  extractPriorConditionNames,
  findRatedConditionMatch,
  isOlderDecision,
  isSupersededName,
  normalizeConditionName,
} from "../../utils/conditionName";

const byName = (r) => r.name;

describe("extractPriorConditionNames", () => {
  it("reads a nested 'formerly evaluated as' parenthetical", () => {
    expect(
      extractPriorConditionNames(
        "Post-traumatic stress disorder (formerly evaluated as panic disorder without agoraphobia and depressive disorder not otherwise specified (NOS))",
      ),
    ).toEqual([
      "panic disorder without agoraphobia and depressive disorder not otherwise specified",
    ]);
  });

  it("reads 'previously rated as'", () => {
    expect(
      extractPriorConditionNames(
        "lumbosacral strain, degenerative disc disease (previously rated as lumbago)",
      ),
    ).toEqual(["lumbago"]);
  });

  it("tolerates a truncated, unclosed parenthetical", () => {
    expect(
      extractPriorConditionNames(
        "lumbosacral strain (previously rated as lumba",
      ),
    ).toEqual(["lumba"]);
  });

  it("does not treat 'also claimed as' as a rename", () => {
    expect(
      extractPriorConditionNames("Lumbago (also claimed as back strain)"),
    ).toEqual([]);
  });

  it("returns [] for plain names and non-strings", () => {
    expect(extractPriorConditionNames("tinnitus")).toEqual([]);
    expect(extractPriorConditionNames(null)).toEqual([]);
  });
});

describe("findRatedConditionMatch", () => {
  const rows = [
    {
      name: "Panic disorder without agoraphobia and depressive disorder not otherwise specified (NOS)",
    },
    {
      name: "Lumbago (also claimed as back strain and straightening lordotic curve)",
    },
    { name: "Tinnitus" },
  ];

  it("matches the same condition by normalized name", () => {
    expect(findRatedConditionMatch(rows, "TINNITUS.", byName)).toBe(rows[2]);
  });

  it("matches a renamed condition to the row it replaces", () => {
    expect(
      findRatedConditionMatch(
        rows,
        "Post-traumatic stress disorder (formerly evaluated as panic disorder without agoraphobia and depressive disorder not otherwise specified (NOS))",
        byName,
      ),
    ).toBe(rows[0]);
    expect(
      findRatedConditionMatch(
        rows,
        "lumbosacral strain (previously rated as lumbago)",
        byName,
      ),
    ).toBe(rows[1]);
  });

  it("matches an older name to a row that already records it as former", () => {
    const newer = [{ name: "PTSD (formerly evaluated as panic disorder)" }];
    expect(findRatedConditionMatch(newer, "Panic disorder", byName)).toBe(
      newer[0],
    );
  });

  it("returns null for an unrelated condition", () => {
    expect(findRatedConditionMatch(rows, "rhinitis", byName)).toBeNull();
  });
});

describe("normalizeConditionName with a truncated parenthetical", () => {
  it("drops the unclosed tail so a later complete letter matches", () => {
    expect(
      normalizeConditionName("lumbosacral strain (previously rated as lumba"),
    ).toBe(
      normalizeConditionName(
        "Lumbosacral strain (previously rated as lumbago)",
      ),
    );
  });
});

describe("isSupersededName", () => {
  it("treats a name the saved row replaced as older", () => {
    expect(
      isSupersededName(
        "PTSD (formerly evaluated as panic disorder)",
        "Panic disorder",
      ),
    ).toBe(true);
    expect(isSupersededName("Tinnitus", "Tinnitus")).toBe(false);
  });
});

describe("isOlderDecision", () => {
  it("compares ISO and prose dates", () => {
    expect(isOlderDecision("2008-06-30", "2023-09-15")).toBe(true);
    expect(isOlderDecision("September 15, 2023", "2008-06-30")).toBe(false);
  });

  it("is false when either date is missing", () => {
    expect(isOlderDecision(null, "2023-09-15")).toBe(false);
    expect(isOlderDecision("2023-09-15", undefined)).toBe(false);
  });
});
