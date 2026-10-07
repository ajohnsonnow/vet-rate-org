import { describe, it, expect } from "vitest";
import { friendlyGpuName } from "../../components/SystemRequirementsNotice";

// Covers the ANGLE-wrapper and Direct3D/Metal/Vulkan/OpenGL-suffix strip
// regexes bounded for sonarjs/super-linear-regex, against realistic
// browser-reported WebGPU adapter description strings.
describe("SystemRequirementsNotice: friendlyGpuName", () => {
  it("strips the ANGLE wrapper for an NVIDIA GPU", () => {
    expect(
      friendlyGpuName(
        "ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)",
      ),
    ).toBe("NVIDIA GeForce RTX 4080 SUPER");
  });

  it("strips the ANGLE wrapper for an Intel integrated GPU", () => {
    expect(
      friendlyGpuName(
        "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)",
      ),
    ).toBe("Intel(R) UHD Graphics 630");
  });

  it("passes through a bare Apple Silicon description unwrapped", () => {
    expect(friendlyGpuName("Apple M2 Pro")).toBe("Apple M2 Pro");
  });

  it("returns null for empty input", () => {
    expect(friendlyGpuName("")).toBeNull();
    expect(friendlyGpuName(null)).toBeNull();
  });
});
