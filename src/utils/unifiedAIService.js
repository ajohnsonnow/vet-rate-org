/**
 * Vet-Rate.org - Unified AI Service
 * 💎 "The Diamond Standard" - 3-Model Swarm Architecture
 *
 * This service provides a unified interface for AI operations using the
 * Warrant Council - 3 specialized fine-tuned models:
 * - AUDITOR: Reviews claims for accuracy, compliance, and completeness
 * - WRITER: Generates compelling personal statements and nexus letters
 * - RATER: Calculates VA disability ratings using bilateral factor formula
 *
 * Supports fallback to cloud AI (Gemini) when local models unavailable.
 * 100% private local inference - no data leaves the device.
 */

import { interceptBeforeAICall } from "./crisisInterceptor";
import {
  scrubPII,
  analyzePII,
  containsSignificantNonLatin,
} from "./piiScrubber";
import { stripUntrustedUrls } from "./sanitize";
import { validateAIResponse as validateHallucinations } from "./hallucinationTrap";
import { logModelCallWithDigests } from "./aiAuditLog";
import { interpretGeminiResponse } from "./geminiResponse";
import { isFeatureEnabled } from "./featureFlags";
import {
  SWARM_AGENTS,
  TOOL_AGENT_MAP,
  getAgentForTool,
  isSwarmReady,
  isSwarmInitializing,
  getCurrentAgent,
  getSwarmStatus,
  generateWithSwarm,
  initializeSwarm,
  reloadSwarmEngine,
  switchAgent,
  unloadSwarm,
} from "./diamondSwarm";

// 💎 New backends: Wllama (browser WASM) and Local Server (llama.cpp)
import * as wllamaService from "./wllamaService";
import * as localServerClient from "./localServerClient";
import { detectDeviceCapabilities } from "./deviceCapabilityDetector";

// Dynamic imports for code splitting
let aiSystemPromptsModule = null;
const getAISystemPrompts = async () => {
  if (!aiSystemPromptsModule) {
    aiSystemPromptsModule = await import("./aiSystemPrompts");
  }
  return aiSystemPromptsModule;
};

// Storage keys
const AI_MODE_KEY = "vet_rate_ai_mode"; // 'cloud' | 'local' | 'swarm'
const GEMINI_KEY = "vetrate_gemini_key";
const _LOCAL_MODEL_KEY = "vet_rate_local_ai_model";
const TOKEN_LIMIT_KEY = "vetrate_token_limit_config";

// Cloud AI endpoint (fallback only)
// NOTE: gemini-1.5-flash was deprecated and shut down in late 2025
// Updated to gemini-2.5-flash which has same 1M token context window
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Warrant Council state (primary AI engine)
let swarmEngine = null;
let swarmReady = false;
let swarmGenerating = false;
let swarmInitializingState = false;

// 🌐 Wllama state (browser WASM inference)
let wllamaReady = false;
let wllamaInitializing = false;
let wllamaCurrentModel = null;

// 🖥️ Local Server state (llama.cpp server)
let localServerAvailable = false;
let localServerChecked = false;

// Legacy WebLLM state (deprecated - kept for backward compatibility)
let localAIEngine = null;
let localAIReady = false;
let localAIGenerating = false;
let localAIInitializing = false;
let localAIModelId = null;
let localAIIsVisionModel = false;
let webGPUSupported = null;
let webGPUCheckPromise = null;

// Promise-based mutex to prevent concurrent generation requests
let generationLock = null;

/**
 * Acquire generation lock - ensures only one generation at a time
 */
const acquireGenerationLock = async () => {
  // Wait for any existing lock to release
  while (generationLock) {
    // eslint-disable-next-line no-console
    console.log("⏳ Waiting for previous generation to complete...");
    await generationLock;
  }

  // Create new lock
  let releaseLock;
  generationLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  return () => {
    generationLock = null;
    releaseLock();
  };
};

/**
 * Get user-configured token limit (or default to 2048)
 */
const getUserTokenLimit = () => {
  try {
    const stored = localStorage.getItem(TOKEN_LIMIT_KEY);
    if (stored) {
      const config = JSON.parse(stored);
      return config.value || 2048;
    }
  } catch (e) {
    console.warn("Error loading token limit config:", e);
  }
  return 2048; // Default balanced setting
};

/**
 * AI Configuration Presets for different use cases
 * Based on "Platinum Standard" recommendations
 */
export const AI_PRESETS = {
  // For legal/regulatory analysis - Maximum accuracy, zero creativity
  LEGAL: {
    label: "Legal/Regulatory (Jag Advocate)",
    description: "100% adherence to regulations. Zero creativity.",
    temperature: 0.1,
    topK: 1,
    topP: 0.1,
    frequencyPenalty: 0.0, // Allow repetition of legal terms
    useCase: [
      "C-File Analyzer",
      "Decision Decoder",
      "PACT Act Navigator",
      "TDIU Builder",
    ],
  },

  // For creative writing - Natural, persuasive, human-sounding
  CREATIVE: {
    label: "Creative/Writing (Empathetic Nexus)",
    description: "Natural, persuasive, human-sounding narrative.",
    temperature: 0.7,
    topK: 40,
    topP: 0.9,
    presencePenalty: 0.3, // Discourage repetitive sentence structures
    useCase: ["Nexus Builder", "Witness Bench", "Personal Statement Helper"],
  },

  // For adversarial analysis - Critical, skeptical, probing
  ADVERSARIAL: {
    label: "Adversarial (Red Team)",
    description: "Critical, skeptical evaluation.",
    temperature: 0.4,
    topK: 20,
    topP: 0.8,
    presencePenalty: 0.2,
    useCase: ["The War Game", "Red Team Simulator"],
  },

  // Balanced default
  BALANCED: {
    label: "Balanced (Standard)",
    description: "Good for most tasks.",
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    useCase: ["General purpose"],
  },
};

/**
 * Get AI preset by name
 * @param {string} presetName - Name of preset (LEGAL, CREATIVE, ADVERSARIAL, BALANCED)
 * @returns {Object} Preset configuration
 */
export const getAIPreset = (presetName = "BALANCED") => {
  return AI_PRESETS[presetName] || AI_PRESETS.BALANCED;
};

/**
 * Check if WebGPU is supported on this device
 * Cached result for performance
 * @returns {Promise<{supported: boolean, reason?: string, device?: string}>}
 */
export const checkWebGPUSupport = async () => {
  // Return cached result if available
  if (webGPUSupported !== null) {
    return webGPUSupported;
  }

  // Prevent duplicate concurrent checks
  if (webGPUCheckPromise) {
    return webGPUCheckPromise;
  }

  webGPUCheckPromise = (async () => {
    // Check for navigator.gpu availability
    if (typeof navigator === "undefined" || !navigator.gpu) {
      webGPUSupported = {
        supported: false,
        reason:
          "WebGPU not available. Local AI requires Chrome 113+, Edge 113+, or a compatible browser.",
      };
      return webGPUSupported;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        webGPUSupported = {
          supported: false,
          reason:
            "No compatible GPU found. Your device may not support Local AI.",
        };
        return webGPUSupported;
      }

      // Verify we can actually get a device
      await adapter.requestDevice();

      webGPUSupported = {
        supported: true,
        device: "GPU detected",
      };
      return webGPUSupported;
    } catch (err) {
      webGPUSupported = {
        supported: false,
        reason: `WebGPU initialization failed: ${err.message}. Try using Chrome or Edge.`,
      };
      return webGPUSupported;
    }
  })();

  return webGPUCheckPromise;
};

/**
 * AI Mode Types
 */
export const AI_MODES = {
  CLOUD: "cloud",
  LOCAL: "local",
  SWARM: "swarm", // 🎖️ Warrant Council - 3 specialized agents (WebGPU/MLC)
  WLLAMA: "wllama", // 🌐 Wllama - Browser WASM inference (works everywhere)
  LOCAL_SERVER: "local_server", // 🖥️ llama.cpp server - Desktop inference via API
  AUTO: "auto", // Prefer swarm → wllama → local_server → cloud
};

/**
 * Get the current AI mode preference
 */
export const getAIMode = () => {
  const stored = localStorage.getItem(AI_MODE_KEY);
  // Migrate old 'local' preference to 'swarm'
  if (stored === "local") {
    localStorage.setItem(AI_MODE_KEY, AI_MODES.SWARM);
    return AI_MODES.SWARM;
  }
  return stored || AI_MODES.SWARM; // Default to Warrant Council
};

/**
 * Set the AI mode preference
 */
export const setAIMode = (mode) => {
  if (Object.values(AI_MODES).includes(mode)) {
    localStorage.setItem(AI_MODE_KEY, mode);
    return true;
  }
  return false;
};

/**
 * Register the Warrant Council engine (primary AI)
 * @param {object} engine - The swarm engine instance
 * @param {boolean} ready - Whether the swarm is fully ready
 * @param {boolean} initializing - Whether the swarm is currently loading
 * @param {string} agentId - The ID of the current agent
 */
export const registerSwarmEngine = (
  engine,
  ready,
  initializing = false,
  agentId = null,
) => {
  swarmEngine = engine;
  swarmReady = ready;
  swarmInitializingState = initializing;
  // eslint-disable-next-line no-console
  console.log(
    `🎖️ Warrant Council registered: agent=${agentId}, ready=${ready}`,
  );
};

/**
 * Register the local AI engine (legacy - for backward compatibility)
 * @param {object} engine - The MLCEngine instance
 * @param {boolean} ready - Whether the engine is fully ready for inference
 * @param {boolean} initializing - Whether the engine is currently loading/warming up
 * @param {string} modelId - The ID of the loaded model
 * @param {boolean} isVisionModel - Whether the model supports vision/image input
 */
const mapModelIdToAgent = (modelId) => {
  const lowerModelId = modelId.toLowerCase();
  if (lowerModelId.includes("writer")) return "writer";
  if (lowerModelId.includes("rater")) return "rater";
  return "auditor";
};

export const registerLocalAIEngine = (
  engine,
  ready,
  initializing = false,
  modelId = null,
  isVisionModel = false,
) => {
  localAIEngine = engine;
  localAIReady = ready;
  localAIInitializing = initializing;
  localAIModelId = modelId;
  localAIIsVisionModel = isVisionModel;
  // eslint-disable-next-line no-console
  console.log(
    `📝 Legacy Local AI registered: modelId=${modelId}, ready=${ready}, isVision=${isVisionModel}`,
  );

  // Dispatch event for DKB status update when Local AI is ready
  if (ready && modelId) {
    window.dispatchEvent(
      new CustomEvent("local-ai-status-change", {
        detail: {
          ready: true,
          modelId,
          fullDKBAvailable: true, // Local AI has access to full 130K+ DKB
        },
      }),
    );

    // Map legacy model to closest Diamond Swarm agent
    const agentId = mapModelIdToAgent(modelId);
    registerSwarmEngine(engine, ready, initializing, agentId);
  } else if (!ready && !initializing) {
    // Only broadcast "not ready" if the swarm isn't already covering inference.
    // LocalAIPanel calls registerLocalAIEngine(null, false) on model-load failure
    // even when the Diamond Swarm loaded successfully moments earlier, which would
    // incorrectly pull the DKB status banner back to "offline".
    if (!swarmReady) {
      window.dispatchEvent(
        new CustomEvent("local-ai-status-change", {
          detail: { ready: false, fullDKBAvailable: false },
        }),
      );
      // Let UI layers surface the failure — without this, the fallback to
      // cloud/other backends is silent and the veteran never learns why
      window.dispatchEvent(
        new CustomEvent("vetrate:ai-engine-failed", {
          detail: {
            engine: modelId || "local-ai",
            error: "Local AI engine failed to load or was unloaded",
          },
        }),
      );
    }
  }
};

/**
 * Unload/terminate the local AI engine to free up resources
 * @returns {Promise<boolean>} true if successfully unloaded
 */
export const unloadLocalAI = async () => {
  if (!localAIEngine) {
    // eslint-disable-next-line no-console
    console.log("No local AI engine to unload");
    return false;
  }

  try {
    // MLC WebLLM engines have a terminate() method
    if (typeof localAIEngine.unload === "function") {
      await localAIEngine.unload();
      // eslint-disable-next-line no-console
      console.log("Local AI engine unloaded via unload()");
    } else if (typeof localAIEngine.terminate === "function") {
      await localAIEngine.terminate();
      // eslint-disable-next-line no-console
      console.log("Local AI engine terminated");
    }

    // Clear the references
    localAIEngine = null;
    localAIReady = false;
    localAIGenerating = false;
    localAIInitializing = false;
    localAIModelId = null;
    localAIIsVisionModel = false;

    // eslint-disable-next-line no-console
    console.log("✅ Local AI unloaded successfully");
    return true;
  } catch (err) {
    console.error("Error unloading local AI:", err);
    // Still clear references even on error
    localAIEngine = null;
    localAIReady = false;
    localAIGenerating = false;
    localAIInitializing = false;
    localAIModelId = null;
    localAIIsVisionModel = false;
    return false;
  }
};

/**
 * Check if Warrant Council is ready (primary)
 */
export const isDiamondSwarmReady = () => {
  return (
    isSwarmReady() ||
    (swarmEngine !== null && swarmReady && !swarmInitializingState)
  );
};

/**
 * Check if local AI is ready (includes Warrant Council)
 */
export const isLocalAIReady = () => {
  // Warrant Council takes priority
  if (isDiamondSwarmReady()) return true;
  // Fallback to legacy local AI
  return localAIEngine !== null && localAIReady && !localAIInitializing;
};

/**
 * Check if local AI is currently initializing/warming up
 */
export const isLocalAIInitializing = () => {
  return isSwarmInitializing() || swarmInitializingState || localAIInitializing;
};

/**
 * Check if the currently loaded local AI model supports vision/image input
 * @returns {boolean} true if vision model is loaded and ready
 */
export const isLocalAIVisionModel = () => {
  return localAIEngine !== null && localAIReady && localAIIsVisionModel;
};

/**
 * Get the currently loaded local AI model ID
 * @returns {string|null} The model ID or null if no model loaded
 */
export const getLocalAIModelId = () => {
  return localAIModelId;
};

/**
 * Check if an API key is valid (not a placeholder)
 */
const isValidApiKey = (key) => {
  if (!key || key.length === 0) return false;
  // Reject common placeholder patterns
  const placeholderPatterns = [
    "your_",
    "your-",
    "YOUR_",
    "YOUR-",
    "_here",
    "-here",
    "api_key_here",
    "key_here",
    "placeholder",
    "example",
    "xxx",
    "test_key",
  ];
  const lowerKey = key.toLowerCase();
  return !placeholderPatterns.some((pattern) =>
    lowerKey.includes(pattern.toLowerCase()),
  );
};

/**
 * Check if cloud AI is available (API key configured)
 */
export const isCloudAIAvailable = () => {
  // RT1-1: BYOK only — the key comes solely from the user's localStorage entry,
  // never from the build env. A VITE_-inlined key would ship in the public bundle.
  const storedKey = localStorage.getItem(GEMINI_KEY);
  return isValidApiKey(storedKey);
};

/**
 * 🌐 Check if Wllama (browser WASM) is available
 */
export const isWllamaAvailable = () => {
  return wllamaReady && !wllamaInitializing;
};

/**
 * 🌐 Check if Wllama is currently initializing
 */
export const isWllamaInitializing = () => {
  return wllamaInitializing;
};

/**
 * 🌐 Initialize Wllama for browser-based inference
 * @param {string} modelName - 'auditor' | 'writer' | 'rater'
 * @param {function} onProgress - Progress callback
 */
export const initializeWllama = async (
  modelName = "auditor",
  onProgress = null,
) => {
  if (wllamaInitializing) {
    // eslint-disable-next-line no-console
    console.log("🌐 Wllama already initializing...");
    return false;
  }

  // RT8-3: The wllama GGUF models are ~4 GB each. Downloading that on a phone
  // or a device without adequate GPU/RAM OOMs or crawls. Gate early — same
  // pattern as diamondSwarm.js which checks canUseWebLLM before any WebLLM
  // download. Mobile tier always returns canUseWebLLM=false.
  const deviceProfile = await detectDeviceCapabilities();
  if (!deviceProfile.canUseWebLLM) {
    const reason = `Device tier "${deviceProfile.tier}" (${deviceProfile.hasWebGPU ? "WebGPU present but mobile" : "no WebGPU"})`;
    // eslint-disable-next-line no-console
    console.warn(
      `[Wllama] Blocked on ${reason}: 7B models need a desktop/laptop.`,
    );
    throw new Error(
      `Local AI (7B model) is not available on this device (${reason}). ` +
        "Use Cloud AI or open the app on a desktop or laptop.",
    );
  }

  try {
    wllamaInitializing = true;
    // eslint-disable-next-line no-console
    console.log(`🌐 Initializing Wllama with ${modelName}...`);

    const result = await wllamaService.initializeWllama(modelName, onProgress);

    if (result.success) {
      wllamaReady = true;
      wllamaCurrentModel = modelName;
      // eslint-disable-next-line no-console
      console.log(`🌐 Wllama ready with ${modelName}`);
    } else {
      console.error("🌐 Wllama init failed:", result.error);
    }

    wllamaInitializing = false;
    return result.success;
  } catch (err) {
    console.error("🌐 Wllama init error:", err);
    wllamaInitializing = false;
    return false;
  }
};

/**
 * 🖥️ Check if local llama.cpp server is available
 */
export const isLocalServerAvailable = () => {
  return localServerAvailable;
};

/**
 * 🖥️ Check local server availability (ping the server)
 * @param {boolean} force - Force re-check even if already checked
 */
export const checkLocalServer = async (force = false) => {
  if (localServerChecked && !force) {
    return localServerAvailable;
  }

  try {
    // eslint-disable-next-line no-console
    console.log("🖥️ Checking local llama.cpp server...");
    const health = await localServerClient.checkServerHealth();
    localServerAvailable = health.available;
    localServerChecked = true;

    if (health.available) {
      // eslint-disable-next-line no-console
      console.log(`🖥️ Local server available: ${health.model || "ready"}`);
    } else {
      // eslint-disable-next-line no-console
      console.log("🖥️ Local server not available");
    }

    return localServerAvailable;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("🖥️ Local server check failed:", err.message);
    localServerAvailable = false;
    localServerChecked = true;
    return false;
  }
};

/**
 * Check if ANY AI is available
 */
export const isAnyAIAvailable = () => {
  return (
    isCloudAIAvailable() ||
    isLocalAIReady() ||
    isWllamaAvailable() ||
    isLocalServerAvailable()
  );
};

// Backend readiness checks, keyed by AI_MODES value. Used by
// resolveFirstAvailableMode() to walk a priority-ordered fallback chain
// without repeating the same five checks in every branch.
const AI_BACKEND_READY_CHECKS = {
  [AI_MODES.SWARM]: isDiamondSwarmReady,
  [AI_MODES.WLLAMA]: isWllamaAvailable,
  [AI_MODES.LOCAL_SERVER]: isLocalServerAvailable,
  [AI_MODES.LOCAL]: isLocalAIReady,
  [AI_MODES.CLOUD]: isCloudAIAvailable,
};

/**
 * Return the first mode in priorityOrder whose backend is currently ready,
 * or null if none are.
 */
const resolveFirstAvailableMode = (priorityOrder) => {
  for (const mode of priorityOrder) {
    if (AI_BACKEND_READY_CHECKS[mode]()) return mode;
  }
  return null;
};

/**
 * Get the effective AI mode based on availability
 * Priority: SWARM (WebGPU) → WLLAMA (WASM) → LOCAL_SERVER (llama.cpp) → LOCAL (legacy) → CLOUD
 */
export const getEffectiveAIMode = () => {
  const preferredMode = getAIMode();
  const { SWARM, WLLAMA, LOCAL_SERVER, LOCAL, CLOUD } = AI_MODES;

  // Warrant Council mode (preferred - WebGPU)
  if (preferredMode === SWARM) {
    return resolveFirstAvailableMode([
      SWARM,
      WLLAMA,
      LOCAL_SERVER,
      LOCAL,
      CLOUD,
    ]);
  }

  // Wllama mode (browser WASM - works everywhere)
  if (preferredMode === WLLAMA) {
    return resolveFirstAvailableMode([WLLAMA, SWARM, LOCAL_SERVER, CLOUD]);
  }

  // Local Server mode (llama.cpp server)
  if (preferredMode === LOCAL_SERVER) {
    return resolveFirstAvailableMode([LOCAL_SERVER, SWARM, WLLAMA, CLOUD]);
  }

  if (preferredMode === LOCAL) {
    // SWARM is checked first even though preferredMode is LOCAL — an
    // intentional upgrade to the newer backend when it's available.
    return resolveFirstAvailableMode([
      SWARM,
      WLLAMA,
      LOCAL_SERVER,
      LOCAL,
      CLOUD,
    ]);
  }

  if (preferredMode === CLOUD) {
    return resolveFirstAvailableMode([
      CLOUD,
      SWARM,
      WLLAMA,
      LOCAL_SERVER,
      LOCAL,
    ]);
  }

  // AUTO mode: prefer swarm → wllama → local_server → local → cloud
  return resolveFirstAvailableMode([SWARM, WLLAMA, LOCAL_SERVER, LOCAL, CLOUD]);
};

/**
 * Get the Gemini API key (only returns valid keys, not placeholders)
 */
const getGeminiApiKey = () => {
  // RT1-1: BYOK only — never fall back to a build-env key (would bake into dist).
  const storedKey = localStorage.getItem(GEMINI_KEY);
  if (isValidApiKey(storedKey)) return storedKey;
  return "";
};

/**
 * Build the Cloud AI system prompt, including DKB (Diamond Knowledge Base)
 * context injection based on the user's prompt.
 */
const buildCloudSystemPrompt = async (prompt, options) => {
  const { _buildSystemPromptWithDKB, buildSystemPrompt, buildDKBContext } =
    await getAISystemPrompts();

  let defaultSystemPrompt = buildSystemPrompt({
    task: options.taskType || "general",
    toolContext: options.toolContext,
    includeAppContext: true,
    includeRegulations: true,
    includeVeteranData: true,
  });

  // 💎 Inject DKB context based on user's prompt (makes Gemini "smart" on VA data)
  const useDKB = options.useDKB !== false; // Enabled by default
  if (useDKB) {
    try {
      const dkbContext = await buildDKBContext(prompt, {
        maxEntries: options.maxDKBEntries || 10,
        maxChars: options.maxDKBChars || 8000,
      });
      if (dkbContext) {
        defaultSystemPrompt += dkbContext;
        // eslint-disable-next-line no-console
        console.log(
          "[Gemini] 💎 DKB context injected for enhanced VA knowledge",
        );
      }
    } catch (dkbError) {
      console.warn(
        "[Gemini] DKB context injection failed, continuing without:",
        dkbError.message,
      );
    }
  }

  return defaultSystemPrompt;
};

/**
 * Resolve the effective Cloud AI generation config (systemPrompt/timeout/
 * temperature/topK/topP/maxTokens), applying an AI_PRESETS override when
 * requested.
 */
const resolveCloudGenerationConfig = (options, defaultSystemPrompt) => {
  const {
    systemPrompt = defaultSystemPrompt,
    maxTokens = getUserTokenLimit(), // Use user-configured limit or default
    temperature = 0.7,
    topK = 40,
    topP = 0.95,
    timeout = 60000, // 60 second timeout
    scrubPIIEnabled = true, // Enable PII scrubbing by default
    preset = null, // Optional: Use AI_PRESETS (e.g., 'LEGAL', 'CREATIVE')
  } = options;

  let finalConfig = { temperature, topK, topP, maxTokens };
  if (preset && AI_PRESETS[preset]) {
    const presetConfig = AI_PRESETS[preset];
    finalConfig = {
      temperature: presetConfig.temperature,
      topK: presetConfig.topK,
      topP: presetConfig.topP,
      maxTokens,
    };
  }

  return { systemPrompt, finalConfig, timeout, scrubPIIEnabled };
};

/**
 * Scrub PII from the full Cloud AI prompt (Client-Side Privacy Firewall),
 * warning when non-Latin scripts limit scrubbing coverage.
 */
const scrubCloudPromptPII = (fullPrompt, scrubPIIEnabled) => {
  if (!scrubPIIEnabled) return fullPrompt;

  let scrubbed = fullPrompt;
  const piiAnalysis = analyzePII(scrubbed);

  if (piiAnalysis.hasPII) {
    console.warn(`⚠️ PII Detected before AI call:`, piiAnalysis.types);

    const { scrubbedText, details } = scrubPII(scrubbed, {
      aggressive: true, // Also scrub DOB and addresses
      preservePartial: false, // Full redaction for safety
    });

    scrubbed = scrubbedText;
    // eslint-disable-next-line no-console
    console.info(`🛡️ PII Scrubbed:`, details);
  }

  // RT3-4: the PII patterns are US/English-centric and cannot reliably find PII in
  // non-Latin (CJK/Arabic/Korean/Cyrillic) narratives, so a non-English document may
  // carry unredacted PII to the cloud. Flag it (conservative handling) rather than
  // over-redacting, which would corrupt the analysis. Prefer local AI for these.
  if (containsSignificantNonLatin(scrubbed)) {
    console.warn(
      "⚠️ Non-Latin script detected: PII scrubbing has limited coverage for " +
        "non-English text; this cloud request may contain unredacted PII. " +
        "Consider local AI for sensitive non-English documents.",
    );
  }

  return scrubbed;
};

/**
 * Build the Gemini generateContent request body.
 */
const buildGeminiRequestBody = (fullPrompt, finalConfig) =>
  JSON.stringify({
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature: finalConfig.temperature,
      maxOutputTokens: finalConfig.maxTokens,
      topK: finalConfig.topK,
      topP: finalConfig.topP,
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ],
  });

/**
 * Fetch the Gemini API with a per-attempt abort timeout, retrying once on
 * timeout (transient backend slowness).
 */
const fetchGeminiWithRetry = async (requestBody, apiKey, timeout) => {
  const fetchWithTimeout = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: requestBody,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const toFriendlyFetchError = (fetchError) => {
    if (fetchError.name === "AbortError") {
      return new Error(
        "Request timed out. The AI is taking too long to respond. Please try again with a shorter prompt, or switch to Local AI.",
      );
    }
    if (
      fetchError.message?.includes("Failed to fetch") ||
      fetchError.message?.includes("NetworkError")
    ) {
      return new Error(
        "Network error. Please check your internet connection. If you are offline, try Local AI which works without internet.",
      );
    }
    return new Error(
      `Connection failed: ${fetchError.message}. If this persists, try switching to Local AI.`,
    );
  };

  try {
    return await fetchWithTimeout();
  } catch (fetchError) {
    if (fetchError.name !== "AbortError") {
      throw toFriendlyFetchError(fetchError);
    }
    // Timeouts are often transient backend slowness — retry once
    console.warn(
      `⏱️ Cloud AI request timed out after ${timeout / 1000}s — retrying once...`,
    );
    try {
      return await fetchWithTimeout();
    } catch (retryError) {
      throw toFriendlyFetchError(retryError);
    }
  }
};

/**
 * Translate a non-ok Gemini response into a user-friendly error and throw it.
 */
const handleGeminiErrorResponse = async (response) => {
  const errorData = await response.json().catch(() => ({}));
  const errorMessage = errorData.error?.message || "";

  // Handle specific HTTP status codes with user-friendly messages
  switch (response.status) {
    case 400:
      if (errorMessage.includes("API key")) {
        throw new Error(
          "Invalid API key. Please check your Gemini API key in Settings.",
        );
      }
      throw new Error(
        "Bad request. The AI could not process your input. Please try rephrasing.",
      );

    case 401:
    case 403:
      throw new Error(
        "API key unauthorized. Your Gemini API key may be invalid or expired. Please check Settings.",
      );

    case 404:
      throw new Error(
        "AI model endpoint not found. Please refresh the page and try again. If this persists, the API endpoint may have changed.",
      );

    case 429:
      throw new Error(
        "Rate limit reached. Too many requests - please wait a minute before trying again, or consider switching to Local AI.",
      );

    case 500:
    case 502:
    case 503:
    case 504:
      throw new Error(
        "Google's AI servers are temporarily unavailable. Please try again in a few minutes, or switch to Local AI.",
      );

    default:
      // Check for region/access blocks
      if (
        errorMessage.includes("not available") ||
        errorMessage.includes("region") ||
        errorMessage.includes("country")
      ) {
        throw new Error(
          "Gemini API may not be available in your region. Consider using Local AI for 100% private, offline processing.",
        );
      }
      throw new Error(
        errorMessage ||
          `Cloud AI error (${response.status}). Please try again or switch to Local AI.`,
      );
  }
};

/**
 * Generate text using Cloud AI (Gemini)
 * 💎 Now enhanced with DKB (Diamond Knowledge Base) context injection
 */
const generateWithCloudAI = async (prompt, options = {}) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  const defaultSystemPrompt = await buildCloudSystemPrompt(prompt, options);
  const { systemPrompt, finalConfig, timeout, scrubPIIEnabled } =
    resolveCloudGenerationConfig(options, defaultSystemPrompt);

  let fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  fullPrompt = scrubCloudPromptPII(fullPrompt, scrubPIIEnabled);

  const requestBody = buildGeminiRequestBody(fullPrompt, finalConfig);
  const response = await fetchGeminiWithRetry(requestBody, apiKey, timeout);

  if (!response.ok) {
    await handleGeminiErrorResponse(response);
  }

  const data = await response.json();
  // C-H05: surface safety blocks / truncation rather than "No response generated".
  return interpretGeminiResponse(data);
};

/**
 * Scrub PII from a Warrant Council prompt (Client-Side Privacy Firewall).
 */
const scrubPromptForWarrantCouncil = (prompt, scrubPIIEnabled) => {
  if (!scrubPIIEnabled) return prompt;
  const piiAnalysis = analyzePII(prompt);
  if (!piiAnalysis.hasPII) return prompt;

  console.warn(
    `⚠️ PII Detected before Warrant Council call:`,
    piiAnalysis.types,
  );
  const { scrubbedText, details } = scrubPII(prompt, {
    aggressive: true,
    preservePartial: false,
  });
  // eslint-disable-next-line no-console
  console.info(`🛡️ PII Scrubbed (Warrant Council):`, details);
  return scrubbedText;
};

/**
 * 💎 Inject DKB context for Warrant Council (makes specialized agents VA-smart!)
 */
const injectDKBForWarrantCouncil = async (prompt, options, useDKB) => {
  if (!useDKB) return prompt;
  try {
    const { buildDKBContext } = await getAISystemPrompts();
    const dkbContext = await buildDKBContext(prompt, {
      maxEntries: options.maxDKBEntries || 6, // Smaller for fine-tuned models (they know more already)
      maxChars: options.maxDKBChars || 4000,
    });
    if (dkbContext) {
      // eslint-disable-next-line no-console
      console.log(
        "[WarrantCouncil] 💎 DKB context injected - agents have live knowledge base access",
      );
      return prompt + dkbContext;
    }
  } catch (dkbError) {
    console.warn(
      "[WarrantCouncil] DKB context injection failed:",
      dkbError.message,
    );
  }
  return prompt;
};

/**
 * Determine the right Warrant Council agent based on tool or task type.
 */
const resolveWarrantCouncilAgent = (toolId, taskType) => {
  if (toolId) {
    return TOOL_AGENT_MAP[toolId] || "auditor";
  }
  if (taskType) {
    const taskToAgent = {
      cfile: "auditor",
      nexus: "writer",
      statement: "writer",
      "personal-statement": "writer",
      rating: "rater",
      calculator: "rater",
      tdiu: "rater",
      legal: "auditor",
      analysis: "auditor",
      document: "auditor",
      writing: "writer",
      general: "auditor",
    };
    return taskToAgent[taskType] || "auditor";
  }
  return "auditor";
};

/**
 * Generate text using Warrant Council (Primary AI Engine)
 * Routes to the appropriate specialized agent based on task type
 * 💎 Now enhanced with DKB context injection
 */
const generateWithWarrantCouncil = async (prompt, options = {}) => {
  const {
    taskType = "general",
    toolId = null,
    maxTokens = getUserTokenLimit(),
    temperature = 0.7,
    scrubPIIEnabled = true,
    useDKB = true, // Enable DKB by default
    timeout = null,
  } = options;

  const scrubbedPrompt = scrubPromptForWarrantCouncil(prompt, scrubPIIEnabled);
  const enhancedPrompt = await injectDKBForWarrantCouncil(
    scrubbedPrompt,
    options,
    useDKB,
  );

  const agentId = resolveWarrantCouncilAgent(toolId, taskType);

  // eslint-disable-next-line no-console
  console.log(
    `🎖️ Warrant Council: Using ${agentId.toUpperCase()} agent for ${taskType || toolId || "general"} task`,
  );

  try {
    swarmGenerating = true;

    // 💎 Use enhanced prompt with DKB context
    const inferencePromise = generateWithSwarm(enhancedPrompt, {
      agentId,
      toolId,
      maxTokens,
      temperature,
      // Thread caller-supplied system prompt and schema through so analyzeChunk
      // can replace the AUDITOR default prompt with the compact C-File version
      // and enable XGrammar constrained decoding for the chunk loop.
      ...(options.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
      ...(options.responseFormat
        ? { responseFormat: options.responseFormat }
        : {}),
    });

    // Guard against GPU-level hangs (WebGPU compute never signals completion).
    // Without this, a hung engine.chat.completions.create() blocks indefinitely
    // because JavaScript Promises wrapping GPU fence waits cannot be cancelled.
    const result = timeout
      ? await Promise.race([
          inferencePromise,
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `WebGPU inference timed out after ${timeout / 1000}s`,
                  ),
                ),
              timeout,
            ),
          ),
        ])
      : await inferencePromise;

    swarmGenerating = false;
    return result.text;
  } catch (err) {
    swarmGenerating = false;
    throw new Error(`Warrant Council error (${agentId}): ${err.message}`);
  }
};

/**
 * 🌐 Generate text using Wllama (Browser WASM inference)
 * 💎 Now enhanced with DKB context injection
 */
const generateWithWllama = async (prompt, options = {}) => {
  const {
    _taskType = "general",
    maxTokens = getUserTokenLimit(),
    temperature = 0.7,
    scrubPIIEnabled = true,
    onStream = null,
    useDKB = true,
  } = options;

  // PII Scrubbing
  let scrubbedPrompt = prompt;
  if (scrubPIIEnabled) {
    const piiAnalysis = analyzePII(prompt);
    if (piiAnalysis.hasPII) {
      console.warn(`⚠️ PII Detected before Wllama call:`, piiAnalysis.types);
      const { scrubbedText, details } = scrubPII(prompt, {
        aggressive: true,
        preservePartial: false,
      });
      scrubbedPrompt = scrubbedText;
      // eslint-disable-next-line no-console
      console.info(`🛡️ PII Scrubbed (Wllama):`, details);
    }
  }

  // 💎 Inject DKB context for Wllama
  let enhancedPrompt = scrubbedPrompt;
  if (useDKB) {
    try {
      const { buildDKBContext } = await getAISystemPrompts();
      const dkbContext = await buildDKBContext(scrubbedPrompt, {
        maxEntries: options.maxDKBEntries || 6,
        maxChars: options.maxDKBChars || 4000,
      });
      if (dkbContext) {
        enhancedPrompt = scrubbedPrompt + dkbContext;
        // eslint-disable-next-line no-console
        console.log("[Wllama] 💎 DKB context injected");
      }
    } catch (dkbError) {
      console.warn("[Wllama] DKB context injection failed:", dkbError.message);
    }
  }

  try {
    // eslint-disable-next-line no-console
    console.log(
      `🌐 Wllama: Generating with ${wllamaCurrentModel || "auditor"} model...`,
    );

    const result = await wllamaService.chatCompletion(enhancedPrompt, {
      maxTokens,
      temperature,
      onToken: onStream ? (token) => onStream(token) : null,
    });

    if (!result.success) {
      throw new Error(result.error || "Wllama generation failed");
    }

    return result.text;
  } catch (err) {
    throw new Error(`Wllama error: ${err.message}`);
  }
};

/**
 * 🖥️ Generate text using Local Server (llama.cpp API)
 * 💎 Now enhanced with DKB context injection
 */
const generateWithLocalServer = async (prompt, options = {}) => {
  const {
    _taskType = "general",
    maxTokens = getUserTokenLimit(),
    temperature = 0.7,
    scrubPIIEnabled = true,
    onStream = null,
    useDKB = true,
  } = options;

  // PII Scrubbing
  let scrubbedPrompt = prompt;
  if (scrubPIIEnabled) {
    const piiAnalysis = analyzePII(prompt);
    if (piiAnalysis.hasPII) {
      console.warn(
        `⚠️ PII Detected before Local Server call:`,
        piiAnalysis.types,
      );
      const { scrubbedText, details } = scrubPII(prompt, {
        aggressive: true,
        preservePartial: false,
      });
      scrubbedPrompt = scrubbedText;
      // eslint-disable-next-line no-console
      console.info(`🛡️ PII Scrubbed (Local Server):`, details);
    }
  }

  // 💎 Inject DKB context for Local Server
  let enhancedPrompt = scrubbedPrompt;
  if (useDKB) {
    try {
      const { buildDKBContext } = await getAISystemPrompts();
      const dkbContext = await buildDKBContext(scrubbedPrompt, {
        maxEntries: options.maxDKBEntries || 8,
        maxChars: options.maxDKBChars || 6000,
      });
      if (dkbContext) {
        enhancedPrompt = scrubbedPrompt + dkbContext;
        // eslint-disable-next-line no-console
        console.log("[LocalServer] 💎 DKB context injected");
      }
    } catch (dkbError) {
      console.warn(
        "[LocalServer] DKB context injection failed:",
        dkbError.message,
      );
    }
  }

  try {
    // eslint-disable-next-line no-console
    console.log("🖥️ Local Server: Generating via llama.cpp API...");

    const result = await localServerClient.chatCompletion(enhancedPrompt, {
      maxTokens,
      temperature,
      stream: !!onStream,
      onChunk: onStream,
    });

    if (!result.success) {
      throw new Error(result.error || "Local server generation failed");
    }

    return result.text;
  } catch (err) {
    throw new Error(`Local Server error: ${err.message}`);
  }
};

/**
 * Throw a helpful error if the legacy Local AI engine isn't ready to generate.
 */
const assertLocalAIReady = () => {
  if (localAIInitializing) {
    throw new Error(
      "Local AI is still warming up. Please wait for the model to finish loading before sending messages.",
    );
  }
  if (!localAIEngine) {
    throw new Error(
      "Local AI not initialized. Please initialize the Neural Engine first.",
    );
  }
  if (!localAIReady) {
    throw new Error(
      "Local AI engine exists but is not ready. This may indicate a failed initialization - please try reloading the model.",
    );
  }
};

/**
 * Build the Local AI system prompt, including DKB context injection.
 */
const buildLocalAISystemPrompt = async (prompt, options) => {
  const { buildSystemPrompt, buildDKBContext } = await getAISystemPrompts();
  let defaultSystemPrompt = buildSystemPrompt({
    task: options.taskType || "general",
    toolContext: options.toolContext,
    includeAppContext: true,
    includeRegulations: true,
    includeVeteranData: true,
  });

  // 💎 Inject DKB context for Local AI (makes local models VA-smart!)
  const useDKB = options.useDKB !== false; // Enabled by default
  if (useDKB) {
    try {
      const dkbContext = await buildDKBContext(prompt, {
        maxEntries: options.maxDKBEntries || 8, // Slightly less than cloud due to context limits
        maxChars: options.maxDKBChars || 6000, // Smaller context for local models
      });
      if (dkbContext) {
        defaultSystemPrompt += dkbContext;
        // eslint-disable-next-line no-console
        console.log(
          "[LocalAI] 💎 DKB context injected - local model now has VA knowledge base access",
        );
      }
    } catch (dkbError) {
      console.warn(
        "[LocalAI] DKB context injection failed, continuing without:",
        dkbError.message,
      );
    }
  }

  return defaultSystemPrompt;
};

/**
 * Resolve the effective Local AI generation config, applying an AI_PRESETS
 * override when requested.
 */
const resolveLocalAIConfig = (options, defaultSystemPrompt) => {
  const {
    systemPrompt = defaultSystemPrompt,
    maxTokens = getUserTokenLimit(), // Use user-configured limit or default
    temperature = 0.7,
    topK = 40,
    topP = 0.95,
    scrubPIIEnabled = true, // Enable PII scrubbing by default
    preset = null, // Optional: Use AI_PRESETS
    onStream,
  } = options;

  let finalConfig = { temperature, topK, topP, maxTokens };
  if (preset && AI_PRESETS[preset]) {
    const presetConfig = AI_PRESETS[preset];
    finalConfig = {
      temperature: presetConfig.temperature,
      topK: presetConfig.topK || 40,
      topP: presetConfig.topP,
      maxTokens,
    };
  }

  return { systemPrompt, finalConfig, scrubPIIEnabled, onStream };
};

/**
 * Scrub PII from a Local AI prompt (Client-Side Privacy Firewall).
 */
const scrubPromptForLocalAI = (prompt, scrubPIIEnabled) => {
  if (!scrubPIIEnabled) return prompt;
  const piiAnalysis = analyzePII(prompt);
  if (!piiAnalysis.hasPII) return prompt;

  console.warn(`⚠️ PII Detected before Local AI call:`, piiAnalysis.types);
  const { scrubbedText, details } = scrubPII(prompt, {
    aggressive: true,
    preservePartial: false,
  });
  // eslint-disable-next-line no-console
  console.info(`🛡️ PII Scrubbed (Local AI):`, details);
  return scrubbedText;
};

/**
 * Clean a Local AI response - remove thinking tags and detect degenerate
 * output. Handles DeepSeek R1 and other reasoning models that output
 * <think> tags.
 */
const cleanLocalAIResponse = (text) => {
  if (!text) return "";

  // Remove <think>...</think> blocks (DeepSeek R1, QwQ, and other reasoning models)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Remove unclosed <think> tags (model may have been interrupted mid-thought)
  cleaned = cleaned.replace(/<think>[\s\S]*/gi, "").trim();

  // Remove orphaned </think> tags (sometimes R1 outputs these without opening tag)
  cleaned = cleaned.replace(/<\/think>/gi, "").trim();

  // Remove any remaining think-like patterns (</think>'ve, </think>", etc.)
  cleaned = cleaned.replace(/<\/think>[^\s]*/gi, "").trim();

  // Detect degenerate/repetitive output (same 2-10 char pattern repeated 8+ times)
  const repetitionPattern = /(.{2,10})\1{8,}/;
  if (repetitionPattern.test(cleaned)) {
    console.warn("⚠️ Detected degenerate output (repetition collapse)");
    const match = cleaned.match(repetitionPattern);
    if (match) {
      const repetitiveSection = match[0];
      cleaned = cleaned.replace(
        repetitiveSection,
        "[Output truncated due to repetition]",
      );
    }
  }

  // Detect R1-style gibberish (multiple quotes/ellipsis/fragments indicating confused output)
  const gibberishPatterns = [
    /(\.{3,}\s*){5,}/, // Multiple ellipsis sequences
    /("\s*){5,}/, // Multiple quote sequences
    /(Hmm|Ok|Wait|But|Hence|Thus|Therefore)[\s\S]{0,20}\1[\s\S]{0,20}\1/gi, // Repeated filler words
    /\b(think|thinking|thought)\b[\s\S]{0,50}\b\1\b[\s\S]{0,50}\b\1\b/gi, // Repeated "think"
  ];

  for (const pattern of gibberishPatterns) {
    if (pattern.test(cleaned)) {
      console.warn("⚠️ Detected R1-style confused output");
      // Try to extract any meaningful content before the gibberish
      const lines = cleaned.split("\n").filter((l) => l.trim());
      const meaningfulLines = lines.filter((line) => {
        const lower = line.toLowerCase();
        return (
          !lower.includes("hmm") &&
          !lower.includes("wait") &&
          !lower.includes("confuse") &&
          !lower.includes("unclear") &&
          line.length > 20 &&
          !/^[\s"'.\\,!?]+$/.test(line)
        );
      });
      if (meaningfulLines.length > 0) {
        cleaned = meaningfulLines.join("\n");
      } else {
        cleaned =
          "I apologize, but I'm having trouble generating a clear response. Please try rephrasing your question or using a different AI model.";
      }
      break;
    }
  }

  return cleaned;
};

/**
 * Run a streaming Local AI generation, aborting early if degenerate
 * (repetition-collapsed) output is detected.
 */
const runLocalAIStreaming = async (generationConfig, onStream, releaseLock) => {
  let fullResponse = "";
  const chunks = await localAIEngine.chat.completions.create({
    ...generationConfig,
    stream: true,
  });

  for await (const chunk of chunks) {
    const delta = chunk.choices[0]?.delta?.content || "";
    fullResponse += delta;

    // Clean and send the streamed response
    const cleanedResponse = cleanLocalAIResponse(fullResponse);
    onStream(delta, cleanedResponse);

    // Early abort if we detect degenerate output during streaming
    if (fullResponse.length > 200) {
      const last200 = fullResponse.slice(-200);
      const repetitionPattern = /(.{2,10})\1{8,}/;
      if (repetitionPattern.test(last200)) {
        console.warn(
          "⚠️ Aborting due to degenerate output detected during streaming",
        );
        try {
          await localAIEngine.interruptGenerate?.();
        } catch (e) {
          console.warn("Failed to interrupt generation:", e);
        }
        break;
      }
    }
  }

  localAIGenerating = false;
  releaseLock();
  return cleanLocalAIResponse(fullResponse);
};

/**
 * Run a non-streaming Local AI generation.
 */
const runLocalAINonStreaming = async (generationConfig, releaseLock) => {
  // eslint-disable-next-line no-console
  console.log(
    "🔧 Local AI generation config:",
    JSON.stringify(generationConfig, null, 2).substring(0, 500),
  );
  const response =
    await localAIEngine.chat.completions.create(generationConfig);
  // eslint-disable-next-line no-console
  console.log(
    "🔧 Local AI raw response:",
    JSON.stringify(response, null, 2).substring(0, 1000),
  );

  localAIGenerating = false;

  // Check for aborted response (WebLLM returns empty content when aborted)
  const finishReason = response.choices[0]?.finish_reason;
  const rawContent = response.choices[0]?.message?.content || "";

  if (finishReason === "abort" && !rawContent) {
    console.warn(
      "⚠️ Generation was aborted (possibly concurrent request conflict)",
    );
    releaseLock();
    throw new Error(
      "AI generation was interrupted. Please try again. If this keeps happening, refresh the page.",
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    "🔧 Local AI rawContent:",
    rawContent.substring(0, 500) || "(empty)",
  );
  releaseLock();
  return cleanLocalAIResponse(rawContent);
};

/**
 * Map a raw Local AI generation error to a user-friendly message.
 */
const mapLocalAIError = (err) => {
  const errorMsg = err.message || "";

  // WebLLM specific errors
  if (
    errorMsg.includes("ModelNotLoadedError") ||
    errorMsg.includes("not loaded")
  ) {
    return new Error(
      "Local AI model not loaded. Please wait for the model to finish loading, or try reloading.",
    );
  }
  if (errorMsg.includes("WebGPU") || errorMsg.includes("GPU")) {
    return new Error(
      "GPU error. Your device may not fully support Local AI. Try refreshing the page, or switch to Cloud AI.",
    );
  }
  if (errorMsg.includes("out of memory") || errorMsg.includes("OOM")) {
    return new Error(
      "GPU out of memory. Try a smaller model (like Llama 3.2 1B), close other browser tabs, or switch to Cloud AI.",
    );
  }
  if (errorMsg.includes("aborted") || errorMsg.includes("cancelled")) {
    return new Error("Generation was cancelled.");
  }

  // Re-throw with context
  return new Error(
    `Local AI error: ${errorMsg}. If this persists, try reloading the model or switching to Cloud AI.`,
  );
};

/**
 * Generate text using Local AI (Legacy WebLLM - fallback only)
 */
const generateWithLocalAI = async (prompt, options = {}) => {
  // First try Warrant Council if available
  if (isDiamondSwarmReady()) {
    // eslint-disable-next-line no-console
    console.log(
      "🎖️ Routing to Warrant Council (upgraded from legacy local AI)",
    );
    return generateWithWarrantCouncil(prompt, options);
  }

  assertLocalAIReady();

  // Acquire generation lock - this ensures only one generation at a time
  // and properly serializes concurrent requests
  const releaseLock = await acquireGenerationLock();

  // Double-check we're not already generating (belt and suspenders)
  if (localAIGenerating) {
    releaseLock();
    console.warn(
      "⚠️ localAIGenerating flag still set despite lock - possible state bug",
    );
    throw new Error(
      "Another AI generation is in progress. Please wait for it to complete.",
    );
  }

  // Build comprehensive system prompt if not provided (lazy load)
  // 💎 Now also injects DKB context for enhanced VA knowledge (same as cloud AI)
  const defaultSystemPrompt = await buildLocalAISystemPrompt(prompt, options);
  const { systemPrompt, finalConfig, scrubPIIEnabled, onStream } =
    resolveLocalAIConfig(options, defaultSystemPrompt);

  const scrubbedPrompt = scrubPromptForLocalAI(prompt, scrubPIIEnabled);

  try {
    localAIGenerating = true;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: scrubbedPrompt },
    ];

    // Generation config with repetition penalty to prevent degenerate output
    const generationConfig = {
      messages,
      max_tokens: finalConfig.maxTokens,
      temperature: finalConfig.temperature,
      top_p: finalConfig.topP,
      // Repetition penalty to prevent loops (1.0 = no penalty, >1.0 = penalize repetition)
      repetition_penalty: 1.1,
      // Frequency penalty (penalize tokens that appear frequently)
      frequency_penalty: 0.3,
      // Presence penalty (penalize tokens that have appeared at all)
      presence_penalty: 0.1,
    };

    if (onStream) {
      return await runLocalAIStreaming(generationConfig, onStream, releaseLock);
    }
    return await runLocalAINonStreaming(generationConfig, releaseLock);
  } catch (err) {
    localAIGenerating = false;
    releaseLock();
    throw mapLocalAIError(err);
  }
};

/**
 * Get user's selected AI preset from localStorage
 */
const getUserPreset = () => {
  try {
    const saved = localStorage.getItem("vetrate_ai_preset");
    if (saved && AI_PRESETS[saved]) {
      return saved;
    }
  } catch (e) {
    console.warn("Error loading preset:", e);
  }
  return null; // Use function defaults if no preset
};

/**
 * Throw a helpful error if the legacy Local AI engine can't run vision input.
 */
const assertVisionModelReady = () => {
  if (!localAIIsVisionModel) {
    throw new Error(
      "Vision model not loaded. Please load a vision model (like Vet-Rate Vision Phi) to analyze images directly.",
    );
  }
  if (!localAIEngine) {
    throw new Error(
      "Local AI engine not initialized. Please wait for model to load.",
    );
  }
  if (!localAIReady) {
    throw new Error(
      "Local AI not ready. Please wait for model to finish loading.",
    );
  }
};

/**
 * Normalize imageUrls to an array and validate each is a base64 data URL.
 */
const normalizeVisionImages = (imageUrls) => {
  const images = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  for (const url of images) {
    if (!url.startsWith("data:image")) {
      throw new Error(
        "Image must be a base64 data URL (data:image/...). Use renderPDFToImages or convert images first.",
      );
    }
  }
  return images;
};

/**
 * Build the multimodal (OpenAI vision format) messages array for a vision
 * model request.
 */
const buildVisionMessages = (prompt, images, systemPrompt) => {
  // Build multimodal message content (OpenAI vision format)
  // WebLLM follows OpenAI's chat completion API for vision models
  const contentParts = [{ type: "text", text: prompt }];
  for (const imageUrl of images) {
    contentParts.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: contentParts });

  // eslint-disable-next-line no-console
  console.log(
    "🖼️ Vision request - messages structure:",
    JSON.stringify(
      messages.map((m) => ({
        role: m.role,
        contentType: Array.isArray(m.content)
          ? `array[${m.content.length}]`
          : typeof m.content,
        contentParts: Array.isArray(m.content)
          ? m.content.map((p) => p.type)
          : null,
      })),
      null,
      2,
    ),
  );

  return messages;
};

/**
 * Map a raw vision-model generation error to a user-friendly message.
 */
const mapVisionError = (err) => {
  const errorMsg = err.message || "";

  if (errorMsg.includes("not of type ModelType.VLM")) {
    return new Error(
      "The loaded model does not support image input. Please load a vision model like Vet-Rate Vision Phi.",
    );
  }
  if (errorMsg.includes("image_url")) {
    return new Error(
      "Image format error. Please ensure images are valid base64 data URLs.",
    );
  }

  return new Error(`Vision model error: ${errorMsg}`);
};

/**
 * Generate AI response with image input (for vision models)
 * This function sends actual images to the vision model instead of OCR text.
 *
 * @param {string} prompt - The text prompt describing what to analyze
 * @param {string|string[]} imageUrls - Base64 data URLs of images to analyze (data:image/jpeg;base64,...)
 * @param {Object} options - Generation options
 * @param {string} options.systemPrompt - System prompt for context
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {number} options.temperature - Temperature for generation
 * @returns {Promise<{text: string, mode: string}>} Generated text and mode used
 */
export const generateAIWithImage = async (prompt, imageUrls, options = {}) => {
  assertVisionModelReady();

  const images = normalizeVisionImages(imageUrls);

  // eslint-disable-next-line no-console
  console.log(
    `🖼️ generateAIWithImage: ${images.length} image(s), prompt: ${prompt.substring(0, 100)}...`,
  );

  const {
    systemPrompt = "",
    maxTokens = getUserTokenLimit(),
    temperature = 0.2, // Lower temperature for document analysis
  } = options;

  localAIGenerating = true;

  try {
    const messages = buildVisionMessages(prompt, images, systemPrompt);

    const generationConfig = {
      messages,
      max_tokens: maxTokens,
      temperature,
      top_p: 0.95,
    };

    // Non-streaming for image analysis (more reliable)
    const response =
      await localAIEngine.chat.completions.create(generationConfig);

    localAIGenerating = false;
    const rawContent = response.choices[0]?.message?.content || "";
    // eslint-disable-next-line no-console
    console.log(
      "🖼️ Vision model response:",
      rawContent.substring(0, 500) || "(empty)",
    );

    // Check for empty response - this indicates the model failed to process the image
    if (!rawContent || rawContent.trim().length === 0) {
      console.warn("⚠️ Vision model returned empty response");
      // Return with empty flag so caller can handle appropriately
      return {
        text: "",
        mode: "local",
        isVisionResponse: true,
        isEmpty: true,
      };
    }

    return {
      text: rawContent,
      mode: "local",
      isVisionResponse: true,
    };
  } catch (err) {
    localAIGenerating = false;
    console.error("Vision model error:", err);
    throw mapVisionError(err);
  }
};

/**
 * Unified AI Generation Function
 * Automatically routes to the appropriate AI backend based on user preference
 *
 * @param {string} prompt - The user prompt
 * @param {Object} options - Generation options
 * @param {string} options.taskType - Type of task for system prompt (cfile, nexus, statement, etc.)
 * @param {object} options.context - Additional context for system prompt
 * @param {string} options.systemPrompt - Override system prompt for context
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {number} options.temperature - Temperature for generation
 * @param {string} options.preset - AI preset name (LEGAL, CREATIVE, ADVERSARIAL, BALANCED)
 * @param {function} options.onStream - Callback for streaming (local AI only)
 * @param {boolean} options.skipCrisisCheck - Skip crisis interception (for internal use)
 * @param {boolean} options.skipValidation - Skip AI response validation
 * @param {boolean} options.skipHallucinationCheck - Skip diagnostic code validation
 * @param {boolean} options.skipFeatureCheck - Skip feature flag check
 * @param {number} options.timeout - Timeout in milliseconds (default: 120000 = 2 minutes)
 * @returns {Promise<{text: string, mode: string}>} Generated text and mode used
 */

// Circuit breaker: after 3 consecutive generation failures, stop hammering the
// backends (each attempt can burn a full 60-120s timeout) and surface a clear
// error instead. Half-opens after a cooldown so a fixed setup can recover.
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30000;
let consecutiveGenerationFailures = 0;
let circuitBreakerOpenedAt = 0;

export const resetAICircuitBreaker = () => {
  consecutiveGenerationFailures = 0;
  circuitBreakerOpenedAt = 0;
};

function _recordGenerationFailure(err) {
  // Crisis interception is a safety block, not an engine failure
  if (err.message !== "CRISIS_DETECTED") {
    consecutiveGenerationFailures++;
    if (consecutiveGenerationFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      circuitBreakerOpenedAt = Date.now();
    }
  }
}

// C-H06: record every production AI call in the tamper-evident, hash-chained
// audit log (SHA-256 digests only — never raw prompt/output PII). Fire-and-
// forget so a logging failure can never break the AI response.
function _logAiCallAudit(prompt, result, options, startedAt) {
  const auditOutput =
    typeof result === "string" ? result : (result?.text ?? "");
  logModelCallWithDigests({
    tag: options.toolId || options.taskType || "generateAI",
    model: options.forceMode || "auto",
    prompt: typeof prompt === "string" ? prompt : JSON.stringify(prompt ?? ""),
    output: auditOutput,
    durationMs: Date.now() - startedAt,
    meta: { expectJSON: !!options.expectJSON },
  }).catch(() => {});
}

// PI-01: last-mile exfil filter — strip non-allow-listed URLs from model output
// that reaches the DOM (a malicious PDF / OCR / retrieved chunk can social-engineer
// the model into surfacing an attacker URL). Opt out for JSON-only / internal calls,
// whose output is parsed not rendered as free text and would be corrupted. Gov links
// survive (see sanitize.LLM_OUTPUT_URL_ALLOWLIST).
function _stripUrlsFromResult(result, options) {
  if (options.expectJSON || options.skipUrlStrip) return result;
  if (typeof result === "string") {
    return stripUntrustedUrls(result);
  }
  if (result && typeof result.text === "string") {
    result.text = stripUntrustedUrls(result.text);
  }
  return result;
}

export const generateAI = async (prompt, options = {}) => {
  if (
    consecutiveGenerationFailures >= CIRCUIT_BREAKER_THRESHOLD &&
    Date.now() - circuitBreakerOpenedAt < CIRCUIT_BREAKER_COOLDOWN_MS
  ) {
    throw new Error(
      `AI_CIRCUIT_OPEN: AI generation has failed ${consecutiveGenerationFailures} times in a row, so further attempts are paused. ` +
        `Please check your AI settings (is the local model loaded? is your API key valid? are you online?) and try again in ${Math.ceil(CIRCUIT_BREAKER_COOLDOWN_MS / 1000)} seconds.`,
    );
  }

  // Apply timeout wrapper to prevent indefinite hangs
  const TIMEOUT_MS = options.timeout || 120000; // 2 minutes default
  let timeoutId;
  const startedAt = Date.now();

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `AI_TIMEOUT: Request exceeded ${TIMEOUT_MS / 1000} second limit`,
        ),
      );
    }, TIMEOUT_MS);
  });

  try {
    // Race between actual generation and timeout
    const result = await Promise.race([
      generateAIInternal(prompt, options),
      timeoutPromise,
    ]);

    // Clear timeout on success
    clearTimeout(timeoutId);
    resetAICircuitBreaker();

    _logAiCallAudit(prompt, result, options, startedAt);

    return _stripUrlsFromResult(result, options);
  } catch (err) {
    // Clear timeout on error
    if (timeoutId) clearTimeout(timeoutId);

    _recordGenerationFailure(err);

    // Enhance timeout errors with helpful message
    if (err.message && err.message.includes("AI_TIMEOUT")) {
      throw new Error(
        `AI request timed out after ${TIMEOUT_MS / 1000} seconds. ` +
          `This usually means the AI model is still loading, your document is too large, or there are network issues. ` +
          `Please wait for the AI to fully load, try with a shorter input, or check your connection.`,
      );
    }

    throw err;
  }
};

async function _checkAiFeatureFlags(options) {
  if (options.skipFeatureCheck) return;

  const aiEnabled = await isFeatureEnabled("ai_enabled");
  if (!aiEnabled) {
    throw new Error(
      "AI features are temporarily disabled. Please try again later.",
    );
  }

  // Check mode-specific flags
  const effectiveMode = getEffectiveAIMode();
  if (effectiveMode === AI_MODES.LOCAL) {
    const localEnabled = await isFeatureEnabled("local_ai");
    if (!localEnabled) {
      throw new Error(
        "Local AI is temporarily disabled. Please use Cloud AI or try again later.",
      );
    }
  } else if (effectiveMode === AI_MODES.CLOUD) {
    const cloudEnabled = await isFeatureEnabled("cloud_ai");
    if (!cloudEnabled) {
      throw new Error(
        "Cloud AI is temporarily disabled. Please use Local AI or try again later.",
      );
    }
  }
}

async function _checkCrisisSafety(prompt, options) {
  if (options.skipCrisisCheck) return;
  const crisisResult = await interceptBeforeAICall(prompt);
  if (crisisResult.shouldBlock) {
    throw new Error("CRISIS_DETECTED");
  }
}

async function _buildFullPrompt(prompt, options) {
  // Build system prompt with anti-hallucination guardrails (unless overridden)
  const { buildSystemPrompt } = await getAISystemPrompts();
  const systemPrompt =
    options.systemPrompt ||
    buildSystemPrompt({
      task: options.taskType || "general",
      toolContext: options.toolContext,
      includeAppContext: true,
      includeRegulations: true,
      includeVeteranData: true,
    });

  // Apply user's saved preset if no preset specified in options
  const effectivePreset = options.preset || getUserPreset();

  // Merge options with preset (options take precedence)
  const enhancedOptions = {
    ...options,
    preset: effectivePreset,
  };

  // Prepend system prompt to user prompt
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\nUser Request:\n${prompt}`
    : prompt;

  return { fullPrompt, enhancedOptions };
}

async function _dispatchAiGeneration(
  effectiveMode,
  fullPrompt,
  enhancedOptions,
  options,
) {
  // Dispatch follows getEffectiveAIMode() — never implicitly upgrade to a
  // backend the user didn't choose. getEffectiveAIMode() already handles the
  // full fallback chain (SWARM → WLLAMA → LOCAL_SERVER → LOCAL → CLOUD).
  const useSwarm = effectiveMode === AI_MODES.SWARM;
  const useWllama = effectiveMode === AI_MODES.WLLAMA;
  const useLocalServer = effectiveMode === AI_MODES.LOCAL_SERVER;
  const useCloud =
    effectiveMode === AI_MODES.CLOUD ||
    (options.preferCloud === true && isCloudAIAvailable());
  const useLocal = effectiveMode === AI_MODES.LOCAL;

  if (useSwarm && isDiamondSwarmReady()) {
    // 🎖️ Warrant Council - Primary AI Engine (WebGPU)
    const text = await generateWithWarrantCouncil(fullPrompt, enhancedOptions);
    const agentUsed = getCurrentAgent() || "auditor";
    // eslint-disable-next-line no-console
    console.log(
      `🎖️ Generated with Warrant Council (${agentUsed.toUpperCase()} agent)`,
    );
    return { text, usedMode: AI_MODES.SWARM, agentUsed };
  }
  if (useWllama && isWllamaAvailable()) {
    // 🌐 Wllama - Browser WASM inference
    const text = await generateWithWllama(fullPrompt, enhancedOptions);
    const agentUsed = wllamaCurrentModel || "auditor";
    // eslint-disable-next-line no-console
    console.log(`🌐 Generated with Wllama (${agentUsed.toUpperCase()} model)`);
    return { text, usedMode: AI_MODES.WLLAMA, agentUsed };
  }
  if (useLocalServer && isLocalServerAvailable()) {
    // 🖥️ Local Server - llama.cpp API
    const text = await generateWithLocalServer(fullPrompt, enhancedOptions);
    // eslint-disable-next-line no-console
    console.log("🖥️ Generated with local llama.cpp server");
    return { text, usedMode: AI_MODES.LOCAL_SERVER, agentUsed: null };
  }
  if (useLocal && isLocalAIReady()) {
    // Legacy local AI (fallback)
    const text = await generateWithLocalAI(fullPrompt, enhancedOptions);
    // eslint-disable-next-line no-console
    console.log("💻 Generated with legacy local AI");
    return { text, usedMode: AI_MODES.LOCAL, agentUsed: null };
  }
  if (useCloud || isCloudAIAvailable()) {
    // Cloud AI (Gemini - fallback)
    const text = await generateWithCloudAI(fullPrompt, enhancedOptions);
    return { text, usedMode: AI_MODES.CLOUD, agentUsed: null };
  }
  if (isWllamaAvailable()) {
    // Fallback: Wllama
    const text = await generateWithWllama(fullPrompt, enhancedOptions);
    return { text, usedMode: AI_MODES.WLLAMA, agentUsed: null };
  }
  if (isLocalServerAvailable()) {
    // Fallback: Local Server
    const text = await generateWithLocalServer(fullPrompt, enhancedOptions);
    return { text, usedMode: AI_MODES.LOCAL_SERVER, agentUsed: null };
  }
  if (isLocalAIReady()) {
    // Final fallback: try legacy local
    const text = await generateWithLocalAI(fullPrompt, enhancedOptions);
    return { text, usedMode: AI_MODES.LOCAL, agentUsed: null };
  }
  throw new Error(
    "No AI available. Please initialize Warrant Council, start the local server, or configure a Gemini API key.",
  );
}

// Hallucination Trap: Filter invalid diagnostic codes (unless explicitly skipped)
function _applyHallucinationFilter(text, options) {
  let hallucinationReport = null;
  if (options.skipHallucinationCheck) {
    return { text, hallucinationReport };
  }

  try {
    const validation = validateHallucinations(text);

    // Only process if validation actually found diagnostic codes to check
    // (skipped=true means response didn't contain diagnostic codes)
    if (
      !validation.skipped &&
      validation.rejected &&
      validation.rejected.length > 0
    ) {
      console.warn("🚫 Hallucination Trap triggered:", validation.rejected);
      hallucinationReport = {
        filtered: validation.rejected,
        valid: validation.safeData,
        stats: validation.stats,
      };

      // If the response had structured data that was filtered, optionally reconstruct
      if (validation.success && validation.safeData) {
        // For JSON responses, we can return the filtered version
        if (options.expectJSON) {
          text = JSON.stringify(validation.safeData, null, 2);
          // eslint-disable-next-line no-console
          console.info("✅ Reconstructed AI response with valid codes only");
        }
      }
    }
  } catch (hallucinationErr) {
    // Don't fail the entire request if hallucination check fails
    console.warn("Hallucination check failed:", hallucinationErr);
  }

  return { text, hallucinationReport };
}

// Validate the AI response for forbidden medical/legal roleplay, ungrounded
// CFR citations, missing disclaimers, invented stats, and over-certain claim
// language. Runs unless explicitly skipped.
//
// AIS-01: this was effectively dead in production. The guard required
// `options.taskType` (so calls without one skipped validation entirely), and
// it passed `options.taskType` — a STRING — as the `context` argument, so the
// validator's `context.loadedRegulations` was always undefined. Run it on every
// non-skipped response and pass a real context object.
async function _buildValidatedResult(
  text,
  usedMode,
  agentUsed,
  hallucinationReport,
  options,
) {
  if (!options.skipValidation) {
    const { validateAIResponse } = await getAISystemPrompts();
    const validation = validateAIResponse(text, {
      taskType: options.taskType,
      loadedRegulations: options.loadedRegulations,
      hasStatistics: options.hasStatistics,
    });
    if (!validation.isValid) {
      console.warn(
        "⚠️ AI response validation failed:",
        validation.errors,
        validation.warnings,
      );
      return {
        text,
        mode: usedMode,
        validationErrors: validation.errors,
        validationWarnings: validation.warnings,
        hallucinationReport,
      };
    }
  }

  return {
    text,
    mode: usedMode,
    ...(agentUsed && { agent: agentUsed }),
    ...(hallucinationReport && { hallucinationReport }),
  };
}

async function _handleContextOverflowFallback(
  err,
  fullPrompt,
  enhancedOptions,
  options,
) {
  const errorMsg = err.message || "";

  // 🔥 CONTEXT WINDOW OVERFLOW HANDLING
  // When Local AI (4096 tokens) can't handle large input, auto-fallback to Cloud AI (1M tokens)
  const isContextOverflow =
    errorMsg.includes("ContextWindowSizeExceeded") ||
    errorMsg.includes("context window") ||
    errorMsg.includes("prompt tokens exceed");

  if (!isContextOverflow) return null;

  console.warn(
    "📏 Context window overflow detected - document too large for Local AI",
  );

  // Try Cloud AI (Gemini has 1M token context window)
  if (isCloudAIAvailable() && !options.noFallback) {
    // eslint-disable-next-line no-console
    console.log("☁️ Auto-falling back to Cloud AI for large document...");
    try {
      const text = await generateWithCloudAI(fullPrompt, {
        ...enhancedOptions,
        // Use minimal system prompt for large documents to save tokens
        systemPrompt: options.systemPrompt || null,
      });
      return {
        text,
        mode: AI_MODES.CLOUD,
        fallback: true,
        fallbackReason: "context_overflow",
        note: "Document was too large for Local AI (4096 tokens). Processed with Cloud AI instead.",
      };
    } catch (cloudErr) {
      console.error("☁️ Cloud AI fallback also failed:", cloudErr.message);
      throw new Error(
        `Document is too large for Local AI (4096 token limit) and Cloud AI also failed. ` +
          `Please try with a shorter document, or paste only the most important sections of your decision letter.`,
      );
    }
  }

  // No Cloud AI available - give helpful error
  throw new Error(
    `📏 Document is too large for Local AI (4096 token limit). ` +
      `Options: 1) Configure a Gemini API key in Settings to enable Cloud AI fallback for large documents, ` +
      `2) Paste only the key sections of your decision letter (look for "Reasons for Decision" or "Denial" sections), ` +
      `3) Try uploading fewer pages at once.`,
  );
}

async function _handleGeneralFallback(err, effectiveMode, fullPrompt, options) {
  // If preferred mode fails, try fallback chain: Swarm -> Local -> Cloud
  let fallbackMode = null;
  let canFallback = false;

  if (effectiveMode === AI_MODES.SWARM) {
    fallbackMode = isLocalAIReady() ? AI_MODES.LOCAL : AI_MODES.CLOUD;
    canFallback =
      fallbackMode === AI_MODES.LOCAL ? isLocalAIReady() : isCloudAIAvailable();
  } else if (effectiveMode === AI_MODES.LOCAL) {
    fallbackMode = AI_MODES.CLOUD;
    canFallback = isCloudAIAvailable();
  } else {
    fallbackMode = isDiamondSwarmReady() ? AI_MODES.SWARM : AI_MODES.LOCAL;
    canFallback = isDiamondSwarmReady() || isLocalAIReady();
  }

  if (canFallback && !options.noFallback) {
    console.warn(
      `💎 Primary AI (${effectiveMode}) failed, falling back to ${fallbackMode}:`,
      err.message,
    );
    try {
      if (fallbackMode === AI_MODES.SWARM) {
        const text = await generateWithWarrantCouncil(fullPrompt, options);
        return {
          text,
          mode: AI_MODES.SWARM,
          agent: getCurrentAgent(),
          fallback: true,
        };
      } else if (fallbackMode === AI_MODES.LOCAL) {
        const text = await generateWithLocalAI(fullPrompt, options);
        return { text, mode: AI_MODES.LOCAL, fallback: true };
      } else {
        const text = await generateWithCloudAI(fullPrompt, options);
        return { text, mode: AI_MODES.CLOUD, fallback: true };
      }
    } catch (fallbackErr) {
      throw new Error(
        `All AI modes failed. Primary: ${err.message}. Fallback: ${fallbackErr.message}`,
      );
    }
  }

  throw err;
}

/**
 * Internal generateAI implementation (wrapped by timeout in public API)
 */
const generateAIInternal = async (prompt, options = {}) => {
  // Feature flag check (unless explicitly skipped)
  await _checkAiFeatureFlags(options);

  // Crisis safety check (unless explicitly skipped)
  await _checkCrisisSafety(prompt, options);

  const effectiveMode = getEffectiveAIMode();

  if (!effectiveMode) {
    throw new Error(
      "No AI available. Please configure a Gemini API key or initialize Local AI.",
    );
  }

  const { fullPrompt, enhancedOptions } = await _buildFullPrompt(
    prompt,
    options,
  );

  try {
    const {
      text: dispatchedText,
      usedMode,
      agentUsed,
    } = await _dispatchAiGeneration(
      effectiveMode,
      fullPrompt,
      enhancedOptions,
      options,
    );

    const { text, hallucinationReport } = _applyHallucinationFilter(
      dispatchedText,
      options,
    );

    return await _buildValidatedResult(
      text,
      usedMode,
      agentUsed,
      hallucinationReport,
      options,
    );
  } catch (err) {
    const overflowResult = await _handleContextOverflowFallback(
      err,
      fullPrompt,
      enhancedOptions,
      options,
    );
    if (overflowResult) return overflowResult;

    return await _handleGeneralFallback(
      err,
      effectiveMode,
      fullPrompt,
      options,
    );
  }
};

// Ordered [substring, friendly name] pairs — first match wins, so more
// specific patterns (e.g. a particular size/variant) must precede their
// generic family fallback (e.g. plain "Llama").
const LOCAL_MODEL_NAME_PATTERNS = [
  // Warrant Council agents (fine-tuned VetRate models)
  ["vetrate-auditor", "🎖️ CW5 Auditor"],
  ["vetrate-writer", "🎖️ CW4 Writer"],
  ["vetrate-rater", "🎖️ CW3 Rater"],

  // DeepSeek R1 Reasoning Models
  ["DeepSeek-R1-Distill-Qwen-7B", "DeepSeek R1 7B"],
  ["DeepSeek-R1-Distill-Llama-8B", "DeepSeek R1 8B"],
  ["DeepSeek", "DeepSeek R1"],

  // Qwen 3 Series (Latest)
  ["Qwen3-0.6B", "Qwen 3 0.6B"],
  ["Qwen3-1.7B", "Qwen 3 1.7B"],
  ["Qwen3-4B", "Qwen 3 4B"],
  ["Qwen3-8B", "Qwen 3 8B"],

  // Qwen 2.5 Series
  ["Qwen2.5-0.5B", "Qwen 2.5 0.5B"],
  ["Qwen2.5-1.5B", "Qwen 2.5 1.5B"],
  ["Qwen2.5-3B", "Qwen 2.5 3B"],
  ["Qwen2.5-7B", "Qwen 2.5 7B"],
  ["Qwen", "Qwen"],

  // SmolLM2 Series (Tiny models)
  ["SmolLM2-135M", "SmolLM2 135M"],
  ["SmolLM2-360M", "SmolLM2 360M"],
  ["SmolLM2-1.7B", "SmolLM2 1.7B"],
  ["SmolLM2", "SmolLM2"],

  // Hermes Series (Function Calling)
  ["Hermes-3-Llama-3.2-3B", "Hermes 3 3B"],
  ["Hermes-3-Llama-3.1-8B", "Hermes 3 8B"],
  ["Hermes-2-Pro", "Hermes 2 Pro"],
  ["Hermes", "Hermes"],

  // Llama Series
  ["Llama-3.2-1B", "Llama 3.2 1B"],
  ["Llama-3.2-3B", "Llama 3.2 3B"],
  ["Llama-3.1-8B", "Llama 3.1 8B"],
  ["Llama", "Llama"],

  // Phi Series (Microsoft) & Custom Vision Models
  ["Vet-Rate-Vision-Phi-Float32", "Vet-Rate Vision Phi"],
  ["Vet-Rate-Vision-Phi", "Vet-Rate Vision Phi (Legacy)"],
  ["Phi-3.5-vision", "Phi 3.5 Vision"],
  ["Phi-3.5", "Phi 3.5 Mini"],
  ["Phi", "Phi"],

  // Mistral Series
  ["Mistral-7B", "Mistral 7B"],
  ["Mistral", "Mistral"],

  // Gemma Series (Google) — specific sizes only match lowercase IDs;
  // the capitalized/generic case is handled separately below.
  ["gemma-2-9b", "Gemma 2 9B"],
  ["gemma-2-2b", "Gemma 2 2B"],
];

function _lookupLocalModelName(modelId) {
  const found = LOCAL_MODEL_NAME_PATTERNS.find(([pattern]) =>
    modelId.includes(pattern),
  );
  if (found) return found[1];

  if (modelId.includes("Gemma") || modelId.includes("gemma")) return "Gemma";

  // Fallback: try to extract a readable name from the model ID
  // e.g., "Some-Model-Name-q4f32_1-MLC" -> "Some Model Name"
  const cleanName = modelId
    // eslint-disable-next-line sonarjs/slow-regex -- runs on short, internal model-ID strings, not user input
    .replace(/-q\d+f\d+.*$/, "") // Remove quantization suffix
    .replace(/-MLC$/, "") // Remove MLC suffix
    .replace(/-Instruct$/, "") // Remove Instruct suffix
    .replace(/-/g, " ") // Replace dashes with spaces
    .trim();

  return cleanName || "Local AI";
}

/**
 * Get the currently loaded AI model name
 * Prioritizes Warrant Council agents over legacy models
 */
export const getLocalModelName = () => {
  // Diamond Swarm takes priority
  if (isDiamondSwarmReady()) {
    const agent = getCurrentAgent();
    if (agent) {
      const agentInfo = SWARM_AGENTS[agent.toUpperCase()];
      return agentInfo ? `💎 ${agentInfo.name}` : `💎 Diamond ${agent}`;
    }
    return "🎖️ Warrant Council";
  }

  const modelId = localStorage.getItem("vet_rate_local_ai_model");
  if (!modelId) return "Local AI"; // Generic name when no specific model selected

  return _lookupLocalModelName(modelId);
};

/**
 * Get AI status information for UI display
 */
export const getAIStatus = () => {
  const mode = getAIMode();
  const effectiveMode = getEffectiveAIMode();
  const localModelName = getLocalModelName();
  const swarmStatus = getSwarmStatus();
  const currentAgent = getCurrentAgent();

  // Check if using Warrant Council or other local backends
  const isSwarm = effectiveMode === AI_MODES.SWARM || isDiamondSwarmReady();
  const isWllama = effectiveMode === AI_MODES.WLLAMA;
  const isLocalServer = effectiveMode === AI_MODES.LOCAL_SERVER;

  // Determine status text
  let statusText = "No AI Available";
  let fullStatusText = "⚠️ No AI Available";

  if (isSwarm) {
    statusText = `🎖️ Warrant Council: ${currentAgent?.toUpperCase() || "AUDITOR"}`;
    fullStatusText = `🎖️ Warrant Council (${currentAgent?.toUpperCase() || "AUDITOR"}) - 100% Private`;
  } else if (isWllama) {
    statusText = `🌐 Wllama: ${wllamaCurrentModel?.toUpperCase() || "AUDITOR"}`;
    fullStatusText = `🌐 Wllama (Browser WASM) - 100% Private`;
  } else if (isLocalServer) {
    statusText = "🖥️ Local Server: llama.cpp";
    fullStatusText = "🖥️ Local Server (llama.cpp) - 100% Private";
  } else if (effectiveMode === AI_MODES.LOCAL) {
    statusText = `Local: ${localModelName}`;
    fullStatusText = `🔒 ${localModelName} (Local)`;
  } else if (effectiveMode === AI_MODES.CLOUD) {
    statusText = "Cloud: Gemini 2.5 Flash";
    fullStatusText = "☁️ Gemini 2.5 Flash (Cloud)";
  }

  return {
    preferredMode: mode,
    effectiveMode,
    cloudAvailable: isCloudAIAvailable(),
    localAvailable: isLocalAIReady(),
    swarmAvailable: isDiamondSwarmReady(),
    wllamaAvailable: isWllamaAvailable(),
    localServerAvailable: isLocalServerAvailable(),
    swarmStatus,
    currentAgent,
    localInitializing: isLocalAIInitializing(),
    wllamaInitializing: isWllamaInitializing(),
    localGenerating: localAIGenerating || swarmGenerating,
    anyAvailable: isAnyAIAvailable(),
    isPrivate: effectiveMode !== AI_MODES.CLOUD, // All local options are private
    cloudModelName: "Gemini 2.5 Flash",
    localModelName,
    statusText,
    fullStatusText,
  };
};

/**
 * Privacy disclosure text based on current AI mode
 */
export const getAIDataDisclosure = () => {
  const status = getAIStatus();

  if (status.effectiveMode === AI_MODES.SWARM) {
    return {
      title: "🎖️ Warrant Council - 100% Private",
      description:
        "All AI processing uses specialized VetRate agents running directly on your device. No data ever leaves.",
      bullets: [
        "✅ Your data NEVER leaves your device",
        "✅ 3 specialized agents: Auditor, Writer, Rater",
        "✅ Fine-tuned on official VA regulations",
        "✅ Diamond Standard accuracy & privacy",
      ],
      isPrivate: true,
      isDiamond: true,
    };
  }

  if (status.effectiveMode === AI_MODES.LOCAL) {
    return {
      title: "🔒 100% Private - Local AI Active",
      description:
        "All AI processing happens directly on your device using WebGPU. No data is sent to any server.",
      bullets: [
        "✅ Your data NEVER leaves your device",
        "✅ Works even offline once loaded",
        "✅ No API keys required",
        "💡 Upgrade to Warrant Council for specialized VA agents",
      ],
      isPrivate: true,
    };
  }

  if (status.effectiveMode === AI_MODES.CLOUD) {
    return {
      title: "☁️ Cloud AI Active",
      description:
        "AI processing uses Google's Gemini API. Only condition names and symptom descriptions are sent - never PII.",
      bullets: [
        "⚠️ Data is sent to Google's servers",
        "✅ No personal identifying information sent",
        "✅ Your API key, your control",
        "💡 Switch to Warrant Council for 100% privacy + specialized VA agents",
      ],
      isPrivate: false,
    };
  }

  return {
    title: "⚠️ No AI Available",
    description: "Configure AI to enable intelligent features.",
    bullets: [
      "🎖️ Option 1: Enable Warrant Council (recommended - specialized VA agents)",
      "🌐 Option 2: Enable Wllama (browser WASM - works everywhere)",
      "🖥️ Option 3: Start local llama.cpp server (desktop inference)",
      "🔒 Option 4: Enable Local AI (100% private legacy)",
      "☁️ Option 5: Add Gemini API key (cloud)",
    ],
    isPrivate: null,
  };
};

// ============================================================================
// DUAL-LLM PATTERN — NOT wired into the document-analysis paths (A-H01)
// ============================================================================
//
// The dual-LLM (privileged-controller + sandboxed-worker) split is NOT the
// production injection defense for untrusted documents. The real C-File,
// muster-call, and DD214 paths call single-LLM generateAI(); their defense is
// the LAYERED control set: spotlight / untrustedSection fences (with embedded-
// delimiter neutralization, A-H02), the PII scrubber at egress, last-mile URL
// stripping (PI-01), and crisis interception.
//
// The createDualLLM() factory in ./dualLLM.js is retained ONLY for the
// (not-yet-wired) legal-answer RAG path (services/legalAnswerer.js). The
// previously-exported dualLLMExtract / dualLLMSynthesize / runDualLLM convenience
// helpers were unused dead code and were removed so nothing implies a
// document-path dual-LLM defense that does not exist.

// Re-export Diamond Swarm functions for convenience
export {
  SWARM_AGENTS,
  TOOL_AGENT_MAP,
  getAgentForTool,
  isSwarmReady,
  isSwarmInitializing,
  getCurrentAgent,
  getSwarmStatus,
  initializeSwarm,
  reloadSwarmEngine,
  switchAgent,
  unloadSwarm,
} from "./diamondSwarm";

export default {
  AI_MODES,
  AI_PRESETS,
  getAIMode,
  setAIMode,
  getEffectiveAIMode,
  getAIPreset,
  getUserPreset,
  isLocalAIReady,
  isLocalAIInitializing,
  isLocalAIVisionModel,
  getLocalAIModelId,
  isDiamondSwarmReady,
  isCloudAIAvailable,
  isAnyAIAvailable,
  // New backends
  isWllamaAvailable,
  isWllamaInitializing,
  initializeWllama,
  isLocalServerAvailable,
  checkLocalServer,
  checkWebGPUSupport,
  registerLocalAIEngine,
  registerSwarmEngine,
  generateAI,
  generateAIWithImage,
  resetAICircuitBreaker,
  getAIStatus,
  getAIDataDisclosure,
  // Diamond Swarm
  SWARM_AGENTS,
  TOOL_AGENT_MAP,
  getAgentForTool,
  isSwarmReady,
  isSwarmInitializing,
  getCurrentAgent,
  getSwarmStatus,
  initializeSwarm,
  reloadSwarmEngine,
  switchAgent,
  unloadSwarm,
};
