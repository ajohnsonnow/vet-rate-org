/**
 * Vet-Rate.org - Interrupted import notice
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * A tab the browser kills mid-import cannot show a message, so the next load
 * says so, in any tab. An import still running in another tab (or in the tab
 * this one was opened from) is never reported and Dismiss never removes it; if
 * its owner later goes away, the periodic re-check below reports it once. The
 * count shown is read from what is stored when the notice is drawn. An import
 * begun in this tab is never reported here.
 */

import { useEffect, useState } from "react";
import {
  describeInterruptedImport,
  dismissInterruptedImport,
  findInterruptedImport,
} from "../../utils/importProgressMarker";

const RECHECK_MS = 10000;

export default function InterruptedImportNotice() {
  const [interrupted, setInterrupted] = useState(null);

  useEffect(() => {
    let active = true;
    let checking = false;
    let again = false;
    const recheck = async () => {
      if (checking) {
        again = true;
        return;
      }
      checking = true;
      try {
        const next = await findInterruptedImport();
        if (!active) return;
        setInterrupted((current) =>
          next?.id === current?.id && next?.saved === current?.saved
            ? current
            : next,
        );
      } finally {
        checking = false;
        if (again && active) {
          again = false;
          recheck();
        }
      }
    };
    recheck();
    const timer = setInterval(recheck, RECHECK_MS);
    window.addEventListener("storage", recheck);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("storage", recheck);
    };
  }, []);

  if (!interrupted) return null;

  const dismiss = async () => {
    await dismissInterruptedImport(interrupted.id);
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
