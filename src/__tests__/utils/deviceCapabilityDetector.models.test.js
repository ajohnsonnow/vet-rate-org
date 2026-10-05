import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145.0 Safari/537.36";
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const PHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

const DEVICES = {
  "desktop-high": { ua: DESKTOP_UA, gpu: 2_147_483_648, screenWidth: 1920 },
  "desktop-mid": { ua: DESKTOP_UA, gpu: 2_147_483_648, screenWidth: 1280 },
  laptop: { ua: DESKTOP_UA, gpu: 268_435_456, screenWidth: 1280 },
  tablet: { ua: IPAD_UA, gpu: 268_435_456, screenWidth: 1024 },
  mobile: { ua: PHONE_UA, gpu: 268_435_456, screenWidth: 390 },
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

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("on-device model order per tier", () => {
  it("desktop-high loads Qwen3.5-4B first, then the earlier models in their old order", async () => {
    const { recommendedModels } = await profileFor(DEVICES["desktop-high"]);
    expect(recommendedModels).toEqual([
      "Qwen3.5-4B-q4f16_1-MLC",
      "Qwen2.5-3B-Instruct-q4f16_1-MLC",
      "Qwen2.5-3B-Instruct-q4f32_1-MLC",
      "Llama-3.2-3B-Instruct-q4f32_1-MLC",
    ]);
  });

  it("desktop-mid loads Qwen3.5-4B first, then the earlier models in their old order", async () => {
    const { recommendedModels } = await profileFor(DEVICES["desktop-mid"]);
    expect(recommendedModels).toEqual([
      "Qwen3.5-4B-q4f16_1-MLC",
      "Qwen2.5-3B-Instruct-q4f16_1-MLC",
      "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
    ]);
  });

  it("laptop loads Qwen3.5-2B first, then the earlier models in their old order", async () => {
    const { recommendedModels } = await profileFor(DEVICES.laptop);
    expect(recommendedModels).toEqual([
      "Qwen3.5-2B-q4f16_1-MLC",
      "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
      "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    ]);
  });

  it("tablet stays on its earlier model: the 2B needs about 0.6 GB more than the tablet plans for", async () => {
    const { recommendedModels } = await profileFor(DEVICES.tablet);
    expect(recommendedModels).toEqual([
      "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
    ]);
  });

  it("a phone still has no on-device model", async () => {
    const profile = await profileFor(DEVICES.mobile);
    expect(profile.recommendedModels).toEqual([]);
    expect(profile.canUseWebLLM).toBe(false);
  });

  it("keeps each tier's context window", async () => {
    const windows = {};
    for (const tier of ["desktop-high", "desktop-mid", "laptop", "tablet"]) {
      windows[tier] = (await profileFor(DEVICES[tier])).contextWindowSize;
    }
    expect(windows).toEqual({
      "desktop-high": 12288,
      "desktop-mid": 8192,
      laptop: 8192,
      tablet: 8192,
    });
  });
});

describe("describeDeviceModel for the Qwen3.5 models", () => {
  it("reports the 4B with the WebLLM memory figure and no invented download size", async () => {
    vi.resetModules();
    const { describeDeviceModel } =
      await import("../../utils/deviceCapabilityDetector");
    expect(
      describeDeviceModel({ recommendedModels: ["Qwen3.5-4B-q4f16_1-MLC"] }),
    ).toEqual({
      modelId: "Qwen3.5-4B-q4f16_1-MLC",
      displayName: "Qwen 3.5 4B",
      downloadGB: null,
      vramGB: 3.9,
    });
  });

  it("reports the 2B the same way", async () => {
    vi.resetModules();
    const { describeDeviceModel } =
      await import("../../utils/deviceCapabilityDetector");
    expect(
      describeDeviceModel({ recommendedModels: ["Qwen3.5-2B-q4f16_1-MLC"] }),
    ).toEqual({
      modelId: "Qwen3.5-2B-q4f16_1-MLC",
      displayName: "Qwen 3.5 2B",
      downloadGB: null,
      vramGB: 2.2,
    });
  });
});
