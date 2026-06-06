/**
 * Vet-Rate.org - Intelligence Briefing (Field Review)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * Post-document-drop review modal where veterans review ALL extracted
 * information before it's committed to My Packet. Think of it as the
 * "Intel Brief" before the mission - one last chance to verify, edit,
 * and resolve discrepancies.
 *
 * Military Term: "Intelligence Briefing" - Pre-mission review of all intel
 */

import { useState, useEffect, useId } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";
import {
  loadVKB,
  saveVKB,
  mergeMusterCallIntoVKB,
} from "../utils/veteranKnowledgeBase";

/**
 * Intelligence Briefing - Field Review Modal
 * Shows all extracted data from Muster Call for review/editing
 *
 * @param {boolean} isOpen - Whether modal is visible
 * @param {function} onClose - Callback when modal closes
 * @param {object} extractedData - All data extracted from documents
 * @param {function} onConfirm - Callback when veteran confirms data (commits to My Packet)
 * @param {function} onEdit - Callback when veteran edits a field
 */
export default function IntelligenceBriefing({
  isOpen,
  onClose,
  extractedData = {},
  onConfirm,
  onEdit,
}) {
  const { t } = useLanguage();

  const [editableData, setEditableData] = useState(extractedData);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [activeSection, setActiveSection] = useState("personal");
  const [showDiscardWarning, setShowDiscardWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEditableData(extractedData);
      // Analyze for discrepancies
      const found = findDiscrepancies(extractedData);
      setDiscrepancies(found);
    }
  }, [isOpen, extractedData]);

  /**
   * Find discrepancies in extracted data
   * (e.g., conflicting dates, multiple values for same field)
   */
  const findDiscrepancies = (data) => {
    const issues = [];

    // Check for multiple DOBs
    if (data.dob && Array.isArray(data.dob) && data.dob.length > 1) {
      issues.push({
        field: "dob",
        type: "multiple_values",
        values: data.dob,
        message: "Found multiple dates of birth in documents",
      });
    }

    // Check for multiple service dates
    if (
      data.serviceStart &&
      Array.isArray(data.serviceStart) &&
      data.serviceStart.length > 1
    ) {
      issues.push({
        field: "serviceStart",
        type: "multiple_values",
        values: data.serviceStart,
        message: "Multiple service start dates detected",
      });
    }

    // Check for conflicting disability ratings
    if (data.conditions && Array.isArray(data.conditions)) {
      const ratingConflicts = {};
      data.conditions.forEach((cond) => {
        if (cond.rating && ratingConflicts[cond.name]) {
          if (ratingConflicts[cond.name] !== cond.rating) {
            issues.push({
              field: `condition_${cond.name}`,
              type: "conflicting_ratings",
              values: [ratingConflicts[cond.name], cond.rating],
              message: `"${cond.name}" has conflicting ratings`,
            });
          }
        }
        if (cond.rating) ratingConflicts[cond.name] = cond.rating;
      });
    }

    return issues;
  };

  /**
   * Handle field edit
   */
  const handleFieldEdit = (section, field, value) => {
    const updated = { ...editableData };
    if (!updated[section]) updated[section] = {};
    updated[section][field] = value;
    setEditableData(updated);

    if (onEdit) {
      onEdit(section, field, value);
    }
  };

  /**
   * Handle resolving a discrepancy
   */
  const resolveDiscrepancy = (discrepancy, chosenValue) => {
    const updated = { ...editableData };
    updated[discrepancy.field] = chosenValue;
    setEditableData(updated);

    // Remove from discrepancies list
    setDiscrepancies((prev) =>
      prev.filter((d) => d.field !== discrepancy.field),
    );
  };

  /**
   * Confirm and commit to My Packet
   */
  const handleConfirm = async () => {
    if (discrepancies.length > 0) {
      const proceed = window.confirm(
        `⚠️ You have ${discrepancies.length} unresolved discrepancy(ies). Proceed anyway?`,
      );
      if (!proceed) return;
    }

    // Build Veteran Knowledge Base from extracted data
    try {
      let vkb = await loadVKB();
      vkb = mergeMusterCallIntoVKB(vkb, editableData);
      await saveVKB(vkb);
      console.log("✅ VKB updated with Muster Call data");
    } catch (err) {
      console.error("Error updating VKB:", err);
      // Don't block confirmation if VKB fails
    }

    if (onConfirm) {
      onConfirm(editableData);
    }
  };

  /**
   * Sections for the briefing
   */
  const sections = [
    { id: "personal", label: "👤 Personal Info", icon: "🪪" },
    { id: "service", label: "🎖️ Service History", icon: "🎖️" },
    { id: "conditions", label: "🏥 Conditions", icon: "🏥" },
    { id: "medical", label: "📋 Medical Records", icon: "📋" },
    { id: "documents", label: "📄 Documents", icon: "📄" },
  ];

  if (!isOpen) return null;

  const header = (
    <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur sm:flex">
          <span className="text-4xl">📋</span>
        </div>
        <div className="min-w-0">
          <h2
            id="intel-briefing-title"
            className="flex items-center gap-2 text-lg font-bold text-white sm:text-2xl"
          >
            Intelligence Briefing
            <span className="rounded bg-red-500 px-2 py-0.5 text-xs font-bold uppercase text-white">
              CLASSIFIED
            </span>
          </h2>
          <p className="text-xs text-amber-100 sm:text-sm">
            Review all extracted data before committing to your packet
          </p>
        </div>
      </div>
      <button
        onClick={() => setShowDiscardWarning(true)}
        className="shrink-0 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
        aria-label="Close dialog"
      >
        <svg
          className="h-6 w-6"
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

  const footer = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📊</span>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {Object.keys(editableData).length} Fields Extracted
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {discrepancies.length > 0
              ? `${discrepancies.length} discrepancies remaining`
              : "All clear - ready to commit"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowDiscardWarning(true)}
          className="rounded-xl bg-gray-200 px-6 py-3 font-bold text-gray-800 transition-all hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-3 font-bold text-white shadow-lg transition-all hover:from-green-500 hover:to-emerald-500 hover:shadow-xl"
        >
          <span>✅</span>
          <span>Commit to My Packet</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={() => setShowDiscardWarning(true)}
        header={header}
        footer={footer}
        labelledBy="intel-briefing-title"
        size="2xl"
        className="border-2 border-amber-200 dark:border-amber-500/30"
      >
        {/* Discrepancies Warning */}
        {discrepancies.length > 0 && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500 dark:bg-red-900/30">
            <div className="flex items-center gap-3">
              <span className="animate-pulse text-3xl">⚠️</span>
              <div>
                <p className="font-bold text-red-700 dark:text-red-200">
                  {discrepancies.length} Discrepancy(ies) Detected
                </p>
                <p className="text-sm text-red-600 dark:text-red-300">
                  Multiple values found for some fields. Review and select the
                  correct one.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row">
          {/* Sidebar Navigation */}
          <nav className="flex gap-2 overflow-x-auto md:max-h-[55vh] md:w-56 md:shrink-0 md:flex-col md:overflow-x-visible md:overflow-y-auto md:border-r md:border-gray-200 md:pr-3 dark:md:border-slate-700">
            <p className="hidden text-xs font-bold uppercase text-gray-500 dark:text-slate-400 md:mb-1 md:block">
              Briefing Sections
            </p>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-3 transition-all md:mb-1 md:w-full md:gap-3 ${
                  activeSection === section.id
                    ? "bg-amber-500 font-bold text-white"
                    : "text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700/50"
                }`}
              >
                <span className="text-xl">{section.icon}</span>
                <span className="text-sm">{section.label}</span>
              </button>
            ))}
          </nav>

          {/* Main Content Area */}
          <div className="min-w-0 flex-1 md:max-h-[55vh] md:overflow-y-auto">
            {/* Discrepancies Section */}
            {discrepancies.length > 0 && (
              <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 p-4 dark:border-red-500/50 dark:bg-red-900/20">
                <h3 className="mb-3 text-lg font-bold text-red-700 dark:text-red-200">
                  🚨 Resolve Discrepancies First
                </h3>
                {discrepancies.map((disc, idx) => (
                  <div
                    key={idx}
                    className="mb-4 rounded-lg bg-gray-100 p-3 dark:bg-slate-800/50"
                  >
                    <p className="mb-2 text-sm font-bold text-gray-900 dark:text-white">
                      {disc.message}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {disc.values.map((value, vIdx) => (
                        <button
                          key={vIdx}
                          onClick={() => resolveDiscrepancy(disc, value)}
                          className="rounded-lg bg-gray-200 p-3 text-left text-gray-900 transition-all hover:bg-amber-500 hover:text-white dark:bg-slate-700 dark:text-white"
                        >
                          <p className="font-mono text-sm">{value}</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                            Click to select
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dynamic content based on active section */}
            {activeSection === "personal" && (
              <div>
                <h3 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                  👤 Personal Information
                </h3>
                <div className="space-y-4">
                  <Field
                    label="Full Name"
                    value={editableData.fullName || ""}
                    onChange={(val) =>
                      handleFieldEdit("personal", "fullName", val)
                    }
                  />
                  <Field
                    label="Date of Birth"
                    value={editableData.dob || ""}
                    onChange={(val) => handleFieldEdit("personal", "dob", val)}
                    type="date"
                  />
                  <Field
                    label="SSN (Last 4)"
                    value={editableData.ssnLast4 || ""}
                    onChange={(val) =>
                      handleFieldEdit("personal", "ssnLast4", val)
                    }
                    maxLength={4}
                  />
                  <Field
                    label="VA File Number"
                    value={editableData.vaFileNumber || ""}
                    onChange={(val) =>
                      handleFieldEdit("personal", "vaFileNumber", val)
                    }
                  />
                </div>
              </div>
            )}

            {activeSection === "service" && (
              <div>
                <h3 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                  🎖️ Service History
                </h3>
                <div className="space-y-4">
                  <Field
                    label="Branch"
                    value={editableData.branch || ""}
                    onChange={(val) =>
                      handleFieldEdit("service", "branch", val)
                    }
                  />
                  <Field
                    label="Service Start Date"
                    value={editableData.serviceStart || ""}
                    onChange={(val) =>
                      handleFieldEdit("service", "serviceStart", val)
                    }
                    type="date"
                  />
                  <Field
                    label="Service End Date"
                    value={editableData.serviceEnd || ""}
                    onChange={(val) =>
                      handleFieldEdit("service", "serviceEnd", val)
                    }
                    type="date"
                  />
                  <Field
                    label="Character of Service"
                    value={editableData.characterOfService || ""}
                    onChange={(val) =>
                      handleFieldEdit("service", "characterOfService", val)
                    }
                  />
                </div>
              </div>
            )}

            {activeSection === "conditions" && (
              <div>
                <h3 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                  🏥 Service-Connected Conditions
                </h3>
                {editableData.conditions &&
                editableData.conditions.length > 0 ? (
                  <div className="space-y-3">
                    {editableData.conditions.map((condition, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">
                              {condition.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              {condition.diagnosticCode || "No code"}
                            </p>
                          </div>
                          <span className="rounded-full bg-blue-500 px-3 py-1 font-bold text-white">
                            {condition.rating}%
                          </span>
                        </div>
                        {condition.effectiveDate && (
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            Effective: {condition.effectiveDate}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="italic text-gray-500 dark:text-slate-400">
                    No conditions extracted from documents
                  </p>
                )}
              </div>
            )}

            {/* Add more sections as needed */}
          </div>
        </div>
      </ResponsiveModal>

      {/* Discard Warning Modal */}
      <ResponsiveModal
        isOpen={showDiscardWarning}
        onClose={() => setShowDiscardWarning(false)}
        title="⚠️ Discard Changes?"
        size="sm"
        zIndex={70}
        className="border-2 border-red-300 dark:border-red-500"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowDiscardWarning(false)}
              className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-800 transition-colors hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
            >
              Keep Editing
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-bold text-white transition-colors hover:bg-red-500"
            >
              Discard & Close
            </button>
          </div>
        }
      >
        <p className="text-gray-700 dark:text-slate-300">
          You haven't committed this data to your packet yet. If you close now,
          all extracted information will be lost.
        </p>
      </ResponsiveModal>
    </>
  );
}

/**
 * Reusable field component
 */
function Field({ label, value, onChange, type = "text", maxLength }) {
  const inputId = useId();
  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-2 block text-sm font-bold text-gray-700 dark:text-slate-300"
      >
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
      />
    </div>
  );
}
