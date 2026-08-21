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
 * Formation queue action creators. Split out of useFormationQueue as its own
 * custom hook (still calls useCallback internally) so the parent hook body
 * stays under the line budget without breaking rules-of-hooks.
 */
function useFormationActions({ formation, setFormation, currentEntry }) {
  const initializeFormation = useCallback(
    (files) => initializeFormationImpl(files, setFormation),
    [setFormation],
  );

  const addToFormation = useCallback(
    (files) => addFilesToFormation(formation, setFormation, files),
    [formation, setFormation],
  );

  const updateEntry = useCallback(
    (entryId, updates) =>
      setFormation((prev) => updateFormationEntry(prev, entryId, updates)),
    [setFormation],
  );

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

  const completeCurrentAndNext = useCallback(
    (result) =>
      completeCurrentAndNextImpl(currentEntry, formation, updateEntry, result),
    [currentEntry, formation, updateEntry],
  );

  const skipCurrentAndNext = useCallback(
    (reason = "User skipped") =>
      skipCurrentAndNextImpl(currentEntry, formation, updateEntry, reason),
    [currentEntry, formation, updateEntry],
  );

  const errorCurrentAndNext = useCallback(
    (error) =>
      errorCurrentAndNextImpl(currentEntry, formation, updateEntry, error),
    [currentEntry, formation, updateEntry],
  );

  const startFormation = useCallback(
    () => startFormationImpl(formation, updateEntry),
    [formation, updateEntry],
  );

  const reorderDocuments = useCallback(
    (fromIndex, toIndex) =>
      reorderFormationDocuments(formation, setFormation, fromIndex, toIndex),
    [formation, setFormation],
  );

  const removeDocument = useCallback(
    (entryId) => removeFormationDocument(formation, setFormation, entryId),
    [formation, setFormation],
  );

  return {
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
  };
}

/**
 * The remaining formation queue actions - split from useFormationActions
 * purely to keep both hooks under the line budget.
 */
function useFormationStatus({
  formation,
  setFormation,
  setCurrentEntry,
  setStats,
}) {
  const clearFormation = useCallback(
    () => clearFormationImpl(setFormation, setCurrentEntry, setStats),
    [setFormation, setCurrentEntry, setStats],
  );

  const isComplete = useCallback(
    () => isFormationComplete(formation),
    [formation],
  );

  const getProgress = useCallback(
    () => getFormationProgress(formation),
    [formation],
  );

  return { clearFormation, isComplete, getProgress };
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

  const {
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
  } = useFormationActions({
    formation,
    setFormation,
    currentEntry,
  });

  const { clearFormation, isComplete, getProgress } = useFormationStatus({
    formation,
    setFormation,
    setCurrentEntry,
    setStats,
  });

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
