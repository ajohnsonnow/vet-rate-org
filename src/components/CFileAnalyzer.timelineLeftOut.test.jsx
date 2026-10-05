/**
 * Final-24 item 2: an event with no real calendar date or no description is
 * never written, and the Save panel lists it as left out with the reason.
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { CFileSaveToRecords } = await import("./CFileAnalyzer.jsx");

const FILE = { name: "generic-letter.pdf", size: 10 };
const EXTRACTED = { totalPages: 1, text: "Generic text. ".repeat(20) };
const ANALYSIS = {
  potential_claims: [],
  timeline: [
    { date: "2018-01-02", category: "Medical", description: "Clinic visit" },
    { date: "", category: "Medical", description: "Floating event" },
    { date: "2018-05-06", category: "Service", description: "" },
  ],
};

describe("Save panel: timeline events left out", () => {
  it("lists only the writable event as saved and the other two as left out with reasons", () => {
    render(
      <CFileSaveToRecords
        file={FILE}
        extractedText={EXTRACTED}
        analysisResult={ANALYSIS}
      />,
    );
    expect(screen.getByText("Timeline events saved (1)")).toBeTruthy();
    expect(screen.getByText("Timeline events left out (2)")).toBeTruthy();
    const items = within(screen.getByTestId("cfile-save-timeline-left-out"))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(items[0]).toContain("Floating event");
    expect(items[0]).toContain("no real calendar date");
    expect(items[1]).toContain("no description");
  });
});
