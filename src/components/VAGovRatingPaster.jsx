/**
 * VA.gov Rating Paster Component
 * Reusable component for pasting ratings from VA.gov
 * Used across multiple tools: TacticalCalculator, Pathfinder, RetroPayHunter, etc.
 */

import React, { useState } from "react";
import {
  parseVAGovRatings,
  validateParsedRatings,
  formatParsedRatings,
  EXAMPLE_VA_GOV_TEXT,
} from "../utils/vaGovRatingParser";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";

export default function VAGovRatingPaster({
  onRatingsParsed,
  onClose,
  showExample = true,
}) {
  const { t } = useLanguage();
  const [pasteText, setPasteText] = useState("");
  const [parsedResult, setParsedResult] = useState(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [isParsing, setIsParsing] = useState(false);

  const handleParse = () => {
    if (!pasteText.trim()) {
      alert("Please paste your ratings text first.");
      return;
    }

    setIsParsing(true);

    // Use setTimeout to allow UI to update with "Parsing..." state
    setTimeout(() => {
      try {
        const parseResult = parseVAGovRatings(pasteText);
        const validatedServiceConnected = validateParsedRatings(
          parseResult.serviceConnected,
        );

        if (
          validatedServiceConnected.length === 0 &&
          parseResult.notServiceConnected.length === 0
        ) {
          alert(
            "No valid ratings found. Please check the format and try again.",
          );
          setIsParsing(false);
          return;
        }

        setParsedResult({
          combinedRating: parseResult.combinedRating,
          serviceConnected: validatedServiceConnected,
          notServiceConnected: parseResult.notServiceConnected,
        });
      } catch (error) {
        console.error("Parse error:", error);
        alert("Error parsing ratings. Please try again.");
      } finally {
        setIsParsing(false);
      }
    }, 100);
  };

  const handleConfirm = () => {
    if (parsedResult && parsedResult.serviceConnected.length > 0) {
      // Pass only service-connected ratings to parent
      onRatingsParsed(parsedResult.serviceConnected);
      if (onClose) {
        onClose();
      }
    }
  };

  const handleLoadExample = () => {
    setPasteText(EXAMPLE_VA_GOV_TEXT);
    setShowInstructions(false);
  };

  const footer = !parsedResult ? (
    <div className="flex gap-3">
      <button
        onClick={handleParse}
        disabled={!pasteText.trim() || isParsing}
        className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isParsing ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Parsing...</span>
          </>
        ) : (
          <>
            <span className="text-lg">🔍</span>
            Parse Ratings
          </>
        )}
      </button>
      <button
        onClick={() => setPasteText("")}
        disabled={!pasteText}
        className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        Clear
      </button>
    </div>
  ) : (
    <div className="flex gap-3">
      <button
        onClick={handleConfirm}
        className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
      >
        <span className="text-lg">✓</span>
        Import {parsedResult.serviceConnected.length} Rating
        {parsedResult.serviceConnected.length === 1 ? "" : "s"}
      </button>
      <button
        onClick={() => {
          setParsedResult(null);
          setPasteText("");
        }}
        className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        Start Over
      </button>
    </div>
  );

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="xl"
      zIndex={100}
      labelledBy="va-paster-title"
      footer={footer}
      header={
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 id="va-paster-title" className="text-2xl font-bold mb-2">
                📋 Paste from VA.gov
              </h2>
              <p className="text-blue-100 text-sm">
                Import your current ratings directly from your VA.gov profile
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Instructions */}
        {showInstructions && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-lg">
            <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
              <span className="text-xl">💡</span>
              How to Copy Your Ratings
            </h3>
            <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-2 ml-6 list-decimal">
              <li>
                Go to{" "}
                <a
                  href="https://www.va.gov/disability/view-disability-rating/rating"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline hover:no-underline"
                >
                  VA.gov Rating Page
                </a>
              </li>
              <li>Scroll to "Your individual ratings" section</li>
              <li>Select and copy the entire list (Ctrl+A then Ctrl+C)</li>
              <li>Paste it in the box below (Ctrl+V)</li>
              <li>Click "Parse Ratings" to import</li>
            </ol>
            <button
              onClick={() => setShowInstructions(false)}
              className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Hide instructions
            </button>
          </div>
        )}

        {!parsedResult ? (
          <>
            {/* Paste Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Paste Your Ratings Here
              </label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your ratings from VA.gov here...&#10;&#10;Example:&#10;20% rating for radiculopathy, left lower extremity (femoral)&#10;Effective date: September 15, 2023&#10;50% rating for post-traumatic stress disorder&#10;Effective date: March 31, 2023"
                className="w-full h-64 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {pasteText.length} characters
                </span>
                {showExample && (
                  <button
                    onClick={handleLoadExample}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Load example text
                  </button>
                )}
              </div>
            </div>

            {/* Supported Formats */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                ✅ Supported Formats
              </h4>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li className="font-mono">
                  • Full page copy (CTRL+A, CTRL+C, CTRL+V)
                </li>
                <li className="font-mono">
                  • Automatically extracts combined rating
                </li>
                <li className="font-mono">
                  • 20% rating for radiculopathy, left lower extremity
                </li>
                <li className="font-mono">• 50% PTSD</li>
                <li className="font-mono">• Tinnitus - 10%</li>
                <li className="font-mono">
                  • Filters non-service-connected conditions
                </li>
              </ul>
            </div>
          </>
        ) : (
          <>
            {/* Combined Rating */}
            {parsedResult.combinedRating !== null && (
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-xl shadow-lg">
                <div className="text-sm opacity-90 mb-1">
                  Combined VA Disability Rating
                </div>
                <div className="text-4xl font-bold">
                  {parsedResult.combinedRating}%
                </div>
              </div>
            )}

            {/* Parsed Results */}
            <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 dark:text-green-300 mb-2 flex items-center gap-2">
                <span className="text-xl">✅</span>
                Successfully Parsed {parsedResult.serviceConnected.length}{" "}
                Service-Connected Rating
                {parsedResult.serviceConnected.length === 1 ? "" : "s"}
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                Review the conditions below and click "Import" to add them.
              </p>
            </div>

            {/* Service-Connected Rating List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {parsedResult.serviceConnected.map((rating, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {rating.condition}
                    </div>
                    {rating.effectiveDate && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Effective:{" "}
                        {new Date(rating.effectiveDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    {rating.rating !== null ? (
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full font-bold text-sm">
                        {rating.rating}%
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full font-medium text-xs">
                        Set %
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Non-Service-Connected Warning */}
            {parsedResult.notServiceConnected.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
                  <strong>⚠️ Note:</strong> Found{" "}
                  {parsedResult.notServiceConnected.length}{" "}
                  non-service-connected condition
                  {parsedResult.notServiceConnected.length === 1
                    ? ""
                    : "s"}{" "}
                  that will NOT be imported:
                </p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-400 ml-4 space-y-1">
                  {parsedResult.notServiceConnected
                    .slice(0, 5)
                    .map((condition, index) => (
                      <li key={index}>• {condition.condition}</li>
                    ))}
                  {parsedResult.notServiceConnected.length > 5 && (
                    <li>
                      • ...and {parsedResult.notServiceConnected.length - 5}{" "}
                      more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}
