/**
 * Forms Helper result view, through the real statement helper with only the
 * model stubbed. The app-built draft is there whether or not AI is set up,
 * with the standard-draft notice, and the labels follow what is on screen:
 * "Standard draft" for the app-built draft, an AI label only for a draft
 * the model reworded. Fixture values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import {
  AI_NO_CHANGE_NOTE,
  STANDARD_DRAFT_NOTE,
  STANDARD_DRAFT_NOTE_NO_BLANKS,
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
const draft = () => screen.getByRole("textbox", { name: /^Your statement/ });
const STANDARD = "Your statement (Standard draft)";

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
    expect(draft().value).toContain(`${EVENT}.`);
    expect(draft().value).toContain("[date the symptoms began]");
    expect(draft().value).toContain("SECTION I - CLAIMANT INFORMATION");
    expect(generateAI).not.toHaveBeenCalled();
  });

  it("labels it Standard draft, with no AI label anywhere near it", async () => {
    openResult();
    await screen.findByRole("status", { name: "Draft notice" });

    expect(draft()).toHaveAccessibleName(STANDARD);
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

  it("is one editable draft, with no second document behind a toggle", async () => {
    openResult();
    await screen.findByRole("status", { name: "Draft notice" });

    expect(
      screen.queryByRole("button", { name: /original|standard draft/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Statement text preview" }),
    ).not.toBeInTheDocument();
    const edited = draft().value.replace(
      "[date the symptoms began]",
      "March 2011",
    );
    fireEvent.change(draft(), { target: { value: edited } });
    expect(draft().value).toBe(edited);
  });

  it("stops asking for blanks once the veteran has filled them all in", async () => {
    openResult();
    await screen.findByRole("status", { name: "Draft notice" });
    fireEvent.change(draft(), {
      target: { value: "My statement, with nothing left to fill in." },
    });

    expect(notice().textContent).toBe(STANDARD_DRAFT_NOTE_NO_BLANKS);
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
    expect(draft().value).toContain(`${EVENT}.`);
    expect(draft()).toHaveAccessibleName(STANDARD);
    expect(document.body.textContent).not.toMatch(
      /AI Version|AI-Enhanced|Viewing AI/i,
    );
  });

  it("keeps them when the model only echoes what was typed", async () => {
    generateAI.mockResolvedValue({ text: `1. ${EVENT}`, mode: "swarm" });
    await enhance();

    await screen.findByText(new RegExp(AI_NO_CHANGE_NOTE));
    expect(draft()).toHaveAccessibleName(STANDARD);
  });

  it("names an engine error, keeps the Standard draft labels, and allows a retry", async () => {
    generateAI.mockRejectedValueOnce(new Error("WebGPU inference timed out"));
    await enhance();

    await screen.findByText(/took too long to answer/i);
    expect(notice().textContent).toBe(STANDARD_DRAFT_NOTE);
    expect(draft()).toHaveAccessibleName(STANDARD);
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
    expect(document.body.textContent).not.toMatch(/took too long|WebGPU/i);
  });

  it("uses the AI labels only for a draft the model reworded", async () => {
    modelRewords();
    await enhance();

    await screen.findByText(/viewing ai/i);
    expect(notice()).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /AI Version/i }),
    ).toBeInTheDocument();
    expect(draft()).toHaveAccessibleName(/AI.Enhanced/i);
    expect(draft().value).toContain(EVENT_REWORDED);

    fireEvent.click(screen.getByRole("button", { name: "Standard draft" }));
    expect(draft()).toHaveAccessibleName(STANDARD);
    expect(draft().value).toContain(`${EVENT}.`);
    expect(draft().value).not.toContain(EVENT_REWORDED);
    expect(notice().textContent).toBe(STANDARD_DRAFT_NOTE);
  });
});

describe("Forms Helper, an edited draft and the AI", () => {
  it("leaves an edited draft untouched when the AI fails, and when it fails again", async () => {
    generateAI.mockRejectedValue(new Error("WebGPU inference timed out"));
    openResult();
    const edited = `${draft().value}\n\nA line I typed myself.`;
    fireEvent.change(draft(), { target: { value: edited } });
    fireEvent.click(
      await screen.findByRole("button", { name: /enhance with ai/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /i understand, enhance/i }),
    );
    await screen.findByText(/took too long to answer/i);
    expect(draft().value).toBe(edited);

    localStorage.removeItem("vetrate_ai_ratelimit");
    fireEvent.click(screen.getByRole("button", { name: "Try the AI again" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /i understand, enhance/i }),
    );
    await waitFor(() => expect(generateAI).toHaveBeenCalledTimes(2));
    await screen.findByText(/took too long to answer/i);
    expect(draft().value).toBe(edited);
  });

  it("puts the AI's wording into the edited draft, keeping the edit", async () => {
    modelRewords();
    openResult();
    fireEvent.change(draft(), {
      target: { value: `${draft().value}\n\nA line I typed myself.` },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: /enhance with ai/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /i understand, enhance/i }),
    );

    await screen.findByText(/viewing ai/i);
    expect(draft().value).toContain(EVENT_REWORDED);
    expect(draft().value).toContain("A line I typed myself.");
    expect(draft().value).not.toContain(`${EVENT}.`);
  });
});
