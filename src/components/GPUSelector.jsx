/**
 * GPU Selector Component
 * Displays available GPUs and allows user to select which one to use for AI processing
 *
 * Integrates with WebGPUManager for multi-GPU discovery
 */

import { useState, useEffect } from "react";
import { gpuManager } from "../utils/WebGPUManager";
import {
  AlertTriangle,
  Cpu,
  CheckCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * GPU discovery/selection state + scan/select handlers, extracted so the
 * component body stays under the max-lines-per-function budget.
 */
function useGpuScanner(autoSelect, onGPUSelected) {
  const [adapters, setAdapters] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    scanSystem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanSystem = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!navigator.gpu) {
        throw new Error(
          "WebGPU not supported in this browser. Please use Chrome, Edge, or another Chromium browser.",
        );
      }

      // Clear previous adapters to prevent stale data
      gpuManager.adapters?.clear?.();

      const found = await gpuManager.scanForAdapters();

      // Validate adapter data before setting state
      const validAdapters = (found || []).filter((adapter) => {
        return adapter && adapter.id && adapter.info;
      });

      setAdapters(validAdapters);

      if (autoSelect && validAdapters.length > 0) {
        // Auto-select the "High Performance" one if available
        const best =
          validAdapters.find((a) => a.tier === "High Performance") ||
          validAdapters[0];
        if (best?.id) await handleSelect(best.id);
      }
    } catch (err) {
      console.error("🎮 GPU scan error:", err);
      setError(err?.message || "Unknown error scanning for GPUs");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (id) => {
    // Set loading state immediately
    setLoading(true);
    setError(null);

    try {
      // Wait for the manager to return the device
      const _device = await gpuManager.selectAdapter(id);

      // Update UI state
      setSelectedId(id);

      // Notify parent component (pass the adapter ID)
      if (onGPUSelected) {
        await onGPUSelected(id);
      }
    } catch (err) {
      console.error("🎮 GPU selection error:", err);
      setError(err.message || "Failed to initialize GPU device");
    } finally {
      setLoading(false);
    }
  };

  return { adapters, selectedId, loading, error, scanSystem, handleSelect };
}

/**
 * Selectable list of detected GPU adapters
 */
function GpuAdapterList({ adapters, selectedId, onSelect }) {
  return (
    <div className="space-y-3">
      {adapters.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`w-full text-left p-4 rounded-lg border transition-all flex justify-between items-center group
              ${
                selectedId === item.id
                  ? "bg-blue-600/20 border-blue-500 ring-1 ring-blue-500"
                  : "bg-slate-900/50 dark:bg-slate-800/50 border-slate-700 hover:bg-slate-700 dark:hover:bg-slate-700"
              }`}
        >
          <div>
            <div className="text-white font-medium flex items-center gap-2">
              {item.info?.displayName || item.info?.device || "Unknown GPU"}
              {item.tier === "High Performance" && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              )}
              {item.tier === "Integrated" && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                  Power Saver
                </span>
              )}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              Vendor: {item.info?.vendor || "Unknown"} | Architecture:{" "}
              {item.info?.architecture || "Unknown"}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              VRAM: {gpuManager.estimateVRAM(item)} | Requested via:{" "}
              {item.hint || "default"}
            </div>
          </div>

          {selectedId === item.id && (
            <CheckCircle className="w-6 h-6 text-blue-400 flex-shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Static guidance shown when only one GPU is detected (Chromium GPU-hiding
 * privacy protections)
 */
function SingleGpuGuidance() {
  return (
    <div className="mt-6 text-sm text-gray-400 bg-slate-900 dark:bg-slate-800 p-4 rounded border border-slate-700">
      <p className="font-semibold text-yellow-500 mb-2 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        Only seeing one GPU?
      </p>
      <p className="mb-3">
        Due to browser privacy protections (
        <a
          href="https://issues.chromium.org/issues/369219127"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
        >
          Chromium Issue #369219127
          <ExternalLink className="w-3 h-3" />
        </a>
        ), Chrome often hides secondary GPUs. Windows also ignores GPU
        preference settings.
      </p>
      <div className="bg-slate-800/50 dark:bg-slate-700/50 p-3 rounded">
        <p className="font-semibold text-white mb-2">
          To force a specific GPU:
        </p>
        <ol className="list-decimal ml-5 space-y-1 text-gray-300">
          <li>
            Open Windows <strong>Settings</strong> → <strong>System</strong> →{" "}
            <strong>Display</strong>
          </li>
          <li>
            Scroll down and click <strong>Graphics Settings</strong>
          </li>
          <li>
            Click <strong>Browse</strong> and find your browser (Chrome/Edge)
          </li>
          <li>
            Click <strong>Options</strong> and select{" "}
            <strong>High Performance</strong>
          </li>
          <li>Restart your browser</li>
        </ol>
        <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
          <p className="text-xs text-blue-300">
            <strong>Quick Access:</strong> Press{" "}
            <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-white font-mono text-xs">
              Win + R
            </kbd>
            , type{" "}
            <code className="px-1.5 py-0.5 bg-slate-700 rounded text-yellow-300 font-mono text-xs">
              ms-settings:display
            </code>
            , then scroll to Graphics Settings
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500 italic">
        This is an OS-level limitation - there&apos;s no code workaround. The
        browser only exposes what Windows allows.
      </p>
    </div>
  );
}

const GPUSelector = ({ onGPUSelected, autoSelect = true }) => {
  const { _t } = useLanguage();
  const { adapters, selectedId, loading, error, scanSystem, handleSelect } =
    useGpuScanner(autoSelect, onGPUSelected);

  if (loading) {
    return (
      <div className="p-4 flex items-center gap-3 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span>Scanning GPU Hardware...</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 dark:bg-slate-900 border border-slate-700 dark:border-slate-600 rounded-lg p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">
            Neural Processing Unit
          </h2>
        </div>
        <button
          onClick={scanSystem}
          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
          aria-label="Rescan for GPUs"
        >
          <RefreshCw className="w-4 h-4" />
          Rescan
        </button>
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Select which GPU should handle AI model inference (Gemini Nano, local
        LLMs, etc.)
      </p>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {adapters.length === 0 && !error && (
        <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 p-3 rounded mb-4">
          <p className="text-sm">
            No GPUs detected. WebGPU may not be available or enabled in your
            browser.
          </p>
        </div>
      )}

      <GpuAdapterList
        adapters={adapters}
        selectedId={selectedId}
        onSelect={handleSelect}
      />

      {/* CRITICAL INFO FOR USER - ADDRESSING THE CHROMIUM ISSUE */}
      {adapters.length === 1 && <SingleGpuGuidance />}

      {adapters.length > 1 && (
        <div className="mt-4 text-xs text-gray-500 bg-slate-900/50 dark:bg-slate-800/50 p-3 rounded">
          <p>
            💡 <strong>Tip:</strong> Multiple GPUs detected! Select &quot;High
            Performance&quot; for faster AI inference, or &quot;Integrated&quot;
            to save battery on laptops.
          </p>
        </div>
      )}
    </div>
  );
};

export default GPUSelector;
