/**
 * Vet-Rate.org - C-File AI Analysis Service
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * AI-powered C-File analysis with AUTOMATIC CHUNKING
 * Handles files of ANY size (including 300MB+ C-Files) by:
 * - Auto-detecting when files exceed context limits
 * - Splitting into intelligent chunks with overlap
 * - Processing chunks in sequence
 * - Merging results with deduplication
 *
 * Context Window Limits:
 * - Gemini 2.5 Flash: ~1,000,000 tokens (~4MB text)
 * - Local AI (WebLLM): ~4,096 tokens (~16KB text)
 */

import {
  generateAI,
  isAnyAIAvailable,
  getAIStatus,
  resetAICircuitBreaker,
  AI_MODES,
} from "./unifiedAIService";
import { validateDiagnosticCode } from "./hallucinationTrap";
import { scanDocumentForCrisis } from "./crisisInterceptor";
import { untrustedSection } from "./aiSystemPrompts";
import { getCachedDeviceProfile } from "./deviceCapabilityDetector";
import { AI_CHUNK_RATE } from "../data/aiPerformanceProfile";
import { segmentPages, chunkBySegment } from "./cFilePageSegmenter";

// ============================================================================
// CONFIGURATION - Token limits and chunking settings
// ============================================================================

// Token budgets per engine, leaving room for system prompt + response:
// budget = context − ~900 (system prompt) − ~1500 (JSON response) − margin.
// The Warrant Council loads WebLLM with context_window_size 8192
// (diamondSwarm.js); wllama runs n_ctx 4096 (wllamaService.js). The old
// flat LOCAL=400 was 4-14x below those budgets and turned a large C-File
// into thousands of sequential generations (hours of analysis time).
const TOKEN_LIMITS = {
  GEMINI: 800000, // 800K tokens (conservative for 1M context)
  // context_window_size raised to 12288: available input = 12288 - 2048 output - 62 system = 10178.
  // At CHARS_PER_TOKEN=3.4 => 8200 * 3.4 ≈ 28K chars/chunk, ~196 chunks (was 4500→18K→304 chunks).
  // Conservative token estimate in generateWithSwarm (÷3) ensures no CWSE even on dense pages.
  SWARM_8K: 8200, // 12288 − 2048 output − 62 system ≈ 10178 available; 8200 tokens ≈ 28K chars
  LOCAL_4K: 1500, // 4096 − 900 − 1500, with margin
};

// Approximate chars per token (English text averages ~4 chars/token)
// OCR'd military/medical text averages ~3.4 chars/token (vs 4 for generic text).
// Used only for chunk-size budgeting; generateWithSwarm uses /3 for its truncation guard.
const CHARS_PER_TOKEN = 3.4;

// Pre-flight scoring caps local-AI runs to the top-scored 150 chunks (sorted by
// claims-keyword density). At ~100 s/chunk (p50 observed 2026-06-13), 150 chunks
// ≈ 4.2 h AI + ~45 min first-run warmup ≈ 5 h total — down from 8+ h at 284 chunks.
// MIN_CLAIMS_SCORE is the absolute keyword floor: chunks scoring below this are
// skipped even within the cap, eliminating admin pages that slipped past Gate 2.
const MAX_WEBGPU_AI_CHUNKS = 150;
const MIN_CLAIMS_SCORE = 2;

// Maximum characters per chunk based on AI mode.
// For SWARM (WebLLM), use the device profile's adaptive chunk size if available
// (set by detectDeviceCapabilities in diamondSwarm.js at model-load time).
const getMaxCharsPerChunk = (aiMode) => {
  if (aiMode === AI_MODES.SWARM) {
    const deviceMaxChars = getCachedDeviceProfile()?.maxChunkChars;
    return deviceMaxChars ?? TOKEN_LIMITS.SWARM_8K * CHARS_PER_TOKEN; // ~28K on desktop-high
  }
  if (
    aiMode === AI_MODES.LOCAL ||
    aiMode === AI_MODES.WLLAMA ||
    aiMode === AI_MODES.LOCAL_SERVER
  ) {
    return TOKEN_LIMITS.LOCAL_4K * CHARS_PER_TOKEN; // ~5K chars
  }
  return TOKEN_LIMITS.GEMINI * CHARS_PER_TOKEN; // ~2.7M chars for cloud
};

// Overlap between chunks (in pages) to catch context that spans boundaries
const CHUNK_OVERLAP_PAGES = 2; // Reduced from 5 to minimize processing time

// Minimum pages per chunk (don't create tiny chunks)
const MIN_PAGES_PER_CHUNK = 5; // Reduced from 10 to handle smaller chunks better

// Retry failed chunks before recording them in the failedChunks manifest
const MAX_CHUNK_RETRIES = 2;
const CHUNK_RETRY_BACKOFF_MS = 1000;

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

// Main analysis prompt
const CFILE_SYSTEM_PROMPT = `You are a highly specialized VA Claims Auditor and Medical Record Analyst. Your sole purpose is to review the provided text, which has been extracted from a veteran's Military Service Records (C-File) and Medical Records.

YOUR GOAL: Identify "The Big Three" elements required for a successful VA disability claim:
1. In-Service Event (Injury, illness, or exposure).
2. Current Diagnosis (Chronic issues mentioned in recent years).
3. Nexus (Medical opinion or continuity of symptoms linking #1 to #2).

INPUT DATA:
The user will provide a large block of text representing the full file. The text includes page markers in the format "--- PAGE X ---".

OUTPUT FORMAT:
You must respond ONLY with a valid JSON object. Do not include markdown formatting, code blocks, or conversational text. The JSON structure must be:

{
  "summary": "A 2-3 sentence executive summary of the veteran's major service-connected risks.",
  "servicePeriod": {
    "branch": "Military branch if identified",
    "entryDate": "Approximate entry date if found",
    "separationDate": "Approximate separation date if found",
    "mos": "Military Occupational Specialty if identified"
  },
  "timeline": [
    {
      "date": "YYYY-MM-DD or Approx Date (e.g., 'Jan 2005' or 'Circa 2003')",
      "page_number": 123,
      "category": "injury|medical_visit|combat_award|diagnosis|exposure|surgery|mental_health|medication",
      "body_part": "Specific body part (e.g., 'Right Knee', 'Lumbar Spine') or 'Systemic' or 'Mental Health'",
      "description": "Concise summary of the event (max 25 words).",
      "quote": "Direct quote of the key phrase from the text (max 50 words).",
      "significance": "high|medium|low - How significant is this for a claim?"
    }
  ],
  "potential_claims": [
    {
      "condition": "Name of condition (e.g., Tinnitus, Lumbar Strain, PTSD)",
      "diagnosticCode": "VA diagnostic code if you can identify it (e.g., 6260 for Tinnitus)",
      "likelihood": "high|medium|low - Based on evidence found",
      "inServiceEvent": "Brief description of the in-service event supporting this claim",
      "currentDiagnosis": "Whether a current diagnosis exists (yes|no|unclear)",
      "nexusStrength": "strong|moderate|weak|missing - Strength of connection between service and condition",
      "missing_element": "What is missing? (e.g., 'Nexus letter needed', 'No current diagnosis found', 'In-service event unclear')",
      "evidence_pages": [12, 45, 108],
      "recommendation": "Specific action to strengthen this claim"
    }
  ],
  "exposures": [
    {
      "type": "Agent Orange|Burn Pits|Radiation|Asbestos|Gulf War Contaminants|Camp Lejeune Water|Other",
      "location": "Location of exposure if identified",
      "timeframe": "When the exposure occurred",
      "page_number": 123,
      "presumptive_conditions": ["List of conditions that may be presumptively connected"]
    }
  ],
  "combatIndicators": [
    {
      "indicator": "Description of combat indicator (CAR, CIB, Purple Heart, combat zone deployment, etc.)",
      "page_number": 123,
      "significance": "Why this matters for claims"
    }
  ],
  "mentalHealth": {
    "indicators": ["List of mental health indicators found"],
    "diagnoses": ["Any mental health diagnoses mentioned"],
    "stressors": ["Documented stressors"],
    "pages": [12, 45]
  },
  "redFlags": [
    {
      "issue": "Any concerning issues found (gaps in records, contradictions, etc.)",
      "page_number": 123,
      "suggestion": "How to address this issue"
    }
  ],
  "actionItems": [
    "Prioritized list of next steps the veteran should take",
    "Get buddy statement for X incident",
    "Request nexus letter for Y condition",
    "File for presumptive condition Z"
  ]
}

CRITICAL RULES:
1. ACCURACY IS PARAMOUNT. Do not hallucinate. If an event is not in the text, do not list it.
2. PAGE REFERENCES: You must strictly track the "--- PAGE X ---" markers to attribute every finding to a specific page number (as an integer, not string).
3. IGNORE NOISE: Ignore administrative clutter (leave forms, routing slips, illegible entries) unless they contain medical evidence.
4. CHRONOLOGY: Order the timeline from oldest to newest.
5. BE COMPREHENSIVE: For large files, aim to capture all significant medical events, not just the most recent ones.
6. DIAGNOSTIC CODES: When you identify a condition, try to match it to a VA diagnostic code from 38 CFR Part 4.
7. PACT ACT AWARENESS: Flag any toxic exposure evidence for PACT Act presumptive claims.
8. MENTAL HEALTH SENSITIVITY: Pay special attention to mental health indicators, even subtle ones.`;

// Chunk-specific prompt (tells AI this is a partial file)
const _CHUNK_PROMPT_PREFIX = `IMPORTANT: This is CHUNK {chunkNum} of {totalChunks} from a large C-File.
Pages in this chunk: {startPage} to {endPage}.
Focus on extracting findings from THIS chunk only. Findings will be merged with other chunks.

`;

// ============================================================================
// JSON REPAIR UTILITIES
// ============================================================================

/**
 * Attempt to repair truncated JSON from AI response
 * Handles cases where output was cut off mid-response
 * @param {string} jsonStr - Potentially truncated JSON string
 * @returns {Object|null} - Parsed object or null if repair failed
 */
function attemptJSONRepair(jsonStr) {
  if (!jsonStr || typeof jsonStr !== "string") return null;

  const content = jsonStr.trim();

  // Remove any trailing incomplete values
  // Find the last complete property-value pair
  const strategies = [
    // Strategy 0: Normalize control characters (literal newlines inside JSON string
    // values are invalid and cause V8 parse failures at the embedded newline position).
    // Replacing all \r/\n with space is safe: JSON ignores whitespace between tokens,
    // and we never want literal newlines in our field values.
    () => JSON.parse(content.replace(/\r\n|\r|\n/g, " ")),
    // Strategy 0b: Fix missing OPENING quote on string values.
    // Model sometimes writes  "key": The text here."  instead of  "key": "The text here."
    // Match: colon, not-a-quote (not already quoted / not null/true/false/number),
    // any non-quote non-newline chars, then a closing quote before a JSON separator.
    () => {
      const fixed = content.replace(
        /(:\s*)(?!")(?!true\b|false\b|null\b|[\d[{-])([^"\n]+?)("\s*[,\n}\]])/g,
        (_, colon, value, closingPart) =>
          `${colon}"${value.trim()}${closingPart}`,
      );
      return JSON.parse(fixed);
    },
    // Strategy 1: Close all open brackets/braces
    () => {
      let repaired = content;
      // Count open brackets
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/]/g) || []).length;

      // Remove any trailing incomplete string/value
      repaired = repaired.replace(/,\s*"[^"]*$/, ""); // Incomplete key
      repaired = repaired.replace(/:\s*"[^"]*$/, ': ""'); // Incomplete string value
      repaired = repaired.replace(/,\s*$/, ""); // Trailing comma
      repaired = repaired.replace(/:\s*$/, ": null"); // Trailing colon

      // Close arrays and objects
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        repaired += "]";
      }
      for (let i = 0; i < openBraces - closeBraces; i++) {
        repaired += "}";
      }

      return JSON.parse(repaired);
    },
    // Strategy 1b: Insert missing commas between consecutive array elements.
    // Model sometimes emits [{...} {...}] without the separating comma.
    // The pattern only appears at array-element boundaries in our schema output;
    // it does not occur inside quoted string values (which never contain bare `}{`).
    () => {
      const fixed = content.replace(/\}\s*\n(\s*)\{/g, "},\n$1{");
      return JSON.parse(fixed);
    },
    // Strategy 1c: Strip text preamble before the first '{', then close brackets.
    // Model sometimes outputs explanatory prose before the JSON object, e.g.
    // "Based on the records: {..." — all prior strategies fail because the
    // non-JSON prefix makes the string unparseable from position 0.
    () => {
      const jsonStart = content.indexOf("{");
      if (jsonStart <= 0) return null;
      let extracted = content.substring(jsonStart);
      extracted = extracted.replace(/,\s*"[^"]*$/, "");
      extracted = extracted.replace(/:\s*"[^"]*$/, ': ""');
      extracted = extracted.replace(/,\s*$/, "");
      extracted = extracted.replace(/:\s*$/, ": null");
      const ob = (extracted.match(/{/g) || []).length;
      const cb = (extracted.match(/}/g) || []).length;
      const oB = (extracted.match(/\[/g) || []).length;
      const cB = (extracted.match(/]/g) || []).length;
      for (let i = 0; i < oB - cB; i++) extracted += "]";
      for (let i = 0; i < ob - cb; i++) extracted += "}";
      return JSON.parse(extracted);
    },
    // Strategy 2: Find last complete object at top level
    () => {
      let depth = 0;
      let lastCompleteIndex = -1;
      let inString = false;
      let escapeNext = false;

      for (let i = 0; i < content.length; i++) {
        const char = content[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === "\\" && inString) {
          escapeNext = true;
          continue;
        }

        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === "{" || char === "[") depth++;
          if (char === "}" || char === "]") {
            depth--;
            if (depth === 0) lastCompleteIndex = i;
          }
        }
      }

      if (lastCompleteIndex > 0) {
        return JSON.parse(content.substring(0, lastCompleteIndex + 1));
      }
      return null;
    },
    // Strategy 2b: Single-quote normalization.
    // Local models occasionally emit valid-JS but invalid-JSON single-quoted output:
    // {'condition': 'PTSD', 'likelihood': 'high'}. Simple global replace works when
    // field values contain no apostrophes; the try/catch discards it otherwise.
    () => JSON.parse(content.replace(/'/g, '"')),
    // Strategy 3: Fix unquoted property names (JSON5-style output from the model)
    // e.g.  {summary: "...", timeline: [...]} → {"summary": "...", "timeline": [...]}
    // Applies the substitution only at structural positions ({, or ,) to avoid
    // touching identifier-like text inside string values.
    () => {
      const fixed = content.replace(
        /([{,])\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g,
        '$1 "$2":',
      );
      return JSON.parse(fixed);
    },
    // Strategy 4: Regex field extraction — last-resort for badly truncated output.
    // Extracts individual condition names and servicePeriod fields even when the
    // surrounding JSON structure is unrecoverable. Works with the slim 3-field
    // schema (no summary field) unlike the previous summary-only fallback.
    () => {
      const result = {
        summary: "",
        servicePeriod: {},
        timeline: [],
        potential_claims: [],
        exposures: [],
        combatIndicators: [],
        redFlags: [],
        actionItems: [],
        mentalHealth: { diagnoses: [], indicators: [], stressors: [], pages: [] },
      };

      // Pull condition+likelihood pairs from any fragment of the response
      const claimRe = /"condition"\s*:\s*"([^"]+)"[^}]*?"likelihood"\s*:\s*"([^"]+)"/g;
      let m;
      while ((m = claimRe.exec(content)) !== null) {
        result.potential_claims.push({
          condition: m[1],
          likelihood: m[2],
          inServiceEvent: "",
          currentDiagnosis: "unclear",
          missing_element: "",
        });
      }

      // Pull servicePeriod fields
      const branchM = content.match(/"branch"\s*:\s*"([^"]*)"/);
      const entryM = content.match(/"entryDate"\s*:\s*"([^"]*)"/);
      const sepM = content.match(/"separationDate"\s*:\s*"([^"]*)"/);
      const mosM = content.match(/"mos"\s*:\s*"([^"]*)"/);
      if (branchM || entryM) {
        result.servicePeriod = {
          branch: branchM?.[1] ?? "",
          entryDate: entryM?.[1] ?? "",
          separationDate: sepM?.[1] ?? "",
          mos: mosM?.[1] ?? "",
        };
      }

      if (result.potential_claims.length > 0 || result.servicePeriod.branch) {
        // eslint-disable-next-line no-console
        console.log(
          `📝 Regex fallback: extracted ${result.potential_claims.length} claim(s) from truncated output`,
        );
        return result;
      }
      return null;
    },
  ];

  for (const strategy of strategies) {
    try {
      const result = strategy();
      if (result && typeof result === "object") {
        return result;
      }
    } catch (e) {
      // Strategy failed, try next
      continue;
    }
  }

  return null;
}

// ============================================================================
// CHUNKING UTILITIES
// ============================================================================

/**
 * Split text into chunks based on page markers
 * Ensures chunks don't exceed the AI's context limit
 * @param {string} fullText - Full extracted text with page markers
 * @param {string} aiMode - Current AI mode (cloud/local/swarm)
 * @returns {Array<{text: string, startPage: number, endPage: number, chunkIndex: number}>}
 */
function splitIntoChunks(fullText, aiMode) {
  const maxCharsPerChunk = getMaxCharsPerChunk(aiMode);

  // Parse page markers to get page boundaries
  const pageMarkerRegex = /--- PAGE (\d+) ---/g;
  const pages = [];
  let lastIndex = 0;
  let match;

  while ((match = pageMarkerRegex.exec(fullText)) !== null) {
    if (pages.length > 0) {
      pages[pages.length - 1].endIndex = match.index;
    }
    pages.push({
      pageNum: parseInt(match[1], 10),
      startIndex: match.index,
      endIndex: fullText.length, // Will be updated on next iteration
    });
    // eslint-disable-next-line no-unused-vars
    lastIndex = match.index;
  }

  // If no page markers found, treat as single chunk
  if (pages.length === 0) {
    console.warn("No page markers found in text, treating as single chunk");
    return [
      {
        text: fullText,
        startPage: 1,
        endPage: 1,
        chunkIndex: 0,
      },
    ];
  }

  // eslint-disable-next-line no-console
  console.log(`📄 Found ${pages.length} pages in document`);

  // If total text fits in one chunk, return as-is
  if (fullText.length <= maxCharsPerChunk) {
    // eslint-disable-next-line no-console
    console.log(
      `✅ Document fits in single chunk (${fullText.length} chars <= ${maxCharsPerChunk} max)`,
    );
    return [
      {
        text: fullText,
        startPage: pages[0].pageNum,
        endPage: pages[pages.length - 1].pageNum,
        chunkIndex: 0,
      },
    ];
  }

  // Need to split into multiple chunks
  // eslint-disable-next-line no-console
  console.log(
    `📦 Document too large (${fullText.length} chars > ${maxCharsPerChunk} max), splitting into chunks...`,
  );

  const chunks = [];
  let currentChunkStart = 0;
  let currentChunkPages = [];
  let currentChunkSize = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageText = fullText.slice(page.startIndex, page.endIndex);
    const pageSize = pageText.length;

    // Check if adding this page would exceed the limit
    if (
      currentChunkSize + pageSize > maxCharsPerChunk &&
      currentChunkPages.length >= MIN_PAGES_PER_CHUNK
    ) {
      // Save current chunk
      const chunkEndIndex = pages[i - 1].endIndex;
      chunks.push({
        text: fullText.slice(currentChunkStart, chunkEndIndex),
        startPage: currentChunkPages[0],
        endPage: currentChunkPages[currentChunkPages.length - 1],
        chunkIndex: chunks.length,
      });

      // Start new chunk with overlap
      const overlapStartIndex = Math.max(0, i - CHUNK_OVERLAP_PAGES);
      currentChunkStart = pages[overlapStartIndex].startIndex;
      currentChunkPages = pages
        .slice(overlapStartIndex, i + 1)
        .map((p) => p.pageNum);
      currentChunkSize = fullText.slice(
        currentChunkStart,
        page.endIndex,
      ).length;
    } else {
      currentChunkPages.push(page.pageNum);
      currentChunkSize = fullText.slice(
        currentChunkStart,
        page.endIndex,
      ).length;
    }
  }

  // Don't forget the last chunk
  if (currentChunkPages.length > 0) {
    chunks.push({
      text: fullText.slice(currentChunkStart),
      startPage: currentChunkPages[0],
      endPage: currentChunkPages[currentChunkPages.length - 1],
      chunkIndex: chunks.length,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`📦 Split into ${chunks.length} chunks`);
  chunks.forEach((chunk, i) => {
    // eslint-disable-next-line no-console
    console.log(
      `  Chunk ${i + 1}: Pages ${chunk.startPage}-${chunk.endPage}, ${chunk.text.length} chars`,
    );
  });

  return chunks;
}

// Signals that a page is worth sending to the (slow, sequential) local LLM.
// VA C-Files are full of cover sheets, blank separators, and form
// instructions; a page with no date and no claim-relevant vocabulary
// cannot contribute an in-service event, symptom, or nexus finding.
// Deliberately keep-biased: any date or any medical/service term keeps it.
const PAGE_RELEVANCE_PATTERN = new RegExp(
  [
    // Date-only patterns removed: "\\b(19|20)\\d{2}\\b" and numeric-date matched
    // every page in a VA C-File (routing slips, cover sheets, index pages all have
    // years/dates). Requiring at least one clinical, VA, body-part, or service
    // keyword drops ~40-60% of administrative pages before chunking, cutting AI
    // calls proportionally without losing any medically-relevant pages.
    "diagnos|symptom|treat|pain|injur|condition|exam|clinic|medical|health",
    "service[- ]connect|rating|disab|compensat|claim|nexus|c&p|dbq",
    "surger|prescri|medicat|therap|mental|ptsd|anxiet|depress",
    "hearing|tinnitus|knee|back|spine|shoulder|hip|ankle|foot|planus|plantar|migraine|sleep",
    "deploy|combat|duty|discharge|dd[- ]?214|enlist",
  ].join("|"),
  "i",
);

/**
 * Drop boilerplate pages before local-AI chunking. Returns the screened
 * text (page markers preserved so page references stay accurate) plus
 * counts for the metadata/UI. Never screens below a safety floor — if the
 * filter would discard nearly everything, the original text is returned.
 */
export function screenRelevantPages(fullText) {
  const pageRegex = /--- PAGE (\d+)[^\n]*---/g;
  const markers = [...fullText.matchAll(pageRegex)];
  if (markers.length < 10) {
    return { text: fullText, totalPages: markers.length, skippedPages: 0 };
  }

  const kept = [];
  const keptPages = []; // {pageNum, text} for segmentPages()
  let skippedPages = 0;
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = i + 1 < markers.length ? markers[i + 1].index : fullText.length;
    const block = fullText.slice(start, end);
    const body = block.slice(markers[i][0].length);
    if (PAGE_RELEVANCE_PATTERN.test(body)) {
      kept.push(block);
      keptPages.push({ pageNum: parseInt(markers[i][1], 10), text: block });
    } else {
      skippedPages++;
    }
  }

  if (kept.length < markers.length * 0.1) {
    // Filter looks wrong for this document — analyze everything instead.
    const allPages = markers.map((m, i) => ({
      pageNum: parseInt(m[1], 10),
      text: fullText.slice(
        m.index,
        i + 1 < markers.length ? markers[i + 1].index : fullText.length,
      ),
    }));
    return {
      text: fullText,
      pages: allPages,
      totalPages: markers.length,
      skippedPages: 0,
    };
  }
  return {
    text: kept.join(""),
    pages: keptPages,
    totalPages: markers.length,
    skippedPages,
  };
}

/**
 * Estimate how long processing will take based on chunk count.
 * Chunk count already scales with document size — the old extra
 * textLength multiplier double-counted size and inflated a large
 * C-File's estimate by two orders of magnitude (~12 hours shown).
 */
function estimateProcessingTime(textLength, chunkCount, aiMode) {
  // Per-chunk rates come from aiPerformanceProfile.js — update that file after
  // each stress run and this estimate updates automatically.
  const aiChunks =
    aiMode === AI_MODES.SWARM || aiMode === AI_MODES.LOCAL
      ? Math.min(chunkCount, MAX_WEBGPU_AI_CHUNKS)
      : chunkCount;

  const profile = getCachedDeviceProfile();
  const tier = profile?.tier ?? "desktop-high";
  const localRate =
    AI_CHUNK_RATE[tier]?.p50 ?? AI_CHUNK_RATE["desktop-high"].p50;
  const baseTimePerChunk =
    aiMode === AI_MODES.CLOUD ? 30 : aiMode === AI_MODES.SWARM ? localRate : 45;

  const totalSeconds = aiChunks * baseTimePerChunk;

  if (totalSeconds < 60) {
    return `~${Math.ceil(totalSeconds)} seconds`;
  } else if (totalSeconds < 3600) {
    return `~${Math.ceil(totalSeconds / 60)} minutes`;
  } else {
    return `~${(totalSeconds / 3600).toFixed(1)} hours`;
  }
}

// ============================================================================
// RESULT MERGING
// ============================================================================

/**
 * Merge results from multiple chunks into a unified analysis
 * Handles deduplication and timeline ordering
 * @param {Array<Object>} chunkResults - Array of analysis results from each chunk
 * @returns {Object} - Merged analysis result
 */
function mergeChunkResults(chunkResults) {
  if (chunkResults.length === 0) {
    throw new Error("No chunk results to merge");
  }

  if (chunkResults.length === 1) {
    return chunkResults[0];
  }

  // eslint-disable-next-line no-console
  console.log(`🔀 Merging ${chunkResults.length} chunk results...`);

  // Initialize merged result with first chunk's service period (usually most reliable)
  const merged = {
    summary: "",
    servicePeriod: chunkResults[0].servicePeriod || {},
    timeline: [],
    potential_claims: [],
    exposures: [],
    combatIndicators: [],
    mentalHealth: {
      indicators: [],
      diagnoses: [],
      stressors: [],
      pages: [],
    },
    redFlags: [],
    actionItems: [],
  };

  // Collect all summaries and create a meta-summary
  const summaries = chunkResults.filter((r) => r.summary).map((r) => r.summary);
  merged.summary = createMetaSummary(summaries);

  // Merge service period (take non-empty values from any chunk)
  for (const result of chunkResults) {
    if (result.servicePeriod) {
      if (!merged.servicePeriod.branch && result.servicePeriod.branch) {
        merged.servicePeriod.branch = result.servicePeriod.branch;
      }
      if (!merged.servicePeriod.entryDate && result.servicePeriod.entryDate) {
        merged.servicePeriod.entryDate = result.servicePeriod.entryDate;
      }
      if (
        !merged.servicePeriod.separationDate &&
        result.servicePeriod.separationDate
      ) {
        merged.servicePeriod.separationDate =
          result.servicePeriod.separationDate;
      }
      if (!merged.servicePeriod.mos && result.servicePeriod.mos) {
        merged.servicePeriod.mos = result.servicePeriod.mos;
      }
    }
  }

  // Merge timelines and sort chronologically
  for (const result of chunkResults) {
    if (result.timeline && Array.isArray(result.timeline)) {
      merged.timeline.push(...result.timeline);
    }
  }
  merged.timeline = deduplicateTimeline(merged.timeline);
  merged.timeline.sort(compareDates);

  // Merge potential claims with deduplication by condition name
  for (const result of chunkResults) {
    if (result.potential_claims && Array.isArray(result.potential_claims)) {
      merged.potential_claims.push(...result.potential_claims);
    }
  }
  merged.potential_claims = deduplicateClaims(merged.potential_claims);

  // Merge exposures with deduplication
  for (const result of chunkResults) {
    if (result.exposures && Array.isArray(result.exposures)) {
      merged.exposures.push(...result.exposures);
    }
  }
  merged.exposures = deduplicateByField(merged.exposures, "type");

  // Merge combat indicators
  for (const result of chunkResults) {
    if (result.combatIndicators && Array.isArray(result.combatIndicators)) {
      merged.combatIndicators.push(...result.combatIndicators);
    }
  }
  merged.combatIndicators = deduplicateByField(
    merged.combatIndicators,
    "indicator",
  );

  // Merge mental health data
  for (const result of chunkResults) {
    if (result.mentalHealth) {
      if (result.mentalHealth.indicators) {
        merged.mentalHealth.indicators.push(...result.mentalHealth.indicators);
      }
      if (result.mentalHealth.diagnoses) {
        merged.mentalHealth.diagnoses.push(...result.mentalHealth.diagnoses);
      }
      if (result.mentalHealth.stressors) {
        merged.mentalHealth.stressors.push(...result.mentalHealth.stressors);
      }
      if (result.mentalHealth.pages) {
        merged.mentalHealth.pages.push(...result.mentalHealth.pages);
      }
    }
  }
  merged.mentalHealth.indicators = [...new Set(merged.mentalHealth.indicators)];
  merged.mentalHealth.diagnoses = [...new Set(merged.mentalHealth.diagnoses)];
  merged.mentalHealth.stressors = [...new Set(merged.mentalHealth.stressors)];
  merged.mentalHealth.pages = [...new Set(merged.mentalHealth.pages)].sort(
    (a, b) => a - b,
  );

  // Merge red flags
  for (const result of chunkResults) {
    if (result.redFlags && Array.isArray(result.redFlags)) {
      merged.redFlags.push(...result.redFlags);
    }
  }
  merged.redFlags = deduplicateByField(merged.redFlags, "issue");

  // Merge action items (deduplicate similar items)
  const allActions = [];
  for (const result of chunkResults) {
    if (result.actionItems && Array.isArray(result.actionItems)) {
      allActions.push(...result.actionItems);
    }
  }
  merged.actionItems = deduplicateActionItems(allActions);

  // eslint-disable-next-line no-console
  console.log(
    `✅ Merged results: ${merged.timeline.length} timeline events, ${merged.potential_claims.length} claims, ${merged.exposures.length} exposures`,
  );

  return merged;
}

/**
 * Create a meta-summary from multiple chunk summaries
 */
function createMetaSummary(summaries) {
  if (summaries.length === 0) return "Analysis complete.";
  if (summaries.length === 1) return summaries[0];

  // For multiple summaries, try to combine the key points
  // This is a simple approach - could be enhanced with AI summary
  const combined = summaries.join(" ");

  // If combined is reasonable length, use it
  if (combined.length <= 500) {
    return combined;
  }

  // Otherwise, take key sentences from each
  const sentences = [];
  for (const summary of summaries) {
    const firstSentence = summary.split(/[.!?]/)[0];
    if (
      firstSentence &&
      !sentences.some((s) => s.toLowerCase() === firstSentence.toLowerCase())
    ) {
      sentences.push(firstSentence.trim());
    }
  }

  return sentences.join(". ") + ".";
}

/**
 * Normalize a date string to a "year-month-day" key so equivalent formats
 * ("Jan 2005", "January 2005", "2005-01") produce the same dedup key.
 * Avoids Date.parse for keying — it mixes local/UTC interpretation across formats.
 */
function normalizeDateKey(dateStr) {
  if (!dateStr) return "";
  const str = String(dateStr).toLowerCase().trim();

  const yearMatch = str.match(/\b(\d{4})\b/);
  if (!yearMatch) return str;
  const year = yearMatch[1];

  const monthNames = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  let month = 0;
  let day = 0;
  for (let i = 0; i < monthNames.length; i++) {
    if (str.includes(monthNames[i])) {
      month = i + 1;
      break;
    }
  }

  if (month) {
    const dayMatch = str.match(/\b(\d{1,2})\b/);
    if (dayMatch) day = parseInt(dayMatch[1], 10);
  } else {
    const ymd = str.match(/\b\d{4}-(\d{1,2})(?:-(\d{1,2}))?/);
    if (ymd) {
      month = parseInt(ymd[1], 10);
      day = ymd[2] ? parseInt(ymd[2], 10) : 0;
    } else {
      const mdy = str.match(/\b(\d{1,2})[/](?:(\d{1,2})[/])?\d{4}/);
      if (mdy) {
        month = parseInt(mdy[1], 10);
        day = mdy[2] ? parseInt(mdy[2], 10) : 0;
      }
    }
  }

  return `${year}-${month}-${day}`;
}

/**
 * Deduplicate timeline entries by normalized date, page number and category
 */
export function deduplicateTimeline(timeline) {
  const seen = new Map();

  for (const event of timeline) {
    const key = `${normalizeDateKey(event.date)}_${event.page_number || 0}_${(event.body_part || "").toLowerCase()}_${event.category || ""}`;

    if (!seen.has(key)) {
      seen.set(key, event);
    } else {
      // Merge evidence pages if same event found in multiple chunks
      const existing = seen.get(key);
      if (
        event.quote &&
        (!existing.quote || event.quote.length > existing.quote.length)
      ) {
        existing.quote = event.quote;
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Deduplicate claims by condition name, merging evidence pages
 */
function deduplicateClaims(claims) {
  const claimMap = new Map();

  for (const claim of claims) {
    const key = (claim.condition || "").toLowerCase().trim();

    if (!claimMap.has(key)) {
      claimMap.set(key, {
        ...claim,
        evidence_pages: [...(claim.evidence_pages || [])],
      });
    } else {
      // Merge evidence pages
      const existing = claimMap.get(key);
      const newPages = claim.evidence_pages || [];
      existing.evidence_pages = [
        ...new Set([...existing.evidence_pages, ...newPages]),
      ].sort((a, b) => a - b);

      // Keep strongest likelihood/nexus
      if (strengthRank(claim.likelihood) > strengthRank(existing.likelihood)) {
        existing.likelihood = claim.likelihood;
      }
      if (
        strengthRank(claim.nexusStrength) > strengthRank(existing.nexusStrength)
      ) {
        existing.nexusStrength = claim.nexusStrength;
      }
    }
  }

  return Array.from(claimMap.values());
}

/**
 * Get numeric rank for strength values
 */
function strengthRank(strength) {
  const ranks = {
    high: 3,
    strong: 3,
    medium: 2,
    moderate: 2,
    low: 1,
    weak: 1,
    missing: 0,
  };
  return ranks[strength?.toLowerCase()] || 0;
}

/**
 * Deduplicate array of objects by a specific field
 */
function deduplicateByField(items, field) {
  const seen = new Map();

  for (const item of items) {
    const key = (item[field] || "").toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }

  return Array.from(seen.values());
}

/**
 * Deduplicate action items using fuzzy matching
 */
function deduplicateActionItems(items) {
  const unique = [];

  for (const item of items) {
    if (typeof item !== "string") continue;
    const normalized = item.toLowerCase().trim();
    const isDuplicate = unique.some((existing) => {
      const existingNorm = existing.toLowerCase().trim();
      // Check for substantial overlap
      return (
        existingNorm.includes(normalized) ||
        normalized.includes(existingNorm) ||
        calculateSimilarity(existingNorm, normalized) > 0.7
      );
    });

    if (!isDuplicate) {
      unique.push(item);
    }
  }

  return unique;
}

/**
 * Simple string similarity calculation (Jaccard index on words)
 */
function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Compare two date strings for sorting (handles various formats)
 */
function compareDates(a, b) {
  const dateA = parseApproxDate(a.date);
  const dateB = parseApproxDate(b.date);
  return dateA - dateB;
}

/**
 * Parse approximate dates like "Jan 2005", "Circa 2003", "2004-06-15"
 */
function parseApproxDate(dateStr) {
  if (!dateStr) return 0;

  // Try standard date format first
  const standardDate = new Date(dateStr);
  if (!isNaN(standardDate)) {
    return standardDate.getTime();
  }

  // Extract year
  const yearMatch = dateStr.match(/\d{4}/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0], 10);

    // Try to extract month
    const monthNames = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const lowerDate = dateStr.toLowerCase();
    for (let i = 0; i < monthNames.length; i++) {
      if (lowerDate.includes(monthNames[i])) {
        return new Date(year, i, 1).getTime();
      }
    }

    return new Date(year, 0, 1).getTime();
  }

  return 0;
}

// ============================================================================
// ANTI-HALLUCINATION (merge-level)
// ============================================================================

/**
 * Strip hallucinated diagnostic codes from a final (merged) analysis result.
 * Claims keep their condition text — only the invalid code is removed, so a
 * real condition is never dropped because the AI guessed a wrong DC.
 * @param {Object} analysis - Merged analysis result (mutated in place)
 * @returns {Array<{condition: string, diagnosticCode: string, reason: string}>} rejected codes
 */
export function enforceValidDiagnosticCodes(analysis) {
  const rejected = [];
  if (!analysis || !Array.isArray(analysis.potential_claims)) {
    return rejected;
  }

  for (const claim of analysis.potential_claims) {
    if (!claim || !claim.diagnosticCode) continue;
    const validation = validateDiagnosticCode(claim.diagnosticCode);
    if (!validation.isValid) {
      console.warn(
        `🚫 Rejected hallucinated diagnostic code ${claim.diagnosticCode} for "${claim.condition || "unknown condition"}"`,
      );
      rejected.push({
        condition: claim.condition || "",
        diagnosticCode: String(claim.diagnosticCode),
        reason: validation.reason,
      });
      claim.diagnosticCode = null;
    }
  }

  return rejected;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a C-File using Unified AI Service with automatic chunking
 * Handles files of ANY size by automatically splitting and merging
 *
 * @param {string} apiKey - User's Gemini API key (optional if using Local AI)
 * @param {string} fullText - Extracted text from the C-File with page markers
 * @param {Function} onProgress - Progress callback (status, {current, total, phase})
 * @param {AbortController} abortController - Optional abort controller to cancel analysis
 * @returns {Promise<Object>} - Structured analysis results
 */
export async function analyzeCFile(
  apiKey,
  fullText,
  onProgress = () => {},
  abortController = null,
) {
  // Check if ANY AI is available (Cloud or Local)
  if (!isAnyAIAvailable()) {
    throw new Error(
      "No AI available. Please set up an API key or enable Local AI.",
    );
  }

  if (!fullText || fullText.trim().length < 100) {
    throw new Error("Insufficient text content to analyze");
  }

  const aiStatus = getAIStatus();
  const aiMode = aiStatus.effectiveMode;

  // Special check for Warrant Council mode - ensure model is fully loaded
  if (aiMode === "swarm") {
    const { hasWebLLMEngine } = await import("./diamondSwarm");
    if (!hasWebLLMEngine()) {
      throw new Error(
        "Warrant Council mode selected but model is still loading. Please wait for the model download to complete (check Local AI panel), or switch to Cloud AI in settings.",
      );
    }
  }

  onProgress("Analyzing document size...", { phase: "prepare" });

  // Local engines generate sequentially — skip boilerplate pages before AI.
  // Cloud mode reads everything (1M context, few calls).
  // NOTE: analyzePageByPage exists but is NOT used yet — WebLLM's ~14 s fixed
  // overhead per call × 1755 page calls = 12+ hours vs chunk-based ~260 min.
  // The right future path is page-level parsing + small-batch AI (3-5 pages).
  const isLocalAIMode = [
    AI_MODES.LOCAL,
    AI_MODES.SWARM,
    AI_MODES.WLLAMA,
    AI_MODES.LOCAL_SERVER,
  ].includes(aiMode);

  let analysisText = fullText;
  let skippedPages = 0;
  const screened = screenRelevantPages(fullText);
  analysisText = screened.text;
  skippedPages = screened.skippedPages;
  if (skippedPages > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `🧹 Skipping ${skippedPages}/${screened.totalPages} admin pages before chunking`,
    );
  }

  // Local AI: segment by document boundaries first, then pack into chunks.
  // Cloud AI: use char-count splitting (1M context, no per-call overhead concern).
  let chunks;
  if (isLocalAIMode && screened.pages?.length > 0) {
    const segments = segmentPages(screened.pages);
    chunks = chunkBySegment(segments, getMaxCharsPerChunk(aiMode));
  } else {
    chunks = splitIntoChunks(analysisText, aiMode);
  }
  const totalChunks = chunks.length;

  // eslint-disable-next-line no-console
  console.log(`📊 Analysis plan: ${totalChunks} chunk(s), AI mode: ${aiMode}`);

  if (totalChunks === 1) {
    // Single chunk - process normally
    onProgress("Sending to AI for analysis...", {
      phase: "analyze",
      current: 1,
      total: 1,
    });
    const result = await analyzeChunk(chunks[0], 1, 1, onProgress);
    const rejectedCodes = enforceValidDiagnosticCodes(result);
    result.failedChunks = [];

    onProgress("Analysis complete!", { phase: "complete" });

    return {
      success: true,
      analysis: result,
      metadata: {
        analyzedAt: new Date().toISOString(),
        textLength: fullText.length,
        aiMode: aiMode,
        chunksProcessed: 1,
        boilerplatePagesSkipped: skippedPages,
        rejectedDiagnosticCodes: rejectedCodes,
      },
    };
  }

  // Multi-chunk processing
  const estimatedTime = estimateProcessingTime(
    fullText.length,
    totalChunks,
    aiMode,
  );
  onProgress(`Processing ${totalChunks} chunks (estimated: ${estimatedTime})`, {
    phase: "multi-chunk",
    current: 0,
    total: totalChunks,
  });

  const chunkResults = [];
  const failedChunks = [];

  // Pre-flight: score every chunk before the loop so the cap selects the
  // highest-value chunks rather than the first N by page order.
  const chunkScores = isLocalAIMode ? chunks.map((c) => scoreChunkRelevance(c.text)) : null;
  let scoreThreshold = 0;
  if (chunkScores && chunkScores.length > MAX_WEBGPU_AI_CHUNKS) {
    const sorted = [...chunkScores].sort((a, b) => b - a);
    scoreThreshold = sorted[MAX_WEBGPU_AI_CHUNKS - 1];
    // eslint-disable-next-line no-console
    console.log(
      `📊 Chunk cap: top ${MAX_WEBGPU_AI_CHUNKS}/${chunkScores.length} by score (threshold ≥${scoreThreshold})`,
    );
  }
  let skippedLowScore = 0;

  for (let i = 0; i < chunks.length; i++) {
    // Check if aborted
    if (abortController?.signal.aborted) {
      throw new Error("Analysis cancelled by user");
    }

    const chunk = chunks[i];
    const chunkNum = i + 1;

    // --- Gate 1: low-content skip ---
    // Near-blank pages: cover sheets, index separators, blank pages.
    // Conservative thresholds — both conditions must hold.
    const alphaCount = (chunk.text.match(/[a-zA-Z]/g) || []).length;
    if (chunk.text.trim().length < 250 || alphaCount < 120) {
      // eslint-disable-next-line no-console
      console.log(
        `⏭️ Chunk ${chunkNum}/${totalChunks} skipped (low-content: ${chunk.text.trim().length} chars, ${alphaCount} alpha)`,
      );
      chunkResults.push(createEmptyChunkResult());
      continue;
    }

    // --- Gate 2: medical content pre-filter ---
    // Text-heavy but purely administrative pages (routing slips, consent forms,
    // SF authorization sheets, index pages) have none of: dates, medical terms,
    // VA/claims language, or body-part references. Any ONE signal → send to LLM.
    if (!chunkHasMedicalContent(chunk.text)) {
      // eslint-disable-next-line no-console
      console.log(
        `⏭️ Chunk ${chunkNum}/${totalChunks} skipped (no medical signals: ${chunk.text.trim().length} chars)`,
      );
      chunkResults.push(createEmptyChunkResult());
      continue;
    }

    // --- Gate 3: pre-flight relevance score ---
    // Coarser than Gate 2 (which fires on any medical term); this gate requires
    // at least MIN_CLAIMS_SCORE condition/claims keywords. Catches admin-heavy
    // chunks that passed Gate 2 on a single generic medical term (e.g. "clinic").
    if (isLocalAIMode && chunkScores && chunkScores[i] < MIN_CLAIMS_SCORE) {
      skippedLowScore++;
      // eslint-disable-next-line no-console
      console.log(
        `⏭️ Chunk ${chunkNum}/${totalChunks} skipped (relevance score ${chunkScores[i]} < ${MIN_CLAIMS_SCORE})`,
      );
      chunkResults.push(createEmptyChunkResult());
      continue;
    }

    // --- Gate 4: priority-ordered chunk cap ---
    // Only the top MAX_WEBGPU_AI_CHUNKS chunks by score are processed. Skipped
    // chunks push createEmptyChunkResult() (not failedChunks) so no "Partial Analysis"
    // banner fires — these are intentional skips, not errors.
    if (isLocalAIMode && scoreThreshold > 0 && chunkScores && chunkScores[i] < scoreThreshold) {
      chunkResults.push(createEmptyChunkResult());
      continue;
    }

    onProgress(
      `Analyzing chunk ${chunkNum} of ${totalChunks} (pages ${chunk.startPage}-${chunk.endPage})...`,
      {
        phase: "analyze",
        current: chunkNum,
        total: totalChunks,
        startPage: chunk.startPage,
        endPage: chunk.endPage,
      },
    );

    let result = null;
    let lastError = null;
    // The circuit breaker protects interactive callers, but this batch loop
    // is the legitimate retry owner: when the circuit opens mid-batch, wait
    // out the cooldown and resume instead of letting every remaining chunk
    // fail instantly. Bounded so a genuinely dead engine still aborts.
    let circuitWaits = 0;

    for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
      if (abortController?.signal.aborted) {
        throw new Error("Analysis cancelled by user");
      }

      try {
        if (attempt > 0) {
          onProgress(
            `Retrying chunk ${chunkNum}/${totalChunks} (attempt ${attempt + 1} of ${MAX_CHUNK_RETRIES + 1})...`,
            {
              phase: "chunk-retry",
              current: chunkNum,
              total: totalChunks,
              attempt: attempt + 1,
            },
          );
          await new Promise((resolve) =>
            setTimeout(resolve, CHUNK_RETRY_BACKOFF_MS * attempt),
          );
        }

        result = await analyzeChunk(chunk, chunkNum, totalChunks, onProgress);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        // Message inlined in the string: the console capture wrapper only
        // records the first argument, so a bare error object logs as blank
        console.error(
          `Error analyzing chunk ${chunkNum} (attempt ${attempt + 1}): ${error?.message || error}`,
        );

        if (error.message?.includes("AI_CIRCUIT_OPEN") && circuitWaits < 3) {
          circuitWaits++;
          onProgress(
            `AI engine paused after repeated failures — waiting 30s before resuming chunk ${chunkNum}/${totalChunks}...`,
            { phase: "circuit-wait", current: chunkNum, total: totalChunks },
          );
          await new Promise((resolve) => setTimeout(resolve, 31000));
          resetAICircuitBreaker();
          attempt--; // circuit downtime doesn't consume a retry
          continue;
        }

        // Context window errors are deterministic — retrying cannot help.
        // unifiedAIService transforms the raw ContextWindowSizeExceededError into
        // "📏 Document is too large for Local AI" before it reaches this catch, so
        // the check covers both forms. Use an empty result (not a failedChunks
        // entry) so the Partial Analysis banner does not fire for this skip, and
        // the circuit breaker does not open on a single overflowing chunk.
        if (
          error.message?.includes("context window") ||
          error.message?.includes("ContextWindowSizeExceededError") ||
          error.message?.includes("too large for Local AI")
        ) {
          result = createEmptyChunkResult();
          break;
        }

        if (error.message === "Analysis cancelled by user") {
          throw error;
        }
      }
    }

    if (result) {
      chunkResults.push(result);

      onProgress(`Chunk ${chunkNum}/${totalChunks} complete`, {
        phase: "chunk-complete",
        current: chunkNum,
        total: totalChunks,
      });
    } else {
      // Record the failure so the final result can show what's missing,
      // then continue — one bad chunk must not abort the run
      failedChunks.push({
        chunkIndex: i,
        startPage: chunk.startPage,
        endPage: chunk.endPage,
        error: lastError?.message || "Unknown error",
      });

      onProgress(
        `⚠️ Chunk ${chunkNum} failed after ${MAX_CHUNK_RETRIES + 1} attempts, continuing...`,
        {
          phase: "chunk-error",
          current: chunkNum,
          total: totalChunks,
          error: lastError?.message,
        },
      );
    }

    // No inter-chunk sleep: local WebGPU AI has no rate limiting.
  }

  if (skippedLowScore > 0) {
    // eslint-disable-next-line no-console
    console.log(`📊 Pre-flight skipped ${skippedLowScore} low-relevance chunks (score < ${MIN_CLAIMS_SCORE})`);
  }

  if (chunkResults.length === 0) {
    throw new Error(
      "All chunks failed to process. Please try again or use a smaller file.",
    );
  }

  // Merge all results
  onProgress("Merging analysis results...", { phase: "merge" });
  const mergedResult = mergeChunkResults(chunkResults);

  // Anti-hallucination gate on the MERGED result: any diagnostic code not in
  // the 38 CFR Part 4 database is stripped before the veteran ever sees it
  const rejectedCodes = enforceValidDiagnosticCodes(mergedResult);
  mergedResult.failedChunks = failedChunks;

  onProgress("Analysis complete!", { phase: "complete" });

  return {
    success: true,
    analysis: mergedResult,
    metadata: {
      analyzedAt: new Date().toISOString(),
      textLength: fullText.length,
      aiMode: aiMode,
      chunksProcessed: chunkResults.length,
      totalChunks: totalChunks,
      failedChunkCount: failedChunks.length,
      boilerplatePagesSkipped: skippedPages,
      rejectedDiagnosticCodes: rejectedCodes,
    },
  };
}

// Slim system prompt for local AI (3 fields: servicePeriod, potential_claims, timeline).
// Secondary fields (summary, exposures, combatIndicators, mentalHealth, redFlags,
// actionItems) are intentionally omitted — analyzeChunk sanitization and
// mergeChunkResults handle absent fields gracefully as empty arrays/strings.
// Omitting 6 fields reduces decode from ~800-1500 to ~150-500 tokens/chunk.
// potential_claims before timeline preserves priority within the 1024-token budget.
const CFILE_SYSTEM_PROMPT_COMPACT = `You are a VA Claims Auditor. Analyze C-File medical records. Output ONLY valid JSON: {"servicePeriod":{"branch":"","entryDate":"","separationDate":"","mos":""},"potential_claims":[{"condition":"","likelihood":"high|medium|low","inServiceEvent":"","currentDiagnosis":"yes|no|unclear","missing_element":""}],"timeline":[{"date":"","page_number":0,"category":"","description":"","significance":"high|medium|low"}]}. Rules: every string MUST be quoted; no newlines in values; values under 8 words; max 2 items in potential_claims array; max 1 item in timeline array; ALWAYS put a comma between array elements; omit fields where nothing found; only report findings present in the text.`;

// Per-page prompt for the page-by-page local-AI path.
// ~200 tokens vs ~600 for CFILE_SYSTEM_PROMPT_COMPACT — saves 400 tokens × every
// page call (1,200 calls × 400 = 480K fewer prefill tokens per full C-File run).
// Schema differs from chunk schema: "conditions" array maps to potential_claims in
// analyzePage(); servicePeriod uses short field names (entry/sep) to save tokens.
const PAGE_SYSTEM_PROMPT = `VA C-File page analyzer. Output ONLY valid JSON: {"conditions":[{"name":"","dc":0,"evidence":"","likelihood":"high|medium|low","nexus":"yes|no|unclear"}],"timeline":[{"date":"","category":"service|medical|claim","description":""}],"servicePeriod":{"branch":"","entry":"","sep":"","mos":""},"exposures":[],"combatIndicators":[],"mentalHealth":{"diagnoses":[],"indicators":[],"stressors":[]}}. Rules: only extract findings present on this page; keep values under 12 words; no newlines in values.`;

// Fresh empty result for skipped chunks (low-content and admin-only pages).
// MUST be a factory, not a shared singleton: the aggregation step mutates result
// arrays in place, so a reused object would bleed one C-File's findings into the
// next veteran's analysis in the same session (Ab-H01). A shallow spread is not
// enough — the nested arrays/objects must be fresh per call.
export const createEmptyChunkResult = () => ({
  summary: "",
  servicePeriod: {},
  timeline: [],
  potential_claims: [],
  exposures: [],
  combatIndicators: [],
  redFlags: [],
  actionItems: [],
  mentalHealth: { diagnoses: [], indicators: [], stressors: [], pages: [] },
});

// Patterns indicating the chunk has meaningful medical/claims content.
// ANY single match → send to LLM. Zero matches → administrative page, skip.
// Conservative: single patterns cover dates, clinical terms, VA language, body parts.
const MEDICAL_SIGNAL_PATTERNS = [
  // Date-only patterns removed for the same reason as PAGE_RELEVANCE_PATTERN:
  // every page in a VA C-File has dates, so date patterns provided zero filtering.
  // Clinical/medical terminology
  /\b(diagnos\w+|condition|treatment|injur\w+|disease|disorder|syndrome|chronic|acute|pain|surger\w+|operat\w+|medic\w+|prescribed|examin\w+|evaluation|assessment|symptom\w*|complaint|prognos\w+)\b/i,
  // VA / claims language
  /\b(service.?connect\w*|nexus|38\s*cfr|disability|rating|claim|compensation|ptsd|tbi|traumatic|combat|deployment|exposure|agent orange|burn pit|pact act|c&p|service record)\b/i,
  // Body parts and specific conditions
  /\b(knee|shoulder|hip|ankle|wrist|elbow|lumbar|cervical|thoracic|tinnitus|hearing loss|vision|anxiety|depression|headache|migraine|diabetes|hypertension|blood pressure|cardiac|pulmonary|respirat\w+)\b/i,
];

function chunkHasMedicalContent(text) {
  return MEDICAL_SIGNAL_PATTERNS.some((p) => p.test(text));
}

// Returns a claims-relevance score for a chunk of text (0–N, higher = more relevant).
// Runs in <1 ms per chunk; used for priority-ordering before the AI cap is applied.
function scoreChunkRelevance(text) {
  const t = text.toLowerCase();
  let score = 0;

  // ICD-10 codes (A00–Z99 with optional decimal) are a definitive clinical signal —
  // any page with one is a medical record regardless of condition name.
  if (/\b[A-Z]\d{2}\.?\d{0,4}\b/.test(text)) score += 3;

  // Clinical note structure headers (SOAP, radiology, pathology) — present in every
  // encounter note even when the condition name is rare or unlisted below.
  if (/\b(assessment|impression|findings|diagnosis|plan)\s*:/i.test(text)) score += 2;

  const HIGH = [
    "ptsd", "post-traumatic", "tinnitus", "radiculopathy", "pes planus",
    "plantar fasci", "sleep apnea", "migraine", "nexus", "service connection",
    "service-connected", "in-service", "dbq", "disability benefits questionnaire",
    "c&p exam", "rating decision", "service treatment record",
    "traumatic brain", "tbi", "burn pit", "agent orange", "pact act",
  ];
  for (const s of HIGH) {
    if (t.includes(s)) score += 2;
  }

  const MED = [
    "diagnosis", "diagnosed", "chronic", "bilateral", "aggravated", "secondary to",
    "hypertension", "diabetes", "depression", "anxiety", "neuropathy",
    "degenerative", "lumbar", "cervical", "sciatica", "carpal tunnel",
    "hearing loss", "knee", "shoulder", "hip", "ankle", "back pain",
    "deployed", "combat", "active duty", "discharge", "dd-214", "dd214",
    "va medical", "vamc", "progress note", "treatment", "prescribed",
    "etiology", "prognosis", "pathology", "biopsy", "specimen",
    "laboratory", "radiology", "consultation", "referred to",
    "presented with", "complaints of", "history of", "chronic condition",
  ];
  for (const s of MED) {
    if (t.includes(s)) score += 1;
  }

  const ADMIN = [
    "please deliver to", "fax transmittal", "routing slip",
    "authorization to release", "cover sheet", "sign here",
    "signature required", "this form is", "table of contents",
    "page intentionally left blank",
  ];
  for (const s of ADMIN) {
    if (t.includes(s)) score -= 2;
  }

  return Math.max(0, score);
}

// JSON Schema for XGrammar constrained decoding — enforces valid JSON output
// per-token so parse errors and repair retries are impossible. Keep this schema
// constant across all 304 chunk calls (WebLLM issue #560: changing schemas on a
// live engine disposes the matcher and throws).
const CFILE_CHUNK_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    servicePeriod: {
      type: "object",
      properties: {
        branch: { type: "string" },
        entryDate: { type: "string" },
        separationDate: { type: "string" },
        mos: { type: "string" },
      },
    },
    timeline: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          page_number: { type: "integer" },
          category: { type: "string" },
          description: { type: "string" },
          significance: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["date", "description"],
      },
    },
    potential_claims: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          condition: { type: "string" },
          likelihood: { type: "string", enum: ["high", "medium", "low"] },
          inServiceEvent: { type: "string" },
          currentDiagnosis: { type: "string", enum: ["yes", "no", "unclear"] },
          missing_element: { type: "string" },
        },
        required: ["condition"],
      },
    },
    exposures: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          location: { type: "string" },
          timeframe: { type: "string" },
        },
      },
    },
    combatIndicators: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          indicator: { type: "string" },
          page_number: { type: "integer" },
        },
      },
    },
    mentalHealth: {
      type: "object",
      properties: {
        indicators: { type: "array", maxItems: 5, items: { type: "string" } },
        diagnoses: { type: "array", maxItems: 5, items: { type: "string" } },
        stressors: { type: "array", maxItems: 5, items: { type: "string" } },
        pages: { type: "array", maxItems: 5, items: { type: "integer" } },
      },
    },
    redFlags: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          issue: { type: "string" },
          suggestion: { type: "string" },
        },
      },
    },
    actionItems: { type: "array", maxItems: 8, items: { type: "string" } },
  },
  required: ["summary"],
};

/**
 * Analyze a single chunk of text
 */
async function analyzeChunk(chunk, chunkNum, totalChunks, onProgress) {
  // Detect if we're using local AI (smaller context). effectiveMode is the
  // resolved routing target — the raw stored mode can disagree with it
  // (e.g. "auto"), which silently gave local generations the short cloud
  // timeout and the full-size prompt.
  const status = getAIStatus();
  const effectiveMode = status.effectiveMode || status.mode;
  const isLocalAI =
    effectiveMode === AI_MODES.LOCAL ||
    effectiveMode === AI_MODES.SWARM ||
    effectiveMode === AI_MODES.WLLAMA ||
    effectiveMode === AI_MODES.LOCAL_SERVER;

  // Use compact prompt for local AI to maximize document space
  let systemPrompt = isLocalAI
    ? CFILE_SYSTEM_PROMPT_COMPACT
    : CFILE_SYSTEM_PROMPT;

  if (totalChunks > 1) {
    const chunkPrefix = `CHUNK ${chunkNum}/${totalChunks} (Pages ${chunk.startPage}-${chunk.endPage}). Extract findings from THIS chunk only.\n\n`;
    systemPrompt = chunkPrefix + systemPrompt;
  }

  // User prompt is just the document text - system prompt is passed separately
  // PI-02: wrap the untrusted C-file text in spotlight delimiters so the
  // <untrusted_content> tags the BASE_SYSTEM_PROMPT relies on are actually present
  // (an injected instruction inside the document is then framed as DATA, not command).
  const userPrompt = `${untrustedSection("C-FILE TEXT", chunk.text)}\n\nAnalyze and return ONLY the JSON object.`;

  // Local AI: cap output at 1024 tokens. Without XGrammar schema enforcement,
  // maxTokens is respected and decode runs at 30+ tok/s instead of 1.5-3 tok/s.
  const localMaxTokens = isLocalAI
    ? Math.min(getCachedDeviceProfile()?.maxOutputTokens ?? 2048, 1024)
    : 32768;

  // Heartbeat: local AI blocks for ~2 min/chunk with no intermediate callbacks.
  // Without this, the progress UI stalls and triggers the 45s watchdog in the
  // stress test (and gives users a frozen screen). Fires every 30s.
  let heartbeatSecs = 0;
  const heartbeat =
    isLocalAI && onProgress
      ? setInterval(() => {
          heartbeatSecs += 30;
          onProgress(
            `Analyzing chunk ${chunkNum} of ${totalChunks} (pages ${chunk.startPage}-${chunk.endPage})… ${heartbeatSecs}s`,
            { phase: "analyze", current: chunkNum, total: totalChunks },
          );
        }, 30000)
      : null;

  // AIS-05: non-blocking crisis scan over this C-file chunk's raw text — surfaces a
  // passive resources banner if the records contain ideation history, never blocks.
  scanDocumentForCrisis(chunk?.text);
  let response;
  try {
    response = await generateAI(userPrompt, {
      temperature: isLocalAI ? 0.1 : 0.2,
      maxTokens: localMaxTokens,
      expectJSON: true,
      skipCrisisCheck: true,
      skipHallucinationCheck: true,
      useDKB: false,
      // Timeout: prefill at ~25 tok/s + decode at ~30 tok/s (no XGrammar schema)
      // + 120s overhead, 2× safety margin. Minimum 120s (stream:false batch GPU
      // readback completes in ~50s on 4080 SUPER; 600s was for stream:true).
      timeout: isLocalAI
        ? Math.max(
            120_000,
            (Math.ceil(chunk.text.length / CHARS_PER_TOKEN / 25) +
              Math.ceil(localMaxTokens / 30) +
              120) *
              2 *
              1000,
          )
        : 120000,
      toolContext: "C-File Analyzer",
      systemPrompt: systemPrompt,
      // No responseFormat for local AI: XGrammar schema enforcement drops decode
      // from 30 tok/s to 1.5-3 tok/s, making a 304-chunk run take 45+ hours.
      // JSON repair (expectJSON: true) handles any malformed output instead.
      responseFormat: undefined,
    });
  } finally {
    clearInterval(heartbeat);
  }

  const content = response?.text || response;

  if (!content) {
    throw new Error("No analysis content received from AI");
  }

  const contentStr =
    typeof content === "string" ? content : JSON.stringify(content);

  // Parse JSON response
  let cleanContent = contentStr.trim();
  if (cleanContent.startsWith("```json")) {
    cleanContent = cleanContent.slice(7);
  }
  if (cleanContent.startsWith("```")) {
    cleanContent = cleanContent.slice(3);
  }
  if (cleanContent.endsWith("```")) {
    cleanContent = cleanContent.slice(0, -3);
  }
  cleanContent = cleanContent.trim();

  // Check for placeholder/loading responses
  if (
    cleanContent.includes("[Warrant Council") ||
    cleanContent.includes("model is still loading")
  ) {
    throw new Error(
      "Local AI model is still loading. Please wait for the model to fully download before analyzing documents.",
    );
  }

  let analysisResult;
  try {
    analysisResult = JSON.parse(cleanContent);
  } catch (parseError) {
    console.error("JSON Parse Error:", parseError);
    console.error("Content to parse:", cleanContent.substring(0, 500));

    // Attempt to repair truncated JSON
    const repaired = attemptJSONRepair(cleanContent);
    if (repaired) {
      // eslint-disable-next-line no-console
      console.log("✅ Successfully repaired truncated JSON response");
      analysisResult = repaired;
    } else if (!cleanContent.includes("{")) {
      // Model returned plain text with no JSON structure at all — it found nothing
      // to report (e.g. "This page contains administrative records."). Treat as an
      // empty-but-successful chunk so it never lands in failedChunks.
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️ Non-JSON model response (no '{' found) — treating as empty chunk: "${cleanContent.substring(0, 80)}"`,
      );
      return createEmptyChunkResult();
    } else {
      throw new Error(
        `Failed to parse AI response as JSON. The AI may have returned an invalid response. Please try again. Error: ${parseError.message}`,
      );
    }
  }

  // Sanitize result — use Array.isArray for array fields so a repaired object
  // (e.g. timeline:{} instead of timeline:[]) doesn't slip through as truthy.
  return {
    summary: analysisResult.summary || "",
    servicePeriod: analysisResult.servicePeriod || {},
    timeline: Array.isArray(analysisResult.timeline)
      ? analysisResult.timeline
      : [],
    potential_claims: Array.isArray(analysisResult.potential_claims)
      ? analysisResult.potential_claims
      : [],
    exposures: Array.isArray(analysisResult.exposures)
      ? analysisResult.exposures
      : [],
    combatIndicators: Array.isArray(analysisResult.combatIndicators)
      ? analysisResult.combatIndicators
      : [],
    redFlags: Array.isArray(analysisResult.redFlags)
      ? analysisResult.redFlags
      : [],
    actionItems: Array.isArray(analysisResult.actionItems)
      ? analysisResult.actionItems
      : [],
    mentalHealth: {
      diagnoses: Array.isArray(analysisResult.mentalHealth?.diagnoses)
        ? analysisResult.mentalHealth.diagnoses
        : [],
      indicators: Array.isArray(analysisResult.mentalHealth?.indicators)
        ? analysisResult.mentalHealth.indicators
        : [],
      stressors: Array.isArray(analysisResult.mentalHealth?.stressors)
        ? analysisResult.mentalHealth.stressors
        : [],
      pages: Array.isArray(analysisResult.mentalHealth?.pages)
        ? analysisResult.mentalHealth.pages
        : [],
    },
  };
}

// ============================================================================
// PAGE-BY-PAGE PIPELINE (local AI — replaces chunk-based for SWARM/LOCAL/WLLAMA)
// ============================================================================

/**
 * Split fullText (with --- PAGE N --- markers) into an array of {pageNum, text}.
 * No overlap, no size limits — each page is its own entry.
 */
function parseAllPages(fullText) {
  const pageRegex = /--- PAGE (\d+)[^\n]*---/g;
  const pages = [];
  let prev = null;
  let match;
  while ((match = pageRegex.exec(fullText)) !== null) {
    if (prev) {
      pages.push({
        pageNum: parseInt(prev[1], 10),
        text: fullText.slice(prev.index + prev[0].length, match.index).trim(),
      });
    }
    prev = match;
  }
  if (prev) {
    pages.push({
      pageNum: parseInt(prev[1], 10),
      text: fullText.slice(prev.index + prev[0].length).trim(),
    });
  }
  return pages;
}

/**
 * Returns 'skip' for admin-only pages, 'medical' for pages worth sending to AI.
 * Reuses the (now keyword-only) PAGE_RELEVANCE_PATTERN — no separate logic needed.
 */
function classifyPage(text) {
  if (!text || text.trim().length < 50) return "skip";
  return PAGE_RELEVANCE_PATTERN.test(text) ? "medical" : "skip";
}

/**
 * Analyze a single page with the short PAGE_SYSTEM_PROMPT.
 * Returns a chunk-schema-compatible object so mergeChunkResults works unchanged.
 */
async function analyzePage(pageText, pageNum, totalPages, onProgress) {
  const status = getAIStatus();
  const effectiveMode = status.effectiveMode || status.mode;
  const isLocalAI = [
    AI_MODES.LOCAL,
    AI_MODES.SWARM,
    AI_MODES.WLLAMA,
    AI_MODES.LOCAL_SERVER,
  ].includes(effectiveMode);

  // PI-02: spotlight the untrusted page text (treat-as-data delimiters).
  const userPrompt = `${untrustedSection(`C-FILE PAGE ${pageNum}`, pageText)}\n\nExtract findings from this page only. Return ONLY the JSON object.`;

  // 256 output tokens per page is generous — a single VA record page rarely has
  // more than 5-6 conditions + a few timeline entries.
  const maxOutputTokens = 256;

  let heartbeatSecs = 0;
  const heartbeat =
    isLocalAI && onProgress
      ? setInterval(() => {
          heartbeatSecs += 30;
          onProgress(
            `Analyzing page ${pageNum} of ${totalPages}… ${heartbeatSecs}s`,
            { phase: "analyze", current: pageNum, total: totalPages },
          );
        }, 30000)
      : null;

  // AIS-05: non-blocking crisis scan over this page's raw text.
  scanDocumentForCrisis(pageText);
  let response;
  try {
    response = await generateAI(userPrompt, {
      temperature: isLocalAI ? 0.1 : 0.2,
      maxTokens: maxOutputTokens,
      expectJSON: true,
      skipCrisisCheck: true,
      skipHallucinationCheck: true,
      useDKB: false,
      timeout: isLocalAI
        ? Math.max(
            60_000,
            (Math.ceil(pageText.length / CHARS_PER_TOKEN / 25) +
              Math.ceil(maxOutputTokens / 30) +
              30) *
              2 *
              1000,
          )
        : 60000,
      toolContext: "C-File Page Analyzer",
      systemPrompt: PAGE_SYSTEM_PROMPT,
      responseFormat: undefined,
    });
  } finally {
    clearInterval(heartbeat);
  }

  const raw =
    typeof response?.text === "string" ? response.text : String(response || "");
  let clean = raw.trim();
  if (clean.startsWith("```json")) clean = clean.slice(7);
  if (clean.startsWith("```")) clean = clean.slice(3);
  if (clean.endsWith("```")) clean = clean.slice(0, -3);
  clean = clean.trim();

  let pr;
  try {
    pr = JSON.parse(clean);
  } catch {
    const repaired = attemptJSONRepair(clean);
    if (repaired) pr = repaired;
    else
      throw new Error(`Page ${pageNum}: failed to parse AI response as JSON`);
  }

  // Map page-level schema → chunk-compatible schema expected by mergeChunkResults
  return {
    summary: "",
    servicePeriod: {
      branch: pr.servicePeriod?.branch || "",
      entryDate: pr.servicePeriod?.entry || "",
      separationDate: pr.servicePeriod?.sep || "",
      mos: pr.servicePeriod?.mos || "",
    },
    timeline: (Array.isArray(pr.timeline) ? pr.timeline : []).map((t) => ({
      date: t.date || "",
      page_number: pageNum,
      category: t.category || "medical",
      description: t.description || "",
      significance: "medium",
    })),
    potential_claims: (Array.isArray(pr.conditions) ? pr.conditions : [])
      .filter((c) => c && typeof c.name === "string" && c.name.trim())
      .map((c) => ({
        condition: c.name.trim(),
        diagnosticCode: Number.isInteger(c.dc) && c.dc > 0 ? c.dc : null,
        likelihood: c.likelihood || "medium",
        inServiceEvent: c.evidence || "",
        currentDiagnosis: c.nexus === "yes" ? "yes" : "unclear",
        missing_element: "",
      })),
    exposures: (Array.isArray(pr.exposures) ? pr.exposures : []).map((e) =>
      typeof e === "string"
        ? { type: e, description: "", page_number: pageNum }
        : e,
    ),
    combatIndicators: (Array.isArray(pr.combatIndicators)
      ? pr.combatIndicators
      : []
    ).map((c) =>
      typeof c === "string" ? { indicator: c, page_number: pageNum } : c,
    ),
    redFlags: [],
    actionItems: [],
    mentalHealth: {
      diagnoses: pr.mentalHealth?.diagnoses || [],
      indicators: pr.mentalHealth?.indicators || [],
      stressors: pr.mentalHealth?.stressors || [],
      pages:
        pr.mentalHealth?.diagnoses?.length ||
        pr.mentalHealth?.indicators?.length
          ? [pageNum]
          : [],
    },
  };
}

/**
 * Page-by-page orchestrator for local AI modes.
 * Replaces screenRelevantPages + splitIntoChunks + chunk loop for LOCAL/SWARM/WLLAMA.
 * Each page is analyzed individually — smaller prefill, better focus, no overlap waste.
 */
async function analyzePageByPage(
  fullText,
  aiMode,
  onProgress,
  abortController,
) {
  const allPages = parseAllPages(fullText);
  if (allPages.length === 0) {
    throw new Error("No page markers found in document text");
  }

  const medicalPages = allPages.filter((p) => classifyPage(p.text) !== "skip");
  const skippedPages = allPages.length - medicalPages.length;

  // eslint-disable-next-line no-console
  console.log(
    `📄 ${allPages.length} total pages → ${medicalPages.length} medical pages (${skippedPages} admin skipped)`,
  );

  if (medicalPages.length === 0) {
    throw new Error("No medical content found after page classification");
  }

  const totalPages = medicalPages.length;
  const estimatedMin = Math.round((totalPages * 12) / 60); // ~12 s/page estimate
  onProgress(
    `Processing ${totalPages} medical pages (~${estimatedMin} min est.)…`,
    { phase: "multi-chunk", current: 0, total: totalPages },
  );

  const pageResults = [];
  const failedPages = [];

  for (let i = 0; i < medicalPages.length; i++) {
    if (abortController?.signal.aborted) {
      throw new Error("Analysis cancelled by user");
    }

    const { pageNum, text } = medicalPages[i];

    // Gate: near-blank pages (should be rare after classifyPage, but defensive)
    const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (text.trim().length < 100 || alphaCount < 50) {
      pageResults.push(createEmptyChunkResult());
      continue;
    }

    onProgress(`Analyzing page ${pageNum} (${i + 1} of ${totalPages})…`, {
      phase: "analyze",
      current: i + 1,
      total: totalPages,
      startPage: pageNum,
      endPage: pageNum,
    });

    let result = null;
    let lastError = null;
    let circuitWaits = 0;

    for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
      if (abortController?.signal.aborted) {
        throw new Error("Analysis cancelled by user");
      }
      try {
        if (attempt > 0) {
          await new Promise((r) =>
            setTimeout(r, CHUNK_RETRY_BACKOFF_MS * attempt),
          );
        }
        result = await analyzePage(text, pageNum, totalPages, onProgress);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        console.error(
          `Error on page ${pageNum} (attempt ${attempt + 1}): ${error?.message}`,
        );

        if (error.message?.includes("AI_CIRCUIT_OPEN") && circuitWaits < 3) {
          circuitWaits++;
          onProgress(`AI engine paused — waiting 30s before page ${pageNum}…`, {
            phase: "circuit-wait",
            current: i + 1,
            total: totalPages,
          });
          await new Promise((r) => setTimeout(r, 31000));
          resetAICircuitBreaker();
          attempt--;
          continue;
        }

        if (
          error.message?.includes("context window") ||
          error.message?.includes("too large for Local AI")
        ) {
          result = createEmptyChunkResult();
          break;
        }

        if (error.message === "Analysis cancelled by user") throw error;
      }
    }

    if (result) {
      pageResults.push(result);
      onProgress(`Page ${pageNum} complete (${i + 1}/${totalPages})`, {
        phase: "chunk-complete",
        current: i + 1,
        total: totalPages,
      });
    } else {
      failedPages.push({
        pageNum,
        error: lastError?.message || "Unknown error",
      });
    }
  }

  if (pageResults.length === 0) {
    throw new Error(
      "All pages failed to process. Please try again or check AI model status.",
    );
  }

  onProgress("Merging analysis results…", { phase: "merge" });
  const mergedResult = mergeChunkResults(pageResults);
  const rejectedCodes = enforceValidDiagnosticCodes(mergedResult);
  mergedResult.failedChunks = failedPages;

  onProgress("Analysis complete!", { phase: "complete" });

  return {
    success: true,
    analysis: mergedResult,
    metadata: {
      analyzedAt: new Date().toISOString(),
      textLength: fullText.length,
      aiMode,
      chunksProcessed: pageResults.length,
      totalChunks: totalPages,
      failedChunkCount: failedPages.length,
      boilerplatePagesSkipped: skippedPages,
      rejectedDiagnosticCodes: rejectedCodes,
      processingMode: "page-by-page",
    },
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Export JSON repair function for use in other modules (e.g., Muster Call)
 * Attempts to fix truncated JSON responses from AI
 */
export { attemptJSONRepair };

/**
 * Estimate chunks needed for a given text length
 * Useful for showing user what to expect before processing
 */
export function estimateChunks(textLength) {
  const aiStatus = getAIStatus();
  const maxChars = getMaxCharsPerChunk(aiStatus.effectiveMode);
  return Math.ceil(textLength / maxChars);
}

/**
 * Get context window info for current AI mode
 */
export function getContextWindowInfo() {
  const aiStatus = getAIStatus();
  const aiMode = aiStatus.effectiveMode;

  if (
    aiMode === AI_MODES.LOCAL ||
    aiMode === AI_MODES.SWARM ||
    aiMode === AI_MODES.WLLAMA ||
    aiMode === AI_MODES.LOCAL_SERVER
  ) {
    return {
      mode: "Local AI",
      tokenLimit: TOKEN_LIMITS.LOCAL,
      charLimit: TOKEN_LIMITS.LOCAL * CHARS_PER_TOKEN,
      pagesPerChunk: "~8 pages",
      supportsLargeFiles: true,
      note: "Large files automatically split into chunks",
    };
  }

  return {
    mode: "Cloud AI (Gemini)",
    tokenLimit: TOKEN_LIMITS.GEMINI,
    charLimit: TOKEN_LIMITS.GEMINI * CHARS_PER_TOKEN,
    pagesPerChunk: "~2,000 pages",
    supportsLargeFiles: true,
    note: "Very large files (300MB+) split into chunks automatically",
  };
}

/**
 * Get the privacy disclosure for C-File analysis
 * Now AI-mode aware - shows different info for Cloud vs Local
 * @returns {string}
 */
export function getCFilePrivacyDisclosure() {
  const status = getAIStatus();

  if (
    status.effectiveMode === AI_MODES.LOCAL ||
    status.effectiveMode === AI_MODES.SWARM
  ) {
    return `🔒 LOCAL AI MODE - MAXIMUM PRIVACY

When you use the C-File Analyzer:

1. YOUR FILE STAYS LOCAL: Your PDF is read directly in your browser. It is NEVER uploaded anywhere.

2. 100% LOCAL PROCESSING: The extracted text is analyzed ENTIRELY ON YOUR DEVICE by the Local AI model.

3. ZERO DATA TRANSMISSION: Nothing is sent over the internet. All processing happens in your browser using WebGPU.

4. NO STORAGE: We do not save any part of your C-File or analysis results. Everything exists only in your browser session.

5. SENSITIVE DATA: C-Files contain highly sensitive information. Even with local processing, use this tool on a private, secure device.

6. LARGE FILE SUPPORT: Files of ANY size are supported. Large files are automatically split into chunks and processed sequentially, then merged.

✅ This is the most private way to analyze your C-File.`;
  }

  return `☁️ CLOUD AI MODE (Google Gemini)

When you use the C-File Analyzer:

1. YOUR FILE STAYS LOCAL: Your PDF is read directly in your browser. It is NEVER uploaded to Vet-Rate.org servers.

2. TEXT ONLY TO AI: Only the extracted TEXT is sent to Google's Gemini AI for analysis. Images and formatting are stripped out.

3. YOUR API KEY: You provide your own Google Gemini API key. We never see or store your key.

4. NO STORAGE: We do not save any part of your C-File or analysis results. Everything exists only in your browser session.

5. GOOGLE'S POLICY: The text sent to Gemini is subject to Google's privacy policy and data handling practices.

6. SENSITIVE DATA: C-Files contain highly sensitive medical and personal information. Only use this tool on a private, secure device.

7. LARGE FILE SUPPORT: Files of ANY size are supported. Very large files (300MB+) are automatically split into chunks and processed sequentially.

💡 TIP: For 100% privacy, switch to Local AI in settings (requires WebGPU-compatible browser).

By proceeding, you acknowledge that:
- You are voluntarily sending extracted text to Google's AI service
- You understand your data is processed according to Google's policies
- You accept responsibility for using this tool securely`;
}
