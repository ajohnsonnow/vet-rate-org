/**
 * Vet-Rate.org - Bug Report Storage
 * "Safe-Squash" Architecture - Persistent Bug Report Database
 *
 * Uses IndexedDB for reliable, persistent storage of sanitized bug reports.
 * Never loses a report - even if email fails, the report is here.
 *
 * Schema:
 * - BugReports: Main table for sanitized error logs
 * - AuditLog: Tracks who accessed what and when
 *
 * HIPAA/GDPR compliant: Only stores sanitized data.
 * Built by a fellow veteran. "No bug report left behind."
 */

import { sanitizeErrorPayload, createSanitizedReport } from "./bugSanitizer";

// ============================================
// DATABASE CONFIGURATION
// ============================================

const DB_NAME = "VetRateBugSquasher";
const DB_VERSION = 1;
const REPORTS_STORE = "BugReports";
const AUDIT_STORE = "AuditLog";

// ============================================
// DATABASE SCHEMA
// ============================================

/**
 * Bug Report Schema:
 * {
 *   report_id: string,        // e.g., 'BUG-MKNCUI1I'
 *   stack_trace: string,      // Sanitized stack trace
 *   error_message: string,    // Sanitized error message
 *   severity: string,         // critical, high, medium, low
 *   category: string,         // UI, Data, Feature, etc.
 *   module: string,           // Which app module
 *   user_description: string, // User's bug description (sanitized)
 *   steps_to_reproduce: string,
 *   expected_behavior: string,
 *   actual_behavior: string,
 *   client_metadata: {
 *     browser: string,
 *     os: string,
 *     screen_resolution: string,
 *     window_size: string,
 *     app_version: string
 *   },
 *   app_state: object,        // Sanitized app state snapshot
 *   console_errors: array,    // Recent console errors (sanitized)
 *   created_at: string,       // ISO timestamp
 *   resolved: boolean,        // Has this been fixed?
 *   resolved_at: string,      // When it was resolved
 *   resolution_notes: string, // How it was fixed
 *   _sanitization: object     // Sanitization metadata
 * }
 */

/**
 * Audit Log Schema:
 * {
 *   id: number,              // Auto-increment
 *   action: string,          // 'VIEW', 'RESOLVE', 'DELETE', 'EXPORT'
 *   report_id: string,       // Which bug report
 *   accessor: string,        // Who accessed (role/identifier)
 *   timestamp: string,       // ISO timestamp
 *   ip_hint: string,         // Partial IP for audit (first two octets only)
 *   user_agent: string       // Browser info
 * }
 */

// ============================================
// DATABASE INITIALIZATION
// ============================================

let db = null;

/**
 * Open/Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
const openDatabase = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open Bug Squasher database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Create BugReports store
      if (!database.objectStoreNames.contains(REPORTS_STORE)) {
        const reportsStore = database.createObjectStore(REPORTS_STORE, {
          keyPath: "report_id",
        });

        // Indexes for querying
        reportsStore.createIndex("created_at", "created_at", { unique: false });
        reportsStore.createIndex("severity", "severity", { unique: false });
        reportsStore.createIndex("resolved", "resolved", { unique: false });
        reportsStore.createIndex("category", "category", { unique: false });
        reportsStore.createIndex("module", "module", { unique: false });
      }

      // Create AuditLog store
      if (!database.objectStoreNames.contains(AUDIT_STORE)) {
        const auditStore = database.createObjectStore(AUDIT_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });

        // Indexes for querying
        auditStore.createIndex("report_id", "report_id", { unique: false });
        auditStore.createIndex("timestamp", "timestamp", { unique: false });
        auditStore.createIndex("action", "action", { unique: false });
      }
    };
  });
};

// ============================================
// BUG REPORT CRUD OPERATIONS
// ============================================

/**
 * Generate a unique bug report ID
 * Format: BUG-XXXXXXXX (8 random alphanumeric chars)
 * @returns {string}
 */
export const generateReportId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "BUG-";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

/**
 * Save a new bug report to storage
 * Automatically sanitizes the payload before saving
 * @param {Object} reportData - Raw bug report data
 * @returns {Promise<Object>} Saved report with ID
 */
export const saveBugReport = async (reportData) => {
  const database = await openDatabase();

  // Generate ID if not provided
  const reportId = reportData.report_id || generateReportId();

  // Sanitize the entire payload
  const sanitizedData = createSanitizedReport(reportData);

  // Build the report object
  const report = {
    report_id: reportId,
    stack_trace:
      sanitizedData.consoleErrors?.[0]?.stack ||
      sanitizedData.stack_trace ||
      "",
    error_message:
      sanitizedData.consoleErrors?.[0]?.message ||
      sanitizedData.error_message ||
      "",
    severity:
      sanitizedData.severity?.value || sanitizedData.severity || "medium",
    category: sanitizedData.category || "Other",
    module: sanitizedData.module || "Unknown",
    user_description:
      sanitizedData.userDescription || sanitizedData.user_description || "",
    steps_to_reproduce:
      sanitizedData.stepsToReproduce || sanitizedData.steps_to_reproduce || "",
    expected_behavior:
      sanitizedData.expectedBehavior || sanitizedData.expected_behavior || "",
    actual_behavior:
      sanitizedData.actualBehavior || sanitizedData.actual_behavior || "",
    client_metadata: {
      browser: sanitizedData.systemInfo?.userAgent || navigator.userAgent,
      os: sanitizedData.systemInfo?.platform || navigator.platform,
      screen_resolution:
        sanitizedData.systemInfo?.screenResolution ||
        `${screen.width}x${screen.height}`,
      window_size:
        sanitizedData.systemInfo?.windowSize ||
        `${window.innerWidth}x${window.innerHeight}`,
      app_version: sanitizedData.appVersion || "1.0.0",
      timezone:
        sanitizedData.systemInfo?.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    app_state: sanitizedData.appState || {},
    console_errors: sanitizedData.consoleErrors || [],
    storage_info: sanitizedData.storageInfo || {},
    additional_context:
      sanitizedData.additionalContext || sanitizedData.additional_context || "",
    created_at: new Date().toISOString(),
    resolved: false,
    resolved_at: null,
    resolution_notes: "",
    _sanitization: sanitizedData._sanitization || {
      sanitizedAt: new Date().toISOString(),
      version: "1.0",
    },
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([REPORTS_STORE], "readwrite");
    const store = transaction.objectStore(REPORTS_STORE);
    const request = store.put(report);

    request.onsuccess = () => {
      // Log the creation in audit log
      logAuditEvent("CREATE", reportId, "system");
      resolve(report);
    };

    request.onerror = () => {
      console.error("Failed to save bug report:", request.error);
      reject(request.error);
    };
  });
};

/**
 * Retrieve a bug report by ID
 * Logs access in the audit log
 * @param {string} reportId - The bug report ID
 * @param {string} accessor - Who is accessing (for audit)
 * @returns {Promise<Object|null>}
 */
export const getBugReport = async (reportId, accessor = "admin") => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([REPORTS_STORE], "readonly");
    const store = transaction.objectStore(REPORTS_STORE);
    const request = store.get(reportId);

    request.onsuccess = () => {
      const report = request.result;
      if (report) {
        // Log the access in audit log
        logAuditEvent("VIEW", reportId, accessor);
      }
      resolve(report || null);
    };

    request.onerror = () => {
      console.error("Failed to get bug report:", request.error);
      reject(request.error);
    };
  });
};

/**
 * Get all bug reports with optional filters
 * @param {Object} filters - { resolved, severity, category, module, limit }
 * @returns {Promise<Array>}
 */
export const getAllBugReports = async (filters = {}) => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([REPORTS_STORE], "readonly");
    const store = transaction.objectStore(REPORTS_STORE);
    const index = store.index("created_at");
    const request = index.openCursor(null, "prev"); // Most recent first

    const reports = [];
    const limit = filters.limit || 100;

    request.onsuccess = (event) => {
      const cursor = event.target.result;

      if (cursor && reports.length < limit) {
        const report = cursor.value;

        // Apply filters
        let include = true;
        if (
          filters.resolved !== undefined &&
          report.resolved !== filters.resolved
        )
          include = false;
        if (filters.severity && report.severity !== filters.severity)
          include = false;
        if (filters.category && report.category !== filters.category)
          include = false;
        if (filters.module && report.module !== filters.module) include = false;

        if (include) {
          reports.push(report);
        }

        cursor.continue();
      } else {
        resolve(reports);
      }
    };

    request.onerror = () => {
      console.error("Failed to get bug reports:", request.error);
      reject(request.error);
    };
  });
};

/**
 * Mark a bug report as resolved
 * @param {string} reportId - The bug report ID
 * @param {string} notes - Resolution notes
 * @param {string} accessor - Who resolved it
 * @returns {Promise<Object>}
 */
export const resolveBugReport = async (
  reportId,
  notes = "",
  accessor = "admin",
) => {
  const database = await openDatabase();

  // First get the existing report
  const existing = await getBugReport(reportId, "system");
  if (!existing) {
    throw new Error(`Bug report ${reportId} not found`);
  }

  const updated = {
    ...existing,
    resolved: true,
    resolved_at: new Date().toISOString(),
    resolution_notes: notes,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([REPORTS_STORE], "readwrite");
    const store = transaction.objectStore(REPORTS_STORE);
    const request = store.put(updated);

    request.onsuccess = () => {
      logAuditEvent("RESOLVE", reportId, accessor);
      resolve(updated);
    };

    request.onerror = () => {
      console.error("Failed to resolve bug report:", request.error);
      reject(request.error);
    };
  });
};

/**
 * Delete a bug report
 * @param {string} reportId - The bug report ID
 * @param {string} accessor - Who deleted it
 * @returns {Promise<boolean>}
 */
export const deleteBugReport = async (reportId, accessor = "admin") => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([REPORTS_STORE], "readwrite");
    const store = transaction.objectStore(REPORTS_STORE);
    const request = store.delete(reportId);

    request.onsuccess = () => {
      logAuditEvent("DELETE", reportId, accessor);
      resolve(true);
    };

    request.onerror = () => {
      console.error("Failed to delete bug report:", request.error);
      reject(request.error);
    };
  });
};

/**
 * Search bug reports by text
 * @param {string} searchText - Text to search for
 * @returns {Promise<Array>}
 */
export const searchBugReports = async (searchText) => {
  const allReports = await getAllBugReports({ limit: 500 });
  const lowerSearch = searchText.toLowerCase();

  return allReports.filter((report) => {
    return (
      report.report_id.toLowerCase().includes(lowerSearch) ||
      report.user_description.toLowerCase().includes(lowerSearch) ||
      report.error_message.toLowerCase().includes(lowerSearch) ||
      report.module.toLowerCase().includes(lowerSearch) ||
      report.category.toLowerCase().includes(lowerSearch)
    );
  });
};

// ============================================
// AUDIT LOG OPERATIONS
// ============================================

/**
 * Log an audit event
 * @param {string} action - The action performed
 * @param {string} reportId - The bug report ID
 * @param {string} accessor - Who performed the action
 */
const logAuditEvent = async (action, reportId, accessor) => {
  try {
    const database = await openDatabase();

    const auditEntry = {
      action,
      report_id: reportId,
      accessor,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
    };

    const transaction = database.transaction([AUDIT_STORE], "readwrite");
    const store = transaction.objectStore(AUDIT_STORE);
    store.add(auditEntry);
  } catch (error) {
    console.error("Failed to log audit event:", error);
    // Don't throw - audit logging shouldn't break main functionality
  }
};

/**
 * Get audit log for a specific report
 * @param {string} reportId - The bug report ID
 * @returns {Promise<Array>}
 */
export const getAuditLog = async (reportId) => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([AUDIT_STORE], "readonly");
    const store = transaction.objectStore(AUDIT_STORE);
    const index = store.index("report_id");
    const request = index.getAll(reportId);

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

/**
 * Get all audit logs (for compliance review)
 * @param {number} limit - Max entries to return
 * @returns {Promise<Array>}
 */
export const getAllAuditLogs = async (limit = 100) => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([AUDIT_STORE], "readonly");
    const store = transaction.objectStore(AUDIT_STORE);
    const index = store.index("timestamp");
    const request = index.openCursor(null, "prev");

    const logs = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;

      if (cursor && logs.length < limit) {
        logs.push(cursor.value);
        cursor.continue();
      } else {
        resolve(logs);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

// ============================================
// STATISTICS & UTILITIES
// ============================================

/**
 * Get bug report statistics
 * @returns {Promise<Object>}
 */
export const getBugStatistics = async () => {
  const allReports = await getAllBugReports({ limit: 1000 });

  const stats = {
    total: allReports.length,
    resolved: allReports.filter((r) => r.resolved).length,
    unresolved: allReports.filter((r) => !r.resolved).length,
    bySeverity: {
      critical: allReports.filter((r) => r.severity === "critical").length,
      high: allReports.filter((r) => r.severity === "high").length,
      medium: allReports.filter((r) => r.severity === "medium").length,
      low: allReports.filter((r) => r.severity === "low").length,
    },
    byModule: {},
    last24Hours: allReports.filter((r) => {
      const created = new Date(r.created_at);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return created > dayAgo;
    }).length,
  };

  // Count by module
  allReports.forEach((r) => {
    stats.byModule[r.module] = (stats.byModule[r.module] || 0) + 1;
  });

  return stats;
};

/**
 * Export all bug reports as JSON (for backup)
 * @returns {Promise<string>}
 */
export const exportBugReports = async () => {
  const reports = await getAllBugReports({ limit: 10000 });
  const auditLogs = await getAllAuditLogs(10000);

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    reports,
    auditLogs,
  };

  // Log the export
  logAuditEvent("EXPORT", "ALL", "admin");

  return JSON.stringify(exportData, null, 2);
};

/**
 * Check if IndexedDB is available
 * @returns {boolean}
 */
export const isStorageAvailable = () => {
  try {
    return "indexedDB" in window && window.indexedDB !== null;
  } catch {
    return false;
  }
};

// ============================================
// FALLBACK: LOCALSTORAGE BACKUP
// ============================================

const LOCALSTORAGE_KEY = "vet_rate_bug_reports_backup";

/**
 * Fallback: Save to localStorage if IndexedDB fails
 */
export const saveToLocalStorage = (report) => {
  try {
    const existing = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || "[]");
    existing.push(report);
    // Keep only last 50 reports in localStorage
    const trimmed = existing.slice(-50);
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(trimmed));
    return true;
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
    return false;
  }
};

/**
 * Get reports from localStorage fallback
 */
export const getFromLocalStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

/**
 * Clear all bug reports from storage
 * @returns {Promise<boolean>}
 */
export const clearAllBugReports = async () => {
  try {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([REPORTS_STORE], "readwrite");
      const store = transaction.objectStore(REPORTS_STORE);
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        console.log("✅ All bug reports cleared");
        resolve(true);
      };

      clearRequest.onerror = () => {
        console.error("Failed to clear bug reports:", clearRequest.error);
        reject(clearRequest.error);
      };
    });
  } catch (error) {
    console.error("Error clearing bug reports:", error);
    return false;
  }
};

// ============================================
// EXPORTS
// ============================================

export default {
  // Core CRUD
  saveBugReport,
  getBugReport,
  getAllBugReports,
  resolveBugReport,
  deleteBugReport,
  searchBugReports,
  generateReportId,
  clearAllBugReports,

  // Audit
  getAuditLog,
  getAllAuditLogs,

  // Utilities
  getBugStatistics,
  exportBugReports,
  isStorageAvailable,

  // Fallback
  saveToLocalStorage,
  getFromLocalStorage,
};
