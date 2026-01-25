/**
 * SupplyLocker.org - Claim Navigator Storage
 * Persistent storage for claim navigator state
 * 
 * Privacy-first: All data stays on user's device (localStorage)
 * Supports multi-claim tracking and version migration
 * 
 * Built by a fellow veteran. "Your data, your device."
 */

import {
  createClaimSchema,
  calculateItfExpiration,
  calculateAppealDeadline
} from '../data/claimNavigatorSchema';

// Storage keys
const CLAIMS_KEY = 'vet_rate_claim_navigator_claims';
const SETTINGS_KEY = 'vet_rate_claim_navigator_settings';
const SCHEMA_VERSION = 1;

// ============================================
// CLAIM CRUD OPERATIONS
// ============================================

/**
 * Generate unique claim ID
 */
export const generateClaimId = () => {
  return `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get all claims from storage
 * @returns {Array} Array of claim objects
 */
export const getAllClaims = () => {
  try {
    const stored = localStorage.getItem(CLAIMS_KEY);
    if (!stored) return [];
    
    const data = JSON.parse(stored);
    
    // Handle version migration if needed
    if (data.version !== SCHEMA_VERSION) {
      return migrateClaims(data);
    }
    
    return data.claims || [];
  } catch (error) {
    console.error('Error reading claims:', error);
    return [];
  }
};

/**
 * Get a single claim by ID
 * @param {string} claimId - The claim ID
 * @returns {Object|null} The claim object or null
 */
export const getClaimById = (claimId) => {
  const claims = getAllClaims();
  return claims.find(c => c.id === claimId) || null;
};

/**
 * Save a new claim
 * @param {Object} claimData - Partial claim data
 * @returns {Object} The created claim with generated ID
 */
export const createClaim = (claimData) => {
  try {
    const claims = getAllClaims();
    
    // Create new claim with schema defaults
    const newClaim = {
      ...createClaimSchema(),
      ...claimData,
      id: generateClaimId(),
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: SCHEMA_VERSION
      }
    };
    
    // Auto-calculate ITF expiration if ITF date provided
    if (newClaim.criticalDates?.itfDate && !newClaim.criticalDates.itfExpirationDate) {
      newClaim.criticalDates.itfExpirationDate = calculateItfExpiration(newClaim.criticalDates.itfDate);
    }
    
    claims.push(newClaim);
    saveClaims(claims);
    
    return newClaim;
  } catch (error) {
    console.error('Error creating claim:', error);
    throw error;
  }
};

/**
 * Update an existing claim
 * @param {string} claimId - The claim ID
 * @param {Object} updates - Partial updates to apply
 * @returns {Object|null} The updated claim or null if not found
 */
export const updateClaim = (claimId, updates) => {
  try {
    const claims = getAllClaims();
    const index = claims.findIndex(c => c.id === claimId);
    
    if (index === -1) {
      console.warn('Claim not found:', claimId);
      return null;
    }
    
    // Deep merge updates
    const updatedClaim = deepMerge(claims[index], updates);
    updatedClaim.metadata.updatedAt = new Date().toISOString();
    
    // Auto-calculate dates
    if (updates.criticalDates?.itfDate && !updatedClaim.criticalDates.itfExpirationDate) {
      updatedClaim.criticalDates.itfExpirationDate = calculateItfExpiration(updatedClaim.criticalDates.itfDate);
    }
    
    if (updates.criticalDates?.decisionDate && !updatedClaim.criticalDates.appealDeadline) {
      updatedClaim.criticalDates.appealDeadline = calculateAppealDeadline(updatedClaim.criticalDates.decisionDate);
    }
    
    claims[index] = updatedClaim;
    saveClaims(claims);
    
    return updatedClaim;
  } catch (error) {
    console.error('Error updating claim:', error);
    throw error;
  }
};

/**
 * Delete a claim
 * @param {string} claimId - The claim ID
 * @returns {boolean} Success status
 */
export const deleteClaim = (claimId) => {
  try {
    const claims = getAllClaims();
    const filtered = claims.filter(c => c.id !== claimId);
    
    if (filtered.length === claims.length) {
      console.warn('Claim not found for deletion:', claimId);
      return false;
    }
    
    saveClaims(filtered);
    return true;
  } catch (error) {
    console.error('Error deleting claim:', error);
    return false;
  }
};

/**
 * Add a note to a claim
 * @param {string} claimId - The claim ID
 * @param {string} noteText - The note text
 * @param {string} noteType - Type of note (user, system, milestone)
 * @returns {Object|null} The updated claim
 */
export const addClaimNote = (claimId, noteText, noteType = 'user') => {
  const claim = getClaimById(claimId);
  if (!claim) return null;
  
  const note = {
    id: `note_${Date.now()}`,
    date: new Date().toISOString(),
    text: noteText,
    type: noteType
  };
  
  const notes = [...(claim.notes || []), note];
  return updateClaim(claimId, { notes });
};

// ============================================
// PHASE TRANSITIONS
// ============================================

/**
 * Advance claim to next phase
 * @param {string} claimId - The claim ID
 * @param {string} newPhase - The new phase code
 * @param {Object} additionalUpdates - Additional updates to apply
 * @returns {Object|null} The updated claim
 */
export const advanceClaimPhase = (claimId, newPhase, additionalUpdates = {}) => {
  const claim = getClaimById(claimId);
  if (!claim) return null;
  
  // Add phase transition note
  const note = {
    id: `note_${Date.now()}`,
    date: new Date().toISOString(),
    text: `Phase changed to: ${newPhase}`,
    type: 'milestone'
  };
  
  return updateClaim(claimId, {
    currentPhase: newPhase,
    notes: [...(claim.notes || []), note],
    ...additionalUpdates
  });
};

/**
 * Update evidence checklist item
 * @param {string} claimId - The claim ID
 * @param {string} evidenceItem - The evidence item key
 * @param {boolean} value - The new value
 * @returns {Object|null} The updated claim
 */
export const updateEvidenceItem = (claimId, evidenceItem, value) => {
  const claim = getClaimById(claimId);
  if (!claim) return null;
  
  const evidenceChecklist = {
    ...claim.evidenceChecklist,
    [evidenceItem]: value
  };
  
  return updateClaim(claimId, { evidenceChecklist });
};

/**
 * Record decision received
 * @param {string} claimId - The claim ID
 * @param {Object} decisionData - Decision details
 * @returns {Object|null} The updated claim
 */
export const recordDecision = (claimId, decisionData) => {
  const claim = getClaimById(claimId);
  if (!claim) return null;
  
  const { outcome, ratingPercentage, effectiveDate, denialReason, denialDetails } = decisionData;
  const decisionDate = decisionData.decisionDate || new Date().toISOString();
  
  const updates = {
    currentPhase: 'DECISION',
    decisionInfo: {
      ...claim.decisionInfo,
      outcome,
      ratingPercentage,
      effectiveDate,
      denialReason,
      denialDetails
    },
    criticalDates: {
      ...claim.criticalDates,
      decisionDate,
      appealDeadline: calculateAppealDeadline(decisionDate)
    }
  };
  
  // Add decision note
  const note = {
    id: `note_${Date.now()}`,
    date: new Date().toISOString(),
    text: `Decision received: ${outcome}${ratingPercentage ? ` at ${ratingPercentage}%` : ''}`,
    type: 'milestone'
  };
  
  updates.notes = [...(claim.notes || []), note];
  
  return updateClaim(claimId, updates);
};

// ============================================
// SETTINGS
// ============================================

/**
 * Get navigator settings
 * @returns {Object} Settings object
 */
export const getSettings = () => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : getDefaultSettings();
  } catch (error) {
    console.error('Error reading settings:', error);
    return getDefaultSettings();
  }
};

/**
 * Update settings
 * @param {Object} updates - Partial settings updates
 * @returns {Object} Updated settings
 */
export const updateSettings = (updates) => {
  try {
    const settings = { ...getSettings(), ...updates };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

/**
 * Get default settings
 */
const getDefaultSettings = () => ({
  deadlineWarningDays: 30,
  showCompletedClaims: true,
  defaultView: 'dashboard',
  notifications: {
    deadlineReminders: true,
    statusChanges: true
  },
  lastSeenVersion: SCHEMA_VERSION
});

// ============================================
// EXPORT / IMPORT
// ============================================

/**
 * Export all claims as JSON
 * @returns {string} JSON string of all claims
 */
export const exportClaimsData = () => {
  try {
    const claims = getAllClaims();
    const settings = getSettings();
    
    const exportData = {
      version: SCHEMA_VERSION,
      exportDate: new Date().toISOString(),
      claims,
      settings
    };
    
    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('Error exporting claims:', error);
    throw error;
  }
};

/**
 * Import claims from JSON
 * @param {string} jsonData - JSON string to import
 * @param {boolean} merge - If true, merge with existing claims
 * @returns {Object} Import result
 */
export const importClaimsData = (jsonData, merge = false) => {
  try {
    const data = JSON.parse(jsonData);
    
    if (!data.claims || !Array.isArray(data.claims)) {
      throw new Error('Invalid import data format');
    }
    
    if (merge) {
      const existing = getAllClaims();
      const existingIds = new Set(existing.map(c => c.id));
      
      // Add new claims, skip duplicates
      const newClaims = data.claims.filter(c => !existingIds.has(c.id));
      saveClaims([...existing, ...newClaims]);
      
      return {
        success: true,
        imported: newClaims.length,
        skipped: data.claims.length - newClaims.length
      };
    } else {
      saveClaims(data.claims);
      if (data.settings) {
        updateSettings(data.settings);
      }
      
      return {
        success: true,
        imported: data.claims.length,
        skipped: 0
      };
    }
  } catch (error) {
    console.error('Error importing claims:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================
// HELPERS
// ============================================

/**
 * Save claims to storage
 */
const saveClaims = (claims) => {
  const data = {
    version: SCHEMA_VERSION,
    lastUpdated: new Date().toISOString(),
    claims
  };
  localStorage.setItem(CLAIMS_KEY, JSON.stringify(data));
};

/**
 * Deep merge objects
 */
const deepMerge = (target, source) => {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
};

/**
 * Migrate claims from older versions
 */
const migrateClaims = (data) => {
  // Add migration logic as schema evolves
  console.log('Migrating claims from version', data.version, 'to', SCHEMA_VERSION);
  
  const claims = data.claims || [];
  
  // Apply migrations based on version
  claims.forEach(claim => {
    if (!claim.metadata) {
      claim.metadata = {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: SCHEMA_VERSION
      };
    }
  });
  
  // Save migrated data
  saveClaims(claims);
  
  return claims;
};

/**
 * Clear all claim navigator data (for testing/reset)
 */
export const clearAllNavigatorData = () => {
  localStorage.removeItem(CLAIMS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
};

// ============================================
// STATISTICS
// ============================================

/**
 * Get claim statistics for dashboard
 * @returns {Object} Statistics object
 */
export const getClaimStatistics = () => {
  const claims = getAllClaims();
  
  const stats = {
    totalClaims: claims.length,
    byStatus: {
      drafting: 0,
      submitted: 0,
      pending: 0,
      granted: 0,
      denied: 0,
      appealing: 0
    },
    byType: {
      ORIGINAL: 0,
      INCREASE: 0,
      SECONDARY: 0,
      SUPPLEMENTAL: 0,
      HLR: 0,
      BOARD_APPEAL: 0
    },
    deadlinesApproaching: 0,
    averageCompleteness: 0
  };
  
  let totalCompleteness = 0;
  
  claims.forEach(claim => {
    // Count by type
    if (claim.claimType && stats.byType[claim.claimType] !== undefined) {
      stats.byType[claim.claimType]++;
    }
    
    // Count by status/phase
    if (claim.currentPhase === 'TRIAGE' || claim.currentPhase === 'GATHERING_EVIDENCE') {
      stats.byStatus.drafting++;
    } else if (claim.currentPhase === 'CLAIM_SUBMITTED' || claim.currentPhase === 'INITIAL_REVIEW') {
      stats.byStatus.submitted++;
    } else if (['EVIDENCE_GATHERING', 'CP_EXAM_SCHEDULED', 'PREPARATION_FOR_DECISION'].includes(claim.currentPhase)) {
      stats.byStatus.pending++;
    } else if (claim.decisionInfo?.outcome === 'GRANTED') {
      stats.byStatus.granted++;
    } else if (claim.decisionInfo?.outcome === 'DENIED') {
      stats.byStatus.denied++;
    } else if (claim.currentPhase === 'APPEAL') {
      stats.byStatus.appealing++;
    }
    
    // Check deadlines
    if (claim.criticalDates?.appealDeadline) {
      const days = daysUntil(claim.criticalDates.appealDeadline);
      if (days > 0 && days <= 30) {
        stats.deadlinesApproaching++;
      }
    }
    if (claim.criticalDates?.itfExpirationDate) {
      const days = daysUntil(claim.criticalDates.itfExpirationDate);
      if (days > 0 && days <= 30) {
        stats.deadlinesApproaching++;
      }
    }
    
    // Calculate completeness
    if (claim.evidenceChecklist) {
      const items = Object.values(claim.evidenceChecklist);
      const complete = items.filter(v => v === true).length;
      totalCompleteness += (complete / items.length) * 100;
    }
  });
  
  stats.averageCompleteness = claims.length > 0 
    ? Math.round(totalCompleteness / claims.length) 
    : 0;
  
  return stats;
};

const daysUntil = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
};

export default {
  generateClaimId,
  getAllClaims,
  getClaimById,
  createClaim,
  updateClaim,
  deleteClaim,
  addClaimNote,
  advanceClaimPhase,
  updateEvidenceItem,
  recordDecision,
  getSettings,
  updateSettings,
  exportClaimsData,
  importClaimsData,
  clearAllNavigatorData,
  getClaimStatistics
};
