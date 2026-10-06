import { describe, it, expect } from "vitest";
import {
  describeDeviceClass,
  describeOnDeviceSupport,
  TABLET_UNTESTED_SENTENCE,
} from "./deviceLabels";

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

describe("describeOnDeviceSupport", () => {
  const profile = (extra) => ({ ...base, tier: "desktop-high", ...extra });

  it("a device that can run on-device AI says nothing against it", () => {
    expect(describeOnDeviceSupport(profile({ canUseWebLLM: true }))).toEqual({
      canRun: true,
      reason: null,
      tabletNote: null,
    });
  });

  it("a tablet with WebGPU can run it, with the untested sentence from one source", () => {
    const out = describeOnDeviceSupport(
      profile({ tier: "tablet", isTablet: true, canUseWebLLM: true }),
    );
    expect(out.canRun).toBe(true);
    expect(out.tabletNote).toBe(TABLET_UNTESTED_SENTENCE);
    expect(TABLET_UNTESTED_SENTENCE).toMatch(/not been tested on tablets/);
  });

  it.each([
    [
      "no WebGPU, on any tier",
      profile({ hasWebGPU: false, gpuTier: "none", canUseWebLLM: true }),
      /needs a browser with WebGPU/,
    ],
    [
      "a tablet without WebGPU",
      profile({
        tier: "tablet",
        isTablet: true,
        hasWebGPU: false,
        canUseWebLLM: true,
      }),
      /needs a browser with WebGPU/,
    ],
    [
      "a phone",
      profile({ tier: "mobile", isMobile: true, canUseWebLLM: false }),
      /not available on phones/,
    ],
    [
      "a tier the profile says cannot use WebLLM",
      profile({ canUseWebLLM: false }),
      /not available on this device/,
    ],
  ])("%s cannot run it and says why in one sentence", (_n, p, reason) => {
    const out = describeOnDeviceSupport(p);
    expect(out.canRun).toBe(false);
    expect(out.reason).toMatch(reason);
    expect(out.reason.match(/\./g)).toHaveLength(1);
  });

  it("an unprobed device is not ruled out", () => {
    expect(describeOnDeviceSupport(null).canRun).toBe(true);
  });
});
