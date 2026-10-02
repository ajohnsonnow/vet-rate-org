/**
 * Vet-Rate.org - Muster Call Completion Summary
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Shown when a formation finishes: lists every document that was not read
 * in full, whose AI analysis did not finish, or that failed - each in plain
 * words, so none of it is buried in a field list or a toast that disappears.
 */

import { useState } from "react";
import { FORMATION_STATUS } from "../../utils/formationQueue";
import { getReadingNotices } from "../../utils/readingNotices";
import DocumentReadingNotices from "./DocumentReadingNotices";

function entryNotices(entry) {
  if (entry.status === FORMATION_STATUS.ERROR) {
    return { error: entry.error || "This document could not be processed." };
  }
  if (entry.status !== FORMATION_STATUS.SAVED || !entry.result) return null;
  const notices = getReadingNotices(entry.result);
  return notices.coverageNote || notices.aiAnalysisNotice ? notices : null;
}

function RetrySaveButton({ entryId, onRetry }) {
  const [retrying, setRetrying] = useState(false);
  const handleClick = async () => {
    setRetrying(true);
    try {
      await onRetry(entryId);
    } finally {
      setRetrying(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={retrying}
      data-testid="retry-save-button"
      className="mt-2 min-h-[44px] px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-sm font-semibold"
    >
      {retrying ? "Retrying..." : "Retry"}
    </button>
  );
}

export default function MusterCallCompletionSummary({
  formation,
  onRetry,
  canRetry,
}) {
  const rows = formation
    .map((entry) => ({ entry, notices: entryNotices(entry) }))
    .filter((row) => row.notices);

  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="muster-completion-heading"
      data-testid="muster-completion-summary"
      className="mt-6 space-y-3"
    >
      <h3
        id="muster-completion-heading"
        className="text-lg font-semibold text-gray-900 dark:text-white"
      >
        Before you move on
      </h3>
      <ul className="space-y-3">
        {rows.map(({ entry, notices }) => (
          <li
            key={entry.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
              {entry.filename || entry.file?.name}
            </p>
            {notices.error ? (
              <>
                <p role="alert" className="mt-2 text-sm text-red-700">
                  This document could not be processed: {notices.error}
                </p>
                {entry.retryable && onRetry && canRetry?.(entry.id) && (
                  <RetrySaveButton entryId={entry.id} onRetry={onRetry} />
                )}
              </>
            ) : (
              <div className="mt-2">
                <DocumentReadingNotices {...notices} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
