/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * FeatureRequest Component
 * Modal to capture feature ideas and suggestions from veterans
 * Uses the same infrastructure as BugSquasher for reliable storage and notification
 *
 * Built by a fellow veteran. "Your ideas make us stronger."
 */

import { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { getSystemInfo, copyToClipboard } from "../utils/bugReportUtils";
import {
  saveFeatureRequest,
  generateFeatureId,
  saveFeatureToLocalStorage,
} from "../utils/featureRequestStorage";
import ResponsiveModal from "./common/ResponsiveModal";
import { scrubText } from "../utils/piiScrubber";

// Developer support contact, shown to the user only if a remote send fails.
const DEVELOPER_EMAIL = "Anth@StructuredForGrowth.com";

// RT1-2: optional remote feedback endpoint (e.g. a FormSubmit.co URL), configured
// via VITE_FEATURE_REQUEST_ENDPOINT. Unset/empty = NO remote send — the request
// saves locally only and no user content leaves the device. This previously
// hardcoded a third-party broker URL + the developer's email and POSTed user
// free-text + email on every submit, undisclosed.
const FORMSUBMIT_URL = import.meta.env.VITE_FEATURE_REQUEST_ENDPOINT ?? "";

// Feature request categories - keys for translation
const FEATURE_CATEGORY_KEYS = [
  "NEW_TOOL",
  "ENHANCEMENT",
  "UI_UX",
  "ACCESSIBILITY",
  "INTEGRATION",
  "MOBILE",
  "DATA",
  "DOCUMENTATION",
  "OTHER",
];

// Priority levels - keys for translation
const PRIORITY_LEVEL_KEYS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const PRIORITY_EMOJIS = {
  CRITICAL: "🔥",
  HIGH: "⚡",
  MEDIUM: "💡",
  LOW: "💭",
};
const PRIORITY_VALUES = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

// Modules for context - keys for translation
const APP_MODULE_KEYS = [
  "SEARCH",
  "CAP_SIMULATOR",
  "NEXUS_BUILDER",
  "MY_PACKET",
  "SECONDARY_SCOUT",
  "TACTICAL_CALCULATOR",
  "CFILE_ANALYZER",
  "FORMS_HELPER",
  "VSO_FINDER",
  "GENERAL",
  "OTHER",
];

function FeatureRequest({ onClose, appState = {}, onOpenRoadmap }) {
  const { t } = useLanguage();

  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [generatedReport, setGeneratedReport] = useState("");
  const [featureId, setFeatureId] = useState("");
  const [emailError, setEmailError] = useState("");

  // Strict email validation regex
  const isValidEmail = (email) => {
    if (!email || email.trim() === "") return true; // Empty is OK (optional field)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  };

  // Form state
  const [formData, setFormData] = useState({
    module: appState.currentModule || "GENERAL",
    category: "",
    priority: null,
    title: "",
    description: "",
    problemSolved: "",
    proposedSolution: "",
    alternativesConsidered: "",
    additionalContext: "",
    saveToMyTickets: true, // Save to My Packet for tracking
    veteranEmail: "", // Optional email for follow-up
  });

  // Generate feature ID on mount
  useEffect(() => {
    setFeatureId(generateFeatureId());
  }, []);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Validate email when it changes
    if (field === "veteranEmail") {
      if (value && value.trim() !== "" && !isValidEmail(value)) {
        setEmailError(t("featureRequest", "emailInvalidError"));
      } else {
        setEmailError("");
      }
    }
  };

  const formatFeatureRequest = () => {
    const systemInfo = getSystemInfo();
    const timestamp = new Date().toISOString();
    const priorityLabel = formData.priority
      ? t("featureRequest", `priority${formData.priority}Label`)
      : t("featureRequest", "notSpecified");
    const priorityEmoji = formData.priority
      ? PRIORITY_EMOJIS[formData.priority]
      : "";
    const moduleLabel = formData.module
      ? t("featureRequest", `module${formData.module}`)
      : "";
    const categoryLabel = formData.category
      ? t("featureRequest", `category${formData.category}`)
      : "";

    return `
╔══════════════════════════════════════════════════════════════╗
║              💡 VET-RATE.ORG FEATURE REQUEST                 ║
╠══════════════════════════════════════════════════════════════╣
║  Request ID: ${featureId}
║  Submitted: ${timestamp}
╚══════════════════════════════════════════════════════════════╝

📋 REQUEST DETAILS
───────────────────────────────────────────────────────────────
Title: ${formData.title}
Category: ${categoryLabel}
Priority: ${priorityLabel} ${priorityEmoji}
Related Module: ${moduleLabel}

📝 DESCRIPTION
───────────────────────────────────────────────────────────────
${formData.description}

🎯 PROBLEM THIS WOULD SOLVE
───────────────────────────────────────────────────────────────
${formData.problemSolved || t("featureRequest", "notSpecified")}

💭 PROPOSED SOLUTION
───────────────────────────────────────────────────────────────
${formData.proposedSolution || t("featureRequest", "notSpecified")}

🔄 ALTERNATIVES CONSIDERED
───────────────────────────────────────────────────────────────
${formData.alternativesConsidered || t("featureRequest", "noneMentioned")}

📎 ADDITIONAL CONTEXT
───────────────────────────────────────────────────────────────
${formData.additionalContext || t("common", "none")}

🖥️ SYSTEM INFO
───────────────────────────────────────────────────────────────
Browser: ${systemInfo.browser}
Screen: ${systemInfo.screenResolution}
App Version: ${systemInfo.appVersion}

📎 END OF FEATURE REQUEST
───────────────────────────────────────────────────────────────
${t("featureRequest", "thankYouMessage")}
`.trim();
  };

  const handleGenerateReport = () => {
    const report = formatFeatureRequest();
    setGeneratedReport(report);
    setStep(3);
  };

  // Submit feature request via FormSubmit.co API (no email client needed!) and optionally save locally
  const handleSubmitRequest = async () => {
    setSubmitting(true);
    setSubmitError("");

    try {
      // === Save to local database if user wants to track ===
      if (formData.saveToMyTickets) {
        try {
          const systemInfo = getSystemInfo();

          await saveFeatureRequest({
            request_id: featureId,
            priority: PRIORITY_VALUES[formData.priority] || "medium",
            category: formData.category,
            module: formData.module,
            title: formData.title,
            description: formData.description,
            problemSolved: formData.problemSolved,
            proposedSolution: formData.proposedSolution,
            alternativesConsidered: formData.alternativesConsidered,
            additionalContext: formData.additionalContext,
            veteranEmail: formData.veteranEmail || null,
            systemInfo,
          });

          // eslint-disable-next-line no-console
          console.log(`✅ Feature request ${featureId} saved to My Tickets`);
        } catch (storageError) {
          // Fallback to localStorage if IndexedDB fails
          console.warn(
            "IndexedDB save failed, using localStorage fallback:",
            storageError,
          );
          saveFeatureToLocalStorage({
            request_id: featureId,
            priority: PRIORITY_VALUES[formData.priority],
            category: formData.category,
            module: formData.module,
            title: formData.title,
            description: formData.description,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Also copy to clipboard as backup
      await copyToClipboard(generatedReport);

      // === Send via FormSubmit.co API (stays in-browser, no email client!) ===
      // Note: This is best-effort. Local save is the primary success path.
      try {
        const priorityLabel = formData.priority
          ? t("featureRequest", `priority${formData.priority}Label`)
          : "Feature";

        // Scrub PII from user-authored free-text before any remote send (RT1-2).
        const formPayload = {
          _subject: `[${featureId}] ${priorityLabel} - ${scrubText(formData.title || "")}`,
          _template: "table",
          request_id: featureId,
          title: scrubText(formData.title || ""),
          category: formData.category,
          priority: priorityLabel,
          module: formData.module,
          description: scrubText(formData.description || ""),
          problem_solved: scrubText(
            formData.problemSolved || t("featureRequest", "notSpecified"),
          ),
          proposed_solution: scrubText(
            formData.proposedSolution || t("featureRequest", "notSpecified"),
          ),
          alternatives: scrubText(
            formData.alternativesConsidered ||
              t("featureRequest", "noneMentioned"),
          ),
          additional_context: scrubText(
            formData.additionalContext || t("common", "none"),
          ),
          veteran_email:
            formData.veteranEmail || t("featureRequest", "anonymousNoReply"),
          submitted_at: new Date().toISOString(),
          full_report: scrubText(generatedReport || ""),
        };

        // Remote send only when the operator has configured an endpoint; otherwise
        // the request is already saved locally and nothing leaves the device.
        const response = FORMSUBMIT_URL
          ? await fetch(FORMSUBMIT_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(formPayload),
            })
          : null;

        if (response && !response.ok) {
          console.warn(
            `⚠️ FormSubmit returned ${response.status} - request saved locally`,
          );
        } else if (response) {
          const result = await response.json();

          if (result.success) {
            // eslint-disable-next-line no-console
            console.log(
              `✅ Feature request ${featureId} sent via FormSubmit AND saved locally`,
            );
          } else {
            console.warn(
              `⚠️ FormSubmit submission failed: ${result.message || "Unknown error"} - request saved locally`,
            );
          }
        }
      } catch (emailError) {
        // Log but don't fail - local save is what matters
        console.warn(
          `⚠️ Could not send email notification (${emailError.message}). Your request was saved locally in My Tickets.`,
        );
      }

      // Always succeed if we got this far (local save succeeded)
      setSubmitted(true);
      setCopied(true);

      setSubmitting(false);
    } catch (error) {
      console.error("Submit error:", error);
      setSubmitError(
        t("featureRequest", "submitErrorMessage") + " " + DEVELOPER_EMAIL,
      );
      setSubmitting(false);
    }
  };

  const handleCopyReport = async () => {
    const result = await copyToClipboard(generatedReport);
    if (result.success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const canProceedStep1 = formData.category && formData.priority;
  const canProceedStep2 =
    formData.title.trim().length >= 5 &&
    formData.description.trim().length >= 20 &&
    isValidEmail(formData.veteranEmail);

  const footer = (
    <div className="flex justify-between items-center">
      <button
        onClick={
          step === 1 ? onClose : submitted ? onClose : () => setStep(step - 1)
        }
        disabled={submitting}
        className={`px-4 py-2 font-medium transition-colors ${
          submitting
            ? "text-gray-400 cursor-not-allowed"
            : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
        }`}
      >
        {step === 1
          ? t("common", "cancel")
          : submitted
            ? t("common", "close")
            : `← ${t("common", "back")}`}
      </button>

      {step < 3 ? (
        <div className="flex flex-col items-end gap-1">
          {step === 2 && !canProceedStep2 && (
            <p className="text-xs text-red-500 dark:text-red-400">
              {formData.title.trim().length < 5 &&
              formData.description.trim().length < 20
                ? `⚠️ ${t("featureRequest", "validationTitleAndDesc")}`
                : formData.title.trim().length < 5
                  ? `⚠️ ${t("featureRequest", "validationTitleOnly")}`
                  : formData.description.trim().length < 20
                    ? `⚠️ ${t("featureRequest", "validationDescOnly")}`
                    : emailError
                      ? `⚠️ ${t("featureRequest", "validationEmailFix")}`
                      : ""}
            </p>
          )}
          <button
            onClick={() =>
              step === 2 ? handleGenerateReport() : setStep(step + 1)
            }
            disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              (step === 1 ? canProceedStep1 : canProceedStep2)
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {step === 2
              ? `${t("featureRequest", "generateRequestButton")} →`
              : `${t("common", "next")} →`}
          </button>
        </div>
      ) : (
        <button
          onClick={onClose}
          className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
        >
          {t("featureRequest", "doneButton")}
        </button>
      )}
    </div>
  );

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="lg"
      zIndex={100}
      labelledBy="feature-request-title"
      footer={footer}
      header={
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-xl p-2">
                <svg
                  className="w-8 h-8"
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
              </div>
              <div>
                <h2 id="feature-request-title" className="text-2xl font-bold">
                  💡 {t("featureRequest", "title")}
                </h2>
                <p className="text-purple-100 text-sm">
                  {t("featureRequest", "subtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label={t("featureRequest", "closeAriaLabel")}
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

          {/* Progress Steps */}
          <div className="flex items-center mt-6">
            {[1, 2, 3].map((s, index) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0 ${
                    step >= s
                      ? "bg-white text-purple-600"
                      : "bg-white/30 text-white"
                  }`}
                >
                  {step > s ? "✓" : s}
                </div>
                {index < 2 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded ${
                      step > s ? "bg-white" : "bg-white/30"
                    }`}
                  ></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex text-xs text-purple-100 mt-2">
            <span className="flex-1 text-center">
              {t("featureRequest", "step1Label")}
            </span>
            <span className="flex-1 text-center">
              {t("featureRequest", "step2Label")}
            </span>
            <span className="flex-1 text-center">
              {t("featureRequest", "step3Label")}
            </span>
          </div>
        </div>
      }
    >
      {/* Step 1: Category & Priority */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              <strong>💡 {t("featureRequest", "ideasMatterTitle")}</strong>{" "}
              {t("featureRequest", "ideasMatterText")}
            </p>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t("featureRequest", "categoryLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleInputChange("category", e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">
                {t("featureRequest", "selectCategoryPlaceholder")}
              </option>
              {FEATURE_CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t("featureRequest", `category${key}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Related Module */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t("featureRequest", "relatedModuleLabel")}
            </label>
            <select
              value={formData.module}
              onChange={(e) => handleInputChange("module", e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {APP_MODULE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t("featureRequest", `module${key}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t("featureRequest", "priorityLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRIORITY_LEVEL_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => handleInputChange("priority", key)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    formData.priority === key
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30"
                      : "border-gray-200 dark:border-gray-600 hover:border-purple-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{PRIORITY_EMOJIS[key]}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("featureRequest", `priority${key}Label`)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t("featureRequest", `priority${key}Desc`)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Feature Details */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Feature Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t("featureRequest", "featureTitleLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder={t("featureRequest", "featureTitlePlaceholder")}
              maxLength={100}
              className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                formData.title.trim().length > 0 &&
                formData.title.trim().length < 5
                  ? "border-red-400 dark:border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            />
            <p
              className={`text-xs mt-1 ${
                formData.title.trim().length >= 5
                  ? "text-green-600 dark:text-green-400"
                  : formData.title.trim().length > 0
                    ? "text-red-500 dark:text-red-400"
                    : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {formData.title.trim().length >= 5
                ? `✓ ${formData.title.length}/100 ${t("featureRequest", "characters")}`
                : `${formData.title.trim().length}/5 ${t("featureRequest", "minCharsRequired")}`}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t("featureRequest", "describeIdeaLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder={t("featureRequest", "describeIdeaPlaceholder")}
              rows={4}
              className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${
                formData.description.trim().length > 0 &&
                formData.description.trim().length < 20
                  ? "border-red-400 dark:border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            />
            <p
              className={`text-xs mt-1 ${
                formData.description.trim().length >= 20
                  ? "text-green-600 dark:text-green-400"
                  : formData.description.trim().length > 0
                    ? "text-red-500 dark:text-red-400"
                    : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {formData.description.trim().length >= 20
                ? `✓ ${formData.description.trim().length} ${t("featureRequest", "characters")}`
                : `${formData.description.trim().length}/20 ${t("featureRequest", "minCharsRequired")}`}
            </p>
          </div>

          {/* Problem Solved */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t("featureRequest", "problemSolvedLabel")}
            </label>
            <textarea
              value={formData.problemSolved}
              onChange={(e) =>
                handleInputChange("problemSolved", e.target.value)
              }
              placeholder={t("featureRequest", "problemSolvedPlaceholder")}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Proposed Solution */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t("featureRequest", "proposedSolutionLabel")}
            </label>
            <textarea
              value={formData.proposedSolution}
              onChange={(e) =>
                handleInputChange("proposedSolution", e.target.value)
              }
              placeholder={t("featureRequest", "proposedSolutionPlaceholder")}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Alternatives Considered */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t("featureRequest", "alternativesLabel")}
            </label>
            <textarea
              value={formData.alternativesConsidered}
              onChange={(e) =>
                handleInputChange("alternativesConsidered", e.target.value)
              }
              placeholder={t("featureRequest", "alternativesPlaceholder")}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Additional Context */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t("featureRequest", "additionalContextLabel")}
            </label>
            <textarea
              value={formData.additionalContext}
              onChange={(e) =>
                handleInputChange("additionalContext", e.target.value)
              }
              placeholder={t("featureRequest", "additionalContextPlaceholder")}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Privacy & Tracking Options */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2">
              <span>🔒</span> {t("featureRequest", "privacyTrackingTitle")}
            </h4>

            {/* Save to My Tickets */}
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.saveToMyTickets}
                onChange={(e) =>
                  handleInputChange("saveToMyTickets", e.target.checked)
                }
                className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("featureRequest", "saveToMyTicketsLabel")}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("featureRequest", "saveToMyTicketsDesc")}
                </p>
              </div>
            </label>

            {/* Optional Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("featureRequest", "emailOptionalLabel")}
              </label>
              <input
                type="email"
                value={formData.veteranEmail}
                onChange={(e) =>
                  handleInputChange("veteranEmail", e.target.value)
                }
                placeholder="email@example.com"
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm ${
                  emailError
                    ? "border-red-500 dark:border-red-400"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              />
              {emailError ? (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                  <span>⚠️</span> {emailError}
                </p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                  {t("featureRequest", "emailPrivacyNote")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Success message after submission */}
          {submitted ? (
            <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-600 rounded-lg p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-green-600 dark:text-green-400"
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
                </div>
              </div>
              <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">
                {t("featureRequest", "successTitle")} 🎉
              </h3>
              <p className="text-green-700 dark:text-green-100 mb-4">
                {t("featureRequest", "successMessage")}
              </p>
              <div className="bg-green-100 dark:bg-green-800/50 rounded-lg p-4 mb-4 text-left">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                  ✅ {t("featureRequest", "whatHappensNext")}
                </h4>
                <ul className="text-sm text-green-700 dark:text-green-100 space-y-1">
                  <li>• {t("featureRequest", "nextStepReview")}</li>
                  {formData.saveToMyTickets && (
                    <li>• {t("featureRequest", "nextStepCheckTickets")}</li>
                  )}
                  {formData.veteranEmail && (
                    <li>• {t("featureRequest", "nextStepEmailNotify")}</li>
                  )}
                </ul>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400">
                {t("featureRequest", "requestIdLabel")}:{" "}
                <span className="font-mono font-bold">{featureId}</span>
              </p>
              {formData.saveToMyTickets && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2 italic">
                  {t("featureRequest", "savedToTicketsNote")}
                </p>
              )}

              {/* Roadmap CTA */}
              {onOpenRoadmap && (
                <div className="mt-6 pt-4 border-t border-green-200 dark:border-green-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    🗺️ Your idea may appear here! See what&apos;s being built &
                    vote:
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenRoadmap();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                  >
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
                        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                      />
                    </svg>
                    View Community Roadmap
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-green-600 dark:text-green-400"
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
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    {t("featureRequest", "requestReadyMessage")}
                  </span>
                </div>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  value={generatedReport}
                  className="w-full h-72 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-xs resize-none"
                />
                <button
                  onClick={handleCopyReport}
                  className={`absolute top-3 right-3 px-3 py-1.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
                    copied
                      ? "bg-green-600 text-white"
                      : "bg-gray-600 text-white hover:bg-gray-700"
                  }`}
                >
                  {copied ? (
                    <>
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
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {t("featureRequest", "copied")}
                    </>
                  ) : (
                    <>
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
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                        />
                      </svg>
                      {t("featureRequest", "copy")}
                    </>
                  )}
                </button>
              </div>

              {/* Submit Error Message */}
              {submitError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-100">
                    {submitError}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmitRequest}
                disabled={submitting}
                className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                  submitting
                    ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl"
                }`}
              >
                {submitting ? (
                  <>
                    <svg
                      className="w-6 h-6 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
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
                    {t("featureRequest", "submittingRequest")}
                  </>
                ) : (
                  <>
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
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                    {t("featureRequest", "submitRequestButton")}
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {t("featureRequest", "sendDirectlyNote")}
              </p>
            </>
          )}
        </div>
      )}
    </ResponsiveModal>
  );
}

export default FeatureRequest;
