/**
 * Forms Helper buddy statement: a witness's words are never reworded by a
 * model. With AI set up there is no "Enhance with AI" control, no model
 * call, and the notice above the draft tells the witness to finish each
 * line in their own words. The veteran's own statement keeps the control.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { fillRequiredOnScreen } from "../helpers/formMarkers";
import { WITNESS_DRAFT_NOTE } from "../../utils/writerTemplates";

vi.mock("../../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => true,
  getAIStatus: () => ({ statusText: "Local AI", isPrivate: true }),
  generateAI: vi.fn(),
}));

const { generateAI } = await import("../../utils/unifiedAIService");
const { default: FormsHelper } =
  await import("../../components/FormsHelper.jsx");

const FRAGMENT =
  "Lights off at the desk, sunglasses indoors, head down on the bench";

function openResult(formName) {
  render(
    <LanguageProvider>
      <FormsHelper onClose={() => {}} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByText(formName));
  fireEvent.click(screen.getByText("Start Guided Builder"));
  const next = () => screen.queryByRole("button", { name: /^next$/i });
  const observed = () =>
    document.getElementById("forms-helper-field-whatObserved");
  for (let guard = 0; guard < 12; guard++) {
    if (observed()) {
      fireEvent.change(observed(), { target: { value: FRAGMENT } });
    }
    fillRequiredOnScreen(fireEvent.change, fireEvent.click);
    if (!next()) break;
    fireEvent.click(next());
  }
  fireEvent.click(screen.getByRole("button", { name: /generate statement/i }));
}

beforeEach(() => {
  localStorage.clear();
  generateAI.mockReset();
});

describe("Forms Helper buddy statement with AI set up", () => {
  it("offers no AI rewording and makes no model call", () => {
    openResult("Buddy / Lay Statement");

    expect(
      screen.queryByRole("button", { name: /enhance with ai/i }),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/AI Statement Assistant/i);
    expect(generateAI).not.toHaveBeenCalled();
  });

  it("shows the witness's fragment as typed, under a notice to finish it", () => {
    openResult("Buddy / Lay Statement");
    const draft = screen.getByRole("textbox", { name: /^Your statement/ });

    expect(draft.value).toContain(`${FRAGMENT}.`);
    expect(
      screen.getByRole("status", { name: "Draft notice" }).textContent,
    ).toBe(WITNESS_DRAFT_NOTE);
  });
});

describe("Forms Helper personal statement with AI set up", () => {
  it("still offers the AI for the veteran's own words", () => {
    openResult("Statement in Support of Claim");

    expect(
      screen.getByRole("button", { name: /enhance with ai/i }),
    ).toBeInTheDocument();
  });
});
