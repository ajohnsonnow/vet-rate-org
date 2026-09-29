/**
 * BackupManager.jsx ("The Bunker") used to have its own "Clear All Data"
 * button call dataBackup.js's clearAllData(), which only removed a fixed
 * localStorage key list - IndexedDB (the knowledge base, My Packet
 * documents), cookies, and every other store survived while the confirm
 * dialog told a veteran everything was gone (decision B). This proves the
 * button now goes through the same shared wipeAllLocalData module VKBViewer's
 * "Clear All Data" uses, with an honest confirm listing the real scope, no
 * decoy redirect, and a cross-tab broadcast - not a re-implementation of the
 * deleted narrow path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BackupManager from "../../components/BackupManager.jsx";
import * as atomicWipe from "../../components/AtomicWipe.jsx";
import * as dataWipeChannel from "../../utils/dataWipeChannel.js";

vi.mock("../../utils/dataBackup.js", () => ({
  exportData: vi.fn(),
  downloadBackup: vi.fn(),
  importData: vi.fn(),
  parseBackupFile: vi.fn(),
  validateBackup: vi.fn(),
  getStorageStats: vi.fn(() => ({ totalKeys: 0, totalSizeKB: 0, keys: [] })),
  createRestorePoint: vi.fn().mockResolvedValue(true),
  getRestorePoint: vi.fn().mockResolvedValue(null),
  restoreFromRestorePoint: vi.fn(),
}));

vi.mock("../../components/AtomicWipe.jsx", () => ({
  default: () => null,
  wipeAllLocalData: vi.fn().mockResolvedValue(undefined),
  forceReloadWithCacheBypass: vi.fn(),
  FULL_DATA_DELETE_CONFIRM_TEXT: "TEST_FULL_DELETE_SCOPE_TEXT",
}));

vi.mock("../../utils/dataWipeChannel.js", () => ({
  broadcastDataWipe: vi.fn(),
}));

vi.mock("../../utils/dbqOfflineStorage.js", () => ({
  getCacheStats: vi.fn().mockResolvedValue(null),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BackupManager Clear All Data (decision B)", () => {
  it("confirm dialog shows the same full-scope text as the shared wipe module, not a narrower one", async () => {
    render(<BackupManager onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear All Data" }));

    expect(
      await screen.findByText("TEST_FULL_DELETE_SCOPE_TEXT"),
    ).toBeInTheDocument();
  });

  it("confirming calls the shared wipeAllLocalData, broadcasts to other tabs, and reloads with no decoy redirect", async () => {
    render(<BackupManager onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear All Data" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /yes, clear everything/i }),
    );

    await waitFor(() => {
      expect(atomicWipe.wipeAllLocalData).toHaveBeenCalledTimes(1);
    });
    expect(dataWipeChannel.broadcastDataWipe).toHaveBeenCalledTimes(1);
    expect(atomicWipe.forceReloadWithCacheBypass).toHaveBeenCalledTimes(1);
  });
});
