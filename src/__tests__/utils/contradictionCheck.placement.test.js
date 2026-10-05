/**
 * Where a correction goes. In the final-build run, a26's first item told the
 * veteran to file an Intent to File for claims already pending, "you must do
 * so immediately", and the correction sat at the very end. It now leads.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildContradictionLead,
  findContradictions,
  flagContradictions,
} from "../../utils/contradictionCheck";

const RUN =
  "llm-compiler/logs/golden-set-results/run_2026-10-05_230321_Qwen3.5-4B-q4f16_1-MLC.jsonl";
const a26 = readFileSync(RUN, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .find((record) => record.id === "a26");
const MODEL_ANSWER = a26.response.split("\n\nVet-Rate check:")[0];

const A26_LEAD = `Vet-Rate check: part of the answer below conflicts with the regulation.

The answer says: "Immediate Action: File an Intent to File (ITF) for Pending Claims"
That recommends an Intent to File for a claim that is already filed. 38 CFR § 3.155(b) says: "(b) Intent to file a claim. A claimant, his or her duly authorized representative, a Member of Congress, or some person acting as next friend of claimant who is not of full age or capacity may indicate a claimant's desire to file a claim for benefits by submitting an intent to file a claim to VA."

Check that part with a Veterans Service Officer before relying on it. The answer follows, unchanged.`;

describe("a26 from the final-build run", () => {
  const out = flagContradictions(
    { text: MODEL_ANSWER },
    { toolId: a26.toolId, dataClass: "context" },
    a26.input,
  );

  it("is the answer the model wrote, with the old trailing correction removed", () => {
    expect(
      MODEL_ANSWER.startsWith("Based on the verified reference material"),
    ).toBe(true);
    expect(MODEL_ANSWER).toContain("you must do so immediately");
    expect(MODEL_ANSWER).not.toContain("Vet-Rate check");
  });

  it("renders exactly this, correction first", () => {
    expect(out.text).toBe(`${A26_LEAD}\n\n${MODEL_ANSWER}`);
  });

  it("names the rule on the result as before", () => {
    expect(out.contradictionsFound).toEqual([
      {
        rule: "intent-to-file-for-filed-claim",
        sentence:
          "Immediate Action: File an Intent to File (ITF) for Pending Claims",
      },
    ]);
  });
});

describe("buildContradictionLead", () => {
  it("lists every contradiction under one heading", () => {
    const hits = findContradictions(
      "File an Intent to File for any pending claims. Then file a Supplemental Claim with new and material evidence.",
      { topics: ["supplemental"] },
    );
    const lead = buildContradictionLead(hits);
    expect(lead.match(/Vet-Rate check:/g)).toHaveLength(1);
    expect(lead.match(/The answer says: "/g)).toHaveLength(2);
    expect(lead).toContain(
      'The answer says: "Then file a Supplemental Claim with new and material evidence."',
    );
  });

  it("trims a long sentence it quotes from the answer", () => {
    const long = `File an Intent to File for any pending claims ${"and keep every record you have ".repeat(12)}today.`;
    const [hit] = findContradictions(long, { topics: ["supplemental"] });
    const quoted = /The answer says: "(.*)"\n/.exec(
      buildContradictionLead([hit]),
    )[1];
    expect(quoted.length).toBeLessThanOrEqual(203);
    expect(quoted.endsWith("...")).toBe(true);
    expect(long.startsWith(quoted.slice(0, -3))).toBe(true);
  });
});
