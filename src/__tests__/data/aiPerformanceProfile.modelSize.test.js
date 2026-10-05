import { describe, it, expect } from "vitest";
import { AI_REQUIREMENTS, AI_WARMUP } from "../../data/aiPerformanceProfile";

describe("on-device model size copy", () => {
  it("states no download size, because the model differs by device and none is stated in the WebLLM config", () => {
    expect(AI_REQUIREMENTS.model.sizeGB).toBeUndefined();
    expect(AI_REQUIREMENTS.model.sizeNote).toBe("size varies by device");
  });

  it("tells the veteran it is a one-time download kept on the device", () => {
    expect(AI_REQUIREMENTS.model.cachedAfterFirstDownload).toBe(true);
    expect(AI_REQUIREMENTS.model.note).toMatch(/one time/i);
    expect(AI_REQUIREMENTS.model.note).toMatch(/kept on your device/);
  });

  it("does not carry the earlier model's 1.7 GB figure into the warm-up text", () => {
    for (const phase of Object.values(AI_WARMUP)) {
      expect(phase.reason).not.toMatch(/1\.7 GB/);
    }
  });
});
