/**
 * Decision B: a tab receiving another tab's wipe still has its OWN
 * beforeunload guard armed - the wipe deleted vetrate_data_hash from shared
 * localStorage, which makes THIS tab's own hasUnsavedChanges() read true
 * from that point on. A bare reload() would trip the browser's native "Leave
 * site?" prompt; choosing Stay there leaves this tab alive with every
 * in-memory cache the wipe was supposed to invalidate.
 *
 * A single, static top-level import - not vi.resetModules() + a dynamic
 * import per test - so dataWipeChannel.js's self-installing `window`
 * "storage" listener is registered exactly once for this whole file (see
 * dataWipeChannel.test.js for why stacking several matters).
 */
import { describe, it, expect, vi, afterEach } from "vitest";

const clearBeforeUnloadWarningSpy = vi.fn();
const stopAutoBackupSpy = vi.fn();

vi.mock("../../utils/beforeUnloadGuard.js", () => ({
  clearBeforeUnloadWarning: (...args) => clearBeforeUnloadWarningSpy(...args),
}));
vi.mock("../../utils/autoBackup.js", () => ({
  stopAutoBackup: (...args) => stopAutoBackupSpy(...args),
}));

await import("../../utils/dataWipeChannel.js");

afterEach(() => {
  clearBeforeUnloadWarningSpy.mockClear();
  stopAutoBackupSpy.mockClear();
  window.onbeforeunload = null;
});

describe("a received wipe broadcast makes this tab's own reload unblockable", () => {
  it("clears the beforeunload guard, nulls onbeforeunload, and stops autoBackup before reloading (storage-fallback path)", () => {
    window.onbeforeunload = () => "unsaved";

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "vetrate_data_wipe_broadcast",
        newValue: String(Date.now()),
      }),
    );

    expect(clearBeforeUnloadWarningSpy).toHaveBeenCalledTimes(1);
    expect(stopAutoBackupSpy).toHaveBeenCalledTimes(1);
    expect(window.onbeforeunload).toBeNull();
  });

  // Proves the fallback listener ignores unrelated storage writes instead of
  // reloading on every localStorage change in any tab.
  it("ignores a storage event for a different key", () => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "some_unrelated_key",
        newValue: "1",
      }),
    );

    expect(clearBeforeUnloadWarningSpy).not.toHaveBeenCalled();
    expect(stopAutoBackupSpy).not.toHaveBeenCalled();
  });
});

// The race this closes: another open tab keeps writing normally for as long
// as the wiping tab's own wipeAllLocalData() takes. A "wipe-pending" signal,
// received and acted on before the actual "wipe" signal (which only fires
// after that tab has already cleared once), gives this tab a chance to stop
// its own debounced writes earlier - without reloading before the real wipe
// signal says to.
describe("a wipe-pending broadcast stops this tab's own writes without reloading yet", () => {
  it("calls stopAutoBackup but not reload (storage-fallback path)", () => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "vetrate_data_wipe_pending_broadcast",
        newValue: String(Date.now()),
      }),
    );

    expect(stopAutoBackupSpy).toHaveBeenCalledTimes(1);
    expect(clearBeforeUnloadWarningSpy).not.toHaveBeenCalled();
  });

  it("ignores a storage event for a different key", () => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "some_unrelated_key",
        newValue: "1",
      }),
    );

    expect(stopAutoBackupSpy).not.toHaveBeenCalled();
  });
});
