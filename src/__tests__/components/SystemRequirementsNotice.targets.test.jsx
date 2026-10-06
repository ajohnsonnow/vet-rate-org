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

describe("requirements notice expand toggles", () => {
  it("are 44px targets", async () => {
    detect.fn.mockResolvedValue({
      tier: "desktop-high",
      hasWebGPU: true,
      gpuTier: "high",
      isMobile: false,
      isTablet: false,
      isAppleSilicon: false,
      gpuDescription: "",
      recommendedModels: ["Qwen3.5-4B-q4f16_1-MLC"],
    });
    render(<SystemRequirementsNotice />);
    for (const name of [/Why does this take so long/, /Minimum requirements/]) {
      const toggle = await screen.findByRole("button", { name });
      expect(toggle.className).toMatch(/min-h-\[44px\]/);
    }
  });
});
