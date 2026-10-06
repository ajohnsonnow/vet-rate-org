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
vi.mock("../utils/deviceLabels", async (importOriginal) => ({
  ...(await importOriginal()),
  useDeviceProfile: () => ({
    tier: "desktop-mid",
    hasWebGPU: true,
    gpuTier: "high",
    isMobile: false,
    isTablet: false,
  }),
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
