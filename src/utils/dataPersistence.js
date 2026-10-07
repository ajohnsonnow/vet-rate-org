/**
 * Vet-Rate.org - Data Persistence Protection Utility
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Tracks unsaved changes and manages the "Bunker Backup" warning system
 * Prevents data loss from cache clearing or accidental tab closure
 */

import { checkHasUnsavedChanges } from "./persistentStorage";
import { setBeforeUnloadRemover } from "./beforeUnloadGuard";

const LAST_BACKUP_KEY = "vetrate_last_backup_timestamp";
const DATA_HASH_KEY = "vetrate_data_hash";

/**
 * Generate a simple hash of the current localStorage data
 * Used to detect if data has changed since last backup
 */
function generateDataHash() {
  const claimsData = localStorage.getItem("saved_claims") || "";
  const statementsData = localStorage.getItem("saved_statements") || "";
  const profileData = localStorage.getItem("veteran_profile") || "";
  const formsData = localStorage.getItem("saved_forms") || "";

  const combinedData = claimsData + statementsData + profileData + formsData;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < combinedData.length; i++) {
    const char = combinedData.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

/**
 * Mark that a backup was just created
 */
export function markBackupCreated() {
  const currentHash = generateDataHash();
  localStorage.setItem(LAST_BACKUP_KEY, Date.now().toString());
  localStorage.setItem(DATA_HASH_KEY, currentHash);
}

/**
 * Check if there are unsaved changes since last backup
 * Returns true if data has changed and needs backup
 */
export function hasUnsavedChanges() {
  const lastBackupHash = localStorage.getItem(DATA_HASH_KEY);
  const currentHash = generateDataHash();

  // If no previous backup or data has changed
  return !lastBackupHash || lastBackupHash !== currentHash;
}

// The single `beforeunload` listener this module has ever registered, kept
// so the panic-redirect path (safetyRedirect.js) can remove it again before
// navigating away. A `beforeunload` handler that calls preventDefault()
// shows the browser's native "Leave site?" prompt, which blocks
// location.replace() the same as any other navigation - the panic key must
// never be blockable, so it disables this (and persistentStorage.js's
// file-handle guard, folded in below) before ever redirecting.
let beforeUnloadHandler = null;

// Consolidated check: this module's own localStorage-hash-based "Bunker
// Backup" comparison, OR persistentStorage.js's File-System-Access-API /
// IndexedDB file-handle flag. Two separate `beforeunload` listeners used to
// be registered (one per module) purely to gate the same native dialog -
// folding them into one registration here means there is only ever one
// listener reference for the panic path to remove (see
// persistentStorage.js's initUnsavedChangesWarning, now a no-op that defers
// to this).
function shouldWarnBeforeUnload() {
  return hasUnsavedChanges() || checkHasUnsavedChanges();
}

/**
 * Setup the beforeunload listener to warn about unsaved changes
 * Should be called once when the app loads
 */
export function setupBeforeUnloadWarning() {
  if (beforeUnloadHandler) return; // already registered - idempotent

  beforeUnloadHandler = (event) => {
    if (shouldWarnBeforeUnload()) {
      const message =
        "You have unsaved changes in your session. Please download your Bunker Backup file before leaving, or your work may be lost.";
      event.preventDefault();
      event.returnValue = message; // For legacy browsers
      return message;
    }
  };
  window.addEventListener("beforeunload", beforeUnloadHandler);
  setBeforeUnloadRemover(removeBeforeUnloadWarning);
}

/**
 * Remove the beforeunload warning so a navigation the veteran deliberately
 * chose (the panic redirect) can never be blocked by it. Safe to call even
 * if setupBeforeUnloadWarning() was never called.
 */
export function removeBeforeUnloadWarning() {
  if (!beforeUnloadHandler) return;
  window.removeEventListener("beforeunload", beforeUnloadHandler);
  beforeUnloadHandler = null;
}
