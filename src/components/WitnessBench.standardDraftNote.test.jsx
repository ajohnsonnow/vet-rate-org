/**
 * Witness Bench on the screen: when the AI's wording is not used, the
 * witness sees the standard statement with the standard-draft notice, a
 * named status region whose meaning is in its text. Fixture values are
 * invented for these tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext.jsx";

const ai = vi.hoisted(() => ({ available: true }));

vi.mock("../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAnyAIAvailable: () => ai.available,
    getAIStatus: () => ({ statusText: "Local AI" }),
    generateAI: vi.fn(),
  };
});
vi.mock("../utils/veteranContextProvider", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getVeteranAIContext: vi.fn(async () => ""),
    saveAnalysisResults: vi.fn(async () => ({})),
  };
});

const { generateAI } = await import("../utils/unifiedAIService");
const { WITNESS_DRAFT_NOTE } = await import("../utils/writerTemplates");
const { default: WitnessBench } = await import("./WitnessBench.jsx");

const ANSWERS = [
  "I have been married to the veteran since 2012.",
  "They leave the room when fireworks start.",
  "They no longer drive at night.",
];
const isStatementRequest = (prompt) => prompt.includes("Rewrite each passage");
const passagesIn = (prompt) =>
  prompt
    .split("\n")
    .filter((line) => /^\d+\. /.test(line))
    .map((line) => line.replace(/^\d+\. /, ""));
const numbered = (passages) =>
  passages.map((passage, i) => `${i + 1}. ${passage}`).join("\n");
/** Rewords a passage without adding a fact. */
const reword = (passage) =>
  `To put it plainly, ${/^I\b/.test(passage) ? passage : passage[0].toLowerCase() + passage.slice(1)}`;

/** The interview questions fall back to the built-in set; only the statement request is answered. */
const modelAnswersStatement = (reply) =>
  generateAI.mockImplementation(async (prompt) => {
    if (!isStatementRequest(prompt)) throw new Error("no questions");
    return { text: reply(prompt) };
  });

async function generateStatement() {
  render(
    <LanguageProvider>
      <WitnessBench onClose={() => {}} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /spouse \/ partner/i }));
  fireEvent.change(
    screen.getByPlaceholderText(
      "e.g., PTSD, Lower Back Pain, Tinnitus, Sleep Apnea",
    ),
    { target: { value: "PTSD" } },
  );
  fireEvent.change(screen.getByPlaceholderText("e.g., Jane Smith, John Doe"), {
    target: { value: "Sam Example" },
  });
  fireEvent.click(screen.getByRole("button", { name: /start interview/i }));

  const next = () => screen.queryByRole("button", { name: /^next/i });
  for (const answer of ANSWERS) {
    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: answer },
    });
    if (next()) fireEvent.click(next());
  }
  // The generate button is on the last question; the rest stay unanswered.
  for (let guard = 0; next() && guard < 12; guard++) fireEvent.click(next());
  fireEvent.click(screen.getByRole("button", { name: /generate statement/i }));
  return screen.findByDisplayValue(/leave the room when fireworks start/);
}

beforeEach(() => {
  localStorage.clear();
  ai.available = true;
  generateAI.mockReset();
});

describe("Witness Bench notice above the statement", () => {
  it("tells the witness these are their words to finish, with AI set up", async () => {
    modelAnswersStatement(
      (prompt) =>
        `1. ${passagesIn(prompt)[0] ?? "I did what the veteran did."}`,
    );
    const statement = await generateStatement();

    const notice = screen.getByRole("status", { name: "Draft notice" });
    expect(notice.textContent).toBe(WITNESS_DRAFT_NOTE);
    expect(statement.value).toContain("Witness Type: Spouse / Partner");
    expect(statement.value).toContain("Sam Example");
    expect(statement.value).not.toMatch(/\bAI\b/);
    expect(statement.value).toContain(
      "WITNESS ATTESTATION (read before you sign)",
    );
  });

  it("never asks the model to reword the witness's answers", async () => {
    modelAnswersStatement((prompt) => numbered(passagesIn(prompt).map(reword)));
    const statement = await generateStatement();

    expect(
      generateAI.mock.calls.filter(([prompt]) => isStatementRequest(prompt)),
    ).toEqual([]);
    for (const answer of ANSWERS) expect(statement.value).toContain(answer);
    expect(statement.value).not.toContain("To put it plainly");
    expect(
      screen.queryByRole("button", { name: "Try the AI again" }),
    ).not.toBeInTheDocument();
  });

  it("is the same with no AI set up", async () => {
    ai.available = false;
    const statement = await generateStatement();

    expect(generateAI).not.toHaveBeenCalled();
    expect(
      screen.getByRole("status", { name: "Draft notice" }).textContent,
    ).toBe(WITNESS_DRAFT_NOTE);
    expect(statement.value).toContain(
      "They leave the room when fireworks start.",
    );
    expect(statement.value).toContain("[Witness Signature]");
  });

  it("the statement text box has an accessible name", async () => {
    const statement = await generateStatement();

    expect(screen.getByRole("textbox", { name: "Your Buddy Statement" })).toBe(
      statement,
    );
  });
});
