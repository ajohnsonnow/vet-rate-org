/**
 * SupplyLocker.org - Data Persistence Protection Utility
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Tracks unsaved changes and manages the "Bunker Backup" warning system
 * Prevents data loss from cache clearing or accidental tab closure
 */

const LAST_BACKUP_KEY = 'supplylocker_last_backup_timestamp';
const DATA_HASH_KEY = 'supplylocker_data_hash';

/**
 * Generate a simple hash of the current localStorage data
 * Used to detect if data has changed since last backup
 */
function generateDataHash() {
  const claimsData = localStorage.getItem('saved_claims') || '';
  const statementsData = localStorage.getItem('saved_statements') || '';
  const profileData = localStorage.getItem('veteran_profile') || '';
  const formsData = localStorage.getItem('saved_forms') || '';
  
  const combinedData = claimsData + statementsData + profileData + formsData;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < combinedData.length; i++) {
    const char = combinedData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
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
  if (!lastBackupHash || lastBackupHash !== currentHash) {
    return true;
  }
  
  return false;
}

/**
 * Get the time since last backup in minutes
 */
export function getMinutesSinceLastBackup() {
  const lastBackupTime = localStorage.getItem(LAST_BACKUP_KEY);
  if (!lastBackupTime) return Infinity;
  
  const now = Date.now();
  const timeDiff = now - parseInt(lastBackupTime, 10);
  return Math.floor(timeDiff / 60000); // Convert to minutes
}

/**
 * Check if the user should be reminded to backup
 * Returns true if:
 * - There are unsaved changes AND
 * - It's been more than 30 minutes since last backup OR no backup exists
 */
export function shouldShowBackupReminder() {
  const unsaved = hasUnsavedChanges();
  const minutesSinceBackup = getMinutesSinceLastBackup();
  
  return unsaved && minutesSinceBackup > 30;
}

/**
 * Setup the beforeunload listener to warn about unsaved changes
 * Should be called once when the app loads
 */
export function setupBeforeUnloadWarning() {
  window.addEventListener('beforeunload', (event) => {
    if (hasUnsavedChanges()) {
      const message = 'You have unsaved changes in your session. Please download your Bunker Backup file before leaving, or your work may be lost.';
      event.preventDefault();
      event.returnValue = message; // For legacy browsers
      return message;
    }
  });
}

/**
 * Check if significant data exists that would be worth backing up
 */
export function hasSignificantData() {
  const claims = localStorage.getItem('saved_claims');
  const forms = localStorage.getItem('saved_forms');
  
  if (!claims && !forms) return false;
  
  try {
    const claimsArray = claims ? JSON.parse(claims) : [];
    const formsArray = forms ? JSON.parse(forms) : [];
    return claimsArray.length > 0 || formsArray.length > 0;
  } catch (e) {
    return false;
  }
}
