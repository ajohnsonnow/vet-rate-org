/**
 * Vet-Rate.org - AI Warning Banner Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Displays prominent warning about AI-generated content hallucinations
 * Specifically warns about fake case law and medical advice
 */

import { useLanguage } from "../contexts/LanguageContext";

const AIWarningBanner = ({ className = "" }) => {
  const { _t } = useLanguage();
  return (
    <div
      className={`bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">⚠️</span>
        <div className="flex-1">
          <h4 className="font-bold text-yellow-900 dark:text-yellow-200 text-sm mb-1">
            AI Warning: Verify All Legal References
          </h4>
          <p className="text-xs text-yellow-800 dark:text-yellow-300">
            AI models can occasionally generate incorrect case law or regulation
            citations.
            <strong> Always verify specific legal references</strong> before
            submitting to the VA.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIWarningBanner;
