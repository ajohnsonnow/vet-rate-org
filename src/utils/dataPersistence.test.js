/**
 * dataPersistence.js's beforeunload guard is what shows the browser's native
 * "Leave site?" prompt when there are unsaved changes - correct in normal
 * use, but it must never be able to block the panic redirect
 * (safetyRedirect.js's triggerPanicRedirect), which needs to remove it
 * first. Also covers the consolidation with persistentStorage.js's own
 * file-handle unsaved-changes flag into this one registration (see
 * shouldWarnBeforeUnload).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  setupBeforeUnloadWarning,
  removeBeforeUnloadWarning,
  markBackupCreated,
} from "./dataPersistence";
import { clearBeforeUnloadWarning } from "./beforeUnloadGuard";
import * as persistentStorage from "./persistentStorage";

function dispatchBeforeUnload() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe("setupBeforeUnloadWarning / removeBeforeUnloadWarning", () => {
  afterEach(() => {
    removeBeforeUnloadWarning();
    localStorage.removeItem("saved_claims");
    localStorage.removeItem("vetrate_data_hash");
    vi.restoreAllMocks();
  });

  it("does not warn when there are no unsaved changes in either system", () => {
    vi.spyOn(persistentStorage, "checkHasUnsavedChanges").mockReturnValue(
      false,
    );
    // Establishes the "matches last backup" baseline dataPersistence's own
    // hash-based hasUnsavedChanges() needs to read as "nothing pending" -
    // otherwise "no backup ever recorded" itself reads as unsaved changes.
    markBackupCreated();
    setupBeforeUnloadWarning();

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });

  it("warns when dataPersistence's own hash-based check has unsaved changes", () => {
    vi.spyOn(persistentStorage, "checkHasUnsavedChanges").mockReturnValue(
      false,
    );
    markBackupCreated();
    localStorage.setItem("saved_claims", '[{"id":1}]');
    setupBeforeUnloadWarning();

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(true);
  });

  it("warns when only persistentStorage's file-handle flag has unsaved changes (the consolidated check)", () => {
    vi.spyOn(persistentStorage, "checkHasUnsavedChanges").mockReturnValue(true);
    setupBeforeUnloadWarning();

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(true);
  });

  it("registering twice does not attach a second listener", () => {
    vi.spyOn(persistentStorage, "checkHasUnsavedChanges").mockReturnValue(true);
    setupBeforeUnloadWarning();
    setupBeforeUnloadWarning();

    let preventDefaultCalls = 0;
    const event = new Event("beforeunload", { cancelable: true });
    const originalPreventDefault = event.preventDefault.bind(event);
    event.preventDefault = () => {
      preventDefaultCalls++;
      originalPreventDefault();
    };
    window.dispatchEvent(event);

    expect(preventDefaultCalls).toBe(1);
  });

  it("removeBeforeUnloadWarning stops the native prompt from firing at all - the panic redirect must never be blockable", () => {
    vi.spyOn(persistentStorage, "checkHasUnsavedChanges").mockReturnValue(true);
    setupBeforeUnloadWarning();
    removeBeforeUnloadWarning();

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });

  it("removeBeforeUnloadWarning is safe to call when nothing was ever registered", () => {
    expect(() => removeBeforeUnloadWarning()).not.toThrow();
  });

  // safetyRedirect.js (the panic key) must never import this module directly
  // - doing so once dragged in persistentStorage -> migrationManager ->
  // version.js's bare `import packageJson from "../../package.json"`, which
  // broke Playwright's e2e test collection entirely. It calls through
  // beforeUnloadGuard.js's clearBeforeUnloadWarning() instead, which this
  // module registers its remover into.
  it("clearBeforeUnloadWarning (the leaf module the panic key imports) also stops the native prompt", () => {
    vi.spyOn(persistentStorage, "checkHasUnsavedChanges").mockReturnValue(true);
    setupBeforeUnloadWarning();
    clearBeforeUnloadWarning();

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });
});
