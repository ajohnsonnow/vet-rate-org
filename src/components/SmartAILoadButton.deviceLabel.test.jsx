import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../utils/smartAILoader", () => ({
  smartLoadAI: vi.fn(),
  checkModelMatch: () => ({
    isCorrect: false,
    action: "load",
    recommendedModel: { id: "x", name: "The Auditor", reason: "test" },
  }),
}));
const profile = vi.hoisted(() => ({
  value: {
    tier: "desktop-mid",
    hasWebGPU: true,
    gpuTier: "high",
    isMobile: false,
    isTablet: false,
    canUseWebLLM: true,
  },
}));
vi.mock("../utils/deviceLabels", async (importOriginal) => ({
  ...(await importOriginal()),
  useDeviceProfile: () => profile.value,
}));

const SmartAILoadButton = (await import("./SmartAILoadButton.jsx")).default;

describe("SmartAILoadButton device line", () => {
  it("uses the shared device label", async () => {
    render(<SmartAILoadButton toolId="decision-decoder" />);
    expect(
      await screen.findByText("Desktop, high-performance GPU"),
    ).toBeTruthy();
  });
});

describe("SmartAILoadButton on a device that cannot run on-device AI", () => {
  it("offers no load button and says why in one sentence", async () => {
    profile.value = {
      tier: "tablet",
      hasWebGPU: false,
      gpuTier: "none",
      isMobile: false,
      isTablet: true,
      canUseWebLLM: true,
    };
    render(<SmartAILoadButton toolId="decision-decoder" />);
    expect(await screen.findByText(/needs a browser with WebGPU/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/Load The Auditor/)).toBeNull();
  });
});
