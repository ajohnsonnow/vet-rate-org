/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See COPYRIGHT.js for full license terms.
 */

/**
 * UPDATE CHECKER - "The Sentinel"
 *
 * Monitors for new app versions by checking version.json on the server.
 * Ensures users aren't running stale cached code.
 *
 * HOW IT WORKS:
 * 1. Every 15 minutes, fetch version.json from server
 * 2. Compare server version with local version
 * 3. If server > local, notify user of update
 * 4. User can click to hard-reload and get fresh code
 */

import { APP_VERSION, UPDATE_CHECK_INTERVAL } from "./version";

let checkInterval = null;
let lastCheckTime = null;

/**
 * Compare semantic versions
 * @param {string} v1 - Version 1
 * @param {string} v2 - Version 2
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
const compareVersions = (v1, v2) => {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
};

/**
 * Check for updates by fetching version.json from server
 * @returns {Promise<Object>} Update status
 */
export const checkForUpdates = async () => {
  try {
    lastCheckTime = Date.now();

    // Fetch version.json with cache-busting
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      // If version.json doesn't exist yet (first deployment), silently ignore
      if (response.status === 404) {
        console.log("ℹ️ version.json not found (first deployment?)");
        return { updateAvailable: false, reason: "version_file_not_found" };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const serverVersion = data.version;
    const currentVersion = APP_VERSION;

    console.log(
      `🔍 Update check: Server=${serverVersion}, Local=${currentVersion}`,
    );

    const comparison = compareVersions(serverVersion, currentVersion);

    if (comparison > 0) {
      // Server version is newer
      console.log("🆕 Update available!");
      return {
        updateAvailable: true,
        currentVersion,
        serverVersion,
        changelog: data.changelog || [],
        updateDate: data.updateDate,
      };
    } else {
      // Already on latest version
      console.log("✅ App is up to date");
      return {
        updateAvailable: false,
        currentVersion,
        serverVersion,
      };
    }
  } catch (error) {
    console.error("❌ Update check failed:", error);
    return {
      updateAvailable: false,
      error: error.message,
    };
  }
};

/**
 * Force a hard reload to get the latest version
 * Clears cache and reloads from server
 */
export const applyUpdate = () => {
  console.log("🔄 Applying update - hard reload...");

  // Force hard reload (bypasses cache)
  window.location.reload(true);
};

/**
 * Start automatic update checking
 * Checks every UPDATE_CHECK_INTERVAL (15 minutes by default)
 * @param {Function} onUpdateAvailable - Callback when update is found
 */
export const startUpdateChecker = (onUpdateAvailable) => {
  // Stop any existing checker
  stopUpdateChecker();

  console.log(
    `🛡️ Update checker started (checking every ${UPDATE_CHECK_INTERVAL / 60000} minutes)`,
  );

  // Check immediately on start
  checkForUpdates().then((result) => {
    if (result.updateAvailable && onUpdateAvailable) {
      onUpdateAvailable(result);
    }
  });

  // Then check periodically
  checkInterval = setInterval(async () => {
    const result = await checkForUpdates();
    if (result.updateAvailable && onUpdateAvailable) {
      onUpdateAvailable(result);
    }
  }, UPDATE_CHECK_INTERVAL);
};

/**
 * Stop automatic update checking
 */
export const stopUpdateChecker = () => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log("🛡️ Update checker stopped");
  }
};
