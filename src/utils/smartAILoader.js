/**
 * Smart AI Loader
 * Automatically loads the best LLM for the device and tool
 * One-click solution for veterans
 */

import { getToolRecommendation } from './llmRecommendations';
import { isMobilePhone, isTabletDevice } from './persistentStorage';
import { getAIStatus, isLocalAIReady } from './unifiedAIService';

/**
 * Get device type
 */
export const getDeviceType = () => {
  if (isMobilePhone()) return 'mobile';
  if (isTabletDevice()) return 'tablet';
  return 'desktop';
};

/**
 * Get the perfect model for this device and tool
 * @param {string} toolId - The tool being used (e.g., 'nexus-builder')
 * @returns {Object} Model recommendation { id, name, reason }
 */
export const getRecommendedModelForDevice = (toolId) => {
  const deviceType = getDeviceType();
  const toolRec = getToolRecommendation(toolId);
  
  if (!toolRec) {
    // Default fallback
    return {
      id: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
      name: 'CWO3 HAWKEYE (3B)',
      reason: 'Balanced performance for general tasks'
    };
  }

  // Mobile: Always use smallest/fastest model
  if (deviceType === 'mobile') {
    return {
      id: toolRec.mobile.modelId,
      name: toolRec.mobile.agentName,
      reason: `Optimized for mobile: ${toolRec.mobile.why}`
    };
  }

  // Tablet: Use mobile model (conservative approach)
  if (deviceType === 'tablet') {
    return {
      id: toolRec.mobile.modelId,
      name: toolRec.mobile.agentName,
      reason: `Optimized for tablet: ${toolRec.mobile.why}`
    };
  }

  // Desktop: Use most powerful model
  return {
    id: toolRec.desktop.modelId,
    name: toolRec.desktop.agentName,
    reason: `Desktop powerhouse: ${toolRec.desktop.why}`
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
      action: 'load',
      message: `Load ${recommended.name} for this tool`
    };
  }

  // Check if current model matches recommendation
  const isMatch = aiStatus.modelId === recommended.id;
  
  if (isMatch) {
    return {
      isCorrect: true,
      currentModel: aiStatus.modelId,
      recommendedModel: recommended,
      action: 'none',
      message: `✓ ${recommended.name} ready`
    };
  }

  // Wrong model loaded
  return {
    isCorrect: false,
    currentModel: aiStatus.modelId,
    recommendedModel: recommended,
    action: 'switch',
    message: `Switch to ${recommended.name} for better performance`
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
    if (check.action === 'switch') {
      onProgress?.(10, 'Unloading current model...');
      
      const { unloadLocalAI } = await import('./diamondSwarm');
      await unloadLocalAI();
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Load recommended model
    onProgress?.(20, `Loading ${recommended.name}...`);
    
    const { initializeSwarm, registerLocalAIEngine, generateWithSwarm, isSwarmReady, getSwarmStatus } = 
      await import('./diamondSwarm');
    
    await initializeSwarm({
      modelId: recommended.id,
      onProgress: (report) => {
        const progressValue = typeof report === 'object' ? (report.progress || 0) : (report || 0);
        const textValue = typeof report === 'object' ? (report.message || 'Loading...') : 'Loading...';
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
    console.error('Smart load failed:', err);
    onProgress?.(-1, `Error: ${err.message}`);
    return false;
  }
};

/**
 * Get a simple status message for UI display
 * @param {string} toolId - The tool being used
 * @returns {string} Status message
 */
export const getSmartLoadStatus = (toolId) => {
  const check = checkModelMatch(toolId);
  const device = getDeviceType();
  
  if (check.isCorrect) {
    return `✅ ${check.recommendedModel.name} loaded (${device})`;
  }
  
  if (check.action === 'load') {
    return `📥 Load ${check.recommendedModel.name} for ${device}`;
  }
  
  return `🔄 Switch to ${check.recommendedModel.name} (recommended for ${device})`;
};
