import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const status = vi.hoisted(() => ({ model: null }));
vi.mock("../utils/unifiedAIService", () => ({
  getAIStatus: () => ({
    effectiveMode: "swarm",
    swarmAvailable: true,
    swarmStatus: { model: status.model },
  }),
}));
const profile = vi.hoisted(() => ({ list: [] }));
vi.mock("../utils/deviceLabels", async (importOriginal) => ({
  ...(await importOriginal()),
  useDeviceProfile: () => ({ recommendedModels: profile.list }),
}));

import SmallModelCaveat from "./SmallModelCaveat";

const SENTENCE =
  "Vet-Rate meant to load Qwen 3.5 4B, but it could not be loaded.";

beforeEach(() => {
  profile.list = ["Qwen3.5-4B-q4f16_1-MLC", "Qwen2.5-3B-Instruct-q4f16_1-MLC"];
});

describe("the small-model caveat when a fallback loaded", () => {
  it("also says the intended model could not be loaded, from the fallback function", () => {
    status.model = "Qwen2.5-3B-Instruct-q4f16_1-MLC";
    render(<SmallModelCaveat />);
    const note = screen.getByRole("note");
    expect(note.textContent).toContain(SENTENCE);
    expect(note.textContent).toMatch(/smaller AI model/);
  });

  it("says nothing extra when the loaded model is the first choice", () => {
    profile.list = [
      "Qwen3.5-2B-q4f16_1-MLC",
      "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    ];
    status.model = "Qwen3.5-2B-q4f16_1-MLC";
    render(<SmallModelCaveat />);
    expect(screen.getByRole("note").textContent).not.toMatch(
      /could not be loaded/,
    );
  });
});
