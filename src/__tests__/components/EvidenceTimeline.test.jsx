/**
 * EvidenceTimeline runs the existing "Import from My Records" (loadVKB)
 * import automatically on first open when the timeline has no events, silently
 * (no confirm/alert dialogs) and without duplicating events on reopen once
 * they're persisted. The manual "Import from My Records" button keeps its
 * original confirm-dialog behavior.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EvidenceTimeline from "../../components/EvidenceTimeline.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { saveTimelineEvents } from "../../utils/veteranProfile.js";

const mockLoadVKB = vi.fn();
vi.mock("../../utils/veteranKnowledgeBase.js", () => ({
  loadVKB: (...args) => mockLoadVKB(...args),
}));

function renderTimeline(props = {}) {
  return render(
    <LanguageProvider>
      <EvidenceTimeline onClose={() => {}} {...props} />
    </LanguageProvider>,
  );
}

// jsdom doesn't implement canvas 2D drawing (getContext() returns null,
// per https://github.com/jsdom/jsdom/issues/1782), which crashes
// EvidenceTimeline's real canvas-rendering effect the instant any event
// exists. Unrelated to this feature - stub a permissive fake context so
// that effect no-ops instead of throwing.
function stubCanvasContext() {
  return new Proxy({}, { get: () => vi.fn() });
}

beforeEach(() => {
  localStorage.clear();
  mockLoadVKB
    .mockReset()
    .mockResolvedValue({ evidenceTimeline: [], evidence: [] });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "alert").mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    stubCanvasContext(),
  );
});

describe("EvidenceTimeline auto-import from records", () => {
  it("auto-imports dated VKB events on first open when the timeline is empty, without a confirm dialog", async () => {
    mockLoadVKB.mockResolvedValue({
      evidenceTimeline: [
        {
          date: "2015-01-01",
          description: "Knee injury noted in service record",
        },
      ],
      evidence: [],
    });

    renderTimeline();

    expect(
      await screen.findByText(/we filled in 1 event/i),
    ).toBeInTheDocument();
    expect(screen.getByText("📋 Timeline Events (1)")).toBeInTheDocument();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("does not auto-import (or call loadVKB) when the timeline already has persisted events", async () => {
    saveTimelineEvents([
      {
        id: "existing_1",
        type: "service",
        date: "2010-01-01",
        title: "Enlistment",
        description: "Enlistment",
        category: "Service Event",
      },
    ]);

    renderTimeline();

    expect(
      await screen.findByText("📋 Timeline Events (1)"),
    ).toBeInTheDocument();
    expect(mockLoadVKB).not.toHaveBeenCalled();
    expect(screen.queryByText(/we filled in/i)).not.toBeInTheDocument();
  });

  it("does not auto-import when events were already supplied via props", async () => {
    renderTimeline({
      events: [
        {
          id: "prop_1",
          type: "service",
          date: "2012-01-01",
          title: "Deployment",
          description: "Deployment",
          category: "Service Event",
        },
      ],
    });

    expect(
      await screen.findByText("📋 Timeline Events (1)"),
    ).toBeInTheDocument();
    expect(mockLoadVKB).not.toHaveBeenCalled();
  });
});

describe("EvidenceTimeline import dedupe", () => {
  it("keeps the manual Import from My Records button working with its confirm dialog", async () => {
    saveTimelineEvents([
      {
        id: "existing_1",
        type: "service",
        date: "2010-01-01",
        title: "Enlistment",
        description: "Enlistment",
        category: "Service Event",
      },
    ]);
    mockLoadVKB.mockResolvedValue({
      evidenceTimeline: [
        { date: "2016-06-01", description: "New medical record found" },
      ],
      evidence: [],
    });

    renderTimeline();
    await screen.findByText("📋 Timeline Events (1)");

    fireEvent.click(
      screen.getByRole("button", { name: /import from my records/i }),
    );

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(
      await screen.findByText("📋 Timeline Events (2)"),
    ).toBeInTheDocument();
  });

  // migrateOffSchemaVKB copies legacy evidence[] entries into
  // evidenceTimeline[], so a not-yet-migrated VKB can carry the exact same
  // dated item in both arrays. Only one timeline entry should come of it.
  it("does not double-add an item present in both vkb.evidenceTimeline and vkb.evidence", async () => {
    mockLoadVKB.mockResolvedValue({
      evidenceTimeline: [
        { date: "2016-06-01", description: "New medical record found" },
      ],
      evidence: [
        { date: "2016-06-01", description: "New medical record found" },
      ],
    });

    renderTimeline();

    expect(
      await screen.findByText(/we filled in 1 event/i),
    ).toBeInTheDocument();
    expect(screen.getByText("📋 Timeline Events (1)")).toBeInTheDocument();
  });
});
