/**
 * Regression: MusterCallFormationSection passed `conflicts={[]}` - a fresh
 * array literal - to DocumentIntelligenceBriefing on every render. That prop
 * feeds a dependency array inside DocumentIntelligenceBriefing's per-document
 * effect, so a reference change (with no actual document change) refired the
 * effect and silently reset all in-progress field verification. This
 * component re-renders on every AI progress tick while the briefing modal is
 * open, so the reset could land mid-verification - this is what produced the
 * "Verify & Save stuck disabled on one field" symptom in the Muster Call
 * stress spec. The `conflicts` prop must be a referentially stable array
 * across re-renders that don't change the active document.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import MusterCallFormationSection from "../../components/musterCall/MusterCallFormationSection.jsx";

let capturedConflicts = [];

vi.mock("../../components/FormationLineup", () => ({
  default: () => null,
}));
vi.mock("../../components/PlatoonSergeantReview", () => ({
  default: () => null,
}));
vi.mock("../../components/DocumentIntelligenceBriefing", () => ({
  default: (props) => {
    capturedConflicts.push(props.conflicts);
    return null;
  },
}));

function buildProps(progress) {
  return {
    shouldShowFormation: false,
    showProcessingView: false,
    formationQueue: {
      formation: [],
      stats: {},
      reorderDocuments: vi.fn(),
      removeDocument: vi.fn(),
      clearFormation: vi.fn(),
    },
    ai: { aiReady: true, aiInitializing: false },
    flow: {
      activeEntry: { file: { name: "doc.pdf" } },
      currentProgress: progress,
      extractionResult: { filename: "doc.pdf", extractedData: {} },
      showIntelBriefing: true,
      setShowIntelBriefing: vi.fn(),
      handleVerifyAndSave: vi.fn(),
      handleSkipDocument: vi.fn(),
    },
    onStartFormation: vi.fn(),
    onOpenDD214Analyzer: vi.fn(),
  };
}

describe("MusterCallFormationSection - conflicts prop stability", () => {
  it("passes the same conflicts array reference across re-renders that don't change the active document", () => {
    capturedConflicts = [];
    const { rerender } = render(
      <MusterCallFormationSection {...buildProps(10)} />,
    );
    // Simulate an AI progress tick - the kind of update that happens
    // continuously while the briefing modal is open, unrelated to the
    // document or its conflicts.
    rerender(<MusterCallFormationSection {...buildProps(50)} />);

    expect(capturedConflicts).toHaveLength(2);
    expect(capturedConflicts[0]).toBe(capturedConflicts[1]);
  });
});
