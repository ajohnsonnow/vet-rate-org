/**
 * No internal code or engine wording reaches the veteran beside a draft.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AI_ERROR_GENERIC, plainAIError } from "../../utils/writerErrorMessage";
import { APP_TRANSLATIONS } from "../../i18n/translations";

const t = (section, key) => APP_TRANSLATIONS[section][key].en;
const INTERNAL = /_[A-Z]|WebGPU|undefined|Error:/;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("plainAIError", () => {
  it.each([
    [
      "AI_CIRCUIT_OPEN: AI generation has failed 4 times in a row; paused for 60s",
      /stopped answering after several failed tries/,
    ],
    ["WebGPU inference timed out", /took too long to answer/],
    ["Request timeout after 120000ms", /took too long to answer/],
    ["GPU device was lost", /ran out of memory/],
    [
      "No AI available. Please configure an API key or enable Local AI.",
      /AI is not configured/,
    ],
    ["Engine not initialized", /not ready yet/],
  ])("%s becomes a plain sentence", (raw, plain) => {
    const shown = plainAIError(raw, t);

    expect(shown).toMatch(plain);
    expect(shown).not.toMatch(INTERNAL);
    expect(shown).not.toMatch(/^⚠️/u);
  });

  it.each([
    "TypeError: Cannot read properties of undefined (reading 'text')",
    "ENGINE_FAULT_17",
    "",
    null,
    undefined,
  ])("anything it does not know (%s) becomes one generic sentence", (raw) => {
    expect(plainAIError(raw, t)).toBe(AI_ERROR_GENERIC);
  });

  it("keeps a message the app wrote for the veteran", () => {
    expect(plainAIError("AI cooling down... please wait 8 seconds.", t)).toBe(
      "AI cooling down... please wait 8 seconds.",
    );
  });
});
