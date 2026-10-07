/**
 * The "nexus impersonation" block stops the assistant writing a medical
 * nexus opinion in a physician's voice. Six recorded answers did exactly
 * that and passed the earlier rule, which knew three fixed phrases. Advice
 * about a nexus letter, and a veteran's own request for one, must still pass.
 */
import { describe, it, expect } from "vitest";
import {
  FORBIDDEN_PHRASES,
  validateAIResponse,
} from "../../utils/aiSystemPrompts";
import { recordedCases } from "./recordedAnswers";

const BLOCK = "BLOCKED: Response contains forbidden nexus impersonation";
const blocksAsNexus = (text) => validateAIResponse(text).errors.includes(BLOCK);

const RECORDED_WRONG_PASSES = [
  [
    "2026-10-05_071859",
    "a19",
    "I, [Your Full Name], a licensed Physician (MD/DO), hereby provide my professional opinion",
  ],
  [
    "2026-10-05_071859",
    "a27",
    "I am writing to provide a nexus opinion regarding the veteran's chronic respiratory issues",
  ],
  [
    "2026-10-05_071859",
    "a29",
    "I, [Your Full Name], a Licensed Physician, have been treating you",
  ],
  [
    "2026-10-05_074624",
    "a19",
    "it is my professional opinion that [Veteran's Condition] is at least as likely as not",
  ],
  [
    "2026-10-05_074624",
    "a29",
    "I, [Your Full Name], a Licensed Physician, have been treating you",
  ],
  [
    "2026-10-05_094601",
    "a19",
    "I am writing to provide a nexus opinion on the veteran's claim",
  ],
];

describe("six recorded answers written as a physician's nexus opinion", () => {
  it.each(RECORDED_WRONG_PASSES)(
    "%s %s passed before and is blocked now",
    (run, id, phrase) => {
      const record = recordedCases().find((c) => c.run === run && c.id === id);
      expect(record.response).toContain(phrase);
      expect(record.validationErrors ?? []).not.toContain(BLOCK);
      expect(blocksAsNexus(record.response)).toBe(true);
    },
  );

  it("are the only labelled answers any rule blocks", () => {
    const answers = recordedCases().filter((c) => c.response);
    const blocked = answers
      .filter((c) => !validateAIResponse(c.response).isValid)
      .map((c) => `${c.run} ${c.id}`);
    expect(blocked).toEqual(
      RECORDED_WRONG_PASSES.map(([run, id]) => `${run} ${id}`),
    );
    const byOtherRules = Object.entries(FORBIDDEN_PHRASES)
      .filter(([category]) => category !== "NEXUS_IMPERSONATION")
      .flatMap(([, patterns]) =>
        answers.filter((c) => patterns.some((p) => p.test(c.response))),
      );
    expect(byOtherRules).toEqual([]);
  });
});

describe("the assistant writing the opinion itself is blocked", () => {
  it.each([
    "I am writing to provide a nexus opinion for this veteran.",
    "I am writing to provide my medical nexus letter in support of the claim.",
    "It is my professional opinion that the condition is at least as likely as not related to service.",
    "Based on my review, it is my medical opinion that sleep apnea is secondary to PTSD.",
    "I, Dr. Placeholder, a licensed physician, have reviewed the records.",
    "I, [Your Full Name], am a board-certified psychiatrist and have treated the veteran.",
    "This is a nexus opinion.",
    "In my medical opinion, it is more likely than not that service caused it.",
  ])("%s", (text) => {
    expect(blocksAsNexus(text)).toBe(true);
  });
});

describe("advice about a nexus letter is not blocked", () => {
  it.each([
    "You will need a qualified medical professional to provide a nexus opinion linking your condition to your service.",
    "I request a nexus letter from a licensed medical professional that states my diagnosis is at least as likely as not caused by service.",
    'Ask your doctor to write: "It is my professional opinion that the condition is at least as likely as not related to service."',
    "Please state whether it is your professional opinion that my hypertension is related to my in-service exposure.",
    "A nexus letter is written by a licensed physician, not by Vet-Rate.",
    "I am writing to request a nexus opinion from you, my treating physician.",
    "The examiner said it is his medical opinion that the knee is unrelated.",
    "I, the veteran, ask a licensed physician to review my records.",
  ])("%s", (text) => {
    expect(blocksAsNexus(text)).toBe(false);
  });
});
