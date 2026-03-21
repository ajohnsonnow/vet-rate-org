/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See COPYRIGHT.js for full license terms.
 */

/**
 * DEBUG DUMP UTILITY - "The Diagnostics Tool"
 *
 * Hidden Easter egg for troubleshooting.
 * Activated by clicking the copyright footer 7 times rapidly.
 * Downloads entire localStorage state for debugging.
 */

import { APP_VERSION, SCHEMA_VERSION } from "./version";
import { triggerBlobDownload } from "./sanitize";

/**
 * Export complete localStorage state for debugging
 * @returns {Object} Complete debug data
 */
export const createDebugDump = () => {
  try {
    const debugData = {
      // Metadata
      timestamp: new Date().toISOString(),
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,

      // Full localStorage dump
      localStorage: {},

      // Version info
      versionInfo: {
        storedAppVersion: localStorage.getItem("vet_rate_app_version"),
        storedSchemaVersion: localStorage.getItem(
          "vet_rate_data_schema_version",
        ),
        lastSeenVersion: localStorage.getItem("vet_rate_last_seen_version"),
      },

      // Storage stats
      storageInfo: {
        totalKeys: 0,
        totalSize: 0,
        keysByPrefix: {},
      },
    };

    // Dump all localStorage
    let totalSize = 0;
    const keysByPrefix = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);

      debugData.localStorage[key] = value;

      // Calculate size (rough estimate)
      const size = (key.length + value.length) * 2; // 2 bytes per char
      totalSize += size;

      // Group by prefix
      const prefix = key.split("_")[0] || key.split("-")[0] || "other";
      if (!keysByPrefix[prefix]) {
        keysByPrefix[prefix] = { count: 0, size: 0 };
      }
      keysByPrefix[prefix].count++;
      keysByPrefix[prefix].size += size;
    }

    debugData.storageInfo.totalKeys = localStorage.length;
    debugData.storageInfo.totalSize = totalSize;
    debugData.storageInfo.totalSizeFormatted = formatBytes(totalSize);
    debugData.storageInfo.keysByPrefix = keysByPrefix;

    // Add console logs (last 100 if available)
    debugData.consoleWarning = "Console logs not available in production build";

    return debugData;
  } catch (error) {
    console.error("Error creating debug dump:", error);
    return {
      error: error.message,
      timestamp: new Date().toISOString(),
      appVersion: APP_VERSION,
    };
  }
};

/**
 * Download debug dump as JSON file
 */
export const downloadDebugDump = () => {
  try {
    const debugData = createDebugDump();

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `vet-rate-debug-dump-${timestamp}.json`;

    const json = JSON.stringify(debugData, null, 2);
    // deepcode ignore javascript/DOMXSS: triggerBlobDownload uses reconstructBlobUrl which extracts only the UUID via regex — a.href is built exclusively from literal 'blob:' + origin + '/' + UUID
    const blob = new Blob([json], { type: "application/json" });
    triggerBlobDownload(blob, String(filename).replace(/[<>"']/g, ""));

    console.log("✅ Debug dump downloaded:", filename);
    return true;
  } catch (error) {
    console.error("❌ Failed to download debug dump:", error);
    alert("Failed to create debug dump. Check console for details.");
    return false;
  }
};

/**
 * Format bytes to human-readable string
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

/**
 * Create click counter for Easter egg activation
 * Usage: const counter = createClickCounter(7, callback);
 */
export const createClickCounter = (
  requiredClicks,
  onActivate,
  timeWindow = 2000,
) => {
  let clicks = [];

  return () => {
    const now = Date.now();

    // Remove old clicks outside time window
    clicks = clicks.filter((time) => now - time < timeWindow);

    // Add new click
    clicks.push(now);

    // Check if threshold reached
    if (clicks.length >= requiredClicks) {
      clicks = []; // Reset
      onActivate();
      return true;
    }

    return false;
  };
};

/**
 * Create debug dump component for Footer
 * Returns click handler function
 */
export const createDebugDumpHandler = () => {
  return createClickCounter(
    7,
    () => {
      console.log(
        "🐛 DEBUG MODE ACTIVATED - Downloading full diagnostic dump...",
      );

      // Visual feedback
      const notification = document.createElement("div");
      notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      z-index: 9999;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 600;
      animation: slideInRight 0.3s ease-out;
    `;
      notification.textContent = "🐛 Debug dump downloaded!";
      document.body.appendChild(notification);

      // Download the dump
      downloadDebugDump();

      // Remove notification after 3 seconds
      setTimeout(() => {
        notification.style.animation = "slideOutRight 0.3s ease-out";
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    },
    2000,
  ); // 2 second window for 7 clicks
};
