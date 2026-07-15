/**
 * Vet-Rate.org - Formation Queue Hook
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * React hook for managing formation queue state
 */

import { useState, useCallback, useEffect } from "react";
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
  FORMATION_STATUS,
} from "../utils/formationQueue";

function logFormationInitialized(count) {
  // eslint-disable-next-line no-console
  console.log(`🚩 Formation initialized with ${count} documents`);
}

function logFormationStatsUpdated(newStats, current) {
  // eslint-disable-next-line no-console
  console.log("📊 Formation stats updated:", {
    total: newStats.total,
    waiting: newStats.waiting,
    inProgress: newStats.inProgress,
    currentEntry: current ? current.filename : "none",
    isProcessing: current !== null,
  });
}

function logInitializeFormationStart(files) {
  // eslint-disable-next-line no-console
  console.log("🚩 initializeFormation called with:", files?.length, "files");
  // eslint-disable-next-line no-console
  console.log("🚩 Files are:", files);
}

function logInitializeFormationBuilt(newFormation) {
  // eslint-disable-next-line no-console
  console.log("🚩 buildFormation returned:", newFormation?.length, "entries");
  // eslint-disable-next-line no-console
  console.log("🚩 First entry:", newFormation?.[0]);
}

function logInitializeFormationSaved(count) {
  // eslint-disable-next-line no-console
  console.log(`🚩 Formation state updated with ${count} documents`);
}

/**
 * Mark the current entry with the given update, then call the next
 * entry in formation forward. Shared by completeCurrentAndNext,
 * skipCurrentAndNext, and errorCurrentAndNext.
 */
function advanceToNext(
  currentEntry,
  formation,
  updateEntry,
  currentEntryUpdate,
) {
  if (!currentEntry) return null;

  updateEntry(currentEntry.id, currentEntryUpdate);

  const next = getNextInFormation(formation);
  if (next) {
    updateEntry(next.id, {
      status: FORMATION_STATUS.CALLED,
    });
    // eslint-disable-next-line no-console
    console.log(`📞 Called to inspection: ${next.filename}`);
  }

  return next;
}

function buildStatusUpdate(status, extra) {
  return {
    status,
    ...extra,
    processedAt: new Date().toISOString(),
  };
}

function completeCurrentAndNextImpl(
  currentEntry,
  formation,
  updateEntry,
  result,
) {
  return advanceToNext(
    currentEntry,
    formation,
    updateEntry,
    buildStatusUpdate(FORMATION_STATUS.SAVED, { result }),
  );
}

function skipCurrentAndNextImpl(currentEntry, formation, updateEntry, reason) {
  return advanceToNext(
    currentEntry,
    formation,
    updateEntry,
    buildStatusUpdate(FORMATION_STATUS.SKIPPED, { error: reason }),
  );
}

function errorCurrentAndNextImpl(currentEntry, formation, updateEntry, error) {
  return advanceToNext(
    currentEntry,
    formation,
    updateEntry,
    buildStatusUpdate(FORMATION_STATUS.ERROR, {
      error: error.message || error,
    }),
  );
}

function loadInitialFormation(setFormation) {
  const savedFormation = loadFormationState();
  if (savedFormation && savedFormation.length > 0) {
    setFormation(savedFormation);
    logFormationInitialized(savedFormation.length);
  }
}

function syncFormationStats(formation, setStats, setCurrentEntry) {
  if (formation.length > 0) {
    const newStats = getFormationStats(formation);
    const current = getCurrentDocument(formation);
    setStats(newStats);
    setCurrentEntry(current);

    // Debug logging
    logFormationStatsUpdated(newStats, current);

    // Auto-save state
    saveFormationState(formation);
  } else {
    setStats(null);
    setCurrentEntry(null);
  }
}

function initializeFormationImpl(files, setFormation) {
  logInitializeFormationStart(files);

  if (!files || files.length === 0) {
    console.error("🚩 ERROR: No files provided to initializeFormation!");
    return [];
  }

  const newFormation = buildFormation(files);
  logInitializeFormationBuilt(newFormation);

  setFormation(newFormation);
  logInitializeFormationSaved(newFormation.length);
  return newFormation;
}

function addFilesToFormation(formation, setFormation, files) {
  const newEntries = buildFormation(files);
  const combined = [...formation, ...newEntries];
  const sorted = sortFormation(combined);
  setFormation(sorted);
  // eslint-disable-next-line no-console
  console.log(`🚩 Added ${newEntries.length} documents to formation`);
  return sorted;
}

function applyCurrentStatusUpdate(
  currentEntry,
  updateEntry,
  status,
  additionalData,
) {
  if (!currentEntry) {
    console.warn("No current entry to update");
    return;
  }

  updateEntry(currentEntry.id, {
    status,
    ...additionalData,
  });
}

function startFormationImpl(formation, updateEntry) {
  const first = getNextInFormation(formation);
  if (first) {
    updateEntry(first.id, {
      status: FORMATION_STATUS.CALLED,
    });
    // eslint-disable-next-line no-console
    console.log(`🚩 Formation begun - First call: ${first.filename}`);
    return first;
  }
  return null;
}

function reorderFormationDocuments(
  formation,
  setFormation,
  fromIndex,
  toIndex,
) {
  const reordered = reorderFormation(formation, fromIndex, toIndex);
  setFormation(reordered);
  // eslint-disable-next-line no-console
  console.log(`🔄 Formation reordered: ${fromIndex} → ${toIndex}`);
}

function removeFormationDocument(formation, setFormation, entryId) {
  const filtered = removeFromFormation(formation, entryId);
  setFormation(filtered);
  // eslint-disable-next-line no-console
  console.log(`❌ Removed document from formation`);
}

function clearFormationImpl(setFormation, setCurrentEntry, setStats) {
  setFormation([]);
  setCurrentEntry(null);
  setStats(null);
  clearFormationState();
  // eslint-disable-next-line no-console
  console.log("🚩 Formation dismissed");
}

/**
 * Hook for managing formation queue
 */
export const useFormationQueue = () => {
  const [formation, setFormation] = useState([]);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [stats, setStats] = useState(null);

  // Load saved formation on mount
  useEffect(() => {
    loadInitialFormation(setFormation);
  }, []);

  // Update stats whenever formation changes
  useEffect(() => {
    syncFormationStats(formation, setStats, setCurrentEntry);
  }, [formation]);

  /**
   * Initialize formation from files
   */
  const initializeFormation = useCallback(
    (files) => initializeFormationImpl(files, setFormation),
    [],
  );

  /**
   * Add files to existing formation
   */
  const addToFormation = useCallback(
    (files) => addFilesToFormation(formation, setFormation, files),
    [formation],
  );

  /**
   * Update a document entry
   */
  const updateEntry = useCallback(
    (entryId, updates) =>
      setFormation((prev) => updateFormationEntry(prev, entryId, updates)),
    [],
  );

  /**
   * Update current entry status
   */
  const updateCurrentStatus = useCallback(
    (status, additionalData = {}) =>
      applyCurrentStatusUpdate(
        currentEntry,
        updateEntry,
        status,
        additionalData,
      ),
    [currentEntry, updateEntry],
  );

  /**
   * Mark current document as complete and move to next
   */
  const completeCurrentAndNext = useCallback(
    (result) =>
      completeCurrentAndNextImpl(currentEntry, formation, updateEntry, result),
    [currentEntry, formation, updateEntry],
  );

  /**
   * Skip current document and move to next
   */
  const skipCurrentAndNext = useCallback(
    (reason = "User skipped") =>
      skipCurrentAndNextImpl(currentEntry, formation, updateEntry, reason),
    [currentEntry, formation, updateEntry],
  );

  /**
   * Mark current as error and move to next
   */
  const errorCurrentAndNext = useCallback(
    (error) =>
      errorCurrentAndNextImpl(currentEntry, formation, updateEntry, error),
    [currentEntry, formation, updateEntry],
  );

  /**
   * Start processing formation
   */
  const startFormation = useCallback(
    () => startFormationImpl(formation, updateEntry),
    [formation, updateEntry],
  );

  /**
   * Reorder documents (drag and drop)
   */
  const reorderDocuments = useCallback(
    (fromIndex, toIndex) =>
      reorderFormationDocuments(formation, setFormation, fromIndex, toIndex),
    [formation],
  );

  /**
   * Remove document from formation
   */
  const removeDocument = useCallback(
    (entryId) => removeFormationDocument(formation, setFormation, entryId),
    [formation],
  );

  /**
   * Clear entire formation
   */
  const clearFormation = useCallback(
    () => clearFormationImpl(setFormation, setCurrentEntry, setStats),
    [],
  );

  /**
   * Check if formation is complete
   */
  const isComplete = useCallback(
    () => isFormationComplete(formation),
    [formation],
  );

  /**
   * Get progress percentage
   */
  const getProgress = useCallback(
    () => getFormationProgress(formation),
    [formation],
  );

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
    isProcessing: currentEntry !== null,
  };
};

export default useFormationQueue;
