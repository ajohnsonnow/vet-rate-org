/**
 * Vet-Rate.org - Muster Call AI Status Banner
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Renders the "AI initializing" / "AI ready" / "load AI" banners for
 * MusterCall.jsx. Pure presentational extraction — no behavior change.
 */

function MusterCallAIInitializingBanner({ initProgress, initMessage }) {
  return (
    <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 border-l-4 border-purple-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            {/* Spinning circular progress indicator */}
            <div className="w-12 h-12 rounded-full border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400 animate-spin"></div>
            {/* CWO icon in center */}
            <div className="absolute inset-0 flex items-center justify-center text-xl">
              🎖️
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Initializing Warrant Council AI...
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {initMessage || "Preparing AI agent for analysis"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 italic">
              🎖️ Three Chief Warrant Officers (CW3-CW5) - Technical experts
              trained to analyze your claim, write statements, and calculate
              ratings
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {initProgress}%
          </div>
        </div>
      </div>
      <div className="mt-4 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden relative">
        <div
          className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-500"
          style={{ width: `${initProgress}%` }}
        />
        {/* Guidon flag marching across */}
        <div
          className="absolute -top-6 transform -translate-x-1/2 transition-all duration-500 text-2xl"
          style={{ left: `${initProgress}%` }}
          aria-label="Warrant Council loading progress"
        >
          🚩
        </div>
      </div>
    </div>
  );
}

export default function MusterCallAIStatusBanner({ ai }) {
  const { aiReady, aiInitializing, initProgress, initMessage, handleLoadAI } =
    ai;

  return (
    <>
      {/* AI Initialization Banner */}
      {aiInitializing && (
        <MusterCallAIInitializingBanner
          initProgress={initProgress}
          initMessage={initMessage}
        />
      )}

      {aiReady && !aiInitializing && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border-l-4 border-green-500">
          <div className="flex items-center">
            <span className="text-2xl mr-3">✅</span>
            <div>
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                CW5 Auditor ready - Your claim accuracy Chief Warrant Officer is
                standing by
              </span>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                Intelligence Briefing will be generated automatically after
                document processing
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Load AI Button - Show when AI not loaded and not initializing */}
      {!aiReady && !aiInitializing && (
        <div className="mb-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🎖️</span>
              <div>
                <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  Warrant Council AI Required
                </span>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                  Load AI to enable intelligent document analysis and processing
                </p>
              </div>
            </div>
            <button
              onClick={handleLoadAI}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              🎖️ Load AI
            </button>
          </div>
        </div>
      )}
    </>
  );
}
