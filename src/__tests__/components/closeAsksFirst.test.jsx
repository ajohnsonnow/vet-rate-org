/**
 * Forms Helper and Witness Bench: closing the tool (the close button or
 * Escape) with an edit that has not been saved asks first. Escape in the
 * question means stay. With no edit, or once the edit is saved, the tool
 * closes at once. All values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { fillRequiredOnScreen } from "../helpers/formMarkers";

vi.mock("../../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => false,
  getAIStatus: () => ({ statusText: "No AI", isPrivate: true }),
  generateAI: vi.fn(),
}));
vi.mock("../../utils/aiStatementHelper", async (importOriginal) => ({
  ...(await importOriginal()),
  isAIAvailable: () => false,
}));
vi.mock("../../utils/veteranContextProvider", async (importOriginal) => ({
  ...(await importOriginal()),
  getVeteranAIContext: vi.fn(async () => ""),
  saveAnalysisResults: vi.fn(async () => ({ documentId: "doc-1" })),
}));

const { default: FormsHelper } =
  await import("../../components/FormsHelper.jsx");
const { default: WitnessBench } =
  await import("../../components/WitnessBench.jsx");

const STAY = "Stay and keep my edits";
const LEAVE = "Close and lose my edits";
const dialog = () => screen.queryByRole("alertdialog");
const closeButton = () => screen.getByRole("button", { name: "Close" });
const pressEscape = (target = document.activeElement) =>
  fireEvent.keyDown(target, { key: "Escape" });
// An open tooltip takes the first Escape for itself, as it should.
const noTooltipOpen = () =>
  waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());

beforeEach(() => {
  localStorage.clear();
});

function expectAsksThenStays(draft, onClose) {
  expect(dialog()).toHaveAccessibleName("Close without saving?");
  expect(dialog()).toHaveAccessibleDescription(/have not saved/);
  expect(onClose).not.toHaveBeenCalled();
  const stay = screen.getByRole("button", { name: STAY });
  expect(stay).toHaveFocus();
  for (const button of [stay, screen.getByRole("button", { name: LEAVE })]) {
    expect(button.className).toMatch(/min-h-\[44px\]/);
  }

  fireEvent.keyDown(stay, { key: "Tab" });
  expect(screen.getByRole("button", { name: LEAVE })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "Tab" });
  expect(stay).toHaveFocus();

  pressEscape(stay);
  expect(dialog()).not.toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  expect(draft()).toHaveFocus();
}

describe("Forms Helper", () => {
  const draft = () => screen.getByRole("textbox", { name: /^Your statement/ });
  function openResult(onClose) {
    render(
      <LanguageProvider>
        <FormsHelper onClose={onClose} />
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
  const edit = () =>
    fireEvent.change(draft(), {
      target: { value: `${draft().value}\n\nA line I typed myself.` },
    });

  it("closes at once when the draft was not edited", () => {
    const onClose = vi.fn();
    openResult(onClose);
    fireEvent.click(closeButton());

    expect(dialog()).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks when the close button is pressed with an unsaved edit, and Escape stays", () => {
    const onClose = vi.fn();
    openResult(onClose);
    edit();
    fireEvent.click(closeButton());

    expectAsksThenStays(draft, onClose);
    expect(draft().value).toMatch(/A line I typed myself\.$/);
  });

  it("asks when Escape is pressed with an unsaved edit", async () => {
    const onClose = vi.fn();
    openResult(onClose);
    edit();
    draft().focus();
    await noTooltipOpen();
    pressEscape();

    expectAsksThenStays(draft, onClose);
  });

  it("closes when the veteran chooses to lose the edit", () => {
    const onClose = vi.fn();
    openResult(onClose);
    edit();
    fireEvent.click(closeButton());
    fireEvent.click(screen.getByRole("button", { name: LEAVE }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes at once when the edit has been saved", async () => {
    const onClose = vi.fn();
    openResult(onClose);
    edit();
    fireEvent.click(screen.getByRole("button", { name: /save to packet/i }));
    await screen.findByRole("button", { name: /saved to my packet at/i });
    fireEvent.click(closeButton());

    expect(dialog()).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks when an edited draft is being kept while the answers are changed", () => {
    const onClose = vi.fn();
    openResult(onClose);
    edit();
    fireEvent.click(screen.getByRole("button", { name: /edit answers/i }));
    fireEvent.click(closeButton());

    expect(dialog()).toHaveAccessibleName("Close without saving?");
    expect(onClose).not.toHaveBeenCalled();
  });
});

const statement = () =>
  screen.getByRole("textbox", { name: "Your Buddy Statement" });
async function openResult(onClose) {
  render(
    <LanguageProvider>
      <WitnessBench onClose={onClose} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /spouse \/ partner/i }));
  fireEvent.change(
    screen.getByPlaceholderText(
      "e.g., PTSD, Lower Back Pain, Tinnitus, Sleep Apnea",
    ),
    { target: { value: "Tinnitus" } },
  );
  fireEvent.change(screen.getByPlaceholderText("e.g., Jane Smith, John Doe"), {
    target: { value: "Odalys Fenwick" },
  });
  fireEvent.click(screen.getByRole("button", { name: /start interview/i }));
  const next = () => screen.queryByRole("button", { name: /^next/i });
  for (let i = 0; i < 20; i++) {
    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: `I saw this happen, number ${i}.` },
    });
    if (!next()) break;
    fireEvent.click(next());
  }
  fireEvent.click(screen.getByRole("button", { name: /generate statement/i }));
  await screen.findByRole("textbox", { name: "Your Buddy Statement" });
}

describe("Witness Bench", () => {
  const edit = () =>
    fireEvent.change(statement(), {
      target: { value: `${statement().value}\n\nA line the witness typed.` },
    });

  it("closes at once when the statement was not edited", async () => {
    const onClose = vi.fn();
    await openResult(onClose);
    fireEvent.click(closeButton());

    expect(dialog()).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks when the close button is pressed with an unsaved edit, and Escape stays", async () => {
    const onClose = vi.fn();
    await openResult(onClose);
    edit();
    fireEvent.click(closeButton());

    expectAsksThenStays(statement, onClose);
    expect(statement().value).toMatch(/A line the witness typed\.$/);
  });

  it("asks when Escape is pressed with an unsaved edit", async () => {
    const onClose = vi.fn();
    await openResult(onClose);
    edit();
    statement().focus();
    await noTooltipOpen();
    pressEscape();

    expectAsksThenStays(statement, onClose);
  });

  it("closes when the witness chooses to lose the edit", async () => {
    const onClose = vi.fn();
    await openResult(onClose);
    edit();
    fireEvent.click(closeButton());
    fireEvent.click(screen.getByRole("button", { name: LEAVE }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes at once when the edit has been saved", async () => {
    const onClose = vi.fn();
    await openResult(onClose);
    edit();
    fireEvent.click(screen.getByRole("button", { name: /save to my packet/i }));
    await waitFor(() =>
      expect(document.body.textContent).toMatch(/Saved to My Packet at/),
    );
    fireEvent.click(closeButton());

    expect(dialog()).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
