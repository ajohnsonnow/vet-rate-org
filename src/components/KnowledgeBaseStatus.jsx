/**
 * SupplyLocker.org - Knowledge Base Status Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Displays Diamond Knowledge Base (DKB) and Community Knowledge Base (CKB) status
 * DKB = Official sources (training approved)
 * CKB = Community sources (NOT for training)
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import disabilityDataJson from '../data/disabilityData.json';
import { useColorSchemas } from '../hooks/useColorSchemas';

const disabilityData = disabilityDataJson.disabilities || [];

/**
 * Knowledge Base Status Indicator
 * Shows real-time stats from Diamond Knowledge Base (DKB) - Official sources only
 * Also displays Community Knowledge Base (CKB) separately - not for training
 */
export default function KnowledgeBaseStatus({ compact = false }) {
  const { t } = useLanguage();
  const { getColorClass, colors, getDropdownClasses } = useColorSchemas();
  const dropdownClasses = getDropdownClasses();
  
  const [showDetails, setShowDetails] = useState(false);
  const [kbStatus, setKbStatus] = useState({
    lastUpdated: null,
    totalConditions: 0,
    // DKB (Diamond Knowledge Base) - Official sources
    dkbEntries: 0,
    dkbSources: {},
    // CKB (Community Knowledge Base) - NOT for training
    ckbEntries: 0,
    ckbSources: {},
    // Combined for display
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
    // Load Diamond Knowledge Base (DKB) and Community Knowledge Base (CKB) separately
    const loadKnowledgeBaseStats = async () => {
      try {
        // Load DKB (official sources - for AI/training)
        const dkbResponse = await fetch('/data/vet_rate_knowledge.json');
        if (!dkbResponse.ok) throw new Error('Failed to load DKB');
        const dkbData = await dkbResponse.json();
        
        // Calculate DKB statistics (official sources only)
        const dkbSources = {};
        dkbData.forEach(item => {
          const source = item.metadata?.source || 'Unknown';
          dkbSources[source] = (dkbSources[source] || 0) + 1;
        });
        
        // Try to load CKB (community sources - NOT for training)
        let ckbData = [];
        let ckbSources = {};
        try {
          const ckbResponse = await fetch('/data/community_knowledge.json');
          if (ckbResponse.ok) {
            const ckbJson = await ckbResponse.json();
            ckbData = ckbJson.entries || [];
            ckbData.forEach(item => {
              const source = item.metadata?.source || 'COMMUNITY_PROVIDED';
              ckbSources[source] = (ckbSources[source] || 0) + 1;
            });
          }
        } catch (ckbError) {
          console.log('[KB] CKB not available (this is OK)');
        }
        
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
          // DKB - Official sources (training approved)
          dkbEntries: dkbData.length,
          dkbSources,
          // CKB - Community sources (NOT for training)
          ckbEntries: ckbData.length,
          ckbSources,
          // Combined totals for display
          totalEntries: dkbData.length + ckbData.length,
          sources: { ...dkbSources, ...ckbSources },
          ecfrCurrent: true,
          ecfrDate: '2026-01-15',
          loading: false
        });
      } catch (error) {
        console.error('Error loading KB stats:', error);
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
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-xs bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          title="Knowledge Base Status"
        >
        <span className={getStatusColor()}>{getStatusIcon()}</span>
        <span className="font-medium text-gray-700 dark:text-gray-200">
          DKB: {kbStatus.loading ? 'Loading...' : `${kbStatus.dkbEntries.toLocaleString()}`}
        </span>
        {kbStatus.ecfrCurrent && (
          <span className="text-green-500 dark:text-green-400" title="Diamond Certified">💎</span>
        )}
        
        {showDetails && (
          <div className="absolute top-full left-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 text-left z-50">
            <div className="space-y-4">
              {/* DKB Section - Official Sources */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-2">
                  💎 Diamond Knowledge Base (DKB)
                  <span className="text-xs bg-emerald-200 dark:bg-emerald-800 px-2 py-0.5 rounded-full">Training Approved</span>
                </h4>
                <div className="space-y-1 text-xs text-emerald-700 dark:text-emerald-400">
                  <div className="flex justify-between">
                    <span>Official Entries:</span>
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">
                      {kbStatus.loading ? 'Loading...' : kbStatus.dkbEntries.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Official Sources:</span>
                    <span className="font-semibold">
                      {Object.keys(kbStatus.dkbSources).length}
                    </span>
                  </div>
                </div>
                {!kbStatus.loading && Object.keys(kbStatus.dkbSources).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-700">
                    <div className="space-y-0.5 text-xs max-h-32 overflow-y-auto">
                      {Object.entries(kbStatus.dkbSources)
                        .sort((a, b) => b[1] - a[1])
                        .map(([source, count]) => (
                          <div key={source} className="flex justify-between text-emerald-600 dark:text-emerald-400">
                            <span className="truncate mr-2" title={source}>
                              {source.replace(/_OFFICIAL/g, '').replace(/_/g, ' ')}
                            </span>
                            <span className="font-semibold text-emerald-800 dark:text-emerald-200 whitespace-nowrap">
                              {count.toLocaleString()}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* CKB Section - Community Sources */}
              {kbStatus.ckbEntries > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                  <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                    👥 Community Knowledge Base (CKB)
                    <span className="text-xs bg-amber-200 dark:bg-amber-800 px-2 py-0.5 rounded-full">Display Only</span>
                  </h4>
                  <div className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
                    <div className="flex justify-between">
                      <span>Community Entries:</span>
                      <span className="font-bold text-amber-900 dark:text-amber-200">
                        {kbStatus.ckbEntries.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-amber-600 dark:text-amber-500 italic">
                    ⚠️ Not used for AI training - community experiences for reference only
                  </div>
                </div>
              )}
              
              {/* eCFR Status */}
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
                💎 DKB: Official VA sources for AI training<br/>
                👥 CKB: Community wisdom (display only, not for training)
              </div>
            </div>
          </div>
        )}
        </button>
      </div>
    );
  }

  // Full display version - shows both DKB and CKB separately
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4">
      <div className="space-y-4">
        {/* DKB Section */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <span>💎</span>
              Diamond Knowledge Base (DKB)
            </h3>
            <span className="text-xs bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 px-2 py-1 rounded-full">
              Training Approved ✓
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Official Entries</div>
              <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                {kbStatus.loading ? 'Loading...' : kbStatus.dkbEntries.toLocaleString()}
              </div>
              <div className="text-xs text-emerald-500 dark:text-emerald-400">
                Official VA sources
              </div>
            </div>
            
            <div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Source Count</div>
              <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                {Object.keys(kbStatus.dkbSources).length}
              </div>
              <div className="text-xs text-emerald-500 dark:text-emerald-400">
                38 CFR, M21-1, OGC, etc.
              </div>
            </div>
          </div>
          
          {!kbStatus.loading && Object.keys(kbStatus.dkbSources).length > 0 && (
            <div className="pt-3 border-t border-emerald-200 dark:border-emerald-700">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                Source Breakdown
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(kbStatus.dkbSources)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([source, count]) => (
                    <div key={source} className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span className="truncate mr-1" title={source}>
                        {source.replace(/_OFFICIAL/g, '').replace(/_/g, ' ')}
                      </span>
                      <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
        
        {/* CKB Section */}
        {kbStatus.ckbEntries > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <span>👥</span>
                Community Knowledge Base (CKB)
              </h3>
              <span className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-1 rounded-full">
                Display Only
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">Community Entries</div>
                <div className="text-lg font-bold text-amber-900 dark:text-amber-100">
                  {kbStatus.ckbEntries.toLocaleString()}
                </div>
                <div className="text-xs text-amber-500 dark:text-amber-400">
                  Veteran experiences
                </div>
              </div>
              
              <div>
                <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">Status</div>
                <div className="text-sm font-bold text-amber-700 dark:text-amber-300">
                  ⚠️ Not for Training
                </div>
                <div className="text-xs text-amber-500 dark:text-amber-400">
                  Reference only
                </div>
              </div>
            </div>
            
            <div className="text-xs text-amber-600 dark:text-amber-400 italic bg-amber-100 dark:bg-amber-900/40 rounded p-2">
              Community knowledge is displayed separately from official sources and is not used for AI training.
            </div>
          </div>
        )}
        
        {/* eCFR Status */}
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
