/**
 * ADR-007 R10 + D13-2: a local timeline copy imported from the VKB's
 * PROJECTED service-entry event (sourceKey = the projection's
 * projectionKey) goes stale the moment a correction changes that
 * projection's date or description. D13-2 syncs this away silently on
 * every mount (no click, no confirm dialog) - not just when the veteran
 * manually clicks "Import from My Records". A legacy copy with no
 * sourceKey is replaced once no current VKB service-entry event still
 * matches its own (date, description). A veteran-added event (numeric id)
 * is never touched either way, and mounting never adds a brand-new
 * projected event that was never previously imported (only the manual
 * button does that). Fixture values are synthetic, not any real
 * veteran's data.
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

function renderTimeline() {
  return render(
    <LanguageProvider>
      <EvidenceTimeline onClose={() => {}} />
    </LanguageProvider>,
  );
}

function stubCanvasContext() {
  return new Proxy({}, { get: () => vi.fn() });
}

beforeEach(() => {
  localStorage.clear();
  mockLoadVKB.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "alert").mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    stubCanvasContext(),
  );
});

describe("a stale sourceKey copy is replaced by the corrected projection", () => {
  it("silently drops the old (calculated) copy and adds the corrected one on mount, no click needed", async () => {
    saveTimelineEvents([
      {
        id: "vkb_1",
        type: "records",
        date: "2002-03-05",
        title: "Enlisted",
        description: "Enlisted (Army National Guard) (calculated)",
        category: "Medical Records",
        eventType: "guard_enlistment",
        sourceKey: "entry:period1",
      },
    ]);
    mockLoadVKB.mockResolvedValue({
      evidenceTimeline: [
        {
          date: "2001-11-01",
          description: "Enlisted (Army National Guard)",
          eventType: "guard_enlistment",
          projected: true,
          projectionKey: "entry:period1",
        },
      ],
      evidence: [],
    });

    renderTimeline();

    await screen.findByText(/Enlisted \(Army National Guard\)$/);
    expect(
      screen.queryByText(/Enlisted \(Army National Guard\) \(calculated\)/),
    ).not.toBeInTheDocument();
    expect(screen.getByText("📋 Timeline Events (1)")).toBeInTheDocument();
    expect(window.confirm).not.toHaveBeenCalled();
  });
});

describe("a legacy copy with no sourceKey is replaced once it no longer matches", () => {
  it("silently drops the outdated legacy copy and adds the current one on mount, no click needed", async () => {
    saveTimelineEvents([
      {
        id: "vkb_1",
        type: "records",
        date: "2002-03-05",
        title: "Enlisted",
        description: "Enlisted (Army National Guard) (calculated)",
        category: "Medical Records",
        eventType: "guard_enlistment",
        sourceKey: null,
      },
    ]);
    mockLoadVKB.mockResolvedValue({
      evidenceTimeline: [
        {
          date: "2001-11-01",
          description: "Enlisted (Army National Guard)",
          eventType: "guard_enlistment",
          projected: true,
          projectionKey: "entry:period1",
        },
      ],
      evidence: [],
    });

    renderTimeline();

    await screen.findByText(/Enlisted \(Army National Guard\)$/);
    expect(
      screen.queryByText(/Enlisted \(Army National Guard\) \(calculated\)/),
    ).not.toBeInTheDocument();
    expect(screen.getByText("📋 Timeline Events (1)")).toBeInTheDocument();
    expect(window.confirm).not.toHaveBeenCalled();
  });
});

describe("mounting never adds a brand-new projected event that was never previously imported", () => {
  it("leaves a lone veteran-added event alone until the manual Import button is clicked", async () => {
    saveTimelineEvents([
      {
        id: 1234567890,
        type: "service",
        date: "2002-03-05",
        title: "My own enlistment note",
        description: "My own enlistment note",
        category: "Service Event",
        eventType: "guard_enlistment",
      },
    ]);
    mockLoadVKB.mockResolvedValue({
      evidenceTimeline: [
        {
          date: "2001-11-01",
          description: "Enlisted (Army National Guard)",
          eventType: "guard_enlistment",
          projected: true,
          projectionKey: "entry:period1",
        },
      ],
      evidence: [],
    });

    renderTimeline();
    await screen.findByText("My own enlistment note");
    await waitFor(() => expect(mockLoadVKB).toHaveBeenCalled());
    expect(screen.getByText("📋 Timeline Events (1)")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /import from my records/i }),
    );
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());

    expect(screen.getByText("My own enlistment note")).toBeInTheDocument();
    expect(screen.getByText("📋 Timeline Events (2)")).toBeInTheDocument();
  });
});
