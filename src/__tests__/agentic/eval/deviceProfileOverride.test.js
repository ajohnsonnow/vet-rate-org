/**
 * The golden-set browser spec forces a WebLLM model id by editing the cached
 * device profile before initializeSwarm reads it. That only works while
 * detectDeviceCapabilities() hands out the one cached object and
 * initializeSwarm() reads recommendedModels from it, so this pins the first
 * half (the second is a direct read in diamondSwarm.js initializeSwarm).
 */
import { describe, it, expect } from "vitest";
import {
  detectDeviceCapabilities,
  getCachedDeviceProfile,
} from "../../../utils/deviceCapabilityDetector";

describe("device profile is a shared, mutable object", () => {
  it("returns the same object every call and through the cache getter", async () => {
    const profile = await detectDeviceCapabilities();
    profile.recommendedModels = ["Some-New-Model-q4f16_1-MLC"];
    profile.contextWindowSize = 16384;

    const again = await detectDeviceCapabilities();
    expect(again).toBe(profile);
    expect(getCachedDeviceProfile()).toBe(profile);
    expect(again.recommendedModels).toEqual(["Some-New-Model-q4f16_1-MLC"]);
    expect(getCachedDeviceProfile().contextWindowSize).toBe(16384);
  });
});
