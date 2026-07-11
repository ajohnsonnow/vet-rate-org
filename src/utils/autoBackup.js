/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Auto-Backup System - "Zero Data Loss Protocol"
 *
 * Automatically backs up ALL user data after every action to ensure
 * no veteran ever loses their claim information.
 *
 * Features:
 * - Instant backup after every data modification
 * - IndexedDB for persistent browser storage
 * - Auto-download backups to user's device (configurable)
 * - Restore from backup with one click
 * - Multi-version history (keep last 10 backups)
 * - Export/Import capabilities
 * - Backup status indicator in UI
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  DB_NAME: "VetRateAutoBackup",
  DB_VERSION: 1,
  BACKUP_STORE: "backups",
  MAX_BACKUPS: 10, // Keep last 10 backups
  AUTO_DOWNLOAD_ENABLED_KEY: "vetrate_auto_download_backups",
  LAST_BACKUP_KEY: "vetrate_last_backup_time",
  BACKUP_INTERVAL_MS: 2000, // Debounce: backup 2s after last change
  AUTO_DOWNLOAD_INTERVAL_HOURS: 24, // Auto-download every 24 hours
};

// Storage keys to monitor for changes
const MONITORED_STORAGE_KEYS = [
  "vet_rate_veteran_profile",
  "vet_rate_my_ratings",
  "vet_rate_saved_claims",
  "vet_rate_statements",
  "vet_rate_saved_forms",
  "vet_rate_service_history",
  "vet_rate_timeline_events",
  "vet_rate_pain_maps",
  "vet_rate_symptom_log",
  "vet_rate_evidence_timeline",
  "vet_rate_gap_analyses",
  "vet_rate_nexus_letters",
];

// ============================================================================
// INTERNAL STATE
// ============================================================================

let backupTimer = null;
let backupInProgress = false;
let backupListeners = [];
let _lastBackupTime = null;

// ============================================================================
// INDEXEDDB SETUP
// ============================================================================

/**
 * Open the backup database
 * @returns {Promise<IDBDatabase>}
 */
const openBackupDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create backups store if it doesn't exist
      if (!db.objectStoreNames.contains(CONFIG.BACKUP_STORE)) {
        const store = db.createObjectStore(CONFIG.BACKUP_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
    };
  });
};

// ============================================================================
// BACKUP OPERATIONS
// ============================================================================

/**
 * Gather all user data from localStorage
 * @returns {Object} Complete backup of all user data
 */
const gatherAllData = () => {
  const backup = {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    data: {},
  };

  // Gather all monitored keys
  MONITORED_STORAGE_KEYS.forEach((key) => {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        backup.data[key] = JSON.parse(value);
      }
    } catch (error) {
      console.warn(`Error reading ${key}:`, error);
    }
  });

  // Calculate backup size
  backup.sizeBytes = new Blob([JSON.stringify(backup)]).size;
  backup.sizeMB = (backup.sizeBytes / (1024 * 1024)).toFixed(2);

  return backup;
};

/**
 * Save backup to IndexedDB
 * @param {Object} backup - Backup data
 * @returns {Promise<number>} Backup ID
 */
const saveBackupToIndexedDB = async (backup) => {
  const db = await openBackupDB();
  const transaction = db.transaction([CONFIG.BACKUP_STORE], "readwrite");
  const store = transaction.objectStore(CONFIG.BACKUP_STORE);

  return new Promise((resolve, reject) => {
    const backupRecord = {
      timestamp: backup.timestamp,
      type: "auto",
      data: backup,
      sizeBytes: backup.sizeBytes,
    };

    const request = store.add(backupRecord);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get all backups from IndexedDB
 * @returns {Promise<Array>} Array of backups
 */
export const getAllBackups = async () => {
  try {
    const db = await openBackupDB();
    const transaction = db.transaction([CONFIG.BACKUP_STORE], "readonly");
    const store = transaction.objectStore(CONFIG.BACKUP_STORE);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error getting backups:", error);
    return [];
  }
};

/**
 * Clean up old backups (keep only MAX_BACKUPS)
 */
const cleanupOldBackups = async () => {
  try {
    const backups = await getAllBackups();

    if (backups.length > CONFIG.MAX_BACKUPS) {
      // Sort by timestamp (oldest first)
      backups.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Delete oldest backups
      const toDelete = backups.slice(0, backups.length - CONFIG.MAX_BACKUPS);
      const db = await openBackupDB();
      const transaction = db.transaction([CONFIG.BACKUP_STORE], "readwrite");
      const store = transaction.objectStore(CONFIG.BACKUP_STORE);

      for (const backup of toDelete) {
        store.delete(backup.id);
      }
    }
  } catch (error) {
    console.error("Error cleaning up backups:", error);
  }
};

/**
 * Perform a backup
 * @param {string} type - 'auto' or 'manual'
 * @returns {Promise<Object>} Backup result
 */
export const performBackup = async (type = "auto") => {
  if (backupInProgress) {
    return { success: false, message: "Backup already in progress" };
  }

  backupInProgress = true;

  try {
    // Gather all data
    const backup = gatherAllData();
    backup.type = type;

    // Save to IndexedDB
    const backupId = await saveBackupToIndexedDB(backup);

    // Clean up old backups
    await cleanupOldBackups();

    // Update last backup time
    _lastBackupTime = backup.timestamp;
    localStorage.setItem(CONFIG.LAST_BACKUP_KEY, backup.timestamp);

    // Notify listeners
    notifyBackupListeners({
      success: true,
      type,
      timestamp: backup.timestamp,
      backupId,
      sizeBytes: backup.sizeBytes,
    });

    // Auto-download if enabled and it's been long enough
    const autoDownloadEnabled =
      localStorage.getItem(CONFIG.AUTO_DOWNLOAD_ENABLED_KEY) === "true";
    if (autoDownloadEnabled && shouldAutoDownload()) {
      await downloadBackup(backup);
    }

    backupInProgress = false;

    return {
      success: true,
      backupId,
      timestamp: backup.timestamp,
      sizeBytes: backup.sizeBytes,
    };
  } catch (error) {
    backupInProgress = false;
    console.error("Backup failed:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Check if we should auto-download a backup
 * @returns {boolean}
 */
const shouldAutoDownload = () => {
  const lastDownload = localStorage.getItem("vetrate_last_auto_download");
  if (!lastDownload) return true;

  const hoursSinceDownload =
    (Date.now() - new Date(lastDownload)) / (1000 * 60 * 60);
  return hoursSinceDownload >= CONFIG.AUTO_DOWNLOAD_INTERVAL_HOURS;
};

/**
 * Download backup as JSON file
 * @param {Object} backup - Backup data
 */
const downloadBackup = async (backup) => {
  try {
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VetRate-Backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Update last download time
    localStorage.setItem(
      "vetrate_last_auto_download",
      new Date().toISOString(),
    );
  } catch (error) {
    console.error("Error downloading backup:", error);
  }
};

// ============================================================================
// RESTORE OPERATIONS
// ============================================================================

/**
 * Restore data from a backup
 * @param {number} backupId - Backup ID to restore
 * @returns {Promise<Object>} Restore result
 */
export const restoreFromBackup = async (backupId) => {
  try {
    const db = await openBackupDB();
    const transaction = db.transaction([CONFIG.BACKUP_STORE], "readonly");
    const store = transaction.objectStore(CONFIG.BACKUP_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get(backupId);

      request.onsuccess = () => {
        const backup = request.result;
        if (!backup) {
          reject(new Error("Backup not found"));
          return;
        }

        try {
          // Restore all data to localStorage
          Object.entries(backup.data.data).forEach(([key, value]) => {
            localStorage.setItem(key, JSON.stringify(value));
          });

          resolve({
            success: true,
            timestamp: backup.timestamp,
            message: "Data restored successfully",
          });

          // Reload the page to reflect changes
          setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
          reject(error);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error restoring backup:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Import backup from file
 * @param {File} file - Backup file
 * @returns {Promise<Object>} Import result
 */
export const importBackupFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const backup = JSON.parse(e.target.result);

        // Validate backup format
        if (!backup.version || !backup.data || !backup.timestamp) {
          reject(new Error("Invalid backup file format"));
          return;
        }

        // Restore data
        Object.entries(backup.data).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });

        // Save to IndexedDB for history
        await saveBackupToIndexedDB(backup);

        resolve({
          success: true,
          timestamp: backup.timestamp,
          message: "Backup imported successfully",
        });

        // Reload page
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

/**
 * Export current data as backup file
 * @returns {Promise<void>}
 */
export const exportBackupFile = async () => {
  const backup = gatherAllData();
  backup.type = "manual";
  await downloadBackup(backup);
};

/**
 * Delete a backup
 * @param {number} backupId - Backup ID to delete
 * @returns {Promise<boolean>}
 */
export const deleteBackup = async (backupId) => {
  try {
    const db = await openBackupDB();
    const transaction = db.transaction([CONFIG.BACKUP_STORE], "readwrite");
    const store = transaction.objectStore(CONFIG.BACKUP_STORE);

    return new Promise((resolve, reject) => {
      const request = store.delete(backupId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error deleting backup:", error);
    return false;
  }
};

// ============================================================================
// AUTO-BACKUP TRIGGER
// ============================================================================

/**
 * Trigger a backup (with debounce)
 */
export const triggerBackup = () => {
  // Clear existing timer
  if (backupTimer) {
    clearTimeout(backupTimer);
  }

  // Set new timer
  backupTimer = setTimeout(() => {
    performBackup("auto");
  }, CONFIG.BACKUP_INTERVAL_MS);
};

/**
 * Monitor localStorage changes and trigger backups
 */
export const startAutoBackup = () => {
  // Override localStorage.setItem to monitor changes
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (key, value) {
    // Call original method
    originalSetItem.call(localStorage, key, value);

    // Trigger backup if it's a monitored key
    if (MONITORED_STORAGE_KEYS.includes(key)) {
      triggerBackup();
    }
  };

  // eslint-disable-next-line no-console
  console.log("✅ Auto-backup system started");
};

/**
 * Get last backup information
 * @returns {Object} Last backup info
 */
export const getLastBackupInfo = async () => {
  const backups = await getAllBackups();
  if (backups.length === 0) {
    return null;
  }

  // Sort by timestamp (newest first)
  backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const latest = backups[0];
  return {
    timestamp: latest.timestamp,
    sizeBytes: latest.sizeBytes,
    type: latest.type,
    id: latest.id,
  };
};

/**
 * Get backup statistics
 * @returns {Promise<Object>} Backup stats
 */
export const getBackupStats = async () => {
  const backups = await getAllBackups();

  const totalSize = backups.reduce((sum, b) => sum + (b.sizeBytes || 0), 0);

  return {
    totalBackups: backups.length,
    totalSizeBytes: totalSize,
    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    oldestBackup:
      backups.length > 0 ? backups[backups.length - 1].timestamp : null,
    newestBackup: backups.length > 0 ? backups[0].timestamp : null,
  };
};

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Add backup event listener
 * @param {Function} callback - Callback function
 */
export const onBackupComplete = (callback) => {
  backupListeners.push(callback);
};

/**
 * Remove backup event listener
 * @param {Function} callback - Callback function
 */
export const removeBackupListener = (callback) => {
  backupListeners = backupListeners.filter((cb) => cb !== callback);
};

/**
 * Notify all backup listeners
 * @param {Object} event - Backup event data
 */
const notifyBackupListeners = (event) => {
  backupListeners.forEach((callback) => {
    try {
      callback(event);
    } catch (error) {
      console.error("Error in backup listener:", error);
    }
  });
};

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Enable/disable auto-download
 * @param {boolean} enabled - Whether to enable auto-download
 */
export const setAutoDownloadEnabled = (enabled) => {
  localStorage.setItem(
    CONFIG.AUTO_DOWNLOAD_ENABLED_KEY,
    enabled ? "true" : "false",
  );
};

/**
 * Check if auto-download is enabled
 * @returns {boolean}
 */
export const isAutoDownloadEnabled = () => {
  return localStorage.getItem(CONFIG.AUTO_DOWNLOAD_ENABLED_KEY) === "true";
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the auto-backup system
 */
export const initAutoBackup = async () => {
  try {
    // Start monitoring localStorage
    startAutoBackup();

    // Load last backup time
    const lastBackup = localStorage.getItem(CONFIG.LAST_BACKUP_KEY);
    if (lastBackup) {
      _lastBackupTime = lastBackup;
    }

    // Perform initial backup if none exists
    const backups = await getAllBackups();
    if (backups.length === 0) {
      await performBackup("auto");
    }

    // eslint-disable-next-line no-console
    console.log("✅ Auto-backup system initialized");
  } catch (error) {
    console.error("Error initializing auto-backup:", error);
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  initAutoBackup,
  performBackup,
  triggerBackup,
  getAllBackups,
  restoreFromBackup,
  importBackupFile,
  exportBackupFile,
  deleteBackup,
  getLastBackupInfo,
  getBackupStats,
  onBackupComplete,
  removeBackupListener,
  setAutoDownloadEnabled,
  isAutoDownloadEnabled,
};
