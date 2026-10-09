/**
 * D12-5 residual (final12 QA re-review, 2026-09-27): _formatCFileDoc printed
 * "Summary: [object Object]" into the packet AI context sent to every AI
 * tool, because musterCallProcessor.js's buildSegmentedCFileResult stores
 * `summary` as quickScanCFile()'s scan object (estimatedPages, detectedTypes,
 * etc.), not prose, and `String(summary)` stringifies any plain object that
 * way. Fixture values are synthetic, not any real veteran's data.
 */
import { describe, it, expect } from "vitest";
import { _formatCFileDoc } from "./myPacketManager";

const scanSummaryDoc = (overrides = {}) => ({
  fileName: "cfile_consolidated.pdf",
  uploadDate: "2026-07-30T20:00:00.000Z",
  extractedData: {
    summary: {
      estimatedPages: 673,
      hasCodeSheet: true,
      hasDD214: true,
      hasDBQs: false,
      hasBVA: false,
      detectedTypes: ["DD214", "RATING_DECISION"],
    },
    ...overrides,
  },
});

describe("_formatCFileDoc: summary line", () => {
  it("never prints the raw quickScanCFile object as text", () => {
    const out = _formatCFileDoc(scanSummaryDoc());
    expect(out).not.toContain("[object Object]");
  });

  it("prints the scan's page estimate and detected types instead", () => {
    const out = _formatCFileDoc(scanSummaryDoc());
    expect(out).toContain(
      "Summary: ~673 pages, detected: DD214, RATING_DECISION",
    );
  });

  it("still prints a plain-string summary unchanged (cfileAnalyzer.js's AI-analysis shape)", () => {
    const out = _formatCFileDoc(
      scanSummaryDoc({ summary: "Consolidated claims file, denial pending." }),
    );
    expect(out).toContain("Summary: Consolidated claims file, denial pending.");
  });

  it("prints nothing for the summary line when there is no summary at all", () => {
    const out = _formatCFileDoc(scanSummaryDoc({ summary: null }));
    expect(out).not.toContain("Summary:");
  });
});
