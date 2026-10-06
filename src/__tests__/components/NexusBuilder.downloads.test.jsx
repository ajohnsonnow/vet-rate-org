/**
 * Every Nexus Builder download format is a real, non-empty file that holds
 * the statement as it stands on screen, edits included. The condition is one
 * the veteran typed, with nothing saved. Fixture values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { draftFileText, flat } from "../helpers/draftFileText";

vi.mock("../../utils/sanitize", async (importOriginal) => ({
  ...(await importOriginal()),
  triggerBlobDownload: vi.fn(() => true),
}));
vi.mock("../../utils/draftExport", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    downloadDraft: vi.fn((...args) => actual.downloadDraft(...args)),
  };
});
vi.mock("../../utils/aiStatementHelper", async (importOriginal) => ({
  ...(await importOriginal()),
  isAIAvailable: () => false,
}));
const { triggerBlobDownload } = await import("../../utils/sanitize");
const { downloadDraft } = await import("../../utils/draftExport");
const { default: NexusBuilder } =
  await import("../../components/NexusBuilder.jsx");

const LABEL = "Statement in Support of Claim (VA Form 21-4138)";
const FORMATS = [
  ["txt", "Text (.txt)"],
  ["docx", "Word (.docx)"],
  ["pdf", "PDF (.pdf)"],
];
const statementField = () => screen.getByRole("textbox", { name: LABEL });

function openReviewStepForTypedCondition() {
  render(
    <LanguageProvider>
      <NexusBuilder onClose={() => {}} onSave={() => true} />
    </LanguageProvider>,
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Plantar fasciitis" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  for (let step = 0; step < 5; step++) {
    const next = screen.queryByRole("button", { name: /next step/i });
    if (!next) break;
    fireEvent.click(next);
  }
}

function editedStatement() {
  const edited = statementField().value.replace(
    "[date the symptoms began]",
    "the spring of 2011 (edited on screen)",
  );
  fireEvent.change(statementField(), { target: { value: edited } });
  return edited;
}

function chooseDownload(label) {
  fireEvent.click(screen.getAllByRole("checkbox").at(-1));
  fireEvent.click(screen.getByRole("button", { name: /download statement/i }));
  fireEvent.click(screen.getByRole("button", { name: label }));
}

beforeEach(() => {
  localStorage.clear();
  downloadDraft.mockClear();
  triggerBlobDownload.mockClear();
  triggerBlobDownload.mockReturnValue(true);
});

describe.each(FORMATS)("NexusBuilder %s download", (format, label) => {
  it("is a non-empty file holding the statement on screen", async () => {
    openReviewStepForTypedCondition();
    const onScreen = editedStatement();
    chooseDownload(label);

    await waitFor(() => expect(downloadDraft).toHaveBeenCalledTimes(1));
    const { bytes, fileName } = await downloadDraft.mock.results[0].value;
    expect(fileName).toBe(`VA-Statement-Plantar-fasciitis.${format}`);
    expect(bytes.length).toBeGreaterThan(100);

    const text = flat(await draftFileText(bytes, format));
    expect(text).toContain(flat(onScreen));
    expect(text).toContain("the spring of 2011 (edited on screen)");
    expect(text).toContain("DOCTOR'S CHEAT SHEET");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says so in plain words, and keeps the draft, when it cannot start", async () => {
    triggerBlobDownload.mockReturnValue(false);
    openReviewStepForTypedCondition();
    const onScreen = editedStatement();
    chooseDownload(label);

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /download did not work/i,
    );
    expect(statementField().value).toBe(onScreen);
  });
});
