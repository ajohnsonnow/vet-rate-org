/**
 * Vet-Rate.org - Device Capability Detection for AI Features
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * "The Device Detective" - Smart AI Option Recommendations
 *
 * Based on analytics showing:
 * - 20% of users on Android 10 (legacy, no WebGPU)
 * - 50%+ on modern iOS 18+ and Android 16+
 *
 * This utility provides device-aware AI recommendations to prevent
 * users on older devices from attempting to load Local AI and crashing.
 */

import { useState, useEffect, useMemo } from "react";
import { checkWebGPUSupport } from "./unifiedAIService";
import { MOBILE_MAX } from "./breakpoints";

/**
 * Device capability tiers
 */
export const DEVICE_TIERS = {
  HIGH_END: "high-end", // Modern devices, Local AI recommended
  CAPABLE: "capable", // Can run Local AI but with warnings
  LEGACY: "legacy", // Old devices, Cloud AI recommended
  UNSUPPORTED: "unsupported", // No WebGPU at all, Local AI blocked
};

/**
 * Parse Android version from User Agent
 * Returns null if not Android, or version number (e.g., 10, 11, 14)
 */
const parseAndroidVersion = (userAgent) => {
  const match = userAgent.match(/Android\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Parse iOS version from User Agent
 * Returns null if not iOS, or major version number (e.g., 16, 17, 18)
 */
const parseIOSVersion = (userAgent) => {
  // iOS UA: "iPhone OS 18_7" or "CPU iPhone OS 18_7 like Mac OS X"
  const match = userAgent.match(/(?:iPhone|iPad|iPod).*?OS\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Check if device is mobile (touch device or small screen)
 */
const checkIsMobile = () => {
  // Check for touch capability
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  // Check screen size
  const isSmallScreen = window.innerWidth < MOBILE_MAX;

  // Check User Agent for mobile keywords
  const ua = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    "mobile",
    "android",
    "iphone",
    "ipad",
    "ipod",
    "webos",
    "blackberry",
  ];
  const isMobileUA = mobileKeywords.some((keyword) => ua.includes(keyword));

  return hasTouch || isSmallScreen || isMobileUA;
};

/**
 * Check if user is on Data Saver mode
 * Important for Local AI which requires large downloads
 */
const checkDataSaverMode = () => {
  try {
    // @ts-expect-error - navigator.connection is not in all browsers
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    if (connection) {
      // Check for saveData flag
      if (connection.saveData) return true;

      // Check for slow connection types
      const slowTypes = ["slow-2g", "2g", "3g"];
      if (slowTypes.includes(connection.effectiveType)) return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Get estimated available memory (if supported)
 * Returns GB or null if not available
 */
const getDeviceMemory = () => {
  try {
    // @ts-expect-error - deviceMemory is not in all browsers
    return navigator.deviceMemory || null;
  } catch {
    return null;
  }
};

/**
 * Determine the device tier for AI recommendations
 */
const determineDeviceTier = async (userAgent, webGPUResult) => {
  const androidVersion = parseAndroidVersion(userAgent);
  const iosVersion = parseIOSVersion(userAgent);
  const isMobile = checkIsMobile();
  const deviceMemory = getDeviceMemory();

  // If WebGPU is not supported at all, it's unsupported
  if (!webGPUResult.supported) {
    return DEVICE_TIERS.UNSUPPORTED;
  }

  // Check for legacy Android (10 and below)
  if (androidVersion !== null && androidVersion <= 10) {
    return DEVICE_TIERS.LEGACY;
  }

  // Check for legacy iOS (below 16)
  if (iosVersion !== null && iosVersion < 16) {
    return DEVICE_TIERS.LEGACY;
  }

  // Check for low memory devices (less than 4GB)
  if (deviceMemory !== null && deviceMemory < 4) {
    return DEVICE_TIERS.CAPABLE; // Can work but may struggle
  }

  // Modern Android 14+ or iOS 18+ = High end
  if (
    (androidVersion !== null && androidVersion >= 14) ||
    (iosVersion !== null && iosVersion >= 18)
  ) {
    return DEVICE_TIERS.HIGH_END;
  }

  // Android 11-13 or iOS 16-17 = Capable
  if (androidVersion !== null || iosVersion !== null) {
    return DEVICE_TIERS.CAPABLE;
  }

  // Desktop with WebGPU = High end
  if (!isMobile && webGPUResult.supported) {
    return DEVICE_TIERS.HIGH_END;
  }

  // Default to capable if we have WebGPU
  return DEVICE_TIERS.CAPABLE;
};

/**
 * Get device-specific AI advice
 * @returns {Object} Advice object with labels, descriptions, and warnings
 */
const getDeviceAdvice = (tier, capabilities) => {
  const { isMobile, isDataSaver, androidVersion, iosVersion, webGPUSupported } =
    capabilities;

  // Base advice structure
  const advice = {
    localAI: {
      available: webGPUSupported,
      recommended: false,
      label: "Local AI",
      badge: null,
      description: "",
      warning: null,
      buttonDisabled: false,
    },
    cloudAI: {
      available: true,
      recommended: false,
      label: "Cloud AI (Gemini)",
      badge: null,
      description: "Fast processing via Google servers. Requires internet.",
      warning: null,
    },
    batteryWarning: isMobile && webGPUSupported,
    dataSaverWarning: isDataSaver,
  };

  switch (tier) {
    case DEVICE_TIERS.HIGH_END:
      advice.localAI.recommended = true;
      advice.localAI.label = "🔒 Local AI (Privacy Focused)";
      advice.localAI.badge = "✨ Recommended for your device";
      advice.localAI.description =
        "Runs entirely on your device. No data leaves your phone.";
      advice.cloudAI.description =
        "Fast but sends data to Google. Use Local AI for privacy.";
      break;

    case DEVICE_TIERS.CAPABLE:
      advice.localAI.recommended = false;
      advice.localAI.label = "🔒 Local AI";
      advice.localAI.badge = null;
      advice.localAI.description =
        "Private processing on your device. May use significant resources.";
      advice.cloudAI.recommended = true;
      advice.cloudAI.badge = "⚡ Faster on your device";
      if (isMobile) {
        advice.localAI.warning =
          "⚠️ May drain battery and use significant memory.";
      }
      break;

    case DEVICE_TIERS.LEGACY:
      advice.localAI.recommended = false;
      advice.localAI.label = "🔒 Local AI (Experimental)";
      advice.localAI.badge = "⚠️ May be slow";
      if (androidVersion !== null) {
        advice.localAI.description = `Your device (Android ${androidVersion}) may struggle with Local AI. We recommend Cloud AI for better performance.`;
      } else if (iosVersion !== null) {
        advice.localAI.description = `Your device (iOS ${iosVersion}) may struggle with Local AI. We recommend Cloud AI for better performance.`;
      } else {
        advice.localAI.description =
          "Your device may struggle with Local AI. We recommend Cloud AI.";
      }
      advice.localAI.warning =
        "⚠️ Local AI may freeze or crash on older devices.";
      advice.cloudAI.recommended = true;
      advice.cloudAI.badge = "✨ Recommended for your device";
      advice.cloudAI.description =
        "Fast and reliable on your device. Requires internet connection.";
      break;

    case DEVICE_TIERS.UNSUPPORTED:
      advice.localAI.available = false;
      advice.localAI.buttonDisabled = true;
      advice.localAI.label = "🔒 Local AI (Not Available)";
      advice.localAI.badge = "❌ Not supported";
      advice.localAI.description =
        "Local AI requires WebGPU, which is not available on your device.";
      advice.localAI.warning =
        "Your browser does not support WebGPU. Please use Chrome 113+, Edge 113+, or a compatible browser.";
      advice.cloudAI.recommended = true;
      advice.cloudAI.badge = "✨ Use this option";
      advice.cloudAI.description =
        "Cloud AI works on all devices. Requires internet connection.";
      break;
  }

  // Add data saver warning if applicable
  if (isDataSaver && advice.localAI.available) {
    advice.localAI.warning =
      (advice.localAI.warning || "") +
      " 📶 Data Saver detected: Local AI requires downloading 0.7-4GB. Consider using Wi-Fi.";
  }

  return advice;
};

/**
 * useDeviceCapability Hook
 * Provides device-aware AI recommendations
 *
 * @returns {Object} Device capabilities and AI advice
 */
export function useDeviceCapability() {
  const [capabilities, setCapabilities] = useState({
    checked: false,
    isMobile: false,
    isDataSaver: false,
    deviceMemory: null,
    androidVersion: null,
    iosVersion: null,
    webGPUSupported: false,
    webGPUReason: null,
    tier: DEVICE_TIERS.CAPABLE,
  });

  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkCapabilities = async () => {
      setIsChecking(true);

      const userAgent = navigator.userAgent;
      const androidVersion = parseAndroidVersion(userAgent);
      const iosVersion = parseIOSVersion(userAgent);
      const isMobile = checkIsMobile();
      const isDataSaver = checkDataSaverMode();
      const deviceMemory = getDeviceMemory();

      // Check WebGPU support
      const webGPUResult = await checkWebGPUSupport();

      // Determine device tier
      const tier = await determineDeviceTier(userAgent, webGPUResult);

      setCapabilities({
        checked: true,
        isMobile,
        isDataSaver,
        deviceMemory,
        androidVersion,
        iosVersion,
        webGPUSupported: webGPUResult.supported,
        webGPUReason: webGPUResult.reason || null,
        tier,
      });

      setIsChecking(false);
    };

    checkCapabilities();
  }, []);

  // Memoize advice based on capabilities
  const advice = useMemo(() => {
    if (!capabilities.checked) {
      return null;
    }
    return getDeviceAdvice(capabilities.tier, capabilities);
  }, [capabilities]);

  return {
    ...capabilities,
    isChecking,
    advice,

    // Convenience getters
    isHighEnd: capabilities.tier === DEVICE_TIERS.HIGH_END,
    isLegacy: capabilities.tier === DEVICE_TIERS.LEGACY,
    isUnsupported: capabilities.tier === DEVICE_TIERS.UNSUPPORTED,
    canRunLocalAI: capabilities.webGPUSupported,
    shouldRecommendCloud:
      capabilities.tier === DEVICE_TIERS.LEGACY ||
      capabilities.tier === DEVICE_TIERS.UNSUPPORTED ||
      capabilities.tier === DEVICE_TIERS.CAPABLE,
  };
}

export default useDeviceCapability;
