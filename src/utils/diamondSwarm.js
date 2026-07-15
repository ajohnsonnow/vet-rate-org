/**
 * Vet-Rate.org - Warrant Council AI Service
 * 🎖️ "The Warrant Standard" - 3-Model Swarm Architecture
 *
 * This service orchestrates 3 specialized fine-tuned models:
 * - AUDITOR: Reviews claims for accuracy, compliance, and completeness
 * - WRITER: Generates compelling personal statements and nexus letters
 * - RATER: Calculates VA disability ratings using bilateral factor formula
 *
 * All models are fine-tuned on official VA regulations and procedures.
 * 100% local inference via GGUF format - no data leaves the device.
 */

import {
  TOOL_REQUIRED_CAPABILITY,
  enforceAgentBoundary,
  resolveAgentForTool,
} from "./agentBoundaries";
import {
  detectDeviceCapabilities,
  getCachedDeviceProfile,
} from "./deviceCapabilityDetector";

// Storage keys
const SWARM_CONFIG_KEY = "vetrate_diamond_swarm_config";
const _SWARM_STATUS_KEY = "vetrate_diamond_swarm_status";

/**
 * Warrant Council Agent Types
 * CW5-CW3 ranks correspond to technical expertise levels
 */
export const SWARM_AGENTS = {
  AUDITOR: {
    id: "auditor",
    name: "CW5 Auditor",
    rank: "First Sergeant (E-8)",
    militaryContext:
      "Your platoon first sergeant who inspects gear, catches mistakes, and ensures you have everything squared away before the mission",
    description:
      "Reviews claims for accuracy, compliance, and identifies issues",
    role: "Claim accuracy and compliance review",
    icon: "🔍",
    capabilities: [
      "Claim accuracy verification",
      "Medical evidence review",
      "Service connection validation",
      "Regulatory compliance check",
      "Missing documentation identification",
    ],
    systemPrompt: `You are the VetRate CW5 Auditor, a Chief Warrant Officer Five and expert VA claim reviewer.
Your role is to analyze VA disability claims for accuracy, completeness, and compliance.

CRITICAL RULES:
1. All regulations MUST cite 38 CFR sources
2. Never fabricate legal/regulatory information
3. Identify missing documentation precisely
4. Flag inconsistencies between evidence and claims
5. Verify service connection evidence quality

MENTAL HEALTH CLAIM PRECISION:
- PTSD requires verified "stressor" (38 CFR § 3.304(f))
- MDD/Anxiety use "in-service incurrence/aggravation" - NOT stressor language
- Ratings under 38 CFR § 4.130 are based on CURRENT impairment, not past treatment failures
- C&P exam and service records often matter more than nexus letters
- Focus advice on what affects the actual rating: current functional impairment

EVIDENCE HIERARCHY:
1. Service Treatment Records (in-service documentation)
2. C&P Exam findings (VA's medical opinion)
3. Continuity of care timeline
4. Current diagnosis
5. Nexus letters (helpful but not always decisive)
6. Lay statements

Always be thorough but compassionate - veterans deserve accurate guidance.`,
  },
  WRITER: {
    id: "writer",
    name: "CW4 Writer",
    rank: "First Sergeant (E-8)",
    militaryContext:
      "The first sergeant who writes you up for awards, helps draft your statements, and knows exactly how to make your accomplishments sound impressive",
    description: "Creates compelling personal statements and nexus letters",
    role: "Persuasive medical-legal writing",
    icon: "✍️",
    capabilities: [
      "Personal statement drafting",
      "Nexus letter generation",
      "Buddy statement templates",
      "Appeal arguments",
      "Emotional narrative building",
    ],
    systemPrompt: `You are the VetRate CW4 Writer, a Chief Warrant Officer Four specializing in VA claims documentation.
Your role is to create compelling, truthful, and effective personal statements.

CRITICAL RULES:
1. Write in first person from the veteran's perspective
2. Include specific dates, locations, and details
3. Connect symptoms to daily life impact
4. Use medical terminology correctly
5. Balance emotional resonance with factual accuracy

Your writing should be honest, powerful, and human-sounding.`,
  },
  RATER: {
    id: "rater",
    name: "CW3 Rater",
    rank: "First Sergeant (E-8)",
    militaryContext:
      "The promotion board first sergeant who knows the point system inside-out and can calculate your ranking down to the decimal",
    description: "Calculates VA disability ratings with bilateral factor",
    role: "Disability rating calculations",
    icon: "🧮",
    capabilities: [
      "Combined rating calculation",
      "Bilateral factor application",
      "TDIU eligibility assessment",
      "Rating schedule interpretation",
      "Diagnostic code mapping",
    ],
    systemPrompt: `You are the VetRate CW3 Rater, a Chief Warrant Officer Three expert in VA disability calculations.
Your role is to calculate combined disability ratings accurately.

CRITICAL RULES:
1. Use EXACT VA bilateral factor formula
2. Apply 38 CFR Part 4 rating criteria
3. Round to nearest 10% for final rating
4. Explain each step of calculation
5. Identify bilateral conditions correctly

VA Formula: Combined = 100 - ((100-A) × (100-B) × (100-C)...) / 100^(n-1)
Bilateral Factor: 10% bonus applied to combined bilateral limb ratings.`,
  },
};

/**
 * Tool to Agent mapping - which agent handles which task
 */
export const TOOL_AGENT_MAP = {
  // Document Analysis - Auditor
  "dd214-analyzer": "auditor",
  "cfile-analyzer": "auditor",
  "blue-button": "auditor",
  "decision-decoder": "auditor",
  "denial-decoder": "auditor",

  // Writing Tasks - Writer
  "nexus-builder": "writer",
  "witness-bench": "writer",
  "personal-statement": "writer",
  "statement-wizard": "writer",
  "buddy-statement": "writer",

  // Rating & Calculations - Rater
  calculator: "rater",
  "rating-calculator": "rater",
  "tdiu-builder": "rater",
  "rating-analyzer": "rater",

  // Mixed Tasks - Default to Auditor for accuracy
  "war-room": "auditor",
  "pact-navigator": "auditor",
  "red-team": "auditor",
  pathfinder: "auditor",
};

/**
 * Warrant Council state
 */
let swarmEngine = null;
let swarmReady = false;
let swarmInitializing = false;
const loadedAgents = new Set();
let currentAgent = null;
let loadedModelId = null; // Tracks which model was actually loaded

/**
 * GGUF Model configurations for each agent
 * These are the fine-tuned VetRate models
 */
export const SWARM_MODELS = {
  auditor: {
    modelPath: "vetrate-auditor-7b-v2.gguf",
    contextSize: 4096,
    baseModel: "Qwen2.5-7B-Instruct",
  },
  writer: {
    modelPath: "vetrate-writer-7b-v2.gguf",
    contextSize: 4096,
    baseModel: "Qwen2.5-7B-Instruct",
  },
  rater: {
    modelPath: "vetrate-rater-7b-v2.gguf",
    contextSize: 4096,
    baseModel: "Qwen2.5-Coder-7B-Instruct",
  },
};

/**
 * Get the recommended agent for a specific tool
 */
export const getAgentForTool = (toolId) => {
  const agentId = TOOL_AGENT_MAP[toolId] || "auditor";
  return SWARM_AGENTS[agentId.toUpperCase()];
};

/**
 * Get all available agents
 */
export const getAllAgents = () => Object.values(SWARM_AGENTS);

/**
 * Check if Warrant Council is ready
 */
export const isSwarmReady = () => swarmReady && !swarmInitializing;

/**
 * Check if Warrant Council is initializing
 */
export const isSwarmInitializing = () => swarmInitializing;

/**
 * Get current loaded agent
 */
export const getCurrentAgent = () => currentAgent;

/**
 * Get loaded agents
 */
export const getLoadedAgents = () => Array.from(loadedAgents);

/**
 * Swarm status for UI display
 */
export const getSwarmStatus = () => {
  return {
    ready: swarmReady,
    initializing: swarmInitializing,
    loadedAgents: Array.from(loadedAgents),
    currentAgent: currentAgent,
    mode: "DIAMOND",
    hasEngine: webllmEngine !== null,
    model: loadedModelId,
  };
};

/**
 * Check if WebLLM engine is loaded and ready for inference
 */
export const hasWebLLMEngine = () => webllmEngine !== null;

/**
 * Register Diamond Swarm engine (called during initialization)
 */
export const registerSwarmEngine = (
  engine,
  ready,
  initializing = false,
  agentId = null,
) => {
  swarmEngine = engine;
  swarmReady = ready;
  swarmInitializing = initializing;
  if (agentId) {
    loadedAgents.add(agentId);
    currentAgent = agentId;
  }
  // eslint-disable-next-line no-console
  console.log(
    `🎖️ Warrant Council registered: agent=${agentId}, ready=${ready}`,
  );
};

// WebLLM engine reference for real inference
let webllmEngine = null;

// Default model list used before device probe completes. The device profile
// (detectDeviceCapabilities) overrides this in initializeSwarm at runtime.
const DIAMOND_MODELS_DEFAULT = [
  "Qwen2.5-3B-Instruct-q4f16_1-MLC", // 1.7GB - f16, proven ~55 s/chunk on 4080 SUPER (stream:false)
  "Qwen2.5-3B-Instruct-q4f32_1-MLC", // 2.0GB - f32 fallback
  "Qwen2.5-1.5B-Instruct-q4f32_1-MLC", // 1.0GB - lower-VRAM fallback
  "Llama-3.2-3B-Instruct-q4f32_1-MLC", // 1.8GB - alternative architecture
];

/**
 * Try to clear corrupted cache entries
 */
const clearCorruptedCache = async () => {
  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name.includes("webllm") || name.includes("mlc")) {
          // eslint-disable-next-line no-console
          console.log(`💎 Clearing potentially corrupted cache: ${name}`);
          await caches.delete(name);
        }
      }
    }
  } catch (e) {
    console.warn("💎 Could not clear cache:", e);
  }
};

/**
 * Resolve the agent ID and callbacks from either calling convention:
 * 1. initializeSwarm('auditor', { onProgress, onComplete, onError })
 * 2. initializeSwarm({ modelId: 'vetrate-auditor-7b-v2', onProgress })
 */
function _resolveAgentIdAndCallbacks(agentIdOrConfig, callbacks) {
  if (typeof agentIdOrConfig === "object" && agentIdOrConfig !== null) {
    // Object form - extract modelId and derive agentId
    const {
      modelId,
      onProgress: _onProgress,
      onComplete: _onComplete,
      onError: _onError,
    } = agentIdOrConfig;

    // Derive agent from modelId (e.g., 'vetrate-writer-7b-v2' -> 'writer')
    let agentId;
    if (modelId) {
      if (modelId.includes("writer")) agentId = "writer";
      else if (modelId.includes("rater")) agentId = "rater";
      else agentId = "auditor"; // default
    } else {
      agentId = "auditor";
    }

    return {
      agentId,
      onProgress: _onProgress,
      onComplete: _onComplete,
      onError: _onError,
    };
  }

  // String form - use directly
  return {
    agentId: String(agentIdOrConfig || "auditor"),
    onProgress: callbacks.onProgress,
    onComplete: callbacks.onComplete,
    onError: callbacks.onError,
  };
}

/**
 * Shared with LocalAIPanel.jsx: patch navigator.gpu.requestAdapter so that
 * when WebLLM internally calls requestDevice it gets the adapter's true max
 * limits (required for Blackwell / RTX 5060 Ti and similar high-end GPUs).
 */
function _ensureMLCGPUPatch() {
  if (window._mlc_gpu_patched || !navigator.gpu) return;

  const _origRequestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
  navigator.gpu.requestAdapter = async function (options) {
    const a = await _origRequestAdapter(options);
    if (!a) return a;
    const aLimits = a.limits;
    const aFeatures = a.features;
    const _origRequestDevice = a.requestDevice.bind(a);
    a.requestDevice = async function (descriptor = {}) {
      const requiredLimits = {
        ...descriptor.requiredLimits,
        maxComputeInvocationsPerWorkgroup:
          aLimits.maxComputeInvocationsPerWorkgroup || 1024,
        maxStorageBufferBindingSize: aLimits.maxStorageBufferBindingSize,
        maxBufferSize: aLimits.maxBufferSize,
        maxComputeWorkgroupSizeX: aLimits.maxComputeWorkgroupSizeX,
        maxComputeWorkgroupSizeY: aLimits.maxComputeWorkgroupSizeY,
        maxComputeWorkgroupSizeZ: aLimits.maxComputeWorkgroupSizeZ,
        maxComputeWorkgroupStorageSize: aLimits.maxComputeWorkgroupStorageSize,
        maxBindGroups: aLimits.maxBindGroups,
        maxBindingsPerBindGroup: aLimits.maxBindingsPerBindGroup,
        maxDynamicStorageBuffersPerPipelineLayout:
          aLimits.maxDynamicStorageBuffersPerPipelineLayout,
        maxStorageBuffersPerShaderStage:
          aLimits.maxStorageBuffersPerShaderStage,
      };
      const requiredFeatures = [...(descriptor.requiredFeatures || [])];
      if (
        aFeatures.has("shader-f16") &&
        !requiredFeatures.includes("shader-f16")
      ) {
        requiredFeatures.push("shader-f16");
      }
      return await _origRequestDevice({
        ...descriptor,
        requiredLimits,
        requiredFeatures,
      });
    };
    return a;
  };
  window._mlc_gpu_patched = true;
}

/**
 * Try to load a WebLLM model from a device-optimal list, in order.
 * Returns { modelId, engine } on success, or null if every model failed.
 */
async function _loadModelFromList(
  modelList,
  agentInfo,
  contextWindowSize,
  tier,
  onProgress,
) {
  for (const modelId of modelList) {
    try {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

      onProgress?.({
        stage: "download",
        message: `Downloading ${agentInfo?.name} (${modelId.split("-")[0]})...`,
        progress: 10,
      });

      const engine = await CreateMLCEngine(
        modelId,
        {
          initProgressCallback: (report) => {
            const progress = Math.round(report.progress * 80) + 10; // 10-90%
            onProgress?.({
              stage: "loading",
              message: report.text || `Loading ${agentInfo?.name}...`,
              progress,
            });
          },
          logLevel: "SILENT",
        },
        // Device-adaptive context window matches model max (Qwen2.5-3B = 8192).
        // desktop-mid/laptop/mobile fall back to 8192 or 4096.
        { context_window_size: contextWindowSize },
      );

      // eslint-disable-next-line no-console
      console.log(
        `🎖️ WebLLM loaded: ${modelId} | context: ${contextWindowSize} | tier: ${tier}`,
      );
      return { modelId, engine }; // Success!
    } catch (modelError) {
      console.warn(`💎 Failed to load ${modelId}:`, modelError.message);

      // If cache error, try to clear and retry once
      if (modelError.message?.includes("Cache") && modelId === modelList[0]) {
        // eslint-disable-next-line no-console
        console.log("💎 Attempting to clear corrupted cache...");
        await clearCorruptedCache();
        // Continue to next model
      }
    }
  }
  return null;
}

/**
 * Initialize Warrant Council with WebLLM model loading
 * Uses a real WebLLM model with Warrant Council specialized prompts
 *
 * @param {string|object} agentIdOrConfig - Either agent ID string ('auditor', 'writer', 'rater')
 *                                          OR config object {modelId, onProgress, onComplete, onError}
 * @param {object} callbacks - Callbacks for progress/complete/error (ignored if first param is object)
 */
export const initializeSwarm = async (
  agentIdOrConfig = "auditor",
  callbacks = {},
) => {
  const { agentId, onProgress, onComplete, onError } =
    _resolveAgentIdAndCallbacks(agentIdOrConfig, callbacks);

  try {
    swarmInitializing = true;

    // Check for WebGPU support
    if (typeof navigator === "undefined" || !navigator.gpu) {
      throw new Error(
        "WebGPU not available. Warrant Council requires Chrome 113+.",
      );
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("No compatible GPU found for Warrant Council.");
    }

    _ensureMLCGPUPatch();

    const agentInfo =
      SWARM_AGENTS[agentId?.toUpperCase?.()] || SWARM_AGENTS["AUDITOR"];
    onProgress?.({
      stage: "init",
      message: `Initializing ${agentInfo?.name || "Diamond Agent"}...`,
      progress: 0,
    });

    // eslint-disable-next-line no-console
    console.log(`🎖️ Initializing Warrant Council agent: ${agentId}`);

    // Probe device capabilities once; select the right model list and context
    // window for the device tier (mobile/tablet/laptop/desktop).
    const deviceProfile = await detectDeviceCapabilities();
    const modelList =
      deviceProfile.recommendedModels?.length > 0
        ? deviceProfile.recommendedModels
        : DIAMOND_MODELS_DEFAULT;
    const contextWindowSize = deviceProfile.contextWindowSize ?? 8192;

    if (!deviceProfile.canUseWebLLM) {
      swarmInitializing = false;
      throw new Error(
        `Warrant Council requires a WebGPU-capable device. ` +
          `Detected: ${deviceProfile.tier} (no WebGPU). ` +
          `Please use a laptop or desktop for local AI analysis.`,
      );
    }

    // Load real WebLLM model for inference - try models in device-optimal order
    const loadResult = await _loadModelFromList(
      modelList,
      agentInfo,
      contextWindowSize,
      deviceProfile.tier,
      onProgress,
    );

    if (!loadResult) {
      swarmInitializing = false;
      const loadErr = new Error(
        "All WebLLM models failed to load. Check the browser console for details (GPU limits, network, or cache errors).",
      );
      onError?.(loadErr);
      return false;
    }

    webllmEngine = loadResult.engine;
    loadedModelId = loadResult.modelId; // Store globally for status reporting

    // Mark as ready only when a model actually loaded
    loadedAgents.add(agentId);
    currentAgent = agentId;
    swarmReady = true;
    swarmInitializing = false;

    onProgress?.({
      stage: "complete",
      message: `${agentInfo?.name} ready!`,
      progress: 100,
    });
    onComplete?.({ agent: agentId });

    return true;
  } catch (error) {
    swarmInitializing = false;
    onError?.(error);
    console.error("🎖️ Warrant Council initialization failed:", error);
    throw error;
  }
};

/**
 * Switch to a different Warrant Council agent
 */
export const switchAgent = async (agentId, callbacks = {}) => {
  if (!SWARM_AGENTS[agentId.toUpperCase()]) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  if (currentAgent === agentId) {
    // eslint-disable-next-line no-console
    console.log(`💎 Already using ${agentId} agent`);
    return true;
  }

  // Switch agent (same WebLLM model, different system prompt)
  currentAgent = agentId;
  loadedAgents.add(agentId);

  // eslint-disable-next-line no-console
  console.log(`💎 Switched to ${SWARM_AGENTS[agentId.toUpperCase()].name}`);
  callbacks.onComplete?.({ agent: agentId });

  return true;
};

/**
 * Truncate the user prompt (keeping the system prompt intact) so the total
 * estimated tokens stay within the device's context window. Returns the
 * prompt unchanged if it already fits.
 */
function _truncatePromptForContext(prompt, finalSystemPrompt, maxTokens) {
  // OCR'd military/medical text tokenizes at ~3 chars/token (not the generic
  // 4 chars/token); using / 3 is deliberately conservative so the truncation
  // guard fires with enough margin that WebLLM never sees a prompt that exceeds
  // context_window_size even on dense chunks.
  const estimatedSystemTokens = Math.ceil(finalSystemPrompt.length / 3);
  const estimatedPromptTokens = Math.ceil(prompt.length / 3);
  const estimatedTotalTokens = estimatedSystemTokens + estimatedPromptTokens;
  // Match the context_window_size the engine was initialized with.
  // Reading from the cached device profile keeps this in sync with the value
  // passed to CreateMLCEngine; defaults to 8192 (Qwen2.5-3B model max).
  const contextLimit = getCachedDeviceProfile()?.contextWindowSize ?? 8192;
  const reservedForOutput = Math.min(maxTokens, 2048); // Reserve for JSON output
  const availableForInput = contextLimit - reservedForOutput;

  // Not too large — nothing to do
  if (estimatedTotalTokens <= availableForInput) {
    return prompt;
  }

  console.warn(
    `💎 Prompt may be too large: ~${estimatedTotalTokens} tokens (limit: ${availableForInput})`,
  );
  // Notify UI so tools can surface a visible warning to the user
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("diamondSwarm:tokenWarning", {
        detail: {
          estimatedTokens: estimatedTotalTokens,
          limit: availableForInput,
        },
      }),
    );
  }

  // Calculate max chars for prompt (keep system prompt, truncate user prompt)
  const maxPromptChars = Math.max(
    1000,
    (availableForInput - estimatedSystemTokens) * 3,
  );
  if (prompt.length <= maxPromptChars) {
    return prompt;
  }

  // eslint-disable-next-line no-console
  console.log(
    `💎 Truncating prompt from ${prompt.length} to ${maxPromptChars} chars`,
  );
  // Keep beginning (context) and end (question) of prompt
  const keepStart = Math.floor(maxPromptChars * 0.3);
  const keepEnd = maxPromptChars - keepStart;
  return (
    prompt.slice(0, keepStart) +
    "\n\n[... middle content truncated for context window ...]\n\n" +
    prompt.slice(-keepEnd)
  );
}

// interruptGenerate is best-effort and may throw if no generation is in
// progress; continue silently either way.
function _interruptGenerate(engine) {
  try {
    engine.interruptGenerate()?.catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Track bracket depth across one streamed delta to detect JSON root
 * completion. Handles escaped chars and string literals so inner braces
 * (e.g. in "description" values) don't trigger a false close. Mutates
 * `state` in place; interrupts `engine` generation once the root object
 * (bracketDepth back to 0) closes.
 */
function _scanDeltaForJSONClose(delta, state, responseText, engine) {
  for (const ch of delta) {
    if (state.escape) {
      state.escape = false;
      continue;
    }
    if (ch === "\\" && state.inString) {
      state.escape = true;
      continue;
    }
    if (ch === '"') {
      state.inString = !state.inString;
      continue;
    }
    if (state.inString) continue;
    if (ch === "{") {
      state.bracketDepth++;
    } else if (ch === "}") {
      state.bracketDepth--;
      if (
        state.bracketDepth === 0 &&
        responseText.trimStart().startsWith("{")
      ) {
        // Root JSON object closed — stop generation immediately.
        _interruptGenerate(engine);
        break;
      }
    }
  }
}

/**
 * JSON mode: always stream internally so we can interrupt the moment
 * the root closing "}" is emitted. This saves all remaining tokens
 * once the JSON object is structurally complete — common on simple/
 * sparse chunks where the schema fills in well under max_tokens.
 * Caller's onStream callback still fires on each delta if provided.
 */
async function _runJSONStreamGeneration(engine, generationConfig, onStream) {
  const jsonStream = await engine.chat.completions.create({
    ...generationConfig,
    stream: true,
  });

  let responseText = "";
  const bracketState = { bracketDepth: 0, inString: false, escape: false };

  for await (const piece of jsonStream) {
    const delta = piece.choices[0]?.delta?.content || "";
    if (delta) {
      responseText += delta;
      onStream?.(delta, responseText);
      _scanDeltaForJSONClose(delta, bracketState, responseText, engine);
    }

    if (
      bracketState.bracketDepth === 0 &&
      responseText.trimStart().startsWith("{")
    )
      break;
    if (piece.choices[0]?.finish_reason) break;
    // Schema maxItems bounds valid output to ~3,300 chars. If we exceed
    // 4,500 the JSON won't parse cleanly anyway — interrupt as safety net.
    if (responseText.length > 4500) {
      try {
        engine.interruptGenerate()?.catch(() => {});
      } catch {
        /* interruptGenerate may throw if no generation is in progress */
      }
      break;
    }
  }

  return responseText;
}

/** Non-JSON caller-driven streaming. */
async function _runPlainStreamGeneration(engine, generationConfig, onStream) {
  const chunks = await engine.chat.completions.create({
    ...generationConfig,
    stream: true,
  });

  let responseText = "";
  for await (const chunk of chunks) {
    const delta = chunk.choices[0]?.delta?.content || "";
    responseText += delta;
    onStream(delta, responseText);
  }
  return responseText;
}

/**
 * stream:true has ~700 ms/token GPU-CPU sync latency on Ada (SM 8.9),
 * turning 1024-token decodes into 12-minute timeouts. stream:false issues
 * one batch readback; the stress harness PROGRESS_STALL_LIMIT_MS (300 s)
 * is set high enough for the decode to complete before the stall fires.
 */
async function _runNonStreamGeneration(engine, generationConfig) {
  const result = await engine.chat.completions.create({
    ...generationConfig,
    stream: false,
  });
  return result.choices[0]?.message?.content || "";
}

async function _runSwarmInference(
  agent,
  finalSystemPrompt,
  prompt,
  maxTokens,
  temperature,
  responseFormat,
  onStream,
) {
  const messages = [
    { role: "system", content: finalSystemPrompt },
    { role: "user", content: prompt },
  ];

  const generationConfig = {
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: !!onStream,
    // Penalize repeated tokens to break repetition loops in small quantized
    // models. XGrammar masks EOS while grammar expects more tokens, which
    // amplifies loops — frequency_penalty 1.15 breaks them while keeping
    // factual field values intact (vLLM issue #40080). top_k/top_p narrow
    // the token distribution for deterministic extraction (Qwen2.5 docs).
    frequency_penalty: responseFormat ? 1.15 : 0,
    top_p: responseFormat ? 0.8 : 1,
    top_k: responseFormat ? 20 : -1,
    // XGrammar per-token constrained decoding — guarantees valid JSON,
    // eliminates repair retries. Keep one constant schema per engine
    // instance (WebLLM issue #560: changing schemas disposes the matcher).
    ...(responseFormat
      ? {
          response_format: {
            type: "json_object",
            schema: JSON.stringify(responseFormat),
          },
        }
      : {}),
  };

  let responseText;

  if (responseFormat) {
    responseText = await _runJSONStreamGeneration(
      webllmEngine,
      generationConfig,
      onStream,
    );
  } else if (onStream) {
    responseText = await _runPlainStreamGeneration(
      webllmEngine,
      generationConfig,
      onStream,
    );
  } else {
    responseText = await _runNonStreamGeneration(
      webllmEngine,
      generationConfig,
    );
  }

  return {
    text: responseText,
    agent: agent.id,
    agentName: agent.name,
    model: loadedModelId || "diamond-swarm",
    tokens: {
      prompt: prompt.length,
      completion: responseText.length,
      total: prompt.length + responseText.length,
    },
  };
}

function _buildLoadingPlaceholderResponse(agent, prompt, onStream) {
  const placeholderText = `[Warrant Council - ${agent.name}]\n\n⚠️ Local AI model is still loading. Please wait for the download to complete.\n\nOnce loaded, this ${agent.name} agent will help with:\n• ${agent.capabilities.join("\n• ")}\n\nYour question: "${prompt.slice(0, 150)}..."`;

  // Call onStream so the UI shows the placeholder immediately
  if (onStream) {
    onStream(placeholderText, placeholderText);
  }

  return {
    text: placeholderText,
    agent: agent.id,
    agentName: agent.name,
    model: "loading",
    tokens: {
      prompt: prompt.length,
      completion: 0,
      total: prompt.length,
    },
  };
}

/**
 * Generate response using Warrant Council
 * Uses WebLLM engine with agent-specific system prompts
 */
export const generateWithSwarm = async (prompt, options = {}) => {
  const {
    agentId = currentAgent || "auditor",
    toolId = null,
    maxTokens = 2048,
    temperature = 0.7,
    systemPrompt = null,
    onStream = null,
    responseFormat = null, // JSON Schema object — enables XGrammar per-token constrained decoding
  } = options;

  // Resolve effective agent. When a toolId is supplied, derive the agent
  // from the capability allowlist in agentBoundaries.js (not from the
  // legacy TOOL_AGENT_MAP table) so the boundary check below has the
  // matching contract to assert against.
  const effectiveAgent = toolId
    ? resolveAgentForTool(toolId, { strict: false })
    : agentId;
  const agent = SWARM_AGENTS[effectiveAgent.toUpperCase()];

  if (!agent) {
    throw new Error(`Unknown agent: ${effectiveAgent}`);
  }

  // Property assertion: the agent must declare the capability the tool
  // requires. Throws AgentBoundaryViolation otherwise — surfacing
  // misrouting instead of silently letting the wrong agent answer.
  // Bare swarm calls (no toolId) skip this check, since the caller is
  // selecting the agent explicitly.
  if (toolId && TOOL_REQUIRED_CAPABILITY[toolId]) {
    enforceAgentBoundary(effectiveAgent, TOOL_REQUIRED_CAPABILITY[toolId]);
  }

  // Use custom system prompt or agent's default
  const finalSystemPrompt = systemPrompt || agent.systemPrompt;

  prompt = _truncatePromptForContext(prompt, finalSystemPrompt, maxTokens);

  // eslint-disable-next-line no-console
  console.log(`💎 Generating with ${agent.name} (${agent.icon})`);

  // If WebLLM engine is loaded, use it for real inference
  if (webllmEngine) {
    try {
      return await _runSwarmInference(
        agent,
        finalSystemPrompt,
        prompt,
        maxTokens,
        temperature,
        responseFormat,
        onStream,
      );
    } catch (inferenceError) {
      console.error("💎 WebLLM inference failed:", inferenceError);
      // The engine exists and genuinely failed — rethrow so callers see the
      // real error (e.g. ContextWindowSizeExceededError triggers their
      // deterministic bailout). Falling through to the "still loading"
      // placeholder masked failures as a retryable loading state.
      throw inferenceError;
    }
  }

  // Fallback: placeholder response when no engine available
  return _buildLoadingPlaceholderResponse(agent, prompt, onStream);
};

/**
 * Process a complete VA claim through the full swarm (all 3 agents)
 * This is the "Diamond Standard" workflow
 */
export const processClaimWithSwarm = async (claimData, callbacks = {}) => {
  const { onProgress, onStepComplete, onComplete, onError } = callbacks;

  try {
    const results = {
      audit: null,
      statement: null,
      rating: null,
      combined: null,
      recommendations: [],
    };

    // Step 1: AUDITOR reviews claim
    onProgress?.({
      step: 1,
      total: 3,
      agent: "auditor",
      message: "Auditor reviewing claim accuracy...",
    });

    const auditResult = await generateWithSwarm(
      `Review this VA disability claim for accuracy and completeness:\n\n${JSON.stringify(claimData, null, 2)}`,
      { agentId: "auditor" },
    );
    results.audit = auditResult.text;
    onStepComplete?.({ step: 1, agent: "auditor", result: auditResult });

    // Step 2: WRITER creates statement
    onProgress?.({
      step: 2,
      total: 3,
      agent: "writer",
      message: "Writer drafting personal statement...",
    });

    const statementResult = await generateWithSwarm(
      `Write a compelling personal statement for this claim:\n\nConditions: ${claimData.conditions?.map((c) => c.name).join(", ")}\nEvidence: ${claimData.evidence || "See attached documentation"}`,
      { agentId: "writer" },
    );
    results.statement = statementResult.text;
    onStepComplete?.({ step: 2, agent: "writer", result: statementResult });

    // Step 3: RATER calculates rating
    onProgress?.({
      step: 3,
      total: 3,
      agent: "rater",
      message: "Rater calculating combined rating...",
    });

    const conditionRatingLines = claimData.conditions
      ?.map((c) => `- ${c.name}: ${c.rating || "TBD"}%`)
      .join("\n");
    const ratingResult = await generateWithSwarm(
      `Calculate the combined VA disability rating for:\n\n${conditionRatingLines}`,
      { agentId: "rater" },
    );
    results.rating = ratingResult.text;
    onStepComplete?.({ step: 3, agent: "rater", result: ratingResult });

    // Generate recommendations
    results.recommendations = [
      "Submit all medical records from service-connected treatment",
      "Include buddy statements from fellow service members",
      "Request Compensation & Pension (C&P) exam",
      "Review audit findings for any missing documentation",
    ];

    // Calculate combined rating (placeholder - actual math in vaCalculations.js)
    results.combined = claimData.conditions?.reduce(
      (acc, c) => Math.max(acc, c.rating || 0),
      0,
    );

    onComplete?.(results);
    return results;
  } catch (error) {
    onError?.(error);
    throw error;
  }
};

/**
 * Unload Warrant Council and free resources
 */
export const unloadSwarm = async () => {
  try {
    // Unload WebLLM engine
    if (webllmEngine) {
      if (typeof webllmEngine.unload === "function") {
        await webllmEngine.unload();
      }
      webllmEngine = null;
    }

    // Legacy swarmEngine cleanup
    if (swarmEngine && typeof swarmEngine.unload === "function") {
      await swarmEngine.unload();
    }

    swarmEngine = null;
    swarmReady = false;
    swarmInitializing = false;
    loadedAgents.clear();
    currentAgent = null;

    // eslint-disable-next-line no-console
    console.log("🎖️ Warrant Council unloaded");
    return true;
  } catch (error) {
    console.error("Error unloading Warrant Council:", error);
    return false;
  }
};

/**
 * Get Warrant Council configuration
 */
export const getSwarmConfig = () => {
  try {
    const stored = localStorage.getItem(SWARM_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Error loading swarm config:", e);
  }

  // Default configuration
  return {
    defaultAgent: "auditor",
    autoSwitchAgents: true,
    modelQuality: "balanced", // 'fast', 'balanced', 'quality'
    maxTokens: 2048,
  };
};

/**
 * Save Diamond Swarm configuration
 */
export const saveSwarmConfig = (config) => {
  localStorage.setItem(SWARM_CONFIG_KEY, JSON.stringify(config));
};

export default {
  SWARM_AGENTS,
  SWARM_MODELS,
  TOOL_AGENT_MAP,
  getAgentForTool,
  getAllAgents,
  isSwarmReady,
  isSwarmInitializing,
  getCurrentAgent,
  getLoadedAgents,
  getSwarmStatus,
  registerSwarmEngine,
  initializeSwarm,
  switchAgent,
  generateWithSwarm,
  processClaimWithSwarm,
  unloadSwarm,
  getSwarmConfig,
  saveSwarmConfig,
};
