/**
 * The Nexus Builder review step shows the app-built draft, as plain editable
 * text with its blanks, whether or not AI is set up. Labels follow what is
 * on screen: only a draft the model reworded is called AI, and only then is
 * the citation warning shown. Fixture values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import {
  STANDARD_DRAFT_NOTE,
  buildPersonalStatementTemplate,
} from "../../utils/writerTemplates";

const ai = vi.hoisted(() => ({ available: true }));

vi.mock("../../utils/aiStatementHelper", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAIAvailable: () => ai.available,
    enhancePersonalStatement: vi.fn(),
  };
});
const { enhancePersonalStatement } =
  await import("../../utils/aiStatementHelper");
const { default: NexusBuilder } =
  await import("../../components/NexusBuilder.jsx");

const LABEL = "Statement in Support of Claim (VA Form 21-4138)";
const TEMPLATE = buildPersonalStatementTemplate(
  {
    symptomOnsetDate: "",
    hasTreatment: "",
    treatmentType: "",
    aggravationMechanism: "",
    aggravationExplanation: "",
    specificIncident: "",
    workImpact: "",
    socialImpact: "",
    specificExamples: "",
  },
  "Tinnitus",
  null,
);
const REWORDING = {
  before: "Effect on my work:",
  after: "Effect on my work: To put it plainly,",
  verdict: "accepted",
};
const statementField = () => screen.getByRole("textbox", { name: LABEL });
const notice = () => screen.queryByRole("status", { name: "Draft notice" });

function openReviewStep(onSave = () => {}) {
  render(
    <LanguageProvider>
      <NexusBuilder onClose={() => {}} onSave={onSave} condition="Tinnitus" />
    </LanguageProvider>,
  );
  for (let step = 0; step < 5; step++) {
    const next = screen.queryByRole("button", { name: /next step/i });
    if (!next) break;
    fireEvent.click(next);
  }
}

async function enhanceOnReviewStep(edit = null) {
  openReviewStep();
  if (edit) {
    fireEvent.change(statementField(), {
      target: { value: `${statementField().value}\n\n${edit}` },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: /enhance with ai/i }));
  fireEvent.click(
    await screen.findByRole("button", { name: /i understand, enhance/i }),
  );
  await waitFor(() => expect(enhancePersonalStatement).toHaveBeenCalled());
}

beforeEach(() => {
  localStorage.clear();
  ai.available = true;
  enhancePersonalStatement.mockReset();
});

describe("NexusBuilder standard draft, no AI set up", () => {
  beforeEach(() => {
    ai.available = false;
  });

  it("is the app-built draft with its blanks and the notice", () => {
    openReviewStep();

    expect(statementField().value).toBe(TEMPLATE);
    expect(statementField().value).toContain("[date the symptoms began]");
    expect(notice().textContent).toBe(STANDARD_DRAFT_NOTE);
    expect(enhancePersonalStatement).not.toHaveBeenCalled();
  });

  it("asserts nothing the veteran was not asked, and shows no markdown", () => {
    openReviewStep();
    const text = statementField().value;

    expect(text).not.toMatch(/persisted and worsened|significantly affects/);
    expect(text).not.toContain("**");
    expect(text).toContain(
      "[whether you have sought treatment for this condition, and where]",
    );
  });

  it("carries no AI label and no warning about AI-generated citations", () => {
    openReviewStep();

    expect(document.body.textContent).not.toMatch(
      /AI Enhanced|AI-enhanced statement|AI-generated literature/,
    );
    expect(
      screen.queryByRole("button", { name: "Try the AI again" }),
    ).not.toBeInTheDocument();
  });

  it("can be edited in place, and the edit is what gets saved", () => {
    const onSave = vi.fn();
    openReviewStep(onSave);
    const edited = TEMPLATE.replace("[date the symptoms began]", "March 2011");
    fireEvent.change(statementField(), { target: { value: edited } });

    expect(statementField().value).toBe(edited);
    fireEvent.click(screen.getAllByRole("checkbox").at(-1));
    fireEvent.click(screen.getByRole("button", { name: /save to packet/i }));
    expect(onSave.mock.calls[0][0].statement).toBe(edited);
  });
});

describe("NexusBuilder after asking the AI", () => {
  it("keeps the standard draft and its labels when nothing was reworded", async () => {
    enhancePersonalStatement.mockResolvedValue({
      success: true,
      content: TEMPLATE,
      draftPath: "template",
      draftNote: STANDARD_DRAFT_NOTE,
      passages: { sent: 0, accepted: 0, unchanged: 0, rejected: 0 },
    });
    await enhanceOnReviewStep();

    await screen.findByText(/did not change the wording/i);
    expect(statementField().value).toBe(TEMPLATE);
    expect(notice().textContent).toBe(STANDARD_DRAFT_NOTE);
    expect(document.body.textContent).not.toMatch(
      /AI Enhanced|AI-enhanced statement|AI-generated literature/,
    );
  });

  it("names the error behind a standard draft and offers another try", async () => {
    enhancePersonalStatement.mockResolvedValue({
      success: true,
      content: TEMPLATE,
      draftPath: "template",
      draftNote: STANDARD_DRAFT_NOTE,
      draftErrorReason: "AI cooling down... please wait 8 seconds.",
    });
    await enhanceOnReviewStep();

    expect(
      await screen.findByText("AI cooling down... please wait 8 seconds."),
    ).toBeInTheDocument();
    expect(notice().textContent).toBe(STANDARD_DRAFT_NOTE);
    expect(document.body.textContent).not.toMatch(/AI Enhanced/);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(
      await screen.findByRole("button", { name: /i understand, enhance/i }),
    ).toBeInTheDocument();
  });

  it("labels a reworded draft as AI, drops the notice and shows the citation warning", async () => {
    const reworded = TEMPLATE.replace(
      "Effect on my work:",
      "Effect on my work: To put it plainly,",
    );
    enhancePersonalStatement.mockResolvedValue({
      success: true,
      content: reworded,
      draftPath: "model",
      draftNote: null,
      passageOutcomes: [REWORDING],
    });
    await enhanceOnReviewStep();

    await screen.findByText(/AI-enhanced statement/);
    expect(statementField().value).toBe(reworded);
    expect(notice()).not.toBeInTheDocument();
    expect(document.body.textContent).toMatch(/AI-generated literature/);
    expect(screen.getAllByText(/AI Enhanced/).length).toBeGreaterThan(0);
  });

  it("goes back to the standard draft, notice and all, when Standard is chosen", async () => {
    enhancePersonalStatement.mockResolvedValue({
      success: true,
      content: TEMPLATE,
      draftPath: "model",
      draftNote: null,
      passageOutcomes: [REWORDING],
    });
    await enhanceOnReviewStep();
    await screen.findByText(/AI-enhanced statement/);

    fireEvent.click(screen.getByRole("button", { name: "Standard" }));
    expect(statementField().value).toBe(TEMPLATE);
    expect(notice().textContent).toBe(STANDARD_DRAFT_NOTE);
    expect(document.body.textContent).not.toMatch(/AI-generated literature/);
  });
});

describe("NexusBuilder, an edited statement and the AI", () => {
  it("leaves an edited statement untouched when the AI fails", async () => {
    enhancePersonalStatement.mockResolvedValue({
      success: true,
      content: TEMPLATE,
      draftPath: "template",
      draftNote: STANDARD_DRAFT_NOTE,
      draftErrorReason: "WebGPU inference timed out",
    });
    await enhanceOnReviewStep("A line I typed myself.");

    await screen.findByText("WebGPU inference timed out");
    expect(statementField().value).toBe(
      `${TEMPLATE}\n\nA line I typed myself.`,
    );
  });

  it("puts the AI's wording into the edited statement, keeping the edit", async () => {
    enhancePersonalStatement.mockResolvedValue({
      success: true,
      content: TEMPLATE,
      draftPath: "model",
      draftNote: null,
      passageOutcomes: [REWORDING],
    });
    await enhanceOnReviewStep("A line I typed myself.");

    await screen.findByText(/AI-enhanced statement/);
    expect(statementField().value).toContain(
      "Effect on my work: To put it plainly,",
    );
    expect(statementField().value).toContain("A line I typed myself.");
  });
});
