/**
 * The covered-Veteran table gives two start dates, each for its own places.
 * Two recorded runs dated Iraq from September 11, 2001; the verified text in
 * the same prompt says August 2, 1990. The place-to-date pairs are read from
 * the bundled entry, not kept in a second list.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  COVERAGE_BLOCKS,
  findWrongCoverageDate,
} from "../../utils/coverageDates";
import {
  findContradictions,
  flagContradictions,
} from "../../utils/contradictionCheck";

const EARLY_LINE =
  "Active service on or after August 2, 1990: Duty station in, including airspace above, Bahrain Iraq Kuwait Oman Qatar Saudi Arabia United Arab Emirates the neutral zone between Iraq and Saudi Arabia the Gulf of Aden the Gulf of Oman the Persian Gulf the Arabian Sea, or the Red Sea.";

describe("COVERAGE_BLOCKS", () => {
  it("reads both date rows and their places from the bundled entry", () => {
    expect(COVERAGE_BLOCKS.map((b) => [b.date, b.iso])).toEqual([
      ["August 2, 1990", "1990-08-02"],
      ["September 11, 2001", "2001-09-11"],
    ]);
    expect(COVERAGE_BLOCKS[0].places).toEqual(
      expect.arrayContaining(["Iraq", "Kuwait", "Saudi", "Persian", "Somalia"]),
    );
    expect(COVERAGE_BLOCKS[1].places).toEqual(
      expect.arrayContaining(["Afghanistan", "Syria", "Egypt", "Yemen"]),
    );
    expect(COVERAGE_BLOCKS[0].places).not.toContain("Duty");
    expect(COVERAGE_BLOCKS[1].places).not.toContain("Duty");
  });
});

describe("findWrongCoverageDate", () => {
  it.each([
    "VA presumes BPOT exposure for any Veteran who served on active duty in Iraq on or after September 11, 2001, or in the neutral zone between Iraq and Saudi Arabia.",
    "Confirm your active duty dates in Iraq fall on or after September 11, 2001.",
    "Service in Kuwait counts only from Sept. 11, 2001.",
    "Persian Gulf service qualifies on or after 9/11/2001.",
    "Gulf War veterans are covered from 11 September 2001.",
    "Saudi Arabia: on or after 2001-09-11.",
  ])("finds the wrong date in: %s", (sentence) => {
    const found = findWrongCoverageDate(sentence);
    expect(found.wrongDate).toBe("September 11, 2001");
    expect(found.quote.text).toBe(EARLY_LINE);
  });

  it("works in the other direction too", () => {
    const found = findWrongCoverageDate(
      "Afghanistan service is covered on or after August 2, 1990.",
    );
    expect(found).toMatchObject({
      place: "Afghanistan",
      wrongDate: "August 2, 1990",
    });
    expect(found.quote.text).toContain(
      "Active service on or after September 11, 2001: Duty station in, including airspace above, Afghanistan Djibouti Syria, or Uzbekistan.",
    );
  });

  it.each([
    "VA presumes exposure for any Veteran who served in Iraq on or after August 2, 1990.",
    "Iraq is covered from August 2, 1990, and Afghanistan from September 11, 2001.",
    "Afghanistan, Djibouti, Syria and Uzbekistan count on or after September 11, 2001.",
    "I served in Iraq from 2008 to 2009.",
    "The United States was attacked on September 11, 2001.",
    "The Red Cross opened on September 11, 2001.",
    "You filed your claim on September 11, 2001.",
  ])("leaves alone: %s", (sentence) => {
    expect(findWrongCoverageDate(sentence)).toBeNull();
  });
});

describe("the coverage-date rule", () => {
  const WRONG =
    "VA presumes BPOT exposure for any Veteran who served on active duty in Iraq on or after September 11, 2001.";

  it("applies when the toxic-exposure text was given, and quotes the line with the right date", () => {
    const [hit] = findContradictions(WRONG, { topics: ["toxic-exposure"] });
    expect(hit.rule).toBe("coverage-date-for-wrong-place");
    expect(hit.says).toBe(
      "gives September 11, 2001 as the start date for a place the table lists under August 2, 1990",
    );
    const out = flagContradictions(
      { text: WRONG },
      { toolId: "pact-navigator", dataClass: "context" },
      "Am I eligible for any PACT Act presumptive conditions based on my Iraq deployment?",
    );
    expect(out.text).toContain(
      `The answer says: "${WRONG}"\nThat gives September 11, 2001 as the start date for a place the table lists under August 2, 1990. VA manual M21-1 VIII.ii.2.A.1.e-h says: "${EARLY_LINE}"\n`,
    );
    expect(out.contradictionsFound).toEqual([
      { rule: "coverage-date-for-wrong-place", sentence: WRONG },
    ]);
  });

  it("does not apply to another topic", () => {
    expect(findContradictions(WRONG, { topics: ["herbicide"] })).toEqual([]);
  });
});

describe("the coverage-date rule over every recorded response", () => {
  const DIR = "llm-compiler/logs/golden-set-results";
  const LAST_REVIEWED_RUN = "run_2026-10-06_002046";
  const hits = readdirSync(DIR)
    .filter((name) => name.endsWith(".jsonl"))
    .filter(
      (name) => name.slice(0, LAST_REVIEWED_RUN.length) <= LAST_REVIEWED_RUN,
    )
    .sort((a, b) => a.localeCompare(b))
    .flatMap((name) =>
      readFileSync(path.join(DIR, name), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((r) => r.type === "case")
        .filter((r) =>
          findContradictions(String(r.response ?? ""), {
            topics: ["toxic-exposure"],
          }).some((h) => h.rule === "coverage-date-for-wrong-place"),
        )
        .map((r) => `${name.slice(4, 21)} ${r.id}`),
    );

  it("flags the two answers that misdated Iraq and nothing else", () => {
    expect(hits).toEqual(["2026-10-05_210108 a16", "2026-10-06_000820 a16"]);
  });
});
