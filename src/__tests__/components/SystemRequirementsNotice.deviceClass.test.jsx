import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const detect = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("../../utils/deviceCapabilityDetector", async (importOriginal) => ({
  ...(await importOriginal()),
  detectDeviceCapabilities: detect.fn,
  getCachedDeviceProfile: () => null,
}));

const { default: SystemRequirementsNotice } =
  await import("../../components/SystemRequirementsNotice");

describe("requirements notice names the GPU class from the shared label", () => {
  it("does not call a high-performance GPU mid-range because the screen is narrow", async () => {
    detect.fn.mockResolvedValue({
      tier: "desktop-mid",
      hasWebGPU: true,
      gpuTier: "high",
      isMobile: false,
      isTablet: false,
      isAppleSilicon: false,
      gpuDescription:
        "ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 SUPER Direct3D11)",
      recommendedModels: ["Qwen3.5-4B-q4f16_1-MLC"],
    });
    render(<SystemRequirementsNotice />);
    const heading = await screen.findByText(/Compatible - /);
    expect(heading.textContent).toMatch(/high-performance GPU/);
    expect(heading.textContent).not.toMatch(/mid-range/);
  });
});
