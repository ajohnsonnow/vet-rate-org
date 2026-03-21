/**
 * Vet-Rate.org - Feature Request Storage
 * Persistent storage for feature requests using IndexedDB
 *
 * Uses the same architecture as bugReportStorage for consistency.
 * Stores feature requests locally with reliable persistence.
 *
 * Built by a fellow veteran. "Every idea counts."
 */

// ============================================
// DATABASE CONFIGURATION
// ============================================

const DB_NAME = "VetRateFeatureRequests";
const DB_VERSION = 1;
const REQUESTS_STORE = "FeatureRequests";
const AUDIT_STORE = "AuditLog";

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
      console.error("Failed to open Feature Requests database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Create FeatureRequests store
      if (!database.objectStoreNames.contains(REQUESTS_STORE)) {
        const requestsStore = database.createObjectStore(REQUESTS_STORE, {
          keyPath: "request_id",
        });

        // Indexes for querying
        requestsStore.createIndex("created_at", "created_at", {
          unique: false,
        });
        requestsStore.createIndex("priority", "priority", { unique: false });
        requestsStore.createIndex("status", "status", { unique: false });
        requestsStore.createIndex("category", "category", { unique: false });
        requestsStore.createIndex("module", "module", { unique: false });
      }

      // Create AuditLog store
      if (!database.objectStoreNames.contains(AUDIT_STORE)) {
        const auditStore = database.createObjectStore(AUDIT_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });

        // Indexes for querying
        auditStore.createIndex("request_id", "request_id", { unique: false });
        auditStore.createIndex("timestamp", "timestamp", { unique: false });
        auditStore.createIndex("action", "action", { unique: false });
      }
    };
  });
};

// ============================================
// FEATURE REQUEST CRUD OPERATIONS
// ============================================

/**
 * Generate a unique feature request ID
 * Format: FEAT-XXXXXXXX (8 random alphanumeric chars)
 * @returns {string}
 */
export const generateFeatureId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "FEAT-";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

/**
 * Save a new feature request to storage
 * @param {Object} requestData - The feature request data
 * @returns {Promise<Object>} - The saved request with ID
 */
export const saveFeatureRequest = async (requestData) => {
  try {
    const database = await openDatabase();

    const request = {
      request_id: requestData.request_id || generateFeatureId(),
      title: requestData.title || "",
      description: requestData.description || "",
      category: requestData.category || "",
      module: requestData.module || "",
      priority: requestData.priority || "medium",
      problemSolved: requestData.problemSolved || "",
      proposedSolution: requestData.proposedSolution || "",
      alternativesConsidered: requestData.alternativesConsidered || "",
      additionalContext: requestData.additionalContext || "",
      systemInfo: requestData.systemInfo || {},
      status: "new", // new, under-review, planned, in-progress, completed, declined
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reviewed_at: null,
      review_notes: "",
    };

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [REQUESTS_STORE, AUDIT_STORE],
        "readwrite",
      );
      const requestsStore = transaction.objectStore(REQUESTS_STORE);
      const auditStore = transaction.objectStore(AUDIT_STORE);

      const addRequest = requestsStore.add(request);

      addRequest.onsuccess = () => {
        // Log the creation in audit
        auditStore.add({
          request_id: request.request_id,
          action: "CREATE",
          timestamp: new Date().toISOString(),
          accessor: "user",
        });

        console.log(
          `✅ Feature request ${request.request_id} saved successfully`,
        );
        resolve(request);
      };

      addRequest.onerror = () => {
        console.error("Failed to save feature request:", addRequest.error);
        reject(addRequest.error);
      };
    });
  } catch (error) {
    console.error("Error in saveFeatureRequest:", error);
    // Fallback to localStorage
    saveFeatureToLocalStorage(requestData);
    throw error;
  }
};

/**
 * Get a feature request by ID
 * @param {string} requestId - The request ID
 * @param {string} accessor - Who is accessing (for audit)
 * @returns {Promise<Object|null>}
 */
export const getFeatureRequest = async (requestId, accessor = "admin") => {
  try {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [REQUESTS_STORE, AUDIT_STORE],
        "readwrite",
      );
      const requestsStore = transaction.objectStore(REQUESTS_STORE);
      const auditStore = transaction.objectStore(AUDIT_STORE);

      const getRequest = requestsStore.get(requestId);

      getRequest.onsuccess = () => {
        if (getRequest.result) {
          // Log the access
          auditStore.add({
            request_id: requestId,
            action: "VIEW",
            timestamp: new Date().toISOString(),
            accessor,
          });
        }
        resolve(getRequest.result || null);
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  } catch (error) {
    console.error("Error getting feature request:", error);
    return null;
  }
};

/**
 * Get all feature requests with optional filters
 * @param {Object} options - Filter options
 * @returns {Promise<Array>}
 */
export const getAllFeatureRequests = async (options = {}) => {
  try {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(REQUESTS_STORE, "readonly");
      const store = transaction.objectStore(REQUESTS_STORE);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        let results = getAllRequest.result || [];

        // Apply filters
        if (options.status !== undefined && options.status !== null) {
          results = results.filter((r) => r.status === options.status);
        }

        if (options.priority) {
          results = results.filter((r) => r.priority === options.priority);
        }

        if (options.category) {
          results = results.filter((r) => r.category === options.category);
        }

        // Sort by created_at descending (newest first)
        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Apply limit
        if (options.limit) {
          results = results.slice(0, options.limit);
        }

        resolve(results);
      };

      getAllRequest.onerror = () => {
        reject(getAllRequest.error);
      };
    });
  } catch (error) {
    console.error("Error getting all feature requests:", error);
    return [];
  }
};

/**
 * Update a feature request status
 * @param {string} requestId - The request ID
 * @param {string} status - New status
 * @param {string} notes - Review notes
 * @param {string} accessor - Who is updating
 * @returns {Promise<Object>}
 */
export const updateFeatureRequestStatus = async (
  requestId,
  status,
  notes = "",
  accessor = "admin",
) => {
  try {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [REQUESTS_STORE, AUDIT_STORE],
        "readwrite",
      );
      const requestsStore = transaction.objectStore(REQUESTS_STORE);
      const auditStore = transaction.objectStore(AUDIT_STORE);

      const getRequest = requestsStore.get(requestId);

      getRequest.onsuccess = () => {
        if (!getRequest.result) {
          reject(new Error("Request not found"));
          return;
        }

        const updated = {
          ...getRequest.result,
          status,
          review_notes: notes,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const putRequest = requestsStore.put(updated);

        putRequest.onsuccess = () => {
          // Log the update
          auditStore.add({
            request_id: requestId,
            action: "STATUS_UPDATE",
            timestamp: new Date().toISOString(),
            accessor,
            details: `Status changed to: ${status}`,
          });

          resolve(updated);
        };

        putRequest.onerror = () => {
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  } catch (error) {
    console.error("Error updating feature request:", error);
    throw error;
  }
};

/**
 * Delete a feature request
 * @param {string} requestId - The request ID
 * @param {string} accessor - Who is deleting
 * @returns {Promise<boolean>}
 */
export const deleteFeatureRequest = async (requestId, accessor = "admin") => {
  try {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [REQUESTS_STORE, AUDIT_STORE],
        "readwrite",
      );
      const requestsStore = transaction.objectStore(REQUESTS_STORE);
      const auditStore = transaction.objectStore(AUDIT_STORE);

      const deleteRequest = requestsStore.delete(requestId);

      deleteRequest.onsuccess = () => {
        // Log the deletion
        auditStore.add({
          request_id: requestId,
          action: "DELETE",
          timestamp: new Date().toISOString(),
          accessor,
        });

        resolve(true);
      };

      deleteRequest.onerror = () => {
        reject(deleteRequest.error);
      };
    });
  } catch (error) {
    console.error("Error deleting feature request:", error);
    return false;
  }
};

/**
 * Search feature requests by text
 * @param {string} query - Search query
 * @returns {Promise<Array>}
 */
export const searchFeatureRequests = async (query) => {
  const allRequests = await getAllFeatureRequests();
  const lowerQuery = query.toLowerCase();

  return allRequests.filter(
    (request) =>
      request.title?.toLowerCase().includes(lowerQuery) ||
      request.description?.toLowerCase().includes(lowerQuery) ||
      request.request_id?.toLowerCase().includes(lowerQuery) ||
      request.category?.toLowerCase().includes(lowerQuery),
  );
};

/**
 * Get feature request statistics
 * @returns {Promise<Object>}
 */
export const getFeatureStatistics = async () => {
  const allRequests = await getAllFeatureRequests();

  const stats = {
    total: allRequests.length,
    byStatus: {
      new: 0,
      "under-review": 0,
      planned: 0,
      "in-progress": 0,
      completed: 0,
      declined: 0,
    },
    byPriority: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    byCategory: {},
    recentRequests: allRequests.slice(0, 5),
  };

  allRequests.forEach((request) => {
    // Count by status
    if (stats.byStatus.hasOwnProperty(request.status)) {
      stats.byStatus[request.status]++;
    }

    // Count by priority
    if (stats.byPriority.hasOwnProperty(request.priority)) {
      stats.byPriority[request.priority]++;
    }

    // Count by category
    if (request.category) {
      stats.byCategory[request.category] =
        (stats.byCategory[request.category] || 0) + 1;
    }
  });

  return stats;
};

/**
 * Get audit log for a feature request
 * @param {string} requestId - The request ID (optional, returns all if not provided)
 * @returns {Promise<Array>}
 */
export const getFeatureAuditLog = async (requestId = null) => {
  try {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(AUDIT_STORE, "readonly");
      const store = transaction.objectStore(AUDIT_STORE);

      let request;
      if (requestId) {
        const index = store.index("request_id");
        request = index.getAll(requestId);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        const results = request.result || [];
        // Sort by timestamp descending
        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        resolve(results);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("Error getting audit log:", error);
    return [];
  }
};

/**
 * Export all feature requests as JSON
 * @returns {Promise<Object>}
 */
export const exportFeatureRequests = async () => {
  const requests = await getAllFeatureRequests();
  const auditLog = await getFeatureAuditLog();
  const stats = await getFeatureStatistics();

  return {
    exported_at: new Date().toISOString(),
    version: "1.0",
    statistics: stats,
    requests,
    auditLog,
  };
};

// ============================================
// LOCALSTORAGE FALLBACK
// ============================================

const LOCALSTORAGE_KEY = "vetrate_feature_requests_backup";

/**
 * Save to localStorage as fallback
 * @param {Object} requestData - The request data
 */
export const saveFeatureToLocalStorage = (requestData) => {
  try {
    const existing = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || "[]");
    existing.push({
      ...requestData,
      created_at: requestData.created_at || new Date().toISOString(),
    });
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(existing));
    console.log("Feature request saved to localStorage fallback");
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
};

/**
 * Get feature requests from localStorage fallback
 * @returns {Array}
 */
export const getFeatureFromLocalStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || "[]");
  } catch (error) {
    console.error("Failed to read from localStorage:", error);
    return [];
  }
};

/**
 * Check if IndexedDB is available
 * @returns {boolean}
 */
export const isStorageAvailable = () => {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
};
