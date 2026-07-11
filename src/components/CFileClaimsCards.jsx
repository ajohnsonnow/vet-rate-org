/**
 * Vet-Rate.org - C-File Claims Cards Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Displays potential claims identified from C-File analysis
 */

import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";

// Likelihood styles
const LIKELIHOOD_STYLES = {
  high: {
    bg: "bg-green-100 dark:bg-green-900/40",
    border: "border-green-500",
    badge: "bg-green-500",
    text: "text-green-800 dark:text-green-200",
  },
  medium: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    border: "border-amber-500",
    badge: "bg-amber-500",
    text: "text-amber-800 dark:text-amber-200",
  },
  low: {
    bg: "bg-red-100 dark:bg-red-900/40",
    border: "border-red-500",
    badge: "bg-red-500",
    text: "text-red-800 dark:text-red-200",
  },
};

const NEXUS_STYLES = {
  strong: { color: "text-green-600 dark:text-green-400", icon: "💪" },
  moderate: { color: "text-amber-600 dark:text-amber-400", icon: "👍" },
  weak: { color: "text-orange-600 dark:text-orange-400", icon: "⚠️" },
  missing: { color: "text-red-600 dark:text-red-400", icon: "❌" },
};

const getQuickStatsDiagnosisIcon = (currentDiagnosis) => {
  if (currentDiagnosis === "yes") return "✅";
  if (currentDiagnosis === "no") return "❌";
  return "❓";
};

const getChecklistDiagnosisIcon = (currentDiagnosis) => {
  if (currentDiagnosis === "yes") return "✅";
  if (currentDiagnosis === "unclear") return "❓";
  return "❌";
};

const getChecklistDiagnosisTextClass = (currentDiagnosis) => {
  if (currentDiagnosis === "yes") return "text-green-700 dark:text-green-300";
  if (currentDiagnosis === "unclear")
    return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
};

const getNexusChecklistIcon = (nexusStrength) => {
  if (nexusStrength === "strong") return "✅";
  if (nexusStrength === "moderate") return "⚠️";
  return "❌";
};

const getNexusChecklistTextClass = (nexusStrength) => {
  if (nexusStrength === "strong") return "text-green-700 dark:text-green-300";
  if (nexusStrength === "moderate")
    return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
};

const ClaimSummaryStats = ({ counts, filter, setFilter }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
    <div
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${filter === "high" ? "ring-2 ring-green-500" : ""} ${LIKELIHOOD_STYLES.high.bg} ${LIKELIHOOD_STYLES.high.border}`}
      onClick={() => setFilter(filter === "high" ? "all" : "high")}
    >
      <div className="text-3xl font-bold text-green-700 dark:text-green-300">
        {counts.high}
      </div>
      <div className="text-sm text-green-600 dark:text-green-400">
        High Likelihood
      </div>
      <div className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
        Strong evidence found
      </div>
    </div>

    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
    <div
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${filter === "medium" ? "ring-2 ring-amber-500" : ""} ${LIKELIHOOD_STYLES.medium.bg} ${LIKELIHOOD_STYLES.medium.border}`}
      onClick={() => setFilter(filter === "medium" ? "all" : "medium")}
    >
      <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
        {counts.medium}
      </div>
      <div className="text-sm text-amber-600 dark:text-amber-400">
        Medium Likelihood
      </div>
      <div className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
        Needs more evidence
      </div>
    </div>

    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
    <div
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${filter === "low" ? "ring-2 ring-red-500" : ""} ${LIKELIHOOD_STYLES.low.bg} ${LIKELIHOOD_STYLES.low.border}`}
      onClick={() => setFilter(filter === "low" ? "all" : "low")}
    >
      <div className="text-3xl font-bold text-red-700 dark:text-red-300">
        {counts.low}
      </div>
      <div className="text-sm text-red-600 dark:text-red-400">
        Low Likelihood
      </div>
      <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
        Significant gaps
      </div>
    </div>
  </div>
);

const ClaimCardQuickStats = ({ claim, nexusStyle }) => (
  <div className="flex items-center gap-4 mt-3 text-sm">
    <div className="flex items-center gap-1">
      <span className={nexusStyle.icon}></span>
      <span className={nexusStyle.color}>
        Nexus: {claim.nexusStrength || "Unknown"}
      </span>
    </div>

    <div className="flex items-center gap-1">
      {getQuickStatsDiagnosisIcon(claim.currentDiagnosis)}
      <span className="text-gray-600 dark:text-gray-400">
        Current Dx: {claim.currentDiagnosis || "Unknown"}
      </span>
    </div>
  </div>
);

const ClaimCardHeader = ({ claim, style, nexusStyle, isExpanded, onToggle }) => (
  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
  <div className="p-4 cursor-pointer" onClick={onToggle}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className={`text-lg font-bold ${style.text}`}>
            {claim.condition}
          </h4>
          {claim.diagnosticCode && (
            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-mono">
              DC {claim.diagnosticCode}
            </span>
          )}
        </div>

        {claim.inServiceEvent && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            📍 {claim.inServiceEvent}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-2">
        <span
          className={`${style.badge} text-white text-xs font-bold px-3 py-1 rounded-full uppercase`}
        >
          {claim.likelihood}
        </span>
        <span className="text-gray-400 dark:text-gray-500 text-sm">
          {isExpanded ? "▲" : "▼"}
        </span>
      </div>
    </div>

    <ClaimCardQuickStats claim={claim} nexusStyle={nexusStyle} />
  </div>
);

const ClaimEvidencePages = ({ pages }) => {
  if (!pages?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
        📄 Evidence Found On:
      </p>
      <div className="flex flex-wrap gap-2">
        {pages.map((page, i) => (
          <span
            key={i}
            className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded text-sm font-mono"
          >
            Page {page}
          </span>
        ))}
      </div>
    </div>
  );
};

const ClaimBigThreeChecklist = ({ claim }) => (
  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
    <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider">
      &quot;The Big Three&quot; Checklist
    </p>
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {claim.inServiceEvent ? "✅" : "❌"}
        <span
          className={
            claim.inServiceEvent
              ? "text-green-700 dark:text-green-300"
              : "text-red-600 dark:text-red-400"
          }
        >
          In-Service Event
        </span>
      </div>
      <div className="flex items-center gap-2">
        {getChecklistDiagnosisIcon(claim.currentDiagnosis)}
        <span className={getChecklistDiagnosisTextClass(claim.currentDiagnosis)}>
          Current Diagnosis
        </span>
      </div>
      <div className="flex items-center gap-2">
        {getNexusChecklistIcon(claim.nexusStrength)}
        <span className={getNexusChecklistTextClass(claim.nexusStrength)}>
          Nexus (Service Connection)
        </span>
      </div>
    </div>
  </div>
);

const ClaimExpandedDetails = ({ claim }) => (
  <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600 pt-4 space-y-4">
    {/* What's Missing */}
    {claim.missing_element && (
      <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
          ⚠️ What&apos;s Missing:
        </p>
        <p className="text-gray-700 dark:text-gray-300">
          {claim.missing_element}
        </p>
      </div>
    )}

    {/* Recommendation */}
    {claim.recommendation && (
      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
          💡 Recommended Action:
        </p>
        <p className="text-blue-800 dark:text-blue-200">
          {claim.recommendation}
        </p>
      </div>
    )}

    <ClaimEvidencePages pages={claim.evidence_pages} />
    <ClaimBigThreeChecklist claim={claim} />
  </div>
);

const ClaimCard = ({ claim, idx, isExpanded, onToggleExpand }) => {
  const style = LIKELIHOOD_STYLES[claim.likelihood] || LIKELIHOOD_STYLES.medium;
  const nexusStyle = NEXUS_STYLES[claim.nexusStrength] || NEXUS_STYLES.missing;

  return (
    <div
      key={idx}
      className={`${style.bg} border-2 ${style.border} rounded-xl overflow-hidden transition-all hover:shadow-lg ${isExpanded ? "md:col-span-2" : ""}`}
    >
      <ClaimCardHeader
        claim={claim}
        style={style}
        nexusStyle={nexusStyle}
        isExpanded={isExpanded}
        onToggle={onToggleExpand}
      />
      {isExpanded && <ClaimExpandedDetails claim={claim} />}
    </div>
  );
};

const ClaimsEmptyState = () => (
  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
    <p className="text-4xl mb-2">🔍</p>
    <p>No potential claims identified.</p>
  </div>
);

const ClaimsInfoBox = () => (
  <div className="mt-8 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
    <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-2">
      📚 Understanding Claim Likelihood
    </h4>
    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
      <li>
        <strong>High:</strong> Strong evidence for all three pillars
        (in-service event, current diagnosis, nexus)
      </li>
      <li>
        <strong>Medium:</strong> Has 1-2 pillars established, needs
        additional evidence or nexus letter
      </li>
      <li>
        <strong>Low:</strong> Significant gaps in evidence, may require
        extensive documentation
      </li>
    </ul>
  </div>
);

export default function CFileClaimsCards({ claims = [] }) {
  const { _t } = useLanguage();
  const [filter, setFilter] = useState("all");
  const [expandedClaim, setExpandedClaim] = useState(null);

  // Sort claims by likelihood (high first)
  const sortedClaims = [...claims].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.likelihood] || 3) - (order[b.likelihood] || 3);
  });

  // Filter claims
  const filteredClaims =
    filter === "all"
      ? sortedClaims
      : sortedClaims.filter((c) => c.likelihood === filter);

  // Count by likelihood
  const counts = {
    high: claims.filter((c) => c.likelihood === "high").length,
    medium: claims.filter((c) => c.likelihood === "medium").length,
    low: claims.filter((c) => c.likelihood === "low").length,
  };

  return (
    <div className="p-6">
      <ClaimSummaryStats counts={counts} filter={filter} setFilter={setFilter} />

      {filter !== "all" && (
        <button
          onClick={() => setFilter("all")}
          className="mb-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Show all claims ({claims.length})
        </button>
      )}

      {/* Claims Grid */}
      {filteredClaims.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredClaims.map((claim, idx) => (
            <ClaimCard
              key={idx}
              claim={claim}
              idx={idx}
              isExpanded={expandedClaim === idx}
              onToggleExpand={() =>
                setExpandedClaim(expandedClaim === idx ? null : idx)
              }
            />
          ))}
        </div>
      ) : (
        <ClaimsEmptyState />
      )}

      <ClaimsInfoBox />
    </div>
  );
}
