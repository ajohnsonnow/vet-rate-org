/**
 * AI Preset Selector Component
 * Allows users to choose pre-configured AI settings for different tasks
 *
 * Presets:
 * - LEGAL: Max accuracy for regulatory analysis (temp 0.1)
 * - CREATIVE: Natural writing for nexus letters (temp 0.7)
 * - ADVERSARIAL: Critical Red Team simulation (temp 0.4)
 * - BALANCED: General purpose (temp 0.7)
 */

import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { AI_PRESETS } from "../utils/unifiedAIService";

const PresetSelector = ({ value, onChange, className = "" }) => {
  const { t } = useLanguage();
  const [selectedPreset, setSelectedPreset] = useState(value || "BALANCED");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (value) setSelectedPreset(value);
  }, [value]);

  const handleChange = (presetName) => {
    setSelectedPreset(presetName);
    if (onChange) {
      onChange(presetName, AI_PRESETS[presetName]);
    }
  };

  const currentPreset = AI_PRESETS[selectedPreset];

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Preset Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          AI Configuration Preset
        </label>

        <select
          value={selectedPreset}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        >
          {Object.entries(AI_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {/* Current Preset Details */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {currentPreset.label}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              {currentPreset.description}
            </p>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-blue-600 dark:text-blue-400 text-xs hover:underline ml-2"
          >
            {showDetails ? "Hide" : "Details"}
          </button>
        </div>

        {/* Expanded Details */}
        {showDetails && (
          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  Temperature:
                </span>
                <span className="ml-1 text-blue-900 dark:text-blue-100">
                  {currentPreset.temperature}
                </span>
              </div>
              <div>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  Top-K:
                </span>
                <span className="ml-1 text-blue-900 dark:text-blue-100">
                  {currentPreset.topK}
                </span>
              </div>
              <div>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  Top-P:
                </span>
                <span className="ml-1 text-blue-900 dark:text-blue-100">
                  {currentPreset.topP}
                </span>
              </div>
            </div>

            {currentPreset.useCase && (
              <div className="text-xs">
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  Best for:
                </span>
                <span className="ml-1 text-blue-900 dark:text-blue-100">
                  {currentPreset.useCase.join(", ")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preset Explanations */}
      <div className="space-y-2">
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
            📖 What do these presets do?
          </summary>
          <div className="mt-2 space-y-2 pl-4 text-gray-600 dark:text-gray-400">
            <div>
              <strong className="text-gray-900 dark:text-gray-100">
                LEGAL (Jag Advocate):
              </strong>
              <p className="ml-2">
                Temperature 0.1 = Maximum precision, zero creativity. Perfect
                for analyzing C-Files, regulations, and PACT Act provisions
                where accuracy is critical.
              </p>
            </div>

            <div>
              <strong className="text-gray-900 dark:text-gray-100">
                CREATIVE (Empathetic Nexus):
              </strong>
              <p className="ml-2">
                Temperature 0.7 = Natural, human-like writing. Ideal for nexus
                letters, personal statements, and persuasive narratives that
                need emotional resonance.
              </p>
            </div>

            <div>
              <strong className="text-gray-900 dark:text-gray-100">
                ADVERSARIAL (Red Team):
              </strong>
              <p className="ml-2">
                Temperature 0.4 = Critical, skeptical evaluation. Simulates VA
                reviewers who scrutinize claims. Use for "War Game" preparation.
              </p>
            </div>

            <div>
              <strong className="text-gray-900 dark:text-gray-100">
                BALANCED (Standard):
              </strong>
              <p className="ml-2">
                Temperature 0.7 = Good for most tasks. Balanced between accuracy
                and natural language.
              </p>
            </div>
          </div>
        </details>
      </div>

      {/* Warning for LEGAL preset */}
      {selectedPreset === "LEGAL" && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-2">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            ⚖️ <strong>Legal Mode Active:</strong> AI will prioritize 38 CFR
            Part 4 accuracy over natural language. Responses may be technical.
          </p>
        </div>
      )}

      {/* Warning for ADVERSARIAL preset */}
      {selectedPreset === "ADVERSARIAL" && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-2">
          <p className="text-xs text-red-800 dark:text-red-200">
            🛡️ <strong>Red Team Mode Active:</strong> AI will challenge your
            claim like a skeptical VA reviewer. This can be stressful - use for
            preparation only.
          </p>
        </div>
      )}
    </div>
  );
};

export default PresetSelector;
