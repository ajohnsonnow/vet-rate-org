/**
 * Vet-Rate.org - Local AI Provider
 * "The Faraday Cage Protocol" - Run AI completely locally, zero data leaves your device
 *
 * This is the ULTIMATE trust signal for privacy-conscious veterans.
 * Uses WebLLM to run quantized models directly in the browser via WebGPU.
 *
 * Even if you unplug your internet, the AI still works.
 */

import React, { useState, useEffect, useContext, createContext } from "react";
import ResponsiveModal from "./common/ResponsiveModal";
import ToolCardButton from "./ToolCardButton";
import ReportBugLink from "./ReportBugLink";
import GPUSelector from "./GPUSelector";
import ExperimentalModeWarning from "./ExperimentalModeWarning";
import SystemRequirementsNotice from "./SystemRequirementsNotice";
import { gpuManager } from "../utils/WebGPUManager";
import {
  GPU_PREFERENCES,
  checkWebGPUSupport,
  useLocalAIProviderState,
} from "../hooks/useLocalAIProviderState";

// Re-exported for backward compatibility - the underlying WebGPU/engine
// state machinery now lives in useLocalAIProviderState.
export {
  GPU_PREFERENCES,
  getGPUPreference,
  setGPUPreference,
  enumerateGPUs,
} from "../hooks/useLocalAIProviderState";

// Context for Local AI state
const LocalAIContext = createContext(null);

/**
 * useLocalAI hook - Access local AI functionality
 */
export const useLocalAI = () => {
  const context = useContext(LocalAIContext);
  if (!context) {
    throw new Error("useLocalAI must be used within a LocalAIProvider");
  }
  return context;
};

/**
 * LocalAIProvider Component
 * Provides local AI capabilities to the entire app
 */
export const LocalAIProvider = ({ children }) => {
  const value = useLocalAIProviderState();
  return (
    <LocalAIContext.Provider value={value}>{children}</LocalAIContext.Provider>
  );
};

/**
 * A single GPU option card in the "Advanced GPU Selection" list.
 */
const GPUSpecItem = ({ label, value }) => (
  <div className="rounded bg-gray-100 p-2 dark:bg-gray-900/50">
    <p className="text-xs text-gray-600 dark:text-gray-500">{label}</p>
    <p className="text-sm font-semibold text-gray-900 dark:text-white">
      {value}
    </p>
  </div>
);

const GPUDetailCard = ({ gpu, isActive, isDisabled, onSelect }) => (
  <button
    onClick={onSelect}
    disabled={isDisabled}
    className={`rounded-lg border-2 p-4 text-left transition-all ${
      isActive
        ? "border-purple-500 bg-purple-100 shadow-lg shadow-purple-500/20 dark:bg-purple-900/40"
        : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600"
    } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    <div className="space-y-2">
      {/* GPU Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl">
          {gpu.type === "high-performance" ? "🚀" : "🔋"}
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-gray-900 dark:text-white">
              {gpu.label}
            </p>
            {isActive && (
              <span className="rounded-full bg-purple-500 px-2 py-0.5 text-xs font-bold text-white">
                ACTIVE
              </span>
            )}
            {gpu.type === "high-performance" && (
              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-700 dark:bg-cyan-500/30 dark:text-cyan-200">
                Recommended for AI
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-sm text-cyan-700 dark:text-cyan-300">
            {gpu.device}
          </p>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
            {gpu.description}
          </p>
        </div>
      </div>

      {/* GPU Specs */}
      <div className="grid grid-cols-2 gap-2 pl-11">
        <GPUSpecItem label="Vendor" value={gpu.vendor} />
        <GPUSpecItem label="Est. VRAM" value={gpu.vram || "Unknown"} />
        <GPUSpecItem
          label="Architecture"
          value={gpu.architecture || "Unknown"}
        />
        <GPUSpecItem
          label="Max Texture"
          value={gpu.limits?.maxTextureSize || "N/A"}
        />
      </div>

      {/* WebGPU Features Count */}
      {gpu.features && gpu.features.length > 0 && (
        <div className="pl-11">
          <p className="text-xs text-gray-600 dark:text-gray-500">
            WebGPU Features:{" "}
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              {gpu.features.length} supported
            </span>
          </p>
        </div>
      )}
    </div>
  </button>
);

/**
 * A single selectable model card in the "Select Neural Engine" list.
 */
const ModelBadgeRow = ({ model, isInstalled, isCurrentlyLoaded }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span
      className={`font-bold ${model.disabled ? "text-gray-500 line-through" : "text-gray-900 dark:text-white"}`}
    >
      {model.name}
    </span>
    {model.disabled && (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-500/30 dark:text-red-300">
        DISABLED
      </span>
    )}
    {model.bestFor && !model.disabled && (
      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-500/30 dark:text-violet-300">
        {model.bestFor}
      </span>
    )}
    {model.recommended && !model.disabled && (
      <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs text-cyan-700 dark:bg-cyan-500/30 dark:text-cyan-300">
        RECOMMENDED
      </span>
    )}
    {isInstalled && !model.disabled && (
      <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-500/30 dark:text-green-300">
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M5 13l4 4L19 7"
          />
        </svg>
        INSTALLED
      </span>
    )}
    {isCurrentlyLoaded && !model.disabled && (
      <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/30 dark:text-blue-300">
        <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
        ACTIVE
      </span>
    )}
  </div>
);

const ModelBaseModelInfo = ({ model }) => {
  if (!model.baseModel || model.disabled) return null;
  return (
    <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700/50">
      <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400/80">
        <span>🔬</span>
        <span className="font-medium">Based on:</span>
        <span className="text-amber-700 dark:text-amber-300">
          {model.baseModel}
        </span>
      </p>
      {model.baseModelInfo && (
        <p className="ml-4 mt-0.5 text-xs text-gray-600 dark:text-gray-500">
          {model.baseModelInfo}
        </p>
      )}
      {model.trainingFocus && (
        <p className="ml-4 mt-0.5 text-xs text-emerald-600 dark:text-emerald-400/70">
          🎯 Specialized for: {model.trainingFocus}
        </p>
      )}
    </div>
  );
};

const ModelSelectionIndicator = ({ isSelected, className }) => (
  <div
    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3 ${className}`}
  >
    {isSelected && (
      <svg
        className="w-4 h-4 text-white"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          d="M5 13l4 4L19 7"
        />
      </svg>
    )}
  </div>
);

const ModelSelectCard = ({
  model,
  isInstalled,
  isCurrentlyLoaded,
  isSelected,
  isLoading,
  onSelect,
}) => {
  const isDisabled = model.disabled || isLoading;

  let modelCardClassName;
  if (model.disabled) {
    modelCardClassName =
      "cursor-not-allowed border-gray-200 bg-gray-100 opacity-60 dark:border-gray-800 dark:bg-gray-900/30";
  } else if (isSelected) {
    modelCardClassName = "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30";
  } else {
    modelCardClassName =
      "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600";
  }

  let radioIndicatorClassName;
  if (model.disabled) {
    radioIndicatorClassName =
      "border-gray-300 bg-gray-200 dark:border-gray-700 dark:bg-gray-800";
  } else if (isSelected) {
    radioIndicatorClassName = "border-cyan-500 bg-cyan-500";
  } else {
    radioIndicatorClassName = "border-gray-400 dark:border-gray-600";
  }

  return (
    <button
      onClick={() => !model.disabled && onSelect()}
      disabled={isDisabled}
      className={`rounded-xl border-2 p-4 text-left transition-all ${modelCardClassName} ${isLoading && !model.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <ModelBadgeRow
            model={model}
            isInstalled={isInstalled}
            isCurrentlyLoaded={isCurrentlyLoaded}
          />
          <p
            className={`text-sm mt-1 ${model.disabled ? "text-gray-500 dark:text-gray-600" : "text-gray-600 dark:text-gray-400"}`}
          >
            {model.description}
          </p>
          {model.contextInfo && (
            <p
              className={`text-xs mt-1 italic ${model.disabled ? "font-medium text-orange-600 dark:text-orange-400/80" : "text-cyan-700 dark:text-cyan-400/80"}`}
            >
              💡 {model.contextInfo}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-500">
            Size: {model.size} • VRAM: {model.vramRequired}
          </p>
          {/* Base Model Transparency - show veterans what powers their AI */}
          <ModelBaseModelInfo model={model} />
        </div>
        <ModelSelectionIndicator
          isSelected={isSelected}
          className={radioIndicatorClassName}
        />
      </div>
    </button>
  );
};

/**
 * Label content for the Initialize/Switch model button - shows a spinner
 * while loading, otherwise the "ready" or "needs download" label.
 */
const ModelLoadButtonLabel = ({
  isLoading,
  loadProgress,
  isInstalled,
  readyLabel,
  downloadLabel,
}) => {
  if (isLoading) {
    return (
      <>
        <span className="animate-spin mr-2">⏳</span> {loadProgress.text}
      </>
    );
  }
  return isInstalled ? readyLabel : downloadLabel;
};

/**
 * Modal header: title/subtitle, VA GPT badge, report-bug link, close button.
 */
const LocalAIPanelHeader = ({ onClose, onReportBug }) => (
  <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600 px-6 py-6 text-white">
    <div className="absolute right-0 top-0 h-32 w-32 -translate-y-16 translate-x-16 rounded-full bg-white/10" />
    <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/5" />

    <div className="relative flex items-start justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <span className="text-4xl">🛡️</span>
        </div>
        <div>
          <h2
            id="local-ai-panel-title"
            className="text-2xl font-bold sm:text-3xl"
          >
            Faraday Cage Protocol{" "}
            <span className="rounded bg-amber-500 px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">
              BETA
            </span>
          </h2>
          <p className="mt-1 text-cyan-200">
            100% Local AI • Zero Data Leaves Your Device
          </p>
          <div className="mt-2">
            <span
              className="rounded-full bg-blue-500/90 px-2 py-0.5 text-xs font-semibold text-white"
              aria-label="VA employees use VA GPT, a secure AI tool"
            >
              ℹ️ VA Staff Use VA GPT (100K+ Users)
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onReportBug && (
          <ReportBugLink
            onClick={onReportBug}
            variant="light"
            moduleName="VA AI Transparency Hub"
          />
        )}
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Close dialog"
        >
          <svg
            className="h-6 w-6"
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
      </div>
    </div>
  </div>
);

/**
 * WebGPU support banner, plus (when supported) the simple GPU selector.
 */
const WebGPUStatusSection = ({ webGPUStatus, onGPUSelected }) => (
  <>
    <div
      className={`rounded-xl border-2 p-4 ${
        webGPUStatus.supported
          ? "border-green-300 bg-green-50 dark:border-green-500/50 dark:bg-green-900/30"
          : "border-red-300 bg-red-50 dark:border-red-500/50 dark:bg-red-900/30"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{webGPUStatus.supported ? "✅" : "❌"}</span>
        <div className="flex-1">
          <h3
            className={`font-bold ${
              webGPUStatus.supported
                ? "text-green-700 dark:text-green-400"
                : "text-red-700 dark:text-red-400"
            }`}
          >
            {webGPUStatus.supported
              ? "WebGPU Available"
              : "WebGPU Not Available"}
          </h3>
          {webGPUStatus.supported ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              🎮 Using: {webGPUStatus.device} ({webGPUStatus.vendor})
            </p>
          ) : (
            <p className="text-sm text-red-600 dark:text-red-400/80">
              {webGPUStatus.reason ||
                "Your browser or device does not support WebGPU"}
            </p>
          )}
        </div>
      </div>
    </div>

    {/* GPU Selector Component - Show when WebGPU is supported */}
    {webGPUStatus.supported && (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎮</span>
          <h3 className="font-bold text-cyan-700 dark:text-cyan-300">
            GPU Selection
          </h3>
          <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs text-cyan-700 dark:bg-cyan-500/30 dark:text-cyan-200">
            {webGPUStatus.availableGPUs?.length || 1} GPU
            {(webGPUStatus.availableGPUs?.length || 1) > 1 ? "s" : ""} Available
          </span>
        </div>
        <GPUSelector onGPUSelected={onGPUSelected} autoSelect={false} />
      </div>
    )}
  </>
);

/**
 * Experimental WebGPU features toggle - currently disabled (see the
 * `{false && ...}` gate at its call site); kept intact for when it's
 * re-enabled rather than deleted.
 */
/**
 * The "accept the risks" warning shown when the user tries to enable
 * experimental WebGPU mode - detected feature list plus enable/cancel.
 */
const DetectedFeaturesList = ({ webGPUStatus }) => (
  <div className="bg-gray-900/50 rounded p-3">
    <p className="text-xs font-bold text-cyan-400 mb-2">
      🔍 Detected Features:
    </p>
    <div className="space-y-1 text-xs">
      {webGPUStatus.availableFeatures?.length > 0 ? (
        <>
          {webGPUStatus.availableFeatures.map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <code className="text-gray-300">{feature}</code>
            </div>
          ))}
        </>
      ) : (
        <p className="text-gray-500">No experimental features detected</p>
      )}
      {webGPUStatus.missingFeatures?.length > 0 && (
        <>
          <p className="text-xs text-red-400 mt-2 font-semibold">
            Missing Features:
          </p>
          {webGPUStatus.missingFeatures.map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <span className="text-red-400">✗</span>
              <code className="text-gray-400">{feature}</code>
            </div>
          ))}
        </>
      )}
    </div>
  </div>
);

const ExperimentalWarningPanel = ({ webGPUStatus, onEnable, onCancel }) => (
  <div className="bg-red-900/30 border-2 border-red-500/50 rounded-lg p-4 space-y-3">
    <div className="flex items-start gap-2">
      <span className="text-xl">🚨</span>
      <div className="flex-1">
        <h4 className="font-bold text-red-400 text-sm">IMPORTANT WARNINGS</h4>
        <ul className="text-xs text-gray-300 mt-2 space-y-1 list-disc list-inside">
          <li>
            This enables <strong>experimental browser features</strong> not yet
            standardized
          </li>
          <li>
            May cause{" "}
            <strong>browser crashes, GPU errors, or system instability</strong>
          </li>
          <li>
            Requires launching Chrome with special flags (see instructions
            below)
          </li>
          <li>
            <strong>Not recommended for production use</strong> - for testing
            only
          </li>
          <li>
            Your browser may not support these features even with flags enabled
          </li>
        </ul>
      </div>
    </div>

    {/* Instructions */}
    <div className="bg-gray-900/50 rounded p-3 space-y-2">
      <p className="text-xs font-bold text-amber-400">
        📋 How to Enable (Windows):
      </p>
      <div className="bg-gray-950 rounded p-2">
        <code className="text-xs text-green-400 break-all">
          chrome.exe --enable-dawn-features=allow_unsafe_apis
        </code>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        1. Close ALL Chrome windows
        <br />
        2. Open Command Prompt or PowerShell
        <br />
        3. Run the command above (adjust path to Chrome if needed)
        <br />
        4. Check if experimental features are detected below
      </p>
    </div>

    {/* Feature Detection Status */}
    <DetectedFeaturesList webGPUStatus={webGPUStatus} />

    {/* Action Buttons */}
    <div className="flex gap-2">
      <button
        onClick={onEnable}
        className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm transition-colors"
      >
        I Accept the Risks - Enable Now
      </button>
      <button
        onClick={onCancel}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium text-sm transition-colors"
      >
        Cancel
      </button>
    </div>
  </div>
);

const ExperimentalModeActiveNotice = () => (
  <div className="bg-amber-900/30 rounded-lg p-3">
    <div className="flex items-center gap-2">
      <span className="text-lg">⚡</span>
      <div className="flex-1">
        <p className="text-xs font-bold text-amber-400">
          Experimental Mode Active
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          The AI will attempt to use experimental WebGPU features if available.
          If you encounter errors, disable this option.
        </p>
      </div>
    </div>
  </div>
);

const ExperimentalFeaturesSection = ({
  experimentalMode,
  showExperimentalWarning,
  setShowExperimentalWarning,
  setExperimentalMode,
  webGPUStatus,
}) => (
  <div className="p-4 rounded-xl border-2 bg-amber-900/20 border-amber-500/50">
    <div className="flex items-start gap-3">
      <span className="text-2xl">⚠️</span>
      <div className="flex-1 space-y-3">
        <div>
          <h3 className="font-bold text-amber-400 flex items-center gap-2">
            Experimental WebGPU Mode
            <span className="text-xs px-2 py-0.5 bg-amber-500/30 text-amber-200 rounded-full">
              Advanced
            </span>
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            Enable experimental shader features for newer AI models (may be
            unstable)
          </p>
        </div>

        {/* Checkbox */}
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={experimentalMode}
            onChange={(e) => {
              if (e.target.checked && !showExperimentalWarning) {
                setShowExperimentalWarning(true);
              } else if (!e.target.checked) {
                setExperimentalMode(false);
                localStorage.setItem("vet_rate_experimental_webgpu", "false");
              }
            }}
            className="mt-1 w-5 h-5 rounded border-2 border-amber-500 bg-gray-800 text-amber-500 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          />
          <div className="flex-1">
            <span className="text-white font-medium group-hover:text-amber-400 transition-colors">
              I understand the risks and want to enable experimental features
            </span>
            <p className="text-xs text-gray-500 mt-1">
              This attempts to use experimental WebGPU APIs that may not be
              available in your browser
            </p>
          </div>
        </label>

        {/* Warning Panel - Shows when trying to enable */}
        {showExperimentalWarning && (
          <ExperimentalWarningPanel
            webGPUStatus={webGPUStatus}
            onEnable={() => {
              setExperimentalMode(true);
              localStorage.setItem("vet_rate_experimental_webgpu", "true");
              setShowExperimentalWarning(false);
            }}
            onCancel={() => setShowExperimentalWarning(false)}
          />
        )}

        {/* Status when enabled */}
        {experimentalMode && !showExperimentalWarning && (
          <ExperimentalModeActiveNotice />
        )}
      </div>
    </div>
  </div>
);

/**
 * "Advanced GPU Selection" panel - shown only when multiple GPUs are
 * detected. Auto option plus a detail card per GPU, technical details,
 * and a "switching" spinner / reload-needed notice.
 */
/**
 * Collapsible per-GPU technical details ("Show Technical Details") shown
 * inside AdvancedGPUSelectionPanel.
 */
const GPUTechnicalDetails = ({ gpus }) => (
  <details className="mt-3">
    <summary className="cursor-pointer select-none text-xs text-gray-600 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400">
      🤓 Show Technical Details
    </summary>
    <div className="mt-2 space-y-2 font-mono text-xs">
      {gpus.map((gpu) => (
        <div
          key={gpu.type}
          className="rounded border border-gray-200 bg-gray-100 p-2 dark:border-gray-800 dark:bg-gray-900/50"
        >
          <p className="mb-1 font-bold text-purple-600 dark:text-purple-400">
            {gpu.device}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Max Buffer: {gpu.limits?.maxBufferSize}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Max Workgroup Size: {gpu.limits?.maxComputeWorkgroupSizeX}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Max Workgroups: {gpu.limits?.maxComputeWorkgroupsPerDimension}
          </p>
          {gpu.features && gpu.features.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-gray-600 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400">
                Features ({gpu.features.length})
              </summary>
              <div className="mt-1 pl-2 text-gray-600 dark:text-gray-500">
                {gpu.features.slice(0, 10).map((feat, i) => (
                  <div key={i}>• {feat}</div>
                ))}
                {gpu.features.length > 10 && (
                  <div>• ... and {gpu.features.length - 10} more</div>
                )}
              </div>
            </details>
          )}
        </div>
      ))}
    </div>
  </details>
);

const AutoGPUOptionButton = ({ isActive, isDisabled, onSelect }) => (
  <button
    onClick={onSelect}
    disabled={isDisabled}
    className={`rounded-lg border-2 p-4 text-left transition-all ${
      isActive
        ? "border-purple-500 bg-purple-100 shadow-lg shadow-purple-500/20 dark:bg-purple-900/40"
        : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600"
    } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    <div className="flex items-center gap-3">
      <span className="text-2xl">🤖</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-bold text-gray-900 dark:text-white">
            Auto (Recommended)
          </p>
          {isActive && (
            <span className="rounded-full bg-purple-500 px-2 py-0.5 text-xs font-bold text-white">
              ACTIVE
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Let the browser choose based on power state and workload
        </p>
      </div>
    </div>
  </button>
);

const AdvancedGPUSelectionPanel = ({
  webGPUStatus,
  gpuPreference,
  isChangingGPU,
  isLoading,
  isReady,
  onSelectGPU,
}) => (
  <div className="rounded-xl border-2 border-purple-300 bg-purple-50 p-4 dark:border-purple-500/50 dark:bg-purple-900/20">
    <div className="mb-3 flex items-center gap-2">
      <span className="text-xl">🎮</span>
      <h3 className="font-bold text-purple-700 dark:text-purple-300">
        Advanced GPU Selection
      </h3>
      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-500/30 dark:text-purple-200">
        {webGPUStatus.availableGPUs?.length || 2} GPUs Detected
      </span>
      <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs text-cyan-700 dark:bg-cyan-500/30 dark:text-cyan-200">
        🤓 Nerd Mode
      </span>
    </div>
    <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
      Multiple GPUs detected on your system. Select which GPU to use for AI
      processing:
    </p>
    <div className="grid gap-3">
      {/* Auto Option */}
      <AutoGPUOptionButton
        isActive={gpuPreference === GPU_PREFERENCES.AUTO}
        isDisabled={isChangingGPU || isLoading}
        onSelect={() => onSelectGPU(GPU_PREFERENCES.AUTO)}
      />

      {/* Available GPUs with Detailed Specs */}
      {webGPUStatus.availableGPUs?.map((gpu) => (
        <GPUDetailCard
          key={gpu.type}
          gpu={gpu}
          isActive={gpuPreference === gpu.type}
          isDisabled={isChangingGPU || isLoading}
          onSelect={() => onSelectGPU(gpu.type)}
        />
      ))}
    </div>

    {/* Detailed Info for Nerds */}
    {webGPUStatus.availableGPUs && webGPUStatus.availableGPUs.length > 0 && (
      <GPUTechnicalDetails gpus={webGPUStatus.availableGPUs} />
    )}

    {isChangingGPU && (
      <div className="mt-3 flex items-center gap-2 text-sm text-purple-600 dark:text-purple-300">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        Switching GPU...
      </div>
    )}

    {isReady && gpuPreference !== webGPUStatus.currentPreference && (
      <div className="mt-3 rounded-lg border border-yellow-300 bg-yellow-50 p-2 dark:border-yellow-500/50 dark:bg-yellow-900/30">
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          ⚠️ GPU preference changed. Unload and reload the AI model to use the
          new GPU.
        </p>
      </div>
    )}
  </div>
);

/**
 * Info box plus the "Select Neural Engine" model grid.
 */
const ModelSelectionSection = ({
  availableModels,
  selectedModel,
  setSelectedModel,
  installedModels,
  loadedModelId,
  isLoading,
}) => (
  <>
    {/* Helpful Info Box */}
    <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-900/20">
      <div className="flex items-start gap-3">
        <span className="text-2xl">💡</span>
        <div className="flex-1">
          <h4 className="mb-2 font-bold text-blue-700 dark:text-blue-300">
            Choosing Your AI Model
          </h4>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p>
              <strong>For most veterans:</strong> The recommended model works
              great for typical tasks.
            </p>
            <p>
              <strong>Large medical records:</strong> Don&apos;t worry! All
              models can handle large Blue Button files. The system
              automatically breaks them into smaller sections if needed.
            </p>
            <p>
              <strong>Need faster results?</strong> Try a smaller model.{" "}
              <strong>Need better quality?</strong> Try a larger one.
            </p>
          </div>
        </div>
      </div>
    </div>
    {/* Model Selection */}
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
        <span>🧠</span> Select Neural Engine
      </h3>
      <div className="grid gap-3">
        {availableModels.map((model) => (
          <ModelSelectCard
            key={model.id}
            model={model}
            isInstalled={installedModels.has(model.id)}
            isCurrentlyLoaded={loadedModelId === model.id}
            isSelected={selectedModel.id === model.id}
            isLoading={isLoading}
            onSelect={() => setSelectedModel(model)}
          />
        ))}
      </div>
    </div>
  </>
);

/**
 * Generate contextual Luna message based on loaded AI model.
 */
const getLunaTestMessage = (loadedModelId, selectedModel) => {
  // Diamond Swarm agents get special messages
  if (loadedModelId?.includes("diamond") || selectedModel?.isDiamond) {
    const agentMessages = {
      "diamond-auditor":
        "*Meow!* 🎖️ Testing the CW5 Auditor! This one's trained to sniff out claim issues like I sniff out treats! Watch it analyze those VA regulations! 😸",
      "diamond-writer":
        "*Purrrr* 🎖️ CW4 Writer test time! This fuzzy brain helper writes statements better than I write on keyboards (which is pretty good, actually). 📝😺",
      "diamond-rater":
        "*Mrrrow!* 🎖️ Testing CW3 Rater! It calculates ratings faster than I calculate my treat schedule. Math whiskers activated! 🧮😸",
    };
    return (
      agentMessages[loadedModelId] ||
      "*Meow!* 🎖️ Testing our Warrant Council AI! These veteran-trained models are purr-fectly tuned for VA claims! 😸✨"
    );
  }

  // Generic local AI message
  return "*Meow!* 🧠 Testing your local Neural Engine! All this AI magic happens right on YOUR device - no data leaves your computer. Luna approves of this privacy! *purrrr* 🛡️😸";
};

/**
 * Generate Luna's completion celebration message.
 */
const getLunaCompletionMessage = (loadedModelId, selectedModel) => {
  // Diamond Swarm agents get special completion messages
  if (loadedModelId?.includes("diamond") || selectedModel?.isDiamond) {
    const completionMessages = {
      "diamond-auditor":
        "*Purrrrr!* 🎖️✨ Knowledge test complete! The CW5 Auditor nailed it! This AI knows VA regulations better than most VSOs. Your claims just got a whole lot stronger! 😸🎉",
      "diamond-writer":
        "*Mrrrrrow!* 🎖️✨ Test passed with flying whiskers! CW4 Writer's ready to craft those statements! Watch those nexus letters practically write themselves! 📝😺",
      "diamond-rater":
        "*Meow meow!* 🎖️✨ Knowledge test SUCCESS! CW3 Rater's math whiskers are on point! It knows the combined ratings formula like I know my treat jar location! 🧮😸🎊",
    };
    return (
      completionMessages[loadedModelId] ||
      "*PURRRR!* 🎖️✨ Knowledge test PASSED! Your Warrant Council AI is veteran-ready! Time to put this knowledge to work on your claim! 😸🚀"
    );
  }

  // Generic local AI completion message
  return "*Happy meow!* 🎉 Knowledge test complete! Your local AI passed with flying colors! All that power running right on YOUR device - no cloud needed! Luna is SO proud! *purrrr* 🛡️😸✨";
};

/**
 * The "Neural Engine Active" panel: AI knowledge test, Luna's contextual
 * messages, the test prompt/generate/stop controls, and the response
 * display. Owns all state for this self-contained test console.
 */
/**
 * Runs the knowledge-test prompt against the local server (if available)
 * or the Diamond Swarm agent directly. Extracted from
 * ReadyStateConsole's handleTestGenerate.
 */
const runKnowledgeTestGeneration = async (testPrompt, signal, onStream) => {
  const { generateWithSwarm } = await import("../utils/diamondSwarm");
  const { isLocalServerAvailable, generateText } =
    await import("../utils/unifiedAIService");

  if (signal.aborted) throw new Error("Aborted");

  if (isLocalServerAvailable()) {
    return await generateText(testPrompt, {
      mode: "local-server",
      taskType: "general",
      signal,
      onStream,
    });
  }

  const result = await generateWithSwarm(testPrompt, {
    agentId: "auditor",
    signal,
    onStream,
  });
  return result?.text || result || "";
};

/**
 * Shows a Luna message and auto-dismisses it after 8 seconds, clearing
 * any previously scheduled dismissal first.
 */
const showLunaMessageWithAutoDismiss = (
  message,
  lunaTimerRef,
  setLunaTestMessage,
) => {
  setLunaTestMessage(message);
  if (lunaTimerRef.current) clearTimeout(lunaTimerRef.current);
  lunaTimerRef.current = setTimeout(() => {
    setLunaTestMessage(null);
  }, 8000);
};

/**
 * Runs the knowledge-test generation and applies its result (response text,
 * Luna's completion message, or error) to state. Extracted from
 * useTestConsoleState's handleTestGenerate.
 */
const executeKnowledgeTest = async (
  testPrompt,
  { loadedModelId, selectedModel, lunaDisabled },
  {
    setStreamedResponse,
    setTestResponse,
    setIsTestGenerating,
    lunaTimerRef,
    setLunaTestMessage,
  },
  signal,
) => {
  try {
    const responseText = await runKnowledgeTestGeneration(
      testPrompt,
      signal,
      (delta, full) => {
        if (!signal.aborted && full) setStreamedResponse(full);
      },
    );

    if (!signal.aborted) {
      setStreamedResponse("");
      setTestResponse(responseText || "AI response completed.");

      if (!lunaDisabled) {
        showLunaMessageWithAutoDismiss(
          getLunaCompletionMessage(loadedModelId, selectedModel),
          lunaTimerRef,
          setLunaTestMessage,
        );
      }
    }
  } catch (err) {
    if (err.name === "AbortError" || err.message === "Aborted") {
      // User stopped - already handled in handleStopTest
      return;
    }
    console.error("Test Generate Error:", err);
    setStreamedResponse("");
    setTestResponse(`Error: ${err.message}`);
  } finally {
    setIsTestGenerating(false);
  }
};

const AIKnowledgeTestCard = ({ onFillPrompt }) => (
  <div className="mb-4 rounded-lg border border-cyan-300 bg-cyan-50 p-4 dark:border-cyan-700/50 dark:bg-cyan-900/20">
    <div className="flex items-start gap-3 mb-3">
      <span className="text-2xl">🧪</span>
      <div>
        <h4 className="text-sm font-bold text-cyan-700 dark:text-cyan-300">
          AI Knowledge Test
        </h4>
        <p className="mt-1 text-xs text-cyan-700 dark:text-cyan-400/80">
          Test if the AI knows about Vet-Rate.org&apos;s tools and 38 CFR
          regulations
        </p>
      </div>
    </div>
    <button
      onClick={onFillPrompt}
      className="w-full rounded-lg border border-cyan-300 bg-cyan-100 px-4 py-2 text-sm font-medium text-cyan-700 transition-colors hover:bg-cyan-200 dark:border-cyan-500/50 dark:bg-cyan-600/30 dark:text-cyan-300 dark:hover:bg-cyan-600/50"
    >
      Run Knowledge Test ⚡
    </button>
  </div>
);

const LunaTestBubble = ({ message, onDismiss, onDisableForever }) => (
  <div className="animate-luna-bounce-in mb-4 rounded-lg border border-purple-300 bg-purple-50 p-4 dark:border-purple-500/40 dark:bg-gradient-to-r dark:from-purple-900/30 dark:via-pink-900/20 dark:to-purple-900/30">
    <div className="flex items-start gap-3">
      <span className="text-2xl flex-shrink-0">😸</span>
      <div className="flex-1">
        <p className="text-sm italic text-purple-800 dark:text-purple-200">
          {message}
        </p>
        <p className="mt-2 text-xs text-purple-600 dark:text-purple-400/60">
          - Luna, Chief Treat Officer 🐾
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onDismiss}
          className="text-purple-600 transition-colors hover:text-purple-700 dark:text-purple-400/60 dark:hover:text-purple-300"
          aria-label="Dismiss Luna's message"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <button
          onClick={onDisableForever}
          className="rounded border border-purple-300 px-2 py-1 text-xs text-purple-600 transition-colors hover:border-purple-400 hover:text-purple-700 dark:border-purple-500/30 dark:text-purple-400/60 dark:hover:border-purple-400/50 dark:hover:text-purple-300"
          aria-label="Don't show Luna messages again"
        >
          🚫
        </button>
      </div>
    </div>
  </div>
);

const TestGenerateControls = ({
  testPrompt,
  setTestPrompt,
  isTestGenerating,
  isGenerating,
  onGenerate,
  onStop,
}) => (
  <div className="space-y-3">
    <textarea
      value={testPrompt}
      onChange={(e) => setTestPrompt(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (testPrompt.trim() && !isGenerating) {
            onGenerate();
          }
        }
      }}
      placeholder="Test the local AI... e.g., 'What evidence do I need for a PTSD claim?' (Press Enter to generate, Shift+Enter for new line)"
      className="w-full resize-none rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
      rows={3}
    />
    <div className="flex gap-2">
      {!isTestGenerating && !isGenerating ? (
        <button
          onClick={onGenerate}
          disabled={!testPrompt.trim()}
          className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <span>⚡</span>
          Generate (100% Local)
        </button>
      ) : (
        <button
          onClick={onStop}
          className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <rect x="6" y="6" width="12" height="12" strokeWidth="2" />
          </svg>
          Stop
        </button>
      )}
    </div>
    {(isTestGenerating || isGenerating) && (
      <div className="flex items-center justify-center gap-2 text-sm text-cyan-600 dark:text-cyan-400">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>Generating response...</span>
      </div>
    )}
  </div>
);

const TestResponseDisplay = ({
  isTestGenerating,
  streamedResponse,
  testResponse,
}) => (
  <div
    className="mt-4 rounded-lg bg-gray-100 p-4 dark:bg-gray-800/50"
    aria-live="polite"
    aria-atomic="false"
  >
    <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
      {isTestGenerating && !streamedResponse && !testResponse
        ? "⏳ Processing..."
        : "Response:"}
    </p>
    <p className="whitespace-pre-wrap text-gray-900 dark:text-white">
      {streamedResponse ||
        testResponse ||
        (isTestGenerating ? "Waiting for AI response..." : "")}
    </p>
  </div>
);

/**
 * Owns all state/effects/handlers for the knowledge-test console: the test
 * prompt, response streaming, Luna's messages, and abort/stop wiring.
 * Extracted from ReadyStateConsole into its own hook so that component
 * stays focused on rendering.
 */
const useTestConsoleState = (loadedModelId, selectedModel, isLoading) => {
  const [testPrompt, setTestPrompt] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [streamedResponse, setStreamedResponse] = useState("");
  const [isTestGenerating, setIsTestGenerating] = useState(false);
  const [lunaTestMessage, setLunaTestMessage] = useState(null);
  const [lunaDisabled, setLunaDisabled] = useState(() => {
    return localStorage.getItem("luna_messages_disabled") === "true";
  });
  const testAbortRef = React.useRef(null);
  const lunaTimerRef = React.useRef(null);

  // Stop test generation
  const handleStopTest = () => {
    if (testAbortRef.current) {
      testAbortRef.current.abort();
      testAbortRef.current = null;
    }
    setIsTestGenerating(false);
    if (streamedResponse) {
      setTestResponse(streamedResponse + "\n\n[Generation stopped]");
    }
    setStreamedResponse("");
  };

  const resetTestState = () => {
    setTestPrompt("");
    setTestResponse("");
    setStreamedResponse("");
  };

  // Clear test prompt and responses when model changes or starts loading
  useEffect(resetTestState, [loadedModelId]);

  // Also clear when a new model starts loading
  useEffect(() => {
    if (isLoading) resetTestState();
  }, [isLoading]);

  // Cleanup Luna timer on unmount
  useEffect(() => {
    return () => {
      if (lunaTimerRef.current) {
        // lunaTimerRef holds a setTimeout id (not a DOM node), so reading
        // its latest .current value at cleanup time is intentional here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        clearTimeout(lunaTimerRef.current);
      }
    };
  }, []);

  // Handle test generation - Direct call to Diamond Swarm for reliability
  const handleTestGenerate = async () => {
    if (!testPrompt.trim()) return;

    // Create abort controller for this generation
    testAbortRef.current = new AbortController();
    const signal = testAbortRef.current.signal;

    setIsTestGenerating(true);
    setStreamedResponse("");
    setTestResponse("");

    // Show Luna's contextual message for the loaded AI (if not disabled)
    if (!lunaDisabled) {
      showLunaMessageWithAutoDismiss(
        getLunaTestMessage(loadedModelId, selectedModel),
        lunaTimerRef,
        setLunaTestMessage,
      );
    }

    await executeKnowledgeTest(
      testPrompt,
      { loadedModelId, selectedModel, lunaDisabled },
      {
        setStreamedResponse,
        setTestResponse,
        setIsTestGenerating,
        lunaTimerRef,
        setLunaTestMessage,
      },
      signal,
    );
  };

  return {
    testPrompt,
    setTestPrompt,
    testResponse,
    streamedResponse,
    isTestGenerating,
    lunaTestMessage,
    setLunaTestMessage,
    lunaDisabled,
    setLunaDisabled,
    lunaTimerRef,
    handleStopTest,
    handleTestGenerate,
  };
};

const ReadyStateConsole = ({
  loadedModelId,
  selectedModel,
  isLoading,
  isGenerating,
  interruptGeneration,
}) => {
  const {
    testPrompt,
    setTestPrompt,
    testResponse,
    streamedResponse,
    isTestGenerating,
    lunaTestMessage,
    setLunaTestMessage,
    lunaDisabled,
    setLunaDisabled,
    lunaTimerRef,
    handleStopTest,
    handleTestGenerate,
  } = useTestConsoleState(loadedModelId, selectedModel, isLoading);

  return (
    <div className="rounded-xl border-2 border-green-500 bg-green-50 p-6 dark:bg-green-900/30">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl animate-pulse">🟢</span>
        <div>
          <h3 className="text-xl font-bold text-green-700 dark:text-green-400">
            Neural Engine Active
          </h3>
          <p className="text-sm text-green-700 dark:text-green-300/80">
            All AI processing happens locally. You can disconnect from the
            internet now.
          </p>
        </div>
      </div>

      <AIKnowledgeTestCard
        onFillPrompt={() =>
          setTestPrompt(
            "What do you know about eCFR and Vet-Rate.org functions? Please list the tools available and explain key VA disability regulations.",
          )
        }
      />

      {/* Luna's Test Message - Shows contextual message for loaded AI */}
      {lunaTestMessage && !lunaDisabled && (
        <LunaTestBubble
          message={lunaTestMessage}
          onDismiss={() => {
            if (lunaTimerRef.current) clearTimeout(lunaTimerRef.current);
            setLunaTestMessage(null);
          }}
          onDisableForever={() => {
            if (lunaTimerRef.current) clearTimeout(lunaTimerRef.current);
            localStorage.setItem("luna_messages_disabled", "true");
            setLunaDisabled(true);
            setLunaTestMessage(null);
          }}
        />
      )}

      <TestGenerateControls
        testPrompt={testPrompt}
        setTestPrompt={setTestPrompt}
        isTestGenerating={isTestGenerating}
        isGenerating={isGenerating}
        onGenerate={handleTestGenerate}
        onStop={isTestGenerating ? handleStopTest : interruptGeneration}
      />

      {/* Response - Always show when generating or has content */}
      {(isTestGenerating || streamedResponse || testResponse) && (
        <TestResponseDisplay
          isTestGenerating={isTestGenerating}
          streamedResponse={streamedResponse}
          testResponse={testResponse}
        />
      )}
    </div>
  );
};

/**
 * Error banner shown when engine init/generation fails, plus a "use the
 * Vision Simulator instead" alternative for the beta-experimental vision
 * model case.
 */
const LocalAIErrorState = ({ error, selectedModel, setError }) => (
  <div
    className="rounded-xl border-2 border-red-500 bg-red-50 p-4 dark:bg-red-900/30"
    role="alert"
    aria-live="polite"
  >
    <p className="whitespace-pre-wrap text-red-700 dark:text-red-400">
      <strong>Error:</strong> {error}
    </p>

    {/* Vision model alternative - show Vision Simulator option */}
    {selectedModel?.disabledReason === "beta-experimental" &&
      selectedModel?.hasVision && (
        <div className="mt-4 border-t border-red-300 pt-4 dark:border-red-500/30">
          <p className="mb-2 font-semibold text-green-700 dark:text-green-400">
            🎉 Good News: We Have a Working Alternative!
          </p>
          <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
            Use our <strong>Vision Simulator</strong> - it combines OCR (text
            extraction) with AI analysis to give you ~80% of vision model
            functionality for documents like DD214s, medical records, and VA
            forms.
          </p>
          <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
            ✅ Works in ALL browsers | ✅ No special flags needed | ✅ 100%
            private
          </p>
          <button
            onClick={() => {
              // Store that user wants vision simulator
              localStorage.setItem("vet_rate_show_vision_simulator", "true");
              // Dispatch event for Navigator/AIAssistant to pick up
              window.dispatchEvent(new CustomEvent("openVisionSimulator"));
              setError(null);
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            Open Vision Simulator
          </button>
        </div>
      )}
  </div>
);

/**
 * LocalAIPanel Component
 * UI for managing and using local AI
 */
/**
 * GPU preference / adapter selection handlers, extracted from LocalAIPanel
 * so the component body stays focused on rendering. Shared by the simple
 * GPUSelector (handleGPUSelected) and the advanced dual-GPU panel
 * (handleGPUChange), which is why isChangingGPU is a single shared state.
 */
const useGPUSelectionHandlers = ({
  updateGPUPreference,
  isReady,
  loadedModelId,
  selectedModel,
  switchModel,
  setWebGPUStatus,
}) => {
  const [isChangingGPU, setIsChangingGPU] = useState(false);

  const handleGPUChange = async (newPreference) => {
    setIsChangingGPU(true);
    try {
      await updateGPUPreference(newPreference);

      // If an AI model is loaded, warn user they may need to reload
      if (isReady) {
        // The user will need to reload the model to use the new GPU
        // eslint-disable-next-line no-console
        console.log(
          "⚠️ GPU changed - model may need to be reloaded to use new GPU",
        );
      }
    } finally {
      setIsChangingGPU(false);
    }
  };

  const handleGPUSelected = async (adapterId) => {
    // Get currently selected adapter to check if it's the same
    const currentAdapter = gpuManager.getSelectedAdapter();
    const targetAdapter = gpuManager
      .getAdapters()
      .find((a) => a.id === adapterId);

    if (!targetAdapter) {
      console.error("❌ Selected GPU not found");
      return;
    }

    // If same adapter, just log and return (no error, no UI change needed)
    if (currentAdapter === targetAdapter.adapter) {
      // eslint-disable-next-line no-console
      console.log("✅ GPU already selected:", targetAdapter.info.displayName);
      return;
    }

    setIsChangingGPU(true);
    try {
      // Select the new GPU
      await gpuManager.selectAdapter(adapterId);

      // Re-check WebGPU status to update UI
      const result = await checkWebGPUSupport();
      setWebGPUStatus({ checked: true, ...result });

      // If a model is loaded, prompt to reload
      if (isReady && loadedModelId) {
        const shouldReload = window.confirm(
          `GPU changed to ${result.device}.\n\nReload the current model (${selectedModel.name}) to use the new GPU?`,
        );

        if (shouldReload) {
          // switchModel unloads the current engine, then loads the new one
          await switchModel(selectedModel.id);
        }
      }

      // eslint-disable-next-line no-console
      console.log("✅ GPU selection updated:", result.device);
    } catch (err) {
      console.error("❌ Failed to change GPU:", err);
      if (err && err.message) {
        alert(`Failed to change GPU: ${err.message}`);
      }
    } finally {
      setIsChangingGPU(false);
    }
  };

  return { isChangingGPU, handleGPUChange, handleGPUSelected };
};

/**
 * Fallback shown when the device/browser doesn't support WebGPU at all.
 */
const NoWebGPUFallback = () => (
  <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 p-6 dark:border-yellow-500/50 dark:bg-yellow-900/30">
    <h3 className="mb-2 font-bold text-yellow-700 dark:text-yellow-400">
      Use Cloud AI Instead
    </h3>
    <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
      Your device doesn&apos;t support local AI, but you can still use the
      cloud-based AI features by adding your own Gemini API key in Settings.
    </p>
    <p className="text-xs text-gray-600 dark:text-gray-500">
      💡 Tip: Try using Chrome/Edge on a device with a dedicated GPU for local
      AI support.
    </p>
  </div>
);

/**
 * The Initialize/Switch model button - which action (if any) is available
 * depends on whether a model is loaded yet and whether it matches the
 * current selection. Extracted from LocalAIPanel.
 */
const ModelActionButton = ({
  isReady,
  isLoading,
  loadProgress,
  loadedModelId,
  selectedModel,
  installedModels,
  onInitialize,
  onSwitch,
}) => {
  if (!isReady) {
    return (
      <ToolCardButton
        className="w-full"
        type="button"
        onClick={onInitialize}
        disabled={isLoading}
      >
        <ModelLoadButtonLabel
          isLoading={isLoading}
          loadProgress={loadProgress}
          isInstalled={installedModels.has(selectedModel.id)}
          readyLabel={<>⚡ Load {selectedModel.name}</>}
          downloadLabel={<>📥 Download & Load {selectedModel.name}</>}
        />
      </ToolCardButton>
    );
  }

  if (loadedModelId === selectedModel.id) return null;

  return (
    <ToolCardButton
      className="w-full"
      type="button"
      onClick={onSwitch}
      disabled={isLoading}
    >
      <ModelLoadButtonLabel
        isLoading={isLoading}
        loadProgress={loadProgress}
        isInstalled={installedModels.has(selectedModel.id)}
        readyLabel={<>🔄 Switch to {selectedModel.name}</>}
        downloadLabel={<>📥 Download & Switch to {selectedModel.name}</>}
      />
    </ToolCardButton>
  );
};

const ModelLoadProgressBar = ({ loadProgress }) => (
  <div className="space-y-2">
    <div className="h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
      <div
        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
        style={{ width: `${loadProgress.progress}%` }}
      />
    </div>
    <p className="text-center text-sm text-gray-600 dark:text-gray-400">
      {loadProgress.text} ({loadProgress.progress}%)
    </p>
  </div>
);

/**
 * The model-selection + load/switch + ready/error state workspace, shown
 * whenever WebGPU is supported. Extracted from LocalAIPanel so it stays
 * focused on the overall modal layout.
 */
const ModelWorkspaceSection = ({
  availableModels,
  selectedModel,
  setSelectedModel,
  installedModels,
  loadedModelId,
  isLoading,
  isReady,
  loadProgress,
  isGenerating,
  error,
  setError,
  initializeEngine,
  switchModel,
  interruptGeneration,
}) => (
  <>
    <ModelSelectionSection
      availableModels={availableModels}
      selectedModel={selectedModel}
      setSelectedModel={setSelectedModel}
      installedModels={installedModels}
      loadedModelId={loadedModelId}
      isLoading={isLoading}
    />

    {/* System requirements notice */}
    <div className="mb-3">
      <SystemRequirementsNotice compact toolName="Warrant Council AI" />
    </div>

    {/* Initialize/Switch Button */}
    <ModelActionButton
      isReady={isReady}
      isLoading={isLoading}
      loadProgress={loadProgress}
      loadedModelId={loadedModelId}
      selectedModel={selectedModel}
      installedModels={installedModels}
      onInitialize={() => initializeEngine()}
      onSwitch={() => switchModel(selectedModel.id)}
    />

    {/* Loading Progress */}
    {isLoading && <ModelLoadProgressBar loadProgress={loadProgress} />}

    {isReady && (
      <ReadyStateConsole
        loadedModelId={loadedModelId}
        selectedModel={selectedModel}
        isLoading={isLoading}
        isGenerating={isGenerating}
        interruptGeneration={interruptGeneration}
      />
    )}

    {error && (
      <LocalAIErrorState
        error={error}
        selectedModel={selectedModel}
        setError={setError}
      />
    )}
  </>
);

/**
 * The full modal body content (everything below the header/footer).
 * Extracted from LocalAIPanel so that component stays focused on wiring
 * up context + the GPU-selection hook + the ResponsiveModal shell.
 */
const LocalAIPanelContent = ({
  webGPUStatus,
  experimentalMode,
  showExperimentalWarning,
  setShowExperimentalWarning,
  setExperimentalMode,
  gpuPreference,
  isChangingGPU,
  isLoading,
  isReady,
  handleGPUChange,
  handleGPUSelected,
  availableModels,
  selectedModel,
  setSelectedModel,
  installedModels,
  loadedModelId,
  loadProgress,
  isGenerating,
  error,
  setError,
  initializeEngine,
  switchModel,
  interruptGeneration,
}) => (
  <div className="space-y-6">
    {/* Experimental Mode Warning */}
    <ExperimentalModeWarning experimentalMode={experimentalMode} />

    <WebGPUStatusSection
      webGPUStatus={webGPUStatus}
      onGPUSelected={handleGPUSelected}
    />

    {/* Experimental WebGPU Features Toggle - HIDDEN (feature disabled) */}
    {/* Vision models and experimental features disabled - standard WebGPU works great for all text models */}
    {/* eslint-disable-next-line no-constant-binary-expression, sonarjs/no-redundant-boolean */}
    {false && webGPUStatus.supported && (
      <ExperimentalFeaturesSection
        experimentalMode={experimentalMode}
        showExperimentalWarning={showExperimentalWarning}
        setShowExperimentalWarning={setShowExperimentalWarning}
        setExperimentalMode={setExperimentalMode}
        webGPUStatus={webGPUStatus}
      />
    )}

    {/* GPU Selection - Only show if dual GPU detected */}
    {webGPUStatus.supported && webGPUStatus.hasDualGPU && (
      <AdvancedGPUSelectionPanel
        webGPUStatus={webGPUStatus}
        gpuPreference={gpuPreference}
        isChangingGPU={isChangingGPU}
        isLoading={isLoading}
        isReady={isReady}
        onSelectGPU={handleGPUChange}
      />
    )}

    {webGPUStatus.supported && (
      <ModelWorkspaceSection
        availableModels={availableModels}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        installedModels={installedModels}
        loadedModelId={loadedModelId}
        isLoading={isLoading}
        isReady={isReady}
        loadProgress={loadProgress}
        isGenerating={isGenerating}
        error={error}
        setError={setError}
        initializeEngine={initializeEngine}
        switchModel={switchModel}
        interruptGeneration={interruptGeneration}
      />
    )}

    {/* Fallback for no WebGPU */}
    {!webGPUStatus.supported && webGPUStatus.checked && <NoWebGPUFallback />}
  </div>
);

const LocalAIPanel = ({ onClose, onReportBug }) => {
  const {
    webGPUStatus,
    setWebGPUStatus,
    isLoading,
    loadProgress,
    isReady,
    error,
    setError,
    isGenerating,
    selectedModel,
    setSelectedModel,
    availableModels,
    installedModels,
    loadedModelId,
    gpuPreference,
    updateGPUPreference,
    experimentalMode,
    setExperimentalMode,
    showExperimentalWarning,
    setShowExperimentalWarning,
    initializeEngine,
    interruptGeneration,
    switchModel,
  } = useLocalAI();

  const { isChangingGPU, handleGPUChange, handleGPUSelected } =
    useGPUSelectionHandlers({
      updateGPUPreference,
      isReady,
      loadedModelId,
      selectedModel,
      switchModel,
      setWebGPUStatus,
    });

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      header={
        <LocalAIPanelHeader onClose={onClose} onReportBug={onReportBug} />
      }
      labelledBy="local-ai-panel-title"
      size="lg"
      footer={
        <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <span>🔒</span>
          <span>
            Military-grade privacy: Your data never leaves your device
          </span>
        </div>
      }
      className="border border-gray-200 dark:border-gray-700"
    >
      <LocalAIPanelContent
        webGPUStatus={webGPUStatus}
        experimentalMode={experimentalMode}
        showExperimentalWarning={showExperimentalWarning}
        setShowExperimentalWarning={setShowExperimentalWarning}
        setExperimentalMode={setExperimentalMode}
        gpuPreference={gpuPreference}
        isChangingGPU={isChangingGPU}
        isLoading={isLoading}
        isReady={isReady}
        handleGPUChange={handleGPUChange}
        handleGPUSelected={handleGPUSelected}
        availableModels={availableModels}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        installedModels={installedModels}
        loadedModelId={loadedModelId}
        loadProgress={loadProgress}
        isGenerating={isGenerating}
        error={error}
        setError={setError}
        initializeEngine={initializeEngine}
        switchModel={switchModel}
        interruptGeneration={interruptGeneration}
      />
    </ResponsiveModal>
  );
};

export default LocalAIPanel;
