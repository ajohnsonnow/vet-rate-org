/**
 * ADR-010 section 9, as one function the Decision Decoder screen and the
 * evaluation runner both use: on a small-class model the letter is read by
 * fixed patterns and never sent to the model.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDecodeDecision = vi.fn();
vi.mock("../../utils/aiStatementHelper", () => ({
  decodeDecision: (...args) => mockDecodeDecision(...args),
}));
const status = vi.hoisted(() => ({ value: null }));
vi.mock("../../utils/unifiedAIService", () => ({
  getAIStatus: () => status.value,
}));

const { decodeDecisionAsShown, readingWithoutModel } =
  await import("../../utils/decisionDecodeAsShown");
const { SMALL_MODEL_FALLBACK_NOTE, patternMatchDenial } =
  await import("../../utils/decisionPatternReading");

const swarm = (model) => ({
  effectiveMode: "swarm",
  swarmAvailable: true,
  swarmStatus: { model },
});
const SMALL = swarm("Qwen3.5-2B-q4f16_1-MLC");
const LARGER = swarm("Qwen3.5-4B-q4f16_1-MLC");
const CLOUD = { effectiveMode: "cloud", swarmStatus: { model: null } };

const LETTER =
  "SYNTHETIC TEST DECISION LETTER. Service connection for tinnitus is granted. " +
  "Service connection for left knee strain is denied.";
const GOOD_RESPONSE = { success: true, data: { decision_type: "Mixed" } };

beforeEach(() => {
  mockDecodeDecision.mockReset().mockResolvedValue(GOOD_RESPONSE);
});

describe("decodeDecisionAsShown", () => {
  it("on a small-class model returns the pattern reading and calls no model", async () => {
    status.value = SMALL;
    const out = await decodeDecisionAsShown(LETTER, { timeout: 1000 });
    expect(mockDecodeDecision).not.toHaveBeenCalled();
    expect(out).toEqual({
      success: true,
      modelCalled: false,
      data: {
        ...patternMatchDenial(LETTER),
        _usedFallback: true,
        _fallbackReason: "small_model",
        _fallbackNote: SMALL_MODEL_FALLBACK_NOTE,
      },
    });
    expect(out.data.decision_type).toBe("Mixed Decision");
  });

  it("says so when the patterns find nothing in the text", async () => {
    status.value = SMALL;
    const out = await decodeDecisionAsShown("Nothing of the kind here.");
    expect(out.data.plain_english).toMatch(/found no decision language/);
    expect(out.data._fallbackReason).toBe("small_model");
  });

  it.each([
    ["the larger on-device model", LARGER],
    ["the cloud model", CLOUD],
  ])("with %s sends the letter to decodeDecision as before", async (_n, s) => {
    status.value = s;
    const out = await decodeDecisionAsShown(LETTER, { timeout: 1000 });
    expect(mockDecodeDecision).toHaveBeenCalledWith(LETTER, { timeout: 1000 });
    expect(out).toBe(GOOD_RESPONSE);
  });
});

describe("readingWithoutModel", () => {
  it("is null unless a small-class model would answer", () => {
    status.value = LARGER;
    expect(readingWithoutModel(LETTER)).toBeNull();
    status.value = SMALL;
    expect(readingWithoutModel(LETTER)._fallbackReason).toBe("small_model");
  });
});
