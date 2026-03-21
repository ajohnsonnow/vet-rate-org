/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 *
 * VA Sync Logger Utility
 *
 * Centralized logging system for all VA API calls.
 * Provides transparency into what data is being fetched, when, and its status.
 * This powers the "Sync Status" tab in My Packet for veteran trust.
 */

const SYNC_LOG_KEY = "vet_rate_va_sync_log";
const MAX_LOG_ENTRIES = 100; // Keep last 100 entries
const RAW_DATA_KEY = "vet_rate_va_raw_data";

// API Categories for display
export const API_CATEGORIES = {
  SERVICE_HISTORY: "Service History",
  CLAIMS: "Claims",
  DISABILITY_RATING: "Disability Rating",
  APPEALS: "Appeals",
  APPEALABLE_ISSUES: "Appealable Issues",
  FACILITIES: "Facilities",
  FORMS: "Forms",
  BENEFITS_REF: "Benefits Reference",
  USER_INFO: "User Info",
};

// Status types
export const SYNC_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  ERROR: "error",
  CACHED: "cached",
};

/**
 * Generate a unique log entry ID
 */
const generateLogId = () => {
  return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get all sync log entries
 * @returns {Array} Array of log entries, newest first
 */
export const getSyncLog = () => {
  try {
    const saved = sessionStorage.getItem(SYNC_LOG_KEY);
    const logs = saved ? JSON.parse(saved) : [];
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    console.error("[VA Sync Logger] Error reading sync log:", error);
    return [];
  }
};

/**
 * Add a new log entry
 * @param {Object} entry - Log entry data
 * @returns {string} Log entry ID
 */
export const addSyncLogEntry = (entry) => {
  try {
    const logs = getSyncLog();
    const newEntry = {
      id: generateLogId(),
      timestamp: new Date().toISOString(),
      status: SYNC_STATUS.PENDING,
      duration: null,
      error: null,
      recordCount: null,
      ...entry,
    };

    logs.unshift(newEntry);

    // Trim to max entries
    const trimmed = logs.slice(0, MAX_LOG_ENTRIES);
    sessionStorage.setItem(SYNC_LOG_KEY, JSON.stringify(trimmed));

    // Dispatch event for real-time UI updates
    window.dispatchEvent(
      new CustomEvent("va-sync-log-update", { detail: newEntry }),
    );

    return newEntry.id;
  } catch (error) {
    console.error("[VA Sync Logger] Error adding log entry:", error);
    return null;
  }
};

/**
 * Update an existing log entry (e.g., when request completes)
 * @param {string} logId - The log entry ID
 * @param {Object} updates - Fields to update
 */
export const updateSyncLogEntry = (logId, updates) => {
  try {
    const logs = getSyncLog();
    const index = logs.findIndex((log) => log.id === logId);

    if (index !== -1) {
      logs[index] = { ...logs[index], ...updates };
      sessionStorage.setItem(SYNC_LOG_KEY, JSON.stringify(logs));

      // Dispatch event for real-time UI updates
      window.dispatchEvent(
        new CustomEvent("va-sync-log-update", { detail: logs[index] }),
      );
    }
  } catch (error) {
    console.error("[VA Sync Logger] Error updating log entry:", error);
  }
};

/**
 * Clear all sync log entries
 */
export const clearSyncLog = () => {
  try {
    sessionStorage.removeItem(SYNC_LOG_KEY);
    window.dispatchEvent(
      new CustomEvent("va-sync-log-update", { detail: { cleared: true } }),
    );
  } catch (error) {
    console.error("[VA Sync Logger] Error clearing sync log:", error);
  }
};

/**
 * Store raw API response data for transparency tab
 * @param {string} category - API category
 * @param {Object} data - Raw API response
 */
export const storeRawData = (category, data) => {
  try {
    const stored = getRawDataStore();
    stored[category] = {
      data,
      timestamp: new Date().toISOString(),
      lastFetched: new Date().toLocaleString(),
    };
    sessionStorage.setItem(RAW_DATA_KEY, JSON.stringify(stored));

    // Dispatch event for UI updates
    window.dispatchEvent(
      new CustomEvent("va-raw-data-update", { detail: { category } }),
    );
  } catch (error) {
    console.error("[VA Sync Logger] Error storing raw data:", error);
  }
};

/**
 * Get all stored raw API data
 * @returns {Object} Object with category keys and raw data values
 */
export const getRawDataStore = () => {
  try {
    const saved = sessionStorage.getItem(RAW_DATA_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error("[VA Sync Logger] Error reading raw data store:", error);
    return {};
  }
};

/**
 * Get raw data for a specific category
 * @param {string} category - API category
 * @returns {Object|null} Raw data or null
 */
export const getRawData = (category) => {
  const store = getRawDataStore();
  return store[category] || null;
};

/**
 * Clear all raw data
 */
export const clearRawData = () => {
  try {
    sessionStorage.removeItem(RAW_DATA_KEY);
    window.dispatchEvent(
      new CustomEvent("va-raw-data-update", { detail: { cleared: true } }),
    );
  } catch (error) {
    console.error("[VA Sync Logger] Error clearing raw data:", error);
  }
};

/**
 * Helper: Log a VA API call with automatic timing
 * Usage:
 *   const { logId, complete, fail } = startApiLog(API_CATEGORIES.CLAIMS, '/services/claims/v2/...');
 *   try {
 *     const data = await fetch(...);
 *     complete(data, data.length);
 *   } catch (err) {
 *     fail(err.message);
 *   }
 */
export const startApiLog = (category, endpoint, authType = "OAuth") => {
  const startTime = Date.now();
  const logId = addSyncLogEntry({
    category,
    endpoint,
    authType,
    status: SYNC_STATUS.PENDING,
  });

  return {
    logId,
    complete: (rawData, recordCount = null) => {
      const duration = Date.now() - startTime;
      updateSyncLogEntry(logId, {
        status: SYNC_STATUS.SUCCESS,
        duration,
        recordCount,
      });
      if (rawData) {
        storeRawData(category, rawData);
      }
    },
    fail: (errorMessage) => {
      const duration = Date.now() - startTime;
      updateSyncLogEntry(logId, {
        status: SYNC_STATUS.ERROR,
        duration,
        error: errorMessage,
      });
    },
    cached: () => {
      updateSyncLogEntry(logId, {
        status: SYNC_STATUS.CACHED,
        duration: 0,
      });
    },
  };
};

/**
 * Get sync statistics
 * @returns {Object} Stats about sync history
 */
export const getSyncStats = () => {
  const logs = getSyncLog();

  const stats = {
    totalCalls: logs.length,
    successCount: logs.filter((l) => l.status === SYNC_STATUS.SUCCESS).length,
    errorCount: logs.filter((l) => l.status === SYNC_STATUS.ERROR).length,
    cachedCount: logs.filter((l) => l.status === SYNC_STATUS.CACHED).length,
    pendingCount: logs.filter((l) => l.status === SYNC_STATUS.PENDING).length,
    lastSync: logs[0]?.timestamp || null,
    avgDuration: 0,
    byCategory: {},
  };

  // Calculate average duration
  const completedLogs = logs.filter((l) => l.duration != null);
  if (completedLogs.length > 0) {
    stats.avgDuration = Math.round(
      completedLogs.reduce((sum, l) => sum + l.duration, 0) /
        completedLogs.length,
    );
  }

  // Group by category
  Object.values(API_CATEGORIES).forEach((cat) => {
    const catLogs = logs.filter((l) => l.category === cat);
    stats.byCategory[cat] = {
      total: catLogs.length,
      success: catLogs.filter((l) => l.status === SYNC_STATUS.SUCCESS).length,
      errors: catLogs.filter((l) => l.status === SYNC_STATUS.ERROR).length,
      lastSync: catLogs[0]?.timestamp || null,
    };
  });

  return stats;
};

/**
 * Format timestamp for display
 */
export const formatTimestamp = (isoString) => {
  if (!isoString) return "Never";
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

/**
 * Format duration for display
 */
export const formatDuration = (ms) => {
  if (ms == null) return "...";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export default {
  getSyncLog,
  addSyncLogEntry,
  updateSyncLogEntry,
  clearSyncLog,
  storeRawData,
  getRawDataStore,
  getRawData,
  clearRawData,
  startApiLog,
  getSyncStats,
  formatTimestamp,
  formatDuration,
  API_CATEGORIES,
  SYNC_STATUS,
};
