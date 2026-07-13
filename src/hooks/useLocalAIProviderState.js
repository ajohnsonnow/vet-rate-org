/**
 * Vet-Rate.org - Local AI Provider state
 * "The Faraday Cage Protocol" - Run AI completely locally, zero data leaves your device
 *
 * All WebGPU detection, model catalog, and engine lifecycle logic that used
 * to live directly in LocalAIProvider (src/components/LocalAIPanel.jsx).
 * Extracted verbatim into this hook so the provider component itself stays
 * a thin `useLocalAIProviderState() -> <Context.Provider>` wrapper.
 */

import { useState, useEffect, useCallback } from "react";
import { registerLocalAIEngine } from "../utils/unifiedAIService";
import { gpuManager } from "../utils/WebGPUManager";

// Storage key for GPU preference
const GPU_PREFERENCE_KEY = "vet_rate_gpu_preference";

// GPU preference options
export const GPU_PREFERENCES = {
  AUTO: "auto", // Let browser decide (default behavior)
  HIGH_PERFORMANCE: "high-performance", // Prefer discrete GPU (gaming/workstation)
  LOW_POWER: "low-power", // Prefer integrated GPU (battery saver)
};

/**
 * Get the saved GPU preference
 */
export const getGPUPreference = () => {
  return localStorage.getItem(GPU_PREFERENCE_KEY) || GPU_PREFERENCES.AUTO;
};

/**
 * Save GPU preference
 */
export const setGPUPreference = (preference) => {
  if (Object.values(GPU_PREFERENCES).includes(preference)) {
    localStorage.setItem(GPU_PREFERENCE_KEY, preference);
    return true;
  }
  return false;
};

/**
 * Get adapter info helper with fallbacks
 */
const getAdapterInfo = async (adapter) => {
  let adapterInfo = {
    vendor: "Unknown",
    architecture: "Unknown",
    device: "Unknown GPU",
    description: "",
  };

  try {
    // Modern WebGPU spec: info property is directly accessible
    if (adapter.info) {
      adapterInfo = adapter.info;
      // eslint-disable-next-line no-console
      console.log("🎮 GPU Adapter Info:", adapterInfo);
    }
    // Legacy: Try requestAdapterInfo method (older Chrome versions)
    else if (
      adapter.requestAdapterInfo &&
      typeof adapter.requestAdapterInfo === "function"
    ) {
      adapterInfo = await adapter.requestAdapterInfo();
      // eslint-disable-next-line no-console
      console.log("🎮 GPU Adapter Info (legacy method):", adapterInfo);
    }
    // Fallback: Basic detection
    else if (adapter.features && adapter.limits) {
      adapterInfo = {
        vendor: "WebGPU Compatible",
        device: "GPU Detected",
        description: "WebGPU is functional",
      };
      // eslint-disable-next-line no-console
      console.log("🎮 GPU Adapter Info (basic detection):", adapterInfo);
    }
  } catch (infoErr) {
    // eslint-disable-next-line no-console
    console.warn(
      "Could not get detailed adapter info, but WebGPU is available:",
      infoErr,
    );
    adapterInfo = {
      vendor: "WebGPU Compatible",
      device: "GPU Detected",
      description: "WebGPU is functional",
    };
  }

  return adapterInfo;
};

/**
 * Get detailed GPU adapter information
 */
const getDetailedAdapterInfo = async (adapter) => {
  if (!adapter) return null;

  const limits = adapter.limits;
  const features = Array.from(adapter.features || []);
  const info = await getAdapterInfo(adapter);

  // Estimate VRAM from max buffer size (rough approximation)
  const estimatedVRAM = limits.maxBufferSize
    ? Math.floor(limits.maxBufferSize / (1024 * 1024 * 1024))
    : null;

  // Build a meaningful GPU name if description/device are empty
  let gpuName = info.description || info.device;
  if (!gpuName || gpuName.trim() === "") {
    // Fallback: Use vendor + architecture to create a descriptive name
    const vendorName = (info.vendor || "Unknown").toUpperCase();
    const arch = info.architecture
      ? ` ${info.architecture.charAt(0).toUpperCase()}${info.architecture.slice(1)}`
      : "";
    gpuName = `${vendorName}${arch} GPU`;
  }

  return {
    ...info,
    device: gpuName,
    description: gpuName,
    limits: {
      maxTextureSize: limits.maxTextureDimension2D,
      maxBufferSize: `${Math.floor(limits.maxBufferSize / (1024 * 1024))} MB`,
      maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX,
      maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension,
    },
    features: features,
    estimatedVRAM: estimatedVRAM ? `~${estimatedVRAM}+ GB` : "Unknown",
  };
};

const getGPUTierLabel = (tier) => {
  if (tier === "High Performance") return "🚀 High Performance";
  if (tier === "Integrated") return "🔋 Power Saver";
  return "⚙️ Standard";
};

const getGPUTierDescription = (tier) => {
  if (tier === "High Performance") return "Best for AI - Uses dedicated GPU";
  if (tier === "Integrated")
    return "Extends battery life - Uses integrated GPU";
  return "Standard GPU";
};

/**
 * Enumerate available GPUs by trying different power preferences.
 * Returns info about both high-performance and low-power GPUs if available.
 */
export const enumerateGPUs = async () => {
  if (!navigator.gpu) {
    return { available: [], error: "WebGPU not available" };
  }

  const gpus = [];
  const seen = new Set(); // Track unique GPUs

  try {
    // Try high-performance (discrete GPU)
    const highPerfAdapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (highPerfAdapter) {
      const detailedInfo = await getDetailedAdapterInfo(highPerfAdapter);
      const gpuId = `${detailedInfo.vendor}-${detailedInfo.device}`;

      if (!seen.has(gpuId)) {
        seen.add(gpuId);
        const gpuName =
          detailedInfo.device || detailedInfo.description || "Discrete GPU";
        gpus.push({
          type: "high-performance",
          label: "🚀 High Performance",
          description: "Best for AI - Uses dedicated GPU",
          vendor: detailedInfo.vendor || "Unknown",
          device: gpuName,
          architecture: detailedInfo.architecture || "Unknown",
          vram: detailedInfo.estimatedVRAM,
          limits: detailedInfo.limits,
          features: detailedInfo.features,
          adapter: detailedInfo,
        });
      }
    }

    // Try low-power (integrated GPU)
    const lowPowerAdapter = await navigator.gpu.requestAdapter({
      powerPreference: "low-power",
    });
    if (lowPowerAdapter) {
      const detailedInfo = await getDetailedAdapterInfo(lowPowerAdapter);
      const gpuId = `${detailedInfo.vendor}-${detailedInfo.device}`;

      if (!seen.has(gpuId)) {
        seen.add(gpuId);
        const gpuName =
          detailedInfo.device || detailedInfo.description || "Integrated GPU";
        gpus.push({
          type: "low-power",
          label: "🔋 Power Saver",
          description: "Extends battery life - Uses integrated GPU",
          vendor: detailedInfo.vendor || "Unknown",
          device: gpuName,
          architecture: detailedInfo.architecture || "Unknown",
          vram: detailedInfo.estimatedVRAM,
          limits: detailedInfo.limits,
          features: detailedInfo.features,
          adapter: detailedInfo,
        });
      }
    }

    // eslint-disable-next-line no-console
    console.log(`🎮 GPU Enumeration Complete:`);
    // eslint-disable-next-line no-console
    console.log(`   - Total GPUs found: ${gpus.length}`);
    // eslint-disable-next-line no-console
    console.log(`   - Has dual GPU: ${gpus.length > 1}`);
    gpus.forEach((gpu, idx) => {
      // eslint-disable-next-line no-console
      console.log(
        `   - GPU ${idx + 1}: ${gpu.device} (${gpu.vendor}) - ${gpu.type}`,
      );
    });

    return {
      available: gpus,
      hasDualGPU: gpus.length > 1,
      hasMultiGPU: gpus.length >= 2,
    };
  } catch (err) {
    console.error("❌ Error enumerating GPUs:", err);
    return { available: [], error: err.message };
  }
};

// Check WebGPU support using the new WebGPUManager
// Track if we've already started initialization to prevent double-init in strict mode
let webGPUInitializing = false;
let webGPUInitPromise = null;
let webGPULastResult = null; // Cache the result for strict mode re-renders

const buildWebGPUInitErrorResult = (err) => {
  console.error("🎮 WebGPU Manager error:", err);

  // If adapter was consumed (strict mode issue), try to reinitialize
  if (err.message?.includes("consumed")) {
    console.warn(
      "🎮 Adapter was consumed, attempting to recover with fresh adapters...",
    );
    // Clear cached adapters and try again
    gpuManager.adapters.clear();
    gpuManager.device = null;
    gpuManager.selectedAdapter = null;
    gpuManager.isInitializing = false;
    gpuManager.initPromise = null;
    // Return unsupported for now, let user retry
    return {
      supported: false,
      reason:
        "WebGPU adapter was consumed. Please refresh the page or click the refresh button.",
    };
  }

  return {
    supported: false,
    reason: `WebGPU initialization failed: ${err.message}`,
  };
};

// Scans, selects, and validates a WebGPU adapter/device via gpuManager.
// Extracted from checkWebGPUSupport so that function stays small; this is
// the body of the async work that used to be an inline IIFE there.
const performWebGPUInitialization = async () => {
  try {
    // eslint-disable-next-line no-console
    console.log("🎮 Initializing WebGPU Manager...");

    // Scan for available GPUs using the new manager
    const adapters = await gpuManager.scanForAdapters();

    if (adapters.length === 0) {
      return {
        supported: false,
        reason: "No WebGPU adapter found (GPU may not be compatible)",
      };
    }

    // Auto-select best GPU or restore previous selection
    await gpuManager.autoSelectBest();
    const device = gpuManager.getDevice();

    if (!device) {
      return { supported: false, reason: "Failed to initialize GPU device" };
    }

    // Get the selected adapter info
    const selectedAdapter = gpuManager.getSelectedAdapter();
    const selectedGPU = adapters.find((a) => a.adapter === selectedAdapter);

    if (!selectedGPU) {
      return { supported: false, reason: "Selected GPU not found" };
    }

    // eslint-disable-next-line no-console
    console.log(
      `🎮 WebGPU Manager initialized with ${adapters.length} GPU(s)`,
    );
    // eslint-disable-next-line no-console
    console.log(`🎮 Selected: ${selectedGPU.info.displayName}`);

    // Check for required features
    const requiredFeatures = ["shader-f16"]; // MLC-LLM typically needs float16 support
    const availableFeatures = Array.from(selectedAdapter.features || []);
    const missingFeatures = requiredFeatures.filter(
      (f) => !availableFeatures.includes(f),
    );

    if (missingFeatures.length > 0) {
      console.warn(
        `⚠️ Missing WebGPU features: ${missingFeatures.join(", ")}`,
      );
      console.warn("⚠️ Some AI models may not work properly");
    }

    const result = {
      supported: true,
      adapter: selectedGPU.info,
      vendor: selectedGPU.info.vendor,
      device: selectedGPU.info.displayName,
      currentPreference: selectedGPU.hint || "auto",
      availableFeatures,
      missingFeatures,
      availableGPUs: adapters.map((a) => ({
        type: a.tier.toLowerCase().replace(" ", "-"),
        label: getGPUTierLabel(a.tier),
        description: getGPUTierDescription(a.tier),
        vendor: a.info.vendor,
        device: a.info.displayName,
        architecture: a.info.architecture,
        vram: gpuManager.estimateVRAM(a),
        adapter: a.info,
      })),
      hasDualGPU: adapters.length > 1,
    };

    // Cache successful result
    webGPULastResult = result;
    return result;
  } catch (err) {
    return buildWebGPUInitErrorResult(err);
  } finally {
    webGPUInitializing = false;
  }
};

export const checkWebGPUSupport = async (_forcePowerPreference = null) => {
  if (!navigator.gpu) {
    return {
      supported: false,
      reason:
        "WebGPU not available in this browser. Try Chrome 113+, Edge 113+, or Firefox Nightly.",
    };
  }

  // If we already have a successful result and device is still valid, return cached result
  // This handles React strict mode re-renders efficiently
  if (webGPULastResult?.supported && gpuManager.getDevice()) {
    // eslint-disable-next-line no-console
    console.log("🎮 Using cached WebGPU initialization result");
    return webGPULastResult;
  }

  // Prevent concurrent initialization attempts (React strict mode double-mounts)
  if (webGPUInitializing && webGPUInitPromise) {
    // eslint-disable-next-line no-console
    console.log("🎮 WebGPU initialization already in progress, waiting...");
    try {
      return await webGPUInitPromise;
    } catch (err) {
      // If waiting failed (e.g., consumed adapter), fall through to reinitialize
      console.warn(
        "🎮 Previous init failed, retrying with fresh adapters...",
        err,
      );
    }
  }

  webGPUInitializing = true;
  webGPUInitPromise = performWebGPUInitialization();
  return await webGPUInitPromise;
};

// Available models organized by RECOMMENDED USE CASE
// 💎 Diamond Swarm agents are the ONLY recommended choice for VA claims processing
// All legacy WebLLM models have been removed - Diamond Swarm provides superior results
const AVAILABLE_MODELS = [
  // === 💎 DIAMOND SWARM AGENTS - Specialized for VA Claims ===
  {
    id: "diamond-auditor",
    name: "🎖️ CW5 Auditor (Recommended)",
    size: "4.0 GB",
    description:
      "Specialized agent for claim review, compliance, and document analysis",
    bestFor: "🔍 Claim Review & Analysis",
    contextInfo:
      "Best for: DD214, C-File, Blue Button, Decision Decoder, compliance checking",
    vramRequired: "6 GB",
    recommended: true,
    category: "diamond",
    isDiamond: true,
    // Base model transparency - let veterans know what powers their AI
    baseModel: "Qwen2.5-7B-Instruct",
    baseModelInfo:
      "Fine-tuned from Alibaba's Qwen 2.5 (7B parameters) - Open source, privacy-respecting",
    trainingFocus: "VA regulations, 38 CFR, claim evidence analysis",
  },
  {
    id: "diamond-writer",
    name: "🎖️ CW4 Writer (Creative)",
    size: "4.0 GB",
    description:
      "Specialized agent for personal statements, nexus letters, buddy statements",
    bestFor: "✍️ Statement Writing",
    contextInfo:
      "Best for: Personal statements, nexus letters, witness statements",
    vramRequired: "6 GB",
    recommended: true,
    category: "diamond",
    isDiamond: true,
    // Base model transparency
    baseModel: "Qwen2.5-7B-Instruct",
    baseModelInfo:
      "Fine-tuned from Alibaba's Qwen 2.5 (7B parameters) - Open source, privacy-respecting",
    trainingFocus:
      "Veteran-voice writing, empathetic statements, legal phrasing",
  },
  {
    id: "diamond-rater",
    name: "🎖️ CW3 Rater (Calculations)",
    size: "4.0 GB",
    description:
      "Specialized agent for VA rating calculations and bilateral factor",
    bestFor: "🧮 Rating Calculations",
    contextInfo:
      "Best for: Combined ratings, bilateral factor, TDIU assessment",
    vramRequired: "6 GB",
    recommended: true,
    category: "diamond",
    isDiamond: true,
    // Base model transparency
    baseModel: "Qwen2.5-7B-Instruct",
    baseModelInfo:
      "Fine-tuned from Alibaba's Qwen 2.5 (7B parameters) - Open source, privacy-respecting",
    trainingFocus: "VA math, bilateral factor, combined ratings table",
  },
];

/**
 * Initializes a Diamond Swarm agent (as opposed to a legacy WebLLM model).
 * Extracted from initializeEngine's "diamond-" branch; takes the state
 * setters it needs as an explicit dependency object.
 */
const initializeDiamondSwarmAgent = async (
  modelId,
  { setLoadProgress, setIsReady, setIsLoading, setError },
) => {
  const agentId = modelId.replace("diamond-", "");
  // eslint-disable-next-line no-console
  console.log(`💎 Initializing Diamond Swarm agent: ${agentId}`);

  try {
    const { initializeSwarm, SWARM_AGENTS } =
      await import("../utils/diamondSwarm");
    const agentInfo = SWARM_AGENTS[agentId.toUpperCase()];

    setLoadProgress({
      progress: 0,
      text: `💎 Initializing ${agentInfo?.name || "Diamond Agent"}...`,
    });

    await initializeSwarm(agentId, {
      onProgress: (status) => {
        setLoadProgress({
          progress: status.progress || 50,
          text: status.message || `💎 Loading ${agentInfo?.name}...`,
        });
      },
      onComplete: () => {
        setLoadProgress({
          progress: 100,
          text: "🎖️ Warrant Council ready!",
        });
      },
      onError: (err) => {
        throw err;
      },
    });

    // Register with unified AI service
    const { registerSwarmEngine } = await import("../utils/unifiedAIService");
    registerSwarmEngine(null, true, false, agentId);

    // Update local state
    setIsReady(true);
    setIsLoading(false);
    setLoadProgress({
      progress: 100,
      text: `💎 ${agentInfo?.name} ready!`,
    });
    localStorage.setItem("vet_rate_local_ai_model", modelId);

    // eslint-disable-next-line no-console
    console.log(
      `🎖️ Warrant Council ${agentId.toUpperCase()} agent initialized successfully`,
    );
    return true;
  } catch (err) {
    console.error("🎖️ Warrant Council initialization failed:", err);
    setError(`Warrant Council error: ${err.message}`);
    setIsLoading(false);
    return null;
  }
};

/**
 * Message shown when the user's selected legacy WebLLM model is disabled.
 */
const getDisabledModelMessage = (model) => {
  // Check for beta/experimental models (vision models with u8 shader issue)
  if (model.disabledReason === "beta-experimental") {
    return (
      "🚧 VISION MODEL: Waiting for Upstream Fix\n\n" +
      `${model.name} requires experimental WebGPU features that aren't available in standard browsers yet.\n\n` +
      "📋 WHAT'S HAPPENING:\n" +
      'Vision models use image processing shaders with "u8" (uint8) data types. These require the experimental "chromium_experimental_subgroup_matrix" WebGPU extension, which is only available in Chrome Canary with special flags.\n\n' +
      "🔧 TEMPORARY WORKAROUND:\n" +
      "1. Install Chrome Canary: google.com/chrome/canary\n" +
      "2. Create a shortcut with flag:\n" +
      "   chrome.exe --enable-dawn-features=allow_unsafe_apis\n" +
      "3. Open Vet-Rate.org in Chrome Canary\n\n" +
      "🔮 WHAT WE'RE DOING:\n" +
      "The MLC-AI team is actively working on a fix (GitHub issue #727). We're monitoring progress and will enable this model as soon as standard browser support is available.\n\n" +
      "💡 ALTERNATIVES:\n" +
      '• Use "The Navigator" with cloud AI for document questions\n' +
      "• Use our DD214 text extraction (OCR) feature\n" +
      "• Text-only local models work great for claims help!\n\n" +
      "🎖️ Built by veterans, for veterans - we'll get this working!"
    );
  }

  // Default disabled message
  return (
    "🚫 This Model is Currently Disabled\n\n" +
    `${model.name} has been temporarily disabled.\n\n` +
    "🔨 COMING SOON: Vet-Rate Vision Phi\n\n" +
    "We're compiling our own custom vision language model specifically optimized for:\n" +
    "• DD214 document recognition\n" +
    "• Medical record parsing\n" +
    "• VA forms processing\n\n" +
    "✨ Built by veterans, for veterans\n" +
    "✨ Works in any browser (no experimental features)\n" +
    "✨ 100% private - runs locally on your device\n\n" +
    "Check back soon for updates!"
  );
};

/**
 * Message shown when a vision model needs experimental WebGPU features
 * that aren't available (and it isn't our custom vision model).
 */
const getVisionModelBlockedMessage = (model) =>
  "⚠️ Vision Model Requires Experimental Chrome Features\n\n" +
  `${model.name} uses WebGPU features not yet available in Chrome Stable.\n\n` +
  "✅ SOLUTION: Use Chrome Canary\n" +
  "   1. Download: https://google.com/chrome/canary/\n" +
  "   2. Enable flags: chrome://flags\n" +
  "      • enable-unsafe-webgpu\n" +
  "      • enable-webgpu-developer-features\n" +
  "   3. Relaunch and try again\n\n" +
  '💡 BETTER OPTION: Try "Vet-Rate Vision Phi" - our custom model that works in standard Chrome!\n\n' +
  "Technical: Requires chromium-experimental-subgroup-matrix for u8 shader types.";

/**
 * CRITICAL FIX: Monkey-patch navigator.gpu.requestAdapter to inject proper
 * limits. MLC-LLM calls requestAdapter() itself, so we must patch at that
 * level. Extracted verbatim from initializeEngine; runs once (guarded by
 * window._mlc_gpu_patched) and has no dependency on component state.
 */
const patchWebGPUAdapterForMLC = () => {
  if (window._mlc_gpu_patched || !navigator.gpu) return;

  const originalRequestAdapter = navigator.gpu.requestAdapter.bind(
    navigator.gpu,
  );

  navigator.gpu.requestAdapter = async function (options) {
    // eslint-disable-next-line no-console
    console.log("🔧 Intercepting requestAdapter");
    const adapter = await originalRequestAdapter(options);
    if (!adapter) return adapter;

    // Now patch this adapter's requestDevice
    const adapterLimits = adapter.limits;
    const adapterFeatures = adapter.features;
    const originalRequestDevice = adapter.requestDevice.bind(adapter);

    // eslint-disable-next-line no-console
    console.log("🔧 Adapter limits:", {
      maxStorageBufferBindingSize: adapterLimits.maxStorageBufferBindingSize,
      maxBufferSize: adapterLimits.maxBufferSize,
      maxComputeInvocationsPerWorkgroup:
        adapterLimits.maxComputeInvocationsPerWorkgroup,
    });
    // eslint-disable-next-line no-console
    console.log("🔧 Adapter features:", [...adapterFeatures]);

    adapter.requestDevice = async function (descriptor = {}) {
      // eslint-disable-next-line no-console
      console.log("🔧 Intercepting requestDevice to inject proper limits");

      // Build requiredLimits from adapter's max limits
      const requiredLimits = {
        ...descriptor.requiredLimits,
        maxComputeInvocationsPerWorkgroup:
          adapterLimits.maxComputeInvocationsPerWorkgroup || 1024,
        maxStorageBufferBindingSize:
          adapterLimits.maxStorageBufferBindingSize,
        maxBufferSize: adapterLimits.maxBufferSize,
        maxComputeWorkgroupSizeX: adapterLimits.maxComputeWorkgroupSizeX,
        maxComputeWorkgroupSizeY: adapterLimits.maxComputeWorkgroupSizeY,
        maxComputeWorkgroupSizeZ: adapterLimits.maxComputeWorkgroupSizeZ,
        maxComputeWorkgroupStorageSize:
          adapterLimits.maxComputeWorkgroupStorageSize,
        maxBindGroups: adapterLimits.maxBindGroups,
        maxBindingsPerBindGroup: adapterLimits.maxBindingsPerBindGroup,
        maxDynamicStorageBuffersPerPipelineLayout:
          adapterLimits.maxDynamicStorageBuffersPerPipelineLayout,
        maxStorageBuffersPerShaderStage:
          adapterLimits.maxStorageBuffersPerShaderStage,
      };

      // Build requiredFeatures - include shader-f16 if available for better compatibility
      const requiredFeatures = [...(descriptor.requiredFeatures || [])];
      if (
        adapterFeatures.has("shader-f16") &&
        !requiredFeatures.includes("shader-f16")
      ) {
        requiredFeatures.push("shader-f16");
      }

      const enhancedDescriptor = {
        ...descriptor,
        requiredLimits,
        requiredFeatures,
      };

      // eslint-disable-next-line no-console
      console.log("🔧 Requesting device with:", {
        maxComputeInvocationsPerWorkgroup:
          enhancedDescriptor.requiredLimits.maxComputeInvocationsPerWorkgroup,
        maxStorageBufferBindingSize:
          enhancedDescriptor.requiredLimits.maxStorageBufferBindingSize,
        maxBufferSize: enhancedDescriptor.requiredLimits.maxBufferSize,
        requiredFeatures: enhancedDescriptor.requiredFeatures,
      });

      return await originalRequestDevice(enhancedDescriptor);
    };

    return adapter;
  };
  window._mlc_gpu_patched = true;
  // eslint-disable-next-line no-console
  console.log("🔧 WebGPU patched for MLC-LLM compatibility");
};

/**
 * Builds a user-facing error message (and whether it's a shader-compile
 * class failure) from an engine-initialization error. Extracted from
 * initializeEngine's catch block; pure function of the error.
 */
const getEngineInitErrorDetails = (err) => {
  // Check for GPUPipelineError with u8 type issues (Vision models)
  if (
    err.name === "GPUPipelineError" ||
    err.message?.includes("GPUPipelineError") ||
    err.message?.includes("Invalid ShaderModule")
  ) {
    return {
      message:
        "🚨 GPU Shader Compilation Failed\n\n" +
        "This model uses WebGPU shader features not available in standard Chrome/Edge.\n\n" +
        "🔧 TO FIX:\n\n" +
        "1. Install Chrome Canary:\n" +
        "   https://google.com/chrome/canary/\n\n" +
        "2. Create a shortcut with this flag:\n" +
        "   chrome.exe --enable-dawn-features=allow_unsafe_apis\n\n" +
        "💡 Or try a different model that works in standard Chrome!\n\n" +
        "Technical: Model uses u8/uint8 shader types requiring chromium_experimental_subgroup_matrix.",
      isShaderFailure: true,
    };
  }

  if (err.message?.includes("chromium_experimental_subgroup_matrix")) {
    return {
      message: `🚨 WGSL Extension Not Enabled\n\nThe 'chromium_experimental_subgroup_matrix' extension is required but not enabled.\n\n✅ FIX: Launch Chrome with:\n--enable-dawn-features=allow_unsafe_apis\n\n📚 See FAQ for detailed instructions (Windows/Mac/Linux)`,
      isShaderFailure: true,
    };
  }

  let message = err.message || "Failed to initialize local AI";

  if (
    err.message?.includes("u8") ||
    err.message?.includes("WGSL") ||
    err.message?.includes("shader")
  ) {
    message =
      "⚠️ WebGPU Shader Compatibility Issue\n\n" +
      "Your browser does not support the shader features required by this AI model.\n\n" +
      "🔧 Solutions:\n" +
      "1. Update Chrome/Edge to the latest version (recommended)\n" +
      "2. Update your GPU drivers\n" +
      "3. Try launching Chrome with experimental flags:\n" +
      "   chrome.exe --enable-dawn-features=allow_unsafe_apis\n" +
      "4. Try a smaller AI model (360M or 1B models)\n\n" +
      "Technical: WGSL u8 type requires experimental WebGPU features.";
  } else if (err.message?.includes("GPUValidationError")) {
    message =
      "⚠️ WebGPU Validation Error\n\n" +
      "The AI model failed GPU validation. This may be due to:\n" +
      "• Outdated GPU drivers\n" +
      "• Browser compatibility issues\n" +
      "• Insufficient GPU memory\n\n" +
      "Please update your GPU drivers and browser.";
  } else if (
    err.message?.includes("Cache") ||
    err.message?.includes("Entry was not found")
  ) {
    message =
      "⚠️ Model Download Issue\n\n" +
      "The model could not be downloaded or cached. This may be due to:\n" +
      "• Network connection issues\n" +
      "• HuggingFace server temporarily unavailable\n" +
      "• Browser storage quota exceeded\n\n" +
      "🔧 Solutions:\n" +
      "1. Check your internet connection\n" +
      "2. Clear browser cache and try again\n" +
      "3. Try a smaller model first\n" +
      "4. Check if you have sufficient disk space";
  } else if (
    err.message?.includes("network") ||
    err.message?.includes("fetch") ||
    err.message?.includes("Failed to fetch")
  ) {
    message =
      "⚠️ Network Error\n\n" +
      "Could not download the AI model.\n\n" +
      "🔧 Please check:\n" +
      "• Your internet connection\n" +
      "• That HuggingFace.co is not blocked\n" +
      "• Your firewall/proxy settings";
  }

  return { message, isShaderFailure: false };
};

/**
 * Determines whether a model needs experimental WebGPU features that aren't
 * available, in which case initializeEngine must block loading it.
 * NOTE: Our custom Vet-Rate Vision Phi model is compiled with q4f32_1
 * quantization, which uses f32 instead of u8 types, so it works in
 * standard Chrome and doesn't need to be blocked here.
 */
const getVisionModelGateStatus = (modelId, selectedModel) => {
  const isVisionModel =
    modelId.includes("vision") || modelId.includes("Vision");
  const isCustomVisionModel =
    selectedModel.isCustomModel && selectedModel.hasVision;
  const hasExperimentalFeatures = gpuManager
    .getDevice()
    ?.features?.has("chromium-experimental-subgroup-matrix");

  return {
    isVisionModel,
    isCustomVisionModel,
    isBlocked: isVisionModel && !isCustomVisionModel && !hasExperimentalFeatures,
  };
};

/**
 * Checks WebLLM's model cache, treating any lookup failure as "not cached"
 * (e.g. for custom models the cache API doesn't know about).
 */
const checkIfModelIsCached = async (modelId) => {
  try {
    const { hasModelInCache } = await import("@mlc-ai/web-llm");
    return await hasModelInCache(modelId);
  } catch (err) {
    console.warn(`Could not check cache for ${modelId}:`, err);
    return false;
  }
};

/**
 * Progress callback passed to CreateMLCEngine, with friendlier text based on
 * whether the model is downloading or loading into the GPU.
 */
const createEngineInitProgressCallback =
  (isDownloading, setLoadProgress) => (report) => {
    const progress = Math.round(report.progress * 100);
    let text = report.text || "Loading...";

    if (text.includes("Downloading")) {
      text = `📥 ${text}`;
    } else if (text.includes("Loading")) {
      text = `⚡ ${text}`;
    } else if (progress < 50 && isDownloading) {
      text = `📥 Downloading: ${progress}%`;
    } else if (progress >= 50 || !isDownloading) {
      text = `⚡ Loading into GPU: ${progress}%`;
    }

    setLoadProgress({ progress, text });
  };

/**
 * Builds the CreateMLCEngine options, including appConfig for custom
 * (non-prebuilt) models such as our Vision Phi model.
 */
const buildMLCEngineOptions = async (
  selectedModel,
  initProgressCallback,
  { setError, setIsReady, setEngine },
) => {
  const engineOptions = {
    initProgressCallback,
    logLevel: "SILENT",
    // Request specific WebGPU features if available
    deviceLostCallback: () => {
      console.warn("⚠️ WebGPU device lost, reinitializing...");
      setError("GPU device lost. Please reload the page.");
      setIsReady(false);
      setEngine(null);
    },
  };

  // Check if this is a custom model that needs appConfig
  if (selectedModel.isCustomModel && selectedModel.customConfig) {
    // eslint-disable-next-line no-console
    console.log(
      "🎯 Loading custom model with appConfig:",
      selectedModel.customConfig,
    );

    // Import ModelType enum from WebLLM for VLM specification
    const { ModelType } = await import("@mlc-ai/web-llm");

    const modelListEntry = {
      model: selectedModel.customConfig.model,
      model_id: selectedModel.customConfig.model_id,
      model_lib: selectedModel.customConfig.model_lib,
    };

    // If this is a vision model, specify model_type as VLM
    if (selectedModel.hasVision) {
      modelListEntry.model_type = ModelType.VLM;
      // eslint-disable-next-line no-console
      console.log("🖼️ Custom model marked as VLM (vision-language model)");
    }

    engineOptions.appConfig = {
      model_list: [modelListEntry],
    };
  }

  return engineOptions;
};

/**
 * Double-checks the freshly-loaded model is actually cached and marks it
 * installed either way (the engine already loaded successfully).
 */
const markModelInstalledAfterLoad = async (modelId, setInstalledModels) => {
  try {
    const { hasModelInCache } = await import("@mlc-ai/web-llm");
    const isNowCached = await hasModelInCache(modelId);
    if (isNowCached) {
      setInstalledModels((prev) => new Set([...prev, modelId]));
      // eslint-disable-next-line no-console
      console.log(`✅ Model ${modelId} verified as cached`);
    }
  } catch (err) {
    console.warn("Could not verify model cache:", err);
    // Still mark as installed since the engine loaded successfully
    setInstalledModels((prev) => new Set([...prev, modelId]));
  }
};

/**
 * Routes a generate() call through the Diamond Swarm service - either the
 * local llama.cpp server if available, or the in-browser WebLLM engine.
 * Extracted from generate()'s "isDiamond" branch.
 */
const generateViaDiamondSwarm = async (prompt, options) => {
  // eslint-disable-next-line no-console
  console.log("🔧 Generate: Taking Diamond Swarm path");
  const { generateWithSwarm, getCurrentAgent, hasWebLLMEngine } =
    await import("../utils/diamondSwarm");
  const { isLocalServerAvailable } = await import(
    "../utils/unifiedAIService"
  );

  // Try local server first (llama.cpp with Diamond Swarm GGUF)
  if (isLocalServerAvailable()) {
    // eslint-disable-next-line no-console
    console.log("💎 Diamond Swarm: Using local llama.cpp server");
    const { generateText } = await import("../utils/unifiedAIService");
    const result = await generateText(prompt, {
      mode: "local-server",
      taskType: options.task || "general",
      ...options,
    });
    // eslint-disable-next-line no-console
    console.log(
      "🔧 Generate: Local server returned:",
      typeof result,
      result?.slice?.(0, 50),
    );
    return result;
  }

  // Use WebLLM engine if loaded (loaded by initializeSwarm)
  if (hasWebLLMEngine()) {
    // eslint-disable-next-line no-console
    console.log("💎 Diamond Swarm: Using WebLLM engine");
  } else {
    // eslint-disable-next-line no-console
    console.log("💎 Diamond Swarm: WebLLM still loading, using placeholder");
  }

  const agent = getCurrentAgent() || "auditor";
  // eslint-disable-next-line no-console
  console.log("🔧 Generate: Calling generateWithSwarm with agent:", agent);
  const result = await generateWithSwarm(prompt, {
    agentId: agent,
    ...options,
  });
  // eslint-disable-next-line no-console
  console.log(
    "🔧 Generate: generateWithSwarm returned:",
    typeof result,
    "text:",
    result?.text?.slice?.(0, 50),
  );
  return result.text;
};

/**
 * User-configured max-tokens override, stored by the token limit settings UI.
 */
const getUserTokenLimit = () => {
  try {
    const stored = localStorage.getItem("vetrate_token_limit_config");
    if (stored) {
      const config = JSON.parse(stored);
      return config.value || 2048;
    }
  } catch (e) {
    console.warn("Error loading token limit config:", e);
  }
  return 2048;
};

/**
 * Clean AI response - remove thinking tags and detect degenerate output.
 * Handles DeepSeek R1 and other reasoning models that output <think> tags.
 */
const cleanResponse = (text) => {
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
 * Runs a chat completion against a loaded legacy WebLLM engine, streaming
 * if onStream is provided, with degenerate-output detection/abort during
 * streaming. Extracted from generate()'s legacy-engine try block.
 */
const runLegacyEngineCompletion = async (
  engine,
  generationConfig,
  onStream,
) => {
  if (!onStream) {
    const response = await engine.chat.completions.create(generationConfig);
    const rawContent = response.choices[0]?.message?.content || "";
    return cleanResponse(rawContent);
  }

  let fullResponse = "";
  const chunks = await engine.chat.completions.create({
    ...generationConfig,
    stream: true,
  });

  for await (const chunk of chunks) {
    const delta = chunk.choices[0]?.delta?.content || "";
    fullResponse += delta;

    // Clean and send the streamed response
    const cleanedResponse = cleanResponse(fullResponse);
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
          await engine.interruptGenerate?.();
        } catch (err) {
          // Best-effort interrupt; log but don't fail the stream on this
          // eslint-disable-next-line no-console
          console.debug("Interrupt generate failed (ignored):", err);
        }
        break;
      }
    }
  }

  return cleanResponse(fullResponse);
};

/**
 * Runs the mount-time WebGPU support check and installed-model cache scan.
 * Extracted from useLocalAIProviderState's mount effect so that effect stays
 * a thin wrapper; closes only over the setters passed in `ctx`.
 */
const checkWebGPUAndModelsOnMount = async (ctx) => {
  const { setWebGPUStatus, setInstalledModels } = ctx;
  const result = await checkWebGPUSupport();
  setWebGPUStatus({ checked: true, ...result });

  // Check which models are already cached
  try {
    const { hasModelInCache } = await import("@mlc-ai/web-llm");
    const installed = new Set();

    // Check each model individually (skip custom models - they're not in prebuiltAppConfig)
    await Promise.all(
      AVAILABLE_MODELS.map(async (model) => {
        // Skip cache check for custom models & Diamond Swarm - WebLLM's hasModelInCache doesn't know about them
        if (model.isCustomModel || model.isDiamond) {
          return;
        }
        try {
          const isCached = await hasModelInCache(model.id);
          if (isCached) {
            // eslint-disable-next-line no-console
            console.log(`✅ Model ${model.id} is cached`);
            installed.add(model.id);
          } else {
            // eslint-disable-next-line no-console
            console.log(`❌ Model ${model.id} is not cached`);
          }
        } catch (err) {
          console.warn(`Could not check cache for ${model.id}:`, err);
        }
      }),
    );

    setInstalledModels(installed);
  } catch (err) {
    console.warn("Could not check cached models:", err);
  }
};

/**
 * Reinitializes the WebGPU device when experimental mode changes.
 * Extracted from useLocalAIProviderState's experimental-mode effect so that
 * effect stays a thin wrapper; closes only over the setters passed in `ctx`.
 */
const reinitializeWebGPUDeviceForExperimentalMode = async (
  experimentalMode,
  webGPUSupported,
  ctx,
) => {
  const { setExperimentalMode, setError } = ctx;
  if (!webGPUSupported) return;

  try {
    // eslint-disable-next-line no-console
    console.log(
      `🎮 Experimental mode ${experimentalMode ? "ENABLED" : "DISABLED"} - reinitializing WebGPU device...`,
    );

    // Get current adapter and reinitialize with new options
    const selectedAdapter = gpuManager.getSelectedAdapter();
    if (selectedAdapter) {
      const adapters = gpuManager.getAdapters();
      const currentGPU = adapters.find((a) => a.adapter === selectedAdapter);

      if (currentGPU) {
        // Force reinitialization with a fresh adapter
        await gpuManager.selectAdapter(currentGPU.id, {
          experimental: experimentalMode,
          forceReinit: true,
        });
        // eslint-disable-next-line no-console
        console.log(
          `✅ WebGPU device reinitialized with experimental=${experimentalMode}`,
        );

        // Check if experimental mode was disabled due to missing features
        const actualExperimentalMode =
          localStorage.getItem("vet_rate_experimental_webgpu") === "true";
        if (experimentalMode && !actualExperimentalMode) {
          console.warn(
            "⚠️ Experimental mode was automatically disabled due to missing GPU features",
          );
          setExperimentalMode(false);
          setError(
            "Your GPU/browser combination does not support the required experimental features (chromium-experimental-subgroup-matrix) for MLC-AI models. Experimental mode has been disabled.",
          );
        }
      }
    }
  } catch (err) {
    console.error("Failed to reinitialize WebGPU device:", err);
    setError(`Failed to reinitialize WebGPU device: ${err.message}`);
  }
};

/**
 * Initializes the LLM engine (Diamond Swarm or legacy WebLLM) for the given
 * model id. Extracted from useLocalAIProviderState's initializeEngine
 * useCallback so that callback stays a thin wrapper; closes only over the
 * state/setters passed in `ctx`.
 */
const runInitializeEngine = async (modelId, ctx) => {
  const { selectedModel, setIsLoading, setError, setLoadProgress, setIsReady } =
    ctx;

  setIsLoading(true);
  setError(null);

  // 💎 Check if this is a Diamond Swarm agent
  if (modelId.startsWith("diamond-")) {
    return await initializeDiamondSwarmAgent(modelId, {
      setLoadProgress,
      setIsReady,
      setIsLoading,
      setError,
    });
  }

  // Check if the selected model is disabled (legacy WebLLM check)
  if (selectedModel.disabled) {
    setError(getDisabledModelMessage(selectedModel));
    setIsLoading(false);
    return null;
  }

  // Check if this is a vision model that requires experimental features
  const { isVisionModel, isCustomVisionModel, isBlocked } =
    getVisionModelGateStatus(modelId, selectedModel);
  if (isBlocked) {
    setError(getVisionModelBlockedMessage(selectedModel));
    setIsLoading(false);
    return null;
  }

  return loadLegacyWebLLMEngine(modelId, { isVisionModel, isCustomVisionModel }, ctx);
};

/**
 * Loads the legacy WebLLM engine for a non-Diamond model id: checks cache
 * status, drives CreateMLCEngine, and registers the result. Extracted from
 * runInitializeEngine so that function stays under the line budget.
 */
const loadLegacyWebLLMEngine = async (modelId, visionFlags, ctx) => {
  const { isVisionModel, isCustomVisionModel } = visionFlags;
  const {
    selectedModel,
    setError,
    setLoadProgress,
    setIsReady,
    setEngine,
    setLoadedModelId,
    setInstalledModels,
    setIsGenerating,
    setIsLoading,
  } = ctx;

  // Check if model is cached to determine the initial message
  const isCached = await checkIfModelIsCached(modelId);
  const isDownloading = !isCached;

  setLoadProgress({
    progress: 0,
    text: isDownloading
      ? "Downloading model from HuggingFace..."
      : "Loading model into GPU...",
  });

  try {
    // Dynamically import WebLLM (heavy dependency)
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

    patchWebGPUAdapterForMLC();

    const initProgressCallback = createEngineInitProgressCallback(
      isDownloading,
      setLoadProgress,
    );
    const engineOptions = await buildMLCEngineOptions(
      selectedModel,
      initProgressCallback,
      { setError, setIsReady, setEngine },
    );

    const mlcEngine = await CreateMLCEngine(modelId, engineOptions);

    setEngine(mlcEngine);
    setLoadedModelId(modelId);
    setIsReady(true);
    setIsLoading(false);
    setLoadProgress({ progress: 100, text: "✅ Neural Engine Ready!" });

    // Verify and mark model as installed (double-check it's actually cached now)
    await markModelInstalledAfterLoad(modelId, setInstalledModels);

    // Save preference FIRST before registering
    localStorage.setItem("vet_rate_local_ai_model", modelId);

    // Determine if this is a vision model
    const isVision =
      isVisionModel || isCustomVisionModel || selectedModel.hasVision;
    // eslint-disable-next-line no-console
    console.log(
      `🔍 Model type: ${isVision ? "Vision (VLM)" : "Text-only (LLM)"}`,
    );

    // Register with unified AI service for seamless integration
    registerLocalAIEngine(mlcEngine, true, false, modelId, isVision);

    // Reset generating state when model loads (prevents stale state from previous session)
    setIsGenerating(false);

    return mlcEngine;
  } catch (err) {
    console.error("Failed to initialize local AI:", err);

    const { message: errorMessage, isShaderFailure } =
      getEngineInitErrorDetails(err);
    setError(errorMessage);
    setIsLoading(false);

    if (isShaderFailure) {
      setLoadProgress({ progress: 0, text: "" });
      return null;
    }

    setIsReady(false);
    // Unregister from unified service on failure
    registerLocalAIEngine(null, false);
    return null;
  }
};

/**
 * Runs a generate() call: routes Diamond Swarm models through the swarm
 * service, otherwise runs the legacy WebLLM chat-completion path. Extracted
 * from useLocalAIProviderState's generate useCallback so that callback stays
 * a thin wrapper; closes only over the state/setters passed in `ctx`.
 */
const runGenerateCompletion = async (prompt, options, ctx) => {
  const { selectedModel, loadedModelId, engine, isReady, setIsGenerating } =
    ctx;

  // eslint-disable-next-line no-console
  console.log(
    "🔧 Generate: Called with isDiamond =",
    selectedModel?.isDiamond,
    "loadedModelId =",
    loadedModelId,
  );

  // 💎 Diamond Swarm models route through diamondSwarm service
  if (selectedModel?.isDiamond || loadedModelId?.startsWith("diamond-")) {
    return await generateViaDiamondSwarm(prompt, options);
  }

  // Legacy WebLLM path - requires engine
  if (!engine || !isReady) {
    throw new Error("Local AI not initialized");
  }

  // Import the buildSystemPrompt function for comprehensive context
  const { buildSystemPrompt } = await import("../utils/aiSystemPrompts");

  const {
    systemPrompt = buildSystemPrompt({
      task: options.task || "general",
      toolContext: options.toolContext || "Faraday Cage Test Console",
      includeAppContext: true,
      includeRegulations: true,
      includeVeteranData: true, // Auto-load veteran's My Packet data
    }),
    maxTokens = getUserTokenLimit(), // Use user-configured limit or default
    temperature = 0.7,
    onStream,
  } = options;

  setIsGenerating(true);

  try {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    // Generation config with repetition penalty to prevent degenerate output
    const generationConfig = {
      messages,
      max_tokens: maxTokens,
      temperature,
      // Repetition penalty to prevent loops (1.0 = no penalty, >1.0 = penalize repetition)
      repetition_penalty: 1.1,
      // Frequency penalty (penalize tokens that appear frequently)
      frequency_penalty: 0.3,
      // Presence penalty (penalize tokens that have appeared at all)
      presence_penalty: 0.1,
    };

    const result = await runLegacyEngineCompletion(
      engine,
      generationConfig,
      onStream,
    );
    setIsGenerating(false);
    return result;
  } catch (err) {
    setIsGenerating(false);
    throw err;
  }
};

/**
 * Interrupts an active generation, but only if the unified AI service says
 * one is actually in progress. Extracted from useLocalAIProviderState's
 * interruptGeneration useCallback; closes only over `ctx`.
 */
const runInterruptGeneration = async (ctx) => {
  const { engine, setIsGenerating } = ctx;

  // Check the global unified state - this is the source of truth for whether generation is happening
  const { getAIStatus } = await import("../utils/unifiedAIService.js");
  const aiStatus = getAIStatus();

  // ONLY interrupt if the unified service says generation is in progress
  // LocalAIPanel's isGenerating state can get stale during React re-renders
  if (!aiStatus.localGenerating) {
    // eslint-disable-next-line no-console
    console.log(
      "⏭️ interruptGeneration called but no global generation in progress - ignoring",
    );
    setIsGenerating(false); // Sync local state with global
    return;
  }

  if (engine) {
    console.warn("🛑 Interrupting active generation");
    try {
      await engine.interruptGenerate?.();
    } catch (err) {
      console.warn("Error interrupting generation:", err);
    }
    setIsGenerating(false);
  }
};

/**
 * Unloads the current engine (if any) and loads a new model. Extracted from
 * useLocalAIProviderState's switchModel useCallback; closes only over the
 * state/setters passed in `ctx`.
 */
const runSwitchModel = async (newModelId, ctx) => {
  const {
    engine,
    setEngine,
    setLoadedModelId,
    setIsReady,
    initializeEngine,
  } = ctx;

  // Unload current model
  if (engine) {
    try {
      await engine.unload?.();
    } catch (err) {
      console.warn("Error unloading model:", err);
    }
  }

  // Reset state
  setEngine(null);
  setLoadedModelId(null);
  setIsReady(false);
  registerLocalAIEngine(null, false);

  // Load new model
  await initializeEngine(newModelId);
};

/**
 * Persists a new GPU preference and re-checks WebGPU support with it.
 * Extracted from useLocalAIProviderState's updateGPUPreference useCallback
 * so that callback stays a thin wrapper; closes only over `ctx`.
 */
const runUpdateGPUPreference = async (newPreference, ctx) => {
  const { setGpuPreferenceState, setWebGPUStatus } = ctx;
  setGPUPreference(newPreference);
  setGpuPreferenceState(newPreference);

  // Rescan for GPUs with the new preference
  // eslint-disable-next-line no-console
  console.log(`🎮 GPU preference updated to: ${newPreference}`);
  const result = await checkWebGPUSupport(newPreference);
  setWebGPUStatus({ checked: true, ...result });

  // eslint-disable-next-line no-console
  console.log(`🎮 Now using: ${result.device} (${result.vendor})`);

  return result;
};

/**
 * Builds the object returned by useLocalAIProviderState. Extracted so the
 * hook body itself stays under the line budget; pure data plumbing.
 */
function buildLocalAIProviderApi(deps) {
  const {
    webGPUStatus, setWebGPUStatus, isLoading, loadProgress, isReady, error, setError, isGenerating,
    selectedModel, setSelectedModel, installedModels, loadedModelId,
    gpuPreference, updateGPUPreference,
    experimentalMode, setExperimentalMode, showExperimentalWarning, setShowExperimentalWarning,
    initializeEngine, generate, interruptGeneration, switchModel,
  } = deps;

  return {
    // Status
    webGPUStatus,
    setWebGPUStatus,
    isLoading,
    loadProgress,
    isReady,
    error,
    setError,
    isGenerating,

    // Model
    selectedModel,
    setSelectedModel,
    availableModels: AVAILABLE_MODELS,
    installedModels,
    loadedModelId,

    // GPU Preference
    gpuPreference,
    updateGPUPreference,

    // Experimental Features
    experimentalMode,
    setExperimentalMode,
    showExperimentalWarning,
    setShowExperimentalWarning,

    // Actions
    initializeEngine,
    generate,
    interruptGeneration,
    switchModel,
  };
}

/**
 * useLocalAIProviderState - all Local AI provider state and actions.
 * Extracted verbatim from LocalAIProvider's component body so that
 * component stays a thin `useLocalAIProviderState() -> <Context.Provider>`
 * wrapper (see LocalAIProvider in src/components/LocalAIPanel.jsx).
 */
export const useLocalAIProviderState = () => {
  // WebGPU state
  const [webGPUStatus, setWebGPUStatus] = useState({
    checked: false,
    supported: false,
  });
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[1]); // Default to balanced
  const [installedModels, setInstalledModels] = useState(new Set());
  const [gpuPreference, setGpuPreferenceState] = useState(getGPUPreference());

  // Engine state
  const [engine, setEngine] = useState(null);
  const [loadedModelId, setLoadedModelId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState({ progress: 0, text: "" });
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  // Chat state
  const [isGenerating, setIsGenerating] = useState(false);

  // Experimental features state
  const [experimentalMode, setExperimentalMode] = useState(() => {
    return localStorage.getItem("vet_rate_experimental_webgpu") === "true";
  });
  const [showExperimentalWarning, setShowExperimentalWarning] = useState(false);

  // Update GPU preference and re-check WebGPU
  const updateGPUPreference = useCallback(
    (newPreference) =>
      runUpdateGPUPreference(newPreference, { setGpuPreferenceState, setWebGPUStatus }),
    [],
  );

  // Check WebGPU support and installed models on mount
  useEffect(() => {
    checkWebGPUAndModelsOnMount({ setWebGPUStatus, setInstalledModels });
  }, []);

  // Reinitialize WebGPU device when experimental mode changes
  useEffect(() => {
    // Only reinitialize if we've already initialized once (not on mount)
    if (webGPUStatus.checked) {
      reinitializeWebGPUDeviceForExperimentalMode(
        experimentalMode,
        webGPUStatus.supported,
        { setExperimentalMode, setError },
      );
    }
  }, [experimentalMode, webGPUStatus.supported, webGPUStatus.checked]);

  // Initialize the LLM engine (supports Diamond Swarm and legacy WebLLM)
  const initializeEngine = useCallback(
    (modelId = selectedModel.id) =>
      runInitializeEngine(modelId, {
        selectedModel, setIsLoading, setError, setLoadProgress, setIsReady,
        setEngine, setLoadedModelId, setInstalledModels, setIsGenerating,
      }),
    [selectedModel],
  );

  // Generate completion
  const generate = useCallback(
    (prompt, options = {}) =>
      runGenerateCompletion(prompt, options, {
        selectedModel, loadedModelId, engine, isReady, setIsGenerating,
      }),
    [engine, isReady, selectedModel, loadedModelId],
  );

  // Interrupt generation - only interrupts if there's actually a global generation in progress
  const interruptGeneration = useCallback(
    () => runInterruptGeneration({ engine, setIsGenerating }),
    [engine],
  );

  // Switch to a different model
  const switchModel = useCallback(
    (newModelId) =>
      runSwitchModel(newModelId, {
        engine, setEngine, setLoadedModelId, setIsReady, initializeEngine,
      }),
    [engine, initializeEngine],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engine) {
        engine.unload?.();
      }
    };
  }, [engine]);

  return buildLocalAIProviderApi({
    webGPUStatus, setWebGPUStatus, isLoading, loadProgress, isReady, error, setError, isGenerating,
    selectedModel, setSelectedModel, installedModels, loadedModelId,
    gpuPreference, updateGPUPreference,
    experimentalMode, setExperimentalMode, showExperimentalWarning, setShowExperimentalWarning,
    initializeEngine, generate, interruptGeneration, switchModel,
  });
};
