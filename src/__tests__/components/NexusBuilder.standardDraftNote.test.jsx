/**
 * When the AI's wording is not usable, the Nexus Builder shows the app-built
 * draft with the one-line note, and does not label it as AI-written.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { STANDARD_DRAFT_NOTE } from "../../utils/writerTemplates";

vi.mock("../../utils/aiStatementHelper", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAIAvailable: () => true,
    enhancePersonalStatement: vi.fn(),
  };
});
const { enhancePersonalStatement } =
  await import("../../utils/aiStatementHelper");
const { default: NexusBuilder } =
  await import("../../components/NexusBuilder.jsx");

const DRAFT = "My symptoms began [date the symptoms began].";

async function enhanceOnReviewStep() {
  render(
    <LanguageProvider>
      <NexusBuilder onClose={() => {}} onSave={() => {}} condition="Tinnitus" />
    </LanguageProvider>,
  );
  for (let step = 0; step < 5; step++) {
    const next = screen.queryByRole("button", { name: /next step/i });
    if (!next) break;
    fireEvent.click(next);
  }
  fireEvent.click(screen.getByRole("button", { name: /enhance with ai/i }));
  fireEvent.click(
    await screen.findByRole("button", { name: /i understand, enhance/i }),
  );
  await waitFor(() => expect(enhancePersonalStatement).toHaveBeenCalled());
}

beforeEach(() => {
  localStorage.clear();
  enhancePersonalStatement.mockReset();
});

describe("NexusBuilder review step", () => {
  it("shows the note with the app-built draft", async () => {
    enhancePersonalStatement.mockResolvedValue({
      success: true,
      content: DRAFT,
      draftPath: "template",
      draftNote: STANDARD_DRAFT_NOTE,
    });
    await enhanceOnReviewStep();

    const note = await screen.findByText(STANDARD_DRAFT_NOTE);
    expect(note).toHaveAttribute("role", "status");
    expect(screen.queryByText(/AI-enhanced statement/)).not.toBeInTheDocument();
    expect(screen.getByText(/\[date the symptoms began\]/)).toBeInTheDocument();
  });

  it("shows no note when the model's wording was accepted", async () => {
    enhancePersonalStatement.mockResolvedValue({
      success: true,
      content: "My symptoms began in service.",
      draftPath: "model",
      draftNote: null,
    });
    await enhanceOnReviewStep();

    await screen.findByText(/My symptoms began in service\./);
    expect(screen.queryByText(STANDARD_DRAFT_NOTE)).not.toBeInTheDocument();
    expect(screen.getByText(/AI-enhanced statement/)).toBeInTheDocument();
  });
});
