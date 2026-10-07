import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import InterruptedImportNotice from "./InterruptedImportNotice";
import {
  IMPORT_MARKER_KEY_PREFIX,
  STALE_AFTER_MS,
  clearAllImportMarkers,
  startImportMarker,
} from "../../utils/importProgressMarker";

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

beforeEach(() => localStorage.clear());
afterEach(() => {
  clearAllImportMarkers();
  vi.useRealTimers();
});

describe("InterruptedImportNotice", () => {
  it("shows nothing when no import was interrupted", () => {
    render(<InterruptedImportNotice />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("tells a fresh start what was cut short and how to finish", () => {
    seedOtherTabMarker("killed", STALE_AFTER_MS + 5000);

    render(<InterruptedImportNotice />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your last import was interrupted before it finished. 1 of 3 documents were saved. Add the same files again to finish - nothing will be duplicated.",
    );
  });

  it("does not show an import that is still running in another tab", () => {
    seedOtherTabMarker("live-elsewhere", 1000);

    render(<InterruptedImportNotice />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(markerKeys()).toHaveLength(1);
  });

  it("goes away for good when dismissed", () => {
    seedOtherTabMarker("killed", STALE_AFTER_MS + 5000);
    render(<InterruptedImportNotice />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(markerKeys()).toHaveLength(0);
  });

  it("dismissing never removes the marker of an import running here", () => {
    seedOtherTabMarker("killed", STALE_AFTER_MS + 5000);
    render(<InterruptedImportNotice />);

    startImportMarker(["document 1 (DD214)", "document 2 (DBQ)"]);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(markerKeys()).toHaveLength(1);
  });

  it("does not show an import that begins in this tab after the app loaded", () => {
    render(<InterruptedImportNotice />);

    startImportMarker(["document 1 (DD214)"]);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("reports another tab's import once its owner goes away", () => {
    vi.useFakeTimers();
    seedOtherTabMarker("live-elsewhere", 1000);
    render(<InterruptedImportNotice />);
    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(STALE_AFTER_MS + 15000);
    });

    expect(screen.getByRole("status")).toHaveTextContent("1 of 3 documents");
  });
});

describe("InterruptedImportNotice in two tabs", () => {
  it("goes away when another tab removed the marker", () => {
    seedOtherTabMarker("killed", STALE_AFTER_MS + 5000);
    render(<InterruptedImportNotice />);
    expect(screen.getByRole("status")).toBeVisible();

    act(() => {
      localStorage.clear();
      window.dispatchEvent(new Event("storage"));
    });

    expect(screen.queryByRole("status")).toBeNull();
  });
});
