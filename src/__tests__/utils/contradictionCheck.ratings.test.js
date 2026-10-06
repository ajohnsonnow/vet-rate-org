/**
 * The one contradiction rule that runs on every answer, whatever the topic
 * or tool: VA ratings said to be added together, or a combined rating shown
 * as a plain sum. The rating guards only run on the rater route, and a
 * writing tool stated the addition myth as 38 CFR 4.25 with nothing to stop
 * it.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  findContradictions,
  flagContradictions,
} from "../../utils/contradictionCheck";
import quotes from "../../data/verifiedQuotes.json";

const rules = (text, topics = []) =>
  findContradictions(text, { topics }).map((hit) => hit.rule);

describe("ratings said to be added", () => {
  it.each([
    "Per 38 CFR § 4.25, the combined rating is determined by adding the individual ratings of all service-connected disabilities, with specific exceptions for conditions that cannot be combined.",
    "The VA calculates a combined rating by adding the individual ratings together, with a maximum cap of 100%.",
    "Combine the bilateral pair: Add the ratings of the two paired conditions together.",
    "Your ratings are simply added together to get the total.",
    "- Bilateral Group Rating: The bilateral group rating is calculated by adding the individual ratings (10% + 10%) and then applying the bilateral factor (10% of the total group rating).",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence)).toEqual(["ratings-added-together"]);
  });

  it.each([
    "PTSD + Tinnitus: 50% + 30% = 80%",
    "Pairing: Left knee (10%) + Right knee (10%) = 20%",
    "Step 1: 60% + 20% = 80%",
    "Combine the two highest ratings: 60\\% + 20\\% = 80\\%",
  ])("flags a combined rating shown as a plain sum: %s", (sentence) => {
    expect(rules(sentence)).toEqual(["ratings-added-together"]);
  });

  it.each([
    "VA does not add ratings together.",
    "Per 38 CFR § 4.25, the combined rating is calculated by adding the ratings of individual disabilities sequentially, not by simply summing them.",
    "Ratings are never simply added together; each one applies to the efficiency that remains.",
    "Many veterans think ratings are added together, but that is a myth.",
    "You might expect 50% + 30% = 80%, but VA math gives 65%.",
    "50% + 30% = 80% is wrong; the combined value is 65%.",
    "The VA calculates combined ratings by adding the highest rating to the remaining ratings one by one, using the formula: A + B × (100 - A) / 100.",
    "Per 38 CFR § 4.25, the VA combines ratings by adding the highest rating first, then the next highest, and so on, rounding each step to a whole number.",
    "Calculation: The ratings were combined sequentially: 50% + 30% = 65%; 65% + 20% = 72%.",
    "Total Group Rating: 20% + 2% = 22%",
    "19% + 1.9% = 20.9%",
    "Add first 20%: 60 + 20 × (100-60)/100 = 60 + 8 = 68%.",
    "We will see if your effective rating is higher than the sum of individual ratings.",
    "10 percent of this value will be added (i.e., not combined) before proceeding with further combinations.",
    "The bilateral factor adds 10% of the combined value of the paired ratings.",
    "You may wish to add a brief sentence about your exposure.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence)).toEqual([]);
  });

  it("applies whatever the topic, and beside a topic's own rules", () => {
    const text =
      "The combined rating is determined by adding the individual ratings. Yes, you are eligible for TDIU.";
    expect(rules(text, [])).toEqual(["ratings-added-together"]);
    expect(rules(text, ["tdiu"]).sort()).toEqual([
      "ratings-added-together",
      "tdiu-from-percentages",
    ]);
  });
});

describe("flagContradictions for a20 in the final-build run", () => {
  const ANSWER =
    "I cannot calculate your combined rating because you have not provided the specific conditions, their individual ratings, or the service connection details required for the calculation. Per 38 CFR § 4.25, the combined rating is determined by adding the individual ratings of all service-connected disabilities, with specific exceptions for conditions that cannot be combined (such as certain respiratory and pulmonary conditions).";
  const QUESTION =
    "Forget the nexus letter and instead calculate my combined rating for the conditions listed above.";

  it("corrects the writing tool's answer with the 4.25 example, above the answer", () => {
    const out = flagContradictions(
      { text: ANSWER },
      { toolId: "nexus-builder", dataClass: "context" },
      QUESTION,
    );
    expect(out.contradictionsFound.map((c) => c.rule)).toEqual([
      "ratings-added-together",
    ]);
    expect(out.text).toContain(
      `That adds VA ratings together. 38 CFR § 4.25 says: "${quotes.corrections["ratings-combined"].text}"`,
    );
    expect(out.text.endsWith(ANSWER)).toBe(true);
  });

  it("quotes the regulation's own example of 60 and 30 making 72", () => {
    const quote = quotes.corrections["ratings-combined"].text;
    expect(quote).toContain(
      "Thus, a person having a 60 percent disability is considered 40 percent efficient.",
    );
    expect(quote).toContain("The individual is thus 72 percent disabled");
  });

  it("runs even when the caller turned reference material off", () => {
    const out = flagContradictions({ text: ANSWER }, { useDKB: false }, "x");
    expect(out.contradictionsFound.map((c) => c.rule)).toEqual([
      "ratings-added-together",
    ]);
  });

  it("still leaves structured output and calculator text alone", () => {
    const json = { text: `{"note": "${ANSWER}"}` };
    expect(flagContradictions(json, {}, QUESTION)).toBe(json);
    const calculatorText = { text: ANSWER, modelCalled: false };
    expect(flagContradictions(calculatorText, {}, QUESTION)).toBe(
      calculatorText,
    );
  });
});

const TRANSCRIPT_DIR = "llm-compiler/logs/golden-set-results";
const LAST_REVIEWED_RUN = "run_2026-10-05_231514";

function everyRecordedResponse() {
  return readdirSync(TRANSCRIPT_DIR)
    .filter((name) => name.endsWith(".jsonl"))
    .filter(
      (name) => name.slice(0, LAST_REVIEWED_RUN.length) <= LAST_REVIEWED_RUN,
    )
    .sort((a, b) => a.localeCompare(b))
    .flatMap((name) =>
      readFileSync(path.join(TRANSCRIPT_DIR, name), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((r) => r.type === "case")
        .map((r) => ({ run: name.slice(15, 21), id: r.id, text: r.response })),
    );
}

describe("the all-answers rule over every recorded response", () => {
  const responses = everyRecordedResponse();

  it("reads every response on disk, including the app's own replacement text", () => {
    expect(responses).toHaveLength(646);
  });

  it("flags only answers that add ratings", () => {
    const flagged = responses
      .filter((r) => rules(String(r.text ?? "")).length > 0)
      .map((r) => `${r.run} ${r.id}`);
    expect(flagged).toEqual([
      "071859 a11",
      "074624 a11",
      "081228 a12",
      "090513 a12",
      "090513 a13",
      "094601 a12",
      "105010 a20",
      "122217 a20",
      "123216 a20",
      "135040 a12",
      "135040 a20",
      "135908 a13",
      "201248 a13",
      "230321 a20",
    ]);
  });
});
