/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * 
 * EXPERIMENTAL MODE WARNING BANNER
 * 
 * Displays a prominent warning when experimental mode is enabled
 * but Chrome wasn't launched with the required flags
 */

import React, { useState, useEffect } from 'react';
import { checkDawnFeaturesEnabled, getLaunchInstructions } from '../utils/webgpuFeatureDetector';

export default function ExperimentalModeWarning({ experimentalMode }) {
  const [featureCheck, setFeatureCheck] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (experimentalMode) {
      checkDawnFeaturesEnabled().then(result => {
        setFeatureCheck(result);
      });
    }
  }, [experimentalMode]);

  // Don't show if not in experimental mode or if dismissed
  if (!experimentalMode || dismissed) return null;

  // Don't show if features are properly enabled
  if (featureCheck?.enabled) return null;

  // Still checking...
  if (!featureCheck) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-4 animate-pulse">
        <div className="flex items-center">
          <span className="text-2xl mr-3">🔍</span>
          <span className="text-sm text-yellow-800 dark:text-yellow-200">
            Checking experimental feature support...
          </span>
        </div>
      </div>
    );
  }

  const instructions = getLaunchInstructions();

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg shadow-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <span className="text-3xl mr-3 animate-bounce">⚠️</span>
            <div>
              <h3 className="text-lg font-bold text-red-800 dark:text-red-200">
                Experimental Mode Enabled - Chrome Flags Missing!
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Chrome wasn't launched with the required experimental features flag
              </p>
            </div>
          </div>

          <div className="ml-12 mt-3">
            <div className="bg-red-100 dark:bg-red-900/40 rounded-lg p-3 mb-3">
              <p className="text-sm text-red-900 dark:text-red-100 font-semibold mb-2">
                ❌ {featureCheck.reason}
              </p>
              {featureCheck.missingFeatures.length > 0 && (
                <p className="text-xs text-red-700 dark:text-red-300">
                  Missing: {featureCheck.missingFeatures.join(', ')}
                </p>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                🔧 Quick Fix ({instructions.platform}):
              </p>
              <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                {instructions.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>

              {instructions.script && (
                <div className="mt-3 bg-gray-100 dark:bg-gray-900 rounded p-2 font-mono text-xs">
                  <span className="text-green-600 dark:text-green-400">$ </span>
                  <span className="text-gray-800 dark:text-gray-200">{instructions.script}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="mt-3 text-sm text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 underline"
            >
              {showDetails ? '▼ Hide Technical Details' : '▶ Show Technical Details'}
            </button>

            {showDetails && (
              <div className="mt-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs font-mono">
                <p className="text-gray-600 dark:text-gray-400 mb-2">Available Features:</p>
                {featureCheck.availableFeatures.length > 0 ? (
                  <ul className="text-gray-800 dark:text-gray-200 space-y-1">
                    {featureCheck.availableFeatures.map(feature => (
                      <li key={feature}>✓ {feature}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-red-600 dark:text-red-400">No experimental features detected</p>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <a
                href="https://github.com/ajohnsonnow/vet-rate-org/blob/main/docs/support/faq.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                📚 View Full Setup Guide
              </a>
              <button
                onClick={() => setDismissed(true)}
                className="text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Dismiss (I'll fix it later)
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="ml-4 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300"
          aria-label="Close warning"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
