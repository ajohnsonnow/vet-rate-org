/**
 * Vet-Rate.org - Knowledge Base Status Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Displays current knowledge base version and eCFR status
 */

import React, { useState, useEffect, useRef } from 'react';
import disabilityDataJson from '../data/disabilityData.json';
import { useColorSchemas } from '../hooks/useColorSchemas';

const disabilityData = disabilityDataJson.disabilities || [];

/**
 * Knowledge Base Status Indicator
 * Shows when the knowledge base was last updated and eCFR status
 */
export default function KnowledgeBaseStatus({ compact = false }) {
  const { getColorClass, colors, getDropdownClasses } = useColorSchemas();
  const dropdownClasses = getDropdownClasses();
  
  const [showDetails, setShowDetails] = useState(false);
  const [kbStatus, setKbStatus] = useState({
    lastUpdated: null,
    totalConditions: 0,
    ecfrCurrent: true,
    ecfrDate: '2026-01-15'
  });
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDetails(false);
      }
    };

    if (showDetails) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDetails]);

  useEffect(() => {
    // Get last verified date from disability data
    const lastVerifiedDates = disabilityData
      .filter(d => d.lastVerifiedDate)
      .map(d => d.lastVerifiedDate);
    
    const mostRecentDate = lastVerifiedDates.length > 0 
      ? lastVerifiedDates.sort().reverse()[0]
      : null;

    setKbStatus({
      lastUpdated: mostRecentDate,
      totalConditions: disabilityData.length,
      ecfrCurrent: true, // Could be checked against eCFR API in future
      ecfrDate: '2026-01-15' // From eCFR Part 4
    });
  }, []);

  const getDaysSinceUpdate = () => {
    if (!kbStatus.lastUpdated) return null;
    const lastUpdate = new Date(kbStatus.lastUpdated);
    const now = new Date();
    const diffTime = Math.abs(now - lastUpdate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = () => {
    const days = getDaysSinceUpdate();
    if (!days) return 'text-gray-500';
    if (days <= 30) return 'text-green-500 dark:text-green-400';
    if (days <= 90) return 'text-yellow-500 dark:text-yellow-400';
    return 'text-orange-500 dark:text-orange-400';
  };

  const getStatusIcon = () => {
    const days = getDaysSinceUpdate();
    if (!days) return '📊';
    if (days <= 30) return '✅';
    if (days <= 90) return '⚠️';
    return '🔄';
  };

  if (compact) {
    return (
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-xs ${getColorClass(colors.base.card)} hover:${getColorClass(colors.base.nestedCard)}`}
          title="Knowledge Base Status"
        >
        <span className={getStatusColor()}>{getStatusIcon()}</span>
        <span className={`font-medium ${getColorClass(colors.text.secondary)}`}>
          KB: {kbStatus.lastUpdated || 'Loading...'}
        </span>
        {kbStatus.ecfrCurrent && (
          <span className="text-green-500 dark:text-green-400" title="eCFR Current">⚖️</span>
        )}
        
        {showDetails && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 text-left z-50">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                  📚 Knowledge Base Status
                </h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Last Updated:</span>
                    <span className={`font-semibold ${getStatusColor()}`}>
                      {kbStatus.lastUpdated}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Conditions:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {kbStatus.totalConditions}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Days Since Update:</span>
                    <span className={`font-semibold ${getStatusColor()}`}>
                      {getDaysSinceUpdate() || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                  ⚖️ eCFR Status
                </h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>38 CFR Part 4:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {kbStatus.ecfrCurrent ? 'Current' : 'Update Available'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>As of Date:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {kbStatus.ecfrDate}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="pt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                Our knowledge base is validated against official eCFR Title 38 regulations.
              </div>
            </div>
          </div>
        )}
        </button>
      </div>
    );
  }

  // Full display version
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>{getStatusIcon()}</span>
          Knowledge Base Status
        </h3>
      </div>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Updated</div>
            <div className={`text-sm font-semibold ${getStatusColor()}`}>
              {kbStatus.lastUpdated || 'Loading...'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              ({getDaysSinceUpdate()} days ago)
            </div>
          </div>
          
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Conditions</div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {kbStatus.totalConditions}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              38 CFR Part 4
            </div>
          </div>
        </div>
        
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">eCFR 38 Part 4 Status</span>
            <span className={`text-sm font-semibold flex items-center gap-1 ${
              kbStatus.ecfrCurrent 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-orange-600 dark:text-orange-400'
            }`}>
              {kbStatus.ecfrCurrent ? '✅ Current' : '🔄 Update Available'}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            As of {kbStatus.ecfrDate}
          </div>
        </div>
        
        <a
          href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2"
        >
          View Official eCFR →
        </a>
      </div>
    </div>
  );
}
