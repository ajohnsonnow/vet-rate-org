import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AI_REQUIREMENTS } from "../../data/aiPerformanceProfile";

const detect = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("../../utils/deviceCapabilityDetector", async (importOriginal) => ({
  ...(await importOriginal()),
  detectDeviceCapabilities: detect.fn,
}));

const { default: SystemRequirementsNotice } =
  await import("../../components/SystemRequirementsNotice");

const laptop = {
  tier: "laptop",
  hasWebGPU: true,
  gpuTier: "mid",
  isMobile: false,
  isTablet: false,
  isAppleSilicon: false,
  gpuDescription: "Test GPU",
  recommendedModels: ["Qwen3.5-2B-q4f16_1-MLC"],
};

beforeEach(() => vi.clearAllMocks());

describe("laptop notice says the smaller model runs on the GPU", () => {
  it("names the 2B and its size and does not say the CPU or WASM does the work", async () => {
    detect.fn.mockResolvedValue(laptop);
    const { container } = render(<SystemRequirementsNotice />);
    await screen.findByText(/Limited GPU - smaller AI model/);
    const text = container.textContent;
    expect(text).toMatch(/loads Qwen 3\.5 2B \(about 1\.1 GB\) on your GPU/);
    expect(text).not.toMatch(/WASM|your CPU|CPU fallback/);
    expect(text).not.toMatch(/6 GB VRAM minimum for on-device inference/);
  });

  it("falls back to a plain phrase when no model is known", async () => {
    detect.fn.mockResolvedValue({ ...laptop, recommendedModels: [] });
    const { container } = render(<SystemRequirementsNotice />);
    await screen.findByText(/Limited GPU - smaller AI model/);
    expect(container.textContent).toMatch(
      /loads a smaller AI model on your GPU/,
    );
  });

  it("compact laptop line also says GPU, not CPU", async () => {
    detect.fn.mockResolvedValue(laptop);
    const { container } = render(<SystemRequirementsNotice compact />);
    await screen.findByText(/smaller AI model on the GPU/);
    expect(container.textContent).not.toMatch(/WASM|CPU/);
  });
});

describe("no usable GPU is the blocked state, not the laptop state", () => {
  const noGpu = {
    ...laptop,
    tier: "mobile",
    hasWebGPU: false,
    gpuTier: "none",
    recommendedModels: [],
  };

  it("full card says there is no WebGPU adapter", async () => {
    detect.fn.mockResolvedValue(noGpu);
    const { container } = render(<SystemRequirementsNotice />);
    await screen.findByText(/On-device AI not available on this device/);
    expect(container.textContent).toMatch(/does not expose a WebGPU adapter/);
    expect(container.textContent).not.toMatch(/Limited GPU/);
  });
});

describe("browser text matches what was tested", () => {
  const claim =
    /Chrome and Edge are tested, and Safari works on recent versions/;

  it("compact no-WebGPU line asks for a browser with WebGPU", async () => {
    detect.fn.mockResolvedValue({ ...laptop, hasWebGPU: false });
    const { container } = render(<SystemRequirementsNotice compact />);
    await screen.findByText(/WebGPU is not available in this browser/);
    expect(container.textContent).toMatch(/needs a browser with WebGPU/);
    expect(container.textContent).toMatch(claim);
  });

  it("requirements list no longer says Safari lacks WebGPU and claims no iPhone or iPad", async () => {
    detect.fn.mockResolvedValue(laptop);
    const { container } = render(<SystemRequirementsNotice />);
    fireEvent.click(await screen.findByText("Minimum requirements"));
    const text = container.textContent;
    expect(text).toMatch(claim);
    expect(text).not.toMatch(/Safari do(es)? not|Firefox and Safari/);
    expect(text).not.toMatch(/iPhone|iPad|iOS/);
  });

  it("the data file keeps no browser claim of its own", () => {
    expect(AI_REQUIREMENTS).not.toHaveProperty("browser");
    expect(AI_REQUIREMENTS).not.toHaveProperty("browserNote");
  });
});
