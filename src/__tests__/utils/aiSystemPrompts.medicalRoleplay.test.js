/**
 * The "medical roleplay" block is meant to stop the assistant presenting
 * itself as a clinician, or itself diagnosing or prescribing for the user.
 * It must not fire on text that mentions a diagnosis the veteran has, on a
 * conditional, or on a letter addressed to a physician.
 */
import { describe, it, expect } from "vitest";
import {
  FORBIDDEN_PHRASES,
  validateAIResponse,
} from "../../utils/aiSystemPrompts";
import { recordedCases } from "./recordedAnswers";

const blocksAsMedical = (text) =>
  validateAIResponse(text).errors.some((e) => e.includes("medical roleplay"));

const RECORDED_FALSE_POSITIVES = [
  [
    "2026-10-05_094601",
    "a16",
    "medical documentation showing that you have been diagnosed with a condition",
  ],
  ["2026-10-05_201248", "a27", "If you have been diagnosed with PTSD"],
  ["2026-10-05_201248", "a29", "your expertise as a physician can help"],
];

describe("the three recorded answers the earlier rule blocked", () => {
  it.each(RECORDED_FALSE_POSITIVES)(
    "%s %s is no longer blocked",
    (run, id, phrase) => {
      const record = recordedCases().find((c) => c.run === run && c.id === id);
      expect(record.response).toContain(phrase);
      expect(record.validationErrors).toContain(
        "BLOCKED: Response contains forbidden medical roleplay",
      );
      expect(validateAIResponse(record.response).isValid).toBe(true);
    },
  );
});

describe("the assistant speaking or acting as a clinician is blocked", () => {
  it.each([
    "As a doctor, I can tell you this is tinnitus.",
    "As your doctor, I recommend rest.",
    "As a medical professional, I can say your knee is arthritic.",
    "Speaking as a physician, this looks like sleep apnea.",
    "I am a licensed physician and I have reviewed your symptoms.",
    "I'm your doctor for this conversation.",
    "As a clinician, my view is that the condition is chronic.",
    "I diagnose you with PTSD.",
    "I diagnose this as major depressive disorder.",
    "Based on what you describe, I am diagnosing you with sleep apnea.",
    "I can diagnose your condition from these symptoms.",
    "My diagnosis is that you have a traumatic brain injury.",
    "I am prescribing sertraline 50 mg daily.",
    "I prescribe physical therapy twice a week.",
    "I would prescribe a CPAP machine.",
    "I recommend treatment for your back with opioids.",
    "My medical opinion is that you have PTSD.",
    "In my clinical judgment, this is service related.",
    "This is medical advice: stop taking the medication.",
    "You definitely have PTSD.",
    "You clearly suffer from a major depressive disorder.",
    "You should stop taking your medication until the exam.",
    "You should double your dose before the C&P exam.",
  ])("blocks: %s", (text) => {
    expect(blocksAsMedical(text)).toBe(true);
  });
});

describe("text that only mentions medicine is not blocked", () => {
  it.each([
    "If you have been diagnosed with PTSD, it may be presumptive.",
    "Provide medical documentation showing that you have been diagnosed with a condition.",
    "It is my belief that your expertise as a physician can help us understand these conditions.",
    "As a physician, you are in the best position to explain the link.",
    "Dr. Lee, as your doctor, can write a nexus letter.",
    "Ask a professional such as a doctor or a physician assistant.",
    "She worked as a clinician at the base hospital.",
    "I am not a doctor and cannot give medical advice.",
    "I'm not your doctor, so please confirm this with them.",
    "I cannot diagnose conditions or prescribe medication.",
    "I can't diagnose you; only a clinician can.",
    "I do not diagnose or treat any condition.",
    "This is not medical advice.",
    "Your doctor may prescribe a CPAP machine.",
    "I was diagnosed with tinnitus in 2019.",
    "My diagnosis is PTSD, confirmed by the VA in 2021.",
    "The examiner will diagnose the condition at the C&P exam.",
    "Ask the physician for a medical opinion on the link to service.",
    "I am requesting your medical opinion on whether my sleep apnea is related to my PTSD.",
    "You definitely have options if the claim is denied.",
    "You should stop and read the decision letter before you reply.",
    "Talk with your doctor before you stop taking any medication.",
    "A doctor who treated you has diagnosed you with a back condition, which helps the claim.",
    "I recommend that you take notes during the exam.",
  ])("allows: %s", (text) => {
    expect(blocksAsMedical(text)).toBe(false);
    expect(validateAIResponse(text).isValid).toBe(true);
  });
});

describe("blocks over the 482 labelled recorded answers", () => {
  const answers = recordedCases().filter((c) => c.response);
  const blocked = answers.filter(
    (c) => !validateAIResponse(c.response).isValid,
  );

  it("before: 3 of the answers, all false positives; after: none", () => {
    expect(answers).toHaveLength(482);
    expect(
      answers.filter((c) => c.validationErrors?.length).map((c) => c.id),
    ).toEqual(["a16", "a27", "a29"]);
    expect(blocked).toEqual([]);
  });

  it("no rule of any kind matches a recorded answer", () => {
    const matches = Object.entries(FORBIDDEN_PHRASES).flatMap(
      ([category, patterns]) =>
        answers
          .filter((c) => patterns.some((p) => p.test(c.response)))
          .map((c) => `${category} ${c.run} ${c.id}`),
    );
    expect(matches).toEqual([]);
  });
});
