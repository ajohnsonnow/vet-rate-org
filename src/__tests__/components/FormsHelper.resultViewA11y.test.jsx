/**
 * Forms Helper: three accessibility and small-screen defects found in a
 * real browser. jsdom does no layout, so the 390px case is pinned by the
 * layout classes the neighbouring controls use.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";

vi.mock("../../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAnyAIAvailable: () => false,
    getAIStatus: () => ({ statusText: "No AI", isPrivate: true }),
    generateAI: vi.fn(),
  };
});

const { default: FormsHelper } =
  await import("../../components/FormsHelper.jsx");

function openBuilder() {
  render(
    <LanguageProvider>
      <FormsHelper onClose={() => {}} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByText("Statement in Support of Claim"));
  fireEvent.click(screen.getByText("Start Guided Builder"));
}

function openResult() {
  openBuilder();
  const next = () => screen.queryByRole("button", { name: /^next$/i });
  for (let guard = 0; next() && guard < 12; guard++) fireEvent.click(next());
  fireEvent.click(screen.getByRole("button", { name: /generate statement/i }));
}

beforeEach(() => {
  localStorage.clear();
});

describe("Forms Helper accessibility", () => {
  it("a select in the builder is named by its label", () => {
    openBuilder();

    const select = screen.getByRole("combobox", { name: /Type of Claim/ });
    expect(
      within(select).getByRole("option", { name: "Secondary Condition" }),
    ).toBeInTheDocument();
  });

  it("the statement is an editable field named by its label, with a hint", () => {
    openResult();

    const draft = screen.getByRole("textbox", {
      name: "Your statement (Standard draft)",
    });
    expect(draft).toHaveAccessibleDescription(
      /Downloads and Save to Packet use exactly what this box shows/,
    );
    expect(draft.className).toMatch(/focus-visible:ring/);
  });

  it("a text field and a text area in the builder are named by their labels", () => {
    openBuilder();

    expect(
      screen.getByRole("textbox", { name: /Your Full Name/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(
      screen.getByRole("textbox", { name: /What in-service event/ }),
    ).toBeInTheDocument();
  });
});
describe("Forms Helper on a 390px screen", () => {
  it("stacks the Configure AI button under its text, like its neighbours", () => {
    openResult();
    const button = screen.getByRole("button", { name: /configure ai/i });

    expect(button.className).toMatch(/w-full/);
    expect(button.className).toMatch(/sm:w-auto/);
    expect(button.className).toMatch(/min-h-\[44px\]/);
    expect(button.className).not.toMatch(/whitespace-nowrap/);
    expect(button.parentElement.className).toMatch(/flex-col/);
    expect(button.parentElement.className).toMatch(/sm:flex-row/);
  });
});
