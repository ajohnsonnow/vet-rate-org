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
          date: "1998-11-01",
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
          date: "1998-11-01",
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
          date: "1998-11-01",
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

// Reviewer findings F2/F11 (final13 QA re-review, 2026-09-28): the old sync
// iterated over EVERY projected event missing from the store, not just the
// specific copies it had just found stale - so a second enlistment's event
// came back silently the moment ANY other copy went stale, whether the
// veteran had deliberately removed it or had simply never imported it yet.
describe("a stale copy's sync never resurrects or invents an UNRELATED enlistment's event", () => {
  function twoEnlistmentProjection() {
    return {
      evidenceTimeline: [
        {
          date: "1998-11-01",
          description: "Enlisted (Army National Guard)",
          eventType: "guard_enlistment",
          projected: true,
          projectionKey: "entry:period1",
        },
        {
          date: "2008-05-01",
          description: "Entered active duty (Army)",
          eventType: "service_entry",
          projected: true,
          projectionKey: "entry:period2",
        },
      ],
      evidence: [],
    };
  }

  it("never re-adds a projectionKey the veteran deliberately removed, while still fixing the stale sibling", async () => {
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
      // No copy of entry:period2 here - the veteran removed it.
    ]);
    mockLoadVKB.mockResolvedValue(twoEnlistmentProjection());

    renderTimeline();

    await screen.findByText(/Enlisted \(Army National Guard\)$/);
    expect(
      screen.queryByText("Entered active duty (Army)"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("📋 Timeline Events (1)")).toBeInTheDocument();
  });

  it("never adds an entry that was never imported at all, while still fixing the stale sibling", async () => {
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
      // No copy of entry:period2 - a DD-214 imported after this timeline's
      // last open, never brought in.
    ]);
    mockLoadVKB.mockResolvedValue(twoEnlistmentProjection());

    renderTimeline();

    await screen.findByText(/Enlisted \(Army National Guard\)$/);
    expect(
      screen.queryByText("Entered active duty (Army)"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("📋 Timeline Events (1)")).toBeInTheDocument();
  });
});

// Reviewer finding F3 (final13 QA re-review, 2026-09-28): the old sync
// closed over the mount-time timelineEvents snapshot, so a hand-added
// event that persisted (synchronously, via performAddEvent) WHILE the
// projection was still loading got silently dropped once the sync's own
// stale write landed. Fixed by re-reading the store only after the await,
// with no further await before writing it back.
describe("a concurrent hand-added event survives the mount-time sync", () => {
  it("keeps an event added while the projection load is still pending", async () => {
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
    let resolveLoadVKB;
    mockLoadVKB.mockReturnValue(
      new Promise((resolve) => {
        resolveLoadVKB = resolve;
      }),
    );

    renderTimeline();
    await waitFor(() => expect(mockLoadVKB).toHaveBeenCalled());

    fireEvent.click(
      screen.getByRole("button", { name: /add timeline event/i }),
    );
    fireEvent.change(document.querySelector('input[type="date"]'), {
      target: { value: "2015-06-01" },
    });
    fireEvent.change(document.querySelector("textarea"), {
      target: { value: "Knee injury at drill weekend" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add event$/i }));
    await screen.findByText("Knee injury at drill weekend");

    resolveLoadVKB({
      evidenceTimeline: [
        {
          date: "1998-11-01",
          description: "Enlisted (Army National Guard)",
          eventType: "guard_enlistment",
          projected: true,
          projectionKey: "entry:period1",
        },
      ],
      evidence: [],
    });

    await screen.findByText(/Enlisted \(Army National Guard\)$/);
    expect(
      screen.getByText("Knee injury at drill weekend"),
    ).toBeInTheDocument();
    const persisted = JSON.parse(
      localStorage.getItem("vet_rate_timeline_events"),
    );
    expect(
      persisted.some((e) => e.description === "Knee injury at drill weekend"),
    ).toBe(true);
  });
});
