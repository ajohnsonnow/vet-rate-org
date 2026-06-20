/**
 * Vet-Rate.org - Data Persistence Protection Utility
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * Tracks unsaved changes and manages the "Bunker Backup" warning system
 * Prevents data loss from cache clearing or accidental tab closure
 */

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

/**
 * Setup the beforeunload listener to warn about unsaved changes
 * Should be called once when the app loads
 */
export function setupBeforeUnloadWarning() {
  window.addEventListener("beforeunload", (event) => {
    if (hasUnsavedChanges()) {
      const message =
        "You have unsaved changes in your session. Please download your Bunker Backup file before leaving, or your work may be lost.";
      event.preventDefault();
      event.returnValue = message; // For legacy browsers
      return message;
    }
  });
}
