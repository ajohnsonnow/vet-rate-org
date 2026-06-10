/**
 * Vet-Rate.org - C-File Analyzer Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * The "Kill Shot" feature - Client-side C-File analysis that competitors charge $500+ for
 * Analyzes veteran claims files locally using AI to identify evidence and claim opportunities
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";
import { formatFileSize, estimateProcessingTime } from "../utils/pdfExtractor";
import {
  processFormationDocument,
  PROCESSING_STATES,
} from "../utils/musterCallProcessor";
import {
  analyzeCFile,
  getCFilePrivacyDisclosure,
} from "../utils/cfileAnalyzer";
import { isAnyAIAvailable, getAIStatus } from "../utils/unifiedAIService";
import { AIStatusBadge } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import SmartAILoadButton from "./SmartAILoadButton";
import ReportBugLink from "./ReportBugLink";
import {
  saveAnalysisResults,
  PACKET_DOC_TYPES,
} from "../utils/veteranContextProvider";
import { getStorageStats } from "../utils/storage";

// Sub-components for the dashboard
import CFileTimeline from "./CFileTimeline";
import CFileClaimsCards from "./CFileClaimsCards";

export default function CFileAnalyzer({
  onClose,
  onOpenAISettings,
  onReportBug,
}) {
  const { t } = useLanguage();

  // File drop state
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // AI status state (unified AI service handles API keys internally)
  // eslint-disable-next-line no-unused-vars
  const [aiStatus, setAIStatus] = useState(getAIStatus());

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState("");
  // Heartbeat while processing: long phases (opening a 300MB document,
  // first model generation) are otherwise silent for minutes — a ticking
  // clock tells the veteran the pipeline is alive, not frozen.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!isProcessing) {
      setElapsedSeconds(0);
      return undefined;
    }
    const startedAt = Date.now();
    const tick = setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(tick);
  }, [isProcessing]);
  const [extractionProgress, setExtractionProgress] = useState({
    current: 0,
    total: 0,
  });
  const [chunkProgress, setChunkProgress] = useState({
    current: 0,
    total: 0,
    phase: "",
    startPage: 0,
    endPage: 0,
  });
  const [error, setError] = useState(null);
  const [storageWarning, setStorageWarning] = useState(null);
  const abortControllerRef = useRef(null);

  // Analysis metadata (for showing chunks processed)
  const [analysisMetadata, setAnalysisMetadata] = useState(null);

  // Consent state
  const [showPrivacyConsent, setShowPrivacyConsent] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [hasConsented, setHasConsented] = useState(false);

  // Results state
  const [analysisResult, setAnalysisResult] = useState(null);
  const [extractedText, setExtractedText] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");

  // Monitor AI status
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle file drop
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer?.files?.[0];
      if (droppedFile) {
        if (droppedFile.type !== "application/pdf") {
          setError(t("cfileAnalyzer", "pleaseDropPdf"));
          return;
        }
        setFile(droppedFile);
        setError(null);
        setAnalysisResult(null);
      }
    },
    [t],
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        if (selectedFile.type !== "application/pdf") {
          setError(t("cfileAnalyzer", "pleaseDropPdf"));
          return;
        }
        setFile(selectedFile);
        setError(null);
        setAnalysisResult(null);
      }
    },
    [t],
  );

  // Stop analysis
  const handleStopAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setProcessingStage("Stopping analysis...");
    }
  }, []);

  // Start analysis process
  const handleStartAnalysis = useCallback(() => {
    if (!file) {
      setError(t("cfileAnalyzer", "pleaseDropFileFirst"));
      return;
    }

    // Check if ANY AI is available (Cloud or Local)
    if (!isAnyAIAvailable()) {
      setError(t("cfileAnalyzer", "noAiAvailable"));
      onOpenAISettings?.();
      return;
    }

    setShowPrivacyConsent(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, t]);

  // Process the file after consent
  const handleConsentAndProcess = useCallback(async () => {
    setHasConsented(true);
    setShowPrivacyConsent(false);
    setIsProcessing(true);
    setError(null);
    setStorageWarning(null);
    setChunkProgress({
      current: 0,
      total: 0,
      phase: "",
      startPage: 0,
      endPage: 0,
    });

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      // Stage 1: (processFormationDocument accepts the File directly — no pre-read needed)

      // Stage 2: Extract text — route through MusterCall pipeline for full
      // Tesseract OCR support (handles scanned / image-only PDFs)
      setProcessingStage(t("cfileAnalyzer", "extractingText"));
      const musterResult = await processFormationDocument(file, (progress) => {
        // Map MusterCall progress events → CFileAnalyzer UI state
        if (progress.state === PROCESSING_STATES.EXTRACTING) {
          setExtractionProgress({
            current: progress.currentPage || 0,
            total: progress.totalPages || 0,
          });
          if (progress.message) setProcessingStage(progress.message);
        }
      });

      // Normalise to the shape the rest of handleConsentAndProcess expects
      const extractionResult = {
        text: musterResult.text || "",
        hasText: (musterResult.text || "").trim().length > 100,
        totalPages: musterResult.pageCount || 1,
        avgCharsPerPage: musterResult.text
          ? Math.round(musterResult.text.length / (musterResult.pageCount || 1))
          : 0,
        method: musterResult.method || "ocr",
        ocrUsed: musterResult.ocrUsed ?? true,
        confidence: musterResult.confidence ?? null,
      };

      if (!extractionResult.hasText) {
        setError(
          `Unable to extract text from this document (${extractionResult.avgCharsPerPage} chars/page avg). ` +
            `The file may be corrupted or an unsupported scan format.`,
        );
        setIsProcessing(false);
        return;
      }

      setExtractedText(extractionResult);

      // Stage 3: Analyze with AI (uses unified AI service with automatic chunking)
      setProcessingStage(t("cfileAnalyzer", "analyzingWithAi"));
      const result = await analyzeCFile(
        null, // API key handled by unified AI service
        extractionResult.text,
        (status, progressData) => {
          setProcessingStage(status);
          // Handle multi-chunk progress data
          if (progressData) {
            setChunkProgress({
              current: progressData.current || 0,
              total: progressData.total || 0,
              phase: progressData.phase || "",
              startPage: progressData.startPage || 0,
              endPage: progressData.endPage || 0,
            });
          }
        },
        abortControllerRef.current, // Pass abort controller
      );

      setAnalysisResult(result.analysis);
      setAnalysisMetadata(result.metadata);
      setProcessingStage("");

      // Storage-quota pre-flight: warn when the remaining quota looks too
      // small for the payload, but still attempt the save
      try {
        const stats = await getStorageStats();
        const estimatedPayloadBytes =
          (extractionResult.text?.length || 0) * 2 +
          JSON.stringify(result.analysis || {}).length;
        const remaining = (stats.quotaLimit || 0) - (stats.quotaUsage || 0);
        if (
          stats.quotaLimit > 0 &&
          (remaining < 50 * 1024 * 1024 ||
            remaining < estimatedPayloadBytes * 2)
        ) {
          setStorageWarning(
            `Browser storage is nearly full (${stats.quotaUsageMB} MB used of ${stats.quotaLimitMB} MB available). ` +
              `Saving this analysis may fail or may not persist. Consider exporting your packet as a backup or freeing up space.`,
          );
        }
      } catch (quotaErr) {
        console.warn("Storage quota pre-flight failed:", quotaErr);
      }

      // Save C-File analysis to VKB + My Packet
      try {
        const analysis = result.analysis || {};
        await saveAnalysisResults({
          toolName: "C-File Analyzer",
          classification: PACKET_DOC_TYPES.C_FILE,
          rawText: extractionResult?.text || "",
          extractedData: analysis,
          fileName: file?.name || "c-file.pdf",
          pageCount: extractionResult?.totalPages || 1,
          vkbDocument: {
            classification: "c_file",
            rawText: (extractionResult?.text || "").slice(0, 5000),
            extractedData: analysis,
            source: "CFileAnalyzer",
          },
          vkbMergeData: {
            claims: (analysis.potential_claims || []).map((c) => ({
              condition: c.condition || c.name || "Unknown",
              status: "identified",
              source: "C-File Analysis",
              evidence: c.evidence || c.description || "",
              diagnosticCode: c.diagnosticCode || "",
            })),
            evidence: (analysis.timeline || []).map((e) => ({
              date: e.date,
              type: "c_file_event",
              description: e.event || e.description || "",
              source: "C-File",
            })),
            aiInsights: {
              cfileAnalysisSummary: analysis.summary || "",
              cfileExposures: analysis.exposures || [],
              cfileActionItems: analysis.actionItems || [],
              cfileExtraction: {
                ocrMethod: extractionResult.method,
                ocrUsed: extractionResult.ocrUsed,
                confidence: extractionResult.confidence,
              },
            },
          },
        });
      } catch (saveErr) {
        console.warn("Failed to save C-File results to VKB/Packet:", saveErr);
      }
    } catch (err) {
      console.error("Analysis error:", err);
      console.error("Error stack:", err.stack);
      console.error("Error details:", {
        message: err.message,
        name: err.name,
        cause: err.cause,
      });

      // Check if it was a cancellation
      if (err.message === "Analysis cancelled by user") {
        setError("Analysis stopped by user");
      } else {
        // Provide detailed error message
        const errorMessage =
          err.message || err.toString() || t("cfileAnalyzer", "analysisError");
        setError(errorMessage);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, [file, t]);

  // Reset to start over
  const handleReset = useCallback(() => {
    setFile(null);
    setAnalysisResult(null);
    setExtractedText(null);
    setError(null);
    setStorageWarning(null);
    setProcessingStage("");
    setExtractionProgress({ current: 0, total: 0 });
    setChunkProgress({
      current: 0,
      total: 0,
      phase: "",
      startPage: 0,
      endPage: 0,
    });
    setAnalysisMetadata(null);
    setHasConsented(false);
  }, []);

  // Render the drop zone form
  const renderUploadForm = () => (
    <div className="max-w-4xl mx-auto">
      {/* Warning Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-bold text-amber-800 dark:text-amber-200">
              {t("cfileAnalyzer", "securityNotice")}
            </h3>
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              {t("cfileAnalyzer", "securityNoticeDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* AI Tip - Compact */}
      {isAnyAIAvailable() && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
            <span>💡</span>
            <span>
              <strong>{t("cfileAnalyzer", "unlimitedFileSize")}</strong>{" "}
              {t("cfileAnalyzer", "unlimitedFileSizeDesc")}
            </span>
          </div>
        </div>
      )}

      {/* Drop Zone */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={`border-3 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
            : file
              ? "border-green-500 bg-green-50 dark:bg-green-900/30"
              : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {file ? (
          <div className="space-y-3">
            <div className="text-5xl">📄</div>
            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              {file.name}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {formatFileSize(file.size)}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
            >
              {t("cfileAnalyzer", "removeFile")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-5xl">📁</div>
            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              {t("cfileAnalyzer", "dropYourCFile")}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {t("cfileAnalyzer", "orClickToBrowse")}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-500">
              {t("cfileAnalyzer", "supportsPdfUpTo")}
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">❌</span>
            <div className="text-red-700 dark:text-red-300">{error}</div>
          </div>
        </div>
      )}

      {/* Smart AI Load Button */}
      {!isAnyAIAvailable() && (
        <div className="mt-6">
          <SmartAILoadButton
            toolId="cfile-analyzer"
            onLoadComplete={(model) =>
              // eslint-disable-next-line no-console
              console.log("Smart AI loaded for C-File Analyzer:", model?.name)
            }
          />
        </div>
      )}

      {/* Analyze Button */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={handleStartAnalysis}
          disabled={!file || !isAnyAIAvailable()}
          className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
            file && isAnyAIAvailable()
              ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          }`}
        >
          🔍 {t("cfileAnalyzer", "analyzeMyFile")}
        </button>
      </div>

      {file && (
        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          {t("cfileAnalyzer", "estimatedProcessingTime")}{" "}
          {estimateProcessingTime(Math.ceil(file.size / 5000))}
        </div>
      )}
    </div>
  );

  // Privacy consent gate — nested over the main analyzer shell (zIndex 70 > the
  // shell's 60). Dismissable: Cancel / ESC / backdrop all decline.
  const renderPrivacyConsent = () => (
    <ResponsiveModal
      isOpen={showPrivacyConsent}
      onClose={() => setShowPrivacyConsent(false)}
      size="lg"
      zIndex={70}
      labelledBy="cfile-privacy-title"
      footer={
        <div className="flex gap-4">
          <button
            onClick={() => setShowPrivacyConsent(false)}
            className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {t("cfileAnalyzer", "cancel")}
          </button>
          <button
            onClick={handleConsentAndProcess}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            {t("cfileAnalyzer", "iUnderstandStart")}
          </button>
        </div>
      }
    >
      <h2
        id="cfile-privacy-title"
        className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"
      >
        🔒 {t("cfileAnalyzer", "privacyDataHandling")}
      </h2>

      <div className="prose prose-sm dark:prose-invert max-w-none">
        <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          {getCFilePrivacyDisclosure()}
        </pre>
      </div>
    </ResponsiveModal>
  );

  // Render processing state
  const renderProcessing = () => {
    const isMultiChunk = chunkProgress.total > 1;
    const chunkPercent =
      chunkProgress.total > 0
        ? Math.round((chunkProgress.current / chunkProgress.total) * 100)
        : 0;

    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="mb-8">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
        </div>

        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
          {isMultiChunk
            ? `📦 ${t("cfileAnalyzer", "processingLargeCFile")}`
            : t("cfileAnalyzer", "analyzingYourCFile")}
        </h3>

        <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
          {processingStage}
        </p>

        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
          ⏱️ Elapsed: {Math.floor(elapsedSeconds / 60)}:
          {String(elapsedSeconds % 60).padStart(2, "0")} — still working
        </p>

        {/* PDF Extraction Progress */}
        {extractionProgress.total > 0 &&
          processingStage.includes("Extracting") && (
            <div className="max-w-md mx-auto mb-6">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{
                    width: `${(extractionProgress.current / extractionProgress.total) * 100}%`,
                  }}
                ></div>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t("cfileAnalyzer", "page")} {extractionProgress.current} /{" "}
                {extractionProgress.total}
              </p>
            </div>
          )}

        {/* Multi-Chunk Progress */}
        {isMultiChunk && chunkProgress.phase === "analyze" && (
          <div className="max-w-md mx-auto mb-6">
            <div className="bg-violet-100 dark:bg-violet-900/30 rounded-xl p-4 border border-violet-300 dark:border-violet-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-violet-800 dark:text-violet-200">
                  {t("cfileAnalyzer", "chunkOf")
                    .replace("{current}", chunkProgress.current)
                    .replace("{total}", chunkProgress.total)}
                </span>
                <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                  {chunkPercent}%
                </span>
              </div>
              <div className="bg-violet-200 dark:bg-violet-800 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-violet-500 to-purple-500 h-full transition-all duration-500"
                  style={{ width: `${chunkPercent}%` }}
                ></div>
              </div>
              {chunkProgress.startPage > 0 && (
                <p className="mt-2 text-xs text-violet-600 dark:text-violet-400">
                  📄{" "}
                  {t("cfileAnalyzer", "analyzingPages")
                    .replace("{start}", chunkProgress.startPage)
                    .replace("{end}", chunkProgress.endPage)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Merging Phase */}
        {chunkProgress.phase === "merge" && (
          <div className="max-w-md mx-auto mb-6">
            <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-xl p-4 border border-emerald-300 dark:border-emerald-700">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                <span className="animate-pulse">🔀</span>
                <span className="font-medium">
                  {t("cfileAnalyzer", "mergingChunks").replace(
                    "{total}",
                    chunkProgress.total,
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
          {isMultiChunk ? (
            <>
              ⚡{" "}
              {t("cfileAnalyzer", "largeFileDetected").replace(
                "{total}",
                chunkProgress.total,
              )}
            </>
          ) : (
            <>⚡ {t("cfileAnalyzer", "largeFileMayTake")}</>
          )}
        </div>

        {/* Stop Button */}
        <div className="mt-6">
          <button
            onClick={handleStopAnalysis}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
          >
            <span>🛑</span>
            <span>Stop Analyzing</span>
          </button>
        </div>
      </div>
    );
  };

  // Render the analysis dashboard
  const renderDashboard = () => (
    <div className="max-w-7xl mx-auto">
      {/* Header with file info */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              ✅ {t("cfileAnalyzer", "analysisComplete")}
            </h2>
            <p className="mt-1 opacity-90">
              {file?.name} • {extractedText?.pageCount}{" "}
              {t("cfileAnalyzer", "pagesAnalyzed")} •{" "}
              {extractedText?.totalCharacters?.toLocaleString()}{" "}
              {t("cfileAnalyzer", "charactersExtracted")}
            </p>
            {/* Multi-chunk indicator */}
            {analysisMetadata?.chunksProcessed > 1 && (
              <p className="mt-1 text-sm opacity-75 flex items-center gap-2">
                📦{" "}
                {t("cfileAnalyzer", "processedInChunks").replace(
                  "{count}",
                  analysisMetadata.chunksProcessed,
                )}
                {analysisMetadata.aiMode && (
                  <span className="px-2 py-0.5 bg-white/20 rounded text-xs">
                    {analysisMetadata.aiMode}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
          >
            {t("cfileAnalyzer", "analyzeAnotherFile")}
          </button>
        </div>
      </div>

      {/* Partial-analysis warning — a veteran must never mistake a partial
          analysis for a complete one */}
      {analysisResult.failedChunks?.length > 0 && (
        <div
          role="alert"
          className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-bold text-amber-800 dark:text-amber-200">
                Partial analysis — {analysisResult.failedChunks.length} of{" "}
                {analysisMetadata?.totalChunks ||
                  analysisResult.failedChunks.length}{" "}
                sections could not be analyzed
              </h3>
              <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                Pages not analyzed:{" "}
                {analysisResult.failedChunks
                  .map((fc) => `${fc.startPage}–${fc.endPage}`)
                  .join(", ")}
                . Findings from those pages are missing, so do not treat these
                results as complete. Try running the analysis again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Storage warning */}
      {storageWarning && (
        <div
          role="alert"
          className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">💾</span>
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              {storageWarning}
            </p>
          </div>
        </div>
      )}

      {/* Executive Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
          📋 {t("cfileAnalyzer", "executiveSummary")}
        </h3>
        <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
          {analysisResult.summary}
        </p>

        {analysisResult.servicePeriod && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {analysisResult.servicePeriod.branch && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t("cfileAnalyzer", "branch")}
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-200">
                  {analysisResult.servicePeriod.branch}
                </div>
              </div>
            )}
            {analysisResult.servicePeriod.mos && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t("cfileAnalyzer", "mos")}
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-200">
                  {analysisResult.servicePeriod.mos}
                </div>
              </div>
            )}
            {analysisResult.servicePeriod.entryDate && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t("cfileAnalyzer", "entryDate")}
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-200">
                  {analysisResult.servicePeriod.entryDate}
                </div>
              </div>
            )}
            {analysisResult.servicePeriod.separationDate && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t("cfileAnalyzer", "separationDate")}
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-200">
                  {analysisResult.servicePeriod.separationDate}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          {
            id: "claims",
            label: `🎯 ${t("cfileAnalyzer", "tabPotentialClaims")}`,
            count: analysisResult.potential_claims?.length,
          },
          {
            id: "timeline",
            label: `📅 ${t("cfileAnalyzer", "tabTimeline")}`,
            count: analysisResult.timeline?.length,
          },
          {
            id: "exposures",
            label: `☢️ ${t("cfileAnalyzer", "tabExposures")}`,
            count: analysisResult.exposures?.length,
          },
          {
            id: "mental",
            label: `🧠 ${t("cfileAnalyzer", "tabMentalHealth")}`,
          },
          {
            id: "actions",
            label: `✅ ${t("cfileAnalyzer", "tabActionItems")}`,
            count: analysisResult.actionItems?.length,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {activeTab === "claims" && (
          <CFileClaimsCards claims={analysisResult.potential_claims || []} />
        )}

        {activeTab === "timeline" && (
          <CFileTimeline events={analysisResult.timeline || []} />
        )}

        {activeTab === "exposures" && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
              {t("cfileAnalyzer", "toxicExposures")}
            </h3>
            {analysisResult.exposures?.length > 0 ? (
              <div className="space-y-4">
                {analysisResult.exposures.map((exposure, idx) => (
                  <div
                    key={idx}
                    className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-orange-800 dark:text-orange-200">
                          {exposure.type}
                        </h4>
                        {exposure.location && (
                          <p className="text-sm text-orange-700 dark:text-orange-300">
                            📍 {exposure.location}
                          </p>
                        )}
                        {exposure.timeframe && (
                          <p className="text-sm text-orange-700 dark:text-orange-300">
                            📅 {exposure.timeframe}
                          </p>
                        )}
                      </div>
                      {exposure.page_number && (
                        <span className="text-xs bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-2 py-1 rounded">
                          {t("cfileAnalyzer", "page")} {exposure.page_number}
                        </span>
                      )}
                    </div>
                    {exposure.presumptive_conditions?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-orange-800 dark:text-orange-200 mb-1">
                          {t("cfileAnalyzer", "presumptiveConditions")}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {exposure.presumptive_conditions.map(
                            (condition, i) => (
                              <span
                                key={i}
                                className="text-xs bg-orange-100 dark:bg-orange-800/50 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded"
                              >
                                {condition}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                {t("cfileAnalyzer", "noExposuresFound")}
              </p>
            )}
          </div>
        )}

        {activeTab === "mental" && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
              {t("cfileAnalyzer", "mentalHealthIndicators")}
            </h3>
            {analysisResult.mentalHealth && (
              <div className="space-y-4">
                {analysisResult.mentalHealth.diagnoses?.length > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <h4 className="font-bold text-purple-800 dark:text-purple-200 mb-2">
                      {t("cfileAnalyzer", "diagnosesFound")}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.mentalHealth.diagnoses.map((dx, i) => (
                        <span
                          key={i}
                          className="bg-purple-100 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-sm"
                        >
                          {dx}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {analysisResult.mentalHealth.indicators?.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-2">
                      {t("cfileAnalyzer", "indicators")}
                    </h4>
                    <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 text-sm space-y-1">
                      {analysisResult.mentalHealth.indicators.map(
                        (indicator, i) => (
                          <li key={i}>{indicator}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

                {analysisResult.mentalHealth.stressors?.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-2">
                      {t("cfileAnalyzer", "documentedStressors")}
                    </h4>
                    <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 text-sm space-y-1">
                      {analysisResult.mentalHealth.stressors.map(
                        (stressor, i) => (
                          <li key={i}>{stressor}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

                {analysisResult.mentalHealth.pages?.length > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    📄 {t("cfileAnalyzer", "seePages")}{" "}
                    {analysisResult.mentalHealth.pages.join(", ")}
                  </p>
                )}
              </div>
            )}
            {(!analysisResult.mentalHealth ||
              (!analysisResult.mentalHealth.diagnoses?.length &&
                !analysisResult.mentalHealth.indicators?.length)) && (
              <p className="text-gray-500 dark:text-gray-400">
                {t("cfileAnalyzer", "noMentalHealthIndicators")}
              </p>
            )}
          </div>
        )}

        {activeTab === "actions" && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
              {t("cfileAnalyzer", "recommendedNextSteps")}
            </h3>
            {analysisResult.actionItems?.length > 0 ? (
              <div className="space-y-3">
                {analysisResult.actionItems.map((action, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4"
                  >
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-green-500 text-white rounded-full font-bold text-sm">
                      {idx + 1}
                    </span>
                    <p className="text-green-800 dark:text-green-200">
                      {action}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                {t("cfileAnalyzer", "noActionItems")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Red Flags Section */}
      {analysisResult.redFlags?.length > 0 && (
        <div className="mt-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-red-800 dark:text-red-200 mb-4 flex items-center gap-2">
            🚨 {t("cfileAnalyzer", "attentionNeeded")}
          </h3>
          <div className="space-y-3">
            {analysisResult.redFlags.map((flag, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-700"
              >
                <div className="flex items-start justify-between">
                  <p className="font-medium text-red-800 dark:text-red-200">
                    {flag.issue}
                  </p>
                  {flag.page_number && (
                    <span className="text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 px-2 py-1 rounded">
                      {t("cfileAnalyzer", "page")} {flag.page_number}
                    </span>
                  )}
                </div>
                {flag.suggestion && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    💡 {flag.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Combat Indicators */}
      {analysisResult.combatIndicators?.length > 0 && (
        <div className="mt-6 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-indigo-800 dark:text-indigo-200 mb-4 flex items-center gap-2">
            🎖️ {t("cfileAnalyzer", "combatIndicatorsFound")}
          </h3>
          <div className="space-y-3">
            {analysisResult.combatIndicators.map((indicator, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between bg-white dark:bg-gray-800 rounded-lg p-4 border border-indigo-200 dark:border-indigo-700"
              >
                <div>
                  <p className="font-medium text-indigo-800 dark:text-indigo-200">
                    {indicator.indicator}
                  </p>
                  {indicator.significance && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {indicator.significance}
                    </p>
                  )}
                </div>
                {indicator.page_number && (
                  <span className="text-xs bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 px-2 py-1 rounded">
                    {t("cfileAnalyzer", "page")} {indicator.page_number}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        size="full"
        labelledBy="cfile-analyzer-title"
        footer={
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 max-w-4xl mx-auto">
            ⚠️ {t("cfileAnalyzer", "footerDisclaimer")}
          </p>
        }
        header={
          <div className="flex-shrink-0 bg-gradient-to-r from-violet-600 to-purple-600 border-b border-violet-500 shadow-sm rounded-t-xl">
            <div className="px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔬</span>
                <div>
                  <h1
                    id="cfile-analyzer-title"
                    className="text-2xl font-bold text-white flex items-center gap-2"
                  >
                    {t("cfileAnalyzer", "title")}
                    <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">
                      {t("cfileAnalyzer", "ai")}
                    </span>
                  </h1>
                  <p className="text-sm text-violet-100">
                    {t("cfileAnalyzer", "subtitle")}
                  </p>
                </div>
                <span className="ml-2 px-2 py-1 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold rounded-full">
                  {t("cfileAnalyzer", "beta")}
                </span>
                <span
                  className="ml-1 px-2 py-1 bg-blue-500/90 text-white text-xs font-semibold rounded-full flex items-center gap-1"
                  aria-label="VA also uses AI for document classification in claims processing"
                >
                  🤖 {t("cfileAnalyzer", "vaUsesSimilarAi")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* AI Status & LLM Recommendation Badges */}
                <LLMRecommendationBadge toolId="cfile-analyzer" />
                <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
                {onReportBug && (
                  <ReportBugLink
                    onClick={onReportBug}
                    variant="light"
                    moduleName="C-File Analyzer"
                  />
                )}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                  aria-label={t("cfileAnalyzer", "closeCFileAnalyzer")}
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
        }
      >
        {isProcessing
          ? renderProcessing()
          : analysisResult
            ? renderDashboard()
            : renderUploadForm()}
      </ResponsiveModal>
      {renderPrivacyConsent()}
    </>
  );
}
