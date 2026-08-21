/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Commander's Checklist
 * Gamified progress tracking for claim readiness
 * Makes the overwhelming process feel achievable
 */

import { useState } from "react";
import useClaimProgress from "../utils/useClaimProgress";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";

// Tool navigation mapping
const TOOL_LINKS = {
  profile: "veteran-profile",
  diagnosis: "conditions-search",
  service_connection: "cfile-analyzer",
  symptoms: "symptom-logger",
  statement: "my-packet",
  nexus: "nexus-builder",
  secondary: "secondary-scout",
  ratings: "tactical-calculator",
  forms: "forms-helper",
  // ClaimNavigator integration
  claim_navigator_used: "claim-navigator",
  claim_tracked: "claim-navigator",
};

// Shared percentage tiers used to pick colors/gradients throughout this file
function getTier(percentage) {
  if (percentage === 100) return "complete";
  if (percentage >= 80) return "high";
  if (percentage >= 50) return "mid";
  return "low";
}

function getTierValue(percentage, values) {
  return values[getTier(percentage)];
}

const WIDGET_PROGRESS_GRADIENT = {
  complete: "bg-gradient-to-r from-green-500 to-green-600",
  high: "bg-gradient-to-r from-blue-500 to-blue-600",
  mid: "bg-gradient-to-r from-yellow-500 to-orange-500",
  low: "bg-gradient-to-r from-orange-500 to-red-500",
};

const EMBEDDED_PROGRESS_GRADIENT = {
  complete: "bg-gradient-to-r from-green-500 to-emerald-500",
  high: "bg-gradient-to-r from-blue-500 to-indigo-500",
  mid: "bg-gradient-to-r from-yellow-500 to-orange-500",
  low: "bg-gradient-to-r from-orange-500 to-red-500",
};

const MODAL_HEADER_GRADIENT = {
  complete: "from-green-600 to-green-800",
  high: "from-blue-600 to-blue-800",
  mid: "from-yellow-600 to-orange-600",
  low: "from-gray-600 to-gray-800",
};

const MODAL_BORDER_COLOR = {
  complete: "border-green-600",
  high: "border-blue-600",
  mid: "border-yellow-600",
  low: "border-gray-600",
};

// Get status message based on percentage
function getStatusMessage(percentage) {
  if (percentage === 100) {
    return {
      text: "🎉 Mission Complete! You're ready to file!",
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-900/20",
    };
  }
  if (percentage >= 80) {
    return {
      text: "🔥 Almost there! Just a few more steps!",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    };
  }
  if (percentage >= 50) {
    return {
      text: "💪 You're halfway there! Keep going!",
      color: "text-yellow-600 dark:text-yellow-400",
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
    };
  }
  if (percentage >= 25) {
    return {
      text: "🚀 Good start! Let's build momentum!",
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/20",
    };
  }
  return {
    text: "🎯 Let's get started on your mission!",
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900/20",
  };
}

function getModalStatus(percentage) {
  if (percentage === 100) {
    return {
      text: "🎉 Mission Complete!",
      color: "text-green-600",
      bg: "bg-green-50",
    };
  }
  if (percentage >= 80) {
    return {
      text: "🔥 Almost there!",
      color: "text-blue-600",
      bg: "bg-blue-50",
    };
  }
  if (percentage >= 50) {
    return {
      text: "💪 Halfway there!",
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    };
  }
  return {
    text: "🎯 Let's get started!",
    color: "text-gray-600",
    bg: "bg-gray-50",
  };
}

function getMissionEmoji(percentage) {
  if (percentage === 100) return "🏆";
  if (percentage >= 80) return "🎯";
  return "📊";
}

// Widget view (fixed progress bar)
function MissionWidget({
  progress,
  status,
  showModal,
  onOpen,
  onClose,
  onMilestoneClick,
}) {
  return (
    <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
      onClick={onOpen}
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t-4 border-blue-600 shadow-2xl cursor-pointer hover:shadow-blue-500/50 transition-all z-40"
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white">
              🎖️ Mission Readiness: {progress.percentage}%
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {progress.completedMilestones.length} of{" "}
              {progress.totalMilestones} objectives complete
            </p>
          </div>
          <div className="text-right">
            <span className={`text-sm font-semibold ${status.color}`}>
              {status.text}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full transition-all duration-500 ease-out ${getTierValue(
              progress.percentage,
              WIDGET_PROGRESS_GRADIENT,
            )}`}
            style={{ width: `${progress.percentage}%` }}
          >
            {progress.percentage >= 100 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <ChecklistModal
          progress={progress}
          onClose={onClose}
          onMilestoneClick={onMilestoneClick}
        />
      )}
    </div>
  );
}

function MilestonePreview({ milestones }) {
  const list = milestones || [];
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {list.slice(0, 5).map(
        (milestone) =>
          milestone && (
            <span
              key={milestone.id}
              className={`text-xs px-2 py-1 rounded-full ${
                milestone.completed
                  ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                  : "bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
              }`}
            >
              {milestone.completed ? "✓" : "○"}{" "}
              {(milestone.label || "").split(" ")[0]}
            </span>
          ),
      )}
      {list.length > 5 && (
        <span className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400">
          +{list.length - 5} more
        </span>
      )}
    </div>
  );
}

// Embedded view (inline in page, not fixed)
function MissionEmbedded({
  progress,
  status,
  showModal,
  onOpen,
  onClose,
  onMilestoneClick,
}) {
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        onClick={onOpen}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl border-2 border-blue-200 dark:border-blue-700 p-4 cursor-pointer hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-xl">🎖️</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white text-lg">
                Mission Readiness: {progress.percentage}%
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {progress.completedMilestones.length} of{" "}
                {progress.totalMilestones} objectives complete • Click to view
                details
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className={`text-sm font-semibold ${status.color}`}>
              {status.text}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full bg-gray-200 dark:bg-gray-600 rounded-full h-4 overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full transition-all duration-500 ease-out ${getTierValue(
              progress.percentage,
              EMBEDDED_PROGRESS_GRADIENT,
            )}`}
            style={{ width: `${progress.percentage}%` }}
          >
            {progress.percentage >= 100 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
            )}
          </div>
          {/* Percentage label inside bar - dark pill backing guarantees ≥4.5:1
             for the white text at any fill level (at low % the bar centre is over
             the light track; a drop-shadow alone isn't counted by contrast tools). */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-white bg-black/60 px-1.5 py-0.5 rounded leading-none">
              {progress.percentage}%
            </span>
          </div>
        </div>

        {/* Quick milestone preview */}
        <MilestonePreview milestones={progress.milestones} />
      </div>

      {/* Modal */}
      {showModal && (
        <ChecklistModal
          progress={progress}
          onClose={onClose}
          onMilestoneClick={onMilestoneClick}
        />
      )}
    </>
  );
}

export default function CommandersChecklist({
  isWidget = false,
  isEmbedded = false,
  onClose = null,
  onToolSelect = null,
}) {
  const { _t } = useLanguage();
  const progress = useClaimProgress();
  const [showModal, setShowModal] = useState(!isWidget && !isEmbedded);

  const handleMilestoneClick = (milestone) => {
    if (onToolSelect && TOOL_LINKS[milestone.id]) {
      onToolSelect(TOOL_LINKS[milestone.id]);
      // Close the modal when navigating to a tool
      setShowModal(false);
      if (onClose) onClose();
    }
  };

  const handleClose = () => {
    setShowModal(false);
    if (onClose) onClose();
  };

  const status = getStatusMessage(progress.percentage);

  if (isWidget) {
    return (
      <MissionWidget
        progress={progress}
        status={status}
        showModal={showModal}
        onOpen={() => setShowModal(true)}
        onClose={handleClose}
        onMilestoneClick={handleMilestoneClick}
      />
    );
  }

  if (isEmbedded) {
    return (
      <MissionEmbedded
        progress={progress}
        status={status}
        showModal={showModal}
        onOpen={() => setShowModal(true)}
        onClose={handleClose}
        onMilestoneClick={handleMilestoneClick}
      />
    );
  }

  // Full modal view
  return showModal ? (
    <ChecklistModal
      progress={progress}
      onClose={handleClose}
      onMilestoneClick={handleMilestoneClick}
    />
  ) : null;
}

function ChecklistModalHeader({ progress, onClose }) {
  return (
    <div
      className={`bg-gradient-to-r ${getTierValue(
        progress.percentage,
        MODAL_HEADER_GRADIENT,
      )} text-white p-6`}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2
            id="commanders-checklist-title"
            className="text-3xl font-bold mb-2"
          >
            🎖️ Commander&apos;s Checklist{" "}
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
              BETA
            </span>
          </h2>
          <p className="text-blue-100">
            Your mission briefing and progress tracker
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 text-2xl font-bold"
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>

      {/* Overall Progress */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-2xl font-bold">
              {progress.percentage}% Complete
            </h3>
            <p className="text-sm text-blue-100">
              {progress.completedMilestones.length} of{" "}
              {progress.totalMilestones} objectives complete
            </p>
          </div>
          <div className="text-5xl">{getMissionEmoji(progress.percentage)}</div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full bg-white/20 rounded-full h-4 overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-white transition-all duration-500 ease-out"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ChecklistStatusBanner({ status, percentage }) {
  return (
    <div
      className={`${status.bg} dark:bg-opacity-20 border-l-4 ${getTierValue(
        percentage,
        MODAL_BORDER_COLOR,
      )} p-4 rounded mb-6`}
    >
      <p className={`font-bold text-lg ${status.color} dark:opacity-90`}>
        {status.text}
      </p>
      {percentage === 100 && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          You&apos;ve completed all major milestones! Review your packet and
          you&apos;re ready to file.
        </p>
      )}
    </div>
  );
}

function MilestoneCard({ milestone, isCompleted, onMilestoneClick }) {
  return (
    <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
      onClick={() =>
        !isCompleted && onMilestoneClick && onMilestoneClick(milestone)
      }
      className={`border-2 rounded-lg p-4 transition-all ${
        isCompleted
          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
          : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 hover:border-blue-500 hover:shadow-lg cursor-pointer"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox/Icon */}
        <div className="flex-shrink-0">
          {isCompleted ? (
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              ✓
            </div>
          ) : (
            <div className="w-8 h-8 border-2 border-gray-400 dark:border-gray-600 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-600">
              <div className="w-4 h-4 bg-gray-300 dark:bg-gray-700 rounded-full" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{milestone.icon}</span>
            <h4
              className={`font-bold text-lg ${
                isCompleted
                  ? "text-green-700 dark:text-green-400"
                  : "text-gray-800 dark:text-white"
              }`}
            >
              {milestone.title}
            </h4>
          </div>
          <p
            className={`text-sm ${
              isCompleted
                ? "text-green-600 dark:text-green-400"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            {milestone.description}
          </p>

          {!isCompleted && (
            <button
              onClick={() => onMilestoneClick && onMilestoneClick(milestone)}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              Start this objective →
            </button>
          )}
        </div>

        {/* Weight indicator */}
        <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
          {milestone.weight}pts
        </div>
      </div>
    </div>
  );
}

function NextStepsPanel({ milestones, completedMilestones }) {
  return (
    <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 p-4 rounded">
      <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
        🎯 Next Steps:
      </h4>
      <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
        {milestones
          .filter((m) => !completedMilestones.includes(m.id))
          .slice(0, 3)
          .map((m) => (
            <li key={m.id}>• {m.title}</li>
          ))}
      </ul>
    </div>
  );
}

function ProTipsPanel() {
  return (
    <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
      <h4 className="font-bold text-yellow-800 dark:text-yellow-300 mb-2">
        💡 Pro Tips:
      </h4>
      <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
        <li>
          • You don&apos;t need 100% to file - but more evidence = stronger
          claim
        </li>
        <li>
          • Focus on the highest-weight items first (diagnosis, nexus,
          statement)
        </li>
        <li>• Each completed objective brings you closer to victory!</li>
        <li>• This progress is saved automatically - come back anytime</li>
      </ul>
    </div>
  );
}

// Checklist Modal Component
function ChecklistModal({ progress, onClose, onMilestoneClick }) {
  const status = getModalStatus(progress.percentage);
  const completedMilestones = progress.completedMilestones.map((m) => m.id);

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="xl"
      labelledBy="commanders-checklist-title"
      header={<ChecklistModalHeader progress={progress} onClose={onClose} />}
    >
      {/* Status Message */}
      <ChecklistStatusBanner status={status} percentage={progress.percentage} />

      {/* Milestones Grid */}
      <div className="space-y-3">
        {progress.milestones.map((milestone) => (
          <MilestoneCard
            key={milestone.id}
            milestone={milestone}
            isCompleted={completedMilestones.includes(milestone.id)}
            onMilestoneClick={onMilestoneClick}
          />
        ))}
      </div>

      {/* Next Steps */}
      {progress.percentage < 100 && (
        <NextStepsPanel
          milestones={progress.milestones}
          completedMilestones={completedMilestones}
        />
      )}

      {/* Tips */}
      <ProTipsPanel />
    </ResponsiveModal>
  );
}
