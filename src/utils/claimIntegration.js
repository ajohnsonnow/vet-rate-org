/**
 * SupplyLocker.org - Claim Integration Bridge
 * Connects ClaimNavigator with existing tools (ClaimProgress, useClaimProgress)
 * 
 * This bridge ensures all tools share data and work as a unified system:
 * - ClaimNavigator (workflow/phases) ↔ ClaimProgress (Big 3 evidence)
 * - ClaimNavigator actions → useClaimProgress milestones
 * - Two-way sync for evidence tracking
 * 
 * Built by a fellow veteran. "One mission, one data source."
 */

// ============================================
// STORAGE KEY MAPPINGS
// ============================================

// Keys used by ClaimProgress.jsx for Big 3 tracking
const BIG_THREE_KEYS = {
  DIAGNOSIS: (condition) => `${condition}_diagnosis`,
  EVENT: (condition) => `${condition}_event`,
  NEXUS: (condition) => `${condition}_nexus`
};

// Keys used by useClaimProgress.js for milestone tracking
const MILESTONE_KEYS = {
  ITF_FILED: 'vet_rate_itf_status',
  PROFILE: 'vet_rate_veteran_profile',
  DIAGNOSES: 'vet_rate_saved_claims',
  SECONDARY: 'secondary_conditions_found',
  MEDICAL_RECORDS: 'vet_rate_medical_records_status',
  SERVICE_CONNECTION: 'cfile_analysis_completed',
  SYMPTOMS: 'symptom_logs',
  BUDDY_STATEMENTS: 'vet_rate_buddy_statements',
  NEXUS: 'nexus_letters',
  STATEMENT: 'vet_rate_statements',
  EXAM_PREP: 'vet_rate_exam_prep_complete',
  RATINGS: 'vet_rate_my_ratings',
  FORMS: 'vet_rate_saved_forms',
  // New keys for ClaimNavigator integration
  CLAIM_NAVIGATOR_ACTIVE: 'vet_rate_claim_navigator_active',
  CLAIM_CREATED: 'vet_rate_claim_navigator_claim_created',
  PHASE_ADVANCED: 'vet_rate_claim_navigator_phase_advanced'
};

// ============================================
// BIG 3 EVIDENCE SYNC
// ============================================

/**
 * Read Big 3 evidence status from ClaimProgress storage
 * @param {string} condition - Condition name/slug
 * @returns {Object} { diagnosis, event, nexus, complete }
 */
export const getBigThreeStatus = (condition) => {
  if (!condition) return { diagnosis: false, event: false, nexus: false, complete: false };
  
  const slug = condition.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  const diagnosis = localStorage.getItem(BIG_THREE_KEYS.DIAGNOSIS(slug)) === 'true';
  const event = localStorage.getItem(BIG_THREE_KEYS.EVENT(slug)) === 'true';
  const nexus = localStorage.getItem(BIG_THREE_KEYS.NEXUS(slug)) === 'true';
  
  return {
    diagnosis,
    event,
    nexus,
    complete: diagnosis && event && nexus
  };
};

/**
 * Set Big 3 evidence status (syncs to ClaimProgress storage)
 * @param {string} condition - Condition name/slug
 * @param {string} type - 'diagnosis', 'event', or 'nexus'
 * @param {boolean} value - true/false
 */
export const setBigThreeStatus = (condition, type, value) => {
  if (!condition) return;
  
  const slug = condition.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const keyMap = {
    'diagnosis': BIG_THREE_KEYS.DIAGNOSIS(slug),
    'event': BIG_THREE_KEYS.EVENT(slug),
    'nexus': BIG_THREE_KEYS.NEXUS(slug)
  };
  
  const key = keyMap[type];
  if (key) {
    localStorage.setItem(key, value ? 'true' : 'false');
    
    // Dispatch event for real-time updates across components
    window.dispatchEvent(new CustomEvent('bigThreeUpdate', {
      detail: { condition: slug, type, value }
    }));
  }
};

/**
 * Sync ClaimNavigator evidence items WITH Big 3 status
 * Maps ClaimNavigator evidence schema to Big 3 keys
 */
export const syncEvidenceToBigThree = (condition, evidenceItems) => {
  if (!condition || !evidenceItems) return;
  
  // Map ClaimNavigator evidence types to Big 3
  const mapping = {
    'medical_diagnosis': 'diagnosis',
    'in_service_event': 'event',
    'nexus_letter': 'nexus'
  };
  
  Object.entries(evidenceItems).forEach(([key, item]) => {
    const bigThreeType = mapping[key];
    if (bigThreeType && item?.status === 'obtained') {
      setBigThreeStatus(condition, bigThreeType, true);
    }
  });
};

/**
 * Read Big 3 status and convert to ClaimNavigator evidence format
 */
export const bigThreeToNavigatorEvidence = (condition) => {
  const status = getBigThreeStatus(condition);
  
  return {
    medical_diagnosis: status.diagnosis ? { status: 'obtained' } : { status: 'needed' },
    in_service_event: status.event ? { status: 'obtained' } : { status: 'needed' },
    nexus_letter: status.nexus ? { status: 'obtained' } : { status: 'needed' }
  };
};

// ============================================
// MILESTONE SYNC (ClaimNavigator → useClaimProgress)
// ============================================

/**
 * Mark ITF as filed (syncs with useClaimProgress milestone)
 * @param {Date|string} date - ITF filing date
 */
export const markItfFiled = (date) => {
  const data = {
    filed: true,
    status: 'filed',
    date: date instanceof Date ? date.toISOString() : date,
    source: 'claim_navigator'
  };
  
  localStorage.setItem(MILESTONE_KEYS.ITF_FILED, JSON.stringify(data));
  dispatchProgressUpdate('itf_filed', true);
};

/**
 * Mark medical records as reviewed
 */
export const markMedicalRecordsReviewed = () => {
  localStorage.setItem(MILESTONE_KEYS.MEDICAL_RECORDS, JSON.stringify({
    reviewed: true,
    timestamp: new Date().toISOString(),
    source: 'claim_navigator'
  }));
  dispatchProgressUpdate('medical_records', true);
};

/**
 * Mark service connection as identified
 */
export const markServiceConnectionIdentified = () => {
  localStorage.setItem(MILESTONE_KEYS.SERVICE_CONNECTION, JSON.stringify({
    completed: true,
    timestamp: new Date().toISOString(),
    source: 'claim_navigator'
  }));
  dispatchProgressUpdate('service_connection', true);
};

/**
 * Mark exam prep as complete
 */
export const markExamPrepComplete = () => {
  localStorage.setItem(MILESTONE_KEYS.EXAM_PREP, 'true');
  dispatchProgressUpdate('exam_prep', true);
};

/**
 * Record that a claim was created in ClaimNavigator
 */
export const recordClaimCreated = (claimType) => {
  localStorage.setItem(MILESTONE_KEYS.CLAIM_CREATED, JSON.stringify({
    created: true,
    type: claimType,
    timestamp: new Date().toISOString()
  }));
  localStorage.setItem(MILESTONE_KEYS.CLAIM_NAVIGATOR_ACTIVE, 'true');
  dispatchProgressUpdate('claim_created', true);
};

/**
 * Record phase advancement
 */
export const recordPhaseAdvanced = (claimId, fromPhase, toPhase) => {
  const history = JSON.parse(localStorage.getItem(MILESTONE_KEYS.PHASE_ADVANCED) || '[]');
  history.push({
    claimId,
    fromPhase,
    toPhase,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem(MILESTONE_KEYS.PHASE_ADVANCED, JSON.stringify(history));
  dispatchProgressUpdate('phase_advanced', true);
};

// ============================================
// CROSS-TOOL DATA READING
// ============================================

/**
 * Check if user has saved diagnoses/conditions (from any tool)
 * @returns {Array} Array of condition names
 */
export const getSavedConditions = () => {
  try {
    // Try useClaimProgress storage first
    const savedClaims = localStorage.getItem(MILESTONE_KEYS.DIAGNOSES);
    if (savedClaims) {
      const parsed = JSON.parse(savedClaims);
      if (Array.isArray(parsed)) {
        return parsed.map(c => c.name || c.condition || c).filter(Boolean);
      }
      if (parsed.conditions) {
        return parsed.conditions.map(c => c.name || c).filter(Boolean);
      }
    }
    
    // Check for My Ratings storage
    const myRatings = localStorage.getItem(MILESTONE_KEYS.RATINGS);
    if (myRatings) {
      const parsed = JSON.parse(myRatings);
      if (Array.isArray(parsed)) {
        return parsed.map(r => r.condition || r.name).filter(Boolean);
      }
    }
    
    return [];
  } catch {
    return [];
  }
};

/**
 * Get existing nexus letters (from Nexus Builder)
 * @returns {Array} Array of nexus letter objects
 */
export const getExistingNexusLetters = () => {
  try {
    const letters = localStorage.getItem(MILESTONE_KEYS.NEXUS);
    if (letters) {
      return JSON.parse(letters);
    }
    return [];
  } catch {
    return [];
  }
};

/**
 * Check if profile exists
 * @returns {Object|null} Profile data or null
 */
export const getVeteranProfile = () => {
  try {
    const profile = localStorage.getItem(MILESTONE_KEYS.PROFILE);
    return profile ? JSON.parse(profile) : null;
  } catch {
    return null;
  }
};

/**
 * Get overall progress from useClaimProgress milestones
 * @returns {Object} { percentage, completedCount, totalCount, milestones }
 */
export const getOverallMilestoneProgress = () => {
  const milestoneChecks = [
    { id: 'itf_filed', key: MILESTONE_KEYS.ITF_FILED, weight: 10 },
    { id: 'profile', key: MILESTONE_KEYS.PROFILE, weight: 5 },
    { id: 'diagnosis', key: MILESTONE_KEYS.DIAGNOSES, weight: 12 },
    { id: 'medical_records', key: MILESTONE_KEYS.MEDICAL_RECORDS, weight: 10 },
    { id: 'service_connection', key: MILESTONE_KEYS.SERVICE_CONNECTION, weight: 12 },
    { id: 'nexus', key: MILESTONE_KEYS.NEXUS, weight: 12 },
    { id: 'forms', key: MILESTONE_KEYS.FORMS, weight: 5 }
  ];
  
  let totalWeight = 0;
  let completedWeight = 0;
  const completed = [];
  
  milestoneChecks.forEach(m => {
    totalWeight += m.weight;
    const data = localStorage.getItem(m.key);
    if (data && data !== 'null' && data !== '[]' && data !== '{}') {
      try {
        const parsed = JSON.parse(data);
        // Check if actually has content
        if (Array.isArray(parsed) ? parsed.length > 0 : 
            typeof parsed === 'object' ? Object.keys(parsed).length > 0 : 
            parsed) {
          completedWeight += m.weight;
          completed.push(m.id);
        }
      } catch {
        // Non-JSON value like 'true'
        if (data === 'true' || data === 'filed') {
          completedWeight += m.weight;
          completed.push(m.id);
        }
      }
    }
  });
  
  return {
    percentage: Math.round((completedWeight / totalWeight) * 100),
    completedCount: completed.length,
    totalCount: milestoneChecks.length,
    milestones: completed
  };
};

// ============================================
// EVENT DISPATCHING
// ============================================

/**
 * Dispatch progress update event (for real-time sync)
 */
const dispatchProgressUpdate = (milestoneId, completed) => {
  window.dispatchEvent(new CustomEvent('claimProgressUpdate', {
    detail: { milestoneId, completed, source: 'claim_navigator' }
  }));
};

/**
 * Dispatch claim navigator update event
 */
export const dispatchNavigatorUpdate = (eventType, data) => {
  window.dispatchEvent(new CustomEvent('claimNavigatorUpdate', {
    detail: { type: eventType, ...data }
  }));
};

// ============================================
// CROSS-TOOL NAVIGATION HELPERS
// ============================================

/**
 * Get suggested tool for a given action type
 * @param {string} actionType - The action identifier
 * @returns {Object} { tool, description, action }
 */
export const getSuggestedTool = (actionType) => {
  const toolMap = {
    'file_itf': {
      tool: 'FormsHelper',
      description: 'Use Forms Helper to file VA Form 21-0966',
      action: 'open_forms_helper'
    },
    'gather_diagnosis': {
      tool: 'BlueButton',
      description: 'Import diagnoses from VA Blue Button records',
      action: 'open_blue_button'
    },
    'explore_secondary': {
      tool: 'SecondaryScout',
      description: 'Find secondary conditions with Secondary Scout',
      action: 'open_secondary_scout'
    },
    'build_nexus': {
      tool: 'NexusBuilder',
      description: 'Generate nexus logic with Nexus Builder',
      action: 'open_nexus_builder'
    },
    'log_symptoms': {
      tool: 'SymptomLogger',
      description: 'Document daily symptoms',
      action: 'open_symptom_logger'
    },
    'review_cfile': {
      tool: 'CFileAnalyzer',
      description: 'Analyze your C-File for service events',
      action: 'open_cfile_analyzer'
    },
    'calculate_rating': {
      tool: 'TacticalCalculator',
      description: 'Calculate combined rating',
      action: 'open_calculator'
    },
    'prepare_exam': {
      tool: 'CPExamGuide',
      description: 'Review C&P exam preparation guide',
      action: 'open_cp_guide'
    },
    'fill_forms': {
      tool: 'FormsHelper',
      description: 'Fill VA claim forms',
      action: 'open_forms_helper'
    },
    'evidence_gap': {
      tool: 'EvidenceGapVisualizer',
      description: 'See what evidence you need',
      action: 'open_evidence_gap'
    }
  };
  
  return toolMap[actionType] || null;
};

// ============================================
// INITIALIZATION & CLEANUP
// ============================================

/**
 * Initialize integration listeners
 * Call this when the app mounts
 */
export const initIntegrationListeners = () => {
  // Listen for ClaimProgress updates and sync to ClaimNavigator
  window.addEventListener('claimProgressUpdate', (e) => {
    const { milestoneId, completed } = e.detail;
    if (milestoneId && completed) {
      dispatchNavigatorUpdate('milestone_sync', { milestoneId, completed });
    }
  });
  
  // Listen for Big 3 updates
  window.addEventListener('bigThreeUpdate', (e) => {
    const { condition, type, value } = e.detail;
    dispatchNavigatorUpdate('evidence_sync', { condition, type, value });
  });
};

/**
 * Clean up integration listeners
 */
export const cleanupIntegrationListeners = () => {
  // Would remove event listeners if needed
  // For now, listeners persist for app lifetime
};

export default {
  // Big 3 Sync
  getBigThreeStatus,
  setBigThreeStatus,
  syncEvidenceToBigThree,
  bigThreeToNavigatorEvidence,
  
  // Milestone Sync
  markItfFiled,
  markMedicalRecordsReviewed,
  markServiceConnectionIdentified,
  markExamPrepComplete,
  recordClaimCreated,
  recordPhaseAdvanced,
  
  // Cross-tool Data
  getSavedConditions,
  getExistingNexusLetters,
  getVeteranProfile,
  getOverallMilestoneProgress,
  
  // Tools
  getSuggestedTool,
  
  // Events
  dispatchNavigatorUpdate,
  initIntegrationListeners,
  cleanupIntegrationListeners
};
