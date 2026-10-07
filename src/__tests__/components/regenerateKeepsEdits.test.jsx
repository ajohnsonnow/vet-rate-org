/**
 * Forms Helper and Nexus Builder: when the veteran edits the draft, goes
 * back, changes an answer and regenerates, the edited draft is still in
 * the box and the app asks, in plain words, whether to keep it or rebuild
 * from the answers. It never replaces the edit without asking. All values
 * are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";

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

const { default: FormsHelper } =
  await import("../../components/FormsHelper.jsx");
const { default: NexusBuilder } =
  await import("../../components/NexusBuilder.jsx");

const EDIT = "A line I typed into the draft myself.";
const KEEP = "Keep my edited draft";
const REBUILD = "Rebuild from my answers";
const dialog = () => screen.queryByRole("alertdialog");
const field = (name) => document.getElementById(`forms-helper-field-${name}`);

const REQUIRED = {
  veteranName: "Marlow Testwright",
  conditionName: "Tinnitus",
  claimType: "initial",
  onsetDate: "March 2011",
  inServiceEvent: "A range accident during a night drill",
  symptoms: "Ringing in both ears",
  worstDays: "I cannot follow a conversation",
  workImpact: "I miss about two shifts a month",
  dailyImpact: "I cannot use the phone",
};

const draft = () => screen.getByRole("textbox", { name: /^Your statement/ });
const next = () => screen.queryByRole("button", { name: /^next$/i });
const outOfStep = () =>
  screen.queryByRole("note", { name: "Draft and answers differ" });

beforeEach(() => {
  localStorage.clear();
});

describe("Forms Helper", () => {
  function walkToResult(change = {}) {
    for (let guard = 0; guard < 12; guard++) {
      for (const [name, value] of Object.entries({ ...REQUIRED, ...change })) {
        if (field(name)) fireEvent.change(field(name), { target: { value } });
      }
      if (!next()) break;
      fireEvent.click(next());
    }
    fireEvent.click(
      screen.getByRole("button", { name: /generate statement/i }),
    );
  }

  function editThenGoBack() {
    render(
      <LanguageProvider>
        <FormsHelper onClose={() => {}} />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByText("Statement in Support of Claim"));
    fireEvent.click(screen.getByText("Start Guided Builder"));
    walkToResult();
    const edited = `${draft().value}\n\n${EDIT}`;
    fireEvent.change(draft(), { target: { value: edited } });
    fireEvent.click(screen.getByRole("button", { name: /edit answers/i }));
    return edited;
  }

  it("asks before replacing an edited draft, and the edit is still in the box", () => {
    const edited = editThenGoBack();
    walkToResult({ workImpact: "I lost my job in May" });

    expect(dialog()).toHaveAccessibleName("You edited this draft");
    expect(screen.getByRole("button", { name: KEEP })).toHaveFocus();
    expect(draft().value).toBe(edited);
  });

  it("keeps the edited draft when the veteran says so", () => {
    const edited = editThenGoBack();
    walkToResult({ workImpact: "I lost my job in May" });
    fireEvent.click(screen.getByRole("button", { name: KEEP }));

    expect(dialog()).not.toBeInTheDocument();
    expect(draft().value).toBe(edited);
    expect(draft()).toHaveFocus();
    expect(outOfStep().textContent).toMatch(
      /does not include the answer you changed.*official PDF uses your current answers/i,
    );
    expect(draft()).toHaveAccessibleDescription(/does not include the answer/);
  });

  it("rebuilds from the answers when the veteran says so", () => {
    editThenGoBack();
    walkToResult({ workImpact: "I lost my job in May" });
    fireEvent.click(screen.getByRole("button", { name: REBUILD }));

    expect(dialog()).not.toBeInTheDocument();
    expect(draft().value).toContain("I lost my job in May.");
    expect(draft().value).not.toContain(EDIT);
    expect(draft()).toHaveFocus();
    expect(outOfStep()).not.toBeInTheDocument();
  });

  it("does not ask when no answer changed: the edit simply stays", () => {
    const edited = editThenGoBack();
    walkToResult();

    expect(dialog()).not.toBeInTheDocument();
    expect(draft().value).toBe(edited);
    expect(outOfStep()).not.toBeInTheDocument();
  });

  it("does not ask when the draft was never edited", () => {
    render(
      <LanguageProvider>
        <FormsHelper onClose={() => {}} />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByText("Statement in Support of Claim"));
    fireEvent.click(screen.getByText("Start Guided Builder"));
    walkToResult();
    fireEvent.click(screen.getByRole("button", { name: /edit answers/i }));
    walkToResult({ workImpact: "I lost my job in May" });

    expect(dialog()).not.toBeInTheDocument();
    expect(draft().value).toContain("I lost my job in May.");
  });
});

describe("Nexus Builder", () => {
  const LABEL = "Statement in Support of Claim (VA Form 21-4138)";
  const statement = () => screen.getByRole("textbox", { name: LABEL });
  const step = (name) => fireEvent.click(screen.getByRole("button", { name }));
  const differs = () =>
    screen.queryByRole("note", { name: "Statement and answers differ" });

  function editThenGoBack() {
    render(
      <LanguageProvider>
        <NexusBuilder
          onClose={() => {}}
          onSave={() => true}
          condition="Tinnitus"
        />
      </LanguageProvider>,
    );
    step(/next step/i);
    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "I miss about two shifts a month" },
    });
    step(/next step/i);
    const edited = `${statement().value}\n\n${EDIT}`;
    fireEvent.change(statement(), { target: { value: edited } });
    step(/^back$/i);
    return edited;
  }

  it("asks before replacing an edited statement, and the edit is still in the box", () => {
    const edited = editThenGoBack();
    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "I lost my job in May" },
    });
    step(/next step/i);

    expect(dialog()).toHaveAccessibleName("You edited this draft");
    expect(screen.getByRole("button", { name: KEEP })).toHaveFocus();
    expect(statement().value).toBe(edited);

    fireEvent.click(screen.getByRole("button", { name: KEEP }));
    expect(dialog()).not.toBeInTheDocument();
    expect(statement().value).toBe(edited);
    expect(statement()).toHaveFocus();
  });

  it("says the kept statement and the answers differ, and keeps saying so while it is edited", () => {
    const edited = editThenGoBack();
    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "I lost my job in May" },
    });
    step(/next step/i);
    expect(differs()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: KEEP }));

    expect(differs().textContent).toMatch(
      /does not include the answer you changed.*notes for your doctor below use your current answers/i,
    );
    expect(statement()).toHaveAccessibleDescription(
      /does not include the answer/,
    );

    fireEvent.change(statement(), { target: { value: `${edited} More.` } });
    expect(differs()).toBeInTheDocument();
  });

  it("rebuilds from the answers when the veteran says so", () => {
    editThenGoBack();
    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "I lost my job in May" },
    });
    step(/next step/i);
    fireEvent.click(screen.getByRole("button", { name: REBUILD }));

    expect(statement().value).toContain("I lost my job in May.");
    expect(statement().value).not.toContain(EDIT);
    expect(statement()).toHaveFocus();
    expect(differs()).not.toBeInTheDocument();
  });

  it("does not ask when no answer changed", () => {
    const edited = editThenGoBack();
    step(/next step/i);

    expect(dialog()).not.toBeInTheDocument();
    expect(statement().value).toBe(edited);
    expect(differs()).not.toBeInTheDocument();
  });
});
