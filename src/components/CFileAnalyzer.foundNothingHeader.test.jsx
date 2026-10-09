/**
 * D19-2: the off-device fallback (cfileAnalyzer.js's
 * _buildOffDeviceFallbackResult) always writes a non-empty summary, even
 * when it found zero conditions - its own "found nothing" summary is prose
 * saying so. The header's old foundNothing check required summary to be
 * blank, so it could never fire for the fallback path and the green
 * "Analysis Complete" banner showed even when nothing was found. The
 * fallback's metadata.foundNothing flag is the authoritative signal and
 * must drive the header instead.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// CFileAnalyzer.jsx pulls in pdfExtractor.js -> pdfjs-dist, which
// references canvas globals jsdom doesn't provide - same recipe as
// cfileAnalyzer.offDeviceFallback.test.js.
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { CFileDashboardHeader } = await import("./CFileAnalyzer.jsx");

const t = (_ns, key) => key;

function baseProps(overrides = {}) {
  return {
    t,
    file: { name: "decision-letter.pdf" },
    // Matches the shape _extractTextForAnalysis actually builds
    // (totalPages/totalCharacters) - not the "pageCount" field the header
    // used to (wrongly) read.
    extractedText: { totalPages: 1, totalCharacters: 500 },
    analysisMetadata: {},
    analysisResult: { potential_claims: [], summary: "" },
    onReset: () => {},
    ...overrides,
  };
}

describe("CFileDashboardHeader: honors the fallback's own foundNothing signal", () => {
  it("shows No Conditions Found when claims are empty and summary is blank (no metadata flag)", () => {
    render(<CFileDashboardHeader {...baseProps()} />);

    expect(screen.getByText("⚠️ analysisNoFindings")).toBeTruthy();
    expect(screen.queryByText("✅ analysisComplete")).toBeNull();
  });

  it("off-device fallback found nothing but wrote a non-empty summary: still shows No Conditions Found", () => {
    render(
      <CFileDashboardHeader
        {...baseProps({
          analysisMetadata: { offDeviceBlocked: true, foundNothing: true },
          analysisResult: {
            potential_claims: [],
            summary:
              "The built-in document scan (no AI available) did not find any claimable conditions, ratings, or decisions in this document.",
          },
        })}
      />,
    );

    expect(screen.getByText("⚠️ analysisNoFindings")).toBeTruthy();
    expect(screen.queryByText("✅ analysisComplete")).toBeNull();
  });

  it("off-device fallback found real conditions: shows Analysis Complete", () => {
    render(
      <CFileDashboardHeader
        {...baseProps({
          analysisMetadata: { offDeviceBlocked: true, foundNothing: false },
          analysisResult: {
            potential_claims: [{ condition: "Tinnitus" }],
            summary:
              "The built-in document scan (no AI available) found 1 potential condition(s) directly in your document's own text: Tinnitus.",
          },
        })}
      />,
    );

    expect(screen.getByText("✅ analysisComplete")).toBeTruthy();
    expect(screen.queryByText("⚠️ analysisNoFindings")).toBeNull();
  });
});

describe("CFileDashboardHeader: shows the real page/character counts, not blanks", () => {
  it("reads totalPages/totalCharacters, the fields _extractTextForAnalysis actually sets", () => {
    render(
      <CFileDashboardHeader
        {...baseProps({
          extractedText: { totalPages: 7, totalCharacters: 12345 },
        })}
      />,
    );

    expect(screen.getByText(/decision-letter\.pdf • 7/)).toBeTruthy();
    expect(screen.getByText(/12,345/)).toBeTruthy();
  });
});
