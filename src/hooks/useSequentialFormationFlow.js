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

import { useRef, useState } from "react";
import {
  processFormationDocument,
  persistFormationDocument,
  retryFormationDocumentPersist,
  describePersistIncomplete,
  autoPopulateProfile,
  PROCESSING_STATES,
} from "../utils/musterCallProcessor";
import { neutralDocumentLabel } from "../utils/documentLabel";
import {
  setServiceEntryDate,
  getServiceEntryForDocument,
} from "../utils/veteranProfile";
import { parseExplicitDate } from "../utils/dateUtils";
import { FORMATION_STATUS, slimCompletedResult } from "../utils/formationQueue";
import {
  classifyDocumentFailure,
  failureLogCode,
  FAILURE_KINDS,
  forLog,
  PlainDocumentError,
  isFileStillReadable,
} from "../utils/fileReadFailure";
import {
  describeDocumentFailure,
  plainDocumentLabel,
} from "../utils/readFailureMessage";
import {
  clearImportMarker,
  recordDocumentSaved,
  startImportMarker,
} from "../utils/importProgressMarker";

// A read that fails is tried once more on its own before the veteran is
// asked; after that a Retry is offered a bounded number of times.
const AUTOMATIC_READ_RETRIES = 1;
const MAX_MANUAL_READ_RETRIES = 3;
const READ_RETRY_DELAY_MS = 1000;

function entryIndex(entry, ctx) {
  const queue = ctx.getFormation ? ctx.getFormation() : ctx.formation;
  return entry ? queue.findIndex((e) => e.id === entry.id) : -1;
}

// For the console: the internal type, never a file name.
function entryLabel(entry, ctx) {
  return neutralDocumentLabel(entry?.estimatedType, entryIndex(entry, ctx));
}

// For the screen: plain words.
function plainEntryLabel(entry, ctx) {
  return plainDocumentLabel(entry?.estimatedType, entryIndex(entry, ctx));
}

// A document counts as saved once it is actually filed, whether that happened
// as it was read or when the veteran confirmed it - and only once.
function noteDocumentSaved(key, ctx) {
  if (ctx.savedDocuments.has(key)) return;
  ctx.savedDocuments.add(key);
  recordDocumentSaved();
}

function completionToast(ctx) {
  const queue = ctx.getFormation ? ctx.getFormation() : ctx.formation;
  const saved = queue.filter((e) => e.status === FORMATION_STATUS.SAVED);
  const failed = queue.filter((e) => e.status === FORMATION_STATUS.ERROR);
  const count = (n) => `${n} document${n === 1 ? "" : "s"}`;
  if (saved.length === 0 && failed.length > 0) {
    const why =
      failed.length === 1 && failed[0].error
        ? failed[0].error
        : `${count(failed.length)} could not be processed. The list below says why.`;
    ctx.toast.error(`Nothing was saved. ${why}`, 10000);
  } else if (saved.length === 0) {
    ctx.toast.warning("Nothing was saved because no document was kept.", 7000);
  } else if (failed.length > 0) {
    ctx.toast.warning(
      `Import finished: ${count(saved.length)} saved, ${failed.length} not saved. The list below says why.`,
      10000,
    );
  } else {
    ctx.toast.success(`Import finished: ${count(saved.length)} saved.`, 7000);
  }
}

/**
 * Advance the queue: process the given entry if provided, otherwise look up
 * the next matching entry in `formation`, falling back to completion (null).
 */
function scheduleNextDocument(nextEntry, formation, predicate, delay, ctx) {
  setTimeout(() => {
    if (nextEntry) {
      runDocumentProcessing(nextEntry, ctx);
    } else {
      // The latest queue, not the snapshot this closure rendered with: that
      // snapshot still lists finished documents as WAITING.
      const latest = ctx.getFormation ? ctx.getFormation() : formation;
      const next = latest.find(predicate);
      if (next) {
        runDocumentProcessing(next, ctx);
      } else {
        runDocumentProcessing(null, ctx); // Triggers completion
      }
    }
  }, delay);
}

/**
 * Handle a progress update from processFormationDocument: reflect it in
 * local progress state and roll the queue entry's status forward.
 */
function handleProgressUpdate(progressData, entry, file, ctx) {
  const { setCurrentProgress, updateEntry } = ctx;

  // eslint-disable-next-line no-console
  console.log("📊 Progress update received:", {
    stage: progressData.stage,
    state: progressData.state,
    progress: progressData.progress,
  });
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
}

/**
 * Process a specific document entry.
 * This can be called with an entry directly, avoiding stale state issues.
 */
async function runDocumentProcessing(entry, ctx) {
  const {
    updateEntry,
    setProcessingState,
    setActiveEntry,
    setCurrentProgress,
    setExtractionResult,
    setShowIntelBriefing,
  } = ctx;

  if (!entry) {
    // eslint-disable-next-line no-console
    console.log("✅ Formation complete!");
    clearImportMarker();
    setProcessingState(PROCESSING_STATES.COMPLETE);
    setActiveEntry(null);
    setCurrentProgress(null);
    completionToast(ctx);
    return;
  }

  const file = entry.file;
  // eslint-disable-next-line no-console
  console.log(`🎖️ Processing ${entryLabel(entry, ctx)}`);

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
    const result = await processFormationDocument(
      file,
      (progressData) => handleProgressUpdate(progressData, entry, file, ctx),
      { returnIncompleteSave: true },
    );

    // eslint-disable-next-line no-console
    console.log("✅ Document processed:", {
      status: result.status,
      classification: result.classification?.type,
    });

    // ADR-007: if this exact document already carries a veteran correction
    // (a prior Verify & Save, or a re-import after one), seed the review
    // modal with it - DocumentIntelligenceBriefing.jsx shows "(your saved
    // correction)" and pre-fills the field instead of the raw re-extraction.
    const priorEntry = getServiceEntryForDocument(file.name);
    if (priorEntry?.source === "veteran") {
      result.priorServiceStartCorrection = {
        date: priorEntry.date,
        documentDate: priorEntry.documentDate,
      };
    }

    // Check status === 'complete' since processFormationDocument sets that, not success
    if (result.status === "complete" && result.readyForReview) {
      if (result.vkbSaved) noteDocumentSaved(entry.id, ctx);
      setExtractionResult(result);
      setShowIntelBriefing(true);
      updateEntry(entry.id, { status: "USER_REVIEW" });
    } else if (result.status === "error") {
      const failure = new Error(result.error || "Processing failed");
      if (result.persistIncomplete) {
        ctx.retainedResults.set(entry.id, result);
        failure.persistIncomplete = true;
        failure.quotaExceeded = result.persistQuotaExceeded === true;
      }
      failure.failureKind =
        result.failureKind ??
        (result.readFailed ? FAILURE_KINDS.READ : FAILURE_KINDS.UNKNOWN);
      failure.plainMessage = result.plainMessage;
      throw failure;
    }
  } catch (err) {
    await handleDocumentFailure(err, entry, ctx);
  }
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The file stays referenced (never its bytes), so a read that failed can be
// done again from the original. Once one automatic retry has been spent the
// veteran is asked, with a bounded Retry while the file can still be read and
// a plain "add it again" once it cannot. Only a failed read is retried on its
// own; every other kind of failure waits for the veteran's Retry.
async function handleRetryableFailure(entry, kind, ctx, detail) {
  // eslint-disable-next-line no-console
  console.warn(
    `📂 Could not finish ${entryLabel(entry, ctx)}`,
    failureLogCode(kind),
  );
  const attempts = ctx.readAttempts.get(entry.id) ?? { auto: 0, manual: 0 };
  const readable = await isFileStillReadable(entry.file);

  if (
    kind === FAILURE_KINDS.READ &&
    readable &&
    attempts.auto < AUTOMATIC_READ_RETRIES
  ) {
    ctx.readAttempts.set(entry.id, { ...attempts, auto: attempts.auto + 1 });
    await pause(READ_RETRY_DELAY_MS);
    return runDocumentProcessing(entry, ctx);
  }

  const canRetry = readable && attempts.manual < MAX_MANUAL_READ_RETRIES;
  if (canRetry) ctx.readRetryable.add(entry.id);
  const message = describeDocumentFailure(plainEntryLabel(entry, ctx), {
    kind,
    detail,
    canRetry,
    fileGone: !readable,
  });
  return finishFailedDocument(
    ctx.errorEntryAndNext(entry.id, message, {
      retryable: canRetry,
      processingFailure: true,
      failureKind: kind,
    }),
    ctx,
  );
}

function finishFailedDocument(nextEntry, ctx) {
  ctx.setCurrentProgress(null);
  ctx.setActiveEntry(null);
  scheduleNextDocument(
    nextEntry,
    ctx.formation,
    (e) => e.status === "WAITING",
    1000,
    ctx,
  );
}

// The text of any failure can carry a file name, a local address or a stack,
// so only a neutral code is written to the console and the veteran is shown a
// plain message built from the kind of failure.
async function handleDocumentFailure(err, entry, ctx) {
  if (err.persistIncomplete) {
    console.error("❌ Document processing error:", "saving did not finish");
    return finishFailedDocument(
      ctx.errorEntryAndNext(entry.id, err.message, {
        retryable: true,
        quotaExceeded: err.quotaExceeded === true,
      }),
      ctx,
    );
  }
  const kind = err.failureKind ?? classifyDocumentFailure(err);
  const detail =
    err.plainMessage ??
    (err instanceof PlainDocumentError ? err.message : undefined);
  return handleRetryableFailure(entry, kind, ctx, detail);
}

const NO_PERIOD_FOR_DOCUMENT_WARNING =
  "Your corrected service start date couldn't be matched to a service period from this document, so it wasn't saved. You can add it in My Packet > Profile > Service Periods.";

/**
 * ADR-007 §2.5/W2: applies a Muster Call review correction, if any, before
 * persisting the document - so persistFormationDocument's own VKB write
 * already reflects the corrected canonical period, not the raw
 * calculated/printed guess. Exported so the review modal's "Verify & Save"
 * handler and its own tests share exactly one code path.
 * @returns {Promise<{persisted: boolean, correction: object|null}>}
 */
export async function persistVerifiedDocument(extractionResult, verifyPayload) {
  const {
    verifiedData: correctedFields = {},
    saveToVKB = true,
    updateProfile = true,
    serviceEntryCorrection,
  } = verifyPayload || {};

  if (!saveToVKB && !updateProfile) {
    return { persisted: false, correction: null };
  }

  if (
    serviceEntryCorrection &&
    !parseExplicitDate(serviceEntryCorrection.date)
  ) {
    throw new Error(
      "That service start date isn't a valid date. Use YYYY-MM-DD.",
    );
  }

  // Identity (serviceStartDate/serviceStartDateDerived) stays on the
  // original extraction - the correction below is the only path that
  // changes the canonical entry date now.
  const {
    serviceStartDate: _serviceStartDate,
    serviceStartDateDerived: _serviceStartDateDerived,
    ...restFields
  } = correctedFields;
  const correctedResult = {
    ...extractionResult,
    extractedData: { ...extractionResult.extractedData, ...restFields },
  };
  const pseudoFile = {
    name: extractionResult.filename,
    size: extractionResult.size,
  };

  const applyCorrection = () =>
    setServiceEntryDate({
      date: serviceEntryCorrection.date,
      via: "muster_review",
      sourceDocument: extractionResult.filename,
      documentStartDate: serviceEntryCorrection.documentStartDate,
      documentEndDate: serviceEntryCorrection.documentEndDate,
    });

  let correction = serviceEntryCorrection ? applyCorrection() : null;

  if (saveToVKB) {
    await persistFormationDocument(pseudoFile, correctedResult);
    if (
      serviceEntryCorrection &&
      correction?.reason === "no_period_for_document"
    ) {
      correction = applyCorrection();
    }
  }
  if (updateProfile) {
    await autoPopulateProfile([correctedResult]);
  }

  return { persisted: true, correction };
}

async function runVerifyAndSave(verifyPayload, ctx) {
  const {
    formation,
    extractionResult,
    completeCurrentAndNext,
    toast,
    setError,
    setShowIntelBriefing,
    setExtractionResult,
    setCurrentProgress,
    setActiveEntry,
  } = ctx;

  // eslint-disable-next-line no-console
  console.log("✅ User verified data:", {
    fieldCount: Object.keys(verifyPayload?.verifiedData || {}).length,
    saveToVKB: verifyPayload?.saveToVKB,
    updateProfile: verifyPayload?.updateProfile,
  });

  try {
    // The briefing screen's checked/edited fields never reached VKB/My
    // Packet/the veteran profile before this — only this hook's own local
    // formation-queue state got them, so a veteran's corrections silently
    // vanished from everywhere every AI tool actually reads. Re-run the
    // same persist sequence the initial extraction used, with the
    // corrected fields merged in; every write it touches is dedup-safe for
    // re-processing the same document (see persistFormationDocument).
    const { correction } = await persistVerifiedDocument(
      extractionResult,
      verifyPayload,
    );
    if (correction?.reason === "no_period_for_document") {
      toast.warning(NO_PERIOD_FOR_DOCUMENT_WARNING);
    }

    // The queue keeps only what the completion summary shows: the document's
    // text is already saved and would otherwise stay in memory, once per
    // document, until the page closes.
    const nextEntry = completeCurrentAndNext(
      slimCompletedResult({
        ...extractionResult,
        verifiedData: verifyPayload,
      }),
    );
    noteDocumentSaved(ctx.activeEntry?.id ?? extractionResult?.filename, ctx);

    toast.success(
      `Document "${extractionResult.filename}" saved to Knowledge Base`,
    );

    setShowIntelBriefing(false);
    setExtractionResult(null);
    setCurrentProgress(null);
    setActiveEntry(null);

    scheduleNextDocument(
      nextEntry,
      formation,
      (e) => e.status === "WAITING" || e.status === "CALLED",
      500,
      ctx,
    );
  } catch (err) {
    const incomplete = err?.name === "DocumentPersistIncompleteError";
    const message = incomplete
      ? describePersistIncomplete(
          extractionResult?.filename,
          "Verify & Save",
          err,
        )
      : err.message;
    console.error(
      "❌ Save error:",
      incomplete
        ? "saving did not finish"
        : failureLogCode(classifyDocumentFailure(err)),
    );
    setError(message);
    toast.error(`Failed to save document: ${message}`);
  }
}

/**
 * Read a document again from the original file after a read failure. Bounded
 * by the attempt count handleRetryableFailure keeps; the file is checked first so a
 * file that is gone says so instead of failing a second time.
 */
async function runRetryRead(entryId, ctx) {
  const entry = ctx.getFormation().find((e) => e.id === entryId);
  ctx.readRetryable.delete(entryId);
  if (!entry?.file) return;

  const attempts = ctx.readAttempts.get(entryId) ?? { auto: 0, manual: 0 };
  ctx.readAttempts.set(entryId, { ...attempts, manual: attempts.manual + 1 });
  if (!(await isFileStillReadable(entry.file))) {
    const message = describeDocumentFailure(plainEntryLabel(entry, ctx), {
      canRetry: false,
      fileGone: true,
    });
    ctx.updateEntry(entryId, { error: message, retryable: false });
    ctx.toast.error(message);
    return;
  }
  ctx.updateEntry(entryId, { error: null, retryable: false });
  await runDocumentProcessing(entry, ctx);
}

/**
 * Retry saving a document whose first save did not finish. Resolves once the
 * attempt has ended; on success the document goes to the same review screen a
 * freshly read one reaches, on failure the entry keeps its Retry. A document
 * that could not be read is read again instead.
 */
async function runRetryPersist(entryId, ctx) {
  if (ctx.readRetryable.has(entryId)) return runRetryRead(entryId, ctx);
  const {
    updateEntry,
    toast,
    setActiveEntry,
    setExtractionResult,
    setShowIntelBriefing,
    retainedResults,
  } = ctx;
  const failed = retainedResults.get(entryId);
  const entry = ctx.getFormation().find((e) => e.id === entryId);
  if (!failed || !entry) return;

  try {
    const result = await retryFormationDocumentPersist(failed);
    if (result.status === "complete") {
      retainedResults.delete(entryId);
      if (result.vkbSaved) noteDocumentSaved(entryId, ctx);
      updateEntry(entryId, {
        status: "USER_REVIEW",
        error: null,
        retryable: false,
      });
      setActiveEntry(entry);
      setExtractionResult(result);
      setShowIntelBriefing(true);
      return;
    }
    retainedResults.set(entryId, result);
    updateEntry(entryId, { error: result.error });
    toast.error(result.error);
  } catch (err) {
    console.error("❌ Retry save error:", forLog(err));
    toast.error(
      "We could not retry saving this document. Nothing you imported was lost.",
    );
  }
}

function runSkipDocument(ctx) {
  const {
    formation,
    activeEntry,
    skipCurrentAndNext,
    setShowIntelBriefing,
    setExtractionResult,
    setCurrentProgress,
    setActiveEntry,
  } = ctx;

  // eslint-disable-next-line no-console
  console.log("⏭️ Skipping", entryLabel(activeEntry, ctx));

  const nextEntry = skipCurrentAndNext("User skipped");
  setShowIntelBriefing(false);
  setExtractionResult(null);
  setCurrentProgress(null);
  setActiveEntry(null);

  scheduleNextDocument(
    nextEntry,
    formation,
    (e) => e.status === "WAITING",
    500,
    ctx,
  );
}

function runStartSequentialProcessing(ctx) {
  // eslint-disable-next-line no-console
  console.log("🚩 Starting sequential formation processing...");
  const firstEntry = ctx.startFormation();
  // eslint-disable-next-line no-console
  console.log("🚩 First entry:", firstEntry?.id);

  if (firstEntry) {
    startImportMarker(
      ctx
        .getFormation()
        .map((entry, index) =>
          neutralDocumentLabel(entry.estimatedType, index),
        ),
    );
    // Process the first document directly instead of relying on currentEntry
    runDocumentProcessing(firstEntry, ctx);
  }
}

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
    updateEntry,
    startFormation,
    completeCurrentAndNext,
    skipCurrentAndNext,
    errorEntryAndNext,
    getFormation,
  } = formationQueue;

  const [currentProgress, setCurrentProgress] = useState(null);
  const [activeEntry, setActiveEntry] = useState(null);
  const [extractionResult, setExtractionResult] = useState(null);
  const [showIntelBriefing, setShowIntelBriefing] = useState(false);
  // Held in memory only: a document's text must never reach the persisted
  // formation ledger, so a page reload ends the chance to retry from here.
  const retainedResults = useRef(new Map()).current;
  // Read failures keep the original File reference (never its bytes) in the
  // queue entry; these track how often each was tried and which still offer a
  // Retry.
  const readAttempts = useRef(new Map()).current;
  const readRetryable = useRef(new Set()).current;
  const savedDocuments = useRef(new Set()).current;

  const ctx = {
    retainedResults,
    readAttempts,
    readRetryable,
    savedDocuments,
    formation,
    activeEntry,
    extractionResult,
    updateEntry,
    startFormation,
    completeCurrentAndNext,
    skipCurrentAndNext,
    errorEntryAndNext,
    getFormation,
    toast,
    setError,
    setProcessingState,
    setCurrentProgress,
    setActiveEntry,
    setExtractionResult,
    setShowIntelBriefing,
  };

  const processDocumentEntry = (entry) => runDocumentProcessing(entry, ctx);
  const handleVerifyAndSave = (verifyPayload) =>
    runVerifyAndSave(verifyPayload, ctx);
  const handleSkipDocument = () => runSkipDocument(ctx);
  const startSequentialProcessing = () => runStartSequentialProcessing(ctx);
  const retryDocumentSave = (entryId) => runRetryPersist(entryId, ctx);
  const canRetryDocumentSave = (entryId) =>
    retainedResults.has(entryId) || readRetryable.has(entryId);

  return {
    retryDocumentSave,
    canRetryDocumentSave,
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
