/**
 * No writing tool asks a small on-device model to reword anything. In two
 * real runs the 2B model dropped a fact, garbled a sentence and moved a
 * present symptom into the past, and the passage check let them through.
 * When the model that would answer is in the small class (the test the
 * small-model note uses), the veteran gets the app-built draft with no
 * model call. A larger on-device model and cloud AI are still asked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { APP_TRANSLATIONS } from "../../i18n/translations";
import {
  SMALL_MODEL_REWORDING_OFF,
  rewordingOffNote,
} from "../../utils/writerTemplates";

const status = vi.hoisted(() => ({ value: {} }));

vi.mock("../../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => true,
  getAIStatus: () => status.value,
  generateAI: vi.fn(async () => ({ text: "1. unchanged", mode: "swarm" })),
}));

const { generateAI } = await import("../../utils/unifiedAIService");
const {
  enhanceAppealStatement,
  enhanceFormStatement,
  enhancePTSDStatement,
  enhancePersonalStatement,
  generateNexusLetterRequest,
} = await import("../../utils/aiStatementHelper");

const onDevice = (model) => ({
  statusText: "Local AI",
  effectiveMode: "swarm",
  swarmAvailable: true,
  swarmStatus: { model },
});
const TYPED = "Numb fingers, dropping tools, trouble with buttons";
const TOOLS = [
  [
    "enhancePersonalStatement",
    () => enhancePersonalStatement({ specificExamples: TYPED }, "Neck strain"),
  ],
  [
    "enhancePTSDStatement",
    () => enhancePTSDStatement({ eventDescription: TYPED }),
  ],
  [
    "enhanceAppealStatement",
    () =>
      enhanceAppealStatement({ conditionName: "Neck", whyIncorrect: TYPED }),
  ],
  [
    "generateNexusLetterRequest",
    () =>
      generateNexusLetterRequest({ conditionName: "Neck", symptoms: TYPED }),
  ],
  [
    "enhanceFormStatement (personal)",
    () => enhanceFormStatement("personal-statement", { worstDays: TYPED }),
  ],
  [
    "enhanceFormStatement (PTSD)",
    () => enhanceFormStatement("ptsd-stressor", { eventDescription: TYPED }),
  ],
];

beforeEach(() => {
  localStorage.clear();
  generateAI.mockClear();
});

describe.each(TOOLS)("%s", (_name, run) => {
  it.each(["Qwen3.5-2B-q4f16_1-MLC", "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"])(
    "makes no model call when the small model %s would answer",
    async (model) => {
      status.value = onDevice(model);
      const result = await run();

      expect(generateAI).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        success: true,
        draftPath: "template",
        rewordingOff: "small-model",
        passages: { sent: 0, accepted: 0, unchanged: 0, rejected: 0 },
      });
      expect(result.content).toContain(TYPED);
      expect(result.draftNote.startsWith(SMALL_MODEL_REWORDING_OFF)).toBe(true);
    },
  );

  it("asks a larger on-device model", async () => {
    status.value = onDevice("Qwen3.5-4B-q4f16_1-MLC");
    const result = await run();

    expect(generateAI).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty("rewordingOff");
  });

  it("asks cloud AI, whatever small model is also loaded", async () => {
    status.value = {
      ...onDevice("Qwen3.5-2B-q4f16_1-MLC"),
      effectiveMode: "cloud",
    };
    await run();

    expect(generateAI).toHaveBeenCalledTimes(1);
  });
});

describe("the small-model reason", () => {
  it("says in plain words why the draft was not reworded", () => {
    expect(SMALL_MODEL_REWORDING_OFF).toMatch(/small/i);
    expect(SMALL_MODEL_REWORDING_OFF).toMatch(/your own words|as you typed/i);
    expect(SMALL_MODEL_REWORDING_OFF).not.toMatch(/2B|Qwen|swarm/);
    expect(rewordingOffNote({ rewordingOff: "small-model" })).toBe(
      SMALL_MODEL_REWORDING_OFF,
    );
    expect(rewordingOffNote({ draftPath: "template" })).toBeNull();
  });

  it("is in every language the app ships, and English matches the source", () => {
    const { rewordingOff } = APP_TRANSLATIONS.smallModelCaveat;

    expect(rewordingOff.en).toBe(SMALL_MODEL_REWORDING_OFF);
    for (const lang of ["es", "tl", "vi", "ko"]) {
      expect(rewordingOff[lang].length).toBeGreaterThan(40);
      expect(rewordingOff[lang]).not.toBe(rewordingOff.en);
    }
    expect(
      rewordingOffNote({ rewordingOff: "small-model" }, rewordingOff.es),
    ).toBe(rewordingOff.es);
    expect(rewordingOffNote({ rewordingOff: "small-model" }, "")).toBe(
      SMALL_MODEL_REWORDING_OFF,
    );
  });
});
