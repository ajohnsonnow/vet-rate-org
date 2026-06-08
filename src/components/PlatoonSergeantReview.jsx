/**
 * Vet-Rate.org - Platoon Sergeant Review Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * "Platoon Sergeant" = OCR/Text Extraction with quality feedback
 * Real-time progress display for document inspection
 */

import React from "react";
import { formatFileSize } from "../utils/ocr";

/**
 * Quality indicator badge
 */
const QualityBadge = ({ quality, confidence }) => {
  const qualityConfig = {
    clean: {
      icon: "✨",
      label: "Excellent",
      color:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    },
    standard: {
      icon: "✓",
      label: "Good",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    },
    poor: {
      icon: "⚠️",
      label: "Poor",
      color:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    },
    aged: {
      icon: "📜",
      label: "Aged",
      color:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    },
    handwritten: {
      icon: "✍️",
      label: "Handwritten",
      color:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    },
  };

  const config = qualityConfig[quality] || qualityConfig.standard;

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.color}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {confidence && <span className="ml-1 opacity-75">({confidence}%)</span>}
    </div>
  );
};

/**
 * Page extraction status
 */
const PageStatus = ({ page, total, quality, status, warning }) => {
  const isComplete = status === "complete";
  const isProcessing = status === "processing";
  const isPending = status === "pending";

  return (
    <div
      className={`
      flex items-center gap-3 p-3 rounded-lg border-2 transition-all
      ${isComplete ? "border-green-500 bg-green-50 dark:bg-green-900/10" : ""}
      ${isProcessing ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10 animate-pulse" : ""}
      ${isPending ? "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/10" : ""}
    `}
    >
      <div className="text-2xl">
        {isComplete && "✅"}
        {isProcessing && "🔍"}
        {isPending && "📄"}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-gray-900 dark:text-white">
            Page {page} of {total}
          </span>
          {quality && <QualityBadge quality={quality} />}
        </div>

        {warning && (
          <div className="text-xs text-orange-600 dark:text-orange-400">
            ⚠️ {warning}
          </div>
        )}

        {isProcessing && (
          <div className="text-xs text-blue-600 dark:text-blue-400">
            Extracting text...
          </div>
        )}
      </div>

      {isComplete && (
        <div className="text-green-600 dark:text-green-400 text-sm font-medium">
          Complete
        </div>
      )}
    </div>
  );
};

/**
 * Method badge (OCR vs native text)
 */
const ExtractionMethodBadge = ({ method }) => {
  const methods = {
    ocr: {
      icon: "🔍",
      label: "Advanced OCR",
      color:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    },
    text: {
      icon: "📝",
      label: "Native Text",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    },
    docx: {
      icon: "📄",
      label: "DOCX Parser",
      color:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    },
  };

  const config = methods[method] || methods.text;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.color}`}
    >
      {config.icon} {config.label}
    </span>
  );
};

/**
 * Main Platoon Sergeant Review Component
 */
export default function PlatoonSergeantReview({
  _document,
  progress,
  _onComplete,
  _onError,
  onSkip,
}) {
  const {
    filename,
    fileSize,
    pageCount,
    // eslint-disable-next-line no-unused-vars
    currentPage,
    method,
    quality,
    confidence,
    ocrState,
    warnings = [],
    pages = [],
  } = progress || {};

  const overallProgress = progress?.progress || 0;
  const isComplete = overallProgress >= 100;
  const hasWarnings = warnings.length > 0;

  // Detect if OCR is active (can be from method or ocrState message)
  const isOCRActive =
    method === "ocr" ||
    method === "advanced_ocr" ||
    (ocrState &&
      (ocrState.toLowerCase().includes("ocr") ||
        ocrState.toLowerCase().includes("preparing") ||
        ocrState.toLowerCase().includes("enhancing")));

  // Debug: Log what we're receiving
  React.useEffect(() => {
    if (progress) {
      // eslint-disable-next-line no-console
      console.log("🎖️ PlatoonSergeantReview received progress:", {
        overallProgress,
        progressProp: progress.progress,
        fullProgress: progress,
      });
    }
  }, [progress, overallProgress]);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="text-4xl">🎖️</div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Platoon Sergeant Review
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Document Inspection & Text Extraction
            </p>
          </div>
        </div>

        {!isComplete && onSkip && (
          <button
            onClick={onSkip}
            className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Skip This Document
          </button>
        )}
      </div>

      {/* Document Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900 dark:text-white truncate flex-1">
            📄 {filename}
          </h4>
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
            {formatFileSize(fileSize)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {method && <ExtractionMethodBadge method={method} />}
          {quality && (
            <QualityBadge quality={quality} confidence={confidence} />
          )}
          {pageCount && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              📑 {pageCount} page{pageCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isComplete ? "Inspection Complete" : "Extraction Progress"}
          </span>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {Math.round(overallProgress)}%
          </span>
        </div>

        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isComplete
                ? "bg-gradient-to-r from-green-500 to-emerald-500"
                : "bg-gradient-to-r from-blue-500 to-purple-500"
            }`}
            style={{ width: `${overallProgress}%` }}
          >
            {/* Animated shimmer effect while processing */}
            {!isComplete && (
              <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            )}
          </div>
        </div>

        {ocrState && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {ocrState}
          </p>
        )}
      </div>

      {/* OCR Processing Warning */}
      {isOCRActive && !isComplete && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-xl">⏱️</span>
            <div className="flex-1">
              <h5 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                Advanced OCR In Progress
              </h5>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Scanned or low-quality documents require character recognition
                which can take <strong>1-3 minutes per page</strong>. This is
                processing locally on your device for privacy.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-2 italic">
                💡 Tip: High-quality scans (300+ DPI) and text-based PDFs
                process much faster.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Page Status List */}
      {pages.length > 0 && (
        <div className="space-y-2 mb-4">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Page Extraction Status:
          </h5>
          {pages.map((page, index) => (
            <PageStatus
              key={index}
              page={index + 1}
              total={pageCount || pages.length}
              quality={page.quality}
              status={page.status}
              warning={page.warning}
            />
          ))}
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <h5 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                Quality Warnings:
              </h5>
              <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                {warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Completion Message */}
      {isComplete && (
        <div
          className={`border-l-4 p-4 ${
            confidence && confidence < 60
              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-500"
              : "bg-green-50 dark:bg-green-900/20 border-green-500"
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-xl">
              {confidence && confidence < 60 ? "⚠️" : "✅"}
            </span>
            <div className="flex-1">
              <h5
                className={`font-semibold mb-1 ${
                  confidence && confidence < 60
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-green-800 dark:text-green-300"
                }`}
              >
                Extraction Complete{" "}
                {confidence && `(${confidence}% confidence)`}
              </h5>
              {confidence && confidence < 60 ? (
                <div className="text-sm text-amber-700 dark:text-amber-400 space-y-2">
                  <p>
                    <strong>Low OCR confidence detected.</strong> The document
                    may be difficult to read (faded, creased, or poor scan
                    quality).
                  </p>
                  <p>
                    Field extraction may have errors. Please verify all data in
                    the SigInt Briefing carefully.
                  </p>
                  <p className="text-xs italic">
                    💡 For better results, try re-scanning at 300+ DPI with good
                    lighting.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-green-700 dark:text-green-400">
                  Document successfully inspected. Proceeding to SigInt
                  Intelligence Briefing...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Military Context Help */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 italic">
        💡 The &quot;Platoon Sergeant&quot; thoroughly inspects each document
        for readability and quality, using advanced OCR for poor-quality scans
        just like a Platoon Sergeant checks every detail before formation.
      </div>
    </div>
  );
}
