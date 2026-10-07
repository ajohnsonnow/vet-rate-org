/**
 * D20-9/3/6: how completely a document was read, and whether its AI analysis
 * finished, must be visible in plain words wherever the veteran looks - the
 * Muster Call completion view, the C-File Analyzer and My Packet - not only
 * as a generic field ~2,150 lines into the briefing.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

import DocumentReadingNotices from "./DocumentReadingNotices";
import MusterCallCompletionSummary from "./MusterCallCompletionSummary";
import {
  getReadingNotices,
  withStoredReadingNotes,
} from "../../utils/readingNotices";
import { buildDocumentFindings } from "../../utils/packetSummary";
import { FORMATION_STATUS } from "../../utils/formationQueue";

const { CFileReadCoverage } = await import("../CFileAnalyzer.jsx");

const AI_NOTICE =
  "AI analysis of this document couldn't complete right now. Nothing was lost.";
const SKIP_NOTE =
  "Read 2 of 4 page(s). 2 scanned page(s) (pages 3-4) were not read because only 1 scanned pages are read at a time.";

const savedEntry = (id, result) => ({
  id,
  filename: `${id}.pdf`,
  status: FORMATION_STATUS.SAVED,
  result,
});

describe("DocumentReadingNotices", () => {
  it("renders nothing when there is nothing to say", () => {
    const { container } = render(<DocumentReadingNotices />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces the AI failure and the coverage note politely, in plain words", () => {
    render(
      <DocumentReadingNotices
        aiAnalysisNotice={AI_NOTICE}
        coverageNote={SKIP_NOTE}
        pagesNotRead
      />,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText(/AI analysis did not finish/)).toBeInTheDocument();
    expect(screen.getByText(AI_NOTICE, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Read 2 of 4 page\(s\)/)).toBeInTheDocument();
  });
});

describe("MusterCallCompletionSummary", () => {
  it("lists a document whose AI analysis failed and one with unread pages, by name", () => {
    render(
      <MusterCallCompletionSummary
        formation={[
          savedEntry("cfile", {
            extractedData: { aiAnalysisNotice: AI_NOTICE },
          }),
          savedEntry("scan", {
            coverageNote: SKIP_NOTE,
            pagesSkipped: [3, 4],
            extractedData: {},
          }),
          savedEntry("clean", { extractedData: {} }),
        ]}
      />,
    );
    expect(screen.getByText("cfile.pdf")).toBeInTheDocument();
    expect(screen.getByText("scan.pdf")).toBeInTheDocument();
    expect(screen.queryByText("clean.pdf")).not.toBeInTheDocument();
    expect(screen.getByText(/AI analysis did not finish/)).toBeInTheDocument();
    expect(screen.getByText(/Read 2 of 4 page\(s\)/)).toBeInTheDocument();
  });

  it("shows a failed document's error instead of hiding it", () => {
    render(
      <MusterCallCompletionSummary
        formation={[
          {
            id: "bad",
            filename: "bad.pdf",
            status: FORMATION_STATUS.ERROR,
            error: "No text could be extracted from document",
          },
        ]}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No text could be extracted from document",
    );
  });

  it("renders nothing when every document read cleanly", () => {
    const { container } = render(
      <MusterCallCompletionSummary
        formation={[savedEntry("clean", { extractedData: {} })]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CFileReadCoverage", () => {
  it("shows the coverage note and a Read remaining pages action that fires", () => {
    const onRead = vi.fn();
    render(
      <CFileReadCoverage
        extractedText={{
          coverageNote: SKIP_NOTE,
          pagesSkipped: [3, 4],
          pagesBlank: [],
          pagesFailed: [],
          pagesOCRd: 1,
        }}
        onReadRemainingPages={onRead}
      />,
    );
    expect(screen.getByText(/Read 2 of 4 page\(s\)/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Read remaining pages" }),
    );
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it("offers no continue action when nothing was skipped", () => {
    render(
      <CFileReadCoverage
        extractedText={{
          coverageNote:
            "Read all 2 page(s). 2 blank page(s) (pages 1-2) had nothing to read.",
          pagesSkipped: [],
          pagesBlank: [1, 2],
          pagesFailed: [],
          pagesOCRd: 0,
        }}
        onReadRemainingPages={() => {}}
      />,
    );
    expect(screen.getByText(/blank page/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("stays silent for a plain text-layer read", () => {
    const { container } = render(
      <CFileReadCoverage
        extractedText={{
          coverageNote:
            "Read all 3 page(s) - every page had a usable text layer.",
          pagesSkipped: [],
          pagesBlank: [],
          pagesFailed: [],
          pagesOCRd: 0,
        }}
        onReadRemainingPages={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("stored document notes (My Packet)", () => {
  it("round-trips the coverage sentence and the AI notice into the packet findings", () => {
    const result = {
      coverageNote: SKIP_NOTE,
      pagesSkipped: [3, 4],
      extractedData: { aiAnalysisNotice: AI_NOTICE },
    };
    const stored = withStoredReadingNotes(result);
    const findings = buildDocumentFindings({
      id: "d1",
      fileName: "scan.pdf",
      extractedData: stored,
    });
    expect(findings.coverageNote).toBe(SKIP_NOTE);
    expect(findings.aiAnalysisNotice).toBe(AI_NOTICE);
    expect(getReadingNotices({ extractedData: stored }).coverageNote).toBe(
      SKIP_NOTE,
    );
  });

  it("stores nothing extra for a plain text-layer read", () => {
    const data = { branch: "ARMY" };
    expect(
      withStoredReadingNotes({
        coverageNote:
          "Read all 1 page(s) - every page had a usable text layer.",
        extractedData: data,
      }),
    ).toBe(data);
  });
});
