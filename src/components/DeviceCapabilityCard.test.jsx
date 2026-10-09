import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const profile = vi.hoisted(() => ({
  value: {
    tier: "desktop-mid",
    hasWebGPU: true,
    gpuTier: "high",
    isMobile: false,
    isTablet: false,
  },
}));
vi.mock("../utils/deviceLabels", async (importOriginal) => ({
  ...(await importOriginal()),
  useDeviceProfile: () => profile.value,
}));

import DeviceCapabilityCard from "./DeviceCapabilityCard";

describe("DeviceCapabilityCard", () => {
  it("shows the shared device label, not a separate tier name", () => {
    render(
      <DeviceCapabilityCard
        webGPUStatus={{ supported: true, device: "Test GPU" }}
      />,
    );
    expect(screen.getByText("Desktop, high-performance GPU")).toBeTruthy();
    expect(screen.queryByText(/High-End|Mid-Range|Unknown/)).toBeNull();
  });

  it("says WebGPU is not available on a desktop without it, not Unknown", () => {
    profile.value = {
      tier: "mobile",
      hasWebGPU: false,
      gpuTier: "none",
      isMobile: false,
      isTablet: false,
    };
    render(<DeviceCapabilityCard webGPUStatus={{ supported: false }} />);
    expect(screen.getByText("Desktop or laptop, no WebGPU")).toBeTruthy();
    expect(screen.queryByText(/Unknown/)).toBeNull();
  });
});
