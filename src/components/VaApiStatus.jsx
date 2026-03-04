/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 *
 * VA API Status Indicator Component - "The Lighthouse Signal"
 * 
 * Shows real-time VA API status to users so they know when
 * issues are on the VA's end, not Vet-Rate.org.
 */

import React, { useState, useEffect } from 'react';
import { useVaApiStatus, useVaFeatureStatus } from '../hooks/useVaApiStatus';
import { STATUS_LEVELS, getStatusPageUrl } from '../utils/vaApiStatus';
import { useLanguage } from '../contexts/LanguageContext';
import { sanitizeUrl, sanitizeErrorMessage } from '../utils/sanitize';

// VA StatusPage shortlinks follow a consistent pattern — validate before use in href
const VA_SHORTLINK_PATTERN = /^https:\/\/[a-z0-9-]+\.statuspage\.io\//i;
/** Returns the shortlink only if it matches a known VA statuspage.io URL pattern, else '#'. */
const sanitizeVaShortlink = (url) =>
  (typeof url === 'string' && VA_SHORTLINK_PATTERN.test(url)) ? url : '#';

// ============================================================================
// VA API STATUS BANNER - Shows when there are issues
// ============================================================================

/**
 * Banner that appears at the top of the page when VA APIs have issues
 * Only shows when there are actual problems
 */
export function VaApiStatusBanner({ onDismiss }) {
  const { t } = useLanguage();
  const { summary, loading, hasIssues } = useVaApiStatus({
    autoFetch: true,
    enablePolling: true,
    pollInterval: 5 * 60 * 1000, // 5 minutes
  });
  // Use getStatusPageUrl() directly — it returns a static constant, not tainted hook state
  const statusPageUrl = getStatusPageUrl();
  
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissal when status changes significantly
  useEffect(() => {
    if (summary?.severity === 'major_outage') {
      setDismissed(false);
    }
  }, [summary?.severity]);

  // Don't show if dismissed, loading, or no issues
  if (dismissed || loading || !hasIssues) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  // Color schemes based on severity
  const severityColors = {
    major_outage: 'bg-red-600 border-red-700',
    partial_outage: 'bg-orange-500 border-orange-600',
    degraded_performance: 'bg-yellow-500 border-yellow-600 text-yellow-900',
    under_maintenance: 'bg-blue-500 border-blue-600',
    info: 'bg-blue-400 border-blue-500',
  };

  const bgColor = severityColors[summary?.severity] || 'bg-gray-500 border-gray-600';
  const textColor = summary?.severity === 'degraded_performance' ? 'text-yellow-900' : 'text-white';

  return (
    <div className={`${bgColor} ${textColor} px-4 py-3 border-b-2 shadow-lg relative`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-2xl" role="img" aria-label="VA Status">
            {summary?.icon || '⚠️'}
          </span>
          <div className="flex-1">
            <p className="font-bold text-sm sm:text-base">
              {summary?.title || 'VA API Status Issue'}
            </p>
            <p className="text-xs sm:text-sm opacity-90">
              {summary?.description || 'Some VA services may be unavailable'} 
              <span className="hidden sm:inline"> - This is a VA system issue, not Vet-Rate.org.</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <a
            href={sanitizeUrl(statusPageUrl)} // deepcode ignore javascript/DOMXSS: sanitizeUrl validates URL protocol before rendering
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 dark:bg-red-600 dark:hover:bg-red-700 dark:text-black rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
          >
            VA Status Page ↗
          </a>
          
          {summary?.severity !== 'major_outage' && (
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Dismiss notification"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPACT STATUS INDICATOR - For headers/toolbars
// ============================================================================

/**
 * Small indicator showing VA API status
 * Good for headers, footers, or toolbars
 */
export function VaApiStatusIndicator({ showLabel = true, size = 'md' }) {
  const { t } = useLanguage();
  const { summary, loading, hasIssues, status } = useVaApiStatus();
  // Call getStatusPageUrl() directly so Snyk can confirm this is a static constant
  const statusPageUrl = getStatusPageUrl();
  
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-1 ${sizeClasses[size]} text-gray-400`}>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
        {showLabel && <span>Checking VA status...</span>}
      </div>
    );
  }

  // Determine color based on status
  const dotColors = {
    operational: 'bg-green-500',
    degraded_performance: 'bg-yellow-500',
    partial_outage: 'bg-orange-500',
    major_outage: 'bg-red-500',
    under_maintenance: 'bg-blue-500',
    unknown: 'bg-gray-400',
  };

  const overallStatus = status?.overallStatus || 'unknown';
  const dotColor = dotColors[overallStatus] || dotColors.unknown;

  return (
    <a
      href={sanitizeUrl(statusPageUrl)} // deepcode ignore javascript/DOMXSS: sanitizeUrl validates URL protocol
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-1.5 ${sizeClasses[size]} hover:opacity-80 transition-opacity`}
      title={summary?.title || 'VA API Status'}
    >
      <div className={`w-2 h-2 ${dotColor} rounded-full ${hasIssues ? 'animate-pulse' : ''}`} />
      {showLabel && (
        <span className={hasIssues ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}>
          VA: {summary?.icon || '✅'}
        </span>
      )}
    </a>
  );
}

// ============================================================================
// FEATURE-SPECIFIC STATUS BADGE
// ============================================================================

/**
 * Badge showing status for a specific VA API feature
 * Use near features that depend on VA APIs
 */
export function VaFeatureStatusBadge({ feature, showDetails = false }) {
  const { t } = useLanguage();
  const { 
    status, 
    statusInfo, 
    hasIssues, 
    incidents, 
    maintenance, 
    statusPageUrl 
  } = useVaFeatureStatus(feature);
  
  const [showTooltip, setShowTooltip] = useState(false);

  if (status === 'unknown') {
    return null;
  }

  if (status === 'operational' && !showDetails) {
    return null;
  }

  const badgeColors = {
    operational: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    degraded_performance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    partial_outage: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    major_outage: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    under_maintenance: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };

  return (
    <div className="relative inline-block">
      {/* deepcode ignore OpenRedirect: statusPageUrl is a hardcoded constant from getStatusPageUrl() */}
      <button
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badgeColors[status] || badgeColors.operational}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => { if (/^https:\/\//.test(statusPageUrl)) window.open(statusPageUrl, '_blank'); }}
      >
        <span>{statusInfo?.icon || '✅'}</span>
        <span>{statusInfo?.label || 'Unknown'}</span>
      </button>

      {/* Tooltip with details */}
      {showTooltip && hasIssues && (incidents.length > 0 || maintenance.length > 0) && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl">
          <div className="font-semibold mb-2">VA API Status</div>
          
          {incidents.length > 0 && (
            <div className="mb-2">
              <div className="text-red-300 font-medium">Active Incidents:</div>
              {incidents.slice(0, 2).map(inc => (
                <div key={inc.id} className="text-gray-300 mt-1">
                  • {inc.name}
                </div>
              ))}
            </div>
          )}
          
          {maintenance.length > 0 && (
            <div>
              <div className="text-blue-300 font-medium">Maintenance:</div>
              {maintenance.slice(0, 2).map(m => (
                <div key={m.id} className="text-gray-300 mt-1">
                  • {m.name}
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-2 text-gray-400 text-[10px]">
            Click for details on VA status page
          </div>
          
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FULL STATUS PANEL - For settings/dashboard
// ============================================================================

/**
 * Full status panel showing all VA API statuses
 * Good for settings pages or dedicated status views
 */
export function VaApiStatusPanel() {
  const { t } = useLanguage();
  const { 
    status, 
    loading, 
    error, 
    lastUpdated, 
    forceRefresh, 
    hasIssues,
  } = useVaApiStatus();
  // Use getStatusPageUrl() directly — static constant, breaks taint chain from hook error state
  const statusPageUrl = getStatusPageUrl();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await forceRefresh();
    setIsRefreshing(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏛️</span>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">VA API Status</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Real-time status from VA Lighthouse
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="p-2 hover:bg-white/50 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh status"
            >
              <svg 
                className={`w-5 h-5 text-gray-600 dark:text-gray-300 ${isRefreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            <a
              href={sanitizeUrl(statusPageUrl)} // deepcode ignore javascript/DOMXSS: sanitizeUrl validates URL protocol
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Full Status Page ↗
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading && !status ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Checking VA API status...</p>
          </div>
        ) : error && !status ? (
          <div className="text-center py-8">
            <span className="text-4xl">❓</span>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Unable to fetch VA status</p>
            <p className="text-xs text-gray-400 mt-1">{sanitizeErrorMessage(error)}</p>
          </div>
        ) : (
          <>
            {/* Overall Status */}
            <div className={`p-4 rounded-lg mb-6 ${
              hasIssues 
                ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' 
                : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{hasIssues ? '⚠️' : '✅'}</span>
                <div>
                  <h3 className={`font-bold ${hasIssues ? 'text-amber-800 dark:text-amber-200' : 'text-green-800 dark:text-green-200'}`}>
                    {status?.overallDescription || 'All Systems Operational'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last checked: {lastUpdated?.toLocaleTimeString() || 'Never'}
                  </p>
                </div>
              </div>
            </div>

            {/* Active Incidents */}
            {status?.activeIncidents?.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-red-500">🔴</span> Active Incidents
                </h3>
                <div className="space-y-3">
                  {status.activeIncidents.map(incident => (
                    <div 
                      key={incident.id}
                      className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                    >
                      <a 
                        href={sanitizeVaShortlink(incident.shortlink)}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium text-red-800 dark:text-red-200 hover:underline"
                      >
                        {incident.name}
                      </a>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        {incident.updates?.[0]?.body?.slice(0, 150) || 'No details available'}
                        {incident.updates?.[0]?.body?.length > 150 ? '...' : ''}
                      </p>
                      <div className="text-xs text-red-600 dark:text-red-400 mt-2">
                        Affected: {incident.affectedComponents?.join(', ') || 'Multiple services'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled Maintenance */}
            {status?.scheduledMaintenance?.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-blue-500">🔧</span> Scheduled Maintenance
                </h3>
                <div className="space-y-3">
                  {status.scheduledMaintenance.map(maint => (
                    <div 
                      key={maint.id}
                      className={`p-3 rounded-lg border ${
                        maint.status === 'in_progress'
                          ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <a 
                            href={sanitizeVaShortlink(maint.shortlink)}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium text-gray-900 dark:text-white hover:underline"
                          >
                            {maint.name}
                          </a>
                          {maint.status === 'in_progress' && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                              In Progress
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {new Date(maint.scheduledFor).toLocaleString()} - {new Date(maint.scheduledUntil).toLocaleString()}
                      </p>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Affected: {maint.affectedComponents?.join(', ') || 'Multiple services'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-start gap-3">
                <span className="text-xl">ℹ️</span>
                <div className="text-sm">
                  <p className="text-blue-800 dark:text-blue-200 font-medium">
                    Why does this matter?
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    Vet-Rate.org uses official VA APIs for some features. When the VA's systems are down or under maintenance, 
                    those features may not work - but <strong>it's not a problem with Vet-Rate.org</strong>. 
                    This status page helps you know when VA APIs are experiencing issues.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ERROR BOUNDARY HELPER - For API error messages
// ============================================================================

/**
 * Component to show when a VA API call fails
 * Helps users understand if it's a VA issue
 */
export function VaApiErrorMessage({ feature, error, onRetry }) {
  const { t } = useLanguage();
  const featureStatus = useVaFeatureStatus(feature);
  const isVaIssue = featureStatus.hasIssues;

  return (
    <div className={`p-4 rounded-lg border ${
      isVaIssue 
        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
        : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
    }`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{isVaIssue ? '🏛️' : '❌'}</span>
        <div className="flex-1">
          <h4 className={`font-semibold ${
            isVaIssue ? 'text-amber-800 dark:text-amber-200' : 'text-red-800 dark:text-red-200'
          }`}>
            {isVaIssue ? 'VA System Issue Detected' : 'Unable to Load Data'}
          </h4>
          
          <p className={`text-sm mt-1 ${
            isVaIssue ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'
          }`}>
            {isVaIssue 
              ? "The VA's systems are currently experiencing issues. This is not a problem with Vet-Rate.org."
              : sanitizeErrorMessage(error) || 'An error occurred while fetching data from the VA.'}
          </p>

          {isVaIssue && featureStatus.incidents.length > 0 && (
            <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Active incident: {featureStatus.incidents[0].name}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  isVaIssue 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                Try Again
              </button>
            )}
            <a
              href={sanitizeUrl(getStatusPageUrl())}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Check VA Status Page ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VaApiStatusBanner;
