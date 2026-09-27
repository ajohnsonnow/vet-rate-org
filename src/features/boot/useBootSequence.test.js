import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  useBootSequence,
  MIGRATION_DECISION_TIMEOUT_MS,
} from "./useBootSequence";

/**
 * boot-swap-dialog-loss: the interactive tree used to mount immediately
 * (isMigrating started false), then get swapped out for <MigrationScreen/>
 * the moment a returning user's migration kicked in, then swapped back when
 * it finished - unmounting (and losing the state of) anything already open.
 * isBooting fixes this by staying true until the migration decision has
 * fully resolved, so App.jsx never mounts the interactive tree before then.
 * These tests cover the timing contract isBooting must hold, independent of
 * React rendering: it must track migration settling (not maintenance-check
 * settling, which is a network fetch with no timeout and must never block
 * it), and must not flip false until an in-progress copy has completed.
 *
 * A second group below covers the maintenance-mode kill switch: the cached
 * last-known flag (maintenanceMode.js) must be able to stop a migration
 * from ever starting, and the live check must be able to stop one already
 * running, without either ever waiting on the network to do so.
 */

const mockNeedsMigration = vi.fn();
const mockMigrateFromLocalStorage = vi.fn();
const mockCheckMaintenanceMode = vi.fn();
const mockReadCachedMaintenanceMode = vi.fn();
const mockMigrateUserData = vi.fn(() => ({
  migrationsRun: [],
  success: true,
  errors: [],
}));
const mockInitPersistentStorage = vi.fn(() =>
  Promise.resolve({ hasUnsavedChanges: false }),
);
const mockInitAutoBackup = vi.fn(() => Promise.resolve());

vi.mock("../../utils/storage", () => ({
  needsMigration: (...args) => mockNeedsMigration(...args),
  migrateFromLocalStorage: (...args) => mockMigrateFromLocalStorage(...args),
}));
vi.mock("../../utils/maintenanceMode", () => ({
  checkMaintenanceMode: (...args) => mockCheckMaintenanceMode(...args),
  readCachedMaintenanceMode: (...args) =>
    mockReadCachedMaintenanceMode(...args),
}));
vi.mock("../../utils/migrationManager", () => ({
  migrateUserData: (...args) => mockMigrateUserData(...args),
}));
vi.mock("../../utils/persistentStorage", () => ({
  initPersistentStorage: (...args) => mockInitPersistentStorage(...args),
  initUnsavedChangesWarning: vi.fn(),
}));
vi.mock("../../utils/autoBackup", () => ({
  initAutoBackup: (...args) => mockInitAutoBackup(...args),
}));
vi.mock("../../utils/voiceIndex", () => ({
  initializeCompassionateVoice: vi.fn(),
}));
vi.mock("../../utils/bugReportUtils", () => ({
  initializeErrorCapture: vi.fn(),
}));
vi.mock("../../utils/dataPersistence", () => ({
  setupBeforeUnloadWarning: vi.fn(),
}));

/** A promise plus externally-callable resolve/reject, for controlling
 * exactly when an awaited dependency settles relative to assertions. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockNeedsMigration.mockReset();
  mockMigrateFromLocalStorage.mockReset();
  mockCheckMaintenanceMode.mockReset();
  mockCheckMaintenanceMode.mockResolvedValue(false);
  mockReadCachedMaintenanceMode.mockReset();
  mockReadCachedMaintenanceMode.mockReturnValue(false);
  mockMigrateUserData.mockClear();
  mockInitPersistentStorage.mockClear();
  mockInitAutoBackup.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useBootSequence: isBooting gate", () => {
  it("flips isBooting false once no migration is needed, without waiting on the maintenance fetch", async () => {
    mockNeedsMigration.mockResolvedValue(false);
    const maintenanceCheck = deferred();
    mockCheckMaintenanceMode.mockReturnValue(maintenanceCheck.promise);

    const { result } = renderHook(() => useBootSequence());

    expect(result.current.isBooting).toBe(true);
    await waitFor(() => expect(result.current.isBooting).toBe(false));

    expect(result.current.maintenanceMode).toBe(false);
    expect(result.current.isMigrating).toBe(false);

    maintenanceCheck.resolve(false);
  });

  it("keeps isBooting true for the full duration of an in-progress migration copy", async () => {
    mockNeedsMigration.mockResolvedValue(true);
    const migrationCopy = deferred();
    mockMigrateFromLocalStorage.mockReturnValue(migrationCopy.promise);

    const { result } = renderHook(() => useBootSequence());

    await waitFor(() => expect(result.current.isMigrating).toBe(true));
    expect(result.current.isBooting).toBe(true);

    migrationCopy.resolve({
      success: true,
      aborted: false,
      migratedKeys: ["vet_rate_veteran_profile"],
      failedKeys: [],
    });

    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(result.current.isMigrating).toBe(false);
  });

  it("settles maintenanceMode independently, even after isBooting has already resolved", async () => {
    mockNeedsMigration.mockResolvedValue(false);
    const maintenanceCheck = deferred();
    mockCheckMaintenanceMode.mockImplementation(
      (setMaintenanceMode, setMaintenanceMessage) =>
        maintenanceCheck.promise.then((isOn) => {
          if (isOn) {
            setMaintenanceMode(true);
            setMaintenanceMessage("Down for scheduled work.");
          }
          return isOn;
        }),
    );

    const { result } = renderHook(() => useBootSequence());

    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(result.current.maintenanceMode).toBe(false);

    maintenanceCheck.resolve(true);

    await waitFor(() => expect(result.current.maintenanceMode).toBe(true));
    expect(result.current.maintenanceMessage).toBe("Down for scheduled work.");
    // isBooting already having settled false is what lets App.jsx's
    // maintenanceMode check apply on a subsequent render.
    expect(result.current.isBooting).toBe(false);
  });
});

describe("useBootSequence: fail-open timeout, logging, and background work", () => {
  it("fails open once the migration decision exceeds its timeout, and still finishes it in the background", async () => {
    let resolveNeedsMigration;
    mockNeedsMigration.mockReturnValue(
      new Promise((resolve) => {
        resolveNeedsMigration = resolve;
      }),
    );
    mockMigrateFromLocalStorage.mockResolvedValue({
      success: true,
      aborted: false,
      migratedKeys: ["vet_rate_veteran_profile"],
      failedKeys: [],
    });

    vi.useFakeTimers();
    const { result } = renderHook(() => useBootSequence());
    expect(result.current.isBooting).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MIGRATION_DECISION_TIMEOUT_MS + 50);
    });
    // Fails open: the tree may mount even though needsMigration() still
    // hasn't settled (simulating a blocked/stalled IndexedDB open).
    expect(result.current.isBooting).toBe(false);

    vi.useRealTimers();
    resolveNeedsMigration(true);

    await waitFor(() => expect(result.current.isMigrating).toBe(false));
    expect(mockMigrateFromLocalStorage).toHaveBeenCalled();
  });

  it("logs the real migrated-key count and list, not stale itemsMigrated/keysProcessed fields", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockNeedsMigration.mockResolvedValue(true);
    mockMigrateFromLocalStorage.mockResolvedValue({
      success: true,
      aborted: false,
      migratedKeys: ["a", "b", "c"],
      failedKeys: [],
    });

    renderHook(() => useBootSequence());

    await waitFor(() =>
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "✅ IndexedDB Migration: Successfully migrated",
        3,
        "items",
      ),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith("   Migrated keys:", [
      "a",
      "b",
      "c",
    ]);

    consoleLogSpy.mockRestore();
  });

  it("runs the background inits (persistent storage, auto-backup, user-data migrations) after the boot gate opens", async () => {
    mockNeedsMigration.mockResolvedValue(false);

    renderHook(() => useBootSequence());

    await waitFor(() => expect(mockInitPersistentStorage).toHaveBeenCalled());
    await waitFor(() => expect(mockInitAutoBackup).toHaveBeenCalled());
    await waitFor(() => expect(mockMigrateUserData).toHaveBeenCalled());
  });
});

describe("useBootSequence: maintenance-mode kill switch", () => {
  it("skips starting a migration entirely when the cached maintenance flag is already on", async () => {
    mockReadCachedMaintenanceMode.mockReturnValue(true);
    mockCheckMaintenanceMode.mockResolvedValue(true);

    const { result } = renderHook(() => useBootSequence());

    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(mockNeedsMigration).not.toHaveBeenCalled();
    expect(mockMigrateFromLocalStorage).not.toHaveBeenCalled();
  });

  it("starts the migration normally when the cached flag is off (unchanged path)", async () => {
    mockReadCachedMaintenanceMode.mockReturnValue(false);
    mockNeedsMigration.mockResolvedValue(false);

    renderHook(() => useBootSequence());

    await waitFor(() => expect(mockNeedsMigration).toHaveBeenCalled());
  });

  it("trips the kill switch passed to migrateFromLocalStorage as shouldAbort once the live check confirms maintenance mid-copy", async () => {
    mockNeedsMigration.mockResolvedValue(true);
    let capturedShouldAbort;
    const migrationCopy = deferred();
    mockMigrateFromLocalStorage.mockImplementation(({ shouldAbort } = {}) => {
      capturedShouldAbort = shouldAbort;
      return migrationCopy.promise;
    });

    let tripKillSwitch;
    mockCheckMaintenanceMode.mockImplementation(
      (setMaintenanceMode, setMaintenanceMessage, onMaintenanceOn) => {
        tripKillSwitch = onMaintenanceOn;
        return new Promise(() => {});
      },
    );

    renderHook(() => useBootSequence());

    await waitFor(() => expect(capturedShouldAbort).toBeTypeOf("function"));
    expect(capturedShouldAbort()).toBe(false);

    tripKillSwitch();

    expect(capturedShouldAbort()).toBe(true);

    migrationCopy.resolve({
      success: false,
      aborted: true,
      migratedKeys: [],
      failedKeys: [],
    });
  });
});

describe("useBootSequence: pre-mount dialog events are no-ops by design", () => {
  it("dispatching open* events before anything can be listening does not throw or corrupt boot state", async () => {
    mockNeedsMigration.mockResolvedValue(false);

    const { result } = renderHook(() => useBootSequence());

    // No production code dispatches these before the interactive tree
    // mounts (boot shows MigrationScreen instead) - but nothing should
    // break if one somehow did. window.dispatchEvent with zero listeners
    // registered is inherently a no-op; this pins that useBootSequence
    // itself never becomes such a listener and never reacts to them.
    expect(() => {
      window.dispatchEvent(new CustomEvent("openMyPacket"));
      window.dispatchEvent(new CustomEvent("openClaimNavigator"));
      window.dispatchEvent(new CustomEvent("openAskTheRegs"));
    }).not.toThrow();

    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(result.current.maintenanceMode).toBe(false);
    expect(result.current.maintenanceMessage).toBe("");
    expect(result.current.isMigrating).toBe(false);
  });
});
