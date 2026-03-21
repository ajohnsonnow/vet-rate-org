/**
 * Vet-Rate.org - VKB Document Integration
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * PURPOSE: Connect extracted VA documents to the Veteran Knowledge Base
 *
 * This module bridges:
 * - VA Document Parser → Condition data
 * - C-File Segmentation → Document inventory
 * - Evidence Gap Finder → Gap alerts
 * - Adversarial Drafting → Legal arguments
 *
 * TO:
 * - Veteran Profile (personal data)
 * - Evidence Timeline (chronological view)
 * - Secondary Scout (condition relationships)
 * - My Ratings (current status)
 *
 * DATA FLOW:
 * ┌─────────────────┐
 * │  MusterCall     │ → Ingest documents
 * │  (DROP ZONE)    │
 * └────────┬────────┘
 *          ▼
 * ┌─────────────────┐
 * │  Document       │ → Parse & segment
 * │  Intelligence   │
 * └────────┬────────┘
 *          ▼
 * ┌─────────────────┐
 * │  VKB            │ → Store & relate
 * │  Integration    │
 * └────────┬────────┘
 *          ▼
 * ┌─────────────────┐
 * │  Evidence       │ → Timeline view
 * │  Timeline       │
 * └─────────────────┘
 */

import {
  parseDecisionLetter,
  parseVADocument,
  extractBigThree,
} from "./vaDocumentParser.js";
import { segmentCFile, quickScanCFile } from "./cFileSegmentation.js";
import { findEvidenceGaps, quickGapCheck } from "./evidenceGapFinder.js";
import { generateAdversarialArguments } from "./adversarialDrafting.js";
import { getVeteranProfile, saveVeteranProfile } from "./veteranProfile.js";
import { markAsModified } from "./persistentStorage.js";

/**
 * VKB Storage Keys
 */
const VKB_KEYS = {
  DOCUMENT_INVENTORY: "vetrate_vkb_documents",
  EVIDENCE_TIMELINE: "vetrate_vkb_timeline",
  CONDITIONS_MAP: "vetrate_vkb_conditions",
  GAP_ALERTS: "vetrate_vkb_gaps",
  LEGAL_NOTES: "vetrate_vkb_legal",
  LAST_SYNC: "vetrate_vkb_sync",
};

/**
 * Get VKB data from localStorage
 */
function getVKBData(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`[VKB] Error reading ${key}:`, err);
    return null;
  }
}

/**
 * Save VKB data to localStorage
 */
function saveVKBData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    markAsModified();
    return true;
  } catch (err) {
    console.error(`[VKB] Error saving ${key}:`, err);
    return false;
  }
}

/**
 * Process a batch of documents and integrate into VKB
 * This is the main entry point from MusterCall
 *
 * @param {Array} documents - Array of {text, type, filename, date}
 * @returns {Object} Processing results
 */
export async function processDocumentsToVKB(documents) {
  const results = {
    success: true,
    processedAt: new Date().toISOString(),
    documentsProcessed: 0,
    conditionsExtracted: [],
    evidenceAdded: [],
    gapsDetected: [],
    errors: [],
  };

  // Load existing VKB data
  let inventory = getVKBData(VKB_KEYS.DOCUMENT_INVENTORY) || [];
  let timeline = getVKBData(VKB_KEYS.EVIDENCE_TIMELINE) || [];
  let conditionsMap = getVKBData(VKB_KEYS.CONDITIONS_MAP) || {};
  let gapAlerts = getVKBData(VKB_KEYS.GAP_ALERTS) || [];

  for (const doc of documents) {
    try {
      // === PARSE DOCUMENT ===
      const parsed = parseVADocument(doc.text);

      // === ADD TO INVENTORY ===
      const inventoryEntry = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        filename: doc.filename,
        type: parsed.documentType,
        uploadedAt: new Date().toISOString(),
        preview: doc.text.substring(0, 200),
        parsedData: parsed,
      };
      inventory.push(inventoryEntry);

      // === EXTRACT CONDITIONS ===
      if (parsed.conditions && parsed.conditions.length > 0) {
        for (const condition of parsed.conditions) {
          // Update conditions map
          if (!conditionsMap[condition.name]) {
            conditionsMap[condition.name] = {
              name: condition.name,
              diagnosticCode: condition.diagnosticCode,
              history: [],
              relatedDocuments: [],
            };
          }

          // Add rating history entry
          conditionsMap[condition.name].history.push({
            date: parsed.extractedAt,
            percent: condition.percent,
            status: condition.status,
            effectiveDate: condition.effectiveDate,
            documentId: inventoryEntry.id,
          });

          conditionsMap[condition.name].relatedDocuments.push(
            inventoryEntry.id,
          );

          results.conditionsExtracted.push(condition.name);
        }
      }

      // === BUILD EVIDENCE TIMELINE ===
      const timelineEntry = {
        id: inventoryEntry.id,
        date: parsed.extractedAt || doc.date || new Date().toISOString(),
        type: parsed.documentType,
        description: getTimelineDescription(parsed),
        documentId: inventoryEntry.id,
        importance: getEvidenceImportance(parsed),
      };
      timeline.push(timelineEntry);
      results.evidenceAdded.push(timelineEntry.description);

      // === DETECT GAPS (if this is a decision letter) ===
      if (
        parsed.documentType === "DECISION_LETTER" &&
        parsed.evidenceConsidered
      ) {
        // Compare against existing inventory
        const quickGap = {
          decisionEvidence: parsed.evidenceConsidered.length,
          inventoryCount: inventory.length,
          possibleGaps: Math.max(
            0,
            inventory.length - parsed.evidenceConsidered.length - 1,
          ),
        };

        if (quickGap.possibleGaps > 2) {
          const gapAlert = {
            id: `gap_${Date.now()}`,
            createdAt: new Date().toISOString(),
            type: "POTENTIAL_MISSED_EVIDENCE",
            severity: quickGap.possibleGaps > 5 ? "HIGH" : "MEDIUM",
            message: `Decision letter may have missed ${quickGap.possibleGaps} documents in your C-File`,
            relatedDocumentId: inventoryEntry.id,
          };
          gapAlerts.push(gapAlert);
          results.gapsDetected.push(gapAlert.message);
        }
      }

      results.documentsProcessed++;
    } catch (err) {
      results.errors.push({
        filename: doc.filename,
        error: err.message,
      });
    }
  }

  // === SAVE UPDATED VKB ===
  saveVKBData(VKB_KEYS.DOCUMENT_INVENTORY, inventory);
  saveVKBData(
    VKB_KEYS.EVIDENCE_TIMELINE,
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date)),
  );
  saveVKBData(VKB_KEYS.CONDITIONS_MAP, conditionsMap);
  saveVKBData(VKB_KEYS.GAP_ALERTS, gapAlerts);
  saveVKBData(VKB_KEYS.LAST_SYNC, new Date().toISOString());

  // === UPDATE VETERAN PROFILE IF APPLICABLE ===
  updateVeteranProfileFromDocuments(documents, conditionsMap);

  return results;
}

/**
 * Get a human-readable timeline description
 */
function getTimelineDescription(parsed) {
  switch (parsed.documentType) {
    case "DECISION_LETTER":
      return `Rating Decision: ${parsed.combinedRating || "N/A"}% combined`;
    case "DBQ_EXAM":
      return `C&P Exam: ${parsed.diagnoses?.[0]?.name || "Medical examination"}`;
    case "CODE_SHEET":
      return `Code Sheet: ${parsed.conditions?.length || 0} conditions listed`;
    case "BVA_DECISION":
      return `BVA Decision: ${parsed.outcome || "Pending"}`;
    case "STATEMENT_OF_CASE":
      return `SOC: ${parsed.issuesOnAppeal?.length || 0} issues`;
    default:
      return `Document processed: ${parsed.documentType}`;
  }
}

/**
 * Calculate evidence importance for timeline
 */
function getEvidenceImportance(parsed) {
  switch (parsed.documentType) {
    case "DECISION_LETTER":
      return 10;
    case "CODE_SHEET":
      return 10;
    case "BVA_DECISION":
      return 9;
    case "DBQ_EXAM":
      return 8;
    case "STATEMENT_OF_CASE":
      return 7;
    default:
      return 5;
  }
}

/**
 * Update veteran profile with extracted data
 */
function updateVeteranProfileFromDocuments(documents, conditionsMap) {
  try {
    const profile = getVeteranProfile();

    // Update current combined rating if available
    for (const doc of documents) {
      const parsed = parseVADocument(doc.text);
      if (parsed.combinedRating !== null) {
        profile.currentCombinedRating = parsed.combinedRating;
      }
      if (parsed.effectiveDate) {
        profile.effectiveDate = parsed.effectiveDate;
      }
      if (parsed.veteranName && !profile.fullName) {
        profile.fullName = parsed.veteranName;
      }
      if (parsed.claimNumber && !profile.claimNumber) {
        profile.claimNumber = parsed.claimNumber;
      }
    }

    // Save updated profile
    if (Object.keys(profile).length > 0) {
      saveVeteranProfile(profile);
    }
  } catch (err) {
    console.error("[VKB] Error updating veteran profile:", err);
  }
}

/**
 * Get full Evidence Timeline for UI
 */
export function getEvidenceTimeline() {
  const timeline = getVKBData(VKB_KEYS.EVIDENCE_TIMELINE) || [];
  return timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Get all extracted conditions
 */
export function getConditionsMap() {
  return getVKBData(VKB_KEYS.CONDITIONS_MAP) || {};
}

/**
 * Get active gap alerts
 */
export function getGapAlerts() {
  return getVKBData(VKB_KEYS.GAP_ALERTS) || [];
}

/**
 * Get document inventory
 */
export function getDocumentInventory() {
  return getVKBData(VKB_KEYS.DOCUMENT_INVENTORY) || [];
}

/**
 * Clear all VKB data (for privacy/reset)
 */
export function clearVKB() {
  Object.values(VKB_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
  return true;
}

/**
 * Export VKB data for backup
 */
export function exportVKB() {
  return {
    exportedAt: new Date().toISOString(),
    inventory: getVKBData(VKB_KEYS.DOCUMENT_INVENTORY),
    timeline: getVKBData(VKB_KEYS.EVIDENCE_TIMELINE),
    conditions: getVKBData(VKB_KEYS.CONDITIONS_MAP),
    gaps: getVKBData(VKB_KEYS.GAP_ALERTS),
    legal: getVKBData(VKB_KEYS.LEGAL_NOTES),
  };
}

/**
 * Import VKB data from backup
 */
export function importVKB(data) {
  if (!data || !data.exportedAt) {
    throw new Error("Invalid VKB backup data");
  }

  if (data.inventory) saveVKBData(VKB_KEYS.DOCUMENT_INVENTORY, data.inventory);
  if (data.timeline) saveVKBData(VKB_KEYS.EVIDENCE_TIMELINE, data.timeline);
  if (data.conditions) saveVKBData(VKB_KEYS.CONDITIONS_MAP, data.conditions);
  if (data.gaps) saveVKBData(VKB_KEYS.GAP_ALERTS, data.gaps);
  if (data.legal) saveVKBData(VKB_KEYS.LEGAL_NOTES, data.legal);

  return true;
}

/**
 * Generate full claim intelligence report
 */
export function generateIntelligenceReport() {
  const inventory = getDocumentInventory();
  const timeline = getEvidenceTimeline();
  const conditions = getConditionsMap();
  const gaps = getGapAlerts();
  const profile = getVeteranProfile();

  return {
    generatedAt: new Date().toISOString(),

    // Veteran summary
    veteran: {
      name: profile.fullName || "Unknown",
      currentRating: profile.currentCombinedRating || null,
      claimNumber: profile.claimNumber || null,
    },

    // Document stats
    documents: {
      total: inventory.length,
      byType: inventory.reduce((acc, doc) => {
        acc[doc.type] = (acc[doc.type] || 0) + 1;
        return acc;
      }, {}),
    },

    // Condition summary
    conditions: {
      total: Object.keys(conditions).length,
      list: Object.entries(conditions).map(([name, data]) => ({
        name,
        currentPercent: data.history?.[data.history.length - 1]?.percent || 0,
        historyCount: data.history?.length || 0,
      })),
    },

    // Alert summary
    alerts: {
      total: gaps.length,
      highPriority: gaps.filter((g) => g.severity === "HIGH").length,
      items: gaps.slice(0, 5), // Top 5 alerts
    },

    // Timeline highlights
    timeline: {
      total: timeline.length,
      earliest: timeline[0]?.date || null,
      latest: timeline[timeline.length - 1]?.date || null,
    },
  };
}

/**
 * Link condition to Secondary Scout
 * Returns related conditions from the knowledge base
 */
export async function findSecondaryConditions(conditionName) {
  // This would query the DKB for secondary connection relationships
  // For now, return a placeholder that the UI can use
  return {
    primaryCondition: conditionName,
    potentialSecondaries: [],
    message: "Use Secondary Scout tool for detailed analysis",
  };
}

/**
 * Sync extracted data to My Ratings section
 */
export function syncToMyRatings() {
  const conditions = getConditionsMap();
  const ratingsKey = "vet_rate_my_ratings";

  const ratings = {};

  for (const [name, data] of Object.entries(conditions)) {
    const latestHistory = data.history?.[data.history.length - 1];
    if (latestHistory && latestHistory.status === "GRANTED") {
      ratings[name] = {
        percent: latestHistory.percent,
        diagnosticCode: data.diagnosticCode,
        effectiveDate: latestHistory.effectiveDate,
        source: "VKB_EXTRACTION",
      };
    }
  }

  localStorage.setItem(ratingsKey, JSON.stringify(ratings));
  markAsModified();

  return Object.keys(ratings).length;
}

export default {
  processDocumentsToVKB,
  getEvidenceTimeline,
  getConditionsMap,
  getGapAlerts,
  getDocumentInventory,
  clearVKB,
  exportVKB,
  importVKB,
  generateIntelligenceReport,
  findSecondaryConditions,
  syncToMyRatings,
};
