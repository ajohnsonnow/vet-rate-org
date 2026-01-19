/**
 * Vet-Rate.org - AI Mode Selector
 * "The Faraday Cage Protocol" - Easy switching between Cloud and Local AI
 * 
 * This component provides a simple, intuitive way for users to:
 * - See their current AI mode
 * - Switch between Cloud and Local AI
 * - Understand the privacy implications of each mode
 */

import React, { useState, useEffect } from 'react';
import { 
  AI_MODES, 
  getAIMode, 
  setAIMode, 
  getAIStatus,
  isLocalAIReady,
  isCloudAIAvailable,
} from '../utils/unifiedAIService';

/**
 * Compact AI Mode Indicator (for headers/toolbars)
 * @param {boolean} showLabel - Show full label with Local/Cloud designation
 */
export const AIStatusBadge = ({ onClick, className = '', showLabel = false }) => {
  const [status, setStatus] = useState(getAIStatus());
  
  useEffect(() => {
    // Refresh status periodically
    const interval = setInterval(() => {
      setStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getBadgeStyle = () => {
    if (status.effectiveMode === AI_MODES.LOCAL) {
      return 'bg-green-500/20 text-green-400 border-green-500/50';
    }
    if (status.effectiveMode === AI_MODES.CLOUD) {
      return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    }
    return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all hover:scale-105 ${getBadgeStyle()} ${className}`}
      title={status.isPrivate ? `Local AI: ${status.localModelName} - 100% Private` : `Cloud AI: ${status.cloudModelName} - Click to configure`}
    >
      {status.effectiveMode === AI_MODES.LOCAL ? (
        <>
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span>🔒 {status.localModelName}</span>
        </>
      ) : status.effectiveMode === AI_MODES.CLOUD ? (
        <>
          <span className="w-2 h-2 bg-blue-400 rounded-full" />
          <span>☁️ {status.cloudModelName}</span>
        </>
      ) : (
        <>
          <span className="w-2 h-2 bg-gray-400 rounded-full" />
          <span>⚠️ No AI</span>
        </>
      )}
    </button>
  );
};

/**
 * AI Mode Toggle Switch (inline)
 */
export const AIToggle = ({ onModeChange, showLabel = true, className = '' }) => {
  const [status, setStatus] = useState(getAIStatus());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    const newMode = status.effectiveMode === AI_MODES.LOCAL ? AI_MODES.CLOUD : AI_MODES.LOCAL;
    
    // Only switch if the target mode is available
    if (newMode === AI_MODES.LOCAL && !isLocalAIReady()) {
      alert('Local AI is not initialized. Please set up Local AI first in the settings.');
      return;
    }
    if (newMode === AI_MODES.CLOUD && !isCloudAIAvailable()) {
      alert('Cloud AI requires a Gemini API key. Please configure it in settings.');
      return;
    }
    
    setAIMode(newMode);
    setStatus(getAIStatus());
    onModeChange?.(newMode);
  };

  const isLocal = status.effectiveMode === AI_MODES.LOCAL;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className="text-xs text-gray-400">
          {isLocal ? '🔒 Private' : '☁️ Cloud'}
        </span>
      )}
      <button
        onClick={handleToggle}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          isLocal ? 'bg-green-600' : 'bg-blue-600'
        }`}
        title={isLocal ? 'Using Local AI (click for Cloud)' : 'Using Cloud AI (click for Local)'}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            isLocal ? 'left-1' : 'left-7'
          }`}
        />
      </button>
    </div>
  );
};

/**
 * Full AI Mode Selector Panel
 */
const AIModeSelector = ({ onClose, onModeChange, compact = false }) => {
  const [status, setStatus] = useState(getAIStatus());
  const [selectedMode, setSelectedMode] = useState(getAIMode());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getAIStatus());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleModeSelect = (mode) => {
    // Validate the mode is available
    if (mode === AI_MODES.LOCAL && !isLocalAIReady()) {
      return; // Can't select unavailable mode
    }
    if (mode === AI_MODES.CLOUD && !isCloudAIAvailable()) {
      return;
    }
    
    setSelectedMode(mode);
    setAIMode(mode);
    setStatus(getAIStatus());
    onModeChange?.(mode);
  };

  if (compact) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">{status.isPrivate ? '🔒' : '☁️'}</span>
            <div>
              <p className="text-sm font-medium text-white">
                {status.effectiveMode === AI_MODES.LOCAL ? 'Local AI' : 
                 status.effectiveMode === AI_MODES.CLOUD ? 'Cloud AI' : 'No AI'}
              </p>
              <p className="text-xs text-gray-400">
                {status.isPrivate ? '100% Private' : 'Data sent to Google'}
              </p>
            </div>
          </div>
          <AIToggle onModeChange={onModeChange} showLabel={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <h3 className="font-bold text-white">AI Privacy Mode</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/20 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Current Status */}
      <div className={`mx-4 mt-4 p-3 rounded-lg border-2 ${
        status.isPrivate 
          ? 'bg-green-900/30 border-green-500/50' 
          : status.effectiveMode 
            ? 'bg-blue-900/30 border-blue-500/50'
            : 'bg-gray-800/50 border-gray-600'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">
            {status.effectiveMode === AI_MODES.LOCAL ? '🔒' : 
             status.effectiveMode === AI_MODES.CLOUD ? '☁️' : '⚠️'}
          </span>
          <div>
            <p className={`font-bold ${
              status.isPrivate ? 'text-green-400' : 
              status.effectiveMode ? 'text-blue-400' : 'text-gray-400'
            }`}>
              {status.statusText}
            </p>
            <p className="text-xs text-gray-400">
              {status.isPrivate 
                ? 'Your data never leaves your device' 
                : status.effectiveMode 
                  ? 'Encrypted connection to Google'
                  : 'Configure AI to enable features'}
            </p>
          </div>
        </div>
      </div>

      {/* Mode Options */}
      <div className="p-4 space-y-3">
        {/* Local AI Option */}
        <button
          onClick={() => handleModeSelect(AI_MODES.LOCAL)}
          disabled={!isLocalAIReady()}
          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
            selectedMode === AI_MODES.LOCAL
              ? 'bg-green-900/30 border-green-500'
              : isLocalAIReady()
                ? 'bg-gray-800/50 border-gray-700 hover:border-green-500/50'
                : 'bg-gray-800/20 border-gray-800 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selectedMode === AI_MODES.LOCAL ? 'bg-green-500' : 'bg-gray-700'
            }`}>
              <span className="text-xl">🔒</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">Local AI</span>
                {selectedMode === AI_MODES.LOCAL && (
                  <span className="text-xs px-2 py-0.5 bg-green-500/30 text-green-400 rounded-full">
                    ACTIVE
                  </span>
                )}
                {!isLocalAIReady() && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-500/30 text-yellow-400 rounded-full">
                    NOT INITIALIZED
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                100% private - runs entirely on your device via WebGPU
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                  ✓ No data sent
                </span>
                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                  ✓ Works offline
                </span>
                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                  ✓ No API key needed
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Cloud AI Option */}
        <button
          onClick={() => handleModeSelect(AI_MODES.CLOUD)}
          disabled={!isCloudAIAvailable()}
          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
            selectedMode === AI_MODES.CLOUD
              ? 'bg-blue-900/30 border-blue-500'
              : isCloudAIAvailable()
                ? 'bg-gray-800/50 border-gray-700 hover:border-blue-500/50'
                : 'bg-gray-800/20 border-gray-800 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selectedMode === AI_MODES.CLOUD ? 'bg-blue-500' : 'bg-gray-700'
            }`}>
              <span className="text-xl">☁️</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">Cloud AI (Gemini)</span>
                {selectedMode === AI_MODES.CLOUD && (
                  <span className="text-xs px-2 py-0.5 bg-blue-500/30 text-blue-400 rounded-full">
                    ACTIVE
                  </span>
                )}
                {!isCloudAIAvailable() && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-500/30 text-yellow-400 rounded-full">
                    NO API KEY
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Google's Gemini AI - faster, more capable, requires internet
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                  ✓ Faster responses
                </span>
                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                  ✓ More capable
                </span>
                <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                  ⚠ Data sent to Google
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Auto Mode Option */}
        <button
          onClick={() => handleModeSelect(AI_MODES.AUTO)}
          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
            selectedMode === AI_MODES.AUTO
              ? 'bg-purple-900/30 border-purple-500'
              : 'bg-gray-800/50 border-gray-700 hover:border-purple-500/50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selectedMode === AI_MODES.AUTO ? 'bg-purple-500' : 'bg-gray-700'
            }`}>
              <span className="text-xl">⚡</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">Auto (Privacy First)</span>
                {selectedMode === AI_MODES.AUTO && (
                  <span className="text-xs px-2 py-0.5 bg-purple-500/30 text-purple-400 rounded-full">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Automatically uses Local AI when available, falls back to Cloud
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Help Text */}
      <div className="px-4 pb-4">
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <p className="text-xs text-gray-500">
            💡 <strong>Privacy Tip:</strong> For maximum privacy, use Local AI. Your data never 
            leaves your device, and it even works offline once the model is loaded.
          </p>
        </div>
      </div>
    </div>
  );
};

// Named export for components that import { AIModeSelector }
export { AIModeSelector };

// Default export for standalone usage
export default AIModeSelector;
