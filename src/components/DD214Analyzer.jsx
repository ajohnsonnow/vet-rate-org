/**
 * Vet-Rate.org - DD214 Information Analyzer
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * Intelligent DD214 analyzer with:
 * - Local OCR support for scanned PDFs
 * - Multi-DD214 cumulative logic (prevents double-counting awards)
 * - AI-powered extraction with diagnostic status
 * - Vision model support (direct image analysis, bypassing OCR)
 */

import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";
import {
  generateAI,
  generateAIWithImage,
  getAIStatus,
  isAnyAIAvailable,
  isLocalAIReady,
  isLocalAIVisionModel,
} from "../utils/unifiedAIService";
import { AIStatusBadge } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import SmartAILoadButton from "./SmartAILoadButton";
import ReportBugLink from "./ReportBugLink";
import {
  analyzeDocument,
  OCR_STATES,
  getProgressStyling,
  formatFileSize,
  isFileSupported,
  getFileTypeLabel,
  getAcceptString,
  renderPDFToImages,
} from "../utils/documentAnalyzer";
import {
  saveDD214Data,
  getServiceHistory,
  addAward,
  getVeteranProfile,
  updateVeteranProfile,
} from "../utils/veteranProfile";
import { parseDD214Text } from "../utils/ribbonRackData";
import {
  extractDD214Fields,
  mergeAIAndRegexResults,
} from "../utils/dd214FieldExtractor";
import {
  saveDocumentToPacket,
  PACKET_DOC_TYPES,
} from "../utils/myPacketManager";
import {
  loadVKB,
  saveVKB,
  mergeDD214IntoVKB,
  addDocumentToVKB,
} from "../utils/veteranKnowledgeBase";
import ProfileImportConfirmModal from "./ProfileImportConfirmModal";
import DD214FormBuilder from "./DD214FormBuilder";

/**
 * System Prompt for Multi-Document Cumulative Analysis
 * Supports: DD214 (Active), NGB 22 (Guard), DD256/DD257 (Reserve)
 * Implements the "Master Record" protocol to prevent double-counting
 */
/**
 * Condensed System Prompt for Local Models (4K context)
 * Focus on essential JSON extraction - comprehensive DD214 coverage
 */
const DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL = `You are a DD214 military records analyst. Extract ALL available data as JSON.

COMPLETE DD214 FIELD LOCATIONS:
Block 1: Name (Last, First, Middle)
Block 2: Department/Component/Branch
Block 3: SSN/Service Number
Block 4a: Pay Grade (E-1 through E-9, W-1 through W-5, O-1 through O-10)
Block 4b: MOS/AFSC/Rating/Primary Specialty Code
Block 4c: Grade/Rank (PV1, PFC, SGT, SSG, CPT, MAJ, etc)
Block 5: Date of Birth
Block 6: Place of Birth (City, State, Country)
Block 7: Home of Record (City, County, State)
Block 8: Last Duty Assignment and Major Command
Block 9: Command to Which Transferred
Block 10: SGL Coverage Amount
Block 11: Primary Specialty (expanded MOS title)
Block 12a: Date Entered Active Duty THIS PERIOD (YYYYMMDD)
Block 12b: Separation Date THIS PERIOD (YYYYMMDD)
Block 12c: Net Active Service THIS PERIOD (YYYYMMDD format)
Block 12d: Total Prior Active Service (YYYYMMDD)
Block 12e: Total Prior Inactive Service (YYYYMMDD)
Block 13: Decorations, Medals, Badges, Citations, Campaign Ribbons
Block 14: Military Education (formal service schools)
Block 15: Member Requests and Options Selected
Block 17: Effective Date of Pay Grade (YYYYMMDD)
Block 18: Remarks (CRITICAL: overflow for awards, qualifications, deployment info)
Block 19: Separation Authority (regulatory authority)
Block 20: Separation Code (SPD/SPN)
Block 21: Reentry Code (RE-1, RE-3, RE-4, etc)
Block 22: Separation Program Designator (SPD)
Block 23: Type of Separation
Block 24: Character of Service (Honorable, General, etc)
Block 25: Narrative Reason for Separation
Block 26: Post-9/11 GI Bill Status
Block 27: Reserve Obligation Termination Date (YYYYMMDD)
Block 28: Days Lost (AWOL, confinement, etc)
Block 29: Foreign Service Credit
Block 30: Home Address at Time of Separation

CRITICAL EXTRACTION RULES:
1. Block 18 (Remarks) often contains:
   - Award continuation from Block 13
   - Combat deployment details
   - Special qualifications (Airborne, Ranger, Special Forces, etc)
   - Overseas service dates
   - Purple Heart/combat injury details
   - Security clearance info
   - Mobilization/deployment orders

2. Convert ALL dates to YYYY-MM-DD format
3. Service time: YYYYMMDD means Years/Months/Days (e.g., "00000429" = 0y 4m 29d)
4. If field not found or not applicable, use null

OUTPUT JSON:
{
  "documentCount": number,
  "documentTypes": ["DD214","NGB22","DD256"],
  "masterRecordDate": "YYYY-MM-DD",
  "masterRecordType": "DD214",
  "fullName": "Last, First Middle",
  "lastName": "string",
  "firstName": "string", 
  "middleName": "string",
  "ssnLast4": "string (last 4 only)",
  "serviceNumber": "string (if applicable)",
  "dateOfBirth": "YYYY-MM-DD",
  "placeOfBirth": "City, State, Country",
  "homeOfRecord": "City, County, State",
  "component": "RA|ARNG|USAR|USN|USAF|USMC|USCG",
  "componentFull": "Regular Army|Army National Guard|Navy Reserve|etc",
  "branch": "Army|Navy|Air Force|Marines|Coast Guard|Space Force",
  "rank": "PV1|SGT|CPT|etc (Block 4c)",
  "payGrade": "E-1|E-4|O-3|etc (Block 4a)",
  "dateOfRank": "YYYY-MM-DD (Block 17)",
  "mos": "MOS code",
  "mosTitle": "Job title",
  "lastDutyAssignment": "Unit and major command",
  "commandTransferredTo": "Next assignment/separation",
  "sglCoverage": "SGLI amount",
  "entryDate": "YYYY-MM-DD (Block 12a)",
  "separationDate": "YYYY-MM-DD (Block 12b)",
  "netActiveService": {"years":0,"months":0,"days":0},
  "totalPriorActiveService": {"years":0,"months":0,"days":0},
  "totalPriorInactiveService": {"years":0,"months":0,"days":0},
  "yearsService": number,
  "monthsService": number,
  "daysService": number,
  "reserveObligationDate": "YYYY-MM-DD (Block 27)",
  "daysLost": number,
  "foreignService": boolean,
  "seaService": {"years":0,"months":0,"days":0},
  "militaryEducation": ["course names"],
  "separationAuthority": "regulation reference",
  "separationCode": "SPD/SPN code",
  "reentryCode": "RE-1|RE-2|RE-3|RE-4",
  "separationType": "Honorable Discharge|ETS|Retirement|Medical|etc",
  "characterOfService": "Honorable|General|OTH|etc",
  "narrativeReason": "narrative reason text",
  "giBlStatus": "eligible|transferred|etc",
  "memberRequests": "requests made by member",
  "homeAddress": "address at separation",
  "awards": [{"name":"name","abbreviation":"abbr","devices":[],"deviceCount":0,"isCombat":boolean}],
  "combatService": {"hasVerifiedCombat":boolean,"indicators":[],"deployments":[]},
  "specialQualifications": ["Airborne","Ranger","SF","etc"],
  "securityClearance": "level if mentioned",
  "extractionNotes": ["important details"]
}

CRITICAL: Return ONLY valid JSON. No comments, markdown, or explanations.`;

/**
 * Full System Prompt for Cloud AI (larger context)
 * Comprehensive multi-document handling with detailed instructions
 */
const DD214_ANALYSIS_SYSTEM_PROMPT = `You are a military records analyst specializing in discharge document interpretation.

SUPPORTED DISCHARGE DOCUMENTS:
- DD Form 214: Active Duty Separation (Certificate of Release or Discharge from Active Duty)
- NGB Form 22: National Guard Discharge (Report of Separation and Record of Service)
- DD Form 256: Reserve Discharge (Honorable Discharge - Reserve Components)
- DD Form 257: Reserve Discharge (General Discharge - Reserve Components)
- DD Form 2586: AGR Verification (Active Guard/Reserve)

ANALYSIS PROTOCOL FOR MULTIPLE DISCHARGE DOCUMENTS:
When you receive text from multiple discharge documents (DD214s, NGB 22s, DD256/257, etc.), follow this STRICT protocol:

1. IDENTIFY DOCUMENTS: Look for form identifiers and separation dates.
   - DD214: Look for "DD FORM 214" or "CERTIFICATE OF RELEASE"
   - NGB 22: Look for "NGB FORM 22" or "REPORT OF SEPARATION" + "NATIONAL GUARD"
   - DD256/257: Look for "DD FORM 256" or "DD FORM 257" + "RESERVE"
   - Extract the date in a standardized format
   - Note which pages belong to which document
   - Note component: Active Duty, National Guard, Reserve, AGR

2. DESIGNATE MASTER RECORD: The document with the LATEST separation date is the "Master Record"
   - The final discharge typically consolidates all prior service
   - HOWEVER: National Guard members may have BOTH DD214 (Active/Title 10) AND NGB 22 (State/Title 32)
   - BOTH are valid and paint a complete picture of Guard service

3. EXTRACTION ORDER:
   a) Extract ALL awards/decorations from the Master Record (Block 13 or equivalent) FIRST
   b) Check if Block 13 ends with "SEE REMARKS", "CONT", "CONTINUED", or similar
   c) If continuation exists, IMMEDIATELY append text from Block 18 (Remarks) or equivalent
   d) Only THEN review older documents
   e) Check for service periods NOT covered by Master Record

4. DEDUPLICATION RULE: When reviewing older documents:
   - ONLY add an award if it is DISTINCTLY DIFFERENT from those already captured
   - "Purple Heart" on DD214 #1 and "Purple Heart" on NGB 22 = COUNT ONCE
   - "Purple Heart" and "Purple Heart w/1 OLC" = COUNT THE ONE WITH DEVICES (more specific)
   - Different campaigns (Afghanistan vs Iraq) = COUNT BOTH

5. NATIONAL GUARD SPECIFICS:
   - NGB 22 shows Title 32 (state) service and State Active Duty
   - DD214 from Guard shows Title 10 (federal/active) deployments/mobilizations
   - BOTH documents together paint complete service picture
   - Total service time = AGR + SAD + Federal Active Duty time
   - Awards may appear on BOTH forms - use deduplication rules

6. RESERVE SPECIFICS:
   - DD256/257 shows drilling reserve time and training
   - Separate DD214 for any active duty tours/mobilizations
   - "Good Year" = year with 50+ retirement points
   - Reserve retirement points DO NOT equal active duty time
   - Be careful not to confuse points with days

7. OVERFLOW HANDLING (CRITICAL):
   - Block 13 has limited space. Long award lists ALWAYS overflow to Block 18/Remarks
   - Search Block 18 for: "CONTINUATION OF BLOCK 13", "AWARDS CONTINUED", "DECORATIONS:", etc.
   - This is where combat badges, campaign stars, and V devices are often listed

OUTPUT FORMAT:
Return a JSON object with this EXACT structure (ALL DD214 BLOCKS):
{
  "documentCount": number,
  "documentTypes": ["DD214", "NGB22", "DD256"],
  "masterRecordDate": "YYYY-MM-DD",
  "masterRecordType": "DD214|NGB22|DD256|DD257",
  
  // PERSONAL IDENTIFICATION (Blocks 1-7)
  "fullName": "Last, First Middle",
  "lastName": "string",
  "firstName": "string",
  "middleName": "string",
  "ssnLast4": "last 4 digits only",
  "serviceNumber": "service number if applicable",
  "dateOfBirth": "YYYY-MM-DD (Block 5)",
  "placeOfBirth": "City, State, Country (Block 6)",
  "homeOfRecord": "City, County, State (Block 7)",
  
  // COMPONENT & RANK (Blocks 2, 4a-4c, 17)
  "component": "RA|ARNG|USAR|USN|USAF|USMC|USCG",
  "componentFull": "Regular Army|Army National Guard|Navy Reserve|etc",
  "branch": "Army|Navy|Air Force|Marines|Coast Guard|Space Force",
  "rank": "PV1|PFC|SGT|CPT|etc (Block 4c)",
  "payGrade": "E-1 through E-9|W-1 through W-5|O-1 through O-10 (Block 4a)",
  "dateOfRank": "YYYY-MM-DD (Block 17)",
  
  // MOS & ASSIGNMENTS (Blocks 4b, 8, 9, 11)
  "mos": "Primary MOS/AFSC/Rating code (Block 4b)",
  "mosTitle": "Job title (Block 11)",
  "lastDutyAssignment": "Unit and major command (Block 8)",
  "commandTransferredTo": "Next assignment or separation location (Block 9)",
  
  // DATES & SERVICE TIME (Blocks 12a-12e)
  "entryDate": "YYYY-MM-DD (Block 12a - Date Entered Active Duty THIS PERIOD)",
  "separationDate": "YYYY-MM-DD (Block 12b)",
  "netActiveService": {"years":number,"months":number,"days":number},
  "totalPriorActiveService": {"years":number,"months":number,"days":number},
  "totalPriorInactiveService": {"years":number,"months":number,"days":number},
  "yearsService": number,
  "monthsService": number,
  "daysService": number,
  
  // BENEFITS & OBLIGATIONS (Blocks 10, 26, 27, 28, 29)
  "sglCoverage": "SGLI coverage amount (Block 10)",
  "giBlStatus": "Post-9/11 GI Bill status (Block 26)",
  "reserveObligationDate": "YYYY-MM-DD (Block 27)",
  "daysLost": "number of days lost to AWOL/confinement (Block 28)",
  "foreignService": boolean,
  "foreignServiceDetails": "details from Block 29 or remarks",
  "seaService": {"years":number,"months":number,"days":number},
  
  // SEPARATION INFO (Blocks 19-25)
  "separationAuthority": "Regulatory authority (Block 19)",
  "separationCode": "SPD/SPN code (Block 20)",
  "reentryCode": "RE-1|RE-2|RE-3|RE-4 (Block 21)",
  "separationProgramDesignator": "SPD code (Block 22)",
  "separationType": "Type of separation (Block 23)",
  "characterOfService": "Honorable|General|OTH|etc (Block 24)",
  "narrativeReason": "Narrative reason for separation (Block 25)",
  
  // EDUCATION & TRAINING (Blocks 14, 15, 18)
  "militaryEducation": ["Course names from Block 14 or Block 18 overflow"],
  "memberRequests": "Member requests and options selected (Block 15)",
  
  // CONTACT (Block 30)
  "homeAddress": "Home address at time of separation (Block 30)",
  
  // AWARDS & DECORATIONS (Blocks 13, 18)
  "awards": [
    {
      "name": "Full award name",
      "abbreviation": "Common abbreviation",
      "devices": ["Oak Leaf Cluster", "V Device", "Bronze Service Star"],
      "deviceCount": number,
      "isCombat": true/false,
      "sourceDocument": "Master Record|DD214 #1|NGB 22|etc"
    }
  ],
  
  // COMBAT SERVICE & QUALIFICATIONS (from Block 13, 18)
  "combatService": {
    "hasVerifiedCombat": true/false,
    "indicators": ["Combat Action Badge", "Purple Heart", "Iraq Campaign Medal"],
    "deployments": ["Iraq 2003-2004", "Afghanistan 2010-2011"]
  },
  "specialQualifications": ["Airborne", "Ranger", "Special Forces", "Air Assault"],
  "securityClearance": "Secret|Top Secret|TS/SCI if mentioned in remarks",
  
  // LEGACY FIELDS (for backwards compatibility)
  "reenlisted": true/false,
  
  // METADATA
  "extractionNotes": ["Any issues, ambiguities, or important details"]
}

RETURN ONLY THE JSON. No explanations, no markdown.`;

/**
 * OCR Progress Bar Component
 */
const OCRProgressBar = ({ progress }) => {
  const styling = getProgressStyling(progress);

  return (
    <div
      className={`p-4 rounded-xl ${styling.bgColor} border border-current/20`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${styling.textColor}`}>
          {styling.icon} {progress.message}
        </span>
        <span className={`text-sm font-bold ${styling.textColor}`}>
          {progress.progress}%
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full ${styling.barColor} transition-all duration-300 ease-out`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>
      {progress.currentPage && progress.totalPages && (
        <p className={`text-xs ${styling.textColor} mt-1`}>
          Page {progress.currentPage} of {progress.totalPages}
        </p>
      )}
    </div>
  );
};

/**
 * Main DD214 Analyzer Component
 */
const DD214Analyzer = ({
  onClose,
  onReportBug,
  onOpenAISettings,
  onSaveResults,
  onOpenMusterCall,
}) => {
  const { t } = useLanguage();
  useBodyScrollLock(true);

  // State
  const [aiStatus, setAIStatus] = useState({ anyAvailable: false });
  const [inputMethod, setInputMethod] = useState("paste"); // 'paste' | 'upload' | 'manual'
  const [pastedText, setPastedText] = useState("");
  const [droppedFiles, setDroppedFiles] = useState([]);
  const [extractedTexts, setExtractedTexts] = useState([]);
  const [originalPDFFiles, setOriginalPDFFiles] = useState([]); // Keep original PDF files for vision model
  const [ocrProgress, setOcrProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Profile import confirmation modal
  const [showProfileImportModal, setShowProfileImportModal] = useState(false);
  const [extractedProfileData, setExtractedProfileData] = useState(null);

  // Manual form builder
  const [showFormBuilder, setShowFormBuilder] = useState(false);

  const fileInputRef = useRef(null);

  // Check AI status on mount and periodically
  useEffect(() => {
    /** @type {() => void} */
    const checkStatus = () => setAIStatus(getAIStatus());
    checkStatus();
    const intervalId = setInterval(() => checkStatus(), 1000);
    return () => clearInterval(intervalId);
  }, []);

  /**
   * Drag and Drop Handlers
   */
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

    console.log("📁 Files dropped:", e.dataTransfer.files);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      isFileSupported(f),
    );
    console.log(
      "📁 Supported files:",
      files.map((f) => f.name),
    );
    if (files.length === 0) {
      setError(t("dd214Analyzer", "unsupportedFormat"));
      return;
    }

    await processFiles(files);
  };

  /**
   * Process dropped in or selected files - NOW AUTO-RUNS OCR
   * FIX for BUG-MKUBD41U: Users were confused by the two-step process
   * Now automatically starts OCR when files are uploaded
   */
  const processFiles = async (files) => {
    console.log(
      "📁 processFiles called with:",
      files.map((f) => f.name),
    );
    if (files.length === 0) return;

    setError(null);

    // Store files in state
    const newDroppedFiles = [...droppedFiles, ...files];
    setDroppedFiles(newDroppedFiles);
    console.log(
      "📁 droppedFiles now:",
      newDroppedFiles.map((f) => f.name),
    );

    // Keep original PDF files for vision model analysis
    const pdfFiles = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length > 0) {
      setOriginalPDFFiles((prev) => [...prev, ...pdfFiles]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // AUTO-RUN OCR immediately after files are added
    // This eliminates the confusing two-step "upload then click Run OCR" process
    console.log("🔄 Auto-starting OCR for uploaded files...");

    // Small delay to ensure state is updated and UI shows the files
    setTimeout(async () => {
      await runOCROnFilesInternal(files);
    }, 100);
  };

  /**
   * Internal OCR runner that accepts files directly
   * Used by both auto-OCR on upload and manual "Run OCR" button
   */
  const runOCROnFilesInternal = async (filesToProcess) => {
    if (!filesToProcess || filesToProcess.length === 0) {
      console.log("📁 No files to process");
      return;
    }

    // Filter to only process files that haven't been processed yet
    const unprocessedFiles = filesToProcess.filter(
      (file) => !extractedTexts.some((et) => et.filename === file.name),
    );

    if (unprocessedFiles.length === 0) {
      console.log("📁 All files already processed");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      for (const file of unprocessedFiles) {
        if (!isFileSupported(file)) {
          console.warn(`⚠️ ${file.name} is not a supported format`);
          continue;
        }

        setOcrProgress({
          state: OCR_STATES.LOADING,
          progress: 0,
          message: `Processing ${file.name}...`,
        });

        try {
          console.log(`🔍 Starting OCR analysis of ${file.name}...`);
          const result = await analyzeDocument(file, setOcrProgress);
          console.log(
            `✅ OCR complete for ${file.name}: ${result.text?.length || 0} chars extracted`,
          );

          setExtractedTexts((prev) => [
            ...prev,
            {
              filename: file.name,
              text: result.text,
              pageCount: result.pageCount,
              method: result.method,
              fileType: result.fileType,
              ocrUsed: result.ocrUsed,
            },
          ]);
        } catch (err) {
          console.error("File processing error:", err);
          setError(`Failed to process ${file.name}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error("OCR batch processing error:", err);
      setError(`Processing failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setOcrProgress(null);
    }
  };

  /**
   * Run OCR on all loaded files that haven't been processed yet
   * Called by the manual "Run OCR" button
   */
  const runOCROnFiles = async () => {
    // Use droppedFiles if available, fall back to originalPDFFiles
    const filesToProcess =
      droppedFiles.length > 0 ? droppedFiles : originalPDFFiles;

    if (filesToProcess.length === 0) {
      setError(t("dd214Analyzer", "pasteOrDropFirst"));
      return;
    }

    const unprocessedFiles = filesToProcess.filter(
      (file) => !extractedTexts.some((et) => et.filename === file.name),
    );

    if (unprocessedFiles.length === 0) {
      setError(t("dd214Analyzer", "allFilesProcessed"));
      return;
    }

    // Use the internal OCR runner
    await runOCROnFilesInternal(unprocessedFiles);
  };

  /**
   * Handle file selection via input
   */
  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    await processFiles(files);
  };

  /**
   * Remove a dropped in file
   */
  const handleRemoveFile = (index) => {
    const fileToRemove = droppedFiles[index];
    setDroppedFiles((prev) => prev.filter((_, i) => i !== index));
    setExtractedTexts((prev) => prev.filter((_, i) => i !== index));
    // Also remove from original PDF files if it's a PDF
    if (fileToRemove?.name?.toLowerCase().endsWith(".pdf")) {
      setOriginalPDFFiles((prev) =>
        prev.filter((f) => f.name !== fileToRemove.name),
      );
    }
  };

  /**
   * Combine all input sources into analysis text
   */
  const getCombinedText = () => {
    let combined = "";

    // Add pasted text if present
    if (pastedText.trim()) {
      combined += `=== PASTED DD214 TEXT ===\n${pastedText.trim()}\n\n`;
    }

    // Add extracted texts from dropped in files
    extractedTexts.forEach((item, idx) => {
      combined += `=== DD214 DOCUMENT ${idx + 1}: ${item.filename} ===\n`;
      combined += `(File type: ${item.fileType || "PDF"}, Method: ${item.method}, Pages: ${item.pageCount})\n\n`;
      combined += item.text;
      combined += "\n\n";
    });

    return combined.trim();
  };

  /**
   * Estimate token count for Llama 3.2 tokenizer
   * Real-world testing shows Llama 3.2 uses ~1.7-2.5 chars/token for mixed content
   * Using 2 chars/token as conservative estimate (errs on side of caution)
   */
  const estimateTokens = (text) => Math.ceil(text.length / 2);

  /**
   * Truncate text to fit within token limit, preserving important sections
   */
  const truncateForContext = (text, maxTokens = 2000) => {
    const maxChars = maxTokens * 2; // ~2 chars per token (conservative for Llama 3.2)
    if (text.length <= maxChars) return text;

    // For DD214s, prioritize the beginning (service info, dates, MOS)
    // and end (awards, decorations, remarks sections)
    const beginningChars = Math.floor(maxChars * 0.6); // 60% for beginning
    const endingChars = Math.floor(maxChars * 0.35); // 35% for ending
    const beginning = text.slice(0, beginningChars);
    const ending = text.slice(-endingChars);

    const omittedKB = Math.floor((text.length - maxChars) / 1000);
    return `${beginning}\n\n[... DOCUMENT TRUNCATED - ${omittedKB}KB OMITTED FOR LOCAL AI PROCESSING ...]\n\n${ending}`;
  };

  /**
   * Main Analysis Handler - THE BUTTON
   * Supports two modes:
   * 1. Vision Model: Sends actual PDF page images directly to vision model (bypasses OCR)
   * 2. Text Model: Uses OCR/text extraction then sends to LLM
   */
  const handleAnalyzeWithAI = async () => {
    // Prevent double-clicks and React StrictMode double-firing
    if (isGenerating) {
      console.log("⚠️ Analysis already in progress, ignoring duplicate click");
      return;
    }

    // Immediately set generating to prevent race conditions
    setIsGenerating(true);

    const combinedText = getCombinedText();
    const hasVisionModel = isLocalAIVisionModel();
    const hasPDFFiles = originalPDFFiles.length > 0;

    // Vision model support: DISABLED - Custom model compilation did not produce image_embed function
    // MLC-LLM vision models require special compilation that includes CLIP preprocessing
    // To enable, load the official "Phi-3.5-vision-instruct-q4f16_1-MLC" model from MLC-AI
    // TODO: Investigate proper vision model compilation with image_embed export
    const useVisionAnalysis = false; // Force OCR path - vision requires official MLC models

    console.log(
      `🔍 Analysis mode: ${useVisionAnalysis ? "VISION (direct image)" : "TEXT (OCR/extraction)"}`,
    );
    console.log(
      `   hasVisionModel: ${hasVisionModel}, hasPDFFiles: ${hasPDFFiles}, hasPastedText: ${!!pastedText.trim()}`,
    );

    // If no text has been extracted, prompt user to run OCR
    if (!combinedText && !useVisionAnalysis) {
      if (hasPDFFiles || droppedFiles.length > 0) {
        setError(t("dd214Analyzer", "runOcrFirst"));
      } else {
        setError(t("dd214Analyzer", "pasteOrDropFirst"));
      }
      setIsGenerating(false); // Reset since we're returning early
      return;
    }

    if (!aiStatus.anyAvailable) {
      setError(t("dd214Analyzer", "aiNotAvailable"));
      setIsGenerating(false); // Reset since we're returning early
      return;
    }

    setError(null);
    setAnalysisResult(null);

    try {
      let response;

      if (useVisionAnalysis) {
        // ========== VISION MODEL PATH ==========
        // Render PDFs to images and send directly to vision model
        console.log("🖼️ Using Vision Model for direct image analysis");

        setOcrProgress({
          state: OCR_STATES.LOADING,
          progress: 0,
          message: "Preparing images for vision analysis...",
        });

        // Collect all images from all PDF files
        const allImages = [];
        for (let i = 0; i < originalPDFFiles.length; i++) {
          const pdfFile = originalPDFFiles[i];
          setOcrProgress({
            state: OCR_STATES.OCR_IN_PROGRESS,
            progress: (i / originalPDFFiles.length) * 50,
            message: `Rendering ${pdfFile.name}...`,
          });

          const { images } = await renderPDFToImages(pdfFile, {
            maxPages: 2, // First 2 pages usually have critical DD214 info
            scale: 1.5, // Good balance of quality vs size
            format: "jpeg",
            quality: 0.85,
          });
          allImages.push(...images);
        }

        console.log(`📷 Total images for vision model: ${allImages.length}`);

        setOcrProgress({
          state: OCR_STATES.OCR_IN_PROGRESS,
          progress: 60,
          message: "Analyzing images with vision model...",
        });

        // Send images to vision model
        response = await generateAIWithImage(
          "Analyze this DD214 discharge document and extract all information. Return your analysis as JSON following the format specified in the system prompt.",
          allImages,
          {
            systemPrompt: DD214_ANALYSIS_SYSTEM_PROMPT,
            maxTokens: 2048,
            temperature: 0.2,
            skipHallucinationCheck: true, // DD214 JSON doesn't contain diagnostic codes
          },
        );

        setOcrProgress(null);
      } else {
        // ========== TEXT MODEL PATH (original) ==========
        // Use OCR/text extraction then send to LLM
        console.log("📝 Using Text Model for OCR-based analysis");

        // Determine if we're using local or cloud AI
        // Local models have tight context limits (4096), cloud has much more
        const localContextLimit = 4096;
        const isLocalOnly = aiStatus.localAvailable && !aiStatus.cloudAvailable;

        // Choose system prompt based on AI availability
        // Local models need the condensed prompt to fit in 4K context
        const systemPrompt = isLocalOnly
          ? DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL
          : DD214_ANALYSIS_SYSTEM_PROMPT;

        // Estimate total tokens needed
        // Using 2 chars/token for conservative Llama 3.2 estimates
        const systemPromptTokens = estimateTokens(systemPrompt);
        const documentTokens = estimateTokens(combinedText);
        const userPromptWrapper = 100; // "Analyze this DD214 document..." wrapper with formatting
        // Models with larger context can handle more output tokens
        const outputBuffer = localContextLimit >= 8192 ? 2048 : 1024;

        console.log(
          `📊 Token estimates: system=${systemPromptTokens}, doc=${documentTokens}, wrapper=${userPromptWrapper}, output=${outputBuffer}`,
        );

        const totalEstimatedTokens =
          systemPromptTokens +
          documentTokens +
          userPromptWrapper +
          outputBuffer;

        const needsTruncation =
          totalEstimatedTokens > localContextLimit && isLocalOnly;
        const preferCloud =
          totalEstimatedTokens > localContextLimit && aiStatus.cloudAvailable;

        let documentText = combinedText;

        if (needsTruncation) {
          console.warn(
            `⚠️ Document too large (${totalEstimatedTokens} tokens estimated). Truncating for local AI...`,
          );
          // Calculate safe document size:
          // Available = Context - System - Wrapper - Output
          const availableForDoc =
            localContextLimit -
            systemPromptTokens -
            userPromptWrapper -
            outputBuffer;
          // Ensure minimum reasonable size (at least 500 tokens for useful extraction)
          const maxDocTokens = Math.max(500, availableForDoc);
          documentText = truncateForContext(combinedText, maxDocTokens);
          console.log(
            `📄 Truncated to ~${estimateTokens(documentText)} tokens (max allowed: ${maxDocTokens})`,
          );
          setError(null); // Clear any previous errors
        }

        if (preferCloud) {
          console.log(
            `📄 Large document (${totalEstimatedTokens} tokens). Using Cloud AI for better results.`,
          );
        }

        // Call the unified AI service - system prompt goes in options, NOT in main message
        response = await generateAI(
          `Analyze this DD214 document and extract the information as JSON:\n\n${documentText}`,
          {
            temperature: 0.2, // Lower temperature for more consistent JSON output
            maxTokens: outputBuffer, // Use calculated output buffer based on context size
            expectJSON: true,
            systemPrompt: systemPrompt,
            preferCloud: preferCloud, // Hint to use cloud for large docs
            skipHallucinationCheck: true, // DD214 JSON doesn't contain diagnostic codes
          },
        );
      }

      // Extract text from response
      // Handle both direct string responses and {text, mode} objects
      let content;
      if (typeof response === "string") {
        content = response;
      } else if (response && typeof response.text === "string") {
        content = response.text;
      } else {
        content = "";
      }
      console.log("🤖 Raw AI Response:", content || "(empty)");

      // Check for empty response - vision models may return empty if image processing failed
      if (!content || content.trim().length === 0) {
        if (response?.isVisionResponse) {
          throw new Error(
            "Vision model returned empty response. The model may have had trouble processing the image. Try: 1) Using a clearer scan, 2) Switching to text-based analysis, or 3) Reloading the AI model.",
          );
        }
        throw new Error("No response received from AI. Please try again.");
      }

      // Parse JSON from response
      let data;
      try {
        let cleanContent =
          typeof content === "string"
            ? content.trim()
            : JSON.stringify(content);
        console.log(
          "🧹 Clean content before JSON parse:",
          cleanContent.substring(0, 500),
        );

        // Remove markdown code fences if present
        if (cleanContent.startsWith("```json"))
          cleanContent = cleanContent.slice(7);
        if (cleanContent.startsWith("```"))
          cleanContent = cleanContent.slice(3);
        if (cleanContent.endsWith("```"))
          cleanContent = cleanContent.slice(0, -3);

        // Try to find JSON object in the response if it's mixed with other text
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanContent = jsonMatch[0];
        }

        // Remove JavaScript-style comments from JSON (some models add these)
        // Remove single-line comments: // comment
        cleanContent = cleanContent.replace(/\/\/[^\n\r]*/g, "");
        // Remove multi-line comments: /* comment */
        cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, "");
        // Clean up any trailing commas before } or ] (common after comment removal)
        cleanContent = cleanContent.replace(/,(\s*[}\]])/g, "$1");

        console.log(
          "🧹 After comment removal:",
          cleanContent.substring(0, 500),
        );

        data = JSON.parse(cleanContent.trim());

        // Normalize data - AI sometimes returns fields in unexpected formats
        // Handle MOS being returned as an object instead of string
        if (data.mos && typeof data.mos === "object") {
          const mosObj = data.mos;
          data.mos = mosObj.code || "";
          data.mosTitle = data.mosTitle || mosObj.title || "";
        }
        // Ensure string fields are actually strings
        if (data.mos && typeof data.mos !== "string") {
          data.mos = String(data.mos);
        }
        if (data.mosTitle && typeof data.mosTitle !== "string") {
          data.mosTitle = String(data.mosTitle);
        }

        console.log("✅ Parsed JSON data:", data);
      } catch (parseError) {
        console.error("JSON parse error:", parseError, "Content:", content);
        throw new Error(t("dd214Analyzer", "parseError"));
      }

      setAnalysisResult(data);

      // ─── DIAMOND STANDARD: Regex Safety Net ───
      // Run the deterministic field extractor on the raw OCR text and
      // merge with AI results. If AI missed a field but regex found it,
      // the regex value fills the gap. If both have a value, AI wins for
      // complex fields, regex wins for structured fields like dates/MOS.
      try {
        const combinedRaw = getCombinedText();
        const regexResult = extractDD214Fields(combinedRaw);
        if (regexResult && Object.keys(regexResult).length > 0) {
          const merged = mergeAIAndRegexResults(data, regexResult);
          console.log(
            "🔀 Merged AI + Regex results:",
            Object.keys(merged).length,
            "fields",
          );
          // Update the result in state with merged data
          Object.assign(data, merged);
          setAnalysisResult({ ...data });
        }
      } catch (regexErr) {
        console.warn(
          "Regex field extraction failed (non-fatal):",
          regexErr.message,
        );
        // AI-only results are still valid — this is just the safety net
      }

      // Automatically trigger the save flow to show import confirmation
      // This provides immediate feedback to the user
      setTimeout(() => {
        handleSaveResultsAfterAnalysis(data);
      }, 500);
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err.message || t("dd214Analyzer", "analysisFailed"));
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Validate and fix date string
   * Returns null if date is invalid
   */
  const validateDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null;

    // Try to parse the date
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return dateStr; // Return as-is if not in expected format

    const [, year, month, day] = match;
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);

    // Validate ranges
    if (m < 1 || m > 12) return null;

    // Days in month (accounting for leap years)
    const daysInMonth = [
      31,
      y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];
    if (d < 1 || d > daysInMonth[m - 1]) return null;

    // Validate reasonable year range for DD214s (1900-2100)
    if (y < 1900 || y > 2100) return null;

    return dateStr;
  };

  /**
   * Save results after analysis (automatic trigger)
   */
  const handleSaveResultsAfterAnalysis = (result) => {
    if (!result) {
      console.warn("handleSaveResultsAfterAnalysis called with empty result");
      return;
    }

    try {
      // Validate dates before using
      const validatedEntryDate = validateDate(result.entryDate);
      const validatedSeparationDate = validateDate(result.separationDate);

      // Prepare extracted profile data for review
      // Note: Use EITHER serviceStartDate OR entryDate, not both (they're duplicates)
      // Same for serviceEndDate/separationDate
      const rawProfileData = {
        // Personal Identification
        fullName: result.fullName,
        lastName: result.lastName,
        firstName: result.firstName,
        middleName: result.middleName,
        ssnLast4: result.ssnLast4,
        serviceNumber: result.serviceNumber,
        dateOfBirth: validateDate(result.dateOfBirth),
        placeOfBirth: result.placeOfBirth,
        homeOfRecord: result.homeOfRecord,

        // Component & Rank
        branch: result.branch,
        component: result.component,
        componentFull: result.componentFull,
        rank: result.rank,
        payGrade: result.payGrade,
        dateOfRank: validateDate(result.dateOfRank),

        // MOS & Assignments
        mos: result.mos,
        mosTitle: result.mosTitle,
        lastDutyAssignment: result.lastDutyAssignment,
        commandTransferredTo: result.commandTransferredTo,

        // Dates & Service Time
        entryDate: validatedEntryDate,
        separationDate: validatedSeparationDate,
        netActiveService: result.netActiveService,
        totalPriorActiveService: result.totalPriorActiveService,
        totalPriorInactiveService: result.totalPriorInactiveService,
        yearsService: result.yearsService,
        monthsService: result.monthsService,
        daysService: result.daysService,

        // Benefits & Obligations
        sglCoverage: result.sglCoverage,
        giBlStatus: result.giBlStatus,
        reserveObligationDate: validateDate(result.reserveObligationDate),
        daysLost: result.daysLost,
        foreignService: result.foreignService,
        foreignServiceDetails: result.foreignServiceDetails,
        seaService: result.seaService,

        // Separation Info
        separationAuthority: result.separationAuthority,
        separationCode: result.separationCode,
        reentryCode: result.reentryCode,
        separationProgramDesignator: result.separationProgramDesignator,
        separationType: result.separationType,
        characterOfService: result.characterOfService,
        narrativeReason: result.narrativeReason,

        // Education & Training
        militaryEducation: result.militaryEducation,
        memberRequests: result.memberRequests,

        // Contact
        homeAddress: result.homeAddress,

        // Combat & Qualifications
        specialQualifications: result.specialQualifications,
        securityClearance: result.securityClearance,

        // Legacy
        reenlisted: result.reenlisted,
      };

      // Filter out undefined/null values but keep empty strings for user to fill
      // Also keep boolean false values (like reenlisted: false)
      const profileData = Object.fromEntries(
        Object.entries(rawProfileData).filter(([key, value]) => {
          // Always exclude undefined/null
          if (value === undefined || value === null) return false;
          // Keep booleans (including false)
          if (typeof value === "boolean") return true;
          // Keep non-empty strings
          if (typeof value === "string" && value.trim() !== "") return true;
          // Keep numbers
          if (typeof value === "number") return true;
          // Filter out empty strings
          return false;
        }),
      );

      // Only show modal if we have data to import
      if (Object.keys(profileData).length === 0) {
        console.warn("No profile data extracted from DD214");
        return;
      }

      console.log("Opening profile import modal with data:", profileData);

      // Show confirmation modal automatically
      setExtractedProfileData(profileData);
      setShowProfileImportModal(true);
    } catch (err) {
      console.error("Auto-save prep error:", err);
      // Don't show error, user can still click manual save button
    }
  };

  /**
   * Save results to veteran profile - Shows confirmation modal first
   */
  const handleSaveResults = () => {
    if (!analysisResult) return;

    try {
      // Validate dates before using
      const validatedEntryDate = validateDate(analysisResult.entryDate);
      const validatedSeparationDate = validateDate(
        analysisResult.separationDate,
      );

      // Prepare extracted profile data for review
      // Note: No duplicate fields (removed serviceStartDate/serviceEndDate aliases)
      const profileData = {
        branch: analysisResult.branch,
        mos: analysisResult.mos,
        mosTitle: analysisResult.mosTitle,
        entryDate: validatedEntryDate,
        separationDate: validatedSeparationDate,
        separationType: analysisResult.separationType,
        characterOfService: analysisResult.characterOfService,
        reenlisted: analysisResult.reenlisted,
        foreignService: analysisResult.foreignService,
        yearsService: analysisResult.yearsService,
        monthsService: analysisResult.monthsService,
      };

      // Filter out null/undefined
      const filteredData = Object.fromEntries(
        Object.entries(profileData).filter(
          ([_, v]) => v !== null && v !== undefined,
        ),
      );

      // Show confirmation modal
      setExtractedProfileData(filteredData);
      setShowProfileImportModal(true);
    } catch (err) {
      console.error("Save error:", err);
      setError(t("dd214Analyzer", "prepareError"));
    }
  };

  /**
   * Confirm and save profile data after user review
   * DIAMOND STANDARD: Saves to THREE places:
   *   1. Veteran Profile (localStorage) — for forms and calculator
   *   2. Veteran Knowledge Base (IndexedDB) — for AI tools
   *   3. My Packet (IndexedDB) — permanent document archive
   */
  const handleConfirmProfileImport = async (selectedFields) => {
    try {
      // ── 1. SAVE TO VETERAN PROFILE (existing behavior) ──
      saveDD214Data({
        branch: analysisResult.branch,
        component: analysisResult.component,
        componentFull: analysisResult.componentFull,
        rank: analysisResult.rank,
        payGrade: analysisResult.payGrade,
        dateOfRank: analysisResult.dateOfRank,
        mos: analysisResult.mos,
        mosTitle: analysisResult.mosTitle,
        entryDate: analysisResult.entryDate,
        separationDate: analysisResult.separationDate,
        netActiveService: analysisResult.netActiveService,
        totalPriorActiveService: analysisResult.totalPriorActiveService,
        totalPriorInactiveService: analysisResult.totalPriorInactiveService,
        yearsService: analysisResult.yearsService,
        monthsService: analysisResult.monthsService,
        daysService: analysisResult.daysService,
        reserveObligationDate: analysisResult.reserveObligationDate,
        militaryEducation: analysisResult.militaryEducation,
        separationType: analysisResult.separationType,
        characterOfService: analysisResult.characterOfService,
        reenlisted: analysisResult.reenlisted,
        foreignService: analysisResult.foreignService,
        extractedText: getCombinedText().substring(0, 10000),
        dd214Count: analysisResult.dd214Count,
        combatService: analysisResult.combatService,
        specialQualifications: analysisResult.specialQualifications,
      });

      // Save awards to profile
      if (analysisResult.awards && Array.isArray(analysisResult.awards)) {
        analysisResult.awards.forEach((award) => {
          addAward({
            name: award.name,
            abbreviation: award.abbreviation,
            dateReceived: null,
            notes: award.devices?.join(", ") || "",
            isCombat: award.isCombat || false,
            sourceDD214: award.sourceDD214,
          });
        });
      }

      // Update veteran profile with selected fields only
      if (selectedFields && Object.keys(selectedFields).length > 0) {
        updateVeteranProfile(selectedFields);
      }

      // ── 2. SAVE TO VETERAN KNOWLEDGE BASE (VKB) ──
      // This makes ALL extracted DD214 data available to every AI tool
      try {
        const vkb = await loadVKB();

        // Build comprehensive data object for VKB merge
        const vkbData = {
          fullName:
            analysisResult.fullName ||
            `${analysisResult.lastName || ""}, ${analysisResult.firstName || ""}`.replace(
              /^, |, $/g,
              "",
            ),
          name: analysisResult.fullName || analysisResult.name,
          ssn: analysisResult.ssnLast4 || analysisResult.ssn,
          ssnLast4: analysisResult.ssnLast4,
          dateOfBirth: analysisResult.dateOfBirth,
          branch: analysisResult.branch,
          component: analysisResult.component || analysisResult.componentFull,
          rank: analysisResult.rank,
          payGrade: analysisResult.payGrade,
          mos: analysisResult.mos,
          mosTitle: analysisResult.mosTitle,
          entryDate: analysisResult.entryDate,
          separationDate: analysisResult.separationDate,
          yearsService: analysisResult.yearsService,
          netActiveServiceTime: analysisResult.netActiveService,
          characterOfService: analysisResult.characterOfService,
          separationAuthority: analysisResult.separationAuthority,
          separationType: analysisResult.separationType,
          narrativeReason: analysisResult.narrativeReason,
          reentryCode: analysisResult.reentryCode,
          spnCode:
            analysisResult.separationCode ||
            analysisResult.separationProgramDesignator,
          reenlisted: analysisResult.reenlisted,
          foreignService: analysisResult.foreignService,
          educationYears: analysisResult.educationYears,
          education: analysisResult.militaryEducation,
          awards: analysisResult.awards || [],
          deployments: analysisResult.deployments || [],
          combatService: analysisResult.combatService || null,
          specialQualifications: analysisResult.specialQualifications || [],
          mailingAddress: analysisResult.homeAddress || null,
        };

        // Determine filename for tracking
        const sourceFileName =
          extractedTexts.length > 0
            ? extractedTexts.map((t) => t.filename).join(", ")
            : "Pasted DD214 Text";

        mergeDD214IntoVKB(vkb, vkbData, { fileName: sourceFileName });
        await saveVKB(vkb);
        console.log("✅ DD214 data merged into VKB");

        // Also register the document in VKB documentation
        await addDocumentToVKB({
          fileName: sourceFileName,
          classification: "DD214",
          fileSize: getCombinedText().length,
          pageCount:
            extractedTexts.reduce((sum, t) => sum + (t.pageCount || 1), 0) || 1,
          extractedText: getCombinedText().substring(0, 50000),
          extractedData: vkbData,
          ocrUsed: extractedTexts.some((t) => t.ocrUsed),
          method: extractedTexts[0]?.method || "paste",
        });
      } catch (vkbErr) {
        console.error("VKB save failed (non-fatal):", vkbErr);
        // Don't block the save — profile data is still saved
      }

      // ── 3. SAVE TO MY PACKET (permanent archive) ──
      // This stores the full document text + structured data forever
      try {
        const sourceFileName =
          extractedTexts.length > 0
            ? extractedTexts.map((t) => t.filename).join(", ")
            : "Pasted DD214 Text";

        const packetResult = await saveDocumentToPacket({
          fileName: sourceFileName,
          classification: PACKET_DOC_TYPES.DD214,
          rawText: getCombinedText(),
          extractedData: analysisResult,
          pageCount:
            extractedTexts.reduce((sum, t) => sum + (t.pageCount || 1), 0) || 1,
          fileSize: new Blob([getCombinedText()]).size,
          ocrMethod: extractedTexts[0]?.method || "paste",
          ocrConfidence: extractedTexts[0]?.ocrConfidence || 0,
          aiAnalysis: analysisResult,
          tags: [
            analysisResult.branch,
            analysisResult.rank,
            analysisResult.mos,
          ].filter(Boolean),
        });

        if (packetResult.success) {
          console.log("📁 DD214 saved to My Packet:", packetResult.documentId);
        }
      } catch (packetErr) {
        console.error("My Packet save failed (non-fatal):", packetErr);
      }

      // Callback if provided
      if (onSaveResults) {
        onSaveResults(analysisResult);
      }

      // Close modal
      setShowProfileImportModal(false);
      setExtractedProfileData(null);

      // Success message
      const fieldCount = Object.keys(selectedFields).length;
      alert(
        `✅ ${t("dd214Analyzer", "dd214DataSaved")}\n• ${t("dd214Analyzer", "serviceHistoryUpdated")}\n• ${analysisResult.awards?.length || 0} ${t("dd214Analyzer", "awardsRecorded")}\n• ${fieldCount} ${t("dd214Analyzer", "profileFieldsImported")}\n• Saved to Knowledge Base (AI-ready)\n• Archived in My Packet`,
      );
    } catch (err) {
      console.error("Save error:", err);
      setError(t("dd214Analyzer", "saveFailed"));
      setShowProfileImportModal(false);
    }
  };

  /**
   * Cancel profile import
   */
  const handleCancelProfileImport = () => {
    setShowProfileImportModal(false);
    setExtractedProfileData(null);
  };

  /**
   * Clear all inputs
   */
  const handleClearAll = () => {
    setPastedText("");
    setDroppedFiles([]);
    setExtractedTexts([]);
    setAnalysisResult(null);
    setError(null);
  };

  // Has input if: pasted text, OR processed files with extracted text, OR loaded files (to prompt user to OCR)
  // Vision path disabled due to custom model lacking image_embed function
  const hasInput =
    pastedText.trim() ||
    extractedTexts.length > 0 ||
    droppedFiles.length > 0 ||
    originalPDFFiles.length > 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📜</span>
            <div>
              <h2 className="text-xl font-bold text-white">
                {t("dd214Analyzer", "title")}{" "}
                <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
                  {t("dd214Analyzer", "beta")}
                </span>
              </h2>
              <p className="text-sm text-blue-200">
                {t("dd214Analyzer", "subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LLMRecommendationBadge toolId="dd214-analyzer" />
            <AIStatusBadge onClick={onOpenAISettings} />
            {onReportBug && (
              <ReportBugLink
                onClick={onReportBug}
                variant="light"
                moduleName="DD214 Analyzer"
              />
            )}
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              aria-label={t("dd214Analyzer", "close")}
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

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Workflow Guidance Banner */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div className="flex-1">
                <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                  Quick Guide
                </h3>
                <div className="text-sm text-purple-800 dark:text-purple-200 space-y-2">
                  <p>
                    <strong>Use this tool for:</strong> Single DD214 deep
                    analysis with AI extraction
                  </p>
                  <p>
                    <strong>Need to process many documents at once?</strong>
                  </p>
                  {onOpenMusterCall && (
                    <button
                      onClick={onOpenMusterCall}
                      className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors text-sm shadow-md flex items-center gap-2"
                    >
                      🎯 Open Muster Call (Batch Processing)
                    </button>
                  )}
                  {!onOpenMusterCall && (
                    <p className="text-xs italic">
                      Look for "Muster Call" in the Missions menu for batch
                      document processing
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">
                  {t("dd214Analyzer", "privateProcessing")}
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {aiStatus.isPrivate
                    ? t("dd214Analyzer", "privateProcessingLocal")
                    : t("dd214Analyzer", "privateProcessingCloud")}
                </p>
              </div>
            </div>
          </div>

          {/* Smart AI Load Button */}
          {!aiStatus.anyAvailable && (
            <div className="mb-4">
              <SmartAILoadButton
                toolId="dd214-analyzer"
                onLoadComplete={(model) => {
                  console.log(
                    "Smart AI loaded for DD214 Analyzer:",
                    model?.name,
                  );
                  setAIStatus(getAIStatus());
                }}
              />
            </div>
          )}

          {/* Input Method Tabs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Choose Input Method:
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Select how you want to provide your DD214 data
              </span>
            </div>
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setInputMethod("paste")}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  inputMethod === "paste"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
                title="Copy text from a digital DD214 and paste it here"
              >
                📋 {t("dd214Analyzer", "pasteText")}
              </button>
              <button
                onClick={() => setInputMethod("upload")}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  inputMethod === "upload"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
                title="Upload PDF or image files - we'll extract the text for you"
              >
                📄 {t("dd214Analyzer", "dropInPdf")}{" "}
                {extractedTexts.length > 0 && `(${extractedTexts.length})`}
              </button>
              <button
                onClick={() => setInputMethod("manual")}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  inputMethod === "manual"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
                title="Fill out a guided form if you don't have a digital copy"
              >
                ✏️ {t("dd214Analyzer", "manualEntry")}
              </button>
            </div>
          </div>

          {/* Paste Input */}
          {inputMethod === "paste" && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("dd214Analyzer", "pasteYourDD214")}
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={t("dd214Analyzer", "pasteTextPlaceholder")}
                rows={10}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("dd214Analyzer", "piiWarning")}
              </p>
            </div>
          )}

          {/* Manual Entry */}
          {inputMethod === "manual" && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <span className="text-4xl">✏️</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-blue-900 dark:text-blue-100 text-lg mb-2">
                      {t("dd214Analyzer", "buildManually")}
                    </h3>
                    <p className="text-blue-800 dark:text-blue-200 mb-4">
                      {t("dd214Analyzer", "manualEntryDesc")}
                    </p>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 mb-4">
                      <li>• 📋 {t("dd214Analyzer", "allBlocksIncluded")}</li>
                      <li>• 💾 {t("dd214Analyzer", "saveMultipleDD214s")}</li>
                      <li>• 🔒 {t("dd214Analyzer", "dataStaysPrivate")}</li>
                      <li>• ✅ {t("dd214Analyzer", "guidedFormLabels")}</li>
                    </ul>
                    <button
                      onClick={() => setShowFormBuilder(true)}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg"
                    >
                      📝 {t("dd214Analyzer", "openFormBuilder")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Show saved DD214s if any */}
              <SavedDD214List />
            </div>
          )}

          {/* Upload Input */}
          {inputMethod === "upload" && (
            <div className="space-y-4">
              {/* Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  isDragging
                    ? "border-blue-500 bg-blue-100 dark:bg-blue-900/30 scale-105"
                    : "border-gray-300 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                }`}
              >
                <svg
                  className="w-12 h-12 text-gray-400 mx-auto mb-4"
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
                <p className="text-gray-600 dark:text-gray-400 font-medium">
                  {isDragging
                    ? `📥 ${t("dd214Analyzer", "dropPdfFiles")}`
                    : `📄 ${t("dd214Analyzer", "dragDropOrClick")}`}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  {t("dd214Analyzer", "supportedFormats")}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={getAcceptString()}
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* OCR Progress */}
              {ocrProgress && <OCRProgressBar progress={ocrProgress} />}
            </div>
          )}

          {/* Loaded Files List - Always visible when files are loaded, regardless of input method */}
          {/* Show if droppedFiles OR originalPDFFiles have items (for backwards compatibility) */}
          {(droppedFiles.length > 0 || originalPDFFiles.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">
                  📁 {t("dd214Analyzer", "loadedFiles")} (
                  {Math.max(droppedFiles.length, originalPDFFiles.length)})
                </h4>
                {/* OCR Button - only show if there are unprocessed files */}
                {(droppedFiles.length > 0
                  ? droppedFiles
                  : originalPDFFiles
                ).some(
                  (f) => !extractedTexts.some((et) => et.filename === f.name),
                ) && (
                  <button
                    onClick={runOCROnFiles}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {t("dd214Analyzer", "processing")}
                      </>
                    ) : (
                      <>🔍 {t("dd214Analyzer", "runOcr")}</>
                    )}
                  </button>
                )}
              </div>

              {/* Use droppedFiles if available, fall back to originalPDFFiles for backwards compat */}
              {(droppedFiles.length > 0 ? droppedFiles : originalPDFFiles).map(
                (file, idx) => {
                  const isProcessed = extractedTexts.some(
                    (et) => et.filename === file.name,
                  );
                  const processedData = extractedTexts.find(
                    (et) => et.filename === file.name,
                  );

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isProcessed
                          ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                          : "bg-gray-50 dark:bg-gray-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {isProcessed ? "✅" : "📄"}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.size)}
                            {isProcessed && processedData && (
                              <span className="ml-2 text-green-600 dark:text-green-400">
                                • {processedData.pageCount}{" "}
                                {t("dd214Analyzer", "pages")} •{" "}
                                {processedData.method === "ocr"
                                  ? `🔍 ${t("dd214Analyzer", "ocr")}`
                                  : processedData.method === "hybrid"
                                    ? `🔍 ${t("dd214Analyzer", "hybrid")}`
                                    : `📝 ${t("dd214Analyzer", "text")}`}
                              </span>
                            )}
                            {!isProcessed && (
                              <span className="ml-2 text-amber-600 dark:text-amber-400">
                                • {t("dd214Analyzer", "readyForOcrOrVision")}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(idx)}
                        className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
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
                },
              )}

              {/* OCR Status - shown when files are loaded */}
              {(droppedFiles.length > 0 || originalPDFFiles.length > 0) &&
                !extractedTexts.length &&
                !isProcessing && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <span className="font-semibold">
                        🔄 OCR will start automatically...
                      </span>
                    </p>
                  </div>
                )}

              {/* Processing indicator */}
              {isProcessing && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                  <p className="text-sm text-purple-700 dark:text-purple-300 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-semibold">
                      📄 Processing your document... Please wait.
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-200">
                    {t("dd214Analyzer", "error")}
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Analysis Results */}
          {analysisResult && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                  ✅ {t("dd214Analyzer", "analysisComplete")}
                  {analysisResult.dd214Count > 1 && (
                    <span className="text-xs bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded-full">
                      {analysisResult.dd214Count}{" "}
                      {t("dd214Analyzer", "dd214sConsolidated")}
                    </span>
                  )}
                </h3>
              </div>

              {/* Service Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {/* Personal Identification */}
                {analysisResult.fullName && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Full Name
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {analysisResult.fullName}
                    </p>
                  </div>
                )}
                {analysisResult.dateOfBirth && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Date of Birth
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {analysisResult.dateOfBirth}
                    </p>
                  </div>
                )}
                {analysisResult.placeOfBirth && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Place of Birth
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {analysisResult.placeOfBirth}
                    </p>
                  </div>
                )}
                {analysisResult.homeOfRecord && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Home of Record
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {analysisResult.homeOfRecord}
                    </p>
                  </div>
                )}

                {/* Branch & Component */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("dd214Analyzer", "branch")}
                  </p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {analysisResult.branch || t("dd214Analyzer", "na")}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Component
                  </p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {analysisResult.componentFull ||
                      analysisResult.component ||
                      t("dd214Analyzer", "na")}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Rank
                  </p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {analysisResult.rank || t("dd214Analyzer", "na")}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Pay Grade
                  </p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {analysisResult.payGrade || t("dd214Analyzer", "na")}
                  </p>
                </div>

                {/* MOS & Assignments */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("dd214Analyzer", "mos")}
                  </p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {typeof analysisResult.mos === "object"
                      ? analysisResult.mos?.code ||
                        JSON.stringify(analysisResult.mos)
                      : analysisResult.mos || t("dd214Analyzer", "na")}
                  </p>
                  {analysisResult.mosTitle && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {analysisResult.mosTitle}
                    </p>
                  )}
                </div>
                {analysisResult.lastDutyAssignment && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Last Duty Assignment
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                      {analysisResult.lastDutyAssignment}
                    </p>
                  </div>
                )}
                {analysisResult.commandTransferredTo && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Command Transferred To
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                      {analysisResult.commandTransferredTo}
                    </p>
                  </div>
                )}

                {/* Service Dates */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Entry Date
                  </p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {analysisResult.entryDate || t("dd214Analyzer", "na")}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("dd214Analyzer", "separation")}
                  </p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {analysisResult.separationDate || t("dd214Analyzer", "na")}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Net Active Service
                  </p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {analysisResult.netActiveService
                      ? `${analysisResult.netActiveService.years || 0}y ${analysisResult.netActiveService.months || 0}m ${analysisResult.netActiveService.days || 0}d`
                      : analysisResult.yearsService
                        ? `${analysisResult.yearsService}y ${analysisResult.monthsService || 0}m ${analysisResult.daysService || 0}d`
                        : t("dd214Analyzer", "na")}
                  </p>
                </div>
                {analysisResult.totalPriorActiveService &&
                  (analysisResult.totalPriorActiveService.years > 0 ||
                    analysisResult.totalPriorActiveService.months > 0 ||
                    analysisResult.totalPriorActiveService.days > 0) && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Prior Active Service
                      </p>
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {`${analysisResult.totalPriorActiveService.years || 0}y ${analysisResult.totalPriorActiveService.months || 0}m ${analysisResult.totalPriorActiveService.days || 0}d`}
                      </p>
                    </div>
                  )}
                {analysisResult.totalPriorInactiveService &&
                  (analysisResult.totalPriorInactiveService.years > 0 ||
                    analysisResult.totalPriorInactiveService.months > 0 ||
                    analysisResult.totalPriorInactiveService.days > 0) && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Prior Inactive Service
                      </p>
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {`${analysisResult.totalPriorInactiveService.years || 0}y ${analysisResult.totalPriorInactiveService.months || 0}m ${analysisResult.totalPriorInactiveService.days || 0}d`}
                      </p>
                    </div>
                  )}
                {analysisResult.seaService &&
                  (analysisResult.seaService.years > 0 ||
                    analysisResult.seaService.months > 0 ||
                    analysisResult.seaService.days > 0) && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Sea Service
                      </p>
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {`${analysisResult.seaService.years || 0}y ${analysisResult.seaService.months || 0}m ${analysisResult.seaService.days || 0}d`}
                      </p>
                    </div>
                  )}
                {analysisResult.dateOfRank && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Date of Rank
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {analysisResult.dateOfRank}
                    </p>
                  </div>
                )}

                {/* Benefits & Obligations */}
                {analysisResult.sglCoverage && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      SGLI Coverage
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {analysisResult.sglCoverage}
                    </p>
                  </div>
                )}
                {analysisResult.giBlStatus && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      GI Bill Status
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {analysisResult.giBlStatus}
                    </p>
                  </div>
                )}
                {analysisResult.reserveObligationDate && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Reserve Obligation End
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {analysisResult.reserveObligationDate}
                    </p>
                  </div>
                )}
                {analysisResult.daysLost && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Days Lost
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {analysisResult.daysLost}
                    </p>
                  </div>
                )}

                {/* Separation Info */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Character of Service
                  </p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {analysisResult.characterOfService ||
                      t("dd214Analyzer", "na")}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Separation Type
                  </p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {analysisResult.separationType || t("dd214Analyzer", "na")}
                  </p>
                </div>
                {analysisResult.separationCode && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Separation Code
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {analysisResult.separationCode}
                    </p>
                  </div>
                )}
                {analysisResult.reentryCode && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Reentry Code
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {analysisResult.reentryCode}
                    </p>
                  </div>
                )}
                {analysisResult.narrativeReason && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Narrative Reason
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                      {analysisResult.narrativeReason}
                    </p>
                  </div>
                )}
                {analysisResult.separationAuthority && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Separation Authority
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                      {analysisResult.separationAuthority}
                    </p>
                  </div>
                )}

                {/* Contact */}
                {analysisResult.homeAddress && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Home Address at Separation
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                      {analysisResult.homeAddress}
                    </p>
                  </div>
                )}

                {/* Qualifications */}
                {analysisResult.securityClearance && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Security Clearance
                    </p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {analysisResult.securityClearance}
                    </p>
                  </div>
                )}
                {analysisResult.specialQualifications &&
                  analysisResult.specialQualifications.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Special Qualifications
                      </p>
                      <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                        {analysisResult.specialQualifications.join(", ")}
                      </p>
                    </div>
                  )}
              </div>

              {/* Military Education */}
              {analysisResult.militaryEducation &&
                analysisResult.militaryEducation.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                      🎓 Military Education (
                      {analysisResult.militaryEducation.length})
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300\">
                      {analysisResult.militaryEducation.map((course, idx) => (
                        <li key={idx}>• {course}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Combat Service */}
              {analysisResult.combatService?.hasVerifiedCombat && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                  <h4 className="font-bold text-red-800 dark:text-red-200 flex items-center gap-2 mb-2">
                    ⚔️ {t("dd214Analyzer", "combatServiceVerified")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.combatService.indicators?.map(
                      (indicator, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-sm rounded-full"
                        >
                          {indicator}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Awards */}
              {analysisResult.awards && analysisResult.awards.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3">
                    🎖️ {t("dd214Analyzer", "awardsDecorations")} (
                    {analysisResult.awards.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {analysisResult.awards.map((award, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg text-sm ${
                          award.isCombat
                            ? "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800"
                            : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {award.isCombat && "⚔️ "}
                          {award.name}
                        </p>
                        {award.devices && award.devices.length > 0 && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {t("dd214Analyzer", "with")}{" "}
                            {award.devices.join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extraction Notes */}
              {analysisResult.extractionNotes &&
                analysisResult.extractionNotes.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200 text-sm mb-1">
                      📝 {t("dd214Analyzer", "notes")}
                    </h4>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                      {analysisResult.extractionNotes.map((note, idx) => (
                        <li key={idx}>• {note}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-col sm:flex-row items-center justify-end gap-4 rounded-b-2xl bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
          {/* Actions */}
          <div className="flex items-center gap-3">
            {hasInput && (
              <button
                onClick={handleClearAll}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
              >
                {t("dd214Analyzer", "clearAll")}
              </button>
            )}

            {analysisResult && (
              <button
                onClick={handleSaveResults}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                💾 {t("dd214Analyzer", "saveToProfile")}
              </button>
            )}

            <button
              onClick={handleAnalyzeWithAI}
              disabled={
                !hasInput ||
                !aiStatus.anyAvailable ||
                isGenerating ||
                isProcessing
              }
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t("dd214Analyzer", "analyzing")}
                </>
              ) : (
                <>🤖 {t("dd214Analyzer", "analyzeWithAi")}</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Profile Import Confirmation Modal - Rendered via portal to escape z-index stacking context */}
      {showProfileImportModal &&
        extractedProfileData &&
        createPortal(
          <ProfileImportConfirmModal
            extractedData={extractedProfileData}
            currentProfile={getVeteranProfile()}
            onConfirm={handleConfirmProfileImport}
            onCancel={handleCancelProfileImport}
          />,
          document.body,
        )}

      {/* DD214 Form Builder Modal */}
      {showFormBuilder && (
        <DD214FormBuilder
          onClose={() => setShowFormBuilder(false)}
          onSave={(dd214) => {
            console.log("DD214 saved:", dd214);
            // Optionally refresh the list or show success message
          }}
        />
      )}
    </div>
  );
};

/**
 * Component to display saved DD214s
 */
const SavedDD214List = () => {
  const [savedDD214s, setSavedDD214s] = useState([]);
  const { t } = useLanguage();

  useEffect(() => {
    const history = getServiceHistory();
    const dd214s = history.dd214s || [];
    setSavedDD214s(dd214s);
  }, []);

  if (savedDD214s.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <span>📚</span>
        <span>
          {t("dd214Analyzer", "savedDD214s")} ({savedDD214s.length})
        </span>
      </h4>
      <div className="space-y-2">
        {savedDD214s.map((dd214, index) => (
          <div
            key={dd214.id || index}
            className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">
                  {dd214.fullName || t("dd214Analyzer", "untitledDD214")}
                </p>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {dd214.branch && (
                    <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                      {dd214.branch}
                    </span>
                  )}
                  {dd214.separationDate && (
                    <span>
                      {t("dd214Analyzer", "sep")}{" "}
                      {new Date(dd214.separationDate).toLocaleDateString()}
                    </span>
                  )}
                  {dd214.characterOfService && (
                    <span>{dd214.characterOfService}</span>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-500">
                {dd214.source === "manual-entry"
                  ? `✏️ ${t("dd214Analyzer", "manual")}`
                  : `🤖 ${t("dd214Analyzer", "ai")}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DD214Analyzer;
