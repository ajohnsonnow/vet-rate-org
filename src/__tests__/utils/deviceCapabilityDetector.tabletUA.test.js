import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const IPAD_TOKEN_UA =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145.0 Safari/537.36";

async function profileFor({ ua, maxTouchPoints, gpu = 268_435_456 }) {
  vi.resetModules();
  vi.stubGlobal("navigator", {
    userAgent: ua,
    maxTouchPoints,
    deviceMemory: 8,
    hardwareConcurrency: 8,
    gpu: {
      requestAdapter: async () => ({
        limits: { maxBufferSize: gpu },
        info: { description: "Test GPU" },
      }),
    },
  });
  vi.stubGlobal("screen", { width: 1180 });
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

describe("tablet detection", () => {
  it("an iPad token in the user agent is a tablet", async () => {
    const p = await profileFor({ ua: IPAD_TOKEN_UA, maxTouchPoints: 5 });
    expect(p).toMatchObject({
      tier: "tablet",
      isTablet: true,
      isMobile: false,
    });
  });

  it("iPadOS Safari (Macintosh user agent with touch points) is a tablet on the tablet model", async () => {
    const p = await profileFor({ ua: MAC_UA, maxTouchPoints: 5 });
    expect(p).toMatchObject({
      tier: "tablet",
      isTablet: true,
      isMobile: false,
    });
    expect(p.recommendedModels[0]).toBe("Qwen2.5-1.5B-Instruct-q4f16_1-MLC");
  });

  it("a real Mac (Macintosh user agent, no touch) stays on the laptop tier", async () => {
    const p = await profileFor({ ua: MAC_UA, maxTouchPoints: 0 });
    expect(p).toMatchObject({ tier: "laptop", isTablet: false });
  });

  it("a Mac that reports a single touch point is not a tablet", async () => {
    const p = await profileFor({ ua: MAC_UA, maxTouchPoints: 1 });
    expect(p.isTablet).toBe(false);
  });

  it("a touch-screen Windows laptop stays on the laptop tier", async () => {
    const p = await profileFor({ ua: WINDOWS_UA, maxTouchPoints: 10 });
    expect(p).toMatchObject({ tier: "laptop", isTablet: false });
  });
});
