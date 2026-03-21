/**
 * VA API Data Persistence
 * Handles saving VA.gov data to MyPacket and VKB with consent
 */

import { saveClaim, generateId } from "./claimsStorage";
import { loadVKB, saveVKB } from "./veteranKnowledgeBase";
import { markAsModified } from "./persistentStorage";

const VA_RECORDS_KEY = "vet_rate_va_records";

/**
 * Save VA Claims to MyPacket
 */
export async function saveVAClaimsToPacket(claims, rawData = null) {
  if (!claims || !Array.isArray(claims)) return { success: false, count: 0 };

  const savedCount = claims.reduce((count, claim) => {
    try {
      const claimData = {
        id: `va_claim_${claim.id || generateId()}`,
        name: claim.type || claim.attributes?.claim_type || "VA Claim",
        diagnosticCode: "VA-IMPORTED",
        isPrimary: true,
        status: claim.status || claim.attributes?.status || "Pending",
        dateFiled: claim.dateFiled || claim.attributes?.claim_date,
        currentPhase:
          claim.phase ||
          claim.phaseNumber ||
          claim.attributes?.claim_phase_dates?.current_phase_back,
        source: "VA.gov API",
        importedAt: new Date().toISOString(),
        vaClaimId: claim.id,
        contentions: claim.contentions || claim.attributes?.contentions || [],
        _rawData: rawData, // Store raw API response for reference
      };

      saveClaim(claimData);
      return count + 1;
    } catch (error) {
      console.error("Error saving VA claim:", error);
      return count;
    }
  }, 0);

  markAsModified();
  return { success: true, count: savedCount };
}

/**
 * Save Service History to VKB
 */
export async function saveServiceHistoryToVKB(serviceHistory, rawData = null) {
  if (!serviceHistory) return { success: false };

  try {
    const vkb = await loadVKB();

    // Update service history section
    vkb.serviceHistory = {
      branch: serviceHistory.branch || serviceHistory.branch_of_service,
      startDate:
        serviceHistory.startDate ||
        serviceHistory.period_of_service?.start_date,
      endDate:
        serviceHistory.endDate || serviceHistory.period_of_service?.end_date,
      dischargeStatus:
        serviceHistory.dischargeStatus || serviceHistory.discharge_status,
      deployments: serviceHistory.deployments || [],
      importedAt: new Date().toISOString(),
      source: "VA.gov API",
      _rawData: rawData,
    };

    await saveVKB(vkb);
    markAsModified();
    return { success: true };
  } catch (error) {
    console.error("Error saving service history to VKB:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Save Appeals to MyPacket
 */
export async function saveAppealsToPacket(appeals, rawData = null) {
  if (!appeals || !Array.isArray(appeals)) return { success: false, count: 0 };

  const savedCount = appeals.reduce((count, appeal) => {
    try {
      const appealData = {
        id: `va_appeal_${appeal.id || generateId()}`,
        name: `Appeal - ${appeal.type || appeal.attributes?.program_area || "Unknown"}`,
        diagnosticCode: "VA-APPEAL",
        isPrimary: false,
        status:
          appeal.status?.type || appeal.attributes?.status?.type || "Active",
        appealType: appeal.type || appeal.attributes?.type,
        dateFiled: appeal.updated || appeal.attributes?.updated,
        source: "VA.gov API",
        importedAt: new Date().toISOString(),
        vaAppealId: appeal.id,
        _rawData: rawData,
      };

      saveClaim(appealData);
      return count + 1;
    } catch (error) {
      console.error("Error saving VA appeal:", error);
      return count;
    }
  }, 0);

  markAsModified();
  return { success: true, count: savedCount };
}

/**
 * Save Appealable Issues to VKB (for AI context)
 */
export async function saveAppealableIssuesToVKB(issues, rawData = null) {
  if (!issues || !Array.isArray(issues)) return { success: false };

  try {
    const vkb = await loadVKB();

    // Add to legal/appeals section
    if (!vkb.legal) vkb.legal = {};
    vkb.legal.appealableIssues = issues.map((issue) => ({
      description: issue.description || issue.attributes?.description,
      decisionDate:
        issue.decisionDate || issue.attributes?.rating_issue_reference_id,
      ratingPercentage:
        issue.ratingPercentage || issue.attributes?.rating_percentage,
      importedAt: new Date().toISOString(),
    }));
    vkb.legal.appealableIssuesRaw = rawData;

    await saveVKB(vkb);
    markAsModified();
    return { success: true };
  } catch (error) {
    console.error("Error saving appealable issues to VKB:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Save raw VA records for the VA Records tab
 */
export function saveVARecordsRaw(vaData) {
  try {
    const records = {
      claims: vaData.claims || [],
      serviceHistory: vaData.serviceHistory || null,
      appeals: vaData.appeals || [],
      appealableIssues: vaData.appealableIssues || [],
      rawClaims: vaData.rawClaims || null,
      rawServiceHistory: vaData.rawServiceHistory || null,
      rawAppeals: vaData.rawAppeals || null,
      rawAppealableIssues: vaData.rawAppealableIssues || null,
      importedAt: new Date().toISOString(),
      source: "VA.gov API",
    };

    localStorage.setItem(VA_RECORDS_KEY, JSON.stringify(records));
    markAsModified();
    return { success: true };
  } catch (error) {
    console.error("Error saving VA records:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Load VA records
 */
export function loadVARecords() {
  try {
    const stored = localStorage.getItem(VA_RECORDS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error("Error loading VA records:", error);
    return null;
  }
}

/**
 * Clear VA records
 */
export function clearVARecords() {
  try {
    localStorage.removeItem(VA_RECORDS_KEY);
    markAsModified();
    return { success: true };
  } catch (error) {
    console.error("Error clearing VA records:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Master save function - called after consent
 */
export async function saveVADataWithConsent(vaData, consent) {
  const results = {
    packet: { saved: false, count: 0 },
    vkb: { saved: false },
    errors: [],
  };

  try {
    // Always save raw records for VA Records tab
    const rawResult = saveVARecordsRaw(vaData);
    if (!rawResult.success) {
      results.errors.push("Failed to save raw VA records");
    }

    // Save to MyPacket if consented
    if (consent.saveToPacket) {
      if (vaData.claims && vaData.claims.length > 0) {
        const claimsResult = await saveVAClaimsToPacket(
          vaData.claims,
          vaData.rawClaims,
        );
        if (claimsResult.success) {
          results.packet.saved = true;
          results.packet.count += claimsResult.count || 0;
        } else {
          results.errors.push("Failed to save claims to packet");
        }
      }

      if (vaData.appeals && vaData.appeals.length > 0) {
        const appealsResult = await saveAppealsToPacket(
          vaData.appeals,
          vaData.rawAppeals,
        );
        if (appealsResult.success) {
          results.packet.count += appealsResult.count || 0;
        } else {
          results.errors.push("Failed to save appeals to packet");
        }
      }
    }

    // Save to VKB if consented
    if (consent.saveToVKB) {
      if (vaData.serviceHistory) {
        const historyResult = await saveServiceHistoryToVKB(
          vaData.serviceHistory,
          vaData.rawServiceHistory,
        );
        if (historyResult.success) {
          results.vkb.saved = true;
        } else {
          results.errors.push("Failed to save service history to VKB");
        }
      }

      if (vaData.appealableIssues && vaData.appealableIssues.length > 0) {
        const issuesResult = await saveAppealableIssuesToVKB(
          vaData.appealableIssues,
          vaData.rawAppealableIssues,
        );
        if (issuesResult.success) {
          results.vkb.saved = true;
        } else {
          results.errors.push("Failed to save appealable issues to VKB");
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Error in saveVADataWithConsent:", error);
    results.errors.push(error.message);
    return results;
  }
}

export default {
  saveVAClaimsToPacket,
  saveServiceHistoryToVKB,
  saveAppealsToPacket,
  saveAppealableIssuesToVKB,
  saveVADataWithConsent,
  saveVARecordsRaw,
  loadVARecords,
  clearVARecords,
};
