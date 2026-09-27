/**
 * EvidenceTimeline runs the existing "Import from My Records" (loadVKB)
 * import automatically on first open when the timeline has no events, silently
 * (no confirm/alert dialogs) and without duplicating events on reopen once
 * they're persisted. The manual "Import from My Records" button keeps its
 * original confirm-dialog behavior.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EvidenceTimeline, {
  selectYearLabelIndices,
} from "../../components/EvidenceTimeline.jsx";
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

describe("selectYearLabelIndices (timeline year-label de-duplication)", () => {
  // 10-day span mapped to a 700px-wide line (padding stripped so x==0 lines
  // up with day 0) gives an easy 70px-per-day scale to reason about. The
  // real canvas' line width is now the modal's actual CSS width minus
  // padding (see setupHiDpiCanvas in EvidenceTimeline.jsx) rather than a
  // fixed 800px buffer, but the pure function under test only cares about
  // the geometry object's numbers, not where they came from.
  const geometry = {
    firstDate: new Date("2020-01-01T00:00:00Z"),
    lastDate: new Date("2020-01-11T00:00:00Z"),
    padding: 0,
    lineWidth: 700,
  };

  it("returns an empty array for no events", () => {
    expect(selectYearLabelIndices([], geometry)).toEqual([]);
  });

  it("always shows a single event's label", () => {
    expect(selectYearLabelIndices([{ date: "2020-01-01" }], geometry)).toEqual([
      true,
    ]);
  });

  it("skips a same-row label that lands within the collision gap, but keeps labels on the other row and once enough distance has passed", () => {
    const events = [
      { date: "2020-01-01T00:00:00Z" }, // index 0, above, x=0
      { date: "2020-01-01T04:48:00Z" }, // index 1, below, x=14
      { date: "2020-01-01T12:00:00Z" }, // index 2, above, x=35 (<36 from index 0 → collides)
      { date: "2020-01-04T00:00:00Z" }, // index 3, below, x=210 (far from index 1 → clear)
      { date: "2020-01-06T00:00:00Z" }, // index 4, above, x=350 (far from index 0 → clear)
    ];

    expect(selectYearLabelIndices(events, geometry)).toEqual([
      true,
      true,
      false,
      true,
      true,
    ]);
  });

  it("shows both labels once the gap reaches the threshold", () => {
    // A 1-day span over a 36px line puts the second "above" event at
    // exactly x=36 - the collision-gap boundary - so this exercises the
    // >= comparison directly instead of an approximate gap.
    const oneDayGeometry = {
      firstDate: new Date("2020-01-01T00:00:00Z"),
      lastDate: new Date("2020-01-02T00:00:00Z"),
      padding: 0,
      lineWidth: 36,
    };
    const events = [
      { date: "2020-01-01T00:00:00Z" }, // index 0, above, x=0
      { date: "2020-01-01T12:00:00Z" }, // index 1, below, unrelated row
      { date: "2020-01-02T00:00:00Z" }, // index 2, above, x=36 (== threshold)
    ];

    expect(selectYearLabelIndices(events, oneDayGeometry)).toEqual([
      true,
      true,
      true,
    ]);
  });
});

describe("EvidenceTimeline canvas: HiDPI backing buffer", () => {
  // The canvas used a fixed 800x200 buffer CSS-scaled to fit (`w-full`),
  // so on a 390px phone everything drawn - including year-label text -
  // rendered at ~0.4x its nominal size (QA S46: ~5px tall labels). The
  // fix sizes the buffer to the canvas' real CSS width * devicePixelRatio
  // and scales the drawing context to match, so canvas text renders at
  // its true CSS pixel size on any screen. jsdom never computes layout
  // (clientWidth/getBoundingClientRect always read 0), so this overrides
  // the clientWidth getter to simulate a real narrow-phone measurement.
  let clientWidthDescriptor;
  let originalDpr;

  beforeEach(() => {
    clientWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    originalDpr = window.devicePixelRatio;
  });

  afterEach(() => {
    if (clientWidthDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        "clientWidth",
        clientWidthDescriptor,
      );
    }
    window.devicePixelRatio = originalDpr;
  });

  it("sizes the backing buffer to CSS width x devicePixelRatio instead of a fixed 800px buffer", async () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 340,
    });
    window.devicePixelRatio = 2;

    renderTimeline({
      events: [
        {
          id: "e1",
          type: "service",
          date: "2020-01-01",
          title: "Enlistment",
          description: "Enlistment",
          category: "Service Event",
        },
      ],
    });
    await screen.findByText("📋 Timeline Events (1)");

    const canvas = document.querySelector("canvas");
    expect(canvas.width).toBe(680); // 340 CSS px * 2 dpr
    expect(canvas.height).toBe(400); // 200 CSS px * 2 dpr
    // The displayed (CSS) height stays fixed even though the backing
    // buffer grew - only the pixel density changed, not the layout.
    expect(canvas.style.height).toBe("200px");
  });

  it("falls back to a sane default width when the real layout can't be measured (devicePixelRatio 1)", async () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 0,
    });
    window.devicePixelRatio = 1;

    renderTimeline({
      events: [
        {
          id: "e1",
          type: "service",
          date: "2020-01-01",
          title: "Enlistment",
          description: "Enlistment",
          category: "Service Event",
        },
      ],
    });
    await screen.findByText("📋 Timeline Events (1)");

    const canvas = document.querySelector("canvas");
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(200);
  });
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

// D-C (final10 QA, 2026-09-25): a National Guard/Reserve enlistment date
// is not the start of active duty - years without evidence between drill
// weekends is normal for that component, not a missing-evidence gap.
describe("EvidenceTimeline gap detection excludes a Guard/Reserve enlistment anchor", () => {
  it("does not flag a gap between a Guard enlistment event and the next real event", async () => {
    mockLoadVKB.mockResolvedValue({
      evidenceTimeline: [
        {
          date: "2000-01-01",
          description: "Enlisted (Army National Guard) (calculated)",
          eventType: "guard_enlistment",
        },
        {
          date: "2015-06-01",
          description: "Knee injury noted in service record",
        },
      ],
      evidence: [],
    });

    renderTimeline();

    expect(
      await screen.findByText("📋 Timeline Events (2)"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Evidence Gaps Detected/i),
    ).not.toBeInTheDocument();
  });

  it("still flags a gap of the same size between two ordinary events", async () => {
    mockLoadVKB.mockResolvedValue({
      evidenceTimeline: [
        { date: "2000-01-01", description: "Separated from service" },
        {
          date: "2015-06-01",
          description: "Knee injury noted in service record",
        },
      ],
      evidence: [],
    });

    renderTimeline();

    expect(
      await screen.findByText("📋 Timeline Events (2)"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Evidence Gaps Detected/i),
    ).toBeInTheDocument();
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
