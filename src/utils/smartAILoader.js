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
import { describeOnDeviceSupport } from "./deviceLabels";

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

const describeLoadedModel = (deviceModel, tabletNote) => {
  if (!deviceModel) return "";
  const size = formatDownloadSize(deviceModel);
  const base = ` On this device it runs ${deviceModel.displayName} (${size}). It is a one-time download kept on your device.`;
  return tabletNote ? `${base} ${tabletNote}` : base;
};

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
  const { tabletNote } = describeOnDeviceSupport(profile);

  if (!primaryModel?.modelId) {
    return {
      ...FALLBACK_ROLE,
      reason:
        FALLBACK_ROLE.reason +
        "." +
        describeLoadedModel(deviceModel, tabletNote),
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
    reason: `${prefix} ${toolRec.name}: ${primaryModel.reason || fallbackReason}${describeLoadedModel(deviceModel, tabletNote)}`,
    deviceModel,
  };
};

/**
 * What the load panel offers. Every caller shows the panel only while no AI is
 * available, so it has one job: offer to load. There is no "ready" or "switch"
 * state; a loaded model is never unloaded from here.
 * @param {string} toolId - The tool being used
 * @returns {Object} { recommendedModel, action: "load", message }
 */
export const checkModelMatch = (toolId) => {
  const recommended = getRecommendedModelForDevice(toolId);
  return {
    recommendedModel: recommended,
    action: "load",
    message: `Load ${recommended.name} for this tool`,
  };
};

/**
 * Load the model this device recommends. If a model is already loaded it is
 * left alone: nothing is unloaded or reloaded.
 * @param {string} toolId - The tool being used
 * @param {Function} onProgress - Progress callback (progress, text)
 * @returns {Promise<boolean>} Success status
 */
export const smartLoadAI = async (toolId, onProgress = null) => {
  const recommended = checkModelMatch(toolId).recommendedModel;

  try {
    if (getAIStatus().swarmAvailable) {
      onProgress?.(100, `${recommended.name} ready`);
      return true;
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
