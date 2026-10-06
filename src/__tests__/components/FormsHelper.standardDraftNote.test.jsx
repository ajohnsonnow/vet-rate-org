/**
 * Forms Helper result view, through the real statement helper with only the
 * model stubbed. The app-built draft is there whether or not AI is set up,
 * with the standard-draft notice, and the labels follow what is on screen:
 * "Standard draft" for the app-built draft, an AI label only for a draft
 * the model reworded. Fixture values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import {
  AI_NO_CHANGE_NOTE,
  STANDARD_DRAFT_NOTE,
} from "../../utils/writerTemplates";

const ai = vi.hoisted(() => ({ available: true }));

vi.mock("../../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAnyAIAvailable: () => ai.available,
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
const AI_LABELS = /AI Version|AI-Enhanced|AI Enhanced|Viewing AI/i;
const modelRewords = () =>
  generateAI.mockImplementation(async () => ({
    text: `1. ${EVENT_REWORDED}`,
    mode: "swarm",
  }));

const notice = () => screen.queryByRole("status", { name: "Draft notice" });
const preview = () =>
  screen.getByRole("region", { name: "Statement text preview" });

function openResult() {
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
}

async function enhance() {
  openResult();
  fireEvent.click(
    await screen.findByRole("button", { name: /enhance with ai/i }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /i understand, enhance/i }),
  );
}

beforeEach(() => {
  localStorage.clear();
  ai.available = true;
  generateAI.mockReset();
});

describe("Forms Helper with no AI set up", () => {
  beforeEach(() => {
    ai.available = false;
  });

  it("hands back the app-built draft with its blanks and the notice", async () => {
    openResult();

    expect(
      (await screen.findByRole("status", { name: "Draft notice" })).textContent,
    ).toBe(STANDARD_DRAFT_NOTE);
    expect(preview().textContent).toContain(`${EVENT}.`);
    expect(preview().textContent).toContain("[date the symptoms began]");
    expect(preview().textContent).toContain(
      "[whether the symptoms have continued since then]",
    );
    expect(generateAI).not.toHaveBeenCalled();
  });

  it("labels it Standard draft, with no AI label anywhere near it", async () => {
    openResult();
    await screen.findByRole("status", { name: "Draft notice" });

    expect(
      screen.getByRole("button", { name: /standard draft/i }),
    ).toBeInTheDocument();
    expect(document.body.textContent).toMatch(
      /Text Preview \(Standard draft\)/,
    );
    expect(document.body.textContent).not.toMatch(AI_LABELS);
  });

  it("offers Configure AI, and no retry", async () => {
    openResult();
    await screen.findByRole("status", { name: "Draft notice" });

    expect(
      screen.getByRole("button", { name: /configure ai/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try the AI again" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /enhance with ai/i }),
    ).not.toBeInTheDocument();
  });

  it("still shows the full form text under Original", async () => {
    openResult();
    await screen.findByRole("status", { name: "Draft notice" });
    fireEvent.click(screen.getByRole("button", { name: /original/i }));

    expect(preview().textContent).toContain("SECTION I - CLAIMANT INFORMATION");
    expect(notice()).not.toBeInTheDocument();
  });
});

describe("Forms Helper with AI set up", () => {
  it("shows the standard draft before the AI is asked", async () => {
    openResult();

    expect(
      (await screen.findByRole("status", { name: "Draft notice" })).textContent,
    ).toBe(STANDARD_DRAFT_NOTE);
    expect(
      screen.getByRole("button", { name: /enhance with ai/i }),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /AI Version|AI-Enhanced|Viewing AI/i,
    );
  });

  it("keeps the Standard draft labels when the model asks for information", async () => {
    generateAI.mockResolvedValue({
      text: "I can help. To make it accurate, please provide the following details: your branch of service and the dates you served.",
      mode: "swarm",
    });
    await enhance();

    await screen.findByText(new RegExp(AI_NO_CHANGE_NOTE));
    expect(notice().textContent).toContain(STANDARD_DRAFT_NOTE);
    expect(generateAI.mock.calls[0][0]).toContain(`1. ${EVENT}`);
    expect(preview().textContent).toContain(`${EVENT}.`);
    expect(document.body.textContent).toMatch(
      /Text Preview \(Standard draft\)/,
    );
    expect(document.body.textContent).not.toMatch(
      /AI Version|AI-Enhanced|Viewing AI/i,
    );
  });

  it("keeps them when the model only echoes what was typed", async () => {
    generateAI.mockResolvedValue({ text: `1. ${EVENT}`, mode: "swarm" });
    await enhance();

    await screen.findByText(new RegExp(AI_NO_CHANGE_NOTE));
    expect(
      screen.getByRole("button", { name: /standard draft/i }),
    ).toBeInTheDocument();
  });

  it("names an engine error, keeps the Standard draft labels, and allows a retry", async () => {
    generateAI.mockRejectedValueOnce(new Error("WebGPU inference timed out"));
    await enhance();

    await screen.findByText(/timed out/i);
    expect(notice().textContent).toBe(STANDARD_DRAFT_NOTE);
    expect(document.body.textContent).toMatch(
      /Text Preview \(Standard draft\)/,
    );
    expect(document.body.textContent).not.toMatch(
      /AI Version|AI-Enhanced|Viewing AI/i,
    );

    localStorage.removeItem("vetrate_ai_ratelimit");
    modelRewords();
    fireEvent.click(screen.getByRole("button", { name: "Try the AI again" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /i understand, enhance/i }),
    );

    await screen.findByText(/viewing ai/i);
    expect(notice()).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/timed out/i);
  });

  it("uses the AI labels only for a draft the model reworded", async () => {
    modelRewords();
    await enhance();

    await screen.findByText(/viewing ai/i);
    expect(notice()).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /AI Version/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /standard draft/i }),
    ).not.toBeInTheDocument();
    expect(preview().textContent).toContain(EVENT_REWORDED);
  });
});
