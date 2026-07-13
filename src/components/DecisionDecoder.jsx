import { useState, useEffect, useRef } from "react";
import ReportBugLink from "./ReportBugLink";
import BuyMeCoffee from "./BuyMeCoffee";
import ResponsiveModal from "./common/ResponsiveModal";
import { decodeDecision, isAIAvailable } from "../utils/aiStatementHelper";
import { getAIStatus, isAnyAIAvailable } from "../utils/unifiedAIService";
import { AIStatusBadge } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import SmartAILoadButton from "./SmartAILoadButton";
import { useVaBenefitsRef } from "../hooks/useVaBenefitsRef";
import {
  analyzePDF,
  analyzeImage,
  OCR_STATES,
  formatFileSize,
  isImageFile,
  isPDFFile,
} from "../utils/ocr";

function getFileRowBorderClass(fileEntry) {
  if (fileEntry.error) {
    return "border-red-200 dark:border-red-700";
  }
  if (fileEntry.extractedText) {
    return "border-green-200 dark:border-green-700";
  }
  return "border-purple-200 dark:border-purple-700";
}

function getFileRowIconBgClass(fileEntry) {
  if (fileEntry.processing) {
    return "bg-purple-100 dark:bg-purple-800";
  }
  if (fileEntry.error) {
    return "bg-red-100 dark:bg-red-800";
  }
  return "bg-green-100 dark:bg-green-800";
}

function getFileTypeIcon(fileEntry) {
  if (fileEntry.processing) {
    return (
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
    );
  }
  if (fileEntry.fileType === "pdf") {
    return <span className="text-sm">📄</span>;
  }
  return <span className="text-sm">📷</span>;
}

function UploadedFileRow({ fileEntry, onRemove }) {
  return (
    <div
      className={`border rounded-lg p-3 bg-white dark:bg-gray-800 ${getFileRowBorderClass(fileEntry)}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getFileRowIconBgClass(fileEntry)}`}
          >
            {getFileTypeIcon(fileEntry)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
              {fileEntry.file.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(fileEntry.file.size)}
              {fileEntry.extractedText && !fileEntry.error && (
                <span className="text-green-600 dark:text-green-400 ml-2">
                  ✓ {fileEntry.extractedText.length} chars
                </span>
              )}
              {fileEntry.error && (
                <span className="text-red-600 dark:text-red-400 ml-2">
                  ✗ {fileEntry.error}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => onRemove(fileEntry.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
          aria-label="Remove file"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Image Preview (collapsed) */}
      {fileEntry.fileType === "image" && fileEntry.preview && (
        <div className="mt-2 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
          <img
            src={fileEntry.preview}
            alt="Preview"
            className="max-h-24 w-full object-contain bg-gray-50 dark:bg-gray-900"
          />
        </div>
      )}
    </div>
  );
}

function getOcrProgressMessage(ocrProgress) {
  if (ocrProgress.state === OCR_STATES.LOADING) {
    return "Loading file...";
  }
  if (ocrProgress.state === OCR_STATES.EXTRACTING_TEXT) {
    return "Extracting text...";
  }
  if (ocrProgress.state === OCR_STATES.OCR_IN_PROGRESS) {
    return "Running OCR...";
  }
  return ocrProgress.message || "Processing...";
}

// Keyword-based fallback used when no AI model is loaded. Each `test`
// receives the raw denial text plus its lowercased form.
const DENIAL_PATTERNS = [
  {
    test: (text) =>
      /no nexus|does not establish a nexus|nexus between.*service|lacks.*nexus|absence of nexus/i.test(
        text,
      ),
    decision_type: "Full Denial",
    plain_english:
      "The VA denied your claim because there is no documented medical link (nexus) between your current condition and your military service.",
    va_reasoning:
      "VA policy requires a 'nexus' — a medical opinion that explicitly links your current diagnosis to a specific event, injury, or illness during service.",
    missing_elements: [
      "A Nexus Letter from a licensed physician stating your condition is 'at least as likely as not' related to service",
      "Medical records documenting in-service treatment or incident",
    ],
    action_plan: [
      "Obtain a Nexus Letter from a private physician familiar with VA claims",
      "Request an Independent Medical Opinion (IMO) from a doctor who reviews your service records",
      "File a Supplemental Claim with the nexus letter as new and relevant evidence",
      "Contact a Veterans Service Organization (VSO) for free claim assistance",
    ],
    appeal_options:
      "File a Supplemental Claim (new evidence), request a Higher-Level Review (same evidence, new rater), or appeal to the Board of Veterans' Appeals.",
    deadline_warning:
      "You have 1 year from this decision date to file an appeal. Gather your nexus evidence immediately — do not wait.",
  },
  {
    test: (text) =>
      /not service.connected|no service connection|not connected to.*service|failed to establish service/i.test(
        text,
      ),
    decision_type: "Full Denial",
    plain_english:
      "The VA decided your condition is not related to your military service.",
    va_reasoning:
      "The VA requires proof of three things: (1) a current diagnosis, (2) an in-service event or stressor, and (3) a nexus linking them. One or more of these is missing.",
    missing_elements: [
      "Evidence of an in-service event, injury, or stressor that caused the condition",
      "A medical nexus linking service to the current diagnosis",
      "Buddy letters or lay statements from fellow service members witnessing the event",
    ],
    action_plan: [
      "Pull your service records (DD214, service treatment records) for documentation",
      "Get a buddy letter from fellow veterans who witnessed the incident",
      "Obtain a medical nexus letter from a private physician",
      "Consider filing a direct service connection, secondary service connection, or aggravation claim",
    ],
    appeal_options:
      "You can file a Supplemental Claim with new evidence, a Higher-Level Review, or a Board Appeal.",
    deadline_warning:
      "You have 1 year from this decision to appeal. Contact a VSO immediately if you are unsure how to proceed.",
  },
  {
    test: (text) =>
      /insufficient evidence|lack of.*evidence|no probative evidence|evidence does not|evidence is not/i.test(
        text,
      ),
    decision_type: "Full Denial",
    plain_english:
      "The VA says there is not enough evidence in your claim file to approve your request.",
    va_reasoning:
      "VA adjudicators weigh the evidence of record. When the evidence for and against a claim is roughly equal, VA rules require denial.",
    missing_elements: [
      "Additional medical evidence supporting your claim",
      "Private medical opinions or independent medical examinations (IME)",
      "Buddy letters (lay statements) from people who observed your condition",
    ],
    action_plan: [
      "Gather all private medical records not already in your file and submit them",
      "Request a copy of your C-File to see exactly what VA has on record",
      "Submit a personal statement describing your symptoms and their impact on daily life",
      "Seek an IME from a private physician to counter the C&P exam findings",
    ],
    appeal_options:
      "A Supplemental Claim is the right path if you have new, relevant evidence. A Higher-Level Review is appropriate if you believe the rater made a clear error.",
    deadline_warning:
      "Appeal deadlines apply. File within 1 year of this decision to preserve your effective date.",
  },
  {
    test: (text, t) =>
      // eslint-disable-next-line sonarjs/slow-regex -- keyword-alternation heuristic over short pasted denial text (local textarea input, not attacker-controlled); a mechanical rewrite risks silently breaking "Granted" detection for real VA letter phrasings
      /granted|service.connected.*at.*%|assigned.*rating.*%|%.*(combined|combined rating)/i.test(
        text,
      ) && !/denied|not.*service.connected/i.test(t),
    decision_type: "Granted",
    plain_english:
      "Congratulations — the VA approved at least part of your claim!",
    va_reasoning:
      "The VA found sufficient evidence to establish service connection and assigned a disability rating.",
    missing_elements: [],
    action_plan: [
      "Review your rating decision carefully — ensure each condition is rated correctly",
      "If you believe the rating percentage is too low, file a Supplemental Claim or Higher-Level Review",
      "Consider secondary conditions that may be caused or aggravated by your service-connected condition",
      "File an Intent to File immediately if you plan to claim additional conditions",
    ],
    appeal_options:
      "If the rating percentage seems too low, compare against 38 CFR Part 4 diagnostic codes and file a Higher-Level Review citing a clear error.",
    deadline_warning: null,
  },
  {
    test: (text) =>
      /deferred pending|claim deferred|examination.*scheduled/i.test(text),
    decision_type: "Deferred",
    plain_english:
      "The VA has not yet made a final decision on your claim — it is waiting for additional information or a C&P exam.",
    va_reasoning:
      "VA defers claims when it needs additional evidence, such as a Compensation & Pension (C&P) exam or more medical records.",
    missing_elements: [
      "C&P exam results (if an exam has been scheduled)",
      "Additional medical records requested by VA",
    ],
    action_plan: [
      "Attend any scheduled C&P exam — missing it can result in denial",
      "Prepare for your C&P exam using the C&P Simulator in Vet-Rate",
      "Submit any outstanding evidence as soon as possible",
      "Contact VA or your VSO to confirm the status of your deferred claim",
    ],
    appeal_options:
      "No appeal action needed yet — wait for the final decision. Once issued, you have 1 year to appeal.",
    deadline_warning:
      "If a C&P exam is scheduled, attend it. Missing a C&P exam without good cause may result in a denial.",
  },
];

function patternMatchDenial(text) {
  const t = text.toLowerCase();

  for (const pattern of DENIAL_PATTERNS) {
    if (pattern.test(text, t)) {
      return pattern;
    }
  }

  // Generic fallback when no specific pattern matches
  const isDenied = /denied|denial|not.*granted|not.*service.connected/i.test(
    text,
  );
  if (isDenied) {
    return {
      decision_type: "Full Denial",
      plain_english:
        "The VA denied your claim. Load the Warrant Council AI for a detailed analysis of the specific reasons.",
      va_reasoning:
        "Pattern matching identified a denial but could not determine the specific reason. AI analysis will provide more detail.",
      missing_elements: [
        "Specific denial reason not detected — load AI for full analysis",
      ],
      action_plan: [
        "Load the Warrant Council AI (button above) for a full plain-English translation",
        "Contact a VSO for free claim assistance",
        "Request a copy of your C-File to understand what evidence VA used",
        "You have 1 year from this decision to file an appeal",
      ],
      appeal_options:
        "You can file a Supplemental Claim, Higher-Level Review, or Board Appeal within 1 year.",
      deadline_warning:
        "You have 1 year from this decision date to file an appeal. Do not let the deadline pass.",
    };
  }

  return null;
}

function getDecodeErrorMessage(err) {
  if (err.message && err.message.includes("TIMEOUT")) {
    return (
      "⏱️ The AI request timed out after 90 seconds. This usually means:\n\n" +
      "• The AI model is still loading (wait a few more seconds and try again)\n" +
      '• Your document is too large (try pasting only the "Reasons for Decision" section)\n' +
      "• Network connection issues (check your internet connection)\n\n" +
      "Please try again with a shorter excerpt, or wait for the AI model to fully load."
    );
  }
  if (
    err.message &&
    (err.message.includes("warming up") || err.message.includes("loading"))
  ) {
    return "🔄 AI model is still loading. Please wait for it to fully initialize (check the badge above) and try again.";
  }
  return (
    "❌ An error occurred during decoding: " +
    (err.message || "Unknown error. Please try again.")
  );
}

function applyPatternMatchFallback(denialText, setResults, setError) {
  const matched = patternMatchDenial(denialText);
  if (!matched) {
    setError(
      "No AI available and no recognizable denial patterns detected. Load the Warrant Council AI above for a full analysis.",
    );
    return;
  }
  setResults({
    ...matched,
    _usedFallback: true,
    _fallbackReason: "pattern_match",
    _fallbackNote:
      "AI is not loaded. This analysis uses keyword pattern matching — load the Warrant Council AI for a complete, personalized translation.",
  });
}

// Robust timeout that WILL reject even if the raced promise hangs.
function createDecodeTimeout(ms, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return { timeoutPromise, clear: () => clearTimeout(timeoutId) };
}

function applyDecodeResponse(response, setResults, setError) {
  if (response.success) {
    setResults({
      ...response.data,
      // Pass through fallback info to show helpful notice
      _usedFallback: response.usedFallback,
      _fallbackReason: response.fallbackReason,
      _fallbackNote: response.fallbackNote,
      // Pass through truncation info to show helpful notice
      _wasTruncated: response.wasTruncated,
      _truncationNote: response.truncationNote,
    });
    return;
  }
  // Check for context overflow error - show helpful message
  if (response.isContextOverflow) {
    setError(response.error);
    return;
  }
  setError(response.error || "Failed to decode decision. Please try again.");
}

function logDecodeError(err) {
  // Better error logging - serialize the full error properly
  const errorDetails = {
    message: err.message,
    name: err.name,
    stack: err.stack,
    ...(err.response && { response: err.response }),
  };
  console.error("[DecisionDecoder] Decode error:", errorDetails);
}

// Owns the decode request lifecycle (pattern-match fallback + AI call with
// timeout) so the component doesn't carry this async state machine inline.
function useDecisionDecode() {
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDecode = async (denialText) => {
    if (!denialText.trim()) {
      setError("Please paste your denial letter or decision text first.");
      return;
    }

    if (denialText.trim().length < 50) {
      setError(
        "The text seems too short. Please paste more of the denial letter.",
      );
      return;
    }

    if (!isAIAvailable()) {
      applyPatternMatchFallback(denialText, setResults, setError);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    const { timeoutPromise, clear } = createDecodeTimeout(
      90000,
      "TIMEOUT: AI request exceeded 90 second limit",
    );

    try {
      // eslint-disable-next-line no-console
      console.log(
        "[DecisionDecoder] Starting AI decode with",
        denialText.length,
        "characters",
      );

      // Race between the actual call and timeout
      const response = await Promise.race([
        decodeDecision(denialText),
        timeoutPromise,
      ]);

      clear();

      // eslint-disable-next-line no-console
      console.log("[DecisionDecoder] AI response:", response);

      applyDecodeResponse(response, setResults, setError);
    } catch (err) {
      clear();
      logDecodeError(err);
      setError(getDecodeErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return { results, isLoading, error, handleDecode };
}

// Joins extracted text from all successfully processed files into one blob.
// `excludeProcessing` additionally drops files still mid-OCR.
function computeCombinedText(fileList, { excludeProcessing = false } = {}) {
  return fileList
    .filter((f) => f.extractedText && (!excludeProcessing || !f.processing))
    .map(
      (f, idx) =>
        `--- Document ${idx + 1}: ${f.file.name} ---\n${f.extractedText}`,
    )
    .join("\n\n");
}

function updateCombinedText({ setUploadedFiles, setDenialText }) {
  setUploadedFiles((prev) => {
    const combinedText = computeCombinedText(prev);
    // Use setTimeout to avoid state update during render
    setTimeout(() => {
      if (combinedText) {
        setDenialText(combinedText);
      }
    }, 0);
    return prev;
  });
}

async function processFile(
  file,
  { setUploadedFiles, setOcrProgress, setCurrentProcessingFile, setFileError, setDenialText },
) {
  // Determine file type
  let fileType = null;
  if (isPDFFile(file)) {
    fileType = "pdf";
  } else if (isImageFile(file)) {
    fileType = "image";
  } else {
    setFileError(
      `Unsupported file: ${file.name}. Use PDF or image (PNG, JPG, JPEG, GIF, BMP, WEBP).`,
    );
    return;
  }

  // Create file entry with pending status
  const fileId = `${file.name}-${Date.now()}`;
  const newFileEntry = {
    id: fileId,
    file,
    fileType,
    preview: null,
    extractedText: "",
    error: null,
    processing: true,
  };

  // Add to list immediately (shows processing state)
  setUploadedFiles((prev) => [...prev, newFileEntry]);
  setCurrentProcessingFile(file.name);

  try {
    let extractedText = "";
    let preview = null;

    if (fileType === "pdf") {
      const result = await analyzePDF(file, (progress) => {
        setOcrProgress(progress);
      });
      extractedText = result.text || "";
    } else {
      // Create preview for images
      preview = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });

      const result = await analyzeImage(file, (progress) => {
        setOcrProgress(progress);
      });
      extractedText = result.success ? result.text || "" : "";
      if (!result.success) {
        newFileEntry.error = result.error || "Failed to extract text";
      }
    }

    // Update file entry with results
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? {
              ...f,
              extractedText,
              preview,
              processing: false,
              error: extractedText ? null : "No text extracted",
            }
          : f,
      ),
    );

    // Update combined denial text
    updateCombinedText({ setUploadedFiles, setDenialText });
  } catch (err) {
    console.error("File processing error:", err);
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, processing: false, error: "Failed to process file" }
          : f,
      ),
    );
  }

  setOcrProgress(null);
  setCurrentProcessingFile(null);
}

// Process multiple files sequentially
async function processMultipleFiles(files, ctx) {
  const { uploadedFiles, setFileError } = ctx;
  setFileError(null);

  for (const file of files) {
    // Check for duplicates
    const isDuplicate = uploadedFiles.some(
      (f) => f.file.name === file.name && f.file.size === file.size,
    );
    if (isDuplicate) {
      continue; // Skip duplicates
    }

    await processFile(file, ctx);
  }
}

// Owns all File Drop-In (PDF/image OCR) state, handlers, and effects so the
// component doesn't carry this subsystem inline.
function useFileDropIn(setDenialText) {
  const [uploadedFiles, setUploadedFiles] = useState([]); // Array of { file, fileType, preview, extractedText, error }
  const [ocrProgress, setOcrProgress] = useState(null);
  const [currentProcessingFile, setCurrentProcessingFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);

  const fileCtx = {
    uploadedFiles,
    setUploadedFiles,
    setOcrProgress,
    setCurrentProcessingFile,
    setFileError,
    setDenialText,
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await processMultipleFiles(Array.from(files), fileCtx);
    }
  };

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processMultipleFiles(Array.from(files), fileCtx);
    }
  };

  // Effect to update combined text when files change
  useEffect(() => {
    const combinedText = computeCombinedText(uploadedFiles, {
      excludeProcessing: true,
    });
    if (combinedText && uploadedFiles.some((f) => !f.processing)) {
      setDenialText(combinedText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFiles]);

  const handleRemoveFile = (fileId) => {
    setUploadedFiles((prev) => {
      const updated = prev.filter((f) => f.id !== fileId);
      setTimeout(() => setDenialText(computeCombinedText(updated)), 0);
      return updated;
    });
  };

  const handleClearAllFiles = () => {
    setUploadedFiles([]);
    setOcrProgress(null);
    setDenialText("");
    setFileError(null);
    setCurrentProcessingFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return {
    uploadedFiles,
    ocrProgress,
    currentProcessingFile,
    isDragging,
    fileError,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
    handleRemoveFile,
    handleClearAllFiles,
  };
}

function FileDropZone({ fileDropIn }) {
  const {
    isDragging,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
  } = fileDropIn;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- drag-and-drop target; the nested "browse" button provides the keyboard-accessible equivalent
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
        isDragging
          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
          : "border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.gif,.bmp,.webp,image/*"
        onChange={handleFileChange}
        multiple
        className="hidden"
      />
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center">
          <svg
            className="w-6 h-6 text-purple-600 dark:text-purple-300"
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
          <p className="text-base font-semibold text-gray-700 dark:text-gray-200">
            Drop files here or{" "}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-purple-600 dark:text-purple-400 hover:underline"
            >
              browse
            </button>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            📄 PDFs • 📷 Images • 📸 Screenshots -{" "}
            <strong>Multiple files supported!</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

const FileErrorNotice = ({ fileError }) => {
  if (!fileError) return null;

  return (
    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
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
        <p className="text-sm text-red-700 dark:text-red-300">{fileError}</p>
      </div>
    </div>
  );
};

const OcrProgressIndicator = ({ ocrProgress, currentProcessingFile }) => {
  if (!ocrProgress || !currentProcessingFile) return null;

  return (
    <div className="mt-3 border border-purple-200 dark:border-purple-700 rounded-xl p-4 bg-purple-50 dark:bg-purple-900/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent"></div>
        <span className="font-medium text-purple-800 dark:text-purple-200 text-sm">
          Processing: {currentProcessingFile}
        </span>
      </div>
      <p className="text-xs text-purple-600 dark:text-purple-400 mb-2">
        {getOcrProgressMessage(ocrProgress)}
      </p>
      {ocrProgress.progress > 0 && (
        <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-1.5">
          <div
            className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${ocrProgress.progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

const UploadedFilesSummary = ({
  uploadedFiles,
  denialText,
  handleRemoveFile,
  handleClearAllFiles,
}) => {
  if (uploadedFiles.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          📁 Uploaded Files ({uploadedFiles.length})
        </span>
        <button
          onClick={handleClearAllFiles}
          className="text-xs text-red-600 dark:text-red-400 hover:underline"
        >
          Clear all
        </button>
      </div>

      {uploadedFiles.map((fileEntry) => (
        <UploadedFileRow
          key={fileEntry.id}
          fileEntry={fileEntry}
          onRemove={handleRemoveFile}
        />
      ))}

      {/* Combined Text Summary */}
      {denialText && uploadedFiles.some((f) => f.extractedText) && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <span className="text-green-500">✓</span>
            <span className="text-sm font-medium">
              Combined text ready - {denialText.length} total
              characters from{" "}
              {uploadedFiles.filter((f) => f.extractedText).length}{" "}
              file(s)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

function FileDropInPanel({ fileDropIn, denialText }) {
  const {
    uploadedFiles,
    ocrProgress,
    currentProcessingFile,
    fileError,
    handleRemoveFile,
    handleClearAllFiles,
  } = fileDropIn;

  return (
    <div>
      {/* Drop Zone - always visible for adding more files */}
      <FileDropZone fileDropIn={fileDropIn} />

      {/* Global Error */}
      <FileErrorNotice fileError={fileError} />

      {/* OCR Progress (while processing) */}
      <OcrProgressIndicator
        ocrProgress={ocrProgress}
        currentProcessingFile={currentProcessingFile}
      />

      {/* Uploaded Files List */}
      <UploadedFilesSummary
        uploadedFiles={uploadedFiles}
        denialText={denialText}
        handleRemoveFile={handleRemoveFile}
        handleClearAllFiles={handleClearAllFiles}
      />

      {/* Privacy Note */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
        🔒 All files processed locally in your browser - nothing is sent to
        any server.
      </p>
    </div>
  );
}

const DecisionDecoderFooter = ({ onClose, results }) => (
  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
    <BuyMeCoffee show={results !== null} trigger="decision-decoder" />
    <button
      onClick={onClose}
      className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
    >
      Close
    </button>
  </div>
);

const DecisionDecoderHeader = ({ onClose, onReportBug, onOpenAISettings }) => (
  <div className="flex-shrink-0 bg-gradient-to-r from-rose-600 via-red-600 to-rose-600 text-white px-6 py-6 rounded-t-lg relative overflow-hidden">
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>

    <div className="relative flex items-start justify-between">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
          <span className="text-3xl">🔓</span>
        </div>
        <div>
          <h2
            id="decoder-title"
            className="text-2xl sm:text-3xl font-bold flex items-center gap-2"
          >
            Decision Decoder
            <span className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur text-white text-xs font-bold rounded-full">
              AI
            </span>
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
              BETA
            </span>
          </h2>
          <p className="text-rose-100 text-sm sm:text-base mt-1">
            The Denial Translator • VA Legalese → Plain English
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <LLMRecommendationBadge toolId="decision-decoder" />
        <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
        {onReportBug && (
          <ReportBugLink
            onClick={onReportBug}
            variant="light"
            moduleName="Decision Decoder"
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

const InputMethodTabs = ({ inputMethod, setInputMethod }) => (
  <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
    <button
      onClick={() => setInputMethod("paste")}
      className={`px-4 py-2 text-sm font-semibold transition-colors ${
        inputMethod === "paste"
          ? "text-amber-600 dark:text-amber-400 border-b-2 border-amber-600 dark:border-amber-400"
          : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      }`}
    >
      📋 Paste Text
    </button>
    <button
      onClick={() => setInputMethod("file")}
      className={`px-4 py-2 text-sm font-semibold transition-colors ${
        inputMethod === "file"
          ? "text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400"
          : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      }`}
    >
      📷 Drop-In File
    </button>
  </div>
);

const PasteTextInput = ({ denialText, setDenialText }) => (
  <>
    {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
      📄 Paste Your VA Decision Letter
    </label>
    <textarea
      value={denialText}
      onChange={(e) => setDenialText(e.target.value)}
      placeholder={`Paste the relevant paragraphs from your VA decision letter here...

Example: "The evidence does not establish a nexus between your current lumbar spine condition and your service-connected right knee disability. While the medical evidence shows a current diagnosis of lumbar degenerative disc disease, there is no competent medical evidence linking this condition to your service or to your service-connected disabilities."`}
      rows={14}
      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none font-mono text-sm"
    />
    <div className="flex items-center justify-between mt-2">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {denialText.length} characters
      </span>
      <button
        onClick={() => setDenialText("")}
        className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
      >
        Clear
      </button>
    </div>
  </>
);

const DecodeButton = ({ isLoading, denialText, handleDecode }) => (
  <button
    onClick={() => handleDecode(denialText)}
    disabled={isLoading || !denialText.trim()}
    className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold text-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
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
        <span>Decoding...</span>
      </>
    ) : (
      <>
        <span>🔓</span>
        <span>Decode This Decision</span>
      </>
    )}
  </button>
);

const DecisionDecoderInputSection = ({
  inputMethod,
  setInputMethod,
  denialText,
  setDenialText,
  fileDropIn,
  isLoading,
  handleDecode,
}) => (
  <div>
    {/* Input Method Tabs */}
    <InputMethodTabs
      inputMethod={inputMethod}
      setInputMethod={setInputMethod}
    />

    {/* Paste Text Input */}
    {inputMethod === "paste" && (
      <PasteTextInput denialText={denialText} setDenialText={setDenialText} />
    )}

    {/* File Drop-In (PDF or Image) - MULTI-FILE SUPPORT */}
    {inputMethod === "file" && (
      <FileDropInPanel fileDropIn={fileDropIn} denialText={denialText} />
    )}

    <DecodeButton
      isLoading={isLoading}
      denialText={denialText}
      handleDecode={handleDecode}
    />

    {/* Privacy Note */}
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
      🔒 Your decision letter is processed securely and never stored on our
      servers.
    </p>
  </div>
);

const ResultsErrorNotice = ({ error }) => {
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

const PatternMatchFallbackNotice = ({ results }) => {
  if (
    !results._usedFallback ||
    results._fallbackReason !== "pattern_match"
  ) {
    return null;
  }

  return (
    <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
      <div className="flex items-start gap-2">
        <span className="text-amber-500">🔍</span>
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Pattern-Match Analysis (No AI Loaded)
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            {results._fallbackNote}
          </p>
        </div>
      </div>
    </div>
  );
};

const CloudAIFallbackNotice = ({ results }) => {
  if (
    !results._usedFallback ||
    results._fallbackReason !== "context_overflow"
  ) {
    return null;
  }

  return (
    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
      <div className="flex items-start gap-2">
        <span className="text-blue-500">☁️</span>
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Processed with Cloud AI
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {results._fallbackNote ||
              "Your document was too large for Local AI (4096 tokens). Cloud AI with 1M token context was used instead."}
          </p>
        </div>
      </div>
    </div>
  );
};

const TruncationNotice = ({ results }) => {
  if (!results._wasTruncated) return null;

  return (
    <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
      <div className="flex items-start gap-2">
        <span className="text-amber-500">✂️</span>
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Large Document Trimmed
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            {results._truncationNote ||
              "Your document was condensed to fit within AI limits. The beginning and end were analyzed (where key decisions are usually found)."}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            💡 Tip: For more complete analysis, paste only the
            &quot;Reasons for Decision&quot; section.
          </p>
        </div>
      </div>
    </div>
  );
};

const DecisionTypeBadge = ({ results }) => {
  if (!results.decision_type) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm border ${getDecisionTypeColor(results.decision_type)}`}
    >
      {results.decision_type === "Full Denial" && "❌"}
      {results.decision_type === "Partial Denial" && "⚠️"}
      {results.decision_type === "Reduction" && "📉"}
      {results.decision_type === "Deferred" && "⏳"}
      {results.decision_type === "Granted" && "✅"}
      {results.decision_type}
    </div>
  );
};

const PlainEnglishSection = ({ results }) => {
  if (!results.plain_english) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
      <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2 mb-2">
        <span>💬</span> In Plain English
      </h4>
      <p className="text-blue-700 dark:text-blue-300">
        {results.plain_english}
      </p>
    </div>
  );
};

const VaReasoningSection = ({ results }) => {
  if (!results.va_reasoning) return null;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-2">
        <span>🏛️</span> Why the VA Made This Decision
      </h4>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {results.va_reasoning}
      </p>
    </div>
  );
};

const FavorableFindingsSection = ({ results }) => {
  if (!results.favorable_findings || results.favorable_findings.length === 0) {
    return null;
  }

  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-700">
      <h4 className="font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 mb-3">
        <span>🏆</span> Favorable Findings (Already Established)
      </h4>
      <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 italic">
        The VA has already accepted these facts - you do NOT need to prove
        them again!
      </p>
      <ul className="space-y-2">
        {results.favorable_findings.map((finding, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">✓</span>
            <span className="text-sm text-emerald-700 dark:text-emerald-300">
              {finding}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const MissingElementsSection = ({ results }) => {
  if (!results.missing_elements || results.missing_elements.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-700">
      <h4 className="font-semibold text-red-800 dark:text-red-200 flex items-center gap-2 mb-3">
        <span>🚨</span> What&apos;s Missing From Your Claim
      </h4>
      <ul className="space-y-2">
        {results.missing_elements.map((element, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-red-500 mt-0.5">•</span>
            <span className="text-sm text-red-700 dark:text-red-300">
              {element}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ActionPlanSection = ({ results }) => {
  if (!results.action_plan || results.action_plan.length === 0) return null;

  return (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
      <h4 className="font-semibold text-green-800 dark:text-green-200 flex items-center gap-2 mb-3">
        <span>✅</span> Your Action Plan
      </h4>
      <ol className="space-y-3">
        {results.action_plan.map((step, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {index + 1}
            </span>
            <span className="text-sm text-green-700 dark:text-green-300">
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};

const AppealOptionsSection = ({ results }) => {
  if (!results.appeal_options) return null;

  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
      <h4 className="font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2 mb-3">
        <span>⚖️</span> Appeal Options
      </h4>
      <div className="space-y-2 text-sm text-purple-700 dark:text-purple-300">
        {typeof results.appeal_options === "string" ? (
          <p>{results.appeal_options}</p>
        ) : (
          results.appeal_options.map((option, index) => (
            <div
              key={index}
              className="p-2 bg-white dark:bg-gray-800 rounded-lg"
            >
              {option}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const DeadlineWarningSection = ({ results }) => {
  if (!results.deadline_warning) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-xl p-4 border-2 border-yellow-400 dark:border-yellow-600">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⏰</span>
        <div>
          <h4 className="font-bold text-yellow-800 dark:text-yellow-200">
            Important Deadline
          </h4>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            {results.deadline_warning}
          </p>
        </div>
      </div>
    </div>
  );
};

const ResultsContent = ({ results }) => {
  if (!results) return null;

  return (
    <div className="space-y-4">
      {/* Pattern-Match Fallback Notice (when AI is not loaded) */}
      <PatternMatchFallbackNotice results={results} />

      {/* Cloud AI Fallback Notice (when document was too large for Local AI) */}
      <CloudAIFallbackNotice results={results} />

      {/* Document Truncation Notice (when document was trimmed to fit Local AI) */}
      <TruncationNotice results={results} />

      {/* Decision Type Badge */}
      <DecisionTypeBadge results={results} />

      {/* Plain English Translation */}
      <PlainEnglishSection results={results} />

      {/* VA's Reasoning */}
      <VaReasoningSection results={results} />

      {/* Favorable Findings - What the VA Already Conceded */}
      <FavorableFindingsSection results={results} />

      {/* Missing Elements */}
      <MissingElementsSection results={results} />

      {/* Action Plan */}
      <ActionPlanSection results={results} />

      {/* Appeal Options */}
      <AppealOptionsSection results={results} />

      {/* Deadline Warning */}
      <DeadlineWarningSection results={results} />
    </div>
  );
};

const DecodingLoadingState = () => (
  <div className="h-full flex items-center justify-center py-12 text-center">
    <div className="max-w-sm">
      <div className="relative mb-6">
        <div className="text-6xl animate-pulse">🔓</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 border-4 border-amber-200 dark:border-amber-800 border-t-amber-500 rounded-full animate-spin"></div>
        </div>
      </div>
      <p className="text-lg font-medium text-amber-700 dark:text-amber-300">
        AI is analyzing your decision...
      </p>
      <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
        Translating VA legalese into plain English
      </p>
      <div className="mt-4 space-y-2 text-xs text-gray-500 dark:text-gray-500">
        <p className="flex items-center justify-center gap-2">
          <span className="animate-pulse">📝</span> Identifying decision
          type...
        </p>
        <p className="flex items-center justify-center gap-2">
          <span className="animate-pulse">🔍</span> Finding missing
          elements...
        </p>
        <p className="flex items-center justify-center gap-2">
          <span className="animate-pulse">📋</span> Building your action
          plan...
        </p>
      </div>
      <p className="text-xs text-amber-600 dark:text-amber-400 mt-4">
        This usually takes 10-30 seconds
      </p>
    </div>
  </div>
);

const DecoderEmptyState = () => (
  <div className="h-full flex items-center justify-center py-12 text-center text-gray-500 dark:text-gray-400">
    <div>
      <div className="text-6xl mb-4">🔓</div>
      <p className="text-lg font-medium">Ready to Decode</p>
      <p className="text-sm mt-2">
        Paste your VA decision letter and click &quot;Decode&quot; to
        translate
      </p>
    </div>
  </div>
);

const DecisionDecoderResultsSection = ({ error, results, isLoading }) => (
  <div>
    <ResultsErrorNotice error={error} />

    <ResultsContent results={results} />

    {/* Loading State - Shows progress while AI is working */}
    {isLoading && <DecodingLoadingState />}

    {/* Empty State */}
    {!results && !isLoading && !error && <DecoderEmptyState />}
  </div>
);

const DecisionDecoderInfoBanner = () => (
  <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl">
    <div className="flex items-start gap-3">
      <span className="text-2xl">📬</span>
      <div>
        <h3 className="font-bold text-amber-800 dark:text-amber-200">
          Got a Confusing VA Letter?
        </h3>
        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
          VA decisions are written in complex legal language. Paste the key
          paragraphs below and we&apos;ll translate what they&apos;re{" "}
          <em>actually</em> saying, what&apos;s missing from your claim, and
          exactly what you need to do next.
        </p>
      </div>
    </div>
  </div>
);

function getDecisionTypeColor(type) {
  switch (type?.toLowerCase()) {
    case "full denial":
      return "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700";
    case "partial denial":
      return "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700";
    case "reduction":
      return "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700";
    case "deferred":
      return "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700";
    case "granted":
      return "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700";
    default:
      return "bg-gray-100 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  }
}

/**
 * DecisionDecoder Component - "The Denial Translator"
 *
 * WHY: VA denial letters are written in legalese. A veteran reads:
 * "The evidence does not establish a nexus between your current condition
 * and your service-connected disability."
 * And thinks: "WTF does that mean?"
 *
 * THIS TOOL: Translates it into:
 * - PLAIN ENGLISH: "They're saying your doctor didn't explicitly say 'X caused Y.'"
 * - MISSING ELEMENT: "A Nexus Letter from a doctor."
 * - ACTION PLAN: "Get a Nexus Letter from a private physician, or request an Independent Medical Opinion."
 */

const CommonDenialReasonsReference = () => (
  <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-xl">
    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
      <span>📚</span> Common VA Denial Language
    </h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
        <p className="text-red-600 dark:text-red-400 font-medium mb-1">
          &quot;No nexus established&quot;
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          = They need a doctor&apos;s letter connecting your condition to
          service
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
        <p className="text-red-600 dark:text-red-400 font-medium mb-1">
          &quot;Not incurred in service&quot;
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          = They didn&apos;t find evidence in your service records
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
        <p className="text-red-600 dark:text-red-400 font-medium mb-1">
          &quot;No current disability&quot;
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          = Need a current diagnosis from a doctor
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
        <p className="text-red-600 dark:text-red-400 font-medium mb-1">
          &quot;Not at least as likely as not&quot;
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          = The examiner said less than 50% chance of connection
        </p>
      </div>
    </div>
  </div>
);

const PhaseTimeline = ({ phases, selectedPhase, setSelectedPhase }) => (
  <div className="relative mb-6">
    <div className="absolute top-4 left-0 right-0 h-1 bg-teal-200 dark:bg-teal-800 rounded"></div>
    <div className="flex justify-between relative">
      {phases.map((phase) => (
        <button
          key={phase.key}
          onClick={() =>
            setSelectedPhase(selectedPhase?.key === phase.key ? null : phase)
          }
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all ${
            selectedPhase?.key === phase.key
              ? "bg-teal-600 text-white ring-4 ring-teal-300 dark:ring-teal-700 scale-110"
              : "bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 border-2 border-teal-300 dark:border-teal-600 hover:bg-teal-100 dark:hover:bg-teal-900"
          }`}
          aria-label={phase.name}
        >
          {phase.phase}
        </button>
      ))}
    </div>
  </div>
);

const SelectedPhaseDetails = ({ selectedPhase }) => {
  if (!selectedPhase) {
    return (
      <p className="text-center text-teal-600 dark:text-teal-400 text-sm py-4">
        👆 Click a phase number above to see detailed information
      </p>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-teal-200 dark:border-teal-700 animate-fadeIn">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h5 className="font-bold text-teal-800 dark:text-teal-200 text-lg">
            Phase {selectedPhase.phase}: {selectedPhase.name}
          </h5>
          <p className="text-teal-600 dark:text-teal-400 text-sm">
            {selectedPhase.shortDesc}
          </p>
        </div>
        <span className="bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-xs px-2 py-1 rounded-full">
          ⏱️ {selectedPhase.avgDays}
        </span>
      </div>

      <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
        {selectedPhase.longDesc}
      </p>

      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mb-3">
        <h6 className="font-semibold text-blue-800 dark:text-blue-200 text-sm mb-1">
          🎯 What You Should Do
        </h6>
        <p className="text-blue-700 dark:text-blue-300 text-sm">
          {selectedPhase.whatNext}
        </p>
      </div>

      {selectedPhase.tips && selectedPhase.tips.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3">
          <h6 className="font-semibold text-amber-800 dark:text-amber-200 text-sm mb-2">
            💡 Pro Tips
          </h6>
          <ul className="space-y-1">
            {selectedPhase.tips.map((tip, i) => (
              <li
                key={i}
                className="text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2"
              >
                <span>•</span> {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const ClaimPhaseExplainer = ({
  showPhaseExplainer,
  setShowPhaseExplainer,
  selectedPhase,
  setSelectedPhase,
  getAllClaimPhases,
}) => (
  <div className="mt-6 p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/30 rounded-xl border border-teal-200 dark:border-teal-700">
    <button
      onClick={() => setShowPhaseExplainer(!showPhaseExplainer)}
      className="w-full flex items-center justify-between"
    >
      <h4 className="font-semibold text-teal-800 dark:text-teal-200 flex items-center gap-2">
        <span>📊</span> Claim Status Phase Explainer
        <span className="text-xs bg-teal-200 dark:bg-teal-800 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full">
          VA Reference Data
        </span>
      </h4>
      <svg
        className={`w-5 h-5 text-teal-600 dark:text-teal-400 transition-transform ${showPhaseExplainer ? "rotate-180" : ""}`}
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

    {showPhaseExplainer && (
      <div className="mt-4">
        <p className="text-sm text-teal-700 dark:text-teal-300 mb-4">
          Wondering what your claim status means? Click a phase to learn what
          the VA is doing and what you should expect.
        </p>

        {/* Phase Timeline */}
        <PhaseTimeline
          phases={getAllClaimPhases()}
          selectedPhase={selectedPhase}
          setSelectedPhase={setSelectedPhase}
        />

        {/* Selected Phase Details */}
        <SelectedPhaseDetails selectedPhase={selectedPhase} />
      </div>
    )}
  </div>
);

const DecisionDecoder = ({ onClose, onReportBug, onOpenAISettings }) => {
  // NOTE: AI is NOT auto-loaded - user selects AI model via SmartAILoadButton dropdown

  const [denialText, setDenialText] = useState("");
  const { results, isLoading, error, handleDecode } = useDecisionDecode();
  const [_aiStatus, setAIStatus] = useState(getAIStatus());
  const [showPhaseExplainer, setShowPhaseExplainer] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [inputMethod, setInputMethod] = useState("paste"); // 'paste' or 'file'

  const fileDropIn = useFileDropIn(setDenialText);

  // Benefits Reference hook for claim phase explanations
  const { getAllClaimPhases } = useVaBenefitsRef();

  // Monitor AI status changes
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const footer = <DecisionDecoderFooter onClose={onClose} results={results} />;

  const header = (
    <DecisionDecoderHeader
      onClose={onClose}
      onReportBug={onReportBug}
      onOpenAISettings={onOpenAISettings}
    />
  );

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="2xl"
      labelledBy="decoder-title"
      header={header}
      footer={footer}
    >
      {/* Content */}
      {/* Info Banner */}
      <DecisionDecoderInfoBanner />

      {/* Smart AI Load Button */}
      {!isAnyAIAvailable() && (
        <div className="mb-6">
          <SmartAILoadButton
            toolId="decision-decoder"
            onLoadComplete={(model) =>
              // eslint-disable-next-line no-console
              console.log("Smart AI loaded for Decision Decoder:", model?.name)
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <DecisionDecoderInputSection
          inputMethod={inputMethod}
          setInputMethod={setInputMethod}
          denialText={denialText}
          setDenialText={setDenialText}
          fileDropIn={fileDropIn}
          isLoading={isLoading}
          handleDecode={handleDecode}
        />

        {/* Results Section */}
        <DecisionDecoderResultsSection
          error={error}
          results={results}
          isLoading={isLoading}
        />
      </div>

      {/* Common Denial Reasons Reference */}
      <CommonDenialReasonsReference />

      {/* Claim Phase Explainer - Powered by Benefits Reference Data */}
      <ClaimPhaseExplainer
        showPhaseExplainer={showPhaseExplainer}
        setShowPhaseExplainer={setShowPhaseExplainer}
        selectedPhase={selectedPhase}
        setSelectedPhase={setSelectedPhase}
        getAllClaimPhases={getAllClaimPhases}
      />
    </ResponsiveModal>
  );
};

export default DecisionDecoder;
