/**
 * WarrantCouncilExplainer Component
 * Explains the Warrant Council AI in veteran-friendly terms
 */

import React, { useState } from "react";
import { SWARM_AGENTS } from "../utils/diamondSwarm";

export default function DiamondSwarmExplainer({ variant = "compact" }) {
  const [expanded, setExpanded] = useState(false);

  if (variant === "inline") {
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400 italic">
        🎖️ Three Chief Warrant Officers (CW3-CW5) - Technical experts trained to
        analyze your claim, write statements, and calculate ratings
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-l-4 border-blue-500">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🎖️</span>
            <div>
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                What is Warrant Council?
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Three Chief Warrant Officers (CW3-CW5) that have your back
              </p>
            </div>
          </div>
          <span className="text-blue-600 dark:text-blue-400">
            {expanded ? "▼" : "▶"}
          </span>
        </button>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800 space-y-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Chief Warrant Officers are technical experts in their field -
              across all branches they're the go-to for specialized knowledge.
              Warrant Council has three CWO-level AI agents:
            </p>

            <div className="space-y-3">
              {Object.values(SWARM_AGENTS).map((agent) => (
                <div
                  key={agent.id}
                  className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm"
                >
                  <div className="flex items-start space-x-2">
                    <span className="text-xl">{agent.icon}</span>
                    <div className="flex-1">
                      <h5 className="font-semibold text-gray-900 dark:text-white text-sm">
                        {agent.name}
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {agent.militaryContext}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                        Role: {agent.role}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 mt-4">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Chief Warrant Officer Across Branches:</strong>
              </p>
              <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 space-y-1">
                <li>
                  🪖 <strong>Army/Marines:</strong> CW2-CW5 (Technical
                  specialists)
                </li>
                <li>
                  ✈️ <strong>Air Force:</strong> No warrant officer rank
                </li>
                <li>
                  ⚓ <strong>Navy/Coast Guard:</strong> CWO2-CWO5 (Technical
                  experts)
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full variant - detailed explanation
  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-800">
      <div className="flex items-center space-x-4 mb-6">
        <div className="text-4xl">🎖️</div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            Warrant Council AI
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Three Chief Warrant Officers (CW3-CW5) for Your VA Claim
          </p>
        </div>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
        <p className="text-gray-700 dark:text-gray-300">
          Remember the Chief Warrant Officers in your unit? The technical
          experts who knew their specialty inside-out - the intel CWO who could
          break down any situation, the logistics CWO who kept everything
          running? That's what Warrant Council is - but specialized for VA
          claims.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {Object.values(SWARM_AGENTS).map((agent) => (
          <div
            key={agent.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow"
          >
            <div className="text-3xl mb-3">{agent.icon}</div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {agent.name}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {agent.militaryContext}
            </p>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              <strong>Capabilities:</strong>
              <ul className="mt-2 space-y-1">
                {agent.capabilities.slice(0, 3).map((cap, idx) => (
                  <li key={idx}>• {cap}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
        <h4 className="text-sm font-bold text-yellow-900 dark:text-yellow-100 mb-2">
          First Sergeant Equivalents by Branch (E-8 Level):
        </h4>
        <div className="grid md:grid-cols-2 gap-2 text-xs text-yellow-800 dark:text-yellow-200">
          <div>
            <strong>🪖 Army:</strong> First Sergeant (1SG)
          </div>
          <div>
            <strong>🪖 Marine Corps:</strong> First Sergeant (1stSgt)
          </div>
          <div>
            <strong>✈️ Air Force:</strong> First Sergeant (SMSgt)
          </div>
          <div>
            <strong>✈️ Space Force:</strong> First Sergeant (SMSgt)
          </div>
          <div>
            <strong>⚓ Navy:</strong> Senior Chief Petty Officer (SCPO - SEL)
          </div>
          <div>
            <strong>⚓ Coast Guard:</strong> Senior Chief Petty Officer (SCPO -
            SEL)
          </div>
        </div>
      </div>
    </div>
  );
}
