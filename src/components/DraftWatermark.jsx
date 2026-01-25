/**
 * SupplyLocker.org - Draft Watermark Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Displays prominent "DRAFT" watermark on AI-generated content
 * Reminds users that content must be reviewed before submission
 */

import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const DraftWatermark = ({ className = '', variant = 'banner' }) => {
  const { t } = useLanguage();
  if (variant === 'banner') {
    return (
      <div className={`bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 rounded-t-lg px-4 py-2 ${className}`}>
        <div className="flex items-center justify-center gap-2">
          <span className="text-red-600 dark:text-red-400 font-bold text-sm tracking-wider">
            📋 DRAFT - FOR VETERAN REVIEW ONLY
          </span>
        </div>
      </div>
    );
  }

  // Inline variant for smaller areas
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded ${className}`}>
      <span className="text-red-600 dark:text-red-400 font-semibold text-xs">
        DRAFT - REVIEW REQUIRED
      </span>
    </div>
  );
};

export default DraftWatermark;
