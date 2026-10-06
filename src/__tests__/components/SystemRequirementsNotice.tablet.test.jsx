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
const { describeDeviceModel } =
  await import("../../utils/deviceCapabilityDetector");

const TABLET = {
  tier: "tablet",
  hasWebGPU: true,
  gpuTier: "mid",
  isMobile: false,
  isTablet: true,
  isAppleSilicon: false,
  gpuDescription: "",
  canUseWebLLM: true,
  recommendedModels: [
    "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
  ],
};

describe("tablet copy comes from the device profile", () => {
  it("a tablet with WebGPU is told it can load the profile's model, and is not told tablets are unsupported", async () => {
    detect.fn.mockResolvedValue(TABLET);
    render(<SystemRequirementsNotice />);
    const notice = await screen.findByText(/Tablet detected/);
    const model = describeDeviceModel(TABLET);
    expect(notice.textContent).toContain(model.displayName);
    expect(notice.textContent).toContain(`about ${model.downloadGB} GB`);
    expect(notice.textContent).toMatch(/not been tested on tablets/);
    expect(document.body.textContent).not.toMatch(
      /Phone and tablet detected|Phones and tablets are not supported/,
    );
  });

  it("the compact variant says the same", async () => {
    detect.fn.mockResolvedValue(TABLET);
    render(<SystemRequirementsNotice compact />);
    const notice = await screen.findByText(/Tablet/);
    expect(notice.textContent).toContain("Qwen 2.5 1.5B");
    expect(notice.textContent).not.toMatch(/not supported/);
  });

  it("a tablet without WebGPU is told WebGPU is missing", async () => {
    detect.fn.mockResolvedValue({
      ...TABLET,
      hasWebGPU: false,
      gpuTier: "none",
    });
    render(<SystemRequirementsNotice />);
    await screen.findByText(/On-device AI not available on this device/);
    expect(document.body.textContent).toMatch(/WebGPU/);
    expect(document.body.textContent).not.toMatch(/Phone and tablet/);
  });

  it("a phone is told on-device AI is not available on phones", async () => {
    detect.fn.mockResolvedValue({
      ...TABLET,
      tier: "mobile",
      isTablet: false,
      isMobile: true,
      canUseWebLLM: false,
      recommendedModels: [],
    });
    render(<SystemRequirementsNotice />);
    await screen.findByText(/Phone detected/);
    expect(document.body.textContent).not.toMatch(/Phone and tablet/);
  });
});
