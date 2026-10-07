/**
 * REGRESSION GUARD: dataBackup.js used to export a narrow clearAllData()
 * that only removed a fixed localStorage key list, leaving IndexedDB and
 * every other store intact (decision B). BackupManager.jsx now calls the
 * shared wipeAllLocalData module instead - this guards against anything
 * re-adding the narrow version under the same name, which nothing here
 * would otherwise catch (a plain grep passes on renamed dead code too).
 */
import { describe, it, expect } from "vitest";
import * as dataBackup from "../../utils/dataBackup.js";

describe("dataBackup.js", () => {
  it("no longer exports a narrow clearAllData", () => {
    expect(dataBackup.clearAllData).toBeUndefined();
  });
});
