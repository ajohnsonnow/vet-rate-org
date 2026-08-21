/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * BDD Builder - Benefits Delivery at Discharge Planning Tool
 * Helps active duty service members file VA claims 180-90 days
 * before separation for same-day rating decisions.
 *
 * 38 CFR § 3.326 - Pre-discharge claims
 */

import { useState, useEffect, useMemo } from "react";
import ResponsiveModal from "./common/ResponsiveModal";
import ReportBugLink from "./ReportBugLink";
import BuyMeCoffee from "./BuyMeCoffee";
import {
  BDD_CHECKLIST,
  BDD_COMMON_MISTAKES,
  calculateBDDEligibility,
  getRelevantMilestones,
  saveBDDProgress,
  loadBDDProgress,
  getChecklistCompletion,
} from "../utils/bddData.js";
import { SERVICE_BRANCHES } from "../config/affiliations.js";

// ─────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "timeline", label: "Timeline", icon: "📅" },
  { id: "checklist", label: "Checklist", icon: "✅" },
  { id: "pitfalls", label: "Common Mistakes", icon: "⚠️" },
];

// ─────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────
function getPhaseBadge(phase) {
  if (!phase) return null;
  const badges = {
    "pre-window": { text: "PREPARING", color: "bg-blue-500" },
    "bdd-window": {
      text: "BDD WINDOW OPEN",
      color: "bg-green-500 animate-pulse",
    },
    "post-window": {
      text: "BDD CLOSED - FILE NOW",
      color: "bg-red-500 animate-pulse",
    },
    "post-separation": { text: "POST-SEPARATION", color: "bg-gray-500" },
  };
  return badges[phase] || null;
}

function getImpactBadgeClass(impact) {
  if (impact === "CRITICAL")
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (impact === "HIGH")
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
}

// Helper to format a date N days from now
function getDateNDaysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// STATE HOOK
// ─────────────────────────────────────────────────────────────
function useBDDBuilderClaimState() {
  const [savedData] = useState(() => loadBDDProgress());
  const [separationDate, setSeparationDate] = useState(
    savedData.separationDate || "",
  );
  const [branch, setBranch] = useState(savedData.branch || "");
  const [checkedItems, setCheckedItems] = useState(
    new Set(savedData.checkedItems || []),
  );
  const [conditions, setConditions] = useState(savedData.conditions || []);
  const [newCondition, setNewCondition] = useState("");

  const eligibility = useMemo(
    () => calculateBDDEligibility(separationDate),
    [separationDate],
  );

  const milestones = useMemo(
    () =>
      eligibility.daysUntilSep != null
        ? getRelevantMilestones(eligibility.daysUntilSep)
        : [],
    [eligibility.daysUntilSep],
  );

  const checklistCompletion = useMemo(
    () => getChecklistCompletion([...checkedItems]),
    [checkedItems],
  );

  useEffect(() => {
    if (
      separationDate ||
      branch ||
      checkedItems.size > 0 ||
      conditions.length > 0
    ) {
      saveBDDProgress({
        separationDate,
        branch,
        checkedItems: [...checkedItems],
        conditions,
      });
    }
  }, [separationDate, branch, checkedItems, conditions]);

  const toggleCheckItem = (id) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCondition = () => {
    const trimmed = newCondition.trim();
    if (trimmed && !conditions.includes(trimmed)) {
      setConditions((prev) => [...prev, trimmed]);
      setNewCondition("");
    }
  };

  const removeCondition = (c) => {
    setConditions((prev) => prev.filter((x) => x !== c));
  };

  return {
    separationDate,
    setSeparationDate,
    branch,
    setBranch,
    checkedItems,
    conditions,
    newCondition,
    setNewCondition,
    eligibility,
    milestones,
    checklistCompletion,
    toggleCheckItem,
    addCondition,
    removeCondition,
  };
}

function useBDDBuilderState() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [expandedMilestone, setExpandedMilestone] = useState(null);
  const [expandedMistake, setExpandedMistake] = useState(null);

  const claim = useBDDBuilderClaimState();
  const [showSetup, setShowSetup] = useState(!claim.separationDate);

  const handleSetSeparationDate = (dateStr) => {
    claim.setSeparationDate(dateStr);
    if (dateStr) setShowSetup(false);
  };

  return {
    activeTab,
    setActiveTab,
    separationDate: claim.separationDate,
    branch: claim.branch,
    setBranch: claim.setBranch,
    checkedItems: claim.checkedItems,
    conditions: claim.conditions,
    newCondition: claim.newCondition,
    setNewCondition: claim.setNewCondition,
    expandedMilestone,
    setExpandedMilestone,
    expandedMistake,
    setExpandedMistake,
    showSetup,
    setShowSetup,
    eligibility: claim.eligibility,
    milestones: claim.milestones,
    checklistCompletion: claim.checklistCompletion,
    handleSetSeparationDate,
    toggleCheckItem: claim.toggleCheckItem,
    addCondition: claim.addCondition,
    removeCondition: claim.removeCondition,
  };
}

// ══════════════════════════════════════════════════════════════
// HEADER
// ══════════════════════════════════════════════════════════════

function BDDBuilderTitleRow({ onClose, onReportBug }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🎖️</span>
        <div>
          <h2
            id="bdd-builder-title"
            className="text-xl font-bold text-white flex items-center gap-2"
          >
            BDD Builder
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
              NEW
            </span>
          </h2>
          <p className="text-sm text-emerald-100">
            Pre-Discharge Claims Planner (38 CFR § 3.326)
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ReportBugLink
          onClick={() => {
            onClose();
            onReportBug?.();
          }}
          variant="light"
          moduleName="BDD Builder"
        />
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          aria-label="Close BDD Builder"
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
  );
}

function BDDBuilderStatusBanner({
  separationDate,
  eligibility,
  checklistCompletion,
}) {
  if (!(separationDate && eligibility.phase)) return null;
  const phaseBadge = getPhaseBadge(eligibility.phase);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {phaseBadge && (
        <span
          className={`px-3 py-1 ${phaseBadge.color} text-white text-xs font-bold rounded-full`}
        >
          {phaseBadge.text}
        </span>
      )}
      {eligibility.daysUntilSep != null && eligibility.daysUntilSep >= 0 && (
        <span className="text-emerald-100 text-sm">
          {eligibility.daysUntilSep} days until separation
        </span>
      )}
      {checklistCompletion > 0 && (
        <span className="text-emerald-200 text-sm ml-auto">
          Checklist: {checklistCompletion}% complete
        </span>
      )}
    </div>
  );
}

function BDDBuilderTabBar({ activeTab, onTabChange }) {
  return (
    <div className="flex gap-1 mt-3 overflow-x-auto pb-1 -mb-4">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
            activeTab === tab.id
              ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              : "text-emerald-100 hover:bg-white/10"
          }`}
        >
          <span>{tab.icon}</span>
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

function BDDBuilderHeader({
  onClose,
  onReportBug,
  separationDate,
  eligibility,
  checklistCompletion,
  showSetup,
  activeTab,
  onTabChange,
}) {
  return (
    <div className="flex-shrink-0 bg-gradient-to-r from-green-700 via-emerald-700 to-teal-700 p-4 shadow-lg rounded-t-xl">
      <BDDBuilderTitleRow onClose={onClose} onReportBug={onReportBug} />
      <BDDBuilderStatusBanner
        separationDate={separationDate}
        eligibility={eligibility}
        checklistCompletion={checklistCompletion}
      />
      {!showSetup && (
        <BDDBuilderTabBar activeTab={activeTab} onTabChange={onTabChange} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// BODY / TAB ROUTING
// ══════════════════════════════════════════════════════════════

function ActiveTabContent({
  activeTab,
  separationDate,
  branch,
  eligibility,
  milestones,
  checkedItems,
  checklistCompletion,
  conditions,
  newCondition,
  onNewConditionChange,
  onAddCondition,
  onRemoveCondition,
  onNavigateToTool,
  onChangeDate,
  expandedMilestone,
  onToggleMilestone,
  onToggleItem,
  expandedMistake,
  onToggleMistake,
}) {
  if (activeTab === "dashboard") {
    return (
      <DashboardTab
        eligibility={eligibility}
        milestones={milestones}
        checkedItems={checkedItems}
        checklistCompletion={checklistCompletion}
        conditions={conditions}
        newCondition={newCondition}
        onNewConditionChange={onNewConditionChange}
        onAddCondition={onAddCondition}
        onRemoveCondition={onRemoveCondition}
        onNavigateToTool={onNavigateToTool}
        onChangeDate={onChangeDate}
        separationDate={separationDate}
        branch={branch}
      />
    );
  }

  if (activeTab === "timeline") {
    return (
      <TimelineTab
        milestones={milestones}
        eligibility={eligibility}
        expandedMilestone={expandedMilestone}
        onToggleMilestone={onToggleMilestone}
        onNavigateToTool={onNavigateToTool}
      />
    );
  }

  if (activeTab === "checklist") {
    return (
      <ChecklistTab
        checkedItems={checkedItems}
        onToggleItem={onToggleItem}
        completion={checklistCompletion}
      />
    );
  }

  if (activeTab === "pitfalls") {
    return (
      <PitfallsTab
        expandedMistake={expandedMistake}
        onToggleMistake={onToggleMistake}
      />
    );
  }

  return null;
}

function BDDBuilderBody({
  showSetup,
  activeTab,
  separationDate,
  branch,
  onSetDate,
  onSetBranch,
  ...tabContentProps
}) {
  return (
    <div>
      {/* ── SETUP VIEW ────────────────────────────── */}
      {showSetup && (
        <SetupView
          separationDate={separationDate}
          branch={branch}
          onSetDate={onSetDate}
          onSetBranch={onSetBranch}
        />
      )}

      {/* ── ACTIVE TAB ─────────────────────────────── */}
      {!showSetup && (
        <ActiveTabContent
          activeTab={activeTab}
          separationDate={separationDate}
          branch={branch}
          {...tabContentProps}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// BDD BUILDER COMPONENT
// ══════════════════════════════════════════════════════════════
function BDDBuilderModal({ state, onClose, onReportBug, onNavigateToTool }) {
  const {
    activeTab,
    setActiveTab,
    separationDate,
    branch,
    setBranch,
    checkedItems,
    conditions,
    newCondition,
    setNewCondition,
    expandedMilestone,
    setExpandedMilestone,
    expandedMistake,
    setExpandedMistake,
    showSetup,
    setShowSetup,
    eligibility,
    milestones,
    checklistCompletion,
    handleSetSeparationDate,
    toggleCheckItem,
    addCondition,
    removeCondition,
  } = state;

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="2xl"
      labelledBy="bdd-builder-title"
      header={
        <BDDBuilderHeader
          onClose={onClose}
          onReportBug={onReportBug}
          separationDate={separationDate}
          eligibility={eligibility}
          checklistCompletion={checklistCompletion}
          showSetup={showSetup}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      }
    >
      <BDDBuilderBody
        showSetup={showSetup}
        activeTab={activeTab}
        separationDate={separationDate}
        branch={branch}
        onSetDate={handleSetSeparationDate}
        onSetBranch={setBranch}
        eligibility={eligibility}
        milestones={milestones}
        checkedItems={checkedItems}
        checklistCompletion={checklistCompletion}
        conditions={conditions}
        newCondition={newCondition}
        onNewConditionChange={setNewCondition}
        onAddCondition={addCondition}
        onRemoveCondition={removeCondition}
        onNavigateToTool={onNavigateToTool}
        onChangeDate={() => setShowSetup(true)}
        expandedMilestone={expandedMilestone}
        onToggleMilestone={(id) =>
          setExpandedMilestone(expandedMilestone === id ? null : id)
        }
        onToggleItem={toggleCheckItem}
        expandedMistake={expandedMistake}
        onToggleMistake={(id) =>
          setExpandedMistake(expandedMistake === id ? null : id)
        }
      />
    </ResponsiveModal>
  );
}

const BDDBuilder = ({ onClose, onReportBug, onNavigateToTool }) => {
  const state = useBDDBuilderState();

  const handleToolNavigation = (toolId) => {
    if (onNavigateToTool) {
      onNavigateToTool(toolId);
    }
  };

  return (
    <>
      <BDDBuilderModal
        state={state}
        onClose={onClose}
        onReportBug={onReportBug}
        onNavigateToTool={handleToolNavigation}
      />

      {/* Buy Me a Coffee */}
      {!state.showSetup && (
        <div className="relative z-[70]">
          <BuyMeCoffee
            show={true}
            trigger="bdd-builder"
            context={{ phase: state.eligibility.phase }}
            componentKey="bdd-builder"
          />
        </div>
      )}
    </>
  );
};

// ══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════

/**
 * Setup View - first-run date picker + branch selector
 */
function BDDInfoBox() {
  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-lg p-4 mb-6">
      <h3 className="font-bold text-emerald-800 dark:text-emerald-200 mb-2 flex items-center gap-2">
        <span>📋</span> What is BDD?
      </h3>
      <ul className="text-sm text-emerald-700 dark:text-emerald-300 space-y-1.5">
        <li className="flex items-start gap-2">
          <span className="text-emerald-500 mt-0.5">&#x2713;</span>
          <span>
            File VA claims <strong>180-90 days</strong> before your separation
            date
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-500 mt-0.5">&#x2713;</span>
          <span>
            C&P exams happen{" "}
            <strong>while you&apos;re still on active duty</strong>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-500 mt-0.5">&#x2713;</span>
          <span>Rating decision comes on or near your discharge date</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-500 mt-0.5">&#x2713;</span>
          <span>
            Benefits start <strong>the day after separation</strong> - no
            waiting months
          </span>
        </li>
      </ul>
      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 italic">
        Authority: 38 CFR § 3.326 - Examinations (Pre-discharge claims)
      </p>
    </div>
  );
}

function BranchSelector({ value, onChange }) {
  return (
    <div className="mb-6">
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Service Branch
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SERVICE_BRANCHES.map((b) => (
          <button
            key={b.id}
            onClick={() => onChange(b.id)}
            className={`p-3 rounded-lg border-2 text-center transition-all text-sm ${
              value === b.id
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200"
                : "border-gray-200 dark:border-gray-600 hover:border-emerald-300 text-gray-700 dark:text-gray-300"
            }`}
          >
            <span className="text-2xl block mb-1">{b.icon}</span>
            <span className="text-xs font-medium">{b.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const SetupView = ({ separationDate, branch, onSetDate, onSetBranch }) => {
  const [localDate, setLocalDate] = useState(separationDate || "");
  const [localBranch, setLocalBranch] = useState(branch || "");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl block mb-4">🎖️</span>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Benefits Delivery at Discharge (BDD)
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
          File your VA disability claim <strong>before</strong> you separate.
          Get your rating decision on or near your discharge date, so benefits
          start the day after you hang up the uniform.
        </p>
      </div>

      <BDDInfoBox />

      <BranchSelector value={localBranch} onChange={setLocalBranch} />

      {/* Date Picker */}
      <div className="mb-6">
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Separation / ETS Date
        </label>
        <input
          type="date"
          aria-label="Separation or ETS date"
          value={localDate}
          onChange={(e) => setLocalDate(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Enter your anticipated discharge or ETS date
        </p>
      </div>

      {/* Launch Button */}
      <button
        onClick={() => {
          onSetBranch(localBranch);
          onSetDate(localDate);
        }}
        disabled={!localDate}
        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-lg rounded-lg hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
      >
        🚀 Launch BDD Builder
      </button>
    </div>
  );
};

/**
 * Dashboard Tab - at-a-glance overview
 */
function EligibilityStatusCard({
  eligibility,
  checklistCompletion,
  onChangeDate,
}) {
  let cardClass;
  let headingClass;
  let headingText;
  if (eligibility.eligible) {
    cardClass =
      "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700";
    headingClass = "text-green-800 dark:text-green-200";
    headingText = "✅ You Are Eligible for BDD!";
  } else if (eligibility.phase === "pre-window") {
    cardClass =
      "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700";
    headingClass = "text-blue-800 dark:text-blue-200";
    headingText = "📋 Preparation Phase";
  } else {
    cardClass =
      "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700";
    headingClass = "text-red-800 dark:text-red-200";
    headingText = "⚠️ BDD Window Status";
  }

  return (
    <div className={`rounded-xl p-5 border-2 ${cardClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className={`text-lg font-bold ${headingClass}`}>{headingText}</h3>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {eligibility.reason}
          </p>
        </div>
        <button
          onClick={onChangeDate}
          className="text-sm px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
        >
          Change Date
        </button>
      </div>

      {/* Countdown */}
      {eligibility.daysUntilSep != null && eligibility.daysUntilSep >= 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <CountdownCard
            number={eligibility.daysUntilSep}
            label="Days to ETS"
            color="text-gray-900 dark:text-white"
          />
          {eligibility.eligible && (
            <CountdownCard
              number={eligibility.daysLeft}
              label="BDD Days Left"
              color={
                eligibility.daysLeft < 30 ? "text-red-600" : "text-green-600"
              }
            />
          )}
          {eligibility.daysUntilWindowOpens > 0 && (
            <CountdownCard
              number={eligibility.daysUntilWindowOpens}
              label="Until BDD Opens"
              color="text-blue-600"
            />
          )}
          <CountdownCard
            number={checklistCompletion}
            label="% Checklist Done"
            color="text-emerald-600"
            suffix="%"
          />
        </div>
      )}
    </div>
  );
}

function ConditionsQuickStats({
  nextMilestone,
  conditions,
  checkedItems,
  checklistCompletion,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Next Action */}
      {nextMilestone && (
        <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4 border-l-4 border-emerald-500">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">
            Next Action
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{nextMilestone.icon}</span>
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              {nextMilestone.title}
            </span>
          </div>
          {nextMilestone.critical && (
            <span className="mt-1 inline-block px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded-full font-bold">
              CRITICAL
            </span>
          )}
        </div>
      )}

      {/* Conditions Count */}
      <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4 border-l-4 border-blue-500">
        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">
          Conditions to Claim
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {conditions.length}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {conditions.length === 0
            ? "Add conditions below"
            : "conditions tracked"}
        </p>
      </div>

      {/* Checklist Progress */}
      <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4 border-l-4 border-amber-500">
        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">
          Checklist Progress
        </div>
        <div className="flex items-end gap-2">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {checkedItems.size}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">
            / {BDD_CHECKLIST.length}
          </div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-2">
          <div
            className="bg-amber-500 h-2 rounded-full transition-all"
            style={{ width: `${checklistCompletion}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ConditionChip({ condition, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 rounded-full text-sm border border-emerald-200 dark:border-emerald-700">
      {condition}
      <button
        onClick={() => onRemove(condition)}
        className="hover:text-red-500 transition-colors"
        aria-label={`Remove ${condition}`}
      >
        <svg
          className="w-3.5 h-3.5"
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
    </span>
  );
}

function ConditionsList({ conditions, onRemoveCondition }) {
  if (conditions.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 italic">
        No conditions added yet. Start by adding your known conditions.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {conditions.map((c) => (
        <ConditionChip key={c} condition={c} onRemove={onRemoveCondition} />
      ))}
    </div>
  );
}

function ConditionsTrackerToolLinks({ onNavigateToTool }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <ToolLink
        icon="🔍"
        label="Secondary Scout"
        onClick={() => onNavigateToTool("secondary-scout")}
      />
      <ToolLink
        icon="🎖️"
        label="MOS Hazard Matcher"
        onClick={() => onNavigateToTool("mos-hazard")}
      />
      <ToolLink
        icon="☢️"
        label="PACT Act Navigator"
        onClick={() => onNavigateToTool("pact-act")}
      />
      <ToolLink
        icon="🕸️"
        label="Web of Conditions"
        onClick={() => onNavigateToTool("web-of-conditions")}
      />
    </div>
  );
}

function ConditionsTracker({
  conditions,
  newCondition,
  onNewConditionChange,
  onAddCondition,
  onRemoveCondition,
  onNavigateToTool,
}) {
  return (
    <div className="bg-white dark:bg-gray-700 rounded-xl shadow p-5">
      <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        🩺 My Conditions to Claim
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Track the conditions you plan to file. Use{" "}
        <button
          onClick={() => onNavigateToTool("secondary-scout")}
          className="text-emerald-600 dark:text-emerald-400 underline font-medium hover:text-emerald-500"
        >
          Secondary Scout
        </button>{" "}
        and{" "}
        <button
          onClick={() => onNavigateToTool("mos-hazard")}
          className="text-emerald-600 dark:text-emerald-400 underline font-medium hover:text-emerald-500"
        >
          MOS Hazard Matcher
        </button>{" "}
        to find conditions you may be missing.
      </p>

      {/* Add condition input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newCondition}
          onChange={(e) => onNewConditionChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAddCondition()}
          placeholder="e.g., Lumbar Strain, Tinnitus, PTSD..."
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={onAddCondition}
          disabled={!newCondition.trim()}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>

      {/* Conditions list */}
      <ConditionsList
        conditions={conditions}
        onRemoveCondition={onRemoveCondition}
      />

      {/* Tool Links */}
      <ConditionsTrackerToolLinks onNavigateToTool={onNavigateToTool} />
    </div>
  );
}

function KeyDatesCard({ eligibility, separationDate }) {
  return (
    <div className="bg-white dark:bg-gray-700 rounded-xl shadow p-5">
      <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        📅 Key Dates
      </h3>
      <div className="space-y-3">
        <DateRow
          label="Today"
          date={new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          icon="📍"
          highlight
        />
        {eligibility.daysUntilWindowOpens > 0 && (
          <DateRow
            label="BDD Window Opens"
            date={getDateNDaysFromNow(eligibility.daysUntilWindowOpens)}
            icon="🟢"
            subLabel={`${eligibility.daysUntilWindowOpens} days`}
          />
        )}
        {eligibility.eligible && (
          <DateRow
            label="BDD Window Closes"
            date={getDateNDaysFromNow(eligibility.daysLeft)}
            icon="🔴"
            subLabel={`${eligibility.daysLeft} days left`}
            warn={eligibility.daysLeft < 30}
          />
        )}
        <DateRow
          label="Separation / ETS Date"
          date={new Date(separationDate + "T00:00:00").toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" },
          )}
          icon="🎖️"
          subLabel={`${eligibility.daysUntilSep} days`}
        />
      </div>
    </div>
  );
}

const DashboardTab = ({
  eligibility,
  milestones,
  checkedItems,
  checklistCompletion,
  conditions,
  newCondition,
  onNewConditionChange,
  onAddCondition,
  onRemoveCondition,
  onNavigateToTool,
  onChangeDate,
  separationDate,
  _branch,
}) => {
  // Find the next actionable milestone
  const nextMilestone =
    milestones.find((m) => m.isCurrent) || milestones.find((m) => m.isUpcoming);

  return (
    <div className="space-y-6">
      <EligibilityStatusCard
        eligibility={eligibility}
        checklistCompletion={checklistCompletion}
        onChangeDate={onChangeDate}
      />

      <ConditionsQuickStats
        nextMilestone={nextMilestone}
        conditions={conditions}
        checkedItems={checkedItems}
        checklistCompletion={checklistCompletion}
      />

      <ConditionsTracker
        conditions={conditions}
        newCondition={newCondition}
        onNewConditionChange={onNewConditionChange}
        onAddCondition={onAddCondition}
        onRemoveCondition={onRemoveCondition}
        onNavigateToTool={onNavigateToTool}
      />

      {eligibility.daysUntilSep != null && eligibility.daysUntilSep >= 0 && (
        <KeyDatesCard
          eligibility={eligibility}
          separationDate={separationDate}
        />
      )}
    </div>
  );
};

/**
 * Timeline Tab - visual milestone tracker
 */
function MilestoneDetails({ milestone: m, onNavigateToTool }) {
  return (
    <div className="mt-2 ml-2 p-4 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-600">
      {m.details && (
        <ul className="space-y-1.5 mb-3">
          {m.details.map((d, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <span className="text-emerald-500 mt-0.5 flex-shrink-0">
                &#x2713;
              </span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
      {m.cfr && (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">
          Authority: {m.cfr}
        </p>
      )}
      {m.tools && m.tools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Vet-Rate Tools:
          </span>
          {m.tools.map((toolId) => (
            <button
              key={toolId}
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToTool(toolId);
              }}
              className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800/40 transition-colors font-medium"
            >
              Open{" "}
              {toolId
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getMilestoneItemStyles(m) {
  let dotClass;
  if (m.isPast) {
    dotClass = "bg-green-500 border-green-500";
  } else if (m.isCurrent) {
    dotClass =
      "bg-amber-500 border-amber-500 ring-4 ring-amber-200 dark:ring-amber-900";
  } else {
    dotClass = "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500";
  }

  let cardBorderClass;
  if (m.isCurrent) {
    cardBorderClass =
      "border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20";
  } else if (m.isPast) {
    cardBorderClass =
      "border-green-200 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10";
  } else {
    cardBorderClass =
      "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700";
  }

  let daysLabel;
  if (m.daysBeforeSep > 0) {
    daysLabel = `${m.daysBeforeSep}d before`;
  } else if (m.daysBeforeSep === 0) {
    daysLabel = "ETS Day";
  } else {
    daysLabel = `${Math.abs(m.daysBeforeSep)}d after`;
  }

  return { dotClass, cardBorderClass, daysLabel };
}

function MilestoneCardHeader({ m, isExpanded, daysLabel }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xl">{m.icon}</span>
        <div>
          <span className="font-semibold text-gray-900 dark:text-white text-sm">
            {m.title}
          </span>
          {m.critical && (
            <span className="ml-2 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-bold rounded">
              CRITICAL
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {daysLabel}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}

function MilestoneItem({
  milestone: m,
  isExpanded,
  onToggle,
  onNavigateToTool,
}) {
  const { dotClass, cardBorderClass, daysLabel } = getMilestoneItemStyles(m);

  return (
    <div className="relative pl-14">
      {/* Timeline dot */}
      <div
        className={`absolute left-4 w-5 h-5 rounded-full border-2 ${dotClass}`}
      />

      <button
        onClick={onToggle}
        className={`w-full text-left rounded-lg border-2 p-4 transition-all hover:shadow-md ${cardBorderClass} ${m.critical ? "ring-2 ring-red-200 dark:ring-red-900" : ""}`}
      >
        <MilestoneCardHeader
          m={m}
          isExpanded={isExpanded}
          daysLabel={daysLabel}
        />
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {m.description}
        </p>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <MilestoneDetails milestone={m} onNavigateToTool={onNavigateToTool} />
      )}
    </div>
  );
}

const TimelineTab = ({
  milestones,
  _eligibility,
  expandedMilestone,
  onToggleMilestone,
  onNavigateToTool,
}) => (
  <div className="max-w-3xl mx-auto">
    <div className="mb-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
        BDD Timeline
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Step-by-step milestones from preparation through post-separation. Green
        means completed, amber means current, and gray means upcoming.
      </p>
    </div>

    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600" />

      <div className="space-y-4">
        {milestones.map((m) => (
          <MilestoneItem
            key={m.id}
            milestone={m}
            isExpanded={expandedMilestone === m.id}
            onToggle={() => onToggleMilestone(m.id)}
            onNavigateToTool={onNavigateToTool}
          />
        ))}
      </div>
    </div>
  </div>
);

/**
 * Checklist Tab - interactive checklist with toggle-able categories
 */
const CHECKLIST_CATEGORIES = [
  { id: "eligibility", label: "Eligibility", icon: "🎯" },
  { id: "documents", label: "Documents", icon: "📄" },
  { id: "preparation", label: "Preparation", icon: "📋" },
  { id: "filing", label: "Filing", icon: "📬" },
  { id: "evidence", label: "Evidence", icon: "📎" },
  { id: "exams", label: "C&P Exams", icon: "🏥" },
  { id: "transition", label: "Transition", icon: "🎓" },
];

function ChecklistProgressHeader({ completion }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          BDD Pre-Discharge Checklist
        </h3>
        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {completion}% Complete
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
        <div
          className={`h-3 rounded-full transition-all ${
            completion === 100 ? "bg-green-500" : "bg-emerald-500"
          }`}
          style={{ width: `${completion}%` }}
        />
      </div>
    </div>
  );
}

function ChecklistItemRow({ item, checked, onToggle }) {
  return (
    <label /* eslint-disable-line jsx-a11y/label-has-associated-control */
      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
        checked
          ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
          : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 w-5 h-5 rounded border-gray-300 dark:border-gray-500 text-emerald-600 focus:ring-emerald-500"
      />
      <div className="flex-1">
        <span
          className={`font-medium text-sm ${
            checked
              ? "text-green-800 dark:text-green-200 line-through"
              : "text-gray-900 dark:text-white"
          }`}
        >
          {item.label}
          {item.required && (
            <span className="ml-1 text-red-500 text-xs font-bold">
              *Required
            </span>
          )}
        </span>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {item.helpText}
        </p>
      </div>
    </label>
  );
}

function ChecklistCategory({ category, checkedItems, onToggleItem }) {
  const items = BDD_CHECKLIST.filter((i) => i.category === category.id);
  if (items.length === 0) return null;
  const catDone = items.every((i) => checkedItems.has(i.id));

  return (
    <div>
      <h4
        className={`text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${
          catDone
            ? "text-green-600 dark:text-green-400"
            : "text-gray-600 dark:text-gray-400"
        }`}
      >
        <span>{category.icon}</span>
        {category.label}
        {catDone && <span className="text-green-500">&#x2714;</span>}
      </h4>
      <div className="space-y-2">
        {items.map((item) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            checked={checkedItems.has(item.id)}
            onToggle={() => onToggleItem(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

const ChecklistTab = ({ checkedItems, onToggleItem, completion }) => (
  <div className="max-w-3xl mx-auto">
    <ChecklistProgressHeader completion={completion} />

    <div className="space-y-6">
      {CHECKLIST_CATEGORIES.map((cat) => (
        <ChecklistCategory
          key={cat.id}
          category={cat}
          checkedItems={checkedItems}
          onToggleItem={onToggleItem}
        />
      ))}
    </div>
  </div>
);

/**
 * Pitfalls Tab - common mistakes to avoid
 */
const PitfallsTab = ({ expandedMistake, onToggleMistake }) => (
  <div className="max-w-3xl mx-auto">
    <div className="mb-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
        Common BDD Mistakes to Avoid
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        These are the mistakes that cost transitioning service members thousands
        in lost benefits. Don&apos;t make them.
      </p>
    </div>

    <div className="space-y-3">
      {BDD_COMMON_MISTAKES.map((mistake) => {
        const isExpanded = expandedMistake === mistake.id;
        return (
          <div
            key={mistake.id}
            className="rounded-lg border-2 border-gray-200 dark:border-gray-600 overflow-hidden"
          >
            <button
              onClick={() => onToggleMistake(mistake.id)}
              className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded ${getImpactBadgeClass(mistake.impact)}`}
                >
                  {mistake.impact}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white text-sm">
                  {mistake.title}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600 pt-3">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  {mistake.description}
                </p>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-700">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                    Fix:{" "}
                  </span>
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">
                    {mistake.fix}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// SMALL REUSABLE COMPONENTS
// ══════════════════════════════════════════════════════════════

const CountdownCard = ({ number, label, color, suffix = "" }) => (
  <div className="bg-white dark:bg-gray-700 rounded-lg p-3 text-center border border-gray-200 dark:border-gray-600">
    <div className={`text-2xl font-bold ${color}`}>
      {number}
      {suffix}
    </div>
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
  </div>
);

const DateRow = ({ label, date, icon, subLabel, highlight, warn }) => {
  let containerClass = "";
  if (highlight) {
    containerClass = "bg-emerald-50 dark:bg-emerald-900/20";
  } else if (warn) {
    containerClass = "bg-red-50 dark:bg-red-900/20";
  }

  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg ${containerClass}`}>
      <span className="text-lg">{icon}</span>
      <div className="flex-1">
        <span className="font-medium text-gray-900 dark:text-white text-sm">
          {label}
        </span>
        {subLabel && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            ({subLabel})
          </span>
        )}
      </div>
      <span
        className={`text-sm font-mono ${warn ? "text-red-600 font-bold" : "text-gray-700 dark:text-gray-300"}`}
      >
        {date}
      </span>
    </div>
  );
};

const ToolLink = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors border border-gray-200 dark:border-gray-500"
  >
    <span>{icon}</span>
    {label}
  </button>
);

export default BDDBuilder;
