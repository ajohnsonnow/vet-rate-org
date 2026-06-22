/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * DBQ Offline Storage Utility
 * Native IndexedDB-based storage for caching DBQ PDFs locally
 * Enables offline access to all Disability Benefits Questionnaires
 */

import { reconstructBlobUrl } from "./sanitize";

const DB_NAME = "vet-rate-dbq-cache";
const DB_VERSION = 1;
const STORE_PDF = "dbq-pdf";
const STORE_METADATA = "dbq-metadata";

// Initialize IndexedDB
let dbPromise = null;

/**
 * Get or initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function getDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store for PDF binary data
      if (!db.objectStoreNames.contains(STORE_PDF)) {
        db.createObjectStore(STORE_PDF, { keyPath: "id" });
      }
      // Store for metadata (last updated, download status, etc.)
      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        const metaStore = db.createObjectStore(STORE_METADATA, {
          keyPath: "id",
        });
        metaStore.createIndex("category", "category", { unique: false });
        metaStore.createIndex("downloadedAt", "downloadedAt", {
          unique: false,
        });
      }
    };
  });

  return dbPromise;
}

// Helper to promisify IDBRequest
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper to get a record from a store
async function dbGet(storeName, key) {
  const db = await getDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return promisifyRequest(store.get(key));
}

// Helper to put a record in a store
async function dbPut(storeName, value) {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  return promisifyRequest(store.put(value));
}

// Helper to delete a record from a store
async function dbDelete(storeName, key) {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  return promisifyRequest(store.delete(key));
}

// Helper to get all records from a store
async function dbGetAll(storeName) {
  const db = await getDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return promisifyRequest(store.getAll());
}

// Helper to get all keys from a store
// eslint-disable-next-line no-unused-vars
async function dbGetAllKeys(storeName) {
  const db = await getDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return promisifyRequest(store.getAllKeys());
}

// Helper to clear a store
async function dbClear(storeName) {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  return promisifyRequest(store.clear());
}

// ============================================================================
// PDF CACHING FUNCTIONS
// ============================================================================

/**
 * Check if a specific DBQ is cached offline
 * @param {string} formId - The DBQ form ID (e.g., "Knee-Lower-Leg")
 * @returns {Promise<boolean>}
 */
export async function isDbqCached(formId) {
  try {
    const pdf = await dbGet(STORE_PDF, formId);
    return !!pdf;
  } catch (error) {
    console.error("Error checking DBQ cache:", error);
    return false;
  }
}

/**
 * Get cached DBQ PDF from IndexedDB
 * @param {string} formId - The DBQ form ID
 * @returns {Promise<Blob|null>} PDF as Blob or null if not cached
 */
export async function getCachedDbq(formId) {
  try {
    const record = await dbGet(STORE_PDF, formId);
    if (record && record.pdfBlob) {
      return record.pdfBlob;
    }
    return null;
  } catch (error) {
    console.error("Error getting cached DBQ:", error);
    return null;
  }
}

/**
 * Cache a DBQ PDF to IndexedDB
 * @param {string} formId - The DBQ form ID
 * @param {Blob} pdfBlob - The PDF as a Blob
 * @param {object} metadata - Form metadata (title, category, etc.)
 * @returns {Promise<boolean>}
 */
export async function cacheDbq(formId, pdfBlob, metadata = {}) {
  try {
    const timestamp = new Date().toISOString();

    // Store the PDF
    await dbPut(STORE_PDF, {
      id: formId,
      pdfBlob,
      size: pdfBlob.size,
      cachedAt: timestamp,
    });

    // Store/update metadata
    await dbPut(STORE_METADATA, {
      id: formId,
      title: metadata.title || formId,
      category: metadata.category || "General",
      path: metadata.path || `/forms/${formId}.pdf`,
      downloadedAt: timestamp,
      size: pdfBlob.size,
      isCached: true,
    });

    return true;
  } catch (error) {
    console.error("Error caching DBQ:", error);
    return false;
  }
}

/**
 * Remove a specific DBQ from cache
 * @param {string} formId - The DBQ form ID
 * @returns {Promise<boolean>}
 */
export async function removeFromCache(formId) {
  try {
    await dbDelete(STORE_PDF, formId);

    // Update metadata to mark as not cached
    const meta = await dbGet(STORE_METADATA, formId);
    if (meta) {
      meta.isCached = false;
      meta.downloadedAt = null;
      await dbPut(STORE_METADATA, meta);
    }

    return true;
  } catch (error) {
    console.error("Error removing DBQ from cache:", error);
    return false;
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Get cache statistics
 * @returns {Promise<object>}
 */
export async function getCacheStats() {
  try {
    const allPdfItems = await dbGetAll(STORE_PDF);
    const allMeta = await dbGetAll(STORE_METADATA);

    const totalSize = allPdfItems.reduce(
      (sum, pdf) => sum + (pdf.size || 0),
      0,
    );
    const cachedCount = allPdfItems.length;

    return {
      cachedCount,
      totalCount: allMeta.length,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      lastUpdated:
        allPdfItems.length > 0
          ? Math.max(...allPdfItems.map((p) => new Date(p.cachedAt).getTime()))
          : null,
    };
  } catch (error) {
    console.error("Error getting cache stats:", error);
    return {
      cachedCount: 0,
      totalCount: 0,
      totalSizeBytes: 0,
      totalSizeMB: "0.00",
    };
  }
}

/**
 * Clear all cached DBQs
 * @returns {Promise<boolean>}
 */
export async function clearDbqCache() {
  try {
    await dbClear(STORE_PDF);

    // Update all metadata to mark as not cached
    const allMeta = await dbGetAll(STORE_METADATA);
    for (const meta of allMeta) {
      meta.isCached = false;
      meta.downloadedAt = null;
      await dbPut(STORE_METADATA, meta);
    }

    return true;
  } catch (error) {
    console.error("Error clearing DBQ cache:", error);
    return false;
  }
}

// ============================================================================
// DOWNLOAD FUNCTIONS
// ============================================================================

/**
 * Download and cache a DBQ PDF
 * @param {object} form - Form object with id, title, path, category
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function downloadAndCacheDbq(form, onProgress = null) {
  try {
    // First check if already cached
    const isCached = await isDbqCached(form.id);
    if (isCached) {
      if (onProgress) onProgress(100);
      return { success: true, alreadyCached: true };
    }

    if (onProgress) onProgress(10);

    // Fetch the PDF
    const response = await fetch(form.path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (onProgress) onProgress(50);

    const blob = await response.blob();

    if (onProgress) onProgress(80);

    // Cache it
    const cached = await cacheDbq(form.id, blob, {
      title: form.title,
      category: form.category,
      path: form.path,
    });

    if (onProgress) onProgress(100);

    return { success: cached };
  } catch (error) {
    console.error(`Error downloading DBQ ${form.id}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Download and cache ALL DBQs from the index
 * @param {function} onProgress - Progress callback { current, total, currentForm }
 * @param {AbortSignal} signal - Optional abort signal to cancel
 * @returns {Promise<{success: boolean, downloaded: number, failed: string[]}>}
 */
export async function downloadAllDbqs(onProgress = null, signal = null) {
  try {
    // Fetch the DBQ index
    const indexResponse = await fetch("/forms/dbq-index.json");
    if (!indexResponse.ok) {
      throw new Error("Could not load DBQ index");
    }
    const index = await indexResponse.json();
    const forms = index.forms || [];

    const results = {
      success: true,
      downloaded: 0,
      skipped: 0,
      failed: [],
    };

    for (let i = 0; i < forms.length; i++) {
      // Check for abort
      if (signal && signal.aborted) {
        results.success = false;
        break;
      }

      const form = forms[i];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: forms.length,
          currentForm: form.title,
          percent: Math.round(((i + 1) / forms.length) * 100),
        });
      }

      const result = await downloadAndCacheDbq(form);

      if (result.alreadyCached) {
        results.skipped++;
      } else if (result.success) {
        results.downloaded++;
      } else {
        results.failed.push(form.id);
      }

      // Small delay to prevent overwhelming the browser
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  } catch (error) {
    console.error("Error downloading all DBQs:", error);
    return { success: false, downloaded: 0, failed: [error.message] };
  }
}

// ============================================================================
// RETRIEVAL WITH FALLBACK
// ============================================================================

/**
 * Get a DBQ PDF - tries cache first, then network
 * @param {string} formId - The DBQ form ID
 * @param {string} fallbackPath - Path to fetch if not cached
 * @returns {Promise<{blob: Blob|null, fromCache: boolean}>}
 */
export async function getDbqWithFallback(formId, fallbackPath) {
  try {
    // Try cache first
    const cached = await getCachedDbq(formId);
    if (cached) {
      return { blob: cached, fromCache: true };
    }

    // Fallback to network
    if (fallbackPath) {
      const response = await fetch(fallbackPath);
      if (response.ok) {
        const blob = await response.blob();
        return { blob, fromCache: false };
      }
    }

    return { blob: null, fromCache: false };
  } catch (error) {
    console.error("Error getting DBQ:", error);
    return { blob: null, fromCache: false };
  }
}

/**
 * Open a DBQ in the browser (for viewing)
 * @param {string} formId - The DBQ form ID
 * @param {string} fallbackPath - Path to fetch if not cached
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function openDbqInBrowser(formId, fallbackPath) {
  try {
    const { blob, fromCache } = await getDbqWithFallback(formId, fallbackPath);

    if (!blob) {
      return { success: false, error: "Could not load DBQ" };
    }

    // URL.createObjectURL always returns a browser-internal blob: URL regardless of
    // blob content — it cannot produce an external or user-controlled redirect target.
    const objectUrl = URL.createObjectURL(blob);
    const safeObjectUrl = reconstructBlobUrl(objectUrl);
    if (!safeObjectUrl) {
      URL.revokeObjectURL(objectUrl);
      return { success: false, error: "Invalid URL generated" };
    }

    // Open in new tab via detached anchor click — avoids window.open/location.replace OR sinks
    const a = document.createElement("a");
    a.setAttribute("href", safeObjectUrl);
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
    a.dispatchEvent(
      new MouseEvent("click", {
        bubbles: false,
        cancelable: true,
        view: window,
      }),
    );

    // Cleanup after a delay (allow browser to load the blob)
    setTimeout(() => URL.revokeObjectURL(safeObjectUrl), 60000);

    return { success: true, url: objectUrl, fromCache };
  } catch (error) {
    console.error("Error opening DBQ:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// SERVICE WORKER INTEGRATION
// ============================================================================

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Export all cached DBQs as a zip file for backup
 * Requires JSZip to be loaded
 * @returns {Promise<Blob|null>}
 */
export async function exportCachedDbqsAsZip() {
  try {
    // Dynamically import JSZip
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const allPdfItems = await dbGetAll(STORE_PDF);
    const allMeta = await dbGetAll(STORE_METADATA);

    // Add PDFs to zip
    for (const pdf of allPdfItems) {
      zip.file(`${pdf.id}.pdf`, pdf.pdfBlob);
    }

    // Add index
    const index = {
      exportedAt: new Date().toISOString(),
      forms: allMeta.filter((m) => m.isCached),
    };
    zip.file("dbq-index.json", JSON.stringify(index, null, 2));

    // Generate zip
    const blob = await zip.generateAsync({ type: "blob" });
    return blob;
  } catch (error) {
    console.error("Error exporting DBQs as zip:", error);
    return null;
  }
}
