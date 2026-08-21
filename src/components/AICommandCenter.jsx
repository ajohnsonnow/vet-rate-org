/**
 * Vet-Rate.org - AI Command Center
 * "The Faraday Cage Protocol" - ONE place for ALL AI settings
 *
 * Simplified for infantry: Veterans don't need to hunt through multiple panels.
 * Everything AI-related in one mission briefing.
 */

import { useState, useEffect } from "react";
import ResponsiveModal from "./common/ResponsiveModal";
import {
  getAIStatus,
  unloadLocalAI,
  registerLocalAIEngine,
} from "../utils/unifiedAIService";
import {
  useDeviceCapability,
  DEVICE_TIERS,
} from "../utils/useDeviceCapability";
import TokenLimitConfig from "./TokenLimitConfig";
import PresetSelector from "./PresetSelector";
import ReportBugLink from "./ReportBugLink";
import GPUSelector from "./GPUSelector";

const GEMINI_KEY_STORAGE = "vetrate_gemini_key";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  🎖️ THE WARRANT COUNCIL - VetRate's Custom Fine-Tuned AI Models             ║
// ║══════════════════════════════════════════════════════════════════════════════║
// ║  Each model maps to a REAL Army Warrant Officer MOS specialty:              ║
// ║  • 350F - All Source Intelligence Technician (analyzes everything)          ║
// ║  • 270A - Legal Administrator (documents & regulations)                      ║
// ║  • 352N - SIGINT Analysis Technician (deciphers signals & patterns)         ║
// ║══════════════════════════════════════════════════════════════════════════════║
// ║  Desktop 7B = Senior Warrants (CWO3-CWO5) - Full SCIF-level analysis        ║
// ║  Mobile 1.7B = Junior Warrants (WO1-CWO2) - Field-deployable ops            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
const MODELS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 🖥️ DESKTOP EDITIONS (7B) - Senior Warrants - SCIF-Level Analysis
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "vetrate-auditor-7b-v2",
    name: '🎖️ CWO3 "HAWKEYE" - 350F All Source Intel',
    description:
      "Fuses all claim intel: service records, medical evidence, 38 CFR regs, and BVA precedent",
    size: "~1-2 GB",
    vramRequired: "~4 GB",
    recommended: true,
    bestFor: "Deep claim audits, evidence correlation, multi-source analysis",
    tier: "full",
    callSign: "HAWKEYE",
    mos: "350F",
  },
  {
    id: "vetrate-writer-7b-v2",
    name: '🎖️ CWO4 "PHANTOM" - 270A Legal Admin',
    description:
      "JAG-trained documentation expert: personal statements, nexus letters, and appeal briefs",
    size: "~1-2 GB",
    vramRequired: "~4 GB",
    bestFor: "Legal documents, NODs, HLR scripts, formal correspondence",
    tier: "full",
    callSign: "PHANTOM",
    mos: "270A",
  },
  {
    id: "vetrate-rater-7b-v2",
    name: '🎖️ CWO5 "ORACLE" - 352N SIGINT Analyst',
    description:
      "Muster Call SigInt specialist: deciphers rating patterns, bilateral math, SMC codes, and TDIU thresholds",
    size: "~1-2 GB",
    vramRequired: "~4 GB",
    bestFor: "Complex calculations, pattern analysis, SMC/TDIU strategy",
    tier: "full",
    callSign: "ORACLE",
    mos: "352N",
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // 📱 MOBILE EDITIONS (1.7B) - Junior Warrants - Field Ops
  // Knowledge-distilled from Senior Warrants for tactical deployment
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "vetrate-auditor-1.7b-mobile-v1",
    name: '📱 WO1 "SCOUT" - 350F Field Intel',
    description:
      "Quick intel sweep: spots red flags, gathers initial HUMINT, preps for Senior analysis",
    size: "~1-2 GB",
    vramRequired: "~2 GB",
    bestFor: "Fast claim triage, evidence spotting, mobile recon",
    tier: "mobile",
    mobileOptimized: true,
    callSign: "SCOUT",
    mos: "350F",
  },
  {
    id: "vetrate-writer-1.7b-mobile-v1",
    name: '📱 CWO2 "SCRIBE" - 270A Field Admin',
    description:
      "Rapid field documentation: captures testimony, outlines statements, secures the narrative",
    size: "~1-2 GB",
    vramRequired: "~2 GB",
    bestFor: "Quick statement drafts, bullet capture, field notes",
    tier: "mobile",
    mobileOptimized: true,
    callSign: "SCRIBE",
    mos: "270A",
  },
  {
    id: "vetrate-rater-1.7b-mobile-v1",
    name: '📱 CWO2 "CIPHER" - 352N Field SIGINT',
    description:
      "Tactical signal decoding: quick rating reads, basic pattern recognition on-the-move",
    size: "~1-2 GB",
    vramRequired: "~2 GB",
    bestFor: "Fast rating estimates, quick math checks, field calculations",
    tier: "mobile",
    mobileOptimized: true,
    callSign: "CIPHER",
    mos: "352N",
  },
];

const getAIStatusIndicatorClass = (aiStatus) => {
  if (aiStatus.isPrivate) return "bg-green-500/30 text-green-200";
  if (aiStatus.effectiveMode) return "bg-blue-500/30 text-blue-200";
  return "bg-yellow-500/30 text-yellow-200";
};

const getAIStatusIcon = (effectiveMode) => {
  if (effectiveMode === "local") return "🔒";
  if (effectiveMode === "cloud") return "☁️";
  return "⚠️";
};

const getLocalAICardBorderClass = (aiStatus, webGPUStatus) => {
  if (aiStatus.effectiveMode === "local") {
    return "border-green-500 bg-green-50 dark:bg-green-900/30";
  }
  if (webGPUStatus.supported) {
    return "border-gray-200 bg-gray-50 hover:border-cyan-500/50 dark:border-gray-700 dark:bg-gray-800/50";
  }
  return "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-800/30";
};

const getDeviceTierLabel = (tier) => {
  if (tier === DEVICE_TIERS.HIGH_END) return "🚀 High-End";
  if (tier === DEVICE_TIERS.MID_RANGE) return "⚡ Mid-Range";
  if (tier === DEVICE_TIERS.LEGACY) return "📱 Legacy";
  return "❓ Unknown";
};

async function checkWebGPU(setWebGPUStatus) {
  if (!navigator.gpu) {
    setWebGPUStatus({
      supported: false,
      checked: true,
      reason: "WebGPU not supported by browser",
    });
    return;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      setWebGPUStatus({
        supported: false,
        checked: true,
        reason: "No GPU adapter found",
      });
      return;
    }

    let adapterInfo = { vendor: "Unknown", device: "GPU Detected" };
    try {
      if (adapter.info) {
        adapterInfo = adapter.info;
      } else if (adapter.requestAdapterInfo) {
        adapterInfo = await adapter.requestAdapterInfo();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log("Could not get adapter info", e);
    }

    setWebGPUStatus({
      supported: true,
      checked: true,
      device: adapterInfo.description || adapterInfo.device || "GPU Detected",
      vendor: adapterInfo.vendor || "Unknown",
    });
  } catch (e) {
    setWebGPUStatus({ supported: false, checked: true, reason: e.message });
  }
}

function useWebGPUStatus() {
  const [webGPUStatus, setWebGPUStatus] = useState({
    supported: false,
    checked: false,
  });

  // Check WebGPU on mount
  useEffect(() => {
    checkWebGPU(setWebGPUStatus);
  }, []);

  return webGPUStatus;
}

function useGeminiApiKey() {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Load API key
  useEffect(() => {
    const savedKey = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem(GEMINI_KEY_STORAGE, apiKey.trim());
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
    }
  };

  const handleClearApiKey = () => {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
    setApiKey("");
  };

  return {
    apiKey,
    setApiKey,
    showApiKey,
    setShowApiKey,
    apiKeySaved,
    handleSaveApiKey,
    handleClearApiKey,
  };
}

function useAIPreset() {
  const [selectedPreset, setSelectedPreset] = useState("BALANCED");

  // Load preset
  useEffect(() => {
    const savedPreset = localStorage.getItem("vetrate_ai_preset");
    if (savedPreset) setSelectedPreset(savedPreset);
  }, []);

  const handlePresetChange = (presetName) => {
    setSelectedPreset(presetName);
    localStorage.setItem("vetrate_ai_preset", presetName);
  };

  return { selectedPreset, handlePresetChange };
}

// Initialize Local AI Engine
async function initializeLocalEngine({
  webGPUStatus,
  selectedModel,
  isLoading,
  setIsLoading,
  setLoadProgress,
  setIsReady,
  setLoadedModelId,
  setInstalledModels,
  setAIStatus,
}) {
  if (!webGPUStatus.supported || isLoading) return;

  setIsLoading(true);
  setLoadProgress({ progress: 0, text: "Starting..." });

  try {
    // Dynamically import the Diamond Swarm
    const { initializeSwarm, generateWithSwarm, isSwarmReady, getSwarmStatus } =
      await import("../utils/diamondSwarm");

    // Initialize with selected model
    await initializeSwarm({
      modelId: selectedModel.id,
      onProgress: (report) => {
        // diamondSwarm passes { stage, message, progress } object
        const progressValue =
          typeof report === "object" ? report.progress || 0 : report || 0;
        const textValue =
          typeof report === "object"
            ? report.message || "Loading..."
            : "Loading...";
        setLoadProgress({
          progress: Math.round(progressValue),
          text: textValue,
        });
      },
    });

    // Register with unified AI service
    registerLocalAIEngine({
      generate: async (prompt, options) => {
        const result = await generateWithSwarm(prompt, options);
        return result?.text || result;
      },
      isReady: isSwarmReady,
      getStatus: getSwarmStatus,
    });

    setIsReady(true);
    setLoadedModelId(selectedModel.id);
    setInstalledModels((prev) => new Set([...prev, selectedModel.id]));
    setAIStatus(getAIStatus());
  } catch (err) {
    console.error("Failed to initialize AI:", err);
    setLoadProgress({ progress: 0, text: `Error: ${err.message}` });
  } finally {
    setIsLoading(false);
  }
}

function useLocalAIEngine(webGPUStatus, selectedModel) {
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  const [isReady, setIsReady] = useState(false);
  const [isUnloading, setIsUnloading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState({
    progress: 0,
    text: "Ready",
  });
  const [, setLoadedModelId] = useState(null);
  const [, setInstalledModels] = useState(new Set());

  // Check if AI is already ready
  useEffect(() => {
    const status = getAIStatus();
    if (status.effectiveMode === "local") {
      setIsReady(true);
    }
  }, []);

  // Update AI status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const status = getAIStatus();
      setAIStatus(status);
      if (status.effectiveMode === "local" && !isReady) {
        setIsReady(true);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isReady]);

  // Unload Local AI
  const handleUnloadLocalAI = async () => {
    setIsUnloading(true);
    try {
      await unloadLocalAI();
      setIsReady(false);
      setLoadedModelId(null);
      setAIStatus(getAIStatus());
    } catch (err) {
      console.error("Failed to unload AI:", err);
    } finally {
      setIsUnloading(false);
    }
  };

  const initializeEngine = () =>
    initializeLocalEngine({
      webGPUStatus,
      selectedModel,
      isLoading,
      setIsLoading,
      setLoadProgress,
      setIsReady,
      setLoadedModelId,
      setInstalledModels,
      setAIStatus,
    });

  return {
    aiStatus,
    isReady,
    isUnloading,
    isLoading,
    loadProgress,
    handleUnloadLocalAI,
    initializeEngine,
  };
}

function useAITestBox() {
  const [testPrompt, setTestPrompt] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  // Handle test AI
  const handleTestAI = async () => {
    if (!testPrompt.trim()) return;

    setIsTesting(true);
    setTestResponse(""); // Clear previous response

    try {
      const { generateWithSwarm } = await import("../utils/diamondSwarm");

      // Show response box immediately
      setTestResponse("⏳ Generating...");

      const result = await generateWithSwarm(testPrompt, {
        temperature: 0.7,
        max_tokens: 200,
        onStream: (delta, fullText) => {
          // Update response in real-time as AI generates
          setTestResponse(fullText || "");
        },
      });

      // Final response (in case streaming didn't capture everything)
      if (result?.text || result) {
        setTestResponse(result?.text || result);
      }
    } catch (err) {
      console.error("Test failed:", err);
      setTestResponse(`❌ Error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return { testPrompt, setTestPrompt, testResponse, isTesting, handleTestAI };
}

const AICommandCenterBrandBanner = ({ aiStatus, onClose, onReportBug }) => (
  <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 px-6 py-5 text-white">
    <div className="absolute right-0 top-0 h-32 w-32 -translate-y-16 translate-x-16 rounded-full bg-white/10" />

    <div className="relative flex items-start justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <span className="text-3xl">🛡️</span>
        </div>
        <div>
          <h2 id="ai-command-center-title" className="text-2xl font-bold">
            AI Command Center
          </h2>
          <p className="mt-1 text-sm text-cyan-200">
            Faraday Cage Protocol • All AI Settings in One Place
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onReportBug && (
          <ReportBugLink
            onClick={onReportBug}
            variant="light"
            moduleName="AI Command Center"
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

    {/* Status Indicator */}
    <div
      className={`mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 ${getAIStatusIndicatorClass(aiStatus)}`}
    >
      <span className="text-lg">{getAIStatusIcon(aiStatus.effectiveMode)}</span>
      <span className="font-semibold">{aiStatus.statusText}</span>
    </div>
  </div>
);

const AICommandCenterTabNav = ({ activeTab, setActiveTab }) => (
  <div className="flex border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
    <button
      onClick={() => setActiveTab("setup")}
      className={`flex-1 px-6 py-3 font-semibold transition-colors ${
        activeTab === "setup"
          ? "border-b-2 border-cyan-500 bg-white text-cyan-600 dark:border-cyan-400 dark:bg-gray-900/50 dark:text-cyan-400"
          : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      ⚡ Quick Setup
    </button>
    <button
      onClick={() => setActiveTab("advanced")}
      className={`flex-1 px-6 py-3 font-semibold transition-colors ${
        activeTab === "advanced"
          ? "border-b-2 border-purple-500 bg-white text-purple-600 dark:border-purple-400 dark:bg-gray-900/50 dark:text-purple-400"
          : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      🔧 Advanced
    </button>
  </div>
);

const AICommandCenterHeader = ({
  aiStatus,
  activeTab,
  setActiveTab,
  onClose,
  onReportBug,
}) => (
  <>
    {/* Gradient brand header */}
    <AICommandCenterBrandBanner
      aiStatus={aiStatus}
      onClose={onClose}
      onReportBug={onReportBug}
    />

    {/* Tab Navigation */}
    <AICommandCenterTabNav activeTab={activeTab} setActiveTab={setActiveTab} />
  </>
);

function ModelPickerButton({ model, isSelected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(model)}
      className={`rounded-lg border-2 p-3 text-left transition-all ${
        isSelected
          ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30"
          : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {model.name}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {model.description}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {model.size} download • {model.vramRequired} VRAM
          </p>
        </div>
        {isSelected && (
          <span className="text-cyan-600 dark:text-cyan-400">✓</span>
        )}
      </div>
    </button>
  );
}

function ModelSelectionPanel({
  selectedModel,
  setSelectedModel,
  isLoading,
  loadProgress,
  onInitialize,
}) {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Select AI Model:
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
        The specialties below share one underlying engine today - the app
        automatically downloads whichever build (~1-2 GB) fits your device.
        Specialty-tuned models are in testing and aren't live yet.
      </p>
      <div className="grid gap-2">
        {MODELS.map((model) => (
          <ModelPickerButton
            key={model.id}
            model={model}
            isSelected={selectedModel.id === model.id}
            onSelect={setSelectedModel}
          />
        ))}
      </div>

      <button
        onClick={onInitialize}
        disabled={isLoading}
        className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 font-bold text-white transition-all hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span> {loadProgress.text} (
            {loadProgress.progress}%)
          </span>
        ) : (
          <span>🚀 Download & Activate Local AI</span>
        )}
      </button>

      {isLoading && (
        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
            style={{ width: `${loadProgress.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function QuickTestQuestions({ onSelectPrompt }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
        Quick Test Questions:
      </p>
      <div className="grid gap-2">
        <button
          onClick={() =>
            onSelectPrompt("What is the VA disability rating for tinnitus?")
          }
          className="group rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-left text-sm text-cyan-800 transition-all hover:border-cyan-300 hover:bg-cyan-100 dark:border-cyan-700/50 dark:bg-cyan-900/30 dark:text-cyan-100 dark:hover:border-cyan-600 dark:hover:bg-cyan-900/50"
        >
          <span className="font-medium">💰 Rating Question:</span>
          <span className="mt-0.5 block text-xs text-cyan-600 group-hover:text-cyan-700 dark:text-cyan-300 dark:group-hover:text-cyan-200">
            What is the VA disability rating for tinnitus?
          </span>
        </button>
        <button
          onClick={() => onSelectPrompt("Explain PTSD secondary conditions")}
          className="group rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-left text-sm text-purple-800 transition-all hover:border-purple-300 hover:bg-purple-100 dark:border-purple-700/50 dark:bg-purple-900/30 dark:text-purple-100 dark:hover:border-purple-600 dark:hover:bg-purple-900/50"
        >
          <span className="font-medium">🔗 Secondary Conditions:</span>
          <span className="mt-0.5 block text-xs text-purple-600 group-hover:text-purple-700 dark:text-purple-300 dark:group-hover:text-purple-200">
            Explain PTSD secondary conditions
          </span>
        </button>
        <button
          onClick={() => onSelectPrompt("How does bilateral factor work?")}
          className="group rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left text-sm text-blue-800 transition-all hover:border-blue-300 hover:bg-blue-100 dark:border-blue-700/50 dark:bg-blue-900/30 dark:text-blue-100 dark:hover:border-blue-600 dark:hover:bg-blue-900/50"
        >
          <span className="font-medium">🧮 Math Calculation:</span>
          <span className="mt-0.5 block text-xs text-blue-600 group-hover:text-blue-700 dark:text-blue-300 dark:group-hover:text-blue-200">
            How does bilateral factor work?
          </span>
        </button>
      </div>
    </div>
  );
}

function TestResponseBox({ testResponse, isTesting }) {
  if (!testResponse && !isTesting) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/70">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Response:
        </p>
        {isTesting && testResponse && testResponse !== "⏳ Generating..." && (
          <span className="animate-pulse text-xs text-cyan-600 dark:text-cyan-400">
            ● Generating...
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
        {testResponse || "⏳ Generating..."}
      </p>
    </div>
  );
}

function TestBoxPanel({
  testPrompt,
  setTestPrompt,
  testResponse,
  isTesting,
  onTest,
}) {
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-cyan-600 dark:text-cyan-400">🧪</span>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Test Your AI
        </h4>
      </div>

      <div className="space-y-3">
        <QuickTestQuestions onSelectPrompt={setTestPrompt} />

        <div className="flex items-center gap-2">
          <hr className="flex-1 border-gray-300 dark:border-gray-600" />
          <span className="text-xs text-gray-500">or ask your own</span>
          <hr className="flex-1 border-gray-300 dark:border-gray-600" />
        </div>

        <textarea
          value={testPrompt}
          onChange={(e) => setTestPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (testPrompt.trim() && !isTesting) {
                onTest();
              }
            }
          }}
          placeholder="Type your question here... (Press Enter to send, Shift+Enter for new line)"
          className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-600 dark:bg-gray-900/50 dark:text-white dark:placeholder:text-gray-500"
          rows={2}
          disabled={isTesting}
        />

        <button
          onClick={onTest}
          disabled={isTesting || !testPrompt.trim()}
          className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isTesting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span> Testing...
            </span>
          ) : (
            "🚀 Send Test Prompt"
          )}
        </button>

        <TestResponseBox testResponse={testResponse} isTesting={isTesting} />
      </div>
    </div>
  );
}

function ActiveLocalAIPanel({ isUnloading, onUnload, testBox }) {
  return (
    <>
      <div className="mt-4 flex gap-2">
        <span className="flex-1 rounded-lg bg-green-100 px-4 py-2 text-center text-sm font-medium text-green-700 dark:bg-green-500/20 dark:text-green-300">
          ✅ AI Active & Private
        </span>
        <button
          onClick={onUnload}
          disabled={isUnloading}
          className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30"
        >
          {isUnloading ? "⏳" : "⏹️ Unload"}
        </button>
      </div>

      <TestBoxPanel
        testPrompt={testBox.testPrompt}
        setTestPrompt={testBox.setTestPrompt}
        testResponse={testBox.testResponse}
        isTesting={testBox.isTesting}
        onTest={testBox.handleTestAI}
      />
    </>
  );
}

function LocalAICard({
  aiStatus,
  webGPUStatus,
  deviceCapability,
  selectedModel,
  setSelectedModel,
  isReady,
  isLoading,
  loadProgress,
  isUnloading,
  onInitialize,
  onUnload,
  testBox,
}) {
  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all ${getLocalAICardBorderClass(aiStatus, webGPUStatus)}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-green-500/20">
          <span className="text-2xl">🔒</span>
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-gray-900 dark:text-white">
              Local AI - 100% Private
            </h4>
            {deviceCapability.tier !== DEVICE_TIERS.UNSUPPORTED && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-500/30 dark:text-green-300">
                RECOMMENDED
              </span>
            )}
            {aiStatus.effectiveMode === "local" && (
              <span className="animate-pulse rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                ACTIVE
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Runs entirely on your device. Zero data transmitted. Works offline.
          </p>

          {webGPUStatus.supported && webGPUStatus.device && (
            <p className="mt-2 text-xs text-cyan-600 dark:text-cyan-400">
              🎮 GPU Ready: {webGPUStatus.device}
            </p>
          )}

          {!webGPUStatus.supported && webGPUStatus.checked && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              ❌ WebGPU not available on this device
            </p>
          )}

          {webGPUStatus.supported && !isReady && (
            <ModelSelectionPanel
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              isLoading={isLoading}
              loadProgress={loadProgress}
              onInitialize={onInitialize}
            />
          )}

          {isReady && (
            <ActiveLocalAIPanel
              isUnloading={isUnloading}
              onUnload={onUnload}
              testBox={testBox}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function GeminiApiKeyForm({
  apiKey,
  setApiKey,
  showApiKey,
  setShowApiKey,
  apiKeySaved,
  onSave,
  onClear,
}) {
  return (
    <div className="mt-3 space-y-2">
      <div className="relative">
        <input
          type={showApiKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter Gemini API key..."
          className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-2 pr-10 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <button
          type="button"
          onClick={() => setShowApiKey(!showApiKey)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
        >
          {showApiKey ? "👁️" : "👁️‍🗨️"}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={!apiKey.trim()}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {apiKeySaved ? "✓ Saved!" : "💾 Save Key"}
        </button>
        {apiKey && (
          <button
            onClick={onClear}
            className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-200 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30"
          >
            Clear
          </button>
        )}
      </div>

      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
      >
        🔗 Get free API key from Google AI Studio →
      </a>
    </div>
  );
}

function CloudAICard({
  aiStatus,
  deviceCapability,
  apiKey,
  setApiKey,
  showApiKey,
  setShowApiKey,
  apiKeySaved,
  onSave,
  onClear,
}) {
  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all ${
        aiStatus.effectiveMode === "cloud"
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
          : "border-gray-200 bg-gray-50 hover:border-blue-500/50 dark:border-gray-700 dark:bg-gray-800/50"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/20">
          <span className="text-2xl">☁️</span>
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-gray-900 dark:text-white">
              Cloud AI - Gemini (Free)
            </h4>
            {aiStatus.effectiveMode === "cloud" && (
              <span className="animate-pulse rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
                ACTIVE
              </span>
            )}
            {(deviceCapability.tier === DEVICE_TIERS.UNSUPPORTED ||
              deviceCapability.tier === DEVICE_TIERS.LEGACY) && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-500/30 dark:text-blue-300">
                BEST FOR YOUR DEVICE
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Fast responses via Google Gemini. Requires internet connection.
          </p>

          {/* Warning */}
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-500/30 dark:bg-amber-900/20">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              ⚠️ Your queries are sent to Google&apos;s servers. API key stays
              in YOUR browser only.
            </p>
          </div>

          {/* API Key Input */}
          <GeminiApiKeyForm
            apiKey={apiKey}
            setApiKey={setApiKey}
            showApiKey={showApiKey}
            setShowApiKey={setShowApiKey}
            apiKeySaved={apiKeySaved}
            onSave={onSave}
            onClear={onClear}
          />
        </div>
      </div>
    </div>
  );
}

function QuickTipsCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <h4 className="mb-2 flex items-center gap-2 font-bold text-gray-900 dark:text-white">
        <span>💡</span> Quick Tips
      </h4>
      <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        <li>
          •{" "}
          <strong className="text-green-600 dark:text-green-400">
            Local AI
          </strong>{" "}
          = 100% private, works offline
        </li>
        <li>
          •{" "}
          <strong className="text-blue-600 dark:text-blue-400">Cloud AI</strong>{" "}
          = faster but sends data to Google
        </li>
        <li>• Both use the same Diamond Knowledge Base (~8K curated VA entries)</li>
      </ul>
    </div>
  );
}

function SetupTab({
  aiStatus,
  webGPUStatus,
  deviceCapability,
  selectedModel,
  setSelectedModel,
  isReady,
  isLoading,
  loadProgress,
  isUnloading,
  onInitialize,
  onUnload,
  testBox,
  apiKey,
  setApiKey,
  showApiKey,
  setShowApiKey,
  apiKeySaved,
  onSaveApiKey,
  onClearApiKey,
}) {
  return (
    <>
      {/* STEP 1: Choose Your AI Mode */}
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-bold text-cyan-600 dark:text-cyan-400">
            1
          </span>
          Choose Your AI
        </h3>

        {/* Option A: Local AI (Privacy First) */}
        <LocalAICard
          aiStatus={aiStatus}
          webGPUStatus={webGPUStatus}
          deviceCapability={deviceCapability}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          isReady={isReady}
          isLoading={isLoading}
          loadProgress={loadProgress}
          isUnloading={isUnloading}
          onInitialize={onInitialize}
          onUnload={onUnload}
          testBox={testBox}
        />

        {/* Divider */}
        <div className="flex items-center gap-4">
          <hr className="flex-1 border-gray-200 dark:border-gray-700" />
          <span className="text-sm text-gray-500">OR</span>
          <hr className="flex-1 border-gray-200 dark:border-gray-700" />
        </div>

        {/* Option B: Cloud AI (Gemini) */}
        <CloudAICard
          aiStatus={aiStatus}
          deviceCapability={deviceCapability}
          apiKey={apiKey}
          setApiKey={setApiKey}
          showApiKey={showApiKey}
          setShowApiKey={setShowApiKey}
          apiKeySaved={apiKeySaved}
          onSave={onSaveApiKey}
          onClear={onClearApiKey}
        />
      </div>

      {/* Quick Tips */}
      <QuickTipsCard />
    </>
  );
}

function DeviceCapabilityCard({ deviceCapability, webGPUStatus }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <h4 className="mb-3 flex items-center gap-2 font-bold text-gray-900 dark:text-white">
        <span>📱</span> Device Capability
      </h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-white p-3 dark:bg-gray-900/50">
          <p className="text-xs text-gray-500">Device Tier</p>
          <p className="font-semibold text-gray-900 dark:text-white">
            {getDeviceTierLabel(deviceCapability.tier)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3 dark:bg-gray-900/50">
          <p className="text-xs text-gray-500">WebGPU</p>
          <p
            className={`font-semibold ${webGPUStatus.supported ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            {webGPUStatus.supported ? "✅ Supported" : "❌ Not Available"}
          </p>
        </div>
        {webGPUStatus.supported && webGPUStatus.device && (
          <div className="col-span-2 rounded-lg bg-white p-3 dark:bg-gray-900/50">
            <p className="text-xs text-gray-500">Active GPU</p>
            <p className="font-semibold text-cyan-600 dark:text-cyan-400">
              {webGPUStatus.device}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdvancedTab({
  selectedPreset,
  onPresetChange,
  webGPUStatus,
  deviceCapability,
}) {
  return (
    <>
      {/* Token Limit */}
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
          <span>📊</span> Response Length
        </h3>
        <TokenLimitConfig />
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* AI Preset */}
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
          <span>🎯</span> AI Personality
        </h3>
        <PresetSelector value={selectedPreset} onChange={onPresetChange} />
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* GPU Selection (if WebGPU available) */}
      {webGPUStatus.supported && (
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <span>🎮</span> GPU Settings
          </h3>
          <GPUSelector onGPUSelected={() => {}} autoSelect={false} />
        </div>
      )}

      {/* DKB Info */}
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-500/30 dark:bg-purple-900/20">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💎</span>
          <div>
            <h4 className="font-bold text-purple-700 dark:text-purple-300">
              Diamond Knowledge Base
            </h4>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Both Local and Cloud AI use our ~8,000-entry curated database of
              VA regulations, 38 CFR, BVA decisions, and CAVC rulings.
            </p>
            <p className="mt-2 text-xs text-purple-600 dark:text-purple-400/80">
              Local AI: 6-8 entries per query (optimized for GPU memory)
              <br />
              Cloud AI: 8-10 entries per query (full context)
            </p>
          </div>
        </div>
      </div>

      {/* Device Info */}
      <DeviceCapabilityCard
        deviceCapability={deviceCapability}
        webGPUStatus={webGPUStatus}
      />
    </>
  );
}

const AICommandCenterFooter = ({ onClose }) => (
  <>
    <button
      onClick={onClose}
      className="w-full rounded-xl bg-gray-200 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
    >
      Done
    </button>
    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
      <span>🔒</span>
      <span>Your data, your device, your control</span>
    </div>
  </>
);

const AICommandCenter = ({ onClose, onReportBug }) => {
  // Tab state
  const [activeTab, setActiveTab] = useState("setup"); // 'setup' | 'advanced'

  // Local AI state
  const webGPUStatus = useWebGPUStatus();
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const {
    aiStatus,
    isReady,
    isUnloading,
    isLoading,
    loadProgress,
    handleUnloadLocalAI,
    initializeEngine,
  } = useLocalAIEngine(webGPUStatus, selectedModel);

  // API Key
  const {
    apiKey,
    setApiKey,
    showApiKey,
    setShowApiKey,
    apiKeySaved,
    handleSaveApiKey,
    handleClearApiKey,
  } = useGeminiApiKey();

  // Test box state
  const testBox = useAITestBox();

  // Preset
  const { selectedPreset, handlePresetChange } = useAIPreset();

  // Device capability
  const deviceCapability = useDeviceCapability();

  const header = (
    <AICommandCenterHeader
      aiStatus={aiStatus}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onClose={onClose}
      onReportBug={onReportBug}
    />
  );

  const footer = <AICommandCenterFooter onClose={onClose} />;

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      header={header}
      labelledBy="ai-command-center-title"
      size="lg"
      footer={footer}
    >
      <div className="space-y-6">
        {activeTab === "setup" && (
          <SetupTab
            aiStatus={aiStatus}
            webGPUStatus={webGPUStatus}
            deviceCapability={deviceCapability}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            isReady={isReady}
            isLoading={isLoading}
            loadProgress={loadProgress}
            isUnloading={isUnloading}
            onInitialize={initializeEngine}
            onUnload={handleUnloadLocalAI}
            testBox={testBox}
            apiKey={apiKey}
            setApiKey={setApiKey}
            showApiKey={showApiKey}
            setShowApiKey={setShowApiKey}
            apiKeySaved={apiKeySaved}
            onSaveApiKey={handleSaveApiKey}
            onClearApiKey={handleClearApiKey}
          />
        )}

        {activeTab === "advanced" && (
          <AdvancedTab
            selectedPreset={selectedPreset}
            onPresetChange={handlePresetChange}
            webGPUStatus={webGPUStatus}
            deviceCapability={deviceCapability}
          />
        )}
      </div>
    </ResponsiveModal>
  );
};

export default AICommandCenter;
