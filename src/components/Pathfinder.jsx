/**
 * Vet-Rate.org - Pathfinder Component (Strategy Engine)
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * AI-powered claims strategy engine that analyzes current ratings
 * and suggests high-probability secondary claims.
 */

import { useState, useEffect, useRef } from "react";
import ResponsiveModal from "./common/ResponsiveModal";
import { useLanguage } from "../contexts/LanguageContext";
import {
  analyzeStrategy,
  getProbabilityColors,
  getConnectionTypeColors,
  getPathfinderPrivacyDisclosure,
} from "../utils/pathfinderEngine";
import { getSavedClaims } from "../utils/claimsStorage";
import { getMyRatings, hasMyRatings } from "../utils/veteranProfile";
import { isAnyAIAvailable, getAIStatus } from "../utils/unifiedAIService";
import { AIStatusBadge } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import SmartAILoadButton from "./SmartAILoadButton";
import VAGovRatingPaster from "./VAGovRatingPaster";
import {
  analyzeDocument,
  isFileSupported,
  getFileTypeLabel,
  getAcceptString,
} from "../utils/documentAnalyzer";

// Icons
const ChartIcon = () => (
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
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

const TargetIcon = () => (
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
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
);

const PlusIcon = () => (
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
      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
    />
  </svg>
);

const TrashIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const CheckIcon = () => (
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
);

const SparklesIcon = () => (
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
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
    />
  </svg>
);

const ArrowRightIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
);

const InfoIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const LightbulbIcon = () => (
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
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);

const TrendingUpIcon = () => (
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
      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
    />
  </svg>
);

// Common conditions list for dropdown
const COMMON_CONDITIONS = [
  "PTSD",
  "Depression",
  "Anxiety",
  "TBI (Traumatic Brain Injury)",
  "Tinnitus",
  "Hearing Loss",
  "Migraines",
  "Lumbar Strain (Back Pain)",
  "Cervical Strain (Neck Pain)",
  "Degenerative Disc Disease",
  "Radiculopathy",
  "Sciatica",
  "Left Knee Condition",
  "Right Knee Condition",
  "Left Ankle Condition",
  "Right Ankle Condition",
  "Left Hip Condition",
  "Right Hip Condition",
  "Left Shoulder Condition",
  "Right Shoulder Condition",
  "Sleep Apnea",
  "Insomnia",
  "GERD",
  "IBS",
  "Hypertension",
  "Diabetes Type II",
  "Peripheral Neuropathy",
  "Carpal Tunnel Syndrome",
  "Eczema",
  "Psoriasis",
  "Erectile Dysfunction",
  "Other (type below)",
];

const RATING_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// Maps a saved My Ratings entry ({name, bodyPart, side}) onto one of
// Pathfinder's COMMON_CONDITIONS presets, so "Load My Ratings" doesn't leave
// every row on "Select condition..." with only the % populated (the saved
// rating shape uses `name`, not `condition`, and free-text labels rarely
// match a preset string exactly).
const CONDITION_NAME_KEYWORD_MAP = [
  [/ptsd|post.?traumatic/i, "PTSD"],
  [/depress/i, "Depression"],
  [/anxiety/i, "Anxiety"],
  [/tbi|traumatic brain/i, "TBI (Traumatic Brain Injury)"],
  [/tinnitus/i, "Tinnitus"],
  [/hearing loss/i, "Hearing Loss"],
  [/migraine/i, "Migraines"],
  [/sciatica/i, "Sciatica"],
  [/radiculopathy/i, "Radiculopathy"],
  [/degenerative disc/i, "Degenerative Disc Disease"],
  [/cervical|neck/i, "Cervical Strain (Neck Pain)"],
  [/lumbar|thoracolumbar|\bback\b/i, "Lumbar Strain (Back Pain)"],
  [/sleep apnea/i, "Sleep Apnea"],
  [/insomnia/i, "Insomnia"],
  [/gerd|reflux/i, "GERD"],
  [/ibs|irritable bowel/i, "IBS"],
  [/hypertension/i, "Hypertension"],
  [/diabetes/i, "Diabetes Type II"],
  [/peripheral neuropathy/i, "Peripheral Neuropathy"],
  [/carpal tunnel/i, "Carpal Tunnel Syndrome"],
  [/eczema/i, "Eczema"],
  [/psoriasis/i, "Psoriasis"],
  [/erectile/i, "Erectile Dysfunction"],
];

const SIDED_BODY_PART_LABELS = {
  knee: "Knee Condition",
  ankle: "Ankle Condition",
  hip: "Hip Condition",
  shoulder: "Shoulder Condition",
};

function mapSavedRatingToCondition(saved) {
  const name = (saved.name || "").trim();

  const exactMatch = COMMON_CONDITIONS.find(
    (c) => c.toLowerCase() === name.toLowerCase(),
  );
  if (exactMatch) return exactMatch;

  const keywordMatch = CONDITION_NAME_KEYWORD_MAP.find(([pattern]) =>
    pattern.test(name),
  );
  if (keywordMatch) return keywordMatch[1];

  const sidedLabel = SIDED_BODY_PART_LABELS[saved.bodyPart];
  if (sidedLabel) {
    if (saved.side === "left") return `Left ${sidedLabel}`;
    if (saved.side === "right") return `Right ${sidedLabel}`;
  }

  // No preset match - fall back to the raw saved name as a custom entry.
  return name;
}

/**
 * Rating Input Row Component
 */
const RatingInput = ({ rating, index, onUpdate, onRemove, t }) => {
  // Ensure we always have defined values for controlled inputs
  const conditionValue = rating.condition || "";
  const ratingValue = rating.rating || "";
  // Recomputed from props on every render (not just on mount) so a parent
  // that swaps `rating.condition` on an already-mounted row (e.g. bulk
  // "Load My Ratings") still switches to the custom text input when the
  // new value doesn't match a preset.
  const [manualCustom, setManualCustom] = useState(false);
  const isCustom =
    manualCustom ||
    (conditionValue !== "" && !COMMON_CONDITIONS.includes(conditionValue));

  return (
    <div className="flex flex-col sm:flex-row gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <div className="flex-1">
        {isCustom ? (
          <input
            type="text"
            value={conditionValue}
            onChange={(e) => onUpdate(index, "condition", e.target.value)}
            placeholder={t("pathfinder", "enterConditionName")}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        ) : (
          <select
            value={conditionValue}
            onChange={(e) => {
              if (e.target.value === "Other (type below)") {
                setManualCustom(true);
                onUpdate(index, "condition", "");
              } else {
                onUpdate(index, "condition", e.target.value);
              }
            }}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500"
          >
            <option value="">{t("pathfinder", "selectCondition")}</option>
            {COMMON_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <select
          value={ratingValue}
          onChange={(e) => onUpdate(index, "rating", e.target.value)}
          className="w-24 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500"
        >
          <option value="">%</option>
          {RATING_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}%
            </option>
          ))}
        </select>
        <button type="button"
          onClick={() => onRemove(index)}
          className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
};

/**
 * Opportunity Card Component
 */
const OpportunityCard = ({ opportunity, onBuildNexus, onPracticeExam, t }) => {
  const probColors = getProbabilityColors(opportunity.win_probability);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white">
            {opportunity.proposed_condition}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("pathfinder", "secondaryTo")}{" "}
            <span className="font-medium">{opportunity.primary_source}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${probColors.bg} ${probColors.text}`}
          >
            {opportunity.win_probability} {t("pathfinder", "probability")}
          </span>
          {opportunity.typical_rating && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t("pathfinder", "typical")} {opportunity.typical_rating}
            </span>
          )}
        </div>
      </div>

      {opportunity.connection_type && (
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-3 ${getConnectionTypeColors(opportunity.connection_type)}`}
        >
          {opportunity.connection_type}
        </span>
      )}

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {opportunity.mechanism}
      </p>

      {opportunity.evidence_needed && (
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 mb-3">
          <p className="text-xs text-teal-800 dark:text-teal-300">
            <strong>{t("pathfinder", "evidenceNeeded")}</strong>{" "}
            {opportunity.evidence_needed}
          </p>
        </div>
      )}

      {opportunity.next_step && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-4">
          <p className="text-xs text-green-800 dark:text-green-300">
            <strong>{t("pathfinder", "nextStep")}</strong>{" "}
            {opportunity.next_step}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button"
          onClick={() => onBuildNexus(opportunity)}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {t("pathfinder", "buildNexus")} <ArrowRightIcon />
        </button>
        <button type="button"
          onClick={() => onPracticeExam(opportunity)}
          className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {t("pathfinder", "practiceExam")} <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
};

/**
 * Main Pathfinder Component
 */
const PathfinderConsentGate = ({ handleConsent, t }) => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
    <div className="text-center mb-6">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-full mb-3">
        <TargetIcon />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {t("pathfinder", "privacyFirst")}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-sm">
        {t("pathfinder", "privacyReviewPrompt")}
      </p>
    </div>

    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-6 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
      {getPathfinderPrivacyDisclosure()}
    </div>

    <button type="button"
      onClick={handleConsent}
      className="w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
    >
      <CheckIcon /> {t("pathfinder", "iUnderstandContinue")}
    </button>
  </div>
);

const PathfinderAIBanner = ({ t }) =>
  !isAnyAIAvailable() ? (
    <div className="mb-6">
      <SmartAILoadButton
        toolId="pathfinder"
        onLoadComplete={(model) =>
          // eslint-disable-next-line no-console
          console.log("Smart AI loaded for Pathfinder:", model?.name)
        }
      />
    </div>
  ) : (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-3 mb-6">
      <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
        <span>💡</span>
        <span>
          <strong>{t("pathfinder", "aiTip")}</strong>{" "}
          {t("pathfinder", "aiTipText")}
        </span>
      </div>
    </div>
  );

const PathfinderInputToolbar = ({
  t,
  hasMyRatings,
  handleLoadMyRatings,
  setShowVAGovPaster,
  setShowDropInModal,
  loadFromPacket,
}) => (
  <div className="flex items-center gap-2">
    {hasMyRatings() && (
      <button type="button"
        onClick={handleLoadMyRatings}
        className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
      >
        📊 {t("pathfinder", "loadMyRatings")}
      </button>
    )}
    <button type="button"
      onClick={() => setShowVAGovPaster(true)}
      className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
    >
      📋 {t("pathfinder", "pasteFromVaGov")}
    </button>
    <button type="button"
      onClick={() => setShowDropInModal(true)}
      className="text-sm px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-1.5"
    >
      📄 {t("pathfinder", "dropInFile")}
    </button>
    <button type="button"
      onClick={loadFromPacket}
      className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-200 flex items-center gap-1"
    >
      {t("pathfinder", "loadFromPacket")}
    </button>
  </div>
);

const PathfinderAnalyzeButton = ({
  isAnalyzing,
  ratings,
  handleAnalyze,
  t,
}) => (
  <button type="button"
    onClick={handleAnalyze}
    disabled={
      isAnalyzing ||
      !isAnyAIAvailable() ||
      ratings.filter((r) => r.condition && r.condition.trim()).length === 0
    }
    className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
  >
    {isAnalyzing ? (
      <>
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        {t("pathfinder", "analyzingStrategy")}
      </>
    ) : (
      <>
        <SparklesIcon /> {t("pathfinder", "analyzeMyStrategy")}
      </>
    )}
  </button>
);

const PathfinderRatingsList = ({
  ratings,
  updateRating,
  removeRating,
  addRating,
  t,
}) => (
  <>
    <div className="space-y-2 mb-4">
      {ratings.map((rating, index) => (
        <RatingInput
          key={index}
          rating={rating}
          index={index}
          onUpdate={updateRating}
          onRemove={removeRating}
          t={t}
        />
      ))}
    </div>

    <button type="button"
      onClick={addRating}
      className="w-full px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-teal-400 hover:text-teal-600 dark:hover:border-teal-500 dark:hover:text-teal-400 transition-colors flex items-center justify-center gap-2"
    >
      <PlusIcon /> {t("pathfinder", "addAnotherRating")}
    </button>
  </>
);

const PathfinderInputSection = ({
  t,
  hasMyRatings,
  handleLoadMyRatings,
  setShowVAGovPaster,
  setShowDropInModal,
  loadFromPacket,
  loadedFromPacket,
  ratings,
  updateRating,
  removeRating,
  addRating,
  additionalContext,
  setAdditionalContext,
  handleClear,
  handleAnalyze,
  isAnalyzing,
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {t("pathfinder", "currentRatingsTitle")}
      </h2>
      <PathfinderInputToolbar
        t={t}
        hasMyRatings={hasMyRatings}
        handleLoadMyRatings={handleLoadMyRatings}
        setShowVAGovPaster={setShowVAGovPaster}
        setShowDropInModal={setShowDropInModal}
        loadFromPacket={loadFromPacket}
      />
    </div>

    {loadedFromPacket && (
      <div className="bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-sm p-2 rounded-lg mb-4">
        ✓ {t("pathfinder", "loadedFromPacket")}
      </div>
    )}

    <PathfinderRatingsList
      ratings={ratings}
      updateRating={updateRating}
      removeRating={removeRating}
      addRating={addRating}
      t={t}
    />

    {/* Additional Context */}
    <div className="mt-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {t("pathfinder", "additionalContext")}
      </label>
      <textarea
        value={additionalContext}
        onChange={(e) => setAdditionalContext(e.target.value)}
        placeholder={t("pathfinder", "additionalContextPlaceholder")}
        className="w-full h-24 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-teal-500 resize-none"
      />
    </div>

    {/* Actions */}
    <div className="flex gap-3 mt-6">
      <button type="button"
        onClick={handleClear}
        className="px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        {t("pathfinder", "clearAll")}
      </button>
      <PathfinderAnalyzeButton
        isAnalyzing={isAnalyzing}
        ratings={ratings}
        handleAnalyze={handleAnalyze}
        t={t}
      />
    </div>
  </div>
);

const PathfinderStrategyOverview = ({ results, t }) => (
  <div className="bg-gradient-to-r from-teal-600 to-emerald-700 text-white rounded-2xl p-6">
    <div className="flex items-start gap-4">
      <div className="p-3 bg-white/20 rounded-xl">
        <ChartIcon />
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-bold mb-2">
          {t("pathfinder", "strategyAnalysis")}
        </h3>
        <p className="text-white">{results.data.strategy_analysis}</p>

        {(results.data.current_estimated_combined ||
          results.data.potential_combined) && (
          <div className="flex gap-6 mt-4">
            {results.data.current_estimated_combined && (
              <div>
                <div className="text-sm text-white/80">
                  {t("pathfinder", "currentEstimated")}
                </div>
                <div className="text-2xl font-bold">
                  {results.data.current_estimated_combined}
                </div>
              </div>
            )}
            {results.data.potential_combined && (
              <div>
                <div className="text-sm text-white/80">
                  {t("pathfinder", "potentialWithOpportunities")}
                </div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {results.data.potential_combined}
                  <TrendingUpIcon />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);

const PathfinderOpportunities = ({
  results,
  t,
  handleBuildNexus,
  handlePracticeExam,
}) =>
  results.data.opportunities &&
  results.data.opportunities.length > 0 && (
    <div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <TargetIcon /> {t("pathfinder", "strategicOpportunities")} (
        {results.data.opportunities.length})
      </h3>
      <div className="grid md:grid-cols-2 gap-4">
        {results.data.opportunities.map((opp, index) => (
          <OpportunityCard
            key={index}
            opportunity={opp}
            onBuildNexus={handleBuildNexus}
            onPracticeExam={handlePracticeExam}
            t={t}
          />
        ))}
      </div>
    </div>
  );

const PathfinderMissingDiagnoses = ({ results, t }) =>
  results.data.missing_diagnoses &&
  results.data.missing_diagnoses.length > 0 && (
    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-700">
      <h3 className="text-lg font-bold text-purple-900 dark:text-purple-200 mb-4 flex items-center gap-2">
        <LightbulbIcon /> {t("pathfinder", "potentialUndiagnosedConditions")}
      </h3>
      <div className="space-y-4">
        {results.data.missing_diagnoses.map((item, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-4">
            <div className="font-semibold text-gray-900 dark:text-white mb-1">
              {item.condition}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t("pathfinder", "linkedTo")} {item.linked_to}
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              {item.reasoning}
            </p>
            {item.action && (
              <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                → {item.action}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );

const PathfinderIncreaseOpportunities = ({ results, t }) =>
  results.data.increase_opportunities &&
  results.data.increase_opportunities.length > 0 && (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-700">
      <h3 className="text-lg font-bold text-green-900 dark:text-green-200 mb-4 flex items-center gap-2">
        <TrendingUpIcon /> {t("pathfinder", "potentialRatingIncreases")}
      </h3>
      <div className="space-y-4">
        {results.data.increase_opportunities.map((item, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-gray-900 dark:text-white">
                {item.current_condition}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{item.current_rating}</span>
                <span className="text-green-600">→</span>
                <span className="text-green-600 font-bold">
                  {item.potential_rating}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              <strong>{t("pathfinder", "criteria")}</strong> {item.criteria}
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              <strong>{t("pathfinder", "action")}</strong> {item.action}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

const PathfinderResultsSection = ({
  results,
  t,
  handleBuildNexus,
  handlePracticeExam,
  setResults,
}) =>
  results &&
  results.success && (
    <div className="space-y-6">
      <PathfinderStrategyOverview results={results} t={t} />

      <PathfinderOpportunities
        results={results}
        t={t}
        handleBuildNexus={handleBuildNexus}
        handlePracticeExam={handlePracticeExam}
      />

      <PathfinderMissingDiagnoses results={results} t={t} />

      <PathfinderIncreaseOpportunities results={results} t={t} />

      {/* Strategic Notes */}
      {results.data.strategic_notes && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
          <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
            <InfoIcon /> {t("pathfinder", "strategicNotes")}
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {results.data.strategic_notes}
          </p>
        </div>
      )}

      {/* Analyze Again */}
      <div className="text-center">
        <button type="button"
          onClick={() => setResults(null)}
          className="px-6 py-3 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors font-medium"
        >
          {t("pathfinder", "analyzeDifferentRatings")}
        </button>
      </div>
    </div>
  );

const PathfinderDropInModalHeader = ({ onDismiss, t }) => (
  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
    <div>
      <h3
        id="pathfinder-dropin-title"
        className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
      >
        📄 {t("pathfinder", "dropInFile") || "Drop In Document"}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Files stay in your browser - never uploaded to any server
      </p>
    </div>
    <button type="button"
      onClick={onDismiss}
      aria-label="Close"
      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
    >
      <svg
        className="w-6 h-6 text-gray-500"
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
);

const PathfinderDropZone = ({ fileInputRef, handleFileSelect, t }) => (
  <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    onClick={() => fileInputRef.current?.click()}
    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-violet-400 dark:hover:border-violet-500 transition-colors cursor-pointer"
  >
    <div className="text-6xl mb-4">📄</div>
    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
      {t("pathfinder", "dropFileHere")}
    </p>
    <p className="text-sm text-gray-500 dark:text-gray-400">
      {t("pathfinder", "supportsFormats")}
    </p>
    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
      {t("pathfinder", "maxFileSize")}
    </p>
    <input
      ref={fileInputRef}
      type="file"
      accept={getAcceptString()}
      onChange={(e) => handleFileSelect(e.target.files)}
      className="hidden"
    />
  </div>
);

const PathfinderSelectedFileInfo = ({
  uploadedFile,
  setUploadedFile,
  setFileProgress,
}) => (
  <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="text-3xl">📄</div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            {uploadedFile.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {getFileTypeLabel(uploadedFile)} •{" "}
            {(uploadedFile.size / 1024).toFixed(0)} KB
          </p>
        </div>
      </div>
      <button type="button"
        onClick={() => {
          setUploadedFile(null);
          setFileProgress(null);
        }}
        className="p-2 hover:bg-violet-100 dark:hover:bg-violet-900/50 rounded-lg transition-colors"
      >
        <svg
          className="w-5 h-5 text-gray-500"
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
);

const PathfinderUploadedFilePanel = ({
  uploadedFile,
  setUploadedFile,
  fileProgress,
  setFileProgress,
  isProcessingFile,
  handleProcessFile,
  t,
}) => (
  <div className="space-y-4">
    <PathfinderSelectedFileInfo
      uploadedFile={uploadedFile}
      setUploadedFile={setUploadedFile}
      setFileProgress={setFileProgress}
    />

    {/* Processing Progress */}
    {fileProgress && (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
          {fileProgress.message}
        </p>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${fileProgress.progress}%` }}
          />
        </div>
      </div>
    )}

    {/* Info */}
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        💡 <strong>{t("pathfinder", "whatHappensNext")}</strong>{" "}
        {t("pathfinder", "whatHappensNextDesc")}
      </p>
    </div>

    {/* Process Button */}
    <button type="button"
      onClick={handleProcessFile}
      disabled={isProcessingFile}
      className="w-full px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
    >
      {isProcessingFile ? (
        <>
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {t("pathfinder", "processing")}
        </>
      ) : (
        <>✨ {t("pathfinder", "extractAndLoad")}</>
      )}
    </button>
  </div>
);

const PathfinderDropInModal = ({
  showDropInModal,
  setShowDropInModal,
  uploadedFile,
  setUploadedFile,
  fileProgress,
  setFileProgress,
  isProcessingFile,
  fileInputRef,
  handleFileSelect,
  handleProcessFile,
  t,
}) => {
  const dismiss = () => {
    setShowDropInModal(false);
    setUploadedFile(null);
    setFileProgress(null);
  };

  return (
    showDropInModal && (
      <ResponsiveModal
        isOpen
        onClose={dismiss}
        size="md"
        zIndex={70}
        labelledBy="pathfinder-dropin-title"
        header={<PathfinderDropInModalHeader onDismiss={dismiss} t={t} />}
      >
        {!uploadedFile ? (
          <PathfinderDropZone
            fileInputRef={fileInputRef}
            handleFileSelect={handleFileSelect}
            t={t}
          />
        ) : (
          <PathfinderUploadedFilePanel
            uploadedFile={uploadedFile}
            setUploadedFile={setUploadedFile}
            fileProgress={fileProgress}
            setFileProgress={setFileProgress}
            isProcessingFile={isProcessingFile}
            handleProcessFile={handleProcessFile}
            t={t}
          />
        )}
      </ResponsiveModal>
    )
  );
};

function _extractRatingsFromText(text) {
  // Look for patterns like "PTSD - 70%" or "Condition: PTSD, Rating: 70%"
  const ratingPatterns = [
    // eslint-disable-next-line sonarjs/slow-regex -- nested quantifier already removed; empirically verified O(n^2) via .exec() loop restarts, not exponential (see PR notes)
    /([A-Z][a-z\s]+)\s*[-:]\s*(\d+)%?/gi, // "PTSD - 70%" or "PTSD: 70"
    // eslint-disable-next-line sonarjs/slow-regex -- same as above; single quantifier, no nesting, no catastrophic backtracking
    /(\d+)%?\s+for\s+([A-Z][a-z\s]+)/gi, // "70% for PTSD"
  ];

  const extractedRatings = [];
  for (const pattern of ratingPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const condition = match[1] || match[2];
      const rating = match[2] || match[1];
      if (condition && rating && !Number.isNaN(Number.parseInt(rating))) {
        extractedRatings.push({
          condition: condition.trim(),
          rating: Number.parseInt(rating).toString(),
        });
      }
    }
  }
  return extractedRatings;
}

function usePathfinderInitEffects({
  initialConditions,
  setApiKey,
  setHasConsented,
  setAIStatus,
  setRatings,
  setLoadedFromPacket,
}) {
  // Load API key, check consent, and monitor AI status
  useEffect(() => {
    const storedKey = localStorage.getItem("vetrate_gemini_key");
    if (storedKey) {
      setApiKey(storedKey);
    }
    const consent = localStorage.getItem("vetrate_ai_consent");
    if (consent === "true") {
      setHasConsented(true);
    }

    // Update AI status periodically
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, [setApiKey, setHasConsented, setAIStatus]);

  // Load initial conditions from BlueButtonXRay if provided
  useEffect(() => {
    if (
      initialConditions &&
      Array.isArray(initialConditions) &&
      initialConditions.length > 0
    ) {
      // eslint-disable-next-line no-console
      console.log(
        "Pathfinder: Loading",
        initialConditions.length,
        "conditions from BlueButton",
      );
      const formattedConditions = initialConditions.map((c) => ({
        condition: c.standardizedName || c.name || c.condition || "",
        rating: "", // Leave rating empty for user to fill
      }));
      setRatings(formattedConditions);
      setLoadedFromPacket(true); // Show indicator that conditions were loaded
    }
  }, [initialConditions, setRatings, setLoadedFromPacket]);
}

async function _processUploadedFile({
  uploadedFile,
  t,
  setIsProcessingFile,
  setError,
  setFileProgress,
  setRatings,
  setAdditionalContext,
  setShowDropInModal,
  setUploadedFile,
}) {
  if (!uploadedFile) return;

  setIsProcessingFile(true);
  setError(null);

  try {
    const result = await analyzeDocument(uploadedFile, setFileProgress);
    const extractedRatings = _extractRatingsFromText(result.text);

    if (extractedRatings.length > 0) {
      setRatings(extractedRatings);
      setAdditionalContext(result.text.substring(0, 2000)); // First 2000 chars as context
    } else {
      // No structured ratings found, just use the text as context
      setAdditionalContext(result.text);
      alert(t("pathfinder", "noRatingsExtracted"));
    }

    setShowDropInModal(false);
    setUploadedFile(null);
    setFileProgress(null);
  } catch (err) {
    console.error("File processing error:", err);
    setError(`${t("pathfinder", "errorProcessingFile")} ${err.message}`);
  } finally {
    setIsProcessingFile(false);
  }
}

function _clearPathfinder({
  setRatings,
  setAdditionalContext,
  setResults,
  setError,
  setLoadedFromPacket,
}) {
  setRatings([{ condition: "", rating: "" }]);
  setAdditionalContext("");
  setResults(null);
  setError(null);
  setLoadedFromPacket(false);
}

function _selectDroppedFile({
  files,
  t,
  setError,
  setUploadedFile,
  setShowDropInModal,
}) {
  const file = files[0];
  if (!file) return;

  if (!isFileSupported(file)) {
    setError(t("pathfinder", "errorUnsupportedFile"));
    return;
  }

  setUploadedFile(file);
  setShowDropInModal(true);
}

function _loadRatingsFromPacket({ setRatings, setLoadedFromPacket }) {
  try {
    const claims = getSavedClaims();
    if (claims && claims.length > 0) {
      // Filter for primary claims (conditions that would be service-connected)
      const loadedRatings = claims
        .map((claim) => ({
          condition:
            claim.primaryCondition || claim.conditionName || claim.condition,
          rating: "",
        }))
        .filter((r) => r.condition);

      if (loadedRatings.length > 0) {
        setRatings(loadedRatings);
        setLoadedFromPacket(true);
      }
    }
  } catch (err) {
    console.error("Error loading from packet:", err);
  }
}

async function _runStrategyAnalysis({
  ratings,
  apiKey,
  additionalContext,
  t,
  onOpenAISettings,
  setError,
  setIsAnalyzing,
  setResults,
}) {
  const validRatings = ratings.filter((r) => r.condition.trim());

  if (validRatings.length === 0) {
    setError(t("pathfinder", "errorAddRating"));
    return;
  }

  // Check if ANY AI is available (Cloud or Local)
  if (!isAnyAIAvailable()) {
    setError(t("pathfinder", "errorNoAI"));
    onOpenAISettings?.();
    return;
  }

  setIsAnalyzing(true);
  setError(null);
  setResults(null);

  try {
    const result = await analyzeStrategy(
      apiKey,
      validRatings,
      additionalContext,
    );
    setResults(result);
  } catch (err) {
    setError(err.message);
  } finally {
    setIsAnalyzing(false);
  }
}

function _buildNexus(onNavigate, opportunity) {
  // Navigate to NexusBuilder with pre-filled data
  if (onNavigate) {
    onNavigate("nexus", {
      condition: opportunity.proposed_condition,
      primaryCondition: opportunity.primary_source?.replace(
        "Secondary to ",
        "",
      ),
    });
  }
}

function _practiceExam(onNavigate, opportunity) {
  // Navigate to DBQ/Exam tool
  if (onNavigate) {
    onNavigate("dbq", {
      condition: opportunity.proposed_condition,
    });
  }
}

function usePathfinderRatingsHandlers({
  t,
  ratings,
  setRatings,
  setShowVAGovPaster,
  setLoadedFromPacket,
}) {
  const addRating = () => {
    setRatings([...ratings, { condition: "", rating: "" }]);
  };

  const updateRating = (index, field, value) => {
    const newRatings = [...ratings];
    newRatings[index][field] = value;
    setRatings(newRatings);
  };

  const removeRating = (index) => {
    if (ratings.length > 1) {
      setRatings(ratings.filter((_, i) => i !== index));
    }
  };

  // Handle pasted ratings from VA.gov
  const handlePastedRatings = (parsedRatings) => {
    // Save each rating to veteranProfile for use across app
    parsedRatings.forEach((rating) => {
      // eslint-disable-next-line sonarjs/no-extra-arguments
      addRating(rating);
    });

    // Convert to Pathfinder format - ensure all values are defined
    const formattedRatings = parsedRatings.map((r) => ({
      condition: r.condition || "",
      rating:
        r.rating !== null && r.rating !== undefined ? r.rating.toString() : "",
    }));

    // Only set ratings if we have valid data
    if (formattedRatings.length > 0) {
      setRatings(formattedRatings);
    }
    setShowVAGovPaster(false);
  };

  // Load ratings from veteranProfile
  const handleLoadMyRatings = () => {
    const savedRatings = getMyRatings();
    if (savedRatings && savedRatings.length > 0) {
      const formatted = savedRatings.map((r) => ({
        condition: mapSavedRatingToCondition(r),
        rating: r.rating !== null ? r.rating.toString() : "",
      }));
      setRatings(formatted);
    } else {
      alert(t("pathfinder", "errorNoSavedRatings"));
    }
  };

  const loadFromPacket = () =>
    _loadRatingsFromPacket({ setRatings, setLoadedFromPacket });

  return {
    addRating,
    updateRating,
    removeRating,
    handlePastedRatings,
    handleLoadMyRatings,
    loadFromPacket,
  };
}

function createPathfinderFileHandlers({
  t,
  uploadedFile,
  setError,
  setUploadedFile,
  setShowDropInModal,
  setIsProcessingFile,
  setFileProgress,
  setRatings,
  setAdditionalContext,
}) {
  return {
    handleFileSelect: (files) =>
      _selectDroppedFile({
        files,
        t,
        setError,
        setUploadedFile,
        setShowDropInModal,
      }),
    handleProcessFile: () =>
      _processUploadedFile({
        uploadedFile,
        t,
        setIsProcessingFile,
        setError,
        setFileProgress,
        setRatings,
        setAdditionalContext,
        setShowDropInModal,
        setUploadedFile,
      }),
  };
}

function createPathfinderActionHandlers({
  ratings,
  apiKey,
  additionalContext,
  t,
  onNavigate,
  onOpenAISettings,
  setError,
  setIsAnalyzing,
  setResults,
  setRatings,
  setAdditionalContext,
  setLoadedFromPacket,
}) {
  return {
    handleAnalyze: () =>
      _runStrategyAnalysis({
        ratings,
        apiKey,
        additionalContext,
        t,
        onOpenAISettings,
        setError,
        setIsAnalyzing,
        setResults,
      }),
    handleBuildNexus: (opportunity) => _buildNexus(onNavigate, opportunity),
    handlePracticeExam: (opportunity) => _practiceExam(onNavigate, opportunity),
    handleClear: () =>
      _clearPathfinder({
        setRatings,
        setAdditionalContext,
        setResults,
        setError,
        setLoadedFromPacket,
      }),
  };
}

function usePathfinderHandlers({
  t,
  onNavigate,
  onOpenAISettings,
  ratings,
  apiKey,
  additionalContext,
  uploadedFile,
  setRatings,
  setAdditionalContext,
  setIsAnalyzing,
  setResults,
  setError,
  setHasConsented,
  setLoadedFromPacket,
  setShowVAGovPaster,
  setShowDropInModal,
  setUploadedFile,
  setIsProcessingFile,
  setFileProgress,
}) {
  const ratingsHandlers = usePathfinderRatingsHandlers({
    t,
    ratings,
    setRatings,
    setShowVAGovPaster,
    setLoadedFromPacket,
  });

  const fileHandlers = createPathfinderFileHandlers({
    t,
    uploadedFile,
    setError,
    setUploadedFile,
    setShowDropInModal,
    setIsProcessingFile,
    setFileProgress,
    setRatings,
    setAdditionalContext,
  });

  const actionHandlers = createPathfinderActionHandlers({
    ratings,
    apiKey,
    additionalContext,
    t,
    onNavigate,
    onOpenAISettings,
    setError,
    setIsAnalyzing,
    setResults,
    setRatings,
    setAdditionalContext,
    setLoadedFromPacket,
  });

  return {
    handleConsent: () => _consentToAI(setHasConsented),
    ...ratingsHandlers,
    ...fileHandlers,
    ...actionHandlers,
  };
}

function _consentToAI(setHasConsented) {
  localStorage.setItem("vetrate_ai_consent", "true");
  setHasConsented(true);
}

function usePathfinderState({
  onNavigate,
  onOpenAISettings,
  initialConditions,
}) {
  const { t } = useLanguage();

  // NOTE: AI is NOT auto-loaded - user selects AI model via SmartAILoadButton dropdown

  const [ratings, setRatings] = useState([{ condition: "", rating: "" }]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasConsented, setHasConsented] = useState(false);
  const [loadedFromPacket, setLoadedFromPacket] = useState(false);
  const [, setAIStatus] = useState(getAIStatus());
  const [showVAGovPaster, setShowVAGovPaster] = useState(false);

  // File drop modal state
  const [showDropInModal, setShowDropInModal] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileProgress, setFileProgress] = useState(null);
  const fileInputRef = useRef(null);

  usePathfinderInitEffects({
    initialConditions,
    setApiKey,
    setHasConsented,
    setAIStatus,
    setRatings,
    setLoadedFromPacket,
  });

  const handlers = usePathfinderHandlers({
    t,
    onNavigate,
    onOpenAISettings,
    ratings,
    apiKey,
    additionalContext,
    uploadedFile,
    setRatings,
    setAdditionalContext,
    setIsAnalyzing,
    setResults,
    setError,
    setHasConsented,
    setLoadedFromPacket,
    setShowVAGovPaster,
    setShowDropInModal,
    setUploadedFile,
    setIsProcessingFile,
    setFileProgress,
  });

  return {
    t,
    ratings,
    additionalContext,
    setAdditionalContext,
    isAnalyzing,
    results,
    setResults,
    error,
    showPrivacy,
    setShowPrivacy,
    hasConsented,
    loadedFromPacket,
    showVAGovPaster,
    setShowVAGovPaster,
    showDropInModal,
    setShowDropInModal,
    uploadedFile,
    setUploadedFile,
    isProcessingFile,
    fileProgress,
    setFileProgress,
    fileInputRef,
    ...handlers,
  };
}

const PathfinderErrorDisplay = ({ error }) =>
  error && (
    <div
      className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 mb-6 flex items-start gap-3"
      role="alert"
      aria-live="polite"
    >
      <svg
        className="w-5 h-5 text-red-500 mt-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="text-red-700 dark:text-red-300">{error}</div>
    </div>
  );

const PathfinderPrivacyToggle = ({ showPrivacy, setShowPrivacy, t }) => (
  <>
    <button type="button"
      onClick={() => setShowPrivacy(!showPrivacy)}
      className="mt-6 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-2"
    >
      <InfoIcon />{" "}
      {showPrivacy
        ? t("pathfinder", "hidePrivacyInfo")
        : t("pathfinder", "viewPrivacyInfo")}
    </button>

    {showPrivacy && (
      <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
        {getPathfinderPrivacyDisclosure()}
      </div>
    )}
  </>
);

const PathfinderAuthenticatedContent = ({
  t,
  hasMyRatings,
  handleLoadMyRatings,
  setShowVAGovPaster,
  setShowDropInModal,
  loadFromPacket,
  loadedFromPacket,
  ratings,
  updateRating,
  removeRating,
  addRating,
  additionalContext,
  setAdditionalContext,
  handleClear,
  handleAnalyze,
  isAnalyzing,
  error,
  results,
  setResults,
  handleBuildNexus,
  handlePracticeExam,
  showPrivacy,
  setShowPrivacy,
}) => (
  <>
    <PathfinderAIBanner t={t} />

    <PathfinderInputSection
      t={t}
      hasMyRatings={hasMyRatings}
      handleLoadMyRatings={handleLoadMyRatings}
      setShowVAGovPaster={setShowVAGovPaster}
      setShowDropInModal={setShowDropInModal}
      loadFromPacket={loadFromPacket}
      loadedFromPacket={loadedFromPacket}
      ratings={ratings}
      updateRating={updateRating}
      removeRating={removeRating}
      addRating={addRating}
      additionalContext={additionalContext}
      setAdditionalContext={setAdditionalContext}
      handleClear={handleClear}
      handleAnalyze={handleAnalyze}
      isAnalyzing={isAnalyzing}
    />
    <PathfinderErrorDisplay error={error} />

    <PathfinderResultsSection
      results={results}
      t={t}
      handleBuildNexus={handleBuildNexus}
      handlePracticeExam={handlePracticeExam}
      setResults={setResults}
    />

    <PathfinderPrivacyToggle
      showPrivacy={showPrivacy}
      setShowPrivacy={setShowPrivacy}
      t={t}
    />
  </>
);

const PathfinderHeader = ({ t, onOpenAISettings }) => (
  <div className="text-center mb-8">
    <div className="flex items-center justify-center gap-4 mb-4">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl shadow-lg">
        <span className="text-3xl">🧭</span>
      </div>
      <LLMRecommendationBadge toolId="pathfinder" />
      <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
    </div>
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
      {t("pathfinder", "title")}{" "}
      <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
        BETA
      </span>
    </h1>
    <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
      {t("pathfinder", "subtitle")}
    </p>
  </div>
);

export default function Pathfinder({
  onNavigate,
  onOpenAISettings,
  initialConditions = null,
}) {
  const pf = usePathfinderState({
    onNavigate,
    onOpenAISettings,
    initialConditions,
  });

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <PathfinderHeader t={pf.t} onOpenAISettings={onOpenAISettings} />

      {/* Consent Check */}
      {!pf.hasConsented ? (
        <PathfinderConsentGate handleConsent={pf.handleConsent} t={pf.t} />
      ) : (
        <PathfinderAuthenticatedContent {...pf} hasMyRatings={hasMyRatings} />
      )}

      {/* VA.gov Rating Paster Modal */}
      {pf.showVAGovPaster && (
        <VAGovRatingPaster
          onRatingsParsed={pf.handlePastedRatings}
          onClose={() => pf.setShowVAGovPaster(false)}
          showExample={true}
        />
      )}

      <PathfinderDropInModal {...pf} />
    </div>
  );
}
