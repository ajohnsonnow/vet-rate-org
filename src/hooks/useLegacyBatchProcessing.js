/**
 * Vet-Rate.org - Legacy Batch Processing Hook
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Muster Call's original all-at-once (LEGACY BATCH) document processing
 * mode, kept as a fallback to the Formation (sequential) flow. Extracted
 * from MusterCall.jsx to keep the component under the max-lines-per-function
 * / complexity budget.
 */

import { useState, useRef } from "react";
import {
  processMusterCallBatch,
  autoPopulateProfile,
  generateMusterCallReport,
  analyzeEvidenceGaps,
  extractIntelligenceBriefingData,
  PROCESSING_STATES,
} from "../utils/musterCallProcessor";
import { isAnyAIAvailable, getAIStatus } from "../utils/unifiedAIService";

/**
 * Handles the `onComplete` callback of processMusterCallBatch: auto-populate
 * the profile, generate the LLM report, run evidence-gap analysis, and
 * trigger the Intelligence Briefing. Not a hook itself — only closes over
 * setters passed in `ctx`, same as any other plain callback.
 */
async function runBatchOnComplete(completeData, ctx) {
  const {
    setResults,
    setProcessingState,
    setReport,
    setError,
    onProcessComplete,
  } = ctx;

  setResults(completeData);
  setProcessingState(PROCESSING_STATES.POPULATING);

  const populateResult = await autoPopulateProfile(completeData.results);
  if (populateResult.success) {
    // eslint-disable-next-line no-console
    console.log(`✅ Auto-populated ${populateResult.count} profile fields`);
  }

  // eslint-disable-next-line no-console
  console.log("🤖 Checking AI availability for report generation...");
  const aiStatus = getAIStatus();
  // eslint-disable-next-line no-console
  console.log("🤖 AI Status:", aiStatus);

  if (isAnyAIAvailable()) {
    // eslint-disable-next-line no-console
    console.log("✅ AI available, generating report...");
    setProcessingState(PROCESSING_STATES.ANALYZING);
    const reportResult = await generateMusterCallReport(
      completeData.results,
      completeData.classified,
    );
    // eslint-disable-next-line no-console
    console.log("📊 Report result:", reportResult);

    if (reportResult.success) {
      // eslint-disable-next-line no-console
      console.log("✅ Setting report in state");
      setReport(reportResult.report);
    } else {
      console.warn("⚠️ Report generation failed:", reportResult.error);
      setError(`Report generation failed: ${reportResult.error}`);
    }
  } else {
    console.warn("⚠️ No AI service available for report generation");
  }

  // Evidence Gap Analysis (v1.16.0)
  // eslint-disable-next-line no-console
  console.log("🔍 Running Evidence Gap Analysis...");
  const gapAnalysis = analyzeEvidenceGaps(completeData.results);
  if (gapAnalysis.success && gapAnalysis.totalGaps > 0) {
    // eslint-disable-next-line no-console
    console.log(`⚠️ Found ${gapAnalysis.totalGaps} potential evidence gaps!`);
    if (completeData.results) {
      completeData.evidenceGaps = gapAnalysis;
    }
  } else {
    // eslint-disable-next-line no-console
    console.log("✅ No significant evidence gaps detected");
  }

  setProcessingState(PROCESSING_STATES.COMPLETE);

  // Trigger Intelligence Briefing if callback provided
  if (onProcessComplete && completeData && completeData.results) {
    const briefingData = extractIntelligenceBriefingData(completeData.results);
    onProcessComplete(briefingData);
  }
}

/**
 * @param {object} params
 * @param {File[]} params.files
 * @param {(msg: string|null) => void} params.setError
 * @param {(state: string) => void} params.setProcessingState
 * @param {(briefingData: object) => void} [params.onProcessComplete]
 */
export const useLegacyBatchProcessing = ({
  files,
  setError,
  setProcessingState,
  onProcessComplete,
}) => {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    processing: 0,
  });
  const [fileProgress, setFileProgress] = useState({});
  const [results, setResults] = useState(null);
  const [report, setReport] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const abortControllerRef = useRef(null);

  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setProcessing(false);
      setProcessingState(PROCESSING_STATES.IDLE);
      setError("Processing stopped by user");
    }
  };

  const handleStartBatchProcessing = async () => {
    // Create new abort controller for this processing run
    abortControllerRef.current = new AbortController();

    setProcessing(true);
    setProcessingState(PROCESSING_STATES.VALIDATING);
    setResults(null);
    setReport(null);
    setError(null);
    setShowReport(false);

    try {
      const result = await processMusterCallBatch(files, {
        signal: abortControllerRef.current.signal,
        onProgress: (progressData) => {
          if (progressData.state) {
            setProcessingState(progressData.state);
          }
          if (progressData.filename) {
            setFileProgress((prev) => ({
              ...prev,
              [progressData.filename]: {
                state: progressData.state,
                progress: progressData.progress || 0,
                error: progressData.error,
              },
            }));
          }
          if (progressData.total !== undefined) {
            setProgress({
              total: progressData.total,
              completed: progressData.completed,
              processing: progressData.processing,
            });
          }
        },
        onComplete: (completeData) =>
          runBatchOnComplete(completeData, {
            setResults,
            setProcessingState,
            setReport,
            setError,
            onProcessComplete,
          }),
      });

      if (!result.success) {
        throw new Error(result.validation.errors[0] || "Processing failed");
      }
    } catch (err) {
      console.error("Muster Call processing error:", err);
      if (err.name === "AbortError") {
        setError("Processing stopped by user");
      } else {
        setError(err.message);
      }
      setProcessingState(PROCESSING_STATES.ERROR);
    } finally {
      setProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const resetBatchState = () => {
    setProcessing(false);
    setProgress({ completed: 0, total: 0, processing: 0 });
    setFileProgress({});
    setResults(null);
    setReport(null);
    setShowReport(false);
  };

  return {
    processing,
    progress,
    fileProgress,
    results,
    report,
    showReport,
    setShowReport,
    handleStartBatchProcessing,
    handleStopProcessing,
    resetBatchState,
  };
};

export default useLegacyBatchProcessing;
