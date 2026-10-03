/**
 * Smart AI Load Button
 * Drop this into any tool modal for one-click AI loading
 * Automatically detects device, recommends best model, handles switching
 */

import { useState, useEffect } from "react";
import {
  checkModelMatch,
  smartLoadAI,
  getDeviceType,
} from "../utils/smartAILoader";

const ConfigErrorNotice = ({ toolId }) => (
  <div className="p-4 bg-red-900/20 border border-red-700 rounded-xl">
    <div className="flex items-start gap-3">
      <span className="text-2xl">⚠️</span>
      <div>
        <h4 className="text-red-300 font-semibold text-sm">
          Configuration Error
        </h4>
        <p className="text-red-400 text-xs mt-1">
          Tool ID &quot;{toolId}&quot; not configured. Using default AI.
        </p>
      </div>
    </div>
  </div>
);

const AIReadyNotice = ({ compact, check, deviceType }) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
        <span className="text-green-400 text-xs">
          ✅ {check.recommendedModel.name}
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-green-900/20 border border-green-700 rounded-xl">
      <div className="flex items-start gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <h4 className="text-green-300 font-semibold text-sm">AI Ready</h4>
          <p className="text-green-400 text-xs mt-1">
            {check.recommendedModel.name} loaded for {deviceType} device
          </p>
          <p className="text-green-500/70 text-xs mt-1">
            {check.recommendedModel.reason}
          </p>
        </div>
      </div>
    </div>
  );
};

const AILoadingNotice = ({ progress }) => (
  <div className="p-4 bg-cyan-900/20 border border-cyan-700 rounded-xl">
    <div className="flex items-start gap-3">
      <span className="text-2xl animate-spin">⏳</span>
      <div className="flex-1">
        <h4 className="text-cyan-300 font-semibold text-sm">{progress.text}</h4>
        <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
            style={{ width: `${progress.value}%` }}
          />
        </div>
        <p className="text-cyan-400 text-xs mt-1">{progress.value}%</p>
      </div>
    </div>
  </div>
);

const AILoadFailedNotice = ({ message }) => (
  <p
    role="alert"
    className="mb-3 p-3 rounded-lg border border-red-700 bg-red-900/20 text-red-300 text-xs"
  >
    {message}
  </p>
);

const AILoadPrompt = ({ check, deviceType, onLoad, loadError }) => (
  <div className="p-4 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border-2 border-cyan-700/50 rounded-xl">
    <div className="flex items-start gap-3">
      <span className="text-2xl">🚀</span>
      <div className="flex-1">
        {loadError && <AILoadFailedNotice message={loadError} />}
        <h4 className="text-cyan-300 font-semibold text-sm">
          {check.action === "switch"
            ? "Recommended: Switch Model"
            : "Load AI for This Tool"}
        </h4>
        <p className="text-cyan-400 text-xs mt-1">
          Device: <span className="font-medium capitalize">{deviceType}</span>
        </p>
        <p className="text-cyan-400 text-xs">
          Recommended:{" "}
          <span className="font-medium">{check.recommendedModel.name}</span>
        </p>
        <p className="text-cyan-500/70 text-xs mt-1">
          {check.recommendedModel.reason}
        </p>

        <button
          onClick={onLoad}
          className="mt-3 w-full py-2 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-lg transition-all shadow-lg text-sm"
        >
          {loadError && "Try again"}
          {!loadError &&
            (check.action === "switch"
              ? `🔄 Switch to ${check.recommendedModel.name}`
              : `📥 Load ${check.recommendedModel.name}`)}
        </button>

        {check.action === "switch" && check.currentModel && (
          <p className="text-xs text-gray-400 mt-2">
            Currently: {check.currentModel.split("-")[0]} (will be unloaded
            first)
          </p>
        )}
      </div>
    </div>
  </div>
);

const SmartAILoadButton = ({
  toolId,
  compact = false,
  onLoadComplete = null,
}) => {
  const [check, setCheck] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ value: 0, text: "" });
  const [deviceType, setDeviceType] = useState("");
  const [loadError, setLoadError] = useState(null);

  // Check AI status on mount and periodically
  useEffect(() => {
    const updateStatus = () => {
      setCheck(checkModelMatch(toolId));
      setDeviceType(getDeviceType());
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);
    return () => clearInterval(interval);
  }, [toolId]);

  const handleSmartLoad = async () => {
    setIsLoading(true);
    setLoadError(null);
    setProgress({ value: 0, text: "Starting..." });

    let failure = null;
    const success = await smartLoadAI(toolId, (value, text) => {
      if (value === -1) failure = text;
      setProgress({ value, text });
    });

    setIsLoading(false);

    if (!success) {
      setLoadError(
        failure?.replace(/^Error:\s*/, "") ||
          "Loading the on-device AI did not finish. Choose Try again.",
      );
    }
    if (success) {
      setCheck(checkModelMatch(toolId));
      onLoadComplete?.(check?.recommendedModel);
    }
  };

  if (!check) return null;

  // Safety check: ensure recommendedModel exists
  if (!check.recommendedModel?.name) {
    console.error(
      "❌ SmartAILoadButton: Invalid recommendedModel for tool:",
      toolId,
      check,
    );
    return <ConfigErrorNotice toolId={toolId} />;
  }

  // Already loaded and correct
  if (check.isCorrect && !isLoading) {
    return (
      <AIReadyNotice compact={compact} check={check} deviceType={deviceType} />
    );
  }

  // Loading state
  if (isLoading) {
    return <AILoadingNotice progress={progress} />;
  }

  // Need to load or switch
  return (
    <AILoadPrompt
      check={check}
      deviceType={deviceType}
      onLoad={handleSmartLoad}
      loadError={loadError}
    />
  );
};

export default SmartAILoadButton;
