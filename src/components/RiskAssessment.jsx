/**
 * Vet-Rate.org - Poke the Bear Calculator (Risk Assessment)
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * "Risk Assessment" - The single most important DEFENSIVE tool
 * Prevents veterans from losing their ratings by filing unnecessary claims
 *
 * Key Protection Rules:
 * - 5-Year Rule: Rating not stabilized - high risk of reduction
 * - 20-Year Rule: Rating protected by law (38 CFR 3.951)
 * - 100% P&T: Filing can trigger review of ALL conditions
 * - 55+ Age: VA generally exempts from future exams
 */

import { useState, useEffect } from "react";
import ResponsiveModal from "./common/ResponsiveModal";
import { isAnyAIAvailable } from "../utils/unifiedAIService";
import { AIStatusBadge } from "./AIModeSelector";
import { getMyRatings } from "../utils/veteranProfile";
import ReportBugLink from "./ReportBugLink";
import { useRiskAssessment } from "../hooks/useRiskAssessment";
import { useAIRiskAnalysis } from "../hooks/useAIRiskAnalysis";

/**
 * Risk meter visualization — needle position derived from the risk level.
 */
function RiskMeter({ riskLevel }) {
  const positions = {
    PROTECTED: 10,
    LOW: 30,
    MODERATE: 50,
    HIGH: 70,
    CRITICAL: 90,
  };
  const position = positions[riskLevel.level] || 50;

  return (
    <div className="relative pt-8 pb-4">
      {/* Meter Background */}
      <div className="h-8 rounded-full bg-gradient-to-r from-blue-500 via-green-500 via-yellow-500 via-orange-500 to-red-600 relative overflow-hidden">
        {/* Segments */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 border-r border-white/30"></div>
          <div className="flex-1 border-r border-white/30"></div>
          <div className="flex-1 border-r border-white/30"></div>
          <div className="flex-1 border-r border-white/30"></div>
          <div className="flex-1"></div>
        </div>
      </div>

      {/* Needle/Indicator */}
      <div
        className="absolute top-4 w-1 h-12 bg-gray-800 dark:bg-white rounded-full shadow-lg transition-all duration-500"
        style={{ left: `calc(${position}% - 2px)` }}
      >
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="text-2xl">{riskLevel.icon}</span>
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-600 dark:text-gray-400">
        <span>Protected</span>
        <span>Low</span>
        <span>Moderate</span>
        <span>High</span>
        <span>Critical</span>
      </div>
    </div>
  );
}

/**
 * P&T status checkbox row shown under the current-rating inputs.
 */
function PermanentTotalToggle({ isPermanentTotal, setIsPermanentTotal }) {
  return (
    <div className="mt-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
            isPermanentTotal
              ? "bg-orange-600 border-orange-600 text-white"
              : "border-gray-300 dark:border-gray-600"
          }`}
        >
          {isPermanentTotal && (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
        <div>
          <span className="font-medium text-gray-800 dark:text-gray-100">
            I am Permanent & Total (P&T)
          </span>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Check your Rating Decision letter for &quot;Total and
            Permanent&quot; or &quot;No future exams scheduled&quot;
          </p>
        </div>
      </label>
      <button
        onClick={() => setIsPermanentTotal(!isPermanentTotal)}
        className="sr-only"
      >
        Toggle P&T status
      </button>
    </div>
  );
}

/**
 * "Your Current VA Rating" card of the input form.
 */
function CurrentRatingCard({
  currentRating,
  setCurrentRating,
  ratingDate,
  setRatingDate,
  isPermanentTotal,
  setIsPermanentTotal,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
        📊 Your Current VA Rating
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Combined Rating Percentage *
          </label>
          <select
            value={currentRating}
            onChange={(e) => setCurrentRating(e.target.value)}
            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 outline-none"
          >
            <option value="">Select rating...</option>
            {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>
        </div>

        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date Rating Awarded *
          </label>
          <input
            type="date"
            value={ratingDate}
            onChange={(e) => setRatingDate(e.target.value)}
            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 outline-none"
          />
        </div>
      </div>

      <PermanentTotalToggle
        isPermanentTotal={isPermanentTotal}
        setIsPermanentTotal={setIsPermanentTotal}
      />
    </div>
  );
}

/**
 * "Additional Information (Optional)" card of the input form.
 */
function AdditionalInfoCard({
  birthYear,
  setBirthYear,
  proposedClaim,
  setProposedClaim,
  currentConditions,
  setCurrentConditions,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
        📋 Additional Information (Optional)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Your Birth Year
          </label>
          <input
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="e.g., 1975"
            min="1940"
            max="2010"
            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 outline-none"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            For 55+ age protection check
          </p>
        </div>

        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Proposed New Claim
          </label>
          <input
            type="text"
            value={proposedClaim}
            onChange={(e) => setProposedClaim(e.target.value)}
            placeholder="e.g., Toe Pain, Tinnitus"
            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 outline-none"
          />
        </div>
      </div>

      <div className="mt-4">
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Current Service-Connected Conditions
        </label>
        <textarea
          value={currentConditions}
          onChange={(e) => setCurrentConditions(e.target.value)}
          placeholder="List your current rated conditions (e.g., PTSD 70%, Lower Back 20%, Tinnitus 10%)"
          rows={3}
          className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 outline-none resize-none"
        />
      </div>
    </div>
  );
}

/**
 * Risk Assessment input form (pre-analysis state).
 */
function RiskInputForm({
  currentRating,
  setCurrentRating,
  ratingDate,
  setRatingDate,
  isPermanentTotal,
  setIsPermanentTotal,
  birthYear,
  setBirthYear,
  proposedClaim,
  setProposedClaim,
  currentConditions,
  setCurrentConditions,
  onAnalyze,
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Warning Banner */}
      <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-r-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🐻</span>
          <div>
            <h3 className="font-bold text-red-800 dark:text-red-200">
              Don&apos;t Poke the Bear!
            </h3>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">
              <strong>Predatory &quot;consultants&quot;</strong> push veterans
              at 90% to file frivolous claims for 10%, triggering re-evaluations
              that can <strong>DROP their rating to 70% or lower</strong>. This
              tool helps you understand the REAL risks before filing.
            </p>
          </div>
        </div>
      </div>

      <CurrentRatingCard
        currentRating={currentRating}
        setCurrentRating={setCurrentRating}
        ratingDate={ratingDate}
        setRatingDate={setRatingDate}
        isPermanentTotal={isPermanentTotal}
        setIsPermanentTotal={setIsPermanentTotal}
      />

      <AdditionalInfoCard
        birthYear={birthYear}
        setBirthYear={setBirthYear}
        proposedClaim={proposedClaim}
        setProposedClaim={setProposedClaim}
        currentConditions={currentConditions}
        setCurrentConditions={setCurrentConditions}
      />

      {/* Analyze Button */}
      <button
        onClick={onAnalyze}
        disabled={!currentRating || !ratingDate}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
      >
        <span>🎯</span>
        <span>Analyze My Risk</span>
      </button>
    </div>
  );
}

/**
 * Gradient risk-level summary card plus the risk meter.
 */
function RiskOverviewSection({ riskLevel, financialGain }) {
  return (
    <>
      {/* Risk Level Card */}
      <div
        className={`bg-gradient-to-r ${riskLevel.bgClass} rounded-xl p-6 text-white shadow-lg`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{riskLevel.icon}</span>
            <div>
              <p className="text-sm opacity-80">Risk Assessment</p>
              <h2 className="text-3xl font-bold">{riskLevel.level}</h2>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-80">Potential Monthly Gain</p>
            <p className="text-2xl font-bold">${financialGain}</p>
            <p className="text-xs opacity-70">
              if rated 10% higher, no dependents
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/20">
          <p className="text-lg font-medium">{riskLevel.recommendation}</p>
        </div>
      </div>

      {/* Risk Meter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
          Risk Meter
        </h3>
        <RiskMeter riskLevel={riskLevel} />
      </div>
    </>
  );
}

/**
 * A single critical/high risk warning card.
 */
function WarningCard({ warning, tone }) {
  const isCritical = tone === "critical";
  const containerClass = isCritical
    ? "bg-red-50 dark:bg-red-900/30 border-2 border-red-500 rounded-xl p-6"
    : "bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-500 rounded-xl p-6";
  const titleClass = isCritical
    ? "text-lg font-bold text-red-800 dark:text-red-200"
    : "text-lg font-bold text-orange-800 dark:text-orange-200";
  const cfrClass = isCritical
    ? "text-sm text-red-600 dark:text-red-400 mb-2"
    : "text-sm text-orange-600 dark:text-orange-400 mb-2";
  const messageClass = isCritical
    ? "text-red-700 dark:text-red-300"
    : "text-orange-700 dark:text-orange-300";
  const actionClass = isCritical
    ? "mt-2 text-red-800 dark:text-red-200 font-medium"
    : "mt-2 text-orange-800 dark:text-orange-200 font-medium";
  const defaultTitle = isCritical ? "CRITICAL WARNING" : "HIGH RISK";
  const icon = isCritical ? "🚨" : "⚠️";

  return (
    <div className={containerClass}>
      <div className="flex items-start gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <h3 className={titleClass}>{warning.rule?.name || defaultTitle}</h3>
          {warning.rule?.cfr && <p className={cfrClass}>{warning.rule.cfr}</p>}
          <p className={messageClass}>{warning.message}</p>
          {warning.action && <p className={actionClass}>➜ {warning.action}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * "Your Protections" card — renders nothing when there are none.
 */
function ProtectionsSection({ protections }) {
  if (protections.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-700">
        <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
          🛡️ Your Protections
        </h3>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {protections.map((protection, i) => (
          <div key={i} className="p-4">
            <div className="flex items-start gap-3">
              <span
                className={`px-2 py-1 text-xs font-bold rounded ${
                  protection.status === "PROTECTED"
                    ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                    : "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300"
                }`}
              >
                {protection.status}
              </span>
              <div>
                <h4 className="font-semibold text-gray-800 dark:text-gray-100">
                  {protection.rule.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {protection.rule.cfr}
                </p>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  {protection.message}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * "Additional Considerations" card — renders nothing when there are none.
 */
function FactorsSection({ factors }) {
  if (factors.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
        📌 Additional Considerations
      </h3>
      <div className="space-y-3">
        {factors.map((factor, i) => {
          let factorClassName =
            "bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300";
          if (factor.type === "critical") {
            factorClassName =
              "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300";
          } else if (factor.type === "tip") {
            factorClassName =
              "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300";
          }

          return (
            <div key={i} className={`p-3 rounded-lg ${factorClassName}`}>
              <p>{factor.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Summary tile grid (current rating, years rated, P&T status, potential gain).
 */
function SummaryCard({ rating, yearsRated, isPermanentTotal, financialGain }) {
  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
        📊 Summary
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Current Rating
          </p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {rating}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Years Rated
          </p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {yearsRated.toFixed(1)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">P&T Status</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {isPermanentTotal ? "Yes" : "No"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Potential Gain
          </p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            ${financialGain}/mo
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            next 10% tier, no dependents
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable bulleted list card used for AI recommendations / strengthen-claim
 * angles. Renders nothing when there are no items.
 */
function AIBulletList({ title, items, bulletChar, bulletClassName }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
        {title}
      </h4>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-gray-600 dark:text-gray-300"
          >
            <span className={`${bulletClassName} mt-1`}>{bulletChar}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Rendered AI analysis (verdict, summary, recommendations, timing, regenerate).
 */
function AIAnalysisResult({ analysis, onRegenerate }) {
  const verdict = analysis.overallVerdict?.toLowerCase() || "";
  let verdictClassName =
    "bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700";
  if (verdict.includes("proceed")) {
    verdictClassName =
      "bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700";
  } else if (verdict.includes("caution")) {
    verdictClassName =
      "bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700";
  }

  return (
    <div className="space-y-4">
      {/* Overall Verdict */}
      <div className={`p-4 rounded-lg ${verdictClassName}`}>
        <p className="font-bold text-lg">{analysis.overallVerdict}</p>
      </div>

      {/* Risk Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
          📋 Risk Assessment
        </h4>
        <p className="text-gray-600 dark:text-gray-300">
          {analysis.riskSummary}
        </p>
      </div>

      {/* Recommendations */}
      <AIBulletList
        title="💡 Recommendations"
        items={analysis.recommendations}
        bulletChar="•"
        bulletClassName="text-purple-500"
      />

      {/* Strengthen Your Claim */}
      <AIBulletList
        title="💪 Strengthen Your Case"
        items={analysis.strengthenClaim}
        bulletChar="✓"
        bulletClassName="text-green-500"
      />

      {/* Timing Advice */}
      {analysis.timingAdvice && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
            ⏰ Timing Considerations
          </h4>
          <p className="text-gray-600 dark:text-gray-300">
            {analysis.timingAdvice}
          </p>
        </div>
      )}

      {/* Regenerate Button */}
      <div className="text-center pt-2">
        <button
          onClick={onRegenerate}
          className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          🔄 Regenerate Analysis
        </button>
      </div>
    </div>
  );
}

/**
 * AI Strategic Analysis panel — configure notice / spinner / error / result.
 */
function AIStrategicAnalysisPanel({
  analysis,
  status,
  isAnalyzing,
  error,
  onGenerateAI,
}) {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-purple-800 dark:text-purple-200 flex items-center gap-2">
          🤖 AI Strategic Analysis
        </h3>
        {!analysis && !isAnalyzing && status?.available && (
          <button
            onClick={onGenerateAI}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            ✨ Get AI Analysis
          </button>
        )}
      </div>

      {!status?.available && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          <p>Configure AI in settings to get strategic analysis</p>
        </div>
      )}

      {isAnalyzing && (
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full"></div>
          <span className="text-purple-600 dark:text-purple-400 font-medium">
            Analyzing risk factors...
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          <button
            onClick={onGenerateAI}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {analysis && (
        <AIAnalysisResult analysis={analysis} onRegenerate={onGenerateAI} />
      )}
    </div>
  );
}

/**
 * Final "DO NOT FILE" warning shown for 100% P&T veterans — renders nothing
 * otherwise.
 */
function FinalPTWarning({ isPermanentTotal, rating, proposedClaim }) {
  if (!isPermanentTotal || rating < 100) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-6 text-white">
      <div className="flex items-start gap-4">
        <span className="text-4xl">⛔</span>
        <div>
          <h3 className="text-xl font-bold mb-2">
            STRONG RECOMMENDATION: DO NOT FILE
          </h3>
          <p className="text-red-100">
            You are at 100% Permanent & Total. Filing for &quot;
            {proposedClaim || "a new condition"}&quot; provides{" "}
            <strong>$0 in additional monthly compensation</strong> but risks
            triggering a review of ALL your conditions. The financial gain is
            zero, but the risk is total.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Risk Assessment results panel (post-analysis state).
 */
function RiskResultsPanel({
  riskAssessment,
  isPermanentTotal,
  proposedClaim,
  aiAnalysis,
  aiStatus,
  isAnalyzingWithAI,
  aiError,
  onGenerateAI,
  onReset,
}) {
  const {
    riskLevel,
    protections,
    warnings,
    factors,
    financialGain,
    yearsRated,
    rating,
  } = riskAssessment;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <RiskOverviewSection
        riskLevel={riskLevel}
        financialGain={financialGain}
      />

      {warnings
        .filter((w) => w.severity === "critical")
        .map((warning, i) => (
          <WarningCard key={i} warning={warning} tone="critical" />
        ))}

      {warnings
        .filter((w) => w.severity === "high")
        .map((warning, i) => (
          <WarningCard key={i} warning={warning} tone="high" />
        ))}

      <ProtectionsSection protections={protections} />

      <FactorsSection factors={factors} />

      <SummaryCard
        rating={rating}
        yearsRated={yearsRated}
        isPermanentTotal={isPermanentTotal}
        financialGain={financialGain}
      />

      <AIStrategicAnalysisPanel
        analysis={aiAnalysis}
        status={aiStatus}
        isAnalyzing={isAnalyzingWithAI}
        error={aiError}
        onGenerateAI={onGenerateAI}
      />

      <FinalPTWarning
        isPermanentTotal={isPermanentTotal}
        rating={rating}
        proposedClaim={proposedClaim}
      />

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onReset}
          className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          🔄 Start Over
        </button>
        <button
          onClick={() => window.print()}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          🖨️ Print Results
        </button>
      </div>
    </div>
  );
}

/**
 * Modal header — title, AI status badge, bug report link, close button.
 */
function RiskAssessmentHeader({ onClose, onReportBug, onOpenAISettings }) {
  return (
    <div className="flex-shrink-0 bg-gradient-to-r from-orange-600 to-red-600 p-4 shadow-lg rounded-t-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🐻</span>
          <div>
            <h2
              id="risk-assessment-title"
              className="text-xl font-bold text-white flex items-center gap-2"
            >
              Poke the Bear Calculator
              <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded">
                AI
              </span>
              <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
                BETA
              </span>
            </h2>
            <p className="text-sm text-orange-100">
              Risk Assessment Before Filing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
          {onReportBug && (
            <ReportBugLink
              onClick={onReportBug}
              variant="light"
              moduleName="Risk Assessment (Poke the Bear)"
            />
          )}
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pre-analysis informational banners (educational, AI-required, My Packet).
 * Renders nothing once results are showing.
 */
function RiskAssessmentNotices({ showResults, savedRatings }) {
  if (showResults) {
    return null;
  }

  return (
    <>
      {/* Educational Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📚</span>
          <div>
            <h3 className="font-bold text-amber-800 dark:text-amber-200">
              Know Your Rights
            </h3>
            <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
              VA ratings have legal protections under <strong>38 CFR</strong>.
              The longer your rating has been in effect, the harder it is to
              reduce. This tool checks your protection status before you file.
            </p>
          </div>
        </div>
      </div>

      {/* AI Required Warning */}
      {!isAnyAIAvailable() && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="font-bold text-amber-800 dark:text-amber-200">
                AI Required for Analysis
              </h3>
              <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                Click the <strong>AI Status button</strong> in the header above
                to load your secure Local AI (100% private) or enter your Gemini
                API key.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* My Packet Integration */}
      {savedRatings.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📦</span>
            <div className="flex-1">
              <h3 className="font-bold text-blue-800 dark:text-blue-200">
                Loaded from My Packet
              </h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                Found {savedRatings.length} saved ratings. Your conditions have
                been auto-populated below.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {savedRatings.slice(0, 5).map((r, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs rounded"
                  >
                    {r.name || r.bodyPart} {r.rating}%
                  </span>
                ))}
                {savedRatings.length > 5 && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs rounded">
                    +{savedRatings.length - 5} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Modal body — pre-analysis notices plus either the input form or results
 * panel, depending on whether an assessment has been run yet.
 */
function RiskAssessmentBody({
  showResults,
  savedRatings,
  riskAssessment,
  isPermanentTotal,
  proposedClaim,
  aiAnalysis,
  aiStatus,
  isAnalyzingWithAI,
  aiError,
  onGenerateAI,
  onReset,
  currentRating,
  setCurrentRating,
  ratingDate,
  setRatingDate,
  setIsPermanentTotal,
  birthYear,
  setBirthYear,
  setProposedClaim,
  currentConditions,
  setCurrentConditions,
  onAnalyze,
}) {
  return (
    <div>
      <RiskAssessmentNotices
        showResults={showResults}
        savedRatings={savedRatings}
      />

      {/* Content */}
      {showResults ? (
        <RiskResultsPanel
          riskAssessment={riskAssessment}
          isPermanentTotal={isPermanentTotal}
          proposedClaim={proposedClaim}
          aiAnalysis={aiAnalysis}
          aiStatus={aiStatus}
          isAnalyzingWithAI={isAnalyzingWithAI}
          aiError={aiError}
          onGenerateAI={onGenerateAI}
          onReset={onReset}
        />
      ) : (
        <RiskInputForm
          currentRating={currentRating}
          setCurrentRating={setCurrentRating}
          ratingDate={ratingDate}
          setRatingDate={setRatingDate}
          isPermanentTotal={isPermanentTotal}
          setIsPermanentTotal={setIsPermanentTotal}
          birthYear={birthYear}
          setBirthYear={setBirthYear}
          proposedClaim={proposedClaim}
          setProposedClaim={setProposedClaim}
          currentConditions={currentConditions}
          setCurrentConditions={setCurrentConditions}
          onAnalyze={onAnalyze}
        />
      )}
    </div>
  );
}

// My Packet integration - load saved rated conditions on mount, and
// auto-populate current conditions from them if available.
function useSavedRatings(currentConditions, setCurrentConditions) {
  const [savedRatings, setSavedRatings] = useState([]);

  useEffect(() => {
    const ratings = getMyRatings();
    setSavedRatings(ratings || []);
    // Auto-populate current conditions if available
    if (ratings && ratings.length > 0 && !currentConditions) {
      const conditionsList = ratings
        .map((r) => `${r.name || r.bodyPart} ${r.rating}%`)
        .join(", ");
      setCurrentConditions(conditionsList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return savedRatings;
}

function createFormHandlers({
  currentRating,
  ratingDate,
  setCurrentRating,
  setRatingDate,
  setIsPermanentTotal,
  setBirthYear,
  setProposedClaim,
  setCurrentConditions,
  setShowResults,
  setAIAnalysis,
  setAIError,
}) {
  const handleAnalyze = () => {
    if (!currentRating || !ratingDate) {
      return;
    }
    setShowResults(true);
    setAIAnalysis(null); // Reset AI analysis for new assessment
  };

  const handleReset = () => {
    setCurrentRating("");
    setRatingDate("");
    setIsPermanentTotal(false);
    setBirthYear("");
    setProposedClaim("");
    setCurrentConditions("");
    setShowResults(false);
    setAIAnalysis(null);
    setAIError(null);
  };

  return { handleAnalyze, handleReset };
}

function useRiskAssessmentController({
  currentRating,
  ratingDate,
  isPermanentTotal,
  birthYear,
  currentConditions,
  proposedClaim,
  setCurrentRating,
  setRatingDate,
  setIsPermanentTotal,
  setBirthYear,
  setProposedClaim,
  setCurrentConditions,
  setShowResults,
}) {
  const riskAssessment = useRiskAssessment(
    currentRating,
    ratingDate,
    isPermanentTotal,
    birthYear,
  );

  const {
    aiStatus,
    aiAnalysis,
    isAnalyzingWithAI,
    aiError,
    generateAIRiskAnalysis,
    setAIAnalysis,
    setAIError,
  } = useAIRiskAnalysis({
    currentRating,
    ratingDate,
    isPermanentTotal,
    currentConditions,
    proposedClaim,
    riskAssessment,
  });

  const { handleAnalyze, handleReset } = createFormHandlers({
    currentRating,
    ratingDate,
    setCurrentRating,
    setRatingDate,
    setIsPermanentTotal,
    setBirthYear,
    setProposedClaim,
    setCurrentConditions,
    setShowResults,
    setAIAnalysis,
    setAIError,
  });

  return {
    riskAssessment,
    aiStatus,
    aiAnalysis,
    isAnalyzingWithAI,
    aiError,
    generateAIRiskAnalysis,
    handleAnalyze,
    handleReset,
  };
}

export default function RiskAssessment({
  onClose,
  onReportBug,
  onOpenAISettings,
}) {
  // Input state
  const [currentRating, setCurrentRating] = useState("");
  const [ratingDate, setRatingDate] = useState("");
  const [isPermanentTotal, setIsPermanentTotal] = useState(false);
  const [birthYear, setBirthYear] = useState("");
  const [proposedClaim, setProposedClaim] = useState("");
  const [currentConditions, setCurrentConditions] = useState("");

  // Result state
  const [showResults, setShowResults] = useState(false);

  const savedRatings = useSavedRatings(currentConditions, setCurrentConditions);

  const {
    riskAssessment,
    aiStatus,
    aiAnalysis,
    isAnalyzingWithAI,
    aiError,
    generateAIRiskAnalysis,
    handleAnalyze,
    handleReset,
  } = useRiskAssessmentController({
    currentRating,
    ratingDate,
    isPermanentTotal,
    birthYear,
    currentConditions,
    proposedClaim,
    setCurrentRating,
    setRatingDate,
    setIsPermanentTotal,
    setBirthYear,
    setProposedClaim,
    setCurrentConditions,
    setShowResults,
  });

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="2xl"
      labelledBy="risk-assessment-title"
      header={
        <RiskAssessmentHeader
          onClose={onClose}
          onReportBug={onReportBug}
          onOpenAISettings={onOpenAISettings}
        />
      }
    >
      <RiskAssessmentBody
        showResults={showResults}
        savedRatings={savedRatings}
        riskAssessment={riskAssessment}
        isPermanentTotal={isPermanentTotal}
        proposedClaim={proposedClaim}
        aiAnalysis={aiAnalysis}
        aiStatus={aiStatus}
        isAnalyzingWithAI={isAnalyzingWithAI}
        aiError={aiError}
        onGenerateAI={generateAIRiskAnalysis}
        onReset={handleReset}
        currentRating={currentRating}
        setCurrentRating={setCurrentRating}
        ratingDate={ratingDate}
        setRatingDate={setRatingDate}
        setIsPermanentTotal={setIsPermanentTotal}
        birthYear={birthYear}
        setBirthYear={setBirthYear}
        setProposedClaim={setProposedClaim}
        currentConditions={currentConditions}
        setCurrentConditions={setCurrentConditions}
        onAnalyze={handleAnalyze}
      />
    </ResponsiveModal>
  );
}
