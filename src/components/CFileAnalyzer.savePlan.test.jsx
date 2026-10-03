/**
 * Final-23 items 2 and 3: the Save panel lists exactly what Save writes (the
 * same plan builds both), and a word the model called a condition that the
 * condition catalogue does not recognise is shown as not recognised and left
 * out unless the veteran ticks it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("../utils/musterCallProcessor", async (importOriginal) => ({
  ...(await importOriginal()),
  persistFormationDocument: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../utils/veteranContextProvider", async (importOriginal) => ({
  ...(await importOriginal()),
  mergeAnalysisIntoVkb: vi.fn().mockResolvedValue(undefined),
}));

const { mergeAnalysisIntoVkb } =
  await import("../utils/veteranContextProvider");
const { CFileSaveToRecords } = await import("./CFileAnalyzer.jsx");

const FILE = { name: "generic-letter.pdf", size: 10 };
const EXTRACTED = {
  totalPages: 1,
  text: "Generic claims file text. ".repeat(20),
  deferredResult: {
    filename: FILE.name,
    size: FILE.size,
    classification: { type: "rating_decision" },
    extractedData: { decisionDate: "2019-03-03" },
  },
};
const ANALYSIS = {
  potential_claims: [
    { condition: "Tinnitus", evidence: "noted" },
    { condition: "Tuesday", evidence: "model guess" },
  ],
  timeline: [
    { date: "2018-01-02", category: "Medical", description: "Clinic visit" },
    { date: "2018-05-06", category: "Service", description: "Posted abroad" },
  ],
};

const renderPanel = () =>
  render(
    <CFileSaveToRecords
      file={FILE}
      extractedText={EXTRACTED}
      analysisResult={ANALYSIS}
    />,
  );

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Save to my records" }));

const listed = (testId) =>
  within(screen.getByTestId(testId))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the Save panel lists exactly what Save writes", () => {
  it("shows the same timeline events, and the same count, that the merge receives", async () => {
    renderPanel();
    const shown = listed("cfile-save-timeline");
    expect(shown).toHaveLength(3);
    expect(screen.getByText("Timeline events saved (3)")).toBeTruthy();

    save();
    await waitFor(() => expect(mergeAnalysisIntoVkb).toHaveBeenCalledTimes(1));
    const written = mergeAnalysisIntoVkb.mock.calls[0][0].vkbMergeData;
    expect(
      written.evidenceTimeline.map((e) => `${e.date}: ${e.description}`),
    ).toEqual(shown.slice(0, 2));
    expect(shown[2]).toMatch(/^2019-03-03: .*generic-letter\.pdf$/);
  });

  it("shows the same conditions that the merge receives", async () => {
    renderPanel();
    save();
    await waitFor(() => expect(mergeAnalysisIntoVkb).toHaveBeenCalledTimes(1));
    const written = mergeAnalysisIntoVkb.mock.calls[0][0].vkbMergeData;
    expect(listed("cfile-save-conditions")).toEqual(
      written.medicalConditionsCurrent.map((c) => c.name),
    );
    expect(written.claims.map((c) => c.condition)).toEqual(["Tinnitus"]);
  });
});

describe("a word the catalogue does not recognise as a condition", () => {
  it("is shown as not recognised and left out of what Save writes", async () => {
    renderPanel();
    expect(listed("cfile-save-conditions")).toEqual(["Tinnitus"]);
    const leftOut = screen.getByTestId("cfile-save-left-out");
    expect(leftOut.textContent).toMatch(/Not recognised as a condition \(1\)/);
    expect(within(leftOut).getByLabelText("Tuesday").checked).toBe(false);

    save();
    await waitFor(() => expect(mergeAnalysisIntoVkb).toHaveBeenCalledTimes(1));
    const written = mergeAnalysisIntoVkb.mock.calls[0][0].vkbMergeData;
    expect(JSON.stringify(written)).not.toContain("Tuesday");
  });

  it("is saved, and listed as saved, once the veteran ticks it", async () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText("Tuesday"));
    expect(listed("cfile-save-conditions")).toEqual(["Tinnitus", "Tuesday"]);
    expect(screen.queryByTestId("cfile-save-left-out")).toBeNull();

    save();
    await waitFor(() => expect(mergeAnalysisIntoVkb).toHaveBeenCalledTimes(1));
    const written = mergeAnalysisIntoVkb.mock.calls[0][0].vkbMergeData;
    expect(written.medicalConditionsCurrent.map((c) => c.name)).toEqual([
      "Tinnitus",
      "Tuesday",
    ]);
  });
});
