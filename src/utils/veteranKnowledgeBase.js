/**
 * Vet-Rate.org - Veteran Knowledge Base (VKB)
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The VKB is a structured, AI-queryable knowledge graph built from:
 * - DD-214 documents
 * - Blue Button medical records
 * - C-File claim documents
 * - Muster Call batch processing
 *
 * Purpose: Give LLMs complete context about a veteran's claim without
 * repeatedly parsing documents. One source of truth for all AI agents.
 *
 * Storage: Uses IndexedDB as primary storage (unlimited capacity)
 * with localStorage as metadata cache only.
 */

import { ensureQuota } from "./storage";
import { normalizeConditionName } from "./conditionName";
import { DOCUMENT_TYPES } from "./documentClassifier";

const VKB_STORAGE_KEY = "vetrate_knowledge_base";
const VKB_VERSION = "1.0.0";

let metadataCacheWarned = false;

const cacheVKBMetadata = (payload) => {
  try {
    localStorage.setItem(VKB_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // Cache is reconstructible from IndexedDB — log once, keep going
    if (!metadataCacheWarned) {
      metadataCacheWarned = true;
      console.warn(
        "VKB metadata cache write failed (data safe in IndexedDB):",
        err?.name || err,
      );
    }
  }
};

// IndexedDB Configuration
const VKB_DB_NAME = "VetRateVKB";
const VKB_DB_VERSION = 1;
const VKB_STORE_NAME = "knowledge_base";

let vkbDB = null;

/**
 * Open/Initialize the VKB IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
const openVKBDatabase = () => {
  return new Promise((resolve, reject) => {
    if (vkbDB) {
      resolve(vkbDB);
      return;
    }

    const request = indexedDB.open(VKB_DB_NAME, VKB_DB_VERSION);

    request.onerror = () => {
      console.error("❌ Failed to open VKB database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      vkbDB = request.result;
      // eslint-disable-next-line no-console
      console.log("✅ VKB IndexedDB opened successfully");
      resolve(vkbDB);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Create VKB store
      if (!database.objectStoreNames.contains(VKB_STORE_NAME)) {
        const vkbStore = database.createObjectStore(VKB_STORE_NAME, {
          keyPath: "id",
        });
        vkbStore.createIndex("lastUpdated", "metadata.lastUpdated", {
          unique: false,
        });
        // eslint-disable-next-line no-console
        console.log("✅ VKB object store created");
      }
    };
  });
};

/**
 * Veteran Knowledge Base Schema
 *
 * This structure is optimized for LLM consumption - clear hierarchy,
 * minimal nesting, timestamped entries, source attribution.
 */
export const VKB_SCHEMA = {
  metadata: {
    version: VKB_VERSION,
    lastUpdated: null, // ISO timestamp
    documentCount: 0,
    completeness: 0, // 0-100 score based on filled fields
  },

  personal: {
    fullName: null,
    dateOfBirth: null,
    ssn: null, // Last 4 only
    veteranFileNumber: null,
    email: null,
    phone: null,
    address: {
      street: null,
      city: null,
      state: null,
      zip: null,
    },
  },

  serviceHistory: {
    branch: null, // Army, Navy, Air Force, Marines, Coast Guard, Space Force
    entryDate: null,
    separationDate: null,
    yearsOfService: null,
    rank: {
      entry: null,
      discharge: null,
    },
    mos: [], // [{code, title, dates, hazards}]
    characterOfService: null, // Honorable, General, etc.
    deployments: [], // [{location, startDate, endDate, combatZone, operation}]
    awards: [], // [{name, date, isCombat, devices}]
    foreignService: false,
    reenlisted: false,
  },

  medicalConditions: {
    current: [], // [{name, diagnosisDate, icdCode, severity, ratedPercentage, serviceConnected}]
    past: [], // Historical conditions
    secondary: [], // [{condition, primaryCondition, relationship}]
    presumptive: [], // [{condition, exposureType, eligibleUnder}]
  },

  medications: {
    current: [], // [{name, dosage, frequency, startDate, prescribedFor}]
    past: [], // Historical meds
  },

  treatments: {
    procedures: [], // [{name, date, provider, outcome, relatedCondition}]
    therapies: [], // [{type, startDate, endDate, frequency, relatedCondition}]
    hospitalizations: [], // [{facility, admitDate, dischargeDate, reason, duration}]
  },

  medicalAppointments: {
    cAndPExams: [], // [{date, examiner, conditionsExamined, findings, dbqSubmitted}]
    vaAppointments: [], // [{date, facility, provider, reason, notes}]
    privateDoctor: [], // [{date, provider, specialty, reason, notes}]
  },

  vaClaimsHistory: {
    claims: [], // [{claimNumber, filedDate, status, decision, decisionDate, conditions}]
    ratings: [], // [{condition, percentage, effectiveDate, combinedRating}]
    appeals: [], // [{claimNumber, appealDate, status, boardDate, decision}]
  },

  exposures: {
    environmental: [], // [{type, location, dates, documentation}] - Agent Orange, burn pits, etc.
    occupational: [], // [{hazard, mos, dates, protectionUsed}]
    combat: [], // [{incident, date, location, injuries, documentation}]
  },

  evidenceTimeline: [], // [{date, eventType, description, source, significance}]

  keyFacts: [], // [{fact, source, documentId, pageNumber, extractedText, importance}]

  nexusStatements: [], // [{condition, statedBy, date, relationship, documentSource}]

  documentation: {
    dd214s: [], // [{id, fileName, uploadDate, pageCount, extracted}]
    blueButtonReports: [], // [{id, fileName, uploadDate, dateRange, recordCount}]
    cFiles: [], // [{id, fileName, uploadDate, pageCount, claimNumber}]
    privateRecords: [], // [{id, fileName, uploadDate, provider, dateRange}]
    otherEvidence: [], // [{id, fileName, uploadDate, category, description}]
  },

  aiInsights: {
    strengthsOfClaim: [], // [{condition, strength, reasons}]
    weaknesses: [], // [{condition, weakness, recommendations}]
    missingEvidence: [], // [{condition, evidenceType, howToObtain, priority}]
    suggestedSecondaries: [], // [{primaryCondition, secondaryCondition, likelihood, rationale}]
  },
};

/**
 * Initialize empty VKB
 */
export const initializeVKB = () => {
  const vkb = JSON.parse(JSON.stringify(VKB_SCHEMA));
  vkb.metadata.lastUpdated = new Date().toISOString();
  return vkb;
};

/**
 * Move a legacy off-schema `vkb.claims[]` entry into `medicalConditions.current`
 * unless a same-named condition is already there. Returns true if it inserted.
 */
function _migrateLegacyClaim(claim, current, existing) {
  const name = claim.condition || claim.conditionName || claim.name;
  const key = normalizeConditionName(name);
  if (!key || existing.has(key)) return false;
  existing.add(key);
  const rating = Number(
    claim.selectedRating ??
      claim.ratingPercent ??
      claim.rating ??
      claim.ratedPercentage,
  );
  const entry = {
    name,
    source: claim.source || "Migrated (legacy claim)",
    serviceConnected: claim.serviceConnected ?? false,
  };
  if (Number.isFinite(rating)) entry.ratedPercentage = rating;
  if (claim.diagnosticCode) entry.diagnosticCode = claim.diagnosticCode;
  current.push(entry);
  return true;
}

/**
 * Move a legacy off-schema `vkb.evidence[]` entry into `evidenceTimeline`
 * unless a same date+type+description event is already there.
 */
function _migrateLegacyEvidence(item, timeline, existing) {
  const timelineKey = (e) =>
    `${e.date || ""}|${(e.eventType || e.type || "").toLowerCase()}|${normalizeConditionName(e.description || e.text || "")}`;
  const key = timelineKey(item);
  if (existing.has(key)) return false;
  existing.add(key);
  timeline.push({
    date: item.date || "",
    eventType: item.eventType || item.type || "legacy_event",
    description: item.description || item.text || "",
    source: item.source || "Migrated (legacy evidence)",
    significance: item.significance || "",
  });
  return true;
}

/**
 * One-time, idempotent migration of legacy off-schema VKB fields into the
 * canonical schema, so readers repointed at the schema (getLoadableConditions,
 * the AI-context builders) see data written before the schema existed.
 *
 * - `vkb.claims[]`   → `medicalConditions.current[]` (dedup by normalized name)
 * - `vkb.evidence[]` → `evidenceTimeline[]`          (dedup by date+type+desc)
 *
 * The legacy arrays are LEFT IN PLACE so transition-release readers can
 * dual-read; a later release drops them. Guarded by
 * `metadata.migratedOffSchema` so it runs exactly once per VKB.
 *
 * Pure (no IndexedDB); the caller persists when `changed` is true.
 *
 * @returns {{ vkb: object, changed: boolean }}
 */
export const migrateOffSchemaVKB = (vkb) => {
  if (!vkb || typeof vkb !== "object") return { vkb, changed: false };
  vkb.metadata = vkb.metadata || {};
  if (vkb.metadata.migratedOffSchema) return { vkb, changed: false };

  let changed = false;

  if (Array.isArray(vkb.claims) && vkb.claims.length > 0) {
    vkb.medicalConditions = vkb.medicalConditions || {};
    vkb.medicalConditions.current = vkb.medicalConditions.current || [];
    const current = vkb.medicalConditions.current;
    const existing = new Set(
      current.map((c) => normalizeConditionName(c.name || c.condition)),
    );
    vkb.claims.forEach((claim) => {
      if (_migrateLegacyClaim(claim, current, existing)) changed = true;
    });
  }

  if (Array.isArray(vkb.evidence) && vkb.evidence.length > 0) {
    vkb.evidenceTimeline = vkb.evidenceTimeline || [];
    const timeline = vkb.evidenceTimeline;
    const existing = new Set(
      timeline.map(
        (e) =>
          `${e.date || ""}|${(e.eventType || e.type || "").toLowerCase()}|${normalizeConditionName(e.description || e.text || "")}`,
      ),
    );
    vkb.evidence.forEach((item) => {
      if (_migrateLegacyEvidence(item, timeline, existing)) changed = true;
    });
  }

  vkb.metadata.migratedOffSchema = true;
  return { vkb, changed };
};

/**
 * Apply the one-time off-schema migration to a freshly loaded VKB and persist
 * it. Returns the in-memory migrated VKB synchronously (via the async wrapper)
 * so readers never wait on a full VKB write; the persist runs in the background
 * and, being idempotent, is safe to re-run if a reload beats the write.
 */
async function _migrateAndPersist(vkb) {
  if (vkb?.metadata?.migratedOffSchema) return vkb;
  try {
    migrateOffSchemaVKB(vkb);
  } catch (err) {
    console.error("Off-schema VKB migration failed:", err);
    return vkb;
  }
  // Fire-and-forget: record the moved data + migratedOffSchema flag without
  // blocking the load. saveVKB catches its own errors, so this is defensive.
  saveVKB(vkb).catch((err) =>
    console.error("Off-schema VKB persist failed:", err),
  );
  return vkb;
}

/**
 * Load VKB from IndexedDB (primary) or localStorage (legacy fallback)
 */
export const loadVKB = async () => {
  try {
    // Try IndexedDB first
    const db = await openVKBDatabase();
    const transaction = db.transaction([VKB_STORE_NAME], "readonly");
    const store = transaction.objectStore(VKB_STORE_NAME);
    const request = store.get("main");

    return new Promise((resolve) => {
      request.onsuccess = () => {
        if (request.result) {
          // eslint-disable-next-line no-console
          console.log("📂 Loaded VKB from IndexedDB");
          // Cache metadata in localStorage for quick access
          cacheVKBMetadata({
            metadata: request.result.metadata,
            source: "indexeddb",
          });
          // One-time off-schema → canonical migration (persists in background).
          _migrateAndPersist(request.result).then(resolve);
        } else {
          // Try localStorage for legacy data
          // eslint-disable-next-line no-console
          console.log("📂 No IndexedDB VKB, checking localStorage...");
          try {
            const stored = localStorage.getItem(VKB_STORAGE_KEY);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed.overflow || parsed.source === "indexeddb") {
                // This is just metadata, initialize new VKB
                // eslint-disable-next-line no-console
                console.log("📂 Found metadata only, initializing fresh VKB");
                resolve(initializeVKB());
              } else {
                // Legacy full VKB, migrate to IndexedDB
                // eslint-disable-next-line no-console
                console.log(
                  "📂 Migrating legacy localStorage VKB to IndexedDB",
                );
                // Fold in the off-schema → canonical migration before the
                // single write that moves this VKB into IndexedDB.
                migrateOffSchemaVKB(parsed);
                saveVKB(parsed).then(() => resolve(parsed));
              }
            } else {
              resolve(initializeVKB());
            }
          } catch (err) {
            console.error("Error loading from localStorage:", err);
            resolve(initializeVKB());
          }
        }
      };

      request.onerror = () => {
        console.error("Error loading from IndexedDB:", request.error);
        // Fallback to localStorage
        try {
          const stored = localStorage.getItem(VKB_STORAGE_KEY);
          resolve(stored ? JSON.parse(stored) : initializeVKB());
        } catch (err) {
          console.error("Error parsing localStorage VKB fallback:", err);
          resolve(initializeVKB());
        }
      };
    });
  } catch (err) {
    console.error("Error opening VKB database:", err);
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(VKB_STORAGE_KEY);
      return stored ? JSON.parse(stored) : initializeVKB();
    } catch (lsErr) {
      console.error("Error parsing localStorage VKB fallback:", lsErr);
      return initializeVKB();
    }
  }
};

/**
 * Save VKB to IndexedDB (primary) with localStorage metadata cache
 */
export const saveVKB = async (vkb) => {
  try {
    vkb.metadata.lastUpdated = new Date().toISOString();
    vkb.metadata.completeness = calculateCompleteness(vkb);

    // Add ID for IndexedDB
    vkb.id = "main";

    // Calculate size
    const vkbString = JSON.stringify(vkb);
    const sizeInBytes = new Blob([vkbString]).size;
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

    // eslint-disable-next-line no-console
    console.log(
      `💾 Saving VKB to IndexedDB (${sizeInMB}MB, ${vkb.metadata.documentCount} documents)`,
    );

    // Pre-flight quota check — still attempt the write either way, but
    // attach a warning the caller can surface to the veteran
    const quota = await ensureQuota(sizeInBytes);

    // Save to IndexedDB (unlimited storage)
    const db = await openVKBDatabase();
    const transaction = db.transaction([VKB_STORE_NAME], "readwrite");
    const store = transaction.objectStore(VKB_STORE_NAME);
    const request = store.put(vkb);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        // eslint-disable-next-line no-console
        console.log(`✅ VKB saved to IndexedDB (${sizeInMB}MB)`);

        // Cache metadata in localStorage for quick access
        cacheVKBMetadata({
          metadata: vkb.metadata,
          source: "indexeddb",
          size: sizeInMB,
        });

        const result = { success: true, size: sizeInMB };
        if (!quota.ok) result.quotaWarning = quota.message;
        resolve(result);
      };

      request.onerror = () => {
        console.error("❌ Failed to save VKB to IndexedDB:", request.error);
        if (request.error?.name === "QuotaExceededError") {
          resolve({
            success: false,
            quotaExceeded: true,
            error:
              "Your device storage is full, so your records could not be saved. Export a backup and free up space, then try again.",
          });
        } else {
          resolve({ success: false, error: request.error.message });
        }
      };
    });
  } catch (err) {
    console.error("❌ Error saving VKB:", err);
    return { success: false, error: err.message };
  }
};

// Maps a document classification to its VKB documentation bucket. Covers two
// independent calling conventions that both feed categorizeDocument: the
// lowercase/snake_case labels hardcoded by DD214Analyzer/BlueButtonXRay's
// call sites, and the DOCUMENT_TYPES enum values (documentClassifier.js)
// that Muster Call passes via result.classification.type.
const DOCUMENT_CATEGORY_BY_CLASSIFICATION = {
  DD214: "dd214s",
  service_record: "dd214s",
  [DOCUMENT_TYPES.DD214]: "dd214s",
  [DOCUMENT_TYPES.DD215]: "dd214s",
  [DOCUMENT_TYPES.NGB22]: "dd214s",
  [DOCUMENT_TYPES.DD256]: "dd214s",
  [DOCUMENT_TYPES.DD257]: "dd214s",

  blue_button: "blueButtonReports",
  medical_record: "blueButtonReports",
  [DOCUMENT_TYPES.MEDICAL_RECORD]: "blueButtonReports",

  c_file: "cFiles",
  rating_decision: "cFiles",
  claim_letter: "cFiles",
  va_decision: "cFiles",
  [DOCUMENT_TYPES.RATING_DECISION]: "cFiles",
  [DOCUMENT_TYPES.CLAIM_LETTER]: "cFiles",
  [DOCUMENT_TYPES.C_FILE_MEDICAL]: "cFiles",
  [DOCUMENT_TYPES.VA_CORRESPONDENCE]: "cFiles",
  [DOCUMENT_TYPES.DBQ]: "cFiles",
  [DOCUMENT_TYPES.EXAM_REPORT]: "cFiles",

  private_medical: "privateRecords",
  provider_letter: "privateRecords",
  nexus_letter: "privateRecords",
  [DOCUMENT_TYPES.NEXUS_LETTER]: "privateRecords",
  [DOCUMENT_TYPES.PERSONAL_STATEMENT]: "privateRecords",
};

/**
 * Determine which VKB documentation category a document classification
 * belongs to.
 */
export function categorizeDocument(classification) {
  return DOCUMENT_CATEGORY_BY_CLASSIFICATION[classification] || "otherEvidence";
}

/**
 * Push a fully-built document entry into the correct VKB documentation
 * bucket based on its classification.
 */
function routeDocumentToVKB(vkb, classification, docEntry) {
  const category = categorizeDocument(classification);
  vkb.documentation[category].push(docEntry);
}

/**
 * Add a document to VKB with full metadata and version tracking
 * Keeps each document's data separate - NEVER overwrites existing documents
 */
export const addDocumentToVKB = async (documentInfo) => {
  const vkb = await loadVKB();

  // Determine document category
  const category = categorizeDocument(documentInfo.classification);

  // Calculate version number (count existing documents of this type + 1)
  const existingDocs = vkb.documentation[category] || [];
  const versionNumber = existingDocs.length + 1;

  // Mark all previous documents as NOT most recent
  existingDocs.forEach((doc) => {
    doc.mostRecent = false;
  });

  const docEntry = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fileName: documentInfo.fileName,
    uploadDate: new Date().toISOString(),
    fileSize: documentInfo.fileSize,
    pageCount: documentInfo.pageCount || 1,
    classification: documentInfo.classification || "unknown",
    extractedText: documentInfo.extractedText || "",
    extractedData: documentInfo.extractedData || {},
    ocrUsed: documentInfo.ocrUsed || false,
    method: documentInfo.method || "text",
    version: versionNumber,
    mostRecent: true,
    category: category,
  };

  // Route to appropriate documentation category
  routeDocumentToVKB(vkb, documentInfo.classification, docEntry);

  vkb.metadata.documentCount =
    vkb.documentation.dd214s.length +
    vkb.documentation.blueButtonReports.length +
    vkb.documentation.cFiles.length +
    vkb.documentation.privateRecords.length +
    vkb.documentation.otherEvidence.length;

  const saveResult = await saveVKB(vkb);

  return {
    success: saveResult.success,
    documentId: docEntry.id,
    vkb,
    size: saveResult.size,
    ...(saveResult.quotaWarning && { quotaWarning: saveResult.quotaWarning }),
    ...(saveResult.error && { error: saveResult.error }),
  };
};

/**
 * Get all documents from VKB
 */
export const getAllDocumentsFromVKB = async () => {
  const vkb = await loadVKB();
  return [
    ...vkb.documentation.dd214s,
    ...vkb.documentation.blueButtonReports,
    ...vkb.documentation.cFiles,
    ...vkb.documentation.privateRecords,
    ...vkb.documentation.otherEvidence,
  ];
};

/**
 * Get all documents grouped by category with metadata
 * Useful for timeline/overview displays
 */
export const getAllDocumentsByCategory = async () => {
  const vkb = await loadVKB();
  return {
    dd214s: {
      label: "DD-214 Service Records",
      icon: "🎖️",
      documents: vkb.documentation.dd214s.sort(
        (a, b) => (b.version || 0) - (a.version || 0),
      ),
      count: vkb.documentation.dd214s.length,
    },
    blueButtonReports: {
      label: "Blue Button Medical Records",
      icon: "🏥",
      documents: vkb.documentation.blueButtonReports.sort(
        (a, b) => (b.version || 0) - (a.version || 0),
      ),
      count: vkb.documentation.blueButtonReports.length,
    },
    cFiles: {
      label: "VA Claims & Decisions",
      icon: "📋",
      documents: vkb.documentation.cFiles.sort(
        (a, b) => (b.version || 0) - (a.version || 0),
      ),
      count: vkb.documentation.cFiles.length,
    },
    privateRecords: {
      label: "Private Medical Records",
      icon: "🩺",
      documents: vkb.documentation.privateRecords.sort(
        (a, b) => (b.version || 0) - (a.version || 0),
      ),
      count: vkb.documentation.privateRecords.length,
    },
    otherEvidence: {
      label: "Other Evidence",
      icon: "📄",
      documents: vkb.documentation.otherEvidence.sort(
        (a, b) => (b.version || 0) - (a.version || 0),
      ),
      count: vkb.documentation.otherEvidence.length,
    },
  };
};

/**
 * Get specific document by ID
 */
export const getDocumentFromVKB = async (documentId) => {
  const allDocs = await getAllDocumentsFromVKB();
  return allDocs.find((doc) => doc.id === documentId);
};

/**
 * Compare two document versions side-by-side
 * @param {string} docId1 - ID of first document
 * @param {string} docId2 - ID of second document
 * @returns {Promise<object>} Comparison object with differences highlighted
 */
export const compareDocumentVersions = async (docId1, docId2) => {
  const doc1 = await getDocumentFromVKB(docId1);
  const doc2 = await getDocumentFromVKB(docId2);

  if (!doc1 || !doc2) {
    return { error: "One or both documents not found" };
  }

  const differences = [];
  const allFields = new Set([
    ...Object.keys(doc1.extractedData || {}),
    ...Object.keys(doc2.extractedData || {}),
  ]);

  allFields.forEach((field) => {
    const val1 = doc1.extractedData[field];
    const val2 = doc2.extractedData[field];

    // Deep comparison
    const val1Str = JSON.stringify(val1);
    const val2Str = JSON.stringify(val2);

    if (val1Str !== val2Str) {
      differences.push({
        field,
        doc1Value: val1,
        doc2Value: val2,
        changed: val1 !== undefined && val2 !== undefined,
        addedInDoc2: val1 === undefined && val2 !== undefined,
        removedInDoc2: val1 !== undefined && val2 === undefined,
      });
    }
  });

  return {
    doc1: {
      id: doc1.id,
      fileName: doc1.fileName,
      uploadDate: doc1.uploadDate,
      version: doc1.version,
    },
    doc2: {
      id: doc2.id,
      fileName: doc2.fileName,
      uploadDate: doc2.uploadDate,
      version: doc2.version,
    },
    differences,
    differenceCount: differences.length,
    identical: differences.length === 0,
  };
};

/**
 * Remove a document from VKB (useful for duplicates or errors)
 * @param {string} documentId - ID of document to remove
 * @returns {Promise<object>} Result with success status
 */
export const removeDocumentFromVKB = async (documentId) => {
  const vkb = await loadVKB();
  let removed = false;
  let category = null;

  // Search all categories
  const categories = [
    "dd214s",
    "blueButtonReports",
    "cFiles",
    "privateRecords",
    "otherEvidence",
  ];

  for (const cat of categories) {
    const index = vkb.documentation[cat].findIndex(
      (doc) => doc.id === documentId,
    );
    if (index !== -1) {
      vkb.documentation[cat].splice(index, 1);
      removed = true;
      category = cat;

      // Recalculate version numbers
      vkb.documentation[cat].forEach((doc, idx) => {
        doc.version = idx + 1;
      });

      // Mark most recent
      if (vkb.documentation[cat].length > 0) {
        vkb.documentation[cat][vkb.documentation[cat].length - 1].mostRecent =
          true;
      }

      break;
    }
  }

  if (removed) {
    // Update document count
    vkb.metadata.documentCount =
      vkb.documentation.dd214s.length +
      vkb.documentation.blueButtonReports.length +
      vkb.documentation.cFiles.length +
      vkb.documentation.privateRecords.length +
      vkb.documentation.otherEvidence.length;

    const saveResult = await saveVKB(vkb);
    return { success: saveResult.success, category, documentId };
  }

  return { success: false, error: "Document not found" };
};

/**
 * Calculate VKB completeness score (0-100)
 */
export const calculateCompleteness = (vkb) => {
  let score = 0;
  let maxScore = 0;

  // Personal info (20 points)
  maxScore += 20;
  if (vkb.personal.fullName) score += 5;
  if (vkb.personal.dateOfBirth) score += 5;
  if (vkb.personal.address.state) score += 5;
  if (vkb.personal.email || vkb.personal.phone) score += 5;

  // Service history (25 points)
  maxScore += 25;
  if (vkb.serviceHistory.branch) score += 5;
  if (vkb.serviceHistory.entryDate) score += 5;
  if (vkb.serviceHistory.separationDate) score += 5;
  if (vkb.serviceHistory.mos.length > 0) score += 5;
  if (vkb.serviceHistory.characterOfService) score += 5;

  // Medical conditions (30 points)
  maxScore += 30;
  if (vkb.medicalConditions.current.length > 0) score += 15;
  if (vkb.medicalConditions.secondary.length > 0) score += 10;
  if (vkb.medications.current.length > 0) score += 5;

  // Evidence (15 points)
  maxScore += 15;
  if (vkb.documentation.dd214s.length > 0) score += 5;
  if (vkb.documentation.blueButtonReports.length > 0) score += 5;
  if (vkb.evidenceTimeline.length > 0) score += 5;

  // Claims history (10 points)
  maxScore += 10;
  if (vkb.vaClaimsHistory.claims.length > 0) score += 5;
  if (vkb.vaClaimsHistory.ratings.length > 0) score += 5;

  return Math.round((score / maxScore) * 100);
};

/**
 * Merge data from DD-214 into VKB - DIAMOND STANDARD
 *
 * Handles ALL 29 blocks of the DD-214 form:
 *   - Blocks 1-3: Name, Branch, SSN
 *   - Blocks 4a-4b: Grade/Pay Grade
 *   - Block 5: DOB
 *   - Block 6: Reserve obligation date
 *   - Blocks 7-8: Dates of service
 *   - Blocks 9-11: Service time calculations
 *   - Blocks 12a-e: Separation details
 *   - Block 13: Awards (may continue in Block 18)
 *   - Block 14: MOS
 *   - Block 15: Education (GED/college)
 *   - Blocks 16-17: Not commonly extracted
 *   - Block 18: Additional remarks (deployments, combat, continuation awards)
 *   - Blocks 19-22: Addresses
 *   - Block 23: Separation type
 *   - Block 24: Character of service
 *   - Blocks 25-27: RE code, SPN code, dates
 *   - Block 28: Narrative reason
 *   - Block 29: Member copy indicator
 *
 * This function MERGES - it never overwrites existing VKB data
 * with empty values. Newer DD214s update rank/dates to the most recent.
 * Awards are always ADDED (not replaced).
 *
 * @param {Object} vkb - The VKB to merge into
 * @param {Object} dd214Data - Extracted DD214 data (from dd214FieldExtractor or AI)
 * @param {Object} options - Merge options
 * @param {boolean} options.isMultiDD214 - Part of a multi-DD214 set
 * @param {number} options.ddIndex - Index in the set (0-based)
 * @param {string} options.fileName - Original filename
 * @returns {Object} Updated VKB
 */
function mergeDD214PersonalInfo(vkb, dd214Data) {
  // ─── PERSONAL INFO (Blocks 1, 3, 5) ───
  if (dd214Data.fullName || dd214Data.name) {
    const name = dd214Data.fullName || dd214Data.name;
    if (!vkb.personal.fullName || name.length > vkb.personal.fullName.length) {
      vkb.personal.fullName = name;
    }
  }
  if (dd214Data.ssn || dd214Data.ssnLast4) {
    const ssn =
      dd214Data.ssnLast4 || (dd214Data.ssn ? dd214Data.ssn.slice(-4) : null);
    if (ssn && !vkb.personal.ssn) {
      vkb.personal.ssn = ssn;
    }
  }
  if (dd214Data.dateOfBirth && !vkb.personal.dateOfBirth) {
    vkb.personal.dateOfBirth = dd214Data.dateOfBirth;
  }
}

function mergeDD214ServiceDates(vkb, dd214Data) {
  // Dates - use the EARLIEST entry and LATEST separation across all DD214s
  if (dd214Data.entryDate) {
    if (
      !vkb.serviceHistory.entryDate ||
      new Date(dd214Data.entryDate) < new Date(vkb.serviceHistory.entryDate)
    ) {
      vkb.serviceHistory.entryDate = dd214Data.entryDate;
    }
  }
  if (dd214Data.separationDate) {
    if (
      !vkb.serviceHistory.separationDate ||
      new Date(dd214Data.separationDate) >
        new Date(vkb.serviceHistory.separationDate)
    ) {
      vkb.serviceHistory.separationDate = dd214Data.separationDate;
    }
  }

  // Calculate total years of service
  if (vkb.serviceHistory.entryDate && vkb.serviceHistory.separationDate) {
    const entry = new Date(vkb.serviceHistory.entryDate);
    const sep = new Date(vkb.serviceHistory.separationDate);
    const years = ((sep - entry) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1);
    vkb.serviceHistory.yearsOfService = parseFloat(years);
  } else {
    vkb.serviceHistory.yearsOfService =
      dd214Data.yearsService ||
      dd214Data.totalService ||
      vkb.serviceHistory.yearsOfService;
  }

  // Net active service time (Block 9)
  if (dd214Data.netActiveServiceTime) {
    vkb.serviceHistory.netActiveServiceTime = dd214Data.netActiveServiceTime;
  }
}

function mergeDD214RankAndCharacter(vkb, dd214Data) {
  // Rank - use the HIGHEST rank (latest DD214 usually has highest)
  if (dd214Data.rank) {
    vkb.serviceHistory.rank.discharge = dd214Data.rank;
    if (!vkb.serviceHistory.rank.entry) {
      vkb.serviceHistory.rank.entry = dd214Data.rank; // Will be overwritten by earlier DD214
    }
  }
  if (dd214Data.payGrade) {
    if (!vkb.serviceHistory.payGrade)
      vkb.serviceHistory.payGrade = dd214Data.payGrade;
    // Keep the HIGHEST pay grade
    const currentGrade = parsePayGrade(vkb.serviceHistory.payGrade);
    const newGrade = parsePayGrade(dd214Data.payGrade);
    if (newGrade > currentGrade) {
      vkb.serviceHistory.payGrade = dd214Data.payGrade;
    }
  }

  // Character of service - keep the most recent
  vkb.serviceHistory.characterOfService =
    dd214Data.characterOfService || vkb.serviceHistory.characterOfService;
  vkb.serviceHistory.reenlisted =
    dd214Data.reenlisted || vkb.serviceHistory.reenlisted;
  vkb.serviceHistory.foreignService =
    dd214Data.foreignService || vkb.serviceHistory.foreignService;
}

function mergeDD214ServiceHistoryCore(vkb, dd214Data) {
  // ─── SERVICE HISTORY (Blocks 2, 4a-4b, 7-11, 24) ───
  vkb.serviceHistory.branch = dd214Data.branch || vkb.serviceHistory.branch;

  // Component (Active, Reserve, Guard)
  if (dd214Data.component) {
    if (!vkb.serviceHistory.component)
      vkb.serviceHistory.component = dd214Data.component;
  }

  mergeDD214ServiceDates(vkb, dd214Data);
  mergeDD214RankAndCharacter(vkb, dd214Data);
}

function mergeDD214SeparationDetails(vkb, dd214Data) {
  // ─── SEPARATION DETAILS (Blocks 12, 23, 25-28) ───
  if (
    dd214Data.separationAuthority ||
    dd214Data.separationType ||
    dd214Data.narrativeReason ||
    dd214Data.reentryCode ||
    dd214Data.spnCode
  ) {
    if (!vkb.serviceHistory.separationDetails)
      vkb.serviceHistory.separationDetails = {};
    vkb.serviceHistory.separationDetails = {
      authority:
        dd214Data.separationAuthority ||
        vkb.serviceHistory.separationDetails?.authority,
      separationType:
        dd214Data.separationType ||
        vkb.serviceHistory.separationDetails?.separationType,
      narrativeReason:
        dd214Data.narrativeReason ||
        vkb.serviceHistory.separationDetails?.narrativeReason,
      reentryCode:
        dd214Data.reentryCode ||
        dd214Data.reCode ||
        vkb.serviceHistory.separationDetails?.reentryCode,
      spnCode:
        dd214Data.spnCode || vkb.serviceHistory.separationDetails?.spnCode,
    };
  }
}

/**
 * Derive the MOS code/title reported on a DD-214, using the same
 * precedence rules used both when merging the MOS list and when
 * recording a service period.
 */
function deriveDD214MOS(dd214Data) {
  const mosCode = dd214Data.mos || dd214Data.primaryMOS;
  const mosTitle =
    dd214Data.mosTitle || dd214Data.primaryMOSTitle || dd214Data.dutyMOS;
  return { mosCode, mosTitle };
}

function mergeDD214MOS(vkb, dd214Data) {
  // ─── MOS (Block 14) ───
  const { mosCode, mosTitle } = deriveDD214MOS(dd214Data);
  if (mosCode) {
    const existingMOS = vkb.serviceHistory.mos.find((m) => m.code === mosCode);
    if (!existingMOS) {
      vkb.serviceHistory.mos.push({
        code: mosCode,
        title: mosTitle || "",
        dates: {
          start: dd214Data.entryDate || null,
          end: dd214Data.separationDate || null,
        },
        hazards: [], // Filled by MOS Hazard Matcher
      });
    }
  }
  // Additional MOS entries
  if (dd214Data.additionalMOS && Array.isArray(dd214Data.additionalMOS)) {
    dd214Data.additionalMOS.forEach((addMos) => {
      const code = typeof addMos === "string" ? addMos : addMos.code;
      if (code && !vkb.serviceHistory.mos.find((m) => m.code === code)) {
        vkb.serviceHistory.mos.push({
          code,
          title: addMos.title || "",
          dates: { start: null, end: null },
          hazards: [],
        });
      }
    });
  }
}

function mergeDD214Education(vkb, dd214Data) {
  // ─── EDUCATION (Block 15) ───
  if (dd214Data.educationYears || dd214Data.education) {
    if (!vkb.serviceHistory.education) vkb.serviceHistory.education = {};
    vkb.serviceHistory.education = {
      years: dd214Data.educationYears || vkb.serviceHistory.education?.years,
      description:
        dd214Data.education || vkb.serviceHistory.education?.description,
    };
  }
}

function mergeDD214Awards(vkb, dd214Data, options) {
  // ─── AWARDS (Block 13 + Block 18 continuation) ───
  if (dd214Data.awards && Array.isArray(dd214Data.awards)) {
    dd214Data.awards.forEach((award) => {
      const awardName =
        typeof award === "string"
          ? award
          : award.name || award.abbreviation || "";
      if (!awardName) return;

      // Normalize for comparison - ignore case, trim, collapse spaces
      const normalizedNew = awardName.toLowerCase().replace(/\s+/g, " ").trim();
      const existingAward = vkb.serviceHistory.awards.find((a) => {
        const normalizedExisting = (a.name || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        return (
          normalizedExisting === normalizedNew ||
          normalizedExisting.includes(normalizedNew) ||
          normalizedNew.includes(normalizedExisting)
        );
      });

      if (!existingAward) {
        vkb.serviceHistory.awards.push({
          name: awardName,
          date: award.date || null,
          isCombat: award.isCombat || false,
          devices: award.devices || [],
          source: options.fileName || "DD-214",
        });
      } else if (typeof award === "object" && award.devices?.length) {
        // Merge new devices into existing award
        const existingDevices = new Set(
          existingAward.devices?.map((d) => d.toLowerCase()) || [],
        );
        award.devices.forEach((d) => {
          if (!existingDevices.has(d.toLowerCase())) {
            existingAward.devices = existingAward.devices || [];
            existingAward.devices.push(d);
          }
        });
      }
    });
  }
}

function mergeDD214Deployments(vkb, dd214Data, options) {
  // ─── DEPLOYMENTS (from Block 18 / extracted) ───
  if (dd214Data.deployments && Array.isArray(dd214Data.deployments)) {
    dd214Data.deployments.forEach((dep) => {
      const location = dep.location || dep.theater || "";
      const operation = dep.operation || "";
      // Avoid duplicate deployments
      const isDuplicate = vkb.serviceHistory.deployments.some(
        (d) =>
          (d.location || "").toLowerCase() === location.toLowerCase() &&
          (d.startDate || "") === (dep.startDate || ""),
      );
      if (!isDuplicate && (location || operation)) {
        vkb.serviceHistory.deployments.push({
          location,
          startDate: dep.startDate || null,
          endDate: dep.endDate || null,
          combatZone: dep.combatZone || dep.isHazardous || false,
          operation,
          source: options.fileName || "DD-214",
        });
      }
    });
  }
}

function mergeDD214CombatService(vkb, dd214Data) {
  // ─── COMBAT SERVICE ───
  if (dd214Data.combatService) {
    if (!vkb.serviceHistory.combatService) {
      vkb.serviceHistory.combatService = {
        hasVerifiedCombat: false,
        indicators: [],
        campaigns: [],
      };
    }
    if (dd214Data.combatService.hasVerifiedCombat) {
      vkb.serviceHistory.combatService.hasVerifiedCombat = true;
    }
    if (dd214Data.combatService.indicators) {
      dd214Data.combatService.indicators.forEach((ind) => {
        if (!vkb.serviceHistory.combatService.indicators.includes(ind)) {
          vkb.serviceHistory.combatService.indicators.push(ind);
        }
      });
    }
    if (dd214Data.combatService.campaigns) {
      dd214Data.combatService.campaigns.forEach((camp) => {
        if (!vkb.serviceHistory.combatService.campaigns.includes(camp)) {
          vkb.serviceHistory.combatService.campaigns.push(camp);
        }
      });
    }
  }
}

function mergeDD214SpecialQualifications(vkb, dd214Data) {
  // ─── SPECIAL QUALIFICATIONS ───
  if (
    dd214Data.specialQualifications &&
    Array.isArray(dd214Data.specialQualifications)
  ) {
    if (!vkb.serviceHistory.specialQualifications)
      vkb.serviceHistory.specialQualifications = [];
    dd214Data.specialQualifications.forEach((qual) => {
      if (!vkb.serviceHistory.specialQualifications.includes(qual)) {
        vkb.serviceHistory.specialQualifications.push(qual);
      }
    });
  }
}

function mergeDD214Addresses(vkb, dd214Data) {
  // ─── ADDRESSES (Blocks 19-22) ───
  if (dd214Data.mailingAddress || dd214Data.address) {
    const addr = dd214Data.mailingAddress || dd214Data.address;
    if (typeof addr === "object") {
      vkb.personal.address = {
        street: addr.street || vkb.personal.address.street,
        city: addr.city || vkb.personal.address.city,
        state: addr.state || vkb.personal.address.state,
        zip: addr.zip || addr.zipCode || vkb.personal.address.zip,
      };
    } else if (typeof addr === "string" && addr.trim()) {
      // Parse string address
      if (!vkb.personal.address.street) {
        vkb.personal.address.street = addr;
      }
    }
  }
}

function mergeDD214EvidenceTimeline(vkb, dd214Data, options) {
  // ─── EVIDENCE TIMELINE ───
  const timelineEntries = [];
  if (dd214Data.entryDate) {
    timelineEntries.push({
      date: dd214Data.entryDate,
      eventType: "service_entry",
      description: `Entered active duty (${dd214Data.branch || vkb.serviceHistory.branch || "Military"})`,
      source: options.fileName || "DD-214",
      significance: "service_milestone",
    });
  }
  if (dd214Data.separationDate) {
    timelineEntries.push({
      date: dd214Data.separationDate,
      eventType: "service_separation",
      description: `Separated from service - ${dd214Data.characterOfService || "Honorable"} discharge`,
      source: options.fileName || "DD-214",
      significance: "service_milestone",
    });
  }
  if (dd214Data.deployments) {
    dd214Data.deployments.forEach((dep) => {
      if (dep.startDate) {
        timelineEntries.push({
          date: dep.startDate,
          eventType: "deployment",
          description: `Deployed to ${dep.location || dep.operation || "overseas"}`,
          source: options.fileName || "DD-214",
          significance: "combat_exposure",
        });
      }
    });
  }

  // Add timeline entries (avoid duplicates)
  timelineEntries.forEach((entry) => {
    const isDuplicate = vkb.evidenceTimeline.some(
      (e) => e.date === entry.date && e.eventType === entry.eventType,
    );
    if (!isDuplicate) {
      vkb.evidenceTimeline.push(entry);
    }
  });

  // Sort timeline by date
  vkb.evidenceTimeline.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });
}

function mergeDD214ServicePeriodTracking(vkb, dd214Data, options) {
  // ─── SERVICE PERIOD TRACKING (for multi-DD214 sets) ───
  const { mosCode, mosTitle } = deriveDD214MOS(dd214Data);
  if (!vkb.serviceHistory.servicePeriods)
    vkb.serviceHistory.servicePeriods = [];
  if (dd214Data.entryDate && dd214Data.separationDate) {
    const isDuplicate = vkb.serviceHistory.servicePeriods.some(
      (p) =>
        p.entryDate === dd214Data.entryDate &&
        p.separationDate === dd214Data.separationDate,
    );
    if (!isDuplicate) {
      vkb.serviceHistory.servicePeriods.push({
        entryDate: dd214Data.entryDate,
        separationDate: dd214Data.separationDate,
        branch: dd214Data.branch || vkb.serviceHistory.branch,
        component: dd214Data.component || "",
        rank: dd214Data.rank || "",
        payGrade: dd214Data.payGrade || "",
        mos: mosCode || "",
        mosTitle: mosTitle || "",
        characterOfService: dd214Data.characterOfService || "",
        source: options.fileName || "DD-214",
      });
    }
  }
}

function mergeDD214Documentation(vkb, dd214Data, options) {
  // ─── DOCUMENTATION ───
  vkb.documentation.dd214s.push({
    id: `dd214-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    fileName: options.fileName || "DD-214",
    uploadDate: new Date().toISOString(),
    pageCount: dd214Data.pageCount || 1,
    extracted: true,
    servicePeriod:
      dd214Data.entryDate && dd214Data.separationDate
        ? `${dd214Data.entryDate} to ${dd214Data.separationDate}`
        : null,
    rank: dd214Data.rank || "",
    branch: dd214Data.branch || "",
  });

  vkb.metadata.documentCount++;
}

export const mergeDD214IntoVKB = (vkb, dd214Data, options = {}) => {
  if (!dd214Data || typeof dd214Data !== "object") return vkb;

  mergeDD214PersonalInfo(vkb, dd214Data);
  mergeDD214ServiceHistoryCore(vkb, dd214Data);
  mergeDD214SeparationDetails(vkb, dd214Data);
  mergeDD214MOS(vkb, dd214Data);
  mergeDD214Education(vkb, dd214Data);
  mergeDD214Awards(vkb, dd214Data, options);
  mergeDD214Deployments(vkb, dd214Data, options);
  mergeDD214CombatService(vkb, dd214Data);
  mergeDD214SpecialQualifications(vkb, dd214Data);
  mergeDD214Addresses(vkb, dd214Data);
  mergeDD214EvidenceTimeline(vkb, dd214Data, options);
  mergeDD214ServicePeriodTracking(vkb, dd214Data, options);
  mergeDD214Documentation(vkb, dd214Data, options);

  return vkb;
};

/**
 * Parse a pay grade string (e.g., "E-5", "O-3") into a numeric rank value.
 * Higher number = higher rank. Used to find the veteran's highest grade.
 */
function parsePayGrade(pg) {
  if (!pg) return 0;
  const match = pg.match(/([EOW])-?(\d+)/i);
  if (!match) return 0;
  const category = match[1].toUpperCase();
  const level = parseInt(match[2], 10);
  let base;
  if (category === "E") {
    base = 0;
  } else if (category === "W") {
    base = 100;
  } else {
    base = 200;
  }
  return base + level;
}

/**
 * Merge data from Blue Button into VKB
 */
export const mergeBlueButtonIntoVKB = (vkb, blueButtonData) => {
  // Medical conditions
  if (blueButtonData.conditions && Array.isArray(blueButtonData.conditions)) {
    blueButtonData.conditions.forEach((condition) => {
      const existingCondition = vkb.medicalConditions.current.find(
        (c) =>
          c.name.toLowerCase() === condition.standardizedName.toLowerCase(),
      );

      if (!existingCondition) {
        vkb.medicalConditions.current.push({
          name: condition.standardizedName,
          diagnosisDate: condition.dateFound || null,
          icdCode: null,
          severity: null,
          ratedPercentage: null,
          serviceConnected: null,
          source: "Blue Button",
        });
      }
    });
  }

  // Evidence timeline
  if (blueButtonData.conditions && Array.isArray(blueButtonData.conditions)) {
    blueButtonData.conditions.forEach((condition) => {
      if (condition.dateFound) {
        vkb.evidenceTimeline.push({
          date: condition.dateFound,
          eventType: "diagnosis",
          description: `Diagnosed with ${condition.standardizedName}`,
          source: "Blue Button Report",
          significance: "medical_diagnosis",
        });
      }
    });
  }

  // Documentation
  vkb.documentation.blueButtonReports.push({
    id: `bluebutton-${Date.now()}`,
    fileName: "VA Blue Button Report",
    uploadDate: new Date().toISOString(),
    dateRange: null,
    recordCount: blueButtonData.conditions?.length || 0,
  });

  vkb.metadata.documentCount++;
  return vkb;
};

/**
 * Merge data from Muster Call into VKB
 */
export const mergeMusterCallIntoVKB = (vkb, musterCallData) => {
  // Muster Call returns combined data from multiple documents
  // Route to appropriate merge functions based on document type

  if (musterCallData.dd214) {
    vkb = mergeDD214IntoVKB(vkb, musterCallData.dd214);
  }

  if (musterCallData.blueButton) {
    vkb = mergeBlueButtonIntoVKB(vkb, musterCallData.blueButton);
  }

  // Generic document metadata
  if (musterCallData.documents) {
    musterCallData.documents.forEach((doc) => {
      vkb.documentation.otherEvidence.push({
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fileName: doc.fileName,
        uploadDate: new Date().toISOString(),
        category: doc.type || "other",
        description: doc.summary || "",
      });
    });
  }

  return vkb;
};

function buildPersonalContext(vkb) {
  // ─── PERSONAL ───
  let context = "";
  if (vkb.personal.fullName) {
    context += `Veteran: ${vkb.personal.fullName}\n`;
  }
  if (vkb.personal.dateOfBirth) {
    context += `DOB: ${vkb.personal.dateOfBirth}\n`;
  }
  if (vkb.personal.ssn) {
    context += `SSN (last 4): ${vkb.personal.ssn}\n`;
  }
  if (
    vkb.personal.address &&
    (vkb.personal.address.city || vkb.personal.address.state)
  ) {
    const addr = vkb.personal.address;
    const parts = [addr.street, addr.city, addr.state, addr.zip].filter(
      Boolean,
    );
    context += `Address: ${parts.join(", ")}\n`;
  }
  return context;
}

function buildServiceHistoryCoreContext(vkb) {
  // ─── SERVICE HISTORY ───
  let context = "\n--- SERVICE HISTORY ---\n";
  if (vkb.serviceHistory.branch) {
    context += `Branch: ${vkb.serviceHistory.branch}\n`;
  }
  if (vkb.serviceHistory.component) {
    context += `Component: ${vkb.serviceHistory.component}\n`;
  }
  if (vkb.serviceHistory.entryDate && vkb.serviceHistory.separationDate) {
    context += `Service: ${vkb.serviceHistory.entryDate} to ${vkb.serviceHistory.separationDate}`;
    if (vkb.serviceHistory.yearsOfService) {
      context += ` (${vkb.serviceHistory.yearsOfService} years)`;
    }
    context += "\n";
  }
  if (vkb.serviceHistory.rank?.discharge) {
    context += `Rank at Discharge: ${vkb.serviceHistory.rank.discharge}`;
    if (vkb.serviceHistory.payGrade)
      context += ` (${vkb.serviceHistory.payGrade})`;
    context += "\n";
  }
  if (vkb.serviceHistory.mos.length > 0) {
    const mosList = vkb.serviceHistory.mos.map((m) => `${m.code} (${m.title})`);
    context += `MOS: ${mosList.join(", ")}\n`;
  }
  if (vkb.serviceHistory.characterOfService) {
    context += `Discharge: ${vkb.serviceHistory.characterOfService}\n`;
  }
  return context;
}

function buildServicePeriodsAndSeparationContext(vkb) {
  let context = "";

  // Service periods (multi-DD214)
  if (vkb.serviceHistory.servicePeriods?.length > 1) {
    context += "\nService Periods:\n";
    vkb.serviceHistory.servicePeriods.forEach((p, i) => {
      context += `  Period ${i + 1}: ${p.entryDate} to ${p.separationDate} - ${p.branch || ""} ${p.rank || ""} (${p.mos || ""})\n`;
    });
  }

  // Separation details
  if (vkb.serviceHistory.separationDetails) {
    const sep = vkb.serviceHistory.separationDetails;
    if (sep.narrativeReason)
      context += `Separation Reason: ${sep.narrativeReason}\n`;
    if (sep.reentryCode) context += `RE Code: ${sep.reentryCode}\n`;
    if (sep.spnCode) context += `SPN Code: ${sep.spnCode}\n`;
  }
  return context;
}

function buildDeploymentsContext(vkb) {
  // ─── DEPLOYMENTS ───
  let context = "";
  if (vkb.serviceHistory.deployments?.length > 0) {
    context += "\n--- DEPLOYMENTS ---\n";
    vkb.serviceHistory.deployments.forEach((dep) => {
      context += `• ${dep.location || dep.operation || "Unknown"}`;
      if (dep.startDate) context += ` (${dep.startDate}`;
      if (dep.endDate) context += ` to ${dep.endDate}`;
      if (dep.startDate) context += ")";
      if (dep.combatZone) context += " [COMBAT ZONE]";
      context += "\n";
    });
  }
  return context;
}

function buildCombatServiceContext(vkb) {
  // ─── COMBAT SERVICE ───
  let context = "";
  if (vkb.serviceHistory.combatService?.hasVerifiedCombat) {
    context += "\n--- COMBAT SERVICE: VERIFIED ---\n";
    if (vkb.serviceHistory.combatService.indicators?.length) {
      context += `Indicators: ${vkb.serviceHistory.combatService.indicators.join(", ")}\n`;
    }
    if (vkb.serviceHistory.combatService.campaigns?.length) {
      context += `Campaigns: ${vkb.serviceHistory.combatService.campaigns.join(", ")}\n`;
    }
  }
  return context;
}

function buildAwardsContext(vkb) {
  // ─── AWARDS ───
  let context = "";
  if (vkb.serviceHistory.awards?.length > 0) {
    context += "\n--- AWARDS & DECORATIONS ---\n";
    const combatAwards = vkb.serviceHistory.awards.filter((a) => a.isCombat);
    const otherAwards = vkb.serviceHistory.awards.filter((a) => !a.isCombat);

    if (combatAwards.length > 0) {
      context += "Combat Awards:\n";
      combatAwards.forEach((a) => {
        context += `  ★ ${a.name}`;
        if (a.devices?.length) context += ` (${a.devices.join(", ")})`;
        context += "\n";
      });
    }
    otherAwards.forEach((a) => {
      context += `  • ${a.name}`;
      if (a.devices?.length) context += ` (${a.devices.join(", ")})`;
      context += "\n";
    });
  }
  return context;
}

function buildSpecialQualificationsContext(vkb) {
  // ─── SPECIAL QUALIFICATIONS ───
  let context = "";
  if (vkb.serviceHistory.specialQualifications?.length > 0) {
    context += `\nSpecial Qualifications: ${vkb.serviceHistory.specialQualifications.join(", ")}\n`;
  }
  return context;
}

function buildEducationContext(vkb) {
  // ─── EDUCATION ───
  let context = "";
  if (vkb.serviceHistory.education) {
    const edu = vkb.serviceHistory.education;
    if (edu.years) context += `Education: ${edu.years} years`;
    if (edu.description) context += ` - ${edu.description}`;
    context += "\n";
  }
  return context;
}

function buildClaimedConditionsContext(vkb) {
  // ─── MEDICAL CONDITIONS ───
  let context = "";
  if (vkb.medicalConditions.current.length > 0) {
    context += "\n--- CLAIMED CONDITIONS ---\n";
    vkb.medicalConditions.current.forEach((condition) => {
      context += `• ${condition.name}`;
      if (condition.diagnosisDate)
        context += ` (diagnosed ${condition.diagnosisDate})`;
      if (condition.ratedPercentage)
        context += ` [${condition.ratedPercentage}% rated]`;
      if (condition.serviceConnected) context += " [SC]";
      context += "\n";
    });
  }
  return context;
}

function buildSecondaryConditionsContext(vkb) {
  // Secondary conditions
  let context = "";
  if (vkb.medicalConditions.secondary.length > 0) {
    context += "\n--- SECONDARY CONDITIONS ---\n";
    vkb.medicalConditions.secondary.forEach((sec) => {
      context += `• ${sec.condition} (secondary to ${sec.primaryCondition})\n`;
    });
  }
  return context;
}

function buildPresumptiveConditionsContext(vkb) {
  // Presumptive conditions
  let context = "";
  if (vkb.medicalConditions.presumptive?.length > 0) {
    context += "\n--- PRESUMPTIVE CONDITIONS ---\n";
    vkb.medicalConditions.presumptive.forEach((p) => {
      context += `• ${p.condition} (${p.exposureType}, eligible under ${p.eligibleUnder})\n`;
    });
  }
  return context;
}

function buildMedicationsContext(vkb) {
  // Medications
  let context = "";
  if (vkb.medications.current.length > 0) {
    context += "\n--- CURRENT MEDICATIONS ---\n";
    vkb.medications.current.forEach((med) => {
      context += `• ${med.name}`;
      if (med.dosage) context += ` ${med.dosage}`;
      if (med.frequency) context += ` (${med.frequency})`;
      if (med.prescribedFor) context += ` - for ${med.prescribedFor}`;
      context += "\n";
    });
  }
  return context;
}

function buildExposuresContext(vkb) {
  // ─── EXPOSURES ───
  let context = "";
  const hasExposures =
    vkb.exposures.environmental.length +
      vkb.exposures.occupational.length +
      vkb.exposures.combat.length >
    0;
  if (hasExposures) {
    context += "\n--- EXPOSURES ---\n";
    vkb.exposures.environmental.forEach((e) => {
      context += `• Environmental: ${e.type} at ${e.location} (${e.dates || "dates unknown"})\n`;
    });
    vkb.exposures.occupational.forEach((e) => {
      context += `• Occupational: ${e.hazard} - MOS ${e.mos}\n`;
    });
    vkb.exposures.combat.forEach((e) => {
      context += `• Combat: ${e.incident} at ${e.location} (${e.date || "date unknown"})\n`;
    });
  }
  return context;
}

function buildClaimsHistoryContext(vkb) {
  // ─── CLAIMS HISTORY ───
  let context = "";
  if (
    vkb.vaClaimsHistory.claims.length > 0 ||
    vkb.vaClaimsHistory.ratings.length > 0
  ) {
    context += "\n--- VA CLAIMS HISTORY ---\n";
    vkb.vaClaimsHistory.claims.forEach((claim) => {
      context += `• Claim #${claim.claimNumber}: ${claim.status}`;
      if (claim.filedDate) context += ` (filed ${claim.filedDate})`;
      context += "\n";
    });
    if (vkb.vaClaimsHistory.ratings.length > 0) {
      context += "Current Ratings:\n";
      vkb.vaClaimsHistory.ratings.forEach((r) => {
        context += `  ${r.condition}: ${r.percentage}%`;
        if (r.effectiveDate) context += ` (effective ${r.effectiveDate})`;
        context += "\n";
      });
    }
  }
  return context;
}

function buildEvidenceSummaryContext(vkb) {
  // ─── EVIDENCE ───
  let context = "\n--- EVIDENCE ON FILE ---\n";
  context += `DD-214s: ${vkb.documentation.dd214s.length}\n`;
  context += `Blue Button Reports: ${vkb.documentation.blueButtonReports.length}\n`;
  context += `C-Files: ${vkb.documentation.cFiles.length}\n`;
  context += `Private Records: ${vkb.documentation.privateRecords.length}\n`;
  context += `Other Evidence: ${vkb.documentation.otherEvidence.length}\n`;
  return context;
}

function buildEvidenceTimelineContext(vkb) {
  // ─── EVIDENCE TIMELINE ───
  let context = "";
  if (vkb.evidenceTimeline.length > 0) {
    context += "\n--- EVIDENCE TIMELINE ---\n";
    vkb.evidenceTimeline.slice(0, 20).forEach((e) => {
      context += `  ${e.date || "???"}: ${e.description} [${e.source || ""}]\n`;
    });
    if (vkb.evidenceTimeline.length > 20) {
      context += `  ... and ${vkb.evidenceTimeline.length - 20} more events\n`;
    }
  }
  return context;
}

function buildKeyFactsContext(vkb) {
  // Key facts
  let context = "";
  if (vkb.keyFacts.length > 0) {
    context += "\n--- KEY FACTS ---\n";
    vkb.keyFacts.slice(0, 10).forEach((fact) => {
      context += `• ${fact.fact} [Source: ${fact.source}]\n`;
    });
  }
  return context;
}

function buildNexusStatementsContext(vkb) {
  // Nexus statements
  let context = "";
  if (vkb.nexusStatements?.length > 0) {
    context += "\n--- NEXUS STATEMENTS ---\n";
    vkb.nexusStatements.forEach((ns) => {
      context += `• ${ns.condition}: "${ns.relationship}" (by ${ns.statedBy || "unknown"}, ${ns.date || ""})\n`;
    });
  }
  return context;
}

function buildAIInsightsContext(vkb) {
  // AI Insights
  let context = "";
  if (vkb.aiInsights.missingEvidence.length > 0) {
    context += "\n--- MISSING EVIDENCE ---\n";
    vkb.aiInsights.missingEvidence.slice(0, 5).forEach((missing) => {
      context += `• ${missing.condition}: Need ${missing.evidenceType}\n`;
    });
  }
  return context;
}

/**
 * Generate LLM context string from VKB
 * This is what we inject into AI prompts so every AI tool
 * knows everything about the veteran - Diamond Standard completeness.
 */
export const generateLLMContext = (vkb) => {
  let context = "=== VETERAN KNOWLEDGE BASE ===\n\n";

  context += buildPersonalContext(vkb);
  context += buildServiceHistoryCoreContext(vkb);
  context += buildServicePeriodsAndSeparationContext(vkb);
  context += buildDeploymentsContext(vkb);
  context += buildCombatServiceContext(vkb);
  context += buildAwardsContext(vkb);
  context += buildSpecialQualificationsContext(vkb);
  context += buildEducationContext(vkb);
  context += buildClaimedConditionsContext(vkb);
  context += buildSecondaryConditionsContext(vkb);
  context += buildPresumptiveConditionsContext(vkb);
  context += buildMedicationsContext(vkb);
  context += buildExposuresContext(vkb);
  context += buildClaimsHistoryContext(vkb);
  context += buildEvidenceSummaryContext(vkb);
  context += buildEvidenceTimelineContext(vkb);
  context += buildKeyFactsContext(vkb);
  context += buildNexusStatementsContext(vkb);
  context += buildAIInsightsContext(vkb);

  context += "\n=== END KNOWLEDGE BASE ===\n";
  return context;
};

/**
 * Export VKB for backup
 */
export const exportVKB = async () => {
  const vkb = await loadVKB();
  const blob = new Blob([JSON.stringify(vkb, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vetrate-knowledge-base-${new Date().toISOString().split("T")[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Clear entire VKB (with confirmation)
 */
export const clearVKB = () => {
  localStorage.removeItem(VKB_STORAGE_KEY);
  return initializeVKB();
};
