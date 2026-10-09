/**
 * Proves the WIRING, not just the effect: the full data delete
 * (AtomicWipe's wipeAllLocalData, shared by Atomic Wipe and VKBViewer's
 * Clear All Data) and the panic redirect (triggerPanicRedirect - Quick Exit
 * / triple-Escape) must both actually call the real stopAutoBackup(), or a
 * pending debounced backup can still fire ~2s later and write a fresh
 * snapshot back after a veteran asked for everything to be gone (D13-8).
 * autoBackup.test.js's "wipe stops autoBackup end-to-end" describe calls
 * stopAutoBackup() itself and asserts its own effect - it would keep passing
 * even if wipeAllLocalData/triggerPanicRedirect silently dropped that call,
 * since nothing there exercises the real wipe/redirect paths at all. This
 * spies on the real stopAutoBackup export instead and calls the REAL
 * wipeAllLocalData/triggerPanicRedirect, so a future refactor that drops
 * either call is caught here even if every other test keeps passing.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

const stopAutoBackupSpy = vi.fn();
vi.mock("../../utils/autoBackup", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    stopAutoBackup: (...args) => {
      stopAutoBackupSpy(...args);
      return actual.stopAutoBackup(...args);
    },
  };
});

const { wipeAllLocalData } = await import("../../components/AtomicWipe.jsx");
const { triggerPanicRedirect } = await import("../../utils/safetyRedirect.js");

describe("the full data delete and the panic redirect both actually call stopAutoBackup", () => {
  afterEach(() => {
    stopAutoBackupSpy.mockClear();
    localStorage.removeItem("vetrate_safety_use_count");
  });

  it("wipeAllLocalData (Atomic Wipe / VKBViewer Clear All Data) calls the real stopAutoBackup", async () => {
    await wipeAllLocalData();
    expect(stopAutoBackupSpy).toHaveBeenCalledTimes(1);
  });

  it("triggerPanicRedirect (Quick Exit / triple-Escape) calls the real stopAutoBackup", () => {
    triggerPanicRedirect();
    expect(stopAutoBackupSpy).toHaveBeenCalledTimes(1);
  });
});
