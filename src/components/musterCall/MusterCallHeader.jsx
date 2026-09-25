/**
 * Vet-Rate.org - Muster Call Header
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Modal header for MusterCall.jsx. Pure presentational extraction — no
 * behavior change.
 */

import ReportBugLink from "../ReportBugLink";

export default function MusterCallHeader({ onClose, processing }) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 p-6 text-white">
      {/* flex-wrap: the title (text-3xl + emoji + BETA badge) and the
          report-bug/close actions don't both fit on one row at 320-390px
          even at their own minimum content widths, which pushed the close
          button off-screen (pre-existing - confirmed against 52a1edd8/
          d78330db, neither touched this file). Wrapping drops the actions
          onto their own row instead of overflowing. */}
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div>
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
        <div className="flex items-center gap-3">
          <ReportBugLink feature="muster-call" />
          <button
            onClick={onClose}
            disabled={processing}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors disabled:opacity-50"
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
        </div>
      </div>
    </div>
  );
}
