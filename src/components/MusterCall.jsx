/**
 * Vet-Rate.org - Muster Call Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * Mass document ingestion system for veteran claim files.
 * Handles 300+ MB of documents, auto-populates entire profile,
 * and generates comprehensive LLM-powered recommendations.
 *
 * "Answer the Muster Call" - Drop your entire VA file and let
 * the system analyze everything automatically.
 *
 * ARMY INSPECTION TERMINOLOGY (TC 3-21.5 Drill and Ceremonies):
 * - "Open Ranks, MARCH" - Begin inspection (front rank forward, creates inspection lanes)
 * - "Count, OFF" - Verify all personnel/documents present
 * - "Dress Right, DRESS" - Align formation (prepare documents)
 * - "Inspection, ARMS" - Show weapon is clear (extract document content)
 * - "Platoon, ATTENTION" - Formation ready for inspection
 * - "Sir/Ma'am, platoon prepared for inspection" - Report to inspector (AI analysis)
 * - "Close Ranks, MARCH" - Return to compact formation (finalize)
 * - "AT EASE" - Inspection complete, formation dismissed
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import ResponsiveModal from "./common/ResponsiveModal";
import {
  processMusterCallBatch,
  processFormationDocument,
  autoPopulateProfile,
  generateMusterCallReport,
  analyzeEvidenceGaps, // NEW: Evidence gap analysis (v1.16.0)
  validateFilesBatch,
  extractIntelligenceBriefingData,
  PROCESSING_STATES,
  formatFileSize,
} from "../utils/musterCallProcessor";
import {
  DOCUMENT_TYPES,
  getDocumentTypeLabel,
} from "../utils/documentClassifier";
import {
  isAnyAIAvailable,
  getAIStatus,
  isSwarmReady,
  initializeSwarm,
} from "../utils/unifiedAIService";
import useFormationQueue from "../hooks/useFormationQueue";
import FormationLineup from "./FormationLineup";
import PlatoonSergeantReview from "./PlatoonSergeantReview";
import DocumentIntelligenceBriefing from "./DocumentIntelligenceBriefing";
import ReportBugLink from "./ReportBugLink";
import ReactMarkdown from "react-markdown";

/**
 * Muster Call - Mass Document Processor
 */
export default function MusterCall({
  isOpen,
  onClose,
  onProcessComplete,
  onOpenDD214Analyzer,
}) {
  const { t } = useLanguage();
  const toast = useToast();

  // AI state - NO auto-init, user must manually load
  const [aiReady, setAiReady] = useState(false);
  const [aiInitializing, setAiInitializing] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [initMessage, setInitMessage] = useState("");

  // Formation queue management
  const {
    formation,
    currentEntry,
    stats,
    isProcessing: formationProcessing,
    isComplete: formationComplete,
    progress: formationProgress,
    hasDocuments,
    initializeFormation,
    startFormation,
    completeCurrentAndNext,
    skipCurrentAndNext,
    errorCurrentAndNext,
    updateEntry,
    reorderDocuments,
    removeDocument,
    clearFormation,
  } = useFormationQueue();

  // Check if AI is already ready on mount
  useEffect(() => {
    if (isSwarmReady()) {
      setAiReady(true);
    }
  }, []);

  // Debug: Log formation changes
  useEffect(() => {
    console.log(
      `📋 MusterCall formation changed: length=${formation.length}, hasDocuments=${hasDocuments}`,
    );
  }, [formation, hasDocuments]);

  /**
   * Manual AI Load function
   */
  const handleLoadAI = useCallback(async () => {
    if (aiInitializing || aiReady) return;

    setAiInitializing(true);
    setInitMessage("Initializing CW5 Auditor...");

    try {
      await initializeSwarm("auditor", {
        onProgress: (progress) => {
          setInitProgress(progress.progress || 0);
          setInitMessage(progress.message || "Loading...");
        },
        onComplete: () => {
          setAiReady(true);
          setAiInitializing(false);
          setInitProgress(100);
          setInitMessage("CW5 Auditor ready!");
          toast.success("🎖️ Warrant Council AI loaded and ready!");
        },
        onError: (error) => {
          setAiInitializing(false);
          setInitMessage("Failed to load AI");
          toast.error("Failed to load AI: " + error.message);
        },
      });
    } catch (err) {
      setAiInitializing(false);
      toast.error("Failed to initialize AI");
    }
  }, [aiInitializing, aiReady, toast]);

  // State management
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processingState, setProcessingState] = useState(
    PROCESSING_STATES.IDLE,
  );
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    processing: 0,
  });
  const [fileProgress, setFileProgress] = useState({});
  const [currentProgress, setCurrentProgress] = useState(null); // For Platoon Sergeant Review
  const [activeEntry, setActiveEntry] = useState(null); // Track the document being processed
  const [extractionResult, setExtractionResult] = useState(null); // For Intel Briefing
  const [showIntelBriefing, setShowIntelBriefing] = useState(false);
  const [results, setResults] = useState(null);
  const [report, setReport] = useState(null);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [useSequentialMode, setUseSequentialMode] = useState(true); // Toggle between modes

  // Compute locally to avoid stale closure issues (MUST be after processingState is declared)
  // Use !currentEntry instead of === null because .find() returns undefined, not null
  const shouldShowFormation =
    processingState === PROCESSING_STATES.IDLE &&
    useSequentialMode &&
    formation.length > 0 &&
    !currentEntry &&
    !activeEntry;

  // Show processing view when we have an active entry being processed
  const showProcessingView =
    activeEntry && currentProgress && !showIntelBriefing;

  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const abortControllerRef = useRef(null);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    (selectedFiles) => {
      console.log(
        "🎯 handleFileSelect called with",
        selectedFiles?.length,
        "files",
      );
      const fileArray = Array.from(selectedFiles);
      console.log("🎯 fileArray:", fileArray.length, "files");

      // Validate files
      const validationResult = validateFilesBatch(fileArray);
      console.log("🎯 validationResult:", validationResult);
      setValidation(validationResult);

      if (validationResult.valid.length > 0) {
        setFiles(fileArray);

        // Initialize formation if in sequential mode
        if (useSequentialMode) {
          console.log(
            "🎯 Calling initializeFormation with",
            validationResult.valid.length,
            "files",
          );
          const result = initializeFormation(validationResult.valid);
          console.log(
            "🎯 initializeFormation returned:",
            result?.length,
            "entries",
          );
          toast.success(
            `${validationResult.valid.length} document${validationResult.valid.length !== 1 ? "s" : ""} added to Formation queue`,
          );
        } else {
          toast.info(
            `${validationResult.valid.length} file${validationResult.valid.length !== 1 ? "s" : ""} selected`,
          );
        }

        if (validationResult.invalid.length > 0) {
          toast.warning(
            `${validationResult.invalid.length} file${validationResult.invalid.length !== 1 ? "s" : ""} skipped (unsupported format)`,
          );
        }

        setError(null);
      } else {
        setError(
          "No valid files selected. Please select PDF, DOCX, or TXT files.",
        );
        toast.error(
          "No valid files selected. Only PDF, DOCX, and TXT files are supported.",
        );
      }
    },
    [useSequentialMode, initializeFormation, toast],
  );

  /**
   * Handle drag and drop
   */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add(
        "border-blue-500",
        "bg-blue-50",
        "dark:bg-blue-900/20",
      );
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove(
        "border-blue-500",
        "bg-blue-50",
        "dark:bg-blue-900/20",
      );
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (dropZoneRef.current) {
        dropZoneRef.current.classList.remove(
          "border-blue-500",
          "bg-blue-50",
          "dark:bg-blue-900/20",
        );
      }

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        handleFileSelect(droppedFiles);
      }
    },
    [handleFileSelect],
  );

  /**
   * Stop processing
   */
  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setProcessing(false);
      setProcessingState(PROCESSING_STATES.IDLE);
      setError("Processing stopped by user");
    }
  };

  /**
   * Start processing files
   */
  const handleStartProcessing = async () => {
    console.log("🚩 handleStartProcessing called");
    console.log("🚩 files.length:", files.length);
    console.log("🚩 formation.length:", formation.length);
    console.log("🚩 useSequentialMode:", useSequentialMode);
    console.log("🚩 hasDocuments:", hasDocuments);

    // Use sequential mode if enabled
    if (useSequentialMode && formation.length > 0) {
      console.log("🚩 Starting sequential formation processing...");
      const firstEntry = startFormation();
      console.log("🚩 First entry:", firstEntry);

      if (firstEntry) {
        // Process the first document directly instead of relying on currentEntry
        processDocumentEntry(firstEntry);
      }
      return;
    }

    // Legacy batch mode requires files
    if (files.length === 0) {
      console.log("🚩 No files for batch processing");
      return;
    }

    // LEGACY: Batch processing mode (kept for fallback)
    // Create new abort controller for this processing run
    abortControllerRef.current = new AbortController();

    setProcessing(true);
    setProcessingState(PROCESSING_STATES.VALIDATING);
    setResults(null);
    setReport(null);
    setError(null);
    setShowReport(false);

    try {
      // Process all files
      const result = await processMusterCallBatch(files, {
        signal: abortControllerRef.current.signal,
        onProgress: (progressData) => {
          if (progressData.state) {
            setProcessingState(progressData.state);
          }
          if (progressData.filename) {
            setFileProgress((prev) => ({
              ...prev,
              [progressData.filename]: {
                state: progressData.state,
                progress: progressData.progress || 0,
                error: progressData.error,
              },
            }));
          }
          if (progressData.total !== undefined) {
            setProgress({
              total: progressData.total,
              completed: progressData.completed,
              processing: progressData.processing,
            });
          }
        },
        onComplete: async (completeData) => {
          setResults(completeData);
          setProcessingState(PROCESSING_STATES.POPULATING);

          // Auto-populate profile
          const populateResult = await autoPopulateProfile(
            completeData.results,
          );

          if (populateResult.success) {
            console.log(
              `✅ Auto-populated ${populateResult.count} profile fields`,
            );
          }

          // Generate LLM report
          console.log("🤖 Checking AI availability for report generation...");
          const aiStatus = getAIStatus();
          console.log("🤖 AI Status:", aiStatus);

          if (isAnyAIAvailable()) {
            console.log("✅ AI available, generating report...");
            setProcessingState(PROCESSING_STATES.ANALYZING);
            const reportResult = await generateMusterCallReport(
              completeData.results,
              completeData.classified,
            );

            console.log("📊 Report result:", reportResult);

            if (reportResult.success) {
              console.log("✅ Setting report in state");
              setReport(reportResult.report);
            } else {
              console.warn("⚠️ Report generation failed:", reportResult.error);
              setError(`Report generation failed: ${reportResult.error}`);
            }
          } else {
            console.warn("⚠️ No AI service available for report generation");
          }

          // NEW: Evidence Gap Analysis (v1.16.0)
          console.log("🔍 Running Evidence Gap Analysis...");
          const gapAnalysis = analyzeEvidenceGaps(completeData.results);
          if (gapAnalysis.success && gapAnalysis.totalGaps > 0) {
            console.log(
              `⚠️ Found ${gapAnalysis.totalGaps} potential evidence gaps!`,
            );
            // Store gap analysis results for display in UI
            if (completeData.results) {
              completeData.evidenceGaps = gapAnalysis;
            }
          } else {
            console.log("✅ No significant evidence gaps detected");
          }

          setProcessingState(PROCESSING_STATES.COMPLETE);

          // Trigger Intelligence Briefing if callback provided
          if (onProcessComplete && completeData && completeData.results) {
            // Transform results into Intelligence Briefing format
            const briefingData = extractIntelligenceBriefingData(
              completeData.results,
            );
            onProcessComplete(briefingData);
          }
        },
      });

      if (!result.success) {
        throw new Error(result.validation.errors[0] || "Processing failed");
      }
    } catch (err) {
      console.error("Muster Call processing error:", err);
      if (err.name === "AbortError") {
        setError("Processing stopped by user");
      } else {
        setError(err.message);
      }
      setProcessingState(PROCESSING_STATES.ERROR);
    } finally {
      setProcessing(false);
      abortControllerRef.current = null;
    }
  };

  /**
   * Process a specific document entry (SEQUENTIAL MODE)
   * This can be called with an entry directly, avoiding stale state issues
   */
  const processDocumentEntry = async (entry) => {
    if (!entry) {
      console.log("✅ Formation complete!");
      setProcessingState(PROCESSING_STATES.COMPLETE);
      setActiveEntry(null);
      setCurrentProgress(null);
      toast.success(
        `Formation complete! ${stats?.completed || 0} document${(stats?.completed || 0) !== 1 ? "s" : ""} processed successfully.`,
        7000,
      );
      return;
    }

    const file = entry.file;
    console.log(`🎖️ Processing document: ${file.name}`);

    // Set active entry for UI display
    setActiveEntry(entry);

    // Update entry status
    updateEntry(entry.id, { status: "CALLED" });
    setCurrentProgress({
      filename: file.name,
      fileSize: entry.fileSize || file.size,
      state: "initializing",
      stage: "platoon_sergeant",
      progress: 0,
      message: "Count, OFF! Preparing formation for inspection...",
    });
    setProcessingState(PROCESSING_STATES.EXTRACTING);

    try {
      // Process document with progress callbacks
      const result = await processFormationDocument(file, (progressData) => {
        console.log("📊 Progress update received:", progressData);
        setCurrentProgress({
          filename: file.name,
          fileSize: entry.fileSize || file.size,
          ...progressData,
        });

        // Update entry based on stage
        if (progressData.stage === "platoon_sergeant") {
          updateEntry(entry.id, {
            status: "OCR_IN_PROGRESS",
            progress: progressData.progress,
          });
        } else if (
          progressData.stage === "intel_classify" ||
          progressData.stage === "intel_extract"
        ) {
          updateEntry(entry.id, {
            status: "INTEL_BRIEFING",
            progress: progressData.progress,
          });
        }
      });

      console.log("✅ Document processed:", result);

      // Show Intelligence Briefing for user verification
      // Check status === 'complete' since processFormationDocument sets that, not success
      if (result.status === "complete" && result.readyForReview) {
        setExtractionResult(result);
        setShowIntelBriefing(true);
        updateEntry(entry.id, { status: "USER_REVIEW" });
      } else if (result.status === "error") {
        throw new Error(result.error || "Processing failed");
      }
    } catch (err) {
      console.error("❌ Document processing error:", err);
      const nextEntry = errorCurrentAndNext(err.message);
      setCurrentProgress(null);
      setActiveEntry(null);

      // Move to next document after error
      setTimeout(() => {
        if (nextEntry) {
          processDocumentEntry(nextEntry);
        } else {
          const next = formation.find((e) => e.status === "WAITING");
          if (next) {
            processDocumentEntry(next);
          } else {
            processDocumentEntry(null); // Triggers completion
          }
        }
      }, 1000);
    }
  };

  /**
   * Process next document in formation (SEQUENTIAL MODE)
   * Uses currentEntry from hook - call this after state has updated
   */
  const processNextDocument = async () => {
    const next = formation.find(
      (e) => e.status === "WAITING" || e.status === "CALLED",
    );
    processDocumentEntry(next);
  };

  /**
   * Handle Intel Briefing verification (SEQUENTIAL MODE)
   */
  const handleVerifyAndSave = async (verifiedData) => {
    console.log("✅ User verified data:", verifiedData);

    try {
      // Complete current document and move to next
      const nextEntry = completeCurrentAndNext({
        ...extractionResult,
        verifiedData,
      });

      toast.success(
        `Document "${extractionResult.filename}" saved to Knowledge Base`,
      );

      setShowIntelBriefing(false);
      setExtractionResult(null);
      setCurrentProgress(null);
      setActiveEntry(null);

      // Process next in formation
      setTimeout(() => {
        if (nextEntry) {
          processDocumentEntry(nextEntry);
        } else {
          // Check if there are more documents
          const next = formation.find(
            (e) => e.status === "WAITING" || e.status === "CALLED",
          );
          if (next) {
            processDocumentEntry(next);
          } else {
            processDocumentEntry(null); // Triggers completion
          }
        }
      }, 500);
    } catch (err) {
      console.error("❌ Save error:", err);
      setError(err.message);
      toast.error(`Failed to save document: ${err.message}`);
    }
  };

  /**
   * Handle skip document (SEQUENTIAL MODE)
   */
  const handleSkipDocument = () => {
    console.log("⏭️ Skipping document:", activeEntry?.file?.name);

    const nextEntry = skipCurrentAndNext("User skipped");
    setShowIntelBriefing(false);
    setExtractionResult(null);
    setCurrentProgress(null);
    setActiveEntry(null);

    // Process next in formation
    setTimeout(() => {
      if (nextEntry) {
        processDocumentEntry(nextEntry);
      } else {
        const next = formation.find((e) => e.status === "WAITING");
        if (next) {
          processDocumentEntry(next);
        } else {
          processDocumentEntry(null); // Triggers completion
        }
      }
    }, 500);
  };

  /**
   * Reset to initial state
   */
  const handleReset = () => {
    setFiles([]);
    setProcessing(false);
    setProcessingState(PROCESSING_STATES.IDLE);
    setProgress({ completed: 0, total: 0, processing: 0 });
    setFileProgress({});
    setResults(null);
    setReport(null);
    setValidation(null);
    setError(null);
    setShowReport(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      labelledBy="muster-call-title"
      dismissable={!processing}
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {processingState === PROCESSING_STATES.IDLE &&
              files.length > 0 &&
              !useSequentialMode && (
                <button
                  onClick={handleStartProcessing}
                  disabled={
                    !aiReady ||
                    aiInitializing ||
                    !validation ||
                    validation.valid.length === 0
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🎖️ Open Ranks, MARCH!
                </button>
              )}
            {(processingState === PROCESSING_STATES.COMPLETE ||
              formationComplete) && (
              <button
                onClick={handleReset}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                🎖️ Fall In - New Formation
              </button>
            )}
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            {useSequentialMode ? (
              <span className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">●</span>
                Formation Mode (Sequential)
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">●</span>
                Batch Mode
              </span>
            )}
          </div>
        </div>
      }
      header={
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2
                id="muster-call-title"
                className="text-3xl font-bold mb-2 flex items-center gap-3"
              >
                <span className="text-4xl">📋</span>
                Muster Call{" "}
                <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">
                  BETA
                </span>
              </h2>
              <p className="text-blue-100 text-sm max-w-2xl">
                Drop your entire VA file - claim letters, C-Files, DD214s. We'll
                analyze everything and build your complete profile
                automatically.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ReportBugLink feature="muster-call" />
              <button
                onClick={onClose}
                disabled={processing}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors disabled:opacity-50"
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
      }
    >
      {/* AI Initialization Banner */}
      {aiInitializing && (
        <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                {/* Spinning circular progress indicator */}
                <div className="w-12 h-12 rounded-full border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400 animate-spin"></div>
                {/* CWO icon in center */}
                <div className="absolute inset-0 flex items-center justify-center text-xl">
                  🎖️
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Initializing Warrant Council AI...
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {initMessage || "Preparing AI agent for analysis"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                  🎖️ Three Chief Warrant Officers (CW3-CW5) - Technical experts
                  trained to analyze your claim, write statements, and calculate
                  ratings
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {initProgress}%
              </div>
            </div>
          </div>
          <div className="mt-4 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden relative">
            <div
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-500"
              style={{ width: `${initProgress}%` }}
            />
            {/* Guidon flag marching across */}
            <div
              className="absolute -top-6 transform -translate-x-1/2 transition-all duration-500 text-2xl"
              style={{ left: `${initProgress}%` }}
              aria-label="Warrant Council loading progress"
            >
              🚩
            </div>
          </div>
        </div>
      )}

      {aiReady && !aiInitializing && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border-l-4 border-green-500">
          <div className="flex items-center">
            <span className="text-2xl mr-3">✅</span>
            <div>
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                CW5 Auditor ready - Your claim accuracy Chief Warrant Officer is
                standing by
              </span>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                Intelligence Briefing will be generated automatically after
                document processing
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Load AI Button - Show when AI not loaded and not initializing */}
      {!aiReady && !aiInitializing && (
        <div className="mb-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🎖️</span>
              <div>
                <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  Warrant Council AI Required
                </span>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                  Load AI to enable intelligent document analysis and processing
                </p>
              </div>
            </div>
            <button
              onClick={handleLoadAI}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              🎖️ Load AI
            </button>
          </div>
        </div>
      )}

      {/* Processing Time Warning */}
      <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border-l-4 border-yellow-500">
        <div className="flex items-start">
          <span className="text-xl mr-3 mt-0.5">⏱️</span>
          <div>
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Processing Time Notice
            </span>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
              Large files (like 320MB+ C-files) and poor-quality scanned images
              may take several minutes to process. Please be patient while we
              extract and analyze your documents with maximum accuracy.
            </p>
          </div>
        </div>
      </div>

      {/* DROP ZONE - Military-style document staging area */}
      {processingState === PROCESSING_STATES.IDLE &&
        !(useSequentialMode && hasDocuments) && (
          <>
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="relative border-4 border-dashed border-amber-500 dark:border-amber-400 rounded-xl p-8 text-center transition-all duration-300 hover:border-amber-400 hover:bg-amber-50/30 dark:hover:bg-amber-900/20 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-inner"
            >
              {/* Corner markers - military targeting style */}
              <div className="absolute top-2 left-2 w-6 h-6 border-l-4 border-t-4 border-amber-500 dark:border-amber-400"></div>
              <div className="absolute top-2 right-2 w-6 h-6 border-r-4 border-t-4 border-amber-500 dark:border-amber-400"></div>
              <div className="absolute bottom-2 left-2 w-6 h-6 border-l-4 border-b-4 border-amber-500 dark:border-amber-400"></div>
              <div className="absolute bottom-2 right-2 w-6 h-6 border-r-4 border-b-4 border-amber-500 dark:border-amber-400"></div>

              {/* DROP ZONE Header */}
              <div className="mb-4">
                <div className="inline-block bg-amber-500 dark:bg-amber-600 text-black dark:text-white px-6 py-2 rounded font-bold text-lg tracking-widest shadow-md">
                  ⬇️ DROP ZONE ⬇️
                </div>
              </div>

              <div className="text-5xl mb-3 animate-bounce">📦</div>
              <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                Deploy Your Documents Here
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                DD214s • C-Files • Decision Letters • Medical Records
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.rtf"
                onChange={(e) => {
                  console.log(
                    "🎯 File input onChange fired, files:",
                    e.target.files?.length,
                  );
                  handleFileSelect(e.target.files);
                }}
                onClick={(e) => console.log("🎯 File input clicked")}
                className="hidden"
                id="muster-call-files"
              />
              <label
                htmlFor="muster-call-files"
                onClick={() => console.log("🎯 Label clicked")}
                className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-lg font-bold cursor-pointer transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                🎯 Select Files
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 font-mono">
                SUPPORTED: PDF • DOCX • TXT | MAX: 500MB
              </p>

              {/* Document type badges */}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
                  C-Files (320MB+)
                </span>
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                  Decision Letters
                </span>
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                  DD214s
                </span>
                <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full">
                  Medical Records
                </span>
              </div>

              {/* Privacy assurance - 100% client-side */}
              <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-semibold text-sm">
                    100% ON YOUR DEVICE
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                  Your documents are <strong>never uploaded</strong> anywhere.
                  All processing happens right here in your browser. Your
                  records stay on YOUR device - we never see them.
                </p>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && !useSequentialMode && (
              <div className="mt-6 bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Selected Files ({files.length})
                  </h3>
                  <button
                    onClick={handleReset}
                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Clear All
                  </button>
                </div>

                {/* Validation Messages */}
                {validation && (
                  <>
                    {validation.warnings.length > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-4">
                        <div className="flex">
                          <div className="text-xl mr-3">⚠️</div>
                          <div className="text-sm text-yellow-800 dark:text-yellow-200">
                            <p className="font-semibold mb-2">Warnings:</p>
                            {validation.warnings.map((warning, idx) => (
                              <p key={idx}>• {warning.message}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {validation.invalid.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 mb-4">
                        <div className="flex">
                          <div className="text-xl mr-3">❌</div>
                          <div className="text-sm text-red-800 dark:text-red-200">
                            <p className="font-semibold mb-2">Invalid Files:</p>
                            {validation.invalid.map((invalid, idx) => (
                              <p key={idx}>
                                • {invalid.file.name}: {invalid.reason}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* File List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-2xl">📄</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Size */}
                {validation && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total: {formatFileSize(validation.totalSize)} •{" "}
                      {validation.valid.length} valid files
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      {/* Formation Lineup (SEQUENTIAL MODE) - Use locally computed shouldShowFormation */}
      {shouldShowFormation && (
        <div className="mt-6">
          <FormationLineup
            formation={formation}
            onReorder={reorderDocuments}
            onRemove={removeDocument}
            onStartFormation={handleStartProcessing}
            onClearFormation={clearFormation}
            aiReady={aiReady}
            aiInitializing={aiInitializing}
          />
        </div>
      )}

      {/* Platoon Sergeant Review (SEQUENTIAL MODE - Active Processing) */}
      {showProcessingView && (
        <div className="space-y-4">
          {/* Show compact formation status */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                📋 Processing {stats?.completed || 0} of {formation.length}{" "}
                documents
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {stats?.waiting || 0} waiting • {stats?.skipped || 0} skipped •{" "}
                {stats?.errors || 0} errors
              </span>
            </div>
          </div>

          <PlatoonSergeantReview
            document={activeEntry.file}
            progress={currentProgress}
            onComplete={() => {}}
            onError={(error) => errorCurrentAndNext(error)}
            onSkip={handleSkipDocument}
          />
        </div>
      )}

      {/* Intelligence Briefing Modal (SEQUENTIAL MODE - User Verification) */}
      {showIntelBriefing && extractionResult && activeEntry && (
        <DocumentIntelligenceBriefing
          document={activeEntry.file}
          extractionResult={extractionResult}
          conflicts={[]} // TODO: Implement conflict detection
          onVerify={handleVerifyAndSave}
          onSkip={handleSkipDocument}
          onClose={() => setShowIntelBriefing(false)}
          onOpenDD214Analyzer={onOpenDD214Analyzer}
        />
      )}

      {/* Processing View */}
      {processing && processingState !== PROCESSING_STATES.IDLE && (
        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {getStateLabel(processingState)}
              </h3>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {progress.completed} / {progress.total} files
                </div>
                <button
                  onClick={handleStopProcessing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  aria-label="Stop processing"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="6" y="6" width="12" height="12" strokeWidth="2" />
                  </svg>
                  Stop
                </button>
              </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${(progress.completed / progress.total) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Individual File Progress */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              File Progress:
            </h4>
            {Object.entries(fileProgress).map(([filename, fileData]) => (
              <div
                key={filename}
                className="bg-white dark:bg-gray-800 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                    {filename}
                  </p>
                  <span className="text-xs text-gray-500 ml-2">
                    {fileData.progress?.toFixed(0) || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      fileData.error ? "bg-red-500" : "bg-green-500"
                    }`}
                    style={{ width: `${fileData.progress || 0}%` }}
                  />
                </div>
                {fileData.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {fileData.error}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Processing Animation */}
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        </div>
      )}

      {/* Results View */}
      {processingState === PROCESSING_STATES.COMPLETE && results && (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 p-6 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-3xl">✅</span>
              <div>
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                  Muster Call Complete!
                </h3>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Processed {results.summary.successful} files in{" "}
                  {(results.summary.processingTime / 1000).toFixed(1)}s
                </p>
              </div>
            </div>
          </div>

          {/* Document Breakdown */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Discovered Documents
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(results.classified.grouped).map(
                ([type, docs]) => (
                  <div
                    key={type}
                    className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500"
                  >
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {getDocumentTypeLabel(type)}
                    </h4>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {docs.length}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {docs.length === 1 ? "document" : "documents"}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* LLM Report */}
          {report && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-2xl">🤖</span>
                  AI Analysis & Recommendations
                </h3>
                <div className="flex items-center gap-3">
                  <ReportBugLink context="muster-call-report" />
                  <button
                    onClick={() => setShowReport(!showReport)}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    {showReport ? "Hide" : "Show"} Report
                  </button>
                </div>
              </div>
              {showReport && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{report}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error View */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-6 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-3xl">❌</span>
            <div>
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
                Processing Error
              </h3>
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}
    </ResponsiveModal>
  );
}

/**
 * Get human-readable label for processing state
 */
function getStateLabel(state) {
  const labels = {
    [PROCESSING_STATES.IDLE]: "Formation Ready",
    [PROCESSING_STATES.VALIDATING]: "Count, OFF! Verifying personnel...",
    [PROCESSING_STATES.LOADING]: "Dress Right, DRESS! Loading documents...",
    [PROCESSING_STATES.EXTRACTING]: "Inspection, ARMS! Extracting content...",
    [PROCESSING_STATES.CLASSIFYING]:
      "Platoon, ATTENTION! Classifying documents...",
    [PROCESSING_STATES.ANALYZING]:
      "Sir/Ma'am, platoon prepared for inspection...",
    [PROCESSING_STATES.POPULATING]:
      "Close Ranks, MARCH! Auto-filling profile...",
    [PROCESSING_STATES.COMPLETE]: "AT EASE - Inspection Complete",
    [PROCESSING_STATES.ERROR]: "Fall Out - Error Encountered",
  };
  return labels[state] || "Ready, FRONT...";
}
