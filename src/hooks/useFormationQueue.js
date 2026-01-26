/**
 * Vet-Rate.org - Formation Queue Hook
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * React hook for managing formation queue state
 */

import { useState, useCallback, useEffect } from 'react';
import {
  buildFormation,
  sortFormation,
  getFormationStats,
  getNextInFormation,
  getCurrentDocument,
  updateFormationEntry,
  reorderFormation,
  removeFromFormation,
  isFormationComplete,
  getFormationProgress,
  saveFormationState,
  loadFormationState,
  clearFormationState,
  FORMATION_STATUS
} from '../utils/formationQueue';

/**
 * Hook for managing formation queue
 */
export const useFormationQueue = () => {
  const [formation, setFormation] = useState([]);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [stats, setStats] = useState(null);

  // Load saved formation on mount
  useEffect(() => {
    const savedFormation = loadFormationState();
    if (savedFormation && savedFormation.length > 0) {
      setFormation(savedFormation);
      console.log(`🚩 Formation initialized with ${savedFormation.length} documents`);
    }
  }, []);

  // Update stats whenever formation changes
  useEffect(() => {
    if (formation.length > 0) {
      const newStats = getFormationStats(formation);
      const current = getCurrentDocument(formation);
      setStats(newStats);
      setCurrentEntry(current);
      
      // Debug logging
      console.log('📊 Formation stats updated:', {
        total: newStats.total,
        waiting: newStats.waiting,
        inProgress: newStats.inProgress,
        currentEntry: current ? current.filename : 'none',
        isProcessing: current !== null
      });
      
      // Auto-save state
      saveFormationState(formation);
    } else {
      setStats(null);
      setCurrentEntry(null);
    }
  }, [formation]);

  /**
   * Initialize formation from files
   */
  const initializeFormation = useCallback((files) => {
    console.log('🚩 initializeFormation called with:', files?.length, 'files');
    console.log('🚩 Files are:', files);
    
    if (!files || files.length === 0) {
      console.error('🚩 ERROR: No files provided to initializeFormation!');
      return [];
    }
    
    const newFormation = buildFormation(files);
    console.log('🚩 buildFormation returned:', newFormation?.length, 'entries');
    console.log('🚩 First entry:', newFormation?.[0]);
    
    setFormation(newFormation);
    console.log(`🚩 Formation state updated with ${newFormation.length} documents`);
    return newFormation;
  }, []);

  /**
   * Add files to existing formation
   */
  const addToFormation = useCallback((files) => {
    const newEntries = buildFormation(files);
    const combined = [...formation, ...newEntries];
    const sorted = sortFormation(combined);
    setFormation(sorted);
    console.log(`🚩 Added ${newEntries.length} documents to formation`);
    return sorted;
  }, [formation]);

  /**
   * Update a document entry
   */
  const updateEntry = useCallback((entryId, updates) => {
    setFormation(prev => updateFormationEntry(prev, entryId, updates));
  }, []);

  /**
   * Update current entry status
   */
  const updateCurrentStatus = useCallback((status, additionalData = {}) => {
    if (!currentEntry) {
      console.warn('No current entry to update');
      return;
    }
    
    updateEntry(currentEntry.id, {
      status,
      ...additionalData
    });
  }, [currentEntry, updateEntry]);

  /**
   * Mark current document as complete and move to next
   */
  const completeCurrentAndNext = useCallback((result) => {
    if (!currentEntry) return null;
    
    // Mark current as saved
    updateEntry(currentEntry.id, {
      status: FORMATION_STATUS.SAVED,
      result,
      processedAt: new Date().toISOString()
    });
    
    // Get next in formation
    const next = getNextInFormation(formation);
    if (next) {
      updateEntry(next.id, {
        status: FORMATION_STATUS.CALLED
      });
      console.log(`📞 Called to inspection: ${next.filename}`);
    }
    
    return next;
  }, [currentEntry, formation, updateEntry]);

  /**
   * Skip current document and move to next
   */
  const skipCurrentAndNext = useCallback((reason = 'User skipped') => {
    if (!currentEntry) return null;
    
    // Mark current as skipped
    updateEntry(currentEntry.id, {
      status: FORMATION_STATUS.SKIPPED,
      error: reason,
      processedAt: new Date().toISOString()
    });
    
    // Get next in formation
    const next = getNextInFormation(formation);
    if (next) {
      updateEntry(next.id, {
        status: FORMATION_STATUS.CALLED
      });
      console.log(`📞 Called to inspection: ${next.filename}`);
    }
    
    return next;
  }, [currentEntry, formation, updateEntry]);

  /**
   * Mark current as error and move to next
   */
  const errorCurrentAndNext = useCallback((error) => {
    if (!currentEntry) return null;
    
    // Mark current as error
    updateEntry(currentEntry.id, {
      status: FORMATION_STATUS.ERROR,
      error: error.message || error,
      processedAt: new Date().toISOString()
    });
    
    // Get next in formation
    const next = getNextInFormation(formation);
    if (next) {
      updateEntry(next.id, {
        status: FORMATION_STATUS.CALLED
      });
      console.log(`📞 Called to inspection: ${next.filename}`);
    }
    
    return next;
  }, [currentEntry, formation, updateEntry]);

  /**
   * Start processing formation
   */
  const startFormation = useCallback(() => {
    const first = getNextInFormation(formation);
    if (first) {
      updateEntry(first.id, {
        status: FORMATION_STATUS.CALLED
      });
      console.log(`🚩 Formation begun - First call: ${first.filename}`);
      return first;
    }
    return null;
  }, [formation, updateEntry]);

  /**
   * Reorder documents (drag and drop)
   */
  const reorderDocuments = useCallback((fromIndex, toIndex) => {
    const reordered = reorderFormation(formation, fromIndex, toIndex);
    setFormation(reordered);
    console.log(`🔄 Formation reordered: ${fromIndex} → ${toIndex}`);
  }, [formation]);

  /**
   * Remove document from formation
   */
  const removeDocument = useCallback((entryId) => {
    const filtered = removeFromFormation(formation, entryId);
    setFormation(filtered);
    console.log(`❌ Removed document from formation`);
  }, [formation]);

  /**
   * Clear entire formation
   */
  const clearFormation = useCallback(() => {
    setFormation([]);
    setCurrentEntry(null);
    setStats(null);
    clearFormationState();
    console.log('🚩 Formation dismissed');
  }, []);

  /**
   * Check if formation is complete
   */
  const isComplete = useCallback(() => {
    return isFormationComplete(formation);
  }, [formation]);

  /**
   * Get progress percentage
   */
  const getProgress = useCallback(() => {
    return getFormationProgress(formation);
  }, [formation]);

  return {
    // State
    formation,
    currentEntry,
    stats,
    
    // Actions
    initializeFormation,
    addToFormation,
    updateEntry,
    updateCurrentStatus,
    completeCurrentAndNext,
    skipCurrentAndNext,
    errorCurrentAndNext,
    startFormation,
    reorderDocuments,
    removeDocument,
    clearFormation,
    
    // Computed
    isComplete: isComplete(),
    progress: getProgress(),
    hasDocuments: formation.length > 0,
    isProcessing: currentEntry !== null
  };
};

export default useFormationQueue;
