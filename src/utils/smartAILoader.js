/**
 * Smart AI Loader
 * Automatically loads the best LLM for the device and tool
 * One-click solution for veterans
 */

import { getToolRecommendation } from "./llmRecommendations";
import { isMobilePhone, isTabletDevice } from "./persistentStorage";
import { getAIStatus } from "./unifiedAIService";
import {
  describeDeviceModel,
  getCachedDeviceProfile,
} from "./deviceCapabilityDetector";
import { formatDownloadSize } from "./localModelLabels";

/**
 * Get device type
 */
export const getDeviceType = () => {
  if (isMobilePhone()) return "mobile";
  if (isTabletDevice()) return "tablet";
  return "desktop";
};

const FALLBACK_ROLE = {
  id: "diamond-auditor",
  name: "CWO3 HAWKEYE",
  reason: "Balanced performance for general tasks",
};

const describeLoadedModel = (deviceModel) =>
  deviceModel
    ? ` On this device it runs ${deviceModel.displayName} (${formatDownloadSize(deviceModel)}). It is a one-time download kept on your device.`
    : "";

/**
 * Get the role and on-device model for this device and tool.
 * The role (id, name) comes from the tool recommendation; the model is the
 * first entry of the device profile's recommendedModels, the same list
 * initializeSwarm loads from, so the button and the swarm cannot disagree.
 * @param {string} toolId - The tool being used (e.g., 'nexus-builder')
 * @returns {Object} Recommendation { id, name, reason, deviceModel }
 */
export const getRecommendedModelForDevice = (toolId) => {
  const toolRec = getToolRecommendation(toolId);
  const primaryModel = toolRec?.primary;
  const profile = getCachedDeviceProfile();
  const deviceModel = profile?.hasWebGPU ? describeDeviceModel(profile) : null;

  if (!primaryModel?.modelId) {
    return {
      ...FALLBACK_ROLE,
      reason: FALLBACK_ROLE.reason + "." + describeLoadedModel(deviceModel),
      deviceModel,
    };
  }

  const prefix =
    getDeviceType() === "desktop" ? "Recommended for" : "Optimized for";
  const fallbackReason =
    prefix === "Recommended for" ? "Best match" : "Recommended model";
  return {
    id: primaryModel.modelId,
    name: primaryModel.modelName || primaryModel.modelId,
    reason: `${prefix} ${toolRec.name}: ${primaryModel.reason || fallbackReason}${describeLoadedModel(deviceModel)}`,
    deviceModel,
  };
};

/**
 * Check if the correct model is loaded for this tool and device
 * @param {string} toolId - The tool being used
 * @returns {Object} { isCorrect, currentModel, recommendedModel, action }
 */
export const checkModelMatch = (toolId) => {
  const aiStatus = getAIStatus();
  const recommended = getRecommendedModelForDevice(toolId);

  // No AI loaded
  if (!aiStatus.isLocal || !aiStatus.modelId) {
    return {
      isCorrect: false,
      currentModel: null,
      recommendedModel: recommended,
      action: "load",
      message: `Load ${recommended.name} for this tool`,
    };
  }

  // Check if current model matches recommendation
  const isMatch = aiStatus.modelId === recommended.id;

  if (isMatch) {
    return {
      isCorrect: true,
      currentModel: aiStatus.modelId,
      recommendedModel: recommended,
      action: "none",
      message: `✓ ${recommended.name} ready`,
    };
  }

  // Wrong model loaded
  return {
    isCorrect: false,
    currentModel: aiStatus.modelId,
    recommendedModel: recommended,
    action: "switch",
    message: `Switch to ${recommended.name} for better performance`,
  };
};

/**
 * Smart loader: Automatically handle model loading/switching
 * @param {string} toolId - The tool being used
 * @param {Function} onProgress - Progress callback (progress, text)
 * @returns {Promise<boolean>} Success status
 */
export const smartLoadAI = async (toolId, onProgress = null) => {
  const check = checkModelMatch(toolId);
  const recommended = check.recommendedModel;

  try {
    // Already correct model
    if (check.isCorrect) {
      onProgress?.(100, `${recommended.name} ready`);
      return true;
    }

    // Need to unload current model first
    if (check.action === "switch") {
      onProgress?.(10, "Unloading current model...");

      const { unloadSwarm } = await import("./diamondSwarm");
      await unloadSwarm();

      // Wait a moment for cleanup
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Load recommended model
    onProgress?.(20, `Loading ${recommended.name}...`);

    const { initializeSwarm, generateWithSwarm, isSwarmReady, getSwarmStatus } =
      await import("./diamondSwarm");
    const { registerLocalAIEngine } = await import("./unifiedAIService");

    await initializeSwarm({
      modelId: recommended.id,
      onProgress: (report) => {
        const progressValue =
          typeof report === "object" ? report.progress || 0 : report || 0;
        const textValue =
          typeof report === "object"
            ? report.message || "Loading..."
            : "Loading...";
        onProgress?.(progressValue, textValue);
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

    onProgress?.(100, `${recommended.name} ready!`);
    return true;
  } catch (err) {
    console.error("Smart load failed:", err);
    onProgress?.(-1, `Error: ${err.message}`);
    return false;
  }
};
