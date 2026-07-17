/**
 * Wllama Browser Integration for Warrant Council
 *
 * Enables 100% local LLM inference in the browser using WebAssembly.
 * Falls back to llama.cpp server if available, then to Gemini cloud.
 *
 * Models: VetRate Auditor, Writer, Rater (GGUF Q4_K_M)
 */

// Dynamic import to avoid bundling Node.js code from wllama's embedded worker strings
// The wllama library contains WASM worker code with Node.js require() calls that
// cause "require is not defined" errors when statically imported
let Wllama = null;
let wllamaLoadError = null;

const loadWllama = async () => {
  if (Wllama) return Wllama;
  if (wllamaLoadError) throw wllamaLoadError;

  try {
    const module = await import("@wllama/wllama/esm/index.js");
    Wllama = module.Wllama;
    return Wllama;
  } catch (error) {
    console.error("[Wllama] Failed to load library:", error);
    wllamaLoadError = error;
    throw error;
  }
};

// Storage keys
const _WLLAMA_CACHE_KEY = "vetrate_wllama_cache";
const _WLLAMA_CONFIG_KEY = "vetrate_wllama_config";

/**
 * Model configurations for Warrant Council agents
 */
export const WLLAMA_MODELS = {
  auditor: {
    name: "VetRate Auditor",
    description: "Reviews claims for accuracy and compliance",
    // Model URL - can be local server or CDN
    url: "/models/vetrate-auditor-7b-v2-Q4_K_M.gguf",
    // Fallback to HuggingFace or other CDN
    fallbackUrl:
      "https://huggingface.co/ajohnsonnow/vetrate-auditor-7b-v2-gguf/resolve/main/vetrate-auditor-7b-v2-Q4_K_M.gguf",
    contextSize: 4096,
    systemPrompt: `You are the VetRate CW5 Auditor, a Chief Warrant Officer Five and expert VA claims reviewer.
Your role is to analyze disability claims for accuracy, completeness, and 38 CFR compliance.
Always cite specific CFR sections. Never fabricate regulatory information.
Be thorough but compassionate - veterans deserve accurate guidance.`,
  },
  writer: {
    name: "VetRate Writer",
    description: "Creates compelling personal statements",
    url: "/models/vetrate-writer-7b-v2-Q4_K_M.gguf",
    fallbackUrl:
      "https://huggingface.co/ajohnsonnow/vetrate-writer-7b-v2-gguf/resolve/main/vetrate-writer-7b-v2-Q4_K_M.gguf",
    contextSize: 4096,
    systemPrompt: `You are the VetRate CW4 Writer, a Chief Warrant Officer Four specializing in VA claims documentation.
Write compelling, truthful personal statements from the veteran's perspective.
Include specific dates, locations, and details. Connect symptoms to daily life impact.
Use medical terminology correctly. Balance emotional resonance with factual accuracy.`,
  },
  rater: {
    name: "VetRate Rater",
    description: "Calculates VA disability ratings",
    url: "/models/vetrate-rater-7b-v2-Q4_K_M.gguf",
    fallbackUrl:
      "https://huggingface.co/ajohnsonnow/vetrate-rater-7b-v2-gguf/resolve/main/vetrate-rater-7b-v2-Q4_K_M.gguf",
    contextSize: 4096,
    systemPrompt: `You are the VetRate CW3 Rater, a Chief Warrant Officer Three expert in VA disability calculations.
Calculate combined ratings using the official VA bilateral factor formula.
Explain rating criteria for specific conditions. Identify potential rating increases.
Always show your work and cite 38 CFR Part 4 rating criteria.`,
  },
};

/**
 * Wllama service state
 */
let wllamaInstance = null;
let currentModel = null;
let isInitializing = false;
let loadProgress = { progress: 0, text: "" };

/**
 * Get download progress callback
 */
const createProgressCallback = (onProgress) => {
  return ({ loaded, total }) => {
    const progress = total > 0 ? (loaded / total) * 100 : 0;
    const loadedMB = (loaded / 1024 / 1024).toFixed(1);
    const totalMB = (total / 1024 / 1024).toFixed(1);

    loadProgress = {
      progress,
      text: `Downloading: ${loadedMB}MB / ${totalMB}MB`,
    };

    if (onProgress) {
      onProgress(loadProgress);
    }
  };
};

/**
 * Initialize Wllama with a specific model
 */
export const initializeWllama = async (modelId = "auditor", options = {}) => {
  const { onProgress, useCache = true } = options;

  if (isInitializing) {
    // eslint-disable-next-line no-console
    console.log("[Wllama] Already initializing...");
    return false;
  }

  if (wllamaInstance && currentModel === modelId) {
    // eslint-disable-next-line no-console
    console.log("[Wllama] Model already loaded:", modelId);
    return true;
  }

  isInitializing = true;

  try {
    // Load Wllama library dynamically
    const WllamaClass = await loadWllama();

    const modelConfig = WLLAMA_MODELS[modelId];
    if (!modelConfig) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    // eslint-disable-next-line no-console
    console.log(`[Wllama] Initializing ${modelConfig.name}...`);

    // v3.4.1: single WASM file handles multi-thread/single-thread automatically.
    // WebGPU acceleration enabled by default when navigator.gpu is available.
    // allowOffline is a WllamaConfig option (the 2nd constructor arg); passing it
    // to loadModelFromUrl below silently ignored it (C-M06). Set here it makes an
    // already-cached model load from IndexedDB with no network round-trip, so the
    // app works in low-connectivity VA waiting rooms.
    wllamaInstance = new WllamaClass(
      { default: "/wasm/wllama.wasm" },
      { allowOffline: useCache },
    );

    // Try primary URL first, then fallback
    let modelUrl = modelConfig.url;
    try {
      const response = await fetch(modelUrl, { method: "HEAD" });
      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.log("[Wllama] Primary URL not available, using fallback");
        modelUrl = modelConfig.fallbackUrl;
      }
    } catch {
      modelUrl = modelConfig.fallbackUrl;
    }

    // wllama's internal download worker is spawned from a blob: URL, whose
    // base isn't the page origin — a path-relative modelUrl (the local/
    // self-hosted case) fails to parse inside it ("Failed to parse URL from
    // /models/..."). Resolve to an absolute URL before crossing into the
    // worker; already-absolute fallbackUrls pass through unchanged.
    modelUrl = new URL(modelUrl, window.location.origin).href;

    // Load the model. n_gpu_layers: all layers on WebGPU when available (v3.1+
    // enables WebGPU automatically; 0 forces CPU-only for iOS/WASM fallback).
    await wllamaInstance.loadModelFromUrl(modelUrl, {
      progressCallback: createProgressCallback(onProgress),
      n_ctx: modelConfig.contextSize,
      n_threads: navigator.hardwareConcurrency || 4,
      n_gpu_layers: typeof navigator !== "undefined" && navigator.gpu ? 999 : 0,
    });

    currentModel = modelId;
    isInitializing = false;

    // eslint-disable-next-line no-console
    console.log(`[Wllama] ${modelConfig.name} loaded successfully`);
    return true;
  } catch (error) {
    console.error("[Wllama] Initialization failed:", error);
    isInitializing = false;
    wllamaInstance = null;
    currentModel = null;
    throw error;
  }
};

/**
 * Generate completion using Wllama
 */
export const generateCompletion = async (prompt, options = {}) => {
  const {
    modelId = "auditor",
    maxTokens = 1024,
    temperature = 0.7,
    topP = 0.9,
    onToken,
    signal,
  } = options;

  // Initialize if needed
  if (!wllamaInstance || currentModel !== modelId) {
    await initializeWllama(modelId);
  }

  const modelConfig = WLLAMA_MODELS[modelId];

  // Build full prompt with system message
  const fullPrompt = `<|system|>
${modelConfig.systemPrompt}
<|end|>
<|user|>
${prompt}
<|end|>
<|assistant|>
`;

  try {
    let result = "";

    await wllamaInstance.createCompletion(fullPrompt, {
      nPredict: maxTokens,
      temperature,
      topP,
      stopTokens: ["<|end|>", "<|user|>"],
      onToken: (token) => {
        result += token;
        if (onToken) {
          onToken(token);
        }
      },
      signal,
    });

    return result.trim();
  } catch (error) {
    if (error.name === "AbortError") {
      // eslint-disable-next-line no-console
      console.log("[Wllama] Generation aborted");
      return null;
    }
    throw error;
  }
};

/**
 * Chat completion with conversation history
 */
export const chatCompletion = async (messages, options = {}) => {
  const {
    modelId = "auditor",
    maxTokens = 1024,
    temperature = 0.7,
    onToken,
    signal,
  } = options;

  // Initialize if needed
  if (!wllamaInstance || currentModel !== modelId) {
    await initializeWllama(modelId);
  }

  const modelConfig = WLLAMA_MODELS[modelId];

  // Build conversation prompt
  let prompt = `<|system|>\n${modelConfig.systemPrompt}\n<|end|>\n`;

  for (const msg of messages) {
    if (msg.role === "user") {
      prompt += `<|user|>\n${msg.content}\n<|end|>\n`;
    } else if (msg.role === "assistant") {
      prompt += `<|assistant|>\n${msg.content}\n<|end|>\n`;
    }
  }

  prompt += "<|assistant|>\n";

  return generateCompletion(prompt, {
    modelId,
    maxTokens,
    temperature,
    onToken,
    signal,
  });
};

/**
 * Check if Wllama is ready
 */
export const isWllamaReady = () => wllamaInstance !== null && !isInitializing;

/**
 * Get current model info
 */
export const getCurrentModelInfo = () => {
  if (!currentModel) return null;
  return {
    id: currentModel,
    ...WLLAMA_MODELS[currentModel],
  };
};

/**
 * Get load progress
 */
export const getLoadProgress = () => loadProgress;

/**
 * Unload current model
 */
export const unloadModel = async () => {
  if (wllamaInstance) {
    await wllamaInstance.exit();
    wllamaInstance = null;
    currentModel = null;
  }
};

/**
 * Check WebAssembly support
 */
export const checkWasmSupport = () => {
  const hasWasm = typeof WebAssembly === "object";
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";

  let reason = null;
  if (!hasWasm) {
    reason = "WebAssembly not supported";
  } else if (!hasSharedArrayBuffer) {
    reason =
      "SharedArrayBuffer not available (COOP/COEP headers needed for multi-threading)";
  }

  return {
    supported: hasWasm,
    multiThread: hasWasm && hasSharedArrayBuffer,
    reason,
  };
};

/**
 * Estimate model download size
 */
export const getModelSize = (_modelId) => {
  // Q4_K_M 7B models are approximately 4.4GB
  return {
    bytes: 4683073600,
    formatted: "4.4 GB",
  };
};

export default {
  initializeWllama,
  generateCompletion,
  chatCompletion,
  isWllamaReady,
  getCurrentModelInfo,
  getLoadProgress,
  unloadModel,
  checkWasmSupport,
  getModelSize,
  WLLAMA_MODELS,
};
