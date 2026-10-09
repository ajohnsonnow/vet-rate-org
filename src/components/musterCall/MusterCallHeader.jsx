/**
 * Vet-Rate.org - Muster Call Header
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Modal header for MusterCall.jsx. Pure presentational extraction — no
 * behavior change.
 */

import ReportBugLink from "../ReportBugLink";
import HeaderCloseSlot from "../common/HeaderCloseSlot";

export default function MusterCallHeader({ onClose, processing }) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 p-6 text-white">
      <HeaderCloseSlot
        close={
          <button
            onClick={onClose}
            disabled={processing}
            className="grid h-11 w-11 shrink-0 place-items-center text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        }
      >
        <div className="min-w-0">
          <h2
            id="muster-call-title"
            className="text-3xl font-bold mb-2 flex items-center gap-3"
          >
            <span className="text-4xl">📋</span>
            Muster Call{" "}
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
              BETA
            </span>
          </h2>
          <p className="text-blue-100 text-sm max-w-2xl">
            Drop your entire VA file - claim letters, C-Files, DD214s.
            We&apos;ll analyze everything and build your complete profile
            automatically.
          </p>
        </div>
        <ReportBugLink feature="muster-call" />
      </HeaderCloseSlot>
    </div>
  );
}
