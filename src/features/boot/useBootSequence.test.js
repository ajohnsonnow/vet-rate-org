import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useBootSequence } from "./useBootSequence";

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
 */

const mockNeedsMigration = vi.fn();
const mockMigrateFromLocalStorage = vi.fn();
const mockFetchVersionJson = vi.fn();
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
vi.mock("../../utils/version", () => ({
  fetchVersionJson: (...args) => mockFetchVersionJson(...args),
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
  mockFetchVersionJson.mockReset();
  mockMigrateUserData.mockClear();
  mockInitPersistentStorage.mockClear();
  mockInitAutoBackup.mockClear();
});

describe("useBootSequence: isBooting gate", () => {
  it("flips isBooting false once no migration is needed, without waiting on the maintenance fetch", async () => {
    mockNeedsMigration.mockResolvedValue(false);
    const versionFetch = deferred();
    mockFetchVersionJson.mockReturnValue(versionFetch.promise);

    const { result } = renderHook(() => useBootSequence());

    expect(result.current.isBooting).toBe(true);
    await waitFor(() => expect(result.current.isBooting).toBe(false));

    expect(result.current.maintenanceMode).toBe(false);
    expect(result.current.isMigrating).toBe(false);

    versionFetch.resolve({ ok: true, data: { maintenance_mode: false } });
  });

  it("keeps isBooting true for the full duration of an in-progress migration copy", async () => {
    mockNeedsMigration.mockResolvedValue(true);
    mockFetchVersionJson.mockResolvedValue({
      ok: true,
      data: { maintenance_mode: false },
    });
    const migrationCopy = deferred();
    mockMigrateFromLocalStorage.mockReturnValue(migrationCopy.promise);

    const { result } = renderHook(() => useBootSequence());

    await waitFor(() => expect(result.current.isMigrating).toBe(true));
    expect(result.current.isBooting).toBe(true);

    migrationCopy.resolve({
      success: true,
      migratedKeys: ["vet_rate_veteran_profile"],
      failedKeys: [],
    });

    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(result.current.isMigrating).toBe(false);
  });

  it("settles maintenanceMode independently, even after isBooting has already resolved", async () => {
    mockNeedsMigration.mockResolvedValue(false);
    const versionFetch = deferred();
    mockFetchVersionJson.mockReturnValue(versionFetch.promise);

    const { result } = renderHook(() => useBootSequence());

    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(result.current.maintenanceMode).toBe(false);

    versionFetch.resolve({
      ok: true,
      data: {
        maintenance_mode: true,
        maintenance_message: "Down for scheduled work.",
      },
    });

    await waitFor(() => expect(result.current.maintenanceMode).toBe(true));
    expect(result.current.maintenanceMessage).toBe("Down for scheduled work.");
    // isBooting already having settled false is what lets App.jsx's
    // maintenanceMode check apply on a subsequent render.
    expect(result.current.isBooting).toBe(false);
  });

  it("runs the background inits (persistent storage, auto-backup, user-data migrations) after the boot gate opens", async () => {
    mockNeedsMigration.mockResolvedValue(false);
    mockFetchVersionJson.mockResolvedValue({
      ok: true,
      data: { maintenance_mode: false },
    });

    renderHook(() => useBootSequence());

    await waitFor(() => expect(mockInitPersistentStorage).toHaveBeenCalled());
    await waitFor(() => expect(mockInitAutoBackup).toHaveBeenCalled());
    await waitFor(() => expect(mockMigrateUserData).toHaveBeenCalled());
  });
});
