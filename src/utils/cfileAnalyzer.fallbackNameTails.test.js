/**
 * D22-5: the off-device fallback still listed a few names that are not
 * conditions: letter wording left on the end of a name ("tinnitus effective
 * date"), names cut off one word short, boilerplate phrases and one phrase
 * run together twice. Generic fixtures with exact expected lists; the real
 * shapes the earlier rules protect must survive every new rule.
 */
import { describe, it, expect, vi } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("./unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateAI: vi.fn(),
    getAIStatus: vi.fn(() => ({ effectiveMode: "cloud" })),
    getDocumentAIRouting: vi.fn(() => ({
      onDeviceReady: false,
      onDeviceMode: null,
      blockedProviderLabel: "Cloud AI (Gemini)",
    })),
    isAnyAIAvailable: vi.fn(() => true),
  };
});

const { analyzeCFile, _cleanConditionName } =
  await import("./cfileAnalyzer.js");

const NOT_CONDITIONS = [
  "Lumbar strain with degenerative",
  "post-traumatic stress",
  "obstructive sleep",
  "sleep",
  "chronic",
  "status post",
  "Your combined evaluation",
  "the veteran",
  "VA examination",
  "no longer",
  "not shown",
  "for the following",
  "this decision",
  "evidence of record",
  "benefits",
  "symptoms",
  "based on",
];

const CLEANED = [
  ["tinnitus effective date", "tinnitus"],
  ["migraine headaches effective", "migraine headaches"],
  ["Tinnitus granted", "Tinnitus"],
  ["tinnitus is granted", "tinnitus"],
  ["lumbar strain denied", "lumbar strain"],
  ["right ankle sprain, evaluated", "right ankle sprain"],
  ["right shoulder strain, status post", "right shoulder strain"],
  ["sleep apnea is", "sleep apnea"],
  ["tinnitus based on", "tinnitus"],
  ["knee condition (claimed as", "knee condition"],
  ["knee condition, claimed as", "knee condition"],
  ["left knee (previously", "left knee"],
  ["Tinnitus and Tinnitus", "Tinnitus"],
  ["Lumbar strain / lumbar strain", "Lumbar strain"],
  ["Panic disorderPanic disorder", "Panic disorder"],
  ["hearing losshearing loss", "hearing loss"],
  ["Hearing loss Hearing Loss", "Hearing loss"],
];

const KEPT = [
  "beriberi",
  "Hearing loss, bilateral",
  "tinnitus, bilateral",
  "left knee",
  "chronic fatigue",
  "chronic obstructive pulmonary disease",
  "post-traumatic stress disorder",
  "obstructive sleep apnea",
  "sleep apnea",
  "degenerative disc disease",
  "Gulf War illness",
  "traumatic brain injury (TBI)",
  "anxiety disorder, not otherwise specified",
  "ED",
];

describe("_cleanConditionName: wording that is not a condition", () => {
  it.each(NOT_CONDITIONS)("drops %j", (raw) => {
    expect(_cleanConditionName(raw)).toBeNull();
  });

  it.each(CLEANED)("cleans %j to %j", (raw, expected) => {
    expect(_cleanConditionName(raw)).toBe(expected);
  });

  it.each(KEPT)("keeps the real name %j unchanged", (name) => {
    expect(_cleanConditionName(name)).toBe(name);
  });
});

const LETTER = `
Rating Decision
Page 1 of 4

DECISION

1. Service connection for chronic obstructive pulmonary disease is granted with an evaluation of 30 percent
disabling effective March 3, 2019.
2. Service connection for panic disorderpanic disorder is granted with an evaluation of 50 percent
disabling effective March 3, 2019.
3. Service connection for hearing loss and hearing loss is granted with an evaluation of 10 percent
disabling effective March 3, 2019.
4. Service connection for right ankle sprain, status post is granted with an evaluation of 10 percent
disabling effective March 3, 2019.
5. Service connection for migraine headaches effective date is granted with an evaluation of 30 percent
disabling effective March 3, 2019.
6. Service connection for sleep apnea is denied.
`;

describe("analyzeCFile off-device fallback: names end clean", () => {
  it("lists exactly the real conditions with the letter wording removed", async () => {
    const result = await analyzeCFile(
      "fake-api-key",
      LETTER,
      () => {},
      null,
      {},
    );
    expect(result.analysis.potential_claims.map((c) => c.condition)).toEqual([
      "chronic obstructive pulmonary disease",
      "panic disorder",
      "hearing loss",
      "right ankle sprain",
      "migraine headaches",
      "sleep apnea",
    ]);
  });
});
