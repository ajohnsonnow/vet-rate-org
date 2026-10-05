/**
 * Every tier that loads an on-device model must be able to hold what the
 * swarm always sends (the persona as the system message and the default
 * system prompt folded into the user turn) and still leave room for output.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSystemPrompt } from "../../utils/aiSystemPrompts";
import { SWARM_AGENTS } from "../../utils/diamondSwarm";
import {
  CHARS_PER_TOKEN,
  OUTPUT_RESERVE_TOKENS,
  planPromptFit,
} from "../../utils/promptBudget";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145.0 Safari/537.36";
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const PHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const HIGH_GPU = 2_147_483_648;
const MID_GPU = 268_435_456;

const DEVICES = {
  "desktop-high": { ua: DESKTOP_UA, gpu: HIGH_GPU, screenWidth: 1920 },
  "desktop-mid": { ua: DESKTOP_UA, gpu: HIGH_GPU, screenWidth: 1280 },
  laptop: { ua: DESKTOP_UA, gpu: MID_GPU, screenWidth: 1280 },
  tablet: { ua: IPAD_UA, gpu: MID_GPU, screenWidth: 1024 },
};

async function profileFor({ ua, gpu, screenWidth }) {
  vi.resetModules();
  vi.stubGlobal("navigator", {
    userAgent: ua,
    deviceMemory: 8,
    hardwareConcurrency: 8,
    gpu: {
      requestAdapter: async () => ({
        limits: { maxBufferSize: gpu },
        info: { description: "Test GPU" },
      }),
    },
  });
  vi.stubGlobal("screen", { width: screenWidth });
  const { detectDeviceCapabilities } =
    await import("../../utils/deviceCapabilityDetector");
  return detectDeviceCapabilities();
}

const ALWAYS_SENT =
  Math.max(...Object.values(SWARM_AGENTS).map((a) => a.systemPrompt.length)) +
  buildSystemPrompt({ task: "general" }).length;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("context window per device tier", () => {
  it.each([
    ["desktop-high", 12288],
    ["desktop-mid", 8192],
    ["laptop", 8192],
    ["tablet", 8192],
  ])("%s loads the engine with %i tokens", async (tier, contextWindow) => {
    const profile = await profileFor(DEVICES[tier]);
    expect(profile.tier).toBe(tier);
    expect(profile.canUseWebLLM).toBe(true);
    expect(profile.contextWindowSize).toBe(contextWindow);
  });

  it("a phone loads no on-device model, so its window is never used", async () => {
    const profile = await profileFor({
      ua: PHONE_UA,
      gpu: MID_GPU,
      screenWidth: 390,
    });
    expect(profile.tier).toBe("mobile");
    expect(profile.canUseWebLLM).toBe(false);
  });

  it("the tablet runs a model the laptop tier also lists, at the same 8,192", async () => {
    const tablet = await profileFor(DEVICES.tablet);
    const laptop = await profileFor(DEVICES.laptop);
    expect(laptop.recommendedModels).toContain(tablet.recommendedModels[0]);
    expect(tablet.contextWindowSize).toBe(laptop.contextWindowSize);
  });

  it.each(Object.keys(DEVICES))(
    "%s holds the persona and the default prompt beside the output reserve, with room for the computed block",
    async (tier) => {
      const { contextWindowSize } = await profileFor(DEVICES[tier]);
      expect(ALWAYS_SENT).toBe(2906 + 12177);
      expect(
        (contextWindowSize - OUTPUT_RESERVE_TOKENS) * CHARS_PER_TOKEN,
      ).toBeGreaterThan(ALWAYS_SENT);
      const plan = planPromptFit({
        contextWindow: contextWindowSize,
        requestedOutputTokens: OUTPUT_RESERVE_TOKENS,
        fixedChars: ALWAYS_SENT + 200,
        computedChars: 900,
      });
      expect(plan.keepComputed).toBe(true);
    },
  );

  it("4,096 tokens, the tablet's earlier window, could not hold them at any output size", () => {
    expect(ALWAYS_SENT / CHARS_PER_TOKEN).toBeGreaterThan(4096);
  });
});
