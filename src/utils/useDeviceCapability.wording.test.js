import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const gpu = vi.hoisted(() => ({ supported: true }));
vi.mock("./unifiedAIService", () => ({
  checkWebGPUSupport: async () => ({ supported: gpu.supported }),
}));

const { useDeviceCapability } = await import("./useDeviceCapability");

beforeEach(() => {
  vi.stubGlobal("innerWidth", 1920);
  delete window.ontouchstart;
  vi.stubGlobal("navigator", {
    ...window.navigator,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/145.0",
    maxTouchPoints: 0,
  });
});

describe("device advice wording on a desktop", () => {
  it("does not say data stays on a phone when the device is a desktop with WebGPU", async () => {
    gpu.supported = true;
    const { result } = renderHook(() => useDeviceCapability());
    await waitFor(() => expect(result.current.advice).not.toBeNull());
    const text = JSON.stringify(result.current.advice);
    expect(text).not.toMatch(/phone/i);
    expect(result.current.advice.localAI.description).toMatch(
      /No data leaves your device/,
    );
  });

  it("a desktop without WebGPU is told WebGPU is missing, not that it is a mobile or unknown device", async () => {
    gpu.supported = false;
    const { result } = renderHook(() => useDeviceCapability());
    await waitFor(() => expect(result.current.advice).not.toBeNull());
    const text = JSON.stringify(result.current.advice);
    expect(text).toMatch(/WebGPU/);
    expect(text).not.toMatch(/phone|mobile|unknown/i);
  });
});
