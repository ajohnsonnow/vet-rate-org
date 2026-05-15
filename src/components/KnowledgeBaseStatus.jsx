/**
 * Vet-Rate.org - Knowledge Base Status Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * Displays Diamond Knowledge Base (DKB) status with source-level date tracking
 * DKB = Official sources (training approved)
 * CKB = Community sources (NOT for training) - HIDDEN until approved
 */

import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import disabilityDataJson from "../data/disabilityData.json";
import { useColorSchemas } from "../hooks/useColorSchemas";
import {
  isMobileDevice,
  isFullDKBCached,
  downloadFullDKB,
  getCachedEntryCount,
  getCachedSourceCounts,
  smartLoadDKB,
  FULL_DATABASE_COUNT,
  WEB_DATABASE_COUNT,
} from "../utils/dkbIndexedDB";

const disabilityData = disabilityDataJson.disabilities || [];

/**
 * Knowledge Source Metadata
 * Each source has a human-readable name, description, and last updated date
 * This allows tracking when new info becomes available for DKB/CKB incorporation
 *
 * VERIFIED SOURCES IN DKB (as of 2026-01-27):
 * - eCFR_OFFICIAL, FEDERAL_REGISTER_OFFICIAL, M21-1_OFFICIAL
 * - BVA_DECISIONS, BVA_REPORTS_OFFICIAL, OGC_PRECEDENT_OPINION
 * - CAVC (U.S. Court of Appeals for Veterans Claims)
 * - PACT_ACT_OFFICIAL, EAJA_STATISTICS_OFFICIAL, SECONDARY_CONDITIONS_MATRIX
 * - VA_OFFICIAL
 */
const SOURCE_METADATA = {
  // Level 1 - Statutory Law (Highest Authority)
  eCFR_OFFICIAL: {
    displayName: "38 CFR (eCFR)",
    description:
      "Code of Federal Regulations - Official VA disability rating schedule",
    lastUpdated: "2026-01-22",
    authorityLevel: 1,
    icon: "📜",
    color: "red",
  },
  ECFR_OFFICIAL: {
    displayName: "38 CFR (eCFR)",
    description:
      "Code of Federal Regulations - Official VA disability rating schedule",
    lastUpdated: "2026-01-22",
    authorityLevel: 1,
    icon: "📜",
    color: "red",
  },
  PACT_ACT_OFFICIAL: {
    displayName: "PACT Act",
    description:
      "Promise to Address Comprehensive Toxics Act - Toxic exposure benefits",
    lastUpdated: "2026-01-15",
    authorityLevel: 1,
    icon: "🎖️",
    color: "red",
  },
  // Level 2 - Judicial Precedent
  "U.S. Court of Appeals for Veterans Claims": {
    displayName: "CAVC Decisions",
    description:
      "Court of Appeals for Veterans Claims - Binding judicial precedent",
    lastUpdated: "2026-01-26",
    authorityLevel: 2,
    icon: "🏛️",
    color: "green",
  },
  CAVC_DECISIONS: {
    displayName: "CAVC Decisions",
    description:
      "Court of Appeals for Veterans Claims - Binding judicial precedent",
    lastUpdated: "2026-01-26",
    authorityLevel: 2,
    icon: "🏛️",
    color: "green",
  },
  CAVC: {
    displayName: "CAVC Cases",
    description: "Veterans Court decisions and remands",
    lastUpdated: "2026-01-26",
    authorityLevel: 2,
    icon: "🏛️",
    color: "green",
  },
  EAJA_STATISTICS_OFFICIAL: {
    displayName: "EAJA Statistics",
    description: "Equal Access to Justice Act - Attorney fee awards data",
    lastUpdated: "2026-01-15",
    authorityLevel: 2,
    icon: "⚖️",
    color: "green",
  },
  // Level 3 - Administrative Decisions
  BVA_DECISIONS: {
    displayName: "BVA Decisions",
    description:
      "Board of Veterans Appeals - Administrative precedent decisions",
    lastUpdated: "2026-01-20",
    authorityLevel: 3,
    icon: "📋",
    color: "green",
  },
  BVA_REPORTS_OFFICIAL: {
    displayName: "BVA Reports",
    description: "Board of Veterans Appeals - Official statistical reports",
    lastUpdated: "2026-01-20",
    authorityLevel: 3,
    icon: "📊",
    color: "green",
  },
  FEDERAL_CIRCUIT: {
    displayName: "Federal Circuit",
    description:
      "U.S. Court of Appeals for the Federal Circuit - Highest VA precedent",
    lastUpdated: "2026-01-26",
    authorityLevel: 2,
    icon: "🏛️",
    color: "green",
  },
  // Level 4 - Policy Guidance
  FEDERAL_REGISTER_OFFICIAL: {
    displayName: "Federal Register",
    description: "Proposed and final VA rule changes - Official notices",
    lastUpdated: "2026-01-18",
    authorityLevel: 4,
    icon: "📰",
    color: "orange",
  },
  OGC_PRECEDENT_OPINION: {
    displayName: "VA OGC Opinions",
    description: "Office of General Counsel - Binding precedential opinions",
    lastUpdated: "2026-01-15",
    authorityLevel: 4,
    icon: "⚡",
    color: "orange",
  },
  PRESUMPTIVE_CONDITIONS: {
    displayName: "Presumptive Conditions",
    description:
      "Service-connected presumptive conditions list - PACT Act & legacy",
    lastUpdated: "2026-01-22",
    authorityLevel: 4,
    icon: "✅",
    color: "green",
  },
  VA_OFFICIAL: {
    displayName: "VA Official",
    description: "Official VA guidance and policy documents",
    lastUpdated: "2026-01-15",
    authorityLevel: 4,
    icon: "🏢",
    color: "orange",
  },
  // Level 5 - Procedures
  "M21-1_OFFICIAL": {
    displayName: "M21-1 Manual",
    description: "VA Adjudication Procedures Manual - Rater guidance",
    lastUpdated: "2026-01-22",
    authorityLevel: 5,
    icon: "📘",
    color: "blue",
  },
  // Level 6 - Reference Data
  SECONDARY_CONDITIONS_MATRIX: {
    displayName: "Secondary Conditions",
    description:
      "Medical nexus matrix - Service-connected secondary conditions",
    lastUpdated: "2026-01-22",
    authorityLevel: 6,
    icon: "🔗",
    color: "purple",
  },
  // Fallback for unknown sources
  Unknown: {
    displayName: "Other Sources",
    description: "Additional knowledge entries",
    lastUpdated: null,
    authorityLevel: 7,
    icon: "📄",
    color: "gray",
  },
};

/**
 * Get metadata for a source, matching partial names
 */
const getSourceMetadata = (sourceKey) => {
  // Direct match
  if (SOURCE_METADATA[sourceKey]) {
    return SOURCE_METADATA[sourceKey];
  }

  // Partial match (e.g., "ECFR_38_CFR_PART4_SUBPART_A" matches "ECFR_38_CFR")
  const normalizedKey = sourceKey.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  for (const [key, metadata] of Object.entries(SOURCE_METADATA)) {
    if (
      normalizedKey.includes(key) ||
      key.includes(normalizedKey.split("_").slice(0, 3).join("_"))
    ) {
      return metadata;
    }
  }

  // Check for CAVC
  if (normalizedKey.includes("CAVC")) {
    return SOURCE_METADATA["CAVC"];
  }

  // Check for CFR
  if (normalizedKey.includes("CFR") || normalizedKey.includes("ECFR")) {
    return SOURCE_METADATA["eCFR_OFFICIAL"];
  }

  return SOURCE_METADATA["Unknown"];
};

/**
 * Knowledge Base Status Indicator
 * Shows real-time stats from Diamond Knowledge Base (DKB) - Official sources only
 * CKB is hidden until approved for use
 */
export default function KnowledgeBaseStatus({ compact = false }) {
  const { t } = useLanguage();
  const { getColorClass, colors, getDropdownClasses } = useColorSchemas();
  const dropdownClasses = getDropdownClasses();

  const [showDetails, setShowDetails] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullCached, setIsFullCached] = useState(false);
  const [kbStatus, setKbStatus] = useState({
    lastUpdated: null,
    totalConditions: 0,
    // DKB (Diamond Knowledge Base) - Official sources
    dkbEntries: 0,
    dkbSources: {},
    // Full database count (available with Local LLM or IndexedDB)
    fullDatabaseCount: FULL_DATABASE_COUNT, // Full DKB entries
    isWebOptimized: true, // True when using web version (truncated)
    localAIReady: false, // Whether Local AI is loaded
    // Combined for display
    totalEntries: 0,
    sources: {},
    // Full DKB source counts (calculated dynamically from cached data)
    fullSources: {},
    ecfrCurrent: true,
    ecfrDate: "2026-01-27",
    loading: true,
  });
  const dropdownRef = useRef(null);

  // Check device type and cache status on mount
  useEffect(() => {
    const checkDeviceAndCache = async () => {
      const mobile = isMobileDevice();
      setIsMobile(mobile);

      const cached = await isFullDKBCached();
      setIsFullCached(cached);

      console.log(`[DKB] Device check: mobile=${mobile}, cached=${cached}`);

      // If full DKB is cached, update the display immediately
      if (cached) {
        const entryCount = await getCachedEntryCount();
        const sourceCounts = await getCachedSourceCounts();
        console.log(
          `[DKB] Full database cached with ${entryCount} entries - updating display`,
        );
        setKbStatus((prev) => ({
          ...prev,
          isWebOptimized: false,
          dkbEntries: entryCount || FULL_DATABASE_COUNT,
          totalEntries: entryCount || FULL_DATABASE_COUNT,
          fullSources: sourceCounts,
          dkbSources: sourceCounts,
          sources: sourceCounts,
        }));
      }

      // On desktop, auto-download full database if not cached
      if (!mobile && !cached) {
        console.log(
          "[DKB] Desktop detected - auto-downloading full database...",
        );
        setIsDownloading(true);
        const result = await downloadFullDKB((progress) =>
          setDownloadProgress(progress),
        );
        setIsDownloading(false);
        if (result.success) {
          setIsFullCached(true);
          // Get actual source counts from the downloaded data
          const sourceCounts = await getCachedSourceCounts();
          // Update state instead of reloading - smoother UX
          setKbStatus((prev) => ({
            ...prev,
            isWebOptimized: false,
            dkbEntries: result.entryCount,
            totalEntries: result.entryCount,
            fullSources: sourceCounts,
            dkbSources: sourceCounts,
            sources: sourceCounts,
          }));
          console.log(
            `[DKB] ✅ Full database cached (${result.entryCount} entries) - updated display`,
          );
        }
      }
    };

    checkDeviceAndCache();

    // Listen for cache updates
    const handleCacheUpdate = (event) => {
      const { entryCount, fullDatabase } = event.detail || {};
      if (fullDatabase) {
        setIsFullCached(true);
        setKbStatus((prev) => ({
          ...prev,
          isWebOptimized: false,
          dkbEntries: entryCount,
          totalEntries: entryCount,
        }));
      }
    };

    window.addEventListener("dkb-cache-updated", handleCacheUpdate);
    return () =>
      window.removeEventListener("dkb-cache-updated", handleCacheUpdate);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDetails(false);
      }
    };

    if (showDetails) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showDetails]);

  // Listen for Local AI status changes
  useEffect(() => {
    const handleLocalAIStatusChange = (event) => {
      const { ready, fullDKBAvailable } = event.detail || {};
      console.log("[DKB Status] Local AI status changed:", {
        ready,
        fullDKBAvailable,
      });

      if (ready && fullDKBAvailable) {
        // Local AI loaded - show full DKB stats
        setKbStatus((prev) => ({
          ...prev,
          localAIReady: true,
          isWebOptimized: false,
          dkbEntries: prev.fullDatabaseCount,
          totalEntries: prev.fullDatabaseCount,
          // Use full source counts
          dkbSources: prev.fullSources,
          sources: prev.fullSources,
        }));
      } else {
        // Local AI unloaded - revert to web-optimized
        setKbStatus((prev) => ({
          ...prev,
          localAIReady: false,
          isWebOptimized: prev.totalEntries < prev.fullDatabaseCount,
        }));
      }
    };

    window.addEventListener(
      "local-ai-status-change",
      handleLocalAIStatusChange,
    );
    return () => {
      window.removeEventListener(
        "local-ai-status-change",
        handleLocalAIStatusChange,
      );
    };
  }, []);

  useEffect(() => {
    // Load Diamond Knowledge Base (DKB) - Official sources only
    const loadKnowledgeBaseStats = async () => {
      try {
        // Load DKB (official sources - for AI/training)
        // This is the web-optimized version (8,000 high-value entries)
        // Full database has 130,508 entries (available with Local LLM)
        const dkbResponse = await fetch("/data/diamond_knowledge.json");
        if (!dkbResponse.ok) throw new Error("Failed to load DKB");
        const dkbData = await dkbResponse.json();

        // Calculate DKB statistics (official sources only)
        const dkbSources = {};
        const entries = dkbData.entries || dkbData || [];
        entries.forEach((item) => {
          const source = item.metadata?.source || item.source || "Unknown";
          dkbSources[source] = (dkbSources[source] || 0) + 1;
        });

        // Get full database count from metadata
        const fullCount =
          dkbData.full_database_count || dkbData.fullDatabaseCount || 130508;

        // Get last verified date from disability data
        const lastVerifiedDates = disabilityData
          .filter((d) => d.lastVerifiedDate)
          .map((d) => d.lastVerifiedDate);

        const mostRecentDate =
          lastVerifiedDates.length > 0
            ? lastVerifiedDates.sort().reverse()[0]
            : null;

        setKbStatus({
          lastUpdated: mostRecentDate,
          totalConditions: disabilityData.length,
          // DKB - Official sources (training approved)
          dkbEntries: entries.length,
          dkbSources,
          // Full database info
          fullDatabaseCount: fullCount,
          isWebOptimized: entries.length < fullCount,
          // Combined totals for display
          totalEntries: entries.length,
          sources: { ...dkbSources },
          ecfrCurrent: true,
          ecfrDate: "2026-01-27",
          loading: false,
        });
      } catch (error) {
        console.error("Error loading KB stats:", error);
        // Fallback to basic stats
        setKbStatus((prev) => ({
          ...prev,
          totalConditions: disabilityData.length,
          loading: false,
        }));
      }
    };

    loadKnowledgeBaseStats();
  }, []);

  // Handle manual download of full DKB (for mobile users)
  const handleDownloadFullDKB = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const result = await downloadFullDKB((progress) =>
        setDownloadProgress(progress),
      );

      if (result.success) {
        setIsFullCached(true);
        setKbStatus((prev) => ({
          ...prev,
          isWebOptimized: !result.isFullDB,
          dkbEntries: result.entryCount,
          totalEntries: result.entryCount,
        }));
        console.log(`[DKB] Successfully cached ${result.entryCount} entries`);
      } else {
        console.error("[DKB] Download failed:", result.error);
      }
    } catch (err) {
      console.error("[DKB] Download error:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const getDaysSinceUpdate = () => {
    if (!kbStatus.lastUpdated) return null;
    const lastUpdate = new Date(kbStatus.lastUpdated);
    const now = new Date();
    const diffTime = Math.abs(now - lastUpdate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = () => {
    const days = getDaysSinceUpdate();
    if (!days) return "text-gray-500";
    if (days <= 30) return "text-green-500 dark:text-green-400";
    if (days <= 90) return "text-yellow-500 dark:text-yellow-400";
    return "text-orange-500 dark:text-orange-400";
  };

  const getStatusIcon = () => {
    const days = getDaysSinceUpdate();
    if (!days) return "📊";
    if (days <= 30) return "✅";
    if (days <= 90) return "⚠️";
    return "🔄";
  };

  // Custom scrollbar styles for a cleaner look
  const scrollbarStyles = `
    .dkb-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .dkb-scrollbar::-webkit-scrollbar-track {
      background: transparent;
      border-radius: 3px;
    }
    .dkb-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(16, 185, 129, 0.3);
      border-radius: 3px;
    }
    .dkb-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(16, 185, 129, 0.5);
    }
    .dark .dkb-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(52, 211, 153, 0.3);
    }
    .dark .dkb-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(52, 211, 153, 0.5);
    }
  `;

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return "Pending";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Group sources by authority level for better organization
  const getGroupedSources = () => {
    const grouped = {};
    Object.entries(kbStatus.dkbSources).forEach(([source, count]) => {
      const metadata = getSourceMetadata(source);
      const level = metadata.authorityLevel;
      if (!grouped[level]) {
        grouped[level] = [];
      }
      grouped[level].push({ source, count, metadata });
    });
    return grouped;
  };

  if (compact) {
    return (
      <div ref={dropdownRef} className="relative">
        <style>{scrollbarStyles}</style>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-xs bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          aria-label="Diamond Knowledge Base - Click for details"
        >
          <span className={getStatusColor()}>{getStatusIcon()}</span>
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {kbStatus.localAIReady &&
            !kbStatus.isWebOptimized &&
            !kbStatus.loading ? (
              <>
                <span className="text-emerald-600 dark:text-emerald-400">
                  FULL DKB
                </span>
                <span
                  className="text-emerald-500 dark:text-emerald-400 ml-1"
                  aria-label="Full DKB active with Local AI"
                >
                  🧠
                </span>
              </>
            ) : (
              <>
                DKB:{" "}
                {kbStatus.loading
                  ? "Loading..."
                  : `${kbStatus.dkbEntries.toLocaleString()}`}
                {kbStatus.isWebOptimized && !kbStatus.loading && (
                  <span
                    className="text-amber-500 dark:text-amber-400 ml-1"
                    aria-label={`Web version (${kbStatus.dkbEntries.toLocaleString()} of ${kbStatus.fullDatabaseCount.toLocaleString()} entries). Load Local LLM for full database.`}
                  >
                    *
                  </span>
                )}
              </>
            )}
          </span>
          {kbStatus.ecfrCurrent && (
            <span
              className="text-green-500 dark:text-green-400"
              aria-label="Diamond Certified - Official VA Sources"
            >
              💎
            </span>
          )}

          {showDetails && (
            <div
              className="absolute top-full left-0 mt-2 w-[420px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 text-left z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                {/* Header with total stats */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">💎</span>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        Diamond Knowledge Base
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Official VA sources for AI training
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {kbStatus.loading
                        ? "..."
                        : kbStatus.dkbEntries.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      entries loaded
                    </div>
                  </div>
                </div>

                {/* Web Optimization Notice */}
                {kbStatus.isWebOptimized &&
                  !kbStatus.loading &&
                  !isFullCached && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-amber-500 text-lg">⚡</span>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                            Web-Optimized Mode
                          </div>
                          <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                            Showing{" "}
                            <strong>
                              {kbStatus.dkbEntries.toLocaleString()}
                            </strong>{" "}
                            high-priority entries for fast loading. Full
                            database has{" "}
                            <strong>
                              {kbStatus.fullDatabaseCount.toLocaleString()}
                            </strong>{" "}
                            entries.
                          </div>

                          {/* Download Button for Mobile */}
                          {isMobile && !isDownloading && (
                            <button
                              onClick={handleDownloadFullDKB}
                              className="mt-3 w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <span>📥</span>
                              <span>Download Full Database (~8 MB)</span>
                            </button>
                          )}

                          {/* Download Progress */}
                          {isDownloading && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 mb-1">
                                <span>Downloading full database...</span>
                                <span>{downloadProgress}%</span>
                              </div>
                              <div className="w-full h-2 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 transition-all duration-300"
                                  style={{ width: `${downloadProgress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Desktop notice */}
                          {!isMobile && !isDownloading && (
                            <div className="text-xs text-amber-600 dark:text-amber-500 mt-2 flex items-center gap-1">
                              <span>🧠</span>
                              <span>
                                Load <strong>Local LLM</strong> (Diamond Swarm)
                                for complete knowledge access.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Full DKB Cached Notice */}
                {isFullCached &&
                  !kbStatus.localAIReady &&
                  !kbStatus.loading && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500 text-lg">💾</span>
                        <div>
                          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                            Full Database Cached
                          </div>
                          <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                            <strong>
                              {kbStatus.fullDatabaseCount.toLocaleString()}
                            </strong>{" "}
                            entries saved locally for offline access.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Full DKB Active Notice */}
                {kbStatus.localAIReady &&
                  !kbStatus.isWebOptimized &&
                  !kbStatus.loading && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500 text-lg">🧠</span>
                        <div>
                          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                            Full Knowledge Base Active
                          </div>
                          <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                            Local AI loaded with complete{" "}
                            <strong>
                              {kbStatus.fullDatabaseCount.toLocaleString()}
                            </strong>{" "}
                            DKB entries. All official sources available for
                            comprehensive analysis.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Source list with metadata */}
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Knowledge Sources
                  </h5>

                  {!kbStatus.loading && (
                    <div className="dkb-scrollbar max-h-48 overflow-y-auto pr-1 space-y-2">
                      {Object.entries(kbStatus.dkbSources)
                        .map(([source, count]) => {
                          const metadata = getSourceMetadata(source);
                          return { source, count, metadata };
                        })
                        .sort(
                          (a, b) =>
                            a.metadata.authorityLevel -
                              b.metadata.authorityLevel || b.count - a.count,
                        )
                        .map(({ source, count, metadata }) => (
                          <div
                            key={source}
                            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5 border border-gray-100 dark:border-gray-600"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base flex-shrink-0">
                                  {metadata.icon}
                                </span>
                                <div className="min-w-0">
                                  <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                    {metadata.displayName}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                    {metadata.description}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                                  {count.toLocaleString()}
                                </div>
                                <div
                                  className={`text-xs ${metadata.lastUpdated ? "text-gray-500 dark:text-gray-400" : "text-amber-500 dark:text-amber-400"}`}
                                >
                                  {metadata.lastUpdated
                                    ? formatDate(metadata.lastUpdated)
                                    : "Planned"}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Authority Levels Legend */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                    📊 Authority Levels
                  </h5>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                      1-Statutory
                    </span>
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                      2-Judicial
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                      3-Admin
                    </span>
                    <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full">
                      4-Policy
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                      5-Procedures
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
                      6-Reference
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>Last KB Update: {formatDate(kbStatus.ecfrDate)}</span>
                    <a
                      href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View eCFR →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </button>
      </div>
    );
  }

  // Full display version - DKB only (CKB hidden until approved)
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
      <style>{scrollbarStyles}</style>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💎</span>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Diamond Knowledge Base
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Official VA sources for AI training
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {kbStatus.localAIReady &&
              !kbStatus.isWebOptimized &&
              !kbStatus.loading ? (
                <span className="flex items-center gap-1">
                  <span>FULL</span>
                  <span className="text-lg">🧠</span>
                </span>
              ) : (
                <>
                  {kbStatus.loading
                    ? "..."
                    : kbStatus.dkbEntries.toLocaleString()}
                  {kbStatus.isWebOptimized && !kbStatus.loading && (
                    <span className="text-amber-500 text-lg ml-1">*</span>
                  )}
                </>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {kbStatus.localAIReady && !kbStatus.isWebOptimized ? (
                <span className="text-emerald-500 dark:text-emerald-400 font-semibold">
                  {kbStatus.fullDatabaseCount.toLocaleString()} entries
                </span>
              ) : kbStatus.isWebOptimized ? (
                "web-optimized entries"
              ) : (
                "total entries"
              )}
            </div>
          </div>
        </div>

        {/* Web Optimization Notice */}
        {kbStatus.isWebOptimized && !kbStatus.loading && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 text-2xl">⚡</span>
              <div className="flex-1">
                <div className="text-base font-semibold text-amber-800 dark:text-amber-300">
                  Web-Optimized Mode Active
                </div>
                <div className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  Currently showing{" "}
                  <strong>{kbStatus.dkbEntries.toLocaleString()}</strong>{" "}
                  high-priority entries (top 6% by quality score) for faster
                  browser loading.
                </div>
                <div className="mt-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                        Full Database
                      </div>
                      <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {kbStatus.fullDatabaseCount.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        total entries
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="text-2xl">🧠</span>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Available with
                      </div>
                      <div className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                        Local LLM
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                  💡 Load <strong>Diamond Swarm</strong> (Local AI) for complete
                  130K+ entry access with offline capability.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Source Cards */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
            Knowledge Sources
          </h4>

          {!kbStatus.loading && (
            <div className="dkb-scrollbar max-h-64 overflow-y-auto pr-2 space-y-3">
              {Object.entries(kbStatus.dkbSources)
                .map(([source, count]) => {
                  const metadata = getSourceMetadata(source);
                  return { source, count, metadata };
                })
                .sort(
                  (a, b) =>
                    a.metadata.authorityLevel - b.metadata.authorityLevel ||
                    b.count - a.count,
                )
                .map(({ source, count, metadata }) => (
                  <div
                    key={source}
                    className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-700/30 rounded-xl p-4 border border-gray-100 dark:border-gray-600 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-2xl flex-shrink-0 mt-0.5">
                          {metadata.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-base text-gray-900 dark:text-white">
                            {metadata.displayName}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {metadata.description}
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-xs">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                                metadata.lastUpdated
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                  : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                              }`}
                            >
                              📅{" "}
                              {metadata.lastUpdated
                                ? formatDate(metadata.lastUpdated)
                                : "Planned"}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500">
                              Level {metadata.authorityLevel} Authority
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          {count.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          entries
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Authority Levels Legend */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
            📊 Authority Hierarchy
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-3 py-2 rounded-lg border border-red-100 dark:border-red-800">
              <span className="font-bold">1</span>
              <span>Statutory Law</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-3 py-2 rounded-lg border border-green-100 dark:border-green-800">
              <span className="font-bold">2</span>
              <span>Judicial Precedent</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-3 py-2 rounded-lg border border-emerald-100 dark:border-emerald-800">
              <span className="font-bold">3</span>
              <span>Administrative</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-3 py-2 rounded-lg border border-orange-100 dark:border-orange-800">
              <span className="font-bold">4</span>
              <span>Policy Guidance</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
              <span className="font-bold">5</span>
              <span>Procedures</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-3 py-2 rounded-lg border border-purple-100 dark:border-purple-800">
              <span className="font-bold">6</span>
              <span>Reference Data</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <span
              className={`inline-flex items-center gap-1 ${
                kbStatus.ecfrCurrent
                  ? "text-green-600 dark:text-green-400"
                  : "text-orange-600 dark:text-orange-400"
              }`}
            >
              {kbStatus.ecfrCurrent ? "✅ eCFR Current" : "🔄 Update Available"}
            </span>
            <span className="ml-2 text-gray-400">
              as of {formatDate(kbStatus.ecfrDate)}
            </span>
          </div>
          <a
            href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            View Official eCFR →
          </a>
        </div>
      </div>
    </div>
  );
}
