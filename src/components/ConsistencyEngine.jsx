/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * The Consistency Engine - UI Component
 * Displays contradictions and helps users fix them
 *
 * Now includes:
 * - Rules Mode: Automated rule-based checks across stored data
 * - AI Mode: "Cross-Examination" - Compare evidence vs statements with AI
 */

import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";
import useConsistencyCheck, {
  getHealthStatus,
} from "../utils/useConsistencyCheck";
import AIConsistencyAnalyzer from "./AIConsistencyAnalyzer";

export default function ConsistencyEngine({ onClose }) {
  const { _t } = useLanguage();

  const [activeTab, setActiveTab] = useState("rules"); // 'rules' or 'ai'
  const {
    contradictions,
    isChecking,
    lastCheck,
    refresh,
    criticalCount,
    highCount,
    mediumCount,
    _totalCount,
  } = useConsistencyCheck();
  const healthStatus = getHealthStatus(contradictions);

  // If AI tab is selected, render the AI analyzer
  if (activeTab === "ai") {
    return (
      <ResponsiveModal
        isOpen
        onClose={onClose}
        size="full"
        labelledBy="consistency-engine-title"
        className="!bg-gray-900"
        header={
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h2
                  id="consistency-engine-title"
                  className="text-2xl font-bold"
                >
                  🔍 The Consistency Engine
                </h2>
                {/* Tabs */}
                <div className="flex bg-black/20 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab("rules")}
                    className={`px-4 py-1.5 rounded text-sm font-semibold transition-colors ${
                      activeTab === "rules"
                        ? "bg-white text-purple-700"
                        : "text-white/80 hover:text-white"
                    }`}
                  >
                    📋 Rules Check
                  </button>
                  <button
                    onClick={() => setActiveTab("ai")}
                    className={`px-4 py-1.5 rounded text-sm font-semibold transition-colors ${
                      activeTab === "ai"
                        ? "bg-white text-purple-700"
                        : "text-white/80 hover:text-white"
                    }`}
                  >
                    🤖 AI Analysis
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 text-2xl font-bold"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        }
      >
        <AIConsistencyAnalyzer onBack={() => setActiveTab("rules")} />
      </ResponsiveModal>
    );
  }

  const _getSeverityBadge = (severity) => {
    const badges = {
      critical: { bg: "bg-red-600", text: "CRITICAL", icon: "🚨" },
      high: { bg: "bg-orange-600", text: "HIGH", icon: "⚠️" },
      medium: { bg: "bg-yellow-600", text: "MEDIUM", icon: "⚡" },
    };
    return badges[severity] || badges.medium;
  };

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="2xl"
      labelledBy="consistency-engine-title"
      header={
        <div
          className={`bg-gradient-to-r ${
            healthStatus.color === "green"
              ? "from-green-600 to-green-800"
              : healthStatus.color === "red"
                ? "from-red-600 to-red-800"
                : healthStatus.color === "yellow"
                  ? "from-yellow-600 to-orange-600"
                  : "from-orange-600 to-red-600"
          } text-white p-6`}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h2
                  id="consistency-engine-title"
                  className="text-3xl font-bold"
                >
                  {healthStatus.icon} The Consistency Engine{" "}
                  <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
                    BETA
                  </span>
                </h2>
                {/* Tabs */}
                <div className="flex bg-black/20 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab("rules")}
                    className={`px-4 py-1.5 rounded text-sm font-semibold transition-colors ${
                      activeTab === "rules"
                        ? "bg-white text-gray-800"
                        : "text-white/80 hover:text-white"
                    }`}
                  >
                    📋 Rules
                  </button>
                  <button
                    onClick={() => setActiveTab("ai")}
                    className={`px-4 py-1.5 rounded text-sm font-semibold transition-colors ${
                      activeTab === "ai"
                        ? "bg-white text-gray-800"
                        : "text-white/80 hover:text-white"
                    }`}
                  >
                    🤖 AI Cross-Exam
                  </button>
                </div>
              </div>
              <p className="text-white/90">
                Automated contradiction detection across all your data
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Status Summary */}
          <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-white/75 mb-1">Status</p>
                <p className="text-2xl font-bold">{healthStatus.message}</p>
              </div>
              <div>
                <p className="text-xs text-white/75 mb-1">Critical</p>
                <p className="text-2xl font-bold">{criticalCount}</p>
              </div>
              <div>
                <p className="text-xs text-white/75 mb-1">High Priority</p>
                <p className="text-2xl font-bold">{highCount}</p>
              </div>
              <div>
                <p className="text-xs text-white/75 mb-1">Medium Priority</p>
                <p className="text-2xl font-bold">{mediumCount}</p>
              </div>
            </div>

            {lastCheck && (
              <p className="text-xs text-white/75 mt-3">
                Last checked: {lastCheck.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      }
    >
      {isChecking && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Running consistency checks...
          </p>
        </div>
      )}

      {!isChecking && contradictions.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">✓</div>
          <h3 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
            All Clear!
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No contradictions detected in your data. Your claim packet is
            internally consistent.
          </p>
          <button
            onClick={refresh}
            className="mt-6 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Re-check Now
          </button>
        </div>
      )}

      {!isChecking && contradictions.length > 0 && (
        <>
          {/* Critical Issues First */}
          {criticalCount > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-3">
                🚨 Critical Issues (Fix Immediately)
              </h3>
              <div className="space-y-3">
                {contradictions
                  .filter((c) => c.severity === "critical")
                  .map((contradiction, index) => (
                    <ContradictionCard
                      key={index}
                      contradiction={contradiction}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* High Priority */}
          {highCount > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400 mb-3">
                ⚠️ High Priority Issues
              </h3>
              <div className="space-y-3">
                {contradictions
                  .filter((c) => c.severity === "high")
                  .map((contradiction, index) => (
                    <ContradictionCard
                      key={index}
                      contradiction={contradiction}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Medium Priority */}
          {mediumCount > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-bold text-yellow-600 dark:text-yellow-400 mb-3">
                ⚡ Medium Priority Issues
              </h3>
              <div className="space-y-3">
                {contradictions
                  .filter((c) => c.severity === "medium")
                  .map((contradiction, index) => (
                    <ContradictionCard
                      key={index}
                      contradiction={contradiction}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <div className="text-center mt-6">
            <button
              onClick={refresh}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Re-check for Contradictions
            </button>
          </div>
        </>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-4 rounded">
        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
          💡 Why This Matters:
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
          The VA looks for <strong>any reason to deny</strong>. Internal
          contradictions are their favorite ammunition.
        </p>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>
            • If you say &quot;constant pain&quot; but your logs show gaps,
            they&apos;ll question your credibility
          </li>
          <li>
            • If you say &quot;left knee&quot; in one place and &quot;right
            knee&quot; in another, they&apos;ll deny everything
          </li>
          <li>
            • If you claim you &quot;can&apos;t lift 10 lbs&quot; but logged a
            gym workout, that&apos;s evidence against you
          </li>
        </ul>
      </div>
    </ResponsiveModal>
  );
}

// Contradiction Card Component
function ContradictionCard({ contradiction }) {
  const badge = getSeverityBadge(contradiction.severity);

  function getSeverityBadge(severity) {
    const badges = {
      critical: { bg: "bg-red-600", text: "CRITICAL", icon: "🚨" },
      high: { bg: "bg-orange-600", text: "HIGH", icon: "⚠️" },
      medium: { bg: "bg-yellow-600", text: "MEDIUM", icon: "⚡" },
    };
    return badges[severity] || badges.medium;
  }

  return (
    <div
      className={`border-l-4 ${
        contradiction.severity === "critical"
          ? "border-red-600 bg-red-50 dark:bg-red-900/20"
          : contradiction.severity === "high"
            ? "border-orange-600 bg-orange-50 dark:bg-orange-900/20"
            : "border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20"
      } rounded-lg p-4`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{badge.icon}</span>
          <span
            className={`${badge.bg} text-white text-xs font-bold px-2 py-1 rounded`}
          >
            {badge.text}
          </span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {contradiction.type.replace("_", " ").toUpperCase()}
          </span>
        </div>
      </div>

      {/* Issue */}
      <div className="mb-3">
        <p className="font-semibold text-gray-800 dark:text-white mb-1">
          Contradiction Detected:
        </p>
        <p className="text-gray-700 dark:text-gray-300">
          {contradiction.issue}
        </p>
      </div>

      {/* Locations */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="bg-white dark:bg-gray-800 rounded p-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            Location 1:
          </p>
          <p className="text-sm font-mono text-gray-800 dark:text-white">
            {contradiction.location1}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded p-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            Location 2:
          </p>
          <p className="text-sm font-mono text-gray-800 dark:text-white">
            {contradiction.location2}
          </p>
        </div>
      </div>

      {/* Fix */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 border-blue-300 dark:border-blue-700">
        <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-2">
          <span>🔧</span> How to Fix:
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {contradiction.fix}
        </p>
      </div>
    </div>
  );
}

// Compact Badge for Header
export function ConsistencyBadge({ onClick }) {
  const { totalCount, criticalCount, isChecking } = useConsistencyCheck();
  const healthStatus = getHealthStatus(useConsistencyCheck().contradictions);

  if (isChecking) {
    return (
      <button
        onClick={onClick}
        className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 transition-colors relative"
        aria-label="Running consistency check..."
      >
        <span className="text-lg animate-spin inline-block">⚙️</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors relative ${
        healthStatus.color === "green"
          ? "bg-green-500/20 hover:bg-green-500/40"
          : healthStatus.color === "red"
            ? "bg-red-500/20 hover:bg-red-500/40 animate-pulse"
            : "bg-yellow-500/20 hover:bg-yellow-500/40"
      }`}
      aria-label={healthStatus.message}
    >
      <span className="text-lg">{healthStatus.icon}</span>
      {totalCount > 0 && (
        <span
          className={`absolute -top-1 -right-1 ${
            criticalCount > 0 ? "bg-red-600" : "bg-yellow-600"
          } text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center`}
        >
          {totalCount}
        </span>
      )}
    </button>
  );
}
