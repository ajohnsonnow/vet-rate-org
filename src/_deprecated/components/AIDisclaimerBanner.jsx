/**
 * AI Disclaimer Banner
 *
 * Required legal/ethical disclaimer shown wherever AI-generated content appears.
 * This makes it crystal clear that the AI is NOT a substitute for professional services.
 */

import React, { useState } from "react";

export default function AIDisclaimerBanner({
  context = "general",
  isSticky = false,
}) {
  const [isDismissed, setIsDismissed] = useState(false);

  const disclaimers = {
    general: {
      icon: "⚠️",
      title: "AI-Assisted Tool",
      message:
        "This tool uses AI to help you understand VA regulations and organize your claim. It is NOT a doctor, lawyer, VA rater, or substitute for professional advice.",
      details: [
        "AI cannot diagnose medical conditions",
        "AI cannot provide legal advice",
        "AI cannot predict claim approval rates",
        "AI cannot replace C&P exams or nexus letters",
        "Always verify AI-generated information against official VA sources (38 CFR)",
      ],
    },
    medical: {
      icon: "🩺",
      title: "Not Medical Advice",
      message:
        "This tool provides educational information only. It cannot diagnose conditions, interpret medical records, or replace medical professionals.",
      details: [
        "Only licensed physicians can diagnose conditions",
        "Only medical professionals can provide nexus opinions",
        "For medical questions, consult your healthcare provider",
        "C&P exams must be conducted by VA-contracted examiners",
      ],
    },
    legal: {
      icon: "⚖️",
      title: "Not Legal Advice",
      message:
        "This tool provides educational information only. It cannot represent you, file appeals, or replace legal counsel.",
      details: [
        "Only licensed attorneys can provide legal advice",
        "For appeals or litigation, consult a VA-accredited attorney",
        "For FREE help, contact an accredited VSO (Veterans Service Officer)",
        "VetRate.org does not represent you in any official capacity",
      ],
    },
    prediction: {
      icon: "🎲",
      title: "No Outcome Guarantees",
      message:
        "AI cannot predict whether your claim will be approved or what rating you will receive. Only VA raters make those decisions.",
      details: [
        "Every claim is reviewed individually by VA personnel",
        "AI analysis is based on regulations, not claim outcomes",
        "Percentages shown are NOT approval probabilities",
        "No tool can guarantee VA approval or a specific rating",
      ],
    },
  };

  const content = disclaimers[context] || disclaimers.general;

  if (isDismissed) {
    // Show compact reminder after dismissal
    return (
      <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 border-l-4 border-yellow-500 p-2 text-xs text-gray-700 dark:text-gray-300">
        <span>{content.icon} AI Tool - Not professional advice</span>
        <button
          onClick={() => setIsDismissed(false)}
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          Show Details
        </button>
      </div>
    );
  }

  return (
    <div
      className={`bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 mb-4 ${
        isSticky ? "sticky top-0 z-10" : ""
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <span className="text-2xl" aria-hidden="true">
            {content.icon}
          </span>
          <div className="flex-1">
            <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-1">
              {content.title}
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
              {content.message}
            </p>
            <ul className="text-xs text-yellow-600 dark:text-yellow-400 space-y-1 list-disc list-inside">
              {content.details.map((detail, idx) => (
                <li key={idx}>{detail}</li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800 text-xs text-yellow-600 dark:text-yellow-400">
              <strong>
                All AI responses are grounded in 38 CFR regulations.
              </strong>{" "}
              If you see information that doesn't cite a source,{" "}
              <strong>treat it with skepticism</strong> and verify it
              independently.
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="ml-4 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 transition-colors"
          aria-label="Minimize disclaimer"
        >
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
              d="M5 15l7-7 7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Inline Disclaimer - Smaller version for within content
 */
export function AIInlineDisclaimer({ text, type = "warning" }) {
  const styles = {
    warning:
      "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300",
    info: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300",
    danger:
      "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300",
  };

  return (
    <div className={`text-xs border-l-4 p-2 my-2 ${styles[type]}`} role="note">
      <strong>⚠️ Disclaimer:</strong> {text}
    </div>
  );
}

/**
 * AI Response Wrapper - Automatically adds disclaimers to AI-generated content
 */
export function AIResponseWrapper({
  children,
  showDisclaimer = true,
  context = "general",
}) {
  return (
    <div className="ai-response-container">
      {showDisclaimer && <AIDisclaimerBanner context={context} />}
      <div className="ai-response-content">{children}</div>
    </div>
  );
}
