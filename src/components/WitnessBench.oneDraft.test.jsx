/**
 * One draft in the Witness Bench. Every question is answered through the
 * real interview with its own marker; each answer, and each thing typed on
 * the setup step, must appear exactly once in the statement on screen, in
 * the copied text, in each download and in what Save to My Packet stores,
 * along with an edit made on screen. A download's opening line follows how
 * the statement was written: it mentions AI only when the model reworded
 * something. All values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext.jsx";
import {
  draftFileText,
  flat,
  occurrences,
} from "../__tests__/helpers/draftFileText";
import { getSavedClaims } from "../utils/claimsStorage";

const ai = vi.hoisted(() => ({ available: false }));

vi.mock("../utils/sanitize", async (importOriginal) => ({
  ...(await importOriginal()),
  triggerBlobDownload: vi.fn(() => true),
}));
vi.mock("../utils/draftExport", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    downloadDraft: vi.fn((...args) => actual.downloadDraft(...args)),
  };
});
vi.mock("../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => ai.available,
  getAIStatus: () => ({ statusText: "Local AI" }),
  generateAI: vi.fn(),
}));
vi.mock("../utils/veteranContextProvider", async (importOriginal) => ({
  ...(await importOriginal()),
  getVeteranAIContext: vi.fn(async () => ""),
  saveAnalysisResults: vi.fn(async () => ({ documentId: "doc-1" })),
}));
vi.mock("../utils/myPacketManager", async (importOriginal) => ({
  ...(await importOriginal()),
  updatePacketDocument: vi.fn(async () => ({ success: true })),
}));

const { downloadDraft } = await import("../utils/draftExport");
const { generateAI } = await import("../utils/unifiedAIService");
const { saveAnalysisResults } = await import("../utils/veteranContextProvider");
const { updatePacketDocument } = await import("../utils/myPacketManager");
const { default: WitnessBench } = await import("./WitnessBench.jsx");

const CONDITION = "Marker10 condition";
const WITNESS = "Marker11 Witness";
const EDIT = "A line the witness typed into the statement on screen.";
const FILES = [
  ["pdf", "Download as PDF"],
  ["docx", "Download as DOCX"],
];
const statementField = () =>
  screen.getByRole("textbox", { name: "Your Buddy Statement" });
const numbered = (passages) =>
  passages.map((passage, i) => `${i + 1}. ${passage}`).join("\n");
const passagesIn = (prompt) =>
  prompt
    .split("\n")
    .filter((line) => /^\d+\. /.test(line))
    .map((line) => line.replace(/^\d+\. /, ""));

/** The built-in questions are used; only the statement request is answered. */
const modelAnswersStatement = (reply) =>
  generateAI.mockImplementation(async (prompt) => {
    if (!prompt.includes("Rewrite each passage"))
      throw new Error("no questions");
    return { text: reply(prompt) };
  });

/** Answer every question with its own marker and generate the statement. */
async function answerEverything() {
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
    { target: { value: CONDITION } },
  );
  fireEvent.change(screen.getByPlaceholderText("e.g., Jane Smith, John Doe"), {
    target: { value: WITNESS },
  });
  fireEvent.click(screen.getByRole("button", { name: /start interview/i }));

  const answers = [];
  const next = () => screen.queryByRole("button", { name: /^next/i });
  for (let i = 0; i < 20; i++) {
    const answer = `They did the thing in marker${30 + i} that I saw.`;
    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: answer },
    });
    answers.push(answer);
    if (!next()) break;
    fireEvent.click(next());
  }
  fireEvent.click(screen.getByRole("button", { name: /generate statement/i }));
  await screen.findByRole("textbox", { name: "Your Buddy Statement" });
  return [CONDITION, WITNESS, "Witness Type: Spouse / Partner", ...answers];
}

function typeAnEdit() {
  fireEvent.change(statementField(), {
    target: { value: `${statementField().value}\n\n${EDIT}` },
  });
  return statementField().value;
}

const counts = (text, printed) =>
  printed.map((answer) => occurrences(text, answer));
const once = (printed) => printed.map(() => 1);

beforeEach(() => {
  localStorage.clear();
  ai.available = false;
  generateAI.mockReset();
  downloadDraft.mockClear();
  saveAnalysisResults.mockClear();
  updatePacketDocument.mockClear();
});

describe("Witness Bench, standard statement", () => {
  it("shows every answer exactly once in the statement on screen", async () => {
    const printed = await answerEverything();

    expect(printed.length).toBeGreaterThan(5);
    expect(counts(statementField().value, printed)).toEqual(once(printed));
  });

  it("copies the statement as it stands on screen", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    vi.spyOn(window, "alert").mockImplementation(() => {});
    const printed = [...(await answerEverything()), EDIT];
    const onScreen = typeAnEdit();
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(onScreen));
    expect(counts(writeText.mock.calls[0][0], printed)).toEqual(once(printed));
    vi.restoreAllMocks();
  });

  it.each(FILES)(
    "puts that statement, every answer once and no word of AI, in the %s",
    async (format, label) => {
      const printed = [...(await answerEverything()), EDIT];
      const onScreen = typeAnEdit();
      fireEvent.click(screen.getByRole("button", { name: /download/i }));
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));

      await waitFor(() => expect(downloadDraft).toHaveBeenCalledTimes(1));
      const { bytes } = await downloadDraft.mock.results[0].value;
      const text = flat(await draftFileText(bytes, format));
      expect(text.startsWith("DRAFT - not a sworn statement.")).toBe(true);
      expect(text.endsWith(flat(onScreen))).toBe(true);
      expect(text).not.toMatch(/\bAI\b/);
      expect(counts(text, printed)).toEqual(once(printed));
    },
  );

  it("saves the statement on screen, and only when asked to", async () => {
    const printed = [...(await answerEverything()), EDIT];
    expect(saveAnalysisResults).not.toHaveBeenCalled();
    const onScreen = typeAnEdit();
    fireEvent.click(screen.getByRole("button", { name: /save to my packet/i }));

    const [claim] = getSavedClaims();
    expect(claim.evidence[0].statement).toBe(onScreen);
    expect(counts(claim.evidence[0].statement, printed)).toEqual(once(printed));
    expect(saveAnalysisResults).toHaveBeenCalledTimes(1);
    expect(saveAnalysisResults.mock.calls[0][0].rawText).toBe(onScreen);
  });

  it("says so and keeps the statement when the save does not work", async () => {
    await answerEverything();
    const onScreen = typeAnEdit();
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    fireEvent.click(screen.getByRole("button", { name: /save to my packet/i }));

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not be saved/i,
    );
    expect(statementField().value).toBe(onScreen);
    expect(saveAnalysisResults).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("Witness Bench, with the AI asked", () => {
  beforeEach(() => {
    ai.available = true;
  });

  it.each(FILES)(
    "says in the %s that AI suggested wording when it did",
    async (format, label) => {
      modelAnswersStatement((prompt) =>
        numbered(
          passagesIn(prompt).map((passage) => `To put it plainly, ${passage}`),
        ),
      );
      await answerEverything();
      const onScreen = statementField().value;
      expect(onScreen).toContain("was suggested by AI");
      fireEvent.click(screen.getByRole("button", { name: /download/i }));
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));

      await waitFor(() => expect(downloadDraft).toHaveBeenCalledTimes(1));
      const { bytes } = await downloadDraft.mock.results[0].value;
      const text = flat(await draftFileText(bytes, format));
      expect(text).toMatch(
        /^DRAFT - not a sworn statement\. The wording of some passages was suggested by AI\./,
      );
      expect(text.endsWith(flat(onScreen))).toBe(true);
    },
  );

  it.each(FILES)(
    "does not mention AI in the %s when the model changed nothing",
    async (format, label) => {
      modelAnswersStatement((prompt) => numbered(passagesIn(prompt)));
      await answerEverything();
      fireEvent.click(screen.getByRole("button", { name: /download/i }));
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));

      await waitFor(() => expect(downloadDraft).toHaveBeenCalledTimes(1));
      const { bytes } = await downloadDraft.mock.results[0].value;
      expect(flat(await draftFileText(bytes, format))).not.toMatch(/\bAI\b/);
    },
  );

  it("names the error behind a standard statement and offers another try", async () => {
    modelAnswersStatement(() => {
      throw new Error("WebGPU inference timed out");
    });
    const printed = await answerEverything();

    expect(screen.getByText(/WebGPU inference timed out/)).toBeInTheDocument();
    expect(counts(statementField().value, printed)).toEqual(once(printed));
    expect(statementField().value).not.toMatch(/\bAI\b/);

    modelAnswersStatement((prompt) =>
      numbered(
        passagesIn(prompt).map((passage) => `To put it plainly, ${passage}`),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Try the AI again" }));

    await waitFor(() =>
      expect(statementField().value).toContain("To put it plainly,"),
    );
    expect(screen.queryByText(/timed out/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try the AI again" }),
    ).not.toBeInTheDocument();
  });

  it("offers no retry when the AI was never asked or simply changed nothing", async () => {
    modelAnswersStatement((prompt) => numbered(passagesIn(prompt)));
    await answerEverything();

    expect(
      screen.queryByRole("button", { name: "Try the AI again" }),
    ).not.toBeInTheDocument();
  });
});

describe("Witness Bench, asking the AI again after it failed", () => {
  beforeEach(() => {
    ai.available = true;
  });

  it("leaves an edited statement untouched when the retry fails too", async () => {
    modelAnswersStatement(() => {
      throw new Error("WebGPU inference timed out");
    });
    await answerEverything();
    const edited = typeAnEdit();
    fireEvent.click(screen.getByRole("button", { name: "Try the AI again" }));

    await waitFor(() =>
      expect(generateAI.mock.calls.length).toBeGreaterThan(2),
    );
    await screen.findByRole("button", { name: "Try the AI again" });
    expect(statementField().value).toBe(edited);
    expect(screen.getByText(/WebGPU inference timed out/)).toBeInTheDocument();
  });

  it("rewords the statement in the box on a retry that works, keeping the edit", async () => {
    modelAnswersStatement(() => {
      throw new Error("WebGPU inference timed out");
    });
    const printed = await answerEverything();
    const edited = typeAnEdit();
    modelAnswersStatement((prompt) =>
      numbered(
        passagesIn(prompt).map(
          (passage) =>
            `To put it plainly, ${passage[0].toLowerCase()}${passage.slice(1)}`,
        ),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Try the AI again" }));

    await waitFor(() =>
      expect(statementField().value).toContain("To put it plainly,"),
    );
    const box = statementField().value;
    expect(occurrences(box, EDIT)).toBe(1);
    expect(box).toContain("was suggested by AI");
    expect(box.length).toBeGreaterThan(edited.length);
    expect(counts(box, printed.slice(0, 3))).toEqual([1, 1, 1]);
  });

  it("keeps an answer the witness rewrote in the box, and says nothing changed", async () => {
    modelAnswersStatement(() => {
      throw new Error("WebGPU inference timed out");
    });
    await answerEverything();
    const mine = statementField().value.replaceAll(
      /They did the thing in marker\d+ that I saw\./g,
      "My own words now.",
    );
    fireEvent.change(statementField(), { target: { value: mine } });
    modelAnswersStatement((prompt) =>
      numbered(
        passagesIn(prompt).map(
          (passage) =>
            `To put it plainly, ${passage[0].toLowerCase()}${passage.slice(1)}`,
        ),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Try the AI again" }));

    await screen.findByText(/did not change the wording/i);
    expect(statementField().value).toBe(mine);
  });
});

describe("Witness Bench saving the same statement again", () => {
  const saveButton = () => screen.getByRole("button", { name: /my packet/i });

  it("has a Save button beside Download, outside the menu", async () => {
    await answerEverything();

    expect(saveButton()).toBeVisible();
    expect(saveButton().textContent).toMatch(/Save to My Packet/);
    fireEvent.click(screen.getByRole("button", { name: /download/i }));
    expect(screen.getAllByRole("button", { name: /my packet/i })).toHaveLength(
      1,
    );
  });

  it("says it was saved and when, and does not offer to save the same text twice", async () => {
    await answerEverything();
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(saveButton().textContent).toMatch(/Saved to My Packet at \d/);
    expect(getSavedClaims()).toHaveLength(1);
  });

  it("updates the same claim and the same packet document when the statement changes", async () => {
    await answerEverything();
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveButton()).toBeDisabled());

    const changed = typeAnEdit();
    expect(saveButton()).toBeEnabled();
    expect(saveButton().textContent).toMatch(/Save changes to My Packet/);
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveButton()).toBeDisabled());

    const claims = getSavedClaims();
    expect(claims).toHaveLength(1);
    expect(claims[0].evidence).toHaveLength(1);
    expect(claims[0].evidence[0].statement).toBe(changed);
    expect(saveAnalysisResults).toHaveBeenCalledTimes(1);
    expect(updatePacketDocument).toHaveBeenCalledTimes(1);
    expect(updatePacketDocument.mock.calls[0][0]).toBe("doc-1");
    expect(updatePacketDocument.mock.calls[0][1].rawText).toBe(changed);
  });
});
