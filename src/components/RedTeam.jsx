import { useState, useEffect, useRef } from "react";
import ReportBugLink from "./ReportBugLink";
import BuyMeCoffee from "./BuyMeCoffee";
import ResponsiveModal from "./common/ResponsiveModal";
import { stressTestStatement, isAIAvailable } from "../utils/aiStatementHelper";
import { getAIStatus, isAnyAIAvailable } from "../utils/unifiedAIService";
import { AIStatusBadge } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import SmartAILoadButton from "./SmartAILoadButton";
import { analyzePDF, OCR_STATES, formatFileSize } from "../utils/ocr";
import VoiceInputButton from "./VoiceInput";

/**
 * RedTeam Component - "The Statement Stress Test"
 *
 * Problem: Veterans are trained to be tough. They write "My back hurts a bit, but I push through."
 * Result: Denial. (The VA reads: "Not severe.")
 *
 * This AI "Drill Sergeant" reviews their draft and flags "Weak Language"
 * without rewriting it (that would be fake) - just highlights issues and suggests clinical equivalents.
 */

// ============================================================================
// HOOKS
// ============================================================================

function useStressTest() {
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const runStressTest = async (draftStatement) => {
    if (!draftStatement.trim()) {
      setError("Please paste your draft statement first.");
      return;
    }

    if (draftStatement.trim().length < 50) {
      setError(
        "Your statement seems too short. Please paste a more complete draft.",
      );
      return;
    }

    if (!isAIAvailable()) {
      setError(
        "AI features are not available. Please load the Warrant Council AI using the button above, or configure your API key in Settings.",
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await stressTestStatement(draftStatement);

      if (response.success) {
        setResults(response.data);
      } else {
        setError(
          response.error || "Failed to analyze statement. Please try again.",
        );
      }
    } catch (err) {
      console.error("Stress test error:", err);
      setError("An error occurred during analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return { results, isLoading, error, runStressTest };
}

function usePdfDropIn(setDraftStatement) {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfOcrProgress, setPdfOcrProgress] = useState(null);
  const [pdfIsDragging, setPdfIsDragging] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const pdfFileInputRef = useRef(null);

  const processPdfFile = async (file) => {
    setPdfFile(file);
    setPdfError(null);
    setDraftStatement("");

    try {
      const result = await analyzePDF(file, (progress) => {
        setPdfOcrProgress(progress);
      });

      if (result.success && result.text) {
        setDraftStatement(result.text);
      } else {
        setPdfError(result.error || "Failed to extract text from PDF");
      }
    } catch (err) {
      console.error("PDF processing error:", err);
      setPdfError(
        "Failed to process PDF. Please try again or paste the text manually.",
      );
    }

    setPdfOcrProgress(null);
  };

  const handlePdfDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfIsDragging(true);
  };

  const handlePdfDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfIsDragging(false);
  };

  const handlePdfDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === "application/pdf") {
        await processPdfFile(file);
      } else {
        setPdfError("Please drop a PDF file (your draft statement document)");
      }
    }
  };

  const handlePdfFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await processPdfFile(file);
    }
  };

  const handleRemovePdf = () => {
    setPdfFile(null);
    setPdfOcrProgress(null);
    setDraftStatement("");
    setPdfError(null);
    if (pdfFileInputRef.current) {
      pdfFileInputRef.current.value = "";
    }
  };

  return {
    pdfFile,
    pdfOcrProgress,
    pdfIsDragging,
    pdfError,
    pdfFileInputRef,
    handlePdfDragOver,
    handlePdfDragLeave,
    handlePdfDrop,
    handlePdfFileChange,
    handleRemovePdf,
  };
}

function useAIStatusPolling() {
  const [, setAIStatus] = useState(getAIStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
}

// ============================================================================
// STATIC / PRESENTATIONAL PIECES
// ============================================================================

const AttentionBanner = () => (
  <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl">
    <div className="flex items-start gap-3">
      <span className="text-2xl">🎖️</span>
      <div>
        <h3 className="font-bold text-amber-800 dark:text-amber-200">
          Attention, Soldier!
        </h3>
        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
          You were trained to &quot;push through&quot; and &quot;be tough.&quot;{" "}
          <strong>That mindset LOSES claims.</strong>
          The VA isn&apos;t reading for courage - they&apos;re reading for{" "}
          <strong>severity and frequency</strong>. Let the Red Team find where
          you&apos;re hurting your own case.
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 border-t border-amber-200 dark:border-amber-700 pt-2">
          Educational self-help only - not legal representation. For accredited
          assistance, contact a VSO, claims agent, or VA-accredited attorney (38
          C.F.R. § 14.629).
        </p>
      </div>
    </div>
  </div>
);

const handleSmartAILoadComplete = (model) =>
  // eslint-disable-next-line no-console
  console.log("Smart AI loaded for Red Team:", model?.name);

const AiLoadPrompt = () => {
  if (isAnyAIAvailable()) return null;
  return (
    <div className="mb-6">
      <SmartAILoadButton
        toolId="red-team"
        onLoadComplete={handleSmartAILoadComplete}
      />
    </div>
  );
};

const RedTeamHeader = ({ onClose, onOpenAISettings, onReportBug }) => (
  <div className="flex-shrink-0 bg-gradient-to-r from-rose-600 via-red-600 to-rose-600 text-white px-6 py-6 rounded-t-lg relative overflow-hidden">
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>

    <div className="relative flex items-start justify-between">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
          <span className="text-3xl">🎖️</span>
        </div>
        <div>
          <h2
            id="red-team-title"
            className="text-2xl sm:text-3xl font-bold flex items-center gap-2"
          >
            The Red Team
            <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
              AI
            </span>
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
              BETA
            </span>
          </h2>
          <p className="text-red-100 text-sm sm:text-base mt-1">
            Statement Stress Test • Find Weak Language
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <LLMRecommendationBadge toolId="red-team" />
        <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
        {onReportBug && (
          <ReportBugLink
            onClick={onReportBug}
            variant="light"
            moduleName="Red Team"
          />
        )}
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
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
);

// ============================================================================
// INPUT SECTION
// ============================================================================

const InputMethodTabs = ({ inputMethod, setInputMethod }) => (
  <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
    <button
      onClick={() => setInputMethod("paste")}
      className={`px-4 py-2 text-sm font-semibold transition-colors ${
        inputMethod === "paste"
          ? "text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400"
          : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      }`}
    >
      📋 Paste Text
    </button>
    <button
      onClick={() => setInputMethod("pdf")}
      className={`px-4 py-2 text-sm font-semibold transition-colors ${
        inputMethod === "pdf"
          ? "text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400"
          : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      }`}
    >
      📄 Drop-In PDF
    </button>
  </div>
);

const PasteInputPanel = ({
  inputMethod,
  draftStatement,
  setDraftStatement,
}) => {
  if (inputMethod !== "paste") return null;
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        📝 Paste Your Draft Statement (or use microphone to speak)
      </label>
      <div className="relative">
        <textarea
          value={draftStatement}
          onChange={(e) => setDraftStatement(e.target.value)}
          placeholder="Paste or speak your Statement in Support of Claim, Personal Statement, or any written testimony here...

Example: 'My back hurts sometimes after standing for a while, but I try to push through it. I've learned to manage the pain by taking breaks.'"
          rows={12}
          className="w-full px-4 py-3 pr-14 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
        />
        <div className="absolute right-3 top-3">
          <VoiceInputButton
            onTranscript={(text) =>
              setDraftStatement((prev) => (prev ? `${prev} ${text}` : text))
            }
            size="md"
          />
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {draftStatement.length} characters
        </span>
        <button
          onClick={() => setDraftStatement("")}
          className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
        >
          Clear
        </button>
      </div>
    </>
  );
};

const PdfDropZone = ({
  pdfFile,
  pdfOcrProgress,
  pdfIsDragging,
  pdfFileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
}) => {
  if (pdfFile || pdfOcrProgress) return null;
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- drag-and-drop zone only; keyboard-accessible file selection is provided via the "browse to select" button and hidden file input below
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
        pdfIsDragging
          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
          : "border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
      }`}
    >
      <input
        ref={pdfFileInputRef}
        type="file"
        accept=".pdf"
        onChange={onFileChange}
        className="hidden"
      />
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-purple-600 dark:text-purple-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            Drop your PDF here
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            or{" "}
            <button
              onClick={() => pdfFileInputRef.current?.click()}
              className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
            >
              browse to select
            </button>
          </p>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Supports: Personal Statement, Statement in Support of Claim (PDF)
        </div>
      </div>
    </div>
  );
};

const getOcrStateMessage = (state) => {
  if (state === OCR_STATES.LOADING) return "Loading PDF...";
  if (state === OCR_STATES.EXTRACTING) return "Extracting text...";
  if (state === OCR_STATES.OCR_PROCESSING)
    return "Running OCR on scanned pages...";
  return "Processing...";
};

const PdfOcrProgressCard = ({ pdfOcrProgress }) => {
  if (!pdfOcrProgress) return null;
  return (
    <div className="border border-purple-200 dark:border-purple-700 rounded-xl p-6 bg-purple-50 dark:bg-purple-900/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent"></div>
        <span className="font-medium text-purple-800 dark:text-purple-200">
          {getOcrStateMessage(pdfOcrProgress.state)}
        </span>
      </div>
      {pdfOcrProgress.progress > 0 && (
        <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
          <div
            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${pdfOcrProgress.progress}%` }}
          />
        </div>
      )}
      {pdfOcrProgress.message && (
        <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
          {pdfOcrProgress.message}
        </p>
      )}
    </div>
  );
};

const PdfFileInfoRow = ({ pdfFile, onRemove }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-800 rounded-lg flex items-center justify-center">
        <svg
          className="w-5 h-5 text-purple-600 dark:text-purple-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <div>
        <p className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
          {pdfFile.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatFileSize(pdfFile.size)}
        </p>
      </div>
    </div>
    <button
      onClick={onRemove}
      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
      aria-label="Remove file"
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
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  </div>
);

const PdfExtractionStatus = ({ pdfError, draftStatement }) => (
  <>
    {pdfError && (
      <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
        <div className="flex items-start gap-2">
          <svg
            className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-300">{pdfError}</p>
        </div>
      </div>
    )}

    {draftStatement && !pdfError && (
      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <span className="text-green-500">✓</span>
          <span className="text-sm font-medium">
            Text extracted - {draftStatement.length} characters
          </span>
        </div>
      </div>
    )}
  </>
);

const PdfFileSelectedCard = ({
  pdfFile,
  pdfOcrProgress,
  pdfError,
  draftStatement,
  onRemove,
}) => {
  if (!pdfFile || pdfOcrProgress) return null;
  return (
    <div className="border border-purple-200 dark:border-purple-700 rounded-xl p-4 bg-white dark:bg-gray-800">
      <PdfFileInfoRow pdfFile={pdfFile} onRemove={onRemove} />
      <PdfExtractionStatus
        pdfError={pdfError}
        draftStatement={draftStatement}
      />
    </div>
  );
};

const PdfInputPanel = ({ inputMethod, pdf, draftStatement }) => {
  if (inputMethod !== "pdf") return null;
  return (
    <div>
      <PdfDropZone
        pdfFile={pdf.pdfFile}
        pdfOcrProgress={pdf.pdfOcrProgress}
        pdfIsDragging={pdf.pdfIsDragging}
        pdfFileInputRef={pdf.pdfFileInputRef}
        onDragOver={pdf.handlePdfDragOver}
        onDragLeave={pdf.handlePdfDragLeave}
        onDrop={pdf.handlePdfDrop}
        onFileChange={pdf.handlePdfFileChange}
      />
      <PdfOcrProgressCard pdfOcrProgress={pdf.pdfOcrProgress} />
      <PdfFileSelectedCard
        pdfFile={pdf.pdfFile}
        pdfOcrProgress={pdf.pdfOcrProgress}
        pdfError={pdf.pdfError}
        draftStatement={draftStatement}
        onRemove={pdf.handleRemovePdf}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
        🔒 Your PDF is processed locally in your browser - nothing is sent to
        any server.
      </p>
    </div>
  );
};

const StressTestButton = ({ isLoading, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full mt-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
  >
    {isLoading ? (
      <>
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span>Analyzing...</span>
      </>
    ) : (
      <>
        <span>🔍</span>
        <span>Stress Test My Statement</span>
      </>
    )}
  </button>
);

// ============================================================================
// RESULTS SECTION
// ============================================================================

const ErrorAlert = ({ error }) => {
  if (!error) return null;
  return (
    <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg mb-4">
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-red-700 dark:text-red-300">{error}</span>
      </div>
    </div>
  );
};

const getScoreColor = (score) => {
  if (score >= 8) return "text-green-600 dark:text-green-400";
  if (score >= 6) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 4) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
};

const getScoreEmoji = (score) => {
  if (score >= 8) return "🎯";
  if (score >= 6) return "⚠️";
  if (score >= 4) return "🔶";
  return "🚨";
};

const getScoreMessage = (score) => {
  if (score >= 8) return "Strong Statement!";
  if (score >= 6) return "Good, But Could Be Stronger";
  if (score >= 4) return "Needs Significant Work";
  return "Major Revisions Needed";
};

const getScoreGradientColor = (score) => {
  if (score >= 6) return "#22c55e";
  if (score >= 4) return "#f59e0b";
  return "#ef4444";
};

const ScoreCard = ({ score }) => (
  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Statement Score
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-4xl font-bold ${getScoreColor(score)}`}>
            {score}/10
          </span>
          <span className="text-2xl">{getScoreEmoji(score)}</span>
        </div>
        <p className={`text-sm font-medium ${getScoreColor(score)}`}>
          {getScoreMessage(score)}
        </p>
      </div>
      <div className="w-20 h-20 rounded-full border-4 border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: `conic-gradient(${getScoreGradientColor(score)} ${score * 10}%, #e5e7eb ${score * 10}%)`,
          }}
        >
          <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center">
            <span className="text-xl font-bold">{score}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const CritiqueSummary = ({ critique }) => {
  if (!critique) return null;
  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
      <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2 mb-2">
        <span>📋</span> Overall Assessment
      </h4>
      <p className="text-sm text-blue-700 dark:text-blue-300">{critique}</p>
    </div>
  );
};

const WeakSpotsList = ({ weakSpots }) => {
  if (!weakSpots || weakSpots.length === 0) return null;
  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
        <span>🚨</span> Weak Spots Found ({weakSpots.length})
      </h4>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {weakSpots.map((spot, index) => (
          <div
            key={index}
            className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border-l-4 border-red-500"
          >
            <div className="flex items-start gap-3">
              <span className="text-red-500 font-bold text-lg">
                #{index + 1}
              </span>
              <div className="flex-1 min-w-0">
                {spot.quote && (
                  <p className="text-sm font-medium text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded inline-block mb-2">
                    &quot;{spot.quote}&quot;
                  </p>
                )}
                {spot.issue && (
                  <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                    <strong>Problem:</strong> {spot.issue}
                  </p>
                )}
                {spot.suggestion && (
                  <div className="bg-green-50 dark:bg-green-900/30 rounded p-2 border border-green-200 dark:border-green-700">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      <strong>✅ Try Instead:</strong> {spot.suggestion}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const NoIssuesCard = ({ weakSpots, score }) => {
  const hasNoWeakSpots = !weakSpots || weakSpots.length === 0;
  if (!(hasNoWeakSpots && score >= 8)) return null;
  return (
    <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-6 border border-green-200 dark:border-green-700 text-center">
      <span className="text-4xl mb-2 block">🎯</span>
      <h4 className="font-bold text-green-800 dark:text-green-200 text-lg">
        Strong Statement!
      </h4>
      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
        Your statement uses appropriate clinical language and clearly describes
        your limitations.
      </p>
    </div>
  );
};

const ResultsCard = ({ results }) => {
  if (!results) return null;
  return (
    <div className="space-y-4">
      <ScoreCard score={results.score} />
      <CritiqueSummary critique={results.critique} />
      <WeakSpotsList weakSpots={results.weak_spots} />
      <NoIssuesCard weakSpots={results.weak_spots} score={results.score} />
    </div>
  );
};

const LoadingIndicator = ({ isLoading }) => {
  if (!isLoading) return null;
  return (
    <div className="h-full flex items-center justify-center py-12 text-center">
      <div className="max-w-sm">
        <div className="relative mb-6">
          <div className="text-6xl animate-pulse">🎖️</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 border-4 border-red-200 dark:border-red-800 border-t-red-500 rounded-full animate-spin"></div>
          </div>
        </div>
        <p className="text-lg font-medium text-red-700 dark:text-red-300">
          Drill Sergeant is reviewing...
        </p>
        <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
          Scanning for weak language that hurts your claim
        </p>
        <div className="mt-4 space-y-2 text-xs text-gray-500 dark:text-gray-500">
          <p className="flex items-center justify-center gap-2">
            <span className="animate-pulse">🔍</span> Finding minimizing
            phrases...
          </p>
          <p className="flex items-center justify-center gap-2">
            <span className="animate-pulse">💪</span> Checking for &quot;tough
            guy&quot; language...
          </p>
          <p className="flex items-center justify-center gap-2">
            <span className="animate-pulse">📊</span> Scoring clinical
            effectiveness...
          </p>
        </div>
        <p className="text-xs text-red-600 dark:text-red-400 mt-4">
          This usually takes 10-30 seconds
        </p>
      </div>
    </div>
  );
};

const EmptyResultsState = ({ results, isLoading, error }) => {
  if (results || isLoading || error) return null;
  return (
    <div className="h-full flex items-center justify-center py-12 text-center text-gray-500 dark:text-gray-400">
      <div>
        <div className="text-6xl mb-4">🎖️</div>
        <p className="text-lg font-medium">Ready for Inspection</p>
        <p className="text-sm mt-2">
          Paste your statement and click &quot;Stress Test&quot; to begin
          analysis
        </p>
      </div>
    </div>
  );
};

const WEAK_LANGUAGE_EXAMPLES = [
  { weak: "a little bit", strong: "moderate to severe" },
  { weak: "sometimes", strong: "approximately 3-4 times weekly" },
  { weak: "I manage", strong: "I struggle to cope with" },
  { weak: "push through", strong: "forces me to stop activities" },
  { weak: "hurts", strong: "causes debilitating pain rated 7/10" },
  { weak: "trouble sleeping", strong: "chronic insomnia, 3-4 hours nightly" },
];

const WeakLanguageTipsCard = () => (
  <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-xl">
    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
      <span>💡</span> Common Weak Language to Avoid
    </h4>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
      {WEAK_LANGUAGE_EXAMPLES.map(({ weak, strong }) => (
        <div key={weak} className="bg-white dark:bg-gray-800 rounded-lg p-3">
          <p className="text-red-600 dark:text-red-400 line-through">
            &quot;{weak}&quot;
          </p>
          <p className="text-green-600 dark:text-green-400">
            → &quot;{strong}&quot;
          </p>
        </div>
      ))}
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const RedTeam = ({ onClose, onReportBug, onOpenAISettings }) => {
  // NOTE: AI is NOT auto-loaded - user selects AI model via SmartAILoadButton dropdown
  const [draftStatement, setDraftStatement] = useState("");
  const { results, isLoading, error, runStressTest } = useStressTest();
  const [inputMethod, setInputMethod] = useState("paste"); // 'paste' or 'pdf'
  const pdf = usePdfDropIn(setDraftStatement);
  useAIStatusPolling();

  const handleStressTest = () => runStressTest(draftStatement);

  const footer = (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <BuyMeCoffee show={results !== null} trigger="red-team" />
      <button
        onClick={onClose}
        className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        Close
      </button>
    </div>
  );

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="2xl"
      labelledBy="red-team-title"
      header={
        <RedTeamHeader
          onClose={onClose}
          onOpenAISettings={onOpenAISettings}
          onReportBug={onReportBug}
        />
      }
      footer={footer}
    >
      {/* Content */}
      <div>
        <AttentionBanner />
        <AiLoadPrompt />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div>
            <InputMethodTabs
              inputMethod={inputMethod}
              setInputMethod={setInputMethod}
            />
            <PasteInputPanel
              inputMethod={inputMethod}
              draftStatement={draftStatement}
              setDraftStatement={setDraftStatement}
            />
            <PdfInputPanel
              inputMethod={inputMethod}
              pdf={pdf}
              draftStatement={draftStatement}
            />
            <StressTestButton
              isLoading={isLoading}
              disabled={isLoading || !draftStatement.trim()}
              onClick={handleStressTest}
            />
          </div>

          {/* Results Section */}
          <div>
            <ErrorAlert error={error} />
            <ResultsCard results={results} />
            <LoadingIndicator isLoading={isLoading} />
            <EmptyResultsState
              results={results}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </div>

        <WeakLanguageTipsCard />
      </div>
    </ResponsiveModal>
  );
};

export default RedTeam;
