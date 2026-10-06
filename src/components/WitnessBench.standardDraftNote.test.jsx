/**
 * Witness Bench on the screen: when the AI's wording is not used, the
 * witness sees the standard statement with the standard-draft notice, a
 * named status region whose meaning is in its text. Fixture values are
 * invented for these tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext.jsx";
import { STANDARD_DRAFT_NOTE } from "../utils/writerTemplates";

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

describe("Witness Bench standard-draft notice", () => {
  it("is shown, by name and in words, when the model refuses", async () => {
    modelAnswersStatement(
      () =>
        "I cannot draft a buddy statement because you have not provided the specific details.",
    );
    const statement = await generateStatement();

    const notice = screen.getByRole("status", { name: "Draft notice" });
    expect(notice.textContent).toBe(STANDARD_DRAFT_NOTE);
    expect(statement.value).toContain("Witness Type: Spouse / Partner");
    expect(statement.value).not.toMatch(/\bAI\b/);
    expect(statement.value).toContain("Sam Example");
    expect(statement.value).toContain(
      "WITNESS ATTESTATION (read before you sign)",
    );
  });

  it("is shown with no AI set up, on a statement that never mentions AI", async () => {
    ai.available = false;
    const statement = await generateStatement();

    expect(generateAI).not.toHaveBeenCalled();
    expect(
      screen.getByRole("status", { name: "Draft notice" }).textContent,
    ).toBe(STANDARD_DRAFT_NOTE);
    expect(statement.value).toContain(
      "They leave the room when fireworks start.",
    );
    expect(statement.value).toContain("[Witness Signature]");
    expect(statement.value).toContain("Sam Example");
    expect(statement.value).not.toMatch(/\bAI\b/);
  });

  it("the statement text box has an accessible name", async () => {
    modelAnswersStatement((prompt) => numbered(passagesIn(prompt)));
    const statement = await generateStatement();

    expect(screen.getByRole("textbox", { name: "Your Buddy Statement" })).toBe(
      statement,
    );
  });

  it("is shown after an engine error", async () => {
    modelAnswersStatement(() => {
      throw new Error("WebGPU inference timed out");
    });
    const statement = await generateStatement();

    expect(
      screen.getByRole("status", { name: "Draft notice" }).textContent,
    ).toBe(STANDARD_DRAFT_NOTE);
    expect(statement.value).toContain("They no longer drive at night.");
  });

  it("is not shown when the model's wording was accepted", async () => {
    modelAnswersStatement((prompt) => numbered(passagesIn(prompt).map(reword)));
    const statement = await generateStatement();

    expect(
      screen.queryByRole("status", { name: "Draft notice" }),
    ).not.toBeInTheDocument();
    expect(statement.value).toContain(
      "To put it plainly, they leave the room when fireworks start.",
    );
    expect(statement.value).toContain("was suggested by AI");
    expect(statement.value).toContain("Sam Example");
    expect(statement.value).not.toContain("[Witness Printed Name]");
    for (const [prompt] of generateAI.mock.calls) {
      expect(prompt).not.toContain("Sam Example");
    }
    expect(statement.value).toContain(
      "WITNESS ATTESTATION (read before you sign)",
    );
  });

  it("is shown when the model only echoes the answers", async () => {
    modelAnswersStatement((prompt) => numbered(passagesIn(prompt)));
    const statement = await generateStatement();

    expect(
      screen.getByRole("status", { name: "Draft notice" }).textContent,
    ).toBe(STANDARD_DRAFT_NOTE);
    expect(statement.value).toContain(
      "They leave the room when fireworks start.",
    );
  });
});
