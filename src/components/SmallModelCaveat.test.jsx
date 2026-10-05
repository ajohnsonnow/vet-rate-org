import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const device = vi.hoisted(() => ({ model: null }));
vi.mock("../utils/localModelLabels", async (importOriginal) => ({
  ...(await importOriginal()),
  useDeviceModel: () => device.model,
}));

import SmallModelCaveat from "./SmallModelCaveat";
import { LanguageProvider } from "../contexts/LanguageContext";
import { APP_TRANSLATIONS } from "../i18n/translations";
import { isSmallModel } from "../utils/deviceCapabilityDetector";

const model = (modelId) => ({ modelId });

beforeEach(() => {
  device.model = null;
  localStorage.clear();
});

describe("isSmallModel reads the per-model table", () => {
  it.each([
    ["Qwen3.5-2B-q4f16_1-MLC", true],
    ["Qwen2.5-1.5B-Instruct-q4f16_1-MLC", true],
    ["Qwen2.5-1.5B-Instruct-q4f32_1-MLC", true],
    ["Qwen3.5-4B-q4f16_1-MLC", false],
    ["Qwen2.5-3B-Instruct-q4f16_1-MLC", false],
    ["Llama-3.2-3B-Instruct-q4f32_1-MLC", false],
    ["Some-New-Model-MLC", false],
    [null, false],
  ])("%s -> %s", (id, small) => {
    expect(isSmallModel(id)).toBe(small);
  });
});

describe("SmallModelCaveat", () => {
  it("shows a plain note, with a name and words not only colour, on a device running the 2B", () => {
    device.model = model("Qwen3.5-2B-q4f16_1-MLC");
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
    device.model = model("Qwen2.5-1.5B-Instruct-q4f16_1-MLC");
    render(<SmallModelCaveat />);
    expect(screen.getByRole("note")).toBeTruthy();
  });

  it.each([
    ["the 4B", model("Qwen3.5-4B-q4f16_1-MLC")],
    ["a device not yet probed", null],
    ["a phone with no on-device model", null],
  ])("shows nothing for %s", (_name, deviceModel) => {
    device.model = deviceModel;
    const { container } = render(<SmallModelCaveat />);
    expect(container.firstChild).toBeNull();
  });

  it("is always visible: it has no dismiss control", () => {
    device.model = model("Qwen3.5-2B-q4f16_1-MLC");
    render(<SmallModelCaveat />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("uses the chosen language when a provider is present", () => {
    device.model = model("Qwen3.5-2B-q4f16_1-MLC");
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
