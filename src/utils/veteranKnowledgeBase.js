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

import {
  isSameServicePeriod,
  isSameDate,
  isDesignatedCombatZone,
  parseExplicitDate,
} from "./dateUtils";
import { isSameCalendarDay, documentSources } from "./serviceEntryDate";
import { ensureQuota } from "./storage";
import {
  calendarDay,
  dropSupersededConditions,
  findRatedConditionMatch,
  isOlderDecision,
  isSupersededName,
  normalizeConditionName,
  primaryConditionKey,
} from "./conditionName";
import { DOCUMENT_TYPES } from "./documentClassifier";
import { awardDisplayName } from "./combatService";
import { redactVeteranIdentifiers } from "./piiScrubber";
import { getVeteranProfile } from "./veteranProfile";

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

// In-memory read cache: detectConflicts() calls loadVKB() once per document
// during a Muster Call batch, and the VKB grows with every document saved.
// Re-reading + re-deserializing the whole growing IndexedDB blob on every
// single document made later documents in a large batch measurably slower
// than earlier ones — on modest hardware that growth can eat into the
// checkbox-verification UI's response budget. Cache the loaded object and
// invalidate it only on a confirmed saveVKB() write; loadVKB() always
// returns a structuredClone so callers can't mutate the cache by holding
// onto their own copy.
let vkbCache = null;

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
      firstPeriodRank: null,
      discharge: null,
    },
    mos: [], // [{code, title, dates, hazards}]
    characterOfService: null, // Honorable, General, etc.
    deployments: [], // [{location, startDate, endDate, combatZone, operation}]
    awards: [], // [{name, date, isCombat, devices}]
    foreignService: null, // true/false once known; null means not yet extracted
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
/**
 * C1: add serviceStartDate/serviceEndDate to every legacy
 * vkb.serviceHistory.servicePeriods[] entry that only has
 * entryDate/separationDate. entryDate/separationDate are left in place
 * (dual-read) — nothing is deleted.
 */
function _renameServicePeriodFields(vkb) {
  const periods = vkb.serviceHistory?.servicePeriods;
  if (!Array.isArray(periods) || periods.length === 0) return false;
  let changed = false;
  periods.forEach((p) => {
    if (!p || typeof p !== "object") return;
    if (p.serviceStartDate === undefined && p.entryDate !== undefined) {
      p.serviceStartDate = p.entryDate;
      changed = true;
    }
    if (p.serviceEndDate === undefined && p.separationDate !== undefined) {
      p.serviceEndDate = p.separationDate;
      changed = true;
    }
  });
  return changed;
}

/**
 * D11-3 (final11 QA, 2026-09-27): rank.entry/rank.entryAsOf mislabeled a
 * separation rank as an entry rank (see mergeDD214RankAndCharacter). Unlike
 * the servicePeriods rename above, the OLD name itself was the bug, so this
 * is a one-time MOVE (old keys deleted), not a permanent dual-read - a
 * surviving rank.entry would keep presenting the same false "entry rank" to
 * any future reader. The real, already-collected rank value moves forward
 * under its honest name instead of being silently dropped.
 */
function _renameEntryRankField(vkb) {
  const rank = vkb.serviceHistory?.rank;
  if (!rank || typeof rank !== "object") return false;
  const hasLegacyKeys =
    Object.hasOwn(rank, "entry") || Object.hasOwn(rank, "entryAsOf");
  if (!hasLegacyKeys) return false;
  // A merge that ran before this migration could already have populated
  // firstPeriodRank from a genuinely earlier record - the legacy value must
  // not clobber it, but the mislabeled keys still need to go, or a future
  // reader (or another writer re-seeding the legacy shape) can resurrect
  // "entry rank" as if it meant something.
  if (rank.firstPeriodRank === undefined) {
    rank.firstPeriodRank = rank.entry ?? null;
    rank.firstPeriodEntryDate = rank.entryAsOf ?? null;
  }
  delete rank.entry;
  delete rank.entryAsOf;
  return true;
}

export const migrateOffSchemaVKB = (vkb) => {
  if (!vkb || typeof vkb !== "object") return { vkb, changed: false };
  vkb.metadata = vkb.metadata || {};

  let changed = false;

  if (!vkb.metadata.migratedOffSchema) {
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
  }

  // C1: separate guard flag so this step also runs for VKBs that already
  // completed the (older) claims/evidence migration above.
  if (!vkb.metadata.migratedServicePeriodFieldNames) {
    if (_renameServicePeriodFields(vkb)) changed = true;
    vkb.metadata.migratedServicePeriodFieldNames = true;
  }

  // D11-3: own guard flag, same reasoning as C1 above.
  if (!vkb.metadata.migratedEntryRankFieldName) {
    if (_renameEntryRankField(vkb)) changed = true;
    vkb.metadata.migratedEntryRankFieldName = true;
  }

  return { vkb, changed };
};

/**
 * Apply the one-time off-schema migration to a freshly loaded VKB and persist
 * it. Returns the in-memory migrated VKB synchronously (via the async wrapper)
 * so readers never wait on a full VKB write; the persist runs in the background
 * and, being idempotent, is safe to re-run if a reload beats the write.
 */
export async function _migrateAndPersist(vkb) {
  if (
    vkb?.metadata?.migratedOffSchema &&
    vkb?.metadata?.migratedServicePeriodFieldNames &&
    vkb?.metadata?.migratedEntryRankFieldName &&
    vkb?.metadata?.migratedServiceEntryProjection
  ) {
    return vkb;
  }
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

// An IndexedDB open blocked by another connection's pending upgrade never
// settles; race any VKB read/write promise so a slow/unavailable IndexedDB
// never hangs a caller forever — resolves to null on timeout instead.
export const raceVkb = (promise, timeoutMs = 3000) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);

/**
 * Load VKB from IndexedDB (primary) or localStorage (legacy fallback)
 */
export const loadVKB = async () => {
  if (vkbCache) {
    return _applyServiceEntryProjection(structuredClone(vkbCache));
  }
  const vkb = await loadVKBFromStorage();
  vkbCache = structuredClone(vkb);
  return _applyServiceEntryProjection(vkb);
};

const loadVKBFromStorage = async () => {
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
    // ADR-007: every VKB writer converges the service-entry projection at
    // the one point they all funnel through.
    await _applyServiceEntryProjection(vkb);
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

        // Refresh the read cache from the object that was actually
        // persisted — clone it so the caller's continued mutation of its
        // own `vkb` reference (common after a fire-and-forget save) can't
        // silently drift the cache away from what's on disk.
        vkbCache = structuredClone(vkb);

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
  [DOCUMENT_TYPES.BLUE_BUTTON]: "blueButtonReports",
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
  const existingDocs = vkb.documentation[category] || [];

  // FIX-6: idempotent across re-imports of the same file — re-uploading an
  // unchanged file previously appended a duplicate entry and silently
  // inflated the document count. Same (fileName, fileSize) updates the
  // existing entry in place instead.
  const duplicate = existingDocs.find(
    (doc) =>
      doc.fileName === documentInfo.fileName &&
      doc.fileSize === documentInfo.fileSize,
  );

  if (duplicate) {
    duplicate.uploadDate = new Date().toISOString();
    duplicate.pageCount = documentInfo.pageCount || duplicate.pageCount || 1;
    duplicate.classification =
      documentInfo.classification || duplicate.classification;
    duplicate.extractedText =
      documentInfo.extractedText || duplicate.extractedText;
    duplicate.extractedData =
      documentInfo.extractedData || duplicate.extractedData;
    duplicate.ocrUsed = documentInfo.ocrUsed ?? duplicate.ocrUsed;
    duplicate.method = documentInfo.method || duplicate.method;
    existingDocs.forEach((doc) => {
      doc.mostRecent = doc.id === duplicate.id;
    });

    const saveResult = await saveVKB(vkb);
    return {
      success: saveResult.success,
      documentId: duplicate.id,
      vkb,
      size: saveResult.size,
      ...(saveResult.quotaWarning && { quotaWarning: saveResult.quotaWarning }),
      ...(saveResult.error && { error: saveResult.error }),
    };
  }

  // Calculate version number (count existing documents of this type + 1)
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

const DOCUMENT_CATEGORY_META = {
  dd214s: { label: "DD-214 Service Records", icon: "🎖️" },
  blueButtonReports: { label: "Blue Button Medical Records", icon: "🏥" },
  cFiles: { label: "VA Claims & Decisions", icon: "📋" },
  privateRecords: { label: "Private Medical Records", icon: "🩺" },
  otherEvidence: { label: "Other Evidence", icon: "📄" },
};

/**
 * Group the VKB's stored documents by category with display metadata.
 * Pure so a caller that already holds a loaded VKB can derive this without a
 * second IndexedDB round trip. Copies before sorting — the previous in-place
 * sort reordered the caller's own vkb.documentation arrays as a side effect.
 */
export const groupDocumentationByCategory = (vkb) =>
  Object.fromEntries(
    Object.entries(DOCUMENT_CATEGORY_META).map(([key, meta]) => {
      const documents = [...(vkb?.documentation?.[key] || [])].sort(
        (a, b) => (b.version || 0) - (a.version || 0),
      );
      return [key, { ...meta, documents, count: documents.length }];
    }),
  );

export const getAllDocumentsByCategory = async () =>
  groupDocumentationByCategory(await loadVKB());

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

const hasServicePeriods = (vkb) =>
  vkb.serviceHistory.servicePeriods?.length > 0;

// Completeness rubric: [points, predicate], grouped only for readability —
// maxScore is the sum of every entry, so adding a criterion here is the whole
// change. C1: a multi-period veteran whose top-level entryDate/separationDate
// aggregate happens to be unset (e.g. every period only has one extractable
// date) still has real service dates recorded per-period — credit that instead
// of scoring them as incomplete.
const COMPLETENESS_CRITERIA = [
  [5, (v) => v.personal.fullName],
  [5, (v) => v.personal.dateOfBirth],
  [5, (v) => v.personal.address.state],
  [5, (v) => v.personal.email || v.personal.phone],

  [5, (v) => v.serviceHistory.branch],
  [5, (v) => v.serviceHistory.entryDate || hasServicePeriods(v)],
  [5, (v) => v.serviceHistory.separationDate || hasServicePeriods(v)],
  [5, (v) => v.serviceHistory.mos.length > 0],
  [5, (v) => v.serviceHistory.characterOfService],

  [15, (v) => v.medicalConditions.current.length > 0],
  [10, (v) => v.medicalConditions.secondary.length > 0],
  [5, (v) => v.medications.current.length > 0],

  [5, (v) => v.documentation.dd214s.length > 0],
  [5, (v) => v.documentation.blueButtonReports.length > 0],
  [5, (v) => v.evidenceTimeline.length > 0],

  [5, (v) => v.vaClaimsHistory.claims.length > 0],
  [5, (v) => v.vaClaimsHistory.ratings.length > 0],
];

/**
 * Calculate VKB completeness score (0-100)
 */
export const calculateCompleteness = (vkb) => {
  const maxScore = COMPLETENESS_CRITERIA.reduce(
    (sum, [points]) => sum + points,
    0,
  );
  const score = COMPLETENESS_CRITERIA.reduce(
    (sum, [points, isMet]) => (isMet(vkb) ? sum + points : sum),
    0,
  );
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
    const incomingDerived = !!dd214Data.entryDateDerived;
    // A calculated (derived) guess must never displace an entryDate this
    // VKB already holds as authoritative (entryDateDerived === false, e.g.
    // set by a VA code sheet's proven date) just because the guess happens
    // to land earlier - decision (3): a fact attaches only on a proven
    // link, never a guess, and a guess never outranks a proven fact. Two
    // real dates, or two guesses, still resolve by earliest as before.
    const currentIsAuthoritative =
      !!vkb.serviceHistory.entryDate &&
      vkb.serviceHistory.entryDateDerived === false;
    if (
      !vkb.serviceHistory.entryDate ||
      (!(incomingDerived && currentIsAuthoritative) &&
        new Date(dd214Data.entryDate) < new Date(vkb.serviceHistory.entryDate))
    ) {
      vkb.serviceHistory.entryDate = dd214Data.entryDate;
      // D-C (final10 QA, 2026-09-25): carries whether THIS entryDate was
      // calculated (separation date minus net service) rather than
      // printed on the form, so a consumer never treats a calculated
      // Guard/Reserve enlistment date the way it would a real printed
      // one - see mergeDD214RankAndCharacter's own use of this same flag.
      vkb.serviceHistory.entryDateDerived = incomingDerived;
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
    vkb.serviceHistory.yearsOfService = Number.parseFloat(years);
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

// True when record A is later than record B: by date when both are dated,
// by pay grade when neither is, and by pay grade too when both dates land
// on the same calendar day - two records dated the same end date are
// otherwise a tie that silently kept whichever was already stored
// (observation, final9 QA, 2026-09-25), which is right on a re-scan of the
// same document but wrong when a second, more senior record shares that
// end date. Exported so other merge points (e.g. veteranProfile.js's
// service-period rank merge) can apply the same recency rule instead of
// inventing an equivalent.
export function _isLaterRecord(dateA, dateB, gradeA, gradeB) {
  if (dateA && dateB) {
    const dayA = _calendarDay(dateA);
    const dayB = _calendarDay(dateB);
    return dayA === dayB ? gradeA > gradeB : dayA > dayB;
  }
  if (dateA || dateB) return Boolean(dateA);
  return gradeA > gradeB;
}

// Observation 2 (final9/final10 QA, 2026-09-25): the first-period-rank
// check used to reuse _isLaterRecord's "having a date beats not having
// one" tie-break, which is right for the DISCHARGE case below (prefer a
// dated record over an undated guess) but backwards here: an incoming
// document with NO entryDate at all could still win and blank out a real,
// already-known earliest date, while a document that legitimately provided
// a real first entryDate (existing.firstPeriodEntryDate still unset) could
// lose to it. This is a dedicated MIN-by-date comparator instead: only a
// document that actually has an entryDate can ever claim "earliest", and it
// only wins when there is no existing dated claim or its date is genuinely
// earlier.
function _isEarlierEntryCandidate(
  existingFirstPeriodEntryDate,
  incomingEntryDate,
) {
  if (!incomingEntryDate) return false;
  if (!existingFirstPeriodEntryDate) return true;
  return (
    _calendarDay(incomingEntryDate) < _calendarDay(existingFirstPeriodEntryDate)
  );
}

function mergeDD214RankAndCharacter(vkb, dd214Data) {
  // Documents arrive in upload order, so the discharge rank comes from the
  // latest separation and firstPeriodRank from the earliest entry. Scanned
  // forms often lose those dates; then the higher pay grade wins.
  const rank = vkb.serviceHistory.rank;
  if (dd214Data.rank) {
    const grade = parsePayGrade(dd214Data.payGrade);
    if (
      !rank.discharge ||
      _isLaterRecord(
        dd214Data.separationDate,
        rank.dischargeAsOf,
        grade,
        rank.dischargeGrade ?? 0,
      )
    ) {
      rank.discharge = dd214Data.rank;
      rank.dischargeAsOf = dd214Data.separationDate || null;
      rank.dischargeGrade = grade;
    }
  }
  // D11-3 (final11 QA, 2026-09-27): a DD214's Box 4a / an NGB-22's rank
  // field is ALWAYS that document's rank as of THAT PERIOD'S OWN
  // SEPARATION - never the rank the veteran held when they entered that
  // period. The old "rank.entry" field named this value as if it were an
  // entry rank, so a veteran who, say, enlisted as a Private and made
  // Sergeant by the end of their first hitch would have that Sergeant
  // grade presented as their rank AT ENTRY - a fabricated fact this
  // pipeline never actually extracts (no document here states grade at
  // entry). Renamed to firstPeriodRank/firstPeriodEntryDate: the value is
  // exactly the same real, dated information (the earliest known period's
  // own rank field, real per D-C below), just labeled for what it actually
  // is - the rank recorded for the veteran's first known period, not the
  // rank they held when entering it. This keeps the real data (nulling it
  // would throw away a true fact) while never presenting a separation rank
  // as an entry rank.
  //
  // D-C: a document's own single rank field only proves the veteran's
  // rank as of THAT field's true moment - real for a genuinely printed
  // entry date, but not for a CALCULATED one (serviceStartDateDerived):
  // an NGB-22's derived entry date is arithmetic on ITS OWN separation
  // date, and its rank field is that same document's rank as of
  // separation/report, not as of the calculated entry decades earlier.
  // Never let a derived date claim "first period" - if no genuinely dated
  // record ever contributes, firstPeriodRank correctly stays whatever it
  // already was (null, if none ever has).
  //
  // Obs 2 (final9/final10 QA; corrected in final10 QA's correctness
  // re-review, 2026-09-26): this used to run only `if (dd214Data.rank)`,
  // so a genuinely earlier, dated record that lacked a rank (a common OCR
  // miss on Box 4a) never got a chance to claim "earliest" - a LATER
  // record's rank could then wrongly stand in for firstPeriodRank. The
  // earliest dated (non-derived) record now always claims "first period",
  // whether or not it has a rank - per spec, firstPeriodRank is that
  // earliest record's own rank field, or null when that record's rank is
  // unknown.
  if (
    !dd214Data.entryDateDerived &&
    _isEarlierEntryCandidate(rank.firstPeriodEntryDate, dd214Data.entryDate)
  ) {
    rank.firstPeriodRank = dd214Data.rank || null;
    rank.firstPeriodEntryDate = dd214Data.entryDate;
    // firstPeriodEntryDate exists to pick "the earliest known period", not
    // to claim the rank held true that early - firstPeriodRank is really
    // that record's rank as of ITS OWN separation. Keep the one date that
    // is actually true of the rank value alongside it, so a future reader
    // can't pair "first period" rank with an entry date and print a rank
    // at entry this pipeline never extracted.
    rank.firstPeriodRankAsOf = dd214Data.rank
      ? dd214Data.separationDate || null
      : null;
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
  // ?? not || : a newly-known "false" (no foreign service) must overwrite
  // the existing value; only an actual null/undefined (not yet known on
  // this document) should fall back to whatever was already stored.
  vkb.serviceHistory.foreignService =
    dd214Data.foreignService ?? vkb.serviceHistory.foreignService;
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
    const existingMOS = vkb.serviceHistory.mos.some((m) => m.code === mosCode);
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
      if (code && !vkb.serviceHistory.mos.some((m) => m.code === code)) {
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
      // D12-5 (final12 QA, 2026-09-27): `award.name || award.abbreviation`
      // covered only two of the four award shapes in circulation (see
      // combatService.js's awardDisplayName) - ribbonRackData.parseDD214Text's
      // nested {award: {name}, matchedText} resolved to "", so `!awardName`
      // silently dropped the award instead of merging it.
      //
      // D12-5 residual (final12 QA re-review, 2026-09-27): awardDisplayName
      // itself has no abbreviation fallback (by design - combatService.js
      // doesn't own the two shapes that never carry one), so an extraction
      // with only an abbreviation (dd214VisionParser's {name: "", abbreviation})
      // still resolved to "" here and was silently dropped, same as base's
      // regression. Falling back to the raw abbreviation only in
      // mergeDD214Awards keeps that fallback scoped to this file's own
      // ownership rather than combatService.js's.
      const awardName = awardDisplayName(award) || award?.abbreviation || "";
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
      } else if (typeof award === "object") {
        // Combat status is sticky across documents: whichever DD214 spells
        // out the decoration establishes it, and a later record that lists
        // the same award more tersely must not retract it.
        if (award.isCombat) existingAward.isCombat = true;
        if (!award.devices?.length) return;
        // FIX-4: devices are structured {type, position} objects, not
        // strings — `.toLowerCase()` on the object itself threw a
        // TypeError. Key the dedup on type+position (not the whole
        // object) so multiple devices of the same type at different
        // positions (e.g. two bronze oak leaf clusters) aren't collapsed
        // into one.
        const existingDevices = new Set(
          (existingAward.devices || []).map((d) => `${d.type}|${d.position}`),
        );
        award.devices.forEach((d) => {
          const key = `${d.type}|${d.position}`;
          if (!existingDevices.has(key)) {
            existingAward.devices = existingAward.devices || [];
            existingAward.devices.push(d);
            existingDevices.add(key);
          }
        });
      }
    });
  }
}

// Exported so a deployments-only source (a C-File has no DD214/NGB22 fields
// of its own to merge) can call this step directly instead of going through
// mergeDD214IntoVKB, which also runs mergeDD214Documentation - filing a
// non-DD214 source as one would double-count it in vkb.metadata.
// documentCount and the "DD-214s: N" tally (S46 QA follow-up, item 5).
export function mergeDD214Deployments(vkb, dd214Data, options) {
  // ─── DEPLOYMENTS (from Block 18 / extracted) ───
  if (dd214Data.deployments && Array.isArray(dd214Data.deployments)) {
    dd214Data.deployments.forEach((dep) => {
      const location = dep.location || dep.theater || "";
      const operation = dep.operation || "";
      const startDate = _toIsoDate(dep.startDate);
      // A location match is enough when either side has no date: an
      // undated mention is either a repeat of an already-dated tour
      // (nothing to add) or fills the existing entry's still-missing
      // dates - matching only on an exact startDate string (as this used
      // to) meant a bare re-mention of an already-dated tour was saved as
      // a second, dateless entry instead. A genuinely different startDate
      // for the same location still creates a new entry (a real second
      // tour) - but a startDate a few days off the one on file (two scans
      // of the same tour) is still the same tour, not a second one, same
      // tolerance isSameServicePeriod uses for service periods.
      const match = vkb.serviceHistory.deployments.find(
        (d) =>
          (d.location || "").toLowerCase() === location.toLowerCase() &&
          (!d.startDate || !startDate || isSameDate(d.startDate, startDate)),
      );
      if (match) {
        if (!match.startDate && startDate) match.startDate = startDate;
        if (!match.endDate && dep.endDate) {
          match.endDate = _toIsoDate(dep.endDate);
        }
        // N6 (final8 QA, 2026-09-24): recomputed on every merge (not just
        // OR'd in) so a stale `true` from before the designation table
        // existed, or one that predates a later date correction, gets
        // corrected on re-import instead of persisting forever - same
        // date-aware rule musterCallProcessor's own saveDeploymentsToProfile
        // uses, shared via dateUtils.isDesignatedCombatZone.
        const recomputedCombat =
          isDesignatedCombatZone(
            location.toUpperCase(),
            match.startDate || startDate,
          ) || !!dep.isHazardous;
        if (recomputedCombat !== match.combatZone) {
          match.combatZone = recomputedCombat;
        }
        return;
      }
      if (location || operation) {
        vkb.serviceHistory.deployments.push({
          location,
          startDate,
          endDate: _toIsoDate(dep.endDate),
          combatZone:
            isDesignatedCombatZone(location.toUpperCase(), startDate) ||
            !!dep.isHazardous,
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

// D-C (final10 QA, 2026-09-25; corrected in final10 QA's correctness
// re-review, 2026-09-26): a National Guard/Reserve ENLISTMENT is not
// "entered active duty" - years without evidence between drill weekends is
// normal for that component, not the start of a continuous-service
// expectation the way a real active-duty entry is. Component alone can't
// tell the two apart: _resolveComponentFromDocument tags component
// "National Guard"/"Reserve" on ANY document for that member, including a
// real Title-10 mobilization DD214 whose Box 12a prints a genuine
// active-duty entry - keying on component relabeled every one of those as
// an enlistment and dropped it from gap detection. An enlistment record is
// the NGB-22 ITSELF (formType), or a calculated (entryDateDerived) entry
// date - a real DD214 is neither, regardless of the veteran's component.
/**
 * Pure builder for a single "when did service begin" timeline event -
 * shared by the DD214 merge path above (_serviceEntryTimelineEvent) and
 * the ADR-007 VKB projection (projectServiceEntryIntoVkb), so both ever
 * produce the exact same label/description for the same facts. "(calculated)"
 * appears only when `derived`; a Code Sheet period (formType !== 'NGB22',
 * never derived) always gets the "Entered active duty" label.
 */
export function buildServiceEntryTimelineEvent({
  date,
  branch,
  component,
  formType,
  derived,
  source,
}) {
  const resolvedBranch = branch || "Military";
  const isEnlistmentRecord = formType === "NGB22" || !!derived;
  const eventType = isEnlistmentRecord ? "guard_enlistment" : "service_entry";
  const componentSuffix = component ? ` ${component}` : "";
  const label = isEnlistmentRecord
    ? `Enlisted (${resolvedBranch}${componentSuffix})`
    : `Entered active duty (${resolvedBranch})`;
  return {
    date,
    eventType,
    description: derived ? `${label} (calculated)` : label,
    derived: !!derived,
    source: source || "DD-214",
    significance: "service_milestone",
  };
}

function _serviceEntryTimelineEvent(dd214Data, vkb, options) {
  return buildServiceEntryTimelineEvent({
    date: dd214Data.entryDate,
    branch: dd214Data.branch || vkb.serviceHistory.branch,
    component: dd214Data.component,
    formType: dd214Data.formType,
    derived: dd214Data.entryDateDerived,
    source: options.fileName,
  });
}

// Exported for the same reason mergeDD214Deployments is (N2, final8 QA,
// 2026-09-24): a deployments-only C-File source needs the evidence-timeline
// entries too, without running mergeDD214IntoVKB's mergeDD214Documentation
// step, which would file the C-File a second time as a fabricated DD-214.
function _isServiceEntryEventType(eventType) {
  return eventType === "guard_enlistment" || eventType === "service_entry";
}

// A correction re-processes the SAME document (Muster Call's Verify & Save,
// or a later re-import) with a new date for this single "when did service
// begin" event - not a genuinely separate enlistment. The generic
// (date, eventType) dedup below only catches an EXACT repeat, so a
// corrected date left the original, un-corrected guess sitting on the
// timeline as a second "Enlisted ... (calculated)" entry. Matches on
// EITHER service-entry eventType (not just the incoming entry's own) since
// _serviceEntryTimelineEvent's derived flag flipping false can itself
// change which of the two labels a re-scan of a non-NGB22 document gets.
function _upsertServiceEntryTimelineEvent(vkb, entry, sourceKey) {
  const existingIndex = vkb.evidenceTimeline.findIndex(
    (e) => _isServiceEntryEventType(e.eventType) && e.source === sourceKey,
  );
  if (existingIndex === -1) return false;
  vkb.evidenceTimeline[existingIndex] = entry;
  return true;
}

export function mergeDD214EvidenceTimeline(vkb, dd214Data, options) {
  // ─── EVIDENCE TIMELINE ───
  const timelineEntries = [];
  if (dd214Data.entryDate) {
    timelineEntries.push(_serviceEntryTimelineEvent(dd214Data, vkb, options));
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
          date: _toIsoDate(dep.startDate),
          eventType: "deployment",
          description: `Deployed to ${dep.location || dep.operation || "overseas"}`,
          source: options.fileName || "DD-214",
          significance: "combat_exposure",
        });
      }
    });
  }

  // Add timeline entries (avoid duplicates)
  const sourceKey = options.fileName || "DD-214";
  timelineEntries.forEach((entry) => {
    if (
      _isServiceEntryEventType(entry.eventType) &&
      _upsertServiceEntryTimelineEvent(vkb, entry, sourceKey)
    ) {
      return;
    }
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
  // Field names here are serviceStartDate/serviceEndDate (the naming
  // convention used everywhere else going forward — matches the parser
  // and profile/UI). Legacy vkb.serviceHistory.servicePeriods[] entries
  // written under entryDate/separationDate are renamed by
  // migrateOffSchemaVKB, not here.
  const { mosCode, mosTitle } = deriveDD214MOS(dd214Data);
  if (!vkb.serviceHistory.servicePeriods)
    vkb.serviceHistory.servicePeriods = [];

  const shared = {
    branch: dd214Data.branch || vkb.serviceHistory.branch,
    rank: dd214Data.rank || "",
    payGrade: dd214Data.payGrade || "",
    mos: mosCode || "",
    mosTitle: mosTitle || "",
    source: options.fileName || "DD-214",
  };
  // C1 bug fix: previously required BOTH dates, silently dropping any
  // period where only one date was extractable. Key on whichever date(s)
  // are available and flag incomplete when only one is present.
  if (dd214Data.entryDate || dd214Data.separationDate) {
    _upsertVkbServicePeriod(vkb, {
      ...shared,
      serviceStartDate: dd214Data.entryDate || null,
      // D-C: carries the same calculated-vs-printed flag entryDate itself
      // carries at vkb.serviceHistory.entryDateDerived (mergeDD214ServiceDates
      // above), so buildServicePeriodsAndSeparationContext's "Period N:" line
      // can mark it too - Box 18 additionalPeriods below are always real
      // printed sub-period dates and never get this flag.
      serviceStartDateDerived: !!dd214Data.entryDateDerived,
      serviceEndDate: dd214Data.separationDate || null,
      component: dd214Data.component || "",
      characterOfService: dd214Data.characterOfService || "",
    });
  }
  // A scanned form often loses Box 12's dates while its remarks (the NGB-22's
  // Box 18 date ranges) still list every period.
  // Rank, grade and MOS on the form belong to its final period, not to the
  // earlier ones its remarks list.
  for (const period of dd214Data.additionalPeriods || []) {
    _upsertVkbServicePeriod(vkb, {
      branch: shared.branch,
      source: shared.source,
      serviceStartDate: period.serviceStartDate
        ? _calendarDay(period.serviceStartDate)
        : null,
      serviceEndDate: period.serviceEndDate
        ? _calendarDay(period.serviceEndDate)
        : null,
      component: period.component || "",
      characterOfService: "",
    });
  }
}

/**
 * VA's code sheet lists every active-duty period with its character of
 * discharge. Its dates win over a form's when the two describe the same
 * period a few days apart.
 */
export const mergeServicePeriodsIntoVKB = (vkb, periods, options = {}) => {
  vkb.serviceHistory ??= {};
  vkb.serviceHistory.servicePeriods ??= [];
  for (const p of periods || []) {
    _upsertVkbServicePeriod(
      vkb,
      {
        serviceStartDate: p.entryDate,
        serviceEndDate: p.separationDate,
        branch: p.branch || vkb.serviceHistory.branch || "",
        characterOfService: p.characterOfDischarge || "",
        source: options.fileName || "VA code sheet",
      },
      { authoritativeDates: true },
    );
  }
  _adoptEarliestCodeSheetEntry(vkb, periods);
  return vkb;
};

// A code-sheet-only veteran (no DD214/NGB-22 ever processed) never gets a
// top-level entryDate/separationDate from mergeDD214ServiceDates, so
// buildServiceHistoryCoreContext's "Service:" line and VKBViewer's own
// top-level display stayed empty even though the period itself was already
// stored. Only fires when the top-level field is still completely unset, so
// it can never override a value a DD214/NGB-22 or an earlier code sheet
// already established - never a guess, since these are the code sheet's own
// printed dates.
function _adoptEarliestCodeSheetEntry(vkb, periods) {
  const complete = (periods || []).filter(
    (p) => p.entryDate && p.separationDate,
  );
  if (complete.length === 0) return;
  if (!vkb.serviceHistory.entryDate) {
    const earliest = complete.reduce((min, p) =>
      new Date(p.entryDate) < new Date(min.entryDate) ? p : min,
    );
    vkb.serviceHistory.entryDate = earliest.entryDate;
    vkb.serviceHistory.entryDateDerived = false;
  }
  if (!vkb.serviceHistory.separationDate) {
    const latest = complete.reduce((max, p) =>
      new Date(p.separationDate) > new Date(max.separationDate) ? p : max,
    );
    vkb.serviceHistory.separationDate = latest.separationDate;
  }
}

function _findExistingVkbPeriod(periods, period, complete) {
  return (
    periods.find(
      (p) =>
        p.serviceStartDate === period.serviceStartDate &&
        p.serviceEndDate === period.serviceEndDate,
    ) ||
    (complete &&
      periods.find((p) =>
        isSameServicePeriod(
          p.serviceStartDate,
          p.serviceEndDate,
          period.serviceStartDate,
          period.serviceEndDate,
        ),
      ))
  );
}

// serviceStartDateDerived describes THIS existing period's start date, not
// whatever a lower-confidence merge happens to carry - only adopt an
// incoming derived flag when the start date itself was missing (a genuine
// fill). Handled separately from the generic fill loop so a non-derived flag
// an authoritative correction already cleared is never silently re-set to
// true by a later, non-authoritative merge finding it "empty".
function _fillVkbPeriodFields(existing, period) {
  const startDateWasMissing = !existing.serviceStartDate;
  for (const [field, value] of Object.entries(period)) {
    if (field === "serviceStartDateDerived") continue;
    if (value && !existing[field]) existing[field] = value;
  }
  if (startDateWasMissing && period.serviceStartDateDerived !== undefined) {
    existing.serviceStartDateDerived = !!period.serviceStartDateDerived;
  }
}

// Proven link to the top-level singular field (buildServiceHistoryCoreContext's
// "Service:" line, VKBViewer's own display): only true when THIS period's
// pre-correction start date is the exact one currently mirrored there AND
// this period is itself the one that carries the derived flag - Box-18 IADT
// windows never get serviceStartDateDerived set at all
// (mergeDD214ServicePeriodTracking never sets it on additionalPeriods), so
// without this a window sharing the primary period's start date could
// misattribute its own correction to the top-level entry.
function _applyAuthoritativeCorrection(vkb, existing, period) {
  const correctsTopLevelEntry =
    vkb.serviceHistory.entryDateDerived &&
    existing.serviceStartDateDerived === true &&
    existing.serviceStartDate === vkb.serviceHistory.entryDate;
  existing.serviceStartDate = period.serviceStartDate;
  existing.serviceEndDate = period.serviceEndDate;
  // The VA code sheet's own dates are never a calculated guess - clear any
  // stale flag a prior NGB-22 merge left on this same period so the
  // now-authoritative date doesn't keep reading as "calculated".
  existing.serviceStartDateDerived = false;
  existing.incomplete = false;
  existing.datesVerifiedBy = period.source;
  if (correctsTopLevelEntry) {
    vkb.serviceHistory.entryDate = period.serviceStartDate;
    vkb.serviceHistory.entryDateDerived = false;
  }
}

function _upsertVkbServicePeriod(vkb, period, { authoritativeDates } = {}) {
  const periods = vkb.serviceHistory.servicePeriods;
  const complete = Boolean(period.serviceStartDate && period.serviceEndDate);
  const existing = _findExistingVkbPeriod(periods, period, complete);
  if (!existing) {
    const fresh = { ...period, incomplete: !complete };
    // A brand-new period from an authoritative source (the code sheet
    // itself, with nothing to correct yet) is never a calculated guess -
    // matches the flags an authoritative CORRECTION sets below, so a code
    // sheet processed before any DD214/NGB-22 doesn't leave its own period
    // looking unverified.
    if (authoritativeDates && complete) {
      fresh.serviceStartDateDerived = false;
      fresh.datesVerifiedBy = period.source;
    }
    periods.push(fresh);
    return;
  }
  _fillVkbPeriodFields(existing, period);
  if (authoritativeDates && complete) {
    _applyAuthoritativeCorrection(vkb, existing, period);
  }
}

// ============================================================================
// ADR-007: the service-entry subset of the VKB is a PROJECTION of shape 1
// (servicePeriods[]), applied at read time (loadVKB) and write time
// (saveVKB) so storage itself converges. Pure - the caller persists.
// ============================================================================

function _hasServiceEntrySnapshot(vkb) {
  return !!vkb.serviceHistory.preProjectionSnapshot;
}

function _takeServiceEntrySnapshot(vkb) {
  if (_hasServiceEntrySnapshot(vkb)) return;
  vkb.serviceHistory.preProjectionSnapshot = {
    takenAt: new Date().toISOString(),
    entryDate: vkb.serviceHistory.entryDate ?? null,
    entryDateDerived: !!vkb.serviceHistory.entryDateDerived,
    servicePeriods: structuredClone(vkb.serviceHistory.servicePeriods || []),
    serviceEntryEvents: structuredClone(
      vkb.evidenceTimeline.filter(_isServiceEntryEvent),
    ),
  };
}

function _isServiceEntryEvent(e) {
  return e.eventType === "guard_enlistment" || e.eventType === "service_entry";
}

function _projectServiceEntryTopLevel(vkb, entry) {
  if (!entry.date) return false;
  const changed =
    vkb.serviceHistory.entryDate !== entry.date ||
    !!vkb.serviceHistory.entryDateDerived !== !!entry.derived ||
    vkb.serviceHistory.entrySource !== entry.source ||
    vkb.serviceHistory.entryPeriodId !== entry.periodId;
  vkb.serviceHistory.entryDate = entry.date;
  vkb.serviceHistory.entryDateDerived = entry.derived;
  vkb.serviceHistory.entrySource = entry.source;
  vkb.serviceHistory.entryPeriodId = entry.periodId;
  if (vkb.serviceHistory.separationDate) {
    const years =
      (new Date(vkb.serviceHistory.separationDate) - new Date(entry.date)) /
      (365.25 * 24 * 60 * 60 * 1000);
    vkb.serviceHistory.yearsOfService = Number.parseFloat(years.toFixed(1));
  }
  return changed;
}

// A VKB row V links to canonical period C by the first rule that matches:
// (a) an already-recorded canonicalPeriodId, (b) the ends are calendar-equal
// and V's start matches C's effective start or its correction's documentDate,
// (c) C is non-window, V's own source names a document C is proven to come
// from, and the ends are calendar-equal. A row whose canonicalPeriodId names
// a period that no longer exists is dropped, not kept as VKB-only.
function _linkVkbRowToPeriod(v, canonicalPeriods) {
  if (v.canonicalPeriodId) {
    return {
      period:
        canonicalPeriods.find((c) => c.id === v.canonicalPeriodId) || null,
      hadId: true,
    };
  }
  const byDate = canonicalPeriods.find(
    (c) =>
      isSameCalendarDay(v.serviceEndDate, c.serviceEndDate) &&
      (isSameCalendarDay(v.serviceStartDate, c.serviceStartDate) ||
        isSameCalendarDay(
          v.serviceStartDate,
          c.startDateCorrection?.documentDate,
        )),
  );
  if (byDate) return { period: byDate, hadId: false };
  const bySource = canonicalPeriods.find(
    (c) =>
      c.periodScope !== "window" &&
      !!v.source &&
      documentSources(c).includes(v.source) &&
      isSameCalendarDay(v.serviceEndDate, c.serviceEndDate),
  );
  return { period: bySource || null, hadId: false };
}

function _buildProjectedPeriodRow(period, linkedRows) {
  const verified = linkedRows.find((v) => v.datesVerifiedBy);
  return {
    serviceStartDate: period.serviceStartDate,
    serviceStartDateDerived: !!period.serviceStartDateDerived,
    serviceStartDateSource: period.serviceStartDateSource ?? null,
    serviceEndDate: period.serviceEndDate,
    branch: period.branch,
    component: period.component,
    rank: period.rank,
    payGrade: period.payGrade,
    mos: period.mos,
    mosTitle: period.mosTitle,
    characterOfService: period.characterOfService,
    source: period.sourceDocument || "Veteran entry",
    incomplete: !!period.incomplete,
    periodScope: period.periodScope ?? null,
    canonicalPeriodId: period.id,
    ...(verified ? { datesVerifiedBy: verified.datesVerifiedBy } : {}),
  };
}

function _sortByStartAscending(rows) {
  rows.sort((a, b) => {
    if (!a.serviceStartDate) return 1;
    if (!b.serviceStartDate) return -1;
    return a.serviceStartDate.localeCompare(b.serviceStartDate);
  });
  return rows;
}

function _linkAndFoldPeriods(vkbRows, canonicalPeriods) {
  const rowsByPeriodId = new Map();
  const vkbOnly = [];
  vkbRows.forEach((v) => {
    const { period, hadId } = _linkVkbRowToPeriod(v, canonicalPeriods);
    if (period) {
      if (!rowsByPeriodId.has(period.id)) rowsByPeriodId.set(period.id, []);
      rowsByPeriodId.get(period.id).push(v);
    } else if (!hadId) {
      const clone = { ...v };
      if (clone.datesVerifiedBy && clone.serviceStartDateDerived) {
        clone.serviceStartDateDerived = false;
      }
      vkbOnly.push(clone);
    }
    // hadId && !period: the linked canonical period no longer exists - drop.
  });
  const projected = canonicalPeriods
    .filter((p) => p.serviceStartDate || p.serviceEndDate)
    .map((p) => _buildProjectedPeriodRow(p, rowsByPeriodId.get(p.id) || []));
  return _sortByStartAscending([...projected, ...vkbOnly]);
}

// Item 3 (final13 QA re-review, 2026-09-28; resolved final14 QA,
// 2026-09-28): a period's STORED formType is allowed to move on to a
// later, higher-confidence document (e.g. Code Sheet legitimately
// relabeling an uncorrected NGB-22 period - veteranProfile.js's N1b) -
// that's real provenance, not a bug, and the raw field stays exactly as
// N1b leaves it (musterCallProcessor.servicePeriodMerge.test.js pins this).
// But neither the projected timeline event's enlistment-vs-active-duty
// classification NOR the human/AI-facing DOCUMENT LABEL should follow that
// same race: an NGB-22 having ever proven this period is a real
// Guard/Reserve enlistment is durable regardless of which document later
// becomes the period's raw stored formType/sourceDocument via N1b's
// confidence race - musterCallProcessor.js's _addSource keeps every prior
// contributor in `sources[]`, additive, never overwritten, so this reads
// as "NGB22" independent of import order. Used for BOTH the gap-detection
// classification below and periodDisplayFormType (the read-only label
// shown in the Service tab / My Packet / any AI context) - never for the
// mutable form-type editor control, which must keep binding to the raw
// stored value the veteran is actually editing.
function _enlistmentClassificationFormType(p) {
  if (p.formType === "NGB22") return "NGB22";
  const everNGB22 = (p.sources || []).some((s) => s.formType === "NGB22");
  return everNGB22 ? "NGB22" : p.formType;
}

/**
 * The document label to SHOW a veteran or an AI for a service period -
 * order-independent (see _enlistmentClassificationFormType above). Distinct
 * from `period.formType` itself, which stays a mutable, import-order-
 * sensitive provenance field editors read/write directly.
 * @param {Object} period
 * @returns {string|undefined}
 */
export function periodDisplayFormType(period) {
  return _enlistmentClassificationFormType(period);
}

// Exported (D13-2 follow-up): veteranProfile.js's saveServiceHistory needs
// this same pure projection, synchronously and without touching the VKB/
// IndexedDB, to keep the vet_rate_timeline_events store itself in sync with
// every service-entry correction - not just while EvidenceTimeline.jsx
// happens to be mounted. See _syncTimelineEventsWithServiceEntryProjection.
export function _buildProjectedEntryEvents(canonicalPeriods) {
  return canonicalPeriods
    .filter((p) => p.periodScope !== "window" && p.serviceStartDate)
    .map((p) => ({
      ...buildServiceEntryTimelineEvent({
        date: p.serviceStartDate,
        branch: p.branch,
        component: p.component,
        formType: _enlistmentClassificationFormType(p),
        derived: p.serviceStartDateDerived,
        source: p.sourceDocument || "Veteran entry",
      }),
      projected: true,
      projectionKey: `entry:${p.id}`,
    }));
}

function _projectTimeline(vkb, canonicalPeriods, knownSources) {
  const projectedEvents = _buildProjectedEntryEvents(canonicalPeriods);
  const survivors = vkb.evidenceTimeline.filter((e) => {
    if (!_isServiceEntryEvent(e)) return true;
    if (e.projected) return false;
    return !(e.source && knownSources.has(e.source));
  });
  const deduped = survivors.filter((e) => {
    if (!_isServiceEntryEvent(e)) return true;
    return !projectedEvents.some(
      (p) => p.eventType === e.eventType && isSameCalendarDay(p.date, e.date),
    );
  });
  vkb.evidenceTimeline = [...deduped, ...projectedEvents];
  vkb.evidenceTimeline.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });
}

/**
 * ADR-007 §2.6: pure projection of the service-entry subset of shape 1
 * (`view`, built by serviceEntryView.js's buildServiceEntryView) onto a VKB
 * object - top-level entry fields, linked/folded period rows, and the
 * evidence-timeline entry events. No-op on a metadata-only cache object
 * (no serviceHistory/evidenceTimeline array at all).
 * @returns {{changed: boolean}}
 */
export function projectServiceEntryIntoVkb(vkb, view) {
  if (!vkb?.serviceHistory || !Array.isArray(vkb.evidenceTimeline)) {
    return { changed: false };
  }
  vkb.serviceHistory.servicePeriods ??= [];

  const willChange =
    !!view.entry.date &&
    (vkb.serviceHistory.entryDate !== view.entry.date ||
      !!vkb.serviceHistory.entryDateDerived !== !!view.entry.derived ||
      vkb.serviceHistory.entrySource !== view.entry.source);
  if (willChange) _takeServiceEntrySnapshot(vkb);

  const topChanged = _projectServiceEntryTopLevel(vkb, view.entry);
  vkb.serviceHistory.servicePeriods = _linkAndFoldPeriods(
    vkb.serviceHistory.servicePeriods,
    view.periods,
  );
  _projectTimeline(vkb, view.periods, view.knownSources);

  return { changed: topChanged || willChange };
}

let _serviceEntryViewModulePromise = null;
function _loadServiceEntryViewModule() {
  _serviceEntryViewModulePromise ??= import("./serviceEntryView");
  return _serviceEntryViewModulePromise;
}

let _projectionErrorLogged = false;

/**
 * ADR-007 §8.4: runs the one-time legacy adoption (guarded by
 * metadata.migratedServiceEntryProjection) then the projection itself.
 * Fails open - a projection error never blocks a VKB read/write, it just
 * leaves the VKB unprojected for this one call.
 */
export async function _applyServiceEntryProjection(vkb) {
  try {
    const view = await _loadServiceEntryViewModule();
    vkb.metadata = vkb.metadata || {};
    if (!vkb.metadata.migratedServiceEntryProjection) {
      view.adoptLegacyVkbEntryEdits({
        entryDate: vkb.serviceHistory?.entryDate ?? null,
        entryDateDerived: !!vkb.serviceHistory?.entryDateDerived,
        servicePeriods: vkb.serviceHistory?.servicePeriods ?? [],
        source: vkb.serviceHistory?.source ?? null,
      });
      vkb.metadata.migratedServiceEntryProjection = true;
    }
    projectServiceEntryIntoVkb(vkb, view.buildServiceEntryView());
    return vkb;
  } catch (error) {
    if (!_projectionErrorLogged) {
      _projectionErrorLogged = true;
      console.error("Service entry projection failed:", error);
    }
    return vkb;
  }
}

function mergeDD214Documentation(vkb, dd214Data, options) {
  // ─── DOCUMENTATION ───
  // Muster Call already filed this document via addDocumentToVKB() ->
  // routeDocumentToVKB(), which lands DD214/NGB22/DD256/DD257 in this same
  // array. Without this guard every service record is counted twice, and a
  // re-upload adds two more each time — inflating metadata.documentCount, the
  // My Packet Documents badge, and the "DD-214s: N" line in generateLLMContext.
  const fileName = options.fileName || "DD-214";
  const alreadyFiled = vkb.documentation.dd214s.some(
    (doc) => doc.fileName === fileName,
  );
  if (alreadyFiled) return;

  vkb.documentation.dd214s.push({
    id: `dd214-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    fileName,
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
 * Exported for the same reason _isLaterRecord is - a shared recency/grade
 * tiebreak other merge points reuse rather than reimplement.
 */
export function parsePayGrade(pg) {
  if (!pg) return 0;
  const match = pg.match(/([EOW])-?(\d+)/i);
  if (!match) return 0;
  const category = match[1].toUpperCase();
  const level = Number.parseInt(match[2], 10);
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
      const existingCondition = vkb.medicalConditions.current.some(
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

// "September 15, 2023" / "2023-09-15" → "2023-09-15" whatever the time zone.
// N7 (final8 QA, 2026-09-24): used to delegate to conditionName's
// calendarDay, whose own `new Date(text)` fallback is as lenient as
// Date.parse - "SINAI 12" (or "SINAI 2004", "NGB FORM 2022") parsed as a
// real, wrong date instead of failing. Delegates to
// dateUtils.parseExplicitDate instead, shared with musterCallProcessor's
// own _toISODateString so both close the same gap from one implementation.
function _toIsoDate(value) {
  return parseExplicitDate(value);
}

const RATING_OUTCOME_LABELS = {
  increased: "Rating increased",
  decreased: "Rating decreased",
  reduced: "Rating reduced",
  continued: "Rating continued",
  "confirmed and continued": "Rating continued",
  code_sheet: "Rating on VA code sheet",
};

/**
 * Merge a parsed rating decision (or a decision-bearing claim letter) into the
 * VKB: rated conditions upsert into medicalConditions.current keyed by
 * normalized name, every rating is recorded in vaClaimsHistory.ratings with a
 * dated evidence-timeline event, denials go to vaClaimsHistory.claims, and the
 * combined rating plus its history table land on vaClaimsHistory.
 */
function _ensureRatingDecisionShape(vkb) {
  vkb.medicalConditions ??= {
    current: [],
    past: [],
    secondary: [],
    presumptive: [],
  };
  vkb.medicalConditions.current ??= [];
  vkb.vaClaimsHistory ??= { claims: [], ratings: [], appeals: [] };
  vkb.vaClaimsHistory.ratings ??= [];
  vkb.vaClaimsHistory.claims ??= [];
  vkb.evidenceTimeline ??= [];
}

function _normalizeRatedConditions(decisionData) {
  const conditions = Array.isArray(decisionData.conditions)
    ? decisionData.conditions
    : [];
  return conditions
    .map((c) => {
      const pct = Number(c.rating ?? c.ratedPercentage ?? c.percentage);
      return {
        name: c.name || c.condition,
        percentage: Number.isFinite(pct) ? pct : null,
        effectiveDate: c.effectiveDate || decisionData.effectiveDate || null,
        diagnosticCode: c.diagnosticCode || null,
        outcome: c.outcome || "granted",
      };
    })
    .filter((c) => c.name && c.percentage !== null);
}

function _upsertRatedCondition(vkb, c, source) {
  const existing = findRatedConditionMatch(
    vkb.medicalConditions.current,
    c.name,
    (e) => e.name,
  );
  if (existing) {
    if (
      isOlderDecision(c.effectiveDate, existing.effectiveDate) ||
      isSupersededName(existing.name, c.name)
    ) {
      return;
    }
    if (
      normalizeConditionName(existing.name) !== normalizeConditionName(c.name)
    ) {
      existing.name = c.name;
    }
    existing.ratedPercentage = c.percentage;
    existing.serviceConnected = true;
    if (c.effectiveDate) existing.effectiveDate = c.effectiveDate;
    if (c.diagnosticCode) existing.diagnosticCode = c.diagnosticCode;
    existing.source ||= source;
    return;
  }
  vkb.medicalConditions.current.push({
    name: c.name,
    diagnosisDate: null,
    icdCode: null,
    severity: null,
    ratedPercentage: c.percentage,
    serviceConnected: true,
    effectiveDate: c.effectiveDate,
    diagnosticCode: c.diagnosticCode,
    source,
  });
}

function _recordRating(vkb, c, combinedRating, source) {
  const key = normalizeConditionName(c.name);
  const alreadyRecorded = vkb.vaClaimsHistory.ratings.some(
    (r) =>
      normalizeConditionName(r.condition) === key &&
      r.effectiveDate === c.effectiveDate &&
      r.percentage === c.percentage,
  );
  if (alreadyRecorded) return;
  vkb.vaClaimsHistory.ratings.push({
    condition: c.name,
    percentage: c.percentage,
    effectiveDate: c.effectiveDate,
    outcome: c.outcome,
    combinedRating: combinedRating ?? null,
    source,
  });
}

// A code sheet restates ratings the letters already announced. Its event is
// kept only when no letter recorded that condition's rating on that day, and
// a letter's event replaces the code sheet's.
function _pushRatingTimelineEvent(vkb, c, source) {
  if (!c.effectiveDate) return;
  const label =
    RATING_OUTCOME_LABELS[c.outcome] || "Service connection granted";
  const description = `${label}: ${c.name} (${c.percentage}%)`;
  const date = _toIsoDate(c.effectiveDate);
  const conditionKey = primaryConditionKey(c.name);
  const sameDay = (e) =>
    e.eventType === "rating_decision" &&
    e.date === date &&
    e.conditionKey === conditionKey;
  if (
    vkb.evidenceTimeline.some(
      (e) => e.description === description && e.date === date,
    )
  ) {
    return;
  }
  if (c.outcome === "code_sheet" && vkb.evidenceTimeline.some(sameDay)) return;
  if (c.outcome !== "code_sheet") {
    vkb.evidenceTimeline = vkb.evidenceTimeline.filter(
      (e) => !(sameDay(e) && e.fromCodeSheet),
    );
  }
  vkb.evidenceTimeline.push({
    date,
    eventType: "rating_decision",
    description,
    source,
    significance: "rating",
    conditionKey,
    ...(c.outcome === "code_sheet" && { fromCodeSheet: true }),
  });
}

function _pushTimelineEvent(vkb, entry) {
  const duplicate = vkb.evidenceTimeline.some(
    (e) => e.date === entry.date && e.eventType === entry.eventType,
  );
  if (!duplicate) vkb.evidenceTimeline.push(entry);
}

const SAME_DECISION_DAYS = 14;

// The same denial reaches the VKB from its letter (dated when mailed) and
// from the code sheet (dated when decided), a few days apart. A denial of the
// same condition years later is a separate decision and is kept.
function _isKnownDenial(vkb, name, decisionDate, source) {
  const key = normalizeConditionName(name);
  const day = Date.parse(calendarDay(decisionDate) ?? "");
  return vkb.vaClaimsHistory.claims.some((cl) => {
    if (cl.status !== "denied") return false;
    if (!(cl.conditions || []).some((n) => normalizeConditionName(n) === key)) {
      return false;
    }
    if (cl.source === source) return true;
    const other = Date.parse(calendarDay(cl.decisionDate) ?? "");
    if (!Number.isFinite(day) || !Number.isFinite(other)) return false;
    return Math.abs(day - other) <= SAME_DECISION_DAYS * 86400000;
  });
}

function _recordDenials(vkb, decisionData, source) {
  const decisions = Array.isArray(decisionData.decisions)
    ? decisionData.decisions
    : [];
  const denied = decisionData.deniedConditions?.length
    ? decisionData.deniedConditions
    : decisions
        .filter((d) => d.outcome === "denied" && !d.issue)
        .map((d) => d.condition);
  // A code sheet lists each denial with its own original denial date.
  for (const entry of denied) {
    const name = typeof entry === "string" ? entry : entry?.name;
    if (!name) continue;
    const decisionDate =
      (typeof entry === "string" ? null : entry.decisionDate) ||
      decisionData.decisionDate ||
      null;
    if (_isKnownDenial(vkb, name, decisionDate, source)) continue;
    vkb.vaClaimsHistory.claims.push({
      claimNumber: decisionData.claimNumber || null,
      filedDate: null,
      status: "denied",
      decision: "denied",
      decisionDate,
      conditions: [name],
      source,
    });
  }
}

// Letters are processed in upload order, not date order, so the newest
// letter's stated combined rating must not be overwritten by an older one.
// An undated letter never replaces a dated one.
function _recordStatedCombinedRating(vkb, decisionData, source) {
  const combined = Number(decisionData.combinedRating);
  if (!Number.isFinite(combined)) return;
  const history = vkb.vaClaimsHistory;
  const incomingDate = decisionData.decisionDate || null;
  const savedDate = history.currentCombinedRatingDate || null;
  if (
    savedDate &&
    (!incomingDate || isOlderDecision(incomingDate, savedDate))
  ) {
    return;
  }
  history.currentCombinedRating = combined;
  history.currentCombinedRatingDate = incomingDate;
  history.currentCombinedRatingDateKind = decisionData.decisionDateKind || null;
  history.currentCombinedRatingSource = source;
}

export const mergeRatingDecisionIntoVKB = (vkb, decisionData, options = {}) => {
  if (!decisionData || typeof decisionData !== "object") return vkb;
  const source = options.fileName || "Rating Decision";
  _ensureRatingDecisionShape(vkb);

  for (const c of _normalizeRatedConditions(decisionData)) {
    _upsertRatedCondition(vkb, c, source);
    _recordRating(vkb, c, decisionData.combinedRating, source);
    _pushRatingTimelineEvent(vkb, c, source);
  }
  _recordDenials(vkb, decisionData, source);

  _recordStatedCombinedRating(vkb, decisionData, source);
  for (const event of decisionData.recordEvents || []) {
    _pushTimelineEvent(vkb, { ...event, source, significance: "claim" });
  }
  if (decisionData.servicePeriods?.length > 0) {
    mergeServicePeriodsIntoVKB(vkb, decisionData.servicePeriods, {
      fileName: source,
    });
  }
  if (decisionData.combinedRatingHistory?.length > 0) {
    vkb.vaClaimsHistory.combinedRatingHistory = _mergeCombinedHistory(
      vkb.vaClaimsHistory.combinedRatingHistory,
      decisionData.combinedRatingHistory,
    );
  }
  dropSupersededConditions(vkb.medicalConditions.current, (c) => c.name);
  return vkb;
};

// Each letter or code sheet prints only part of the combined-rating history
// (the code sheet leaves out a row the letters print), so rows from every
// source are kept, one per effective day, in date order.
function _mergeCombinedHistory(existing, incoming) {
  const byDay = new Map();
  for (const row of [...(existing || []), ...incoming]) {
    const key = _calendarDay(row.effectiveDate);
    if (!byDay.has(key)) byDay.set(key, row);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => row);
}

function _calendarDay(value) {
  return calendarDay(value) ?? String(value ?? "");
}

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

// Owner decision D (2026-09-28, ADR-008): no AI context may ever contain a
// direct veteran identifier - full/partial name, DOB, SSN (any part), VA
// file number, address, phone, or email. This function is the historical
// location those fields were rendered from (name/DOB/SSN(last4)/address);
// kept as a deliberate no-op, not deleted, so a future edit that wants to
// add veteran identity back to the AI context has to consciously remove
// this comment first. No live consumer needs age from this - if one ever
// does, add ONLY a whole-year age computed from dateOfBirth, never the DOB
// itself.
function buildPersonalContext() {
  return "";
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
    context += `Service: ${vkb.serviceHistory.entryDate}`;
    // D-C: entryDateDerived means this entry date is arithmetic (separation
    // minus net service), not a printed NGB-22 date - every consumer of
    // generateLLMContext (AI tools, VKBViewer's own "Show LLM Context")
    // must see the same qualifier _serviceEntryTimelineEvent already puts
    // on the matching evidence-timeline entry below.
    if (vkb.serviceHistory.entryDateDerived) {
      context += " (calculated from net service)";
    }
    context += ` to ${vkb.serviceHistory.separationDate}`;
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
    const mosList = vkb.serviceHistory.mos.map((m) =>
      m.title ? `${m.code} (${m.title})` : m.code,
    );
    context += `MOS: ${mosList.join(", ")}\n`;
  }
  if (vkb.serviceHistory.characterOfService) {
    context += `Discharge: ${vkb.serviceHistory.characterOfService}\n`;
  }
  return context;
}

function buildServicePeriodsAndSeparationContext(vkb) {
  let context = "";

  // Service periods (multi-DD214). D11-6: gated on 2+ periods before, so a
  // single-period veteran's "Service:" line (buildServiceHistoryCoreContext)
  // and this "Period 1:" line could show different dates/markers with no
  // way to tell they described the same period - always list what's there.
  if (vkb.serviceHistory.servicePeriods?.length > 0) {
    context += "\nService Periods:\n";
    vkb.serviceHistory.servicePeriods.forEach((p, i) => {
      const note = p.serviceStartDateDerived
        ? " (calculated from net service)"
        : "";
      // D13-7: a Box-18 sub-period (branch known, rank/MOS not individually
      // tracked) used to print "Army  ()" - the blank rank left a double
      // space, and the blank MOS left an empty, meaningless "()". Omit
      // each empty part instead of printing its blank placeholder.
      const branchRank = [p.branch, p.rank].filter(Boolean).join(" ");
      const mosPart = p.mos ? ` (${p.mos})` : "";
      const detail = branchRank ? ` - ${branchRank}${mosPart}` : mosPart;
      // F8 (final13 QA re-review, 2026-09-28): serviceStartDate/serviceEndDate
      // were interpolated unguarded - a still-serving veteran's open-ended
      // period (My Packet's "+ Add Service Period", serviceEndDate: "") or a
      // DD-214 whose end date wasn't extracted (null) printed literal
      // "to null"/"undefined to ..." into every AI tool's context.
      const startPart = p.serviceStartDate || "?";
      const endPart = p.serviceEndDate || "?";
      context += `  Period ${i + 1}: ${startPart}${note} to ${endPart}${detail}\n`;
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

// D12-5 (final12 QA, 2026-09-27): FIX-4 made devices structured {type,
// position} objects everywhere they're stored, but buildAwardsContext still
// joined them as if they were strings - Array.prototype.join calls
// String(device) on each entry, printing "[object Object]" into every AI
// context that has ever included a device. Same canonical names
// ribbonRackData.js's DEVICES table uses for the ribbon UI, kept local here
// (not imported) so a plain-text AI-context builder doesn't pull in that
// module's ribbon-rendering/state-award data.
const DEVICE_LABELS = {
  bronze_star: "Bronze Service Star",
  silver_star: "Silver Service Star",
  gold_star: "Gold Service Star",
  bronze_olc: "Bronze Oak Leaf Cluster",
  silver_olc: "Silver Oak Leaf Cluster",
  v_device: "V Device (Valor)",
  c_device: "C Device (Combat)",
  r_device: "R Device (Remote)",
  m_device: "M Device (Mobilization)",
  arrowhead: "Arrowhead",
  numeral: "Numeral",
};

function _formatDevice(d) {
  if (typeof d === "string") return d;
  if (!d || typeof d !== "object") return "";
  return DEVICE_LABELS[d.type] || d.type || "";
}

function _formatAwardDevices(devices) {
  if (!devices?.length) return "";
  const names = devices.map(_formatDevice).filter(Boolean);
  return names.length ? ` (${names.join(", ")})` : "";
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
        context += `  ★ ${a.name}${_formatAwardDevices(a.devices)}\n`;
      });
    }
    otherAwards.forEach((a) => {
      context += `  • ${a.name}${_formatAwardDevices(a.devices)}\n`;
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
      const locationPart = e.location ? ` at ${e.location}` : "";
      context += `• Environmental: ${e.type}${locationPart} (${e.dates || "dates unknown"})\n`;
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

// D14-2 (final14 QA) / owner decision D: claim numbers never enter AI
// context - they identify a specific VA claim file, not a fact about the
// veteran's condition an AI tool needs to reason about. Label by condition/
// claim type and decision date instead. `claim.claimNumber` used to be
// interpolated directly, so an entry with none printed the literal string
// "Claim #null" - condition/claimType/status/decisionDate are all plain
// strings or absent (guarded below), never interpolated when falsy.
function _claimContextLabel(claim) {
  if (Array.isArray(claim.conditions) && claim.conditions.length > 0) {
    return claim.conditions.join(", ");
  }
  return claim.condition || claim.claimType || "Claim";
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
      context += `• ${_claimContextLabel(claim)}: ${claim.status || "status unknown"}`;
      const decidedOn = claim.decisionDate || claim.filedDate;
      if (decidedOn) {
        const verb = claim.decisionDate ? "decided" : "filed";
        context += ` (${verb} ${decidedOn})`;
      }
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

// D-D / ADR-008: `source` on an evidenceTimeline/keyFacts entry is
// routinely the veteran's own uploaded fileName (see mergeDD214EvidenceTimeline,
// mergeRatingDecisionIntoVKB) - real exported VA documents commonly carry
// the veteran's surname/first name and the last four of their VA file
// number in the filename itself. That value is load-bearing for internal
// provenance matching (_upsertServiceEntryTimelineEvent, _projectTimeline's
// knownSources) so it can't be changed in storage - only neutralized at
// the point this text is rendered for an AI context. A safe, non-filename
// label ("DD-214", "C-File Analysis", a tool name like "DenialDecoder", …)
// is passed straight through; anything shaped like an uploaded file
// (ends in a recognizable extension) is replaced with a generic
// "<document type> <date> (#index)" label instead.
const EVENT_TYPE_DOCUMENT_LABELS = {
  service_entry: "Service record",
  guard_enlistment: "Service record",
  service_separation: "Service record",
  deployment: "Service record",
  diagnosis: "Medical record",
  rating_decision: "VA decision",
  c_file_event: "C-File",
};

function _looksLikeFileName(value) {
  return typeof value === "string" && /\.[a-z0-9]{2,5}$/i.test(value.trim());
}

// D19-6: matches a whole filename-shaped TOKEN (e.g. "veteran_smith_dd214.pdf"
// embedded inside "DD-214: veteran_smith_dd214.pdf") rather than requiring
// the entire string to be a filename, since musterCallProcessor's own
// evidenceTimeline description is built as "<label>: <raw file.name>" (see
// mergeDocumentImportEntry) - the file name is a SUBSTRING there, not the
// whole value, so `_looksLikeFileName`'s end-of-string anchor never matches
// it. Restricted to a real document-extension allowlist (not any
// `.xx`-shaped suffix) so a decimal value like "$1,500.00" or a CFR/USC
// pinpoint like "20.203" is never mistaken for a file name.
//
// D19-6 follow-up: the body class used to EXCLUDE both whitespace and "."
// (`[^\s.]{1,80}`), which meant it only ever matched the LAST space/dot-free
// word of the real file name, not the name itself - "Jane Doe DD214.pdf"
// left "Jane Doe " (the veteran's own name) sitting in front of the
// replacement untouched. Real upload names routinely contain spaces
// ("Jane Doe DD214.pdf") and interior dots ("J.Q.Faketon_STR.pdf",
// "faketon.pdf.pdf"), so both are now allowed in the body. The only
// character still excluded is ":" (not "." - see below) - every real
// caller builds this description as "<label>: <file.name>" with the file
// name as a plain-text SUFFIX after that one colon, so excluding ":" from
// the body stops a greedy match from crossing back over the label's own
// "DD-214:" / "Supporting evidence:" separator and consuming (and thus
// dropping) the label itself; a literal ":" inside a real file name is not
// a case this needs to handle (invalid in a Windows file name, the
// dominant upload source). The "." IS included in the body (unlike before)
// specifically so an interior dot doesn't end the match early - this
// reintroduces the same body-includes-its-own-separator shape the base
// `email` pattern's quadratic bug had (see piiScrubber.js), so the body is
// explicitly bounded (`{0,254}`, a real filesystem's max component length)
// rather than a greedy `\S*`/`[^:\n]*` - confirmed <200ms against an
// 80,000-char pathological '.'-heavy run.
const FILENAME_TOKEN =
  /[^\s:][^:\n]{0,254}\.(?:pdf|jpeg|jpg|png|gif|bmp|tif|tiff|heic|webp|docx|doc|txt|rtf)\b/gi;

function _neutralSourceLabel(source, eventType, date, index) {
  if (!_looksLikeFileName(source)) return source || "";
  const type = EVENT_TYPE_DOCUMENT_LABELS[eventType] || "Document";
  const dated = date ? `${type}, ${date}` : type;
  return `${dated} (#${index + 1})`;
}

// D19-6: neutralizes any raw file name embedded IN the description text
// itself (not just the bracketed `source` label _neutralSourceLabel
// already covers) - same ADR-008 rule, applied at the same render-time
// choke point, since the raw name is load-bearing in storage (dedup keys
// off the exact description text) and can only be neutralized here.
function _neutralizeDescription(description, eventType, date, index) {
  if (typeof description !== "string") return description;
  const type = EVENT_TYPE_DOCUMENT_LABELS[eventType] || "Document";
  const label = date
    ? `${type}, ${date} (#${index + 1})`
    : `${type} (#${index + 1})`;
  return description.replace(FILENAME_TOKEN, label);
}

function buildEvidenceTimelineContext(vkb) {
  // ─── EVIDENCE TIMELINE ───
  let context = "";
  if (vkb.evidenceTimeline.length > 0) {
    context += "\n--- EVIDENCE TIMELINE ---\n";
    vkb.evidenceTimeline.slice(0, 20).forEach((e, i) => {
      const label = _neutralSourceLabel(e.source, e.eventType, e.date, i);
      const description = _neutralizeDescription(
        e.description,
        e.eventType,
        e.date,
        i,
      );
      context += `  ${e.date || "date not recorded"}: ${description} [${label}]\n`;
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
    vkb.keyFacts.slice(0, 10).forEach((fact, i) => {
      const label = _neutralSourceLabel(fact.source, null, null, i);
      context += `• ${fact.fact} [Source: ${label}]\n`;
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
      const need = missing.evidenceType ? `: Need ${missing.evidenceType}` : "";
      context += `• ${missing.condition}${need}\n`;
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

  context += buildPersonalContext();
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

  // ADR-008 single enforcement point: a final known-value pass over the
  // WHOLE assembled string, not just the personal-info section above - a
  // free-text field elsewhere (evidenceNeeded, a nexus statement's
  // `relationship` text, …) can still carry the veteran's own name/DOB/SSN/
  // address/file number verbatim from OCR, and this is the one place that
  // can't be bypassed by a future section a developer forgets to scrub.
  const claimNumbers = (vkb.vaClaimsHistory?.claims || [])
    .map((c) => c.claimNumber)
    .filter(Boolean);
  // ADR-008: VKB's .personal block never carries firstName/lastName/
  // serviceNumber/mailingStreet/mailingCity - those live only on the flat
  // legacy profile store. Merge both so a veteran ingested through a path
  // that only ever populated one of the two stores is still fully covered.
  const personal = { ...getVeteranProfile(), ...vkb.personal };
  return redactVeteranIdentifiers(context, personal, claimNumbers);
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
 *
 * Must actually erase the record, not just the localStorage metadata cache:
 * the real data lives in IndexedDB (openVKBDatabase/VKB_STORE_NAME), and
 * loadVKB() also serves a structuredClone of the in-memory vkbCache before
 * ever touching either. Deleting only the localStorage key left both of
 * those fully intact, so loadVKB() (and every AI context built from it -
 * getVeteranAIContext, generateLLMContext) kept returning the "cleared"
 * veteran's entire history, in the same session and after reload.
 *
 * Returns `{ vkb, persisted }` rather than just the fresh VKB: the in-memory
 * reset below always succeeds, but the IndexedDB delete it also attempts can
 * fail independently, and a caller that reports success on a privacy
 * deletion that didn't actually persist (the record would come back on
 * reload) is exactly the silent-failure this must not allow.
 */
export const clearVKB = async () => {
  localStorage.removeItem(VKB_STORAGE_KEY);
  vkbCache = null;

  let persistError = null;
  try {
    const db = await openVKBDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([VKB_STORE_NAME], "readwrite");
      const store = transaction.objectStore(VKB_STORE_NAME);
      const request = store.delete("main");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    persistError = err;
  }

  // Reset the in-memory view either way - a veteran must never see stale
  // data in THIS session regardless of whether the disk copy actually went
  // away.
  const fresh = initializeVKB();
  vkbCache = structuredClone(fresh);

  if (persistError) {
    console.error("Error clearing VKB from IndexedDB:", persistError);
    return { vkb: fresh, persisted: false };
  }

  return { vkb: fresh, persisted: true };
};
