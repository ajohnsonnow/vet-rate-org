/**
 * Hardware Capability Check Hook
 * "The Chromebook Problem" Solution
 * 
 * Purpose: Detect if device can handle local AI models before spinning them up.
 * 
 * The Problem:
 * You are running local AI models (Diamond Swarm) in the browser. If a veteran
 * tries this on a $200 Chromebook or an old iPad, the browser will crash or freeze.
 * 
 * The Fix:
 * Check for WebGPU support and estimate device tier. If hardware is insufficient,
 * degrade gracefully (disable AI or offer Cloud option). Never crash the user's browser.
 * 
 * @returns {Object} Hardware capability detection functions
 */

import { useState, useEffect, useCallback } from 'react';

// ========================================
// CAPABILITY TIERS
// ========================================

export const HW_TIERS = {
  HIGH: 'HIGH',           // Desktop GPU, high-end laptop - Can run 7B models
  MEDIUM: 'MEDIUM',       // Integrated GPU, mid-range device - Can run quantized models
  LOW: 'LOW',             // Old device, no GPU acceleration - Cloud only
  UNKNOWN: 'UNKNOWN'      // Unable to detect
};

export const AI_RECOMMENDATIONS = {
  [HW_TIERS.HIGH]: {
    canRunLocal: true,
    maxModelSize: '7B',
    recommendedMode: 'LOCAL',
    message: '✅ Your device can run local AI models at full quality.'
  },
  [HW_TIERS.MEDIUM]: {
    canRunLocal: true,
    maxModelSize: '3B',
    recommendedMode: 'LOCAL_QUANTIZED',
    message: '⚠️ Your device can run AI, but we recommend using smaller models for best performance.'
  },
  [HW_TIERS.LOW]: {
    canRunLocal: false,
    maxModelSize: null,
    recommendedMode: 'CLOUD',
    message: '❌ Your device cannot run local AI. Please use the Gemini Cloud option in Settings.'
  },
  [HW_TIERS.UNKNOWN]: {
    canRunLocal: false,
    maxModelSize: null,
    recommendedMode: 'CLOUD',
    message: '⚠️ Unable to detect hardware capabilities. We recommend using Cloud AI for reliability.'
  }
};

// ========================================
// HARDWARE DETECTION
// ========================================

/**
 * Check if WebGPU is supported (required for local LLM)
 * 
 * @returns {boolean}
 */
export const hasWebGPU = () => {
  return 'gpu' in navigator;
};

/**
 * Check if WebGL is available (fallback indicator)
 * 
 * @returns {boolean}
 */
export const hasWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl') || 
      canvas.getContext('experimental-webgl')
    );
  } catch (e) {
    return false;
  }
};

/**
 * Estimate GPU tier based on WebGPU adapter info
 * 
 * Note: Browser privacy restrictions limit the info we can access.
 * We use available signals to make a best-guess estimate.
 * 
 * @returns {Promise<string>} HW_TIERS value
 */
export const estimateGPUTier = async () => {
  if (!hasWebGPU()) {
    return HW_TIERS.LOW;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    
    if (!adapter) {
      return HW_TIERS.LOW;
    }

    // Get adapter info (limited by browser privacy)
    const features = adapter.features;
    const limits = adapter.limits;

    // Heuristics for tier estimation:
    // 1. Check max buffer size (proxy for VRAM)
    // 2. Check supported features (advanced features = better GPU)
    // 3. Check device type (discrete GPU vs integrated)

    // High Tier Indicators:
    // - maxBufferSize > 4GB (4294967296 bytes)
    // - Supports texture-compression-bc (desktop feature)
    const maxBufferSize = limits.maxBufferSize || 0;
    const hasAdvancedFeatures = features.has('texture-compression-bc');

    if (maxBufferSize > 4294967296 || hasAdvancedFeatures) {
      return HW_TIERS.HIGH;
    }

    // Medium Tier: Has WebGPU but limited resources
    if (maxBufferSize > 1073741824) { // >1GB
      return HW_TIERS.MEDIUM;
    }

    // Low Tier: WebGPU exists but very limited
    return HW_TIERS.LOW;

  } catch (error) {
    console.warn('[Hardware Check] Error estimating GPU tier:', error);
    return HW_TIERS.UNKNOWN;
  }
};

/**
 * Get device memory (RAM) if available
 * Note: navigator.deviceMemory is experimental and not widely supported
 * 
 * @returns {number|null} Memory in GB or null
 */
export const getDeviceMemory = () => {
  if ('deviceMemory' in navigator) {
    return navigator.deviceMemory; // Returns GB (e.g., 4, 8, 16)
  }
  return null;
};

/**
 * Detect if running on mobile device
 * 
 * @returns {boolean}
 */
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Get user agent hints (if available)
 * Chromium-based browsers provide more detailed device info
 * 
 * @returns {Promise<Object|null>}
 */
export const getUserAgentData = async () => {
  if ('userAgentData' in navigator && navigator.userAgentData.getHighEntropyValues) {
    try {
      const data = await navigator.userAgentData.getHighEntropyValues([
        'model',
        'platformVersion',
        'architecture'
      ]);
      return data;
    } catch (error) {
      return null;
    }
  }
  return null;
};

// ========================================
// COMPREHENSIVE CHECK
// ========================================

/**
 * Perform comprehensive hardware capability check
 * 
 * @returns {Promise<Object>} Capability report
 */
export const checkHardwareCapabilities = async () => {
  const report = {
    timestamp: new Date().toISOString(),
    webgpu: hasWebGPU(),
    webgl: hasWebGL(),
    tier: HW_TIERS.UNKNOWN,
    deviceMemory: getDeviceMemory(),
    isMobile: isMobileDevice(),
    userAgent: navigator.userAgent,
    recommendation: AI_RECOMMENDATIONS[HW_TIERS.UNKNOWN],
    details: {}
  };

  // Estimate GPU tier
  report.tier = await estimateGPUTier();
  report.recommendation = AI_RECOMMENDATIONS[report.tier];

  // Get additional device data if available
  const uaData = await getUserAgentData();
  if (uaData) {
    report.details.model = uaData.model || null;
    report.details.platform = uaData.platform || null;
    report.details.architecture = uaData.architecture || null;
  }

  // WebGPU adapter details (if available)
  if (report.webgpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        report.details.maxBufferSize = adapter.limits.maxBufferSize;
        report.details.maxTextureDimension2D = adapter.limits.maxTextureDimension2D;
        report.details.features = Array.from(adapter.features);
      }
    } catch (error) {
      report.details.adapterError = error.message;
    }
  }

  return report;
};

// ========================================
// REACT HOOK
// ========================================

/**
 * React hook for hardware capability checking
 * 
 * @param {boolean} checkOnMount - Run check immediately on mount
 * @returns {Object}
 */
export const useHardwareCheck = (checkOnMount = false) => {
  const [capabilities, setCapabilities] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(null);

  const runCheck = useCallback(async () => {
    setIsChecking(true);
    setError(null);

    try {
      const report = await checkHardwareCapabilities();
      setCapabilities(report);
      
      // Store in localStorage for future reference
      localStorage.setItem('vet_rate_hw_capabilities', JSON.stringify(report));
      
      return report;
    } catch (err) {
      console.error('[Hardware Check] Failed:', err);
      setError(err.message);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const getCachedCapabilities = useCallback(() => {
    const cached = localStorage.getItem('vet_rate_hw_capabilities');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (checkOnMount) {
      // Try to load cached first
      const cached = getCachedCapabilities();
      if (cached) {
        setCapabilities(cached);
      }
      
      // Then run fresh check in background
      runCheck();
    }
  }, [checkOnMount, runCheck, getCachedCapabilities]);

  return {
    capabilities,
    isChecking,
    error,
    runCheck,
    getCachedCapabilities,
    // Convenience accessors
    canRunLocal: capabilities?.recommendation?.canRunLocal ?? false,
    tier: capabilities?.tier ?? HW_TIERS.UNKNOWN,
    message: capabilities?.recommendation?.message ?? ''
  };
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Check if device meets minimum requirements for local AI
 * 
 * @returns {Promise<boolean>}
 */
export const meetsMinimumRequirements = async () => {
  const report = await checkHardwareCapabilities();
  return report.tier !== HW_TIERS.LOW && report.webgpu;
};

/**
 * Get recommended AI mode based on hardware
 * 
 * @returns {Promise<string>} 'LOCAL', 'LOCAL_QUANTIZED', or 'CLOUD'
 */
export const getRecommendedAIMode = async () => {
  const report = await checkHardwareCapabilities();
  return report.recommendation.recommendedMode;
};

/**
 * Generate user-friendly hardware summary
 * 
 * @param {Object} capabilities - Capability report
 * @returns {string}
 */
export const getHardwareSummary = (capabilities) => {
  if (!capabilities) return 'Hardware check not performed yet.';

  const parts = [];
  
  parts.push(`Tier: ${capabilities.tier}`);
  
  if (capabilities.deviceMemory) {
    parts.push(`RAM: ${capabilities.deviceMemory}GB`);
  }
  
  if (capabilities.isMobile) {
    parts.push('Mobile Device');
  }
  
  if (capabilities.webgpu) {
    parts.push('WebGPU: ✓');
  } else {
    parts.push('WebGPU: ✗');
  }

  return parts.join(' | ');
};

export default useHardwareCheck;
