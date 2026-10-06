/**
 * A review lane or an Intent to File given another lane's form number. The
 * numbers come from the bundled forms table, so the rule is measured here
 * over every recorded answer as well as on the sentence that prompted it.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  buildContradictionLead,
  findContradictions,
} from "../../utils/contradictionCheck";
import { LANE_FORMS, findFormMismatch } from "../../utils/vaForms";
import reference from "../../data/verifiedReference.json";

const RULE = "form-for-another-filing";
const FILING = ["next-claim-step"];
const rules = (text, topics = FILING) =>
  findContradictions(text, { topics }).map((hit) => hit.rule);

const RUN_C_A26 =
  "*   **Action:** You must submit supplemental claims for the three denied claims using VA Form 21-0966 (or via electronic submission if available).";

describe("the form each filing takes", () => {
  it("is read from the bundled forms table", () => {
    expect(LANE_FORMS).toEqual({
      "higher-level-review": "20-0996",
      "board-appeal": "10182",
      "supplemental-claim": "20-0995",
      "intent-to-file": "21-0966",
    });
    const table = reference.entries.find((e) => e.id === "va-forms").text;
    for (const number of Object.values(LANE_FORMS)) {
      expect(table).toContain(`VA Form ${number}: `);
    }
  });
});

describe("a filing paired with another filing's form", () => {
  it.each([
    [RUN_C_A26, "supplemental-claim", "21-0966"],
    [
      "- Fill out the VA Form 21-527C (Supplemental Claim) if you haven't already done so.",
      "supplemental-claim",
      "21-527C",
    ],
    [
      "File a Supplemental Claim (VA Form 10182) with the new opinion.",
      "supplemental-claim",
      "10182",
    ],
    [
      "Request a Higher-Level Review using VA Form 20-0995.",
      "higher-level-review",
      "20-0995",
    ],
    ["Use VA Form 20-0996 to file a Board Appeal.", "board-appeal", "20-0996"],
    [
      "Submit an Intent to File (Form 20-0995) today.",
      "intent-to-file",
      "20-0995",
    ],
  ])("flags: %s", (sentence, lane, number) => {
    expect(findFormMismatch(sentence)).toMatchObject({ lane, number });
    expect(rules(sentence)).toEqual([RULE]);
  });

  it.each([
    "File a Supplemental Claim (VA Form 20-0995) with the new opinion.",
    "Step 2: In the Higher-Level Review, specifically request a Board hearing (VA Form 10182) for the knee issue.",
    "**Claim Form:** File a claim (VA Form 21-526EZ) or Intent to File (VA Form 21-0966) citing **PACT Act** presumptive service connection.",
    "Within one year of receiving that ITF confirmation letter, you must file a complete claim (VA Form 21-0956 or 21-4138).",
    "File a Supplemental Claim and a lay statement using VA Form 21-10210.",
    "Include a buddy statement with your Supplemental Claim (VA Form 21-10210).",
    "You can file a Higher-Level Review (VA Form 20-0996), a Supplemental Claim (VA Form 20-0995), or a Board Appeal (VA Form 10182).",
    "File a Notice of Disagreement (VA Form 10182) within one year of the decision date.",
    "A Supplemental Claim does not use VA Form 21-0966.",
  ])("leaves alone: %s", (sentence) => {
    expect(findFormMismatch(sentence)).toBeNull();
    expect(rules(sentence)).not.toContain(RULE);
  });

  it("corrects run C's sentence from the table, above the answer", () => {
    const hits = findContradictions(RUN_C_A26, { topics: FILING });
    expect(buildContradictionLead(hits)).toBe(
      [
        "Vet-Rate check: part of the answer below conflicts with the regulation.",
        "",
        'The answer says: "Action: You must submit supplemental claims for the three denied claims using VA Form 21-0966 (or via electronic submission if available)."',
        'That gives VA Form 21-0966 as the form for a Supplemental Claim. The list of VA claim forms (titles as cited in VA Adjudication Procedures Manual M21-1) says: "VA Form 20-0995: Decision Review Request: Supplemental Claim"',
        "",
        "Check that part with a Veterans Service Officer before relying on it. The answer follows, unchanged.",
      ].join("\n"),
    );
  });

  it("is not applied to a question about something other than filing", () => {
    expect(rules(RUN_C_A26, ["secondary"])).toEqual([]);
  });
});

describe("the rule over every recorded answer", () => {
  const DIR = "llm-compiler/logs/golden-set-results";
  const LAST_REVIEWED_RUN = "run_2026-10-06_034657";
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

  // The Decision Decoder answers in JSON; the app checks it field by field.
  const textsOf = (response) => {
    try {
      return Object.values(JSON.parse(response))
        .flat()
        .filter((value) => typeof value === "string");
    } catch {
      return [String(response ?? "")];
    }
  };

  it("fires eight times in 1160 responses, each a real mix-up, with the topic gate off", () => {
    expect(responses).toHaveLength(1160);
    const hits = responses.flatMap((r) =>
      textsOf(r.response)
        .flatMap((text) => findContradictions(text, { topics: FILING }))
        .filter((hit) => hit.rule === RULE)
        .map((hit) => `${r.run} ${r.id} | ${hit.says}`),
    );
    expect(hits).toEqual([
      "074624 a18 | gives VA Form 21-527C as the form for a Supplemental Claim",
      "231514 t08 | gives VA Form 10182 as the form for a Supplemental Claim",
      "000014 a26 | gives VA Form 21-0966 as the form for a Supplemental Claim",
      "021103 a26 | gives VA Form 21-0966 as the form for a Supplemental Claim",
      "021103 t08 | gives VA Form 10182 as the form for a Supplemental Claim",
      "022302 t08 | gives VA Form 10182 as the form for a Supplemental Claim",
      "032917 t08 | gives VA Form 10182 as the form for a Supplemental Claim",
      "034657 a04 | gives VA Form 22-0966 as the form for a Supplemental Claim",
    ]);
  });
});
