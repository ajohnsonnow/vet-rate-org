/**
 * Vet-Rate.org - My Packet Document Manager
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * DIAMOND STANDARD: Persistent document storage for all veteran documents.
 * Think of "My Packet" like a digital filing cabinet. Every document the
 * veteran uploads gets stored here with:
 *   - The raw OCR text (so any AI tool can re-read it later)
 *   - The structured extracted data (so forms auto-fill instantly)
 *   - Document metadata (filename, upload date, page count, type)
 *   - Classification (DD214, Claim Letter, C-File, Blue Button, etc.)
 *
 * Storage: IndexedDB (unlimited capacity, persists across sessions)
 * Fallback: localStorage (5-10MB limit, for older browsers)
 *
 * All data stays 100% on the veteran's device — never sent to servers.
 */

import { markAsModified } from "./persistentStorage";
import { ensureQuota } from "./storage";

// ============================================================
// DATABASE CONFIGURATION
// ============================================================

const PACKET_DB_NAME = "VetRateMyPacket";
const PACKET_DB_VERSION = 2; // Bump when schema changes
const PACKET_STORE_NAME = "documents";
const PACKET_INDEX_STORE = "document_index";
const PACKET_META_KEY = "vetrate_my_packet_meta";

let packetDB = null;

// ============================================================
// DATABASE INITIALIZATION
// ============================================================

/**
 * Open or create the My Packet IndexedDB database.
 * IndexedDB is like a mini database inside the browser —
 * it can store megabytes of data without any server.
 */
const openPacketDB = () => {
  return new Promise((resolve, reject) => {
    if (packetDB) {
      resolve(packetDB);
      return;
    }

    const request = indexedDB.open(PACKET_DB_NAME, PACKET_DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open My Packet database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      packetDB = request.result;
      resolve(packetDB);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Main documents store
      if (!db.objectStoreNames.contains(PACKET_STORE_NAME)) {
        const store = db.createObjectStore(PACKET_STORE_NAME, {
          keyPath: "id",
        });
        store.createIndex("classification", "classification", {
          unique: false,
        });
        store.createIndex("uploadDate", "uploadDate", { unique: false });
        store.createIndex("fileName", "fileName", { unique: false });
      }

      // Lightweight index store (for fast lookups without loading full text)
      if (!db.objectStoreNames.contains(PACKET_INDEX_STORE)) {
        const indexStore = db.createObjectStore(PACKET_INDEX_STORE, {
          keyPath: "id",
        });
        indexStore.createIndex("classification", "classification", {
          unique: false,
        });
      }
    };
  });
};

// ============================================================
// DOCUMENT CLASSIFICATION CONSTANTS
// ============================================================

export const PACKET_DOC_TYPES = {
  DD214: "DD214",
  DD215: "DD215",
  NGB22: "NGB22",
  DD256: "DD256",
  DD257: "DD257",
  RATING_DECISION: "RATING_DECISION",
  CLAIM_LETTER: "CLAIM_LETTER",
  C_FILE: "C_FILE",
  BLUE_BUTTON: "BLUE_BUTTON",
  MEDICAL_RECORD: "MEDICAL_RECORD",
  DBQ: "DBQ",
  NEXUS_LETTER: "NEXUS_LETTER",
  PERSONAL_STATEMENT: "PERSONAL_STATEMENT",
  BUDDY_STATEMENT: "BUDDY_STATEMENT",
  VA_CORRESPONDENCE: "VA_CORRESPONDENCE",
  EXAM_REPORT: "EXAM_REPORT",
  OTHER: "OTHER",
};

export const PACKET_DOC_LABELS = {
  [PACKET_DOC_TYPES.DD214]: "DD-214 (Service Record)",
  [PACKET_DOC_TYPES.DD215]: "DD-215 (Correction to DD-214)",
  [PACKET_DOC_TYPES.NGB22]: "NGB-22 (Guard Service Record)",
  [PACKET_DOC_TYPES.DD256]: "DD-256 (Reserve Discharge)",
  [PACKET_DOC_TYPES.DD257]: "DD-257 (Reserve General Discharge)",
  [PACKET_DOC_TYPES.RATING_DECISION]: "VA Rating Decision",
  [PACKET_DOC_TYPES.CLAIM_LETTER]: "VA Claim Letter",
  [PACKET_DOC_TYPES.C_FILE]: "C-File (Claims File)",
  [PACKET_DOC_TYPES.BLUE_BUTTON]: "VA Blue Button Report",
  [PACKET_DOC_TYPES.MEDICAL_RECORD]: "Medical Record",
  [PACKET_DOC_TYPES.DBQ]: "DBQ (Disability Benefits Questionnaire)",
  [PACKET_DOC_TYPES.NEXUS_LETTER]: "Nexus Letter",
  [PACKET_DOC_TYPES.PERSONAL_STATEMENT]: "Personal Statement",
  [PACKET_DOC_TYPES.BUDDY_STATEMENT]: "Buddy Statement",
  [PACKET_DOC_TYPES.VA_CORRESPONDENCE]: "VA Correspondence",
  [PACKET_DOC_TYPES.EXAM_REPORT]: "C&P Exam Report",
  [PACKET_DOC_TYPES.OTHER]: "Other Document",
};

export const PACKET_DOC_ICONS = {
  [PACKET_DOC_TYPES.DD214]: "🎖️",
  [PACKET_DOC_TYPES.DD215]: "📝",
  [PACKET_DOC_TYPES.NGB22]: "🏛️",
  [PACKET_DOC_TYPES.DD256]: "📜",
  [PACKET_DOC_TYPES.DD257]: "📜",
  [PACKET_DOC_TYPES.RATING_DECISION]: "⚖️",
  [PACKET_DOC_TYPES.CLAIM_LETTER]: "📬",
  [PACKET_DOC_TYPES.C_FILE]: "📋",
  [PACKET_DOC_TYPES.BLUE_BUTTON]: "💊",
  [PACKET_DOC_TYPES.MEDICAL_RECORD]: "🏥",
  [PACKET_DOC_TYPES.DBQ]: "📊",
  [PACKET_DOC_TYPES.NEXUS_LETTER]: "🔗",
  [PACKET_DOC_TYPES.PERSONAL_STATEMENT]: "✍️",
  [PACKET_DOC_TYPES.BUDDY_STATEMENT]: "🤝",
  [PACKET_DOC_TYPES.VA_CORRESPONDENCE]: "📮",
  [PACKET_DOC_TYPES.EXAM_REPORT]: "🩺",
  [PACKET_DOC_TYPES.OTHER]: "📄",
};

// ============================================================
// CORE CRUD OPERATIONS
// ============================================================

/**
 * FIX-6 (packet store): find an existing packet document that represents
 * the same underlying file as an incoming save, so re-importing an
 * unchanged file updates that record in place instead of appending a
 * duplicate. Same (fileName, fileSize) pairing as addDocumentToVKB's
 * idempotency guard in veteranKnowledgeBase.js. Pure function — no
 * IndexedDB — so it's directly unit-testable.
 */
export const findDuplicatePacketDocument = (
  existingDocs,
  fileName,
  fileSize,
) => {
  if (!Array.isArray(existingDocs)) return null;
  return (
    existingDocs.find(
      (doc) =>
        doc.fileName === fileName && (doc.metadata?.fileSize || 0) === fileSize,
    ) || null
  );
};

/**
 * Save a document to My Packet.
 * This is the main function — call it whenever a document is processed.
 *
 * @param {Object} doc - Document to save
 * @param {string} doc.fileName - Original filename
 * @param {string} doc.classification - One of PACKET_DOC_TYPES
 * @param {string} doc.rawText - Full OCR/extracted text
 * @param {Object} doc.extractedData - Structured data extracted from the document
 * @param {number} doc.pageCount - Number of pages
 * @param {number} doc.fileSize - File size in bytes
 * @param {string} doc.ocrMethod - How text was extracted (standard, advanced_ocr, etc.)
 * @param {number} doc.ocrConfidence - OCR confidence percentage
 * @param {Object} doc.aiAnalysis - AI analysis results (if available)
 * @returns {Promise<{success: boolean, documentId: string}>}
 */
// Pure object-literal builder split out of saveDocumentToPacket purely to
// keep that function's cyclomatic complexity under the repo's lint ceiling
// — every branch here is just a field default, no new behavior.
function _buildPacketDocumentRecord({
  doc,
  id,
  duplicate,
  sanitizedFileName,
  incomingFileSize,
}) {
  return {
    id,
    fileName: sanitizedFileName,
    classification: doc.classification || PACKET_DOC_TYPES.OTHER,
    uploadDate: duplicate ? duplicate.uploadDate : new Date().toISOString(),
    lastUpdated: new Date().toISOString(),

    // The raw text — this is what AI tools can re-read at any time
    rawText: doc.rawText || "",

    // Structured extracted data — differs by document type
    extractedData: doc.extractedData || {},

    // AI analysis results
    aiAnalysis: doc.aiAnalysis || null,

    // Document metadata
    metadata: {
      pageCount: doc.pageCount || 1,
      fileSize: incomingFileSize,
      ocrMethod: doc.ocrMethod || "unknown",
      ocrConfidence: doc.ocrConfidence || 0,
      fileType: doc.fileType || "pdf",
      processingTime: doc.processingTime || 0,
    },

    // Version tracking (for re-processing the same document)
    version: duplicate ? (duplicate.version || 1) + 1 : 1,
    supersedes: null, // ID of previous version if re-processed

    // Tags for organization
    tags: doc.tags || [],
    notes: sanitize(doc.notes || "", 5000),
  };
}

export const saveDocumentToPacket = async (doc) => {
  try {
    const db = await openPacketDB();
    const sanitizedFileName = sanitize(doc.fileName || "Unknown Document", 500);
    const incomingFileSize = doc.fileSize || 0;

    const existingDocs = await getAllPacketDocuments();
    const duplicate = findDuplicatePacketDocument(
      existingDocs,
      sanitizedFileName,
      incomingFileSize,
    );

    const id = duplicate
      ? duplicate.id
      : `pkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const document = _buildPacketDocumentRecord({
      doc,
      id,
      duplicate,
      sanitizedFileName,
      incomingFileSize,
    });

    // Pre-flight quota check — still attempt the write either way, but
    // attach a warning the caller can surface to the veteran
    const quota = await ensureQuota(JSON.stringify(document).length);

    // Save the full document to IndexedDB. put() with the same id
    // (re-used from the duplicate above) replaces the existing row instead
    // of adding a new one.
    await new Promise((resolve, reject) => {
      const tx = db.transaction(
        [PACKET_STORE_NAME, PACKET_INDEX_STORE],
        "readwrite",
      );

      // Save full document
      tx.objectStore(PACKET_STORE_NAME).put(document);

      // Save lightweight index entry (no rawText, for fast listing)
      tx.objectStore(PACKET_INDEX_STORE).put({
        id,
        fileName: document.fileName,
        classification: document.classification,
        uploadDate: document.uploadDate,
        lastUpdated: document.lastUpdated,
        pageCount: document.metadata.pageCount,
        fileSize: document.metadata.fileSize,
        ocrConfidence: document.metadata.ocrConfidence,
        hasExtractedData: Object.keys(document.extractedData).length > 0,
        hasAIAnalysis: !!document.aiAnalysis,
        tags: document.tags,
        version: document.version,
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Update localStorage metadata cache
    await updatePacketMetadata();
    markAsModified();

    // eslint-disable-next-line no-console
    console.log(`📁 Saved to My Packet: ${document.fileName} (${id})`);
    const result = { success: true, documentId: id };
    if (!quota.ok) result.quotaWarning = quota.message;
    return result;
  } catch (error) {
    console.error("Failed to save document to My Packet:", error);
    if (error?.name === "QuotaExceededError") {
      return {
        success: false,
        quotaExceeded: true,
        error:
          "Your device storage is full, so this document could not be saved. Export a backup and free up space, then try again.",
      };
    }
    return { success: false, error: error.message };
  }
};

/**
 * Get a single document by ID (full document with raw text)
 */
export const getPacketDocument = async (documentId) => {
  try {
    const db = await openPacketDB();
    return new Promise((resolve) => {
      const tx = db.transaction([PACKET_STORE_NAME], "readonly");
      const request = tx.objectStore(PACKET_STORE_NAME).get(documentId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error("Failed to get packet document:", error);
    return null;
  }
};

/**
 * Get all document index entries (lightweight — no raw text)
 * Use this for listing documents in the UI
 */
export const getPacketIndex = async () => {
  try {
    const db = await openPacketDB();
    return new Promise((resolve) => {
      const tx = db.transaction([PACKET_INDEX_STORE], "readonly");
      const request = tx.objectStore(PACKET_INDEX_STORE).getAll();
      request.onsuccess = () => {
        const results = request.result || [];
        // Sort by upload date, newest first
        results.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        resolve(results);
      };
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.error("Failed to get packet index:", error);
    return [];
  }
};

/**
 * Get all documents of a specific type
 */
export const getPacketDocumentsByType = async (classification) => {
  try {
    const db = await openPacketDB();
    return new Promise((resolve) => {
      const tx = db.transaction([PACKET_INDEX_STORE], "readonly");
      const index = tx.objectStore(PACKET_INDEX_STORE).index("classification");
      const request = index.getAll(classification);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.error("Failed to get documents by type:", error);
    return [];
  }
};

/**
 * Get ALL full documents (with raw text) — use carefully, can be large
 */
export const getAllPacketDocuments = async () => {
  try {
    const db = await openPacketDB();
    return new Promise((resolve) => {
      const tx = db.transaction([PACKET_STORE_NAME], "readonly");
      const request = tx.objectStore(PACKET_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.error("Failed to get all packet documents:", error);
    return [];
  }
};

/**
 * Update a document (e.g., after re-processing or adding AI analysis)
 */
export const updatePacketDocument = async (documentId, updates) => {
  try {
    const existing = await getPacketDocument(documentId);
    if (!existing) return { success: false, error: "Document not found" };

    const updated = {
      ...existing,
      ...updates,
      id: documentId, // Ensure ID doesn't change
      lastUpdated: new Date().toISOString(),
      version: (existing.version || 1) + 1,
    };

    const db = await openPacketDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(
        [PACKET_STORE_NAME, PACKET_INDEX_STORE],
        "readwrite",
      );
      tx.objectStore(PACKET_STORE_NAME).put(updated);

      // Update index too
      tx.objectStore(PACKET_INDEX_STORE).put({
        id: updated.id,
        fileName: updated.fileName,
        classification: updated.classification,
        uploadDate: updated.uploadDate,
        lastUpdated: updated.lastUpdated,
        pageCount: updated.metadata?.pageCount || 1,
        fileSize: updated.metadata?.fileSize || 0,
        ocrConfidence: updated.metadata?.ocrConfidence || 0,
        hasExtractedData: Object.keys(updated.extractedData || {}).length > 0,
        hasAIAnalysis: !!updated.aiAnalysis,
        tags: updated.tags || [],
        version: updated.version,
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await updatePacketMetadata();
    markAsModified();
    return { success: true };
  } catch (error) {
    console.error("Failed to update packet document:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a document from My Packet
 */
export const deletePacketDocument = async (documentId) => {
  try {
    const db = await openPacketDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(
        [PACKET_STORE_NAME, PACKET_INDEX_STORE],
        "readwrite",
      );
      tx.objectStore(PACKET_STORE_NAME).delete(documentId);
      tx.objectStore(PACKET_INDEX_STORE).delete(documentId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await updatePacketMetadata();
    markAsModified();
    return { success: true };
  } catch (error) {
    console.error("Failed to delete packet document:", error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// SEARCH & QUERY
// ============================================================

/**
 * Search all documents in My Packet by text content.
 * This searches the raw OCR text — useful for finding specific
 * phrases, dates, or conditions mentioned anywhere in the veteran's records.
 *
 * @param {string} query - Text to search for
 * @param {Object} options - Search options
 * @param {string} options.classification - Filter by doc type
 * @param {boolean} options.caseSensitive - Case-sensitive search
 * @returns {Promise<Array>} Matching documents with highlighted snippets
 */
export const searchPacketDocuments = async (query, options = {}) => {
  if (!query || query.length < 2) return [];

  try {
    const allDocs = await getAllPacketDocuments();
    const searchText = options.caseSensitive ? query : query.toLowerCase();
    const results = [];

    for (const doc of allDocs) {
      // Filter by classification if specified
      if (
        options.classification &&
        doc.classification !== options.classification
      )
        continue;

      const rawText = options.caseSensitive
        ? doc.rawText
        : (doc.rawText || "").toLowerCase();
      const matchIndex = rawText.indexOf(searchText);

      if (matchIndex !== -1) {
        // Extract a snippet around the match
        const start = Math.max(0, matchIndex - 100);
        const end = Math.min(rawText.length, matchIndex + query.length + 100);
        const snippet = (doc.rawText || "").substring(start, end);

        results.push({
          id: doc.id,
          fileName: doc.fileName,
          classification: doc.classification,
          uploadDate: doc.uploadDate,
          snippet: `...${snippet}...`,
          matchPosition: matchIndex,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to search packet documents:", error);
    return [];
  }
};

/**
 * Get the raw text for a specific document — used by AI tools
 * that need to re-read a document for analysis.
 */
export const getDocumentRawText = async (documentId) => {
  const doc = await getPacketDocument(documentId);
  return doc?.rawText || "";
};

/**
 * Get the extracted structured data for a document
 */
export const getDocumentExtractedData = async (documentId) => {
  const doc = await getPacketDocument(documentId);
  return doc?.extractedData || {};
};

/**
 * Get ALL raw text concatenated for use in AI prompts.
 * This gives AI tools complete context about the veteran.
 *
 * @param {Object} options - Options
 * @param {string|string[]} options.types - Filter by document type(s)
 * @param {number} options.maxChars - Maximum total characters
 * @returns {Promise<string>} Concatenated text from all documents
 */
export const getAllDocumentText = async (options = {}) => {
  try {
    const allDocs = await getAllPacketDocuments();
    let filteredDocs = allDocs;

    // Filter by type if specified
    if (options.types) {
      const typeArray = Array.isArray(options.types)
        ? options.types
        : [options.types];
      filteredDocs = allDocs.filter((d) =>
        typeArray.includes(d.classification),
      );
    }

    // Sort by upload date (oldest first for chronological context)
    filteredDocs.sort(
      (a, b) => new Date(a.uploadDate) - new Date(b.uploadDate),
    );

    let combinedText = "";
    for (const doc of filteredDocs) {
      const label = PACKET_DOC_LABELS[doc.classification] || doc.classification;
      const header = `\n=== ${label}: ${doc.fileName} (${doc.uploadDate.split("T")[0]}) ===\n`;
      combinedText += header + (doc.rawText || "") + "\n\n";

      // Check size limit
      if (options.maxChars && combinedText.length > options.maxChars) {
        combinedText = combinedText.substring(0, options.maxChars);
        combinedText +=
          "\n\n[... DOCUMENT TEXT TRUNCATED FOR AI PROCESSING ...]\n";
        break;
      }
    }

    return combinedText;
  } catch (error) {
    console.error("Failed to get all document text:", error);
    return "";
  }
};

/**
 * Get ALL extracted structured data for use by AI tools.
 * Returns a combined object with data organized by document type.
 */
export const getAllExtractedData = async () => {
  try {
    const allDocs = await getAllPacketDocuments();
    const data = {
      dd214s: [],
      claimLetters: [],
      ratingDecisions: [],
      medicalRecords: [],
      blueButton: [],
      cFiles: [],
      other: [],
    };

    for (const doc of allDocs) {
      const entry = {
        id: doc.id,
        fileName: doc.fileName,
        uploadDate: doc.uploadDate,
        extractedData: doc.extractedData || {},
        aiAnalysis: doc.aiAnalysis || null,
      };

      switch (doc.classification) {
        case PACKET_DOC_TYPES.DD214:
        case PACKET_DOC_TYPES.DD215:
        case PACKET_DOC_TYPES.NGB22:
        case PACKET_DOC_TYPES.DD256:
        case PACKET_DOC_TYPES.DD257:
          data.dd214s.push(entry);
          break;
        case PACKET_DOC_TYPES.CLAIM_LETTER:
          data.claimLetters.push(entry);
          break;
        case PACKET_DOC_TYPES.RATING_DECISION:
          data.ratingDecisions.push(entry);
          break;
        case PACKET_DOC_TYPES.MEDICAL_RECORD:
        case PACKET_DOC_TYPES.DBQ:
        case PACKET_DOC_TYPES.NEXUS_LETTER:
        case PACKET_DOC_TYPES.EXAM_REPORT:
          data.medicalRecords.push(entry);
          break;
        case PACKET_DOC_TYPES.BLUE_BUTTON:
          data.blueButton.push(entry);
          break;
        case PACKET_DOC_TYPES.C_FILE:
          data.cFiles.push(entry);
          break;
        default:
          data.other.push(entry);
      }
    }

    return data;
  } catch (error) {
    console.error("Failed to get all extracted data:", error);
    return {
      dd214s: [],
      claimLetters: [],
      ratingDecisions: [],
      medicalRecords: [],
      blueButton: [],
      cFiles: [],
      other: [],
    };
  }
};

// ============================================================
// METADATA & STATISTICS
// ============================================================

/**
 * Update the lightweight metadata cache in localStorage
 */
const updatePacketMetadata = async () => {
  try {
    const index = await getPacketIndex();
    const meta = {
      documentCount: index.length,
      byType: {},
      lastUpdated: new Date().toISOString(),
      totalSize: 0,
    };

    for (const doc of index) {
      meta.byType[doc.classification] =
        (meta.byType[doc.classification] || 0) + 1;
      meta.totalSize += doc.fileSize || 0;
    }

    localStorage.setItem(PACKET_META_KEY, JSON.stringify(meta));
  } catch (error) {
    console.error("Failed to update packet metadata:", error);
  }
};

/**
 * Get packet statistics (fast — uses cached metadata)
 */
export const getPacketStats = () => {
  try {
    const meta = localStorage.getItem(PACKET_META_KEY);
    if (meta) return JSON.parse(meta);
    return { documentCount: 0, byType: {}, lastUpdated: null, totalSize: 0 };
  } catch {
    return { documentCount: 0, byType: {}, lastUpdated: null, totalSize: 0 };
  }
};

/**
 * Check if packet has any documents
 */
export const hasPacketDocuments = () => {
  const stats = getPacketStats();
  return stats.documentCount > 0;
};

/**
 * Check if packet has a specific document type
 */
export const hasDocumentType = (classification) => {
  const stats = getPacketStats();
  return (stats.byType[classification] || 0) > 0;
};

// ============================================================
// EXPORT / IMPORT
// ============================================================

/**
 * Export all My Packet documents as a JSON file for backup
 */
export const exportPacket = async () => {
  try {
    const allDocs = await getAllPacketDocuments();
    const exportData = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      documentCount: allDocs.length,
      documents: allDocs,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vetrate-my-packet-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    return { success: true, documentCount: allDocs.length };
  } catch (error) {
    console.error("Failed to export packet:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Import documents from a packet backup file
 */
export const importPacket = async (jsonData, mode = "merge") => {
  try {
    const data = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
    if (!data.documents || !Array.isArray(data.documents)) {
      return { success: false, error: "Invalid packet backup file" };
    }

    let imported = 0;
    let skipped = 0;

    for (const doc of data.documents) {
      if (mode === "merge") {
        // Check if document already exists
        const existing = await getPacketDocument(doc.id);
        if (existing) {
          skipped++;
          continue;
        }
      }

      const db = await openPacketDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(
          [PACKET_STORE_NAME, PACKET_INDEX_STORE],
          "readwrite",
        );
        tx.objectStore(PACKET_STORE_NAME).put(doc);
        tx.objectStore(PACKET_INDEX_STORE).put({
          id: doc.id,
          fileName: doc.fileName,
          classification: doc.classification,
          uploadDate: doc.uploadDate,
          lastUpdated: doc.lastUpdated,
          pageCount: doc.metadata?.pageCount || 1,
          fileSize: doc.metadata?.fileSize || 0,
          ocrConfidence: doc.metadata?.ocrConfidence || 0,
          hasExtractedData: Object.keys(doc.extractedData || {}).length > 0,
          hasAIAnalysis: !!doc.aiAnalysis,
          tags: doc.tags || [],
          version: doc.version || 1,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      imported++;
    }

    await updatePacketMetadata();
    markAsModified();
    return { success: true, imported, skipped };
  } catch (error) {
    console.error("Failed to import packet:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Clear all documents from My Packet
 */
export const clearPacket = async () => {
  try {
    const db = await openPacketDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(
        [PACKET_STORE_NAME, PACKET_INDEX_STORE],
        "readwrite",
      );
      tx.objectStore(PACKET_STORE_NAME).clear();
      tx.objectStore(PACKET_INDEX_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    localStorage.removeItem(PACKET_META_KEY);
    markAsModified();
    return { success: true };
  } catch (error) {
    console.error("Failed to clear packet:", error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// GENERATE AI CONTEXT FROM PACKET
// ============================================================

/**
 * Generate a comprehensive AI context string from all packet documents.
 * This is what gets injected into AI prompts so the AI knows everything
 * about the veteran's case without re-reading documents.
 *
 * @param {Object} options - Options
 * @param {number} options.maxTokens - Approximate max tokens (chars/2)
 * @param {boolean} options.includeRawText - Include raw document text
 * @param {string[]} options.types - Filter to specific doc types
 * @returns {Promise<string>} AI-ready context string
 */
function _groupDocsByType(allDocs, types) {
  const grouped = {};
  for (const doc of allDocs) {
    if (types && !types.includes(doc.classification)) continue;
    if (!grouped[doc.classification]) grouped[doc.classification] = [];
    grouped[doc.classification].push(doc);
  }
  return grouped;
}

function _formatDeployment(d) {
  const place = d.location || d.operation || "";
  const dates = `${d.startDate || ""}-${d.endDate || ""}`;
  return `${place} ${dates}`;
}

function _formatServiceRecordDoc(doc, options) {
  const data = doc.extractedData || {};
  if (Object.keys(data).length === 0) {
    if (options.includeRawText && doc.rawText) {
      return `[Raw text from ${doc.fileName}]\n${doc.rawText.substring(0, 2000)}\n\n`;
    }
    return "";
  }

  let out = `File: ${doc.fileName}\n`;
  if (data.fullName) out += `  Name: ${data.fullName}\n`;
  if (data.branch) out += `  Branch: ${data.branch}\n`;
  if (data.component) out += `  Component: ${data.component}\n`;
  if (data.rank) out += `  Rank: ${data.rank} (${data.payGrade || ""})\n`;
  if (data.mos) out += `  MOS: ${data.mos} - ${data.mosTitle || ""}\n`;
  if (data.entryDate) out += `  Entry: ${data.entryDate}\n`;
  if (data.separationDate) out += `  Separation: ${data.separationDate}\n`;
  if (data.characterOfService)
    out += `  Character: ${data.characterOfService}\n`;
  if (data.awards?.length) {
    out += `  Awards: ${data.awards.map((a) => a.name || a).join("; ")}\n`;
  }
  if (data.combatService?.hasVerifiedCombat) {
    out += `  Combat: YES (${data.combatService.indicators?.join(", ") || "verified"})\n`;
  }
  if (data.deployments?.length) {
    out += `  Deployments: ${data.deployments.map(_formatDeployment).join("; ")}\n`;
  }
  if (data.specialQualifications?.length) {
    out += `  Qualifications: ${data.specialQualifications.join(", ")}\n`;
  }
  out += "\n";
  return out;
}

function _formatServiceRecordSection(grouped, options) {
  const serviceRecordTypes = [
    PACKET_DOC_TYPES.DD214,
    PACKET_DOC_TYPES.NGB22,
    PACKET_DOC_TYPES.DD256,
  ];

  let out = "";
  for (const type of serviceRecordTypes) {
    if (!grouped[type]) continue;
    out += `--- ${PACKET_DOC_LABELS[type]} ---\n`;
    for (const doc of grouped[type]) {
      out += _formatServiceRecordDoc(doc, options);
    }
    delete grouped[type];
  }
  return out;
}

// Structured C-File formatter — replaces the 500-char JSON blob for C-Files.
// The extractedData is the C-File analysis object (potential_claims, timeline,
// summary, exposures), so emit readable condition/evidence lines an AI tool can
// actually use. Conditions are AI SUGGESTIONS (not filed claims) — labelled so.
function _formatCFileDoc(doc) {
  const data = doc.extractedData || {};
  let out = `File: ${doc.fileName} (${(doc.uploadDate || "").split("T")[0]})\n`;
  if (data.summary) {
    out += `  Summary: ${String(data.summary).slice(0, 400)}\n`;
  }
  const claims = Array.isArray(data.potential_claims)
    ? data.potential_claims
    : [];
  if (claims.length > 0) {
    out += "  Identified conditions (AI suggestions, not yet filed):\n";
    claims.slice(0, 25).forEach((c) => {
      const name = c.condition || c.name || "Unknown";
      const dc = c.diagnosticCode ? ` [DC ${c.diagnosticCode}]` : "";
      out += `    • ${name}${dc}`;
      if (c.missing_element) out += ` — missing: ${c.missing_element}`;
      out += "\n";
    });
    if (claims.length > 25) {
      out += `    ... and ${claims.length - 25} more\n`;
    }
  }
  const exposures = Array.isArray(data.exposures) ? data.exposures : [];
  const exposureNames = exposures
    .map((e) => (typeof e === "string" ? e : e?.type))
    .filter(Boolean);
  if (exposureNames.length > 0) {
    out += `  Exposures: ${exposureNames.join(", ")}\n`;
  }
  out += "\n";
  return out;
}

function _formatCFileSection(grouped) {
  const cFiles = grouped[PACKET_DOC_TYPES.C_FILE];
  if (!cFiles || cFiles.length === 0) return "";
  let out = `--- ${PACKET_DOC_LABELS[PACKET_DOC_TYPES.C_FILE]} ---\n`;
  for (const doc of cFiles) {
    out += _formatCFileDoc(doc);
  }
  // Remove so it does NOT also fall through to the truncated JSON blob below.
  delete grouped[PACKET_DOC_TYPES.C_FILE];
  return out;
}

function _formatOtherDocsSection(grouped) {
  let out = "";
  for (const [type, docs] of Object.entries(grouped)) {
    const label = PACKET_DOC_LABELS[type] || type;
    out += `--- ${label} (${docs.length} document${docs.length > 1 ? "s" : ""}) ---\n`;
    for (const doc of docs) {
      out += `  ${doc.fileName} (${doc.uploadDate.split("T")[0]})\n`;
      if (doc.extractedData && Object.keys(doc.extractedData).length > 0) {
        const summary = JSON.stringify(doc.extractedData).substring(0, 500);
        out += `  Data: ${summary}\n`;
      }
    }
    out += "\n";
  }
  return out;
}

export const generatePacketContext = async (options = {}) => {
  try {
    const allDocs = await getAllPacketDocuments();
    if (allDocs.length === 0) return "";

    const maxChars = (options.maxTokens || 4000) * 2;
    let context = "=== MY PACKET: VETERAN DOCUMENT SUMMARY ===\n\n";
    context += `Documents on file: ${allDocs.length}\n\n`;

    const grouped = _groupDocsByType(allDocs, options.types);

    // DD214s first (most important for claims)
    context += _formatServiceRecordSection(grouped, options);

    // C-Files get a structured formatter (conditions + missing evidence +
    // summary) instead of the truncated JSON blob used for other types.
    context += _formatCFileSection(grouped);

    // Other document types
    context += _formatOtherDocsSection(grouped);

    // Trim to max size
    if (context.length > maxChars) {
      context = context.substring(0, maxChars) + "\n[... TRUNCATED ...]\n";
    }

    context += "=== END MY PACKET ===\n";
    return context;
  } catch (error) {
    console.error("Failed to generate packet context:", error);
    return "";
  }
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Simple string sanitizer
 */
function sanitize(str, maxLength = 500) {
  if (typeof str !== "string") return "";
  let s = str.slice(0, maxLength);
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  s = s.replace(/on\w+\s*=/gi, "");
  s = s.replace(/javascript:/gi, "");
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return s.trim();
}

export default {
  saveDocumentToPacket,
  findDuplicatePacketDocument,
  getPacketDocument,
  getPacketIndex,
  getPacketDocumentsByType,
  getAllPacketDocuments,
  updatePacketDocument,
  deletePacketDocument,
  searchPacketDocuments,
  getDocumentRawText,
  getDocumentExtractedData,
  getAllDocumentText,
  getAllExtractedData,
  getPacketStats,
  hasPacketDocuments,
  hasDocumentType,
  exportPacket,
  importPacket,
  clearPacket,
  generatePacketContext,
  PACKET_DOC_TYPES,
  PACKET_DOC_LABELS,
  PACKET_DOC_ICONS,
};
