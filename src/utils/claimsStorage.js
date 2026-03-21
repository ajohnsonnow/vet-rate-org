/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Claims Storage Utility
 * Manages localStorage for saved claims and generated statements
 * Privacy-focused: All data stays on user's device
 *
 * Now integrates with persistentStorage for crash-proof auto-saving
 */

import { markAsModified } from "./persistentStorage";

const STORAGE_KEY = "vet_rate_saved_claims";
const STATEMENTS_KEY = "vet_rate_statements";

// Generate unique ID
export const generateId = () => {
  return `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get all saved claims
export const getSavedClaims = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Error reading saved claims:", error);
    return [];
  }
};

// Save a new claim
export const saveClaim = (claim) => {
  try {
    const claims = getSavedClaims();

    // Check if already saved
    const existingIndex = claims.findIndex(
      (c) =>
        c.conditionName === claim.conditionName &&
        c.parentCondition === claim.parentCondition,
    );

    if (existingIndex >= 0) {
      // Update existing claim
      claims[existingIndex] = {
        ...claims[existingIndex],
        ...claim,
        dateUpdated: new Date().toISOString(),
      };
    } else {
      // Add new claim
      const newClaim = {
        id: generateId(),
        conditionName: claim.conditionName,
        parentCondition: claim.parentCondition || null,
        dateSaved: new Date().toISOString(),
        status: claim.status || "Drafting",
        ...claim,
      };
      claims.push(newClaim);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(claims));

    // Trigger auto-save to crash-proof storage
    markAsModified();

    return true;
  } catch (error) {
    console.error("Error saving claim:", error);
    return false;
  }
};

// Check if claim is already saved
export const isClaimSaved = (conditionName, parentCondition = null) => {
  const claims = getSavedClaims();
  return claims.some(
    (c) =>
      c.conditionName === conditionName &&
      c.parentCondition === parentCondition,
  );
};

// Remove a claim
export const removeClaim = (claimId) => {
  try {
    const claims = getSavedClaims();
    const filtered = claims.filter((c) => c.id !== claimId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    // Trigger auto-save to crash-proof storage
    markAsModified();

    return true;
  } catch (error) {
    console.error("Error removing claim:", error);
    return false;
  }
};

// Clear all saved claims
export const clearAllClaims = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STATEMENTS_KEY);

    // Trigger auto-save to crash-proof storage
    markAsModified();

    return true;
  } catch (error) {
    console.error("Error clearing claims:", error);
    return false;
  }
};

// Update claim status
export const updateClaimStatus = (claimId, newStatus) => {
  try {
    const claims = getSavedClaims();
    const index = claims.findIndex((c) => c.id === claimId);

    if (index >= 0) {
      claims[index].status = newStatus;
      claims[index].dateUpdated = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(claims));

      // Trigger auto-save to crash-proof storage
      markAsModified();

      return true;
    }
    return false;
  } catch (error) {
    console.error("Error updating claim status:", error);
    return false;
  }
};

// Save a generated statement
export const saveStatement = (claimId, statementData) => {
  try {
    const statements = JSON.parse(localStorage.getItem(STATEMENTS_KEY) || "{}");
    statements[claimId] = {
      ...statementData,
      savedDate: new Date().toISOString(),
    };
    localStorage.setItem(STATEMENTS_KEY, JSON.stringify(statements));

    // Update claim status
    updateClaimStatus(claimId, "Statement Generated");

    // Trigger auto-save to crash-proof storage
    markAsModified();

    return true;
  } catch (error) {
    console.error("Error saving statement:", error);
    return false;
  }
};

// Get statement for a claim
export const getStatement = (claimId) => {
  try {
    const statements = JSON.parse(localStorage.getItem(STATEMENTS_KEY) || "{}");
    return statements[claimId] || null;
  } catch (error) {
    console.error("Error getting statement:", error);
    return null;
  }
};

// Get claim statistics
export const getClaimStats = () => {
  const claims = getSavedClaims();
  return {
    total: claims.length,
    drafting: claims.filter((c) => c.status === "Drafting").length,
    statementGenerated: claims.filter((c) => c.status === "Statement Generated")
      .length,
    filed: claims.filter((c) => c.status === "Filed").length,
  };
};

// Get all statements (for backup)
export const getAllStatements = () => {
  try {
    const statements = JSON.parse(localStorage.getItem(STATEMENTS_KEY) || "{}");
    return statements;
  } catch (error) {
    console.error("Error getting all statements:", error);
    return {};
  }
};

// Import claims (for restore)
export const importClaims = (claims, mergeMode = "replace") => {
  try {
    if (mergeMode === "replace") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(claims));
    } else if (mergeMode === "merge") {
      const existingClaims = getSavedClaims();
      const existingIds = new Set(
        existingClaims.map(
          (c) => c.conditionName + "|" + (c.parentCondition || ""),
        ),
      );

      const newClaims = claims.filter(
        (c) =>
          !existingIds.has(c.conditionName + "|" + (c.parentCondition || "")),
      );

      const mergedClaims = [...existingClaims, ...newClaims];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedClaims));
    }
    return true;
  } catch (error) {
    console.error("Error importing claims:", error);
    return false;
  }
};

// Import statements (for restore)
export const importStatements = (statements, mergeMode = "replace") => {
  try {
    if (mergeMode === "replace") {
      localStorage.setItem(STATEMENTS_KEY, JSON.stringify(statements));
    } else if (mergeMode === "merge") {
      const existingStatements = JSON.parse(
        localStorage.getItem(STATEMENTS_KEY) || "{}",
      );
      const mergedStatements = { ...existingStatements, ...statements };
      localStorage.setItem(STATEMENTS_KEY, JSON.stringify(mergedStatements));
    }
    return true;
  } catch (error) {
    console.error("Error importing statements:", error);
    return false;
  }
};
