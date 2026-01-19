/**
 * Vet-Rate.org - Stale Data Indicator Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Visual indicator for outdated rating criteria
 * Shows warnings and provides reporting mechanism
 */

import React from 'react';
import { getStaleDataStatus, generateReportOutdatedLink } from '../utils/staleDataDetection';

const StaleDataIndicator = ({ disability, variant = 'full', className = '' }) => {
  const status = getStaleDataStatus(disability);
  
  // Don't show anything if data is current
  if (!status.showWarning) {
    return null;
  }
  
  // Compact badge variant (for lists/cards)
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
        status.severity === 'critical' 
          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700' 
          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700'
      } ${className}`}>
        <span>{status.icon}</span>
        <span>Verify</span>
      </div>
    );
  }
  
  // Full warning banner variant
  return (
    <div className={`rounded-lg border-2 p-3 ${
      status.severity === 'critical'
        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
    } ${className}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{status.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className={`font-bold text-sm mb-1 ${
            status.severity === 'critical'
              ? 'text-red-900 dark:text-red-200'
              : 'text-yellow-900 dark:text-yellow-200'
          }`}>
            {status.message}
          </h4>
          <p className={`text-xs mb-2 ${
            status.severity === 'critical'
              ? 'text-red-800 dark:text-red-300'
              : 'text-yellow-800 dark:text-yellow-300'
          }`}>
            {status.description}. VA rating criteria may have changed. 
            Please verify current regulations at <a href="https://www.ecfr.gov/current/title-38/chapter-I/part-4" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">38 CFR Part 4</a>.
          </p>
          <a
            href={generateReportOutdatedLink(disability)}
            className={`inline-flex items-center gap-1 text-xs font-medium underline hover:no-underline ${
              status.severity === 'critical'
                ? 'text-red-700 dark:text-red-400'
                : 'text-yellow-700 dark:text-yellow-400'
            }`}
          >
            <span>📧</span>
            Report Outdated Info
          </a>
        </div>
      </div>
    </div>
  );
};

export default StaleDataIndicator;
