/**
 * Triggers written the way veterans phrase things, not the way the
 * regulation names them. The graded run missed four golden-set questions
 * that needed verified text because none of them used the legal term.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  detectReferenceTopics,
  selectVerifiedEntries,
} from "../../utils/verifiedReference";

const golden = Object.fromEntries(
  readFileSync("src/__tests__/agentic/golden-set.jsonl", "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((c) => [c.id, c]),
);
const topicsFor = (id) =>
  detectReferenceTopics(golden[id].input, golden[id].toolId);

describe("Intent to File wording", () => {
  it.each([
    "How do I protect my effective date while I gather records?",
    "I want to start my claim. What comes first?",
    "Can I hold my date while I wait for my records?",
    "How do I lock in my date before I file?",
    "I have never filed a claim before.",
    "This will be my first VA claim.",
    "I just got out. Where do I start?",
  ])("%s", (question) => {
    expect(detectReferenceTopics(question)).toContain("intent-to-file");
  });
});

describe("TDIU wording", () => {
  it.each([
    "I can't work anymore because of my back.",
    "I cannot work a full day with my migraines.",
    "My PTSD has left me unable to work.",
    "My doctor says I am unemployable.",
    "I lost my job because of my service-connected knee.",
    "I had to quit because of my conditions.",
    "I can’t hold a job with these flare-ups.",
  ])("%s", (question) => {
    expect(detectReferenceTopics(question)).toContain("tdiu");
  });

  it("reads a planning question from a veteran already at 70 percent", () => {
    expect(
      detectReferenceTopics("What should I plan next at a 70% rating?"),
    ).toContain("tdiu");
    expect(
      detectReferenceTopics("Analyze my 80% combined rating and the math."),
    ).not.toContain("tdiu");
  });
});

describe("Supplemental Claim wording", () => {
  it.each([
    "I was denied last year and now have new evidence.",
    "I have new evidence for a claim VA denied.",
    "Can I reopen my old knee claim?",
    "VA denied my claim. What are my options?",
    "My claim was denied. Can I refile?",
  ])("%s", (question) => {
    expect(detectReferenceTopics(question)).toContain("supplemental");
  });

  it("does not read every mention of a denial as a supplemental claim question", () => {
    for (const question of [
      "VA denied 3 of my 5 conditions. Decode each denial reason.",
      "Decode this rating decision and explain why my tinnitus was denied.",
      "Red-team my claim and identify everything VA will use to deny it.",
    ]) {
      expect(detectReferenceTopics(question)).not.toContain("supplemental");
    }
  });
});

describe("questions about what to do next", () => {
  it.each([
    "Given my situation, what should my next claim action be?",
    "Help me prioritize next steps.",
    "Help me plan my next round of claims.",
    "What should I file next?",
  ])("%s", (question) => {
    expect(detectReferenceTopics(question)).toContain("next-claim-step");
  });

  it("offers both the Intent to File rule and the Supplemental Claim rule", () => {
    expect(
      selectVerifiedEntries("What should my next claim action be?", {
        maxChars: 3400,
      }).map((e) => e.id),
    ).toEqual(["cfr-3.155-b", "cfr-3.2501"]);
  });
});

describe("the golden-set questions the graded run left without verified text", () => {
  it("a30: first claim, where Intent to File is the answer", () => {
    expect(topicsFor("a30")).toEqual(["intent-to-file"]);
  });

  it("a26: pending and denied claims", () => {
    expect(topicsFor("a26")).toEqual(["supplemental", "next-claim-step"]);
    expect(
      selectVerifiedEntries(golden.a26.input, {
        toolId: golden.a26.toolId,
        maxChars: 3400,
      }).map((e) => e.id),
    ).toEqual(["cfr-3.2501", "cfr-3.155-b"]);
  });

  it("a15: planning claims at 70 percent", () => {
    expect(topicsFor("a15")).toEqual(["tdiu", "next-claim-step"]);
  });

  it("a18: next claim action", () => {
    expect(topicsFor("a18")).toEqual(["next-claim-step"]);
  });

  it.each(["a01", "a04", "a07", "a09", "a17", "a23", "a28"])(
    "%s still gets nothing",
    (id) => {
      expect(topicsFor(id)).toEqual([]);
    },
  );
});
