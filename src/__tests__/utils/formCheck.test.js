/**
 * Post-generation form check. An answer that names a VA form number found in
 * neither the allowlist nor the bundled forms table gets a notice under it,
 * like the citation notice. Measured over every recorded answer.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  buildFormNotice,
  findUnverifiedForms,
  flagUnverifiedForms,
} from "../../utils/formCheck";

describe("findUnverifiedForms", () => {
  it.each([
    [
      "VA will issue the appropriate application form (likely Form 22-5388) which must be filed within one year.",
      ["22-5388"],
    ],
    [
      "VA will issue the appropriate application form (VA Form 22-5300) for your specific disability benefits.",
      ["22-5300"],
    ],
    [
      "Submit VA Form 22-5262, VA Form 22-5263, or VA Form 22-5262 again.",
      ["22-5262", "22-5263"],
    ],
    ["Fill out the VA Form 21-527C (Supplemental Claim).", ["21-527C"]],
    ["Complete VA Form 99999 first.", ["99999"]],
  ])("finds the unknown number in: %s", (text, expected) => {
    expect(findUnverifiedForms(text)).toEqual(expected);
  });

  it.each([
    "File an Intent to File (VA Form 21-0966), then VA Form 21-526EZ.",
    "File a Notice of Disagreement (VA Form 10182) or use Form 10182 online.",
    "Ask your doctor for a DBQ, such as VA Form 21-0960M-15.",
    "Bring your DD Form 214 and any DD Form 2799.",
    "Request your records with SF-180 (Standard Form 180).",
    "Your accountant will want Form 1040.",
    "You served 2003-2007 and filed in 21-2024.",
    "Use va form 21-4142a to release private records.",
    "",
    null,
  ])("finds nothing in: %s", (text) => {
    expect(findUnverifiedForms(text)).toEqual([]);
  });
});

describe("buildFormNotice", () => {
  it("names one number and where to check it", () => {
    expect(buildFormNotice(["22-5388"])).toBe(
      "Vet-Rate could not verify a form number in this answer: VA Form 22-5388 is not in its list of VA forms (as of 2026-01-27). Check that number at va.gov/find-forms or with a Veterans Service Officer before using it.",
    );
  });

  it("names several", () => {
    expect(buildFormNotice(["22-5262", "22-5263", "22-5264"])).toBe(
      "Vet-Rate could not verify form numbers in this answer: VA Form 22-5262, 22-5263 and 22-5264 are not in its list of VA forms (as of 2026-01-27). Check those numbers at va.gov/find-forms or with a Veterans Service Officer before using them.",
    );
  });
});

describe("flagUnverifiedForms", () => {
  const answer = "Then file the application (VA Form 22-5300).";

  it("appends the notice and records the numbers", () => {
    const out = flagUnverifiedForms({
      text: answer,
      validationWarnings: ["x"],
    });
    expect(out.text).toBe(`${answer}\n\n${buildFormNotice(["22-5300"])}`);
    expect(out.formsUnverified).toEqual({ forms: ["22-5300"] });
    expect(out.validationWarnings).toEqual([
      "x",
      "Answer names VA form numbers that could not be verified: 22-5300",
    ]);
  });

  it("returns an answer with known forms as it came", () => {
    const result = { text: "File VA Form 20-0995." };
    expect(flagUnverifiedForms(result)).toBe(result);
  });

  it("leaves structured output alone", () => {
    const json = { text: '{"plan":"File VA Form 22-5300"}' };
    expect(flagUnverifiedForms(json)).toBe(json);
    const asked = { text: answer };
    expect(
      flagUnverifiedForms(asked, { responseFormat: { type: "json_object" } }),
    ).toBe(asked);
  });
});

describe("the check over every recorded answer", () => {
  const DIR = "llm-compiler/logs/golden-set-results";
  const LAST_REVIEWED_RUN = "run_2026-10-06_015232";
  const responses = readdirSync(DIR)
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
        .map((r) => ({ run: name.slice(15, 21), ...r })),
    );

  it("flags 19 of 920 responses, each naming a number in neither list", () => {
    expect(responses).toHaveLength(920);
    const hits = responses
      .map((r) => [r, findUnverifiedForms(String(r.response ?? ""))])
      .filter(([, forms]) => forms.length > 0)
      .map(([r, forms]) => `${r.run} ${r.id} ${forms.join(" ")}`);
    expect(hits).toEqual([
      "071859 a27 21-4168",
      "074624 a18 21-527C",
      "081228 a06 21-4568B",
      "081228 a18 21-4548",
      "081228 a25 28-10253",
      "081228 a27 21-4548",
      "090513 a15 21-414 21-454",
      "090513 a30 26-1828B 26-5492",
      "094601 a15 21-414 21-454",
      "094601 a30 26-1828B 26-5492",
      "110055 a30 22-5262 22-5263 22-5264 22-5265 22-5266 22-5267 22-5268 22-5269 22-5270",
      "123216 a25 21-527",
      "125630 a30 22-1900",
      "135908 a30 21-0956",
      "201248 a30 21-5473",
      "000014 a15 22-5388",
      "000014 a30 22-5300",
      "013549 a26 22-5280",
      "015232 a30 22-0966",
    ]);
  });
});
