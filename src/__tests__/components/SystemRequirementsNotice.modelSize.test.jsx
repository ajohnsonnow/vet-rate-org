import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const detect = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("../../utils/deviceCapabilityDetector", async (importOriginal) => ({
  ...(await importOriginal()),
  detectDeviceCapabilities: detect.fn,
}));

const { default: SystemRequirementsNotice } =
  await import("../../components/SystemRequirementsNotice");

const profile = (tier, recommendedModels) => ({
  tier,
  hasWebGPU: true,
  isMobile: false,
  isTablet: false,
  isAppleSilicon: false,
  gpuDescription: "Test GPU",
  recommendedModels,
});

beforeEach(() => vi.clearAllMocks());

describe("system requirements notice states the first download", () => {
  it("tells a desktop veteran the 4B is about 2.4 GB, one time, before anything downloads", async () => {
    detect.fn.mockResolvedValue(
      profile("desktop-high", ["Qwen3.5-4B-q4f16_1-MLC"]),
    );
    render(<SystemRequirementsNotice />);
    const first = await screen.findByText(/First run:/);
    expect(first.parentElement.textContent).toMatch(
      /downloading Qwen 3\.5 4B, about 2\.4 GB/,
    );
    expect(first.parentElement.textContent).toMatch(/one-time/);
  });

  it("lists the same size and that it is kept on the device in the requirements", async () => {
    detect.fn.mockResolvedValue(
      profile("desktop-high", ["Qwen3.5-4B-q4f16_1-MLC"]),
    );
    render(<SystemRequirementsNotice />);
    fireEvent.click(await screen.findByText("Minimum requirements"));
    const line = (await screen.findByText(/First-time download:/))
      .parentElement;
    expect(line.textContent).toMatch(/about 2\.4 GB/);
    expect(line.textContent).toMatch(/kept on your device/);
  });

  it("says the size varies when the model is not known", async () => {
    detect.fn.mockResolvedValue(profile("desktop-high", []));
    render(<SystemRequirementsNotice />);
    const first = await screen.findByText(/First run:/);
    expect(first.parentElement.textContent).toMatch(/size varies/);
  });
});
