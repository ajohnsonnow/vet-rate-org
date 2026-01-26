/**
 * Vet-Rate.org - Formation Queue Manager
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "Formation & Inspection" - Sequential document processing system
 * Manages the queue of documents waiting for inspection and processing.
 * 
 * Military Workflow:
 * 1. Formation Lineup - Files organize by priority
 * 2. Call to Inspection - Process one at a time
 * 3. Platoon Sergeant Review - OCR/extraction
 * 4. SecOps Intelligence Brief - AI analysis
 * 5. User Verification - Data validation
 * 6. VKB Storage - Save verified data
 * 7. Next in Formation - Move to next document
 */

import { DOCUMENT_TYPES, classifyDocument } from './documentClassifier';

/**
 * Priority levels for document types
 * Higher number = processed first
 */
export const PRIORITY_LEVELS = {
  [DOCUMENT_TYPES.DD214]: 10,        // Critical - Service record
  [DOCUMENT_TYPES.DD215]: 10,        // Critical - Corrected DD214
  [DOCUMENT_TYPES.NGB22]: 10,        // Critical - Guard service
  [DOCUMENT_TYPES.DD256]: 9,         // Critical - Reserve discharge
  [DOCUMENT_TYPES.DD257]: 9,         // Critical - Reserve discharge
  [DOCUMENT_TYPES.RATING_DECISION]: 9, // Critical - Current ratings
  [DOCUMENT_TYPES.CLAIM_LETTER]: 8,  // Important - Pending claims
  [DOCUMENT_TYPES.DBQ]: 7,           // Important - Medical opinion
  [DOCUMENT_TYPES.NEXUS_LETTER]: 7,  // Important - Medical nexus
  [DOCUMENT_TYPES.C_FILE_MEDICAL]: 6, // Important - Medical evidence
  [DOCUMENT_TYPES.MEDICAL_RECORD]: 6, // Important - Treatment records
  [DOCUMENT_TYPES.EXAM_REPORT]: 5,   // Review - Exam results
  [DOCUMENT_TYPES.PERSONAL_STATEMENT]: 5, // Review - Veteran statement
  [DOCUMENT_TYPES.VA_CORRESPONDENCE]: 4, // Review - VA letters
  [DOCUMENT_TYPES.UNKNOWN]: 0        // Last - Unknown docs
};

/**
 * Priority labels for UI display
 */
export const PRIORITY_LABELS = {
  10: { label: 'CRITICAL', color: 'red', icon: '🔴' },
  9: { label: 'CRITICAL', color: 'red', icon: '🔴' },
  8: { label: 'IMPORTANT', color: 'orange', icon: '🟠' },
  7: { label: 'IMPORTANT', color: 'orange', icon: '🟠' },
  6: { label: 'IMPORTANT', color: 'yellow', icon: '🟡' },
  5: { label: 'REVIEW', color: 'blue', icon: '🔵' },
  4: { label: 'REVIEW', color: 'blue', icon: '🔵' },
  0: { label: 'UNKNOWN', color: 'gray', icon: '⚪' }
};

/**
 * Document status in formation queue
 */
export const FORMATION_STATUS = {
  WAITING: 'WAITING',           // In formation, not processed yet
  CALLED: 'CALLED',             // Currently being inspected
  OCR_IN_PROGRESS: 'OCR_IN_PROGRESS', // Platoon Sergeant review
  INTEL_BRIEFING: 'INTEL_BRIEFING',   // SecOps analysis
  USER_REVIEW: 'USER_REVIEW',   // Awaiting user verification
  VERIFIED: 'VERIFIED',         // User verified, ready to save
  SAVED: 'SAVED',               // Saved to VKB
  SKIPPED: 'SKIPPED',           // User chose to skip
  ERROR: 'ERROR'                // Processing error
};

/**
 * Quick classify a file to determine priority
 * Uses filename and file type for fast classification
 */
const quickClassifyFile = (file) => {
  const filename = file.name.toLowerCase();
  
  // Quick classification based on filename patterns
  if (filename.includes('dd214') || filename.includes('dd-214')) {
    return DOCUMENT_TYPES.DD214;
  }
  if (filename.includes('dd215') || filename.includes('dd-215')) {
    return DOCUMENT_TYPES.DD215;
  }
  if (filename.includes('ngb') || filename.includes('national guard')) {
    return DOCUMENT_TYPES.NGB22;
  }
  if (filename.includes('rating') && filename.includes('decision')) {
    return DOCUMENT_TYPES.RATING_DECISION;
  }
  if (filename.includes('claim')) {
    return DOCUMENT_TYPES.CLAIM_LETTER;
  }
  if (filename.includes('dbq') || filename.includes('disability benefits questionnaire')) {
    return DOCUMENT_TYPES.DBQ;
  }
  if (filename.includes('nexus') || filename.includes('imo') || filename.includes('medical opinion')) {
    return DOCUMENT_TYPES.NEXUS_LETTER;
  }
  if (filename.includes('medical') || filename.includes('treatment')) {
    return DOCUMENT_TYPES.MEDICAL_RECORD;
  }
  if (filename.includes('c-file') || filename.includes('cfile')) {
    return DOCUMENT_TYPES.C_FILE_MEDICAL;
  }
  
  // Default to unknown - will be classified during processing
  return DOCUMENT_TYPES.UNKNOWN;
};

/**
 * Create formation entry from file
 */
export const createFormationEntry = (file, index) => {
  const estimatedType = quickClassifyFile(file);
  const priority = PRIORITY_LEVELS[estimatedType] || 0;
  const priorityInfo = PRIORITY_LABELS[priority] || PRIORITY_LABELS[0];
  
  return {
    id: `formation-${Date.now()}-${index}`,
    file,
    filename: file.name,
    fileSize: file.size,
    estimatedType,
    priority,
    priorityLabel: priorityInfo.label,
    priorityColor: priorityInfo.color,
    priorityIcon: priorityInfo.icon,
    status: FORMATION_STATUS.WAITING,
    addedAt: new Date().toISOString(),
    processedAt: null,
    result: null,
    error: null
  };
};

/**
 * Sort formation queue by priority (highest first)
 */
export const sortFormation = (formation) => {
  return [...formation].sort((a, b) => {
    // Primary sort: Priority (highest first)
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    
    // Secondary sort: File size (smaller first for same priority)
    return a.fileSize - b.fileSize;
  });
};

/**
 * Build formation from files
 */
export const buildFormation = (files) => {
  if (!files || files.length === 0) {
    return [];
  }
  
  const fileArray = Array.isArray(files) ? files : Array.from(files);
  const formation = fileArray.map((file, index) => createFormationEntry(file, index));
  
  return sortFormation(formation);
};

/**
 * Get formation statistics
 */
export const getFormationStats = (formation) => {
  const stats = {
    total: formation.length,
    waiting: 0,
    inProgress: 0,
    completed: 0,
    skipped: 0,
    errors: 0,
    critical: 0,
    important: 0,
    review: 0,
    unknown: 0,
    totalSize: 0,
    completedSize: 0
  };
  
  formation.forEach(entry => {
    stats.totalSize += entry.fileSize;
    
    // Status counts
    switch (entry.status) {
      case FORMATION_STATUS.WAITING:
        stats.waiting++;
        break;
      case FORMATION_STATUS.CALLED:
      case FORMATION_STATUS.OCR_IN_PROGRESS:
      case FORMATION_STATUS.INTEL_BRIEFING:
      case FORMATION_STATUS.USER_REVIEW:
      case FORMATION_STATUS.VERIFIED:
        stats.inProgress++;
        break;
      case FORMATION_STATUS.SAVED:
        stats.completed++;
        stats.completedSize += entry.fileSize;
        break;
      case FORMATION_STATUS.SKIPPED:
        stats.skipped++;
        break;
      case FORMATION_STATUS.ERROR:
        stats.errors++;
        break;
    }
    
    // Priority counts
    if (entry.priority >= 9) {
      stats.critical++;
    } else if (entry.priority >= 6) {
      stats.important++;
    } else if (entry.priority >= 4) {
      stats.review++;
    } else {
      stats.unknown++;
    }
  });
  
  return stats;
};

/**
 * Get next document to process
 */
export const getNextInFormation = (formation) => {
  return formation.find(entry => entry.status === FORMATION_STATUS.WAITING);
};

/**
 * Get currently processing document
 */
export const getCurrentDocument = (formation) => {
  return formation.find(entry => 
    entry.status === FORMATION_STATUS.CALLED ||
    entry.status === FORMATION_STATUS.OCR_IN_PROGRESS ||
    entry.status === FORMATION_STATUS.INTEL_BRIEFING ||
    entry.status === FORMATION_STATUS.USER_REVIEW ||
    entry.status === FORMATION_STATUS.VERIFIED
  );
};

/**
 * Update document status in formation
 */
export const updateFormationEntry = (formation, entryId, updates) => {
  return formation.map(entry => {
    if (entry.id === entryId) {
      return {
        ...entry,
        ...updates,
        updatedAt: new Date().toISOString()
      };
    }
    return entry;
  });
};

/**
 * Reorder formation (drag and drop)
 */
export const reorderFormation = (formation, fromIndex, toIndex) => {
  const result = [...formation];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
};

/**
 * Remove document from formation
 */
export const removeFromFormation = (formation, entryId) => {
  return formation.filter(entry => entry.id !== entryId);
};

/**
 * Check if formation is complete
 */
export const isFormationComplete = (formation) => {
  return formation.every(entry => 
    entry.status === FORMATION_STATUS.SAVED ||
    entry.status === FORMATION_STATUS.SKIPPED ||
    entry.status === FORMATION_STATUS.ERROR
  );
};

/**
 * Get formation progress percentage
 */
export const getFormationProgress = (formation) => {
  if (formation.length === 0) return 0;
  
  const completed = formation.filter(entry => 
    entry.status === FORMATION_STATUS.SAVED ||
    entry.status === FORMATION_STATUS.SKIPPED
  ).length;
  
  return Math.round((completed / formation.length) * 100);
};

/**
 * Save formation state to localStorage
 */
export const saveFormationState = (formation) => {
  try {
    // Can't save File objects directly, so save metadata only
    const serializable = formation.map(entry => ({
      ...entry,
      file: {
        name: entry.file.name,
        size: entry.file.size,
        type: entry.file.type
      }
    }));
    
    localStorage.setItem('vetrate_formation_state', JSON.stringify({
      formation: serializable,
      savedAt: new Date().toISOString()
    }));
    
    return true;
  } catch (error) {
    console.error('Failed to save formation state:', error);
    return false;
  }
};

/**
 * Check if there's a saved formation to resume
 */
export const canResumeFormation = () => {
  try {
    const saved = localStorage.getItem('vetrate_formation_state');
    if (!saved) return false;
    
    const state = JSON.parse(saved);
    if (!state.formation || state.formation.length === 0) return false;
    
    // Check if there are any incomplete documents
    return state.formation.some(entry => 
      entry.status === FORMATION_STATUS.WAITING ||
      entry.status === FORMATION_STATUS.CALLED ||
      entry.status === FORMATION_STATUS.OCR_IN_PROGRESS ||
      entry.status === FORMATION_STATUS.INTEL_BRIEFING ||
      entry.status === FORMATION_STATUS.USER_REVIEW ||
      entry.status === FORMATION_STATUS.VERIFIED
    );
  } catch (error) {
    console.error('Failed to check resume state:', error);
    return false;
  }
};

/**
 * Load saved formation state from localStorage
 * Note: File objects can't be serialized, so entries without actual files
 * will be displayed but can't be reprocessed
 */
export const loadFormationState = () => {
  try {
    const saved = localStorage.getItem('vetrate_formation_state');
    if (!saved) return null;
    
    const state = JSON.parse(saved);
    if (!state.formation || state.formation.length === 0) return null;
    
    console.log(`📂 Loading ${state.formation.length} documents from saved formation`);
    
    // Return the formation entries (without actual File objects)
    // Reset status to WAITING if not already completed/saved
    // This allows resuming formation after page refresh
    return state.formation.map(entry => {
      // Keep completed/saved/skipped/error statuses as-is
      // Reset in-progress statuses back to WAITING
      let status = entry.status;
      if (status === FORMATION_STATUS.CALLED ||
          status === FORMATION_STATUS.OCR_IN_PROGRESS ||
          status === FORMATION_STATUS.INTEL_BRIEFING ||
          status === FORMATION_STATUS.USER_REVIEW ||
          status === FORMATION_STATUS.VERIFIED) {
        status = FORMATION_STATUS.WAITING;
        console.log(`   ⏸️ Reset ${entry.filename} from ${entry.status} to WAITING`);
      }
      
      return {
        ...entry,
        status,
        // Mark that this is restored from storage (no actual File object)
        isRestored: true
      };
    });
  } catch (error) {
    console.error('Failed to load formation state:', error);
    return null;
  }
};

/**
 * Clear saved formation state
 */
export const clearFormationState = () => {
  localStorage.removeItem('vetrate_formation_state');
};

/**
 * Get recommended processing order message
 */
export const getProcessingOrderMessage = (formation) => {
  const stats = getFormationStats(formation);
  
  if (stats.critical > 0) {
    return `Processing ${stats.critical} critical document${stats.critical > 1 ? 's' : ''} first (DD214, Rating Decisions)`;
  }
  if (stats.important > 0) {
    return `Processing ${stats.important} important document${stats.important > 1 ? 's' : ''} (Claims, Medical Records)`;
  }
  if (stats.review > 0) {
    return `Processing ${stats.review} document${stats.review > 1 ? 's' : ''} for review`;
  }
  if (stats.unknown > 0) {
    return `Processing ${stats.unknown} unknown document${stats.unknown > 1 ? 's' : ''} - will classify during inspection`;
  }
  
  return 'Ready to begin formation inspection';
};
