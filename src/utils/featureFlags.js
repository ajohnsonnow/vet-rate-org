/**
 * Feature Flag System - Remote Kill Switch
 * Allows instant disabling of features without redeployment
 */

import { useState, useEffect } from "react";

const STATUS_URL = "/status.json";
const CACHE_KEY = "vetrate_system_status";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to check system status and feature flags
 * @returns {Object} System status
 */
export const useSystemStatus = () => {
  const [status, setStatus] = useState({
    aiEnabled: true, // Default to true (fail-open for offline usage)
    localAIEnabled: true,
    cloudAIEnabled: true,
    warning: null,
    systemStatus: "nominal",
    isLoading: true,
    lastChecked: null,
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Check cache first
        const cached = getCachedStatus();
        if (cached && isCacheValid(cached)) {
          setStatus({
            ...cached.data,
            isLoading: false,
            lastChecked: new Date(cached.timestamp),
          });
          return;
        }

        // Fetch fresh status with cache-busting
        const response = await fetch(`${STATUS_URL}?t=${Date.now()}`, {
          cache: "no-cache",
        });

        if (!response.ok) {
          // Fail-open: If status check fails, allow features to work
          console.warn("Status check failed, using defaults");
          setStatus((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        const config = await response.json();

        const newStatus = {
          aiEnabled: config.ai_enabled !== false,
          localAIEnabled: config.features?.local_ai !== false,
          cloudAIEnabled: config.features?.cloud_ai !== false,
          warning: config.maintenance_message || null,
          systemStatus: config.system_status || "nominal",
          isLoading: false,
          lastChecked: new Date(),
        };

        // Cache the result
        cacheStatus(newStatus);

        setStatus(newStatus);
      } catch (err) {
        console.warn("System status check error (failing open):", err);
        // Fail-open: Allow features to work if check fails
        setStatus((prev) => ({ ...prev, isLoading: false }));
      }
    };

    checkStatus();

    // Re-check every 5 minutes
    const interval = setInterval(checkStatus, CACHE_DURATION);

    return () => clearInterval(interval);
  }, []);

  return status;
};

/**
 * Get cached status from localStorage
 */
const getCachedStatus = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn("Failed to read cached status:", e);
  }
  return null;
};

/**
 * Check if cached status is still valid
 */
const isCacheValid = (cached) => {
  if (!cached || !cached.timestamp) return false;
  const age = Date.now() - cached.timestamp;
  return age < CACHE_DURATION;
};

/**
 * Cache status to localStorage
 */
const cacheStatus = (status) => {
  try {
    const toCache = {
      data: status,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
  } catch (e) {
    console.warn("Failed to cache status:", e);
  }
};

/**
 * Force refresh of system status (bypass cache)
 */
export const refreshSystemStatus = async () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    const response = await fetch(`${STATUS_URL}?t=${Date.now()}`, {
      cache: "no-cache",
    });

    if (!response.ok) return null;

    const config = await response.json();
    return {
      aiEnabled: config.ai_enabled !== false,
      localAIEnabled: config.features?.local_ai !== false,
      cloudAIEnabled: config.features?.cloud_ai !== false,
      warning: config.maintenance_message || null,
      systemStatus: config.system_status || "nominal",
    };
  } catch (err) {
    console.error("Failed to refresh status:", err);
    return null;
  }
};

/**
 * Check if a specific feature is enabled
 * @param {string} featureName - Name of the feature
 * @returns {boolean}
 */
export const isFeatureEnabled = (featureName) => {
  try {
    const cached = getCachedStatus();
    if (!cached || !isCacheValid(cached)) {
      // If no valid cache, assume enabled (fail-open)
      return true;
    }

    const status = cached.data;

    switch (featureName.toLowerCase()) {
      case "ai":
      case "all_ai":
        return status.aiEnabled !== false;
      case "local_ai":
        return status.localAIEnabled !== false && status.aiEnabled !== false;
      case "cloud_ai":
        return status.cloudAIEnabled !== false && status.aiEnabled !== false;
      default:
        return true; // Unknown features default to enabled
    }
  } catch (e) {
    console.warn("Feature check error (defaulting to enabled):", e);
    return true;
  }
};

export default {
  useSystemStatus,
  refreshSystemStatus,
  isFeatureEnabled,
};
