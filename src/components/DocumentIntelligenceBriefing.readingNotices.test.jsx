/**
 * D20-6/3: the import-time AI failure notice and the page-coverage note were
 * only reachable as a generic "Ai Analysis Notice" field far down the review
 * list. They must show plainly at the top of the review, and the notice must
 * not also be offered as a field to verify.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { default: DocumentIntelligenceBriefing } =
  await import("./DocumentIntelligenceBriefing.jsx");

const AI_NOTICE =
  "AI analysis of this document couldn't complete right now. Nothing was lost.";
const COVERAGE =
  "Read 2 of 4 page(s). 2 scanned page(s) (pages 3-4) were not read because only 1 scanned pages are read at a time.";

const extractionResult = {
  filename: "generic-c-file.pdf",
  size: 1000,
  pageCount: 4,
  method: "advanced_ocr",
  classification: { type: "C_FILE_MEDICAL", confidence: 0.9 },
  coverageNote: COVERAGE,
  pagesSkipped: [3, 4],
  pagesOCRd: 1,
  extractedData: {
    type: "c_file",
    aiAnalysisNotice: AI_NOTICE,
    summary: "Plain generic summary",
  },
};

// A fresh [] per render refires the briefing's per-document effect forever.
const NO_CONFLICTS = [];

function renderBriefing(result = extractionResult) {
  return render(
    <DocumentIntelligenceBriefing
      extractionResult={result}
      conflicts={NO_CONFLICTS}
      onVerify={vi.fn()}
      onSkip={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

describe("DocumentIntelligenceBriefing: reading notices", () => {
  it("shows the AI failure notice and the page coverage note in plain words", () => {
    renderBriefing();
    expect(screen.getByTestId("ai-analysis-notice")).toHaveTextContent(
      AI_NOTICE,
    );
    expect(screen.getByTestId("page-coverage-note")).toHaveTextContent(
      "Read 2 of 4 page(s)",
    );
  });

  it("does not list the notice as a generic field to verify", () => {
    renderBriefing();
    expect(screen.queryByText("Ai Analysis Notice")).not.toBeInTheDocument();
  });

  it("shows no reading notices for a clean text-layer document", () => {
    renderBriefing({
      ...extractionResult,
      coverageNote: "Read all 4 page(s) - every page had a usable text layer.",
      pagesSkipped: [],
      pagesOCRd: 0,
      extractedData: { type: "c_file", summary: "Plain generic summary" },
    });
    expect(
      screen.queryByTestId("document-reading-notices"),
    ).not.toBeInTheDocument();
  });
});
