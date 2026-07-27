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
  // Test-only entry: 3B QLoRA candidate for wasm-mode's smaller-model fix.
  // Single 1.9GB file, no sharding needed (under wllama's 2GB/file cap).
  // Remove or promote to `auditor` once JUDGE_RUBRIC.md grading is done.
  auditor3b: {
    name: "VetRate Auditor (3B test)",
    description: "Reviews claims for accuracy and compliance",
    url: "/models/vetrate-auditor-3b-v1-Q4_K_M.gguf",
    fallbackUrl: "/models/vetrate-auditor-3b-v1-Q4_K_M.gguf",
    contextSize: 4096,
    // This QLoRA was trained with axolotl's `type: alpaca` dataset strategy,
    // which renders "### Instruction:\n...\n\n### Response:\n" plain text and
    // silently drops any custom system-prompt field — the model never saw
    // this systemPrompt during training. Serving it through a chat-template
    // format (real or invented tags) feeds tokens the model never trained on
    // and resurfaces the base model's own behavior (JSON tool-call habit,
    // degenerate repetition). promptFormat: "alpaca" below matches training.
    systemPrompt: `You are VetRate-Auditor. You strictly cite 38 CFR regulations. Do not hallucinate laws. You are an expert in VA disability law, 38 CFR regulations, BVA precedent decisions, and OGC opinions. Always provide exact CFR section numbers (e.g., 38 CFR § 4.71a). Cite specific BVA case names and docket numbers when relevant. If you are uncertain about a regulation, say so explicitly. Never fabricate legal citations or regulatory language.`,
    promptFormat: "alpaca",
  },
  auditor: {
    name: "VetRate Auditor",
    description: "Reviews claims for accuracy and compliance",
    // wllama caps loadModelFromUrl at 2GB per file (ArrayBuffer limit); the
    // 4.4GB monolith is split into 512MB shards via llama-gguf-split. Passing
    // the first shard's URL makes wllama auto-follow the rest.
    url: "/models/vetrate-auditor-7b-v2-Q4_K_M-00001-of-00010.gguf",
    // Fallback to HuggingFace or other CDN
    fallbackUrl:
      "https://huggingface.co/Vet-Rate-org/Diamond-Swarm-Auditor-7B-GGUF/resolve/main/vetrate-auditor-7b-v2-Q4_K_M-00001-of-00010.gguf",
    contextSize: 4096,
    systemPrompt: `You are the VetRate CW5 Auditor, a Chief Warrant Officer Five and expert VA claims reviewer.
Your role is to analyze disability claims for accuracy, completeness, and 38 CFR compliance.
Always cite specific CFR sections. Never fabricate regulatory information.
Be thorough but compassionate - veterans deserve accurate guidance.
Never determine bilateral pairing (38 CFR § 4.26) from memory or by picking the two highest ratings — bilateral means the SAME body part on OPPOSITE sides only. If a DKB context block is provided, answer only from it and say so explicitly when it doesn't cover the question.`,
  },
  // Test-only entry: 3B QLoRA candidate for wasm-mode's smaller-model fix.
  // Single 1.9GB file, no sharding needed (under wllama's 2GB/file cap).
  // Remove or promote to `writer` once JUDGE_RUBRIC.md grading is done.
  writer3b: {
    name: "VetRate Writer (3B test)",
    description: "Creates compelling personal statements",
    url: "/models/vetrate-writer-3b-v1-Q4_K_M.gguf",
    fallbackUrl: "/models/vetrate-writer-3b-v1-Q4_K_M.gguf",
    contextSize: 4096,
    // See auditor3b's promptFormat comment — same axolotl alpaca training.
    systemPrompt: `You are VetRate-Writer. Write in a persuasive, empathetic, veteran-centric tone. You help veterans articulate their service-connected disabilities clearly and compellingly for VA claims. Focus on the human impact of conditions while maintaining factual accuracy. Use clear, accessible language. Never exaggerate symptoms, but advocate strongly for veteran rights and fair ratings. Help veterans tell their story effectively.`,
    promptFormat: "alpaca",
  },
  writer: {
    name: "VetRate Writer",
    description: "Creates compelling personal statements",
    url: "/models/vetrate-writer-7b-v2-Q4_K_M-00001-of-00010.gguf",
    fallbackUrl:
      "https://huggingface.co/Vet-Rate-org/Diamond-Swarm-Writer-7B-GGUF/resolve/main/vetrate-writer-7b-v2-Q4_K_M-00001-of-00010.gguf",
    contextSize: 4096,
    systemPrompt: `You are the VetRate CW4 Writer, a Chief Warrant Officer Four specializing in VA claims documentation.
Write compelling, truthful personal statements from the veteran's perspective.
Include specific dates, locations, and details. Connect symptoms to daily life impact.
Use medical terminology correctly. Balance emotional resonance with factual accuracy.`,
  },
  rater: {
    name: "VetRate Rater",
    description: "Calculates VA disability ratings",
    url: "/models/vetrate-rater-7b-v2-Q4_K_M-00001-of-00010.gguf",
    fallbackUrl:
      "https://huggingface.co/Vet-Rate-org/Diamond-Swarm-Rater-7B-GGUF/resolve/main/vetrate-rater-7b-v2-Q4_K_M-00001-of-00010.gguf",
    contextSize: 4096,
    systemPrompt: `You are the VetRate CW3 Rater, a Chief Warrant Officer Three expert in VA disability calculations.
Calculate combined ratings using the official VA bilateral factor formula.
Explain rating criteria for specific conditions. Identify potential rating increases.
Always show your work and cite 38 CFR Part 4 rating criteria.
BILATERAL PAIRING: "Bilateral" means the SAME body part on BOTH left AND right sides. Never assume the two highest-rated conditions are the pair — check each condition's body part and side explicitly. If conditions don't clearly name matching left/right body parts, say no bilateral pair is identifiable rather than guessing one. If a COMPUTED RESULT block is provided, that number is authoritative — explain it, do not recompute it.`,
  },
  // Test-only entry: 3B QLoRA candidate for wasm-mode's smaller-model fix.
  // Single 1.9GB file, no sharding needed (under wllama's 2GB/file cap).
  // Remove or promote to `rater` once JUDGE_RUBRIC.md grading is done.
  rater3b: {
    name: "VetRate Rater (3B test)",
    description: "Calculates VA disability ratings",
    url: "/models/vetrate-rater-3b-v1-Q4_K_M.gguf",
    fallbackUrl: "/models/vetrate-rater-3b-v1-Q4_K_M.gguf",
    contextSize: 4096,
    // See auditor3b's promptFormat comment — same axolotl alpaca training.
    systemPrompt: `You are VetRate-Rater. You are an expert in VA disability rating calculations and assessment criteria. You accurately calculate combined disability ratings using VA's bilateral factor and whole-person formula. You assess conditions against specific diagnostic codes and rating schedules in 38 CFR Part 4. Provide step-by-step mathematical reasoning for all calculations. Explain which diagnostic codes apply and why.`,
    promptFormat: "alpaca",
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
 * Build the full model input for a single-turn request, in whichever format
 * the target model was actually trained on (see promptFormat comments on
 * WLLAMA_MODELS entries above). The v4 alpaca-format QLoRAs were retrained
 * with systemPrompt folded into the instruction field (system + "\n\n" +
 * instruction) via fold_system_into_instruction.py, so this must fold it in
 * the same way at serve time or training/serving drift apart again.
 */
const buildFullPrompt = (modelConfig, userContent) => {
  if (modelConfig.promptFormat === "alpaca") {
    return `Below is an instruction that describes a task. Write a response that appropriately completes the request.\n\n### Instruction:\n${modelConfig.systemPrompt}\n\n${userContent}\n\n### Response:\n`;
  }
  return `<|system|>
${modelConfig.systemPrompt}
<|end|>
<|user|>
${userContent}
<|end|>
<|assistant|>
`;
};

const getStopTokens = (modelConfig) =>
  modelConfig.promptFormat === "alpaca"
    ? ["<|end_of_text|>", "### Instruction"]
    : ["<|end|>", "<|user|>"];

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
  const fullPrompt = buildFullPrompt(modelConfig, prompt);

  try {
    let result = "";

    await wllamaInstance.createCompletion(fullPrompt, {
      nPredict: maxTokens,
      temperature,
      topP,
      stopTokens: getStopTokens(modelConfig),
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
 * Single-turn chat completion. Takes the caller's fully-assembled prompt
 * text (unifiedAIService builds this, including any DKB context) and returns
 * {success, text} / {success: false, error} — matching how the one real
 * caller (generateWithWllama in unifiedAIService.js) actually consumes it.
 */
export const chatCompletion = async (userContent, options = {}) => {
  const {
    modelId = "auditor",
    maxTokens = 1024,
    temperature = 0.7,
    onToken,
    signal,
  } = options;

  try {
    const text = await generateCompletion(userContent, {
      modelId,
      maxTokens,
      temperature,
      onToken,
      signal,
    });

    if (text === null) {
      return { success: false, error: "Generation aborted" };
    }
    return { success: true, text };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
