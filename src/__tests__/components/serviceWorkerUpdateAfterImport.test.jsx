/**
 * The update notice is held back while this tab is importing. The import
 * marker module keeps the id of the last import after it has finished, so the
 * check has to ask whether an import is still running. Uses the real module:
 * a mock that forgets the id when the import ends would hide the difference.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useServiceWorkerUpdate } from "../../features/update/useServiceWorkerUpdate";
import {
  startImportMarker,
  completeImportMarker,
  clearImportMarker,
  activeImportId,
} from "../../utils/importProgressMarker";

const announce = () =>
  act(() => {
    window.dispatchEvent(
      new CustomEvent("sw-update-available", { detail: { accept: vi.fn() } }),
    );
  });
const recheck = () =>
  act(() => {
    vi.advanceTimersByTime(2000);
  });

describe("update notice after an import has finished", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    clearImportMarker();
    vi.useRealTimers();
  });

  it("is held back during the import and shown once it completes", async () => {
    const { result } = renderHook(() => useServiceWorkerUpdate());
    startImportMarker(["Document 1"]);
    announce();
    recheck();
    expect(result.current.visible).toBe(false);

    await act(async () => {
      await completeImportMarker();
    });
    recheck();
    expect(activeImportId()).not.toBeNull();
    expect(result.current.visible).toBe(true);
  });

  it("is shown again after a cancelled import", () => {
    const { result } = renderHook(() => useServiceWorkerUpdate());
    startImportMarker(["Document 1"]);
    announce();
    recheck();
    expect(result.current.visible).toBe(false);

    clearImportMarker();
    recheck();
    expect(result.current.visible).toBe(true);
  });
});
