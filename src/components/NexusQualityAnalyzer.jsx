/**
 * Vet-Rate.org - Nexus Quality Analyzer
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * Analyzes nexus letter quality based on BVA decision patterns.
 * Data-driven recommendations from 18,609 BVA decisions analysis.
 */

import { useState, useMemo } from "react";
import {
  NEXUS_QUALITY_OUTCOMES,
  NEXUS_PROVIDER_OUTCOMES,
  BVA_JUDGE_QUOTES,
  scoreNexusQuality,
} from "../data/bvaSuccessData";
import ResponsiveModal from "./common/ResponsiveModal";

const NexusQualityAnalyzer = ({ onClose }) => {
  const [nexusText, setNexusText] = useState("");
  const [providerType, setProviderType] = useState("");
  const [showJudgeQuotes, setShowJudgeQuotes] = useState(false);

  const analysis = useMemo(() => {
    if (nexusText.length < 50) return null;
    return scoreNexusQuality(nexusText);
  }, [nexusText]);

  const providerData = providerType
    ? NEXUS_PROVIDER_OUTCOMES[providerType]
    : null;

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="xl"
      labelledBy="nexus-quality-title"
      header={
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
          <div>
            <h2
              id="nexus-quality-title"
              className="text-xl font-bold flex items-center gap-2"
            >
              📊 Nexus Quality Analyzer
            </h2>
            <p className="text-indigo-100 text-sm">
              Data from 18,609 BVA decisions
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white hover:text-indigo-200 text-2xl"
          >
            ×
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Provider Type Selection */}
        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Who wrote your nexus opinion?
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(NEXUS_PROVIDER_OUTCOMES).map(([key, data]) => (
              <button
                key={key}
                onClick={() => setProviderType(key)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  providerType === key
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                    : "border-gray-200 dark:border-gray-600 hover:border-indigo-300"
                }`}
              >
                <div className="font-semibold text-gray-900 dark:text-white">
                  {data.label}
                </div>
                <div
                  className={`text-2xl font-bold ${data.grantRate >= 70 ? "text-green-600" : data.grantRate >= 40 ? "text-yellow-600" : "text-orange-600"}`}
                >
                  {data.grantRate}% grant rate
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {data.tip}
                </div>
              </button>
            ))}
          </div>
          {providerData && (
            <div
              className={`mt-3 p-3 rounded-lg ${providerData.grantRate >= 70 ? "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300" : providerData.grantRate >= 40 ? "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" : "bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"}`}
            >
              <strong>BVA Data:</strong> {providerData.label} nexus opinions
              have a {providerData.grantRate}% grant rate (
              {providerData.grantPlusRemand}% when including remands).
              {providerType === "vaExaminer" && (
                <span className="block mt-1 text-sm">
                  💡 Consider supplementing with a private opinion - they grant
                  at 2.5x the rate.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Nexus Text Input */}
        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Paste your nexus opinion text (we analyze it locally - nothing is
            sent anywhere):
          </label>
          <textarea
            value={nexusText}
            onChange={(e) => setNexusText(e.target.value)}
            placeholder="It is at least as likely as not (50% or greater probability) that the veteran's condition is related to..."
            className="w-full h-40 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
          <div className="text-xs text-gray-500 mt-1">
            {nexusText.length} characters • Need at least 50 to analyze
          </div>
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-4">
            {/* Quality Score */}
            <div
              className={`p-4 rounded-lg ${
                analysis.quality === "strong"
                  ? "bg-green-100 dark:bg-green-900/30"
                  : analysis.quality === "adequate"
                    ? "bg-yellow-100 dark:bg-yellow-900/30"
                    : "bg-red-100 dark:bg-red-900/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`text-4xl font-bold ${
                    analysis.quality === "strong"
                      ? "text-green-600"
                      : analysis.quality === "adequate"
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {analysis.score}/100
                </div>
                <div>
                  <div
                    className={`text-lg font-semibold ${
                      analysis.quality === "strong"
                        ? "text-green-700 dark:text-green-400"
                        : analysis.quality === "adequate"
                          ? "text-yellow-700 dark:text-yellow-400"
                          : "text-red-700 dark:text-red-400"
                    }`}
                  >
                    {analysis.quality.toUpperCase()} Nexus Opinion
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {analysis.quality === "strong"
                      ? `${NEXUS_QUALITY_OUTCOMES.strong.grantRate}% grant rate for strong opinions`
                      : analysis.quality === "adequate"
                        ? `${NEXUS_QUALITY_OUTCOMES.adequate.grantRate}% grant rate for adequate opinions`
                        : `Only ${NEXUS_QUALITY_OUTCOMES.weak.grantRate}% grant rate for weak opinions`}
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Checklist */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                Quality Checklist
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(analysis.checks).map(([check, passed]) => (
                  <div
                    key={check}
                    className={`flex items-center gap-2 text-sm ${passed ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    <span>{passed ? "✓" : "✗"}</span>
                    <span>
                      {check === "hasLikelyAsNot" &&
                        'Uses "at least as likely as not"'}
                      {check === "citesMedicalLit" &&
                        "Cites medical literature"}
                      {check === "explainsMechanism" &&
                        "Explains medical mechanism"}
                      {check === "referencesRecords" &&
                        "References service records"}
                      {check === "rulesOutOther" && "Rules out other causes"}
                      {check === "hasRationale" &&
                        "Detailed rationale provided"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {analysis.recommendations.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">
                  🎯 To Strengthen Your Nexus Opinion:
                </h4>
                <ul className="space-y-2">
                  {analysis.recommendations.map((rec, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-200"
                    >
                      <span className="text-amber-500">→</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* BVA Judge Quotes Toggle */}
        <div>
          <button
            onClick={() => setShowJudgeQuotes(!showJudgeQuotes)}
            className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium"
          >
            {showJudgeQuotes ? "▼ Hide" : "▶ Show"} What BVA Judges Say About
            Nexus Opinions
          </button>

          {showJudgeQuotes && (
            <div className="mt-4 space-y-4">
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                <h5 className="font-semibold text-green-700 dark:text-green-300 mb-2">
                  ✓ Winning Language
                </h5>
                {BVA_JUDGE_QUOTES.privateOpinionWins.map((quote, idx) => (
                  <p
                    key={idx}
                    className="text-sm text-green-600 dark:text-green-400 italic mb-2"
                  >
                    {quote}
                  </p>
                ))}
              </div>
              <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
                <h5 className="font-semibold text-red-700 dark:text-red-300 mb-2">
                  ✗ Why Opinions Get Rejected
                </h5>
                {BVA_JUDGE_QUOTES.inadequateExam.map((quote, idx) => (
                  <p
                    key={idx}
                    className="text-sm text-red-600 dark:text-red-400 italic mb-2"
                  >
                    {quote}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Provider Comparison Chart */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
            📈 BVA Grant Rates by Nexus Provider
          </h4>
          <div className="space-y-2">
            {Object.entries(NEXUS_PROVIDER_OUTCOMES).map(([key, data]) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-32 text-sm text-gray-600 dark:text-gray-400">
                  {data.label}
                </div>
                <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-6 relative">
                  <div
                    className={`h-full rounded-full ${data.grantRate >= 70 ? "bg-green-500" : data.grantRate >= 40 ? "bg-yellow-500" : "bg-orange-500"}`}
                    style={{ width: `${data.grantRate}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-900 dark:text-white">
                    {data.grantRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Based on analysis of 8,167 BVA decisions with nexus opinions
            (2023-2025)
          </p>
        </div>
      </div>
    </ResponsiveModal>
  );
};

export default NexusQualityAnalyzer;
