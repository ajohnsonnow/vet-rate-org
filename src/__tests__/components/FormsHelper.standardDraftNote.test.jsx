/**
 * Forms Helper on the screen, through the real statement helper with only
 * the model stubbed: when the AI's wording is not used, the "AI version" is
 * the app-built draft, and the standard-draft notice says so in place of
 * the "viewing AI version" label. Fixture values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { STANDARD_DRAFT_NOTE } from "../../utils/writerTemplates";

vi.mock("../../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAnyAIAvailable: () => true,
    getAIStatus: () => ({ statusText: "Local AI", isPrivate: true }),
    generateAI: vi.fn(),
  };
});

const { generateAI } = await import("../../utils/unifiedAIService");
const { default: FormsHelper } =
  await import("../../components/FormsHelper.jsx");

async function enhancePersonalStatement() {
  render(
    <LanguageProvider>
      <FormsHelper onClose={() => {}} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByText("Statement in Support of Claim"));
  fireEvent.click(screen.getByText("Start Guided Builder"));
  fireEvent.change(
    screen.getByPlaceholderText("PTSD, back pain, knee injury, etc."),
    { target: { value: "Tinnitus" } },
  );
  const next = () => screen.queryByRole("button", { name: /^next$/i });
  for (let guard = 0; next() && guard < 12; guard++) fireEvent.click(next());
  fireEvent.click(screen.getByRole("button", { name: /generate statement/i }));
  fireEvent.click(
    await screen.findByRole("button", { name: /enhance with ai/i }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /i understand, enhance/i }),
  );
}

beforeEach(() => {
  localStorage.clear();
  generateAI.mockReset();
});

describe("Forms Helper standard-draft notice", () => {
  it("is shown, by name and in words, when the model asks for information", async () => {
    generateAI.mockResolvedValue({
      text: "I can help. To make it accurate, please provide the following details: your branch of service and the dates you served.",
      mode: "swarm",
    });
    await enhancePersonalStatement();

    const notice = await screen.findByRole("status", { name: "Draft notice" });
    expect(notice.textContent).toBe(STANDARD_DRAFT_NOTE);
    expect(screen.queryByText(/viewing ai/i)).not.toBeInTheDocument();
    expect(document.body.textContent).toContain(
      "[what happened during your service that caused or started this condition]",
    );
  });

  it("is shown after an engine error, with no error message in its place", async () => {
    generateAI.mockRejectedValue(new Error("WebGPU inference timed out"));
    await enhancePersonalStatement();

    expect(
      (await screen.findByRole("status", { name: "Draft notice" })).textContent,
    ).toBe(STANDARD_DRAFT_NOTE);
    expect(document.body.textContent).toContain("[date the symptoms began]");
  });

  it("is not shown when the model's wording was accepted", async () => {
    generateAI.mockImplementation(async (prompt) => ({
      text: /=== DRAFT ===\n([\s\S]*)\n=== END DRAFT ===/.exec(prompt)[1],
      mode: "swarm",
    }));
    await enhancePersonalStatement();

    await screen.findByText(/viewing ai/i);
    expect(
      screen.queryByRole("status", { name: "Draft notice" }),
    ).not.toBeInTheDocument();
  });
});
