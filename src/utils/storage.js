/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 *
 * Storage Utility with IndexedDB
 * Provides a localStorage-like API backed by IndexedDB for unlimited storage.
 * Automatically migrates from localStorage to IndexedDB on first use.
 */

import { get, set, del, keys, clear } from "idb-keyval";

const MIGRATION_KEY = "vet_rate_migrated_to_indexeddb";
const MIGRATION_TIMESTAMP_KEY = "vet_rate_migration_timestamp";

/**
 * Storage wrapper that provides async localStorage-like API using IndexedDB
 */
export const storage = {
  /**
   * Get an item from storage
   * @param {string} key - The key to retrieve
   * @returns {Promise<string|null>} The value or null
   */
  async getItem(key) {
    try {
      const value = await get(key);
      return value !== undefined ? value : null;
    } catch (error) {
      console.error("Storage getItem error:", error);
      return null;
    }
  },

  /**
   * Set an item in storage
   * @param {string} key - The key to set
   * @param {string} value - The value to store
   * @returns {Promise<boolean>} Success status
   */
  async setItem(key, value) {
    try {
      await set(key, value);
      return true;
    } catch (error) {
      console.error("Storage setItem error:", error);
      return false;
    }
  },

  /**
   * Remove an item from storage
   * @param {string} key - The key to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeItem(key) {
    try {
      await del(key);
      return true;
    } catch (error) {
      console.error("Storage removeItem error:", error);
      return false;
    }
  },

  /**
   * Get all keys in storage
   * @returns {Promise<string[]>} Array of keys
   */
  async getAllKeys() {
    try {
      return await keys();
    } catch (error) {
      console.error("Storage getAllKeys error:", error);
      return [];
    }
  },

  /**
   * Clear all items from storage
   * @returns {Promise<boolean>} Success status
   */
  async clear() {
    try {
      await clear();
      return true;
    } catch (error) {
      console.error("Storage clear error:", error);
      return false;
    }
  },

  /**
   * Get multiple items at once
   * @param {string[]} keyList - Array of keys to retrieve
   * @returns {Promise<Object>} Object with key-value pairs
   */
  async getMultiple(keyList) {
    const results = {};
    await Promise.all(
      keyList.map(async (key) => {
        results[key] = await this.getItem(key);
      }),
    );
    return results;
  },

  /**
   * Set multiple items at once
   * @param {Object} items - Object with key-value pairs
   * @returns {Promise<boolean>} Success status
   */
  async setMultiple(items) {
    try {
      await Promise.all(
        Object.entries(items).map(([key, value]) => this.setItem(key, value)),
      );
      return true;
    } catch (error) {
      console.error("Storage setMultiple error:", error);
      return false;
    }
  },
};

/**
 * Check if migration from localStorage to IndexedDB is needed
 * @returns {Promise<boolean>} True if migration is needed
 */
export async function needsMigration() {
  // Check if we've already migrated
  const alreadyMigrated = await storage.getItem(MIGRATION_KEY);
  if (alreadyMigrated === "true") {
    return false;
  }

  // Check if there's any data in localStorage that should be migrated
  const veteranProfileKeys = [
    "vet_rate_veteran_profile",
    "vet_rate_saved_forms",
    "vet_rate_my_ratings",
    "vet_rate_saved_claims",
    "vet-rate-tos-accepted",
    "vet-rate-tos-accepted-date",
    "vetrate_gemini_key",
    "vet_rate_app_version",
    "vet_rate_data_schema_version",
    "vet_rate_last_seen_version",
    "pwa_install_dismissed",
  ];

  for (const key of veteranProfileKeys) {
    let stored = null;
    try {
      stored = localStorage.getItem(key);
    } catch {
      // A key that cannot be read has nothing this migration can move.
    }
    if (stored !== null) {
      return true; // Found data that needs migration
    }
  }

  return false;
}

function getAllLocalStorageKeys() {
  const allKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) allKeys.push(key);
  }
  return allKeys;
}

async function copyKeyToIndexedDb(key, migrationResults) {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) {
      const wrote = await storage.setItem(key, value);
      if (!wrote) {
        throw new Error("IndexedDB write failed");
      }
      migrationResults.migratedKeys.push(key);
      migrationResults.totalSize += value.length;
      // eslint-disable-next-line no-console
      console.log(`✅ Migrated: ${key} (${value.length} bytes)`);
    }
  } catch (error) {
    console.error(`❌ Failed to migrate key: ${key}`, error);
    migrationResults.failedKeys.push({ key, error: error.message });
  }
}

// Copies every key, checking `shouldAbort` before each one. This is never a
// destructive operation (see migrateFromLocalStorage's own doc comment), so
// stopping here mid-loop is always safe - it just leaves some keys uncopied
// for a later, complete run to pick up.
async function copyAllKeysToIndexedDb(allKeys, migrationResults, shouldAbort) {
  for (const key of allKeys) {
    if (shouldAbort?.()) {
      migrationResults.aborted = true;
      console.warn(
        "⚠️ Migration stopped mid-copy (maintenance mode turned on) - originals untouched, will resume on a later boot",
      );
      return;
    }
    await copyKeyToIndexedDb(key, migrationResults);
  }
}

async function markMigrationComplete(migrationResults) {
  const flagWritten = await storage.setItem(MIGRATION_KEY, "true");
  await storage.setItem(MIGRATION_TIMESTAMP_KEY, migrationResults.timestamp);
  if (!flagWritten) {
    migrationResults.failedKeys.push({
      key: MIGRATION_KEY,
      error: "IndexedDB write failed",
    });
  }
  migrationResults.success = migrationResults.failedKeys.length === 0;
}

/**
 * Migrate all data from localStorage to IndexedDB.
 *
 * This copy is never destructive - it only ever writes to IndexedDB and
 * never deletes or clears the localStorage originals (see the "DO NOT
 * clear localStorage" note below), so it's always safe to stop mid-loop.
 *
 * `shouldAbort`, if given, is checked before copying each key. It exists so
 * a caller (useBootSequence.js) can stop an in-progress copy the instant a
 * live maintenance-mode check turns on, without any risk of data loss - an
 * aborted run never writes the MIGRATION_KEY completion flag, so
 * needsMigration() still reports true afterward and a later boot's copy
 * picks up (and safely re-copies, idempotently) right where this one left
 * off.
 *
 * @param {Object} [options]
 * @param {() => boolean} [options.shouldAbort] - checked before each key;
 *   stops the copy (without marking it complete) the first time it's true.
 * @returns {Promise<Object>} Migration results
 */
export async function migrateFromLocalStorage({ shouldAbort } = {}) {
  const migrationResults = {
    success: false,
    aborted: false,
    migratedKeys: [],
    failedKeys: [],
    totalSize: 0,
    timestamp: new Date().toISOString(),
  };

  try {
    // eslint-disable-next-line no-console
    console.log("🔄 Starting migration from localStorage to IndexedDB...");

    const allKeys = getAllLocalStorageKeys();
    // eslint-disable-next-line no-console
    console.log(`📦 Found ${allKeys.length} keys in localStorage`);

    await copyAllKeysToIndexedDb(allKeys, migrationResults, shouldAbort);

    if (migrationResults.aborted) {
      migrationResults.success = false;
      return migrationResults;
    }

    await markMigrationComplete(migrationResults);

    // eslint-disable-next-line no-console
    console.log(
      `✨ Migration complete! Migrated ${migrationResults.migratedKeys.length} keys (${(migrationResults.totalSize / 1024).toFixed(2)} KB)`,
    );

    // DO NOT clear localStorage - app still reads from it
    // Data is now in both places (IndexedDB for backup, localStorage for live access)
    // SECURITY DEBT: both stores are plaintext — PII (ratings, profile, DD214 data) is
    // readable by any same-origin JS. At-rest encryption requires wrapping every read/write
    // path with cloudEncryption.js (encryptForCloud / decryptFromCloud) and a device passphrase.
    // eslint-disable-next-line no-console
    console.log(
      "✅ Data successfully backed up to IndexedDB (localStorage preserved)",
    );

    return migrationResults;
  } catch (error) {
    console.error("❌ Migration failed:", error);
    migrationResults.success = false;
    migrationResults.error = error.message;
    return migrationResults;
  }
}

/**
 * Check migration status
 * @returns {Promise<Object>} Migration status info
 */
export async function getMigrationStatus() {
  const isMigrated = await storage.getItem(MIGRATION_KEY);
  const timestamp = await storage.getItem(MIGRATION_TIMESTAMP_KEY);
  const allKeys = await storage.getAllKeys();

  return {
    isMigrated: isMigrated === "true",
    migrationDate: timestamp,
    indexedDBKeys: allKeys.length,
    localStorageKeys: localStorage.length,
    estimatedIndexedDBSize: await estimateStorageSize(),
    estimatedLocalStorageSize: estimateLocalStorageSize(),
  };
}

/**
 * Estimate the size of data in IndexedDB
 * @returns {Promise<number>} Estimated size in bytes
 */
async function estimateStorageSize() {
  try {
    const allKeys = await storage.getAllKeys();
    let totalSize = 0;

    for (const key of allKeys) {
      const value = await storage.getItem(key);
      if (value) {
        totalSize += JSON.stringify(value).length;
      }
    }

    return totalSize;
  } catch (error) {
    console.error("Error estimating storage size:", error);
    return 0;
  }
}

/**
 * Estimate the size of data in localStorage
 * @returns {number} Estimated size in bytes
 */
function estimateLocalStorageSize() {
  let totalSize = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += key.length + value.length;
      }
    }
  }
  return totalSize;
}

/**
 * Export all data from IndexedDB (for backup)
 * @returns {Promise<Object>} All data in a single object
 */
export async function exportAllData() {
  try {
    const allKeys = await storage.getAllKeys();
    const data = {};

    for (const key of allKeys) {
      data[key] = await storage.getItem(key);
    }

    return {
      exportDate: new Date().toISOString(),
      version: "1.0.0",
      storageType: "IndexedDB",
      data,
    };
  } catch (error) {
    console.error("Error exporting data:", error);
    throw error;
  }
}

/**
 * Import data into IndexedDB (for restore)
 * @param {Object} exportedData - Data exported from exportAllData()
 * @returns {Promise<boolean>} Success status
 */
export async function importAllData(exportedData) {
  try {
    if (!exportedData?.data) {
      throw new Error("Invalid export data format");
    }

    // eslint-disable-next-line no-console
    console.log("📥 Importing data into IndexedDB...");

    const entries = Object.entries(exportedData.data);
    for (const [key, value] of entries) {
      await storage.setItem(key, value);
    }

    // eslint-disable-next-line no-console
    console.log(`✅ Imported ${entries.length} keys`);
    return true;
  } catch (error) {
    console.error("Error importing data:", error);
    throw error;
  }
}

const QUOTA_ESTIMATE_TIMEOUT_MS = 5000;

/**
 * Pre-flight check that an upcoming write of roughly `estimatedBytes`
 * fits within the browser's storage quota.
 * Never throws; resolves ok:true when the quota API is unavailable so
 * unsupported browsers are never blocked.
 * @param {number} estimatedBytes - Rough size of the pending write
 * @returns {Promise<{ok: boolean, remaining: number|null, message: string}>}
 */
export async function ensureQuota(estimatedBytes) {
  try {
    if (
      typeof navigator === "undefined" ||
      !navigator.storage ||
      typeof navigator.storage.estimate !== "function"
    ) {
      return { ok: true, remaining: null, message: "" };
    }

    // estimate() can stall for a long time when the browser is busy writing;
    // a save must never wait on an advisory check.
    let estimateTimer;
    const { usage = 0, quota = 0 } = await Promise.race([
      navigator.storage.estimate(),
      new Promise((resolve) => {
        estimateTimer = setTimeout(
          () => resolve({}),
          QUOTA_ESTIMATE_TIMEOUT_MS,
        );
      }),
    ]).finally(() => clearTimeout(estimateTimer));
    if (!quota) {
      return { ok: true, remaining: null, message: "" };
    }

    const remaining = quota - usage;
    if (estimatedBytes > remaining) {
      const neededMB = (estimatedBytes / (1024 * 1024)).toFixed(1);
      const remainingMB = (remaining / (1024 * 1024)).toFixed(1);
      return {
        ok: false,
        remaining,
        message: `This save needs about ${neededMB} MB but your browser only has about ${remainingMB} MB of storage left. Export a backup and free up space to avoid losing data.`,
      };
    }

    return { ok: true, remaining, message: "" };
  } catch (error) {
    console.warn("Storage quota check failed:", error);
    return { ok: true, remaining: null, message: "" };
  }
}

/**
 * Get storage statistics
 * @returns {Promise<Object>} Storage stats
 */
export async function getStorageStats() {
  const migrationStatus = await getMigrationStatus();

  // Try to get quota information
  let quota = { usage: 0, quota: 0 };
  if (navigator.storage?.estimate) {
    try {
      quota = await navigator.storage.estimate();
    } catch (e) {
      console.warn("Could not estimate storage quota:", e);
    }
  }

  return {
    ...migrationStatus,
    quotaUsage: quota.usage,
    quotaLimit: quota.quota,
    quotaUsagePercent:
      quota.quota > 0 ? ((quota.usage / quota.quota) * 100).toFixed(2) : 0,
    quotaUsageMB: (quota.usage / (1024 * 1024)).toFixed(2),
    quotaLimitMB: (quota.quota / (1024 * 1024)).toFixed(2),
    estimatedIndexedDBSizeMB: (
      migrationStatus.estimatedIndexedDBSize /
      (1024 * 1024)
    ).toFixed(2),
    estimatedLocalStorageSizeMB: (
      migrationStatus.estimatedLocalStorageSize /
      (1024 * 1024)
    ).toFixed(2),
    localStorageLimitMB: "5-10", // Typical browser limit
  };
}

export default storage;
