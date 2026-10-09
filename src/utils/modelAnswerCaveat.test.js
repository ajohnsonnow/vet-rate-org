import { describe, it, expect } from "vitest";
import { APP_TRANSLATIONS } from "../i18n/translations";
import {
  MODEL_ANSWER_CAVEAT,
  isModelWrittenOnDevice,
  onDeviceModelAnswering,
} from "./modelAnswerCaveat";

const swarm = (model) => ({
  effectiveMode: "swarm",
  swarmAvailable: true,
  swarmStatus: { model },
});
const LARGER = swarm("Qwen3.5-4B-q4f16_1-MLC");
const SMALL = swarm("Qwen3.5-2B-q4f16_1-MLC");

describe("the fixed line's translations", () => {
  it("English is the constant; every shipped locale has a non-empty line", () => {
    const line = APP_TRANSLATIONS.modelAnswerCaveat.line;
    expect(line.en).toBe(MODEL_ANSWER_CAVEAT);
    for (const lang of ["es", "tl", "vi", "ko"]) {
      expect(line[lang].trim().length).toBeGreaterThan(20);
    }
  });
});

describe("isModelWrittenOnDevice", () => {
  it("is true for a model's on-device answer from a model that is not small-class", () => {
    expect(isModelWrittenOnDevice({ onDevice: true, text: "x" }, LARGER)).toBe(
      true,
    );
  });

  it.each([
    ["a calculator answer", { onDevice: true, modelCalled: false }],
    ["the open-advice message", { onDevice: true, openAdviceHeld: true }],
    ["a cloud answer", { onDevice: false }],
    ["no result", undefined],
  ])("is false for %s", (_n, result) => {
    expect(isModelWrittenOnDevice(result, LARGER)).toBe(false);
  });

  it("is false while a small-class model answers: it has its own caveat", () => {
    expect(isModelWrittenOnDevice({ onDevice: true }, SMALL)).toBe(false);
  });
});

describe("onDeviceModelAnswering", () => {
  it("is true for an on-device mode with a larger model, false for cloud or small", () => {
    expect(onDeviceModelAnswering(LARGER)).toBe(true);
    expect(onDeviceModelAnswering(SMALL)).toBe(false);
    expect(onDeviceModelAnswering({ effectiveMode: "cloud" })).toBe(false);
    expect(onDeviceModelAnswering(undefined)).toBe(false);
  });
});
