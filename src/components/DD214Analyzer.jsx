/**
 * Vet-Rate.org - DD214 Information Analyzer
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Intelligent DD214 analyzer with:
 * - Local OCR support for scanned PDFs
 * - Multi-DD214 cumulative logic (prevents double-counting awards)
 * - AI-powered extraction with diagnostic status
 * - Vision model support (direct image analysis, bypassing OCR)
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { createPortal } from "react-dom";
import ResponsiveModal from "./common/ResponsiveModal";
import HeaderCloseSlot from "./common/HeaderCloseSlot";
import {
  generateAI,
  getAIStatus,
  getDocumentAIRouting,
} from "../utils/unifiedAIService";
import {
  AI_DATA_CLASS,
  DocumentOffDeviceBlockedError,
  buildDocumentOffDeviceNotice,
} from "../utils/aiDataClassPolicy";
import { AIStatusBadge } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import SmartAILoadButton from "./SmartAILoadButton";
import ReportBugLink from "./ReportBugLink";
import {
  OCR_STATES,
  getProgressStyling,
  formatFileSize,
  isFileSupported,
  getAcceptString,
} from "../utils/documentAnalyzer";
import {
  processFormationDocument,
  persistFormationDocument,
  stripIdentifiersFromFormationResult,
  PROCESSING_STATES,
} from "../utils/musterCallProcessor";
import { smolVLMService, isSmolVLMSupported } from "../utils/smolVLMService";
import SystemRequirementsNotice from "./SystemRequirementsNotice";
import {
  saveDD214Data,
  getServiceHistory,
  addAward,
  getVeteranProfile,
  updateVeteranProfile,
  upsertServicePeriod,
  hasPeriodBackedServiceEntry,
  isKnownServiceEntryDate,
  recordServiceEntryDisagreement,
  setServiceEntryDate,
} from "../utils/veteranProfile";
import { parseExplicitDate } from "../utils/dateUtils";
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
import {
  buildPlaceholderDetector,
  sanitizeModelOutput,
  scrubModelFreeText,
  MODEL_TEXT_FIELDS,
} from "../utils/dd214ModelOutputGuards";
import { parseModelJsonReply } from "../utils/dd214JsonReply";

/**
 * System Prompt for Multi-Document Cumulative Analysis
 * Supports: DD214 (Active), NGB 22 (Guard), DD256/DD257 (Reserve)
 * Implements the "Master Record" protocol to prevent double-counting
 */
/**
 * Condensed System Prompt for Local Models (4K context)
 * Focus on essential JSON extraction - comprehensive DD214 coverage
 */
// Owner decision (F), 2026-10-01 (ADR-009): the model is never the source of
// an identifier field. Both prompts omit name/SSN/service number/DOB/home of
// record/address; they come only from dd214FieldExtractor when confident.
// This is a code comment, kept OUTSIDE the template literal below - unlike a
// comment placed inside the backtick string, this one is never sent to the
// model as prompt text.
export const DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL = `You are a DD214 military records analyst. Extract ALL available data as JSON.

COMPLETE DD214 FIELD LOCATIONS:
Block 2: Department/Component/Branch
Block 4a: Pay Grade (E-1 through E-9, W-1 through W-5, O-1 through O-10)
Block 4b: MOS/AFSC/Rating/Primary Specialty Code
Block 4c: Grade/Rank (PV1, PFC, SGT, SSG, CPT, MAJ, etc)
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

Do NOT output the veteran's name, SSN, service number, date of birth, place of birth, home of record, mailing address, phone, email, next of kin, nearest relative or any signature. Omit those fields entirely.

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
export const DD214_ANALYSIS_SYSTEM_PROMPT = `You are a military records analyst specializing in discharge document interpretation.

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
  
  // PERSONAL IDENTIFICATION (Blocks 1-7) - do NOT include name, SSN/
  // service number, date of birth, place of birth, or home-of-record; they
  // are filled in separately and must be omitted from this JSON entirely.

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

  // CONTACT (Block 30) - do NOT include home address either; see the
  // PERSONAL IDENTIFICATION note above. Omit it entirely from this JSON.

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

function _formatNetActiveService(analysisResult, t) {
  const nas = analysisResult.netActiveService;
  if (nas) return `${nas.years || 0}y ${nas.months || 0}m ${nas.days || 0}d`;
  if (analysisResult.yearsService) {
    return `${analysisResult.yearsService}y ${analysisResult.monthsService || 0}m ${analysisResult.daysService || 0}d`;
  }
  return t("dd214Analyzer", "na");
}

function _formatServiceDuration(service) {
  return `${service.years || 0}y ${service.months || 0}m ${service.days || 0}d`;
}

function _extractionMethodLabel(method, t) {
  if (method === "ocr") return `🔍 ${t("dd214Analyzer", "ocr")}`;
  if (method === "hybrid") return `🔍 ${t("dd214Analyzer", "hybrid")}`;
  return `📝 ${t("dd214Analyzer", "text")}`;
}

function _mapMusterCallStateToOcrState(state) {
  if (state === PROCESSING_STATES.EXTRACTING) return OCR_STATES.OCR_IN_PROGRESS;
  if (state === PROCESSING_STATES.COMPLETE) return OCR_STATES.COMPLETE;
  if (state === PROCESSING_STATES.ERROR) return OCR_STATES.ERROR;
  return OCR_STATES.LOADING;
}

/**
 * Validate and fix date string
 * Returns null if date is invalid
 */
function validateDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;

  // Try to parse the date
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr; // Return as-is if not in expected format

  const [, year, month, day] = match;
  const y = Number.parseInt(year, 10);
  const m = Number.parseInt(month, 10);
  const d = Number.parseInt(day, 10);

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
}

/**
 * Estimate token count for Llama 3.2 tokenizer
 * Real-world testing shows Llama 3.2 uses ~1.7-2.5 chars/token for mixed content
 * Using 2 chars/token as conservative estimate (errs on side of caution)
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 2);
}

/**
 * Truncate text to fit within token limit, preserving important sections
 */
function truncateForContext(text, maxTokens = 2000) {
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
}

export async function _runVisionAnalysis(originalPDFFiles, setOcrProgress) {
  // ========== VISION MODEL PATH - SmolVLM (transformers.js v3 + WebGPU) ==========
  // Processes PDF pages as images directly through SmolVLM-256M-Instruct.
  // Replaces the broken MLC WebLLM Phi-3.5-vision path.
  // eslint-disable-next-line no-console
  console.log("🖼️ Using SmolVLM Vision for direct image analysis");

  setOcrProgress({
    state: OCR_STATES.LOADING,
    progress: 0,
    message: "Initializing SmolVLM Vision engine...",
  });

  // Ensure model is loaded (cached after first load)
  const visionReady = await smolVLMService.initialize();
  if (!visionReady) {
    throw new Error(
      "SmolVLM failed to initialize. Falling back - please run OCR first.",
    );
  }

  // Process each PDF - up to 2 pages per file (DD214 is typically 1-2 pages)
  const visionPrompt =
    "Analyze this DD214 military discharge document and extract all information. " +
    "Return your analysis as JSON following the format specified in the system prompt.";

  const allPageTexts = [];
  for (let i = 0; i < originalPDFFiles.length; i++) {
    const pdfFile = originalPDFFiles[i];
    setOcrProgress({
      state: OCR_STATES.OCR_IN_PROGRESS,
      progress: 10 + (i / originalPDFFiles.length) * 60,
      message: `SmolVLM reading ${pdfFile.name}...`,
    });

    const result = await smolVLMService.processMultiplePages(pdfFile, {
      maxPages: 2,
      prompt: visionPrompt,
      onPageComplete: (pageNum, total) => {
        setOcrProgress({
          state: OCR_STATES.OCR_IN_PROGRESS,
          progress: 10 + ((i + pageNum / total) / originalPDFFiles.length) * 60,
          message: `SmolVLM: page ${pageNum}/${total} of ${pdfFile.name}...`,
        });
      },
    });
    allPageTexts.push(result.combinedText);
  }

  setOcrProgress(null);

  // SmolVLM already generated structured output - use it directly as response.
  // ADR-009 §4: SmolVLM runs entirely in-browser (transformers.js v3 +
  // WebGPU) - unconditionally on-device by construction. Every consumer
  // treats a response missing this flag as off-device (fail closed), so a
  // genuinely on-device vision read must say so explicitly.
  return {
    content: allPageTexts.join("\n\n---\n\n"),
    isVisionResponse: true,
    onDevice: true,
  };
}

export async function _runTextAnalysis(combinedText, setError) {
  // ========== TEXT MODEL PATH (original) ==========
  // Use OCR/text extraction then send to LLM
  // eslint-disable-next-line no-console
  console.log("📝 Using Text Model for OCR-based analysis");

  // Determine if we're using local or cloud AI
  // Local models have tight context limits (4096), cloud has much more
  const localContextLimit = 4096;
  // ADR-009: a document call ALWAYS dispatches on-device when any on-device
  // engine is ready - `getDocumentAIRouting().onDeviceReady` is the real
  // answer, not `aiStatus.localAvailable && !aiStatus.cloudAvailable`. That
  // old check treated ANY configured cloud key as "not local-only", so a
  // veteran with both a Gemini key AND Warrant Council loaded got the full
  // cloud-sized prompt/no truncation for a call that ADR-009 forces
  // on-device anyway - the same silent-truncation-then-mislabeled-complete
  // failure as cfileAnalyzer's chunk sizing.
  const isLocalOnly = getDocumentAIRouting().onDeviceReady;

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

  // eslint-disable-next-line no-console
  console.log(
    `📊 Token estimates: system=${systemPromptTokens}, doc=${documentTokens}, wrapper=${userPromptWrapper}, output=${outputBuffer}`,
  );

  const totalEstimatedTokens =
    systemPromptTokens + documentTokens + userPromptWrapper + outputBuffer;

  const needsTruncation =
    totalEstimatedTokens > localContextLimit && isLocalOnly;

  let documentText = combinedText;

  if (needsTruncation) {
    console.warn(
      `⚠️ Document too large (${totalEstimatedTokens} tokens estimated). Truncating for local AI...`,
    );
    // Calculate safe document size:
    // Available = Context - System - Wrapper - Output
    const availableForDoc =
      localContextLimit - systemPromptTokens - userPromptWrapper - outputBuffer;
    // Ensure minimum reasonable size (at least 500 tokens for useful extraction)
    const maxDocTokens = Math.max(500, availableForDoc);
    documentText = truncateForContext(combinedText, maxDocTokens);
    // eslint-disable-next-line no-console
    console.log(
      `📄 Truncated to ~${estimateTokens(documentText)} tokens (max allowed: ${maxDocTokens})`,
    );
    setError(null); // Clear any previous errors
  }

  // Call the unified AI service - system prompt goes in options, NOT in main message
  // ADR-009: "document" - DD214 text stays on-device only, so there is no
  // cloud-sized alternative to prefer (preferCloud removed - see isLocalOnly
  // above).
  return generateAI(
    `Analyze this DD214 document and extract the information as JSON:\n\n${documentText}`,
    {
      dataClass: AI_DATA_CLASS.DOCUMENT,
      temperature: 0.2, // Lower temperature for more consistent JSON output
      maxTokens: outputBuffer, // Use calculated output buffer based on context size
      expectJSON: true,
      systemPrompt: systemPrompt,
      skipHallucinationCheck: true, // DD214 JSON doesn't contain diagnostic codes
    },
  );
}

export function _extractResponseContent(response) {
  // Extract text from response
  // Handle direct string responses, {text, mode} objects from generateAI,
  // AND {content, isVisionResponse} objects from _runVisionAnalysis - a
  // vision-path response was never covered here, so it always fell through
  // to content="" below and reported "Vision model returned empty
  // response" even when SmolVLM returned real text.
  let content;
  if (typeof response === "string") {
    content = response;
  } else if (response && typeof response.text === "string") {
    content = response.text;
  } else if (response && typeof response.content === "string") {
    content = response.content;
  } else {
    content = "";
  }

  // Check for empty response - vision models may return empty if image processing failed
  if (!content || content.trim().length === 0) {
    if (response?.isVisionResponse) {
      throw new Error(
        "Vision model returned empty response. The model may have had trouble processing the image. Try: 1) Using a clearer scan, 2) Switching to text-based analysis, or 3) Reloading the AI model.",
      );
    }
    throw new Error("No response received from AI. Please try again.");
  }
  return content;
}

// Model output never reaches the console: bugReportUtils' interceptor
// captures console output into bug reports a veteran can copy or send
// off-device, so diagnostics here report shape/length only. Identifier fields
// a model returns anyway are dropped at parse time (owner decision F).
export function _parseDd214Json(content, t) {
  // Parse JSON from response
  let data;
  try {
    data = parseModelJsonReply(content);

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
    _stripModelIdentifiers(data);
    _keepModelSchemaFields(data);
    _placeholderDetector.rejectPlaceholderEchoes(data);
    sanitizeModelOutput(data, [getVeteranProfile()]);
  } catch {
    // V8's JSON.parse message quotes a snippet of the input, so it is never
    // logged - only the length.
    console.error(
      "JSON parse error. Content length:",
      typeof content === "string" ? content.length : 0,
    );
    throw new Error(t("dd214Analyzer", "parseError"));
  }
  return data;
}

// Owner decision (F), 2026-10-01 (ADR-009): the AI is NEVER the source of an
// identifier field. Three evaluation rounds showed the on-device model
// invents these values (on the owner's 5 scans it filled 14 of 25 identifier
// fields and 10 were wrong, some appearing nowhere in the document). A value
// shown or saved for any of these comes only from dd214FieldExtractor when it
// is confident; otherwise the field is empty for the veteran to type. `homeAddress`
// is bridged from the extractor's own `mailingAddress` field (Block 19 on the
// layouts it targets; Block 30 in the AI schema's numbering).
export const IDENTIFIER_FIELDS = [
  "fullName",
  "lastName",
  "firstName",
  "middleName",
  "ssnLast4",
  "dateOfBirth",
  "homeOfRecord",
  "homeAddress",
];

// Alternate key names a model might emit for the same identifiers despite
// the prompt omitting them. No local-parser counterpart exists for these.
const IDENTIFIER_ALIAS_KEYS = [
  "name",
  "ssn",
  "ssnFull",
  "serviceNumber",
  "dob",
  "mailingAddress",
];

function _hasValue(val) {
  return val !== undefined && val !== null && val !== "";
}

export function _stripModelIdentifiers(data) {
  [...IDENTIFIER_FIELDS, ...IDENTIFIER_ALIAS_KEYS].forEach((key) => {
    if (key in data) delete data[key];
  });
  return data;
}

const _placeholderDetector = buildPlaceholderDetector([
  DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL,
  DD214_ANALYSIS_SYSTEM_PROMPT,
]);

// An allowlist, not a denylist: a model that files a name or SSN under a key
// the schema never asked for ("SSN", "veteranName", a nested "personal"
// object) must not reach the saved record. Only the keys the two prompts
// request survive, and their values are never re-read as identifiers.
export const MODEL_SCHEMA_KEYS = new Set([
  "documentCount",
  "documentTypes",
  "masterRecordDate",
  "masterRecordType",
  "component",
  "componentFull",
  "branch",
  "rank",
  "payGrade",
  "dateOfRank",
  "mos",
  "mosTitle",
  "lastDutyAssignment",
  "commandTransferredTo",
  "sglCoverage",
  "entryDate",
  "separationDate",
  "netActiveService",
  "totalPriorActiveService",
  "totalPriorInactiveService",
  "yearsService",
  "monthsService",
  "daysService",
  "reserveObligationDate",
  "daysLost",
  "foreignService",
  "foreignServiceDetails",
  "seaService",
  "militaryEducation",
  "separationAuthority",
  "separationCode",
  "separationProgramDesignator",
  "reentryCode",
  "separationType",
  "characterOfService",
  "narrativeReason",
  "giBlStatus",
  "memberRequests",
  "awards",
  "combatService",
  "specialQualifications",
  "securityClearance",
  "reenlisted",
  "dd214Count",
  "extractionNotes",
]);

export function _keepModelSchemaFields(data) {
  Object.keys(data).forEach((key) => {
    if (!MODEL_SCHEMA_KEYS.has(key)) delete data[key];
  });
  return data;
}

function _applyIdentifierFieldsFromLocalParser(data, regexFields) {
  _stripModelIdentifiers(data);
  IDENTIFIER_FIELDS.forEach((key) => {
    const value =
      key === "homeAddress" ? regexFields?.mailingAddress : regexFields?.[key];
    data[key] = _hasValue(value) ? value : "";
  });
}

function _extractRegexFields(combinedRawText) {
  try {
    return extractDD214Fields(combinedRawText);
  } catch (extractErr) {
    console.warn(
      "Regex field extraction failed (non-fatal):",
      extractErr.message,
    );
    return null;
  }
}

function _mergeRegexIntoData(data, regexResult) {
  if (!regexResult) return null;
  try {
    if (Object.keys(regexResult).length > 0) {
      const merged = mergeAIAndRegexResults(data, regexResult);
      Object.assign(data, merged);
    }
  } catch (mergeErr) {
    console.warn("Regex/AI merge failed (non-fatal):", mergeErr.message);
    // AI-only results are still valid - identifier precedence below still
    // runs regardless, so this doesn't leave an off-device identifier
    // displayed.
  }
  return regexResult;
}

function _regexIdentifierSource(regexFields) {
  if (!regexFields) return null;
  return { ...regexFields, homeAddress: regexFields.mailingAddress };
}

export function _applyRegexSafetyNet(data, combinedRawText, setAnalysisResult) {
  const regexResult = _extractRegexFields(combinedRawText);
  // The model's own values are sanitized BEFORE the merge, with the name the
  // local parser read as a known value, so a name the model wrote under any
  // key is redacted while the parser's own values stay untouched.
  _keepModelSchemaFields(data);
  sanitizeModelOutput(data, [
    getVeteranProfile(),
    _regexIdentifierSource(regexResult?.fields),
  ]);
  _mergeRegexIntoData(data, regexResult);

  // Runs unconditionally (fail-closed), regardless of whether extraction or
  // merge above threw or found nothing.
  _applyIdentifierFieldsFromLocalParser(data, regexResult?.fields);
  scrubModelFreeText(data, [getVeteranProfile(), data]);

  setAnalysisResult({ ...data });
}

// The same label _saveDd214ToVkb uses to identify this analysis, so
// setServiceEntryDate's sourceDocument targeting and upsertServicePeriod's
// own identity both agree with whatever addDocumentToVKB filed this under.
function _dd214SourceFileName(extractedTexts) {
  return extractedTexts.length > 0
    ? extractedTexts.map((et) => et.filename).join(", ")
    : "Pasted DD214 Text";
}

// DR-3 (accepted): a single DD214 with both printed dates gets a real
// canonical period, not just the legacy flat/dd214Data fields - so a
// veteran who only ever uses DD214Analyzer still has a Service card
// period. Confidence 0.5 matches migrationManager.js's own trust tier for
// this source; it is only ever compared against a RE-analysis of this
// same file (upsertServicePeriod's own identity match).
function _upsertDd214CanonicalPeriod(analysisResult, sourceFileName) {
  return upsertServicePeriod(
    {
      serviceStartDate: parseExplicitDate(analysisResult.entryDate),
      serviceEndDate: parseExplicitDate(analysisResult.separationDate),
      serviceStartDateDerived: false,
      formType: "DD214",
      branch: analysisResult.branch,
      component: analysisResult.component,
      rank: analysisResult.rank,
      payGrade: analysisResult.payGrade,
      mos: analysisResult.mos,
      mosTitle: analysisResult.mosTitle,
      characterOfService: analysisResult.characterOfService,
      separationType: analysisResult.separationType,
    },
    { sourceDocument: sourceFileName, confidence: 0.5 },
  );
}

function _saveDd214EntryDate(analysisResult, sourceFileName) {
  // dd214Count is stripped by saveDD214Data's own sanitizer - analysisResult
  // is the only reliable source for "how many DD214s did this analysis
  // cover".
  const eligible =
    (analysisResult.dd214Count ?? 1) <= 1 &&
    !!parseExplicitDate(analysisResult.entryDate) &&
    !!parseExplicitDate(analysisResult.separationDate);
  if (eligible) {
    return _upsertDd214CanonicalPeriod(analysisResult, sourceFileName);
  }
  if (
    hasPeriodBackedServiceEntry() &&
    analysisResult.entryDate &&
    !isKnownServiceEntryDate(analysisResult.entryDate)
  ) {
    recordServiceEntryDisagreement(
      analysisResult.entryDate,
      "DD-214 analysis (multiple DD-214s)",
    );
  }
  return null;
}

function _saveDd214Awards(awards) {
  // FIX-4: `award.devices?.join(", ")` produced "[object Object]" garbage
  // whenever devices were already structured {type, position} objects,
  // and - critically - never passed devices through to addAward's
  // `devices` key at all, so they could never reach VisualRibbon. Pass
  // devices through as structured data; addAward's sanitizer accepts
  // {type, position} objects and safely drops anything else (e.g. a
  // plain display-name string from a different extractor).
  if (!awards || !Array.isArray(awards)) return;
  awards.forEach((award) => {
    const deviceLabels = (award.devices || [])
      .map((d) => (typeof d === "string" ? d : d?.type || ""))
      .filter(Boolean);
    addAward({
      name: award.name,
      abbreviation: award.abbreviation,
      dateReceived: null,
      notes:
        deviceLabels.length > 0 ? `Devices: ${deviceLabels.join(", ")}` : "",
      devices: award.devices || [],
      isCombat: award.isCombat || false,
      sourceDD214: award.sourceDD214,
    });
  });
}

export function _saveDd214ToProfile(
  analysisResult,
  combinedText,
  selectedFields,
  meta = {},
  extractedTexts = [],
) {
  const sourceFileName = _dd214SourceFileName(extractedTexts);
  const periodId = _saveDd214EntryDate(analysisResult, sourceFileName);

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
    extractedText: combinedText.substring(0, 10000),
    dd214Count: analysisResult.dd214Count,
    combatService: analysisResult.combatService,
    specialQualifications: analysisResult.specialQualifications,
  });

  _saveDd214Awards(analysisResult.awards);

  if (meta.serviceStartDateEdited) {
    setServiceEntryDate({
      date: selectedFields.serviceStartDate,
      via: "dd214_import",
      ...(periodId ? { periodId } : { noPeriod: true }),
    });
  }

  // Update veteran profile with selected fields only
  if (selectedFields && Object.keys(selectedFields).length > 0) {
    const fieldsToSave = { ...selectedFields };
    if (
      !periodId &&
      !meta.serviceStartDateEdited &&
      fieldsToSave.serviceStartDate
    ) {
      fieldsToSave.profileFieldSources = {
        ...(getVeteranProfile().profileFieldSources || {}),
        serviceStartDate: "document",
      };
    }
    updateVeteranProfile(fieldsToSave);
  }
}

// Owner decision (F): identifiers reach the Knowledge Base only when the
// veteran ticked the matching import box.
function _selectedVkbIdentifiers(analysisResult, selectedFields = {}) {
  const picked = (key) => _hasValue(selectedFields[key]);
  const nameSelected =
    picked("fullName") || picked("lastName") || picked("firstName");
  const fullName =
    analysisResult.fullName ||
    `${analysisResult.lastName || ""}, ${analysisResult.firstName || ""}`.replace(
      /^, |, $/g,
      "",
    );
  return {
    fullName: nameSelected ? fullName : undefined,
    name: nameSelected ? fullName : undefined,
    ssn: picked("ssnLast4") ? analysisResult.ssnLast4 : undefined,
    ssnLast4: picked("ssnLast4") ? analysisResult.ssnLast4 : undefined,
    dateOfBirth: picked("dateOfBirth") ? analysisResult.dateOfBirth : undefined,
    mailingAddress: picked("homeAddress") ? analysisResult.homeAddress : null,
  };
}

export async function _saveDd214ToVkb(
  analysisResult,
  combinedText,
  extractedTexts,
  selectedFields,
) {
  // This makes ALL extracted DD214 data available to every AI tool
  try {
    // Build comprehensive data object for VKB merge
    const vkbData = {
      ..._selectedVkbIdentifiers(analysisResult, selectedFields),
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
      narrativeReason: _hasValue(selectedFields?.narrativeReason)
        ? analysisResult.narrativeReason
        : undefined,
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
    };

    // Determine filename for tracking
    const sourceFileName =
      extractedTexts.length > 0
        ? extractedTexts.map((et) => et.filename).join(", ")
        : "Pasted DD214 Text";

    // FIX-6: register the document FIRST so mergeDD214IntoVKB below can
    // enrich that same doc_ entry (matched via vkbDocumentId) instead of
    // pushing a second dd214-... record for the same file.
    const docResult = await addDocumentToVKB({
      fileName: sourceFileName,
      classification: "DD214",
      fileSize: combinedText.length,
      pageCount:
        extractedTexts.reduce((sum, et) => sum + (et.pageCount || 1), 0) || 1,
      extractedText: combinedText.substring(0, 50000),
      extractedData: vkbData,
      ocrUsed: extractedTexts.some((et) => et.ocrUsed),
      method: extractedTexts[0]?.method || "paste",
    });

    const vkb = await loadVKB();
    mergeDD214IntoVKB(vkb, vkbData, {
      fileName: sourceFileName,
      vkbDocumentId: docResult.documentId,
    });
    await saveVKB(vkb);
    // eslint-disable-next-line no-console
    console.log("✅ DD214 data merged into VKB");
  } catch (vkbErr) {
    console.error("VKB save failed (non-fatal):", vkbErr);
    // Don't block the save - profile data is still saved
  }
}

// The structured copy filed with the archived document carries an identifier
// or model-written text only when the veteran ticked its import box.
const UNCONFIRMED_UNLESS_TICKED = [
  ...IDENTIFIER_FIELDS,
  ...MODEL_TEXT_FIELDS,
  "placeOfBirth",
];

function _confirmedFieldsOnly(analysisResult, selectedFields = {}) {
  const confirmed = { ...analysisResult };
  UNCONFIRMED_UNLESS_TICKED.forEach((key) => {
    if (!_hasValue(selectedFields[key])) delete confirmed[key];
  });
  return confirmed;
}

export async function _saveDd214ToPacket(
  rawAnalysisResult,
  combinedText,
  extractedTexts,
  selectedFields,
) {
  const analysisResult = _confirmedFieldsOnly(
    rawAnalysisResult,
    selectedFields,
  );
  // This stores the full document text + structured data forever
  try {
    const sourceFileName =
      extractedTexts.length > 0
        ? extractedTexts.map((et) => et.filename).join(", ")
        : "Pasted DD214 Text";

    const packetResult = await saveDocumentToPacket({
      fileName: sourceFileName,
      classification: PACKET_DOC_TYPES.DD214,
      rawText: combinedText,
      extractedData: analysisResult,
      pageCount:
        extractedTexts.reduce((sum, et) => sum + (et.pageCount || 1), 0) || 1,
      fileSize: new Blob([combinedText]).size,
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
      // eslint-disable-next-line no-console
      console.log("📁 DD214 saved to My Packet:", packetResult.documentId);
    }
  } catch (packetErr) {
    console.error("My Packet save failed (non-fatal):", packetErr);
  }
}

function DD214ModalFooter({
  hasInput,
  handleClearAll,
  analysisResult,
  handleSaveResults,
  handleAnalyzeWithAI,
  aiStatus,
  isGenerating,
  isProcessing,
  t,
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
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
            !hasInput || !aiStatus.anyAvailable || isGenerating || isProcessing
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
  );
}

function DD214ModalHeader({ t, onReportBug, onClose, onOpenAISettings }) {
  return (
    <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-4 rounded-t-2xl flex-shrink-0">
      <HeaderCloseSlot
        close={
          <button
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
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
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-3xl shrink-0">📜</span>
          <div className="min-w-0">
            <h2
              id="dd214-analyzer-title"
              className="text-xl font-bold text-white"
            >
              {t("dd214Analyzer", "title")}{" "}
              <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
                {t("dd214Analyzer", "beta")}
              </span>
            </h2>
            <p className="text-sm text-blue-200">
              {t("dd214Analyzer", "subtitle")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LLMRecommendationBadge toolId="dd214-analyzer" />
          <AIStatusBadge onClick={onOpenAISettings} />
          {onReportBug && (
            <ReportBugLink
              onClick={onReportBug}
              variant="light"
              moduleName="DD214 Analyzer"
            />
          )}
        </div>
      </HeaderCloseSlot>
    </div>
  );
}

function DD214GuidanceAndPrivacyBanners({ onOpenMusterCall, aiStatus, t }) {
  return (
    <>
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
                <strong>Use this tool for:</strong> Single DD214 deep analysis
                with AI extraction
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
                  Look for &quot;Muster Call&quot; in the Missions menu for
                  batch document processing
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
    </>
  );
}

function DD214SmartAiLoadSection({ aiStatus, setAIStatus }) {
  if (aiStatus.anyAvailable) return null;
  return (
    <div className="mb-4">
      <SmartAILoadButton
        toolId="dd214-analyzer"
        onLoadComplete={(model) => {
          // eslint-disable-next-line no-console
          console.log("Smart AI loaded for DD214 Analyzer:", model?.name);
          setAIStatus(getAIStatus());
        }}
      />
    </div>
  );
}

function DD214InputMethodTabs({
  inputMethod,
  setInputMethod,
  extractedTexts,
  t,
}) {
  return (
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
          aria-label="Copy text from a digital DD214 and paste it here"
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
          aria-label="Upload PDF or image files - we'll extract the text for you"
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
          aria-label="Fill out a guided form if you don't have a digital copy"
        >
          ✏️ {t("dd214Analyzer", "manualEntry")}
        </button>
      </div>
    </div>
  );
}

function DD214PasteInput({ pastedText, setPastedText, t }) {
  return (
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
  );
}

function DD214ManualEntry({ t, setShowFormBuilder }) {
  return (
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
  );
}

function DD214UploadInput({
  fileInputRef,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  isDragging,
  handleFileChange,
  ocrProgress,
  t,
}) {
  return (
    <div className="space-y-4">
      {/* System requirements notice */}
      <SystemRequirementsNotice compact toolName="DD214 Analyzer" />
      {/* Drop Zone */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
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
  );
}

function DD214FileRow({ file, idx, extractedTexts, handleRemoveFile, t }) {
  const isProcessed = extractedTexts.some((et) => et.filename === file.name);
  const processedData = extractedTexts.find((et) => et.filename === file.name);

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
        <span className="text-2xl">{isProcessed ? "✅" : "📄"}</span>
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {file.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatFileSize(file.size)}
            {isProcessed && processedData && (
              <span className="ml-2 text-green-600 dark:text-green-400">
                • {processedData.pageCount} {t("dd214Analyzer", "pages")} •{" "}
                {_extractionMethodLabel(processedData.method, t)}
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
}

function DD214LoadedFilesList({
  droppedFiles,
  originalPDFFiles,
  extractedTexts,
  runOCROnFiles,
  isProcessing,
  handleRemoveFile,
  t,
}) {
  if (droppedFiles.length === 0 && originalPDFFiles.length === 0) return null;

  const files = droppedFiles.length > 0 ? droppedFiles : originalPDFFiles;
  const hasUnprocessed = files.some(
    (f) => !extractedTexts.some((et) => et.filename === f.name),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-700 dark:text-gray-300">
          📁 {t("dd214Analyzer", "loadedFiles")} (
          {Math.max(droppedFiles.length, originalPDFFiles.length)})
        </h4>
        {/* OCR Button - only show if there are unprocessed files */}
        {hasUnprocessed && (
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
      {files.map((file, idx) => (
        <DD214FileRow
          key={file.name}
          file={file}
          idx={idx}
          extractedTexts={extractedTexts}
          handleRemoveFile={handleRemoveFile}
          t={t}
        />
      ))}

      {/* OCR Status - shown when files are loaded */}
      {!extractedTexts.length && !isProcessing && (
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
  );
}

function DD214ErrorBanner({ error, t }) {
  if (!error) return null;
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div>
          <h3 className="font-semibold text-red-800 dark:text-red-200">
            {t("dd214Analyzer", "error")}
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    </div>
  );
}

// ADR-009: shown when only an off-device AI was configured, so the local
// regex parser ran instead of sending the DD214 text off-device.
function DD214OffDeviceNotice({ notice }) {
  if (!notice) return null;
  return (
    <div
      className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4"
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">
          🔒
        </span>
        <p className="text-sm text-amber-700 dark:text-amber-300">{notice}</p>
      </div>
    </div>
  );
}

function DD214ResultsSummaryHeader({ analysisResult, importSaved, t }) {
  return (
    <div className="space-y-1">
      <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
        ✅ {t("dd214Analyzer", "analysisComplete")}
        {analysisResult.dd214Count > 1 && (
          <span className="text-xs bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded-full">
            {analysisResult.dd214Count}{" "}
            {t("dd214Analyzer", "dd214sConsolidated")}
          </span>
        )}
      </h3>
      <p className="text-sm text-blue-700 dark:text-blue-300">
        {t(
          "dd214Analyzer",
          importSaved ? "importSavedNote" : "nothingSavedYet",
        )}
      </p>
    </div>
  );
}

// Owner decision (F): an identifier field shows the local parser's confident
// value or nothing. When empty it is a text box so the veteran can type it in;
// whatever the veteran types is stored on the result and always wins.
function DD214IdentifierCard({
  field,
  label,
  placeholder,
  value,
  onChange,
  wide,
}) {
  const inputId = `dd214-identifier-${field}`;
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg p-3 ${wide ? "col-span-2" : ""}`}
    >
      <label
        htmlFor={inputId}
        className="text-xs text-gray-500 dark:text-gray-400 block"
      >
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(field, e.target.value)}
        className="w-full min-w-0 font-bold text-gray-900 dark:text-gray-100 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 placeholder:font-normal placeholder:text-gray-400 min-h-[44px]"
      />
      {!value && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Not read from the document. Type it in if you want it saved.
        </p>
      )}
    </div>
  );
}

function DD214PersonalIdCards({ analysisResult, onIdentifierChange }) {
  return (
    <>
      {/* Personal Identification */}
      <DD214IdentifierCard
        field="fullName"
        label="Full Name"
        placeholder="Last, First Middle"
        value={analysisResult.fullName}
        onChange={onIdentifierChange}
      />
      <DD214IdentifierCard
        field="dateOfBirth"
        label="Date of Birth"
        placeholder="YYYY-MM-DD"
        value={analysisResult.dateOfBirth}
        onChange={onIdentifierChange}
      />
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
      <DD214IdentifierCard
        field="homeOfRecord"
        label="Home of Record"
        placeholder="City, State"
        value={analysisResult.homeOfRecord}
        onChange={onIdentifierChange}
      />
    </>
  );
}

function DD214RankComponentCards({ analysisResult, t }) {
  return (
    <>
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
        <p className="text-xs text-gray-500 dark:text-gray-400">Component</p>
        <p className="font-bold text-gray-900 dark:text-gray-100">
          {analysisResult.componentFull ||
            analysisResult.component ||
            t("dd214Analyzer", "na")}
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Rank</p>
        <p className="font-bold text-gray-900 dark:text-gray-100">
          {analysisResult.rank || t("dd214Analyzer", "na")}
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Pay Grade</p>
        <p className="font-bold text-gray-900 dark:text-gray-100">
          {analysisResult.payGrade || t("dd214Analyzer", "na")}
        </p>
      </div>
    </>
  );
}

function DD214MosAssignmentCards({ analysisResult, t }) {
  return (
    <>
      {/* MOS & Assignments */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("dd214Analyzer", "mos")}
        </p>
        <p className="font-bold text-gray-900 dark:text-gray-100">
          {typeof analysisResult.mos === "object"
            ? analysisResult.mos?.code || JSON.stringify(analysisResult.mos)
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
    </>
  );
}

function DD214ServiceDateCards({ analysisResult, t }) {
  return (
    <>
      {/* Service Dates */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Entry Date</p>
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
          {_formatNetActiveService(analysisResult, t)}
        </p>
      </div>
      <DD214PriorServiceCards analysisResult={analysisResult} />
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
    </>
  );
}

function DD214PriorServiceCards({ analysisResult }) {
  return (
    <>
      {analysisResult.totalPriorActiveService &&
        (analysisResult.totalPriorActiveService.years > 0 ||
          analysisResult.totalPriorActiveService.months > 0 ||
          analysisResult.totalPriorActiveService.days > 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Prior Active Service
            </p>
            <p className="font-bold text-gray-900 dark:text-gray-100">
              {_formatServiceDuration(analysisResult.totalPriorActiveService)}
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
              {_formatServiceDuration(analysisResult.totalPriorInactiveService)}
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
              {_formatServiceDuration(analysisResult.seaService)}
            </p>
          </div>
        )}
    </>
  );
}

function DD214BenefitsCards({ analysisResult }) {
  return (
    <>
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
          <p className="text-xs text-gray-500 dark:text-gray-400">Days Lost</p>
          <p className="font-bold text-gray-900 dark:text-gray-100">
            {analysisResult.daysLost}
          </p>
        </div>
      )}
    </>
  );
}

function DD214SeparationCards({ analysisResult, t }) {
  return (
    <>
      {/* Separation Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Character of Service
        </p>
        <p className="font-bold text-gray-900 dark:text-gray-100">
          {analysisResult.characterOfService || t("dd214Analyzer", "na")}
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
    </>
  );
}

function DD214ContactQualCards({ analysisResult, onIdentifierChange }) {
  return (
    <>
      {/* Contact */}
      <DD214IdentifierCard
        field="homeAddress"
        label="Home Address at Separation"
        placeholder="Street, City, State ZIP"
        value={analysisResult.homeAddress}
        onChange={onIdentifierChange}
        wide
      />

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
    </>
  );
}

function DD214EducationSection({ analysisResult }) {
  if (
    !analysisResult.militaryEducation ||
    analysisResult.militaryEducation.length === 0
  ) {
    return null;
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
        🎓 Military Education ({analysisResult.militaryEducation.length})
      </h4>
      <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
        {analysisResult.militaryEducation.map((course) => (
          <li key={course}>• {course}</li>
        ))}
      </ul>
    </div>
  );
}

function DD214CombatServiceSection({ analysisResult, t }) {
  if (!analysisResult.combatService?.hasVerifiedCombat) return null;
  return (
    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
      <h4 className="font-bold text-red-800 dark:text-red-200 flex items-center gap-2 mb-2">
        ⚔️ {t("dd214Analyzer", "combatServiceVerified")}
      </h4>
      <div className="flex flex-wrap gap-2">
        {analysisResult.combatService.indicators?.map((indicator) => (
          <span
            key={indicator}
            className="px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-sm rounded-full"
          >
            {indicator}
          </span>
        ))}
      </div>
    </div>
  );
}

function DD214AwardsSection({ analysisResult, t }) {
  if (!analysisResult.awards || analysisResult.awards.length === 0) return null;
  return (
    <div>
      <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3">
        🎖️ {t("dd214Analyzer", "awardsDecorations")} (
        {analysisResult.awards.length})
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
        {analysisResult.awards.map((award) => (
          <div
            key={award.name}
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
                {t("dd214Analyzer", "with")} {award.devices.join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DD214ExtractionNotesSection({ analysisResult, t }) {
  if (
    !analysisResult.extractionNotes ||
    analysisResult.extractionNotes.length === 0
  ) {
    return null;
  }
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
      <h4 className="font-medium text-yellow-800 dark:text-yellow-200 text-sm mb-1">
        📝 {t("dd214Analyzer", "notes")}
      </h4>
      <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
        {analysisResult.extractionNotes.map((note) => (
          <li key={note}>• {note}</li>
        ))}
      </ul>
    </div>
  );
}

function DD214AnalysisResultsPanel({
  analysisResult,
  importSaved,
  onIdentifierChange,
  t,
}) {
  if (!analysisResult) return null;
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 space-y-6">
      <DD214ResultsSummaryHeader
        analysisResult={analysisResult}
        importSaved={importSaved}
        t={t}
      />

      {/* Service Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <DD214PersonalIdCards
          analysisResult={analysisResult}
          onIdentifierChange={onIdentifierChange}
        />
        <DD214RankComponentCards analysisResult={analysisResult} t={t} />
        <DD214MosAssignmentCards analysisResult={analysisResult} t={t} />
        <DD214ServiceDateCards analysisResult={analysisResult} t={t} />
        <DD214BenefitsCards analysisResult={analysisResult} />
        <DD214SeparationCards analysisResult={analysisResult} t={t} />
        <DD214ContactQualCards
          analysisResult={analysisResult}
          onIdentifierChange={onIdentifierChange}
        />
      </div>

      <DD214EducationSection analysisResult={analysisResult} />
      <DD214CombatServiceSection analysisResult={analysisResult} t={t} />
      <DD214AwardsSection analysisResult={analysisResult} t={t} />
      <DD214ExtractionNotesSection analysisResult={analysisResult} t={t} />
    </div>
  );
}

function _processDroppedFiles(files, ctx) {
  const {
    droppedFiles,
    setDroppedFiles,
    setOriginalPDFFiles,
    fileInputRef,
    setError,
  } = ctx;

  if (files.length === 0) return;

  setError(null);

  // Store files in state
  const newDroppedFiles = [...droppedFiles, ...files];
  setDroppedFiles(newDroppedFiles);

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
  // eslint-disable-next-line no-console
  console.log("🔄 Auto-starting OCR for uploaded files...");

  // Small delay to ensure state is updated and UI shows the files
  setTimeout(async () => {
    await _runOcrOnFiles(files, ctx);
  }, 100);
}

async function _processSingleFileForOcr(file, ctx) {
  const { setOcrProgress, setExtractedTexts, setError } = ctx;

  if (!isFileSupported(file)) {
    return;
  }

  setOcrProgress({
    state: OCR_STATES.LOADING,
    progress: 0,
    message: `Processing ${file.name}...`,
  });

  try {
    // Route through MusterCall → Florence-2 vision first, Tesseract OCR fallback
    // deferPersist: reading a scan writes nothing to the profile or Knowledge
    // Base; the veteran confirms the import dialog first (see
    // _persistDeferredFormationResults).
    const musterResult = await processFormationDocument(
      file,
      (progress) => {
        // Map MusterCall progress → OCR progress bar state
        const mapped = {
          state: _mapMusterCallStateToOcrState(progress.state),
          progress: progress.progress || 0,
          message: progress.message || `Processing ${file.name}...`,
          currentPage: progress.currentPage,
          totalPages: progress.totalPages,
        };
        setOcrProgress(mapped);
      },
      { deferPersist: true },
    );
    const result = {
      text: musterResult.text || "",
      pageCount: musterResult.pageCount || 1,
      method: musterResult.method || "ocr",
      fileType: musterResult.fileType || "pdf",
      ocrUsed: musterResult.ocrUsed ?? true,
      ocrConfidence: musterResult.confidence || 0,
    };

    setExtractedTexts((prev) => [
      ...prev,
      {
        filename: file.name,
        text: result.text,
        pageCount: result.pageCount,
        method: result.method,
        fileType: result.fileType,
        ocrUsed: result.ocrUsed,
        deferredResult:
          musterResult.status === "complete" ? musterResult : null,
      },
    ]);
  } catch (err) {
    console.error("File processing error:", err);
    setError(`Failed to process ${file.name}: ${err.message}`);
  }
}

async function _runOcrOnFiles(filesToProcess, ctx) {
  const { extractedTexts, setIsProcessing, setError, setOcrProgress } = ctx;

  if (!filesToProcess || filesToProcess.length === 0) {
    // eslint-disable-next-line no-console
    console.log("📁 No files to process");
    return;
  }

  // Filter to only process files that haven't been processed yet
  const unprocessedFiles = filesToProcess.filter(
    (file) => !extractedTexts.some((et) => et.filename === file.name),
  );

  if (unprocessedFiles.length === 0) {
    // eslint-disable-next-line no-console
    console.log("📁 All files already processed");
    return;
  }

  setIsProcessing(true);
  setError(null);

  try {
    for (const file of unprocessedFiles) {
      await _processSingleFileForOcr(file, ctx);
    }
  } catch (err) {
    console.error("OCR batch processing error:", err);
    setError(`Processing failed: ${err.message}`);
  } finally {
    setIsProcessing(false);
    setOcrProgress(null);
  }
}

// Note: Use EITHER serviceStartDate OR entryDate, not both (they're duplicates)
// Same for serviceEndDate/separationDate
// serviceStartDate/serviceEndDate, not entryDate/separationDate:
// updateVeteranProfile's VALID_PROFILE_FIELDS whitelist only recognizes
// the former - entryDate/separationDate silently dropped on save, so a
// DD214Analyzer-only veteran's profile/dossier never got a service
// span at all ("? - ?").
function _buildRawProfileImportData(result) {
  return {
    // Personal Identification
    fullName: result.fullName,
    lastName: result.lastName,
    firstName: result.firstName,
    middleName: result.middleName,
    ssnLast4: result.ssnLast4,
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
    // ADR-007: serviceStartDateDerived is no longer part of this import
    // shape - the flat profile mirror's derived flag is owned entirely by
    // the projection now (saveVeteranProfile's chokepoint / saveServiceHistory).
    serviceStartDate: validateDate(result.entryDate),
    serviceEndDate: validateDate(result.separationDate),
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
}

// Filter out undefined/null values but keep empty strings for user to fill.
// Also keeps boolean false values (like reenlisted: false).
function _filterProfileImportData(rawProfileData) {
  return Object.fromEntries(
    Object.entries(rawProfileData).filter(([_key, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "boolean") return true;
      if (typeof value === "string" && value.trim() !== "") return true;
      if (typeof value === "number") return true;
      return false;
    }),
  );
}

export function _prepareAndShowProfileImport(
  result,
  setExtractedProfileData,
  setShowProfileImportModal,
) {
  if (!result) {
    console.warn("handleSaveResultsAfterAnalysis called with empty result");
    return;
  }

  try {
    const profileData = _filterProfileImportData(
      _buildRawProfileImportData(result),
    );

    // Only show modal if we have data to import
    if (Object.keys(profileData).length === 0) {
      console.warn("No profile data extracted from DD214");
      return;
    }

    // Show confirmation modal automatically
    setExtractedProfileData(profileData);
    setShowProfileImportModal(true);
  } catch (err) {
    console.error("Auto-save prep error:", err);
    // Don't show error, user can still click manual save button
  }
}

function _pickIdentifierFields(result) {
  return Object.fromEntries(IDENTIFIER_FIELDS.map((key) => [key, result[key]]));
}

export function _prepareManualProfileImport(
  analysisResult,
  setExtractedProfileData,
  setShowProfileImportModal,
  setError,
  t,
) {
  try {
    // Validate dates before using
    const validatedEntryDate = validateDate(analysisResult.entryDate);
    const validatedSeparationDate = validateDate(analysisResult.separationDate);

    // Prepare extracted profile data for review. serviceStartDate/
    // serviceEndDate, not entryDate/separationDate - see the same note in
    // _prepareAndShowProfileImport above (updateVeteranProfile's whitelist
    // silently drops the latter).
    const profileData = {
      branch: analysisResult.branch,
      mos: analysisResult.mos,
      mosTitle: analysisResult.mosTitle,
      serviceStartDate: validatedEntryDate,
      serviceEndDate: validatedSeparationDate,
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

    // Identifier values the veteran typed in (or the local parser read) are
    // offered for import; the modal never pre-selects them.
    Object.assign(
      filteredData,
      _filterProfileImportData(
        _pickIdentifierFields({
          ...analysisResult,
          dateOfBirth: validateDate(analysisResult.dateOfBirth),
        }),
      ),
    );

    // Show confirmation modal
    setExtractedProfileData(filteredData);
    setShowProfileImportModal(true);
  } catch (err) {
    console.error("Save error:", err);
    setError(t("dd214Analyzer", "prepareError"));
  }
}

/**
 * Main DD214 Analyzer Component
 */
function _getDd214CombinedText(pastedText, extractedTexts) {
  let combined = "";

  if (pastedText.trim()) {
    combined += `=== PASTED DD214 TEXT ===\n${pastedText.trim()}\n\n`;
  }

  extractedTexts.forEach((item, idx) => {
    combined += `=== DD214 DOCUMENT ${idx + 1}: ${item.filename} ===\n`;
    combined += `(File type: ${item.fileType || "PDF"}, Method: ${item.method}, Pages: ${item.pageCount})\n\n`;
    combined += item.text;
    combined += "\n\n";
  });

  return combined.trim();
}

function _buildDd214DropHandlers(state) {
  const {
    t,
    setIsDragging,
    droppedFiles,
    setDroppedFiles,
    setOriginalPDFFiles,
    fileInputRef,
    setError,
    extractedTexts,
    setIsProcessing,
    setOcrProgress,
    setExtractedTexts,
  } = state;

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

  const processFiles = async (files) => {
    _processDroppedFiles(files, {
      droppedFiles,
      setDroppedFiles,
      setOriginalPDFFiles,
      fileInputRef,
      setError,
      extractedTexts,
      setIsProcessing,
      setOcrProgress,
      setExtractedTexts,
    });
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      isFileSupported(f),
    );
    if (files.length === 0) {
      setError(t("dd214Analyzer", "unsupportedFormat"));
      return;
    }

    await processFiles(files);
  };

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    await processFiles(files);
  };

  return {
    handleDragOver,
    handleDragLeave,
    handleDrop,
    processFiles,
    handleFileChange,
  };
}

function _buildDd214FileListHandlers(state) {
  const {
    t,
    droppedFiles,
    setDroppedFiles,
    setOriginalPDFFiles,
    setError,
    extractedTexts,
    setIsProcessing,
    setOcrProgress,
    setExtractedTexts,
    originalPDFFiles,
    setPastedText,
    setAnalysisResult,
    setImportSaved,
  } = state;

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

    await _runOcrOnFiles(unprocessedFiles, {
      extractedTexts,
      setIsProcessing,
      setError,
      setOcrProgress,
      setExtractedTexts,
    });
  };

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

  const handleClearAll = () => {
    setPastedText("");
    setDroppedFiles([]);
    setExtractedTexts([]);
    setAnalysisResult(null);
    setImportSaved(false);
    setError(null);
  };

  return { runOCROnFiles, handleRemoveFile, handleClearAll };
}

function _buildDd214FileHandlers(state) {
  return {
    ..._buildDd214DropHandlers(state),
    ..._buildDd214FileListHandlers(state),
  };
}

// ADR-009: only an off-device AI is configured - DD214 text stays on-device
// only. Fall back to the same local regex parser used as the AI safety net
// (now standalone), show its result, and show the plain-language notice
// instead of a dead end.
function _handleDd214OffDeviceBlocked(err, state) {
  const {
    pastedText,
    extractedTexts,
    setOffDeviceNotice,
    setAnalysisResult,
    setExtractedProfileData,
    setShowProfileImportModal,
  } = state;

  setOffDeviceNotice(buildDocumentOffDeviceNotice(err.providerLabel));
  const localData = {};
  const rawText = _getDd214CombinedText(pastedText, extractedTexts);
  _applyRegexSafetyNet(localData, rawText, setAnalysisResult);
  setAnalysisResult({ ...localData });
  setTimeout(() => {
    _prepareAndShowProfileImport(
      localData,
      setExtractedProfileData,
      setShowProfileImportModal,
    );
  }, 500);
}

// Pulled out of handleAnalyzeWithAI purely to keep that function under the
// repo's max-lines-per-function limit - same two early-return guards, same
// behavior (including resetting isGenerating on either rejection).
function _dd214ReadyToAnalyze(ctx) {
  const {
    combinedText,
    useVisionAnalysis,
    hasPDFFiles,
    droppedFiles,
    aiStatus,
    t,
    setError,
    setIsGenerating,
  } = ctx;

  if (!combinedText && !useVisionAnalysis) {
    setError(
      hasPDFFiles || droppedFiles.length > 0
        ? t("dd214Analyzer", "runOcrFirst")
        : t("dd214Analyzer", "pasteOrDropFirst"),
    );
    setIsGenerating(false);
    return false;
  }

  if (!aiStatus.anyAvailable) {
    setError(t("dd214Analyzer", "aiNotAvailable"));
    setIsGenerating(false);
    return false;
  }

  return true;
}

// The AI-success path (parse, merge with the regex safety net, schedule the
// profile-import prompt) - pulled out of handleAnalyzeWithAI purely to keep
// that function under the repo's max-lines-per-function limit.
function _finishDd214Analysis(response, state) {
  const {
    t,
    pastedText,
    extractedTexts,
    setAnalysisResult,
    setExtractedProfileData,
    setShowProfileImportModal,
  } = state;

  const content = _extractResponseContent(response);
  const data = _parseDd214Json(content, t);
  setAnalysisResult(data);

  // ─── DIAMOND STANDARD: Regex Safety Net ───
  // Run the deterministic field extractor on the raw OCR text and merge
  // with AI results. If AI missed a field but regex found it, the regex
  // value fills the gap. If both have a value, AI wins for complex fields,
  // regex wins for structured fields like dates/MOS.
  // Identifier fields come only from the local parser (owner decision F).
  _applyRegexSafetyNet(
    data,
    _getDd214CombinedText(pastedText, extractedTexts),
    setAnalysisResult,
  );

  // Automatically trigger the save flow to show import confirmation - this
  // provides immediate feedback to the user.
  setTimeout(() => {
    _prepareAndShowProfileImport(
      data,
      setExtractedProfileData,
      setShowProfileImportModal,
    );
  }, 500);
}

function _buildDd214AnalysisHandlers(state) {
  const {
    t,
    pastedText,
    extractedTexts,
    originalPDFFiles,
    droppedFiles,
    isGenerating,
    setIsGenerating,
    aiStatus,
    setError,
    setAnalysisResult,
    setOcrProgress,
    setOffDeviceNotice,
    setImportSaved,
  } = state;

  /**
   * Main Analysis Handler - THE BUTTON
   * Supports two modes:
   * 1. Vision Model: Sends actual PDF page images directly to vision model (bypasses OCR)
   * 2. Text Model: Uses OCR/text extraction then sends to LLM
   */
  const handleAnalyzeWithAI = async () => {
    // Prevent double-clicks and React StrictMode double-firing
    if (isGenerating) {
      // eslint-disable-next-line no-console
      console.log("⚠️ Analysis already in progress, ignoring duplicate click");
      return;
    }

    // Immediately set generating to prevent race conditions
    setIsGenerating(true);

    const combinedText = _getDd214CombinedText(pastedText, extractedTexts);
    const hasPDFFiles = originalPDFFiles.length > 0;

    // Vision analysis: use SmolVLM-256M (transformers.js v3 + WebGPU) when:
    //   - WebGPU is available in this browser
    //   - User has PDF files loaded (needs images to analyze)
    //   - No text has been extracted yet (avoids double-processing)
    // NOTE: The original MLC WebLLM Phi-3.5-vision path is disabled - it crashes with
    //   "Cannot find parameter in cache: vision_embed_tokens..." (WebLLM v0.2.80 bug).
    //   SmolVLM replaces it via the same transformers.js v3 runtime used by Florence-2.
    const useVisionAnalysis =
      isSmolVLMSupported() && hasPDFFiles && !combinedText;

    // eslint-disable-next-line no-console
    console.log(
      `🔍 Analysis mode: ${useVisionAnalysis ? "VISION (direct image)" : "TEXT (OCR/extraction)"}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `   hasVisionModel: ${isSmolVLMSupported()}, hasPDFFiles: ${hasPDFFiles}, hasPastedText: ${!!pastedText.trim()}`,
    );

    // If no text has been extracted, prompt user to run OCR
    if (
      !_dd214ReadyToAnalyze({
        combinedText,
        useVisionAnalysis,
        hasPDFFiles,
        droppedFiles,
        aiStatus,
        t,
        setError,
        setIsGenerating,
      })
    ) {
      return;
    }

    setError(null);
    setOffDeviceNotice(null);
    setAnalysisResult(null);
    setImportSaved(false);

    try {
      const response = useVisionAnalysis
        ? await _runVisionAnalysis(originalPDFFiles, setOcrProgress)
        : await _runTextAnalysis(combinedText, setError);
      _finishDd214Analysis(response, state);
    } catch (err) {
      // ADR-009: only an off-device AI is configured - DD214 text stays
      // on-device only. Fall back to the same local regex parser used as
      // the AI safety net (now standalone), show its result, and show the
      // plain-language notice instead of a dead end.
      if (err instanceof DocumentOffDeviceBlockedError) {
        _handleDd214OffDeviceBlocked(err, state);
        return;
      }
      console.error("Analysis error:", err);
      setError(err.message || t("dd214Analyzer", "analysisFailed"));
    } finally {
      setIsGenerating(false);
    }
  };

  return { handleAnalyzeWithAI };
}

// Everything reading a scan found (service periods, awards, deployments, the
// archived document) is written only now, after the veteran confirmed the
// import dialog. Identifiers are never part of it, and neither are the flat
// profile fields (branch, dates, MOS, character of service): those reach the
// profile only through the boxes the veteran ticked, in the dialog's own
// values.
export async function _persistDeferredFormationResults(extractedTexts) {
  for (const item of extractedTexts) {
    if (!item.deferredResult) continue;
    const result = stripIdentifiersFromFormationResult(item.deferredResult);
    await persistFormationDocument(
      { name: result.filename, size: result.size },
      result,
    );
  }
}

function _buildDd214SaveHandlers(state) {
  const {
    t,
    analysisResult,
    pastedText,
    extractedTexts,
    onSaveResults,
    setExtractedProfileData,
    setShowProfileImportModal,
    setImportSaved,
    setError,
  } = state;

  /**
   * Save results to veteran profile - Shows confirmation modal first
   */
  const handleSaveResults = () => {
    if (!analysisResult) return;
    _prepareManualProfileImport(
      analysisResult,
      setExtractedProfileData,
      setShowProfileImportModal,
      setError,
      t,
    );
  };

  /**
   * Confirm and save profile data after user review
   * DIAMOND STANDARD: Saves to THREE places:
   *   1. Veteran Profile (localStorage) - for forms and calculator
   *   2. Veteran Knowledge Base (IndexedDB) - for AI tools
   *   3. My Packet (IndexedDB) - permanent document archive
   */
  const handleConfirmProfileImport = async (selectedFields, meta = {}) => {
    try {
      const combinedText = _getDd214CombinedText(pastedText, extractedTexts);

      await _persistDeferredFormationResults(extractedTexts);

      // ── 1. SAVE TO VETERAN PROFILE (existing behavior) ──
      _saveDd214ToProfile(
        analysisResult,
        combinedText,
        selectedFields,
        meta,
        extractedTexts,
      );

      // ── 2. SAVE TO VETERAN KNOWLEDGE BASE (VKB) ──
      // This makes ALL extracted DD214 data available to every AI tool
      await _saveDd214ToVkb(
        analysisResult,
        combinedText,
        extractedTexts,
        selectedFields,
      );

      // ── 3. SAVE TO MY PACKET (permanent archive) ──
      // This stores the full document text + structured data forever
      await _saveDd214ToPacket(
        analysisResult,
        combinedText,
        extractedTexts,
        selectedFields,
      );

      // Callback if provided
      if (onSaveResults) {
        onSaveResults(analysisResult);
      }

      // Close modal
      setShowProfileImportModal(false);
      setExtractedProfileData(null);
      setImportSaved(true);

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

  return {
    handleSaveResults,
    handleConfirmProfileImport,
    handleCancelProfileImport,
  };
}

function DD214AnalyzerUploadInput({ state, handlers }) {
  const { fileInputRef, isDragging, ocrProgress, t } = state;
  const { handleDragOver, handleDragLeave, handleDrop, handleFileChange } =
    handlers;

  return (
    <DD214UploadInput
      fileInputRef={fileInputRef}
      handleDragOver={handleDragOver}
      handleDragLeave={handleDragLeave}
      handleDrop={handleDrop}
      isDragging={isDragging}
      handleFileChange={handleFileChange}
      ocrProgress={ocrProgress}
      t={t}
    />
  );
}

function DD214AnalyzerModalContent({ state, handlers }) {
  const {
    inputMethod,
    setInputMethod,
    pastedText,
    setPastedText,
    setShowFormBuilder,
    droppedFiles,
    originalPDFFiles,
    extractedTexts,
    isProcessing,
    error,
    offDeviceNotice,
    analysisResult,
    setAnalysisResult,
    importSaved,
    aiStatus,
    setAIStatus,
    onOpenMusterCall,
    t,
  } = state;
  const { runOCROnFiles, handleRemoveFile } = handlers;

  return (
    <div className="space-y-6">
      <DD214GuidanceAndPrivacyBanners
        onOpenMusterCall={onOpenMusterCall}
        aiStatus={aiStatus}
        t={t}
      />

      <DD214SmartAiLoadSection aiStatus={aiStatus} setAIStatus={setAIStatus} />

      <DD214InputMethodTabs
        inputMethod={inputMethod}
        setInputMethod={setInputMethod}
        extractedTexts={extractedTexts}
        t={t}
      />

      {/* Paste Input */}
      {inputMethod === "paste" && (
        <DD214PasteInput
          pastedText={pastedText}
          setPastedText={setPastedText}
          t={t}
        />
      )}

      {/* Manual Entry */}
      {inputMethod === "manual" && (
        <DD214ManualEntry t={t} setShowFormBuilder={setShowFormBuilder} />
      )}

      {/* Upload Input */}
      {inputMethod === "upload" && (
        <DD214AnalyzerUploadInput state={state} handlers={handlers} />
      )}

      <DD214LoadedFilesList
        droppedFiles={droppedFiles}
        originalPDFFiles={originalPDFFiles}
        extractedTexts={extractedTexts}
        runOCROnFiles={runOCROnFiles}
        isProcessing={isProcessing}
        handleRemoveFile={handleRemoveFile}
        t={t}
      />

      <DD214ErrorBanner error={error} t={t} />
      <DD214OffDeviceNotice notice={offDeviceNotice} />

      <DD214AnalysisResultsPanel
        analysisResult={analysisResult}
        importSaved={importSaved}
        onIdentifierChange={(field, value) =>
          setAnalysisResult((prev) => ({ ...prev, [field]: value }))
        }
        t={t}
      />
    </div>
  );
}

function DD214AnalyzerExtraModals({ state, handlers }) {
  const {
    showProfileImportModal,
    extractedProfileData,
    showFormBuilder,
    setShowFormBuilder,
  } = state;
  const { handleConfirmProfileImport, handleCancelProfileImport } = handlers;
  // G10: a fresh getVeteranProfile() object every render gave the modal's
  // own reset effect (keyed on this prop's identity) a new reference on
  // every parent re-render, wiping the veteran's in-progress field
  // selections/edits - only re-reads when the modal actually opens.
  const currentProfile = useMemo(
    () => getVeteranProfile(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showProfileImportModal],
  );

  return (
    <>
      {/* Profile import confirmation - already portaled to document.body */}
      {showProfileImportModal &&
        extractedProfileData &&
        createPortal(
          <ProfileImportConfirmModal
            extractedData={extractedProfileData}
            currentProfile={currentProfile}
            onConfirm={handleConfirmProfileImport}
            onCancel={handleCancelProfileImport}
          />,
          document.body,
        )}

      {/* DD214 Form Builder - fixed z-[9999] portal, renders above the shell */}
      {showFormBuilder && (
        <DD214FormBuilder
          onClose={() => setShowFormBuilder(false)}
          onSave={() => {
            // Optionally refresh the list or show success message
          }}
        />
      )}
    </>
  );
}

function DD214AnalyzerView({ state, handlers }) {
  const {
    onClose,
    onReportBug,
    onOpenAISettings,
    t,
    pastedText,
    extractedTexts,
    droppedFiles,
    originalPDFFiles,
    analysisResult,
    aiStatus,
    isGenerating,
    isProcessing,
  } = state;
  const { handleClearAll, handleSaveResults, handleAnalyzeWithAI } = handlers;

  // Has input if: pasted text, OR processed files with extracted text, OR loaded files (to prompt user to OCR)
  const hasInput =
    pastedText.trim() ||
    extractedTexts.length > 0 ||
    droppedFiles.length > 0 ||
    originalPDFFiles.length > 0;

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        size="xl"
        labelledBy="dd214-analyzer-title"
        footer={
          <DD214ModalFooter
            hasInput={hasInput}
            handleClearAll={handleClearAll}
            analysisResult={analysisResult}
            handleSaveResults={handleSaveResults}
            handleAnalyzeWithAI={handleAnalyzeWithAI}
            aiStatus={aiStatus}
            isGenerating={isGenerating}
            isProcessing={isProcessing}
            t={t}
          />
        }
        header={
          <DD214ModalHeader
            t={t}
            onReportBug={onReportBug}
            onClose={onClose}
            onOpenAISettings={onOpenAISettings}
          />
        }
      >
        <DD214AnalyzerModalContent state={state} handlers={handlers} />
      </ResponsiveModal>

      <DD214AnalyzerExtraModals state={state} handlers={handlers} />
    </>
  );
}

// Check AI status on mount and periodically.
function useDD214AIStatus() {
  const [aiStatus, setAIStatus] = useState({ anyAvailable: false });

  useEffect(() => {
    /** @type {() => void} */
    const checkStatus = () => setAIStatus(getAIStatus());
    checkStatus();
    const intervalId = setInterval(() => checkStatus(), 1000);
    return () => clearInterval(intervalId);
  }, []);

  return { aiStatus, setAIStatus };
}

function useDD214FileUploadState() {
  const [droppedFiles, setDroppedFiles] = useState([]);
  const [extractedTexts, setExtractedTexts] = useState([]);
  const [originalPDFFiles, setOriginalPDFFiles] = useState([]); // Keep original PDF files for vision model
  const [ocrProgress, setOcrProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  return {
    droppedFiles,
    setDroppedFiles,
    extractedTexts,
    setExtractedTexts,
    originalPDFFiles,
    setOriginalPDFFiles,
    ocrProgress,
    setOcrProgress,
    isProcessing,
    setIsProcessing,
    isDragging,
    setIsDragging,
    fileInputRef,
  };
}

function useDD214ResultState() {
  const [inputMethod, setInputMethod] = useState("paste"); // 'paste' | 'upload' | 'manual'
  const [pastedText, setPastedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [offDeviceNotice, setOffDeviceNotice] = useState(null);
  const [importSaved, setImportSaved] = useState(false);

  return {
    inputMethod,
    setInputMethod,
    pastedText,
    setPastedText,
    isGenerating,
    setIsGenerating,
    analysisResult,
    setAnalysisResult,
    error,
    setError,
    offDeviceNotice,
    setOffDeviceNotice,
    importSaved,
    setImportSaved,
  };
}

// Profile import confirmation modal + manual form builder state.
function useDD214ImportModalsState() {
  const [showProfileImportModal, setShowProfileImportModal] = useState(false);
  const [extractedProfileData, setExtractedProfileData] = useState(null);
  const [showFormBuilder, setShowFormBuilder] = useState(false);

  return {
    showProfileImportModal,
    setShowProfileImportModal,
    extractedProfileData,
    setExtractedProfileData,
    showFormBuilder,
    setShowFormBuilder,
  };
}

const DD214Analyzer = ({
  onClose,
  onReportBug,
  onOpenAISettings,
  onSaveResults,
  onOpenMusterCall,
  initialFile,
}) => {
  const { t } = useLanguage();

  const aiStatusState = useDD214AIStatus();
  const fileUploadState = useDD214FileUploadState();
  const resultState = useDD214ResultState();
  const importModalsState = useDD214ImportModalsState();

  const state = {
    t,
    onClose,
    onReportBug,
    onOpenAISettings,
    onSaveResults,
    onOpenMusterCall,
    ...aiStatusState,
    ...fileUploadState,
    ...resultState,
    ...importModalsState,
  };
  const handlers = {
    ..._buildDd214FileHandlers(state),
    ..._buildDd214AnalysisHandlers(state),
    ..._buildDd214SaveHandlers(state),
  };

  // FIX-2: auto-process the file carried through from MyPacket's
  // drag-drop/file-select (openDD214Analyzer CustomEvent detail) instead
  // of opening empty and making the veteran re-select it. Guarded by a
  // ref so re-renders (or the same File object reference persisting
  // across parent re-renders) don't reprocess it repeatedly.
  const processedInitialFileRef = useRef(false);
  useEffect(() => {
    if (!initialFile || processedInitialFileRef.current) return;
    processedInitialFileRef.current = true;
    resultState.setInputMethod("upload");
    handlers.processFiles([initialFile]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  return <DD214AnalyzerView state={state} handlers={handlers} />;
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
