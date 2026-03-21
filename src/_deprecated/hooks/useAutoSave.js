/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 *
 * useAutoSave Hook
 *
 * A React hook that provides auto-save functionality for forms and inputs.
 * Integrates with the persistent storage system to ensure data survives
 * crashes and cache clears.
 *
 * Usage:
 *   const { markModified, saveNow, status } = useAutoSave();
 *
 *   // In your input onChange:
 *   onChange={(e) => {
 *     setFormData({...formData, field: e.target.value});
 *     markModified();
 *   }}
 *
 *   // In your "Next" button:
 *   onClick={async () => {
 *     await saveNow();
 *     navigateToNextStep();
 *   }}
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  markAsModified,
  saveOnStepComplete,
  manualSave,
  addSaveListener,
  checkHasUnsavedChanges,
  getSaveStatus,
  gatherPacketData,
} from "../utils/persistentStorage";

/**
 * Hook for auto-save functionality
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether auto-save is enabled (default: true)
 * @param {Function} options.onSave - Callback when save completes
 * @param {Function} options.onError - Callback when save fails
 */
export function useAutoSave(options = {}) {
  const { enabled = true, onSave, onError } = options;

  const [status, setStatus] = useState("ready"); // 'ready' | 'saving' | 'saved' | 'error' | 'unsaved'
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);

  // Track if there are unsaved changes
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (checkHasUnsavedChanges() && status !== "saving") {
        setStatus("unsaved");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [enabled, status]);

  // Listen for save events
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = addSaveListener((eventType, data) => {
      switch (eventType) {
        case "saving":
          setStatus("saving");
          setError(null);
          break;
        case "saved":
        case "downloaded":
        case "file-created":
          setStatus("saved");
          setLastSaved(Date.now());
          setError(null);
          onSave?.(data);
          break;
        case "save-error":
          setStatus("error");
          setError(data?.message || "Save failed");
          onError?.(data);
          break;
      }
    });

    return unsubscribe;
  }, [enabled, onSave, onError]);

  /**
   * Mark that data has been modified (triggers auto-save)
   */
  const markModified = useCallback(() => {
    if (!enabled) return;
    markAsModified();
    setStatus("unsaved");
  }, [enabled]);

  /**
   * Force an immediate save (for step transitions)
   */
  const saveNow = useCallback(async () => {
    if (!enabled) return true;

    setStatus("saving");
    try {
      await saveOnStepComplete();
      setStatus("saved");
      setLastSaved(Date.now());
      return true;
    } catch (err) {
      setStatus("error");
      setError(err.message);
      onError?.(err);
      return false;
    }
  }, [enabled, onError]);

  /**
   * Manual save with download option
   */
  const saveManual = useCallback(
    async (forceDownload = false) => {
      if (!enabled) return true;

      setStatus("saving");
      try {
        await manualSave(forceDownload);
        setStatus("saved");
        setLastSaved(Date.now());
        return true;
      } catch (err) {
        setStatus("error");
        setError(err.message);
        onError?.(err);
        return false;
      }
    },
    [enabled, onError],
  );

  return {
    // Actions
    markModified,
    saveNow,
    saveManual,

    // Status
    status,
    lastSaved,
    error,
    hasUnsavedChanges: status === "unsaved",
    isSaving: status === "saving",

    // Utility
    clearError: () => setError(null),
  };
}

/**
 * Hook for wrapping form inputs with auto-save
 * Returns modified onChange handlers that trigger auto-save
 */
export function useAutoSaveInputs(initialData = {}) {
  const [formData, setFormData] = useState(initialData);
  const { markModified, saveNow, status, hasUnsavedChanges } = useAutoSave();

  /**
   * Create an onChange handler for a specific field
   */
  const createFieldHandler = useCallback(
    (fieldName) => {
      return (event) => {
        const value =
          event.target.type === "checkbox"
            ? event.target.checked
            : event.target.value;

        setFormData((prev) => ({ ...prev, [fieldName]: value }));
        markModified();
      };
    },
    [markModified],
  );

  /**
   * Update a field directly
   */
  const setField = useCallback(
    (fieldName, value) => {
      setFormData((prev) => ({ ...prev, [fieldName]: value }));
      markModified();
    },
    [markModified],
  );

  /**
   * Update multiple fields at once
   */
  const setFields = useCallback(
    (updates) => {
      setFormData((prev) => ({ ...prev, ...updates }));
      markModified();
    },
    [markModified],
  );

  /**
   * Reset form to initial data
   */
  const reset = useCallback(() => {
    setFormData(initialData);
  }, [initialData]);

  return {
    formData,
    setFormData,
    createFieldHandler,
    setField,
    setFields,
    reset,
    saveNow,
    status,
    hasUnsavedChanges,
  };
}

/**
 * Higher-order component that wraps a form component with auto-save
 */
export function withAutoSave(WrappedComponent) {
  return function AutoSaveWrapper(props) {
    const autoSave = useAutoSave();
    return <WrappedComponent {...props} autoSave={autoSave} />;
  };
}

/**
 * Hook for step-based forms (wizard-style)
 * Saves automatically when moving between steps
 */
export function useStepAutoSave(totalSteps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { markModified, saveNow, status } = useAutoSave();
  const isSavingRef = useRef(false);

  /**
   * Navigate to next step (saves first)
   */
  const nextStep = useCallback(async () => {
    if (isSavingRef.current) return false;

    isSavingRef.current = true;
    try {
      await saveNow();
      if (currentStep < totalSteps - 1) {
        setCurrentStep((prev) => prev + 1);
      }
      return true;
    } finally {
      isSavingRef.current = false;
    }
  }, [currentStep, totalSteps, saveNow]);

  /**
   * Navigate to previous step (saves first)
   */
  const prevStep = useCallback(async () => {
    if (isSavingRef.current) return false;

    isSavingRef.current = true;
    try {
      await saveNow();
      if (currentStep > 0) {
        setCurrentStep((prev) => prev - 1);
      }
      return true;
    } finally {
      isSavingRef.current = false;
    }
  }, [currentStep, saveNow]);

  /**
   * Go to specific step (saves first)
   */
  const goToStep = useCallback(
    async (step) => {
      if (isSavingRef.current) return false;
      if (step < 0 || step >= totalSteps) return false;

      isSavingRef.current = true;
      try {
        await saveNow();
        setCurrentStep(step);
        return true;
      } finally {
        isSavingRef.current = false;
      }
    },
    [totalSteps, saveNow],
  );

  return {
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    goToStep,
    markModified,
    status,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === totalSteps - 1,
    progress: ((currentStep + 1) / totalSteps) * 100,
  };
}

export default useAutoSave;
