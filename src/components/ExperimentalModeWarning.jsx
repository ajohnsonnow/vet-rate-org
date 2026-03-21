/**
 * Experimental Mode Warning Component
 * Displays a warning when experimental WebGPU features are enabled
 */

import React from "react";
import { useLanguage } from "../contexts/LanguageContext";

const ExperimentalModeWarning = ({ experimentalMode }) => {
  const { t } = useLanguage();
  if (!experimentalMode) {
    return null;
  }

  return (
    <div className="p-4 rounded-xl border-2 bg-yellow-900/30 border-yellow-500/50">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <h3 className="font-bold text-yellow-400">
            Experimental WebGPU Mode Enabled
          </h3>
          <p className="text-gray-300 text-sm mt-1">
            You've enabled experimental WebGPU features. This may allow
            additional models to load but could cause instability on some
            systems.
          </p>
          <ul className="text-gray-400 text-xs mt-2 space-y-1 list-disc list-inside">
            <li>Required for Vision models and some advanced features</li>
            <li>May increase GPU memory usage</li>
            <li>Disable if you experience crashes or errors</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExperimentalModeWarning;
