/**
 * Forms Helper and Nexus Builder do not offer "Enhance with AI" while a
 * small on-device model is the one that would answer: no button, so no
 * consent dialog for something that will not happen. The line saying
 * rewording is off stands in its place. With a larger on-device model the
 * button is offered as before. All values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { APP_TRANSLATIONS } from "../../i18n/translations";
import { fillRequiredOnScreen } from "../helpers/formMarkers";

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
const { default: FormsHelper } =
  await import("../../components/FormsHelper.jsx");
const { default: NexusBuilder } =
  await import("../../components/NexusBuilder.jsx");

const onDevice = (model) => ({
  statusText: "Local AI",
  effectiveMode: "swarm",
  swarmAvailable: true,
  isPrivate: true,
  swarmStatus: { model },
});
const SMALL = onDevice("Qwen3.5-2B-q4f16_1-MLC");
const LARGER = onDevice("Qwen3.5-9B-q4f16_1-MLC");
const REWORDING_OFF = APP_TRANSLATIONS.smallModelCaveat.rewordingOff.en;
const enhance = () =>
  screen.queryByRole("button", { name: /enhance with ai/i });
const note = () => screen.queryByRole("note", { name: "About AI wording" });

beforeEach(() => {
  localStorage.clear();
  generateAI.mockReset();
});

function openFormsHelperResult() {
  render(
    <LanguageProvider>
      <FormsHelper onClose={() => {}} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByText("Statement in Support of Claim"));
  fireEvent.click(screen.getByText("Start Guided Builder"));
  const next = () => screen.queryByRole("button", { name: /^next$/i });
  for (let guard = 0; guard < 14; guard++) {
    fillRequiredOnScreen(fireEvent.change, fireEvent.click);
    if (!next()) break;
    fireEvent.click(next());
  }
  fireEvent.click(screen.getByRole("button", { name: /generate/i }));
}

function openNexusReview() {
  render(
    <LanguageProvider>
      <NexusBuilder
        onClose={() => {}}
        onSave={() => true}
        condition="Tinnitus"
      />
    </LanguageProvider>,
  );
  const step = () =>
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));
  step();
  fireEvent.change(screen.getAllByRole("textbox")[0], {
    target: { value: "I miss about two shifts a month" },
  });
  step();
}

describe.each([
  ["Forms Helper", openFormsHelperResult],
  ["Nexus Builder", openNexusReview],
])("%s", (_tool, open) => {
  it("offers no AI rewording on a small on-device model, and says why in one line", () => {
    ai.status = SMALL;
    open();

    expect(enhance()).not.toBeInTheDocument();
    expect(note().textContent).toBe(REWORDING_OFF);
    expect(screen.queryByRole("dialog", { name: /consent|AI/i })).toBeNull();
    expect(generateAI).not.toHaveBeenCalled();
  });

  it("offers it as before on a larger on-device model, with no such line", () => {
    ai.status = LARGER;
    open();

    expect(enhance()).toBeInTheDocument();
    expect(note()).not.toBeInTheDocument();
  });
});
