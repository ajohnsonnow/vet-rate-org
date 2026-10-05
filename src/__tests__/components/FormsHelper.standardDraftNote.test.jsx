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

const EVENT = "fell from a cargo ramp during a night drill, hurt my back";
const EVENT_REWORDED =
  "I fell from a cargo ramp during a night drill and hurt my back.";
const modelRewords = () =>
  generateAI.mockImplementation(async () => ({
    text: `1. ${EVENT_REWORDED}`,
    mode: "swarm",
  }));

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
  for (let guard = 0; next() && guard < 12; guard++) {
    const event = screen.queryByPlaceholderText(
      /Describe the specific event, injury/,
    );
    if (event) fireEvent.change(event, { target: { value: EVENT } });
    fireEvent.click(next());
  }
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
    expect(generateAI).toHaveBeenCalledTimes(1);
    expect(generateAI.mock.calls[0][0]).toContain(`1. ${EVENT}`);
    expect(document.body.textContent).toContain(`${EVENT}.`);
    expect(document.body.textContent).toContain("[date the symptoms began]");
  });

  it("is shown when the model only echoes what was typed", async () => {
    generateAI.mockResolvedValue({ text: `1. ${EVENT}`, mode: "swarm" });
    await enhancePersonalStatement();

    expect(
      (await screen.findByRole("status", { name: "Draft notice" })).textContent,
    ).toBe(STANDARD_DRAFT_NOTE);
    expect(screen.queryByText(/viewing ai/i)).not.toBeInTheDocument();
  });

  it("is shown after an engine error, with no error message in its place", async () => {
    generateAI.mockRejectedValue(new Error("WebGPU inference timed out"));
    await enhancePersonalStatement();

    expect(
      (await screen.findByRole("status", { name: "Draft notice" })).textContent,
    ).toBe(STANDARD_DRAFT_NOTE);
    expect(document.body.textContent).toContain("[date the symptoms began]");
  });

  it("names the error and lets the veteran try the AI again", async () => {
    generateAI.mockRejectedValueOnce(new Error("WebGPU inference timed out"));
    await enhancePersonalStatement();
    await screen.findByRole("status", { name: "Draft notice" });
    expect(document.body.textContent).toMatch(/timed out/i);

    localStorage.removeItem("vetrate_ai_ratelimit");
    modelRewords();
    fireEvent.click(screen.getByRole("button", { name: "Try the AI again" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /i understand, enhance/i }),
    );

    await screen.findByText(/viewing ai/i);
    expect(
      screen.queryByRole("status", { name: "Draft notice" }),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/timed out/i);
  });

  it("is not shown when the model's wording was accepted", async () => {
    modelRewords();
    await enhancePersonalStatement();

    await screen.findByText(/viewing ai/i);
    expect(
      screen.queryByRole("status", { name: "Draft notice" }),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).toContain(EVENT_REWORDED);
  });
});
