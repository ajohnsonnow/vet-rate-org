/**
 * Reopening the Nexus Builder for a condition that already has a saved
 * statement: the saved text is offered to continue from, and a new
 * statement never replaces the saved one without asking. All values are
 * invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { saveStatementForCondition } from "../../utils/claimsStorage";

vi.mock("../../utils/aiStatementHelper", async (importOriginal) => ({
  ...(await importOriginal()),
  isAIAvailable: () => false,
}));
const { default: NexusBuilder } =
  await import("../../components/NexusBuilder.jsx");

const LABEL = "Statement in Support of Claim (VA Form 21-4138)";
const SAVED_TEXT = "My saved statement, with words I wrote myself.";
const SAVED = {
  condition: "Tinnitus",
  primaryCondition: null,
  answers: {
    symptomOnsetDate: "March 2011",
    hasTreatment: "no",
    workImpact: "I miss about two shifts a month",
    socialImpact: "",
    specificExamples: "",
  },
  statement: SAVED_TEXT,
};
const statement = () => screen.getByRole("textbox", { name: LABEL });
const dialog = () => screen.queryByRole("alertdialog");

function open(props = {}) {
  const onSave = vi.fn(() => true);
  render(
    <LanguageProvider>
      <NexusBuilder
        onClose={() => {}}
        onSave={onSave}
        condition="Tinnitus"
        {...props}
      />
    </LanguageProvider>,
  );
  return onSave;
}

function toReview() {
  for (let step = 0; step < 5; step++) {
    const next = screen.queryByRole("button", { name: /next step/i });
    if (!next) break;
    fireEvent.click(next);
  }
}

function certifyAndSave() {
  fireEvent.click(screen.getAllByRole("checkbox").at(-1));
  fireEvent.click(screen.getByRole("button", { name: /save to packet/i }));
}

beforeEach(() => {
  localStorage.clear();
});

describe("Nexus Builder with a saved statement for the condition", () => {
  beforeEach(() => {
    saveStatementForCondition(SAVED);
  });

  it("offers the saved statement to continue from, before anything else", () => {
    open();

    expect(dialog()).toHaveAccessibleName(
      "You have a saved statement for Tinnitus",
    );
    expect(
      screen.getByRole("button", { name: "Continue from my saved statement" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Start a new statement" }),
    ).toBeInTheDocument();
  });

  it("continues from the saved text and answers, and saves without a second question", () => {
    const onSave = open();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue from my saved statement" }),
    );
    toReview();

    expect(statement().value).toBe(SAVED_TEXT);
    fireEvent.change(statement(), {
      target: { value: `${SAVED_TEXT} And one more line.` },
    });
    certifyAndSave();
    expect(dialog()).not.toBeInTheDocument();
    expect(onSave.mock.calls[0][0].statement).toBe(
      `${SAVED_TEXT} And one more line.`,
    );
    expect(onSave.mock.calls[0][0].answers.workImpact).toBe(
      "I miss about two shifts a month",
    );
  });

  it("asks before a new statement replaces the saved one, and can keep the saved one", () => {
    const onSave = open();
    fireEvent.click(
      screen.getByRole("button", { name: "Start a new statement" }),
    );
    toReview();
    expect(statement().value).not.toContain(SAVED_TEXT);
    const fresh = statement().value;
    certifyAndSave();

    expect(dialog()).toHaveAccessibleName("Replace your saved statement?");
    fireEvent.click(
      screen.getByRole("button", { name: "Keep my saved statement" }),
    );
    expect(onSave).not.toHaveBeenCalled();
    expect(dialog()).not.toBeInTheDocument();
    expect(statement().value).toBe(fresh);
  });

  it("replaces the saved one only when the veteran says so", () => {
    const onSave = open();
    fireEvent.click(
      screen.getByRole("button", { name: "Start a new statement" }),
    );
    toReview();
    certifyAndSave();
    fireEvent.click(
      screen.getByRole("button", { name: "Replace it with this statement" }),
    );

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].statement).toBe(statement().value);
  });

  it("opens straight into the saved statement when resumed from My Packet", () => {
    open({ existingStatement: SAVED });

    expect(dialog()).not.toBeInTheDocument();
    toReview();
    expect(statement().value).toBe(SAVED_TEXT);
  });
});

describe("Nexus Builder with nothing saved for the condition", () => {
  it("asks nothing on opening or on saving", () => {
    const onSave = open();

    expect(dialog()).not.toBeInTheDocument();
    toReview();
    certifyAndSave();
    expect(dialog()).not.toBeInTheDocument();
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
