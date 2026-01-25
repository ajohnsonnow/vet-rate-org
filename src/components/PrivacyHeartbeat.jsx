/**
 * SupplyLocker.org - Privacy Heartbeat Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * 
 * AAAAA Design System - "Diamond Standard" Privacy Verification
 * 
 * A persistent visual indicator that reinforces the 100% client-side,
 * zero-data-collection architecture. Shows real-time processing status
 * and provides a link to the Security Proof documentation.
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export default function PrivacyHeartbeat({ 
  isProcessing = false, 
  showSecurityProof,
  compact = false 
}) {
  const { isDark, isTbiComfort } = useTheme();
  const [networkActivity, setNetworkActivity] = useState(false);
  
  // Monitor for any network activity (for transparency)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.PerformanceObserver) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Only flag external network calls, not local assets
          if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
            const url = entry.name || '';
            if (!url.includes(window.location.host) && !url.startsWith('data:')) {
              setNetworkActivity(true);
              setTimeout(() => setNetworkActivity(false), 2000);
            }
          }
        }
      });
      
      try {
        observer.observe({ entryTypes: ['resource'] });
      } catch (e) {
        // Observer not supported
      }
      
      return () => observer.disconnect();
    }
  }, []);
  
  const getStatusColor = () => {
    if (networkActivity) return 'yellow';
    if (isProcessing) return 'blue';
    return 'green';
  };
  
  const getStatusText = () => {
    if (networkActivity) return 'Network Activity Detected';
    if (isProcessing) return 'Local Processing Active';
    return 'Local-Only Processing';
  };
  
  const statusColor = getStatusColor();
  
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-${statusColor}-400 opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 bg-${statusColor}-500`} />
        </div>
        <span className={`text-xs font-bold ${statusColor === 'green' ? 'text-green-600 dark:text-green-400' : statusColor === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400'}`}>
          {isProcessing ? 'Processing...' : 'Secure'}
        </span>
      </div>
    );
  }
  
  return (
    <div className={`
      p-4 rounded-xl border flex items-center justify-between flex-wrap gap-4
      ${isDark || isTbiComfort 
        ? 'bg-gray-800/50 border-gray-700' 
        : 'bg-slate-50 border-slate-200'}
    `}>
      <div className="flex items-center gap-3">
        {/* Animated Heartbeat Indicator */}
        <div className="relative flex h-3 w-3">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            statusColor === 'green' ? 'bg-green-400' : 
            statusColor === 'yellow' ? 'bg-yellow-400' : 'bg-blue-400'
          }`} />
          <span className={`relative inline-flex rounded-full h-3 w-3 ${
            statusColor === 'green' ? 'bg-green-500' : 
            statusColor === 'yellow' ? 'bg-yellow-500' : 'bg-blue-500'
          }`} />
        </div>
        
        <div>
          <span className={`text-sm font-medium ${isDark || isTbiComfort ? 'text-gray-300' : 'text-slate-700'}`}>
            Security Status:{' '}
            <span className={`font-bold uppercase ${
              statusColor === 'green' ? 'text-green-600 dark:text-green-400' : 
              statusColor === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' : 
              'text-blue-600 dark:text-blue-400'
            }`}>
              {getStatusText()}
            </span>
          </span>
          
          {/* Processing details when active */}
          {isProcessing && (
            <p className={`text-xs ${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-500'} mt-1`}>
              AI analysis running in browser memory • Zero data transmitted
            </p>
          )}
        </div>
      </div>
      
      {/* Security Proof Link */}
      {showSecurityProof && (
        <button
          onClick={showSecurityProof}
          className={`
            text-xs font-bold uppercase tracking-wider underline
            ${isDark || isTbiComfort ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}
            focus:outline-none focus:ring-2 focus:ring-blue-500 rounded
          `}
        >
          View Security Proof
        </button>
      )}
    </div>
  );
}

/**
 * Privacy Badge - Compact badge for tool headers
 */
export function PrivacyBadge({ isLocal = true, showPulse = true }) {
  const { isDark, isTbiComfort } = useTheme();
  
  if (!isLocal) return null;
  
  return (
    <span className={`
      inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest 
      px-2 py-1 rounded-full border
      ${isDark || isTbiComfort 
        ? 'text-green-400 bg-green-900/30 border-green-700' 
        : 'text-green-700 bg-green-50 border-green-200'}
    `}>
      {showPulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
        </span>
      )}
      100% Local
    </span>
  );
}

/**
 * Privacy Notice - For file upload areas
 */
export function PrivacyNotice({ compact = false }) {
  const { isDark, isTbiComfort } = useTheme();
  
  if (compact) {
    return (
      <p className={`text-xs ${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-500'} flex items-center gap-1`}>
        <span className="text-green-500">🔒</span>
        Privacy Verified: Data processed locally, never transmitted
      </p>
    );
  }
  
  return (
    <div className={`
      p-3 rounded-lg border flex items-start gap-3
      ${isDark || isTbiComfort 
        ? 'bg-green-900/20 border-green-800/50' 
        : 'bg-green-50 border-green-200'}
    `}>
      <span className="text-xl">🔒</span>
      <div>
        <p className={`text-sm font-semibold ${isDark || isTbiComfort ? 'text-green-400' : 'text-green-800'}`}>
          Privacy Verified
        </p>
        <p className={`text-xs ${isDark || isTbiComfort ? 'text-green-300/70' : 'text-green-700'}`}>
          This file is processed entirely in your browser's RAM. No data is uploaded, stored, or transmitted. 
          Analysis is wiped when you close the tab.
        </p>
      </div>
    </div>
  );
}
