/**
 * Vet-Rate.org - Muster Call Orchestration Hook
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Composes the Formation-queue, AI-loader, file-intake, sequential-flow,
 * and legacy-batch hooks into everything MusterCall.jsx's render needs.
 * Extracted from MusterCall.jsx to keep the component under the
 * max-lines-per-function / complexity budget.
 */

import { useState, useEffect } from "react";
import { PROCESSING_STATES } from "../utils/musterCallProcessor";
import useFormationQueue from "./useFormationQueue";
import useMusterCallAILoader from "./useMusterCallAILoader";
import useMusterCallFileIntake from "./useMusterCallFileIntake";
import useSequentialFormationFlow from "./useSequentialFormationFlow";
import useLegacyBatchProcessing from "./useLegacyBatchProcessing";

/**
 * @param {object} params
 * @param {object} params.toast
 * @param {(briefingData: object) => void} [params.onProcessComplete]
 * @param {boolean} params.useSequentialMode
 */
export const useMusterCallOrchestration = ({
  toast,
  onProcessComplete,
  useSequentialMode,
}) => {
  const formationQueue = useFormationQueue();
  const { formation, hasDocuments, currentEntry } = formationQueue;

  // Debug: Log formation changes
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(
      `📋 MusterCall formation changed: length=${formation.length}, hasDocuments=${hasDocuments}`,
    );
  }, [formation, hasDocuments]);

  const ai = useMusterCallAILoader(toast);

  const [processingState, setProcessingState] = useState(
    PROCESSING_STATES.IDLE,
  );
  const [error, setError] = useState(null);

  const intake = useMusterCallFileIntake({
    useSequentialMode,
    formationQueue,
    toast,
    setError,
  });
  const flow = useSequentialFormationFlow({
    formationQueue,
    toast,
    setError,
    setProcessingState,
  });
  const batch = useLegacyBatchProcessing({
    files: intake.files,
    setError,
    setProcessingState,
    onProcessComplete,
  });

  // Compute locally to avoid stale closure issues (MUST be after processingState is declared)
  // Use !currentEntry instead of === null because .find() returns undefined, not null
  const shouldShowFormation =
    processingState === PROCESSING_STATES.IDLE &&
    useSequentialMode &&
    formation.length > 0 &&
    !currentEntry &&
    !flow.activeEntry;

  // Show processing view when we have an active entry being processed
  const showProcessingView =
    flow.activeEntry && flow.currentProgress && !flow.showIntelBriefing;

  /**
   * Start processing files (dispatches to Formation or legacy batch mode)
   */
  const handleStartProcessing = async () => {
    if (useSequentialMode && formation.length > 0) {
      flow.startSequentialProcessing();
      return;
    }
    if (intake.files.length === 0) return;
    await batch.handleStartBatchProcessing();
  };

  /**
   * Reset to initial state
   */
  const handleReset = () => {
    intake.resetFileIntake();
    batch.resetBatchState();
    setProcessingState(PROCESSING_STATES.IDLE);
    setError(null);
  };

  return {
    formationQueue,
    ai,
    processingState,
    error,
    intake,
    flow,
    batch,
    shouldShowFormation,
    showProcessingView,
    handleStartProcessing,
    handleReset,
  };
};

export default useMusterCallOrchestration;
