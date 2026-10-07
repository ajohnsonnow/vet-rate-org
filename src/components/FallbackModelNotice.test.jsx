import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const status = vi.hoisted(() => ({ value: null }));
vi.mock("../utils/unifiedAIService", () => ({
  getAIStatus: () => status.value,
}));
vi.mock("../utils/deviceLabels", async (importOriginal) => ({
  ...(await importOriginal()),
  useDeviceProfile: () => ({
    recommendedModels: [
      "Qwen3.5-4B-q4f16_1-MLC",
      "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    ],
  }),
}));

import FallbackModelNotice from "./FallbackModelNotice";

const swarm = (model) => ({
  effectiveMode: "swarm",
  swarmAvailable: true,
  swarmStatus: { model },
});

beforeEach(() => {
  status.value = swarm("Qwen2.5-3B-Instruct-q4f16_1-MLC");
});

describe("FallbackModelNotice", () => {
  it("tells the veteran the first choice failed and which older model is loaded", () => {
    render(<FallbackModelNotice />);
    const note = screen.getByRole("status");
    expect(note.textContent).toMatch(/meant to load Qwen 3\.5 4B/);
    expect(note.textContent).toMatch(/could not be loaded/);
    expect(note.textContent).toMatch(/Qwen 2\.5 3B is loaded instead/);
    expect(note.textContent).toMatch(/older model/);
  });

  it("shows nothing when the first choice is loaded", () => {
    status.value = swarm("Qwen3.5-4B-q4f16_1-MLC");
    const { container } = render(<FallbackModelNotice />);
    expect(container.firstChild).toBeNull();
  });
});
