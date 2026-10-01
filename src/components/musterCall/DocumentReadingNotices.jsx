/**
 * Vet-Rate.org - Document Reading Notices
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Shows, in plain words, how completely a document was read (pages read,
 * blank, or not read) and whether its AI analysis finished. Used by the
 * Muster Call review and completion views and by My Packet's document cards,
 * so a veteran never has to dig through a field list to learn that part of a
 * document was not read or that AI analysis did not run.
 */

export default function DocumentReadingNotices({
  aiAnalysisNotice = null,
  coverageNote = null,
  pagesNotRead = false,
}) {
  if (!aiAnalysisNotice && !coverageNote) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="document-reading-notices"
      className="space-y-2"
    >
      {aiAnalysisNotice && (
        <p
          data-testid="ai-analysis-notice"
          className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-3 rounded-r-lg text-sm text-amber-900 dark:text-amber-200"
        >
          <strong>AI analysis did not finish.</strong> {aiAnalysisNotice}
        </p>
      )}
      {coverageNote && (
        <p
          data-testid="page-coverage-note"
          className={`border-l-4 p-3 rounded-r-lg text-sm ${
            pagesNotRead
              ? "bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-amber-900 dark:text-amber-200"
              : "bg-blue-50 dark:bg-blue-900/20 border-blue-400 text-blue-900 dark:text-blue-200"
          }`}
        >
          <strong>Pages:</strong> {coverageNote}
        </p>
      )}
    </div>
  );
}
