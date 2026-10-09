import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import InterruptedImportNotice from "./InterruptedImportNotice";
import {
  IMPORT_MARKER_KEY_PREFIX,
  STALE_AFTER_MS,
  clearAllImportMarkers,
  startImportMarker,
} from "../../utils/importProgressMarker";

const loadVkb = vi.hoisted(() => vi.fn());
vi.mock("../../utils/veteranKnowledgeBase", () => ({
  loadVKB: (...args) => loadVkb(...args),
  raceVkb: (promise) => promise,
}));

const markerKeys = () =>
  Array.from({ length: localStorage.length }, (_, i) =>
    localStorage.key(i),
  ).filter((key) => key.startsWith(IMPORT_MARKER_KEY_PREFIX));

function seedOtherTabMarker(id, ageMs, saved = 1) {
  localStorage.setItem(
    `${IMPORT_MARKER_KEY_PREFIX}${id}`,
    JSON.stringify({
      id,
      total: 3,
      saved,
      labels: ["document 1 (DD214)", "document 2 (DBQ)", "document 3 (DBQ)"],
      owner: "another-tab",
      heartbeat: Date.now() - ageMs,
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  loadVkb.mockReset();
  loadVkb.mockRejectedValue(new Error("no store in this test"));
  vi.stubGlobal("BroadcastChannel", undefined);
});
afterEach(() => {
  clearAllImportMarkers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("InterruptedImportNotice", () => {
  it("shows nothing when no import was interrupted", async () => {
    render(<InterruptedImportNotice />);
    await act(async () => {});

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("tells a fresh start what was cut short and how to finish", async () => {
    seedOtherTabMarker("killed", STALE_AFTER_MS + 5000);

    render(<InterruptedImportNotice />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your last import was interrupted before it finished. 1 of 3 documents were saved. Add the same files again to finish - nothing will be duplicated.",
    );
  });

  it("does not show an import that is still running in another tab", async () => {
    seedOtherTabMarker("live-elsewhere", 1000);

    render(<InterruptedImportNotice />);
    await act(async () => {});

    expect(screen.queryByRole("status")).toBeNull();
    expect(markerKeys()).toHaveLength(1);
  });

  it("goes away for good when dismissed", async () => {
    seedOtherTabMarker("killed", STALE_AFTER_MS + 5000);
    render(<InterruptedImportNotice />);

    fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(markerKeys()).toHaveLength(0);
  });

  it("dismissing never removes the marker of an import running here", async () => {
    seedOtherTabMarker("killed", STALE_AFTER_MS + 5000);
    render(<InterruptedImportNotice />);
    const dismiss = await screen.findByRole("button", { name: "Dismiss" });

    startImportMarker(["document 1 (DD214)", "document 2 (DBQ)"]);
    fireEvent.click(dismiss);

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(markerKeys()).toHaveLength(1);
  });

  it("does not show an import that begins in this tab after the app loaded", async () => {
    render(<InterruptedImportNotice />);

    startImportMarker(["document 1 (DD214)"]);
    await act(async () => {});

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("reports another tab's import once its owner goes away", async () => {
    vi.useFakeTimers();
    seedOtherTabMarker("live-elsewhere", 1000);
    render(<InterruptedImportNotice />);
    await act(async () => {});
    expect(screen.queryByRole("status")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STALE_AFTER_MS + 15000);
    });

    expect(screen.getByRole("status")).toHaveTextContent("1 of 3 documents");
  });
});

describe("InterruptedImportNotice in two tabs", () => {
  it("goes away when another tab removed the marker", async () => {
    seedOtherTabMarker("killed", STALE_AFTER_MS + 5000);
    render(<InterruptedImportNotice />);
    expect(await screen.findByRole("status")).toBeVisible();

    act(() => {
      localStorage.clear();
      window.dispatchEvent(new Event("storage"));
    });

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
});

describe("InterruptedImportNotice count", () => {
  it("shows the document stored just before the tab died, not only the marker's last write", async () => {
    const started = Date.now() - 600000;
    localStorage.setItem(
      `${IMPORT_MARKER_KEY_PREFIX}killed`,
      JSON.stringify({
        id: "killed",
        total: 8,
        saved: 4,
        labels: Array.from({ length: 8 }, (_, i) => `document ${i + 1} (DBQ)`),
        owner: "another-tab",
        heartbeat: started,
        started,
      }),
    );
    loadVkb.mockResolvedValue({
      documentation: {
        otherEvidence: Array.from({ length: 5 }, () => ({
          uploadDate: new Date().toISOString(),
        })),
      },
    });

    render(<InterruptedImportNotice />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "5 of 8 documents were saved.",
    );
  });
});
