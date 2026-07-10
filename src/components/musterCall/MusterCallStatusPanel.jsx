/**
 * Vet-Rate.org - Muster Call Status Panel
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Legacy batch progress, results/report, and error views for
 * MusterCall.jsx. Extracted as a pure presentational split — no behavior
 * change.
 */

import ReactMarkdown from "react-markdown";
import { PROCESSING_STATES } from "../../utils/musterCallProcessor";
import { getDocumentTypeLabel } from "../../utils/documentClassifier";
import ReportBugLink from "../ReportBugLink";

/**
 * Get human-readable label for processing state
 */
function getStateLabel(state) {
  const labels = {
    [PROCESSING_STATES.IDLE]: "Formation Ready",
    [PROCESSING_STATES.VALIDATING]: "Count, OFF! Verifying personnel...",
    [PROCESSING_STATES.LOADING]: "Dress Right, DRESS! Loading documents...",
    [PROCESSING_STATES.EXTRACTING]: "Inspection, ARMS! Extracting content...",
    [PROCESSING_STATES.CLASSIFYING]:
      "Platoon, ATTENTION! Classifying documents...",
    [PROCESSING_STATES.ANALYZING]:
      "Sir/Ma'am, platoon prepared for inspection...",
    [PROCESSING_STATES.POPULATING]:
      "Close Ranks, MARCH! Auto-filling profile...",
    [PROCESSING_STATES.COMPLETE]: "AT EASE - Inspection Complete",
    [PROCESSING_STATES.ERROR]: "Fall Out - Error Encountered",
  };
  return labels[state] || "Ready, FRONT...";
}

function MusterCallBatchProgress({ processingState, batch, onStop }) {
  const { progress, fileProgress } = batch;
  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {getStateLabel(processingState)}
          </h3>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {progress.completed} / {progress.total} files
            </div>
            <button
              onClick={onStop}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              aria-label="Stop processing"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="6" y="6" width="12" height="12" strokeWidth="2" />
              </svg>
              Stop
            </button>
          </div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300 rounded-full"
            style={{
              width: `${(progress.completed / progress.total) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Individual File Progress */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          File Progress:
        </h4>
        {Object.entries(fileProgress).map(([filename, fileData]) => (
          <div
            key={filename}
            className="bg-white dark:bg-gray-800 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                {filename}
              </p>
              <span className="text-xs text-gray-500 ml-2">
                {fileData.progress?.toFixed(0) || 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  fileData.error ? "bg-red-500" : "bg-green-500"
                }`}
                style={{ width: `${fileData.progress || 0}%` }}
              />
            </div>
            {fileData.error && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {fileData.error}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Processing Animation */}
      <div className="flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    </div>
  );
}

function MusterCallResults({ batch }) {
  const { results, report, showReport, setShowReport } = batch;
  return (
    <div className="space-y-6">
      {/* Success Banner */}
      <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 p-6 rounded-lg">
        <div className="flex items-center gap-3">
          <span className="text-3xl">✅</span>
          <div>
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
              Muster Call Complete!
            </h3>
            <p className="text-sm text-green-800 dark:text-green-200">
              Processed {results.summary.successful} files in{" "}
              {(results.summary.processingTime / 1000).toFixed(1)}s
            </p>
          </div>
        </div>
      </div>

      {/* Document Breakdown */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Discovered Documents
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(results.classified.grouped).map(([type, docs]) => (
            <div
              key={type}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500"
            >
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                {getDocumentTypeLabel(type)}
              </h4>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {docs.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {docs.length === 1 ? "document" : "documents"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* LLM Report */}
      {report && (
        <div
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-blue-500"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              AI Analysis & Recommendations
            </h3>
            <div className="flex items-center gap-3">
              <ReportBugLink context="muster-call-report" />
              <button
                onClick={() => setShowReport(!showReport)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {showReport ? "Hide" : "Show"} Report
              </button>
            </div>
          </div>
          {showReport && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MusterCallErrorBanner({ error }) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-6 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-3xl">❌</span>
        <div>
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
            Processing Error
          </h3>
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    </div>
  );
}

export default function MusterCallStatusPanel({
  processingState,
  batch,
  error,
}) {
  return (
    <>
      {batch.processing && processingState !== PROCESSING_STATES.IDLE && (
        <MusterCallBatchProgress
          processingState={processingState}
          batch={batch}
          onStop={batch.handleStopProcessing}
        />
      )}

      {processingState === PROCESSING_STATES.COMPLETE && batch.results && (
        <MusterCallResults batch={batch} />
      )}

      {error && <MusterCallErrorBanner error={error} />}
    </>
  );
}
