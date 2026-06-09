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
let loadedAgents = new Set();
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

// Fallback models for Warrant Council - try smaller models first to avoid cache issues
const DIAMOND_MODELS = [
  "Qwen2.5-3B-Instruct-q4f32_1-MLC", // 2GB - good balance
  "Qwen2.5-1.5B-Instruct-q4f32_1-MLC", // 1GB - faster
  "Llama-3.2-3B-Instruct-q4f32_1-MLC", // 1.8GB - alternative
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
  // Handle both calling conventions:
  // 1. initializeSwarm('auditor', { onProgress, onComplete, onError })
  // 2. initializeSwarm({ modelId: 'vetrate-auditor-7b-v2', onProgress })
  let agentId;
  let onProgress, onComplete, onError;

  if (typeof agentIdOrConfig === "object" && agentIdOrConfig !== null) {
    // Object form - extract modelId and derive agentId
    const {
      modelId,
      onProgress: _onProgress,
      onComplete: _onComplete,
      onError: _onError,
    } = agentIdOrConfig;
    onProgress = _onProgress;
    onComplete = _onComplete;
    onError = _onError;

    // Derive agent from modelId (e.g., 'vetrate-writer-7b-v2' -> 'writer')
    if (modelId) {
      if (modelId.includes("writer")) agentId = "writer";
      else if (modelId.includes("rater")) agentId = "rater";
      else agentId = "auditor"; // default
    } else {
      agentId = "auditor";
    }
  } else {
    // String form - use directly
    agentId = String(agentIdOrConfig || "auditor");
    onProgress = callbacks.onProgress;
    onComplete = callbacks.onComplete;
    onError = callbacks.onError;
  }

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

    // Shared with LocalAIPanel.jsx: patch navigator.gpu.requestAdapter so that
    // when WebLLM internally calls requestDevice it gets the adapter's true max
    // limits (required for Blackwell / RTX 5060 Ti and similar high-end GPUs).
    if (!window._mlc_gpu_patched && navigator.gpu) {
      const _origRequestAdapter = navigator.gpu.requestAdapter.bind(
        navigator.gpu,
      );
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
            maxComputeWorkgroupStorageSize:
              aLimits.maxComputeWorkgroupStorageSize,
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

    const agentInfo =
      SWARM_AGENTS[agentId?.toUpperCase?.()] || SWARM_AGENTS["AUDITOR"];
    onProgress?.({
      stage: "init",
      message: `Initializing ${agentInfo?.name || "Diamond Agent"}...`,
      progress: 0,
    });

    // eslint-disable-next-line no-console
    console.log(`🎖️ Initializing Warrant Council agent: ${agentId}`);

    // Load real WebLLM model for inference - try multiple models
    let loadedModel = null;
    for (const modelId of DIAMOND_MODELS) {
      try {
        const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

        onProgress?.({
          stage: "download",
          message: `Downloading ${agentInfo?.name} (${modelId.split("-")[0]})...`,
          progress: 10,
        });

        webllmEngine = await CreateMLCEngine(modelId, {
          initProgressCallback: (report) => {
            const progress = Math.round(report.progress * 80) + 10; // 10-90%
            onProgress?.({
              stage: "loading",
              message: report.text || `Loading ${agentInfo?.name}...`,
              progress,
            });
          },
          logLevel: "SILENT",
          context_window_size: 8192, // Increase context window to handle larger prompts
        });

        loadedModel = modelId;
        loadedModelId = modelId; // Store globally for status reporting
        // eslint-disable-next-line no-console
        console.log(`🎖️ WebLLM engine loaded for Warrant Council: ${modelId}`);
        break; // Success!
      } catch (modelError) {
        console.warn(`💎 Failed to load ${modelId}:`, modelError.message);

        // If cache error, try to clear and retry once
        if (
          modelError.message?.includes("Cache") &&
          modelId === DIAMOND_MODELS[0]
        ) {
          // eslint-disable-next-line no-console
          console.log("💎 Attempting to clear corrupted cache...");
          await clearCorruptedCache();
          // Continue to next model
        }
      }
    }

    if (!loadedModel) {
      swarmInitializing = false;
      const loadErr = new Error(
        "All WebLLM models failed to load. Check the browser console for details (GPU limits, network, or cache errors).",
      );
      onError?.(loadErr);
      return false;
    }

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

  // Rough token estimation (1 token ≈ 4 characters)
  const estimatedSystemTokens = Math.ceil(finalSystemPrompt.length / 4);
  const estimatedPromptTokens = Math.ceil(prompt.length / 4);
  const estimatedTotalTokens = estimatedSystemTokens + estimatedPromptTokens;
  const contextLimit = 4096; // Qwen2.5-3B actual context window
  const reservedForOutput = Math.min(maxTokens, 1024); // Reserve 1024 tokens for complete JSON output
  const availableForInput = contextLimit - reservedForOutput;

  // Warn and truncate if prompt is too large
  if (estimatedTotalTokens > availableForInput) {
    console.warn(
      `💎 Prompt may be too large: ~${estimatedTotalTokens} tokens (limit: ${availableForInput})`,
    );

    // Calculate max chars for prompt (keep system prompt, truncate user prompt)
    const maxPromptChars = Math.max(
      1000,
      (availableForInput - estimatedSystemTokens) * 4,
    );
    if (prompt.length > maxPromptChars) {
      // eslint-disable-next-line no-console
      console.log(
        `💎 Truncating prompt from ${prompt.length} to ${maxPromptChars} chars`,
      );
      // Keep beginning (context) and end (question) of prompt
      const keepStart = Math.floor(maxPromptChars * 0.3);
      const keepEnd = maxPromptChars - keepStart;
      prompt =
        prompt.slice(0, keepStart) +
        "\n\n[... middle content truncated for context window ...]\n\n" +
        prompt.slice(-keepEnd);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`💎 Generating with ${agent.name} (${agent.icon})`);

  // If WebLLM engine is loaded, use it for real inference
  if (webllmEngine) {
    try {
      const messages = [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: prompt },
      ];

      const generationConfig = {
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: !!onStream,
      };

      let responseText = "";

      if (onStream) {
        // Streaming response
        const chunks = await webllmEngine.chat.completions.create({
          ...generationConfig,
          stream: true,
        });

        for await (const chunk of chunks) {
          const delta = chunk.choices[0]?.delta?.content || "";
          responseText += delta;
          onStream(delta, responseText); // Pass both delta and full accumulated text
        }
      } else {
        // Non-streaming response
        const response =
          await webllmEngine.chat.completions.create(generationConfig);
        responseText = response.choices[0]?.message?.content || "";
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
    } catch (inferenceError) {
      console.error("💎 WebLLM inference failed:", inferenceError);
      // Fall through to placeholder response
    }
  }

  // Fallback: placeholder response when no engine available
  const placeholderText = `[Warrant Council - ${agent.name}]\n\n⚠️ Local AI model is still loading. Please wait for the download to complete.\n\nOnce loaded, this ${agent.name} agent will help with:\n• ${agent.capabilities.join("\n• ")}\n\nYour question: "${prompt.slice(0, 150)}..."`;

  // Call onStream so the UI shows the placeholder immediately
  if (onStream) {
    onStream(placeholderText, placeholderText);
  }

  const response = {
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

  return response;
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

    const ratingResult = await generateWithSwarm(
      `Calculate the combined VA disability rating for:\n\n${claimData.conditions?.map((c) => `- ${c.name}: ${c.rating || "TBD"}%`).join("\n")}`,
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
