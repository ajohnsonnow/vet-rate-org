/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * 
 * WEBGPU FEATURE DETECTOR
 * 
 * Detects whether Chrome was launched with experimental WebGPU features enabled
 * Used to warn users when experimental mode is enabled but browser flags are missing
 */

/**
 * Check if WebGPU is available
 */
export function isWebGPUAvailable() {
  return 'gpu' in navigator;
}

/**
 * Check if experimental Dawn features are enabled
 * This requires Chrome to be launched with --enable-dawn-features=allow_unsafe_apis
 */
export async function checkDawnFeaturesEnabled() {
  if (!isWebGPUAvailable()) {
    return {
      enabled: false,
      reason: 'WebGPU not available',
      missingFeatures: [],
      availableFeatures: []
    };
  }

  try {
    // Request a GPU adapter
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });

    if (!adapter) {
      return {
        enabled: false,
        reason: 'No GPU adapter available',
        missingFeatures: [],
        availableFeatures: []
      };
    }

    // Get available features
    const availableFeatures = Array.from(adapter.features);
    
    // Check for experimental features that indicate Dawn unsafe APIs are enabled
    const experimentalFeatures = [
      'chromium-experimental-subgroups',
      'chromium-experimental-subgroup-matrix',
      'subgroups',
      'subgroups-f16'
    ];

    const foundExperimentalFeatures = experimentalFeatures.filter(feature => 
      availableFeatures.includes(feature)
    );

    const missingFeatures = experimentalFeatures.filter(feature =>
      !availableFeatures.includes(feature)
    );

    // If we have at least some experimental features, Dawn features are likely enabled
    const enabled = foundExperimentalFeatures.length > 0;

    return {
      enabled,
      reason: enabled 
        ? 'Dawn experimental features detected'
        : 'No experimental features available - Chrome may not be launched with --enable-dawn-features=allow_unsafe_apis',
      availableFeatures,
      experimentalFeatures: foundExperimentalFeatures,
      missingFeatures
    };

  } catch (err) {
    return {
      enabled: false,
      reason: `Error checking features: ${err.message}`,
      missingFeatures: [],
      availableFeatures: []
    };
  }
}

/**
 * Check if specific feature is available
 */
export async function hasFeature(featureName) {
  if (!isWebGPUAvailable()) return false;

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    return adapter.features.has(featureName);
  } catch (err) {
    console.error(`Error checking for feature ${featureName}:`, err);
    return false;
  }
}

/**
 * Get comprehensive WebGPU capability report
 */
export async function getWebGPUCapabilities() {
  if (!isWebGPUAvailable()) {
    return {
      available: false,
      error: 'WebGPU not available in this browser'
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });

    if (!adapter) {
      return {
        available: false,
        error: 'No GPU adapter available'
      };
    }

    const info = adapter.info || adapter;
    const features = Array.from(adapter.features);
    const limits = adapter.limits;

    // Categorize features
    const standardFeatures = features.filter(f => !f.includes('experimental') && !f.includes('chromium'));
    const experimentalFeatures = features.filter(f => f.includes('experimental') || f.includes('chromium'));

    return {
      available: true,
      adapter: {
        vendor: info.vendor || 'unknown',
        architecture: info.architecture || 'unknown',
        device: info.device || 'unknown',
        description: info.description || 'unknown'
      },
      features: {
        all: features,
        standard: standardFeatures,
        experimental: experimentalFeatures
      },
      limits: {
        maxTextureDimension2D: limits.maxTextureDimension2D,
        maxBufferSize: limits.maxBufferSize,
        maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX,
        maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension
      },
      dawnFeaturesEnabled: experimentalFeatures.length > 0
    };

  } catch (err) {
    return {
      available: false,
      error: err.message
    };
  }
}

/**
 * Get user-friendly browser launch instructions
 */
export function getLaunchInstructions() {
  const platform = navigator.platform.toLowerCase();
  const isWindows = platform.includes('win');
  const isMac = platform.includes('mac');
  const isLinux = platform.includes('linux');

  if (isWindows) {
    return {
      platform: 'Windows',
      steps: [
        'Close ALL Chrome windows',
        'Open PowerShell or Command Prompt',
        'Run: cd scripts',
        'Run: .\\launch-chrome-dev.ps1',
        'Or manually: chrome.exe --enable-dawn-features=allow_unsafe_apis'
      ],
      script: 'scripts/launch-chrome-dev.ps1',
      command: 'chrome.exe --enable-dawn-features=allow_unsafe_apis'
    };
  } else if (isMac) {
    return {
      platform: 'macOS',
      steps: [
        'Close ALL Chrome windows',
        'Open Terminal',
        'Run: cd scripts',
        'Run: ./launch-chrome-dev.sh',
        'Or manually: open -a "Google Chrome" --args --enable-dawn-features=allow_unsafe_apis'
      ],
      script: 'scripts/launch-chrome-dev.sh',
      command: 'open -a "Google Chrome" --args --enable-dawn-features=allow_unsafe_apis'
    };
  } else if (isLinux) {
    return {
      platform: 'Linux',
      steps: [
        'Close ALL Chrome windows',
        'Open Terminal',
        'Run: cd scripts',
        'Run: ./launch-chrome-dev.sh',
        'Or manually: google-chrome --enable-dawn-features=allow_unsafe_apis'
      ],
      script: 'scripts/launch-chrome-dev.sh',
      command: 'google-chrome --enable-dawn-features=allow_unsafe_apis'
    };
  }

  return {
    platform: 'Unknown',
    steps: [
      'Close ALL Chrome windows',
      'Launch Chrome with: --enable-dawn-features=allow_unsafe_apis',
      'See docs/support/faq.md for detailed instructions'
    ],
    script: null,
    command: '--enable-dawn-features=allow_unsafe_apis'
  };
}

export default {
  isWebGPUAvailable,
  checkDawnFeaturesEnabled,
  hasFeature,
  getWebGPUCapabilities,
  getLaunchInstructions
};
