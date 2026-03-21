/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 *
 * useVaApiStatus Hook - React hook for VA API status monitoring
 *
 * Provides real-time VA API status information to components,
 * with automatic polling and caching.
 */

import { useState, useEffect, useCallback } from "react";
import {
  fetchVaApiStatus,
  getFeatureStatus,
  hasAnyIssues,
  getStatusSummary,
  clearStatusCache,
  getStatusPageUrl,
  VA_API_MAPPING,
} from "../utils/vaApiStatus";

// Default polling interval (5 minutes)
const DEFAULT_POLL_INTERVAL = 5 * 60 * 1000;

/**
 * Hook to monitor VA API status
 *
 * @param {Object} options - Hook options
 * @param {boolean} options.autoFetch - Auto-fetch on mount (default: true)
 * @param {boolean} options.enablePolling - Enable automatic polling (default: true)
 * @param {number} options.pollInterval - Polling interval in ms (default: 5 minutes)
 * @param {string[]} options.watchFeatures - Features to specifically watch for changes
 *
 * @returns {Object} Status data and control functions
 */
export function useVaApiStatus(options = {}) {
  const {
    autoFetch = true,
    enablePolling = true,
    pollInterval = DEFAULT_POLL_INTERVAL,
    watchFeatures = [],
  } = options;

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch status data
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchVaApiStatus();
      setStatus(data);
      setLastUpdated(new Date());

      if (data.error) {
        setError(data.error);
      }

      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Force refresh (clears cache first)
  const forceRefresh = useCallback(async () => {
    clearStatusCache();
    return refresh();
  }, [refresh]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [autoFetch, refresh]);

  // Polling
  useEffect(() => {
    if (!enablePolling) return;

    const interval = setInterval(() => {
      refresh();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [enablePolling, pollInterval, refresh]);

  // Get status for a specific feature
  const getFeatureStatusCurrent = useCallback(
    (feature) => {
      return getFeatureStatus(feature, status);
    },
    [status],
  );

  // Check if any watched features have issues
  const watchedFeaturesWithIssues = watchFeatures
    .map((feature) => ({
      feature,
      ...getFeatureStatus(feature, status),
    }))
    .filter((f) => f.status !== "operational" && f.status !== "unknown");

  return {
    // Status data
    status,
    loading,
    error,
    lastUpdated,

    // Computed values
    hasIssues: hasAnyIssues(status),
    summary: getStatusSummary(status),
    watchedFeaturesWithIssues,

    // Functions
    refresh,
    forceRefresh,
    getFeatureStatus: getFeatureStatusCurrent,

    // Constants
    statusPageUrl: getStatusPageUrl(),
    availableFeatures: Object.keys(VA_API_MAPPING),
  };
}

/**
 * Hook to check status of a specific VA API feature
 *
 * @param {string} feature - Feature name from VA_API_MAPPING
 * @param {Object} options - Hook options
 *
 * @returns {Object} Feature-specific status
 */
export function useVaFeatureStatus(feature, options = {}) {
  const { status, loading, error, refresh, statusPageUrl } =
    useVaApiStatus(options);

  const featureStatus = getFeatureStatus(feature, status);

  return {
    ...featureStatus,
    loading,
    error,
    refresh,
    statusPageUrl,
    isOperational: featureStatus.status === "operational",
    hasIssues:
      featureStatus.status !== "operational" &&
      featureStatus.status !== "unknown",
  };
}

export default useVaApiStatus;
