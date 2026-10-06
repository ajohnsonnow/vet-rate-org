import { describe, it, expect } from "vitest";
import { describeDeviceClass } from "./deviceLabels";

const base = {
  hasWebGPU: true,
  isMobile: false,
  isTablet: false,
  gpuTier: "high",
};

describe("describeDeviceClass renders one label from the device profile", () => {
  it.each([
    [
      "a desktop-mid profile on a high-performance GPU (narrow screen)",
      { ...base, tier: "desktop-mid" },
      "Desktop, high-performance GPU",
    ],
    [
      "desktop-high",
      { ...base, tier: "desktop-high" },
      "Desktop, high-performance GPU",
    ],
    [
      "laptop on a mid-range GPU",
      { ...base, tier: "laptop", gpuTier: "mid" },
      "Laptop, mid-range GPU",
    ],
    [
      "tablet",
      { ...base, tier: "tablet", isTablet: true, gpuTier: "mid" },
      "Tablet, mid-range GPU",
    ],
    [
      "phone",
      { ...base, tier: "mobile", isMobile: true, gpuTier: "low" },
      "Phone, basic GPU",
    ],
    [
      "a desktop with no WebGPU (internal tier name mobile)",
      { ...base, tier: "mobile", hasWebGPU: false, gpuTier: "none" },
      "Desktop or laptop, no WebGPU",
    ],
  ])("%s", (_name, profile, label) => {
    expect(describeDeviceClass(profile).label).toBe(label);
  });

  it("never calls a device without WebGPU a mobile device unless it is a phone", () => {
    const { label } = describeDeviceClass({
      ...base,
      tier: "mobile",
      hasWebGPU: false,
      gpuTier: "none",
    });
    expect(label).not.toMatch(/mobile|phone|unknown/i);
  });

  it("says the device is not checked yet when there is no profile", () => {
    expect(describeDeviceClass(null).label).toBe("Device not checked yet");
  });

  it("exposes the GPU class on its own for the notice heading", () => {
    expect(describeDeviceClass({ ...base, tier: "desktop-mid" }).gpuClass).toBe(
      "high-performance GPU",
    );
  });
});
