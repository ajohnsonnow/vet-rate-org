/**
 * Nexus Builder's per-field "AI help" and the Symptom Logger's "AI"
 * suggestion put a model's words into the veteran's own field. While a
 * small on-device model is the one that would answer, neither is offered,
 * and the line saying AI wording is off appears once near the first such
 * field, not on every field. A larger on-device model or the cloud is
 * offered them as before. All values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { APP_TRANSLATIONS } from "../../i18n/translations";

const ai = vi.hoisted(() => ({ status: {} }));

vi.mock("../../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => true,
  getAIStatus: () => ai.status,
  generateAI: vi.fn(),
}));
vi.mock("../../utils/aiStatementHelper", async (importOriginal) => ({
  ...(await importOriginal()),
  isAIAvailable: () => true,
}));

const { generateAI } = await import("../../utils/unifiedAIService");
const { default: NexusBuilder } =
  await import("../../components/NexusBuilder.jsx");
const { default: SymptomLogger } =
  await import("../../components/SymptomLogger.jsx");

const onDevice = (model) => ({
  anyAvailable: true,
  statusText: "Local AI",
  effectiveMode: "swarm",
  swarmAvailable: true,
  isPrivate: true,
  swarmStatus: { model },
});
const SMALL = onDevice("Qwen3.5-2B-q4f16_1-MLC");
const LARGER = onDevice("Qwen3.5-9B-q4f16_1-MLC");
const CLOUD = {
  anyAvailable: true,
  statusText: "Cloud AI",
  effectiveMode: "cloud",
};
const REWORDING_OFF = APP_TRANSLATIONS.smallModelCaveat.rewordingOff.en;
const notes = () => screen.queryAllByRole("note", { name: "About AI wording" });

beforeEach(() => {
  localStorage.clear();
  generateAI.mockReset();
});

describe("Nexus Builder per-field AI help", () => {
  const helpButtons = () =>
    screen.queryAllByRole("button", { name: /ai help/i });
  const nextStep = () =>
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));
  function open(secondary) {
    render(
      <LanguageProvider>
        <NexusBuilder
          onClose={() => {}}
          onSave={() => true}
          condition="Tinnitus"
          primaryCondition={secondary ? "Hearing loss" : undefined}
        />
      </LanguageProvider>,
    );
    nextStep();
  }

  it.each([
    ["a primary claim", false],
    ["a secondary claim", true],
  ])(
    "is not offered on a small model, for %s, and the line appears once",
    (_kind, secondary) => {
      ai.status = SMALL;
      open(secondary);

      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(1);
      expect(helpButtons()).toEqual([]);
      expect(notes()).toHaveLength(1);
      expect(notes()[0].textContent).toBe(REWORDING_OFF);
      expect(generateAI).not.toHaveBeenCalled();
    },
  );

  it("stays off, with one line, on the next step of a secondary claim", () => {
    ai.status = SMALL;
    open(true);
    nextStep();

    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(1);
    expect(helpButtons()).toEqual([]);
    expect(notes()).toHaveLength(1);
  });

  it.each([
    ["a larger on-device model", LARGER],
    ["the cloud", CLOUD],
  ])(
    "is offered on every field with %s, with no such line",
    (_name, status) => {
      ai.status = status;
      open(false);

      expect(helpButtons().length).toBeGreaterThan(1);
      expect(notes()).toEqual([]);
    },
  );
});

describe("Symptom Logger AI suggestion", () => {
  const suggestButtons = () =>
    screen.queryAllByRole("button", { name: /^✨ AI$/ });
  const open = () =>
    render(
      <LanguageProvider>
        <SymptomLogger onClose={() => {}} />
      </LanguageProvider>,
    );

  it("is not offered on a small model, and the line appears once", () => {
    ai.status = SMALL;
    open();

    expect(suggestButtons()).toEqual([]);
    expect(notes()).toHaveLength(1);
    expect(notes()[0].textContent).toBe(REWORDING_OFF);
    expect(generateAI).not.toHaveBeenCalled();
  });

  it.each([
    ["a larger on-device model", LARGER],
    ["the cloud", CLOUD],
  ])(
    "is offered on its three fields with %s, with no such line",
    (_name, status) => {
      ai.status = status;
      open();

      expect(suggestButtons()).toHaveLength(3);
      expect(notes()).toEqual([]);
    },
  );
});

describe("promises of AI suggestions", () => {
  const TIP = /Click the sparkle .* icon next to any field/;
  const PANEL = /AI can help suggest triggers, activity impact/;
  const openNexus = () =>
    render(
      <LanguageProvider>
        <NexusBuilder
          onClose={() => {}}
          onSave={() => true}
          condition="Tinnitus"
        />
      </LanguageProvider>,
    );
  function openLoggerSettings() {
    render(
      <LanguageProvider>
        <SymptomLogger onClose={() => {}} />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "AI Settings" }));
  }

  it("are not made on a small model: no sparkle tip on any Nexus Builder step", () => {
    ai.status = SMALL;
    openNexus();

    expect(document.body.textContent).not.toMatch(TIP);
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));
    expect(document.body.textContent).not.toMatch(TIP);
  });

  it("are not made on a small model: the Symptom Logger's AI panel says suggestions are off", () => {
    ai.status = SMALL;
    openLoggerSettings();

    expect(document.body.textContent).not.toMatch(PANEL);
    expect(notes().map((note) => note.textContent)).toEqual([
      REWORDING_OFF,
      REWORDING_OFF,
    ]);
  });

  it.each([
    ["a larger on-device model", LARGER],
    ["the cloud", CLOUD],
  ])("are made as before with %s", (_name, status) => {
    ai.status = status;
    openNexus();
    expect(document.body.textContent).toMatch(TIP);
    cleanup();

    openLoggerSettings();
    expect(document.body.textContent).toMatch(PANEL);
    expect(notes()).toEqual([]);
  });
});
