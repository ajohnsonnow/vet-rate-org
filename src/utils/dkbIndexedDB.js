/**
 * 💎 Diamond Knowledge Base IndexedDB Manager
 *
 * Handles caching of the web-optimized DKB (~8K entries) in IndexedDB for:
 * - Desktop: Auto-loads on first visit
 * - Mobile: Manual download button, cached forever after
 *
 * The 130K-entry "full" database (diamond_knowledge_full.json) is a Git LFS
 * pointer on Render — this module never fetches it. See
 * docs/adr/ADR-003-dkb-web-file-only.md for why.
 *
 * @file dkbIndexedDB.js
 */

import { logger } from "./logger";
import { MOBILE_MAX } from "./breakpoints";

const DB_NAME = "VetRate_DKB";
const DB_VERSION = 1;
const STORE_NAME = "knowledge_base";
const METADATA_KEY = "dkb_metadata";
const WEB_DKB_URL = "/data/diamond_knowledge.json";

// Size of the full (unfetchable, see file header) external knowledge corpus.
// Kept for UI display ("you have X of Y entries") and to recognize a
// genuine full cache an earlier build may have left in a returning user's
// IndexedDB - isFullDKBCached() below still honors that if it's there.
export const FULL_DATABASE_COUNT = 130508;
export const WEB_DATABASE_COUNT = 7988;

/**
 * Check if device is mobile
 */
export const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < MOBILE_MAX;
  const ua = navigator.userAgent.toLowerCase();
  const mobileKeywords = ["mobile", "android", "iphone", "ipad", "ipod"];
  const isMobileUA = mobileKeywords.some((keyword) => ua.includes(keyword));
  return hasTouch || isSmallScreen || isMobileUA;
};

/**
 * Open/create IndexedDB database
 */
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
};

/**
 * Get DKB metadata from IndexedDB
 */
export const getDKBMetadata = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(METADATA_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);

      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error("[DKB IndexedDB] Failed to get metadata:", err);
    return null;
  }
};

/**
 * Check if the DKB is already cached in IndexedDB, so callers can skip a
 * redundant re-download. Name predates the web-file-only fix (see file
 * header) - "full" here means "the dataset this module ever downloads",
 * not the 130K-entry corpus. A pre-existing genuine full cache from before
 * that fix (entryCount >= FULL_DATABASE_COUNT) still satisfies this too.
 */
export const isFullDKBCached = async () => {
  const metadata = await getDKBMetadata();
  return (metadata?.entryCount ?? 0) >= WEB_DATABASE_COUNT * 0.9;
};

/**
 * Get cached DKB entries count
 */
export const getCachedEntryCount = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(Math.max(0, request.result - 1)); // Subtract 1 for metadata

      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error("[DKB IndexedDB] Failed to get count:", err);
    return 0;
  }
};

/**
 * Download and cache the DKB
 *
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<{success: boolean, entryCount: number}>}
 */
async function _downloadDKBEntries(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch DKB: ${response.status}`);
  }

  onProgress(20);

  // Get total size for progress tracking
  const contentLength = response.headers.get("content-length");
  const totalSize = contentLength ? Number.parseInt(contentLength, 10) : 0;

  // Read response as stream for progress
  const reader = response.body.getReader();
  const chunks = [];
  let receivedLength = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    if (totalSize > 0) {
      const downloadProgress =
        20 + Math.round((receivedLength / totalSize) * 50);
      onProgress(downloadProgress);
    }
  }

  // Combine chunks and parse JSON
  const allChunks = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  onProgress(75);
  const data = JSON.parse(new TextDecoder().decode(allChunks));

  const entries = data.entries || data || [];
  logger.info(`[DKB] Parsed ${entries.length} entries from ${url}`);
  return entries;
}

async function _storeDKBEntries(entries, onProgress) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  // Clear existing data
  await new Promise((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onerror = () => reject(clearRequest.error);
    clearRequest.onsuccess = () => resolve();
  });

  onProgress(85);

  // Store each entry (batched for performance)
  const BATCH_SIZE = 1000;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    for (const entry of batch) {
      store.put({ id: entry.id, ...entry });
    }

    const storeProgress = 85 + Math.round((i / entries.length) * 10);
    onProgress(storeProgress);
  }

  // Store metadata
  store.put({
    id: METADATA_KEY,
    entryCount: entries.length,
    downloadedAt: new Date().toISOString(),
    version: "1.0.0",
  });

  await new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function _downloadFullDKBImpl(onProgress) {
  try {
    onProgress(5);
    logger.info("[DKB] Starting database download...");

    const entries = await _downloadDKBEntries(WEB_DKB_URL, onProgress);

    onProgress(80);

    await _storeDKBEntries(entries, onProgress);

    onProgress(100);
    // eslint-disable-next-line no-console
    console.log(`[DKB] ✅ Cached ${entries.length} entries in IndexedDB`);

    // Dispatch event for UI updates
    window.dispatchEvent(
      new CustomEvent("dkb-cache-updated", {
        detail: { entryCount: entries.length },
      }),
    );

    return { success: true, entryCount: entries.length };
  } catch (err) {
    console.error("[DKB IndexedDB] Download failed:", err);
    return { success: false, entryCount: 0, error: err.message };
  }
}

// Several components (e.g. KnowledgeBaseStatus's desktop auto-download and
// smartLoadDKB callers) can all decide to download the DKB on the same
// page load before the first call's IndexedDB write lands - observed as 8
// concurrent downloads+parses in one audit run. Single-flight: concurrent
// callers await the same in-progress download instead of each re-fetching
// and re-parsing it.
let inFlightDownload = null;

export const downloadFullDKB = (onProgress = () => {}) => {
  if (inFlightDownload) {
    return inFlightDownload;
  }

  inFlightDownload = _downloadFullDKBImpl(onProgress).finally(() => {
    inFlightDownload = null;
  });

  return inFlightDownload;
};

/**
 * Load DKB from IndexedDB cache
 *
 * @returns {Promise<Array>} Cached entries or empty array
 */
export const loadCachedDKB = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // Filter out metadata entry
        const entries = (request.result || []).filter(
          (e) => e.id !== METADATA_KEY,
        );
        resolve(entries);
      };

      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error("[DKB IndexedDB] Failed to load cache:", err);
    return [];
  }
};

/**
 * Clear DKB cache
 */
export const clearDKBCache = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);

      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error("[DKB IndexedDB] Failed to clear cache:", err);
    return false;
  }
};

/**
 * Get estimated cache size in MB
 */
export const getCacheSize = async () => {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    const { usage } = await navigator.storage.estimate();
    return Math.round((usage || 0) / (1024 * 1024));
  }
  return null;
};

/**
 * Get source counts from cached DKB
 *
 * @returns {Promise<Object>} Source counts object
 */
export const getCachedSourceCounts = async () => {
  try {
    const entries = await loadCachedDKB();
    const sourceCounts = {};

    entries.forEach((entry) => {
      const source = entry.metadata?.source || entry.source || "Unknown";
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    // eslint-disable-next-line no-console
    console.log("[DKB] Calculated source counts from cache:", sourceCounts);
    return sourceCounts;
  } catch (err) {
    console.error("[DKB] Failed to calculate source counts:", err);
    return {};
  }
};

/**
 * Smart DKB loader - auto-loads on desktop, waits for user action on mobile
 *
 * @param {function} onProgress - Progress callback
 * @returns {Promise<{entries: Array, source: string, count: number}>}
 */
export const smartLoadDKB = async (onProgress = () => {}) => {
  const isMobile = isMobileDevice();
  const isCached = await isFullDKBCached();

  // eslint-disable-next-line no-console
  console.log(`[DKB] Smart load: mobile=${isMobile}, cached=${isCached}`);

  // If already cached, load from cache
  if (isCached) {
    const entries = await loadCachedDKB();
    return { entries, source: "indexeddb", count: entries.length };
  }

  // Desktop: Auto-download and cache
  if (!isMobile) {
    // eslint-disable-next-line no-console
    console.log("[DKB] Desktop detected - downloading database...");
    const result = await downloadFullDKB(onProgress);
    if (result.success) {
      const entries = await loadCachedDKB();
      return { entries, source: "download-cached", count: entries.length };
    }
  }

  // Mobile (not cached): Load web-optimized version
  // eslint-disable-next-line no-console
  console.log("[DKB] Loading web-optimized database...");
  try {
    const response = await fetch(WEB_DKB_URL);
    const data = await response.json();
    const entries = data.entries || data || [];
    return { entries, source: "web-optimized", count: entries.length };
  } catch (err) {
    console.error("[DKB] Failed to load web-optimized:", err);
    return { entries: [], source: "error", count: 0 };
  }
};

export default {
  isMobileDevice,
  isFullDKBCached,
  getCachedEntryCount,
  getCachedSourceCounts,
  downloadFullDKB,
  loadCachedDKB,
  clearDKBCache,
  getCacheSize,
  smartLoadDKB,
  FULL_DATABASE_COUNT,
  WEB_DATABASE_COUNT,
};
