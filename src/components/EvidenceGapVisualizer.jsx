/**
 * Vet-Rate.org - Evidence Gap Visualizer
 * "The Missing Link" - Shows veterans exactly what evidence they're missing
 *
 * This isn't just showing what you HAVE - it's showing what you NEED.
 * The difference between "data display" and "active coaching."
 */

import { useState, useEffect } from "react";
import ResponsiveModal from "./common/ResponsiveModal";
import {
  EVIDENCE_REQUIREMENTS,
  getAvailableConditions,
  analyzeEvidenceGaps,
} from "../data/evidenceRequirements";
import { saveClaim } from "../utils/claimsStorage";
import ReportBugLink from "./ReportBugLink";

function getAvailableRatingsForCondition(conditionId) {
  const data = conditionId ? EVIDENCE_REQUIREMENTS[conditionId] : null;
  return data
    ? Object.keys(data.ratings)
        .map((r) => parseInt(r))
        .sort((a, b) => a - b)
    : [];
}

function computeDefaultRating(conditionId) {
  const condition = EVIDENCE_REQUIREMENTS[conditionId];
  if (!condition) return null;
  // Set default to highest rating that isn't 100
  const ratings = Object.keys(condition.ratings)
    .map((r) => parseInt(r))
    .sort((a, b) => b - a);
  return ratings.find((r) => r < 100 && r >= 30) || ratings[0];
}

function saveGapAnalysis({
  analysis,
  userEvidence,
  savedGapAnalyses,
  setSavedGapAnalyses,
  setSaveStatus,
}) {
  if (!analysis) return;

  const newSave = {
    id: Date.now(),
    date: new Date().toISOString(),
    condition: analysis.condition,
    targetRating: analysis.targetRating,
    completenessPercent: analysis.completenessPercent,
    evidenceFound: userEvidence,
    criticalGaps: analysis.criticalGaps.map((g) => g.label),
  };

  // Save to local gap analyses storage
  const updated = [...savedGapAnalyses, newSave];
  setSavedGapAnalyses(updated);
  localStorage.setItem("vet_rate_gap_analyses", JSON.stringify(updated));

  // Save to My Packet for centralized evidence management
  try {
    const missingGapsSummary =
      analysis.criticalGaps.length > 0
        ? `Missing: ${analysis.criticalGaps.map((g) => g.label).join(", ")}`
        : "All critical evidence gathered!";

    const packetClaim = {
      conditionName: analysis.condition,
      status: analysis.isClaimReady
        ? "Evidence Complete"
        : "Evidence Gathering",
      evidence: [
        {
          type: "Gap Analysis",
          description: `Evidence Gap Analysis for ${analysis.ratingLabel}`,
          targetRating: analysis.targetRating,
          completenessPercent: analysis.completenessPercent,
          evidenceFound: userEvidence.map((id) => {
            const item = analysis.analysis.find((a) => a.id === id);
            return item ? item.label : id;
          }),
          criticalGaps: analysis.criticalGaps.map((g) => ({
            label: g.label,
            description: g.description,
            type: g.type,
          })),
          recommendations: analysis.tips || [],
          dateSaved: new Date().toISOString(),
        },
      ],
      notes: `Gap Analysis: ${analysis.completenessPercent}% complete for ${analysis.targetRating}% rating. ${missingGapsSummary}`,
    };

    const success = saveClaim(packetClaim);
    if (success) {
      setSaveStatus("success");
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  } catch (error) {
    console.error("Error saving to My Packet:", error);
    setSaveStatus("error");
    setTimeout(() => setSaveStatus(null), 3000);
  }
}

const EvidenceGapHeader = ({ onClose, onReportBug }) => (
  <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white px-6 py-6 relative overflow-hidden">
    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20" />
    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12" />

    <div className="relative flex items-start justify-between">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
          <span className="text-4xl">🔬</span>
        </div>
        <div>
          <h2
            id="evidence-gap-title"
            className="text-2xl sm:text-3xl font-bold"
          >
            Evidence Gap Visualizer{" "}
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
              BETA
            </span>
          </h2>
          <p className="text-purple-200 mt-1">
            &quot;The Missing Link&quot; • See exactly what you need
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onReportBug && (
          <ReportBugLink
            onClick={onReportBug}
            variant="light"
            moduleName="Evidence Gap Visualizer"
          />
        )}
        <button
          onClick={onClose}
          className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
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

const ConditionRatingSelectors = ({
  availableConditions,
  availableRatings,
  selectedCondition,
  targetRating,
  handleConditionChange,
  setTargetRating,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
    <div>
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="block text-sm font-semibold text-gray-300 mb-2">
        Select Condition
      </label>
      <select
        value={selectedCondition}
        onChange={(e) => handleConditionChange(e.target.value)}
        className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
      >
        <option value="">-- Choose a condition --</option>
        {availableConditions.map((condition) => (
          <option key={condition.id} value={condition.id}>
            {condition.name} (DC {condition.diagnosticCode})
          </option>
        ))}
      </select>
    </div>

    <div>
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="block text-sm font-semibold text-gray-300 mb-2">
        Target Rating
      </label>
      <select
        value={targetRating}
        onChange={(e) => setTargetRating(parseInt(e.target.value))}
        disabled={!selectedCondition}
        className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all disabled:opacity-50"
      >
        {availableRatings.map((rating) => (
          <option key={rating} value={rating}>
            {rating}%
          </option>
        ))}
      </select>
    </div>
  </div>
);

// Render completeness gauge
const CompletenessGauge = ({ analysis }) => {
  if (!analysis) return null;

  const percent = analysis.completenessPercent;
  const isReady = analysis.isClaimReady;

  let gaugeColor = "from-red-500 to-red-600";
  let statusText = "NOT READY";
  let statusEmoji = "🔴";

  if (percent >= 100) {
    gaugeColor = "from-green-500 to-emerald-600";
    statusText = "CLAIM READY!";
    statusEmoji = "🟢";
  } else if (percent >= 75) {
    gaugeColor = "from-yellow-500 to-amber-600";
    statusText = "ALMOST THERE";
    statusEmoji = "🟡";
  } else if (percent >= 50) {
    gaugeColor = "from-orange-500 to-orange-600";
    statusText = "MAKING PROGRESS";
    statusEmoji = "🟠";
  }

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">
          Evidence Completeness
        </h3>
        <span
          className={`text-2xl font-bold ${isReady ? "text-green-400" : "text-yellow-400"}`}
        >
          {statusEmoji} {statusText}
        </span>
      </div>

      {/* Gauge Bar */}
      <div className="relative h-8 bg-gray-700 rounded-full overflow-hidden mb-2">
        <div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${gaugeColor} transition-all duration-500 ease-out rounded-full`}
          style={{ width: `${percent}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-bold text-lg drop-shadow-lg">
            {percent}% Complete
          </span>
        </div>
      </div>

      {/* Target Info */}
      <p className="text-gray-400 text-sm">
        Target:{" "}
        <span className="text-white font-semibold">
          {analysis.ratingLabel}
        </span>
      </p>
    </div>
  );
};

const EvidenceChecklistItem = ({ item, onToggle }) => {
  const isFound = item.status === "found";
  const isCritical = item.isCritical;

  const criticalBorderClass = isCritical
    ? "bg-red-900/30 border-red-500/50 hover:border-red-400 animate-pulse"
    : "bg-yellow-900/20 border-yellow-500/30 hover:border-yellow-400";
  const itemBorderClass = isFound
    ? "bg-green-900/30 border-green-500/50 hover:border-green-400"
    : criticalBorderClass;

  const criticalTextClass = isCritical ? "text-red-400" : "text-yellow-400";
  const labelTextClass = isFound ? "text-green-400" : criticalTextClass;

  return (
    <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
      className={`relative p-4 rounded-lg border-2 transition-all cursor-pointer ${itemBorderClass}`}
      onClick={() => onToggle(item.id)}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
            isFound
              ? "bg-green-500 text-white"
              : "bg-gray-700 border-2 border-gray-500"
          }`}
        >
          {isFound && (
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

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold ${labelTextClass}`}>
              {item.label}
            </span>
            {item.type === "required" ? (
              <span className="text-xs px-2 py-0.5 bg-red-500/30 text-red-300 rounded-full">
                REQUIRED
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 bg-blue-500/30 text-blue-300 rounded-full">
                RECOMMENDED
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">{item.description}</p>

          {/* Status Badge */}
          {!isFound && isCritical && (
            <div className="mt-2 flex items-center gap-2 text-red-400">
              <span className="text-lg">❌</span>
              <span className="text-sm font-semibold">
                MISSING - Required for this rating!
              </span>
            </div>
          )}
          {isFound && (
            <div className="mt-2 flex items-center gap-2 text-green-400">
              <span className="text-lg">✅</span>
              <span className="text-sm font-semibold">Evidence Found</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Render evidence checklist
const EvidenceChecklist = ({ analysis, toggleEvidence }) => {
  if (!analysis) return null;

  return (
    <div className="space-y-3">
      {analysis.analysis.map((item) => (
        <EvidenceChecklistItem
          key={item.id}
          item={item}
          onToggle={toggleEvidence}
        />
      ))}
    </div>
  );
};

// Render critical gaps summary
const CriticalGapsSummary = ({ analysis, targetRating }) => {
  if (!analysis || analysis.criticalGaps.length === 0) return null;

  return (
    <div className="bg-red-900/30 border-2 border-red-500 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-red-500/30 rounded-full flex items-center justify-center">
          <span className="text-2xl">🚨</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-red-400">
            Critical Missing Evidence
          </h3>
          <p className="text-red-300/80 text-sm">
            You need these items to qualify for {targetRating}%
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {analysis.criticalGaps.map((gap) => (
          <div
            key={gap.id}
            className="flex items-start gap-3 p-3 bg-red-950/50 rounded-lg"
          >
            <span className="text-red-500 text-xl flex-shrink-0">❌</span>
            <div>
              <p className="text-red-300 font-semibold">{gap.label}</p>
              <p className="text-red-400/70 text-sm">{gap.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Render tips section
const TipsSection = ({ analysis, showTips, setShowTips }) => {
  if (!analysis || !analysis.tips) return null;

  return (
    <div className="bg-blue-900/30 border-2 border-blue-500/50 rounded-xl p-6 mb-6">
      <button
        onClick={() => setShowTips(!showTips)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">💡</span>
          <h3 className="text-lg font-bold text-blue-400">
            Pro Tips for {analysis.condition}
          </h3>
        </div>
        <span className="text-blue-400 text-xl">{showTips ? "−" : "+"}</span>
      </button>

      {showTips && (
        <ul className="mt-4 space-y-2">
          {analysis.tips.map((tip, index) => (
            <li key={index} className="flex items-start gap-2 text-blue-200">
              <span className="text-blue-400 flex-shrink-0">→</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Render "Bridge to Rating" visual
const BridgeVisual = ({ analysis, targetRating }) => {
  if (!analysis) return null;

  const steps = analysis.analysis.filter((a) => a.type === "required");
  const foundCount = steps.filter((s) => s.status === "found").length;

  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 mb-6">
      <h3 className="text-lg font-bold text-white mb-4">
        🌉 Bridge to {targetRating}%
      </h3>

      {/* Visual Bridge */}
      <div className="flex items-center justify-between relative">
        {/* Start Point */}
        <div className="flex flex-col items-center z-10">
          <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mb-2">
            <span className="text-xl">🏠</span>
          </div>
          <span className="text-xs text-gray-400">Current</span>
        </div>

        {/* Bridge Steps */}
        <div className="flex-1 mx-4 relative">
          <div className="h-2 bg-gray-700 rounded-full absolute top-6 left-0 right-0 -z-0" />
          <div
            className="h-2 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full absolute top-6 left-0 -z-0 transition-all duration-500"
            style={{ width: `${(foundCount / steps.length) * 100}%` }}
          />

          <div className="flex justify-around relative z-10">
            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-all ${
                    step.status === "found"
                      ? "bg-green-500 scale-110"
                      : "bg-gray-600 border-2 border-red-500"
                  }`}
                >
                  {step.status === "found" ? "✓" : index + 1}
                </div>
                <span
                  className={`text-xs text-center max-w-[60px] ${
                    step.status === "found"
                      ? "text-green-400"
                      : "text-gray-500"
                  }`}
                >
                  {step.label.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* End Point */}
        <div className="flex flex-col items-center z-10">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
              analysis.isClaimReady
                ? "bg-green-500 scale-110 animate-bounce"
                : "bg-gray-600 opacity-50"
            }`}
          >
            <span className="text-xl">🎯</span>
          </div>
          <span
            className={`text-xs font-bold ${
              analysis.isClaimReady ? "text-green-400" : "text-gray-400"
            }`}
          >
            {targetRating}%
          </span>
        </div>
      </div>
    </div>
  );
};

const SaveStatusNotice = ({ saveStatus }) => (
  <>
    {saveStatus === "success" && (
      <div className="flex items-center gap-2 text-green-400 text-sm animate-fade-in">
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span>Saved to My Packet! 📦</span>
      </div>
    )}
    {saveStatus === "error" && (
      <div className="flex items-center gap-2 text-red-400 text-sm">
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Error saving. Please try again.</span>
      </div>
    )}
  </>
);

const SaveButton = ({ saveAnalysis, saveStatus }) => (
  <button
    onClick={saveAnalysis}
    disabled={saveStatus === "success"}
    className={`px-6 py-3 ${
      saveStatus === "success"
        ? "bg-green-600 hover:bg-green-700"
        : "bg-purple-600 hover:bg-purple-700"
    } text-white font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-75`}
  >
    {saveStatus === "success" ? (
      <>
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        Saved to My Packet
      </>
    ) : (
      <>
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
          />
        </svg>
        Save to My Packet
      </>
    )}
  </button>
);

const SaveToPacketButton = ({ saveAnalysis, saveStatus }) => (
  <div className="mt-6 flex flex-col items-end gap-2">
    <SaveStatusNotice saveStatus={saveStatus} />
    <SaveButton saveAnalysis={saveAnalysis} saveStatus={saveStatus} />
  </div>
);

const EvidenceGapEmptyState = () => (
  <div className="text-center py-16">
    <div className="text-6xl mb-4">🎯</div>
    <h3 className="text-xl font-bold text-gray-300 mb-2">
      Select a Condition to Begin
    </h3>
    <p className="text-gray-500 max-w-md mx-auto">
      Choose a condition and target rating above to see exactly what evidence
      you need to support your claim.
    </p>
  </div>
);

const EvidenceGapAnalysisResults = ({
  analysis,
  targetRating,
  showTips,
  setShowTips,
  toggleEvidence,
  saveAnalysis,
  saveStatus,
}) => (
  <>
    {/* Completeness Gauge */}
    <CompletenessGauge analysis={analysis} />

    {/* Bridge Visual */}
    <BridgeVisual analysis={analysis} targetRating={targetRating} />

    {/* Critical Gaps Warning */}
    <CriticalGapsSummary analysis={analysis} targetRating={targetRating} />

    {/* Pro Tips */}
    <TipsSection
      analysis={analysis}
      showTips={showTips}
      setShowTips={setShowTips}
    />

    {/* Evidence Checklist */}
    <div className="bg-gray-800/30 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">
          📋 Evidence Checklist
        </h3>
        <span className="text-sm text-gray-400">
          Click items to mark as found
        </span>
      </div>
      <EvidenceChecklist analysis={analysis} toggleEvidence={toggleEvidence} />
    </div>

    {/* Save Button with Status Feedback */}
    <SaveToPacketButton saveAnalysis={saveAnalysis} saveStatus={saveStatus} />
  </>
);

const EvidenceGapBody = ({
  availableConditions,
  availableRatings,
  selectedCondition,
  targetRating,
  handleConditionChange,
  setTargetRating,
  analysis,
  showTips,
  setShowTips,
  toggleEvidence,
  saveAnalysis,
  saveStatus,
}) => (
  <div className="-mx-4 -my-4">
    {/* Content */}
    <div className="p-6">
      {/* Condition & Rating Selection */}
      <ConditionRatingSelectors
        availableConditions={availableConditions}
        availableRatings={availableRatings}
        selectedCondition={selectedCondition}
        targetRating={targetRating}
        handleConditionChange={handleConditionChange}
        setTargetRating={setTargetRating}
      />

      {/* Analysis Results */}
      {analysis ? (
        <EvidenceGapAnalysisResults
          analysis={analysis}
          targetRating={targetRating}
          showTips={showTips}
          setShowTips={setShowTips}
          toggleEvidence={toggleEvidence}
          saveAnalysis={saveAnalysis}
          saveStatus={saveStatus}
        />
      ) : (
        <EvidenceGapEmptyState />
      )}
    </div>

    {/* Disclaimer */}
    <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700">
      <p className="text-xs text-gray-500 text-center">
        💡 This analysis is based on 38 CFR requirements. Always consult with
        a VSO or attorney for specific claim advice.
      </p>
    </div>
  </div>
);

function useEvidenceGapAnalysis({
  selectedCondition,
  targetRating,
  userEvidence,
  setSavedGapAnalyses,
  setAnalysis,
}) {
  // Load saved analyses from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("vet_rate_gap_analyses");
    if (saved) {
      try {
        setSavedGapAnalyses(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved gap analyses:", e);
      }
    }
  }, [setSavedGapAnalyses]);

  // Re-analyze when condition, rating, or evidence changes
  useEffect(() => {
    if (selectedCondition && targetRating) {
      const result = analyzeEvidenceGaps(
        selectedCondition,
        targetRating,
        userEvidence,
      );
      setAnalysis(result);
    } else {
      setAnalysis(null);
    }
  }, [selectedCondition, targetRating, userEvidence, setAnalysis]);
}

const EvidenceGapVisualizer = ({
  onClose,
  initialCondition = null,
  initialRating = null,
  onReportBug,
}) => {
  // State
  const [selectedCondition, setSelectedCondition] = useState(
    initialCondition || "",
  );
  const [targetRating, setTargetRating] = useState(initialRating || 50);
  const [userEvidence, setUserEvidence] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [showTips, setShowTips] = useState(false);
  const [savedGapAnalyses, setSavedGapAnalyses] = useState([]);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null

  // Get available conditions and ratings
  const availableConditions = getAvailableConditions();
  const availableRatings = getAvailableRatingsForCondition(selectedCondition);

  useEvidenceGapAnalysis({
    selectedCondition,
    targetRating,
    userEvidence,
    setSavedGapAnalyses,
    setAnalysis,
  });

  // Handle condition change
  const handleConditionChange = (conditionId) => {
    setSelectedCondition(conditionId);
    setUserEvidence([]);
    const defaultRating = computeDefaultRating(conditionId);
    if (defaultRating !== null) setTargetRating(defaultRating);
  };

  // Toggle evidence item
  const toggleEvidence = (evidenceId) => {
    setUserEvidence((prev) =>
      prev.includes(evidenceId)
        ? prev.filter((id) => id !== evidenceId)
        : [...prev, evidenceId],
    );
  };

  // Save current analysis to My Packet
  const saveAnalysis = () =>
    saveGapAnalysis({
      analysis,
      userEvidence,
      savedGapAnalyses,
      setSavedGapAnalyses,
      setSaveStatus,
    });

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="xl"
      labelledBy="evidence-gap-title"
      className="bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-700"
      header={
        <EvidenceGapHeader onClose={onClose} onReportBug={onReportBug} />
      }
    >
      <EvidenceGapBody
        availableConditions={availableConditions}
        availableRatings={availableRatings}
        selectedCondition={selectedCondition}
        targetRating={targetRating}
        handleConditionChange={handleConditionChange}
        setTargetRating={setTargetRating}
        analysis={analysis}
        showTips={showTips}
        setShowTips={setShowTips}
        toggleEvidence={toggleEvidence}
        saveAnalysis={saveAnalysis}
        saveStatus={saveStatus}
      />
    </ResponsiveModal>
  );
};

export default EvidenceGapVisualizer;
