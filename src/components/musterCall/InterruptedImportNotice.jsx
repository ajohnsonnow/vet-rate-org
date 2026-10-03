/**
 * Vet-Rate.org - Interrupted import notice
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * A tab the browser kills mid-import cannot show a message, so the next load
 * says so. Read once when the app starts: an import begun later in this
 * session never shows it.
 */

import { useState } from "react";
import {
  clearImportMarker,
  describeInterruptedImport,
  readInterruptedImport,
} from "../../utils/importProgressMarker";

export default function InterruptedImportNotice() {
  const [interrupted, setInterrupted] = useState(readInterruptedImport);

  if (!interrupted) return null;

  const dismiss = () => {
    clearImportMarker(interrupted.id);
    setInterrupted(null);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="interrupted-import-notice"
      className="fixed left-4 right-4 top-[calc(4rem+env(safe-area-inset-top))] z-[55] max-w-lg rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-lg dark:border-amber-600 dark:bg-gray-800 sm:right-auto"
    >
      <p className="text-sm text-amber-900 dark:text-amber-100">
        {describeInterruptedImport(interrupted)}
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 min-h-[44px] rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
      >
        Dismiss
      </button>
    </div>
  );
}
