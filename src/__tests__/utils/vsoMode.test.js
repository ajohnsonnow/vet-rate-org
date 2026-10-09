import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isVsoModeEnabled } from "../../config/vsoMode";
import { VSO_REGISTRY_KEY } from "../../utils/siloScope";
import { isVsoModeActive } from "../../utils/vsoRegistry";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isVsoModeEnabled", () => {
  it("is off when the variable is unset", () => {
    vi.stubEnv("VITE_VSO_MODE_ENABLED", undefined);
    expect(isVsoModeEnabled()).toBe(false);
  });

  it.each(["true", "TRUE", "True"])("is on for %j", (value) => {
    vi.stubEnv("VITE_VSO_MODE_ENABLED", value);
    expect(isVsoModeEnabled()).toBe(true);
  });

  it.each(["false", "FALSE", "", "1", "yes", "on", "tru", " true", "true "])(
    "is off for %j",
    (value) => {
      vi.stubEnv("VITE_VSO_MODE_ENABLED", value);
      expect(isVsoModeEnabled()).toBe(false);
    },
  );
});

// AC8: the flag gates only the entry point. An existing registry keeps the
// VSO code paths running whatever the flag says, so data is never stranded.
describe("AC8 flag logic", () => {
  it("flag off and no registry: the entry point is hidden and VSO mode is off", () => {
    vi.stubEnv("VITE_VSO_MODE_ENABLED", "false");
    expect(isVsoModeEnabled()).toBe(false);
    expect(isVsoModeActive()).toBe(false);
  });

  it("flag off with a registry present: the entry point is hidden but VSO mode is still active", () => {
    vi.stubEnv("VITE_VSO_MODE_ENABLED", "false");
    localStorage.setItem(
      VSO_REGISTRY_KEY,
      JSON.stringify({ version: 1, silos: [] }),
    );
    expect(isVsoModeEnabled()).toBe(false);
    expect(isVsoModeActive()).toBe(true);
  });

  it("flag off with an unreadable registry: VSO mode is still active", () => {
    vi.stubEnv("VITE_VSO_MODE_ENABLED", "false");
    localStorage.setItem(VSO_REGISTRY_KEY, "{garbage");
    expect(isVsoModeActive()).toBe(true);
  });

  it("flag on and no registry: the entry point shows but VSO mode is not yet active", () => {
    vi.stubEnv("VITE_VSO_MODE_ENABLED", "true");
    expect(isVsoModeEnabled()).toBe(true);
    expect(isVsoModeActive()).toBe(false);
  });
});
