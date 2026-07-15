/**
 * Vet-Rate.org - Appeals Lane Advisor
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Helps veterans choose the right appeals lane based on their situation.
 * Data from 2025 VA analysis and BVA decision patterns.
 */

import { useState, useMemo } from "react";
import {
  APPEALS_LANE_DATA,
  EFFECTIVE_DATE_RULES,
} from "../data/bvaSuccessData";
import ResponsiveModal from "./common/ResponsiveModal";

// Visual styling per recommended lane. Any lane not listed (e.g.
// "gatherEvidence") falls back to DEFAULT_LANE_STYLE.
const LANE_STYLES = {
  supplementalClaim: {
    border: "border-green-500 bg-green-50 dark:bg-green-900/30",
    icon: "🚀",
  },
  higherLevelReview: {
    border: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30",
    icon: "⚖️",
  },
  boardAppeal: {
    border: "border-purple-500 bg-purple-50 dark:bg-purple-900/30",
    icon: "🏛️",
  },
};
const DEFAULT_LANE_STYLE = {
  border: "border-amber-500 bg-amber-50 dark:bg-amber-900/30",
  icon: "📋",
};

function computeRecommendation(answers) {
  const {
    hasNewEvidence,
    raterMadeError,
    timeSinceDenial,
    complexity,
    priorAppeals,
  } = answers;

  // Not enough answers yet
  if (hasNewEvidence === null) return null;

  // Decision tree
  if (hasNewEvidence === "yes") {
    return {
      lane: "supplementalClaim",
      confidence: "HIGH",
      reasoning: [
        "You have NEW evidence - this is the fastest lane",
        "Supplemental Claims averaging just 64 days (Nov 2025)",
        "VA crushed the backlog - 39.5% reduction in 2025",
        timeSinceDenial === "under1year"
          ? "✓ Filing within 1 year preserves your original effective date!"
          : "⚠️ Over 1 year since denial - you'll lose back pay for the gap",
      ],
      action: "File Supplemental Claim with your new evidence ASAP",
      warning:
        hasNewEvidence === "yes" && answers.evidenceType === "noNexus"
          ? "Consider getting a nexus letter - new records alone show current status but don't prove service connection"
          : null,
    };
  }

  if (raterMadeError === "yes") {
    return {
      lane: "higherLevelReview",
      confidence: "MODERATE",
      reasoning: [
        "HLR is for clear rater errors with existing evidence",
        "Only 18-20% success rate - most denials aren't rater errors",
        "Processing: ~140 days average",
        "Cannot add ANY new evidence or it gets kicked out",
      ],
      action: "File HLR pointing out the specific error",
      warning:
        "If the rater didn't make an error but you just disagree with the decision, HLR won't help. You need new evidence → Supplemental Claim.",
    };
  }

  if (hasNewEvidence === "no" && raterMadeError === "no") {
    return {
      lane: "gatherEvidence",
      confidence: "HIGH",
      reasoning: [
        "You need NEW evidence before filing any appeal",
        "Resubmitting the same evidence = probable denial",
        "Focus on getting: private nexus letter, buddy statements, new medical records",
      ],
      action: "Gather new evidence FIRST, then file Supplemental Claim",
      warning:
        "Don't file anything yet - gather evidence first. File Intent to File NOW to lock your effective date while you prepare.",
    };
  }

  if (complexity === "high" || priorAppeals >= 2) {
    return {
      lane: "boardAppeal",
      confidence: "MODERATE",
      reasoning: [
        "Complex cases or multiple prior denials may benefit from BVA review",
        "Judges review everything more thoroughly than RO raters",
        "Real timeline: 35.5 months average (not 12-18 VA claims)",
        "28% of cases get remanded - adds another 2+ years",
      ],
      action: "Consider Board Appeal, but prepare for 2-3+ year timeline",
      warning:
        "This is the slow lane. Only use if other options exhausted or you have legal issues that need a judge.",
    };
  }

  return null;
}

function AppealsLaneHeader({ onClose }) {
  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-cyan-600 p-4 text-white">
      <div>
        <h2
          id="appeals-lane-title"
          className="text-xl font-bold flex items-center gap-2"
        >
          🛤️ Appeals Lane Advisor
        </h2>
        <p className="text-blue-100 text-sm">
          Choose the right path for your situation
        </p>
      </div>
      {/* mr-20 keeps the close button clear of the fixed Quick Exit
          panic button on phones (WCAG 2.5.8 target collision) */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="mr-20 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-2xl text-white hover:text-blue-200 sm:mr-0"
      >
        ×
      </button>
    </div>
  );
}

function StatsBanner() {
  return (
    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">📊</span>
        <span className="font-bold text-green-800 dark:text-green-300">
          2025 Was Record-Breaking
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div>
          <div className="text-2xl font-bold text-green-600">3M+</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Claims Completed
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">120 days</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Avg Processing
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">-60%</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Backlog Reduction
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">64 days</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Supplemental Avg
          </div>
        </div>
      </div>
    </div>
  );
}

function NewEvidenceQuestion({ value, onAnswer }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
        1. Do you have NEW evidence that wasn&apos;t in your original claim?
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        NEW means: nexus letter dated after denial, medical records dated after
        denial, buddy statements not previously submitted
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => onAnswer("yes")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            value === "yes"
              ? "bg-green-600 text-white"
              : "bg-gray-200 dark:bg-gray-600 hover:bg-green-100 dark:hover:bg-green-800"
          }`}
        >
          ✓ Yes, I have new evidence
        </button>
        <button
          onClick={() => onAnswer("no")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            value === "no"
              ? "bg-red-600 text-white"
              : "bg-gray-200 dark:bg-gray-600 hover:bg-red-100 dark:hover:bg-red-800"
          }`}
        >
          ✗ No new evidence yet
        </button>
      </div>
    </div>
  );
}

function EvidenceTypeQuestion({ value, onSelect }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
        2. What type of new evidence do you have?
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
          {
            id: "nexus",
            label: "Private nexus letter/IMO",
            icon: "📋",
          },
          { id: "records", label: "New medical records", icon: "🏥" },
          { id: "buddy", label: "Buddy statements", icon: "👥" },
          {
            id: "noNexus",
            label: "Records but no nexus letter",
            icon: "⚠️",
          },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className={`p-3 rounded-lg text-left transition-colors ${
              value === opt.id
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 hover:border-blue-400"
            }`}
          >
            <span className="mr-2">{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RaterErrorQuestion({ value, onAnswer }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
        2. Did the VA rater make a clear error?
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Error means: ignored evidence IN your file, misread medical evidence,
        math error, failed duty to assist
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => onAnswer("yes")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            value === "yes"
              ? "bg-yellow-600 text-white"
              : "bg-gray-200 dark:bg-gray-600 hover:bg-yellow-100"
          }`}
        >
          Yes, clear error
        </button>
        <button
          onClick={() => onAnswer("no")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            value === "no"
              ? "bg-red-600 text-white"
              : "bg-gray-200 dark:bg-gray-600 hover:bg-red-100"
          }`}
        >
          No, I just disagree
        </button>
      </div>
    </div>
  );
}

function TimeSinceDenialQuestion({ value, onAnswer }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
        3. How long since your denial?
      </h3>
      <div className="flex gap-3">
        <button
          onClick={() => onAnswer("under1year")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            value === "under1year"
              ? "bg-green-600 text-white"
              : "bg-gray-200 dark:bg-gray-600 hover:bg-green-100"
          }`}
        >
          Under 1 year ✓
        </button>
        <button
          onClick={() => onAnswer("over1year")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            value === "over1year"
              ? "bg-orange-600 text-white"
              : "bg-gray-200 dark:bg-gray-600 hover:bg-orange-100"
          }`}
        >
          Over 1 year ⚠️
        </button>
      </div>
    </div>
  );
}

function RecommendationHeader({ recommendation, laneData, laneStyle }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-3xl">{laneStyle.icon}</span>
      <div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">
          {laneData?.label || "Gather Evidence First"}
        </div>
        <div
          className={`text-sm font-medium ${
            recommendation.confidence === "HIGH"
              ? "text-green-600"
              : "text-yellow-600"
          }`}
        >
          {recommendation.confidence} confidence recommendation
        </div>
      </div>
    </div>
  );
}

function RecommendationReasoning({ reasoning }) {
  return (
    <div className="space-y-2 mb-4">
      {reasoning.map((reason, idx) => (
        <div
          key={idx}
          className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
        >
          <span className="text-gray-400">→</span>
          {reason}
        </div>
      ))}
    </div>
  );
}

function LaneTimelineStats({ laneData }) {
  if (!laneData) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 grid grid-cols-2 gap-4 text-sm">
      <div>
        <div className="text-gray-500 dark:text-gray-400">Timeline</div>
        <div className="font-semibold text-gray-900 dark:text-white">
          {laneData.actualTimeline || laneData.officialTimeline}
        </div>
      </div>
      <div>
        <div className="text-gray-500 dark:text-gray-400">Success Rate</div>
        <div className="font-semibold text-gray-900 dark:text-white">
          {laneData.favorableRate}%
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation, laneData }) {
  const laneStyle = LANE_STYLES[recommendation.lane] || DEFAULT_LANE_STYLE;

  return (
    <div className={`p-5 rounded-xl border-2 ${laneStyle.border}`}>
      <RecommendationHeader
        recommendation={recommendation}
        laneData={laneData}
        laneStyle={laneStyle}
      />

      <RecommendationReasoning reasoning={recommendation.reasoning} />

      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-3">
        <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">
          📍 Your Action:
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {recommendation.action}
        </div>
      </div>

      {recommendation.warning && (
        <div className="bg-amber-100 dark:bg-amber-900/50 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
          ⚠️ {recommendation.warning}
        </div>
      )}

      <LaneTimelineStats laneData={laneData} />
    </div>
  );
}

function LaneComparisonRow({ laneKey, lane }) {
  return (
    <div
      key={laneKey}
      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="font-semibold text-gray-900 dark:text-white">
          {lane.label}
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-bold ${
            lane.favorableRate >= 50
              ? "bg-green-200 text-green-800"
              : "bg-yellow-200 text-yellow-800"
          }`}
        >
          {lane.favorableRate}% success
        </span>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {lane.requirement}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Official: </span>
          <span className="text-gray-700 dark:text-gray-300">
            {lane.officialTimeline}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Actual: </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {lane.actualTimeline}
          </span>
        </div>
      </div>
      <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
        💡 {lane.tip}
      </div>
    </div>
  );
}

function LaneComparisonSection({ showTimelines, onToggle }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
      >
        {showTimelines ? "▼ Hide" : "▶ Show"} All Appeals Lanes Comparison
      </button>

      {showTimelines && (
        <div className="mt-4 space-y-3">
          {Object.entries(APPEALS_LANE_DATA).map(([key, lane]) => (
            <LaneComparisonRow key={key} laneKey={key} lane={lane} />
          ))}
        </div>
      )}
    </div>
  );
}

function WithinYearExample() {
  return (
    <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
      <h5 className="font-semibold text-green-700 dark:text-green-300 mb-2">
        ✓ File Within 1 Year
      </h5>
      <div className="text-sm text-green-600 dark:text-green-400 space-y-1">
        <div>
          Original: {EFFECTIVE_DATE_RULES.withinOneYear.example.originalFiled}
        </div>
        <div>Denied: {EFFECTIVE_DATE_RULES.withinOneYear.example.denied}</div>
        <div>
          Supplemental:{" "}
          {EFFECTIVE_DATE_RULES.withinOneYear.example.supplementalFiled}
        </div>
        <div className="font-bold">
          Effective Date:{" "}
          {EFFECTIVE_DATE_RULES.withinOneYear.example.effectiveDate}
        </div>
      </div>
    </div>
  );
}

function AfterYearExample() {
  return (
    <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
      <h5 className="font-semibold text-red-700 dark:text-red-300 mb-2">
        ✗ File After 1 Year
      </h5>
      <div className="text-sm text-red-600 dark:text-red-400 space-y-1">
        <div>
          Original: {EFFECTIVE_DATE_RULES.afterOneYear.example.originalFiled}
        </div>
        <div>Denied: {EFFECTIVE_DATE_RULES.afterOneYear.example.denied}</div>
        <div>
          Supplemental:{" "}
          {EFFECTIVE_DATE_RULES.afterOneYear.example.supplementalFiled}
        </div>
        <div className="font-bold">
          Effective Date:{" "}
          {EFFECTIVE_DATE_RULES.afterOneYear.example.effectiveDate}
        </div>
      </div>
    </div>
  );
}

function EffectiveDateSection({ showEffectiveDate, onToggle }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
      >
        {showEffectiveDate ? "▼ Hide" : "▶ Show"} Critical: Effective Date Rules
      </button>

      {showEffectiveDate && (
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <WithinYearExample />
          <AfterYearExample />
        </div>
      )}
    </div>
  );
}

function QuestionFlow({ answers, setAnswers }) {
  return (
    <div className="space-y-4">
      <NewEvidenceQuestion
        value={answers.hasNewEvidence}
        onAnswer={(v) => setAnswers((prev) => ({ ...prev, hasNewEvidence: v }))}
      />

      {answers.hasNewEvidence === "yes" && (
        <EvidenceTypeQuestion
          value={answers.evidenceType}
          onSelect={(id) =>
            setAnswers((prev) => ({ ...prev, evidenceType: id }))
          }
        />
      )}

      {answers.hasNewEvidence === "no" && (
        <RaterErrorQuestion
          value={answers.raterMadeError}
          onAnswer={(v) =>
            setAnswers((prev) => ({ ...prev, raterMadeError: v }))
          }
        />
      )}

      {answers.hasNewEvidence === "yes" && (
        <TimeSinceDenialQuestion
          value={answers.timeSinceDenial}
          onAnswer={(v) =>
            setAnswers((prev) => ({ ...prev, timeSinceDenial: v }))
          }
        />
      )}
    </div>
  );
}

const AppealsLaneAdvisor = ({ onClose }) => {
  const [answers, setAnswers] = useState({
    hasNewEvidence: null,
    evidenceType: null,
    raterMadeError: null,
    errorType: null,
    timeSinceDenial: null,
    priorAppeals: null,
    complexity: null,
  });
  const [showTimelines, setShowTimelines] = useState(false);
  const [showEffectiveDate, setShowEffectiveDate] = useState(false);

  const recommendation = useMemo(
    () => computeRecommendation(answers),
    [answers],
  );

  const laneData = recommendation
    ? APPEALS_LANE_DATA[recommendation.lane]
    : null;

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="xl"
      labelledBy="appeals-lane-title"
      header={<AppealsLaneHeader onClose={onClose} />}
    >
      <div className="space-y-6">
        {/* 2025 Stats Banner */}
        <StatsBanner />

        {/* Question Flow */}
        <QuestionFlow answers={answers} setAnswers={setAnswers} />

        {/* Recommendation */}
        {recommendation && (
          <RecommendationCard
            recommendation={recommendation}
            laneData={laneData}
          />
        )}

        {/* Lane Comparison */}
        <LaneComparisonSection
          showTimelines={showTimelines}
          onToggle={() => setShowTimelines(!showTimelines)}
        />

        {/* Effective Date Warning */}
        <EffectiveDateSection
          showEffectiveDate={showEffectiveDate}
          onToggle={() => setShowEffectiveDate(!showEffectiveDate)}
        />
      </div>
    </ResponsiveModal>
  );
};

export default AppealsLaneAdvisor;
