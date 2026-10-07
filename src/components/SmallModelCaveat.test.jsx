import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const status = vi.hoisted(() => ({ value: null }));
vi.mock("../utils/unifiedAIService", () => ({
  getAIStatus: () => status.value,
}));

import SmallModelCaveat from "./SmallModelCaveat";
import { LanguageProvider } from "../contexts/LanguageContext";
import { APP_TRANSLATIONS } from "../i18n/translations";
import { isSmallModel } from "../utils/deviceCapabilityDetector";

const swarm = (modelId, extra = {}) => ({
  effectiveMode: "swarm",
  swarmAvailable: true,
  swarmStatus: { model: modelId },
  ...extra,
});
const NO_AI = {
  effectiveMode: "cloud",
  swarmAvailable: false,
  cloudAvailable: false,
  swarmStatus: { model: null },
};

beforeEach(() => {
  status.value = NO_AI;
  localStorage.clear();
});

describe("isSmallModel reads the per-model table", () => {
  it.each([
    ["Qwen3.5-2B-q4f16_1-MLC", true],
    ["Qwen2.5-1.5B-Instruct-q4f16_1-MLC", true],
    ["Qwen2.5-1.5B-Instruct-q4f32_1-MLC", true],
    ["Qwen3.5-4B-q4f16_1-MLC", false],
    ["Qwen2.5-3B-Instruct-q4f16_1-MLC", true],
    ["Qwen2.5-3B-Instruct-q4f32_1-MLC", true],
    ["Llama-3.2-3B-Instruct-q4f32_1-MLC", false],
    ["Some-New-Model-MLC", false],
    [null, false],
  ])("%s -> %s", (id, small) => {
    expect(isSmallModel(id)).toBe(small);
  });
});

describe("SmallModelCaveat", () => {
  it("shows a plain note, with a name and words not only colour, on a device running the 2B", () => {
    status.value = swarm("Qwen3.5-2B-q4f16_1-MLC");
    render(<SmallModelCaveat />);
    const note = screen.getByRole("note", {
      name: "This device runs a smaller AI model",
    });
    expect(note.textContent).toMatch(/smaller AI model/);
    expect(note.textContent).toMatch(
      /check every statement against your own documents/i,
    );
    expect(note.textContent).toMatch(
      /accredited VSO or on VA\.gov before acting/,
    );
    expect(note.querySelector("button, a, input")).toBeNull();
  });

  it("shows on the tablet's 1.5B", () => {
    status.value = swarm("Qwen2.5-1.5B-Instruct-q4f16_1-MLC");
    render(<SmallModelCaveat />);
    expect(screen.getByRole("note")).toBeTruthy();
  });

  it.each([
    ["the 4B loaded", swarm("Qwen3.5-4B-q4f16_1-MLC")],
    ["no AI set up", NO_AI],
    [
      "cloud AI answering while a small model sits loaded",
      swarm("Qwen3.5-2B-q4f16_1-MLC", { effectiveMode: "cloud" }),
    ],
    [
      "a small model that is not loaded (swarm not ready)",
      swarm("Qwen3.5-2B-q4f16_1-MLC", { swarmAvailable: false }),
    ],
  ])("shows nothing for %s", (_name, value) => {
    status.value = value;
    const { container } = render(<SmallModelCaveat />);
    expect(container.firstChild).toBeNull();
  });

  it("shows for a fallback to the Qwen2.5-3B: it follows the model actually loaded, not the first choice", () => {
    status.value = swarm("Qwen2.5-3B-Instruct-q4f16_1-MLC");
    render(<SmallModelCaveat />);
    expect(screen.getByRole("note")).toBeTruthy();
  });

  it("shows nothing for a loaded model that is not in the small class", () => {
    status.value = swarm("Llama-3.2-3B-Instruct-q4f32_1-MLC");
    const { container } = render(<SmallModelCaveat />);
    expect(container.firstChild).toBeNull();
  });

  it("is always visible: it has no dismiss control", () => {
    status.value = swarm("Qwen3.5-2B-q4f16_1-MLC");
    render(<SmallModelCaveat />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("uses the chosen language when a provider is present", () => {
    status.value = swarm("Qwen3.5-2B-q4f16_1-MLC");
    localStorage.setItem("vetrate_language", "es");
    render(
      <LanguageProvider>
        <SmallModelCaveat />
      </LanguageProvider>,
    );
    expect(
      screen.getByRole("note", {
        name: APP_TRANSLATIONS.smallModelCaveat.title.es,
      }),
    ).toBeTruthy();
  });

  it("has a non-empty string for every shipped locale of both keys", () => {
    const section = APP_TRANSLATIONS.smallModelCaveat;
    for (const key of ["title", "body"]) {
      for (const lang of ["en", "es", "tl", "vi", "ko"]) {
        expect(section[key][lang]?.trim().length).toBeGreaterThan(10);
      }
    }
  });
});
