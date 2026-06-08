/**
 * Vet-Rate.org - Formation Lineup Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * Visual display of documents in formation queue
 * Drag-and-drop reordering, priority indicators, status tracking
 */

import React from "react";
import { formatFileSize } from "../utils/ocr";
import { FORMATION_STATUS } from "../utils/formationQueue";
import { getDocumentTypeLabel } from "../utils/documentClassifier";

/**
 * Status icons and colors
 */
const STATUS_DISPLAY = {
  [FORMATION_STATUS.WAITING]: {
    icon: "⏸️",
    label: "Waiting",
    color: "text-gray-500",
  },
  [FORMATION_STATUS.CALLED]: {
    icon: "📞",
    label: "Called",
    color: "text-blue-600",
  },
  [FORMATION_STATUS.OCR_IN_PROGRESS]: {
    icon: "🔍",
    label: "OCR In Progress",
    color: "text-purple-600",
  },
  [FORMATION_STATUS.INTEL_BRIEFING]: {
    icon: "🛡️",
    label: "Intel Briefing",
    color: "text-indigo-600",
  },
  [FORMATION_STATUS.USER_REVIEW]: {
    icon: "👀",
    label: "Your Review",
    color: "text-yellow-600",
  },
  [FORMATION_STATUS.VERIFIED]: {
    icon: "✅",
    label: "Verified",
    color: "text-green-600",
  },
  [FORMATION_STATUS.SAVED]: {
    icon: "💾",
    label: "Saved",
    color: "text-green-700",
  },
  [FORMATION_STATUS.SKIPPED]: {
    icon: "⏭️",
    label: "Skipped",
    color: "text-gray-400",
  },
  [FORMATION_STATUS.ERROR]: {
    icon: "❌",
    label: "Error",
    color: "text-red-600",
  },
};

/**
 * Individual document entry in formation
 */
const FormationEntry = ({
  entry,
  index,
  onRemove,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const status =
    STATUS_DISPLAY[entry.status] || STATUS_DISPLAY[FORMATION_STATUS.WAITING];
  const isCurrent =
    entry.status === FORMATION_STATUS.CALLED ||
    entry.status === FORMATION_STATUS.OCR_IN_PROGRESS ||
    entry.status === FORMATION_STATUS.INTEL_BRIEFING ||
    entry.status === FORMATION_STATUS.USER_REVIEW ||
    entry.status === FORMATION_STATUS.VERIFIED;

  return (
    <div
      draggable={entry.status === FORMATION_STATUS.WAITING}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      className={`
        group relative p-4 rounded-lg border-2 transition-all duration-200
        ${isCurrent ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg" : "border-gray-200 dark:border-gray-700"}
        ${isDragging ? "opacity-50" : "opacity-100"}
        ${entry.status === FORMATION_STATUS.WAITING ? "cursor-move hover:border-gray-300 dark:hover:border-gray-600" : ""}
        ${entry.status === FORMATION_STATUS.SAVED ? "bg-green-50 dark:bg-green-900/10" : ""}
        ${entry.status === FORMATION_STATUS.ERROR ? "bg-red-50 dark:bg-red-900/10" : ""}
      `}
    >
      {/* Position Number */}
      <div className="absolute -left-3 -top-3 w-8 h-8 rounded-full bg-gray-700 dark:bg-gray-600 text-white flex items-center justify-center font-bold text-sm">
        {index + 1}
      </div>

      {/* Remove button (only for waiting documents) */}
      {entry.status === FORMATION_STATUS.WAITING && (
        <button
          onClick={() => onRemove(entry.id)}
          className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
          aria-label="Remove from formation"
        >
          ×
        </button>
      )}

      <div className="flex items-start gap-3">
        {/* Priority Badge */}
        <div
          className={`
          flex-shrink-0 w-24 text-center py-1 px-2 rounded-lg text-xs font-bold
          ${entry.priorityColor === "red" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : ""}
          ${entry.priorityColor === "orange" ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" : ""}
          ${entry.priorityColor === "yellow" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" : ""}
          ${entry.priorityColor === "blue" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" : ""}
          ${entry.priorityColor === "gray" ? "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300" : ""}
        `}
        >
          {entry.priorityIcon} {entry.priorityLabel}
        </div>

        {/* Document Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{status.icon}</span>
            <h4 className="font-semibold text-gray-900 dark:text-white truncate">
              {entry.filename}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              📄 {getDocumentTypeLabel(entry.estimatedType)}
            </span>
            <span className="flex items-center gap-1">
              💾 {formatFileSize(entry.fileSize)}
            </span>
            <span
              className={`flex items-center gap-1 font-medium ${status.color}`}
            >
              {status.label}
            </span>
          </div>

          {/* Error message */}
          {entry.status === FORMATION_STATUS.ERROR && entry.error && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400">
              ⚠️ {entry.error}
            </div>
          )}

          {/* Skip reason */}
          {entry.status === FORMATION_STATUS.SKIPPED && entry.error && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              ℹ️ {entry.error}
            </div>
          )}

          {/* Current indicator */}
          {isCurrent && (
            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium animate-pulse">
              ⚡ Currently processing...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Formation Statistics Panel
 */
const FormationStats = ({ stats, progress }) => {
  if (!stats) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          🚩 Formation Statistics
        </h3>
        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {progress}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.total}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {stats.waiting}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Waiting
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-green-600">
            {stats.completed}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Completed
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-red-600">
            {stats.critical}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Critical Docs
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Main Formation Lineup Component
 */
export default function FormationLineup({
  formation,
  onReorder,
  onRemove,
  onStartFormation,
  onClearFormation,
  aiReady = false,
  aiInitializing = false,
}) {
  const [draggedIndex, setDraggedIndex] = React.useState(null);

  const stats =
    formation.length > 0
      ? {
          total: formation.length,
          waiting: formation.filter(
            (e) => e.status === FORMATION_STATUS.WAITING,
          ).length,
          completed: formation.filter(
            (e) => e.status === FORMATION_STATUS.SAVED,
          ).length,
          critical: formation.filter((e) => e.priority >= 9).length,
        }
      : null;

  const progress =
    formation.length > 0
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, _index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      onReorder(draggedIndex, toIndex);
    }
    setDraggedIndex(null);
  };

  const canStartFormation = formation.some(
    (e) => e.status === FORMATION_STATUS.WAITING,
  );
  const isProcessing = formation.some(
    (e) =>
      e.status === FORMATION_STATUS.CALLED ||
      e.status === FORMATION_STATUS.OCR_IN_PROGRESS ||
      e.status === FORMATION_STATUS.INTEL_BRIEFING ||
      e.status === FORMATION_STATUS.USER_REVIEW,
  );
  const hasRestoredDocs = formation.some((e) => e.isRestored);

  // Debug log to verify component renders
  // eslint-disable-next-line no-console
  console.log("📋 FormationLineup rendering:", {
    documentCount: formation.length,
    hasRestoredDocs,
    canStartFormation,
    isProcessing,
    hasOnClearFormation: typeof onClearFormation === "function",
  });

  if (formation.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Restored Documents Warning */}
      {hasRestoredDocs && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border-l-4 border-yellow-500">
          <div className="flex items-start">
            <span className="text-2xl mr-3 mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                Formation Restored from Previous Session
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                These documents are from your previous session. They were saved
                but the actual files are no longer in memory. You can view the
                lineup and clear it, but you&apos;ll need to re-upload the files
                to process them again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <FormationStats stats={stats} progress={progress} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          📋 Documents in Formation
          <span className="text-sm font-normal text-gray-500">
            (Drag to reorder)
          </span>
        </h3>

        <div className="flex gap-2">
          {canStartFormation && !isProcessing && (
            <button
              onClick={onStartFormation}
              disabled={hasRestoredDocs || !aiReady || aiInitializing}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                hasRestoredDocs || !aiReady || aiInitializing
                  ? "bg-gray-400 cursor-not-allowed text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
              aria-label={
                hasRestoredDocs
                  ? "Cannot process restored documents - please re-upload files"
                  : !aiReady && aiInitializing
                    ? "AI is loading..."
                    : !aiReady
                      ? "Load Warrant Council AI first to process documents"
                      : "Start processing documents"
              }
            >
              {aiInitializing ? (
                <>
                  <span className="animate-spin">⏳</span> Loading AI...
                </>
              ) : !aiReady ? (
                <>🛡️ AI Required</>
              ) : (
                <>🚩 Begin Formation</>
              )}
            </button>
          )}

          <button
            onClick={onClearFormation}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
          >
            Dismiss Formation
          </button>
        </div>
      </div>

      {/* Formation Queue */}
      <div className="space-y-3">
        {formation.map((entry, index) => (
          <FormationEntry
            key={entry.id}
            entry={entry}
            index={index}
            onRemove={onRemove}
            isDragging={draggedIndex === index}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
        <p className="font-semibold mb-2">🎖️ Formation Processing:</p>
        <ul className="space-y-1 text-xs">
          <li>
            • <strong>Critical documents</strong> (DD214, Rating Decisions)
            process first
          </li>
          <li>• Each document gets inspected individually for accuracy</li>
          <li>• You&apos;ll verify extracted data before it&apos;s saved</li>
          <li>• Drag documents to change processing order</li>
          <li>• You can pause and resume anytime</li>
        </ul>
      </div>
    </div>
  );
}
