/**
 * Vet-Rate.org - Sequential Formation Flow Hook
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Drives Muster Call's document-by-document (SEQUENTIAL MODE) processing:
 * calling each document forward, running extraction, and handing control to
 * the user for verification before moving to the next document. Extracted
 * from MusterCall.jsx to keep the component under the max-lines-per-function
 * / complexity budget.
 */

import { useState } from "react";
import {
  processFormationDocument,
  PROCESSING_STATES,
} from "../utils/musterCallProcessor";

/**
 * @param {object} params
 * @param {ReturnType<typeof import('./useFormationQueue').default>} params.formationQueue
 * @param {object} params.toast
 * @param {(msg: string|null) => void} params.setError
 * @param {(state: string) => void} params.setProcessingState
 */
export const useSequentialFormationFlow = ({
  formationQueue,
  toast,
  setError,
  setProcessingState,
}) => {
  const {
    formation,
    stats,
    updateEntry,
    startFormation,
    completeCurrentAndNext,
    skipCurrentAndNext,
    errorCurrentAndNext,
  } = formationQueue;

  const [currentProgress, setCurrentProgress] = useState(null);
  const [activeEntry, setActiveEntry] = useState(null);
  const [extractionResult, setExtractionResult] = useState(null);
  const [showIntelBriefing, setShowIntelBriefing] = useState(false);

  /**
   * Process a specific document entry.
   * This can be called with an entry directly, avoiding stale state issues.
   */
  const processDocumentEntry = async (entry) => {
    if (!entry) {
      // eslint-disable-next-line no-console
      console.log("✅ Formation complete!");
      setProcessingState(PROCESSING_STATES.COMPLETE);
      setActiveEntry(null);
      setCurrentProgress(null);
      toast.success(
        `Formation complete! ${stats?.completed || 0} document${(stats?.completed || 0) !== 1 ? "s" : ""} processed successfully.`,
        7000,
      );
      return;
    }

    const file = entry.file;
    // eslint-disable-next-line no-console
    console.log(`🎖️ Processing document: ${file.name}`);

    setActiveEntry(entry);
    updateEntry(entry.id, { status: "CALLED" });
    setCurrentProgress({
      filename: file.name,
      fileSize: entry.fileSize || file.size,
      state: "initializing",
      stage: "platoon_sergeant",
      progress: 0,
      message: "Count, OFF! Preparing formation for inspection...",
    });
    setProcessingState(PROCESSING_STATES.EXTRACTING);

    try {
      const result = await processFormationDocument(file, (progressData) => {
        // eslint-disable-next-line no-console
        console.log("📊 Progress update received:", progressData);
        setCurrentProgress({
          filename: file.name,
          fileSize: entry.fileSize || file.size,
          ...progressData,
        });

        if (progressData.stage === "platoon_sergeant") {
          updateEntry(entry.id, {
            status: "OCR_IN_PROGRESS",
            progress: progressData.progress,
          });
        } else if (
          progressData.stage === "intel_classify" ||
          progressData.stage === "intel_extract"
        ) {
          updateEntry(entry.id, {
            status: "INTEL_BRIEFING",
            progress: progressData.progress,
          });
        }
      });

      // eslint-disable-next-line no-console
      console.log("✅ Document processed:", result);

      // Check status === 'complete' since processFormationDocument sets that, not success
      if (result.status === "complete" && result.readyForReview) {
        setExtractionResult(result);
        setShowIntelBriefing(true);
        updateEntry(entry.id, { status: "USER_REVIEW" });
      } else if (result.status === "error") {
        throw new Error(result.error || "Processing failed");
      }
    } catch (err) {
      console.error("❌ Document processing error:", err);
      const nextEntry = errorCurrentAndNext(err.message);
      setCurrentProgress(null);
      setActiveEntry(null);

      // Move to next document after error
      setTimeout(() => {
        if (nextEntry) {
          processDocumentEntry(nextEntry);
        } else {
          const next = formation.find((e) => e.status === "WAITING");
          if (next) {
            processDocumentEntry(next);
          } else {
            processDocumentEntry(null); // Triggers completion
          }
        }
      }, 1000);
    }
  };

  const handleVerifyAndSave = async (verifiedData) => {
    // eslint-disable-next-line no-console
    console.log("✅ User verified data:", verifiedData);

    try {
      const nextEntry = completeCurrentAndNext({
        ...extractionResult,
        verifiedData,
      });

      toast.success(
        `Document "${extractionResult.filename}" saved to Knowledge Base`,
      );

      setShowIntelBriefing(false);
      setExtractionResult(null);
      setCurrentProgress(null);
      setActiveEntry(null);

      setTimeout(() => {
        if (nextEntry) {
          processDocumentEntry(nextEntry);
        } else {
          const next = formation.find(
            (e) => e.status === "WAITING" || e.status === "CALLED",
          );
          if (next) {
            processDocumentEntry(next);
          } else {
            processDocumentEntry(null); // Triggers completion
          }
        }
      }, 500);
    } catch (err) {
      console.error("❌ Save error:", err);
      setError(err.message);
      toast.error(`Failed to save document: ${err.message}`);
    }
  };

  const handleSkipDocument = () => {
    // eslint-disable-next-line no-console
    console.log("⏭️ Skipping document:", activeEntry?.file?.name);

    const nextEntry = skipCurrentAndNext("User skipped");
    setShowIntelBriefing(false);
    setExtractionResult(null);
    setCurrentProgress(null);
    setActiveEntry(null);

    setTimeout(() => {
      if (nextEntry) {
        processDocumentEntry(nextEntry);
      } else {
        const next = formation.find((e) => e.status === "WAITING");
        if (next) {
          processDocumentEntry(next);
        } else {
          processDocumentEntry(null); // Triggers completion
        }
      }
    }, 500);
  };

  const startSequentialProcessing = () => {
    // eslint-disable-next-line no-console
    console.log("🚩 Starting sequential formation processing...");
    const firstEntry = startFormation();
    // eslint-disable-next-line no-console
    console.log("🚩 First entry:", firstEntry);

    if (firstEntry) {
      // Process the first document directly instead of relying on currentEntry
      processDocumentEntry(firstEntry);
    }
  };

  return {
    currentProgress,
    activeEntry,
    extractionResult,
    showIntelBriefing,
    setShowIntelBriefing,
    processDocumentEntry,
    handleVerifyAndSave,
    handleSkipDocument,
    startSequentialProcessing,
  };
};

export default useSequentialFormationFlow;
