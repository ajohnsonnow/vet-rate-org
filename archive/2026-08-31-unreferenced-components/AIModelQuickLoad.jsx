/**
 * Vet-Rate.org - AI Model Quick Load Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Reusable component that provides quick-load buttons for AI models
 * directly in tool modals. Automatically unloads current AI before loading new one.
 *
 * Usage: <AIModelQuickLoad toolId="nexus-builder" onLoadComplete={() => {...}} />
 */

import { useState, useEffect } from "react";
import {
  getAIStatus,
  isDiamondSwarmReady,
  switchAgent,
  initializeSwarm,
} from "../utils/unifiedAIService";
import { SWARM_AGENTS, TOOL_AGENT_MAP } from "../utils/diamondSwarm";

/**
 * Quick load recommended AI model
 */
async function loadRecommendedAgent(
  recommendedAgentId,
  recommendedAgent,
  { setLoading, setError, setAIStatus, onLoadComplete },
) {
  setLoading(true);
  setError(null);

  try {
    // If Warrant Council is already initialized, just switch agents
    if (isDiamondSwarmReady()) {
      // eslint-disable-next-line no-console
      console.log("🎖️ Warrant Council already ready, switching agent...");
      await switchAgent(recommendedAgentId);
    } else {
      // Initialize Warrant Council with the recommended agent
      // eslint-disable-next-line no-console
      console.log(
        `🎖️ Initializing Warrant Council with ${recommendedAgent.name}...`,
      );
      await initializeSwarm(recommendedAgentId, {
        onProgress: (progress) => {
          // eslint-disable-next-line no-console
          console.log(
            `Loading progress: ${progress.message} (${progress.progress}%)`,
          );
        },
        onComplete: () => {
          // eslint-disable-next-line no-console
          console.log(`✅ ${recommendedAgent.name} loaded successfully`);
        },
        onError: (err) => {
          throw err;
        },
      });
    }

    if (onLoadComplete) {
      onLoadComplete(recommendedAgent);
    }

    setAIStatus(getAIStatus());
  } catch (err) {
    console.error("Failed to load AI:", err);
    setError(err.message || "Failed to load AI model");
  } finally {
    setLoading(false);
  }
}

/**
 * AI Model Quick Load Component
 * Shows recommended AI for current tool with one-click load
 *
 * @param {string} toolId - Tool identifier from TOOL_AGENT_MAP
 * @param {function} onLoadComplete - Callback when model loads successfully
 * @param {boolean} compact - Compact mode for smaller spaces
 * @param {boolean} showFullDropdown - Show dropdown with all available models
 */
export default function AIModelQuickLoad({
  toolId,
  onLoadComplete,
  compact = false,
  showFullDropdown = false,
}) {
  const [_aiStatus, setAIStatus] = useState(getAIStatus());
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState(null);

  // Get recommended agent for this tool
  const recommendedAgentId = TOOL_AGENT_MAP[toolId] || "auditor";
  const recommendedAgent = SWARM_AGENTS[recommendedAgentId.toUpperCase()];

  // Update AI status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleQuickLoad = () =>
    loadRecommendedAgent(recommendedAgentId, recommendedAgent, {
      setLoading,
      setError,
      setAIStatus,
      onLoadComplete,
    });

  /**
   * Check if the recommended agent is already loaded
   */
  const isRecommendedLoaded = () => {
    const status = getAIStatus();
    return (
      status.effectiveMode === "swarm" && status.agentId === recommendedAgentId
    );
  };

  // Compact mode - just a button
  if (compact) {
    return (
      <QuickLoadCompactButton
        recommendedAgent={recommendedAgent}
        loading={loading}
        loaded={isRecommendedLoaded()}
        onLoad={handleQuickLoad}
      />
    );
  }

  // Full mode with info card
  return (
    <QuickLoadFullCard
      recommendedAgent={recommendedAgent}
      recommendedAgentId={recommendedAgentId}
      loading={loading}
      error={error}
      loaded={isRecommendedLoaded()}
      onLoad={handleQuickLoad}
      showFullDropdown={showFullDropdown}
      showDropdown={showDropdown}
      setShowDropdown={setShowDropdown}
      onLoadComplete={onLoadComplete}
      setLoading={setLoading}
      setError={setError}
    />
  );
}

function QuickLoadCompactButton({ recommendedAgent, loading, loaded, onLoad }) {
  return (
    <div className="flex items-center gap-2">
      {loaded ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">
          <span>{recommendedAgent.icon}</span>
          <span className="font-medium">Ready</span>
        </div>
      ) : (
        <button
          onClick={onLoad}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <span>{recommendedAgent.icon}</span>
              <span>Load AI</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

function QuickLoadInfoCard({ recommendedAgent, error }) {
  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{recommendedAgent.icon}</span>
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white">
            Recommended AI for This Tool
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {recommendedAgent.name}
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {recommendedAgent.description}
      </p>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1 mb-3">
        {recommendedAgent.capabilities.slice(0, 3).map((capability, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs rounded-full"
          >
            {capability}
          </span>
        ))}
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}

function QuickLoadActionColumn({
  recommendedAgent,
  loading,
  loaded,
  onLoad,
  showFullDropdown,
  showDropdown,
  setShowDropdown,
}) {
  return (
    <div className="flex flex-col gap-2">
      {loaded ? (
        <div className="flex flex-col items-center gap-2 px-4 py-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg">
          <span className="text-2xl">✅</span>
          <span className="font-bold text-sm">Ready!</span>
        </div>
      ) : (
        <button
          onClick={onLoad}
          disabled={loading}
          className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all flex flex-col items-center gap-1 min-w-[120px] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
        >
          {loading ? (
            <>
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading...</span>
            </>
          ) : (
            <>
              <span className="text-2xl">{recommendedAgent.icon}</span>
              <span className="text-sm">Quick Load</span>
            </>
          )}
        </button>
      )}

      {showFullDropdown && (
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs transition-colors"
        >
          Other Models
        </button>
      )}
    </div>
  );
}

async function selectAlternativeAgent(
  agent,
  { setLoading, setError, onLoadComplete, setShowDropdown },
) {
  setLoading(true);
  setError(null);
  try {
    // If Warrant Council is already initialized, just switch agents
    if (isDiamondSwarmReady()) {
      await switchAgent(agent.id);
    } else {
      // Initialize with the selected agent
      await initializeSwarm(agent.id, {
        onProgress: (progress) =>
          // eslint-disable-next-line no-console
          console.log(progress.message),
        onComplete: () =>
          // eslint-disable-next-line no-console
          console.log(`✅ ${agent.name} loaded`),
        onError: (err) => {
          throw err;
        },
      });
    }
    if (onLoadComplete) onLoadComplete(agent);
    setShowDropdown(false);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

function AlternativeAgentsDropdown({
  recommendedAgentId,
  loading,
  setLoading,
  setError,
  onLoadComplete,
  setShowDropdown,
}) {
  return (
    <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
        Alternative Warrant Council Agents:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.values(SWARM_AGENTS)
          .filter((agent) => agent.id !== recommendedAgentId)
          .map((agent) => (
            <button
              key={agent.id}
              onClick={() =>
                selectAlternativeAgent(agent, {
                  setLoading,
                  setError,
                  onLoadComplete,
                  setShowDropdown,
                })
              }
              disabled={loading}
              className="p-2 bg-white dark:bg-gray-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-gray-200 dark:border-gray-700 rounded-lg text-center transition-colors disabled:opacity-50"
            >
              <span className="text-xl block mb-1">{agent.icon}</span>
              <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                {agent.name.replace("Diamond ", "")}
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}

function QuickLoadFullCard({
  recommendedAgent,
  recommendedAgentId,
  loading,
  error,
  loaded,
  onLoad,
  showFullDropdown,
  showDropdown,
  setShowDropdown,
  onLoadComplete,
  setLoading,
  setError,
}) {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <QuickLoadInfoCard recommendedAgent={recommendedAgent} error={error} />

        <QuickLoadActionColumn
          recommendedAgent={recommendedAgent}
          loading={loading}
          loaded={loaded}
          onLoad={onLoad}
          showFullDropdown={showFullDropdown}
          showDropdown={showDropdown}
          setShowDropdown={setShowDropdown}
        />
      </div>

      {/* Dropdown for other models */}
      {showFullDropdown && showDropdown && (
        <AlternativeAgentsDropdown
          recommendedAgentId={recommendedAgentId}
          loading={loading}
          setLoading={setLoading}
          setError={setError}
          onLoadComplete={onLoadComplete}
          setShowDropdown={setShowDropdown}
        />
      )}
    </div>
  );
}
