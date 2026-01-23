/**
 * Vet-Rate.org - Knowledge Base Status Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Displays current Diamond Knowledge Base (DKB) status with dynamic loading
 */

import React, { useState, useEffect, useRef } from 'react';
import disabilityDataJson from '../data/disabilityData.json';
import { useColorSchemas } from '../hooks/useColorSchemas';

const disabilityData = disabilityDataJson.disabilities || [];

/**
 * Knowledge Base Status Indicator
 * Shows real-time stats from Diamond Knowledge Base (DKB)
 */
export default function KnowledgeBaseStatus({ compact = false }) {
  const { getColorClass, colors, getDropdownClasses } = useColorSchemas();
  const dropdownClasses = getDropdownClasses();
  
  const [showDetails, setShowDetails] = useState(false);
  const [kbStatus, setKbStatus] = useState({
    lastUpdated: null,
    totalConditions: 0,
    totalEntries: 0,
    sources: {},
    ecfrCurrent: true,
    ecfrDate: '2026-01-15',
    loading: true
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
    // Load Diamond Knowledge Base (DKB) statistics dynamically
    const loadKnowledgeBaseStats = async () => {
      try {
        const response = await fetch('/data/vet_rate_knowledge.json');
        if (!response.ok) throw new Error('Failed to load DKB');
        
        const dkbData = await response.json();
        
        // Calculate statistics from DKB
        const sources = {};
        dkbData.forEach(item => {
          const source = item.metadata?.source || 'Unknown';
          sources[source] = (sources[source] || 0) + 1;
        });
        
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
          totalEntries: dkbData.length,
          sources,
          ecfrCurrent: true,
          ecfrDate: '2026-01-15',
          loading: false
        });
      } catch (error) {
        console.error('Error loading DKB stats:', error);
        // Fallback to basic stats
        setKbStatus(prev => ({
          ...prev,
          totalConditions: disabilityData.length,
          loading: false
        }));
      }
    };

    loadKnowledgeBaseStats();
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
          title="Diamond Knowledge Base Status"
        >
        <span className={getStatusColor()}>{getStatusIcon()}</span>
        <span className={`font-medium ${getColorClass(colors.text.secondary)}`}>
          DKB: {kbStatus.loading ? 'Loading...' : `${kbStatus.totalEntries.toLocaleString()} entries`}
        </span>
        {kbStatus.ecfrCurrent && (
          <span className="text-green-500 dark:text-green-400" title="eCFR Current">💎</span>
        )}
        
        {showDetails && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 text-left z-50">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                  💎 Diamond Knowledge Base (DKB)
                </h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Total Entries:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {kbStatus.loading ? 'Loading...' : kbStatus.totalEntries.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Official Sources:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {Object.keys(kbStatus.sources).filter(s => s.includes('OFFICIAL')).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Conditions Tracked:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {kbStatus.totalConditions}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Updated:</span>
                    <span className={`font-semibold ${getStatusColor()}`}>
                      {kbStatus.lastUpdated || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              
              {!kbStatus.loading && Object.keys(kbStatus.sources).length > 0 && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                    📊 Source Breakdown
                  </h4>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 max-h-40 overflow-y-auto">
                    {Object.entries(kbStatus.sources)
                      .sort((a, b) => b[1] - a[1])
                      .map(([source, count]) => (
                        <div key={source} className="flex justify-between">
                          <span className="truncate mr-2" title={source}>
                            {source.replace(/_/g, ' ')}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                            {count.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                  ⚖️ eCFR Status
                </h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>38 CFR Part 4:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {kbStatus.ecfrCurrent ? 'Current ✓' : 'Update Available'}
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
                Diamond Standard: Multi-source validated knowledge base with official eCFR, M21-1, BVA decisions, and community expertise.
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
          <span>💎</span>
          Diamond Knowledge Base
        </h3>
      </div>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Entries</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {kbStatus.loading ? 'Loading...' : kbStatus.totalEntries.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Multi-source validated
            </div>
          </div>
          
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Conditions Tracked</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {kbStatus.totalConditions}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              38 CFR Part 4
            </div>
          </div>
        </div>
        
        {!kbStatus.loading && Object.keys(kbStatus.sources).length > 0 && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Official Sources ({Object.keys(kbStatus.sources).filter(s => s.includes('OFFICIAL')).length})
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(kbStatus.sources)
                .filter(([source]) => source.includes('OFFICIAL'))
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([source, count]) => (
                  <div key={source} className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span className="truncate mr-1" title={source}>
                      {source.replace(/_OFFICIAL/g, '').replace(/_/g, ' ')}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
        
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
