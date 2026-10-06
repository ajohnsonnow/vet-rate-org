import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapAssistantErrorMessage } from "./assistantErrorMessage";

const t = (section, key) => `${section}.${key}`;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("mapAssistantErrorMessage", () => {
  it.each([
    ["No AI available. Set one up.", "aiAssistant.errorNoAI"],
    ["CRISIS_DETECTED", "aiAssistant.errorCrisis"],
    ["AI is temporarily disabled", "aiAssistant.errorDisabled"],
    ["model returned an empty response", "aiAssistant.errorEmptyResponse"],
    ["engine not initialized", "aiAssistant.errorNotReady"],
    ["model not loaded", "aiAssistant.errorNotReady"],
  ])(
    "maps the expected state %j without logging an error",
    (message, shown) => {
      expect(mapAssistantErrorMessage(new Error(message), t)).toBe(shown);
      expect(console.error).not.toHaveBeenCalled();
    },
  );

  it("still logs an error for an unexpected failure", () => {
    const shown = mapAssistantErrorMessage(new Error("GPU exploded"), t);
    expect(shown).toBe("⚠️ GPU exploded");
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("logs and shows the generic message when there is no message", () => {
    expect(mapAssistantErrorMessage(undefined, t)).toBe(
      "aiAssistant.errorGeneric",
    );
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
