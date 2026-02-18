/**
 * Vet-Rate.org - AI Ready Check Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Checks if AI (Local or Cloud) is available before running AI tools.
 * Provides helpful UI to guide users to set up AI if not ready.
 * 
 * Now with Device-Aware recommendations based on user analytics:
 * - Android 10 users (20% of traffic) get Cloud AI recommendation
 * - Modern iOS/Android users get Local AI recommendation
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  isAnyAIAvailable, 
  isLocalAIReady, 
  isLocalAIInitializing,
  isCloudAIAvailable, 
  getAIStatus, 
  AI_MODES 
} from '../utils/unifiedAIService';
import { useDeviceCapability, DEVICE_TIERS } from '../utils/useDeviceCapability';
import { AIStatusBadge } from './AIModeSelector';

const AlertIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

/**
 * AI Status Badge with Current AI Info
 */
export const AICurrentBadge = ({ className = '' }) => {
  const { t } = useLanguage();
  const [aiStatus, setAiStatus] = useState(getAIStatus());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setAiStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (aiStatus.effectiveMode === AI_MODES.LOCAL) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/50 rounded-lg ${className}`}>
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <LockIcon />
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-green-400">Local AI Active</span>
          <span className="text-xs text-green-300">{aiStatus.localModelName}</span>
        </div>
      </div>
    );
  }

  if (aiStatus.effectiveMode === AI_MODES.CLOUD) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-2 bg-blue-500/20 border border-blue-500/50 rounded-lg ${className}`}>
        <span className="w-2 h-2 bg-blue-400 rounded-full" />
        <SparklesIcon />
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-blue-400">Cloud AI Active</span>
          <span className="text-xs text-blue-300">{aiStatus.cloudModelName}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 bg-gray-500/20 border border-gray-500/50 rounded-lg ${className}`}>
      <span className="w-2 h-2 bg-gray-400 rounded-full" />
      <AlertIcon />
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-gray-400">No AI Configured</span>
        <span className="text-xs text-gray-400">Set up AI below</span>
      </div>
    </div>
  );
};

/**
 * AI Ready Check Component
 * Shows warning if no AI is available with links to set it up
 * Now with device-aware recommendations
 */
export default function AIReadyCheck({ 
  onOpenFaradayCage, 
  onOpenCloudAISettings,
  className = '',
  compact = false 
}) {
  const [aiReady, setAiReady] = useState(isAnyAIAvailable());
  const [localReady, setLocalReady] = useState(isLocalAIReady());
  const [localInitializing, setLocalInitializing] = useState(isLocalAIInitializing());
  const [cloudReady, setCloudReady] = useState(isCloudAIAvailable());
  
  // Device capability detection for smart AI recommendations
  const deviceCapability = useDeviceCapability();

  useEffect(() => {
    const interval = setInterval(() => {
      setAiReady(isAnyAIAvailable());
      setLocalReady(isLocalAIReady());
      setLocalInitializing(isLocalAIInitializing());
      setCloudReady(isCloudAIAvailable());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // If Local AI is warming up, show loading state
  if (localInitializing) {
    return (
      <div className={`bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-pulse">⏳</span>
          <div className="flex-1">
            <h3 className="font-semibold text-cyan-800 dark:text-cyan-200">Local AI Warming Up...</h3>
            {!compact && (
              <p className="text-sm text-cyan-700 dark:text-cyan-300">
                The Neural Engine is loading. Please wait before sending messages.
              </p>
            )}
          </div>
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // If AI is ready, show success state
  if (aiReady) {
    return (
      <div className={`bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">AI Ready</h3>
              {!compact && (
                <p className="text-sm text-green-700 dark:text-green-300">
                  {localReady && cloudReady 
                    ? 'Both Local and Cloud AI are available'
                    : localReady 
                    ? '100% Private Local AI active'
                    : 'Cloud AI (Gemini) active'}
                </p>
              )}
            </div>
          </div>
          <AICurrentBadge />
        </div>
      </div>
    );
  }

  // If no AI is ready, show warning with setup options (device-aware)
  return (
    <div className={`bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertIcon />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
            AI Not Configured
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
            This tool requires AI. Choose an option below to get started:
          </p>

          <div className="grid md:grid-cols-2 gap-3">
            {/* Local AI Option - Device Aware */}
            <button
              onClick={deviceCapability.advice?.localAI.buttonDisabled ? undefined : onOpenFaradayCage}
              disabled={deviceCapability.advice?.localAI.buttonDisabled}
              className={`flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border-2 transition-all group relative ${
                deviceCapability.advice?.localAI.buttonDisabled
                  ? 'border-gray-300 dark:border-gray-700 opacity-60 cursor-not-allowed'
                  : deviceCapability.advice?.localAI.recommended
                    ? 'border-green-400 dark:border-green-600 ring-2 ring-green-200 dark:ring-green-900'
                    : 'border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600'
              }`}
            >
              {/* Recommendation Badge */}
              {deviceCapability.advice?.localAI.badge && (
                <span className={`absolute -top-2 -right-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                  deviceCapability.advice?.localAI.recommended
                    ? 'bg-green-500 text-white'
                    : deviceCapability.isUnsupported
                      ? 'bg-red-500 text-white'
                      : 'bg-amber-500 text-white'
                }`}>
                  {deviceCapability.advice?.localAI.badge}
                </span>
              )}
              
              <div className={`p-2 rounded-lg transition-colors ${
                deviceCapability.advice?.localAI.buttonDisabled
                  ? 'bg-gray-100 dark:bg-gray-700'
                  : 'bg-green-100 dark:bg-green-900/40 group-hover:bg-green-200 dark:group-hover:bg-green-800/60'
              }`}>
                <LockIcon />
              </div>
              <div className="text-left flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {deviceCapability.advice?.localAI.label || '🔒 Local AI'}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {deviceCapability.advice?.localAI.description || '100% private, runs on your device.'}
                </p>
                {/* Warning message for legacy/unsupported devices */}
                {deviceCapability.advice?.localAI.warning && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                    {deviceCapability.advice.localAI.warning}
                  </p>
                )}
                {/* Battery warning for mobile */}
                {deviceCapability.advice?.batteryWarning && !deviceCapability.isUnsupported && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                    📱 Note: Heavy battery usage on mobile
                  </p>
                )}
              </div>
            </button>

            {/* Cloud AI Option - Device Aware */}
            <button
              onClick={onOpenCloudAISettings}
              className={`flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border-2 transition-all group relative ${
                deviceCapability.advice?.cloudAI.recommended
                  ? 'border-blue-400 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-900'
                  : 'border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600'
              }`}
            >
              {/* Recommendation Badge */}
              {deviceCapability.advice?.cloudAI.badge && (
                <span className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-bold rounded-full bg-blue-500 text-white">
                  {deviceCapability.advice?.cloudAI.badge}
                </span>
              )}
              
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/60 transition-colors">
                <SparklesIcon />
              </div>
              <div className="text-left flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  ☁️ Cloud AI (Gemini)
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {deviceCapability.advice?.cloudAI.description || 'Requires free Google Gemini API key. Data sent to Google.'}
                </p>
              </div>
            </button>
          </div>
          
          {/* Data saver warning */}
          {deviceCapability.advice?.dataSaverWarning && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 text-center">
              📶 Data Saver mode detected. Local AI requires downloading 0.7-4GB. Consider using Wi-Fi or Cloud AI.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline AI Ready Indicator (for tool headers)
 */
export const AIReadyIndicator = ({ 
  onOpenSettings, 
  showLabel = false,
  className = '' 
}) => {
  const [aiStatus, setAiStatus] = useState(getAIStatus());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setAiStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <AIStatusBadge showLabel={showLabel} onClick={onOpenSettings} />
      {aiStatus.effectiveMode && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {aiStatus.effectiveMode === AI_MODES.LOCAL 
            ? '🔒 Private'
            : '☁️ Cloud'}
        </span>
      )}
    </div>
  );
};
