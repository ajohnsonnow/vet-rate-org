/**
 * Vet-Rate.org - Interrupted import notice
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * A tab the browser kills mid-import cannot show a message, so the next load
 * says so, in any tab. An import that is still running in another tab keeps a
 * fresh heartbeat and is never reported; if its owner later goes away, the
 * periodic re-check below reports it once. An import begun in this tab is
 * never reported here.
 */

import { useEffect, useState } from "react";
import {
  clearImportMarker,
  describeInterruptedImport,
  readInterruptedImport,
} from "../../utils/importProgressMarker";

const RECHECK_MS = 10000;

export default function InterruptedImportNotice() {
  const [interrupted, setInterrupted] = useState(readInterruptedImport);

  useEffect(() => {
    const recheck = () =>
      setInterrupted((current) => {
        const next = readInterruptedImport();
        return next?.id === current?.id && next?.saved === current?.saved
          ? current
          : next;
      });
    const timer = setInterval(recheck, RECHECK_MS);
    window.addEventListener("storage", recheck);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", recheck);
    };
  }, []);

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
      className="fixed left-1/2 top-1/2 z-[55] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-amber-500 bg-white p-4 shadow-2xl dark:bg-gray-900"
    >
      <p className="text-sm text-gray-900 dark:text-gray-100">
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
