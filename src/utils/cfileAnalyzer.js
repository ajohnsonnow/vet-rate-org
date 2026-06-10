/**
 * Vet-Rate.org - C-File AI Analysis Service
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
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
  SWARM_8K: 4500, // 8192 − 900 − 1500, with margin for DKB context injection
  LOCAL_4K: 1500, // 4096 − 900 − 1500, with margin
};

// Approximate chars per token (English text averages ~4 chars/token)
const CHARS_PER_TOKEN = 4;

// Maximum characters per chunk based on AI mode
const getMaxCharsPerChunk = (aiMode) => {
  if (aiMode === AI_MODES.SWARM) {
    return TOKEN_LIMITS.SWARM_8K * CHARS_PER_TOKEN; // ~18K chars
  }
  if (
    aiMode === AI_MODES.LOCAL ||
    aiMode === AI_MODES.WLLAMA ||
    aiMode === AI_MODES.LOCAL_SERVER
  ) {
    return TOKEN_LIMITS.LOCAL_4K * CHARS_PER_TOKEN; // ~6K chars
  }
  return TOKEN_LIMITS.GEMINI * CHARS_PER_TOKEN; // ~3.2M chars for cloud
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

  let content = jsonStr.trim();

  // Remove any trailing incomplete values
  // Find the last complete property-value pair
  const strategies = [
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
    // Strategy 3: Extract just the core fields we need
    () => {
      // Try to find and extract key fields
      const result = {
        summary: "",
        servicePeriod: {},
        timeline: [],
        potential_claims: [],
        exposures: [],
        combatIndicators: [],
        redFlags: [],
        actionItems: [],
        mentalHealth: {
          diagnoses: [],
          indicators: [],
          stressors: [],
          pages: [],
        },
      };

      // Extract summary if present
      const summaryMatch = content.match(/"summary"\s*:\s*"([^"]+)"/);
      if (summaryMatch) result.summary = summaryMatch[1];

      // If we got at least a summary, return partial result
      if (result.summary) {
        // eslint-disable-next-line no-console
        console.log("📝 Extracted partial data from truncated response");
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
    "\\b(19|20)\\d{2}\\b", // any year
    "\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}", // numeric dates
    "diagnos|symptom|treat|pain|injur|condition|exam|clinic|medical|health",
    "service[- ]connect|rating|disab|compensat|claim|nexus|c&p|dbq",
    "surger|prescri|medicat|therap|mental|ptsd|anxiet|depress",
    "hearing|tinnitus|knee|back|spine|shoulder|hip|ankle|migraine|sleep",
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
  let skippedPages = 0;
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = i + 1 < markers.length ? markers[i + 1].index : fullText.length;
    const block = fullText.slice(start, end);
    const body = block.slice(markers[i][0].length);
    if (PAGE_RELEVANCE_PATTERN.test(body)) {
      kept.push(block);
    } else {
      skippedPages++;
    }
  }

  if (kept.length < markers.length * 0.1) {
    // Filter looks wrong for this document — analyze everything instead.
    return { text: fullText, totalPages: markers.length, skippedPages: 0 };
  }
  return {
    text: kept.join(""),
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
  // Base time per chunk (seconds): cloud round-trip vs local generation
  const baseTimePerChunk =
    aiMode === AI_MODES.CLOUD ? 30 : aiMode === AI_MODES.SWARM ? 25 : 45;

  const totalSeconds = chunkCount * baseTimePerChunk;

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

  // Local engines generate sequentially — skip boilerplate pages (cover
  // sheets, blanks, form instructions) so only claim-relevant content
  // spends LLM time. Cloud mode reads everything (1M context, few calls).
  let analysisText = fullText;
  let skippedPages = 0;
  if (aiMode !== AI_MODES.CLOUD) {
    const screened = screenRelevantPages(fullText);
    analysisText = screened.text;
    skippedPages = screened.skippedPages;
    if (skippedPages > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `🧹 Skipping ${skippedPages}/${screened.totalPages} boilerplate pages before AI analysis`,
      );
    }
  }

  // Split into chunks based on AI context limits
  const chunks = splitIntoChunks(analysisText, aiMode);
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

  for (let i = 0; i < chunks.length; i++) {
    // Check if aborted
    if (abortController?.signal.aborted) {
      throw new Error("Analysis cancelled by user");
    }

    const chunk = chunks[i];
    const chunkNum = i + 1;

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

        // Context window errors are deterministic — retrying cannot help
        if (
          error.message?.includes("context window") ||
          error.message?.includes("ContextWindowSizeExceededError")
        ) {
          throw new Error(
            `Context window exceeded. This document is too large for the current AI model. Try using Cloud AI (Gemini) instead, or split your document into smaller files.`,
          );
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

    // Small delay between chunks to avoid rate limiting
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
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

// Compact system prompt for local AI — JSON structure is enforced by XGrammar,
// so the OUTPUT FORMAT example is removed to save ~80 prefill tokens per chunk
// (paid 304 times with no KV caching between calls).
const CFILE_SYSTEM_PROMPT_COMPACT = `You are a VA Claims Auditor. Analyze C-File medical records and extract service-connected conditions, timeline events, and evidence. Only report findings present in the text. Track "--- PAGE X ---" markers for page numbers. Output valid JSON only.`;

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
        indicators: { type: "array", items: { type: "string" } },
        diagnoses: { type: "array", items: { type: "string" } },
        stressors: { type: "array", items: { type: "string" } },
        pages: { type: "array", items: { type: "integer" } },
      },
    },
    redFlags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          issue: { type: "string" },
          suggestion: { type: "string" },
        },
      },
    },
    actionItems: { type: "array", items: { type: "string" } },
  },
  required: ["summary"],
};

/**
 * Analyze a single chunk of text
 */
async function analyzeChunk(chunk, chunkNum, totalChunks, _onProgress) {
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
  const userPrompt = `--- BEGIN C-FILE TEXT ---\n\n${chunk.text}\n\n--- END C-FILE TEXT ---\n\nAnalyze and return ONLY the JSON object.`;

  const response = await generateAI(userPrompt, {
    temperature: 0.2,
    maxTokens: isLocalAI ? 2048 : 32768,
    expectJSON: true,
    skipCrisisCheck: true,
    skipHallucinationCheck: true,
    useDKB: false,
    timeout: isLocalAI ? 300000 : 120000,
    toolContext: "C-File Analyzer",
    systemPrompt: systemPrompt,
    // XGrammar constrained decoding: guarantees valid JSON on every chunk,
    // eliminates JSON-repair retries, and bounds decode tokens to schema.
    // Only for local AI — cloud models handle JSON reliably via prompting.
    responseFormat: isLocalAI ? CFILE_CHUNK_SCHEMA : undefined,
  });

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
    } else {
      throw new Error(
        `Failed to parse AI response as JSON. The AI may have returned an invalid response. Please try again. Error: ${parseError.message}`,
      );
    }
  }

  // Sanitize result
  return {
    summary: analysisResult.summary || "",
    servicePeriod: analysisResult.servicePeriod || {},
    timeline: analysisResult.timeline || [],
    potential_claims: analysisResult.potential_claims || [],
    exposures: analysisResult.exposures || [],
    combatIndicators: analysisResult.combatIndicators || [],
    redFlags: analysisResult.redFlags || [],
    actionItems: analysisResult.actionItems || [],
    mentalHealth: {
      diagnoses: analysisResult.mentalHealth?.diagnoses || [],
      indicators: analysisResult.mentalHealth?.indicators || [],
      stressors: analysisResult.mentalHealth?.stressors || [],
      pages: analysisResult.mentalHealth?.pages || [],
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
