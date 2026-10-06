/**
 * TDIU Builder: the work-history answers used to appear only in the
 * downloaded report. Each one, given with its own marker, must appear
 * exactly once on the result screen and once in each download, beside the
 * analysis as edited on screen, and once in the item saved to My Packet.
 * Work history is saved as typed and is not added to the insights other
 * tools draw on. The save button says when the item was saved and offers
 * to save changes after an edit, updating the same item. All values are
 * invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  draftFileText,
  flat,
  occurrences,
} from "../__tests__/helpers/draftFileText";

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
  isAnyAIAvailable: () => false,
  getAIStatus: () => ({ statusText: "No AI" }),
  generateAI: vi.fn(),
}));
vi.mock("../utils/veteranContextProvider", async (importOriginal) => ({
  ...(await importOriginal()),
  getVeteranAIContext: vi.fn(async () => ""),
  saveAnalysisResults: vi.fn(async () => ({ documentId: "doc-7" })),
  mergeAnalysisIntoVkb: vi.fn(async () => {}),
}));
vi.mock("../utils/myPacketManager", async (importOriginal) => ({
  ...(await importOriginal()),
  updatePacketDocument: vi.fn(async () => ({ success: true })),
}));

const { triggerBlobDownload } = await import("../utils/sanitize");
const { downloadDraft } = await import("../utils/draftExport");
const { generateAI } = await import("../utils/unifiedAIService");
const { saveAnalysisResults, mergeAnalysisIntoVkb } =
  await import("../utils/veteranContextProvider");
const { updatePacketDocument } = await import("../utils/myPacketManager");
const { default: TDIUBuilder } = await import("./TDIUBuilder.jsx");

const BOX_18 = "Statement for Box 18 (VA Form 21-8940)";
const WORK = {
  lastWorked: "Marker21 last worked",
  lastOccupation: "Marker22 occupation",
  reasonLeft: "Marker23 reason left",
  education: "Some College",
  triedToWork: "Marker25 tried to work",
};
const PRINTED = Object.values(WORK);
const EDIT = "Marker30 typed into Box 18 on screen.";
const FILES = [
  ["pdf", "Download as PDF"],
  ["docx", "Download as DOCX"],
];
const once = PRINTED.map(() => 1);
const counts = (text) => PRINTED.map((answer) => occurrences(text, answer));

async function generate(work = WORK) {
  render(<TDIUBuilder onClose={() => {}} />);
  fireEvent.change(screen.getAllByRole("combobox")[0], {
    target: { value: "Diabetes" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Fatigue" }));
  fireEvent.click(screen.getByRole("button", { name: /add this disability/i }));
  fireEvent.click(
    screen.getByRole("button", { name: /continue to work history/i }),
  );
  const type = (name, value) =>
    fireEvent.change(screen.getByRole("textbox", { name }), {
      target: { value },
    });
  type("When did you last work?", work.lastWorked);
  type("What was your last occupation?", work.lastOccupation);
  type("Why did you stop working?", work.reasonLeft);
  fireEvent.change(
    screen.getByRole("combobox", { name: "Highest level of education?" }),
    { target: { value: work.education } },
  );
  type(/Have you tried to work since leaving/, work.triedToWork);
  fireEvent.click(
    screen.getByRole("button", { name: /generate vocational statement/i }),
  );
  await screen.findByLabelText(BOX_18);
}

function editBox18() {
  const box = screen.getByLabelText(BOX_18);
  fireEvent.change(box, { target: { value: `${box.value} ${EDIT}` } });
  return screen.getByLabelText(BOX_18).value;
}

beforeEach(() => {
  localStorage.clear();
  downloadDraft.mockClear();
  saveAnalysisResults.mockClear();
  mergeAnalysisIntoVkb.mockClear();
  updatePacketDocument.mockClear();
  triggerBlobDownload.mockReturnValue(true);
});

describe("TDIU Builder work history", () => {
  it("is on the result screen, every answer exactly once", async () => {
    await generate();

    const history = screen.getByRole("region", { name: "Your work history" });
    expect(counts(history.textContent)).toEqual(once);
    expect(within(history).getByText("Why I stopped working")).toBeVisible();
    expect(generateAI).not.toHaveBeenCalled();
  });

  it("is left off the screen when nothing was answered", async () => {
    await generate({
      lastWorked: "",
      lastOccupation: "",
      reasonLeft: "",
      education: "",
      triedToWork: "",
    });

    expect(
      screen.queryByRole("region", { name: "Your work history" }),
    ).not.toBeInTheDocument();
  });

  it.each(FILES)(
    "is in the %s once, with the analysis as edited on screen",
    async (format, label) => {
      await generate();
      const box18 = editBox18();
      fireEvent.click(screen.getByRole("button", { name: /download$/i }));
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));

      await waitFor(() => expect(downloadDraft).toHaveBeenCalledTimes(1));
      const { bytes } = await downloadDraft.mock.results[0].value;
      const text = flat(await draftFileText(bytes, format));
      expect(bytes.length).toBeGreaterThan(100);
      expect(counts(text)).toEqual(once);
      expect(text).toContain(flat(box18));
      expect(occurrences(text, EDIT)).toBe(1);
    },
  );

  it("prints an answer in the download even when only a later one was given", async () => {
    await generate({ ...WORK, lastWorked: "", reasonLeft: "" });
    fireEvent.click(screen.getByRole("button", { name: /download$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Download as DOCX/ }));

    await waitFor(() => expect(downloadDraft).toHaveBeenCalledTimes(1));
    const { bytes } = await downloadDraft.mock.results[0].value;
    const text = await draftFileText(bytes, "docx");
    expect(text).toContain(`Last occupation: ${WORK.lastOccupation}`);
    expect(text).toContain(`Education: ${WORK.education}`);
  });

  it("says so and keeps the analysis when a download does not work", async () => {
    triggerBlobDownload.mockReturnValue(false);
    await generate();
    const box18 = editBox18();
    fireEvent.click(screen.getByRole("button", { name: /download$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Download as PDF/ }));

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /download did not work/i,
    );
    expect(screen.getByLabelText(BOX_18).value).toBe(box18);
  });
});

describe("TDIU Builder saved item", () => {
  const saveButton = (name) => screen.getByRole("button", { name });

  it("holds every work-history answer once, and keeps it out of the insights", async () => {
    await generate();
    fireEvent.click(saveButton("Save to My Packet"));
    await waitFor(() => expect(saveAnalysisResults).toHaveBeenCalledTimes(1));

    const saved = saveAnalysisResults.mock.calls[0][0];
    expect(counts(saved.rawText)).toEqual(once);
    expect(saved.extractedData.workHistory).toEqual({
      "Last worked": WORK.lastWorked,
      "Last occupation": WORK.lastOccupation,
      "Why I stopped working": WORK.reasonLeft,
      Education: WORK.education,
      "Attempts to work since": WORK.triedToWork,
    });
    expect(JSON.stringify(saved.vkbMergeData ?? {})).not.toMatch(/Marker2\d/);
  });

  it("says when it was saved, then offers to save changes after an edit", async () => {
    await generate();
    fireEvent.click(saveButton("Save to My Packet"));

    const saved = await screen.findByRole("button", {
      name: /^Saved to My Packet at \d{1,2}:\d{2}/,
    });
    expect(saved).toBeDisabled();
    expect(
      screen.getByRole("status", { name: "Save result" }).textContent,
    ).toMatch(/^Saved to My Packet at \d{1,2}:\d{2}/);

    editBox18();
    expect(saveButton("Save changes to My Packet")).toBeEnabled();
  });

  it("updates the item already saved instead of making a second", async () => {
    await generate();
    fireEvent.click(saveButton("Save to My Packet"));
    await screen.findByRole("button", { name: /^Saved to My Packet at/ });
    const box18 = editBox18();
    fireEvent.click(saveButton("Save changes to My Packet"));
    await screen.findByRole("button", { name: /^Saved to My Packet at/ });

    expect(saveAnalysisResults).toHaveBeenCalledTimes(1);
    expect(updatePacketDocument).toHaveBeenCalledTimes(1);
    const [id, document] = updatePacketDocument.mock.calls[0];
    expect(id).toBe("doc-7");
    expect(document.rawText).toContain(EDIT);
    expect(document.rawText.startsWith(box18)).toBe(true);
    expect(counts(document.rawText)).toEqual(once);
    expect(document).not.toHaveProperty("vkbMergeData");
  });
});

describe("TDIU Builder support banner", () => {
  it("does not tell the veteran what they just did", async () => {
    await generate();

    expect(document.body.textContent).not.toMatch(/You just did it for free/);
    expect(document.body.textContent).toMatch(
      /This tool is free\. Help keep it available for every veteran/,
    );
  });
});
