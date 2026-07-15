/**
 * Vet-Rate.org - AI Mode Selector
 * "The Faraday Cage Protocol" - Easy switching between Cloud and Local AI
 *
 * This component provides a simple, intuitive way for users to:
 * - See their current AI mode
 * - Switch between Cloud and Local AI
 * - Understand the privacy implications of each mode
 */

import { useState, useEffect } from "react";
import { Tooltip } from "./common/Tooltip";
import {
  AI_MODES,
  getAIMode,
  setAIMode,
  getAIStatus,
  isLocalAIReady,
  isCloudAIAvailable,
} from "../utils/unifiedAIService";

/**
 * Polls the shared AI status on an interval and exposes a manual refresh
 * so callers can force an immediate update right after changing the mode.
 */
function useAIStatus(intervalMs = 1000) {
  const [status, setStatus] = useState(getAIStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getAIStatus());
    }, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  const refreshStatus = () => setStatus(getAIStatus());

  return [status, refreshStatus];
}

function useAIStatusBadgeMeta(status) {
  let badgeStyle;
  if (status.localInitializing || status.wllamaInitializing) {
    badgeStyle =
      "bg-cyan-500/30 text-cyan-300 border-cyan-400 shadow-cyan-500/50 shadow-md animate-pulse";
  } else if (status.effectiveMode === AI_MODES.SWARM) {
    badgeStyle =
      "bg-purple-500/30 text-purple-300 border-purple-400 shadow-purple-500/50 shadow-md";
  } else if (status.effectiveMode === AI_MODES.WLLAMA) {
    badgeStyle =
      "bg-teal-500/30 text-teal-300 border-teal-400 shadow-teal-500/50 shadow-md";
  } else if (
    status.effectiveMode === AI_MODES.LOCAL_SERVER ||
    status.effectiveMode === AI_MODES.LOCAL
  ) {
    badgeStyle =
      "bg-green-500/30 text-green-300 border-green-400 shadow-green-500/50 shadow-md";
  } else if (status.effectiveMode === AI_MODES.CLOUD) {
    badgeStyle =
      "bg-blue-500/30 text-blue-300 border-blue-400 shadow-blue-500/50 shadow-md";
  } else {
    badgeStyle =
      "bg-yellow-500/30 text-yellow-300 border-yellow-400 shadow-yellow-500/50 shadow-md animate-pulse";
  }

  let tooltip;
  if (status.localInitializing || status.wllamaInitializing) {
    tooltip = "AI is warming up...";
  } else if (status.effectiveMode === AI_MODES.SWARM) {
    tooltip = "Warrant Council - 100% Private - Full 130K+ DKB";
  } else if (status.effectiveMode === AI_MODES.WLLAMA) {
    tooltip = "Wllama (Browser) - 100% Private - Full 130K+ DKB";
  } else if (status.effectiveMode === AI_MODES.LOCAL_SERVER) {
    tooltip = "Local Server (llama.cpp) - 100% Private - Full 130K+ DKB";
  } else if (status.effectiveMode === AI_MODES.LOCAL) {
    tooltip = `${status.localModelName} - 100% Private - Full 130K+ DKB`;
  } else if (status.effectiveMode === AI_MODES.CLOUD) {
    tooltip = `${status.cloudModelName} - Cloud (💎 DKB 8K web-optimized*)`;
  } else {
    tooltip = "No AI configured - Click to set up";
  }

  return { badgeStyle, tooltip };
}

function AIStatusBadgeContent({ status }) {
  if (status.localInitializing || status.wllamaInitializing) {
    return (
      <>
        <span className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
        <span className="text-base">Warming up...</span>
      </>
    );
  }
  if (status.effectiveMode === AI_MODES.SWARM) {
    return (
      <>
        <span className="w-3 h-3 bg-purple-400 rounded-full animate-pulse" />
        <span className="text-base">Warrant Council</span>
      </>
    );
  }
  if (status.effectiveMode === AI_MODES.WLLAMA) {
    return (
      <>
        <span className="w-3 h-3 bg-teal-400 rounded-full animate-pulse" />
        <span className="text-base">Wllama</span>
      </>
    );
  }
  if (status.effectiveMode === AI_MODES.LOCAL_SERVER) {
    return (
      <>
        <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
        <span className="text-base">Local Server</span>
      </>
    );
  }
  if (status.effectiveMode === AI_MODES.LOCAL) {
    return (
      <>
        <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
        <span className="text-base">{status.localModelName}</span>
      </>
    );
  }
  if (status.effectiveMode === AI_MODES.CLOUD) {
    return (
      <>
        <span className="w-3 h-3 bg-blue-400 rounded-full" />
        <span className="text-base">{status.cloudModelName}</span>
        <span
          className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full font-medium"
          aria-label="Web-optimized DKB (8K entries). Load Local LLM for full 130K+ entries."
        >
          💎 DKB*
        </span>
      </>
    );
  }
  return (
    <>
      <span className="w-3 h-3 bg-gray-400 rounded-full" />
      <span className="text-base">No AI</span>
    </>
  );
}

/**
 * Compact AI Mode Indicator (for headers/toolbars)
 */
export const AIStatusBadge = ({ onClick, className = "" }) => {
  const [status] = useAIStatus(1000);
  const { badgeStyle, tooltip } = useAIStatusBadgeMeta(status);

  return (
    <Tooltip content={tooltip} placement="bottom">
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg border-2 transition-all hover:scale-105 hover:shadow-lg ${badgeStyle} ${className}`}
        aria-label={tooltip}
      >
        <AIStatusBadgeContent status={status} />
      </button>
    </Tooltip>
  );
};

/**
 * AI Mode Toggle Switch (inline)
 */
export const AIToggle = ({
  onModeChange,
  showLabel = true,
  className = "",
}) => {
  const [status, refreshStatus] = useAIStatus(1000);

  const handleToggle = () => {
    const newMode =
      status.effectiveMode === AI_MODES.LOCAL ? AI_MODES.CLOUD : AI_MODES.LOCAL;

    // Only switch if the target mode is available
    if (newMode === AI_MODES.LOCAL && !isLocalAIReady()) {
      alert(
        "Local AI is not initialized. Please set up Local AI first in the settings.",
      );
      return;
    }
    if (newMode === AI_MODES.CLOUD && !isCloudAIAvailable()) {
      alert(
        "Cloud AI requires a Gemini API key. Please configure it in settings.",
      );
      return;
    }

    setAIMode(newMode);
    refreshStatus();
    onModeChange?.(newMode);
  };

  const isLocal = status.effectiveMode === AI_MODES.LOCAL;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className="text-xs text-gray-400">
          {isLocal ? "🔒 Private" : "☁️ Cloud"}
        </span>
      )}
      <Tooltip
        content={
          isLocal
            ? "Using Local AI — click to use Cloud"
            : "Using Cloud AI — click to use Local"
        }
        placement="bottom"
      >
        <button
          onClick={handleToggle}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            isLocal ? "bg-green-600" : "bg-blue-600"
          }`}
          aria-label={
            isLocal
              ? "Using Local AI (click for Cloud)"
              : "Using Cloud AI (click for Local)"
          }
        >
          <div
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              isLocal ? "left-1" : "left-7"
            }`}
          />
        </button>
      </Tooltip>
    </div>
  );
};

function AIModeSelectorCompactView({ status, onModeChange }) {
  let modeLabel;
  if (status.effectiveMode === AI_MODES.LOCAL) {
    modeLabel = "Local AI";
  } else if (status.effectiveMode === AI_MODES.CLOUD) {
    modeLabel = "Cloud AI";
  } else {
    modeLabel = "No AI";
  }

  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{status.isPrivate ? "🔒" : "☁️"}</span>
          <div>
            <p className="text-sm font-medium text-white">{modeLabel}</p>
            <p className="text-xs text-gray-400">
              {status.isPrivate ? "100% Private" : "Data sent to Google"}
            </p>
          </div>
        </div>
        <AIToggle onModeChange={onModeChange} showLabel={false} />
      </div>
    </div>
  );
}

function AIModeSelectorHeader({ onClose }) {
  return (
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
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

function AIModeSelectorStatusPanel({ status }) {
  let containerStyle;
  if (status.isPrivate) {
    containerStyle = "bg-green-900/30 border-green-500/50";
  } else if (status.effectiveMode) {
    containerStyle = "bg-blue-900/30 border-blue-500/50";
  } else {
    containerStyle = "bg-gray-800/50 border-gray-600";
  }

  let icon;
  if (status.effectiveMode === AI_MODES.LOCAL) {
    icon = "🔒";
  } else if (status.effectiveMode === AI_MODES.CLOUD) {
    icon = "☁️";
  } else {
    icon = "⚠️";
  }

  let textStyle;
  if (status.isPrivate) {
    textStyle = "text-green-400";
  } else if (status.effectiveMode) {
    textStyle = "text-blue-400";
  } else {
    textStyle = "text-gray-400";
  }

  let subtitle;
  if (status.isPrivate) {
    subtitle = "Your data never leaves your device";
  } else if (status.effectiveMode) {
    subtitle = "Encrypted connection to Google";
  } else {
    subtitle = "Configure AI to enable features";
  }

  return (
    <div className={`mx-4 mt-4 p-3 rounded-lg border-2 ${containerStyle}`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className={`font-bold ${textStyle}`}>{status.statusText}</p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function LocalAIOptionCard({ selectedMode, onSelect }) {
  const available = isLocalAIReady();
  const isSelected = selectedMode === AI_MODES.LOCAL;

  let cardStyle;
  if (isSelected) {
    cardStyle = "bg-green-900/30 border-green-500";
  } else if (available) {
    cardStyle = "bg-gray-800/50 border-gray-700 hover:border-green-500/50";
  } else {
    cardStyle = "bg-gray-800/20 border-gray-800 opacity-50 cursor-not-allowed";
  }

  return (
    <button
      onClick={() => onSelect(AI_MODES.LOCAL)}
      disabled={!available}
      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${cardStyle}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isSelected ? "bg-green-500" : "bg-gray-700"
          }`}
        >
          <span className="text-xl">🔒</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Local AI</span>
            {isSelected && (
              <span className="text-xs px-2 py-0.5 bg-green-500/30 text-green-400 rounded-full">
                ACTIVE
              </span>
            )}
            {!available && (
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
  );
}

function CloudAIOptionCard({ selectedMode, onSelect }) {
  const available = isCloudAIAvailable();
  const isSelected = selectedMode === AI_MODES.CLOUD;

  let cardStyle;
  if (isSelected) {
    cardStyle = "bg-blue-900/30 border-blue-500";
  } else if (available) {
    cardStyle = "bg-gray-800/50 border-gray-700 hover:border-blue-500/50";
  } else {
    cardStyle = "bg-gray-800/20 border-gray-800 opacity-50 cursor-not-allowed";
  }

  return (
    <button
      onClick={() => onSelect(AI_MODES.CLOUD)}
      disabled={!available}
      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${cardStyle}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isSelected ? "bg-blue-500" : "bg-gray-700"
          }`}
        >
          <span className="text-xl">☁️</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Cloud AI (Gemini)</span>
            {isSelected && (
              <span className="text-xs px-2 py-0.5 bg-blue-500/30 text-blue-400 rounded-full">
                ACTIVE
              </span>
            )}
            {!available && (
              <span className="text-xs px-2 py-0.5 bg-yellow-500/30 text-yellow-400 rounded-full">
                NO API KEY
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Google&apos;s Gemini AI - faster, more capable, requires internet
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
  );
}

function AutoModeOptionCard({ selectedMode, onSelect }) {
  const isSelected = selectedMode === AI_MODES.AUTO;

  return (
    <button
      onClick={() => onSelect(AI_MODES.AUTO)}
      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
        isSelected
          ? "bg-purple-900/30 border-purple-500"
          : "bg-gray-800/50 border-gray-700 hover:border-purple-500/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isSelected ? "bg-purple-500" : "bg-gray-700"
          }`}
        >
          <span className="text-xl">⚡</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Auto (Privacy First)</span>
            {isSelected && (
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
  );
}

/**
 * Full AI Mode Selector Panel
 */
const AIModeSelector = ({ onClose, onModeChange, compact = false }) => {
  const [status, refreshStatus] = useAIStatus(500);
  const [selectedMode, setSelectedMode] = useState(getAIMode());

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
    refreshStatus();
    onModeChange?.(mode);
  };

  if (compact) {
    return (
      <AIModeSelectorCompactView status={status} onModeChange={onModeChange} />
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      <AIModeSelectorHeader onClose={onClose} />
      <AIModeSelectorStatusPanel status={status} />

      {/* Mode Options */}
      <div className="p-4 space-y-3">
        <LocalAIOptionCard
          selectedMode={selectedMode}
          onSelect={handleModeSelect}
        />
        <CloudAIOptionCard
          selectedMode={selectedMode}
          onSelect={handleModeSelect}
        />
        <AutoModeOptionCard
          selectedMode={selectedMode}
          onSelect={handleModeSelect}
        />
      </div>

      {/* Help Text */}
      <div className="px-4 pb-4">
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <p className="text-xs text-gray-500">
            💡 <strong>Privacy Tip:</strong> For maximum privacy, use Local AI.
            Your data never leaves your device, and it even works offline once
            the model is loaded.
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
