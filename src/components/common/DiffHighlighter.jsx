/**
 * Vet-Rate.org - DiffHighlighter Component
 * Visual forensics for the Consistency Engine
 *
 * Takes text and an array of issues, then renders the text with
 * color-coded highlights showing exactly where problems were found.
 * Hover over highlighted sections to see explanations.
 *
 * @author Vet-Rate.org Development Team
 * @version 1.0.0
 */

import React from "react";
import { useLanguage } from "../../contexts/LanguageContext";

/**
 * Issue types and their corresponding colors
 */
const ISSUE_COLORS = {
  Contradiction: {
    bg: "bg-red-900/60",
    text: "text-red-100",
    border: "border-b-2 border-red-500",
    icon: "⛔",
  },
  Exaggeration: {
    bg: "bg-orange-900/60",
    text: "text-orange-100",
    border: "border-b-2 border-orange-500",
    icon: "📈",
  },
  Timeline: {
    bg: "bg-yellow-900/60",
    text: "text-yellow-100",
    border: "border-b-2 border-yellow-500",
    icon: "⏳",
  },
  Vague: {
    bg: "bg-blue-900/60",
    text: "text-blue-100",
    border: "border-b-2 border-blue-500",
    icon: "🌫️",
  },
  default: {
    bg: "bg-purple-900/60",
    text: "text-purple-100",
    border: "border-b-2 border-purple-500",
    icon: "⚠️",
  },
};

/**
 * DiffHighlighter - Visual text forensics
 *
 * @param {Object} props
 * @param {string} props.text - The full text to display
 * @param {Array} props.issues - Array of issue objects with quote_target, type, explanation, etc.
 * @param {string} props.className - Additional CSS classes
 */
const DiffHighlighter = ({ text, issues = [], className = "" }) => {
  const { t } = useLanguage();

  // If no text, return nothing
  if (!text) return null;

  // If no issues, just render the plain text
  if (!issues || issues.length === 0) {
    return (
      <div
        className={`whitespace-pre-wrap text-gray-300 leading-relaxed ${className}`}
      >
        {text}
      </div>
    );
  }

  // Build a "mask" array for the text - each character maps to an issue (or null)
  const mask = new Array(text.length).fill(null);

  // Sort issues by quote length (longest first) to prevent overlapping issues
  // where a shorter quote might be inside a longer one
  const sortedIssues = [...issues]
    .filter((issue) => issue.quote_target) // Only issues with quotes
    .sort(
      (a, b) => (b.quote_target?.length || 0) - (a.quote_target?.length || 0),
    );

  // Mark each character with its issue
  sortedIssues.forEach((issue) => {
    if (!issue.quote_target) return;

    const startIdx = text.indexOf(issue.quote_target);
    if (startIdx !== -1) {
      for (let i = startIdx; i < startIdx + issue.quote_target.length; i++) {
        // Only mark if not already marked (first match wins)
        if (mask[i] === null) {
          mask[i] = issue;
        }
      }
    }
  });

  // Render a buffer of text with optional highlighting
  const renderBuffer = (buffer, issue, key) => {
    if (!buffer) return null;

    // No issue = plain text
    if (!issue) {
      return <span key={key}>{buffer}</span>;
    }

    // Get color scheme for this issue type
    const colors = ISSUE_COLORS[issue.type] || ISSUE_COLORS.default;

    // Build tooltip text
    const tooltipText = [
      `${colors.icon} ${issue.type}`,
      issue.severity ? `Severity: ${issue.severity}` : null,
      issue.explanation || null,
      issue.fix_suggestion ? `💡 Fix: ${issue.fix_suggestion}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return (
      <span
        key={key}
        className={`${colors.bg} ${colors.text} ${colors.border} px-0.5 rounded cursor-help transition-all hover:opacity-80`}
        title={tooltipText}
        role="mark"
        aria-label={`Issue: ${issue.type}`}
      >
        {buffer}
      </span>
    );
  };

  // Build the DOM by walking through the mask
  const nodes = [];
  let currentIssue = null;
  let buffer = "";

  for (let i = 0; i < text.length; i++) {
    const issueAtChar = mask[i];

    // If the issue changed, flush the buffer
    if (issueAtChar !== currentIssue) {
      if (buffer) {
        nodes.push(renderBuffer(buffer, currentIssue, `segment-${i}`));
      }
      buffer = "";
      currentIssue = issueAtChar;
    }
    buffer += text[i];
  }

  // Flush the final buffer
  if (buffer) {
    nodes.push(renderBuffer(buffer, currentIssue, "segment-end"));
  }

  return (
    <div
      className={`whitespace-pre-wrap text-gray-300 leading-relaxed font-mono text-sm ${className}`}
    >
      {nodes}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
          Issue Legend
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(ISSUE_COLORS)
            .filter(([key]) => key !== "default")
            .map(([type, colors]) => (
              <span
                key={type}
                className={`${colors.bg} ${colors.text} px-2 py-1 rounded`}
              >
                {colors.icon} {type}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Standalone issue card for detailed view
 */
export const IssueCard = ({ issue, index }) => {
  const { t } = useLanguage();
  const colors = ISSUE_COLORS[issue.type] || ISSUE_COLORS.default;

  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4 hover:border-orange-500 transition-colors">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="text-2xl mt-1">{colors.icon}</div>

        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex justify-between items-start">
            <h4 className="font-bold text-red-300">{issue.type} Warning</h4>
            {issue.severity && (
              <span
                className={`text-xs font-mono uppercase px-2 py-1 rounded ${
                  issue.severity === "High"
                    ? "bg-red-900/50 text-red-200"
                    : issue.severity === "Medium"
                      ? "bg-yellow-900/50 text-yellow-200"
                      : "bg-gray-700 text-gray-300"
                }`}
              >
                {issue.severity} Severity
              </span>
            )}
          </div>

          {/* The Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-black/20 p-3 rounded">
            {issue.quote_target && (
              <div>
                <span className="text-xs text-gray-500 uppercase">
                  You wrote:
                </span>
                <p className="text-red-200 italic">"{issue.quote_target}"</p>
              </div>
            )}
            {issue.quote_reference && (
              <div>
                <span className="text-xs text-gray-500 uppercase">
                  Evidence says:
                </span>
                <p className="text-blue-200 italic">
                  "{issue.quote_reference}"
                </p>
              </div>
            )}
          </div>

          {/* Explanation & Fix */}
          <div className="mt-2 space-y-1">
            {issue.explanation && (
              <p className="text-gray-300 text-sm">
                <span className="font-bold text-orange-400">Rater View:</span>{" "}
                {issue.explanation}
              </p>
            )}
            {issue.fix_suggestion && (
              <p className="text-green-400 text-sm">
                <span className="font-bold">💡 Suggestion:</span>{" "}
                {issue.fix_suggestion}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffHighlighter;
