/**
 * VA API Data Persistence
 * Handles saving VA.gov data to MyPacket and VKB with consent
 */

import { saveClaim, generateId } from "./claimsStorage";
import { loadVKB, saveVKB, raceVkb } from "./veteranKnowledgeBase";
import { markAsModified } from "./persistentStorage";

const VKB_LOAD_TIMEOUT_ERROR =
  "Timed out loading your saved data. Please try again.";

const VA_RECORDS_KEY = "vet_rate_va_records";

/**
 * Save VA Claims to MyPacket
 */
export async function saveVAClaimsToPacket(claims, rawData = null) {
  if (!claims || !Array.isArray(claims)) return { success: false, count: 0 };

  const savedCount = claims.reduce((count, claim) => {
    try {
      const contentions =
        claim.contentionList ||
        claim.attributes?.contentionList ||
        claim.contentions ||
        claim.attributes?.contentions ||
        [];
      const claimType =
        claim.type || claim.attributes?.claim_type || "VA Claim";
      const firstContention = contentions[0];
      const contentionName =
        typeof firstContention === "string"
          ? firstContention
          : firstContention?.name;
      const dateFiled = claim.dateFiled || claim.attributes?.claim_date;

      const claimData = {
        id: `va_claim_${claim.id || generateId()}`,
        name: claimType,
        conditionName:
          contentionName ||
          (dateFiled ? `${claimType} (filed ${dateFiled})` : claimType),
        // Lighthouse Claims API v2 doesn't return a diagnostic/DC code on the
        // claim list — that only exists once the Disability Rating API has a
        // rated decision — so this stays a clearly-marked placeholder.
        diagnosticCode: "VA-IMPORTED",
        isPrimary: true,
        status: claim.status || claim.attributes?.status || "Pending",
        dateFiled,
        currentPhase:
          claim.phase ||
          claim.phaseNumber ||
          claim.attributes?.claim_phase_dates?.current_phase_back,
        source: "VA.gov API",
        importedAt: new Date().toISOString(),
        vaClaimId: claim.id,
        // saveClaim() dedupes on parentCondition === parentCondition; must match
        // the null it stores for claims with no parent, not leave this undefined.
        parentCondition: null,
        contentions,
        _rawData: rawData, // Store raw API response for reference
      };

      return saveClaim(claimData) ? count + 1 : count;
    } catch (error) {
      console.error("Error saving VA claim:", error);
      return count;
    }
  }, 0);

  markAsModified();
  return { success: savedCount === claims.length, count: savedCount };
}

function _mergeServiceHistoryDeployments(sh, serviceHistory) {
  const deployments = Array.isArray(serviceHistory.deployments)
    ? serviceHistory.deployments
    : [];
  deployments.forEach((dep) => {
    const location = dep.location || dep.theater || "";
    const isDuplicate = sh.deployments.some(
      (d) =>
        (d.location || "").toLowerCase() === location.toLowerCase() &&
        (d.startDate || "") === (dep.startDate || ""),
    );
    if (!isDuplicate && location) {
      sh.deployments.push({
        location,
        startDate: dep.startDate || null,
        endDate: dep.endDate || null,
        combatZone: dep.combatZone || false,
        operation: dep.operation || "",
        source: "VA.gov API",
      });
    }
  });
}

/**
 * Save Service History to VKB
 *
 * Merges field-by-field into the existing vkb.serviceHistory object (same
 * pattern as mergeDD214IntoVKB) instead of replacing the whole key — DD214
 * uploads populate richer fields (rank, mos, awards, characterOfService) on
 * this same object, and a full-key overwrite would destroy them.
 */
export async function saveServiceHistoryToVKB(serviceHistory, rawData = null) {
  if (!serviceHistory) return { success: false };

  try {
    const vkb = await raceVkb(loadVKB());
    if (!vkb) return { success: false, error: VKB_LOAD_TIMEOUT_ERROR };
    vkb.serviceHistory = vkb.serviceHistory || {};
    const sh = vkb.serviceHistory;
    sh.deployments = Array.isArray(sh.deployments) ? sh.deployments : [];

    // Fill-if-empty only: a veteran's DD214 may cover a different
    // branch/era than this VA API episode — never let an unconditional
    // overwrite here produce a chimera record mixing the two sources.
    sh.branch =
      sh.branch || serviceHistory.branch || serviceHistory.branch_of_service;
    sh.entryDate =
      sh.entryDate ||
      serviceHistory.startDate ||
      serviceHistory.period_of_service?.start_date;
    sh.separationDate =
      sh.separationDate ||
      serviceHistory.endDate ||
      serviceHistory.period_of_service?.end_date;
    sh.characterOfService =
      sh.characterOfService ||
      serviceHistory.dischargeStatus ||
      serviceHistory.discharge_status;

    if (serviceHistory.payGrade) {
      if (!sh.rank) sh.rank = { entry: null, discharge: null };
      sh.rank.discharge = sh.rank.discharge || serviceHistory.payGrade;
    }

    if (sh.entryDate && sh.separationDate) {
      const years =
        (new Date(sh.separationDate) - new Date(sh.entryDate)) /
        (365.25 * 24 * 60 * 60 * 1000);
      sh.yearsOfService = Number.parseFloat(years.toFixed(1));
    }

    _mergeServiceHistoryDeployments(sh, serviceHistory);

    sh.importedAt = new Date().toISOString();
    sh.source = sh.source || "VA.gov API";
    sh._rawData = rawData;

    await saveVKB(vkb);
    markAsModified();
    return { success: true };
  } catch (error) {
    console.error("Error saving service history to VKB:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Save Disability Rating to VKB
 *
 * vaClaimsHistory.ratings already holds per-condition ratings (populated from
 * decision-document extraction elsewhere) — merge into it instead of creating
 * a colliding parallel `disabilityRating` field on the VKB object.
 */
export async function saveDisabilityRatingToVKB(
  disabilityRating,
  rawData = null,
) {
  if (!disabilityRating) return { success: false };

  try {
    const vkb = await raceVkb(loadVKB());
    if (!vkb) return { success: false, error: VKB_LOAD_TIMEOUT_ERROR };
    vkb.vaClaimsHistory = vkb.vaClaimsHistory || {};
    vkb.vaClaimsHistory.ratings = Array.isArray(vkb.vaClaimsHistory.ratings)
      ? vkb.vaClaimsHistory.ratings
      : [];
    const individualRatings = Array.isArray(disabilityRating.individualRatings)
      ? disabilityRating.individualRatings
      : [];

    individualRatings.forEach((rating) => {
      const condition = rating.diagnosticTypeName || rating.diagnosticText;
      if (!condition) return;

      const entry = {
        condition,
        percentage: rating.ratingPercentage ?? null,
        effectiveDate: rating.effectiveDate || null,
        combinedRating: disabilityRating.combinedRating ?? null,
        source: "VA.gov API",
      };

      const existingIndex = vkb.vaClaimsHistory.ratings.findIndex(
        (r) => r.condition === condition && r.source === "VA.gov API",
      );
      if (existingIndex >= 0) {
        vkb.vaClaimsHistory.ratings[existingIndex] = entry;
      } else {
        vkb.vaClaimsHistory.ratings.push(entry);
      }
    });
    vkb.vaClaimsHistory.disabilityRatingRawData = rawData;

    await saveVKB(vkb);
    markAsModified();
    return { success: true };
  } catch (error) {
    console.error("Error saving disability rating to VKB:", error);
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
      const issues = appeal.issues || appeal.attributes?.issues || [];
      const firstIssue = issues[0];
      const issueDescription =
        typeof firstIssue === "string" ? firstIssue : firstIssue?.description;
      const appealType = appeal.type || appeal.attributes?.type || "Unknown";
      const dateFiled = appeal.updated || appeal.attributes?.updated;

      const appealData = {
        id: `va_appeal_${appeal.id || generateId()}`,
        name: `Appeal - ${appealType}`,
        conditionName:
          issueDescription ||
          (dateFiled
            ? `${appealType} Appeal (updated ${dateFiled})`
            : `${appealType} Appeal`),
        diagnosticCode: "VA-APPEAL",
        isPrimary: false,
        status:
          appeal.status?.type || appeal.attributes?.status?.type || "Active",
        appealType,
        dateFiled,
        // saveClaim() dedupes VA-imported entries on vaAppealId when present;
        // must match the null it stores for entries with no parent, not
        // leave this undefined.
        parentCondition: null,
        source: "VA.gov API",
        importedAt: new Date().toISOString(),
        vaAppealId: appeal.id,
        _rawData: rawData,
      };

      return saveClaim(appealData) ? count + 1 : count;
    } catch (error) {
      console.error("Error saving VA appeal:", error);
      return count;
    }
  }, 0);

  markAsModified();
  return { success: savedCount === appeals.length, count: savedCount };
}

/**
 * Save Appealable Issues to VKB (for AI context)
 */
export async function saveAppealableIssuesToVKB(issues, rawData = null) {
  if (!issues || !Array.isArray(issues)) return { success: false };

  try {
    const vkb = await raceVkb(loadVKB());
    if (!vkb) return { success: false, error: VKB_LOAD_TIMEOUT_ERROR };

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

async function _savePacketData(vaData, results) {
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
      results.packet.saved = true;
      results.packet.count += appealsResult.count || 0;
    } else {
      results.errors.push("Failed to save appeals to packet");
    }
  }
}

async function _saveVKBData(vaData, results) {
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

  if (vaData.disabilityRating) {
    const ratingResult = await saveDisabilityRatingToVKB(
      vaData.disabilityRating,
      vaData.rawDisabilityRating,
    );
    if (ratingResult.success) {
      results.vkb.saved = true;
    } else {
      results.errors.push("Failed to save disability rating to VKB");
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

    if (consent.saveToPacket) {
      await _savePacketData(vaData, results);
    }

    if (consent.saveToVKB) {
      await _saveVKBData(vaData, results);
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
  saveDisabilityRatingToVKB,
  saveAppealsToPacket,
  saveAppealableIssuesToVKB,
  saveVADataWithConsent,
  saveVARecordsRaw,
  loadVARecords,
  clearVARecords,
};
