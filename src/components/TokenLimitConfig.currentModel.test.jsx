import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const status = vi.hoisted(() => ({ value: {} }));
vi.mock("../utils/unifiedAIService", () => ({
  getAIStatus: () => status.value,
}));

import TokenLimitConfig from "./TokenLimitConfig";

const NONE = {
  effectiveMode: "cloud",
  cloudAvailable: false,
  localAvailable: false,
  swarmAvailable: false,
  wllamaAvailable: false,
  localServerAvailable: false,
  swarmStatus: { model: null },
  localModelName: "Local AI",
};

beforeEach(() => {
  localStorage.clear();
  status.value = NONE;
});

describe("Current Model line", () => {
  it("says no AI is set up, and names no model, when nothing is configured", () => {
    render(<TokenLimitConfig />);
    expect(screen.getByText(/No AI is set up yet/)).toBeTruthy();
    expect(screen.queryByText(/Gemini/)).toBeNull();
    expect(screen.queryByText(/Context Window/)).toBeNull();
  });

  it("names Gemini when Cloud AI is configured", () => {
    status.value = { ...NONE, cloudAvailable: true };
    render(<TokenLimitConfig />);
    expect(
      screen.getByText("Current Model: Google Gemini 2.5 Flash"),
    ).toBeTruthy();
  });

  it("names the on-device model when the swarm has loaded one, not Gemini", () => {
    status.value = {
      ...NONE,
      effectiveMode: "swarm",
      swarmAvailable: true,
      swarmStatus: { model: "Qwen3.5-4B-q4f16_1-MLC" },
    };
    render(<TokenLimitConfig />);
    expect(screen.getByText("Current Model: Qwen 3.5 4B")).toBeTruthy();
    expect(screen.queryByText(/Gemini/)).toBeNull();
  });
});
