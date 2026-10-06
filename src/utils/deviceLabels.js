import { useState, useEffect } from "react";
import {
  detectDeviceCapabilities,
  getCachedDeviceProfile,
} from "./deviceCapabilityDetector";

const GPU_CLASS = {
  high: "high-performance GPU",
  mid: "mid-range GPU",
  low: "basic GPU",
};

function formFactorOf(profile) {
  if (profile.isTablet) return "Tablet";
  if (profile.isMobile) return "Phone";
  if (profile.tier === "laptop") return "Laptop";
  if (profile.tier === "desktop-high" || profile.tier === "desktop-mid") {
    return "Desktop";
  }
  return "Desktop or laptop";
}

export const TABLET_UNTESTED_SENTENCE =
  "It has not been tested on tablets, and large files will be slow.";

/**
 * Whether on-device AI can run on this device, from the same profile that
 * picks the model, with one plain sentence when it cannot. An unprobed device
 * is not ruled out.
 */
export function describeOnDeviceSupport(profile) {
  if (!profile) return { canRun: true, reason: null, tabletNote: null };
  if (profile.isMobile) {
    return {
      canRun: false,
      reason: "On-device AI is not available on phones.",
      tabletNote: null,
    };
  }
  if (!profile.hasWebGPU) {
    return {
      canRun: false,
      reason:
        "On-device AI needs a browser with WebGPU, which this device does not have.",
      tabletNote: null,
    };
  }
  if (profile.canUseWebLLM === false) {
    return {
      canRun: false,
      reason: "On-device AI is not available on this device.",
      tabletNote: null,
    };
  }
  return {
    canRun: true,
    reason: null,
    tabletNote: profile.isTablet ? TABLET_UNTESTED_SENTENCE : null,
  };
}

/**
 * The one place a device tier or GPU class is turned into words. The form
 * factor comes from the profile's tier and flags, the GPU class from the
 * WebGPU limits (gpuTier), so a high-performance GPU on a narrow screen is
 * not described as mid-range. Every screen that names the device uses this.
 */
export function describeDeviceClass(profile) {
  if (!profile) {
    return {
      formFactor: null,
      gpuClass: null,
      label: "Device not checked yet",
    };
  }
  const formFactor = formFactorOf(profile);
  const gpuClass = profile.hasWebGPU
    ? (GPU_CLASS[profile.gpuTier] ?? "basic GPU")
    : "no WebGPU";
  return { formFactor, gpuClass, label: `${formFactor}, ${gpuClass}` };
}

export function useDeviceProfile() {
  const [profile, setProfile] = useState(() => getCachedDeviceProfile());

  useEffect(() => {
    let active = true;
    detectDeviceCapabilities()
      .then((next) => {
        if (active) setProfile(next);
      })
      .catch((err) => {
        console.warn("Could not read the device profile:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  return profile;
}
