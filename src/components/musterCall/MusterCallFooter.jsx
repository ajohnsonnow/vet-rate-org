/**
 * Vet-Rate.org - Muster Call Footer
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Modal footer for MusterCall.jsx. Pure presentational extraction — no
 * behavior change.
 */

import { PROCESSING_STATES } from "../../utils/musterCallProcessor";

export default function MusterCallFooter({
  processingState,
  intake,
  useSequentialMode,
  ai,
  formationComplete,
  onStart,
  onReset,
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {processingState === PROCESSING_STATES.IDLE &&
          intake.files.length > 0 &&
          !useSequentialMode && (
            <button
              onClick={onStart}
              disabled={
                !ai.aiReady ||
                ai.aiInitializing ||
                !intake.validation ||
                intake.validation.valid.length === 0
              }
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🎖️ Open Ranks, MARCH!
            </button>
          )}
        {(processingState === PROCESSING_STATES.COMPLETE ||
          formationComplete) && (
          <button
            onClick={onReset}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            🎖️ Fall In - New Formation
          </button>
        )}
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        {useSequentialMode ? (
          <span className="flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400">●</span>
            Formation Mode (Sequential)
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-blue-600 dark:text-blue-400">●</span>
            Batch Mode
          </span>
        )}
      </div>
    </div>
  );
}
