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
  reloadSwarmEngine,
  AI_MODES,
} from "./unifiedAIService";
import {
  validateDiagnosticCode,
  lookupDiagnosticCodeByName,
} from "./hallucinationTrap";
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

// Pre-flight scoring passes ALL medically-relevant chunks to the LLM. The 10k
// value is a safety valve against pathological documents only — in practice a
// 313 MB C-File produces ~284 chunks.
// MIN_CLAIMS_SCORE = 0 disables the relevance floor (Gate 3): every chunk that
// clears the blank-page (Gate 1) and any-medical-signal (Gate 2) pre-filters is
// sent to the AI, so no page carrying potential claim evidence is skipped for a
// low keyword score. This is the "no missing data" full-coverage policy — it
// trades longer runtime on large files for completeness. Gates 1/2 still drop
// genuinely blank / zero-signal pages, which carry nothing to lose.
const MAX_WEBGPU_AI_CHUNKS = 10_000;
const MIN_CLAIMS_SCORE = 0;

/**
 * Pure computation of which local-AI chunks get excluded, and why. This is the
 * single source of truth the analysis loop consults for its cap/floor skip
 * decisions, so unit-testing this function tests the real exclusion behaviour
 * (no drift between a helper and the loop).
 *
 * Two independent exclusion gates, mirroring the loop:
 *   - floor (Gate 3): score < `minClaimsScore` — admin-heavy chunks that cleared
 *     the coarser medical pre-filter on a single generic term.
 *   - cap   (Gate 4): only the top `maxAiChunks` chunks by score run the slow
 *     pass; the rest are excluded (soft on ties — matches `scoreThreshold`).
 * A chunk excluded by the floor is not also counted under the cap.
 *
 * These caps protect a real per-chunk time budget on low-end devices and are
 * NOT removed — S24 makes their effect visible (and decouples the semantic
 * index from them) rather than eliminating them.
 *
 * @param {number[]} chunkScores
 * @param {{maxAiChunks:number, minClaimsScore:number}} params
 * @returns {{floorIndices:Set<number>, capIndices:Set<number>}}
 */
export function computeAiExclusion(
  chunkScores,
  {
    maxAiChunks = MAX_WEBGPU_AI_CHUNKS,
    minClaimsScore = MIN_CLAIMS_SCORE,
  } = {},
) {
  const floorIndices = new Set();
  const capIndices = new Set();
  if (!Array.isArray(chunkScores) || chunkScores.length === 0) {
    return { floorIndices, capIndices };
  }
  chunkScores.forEach((s, i) => {
    if (s < minClaimsScore) floorIndices.add(i);
  });
  if (chunkScores.length > maxAiChunks) {
    const threshold = [...chunkScores].sort((a, b) => b - a)[maxAiChunks - 1];
    if (threshold > 0) {
      chunkScores.forEach((s, i) => {
        if (!floorIndices.has(i) && s < threshold) capIndices.add(i);
      });
    }
  }
  return { floorIndices, capIndices };
}

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
// 2 retries (3 attempts): deliberately aligned with CIRCUIT_BREAKER_THRESHOLD
// (3 consecutive generation failures) so a chunk's retries never trip the
// breaker mid-recovery and incur its 30s cooldown. Recovery of a chunk that
// truncated its JSON is driven instead by the per-attempt output-token
// escalation in _requestChunkAnalysis (2048→4096→6144) — a chunk that still
// can't parse after all 3 attempts fails loudly (never a silent drop).
const MAX_CHUNK_RETRIES = 2;
const CHUNK_RETRY_BACKOFF_MS = 1000;

// How many times a single chunk may trigger a full GPU-engine rebuild before
// the run aborts. Generous because each recovery reloads a fresh WebGPU adapter
// and the model weights (~1-3 min), which clears the "adapter consumed" /
// hung-compute state that causes the freeze. If the GPU is physically dead this
// still terminates instead of looping forever — but it never silently drops the
// chunk, because missing medical evidence is unacceptable for a VA claim.
const MAX_GPU_RECOVERIES = 5;

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
function _repairNormalizeControlChars(content) {
  return JSON.parse(content.replace(/\r\n|\r|\n/g, " "));
}

function _repairMissingOpeningQuote(content) {
  const fixed = content.replace(
    // eslint-disable-next-line sonarjs/slow-regex -- best-effort JSON repair on AI output; on ReDoS-slow input this strategy simply fails and the next fallback strategy runs
    /(:\s*)(?!")(?!true\b|false\b|null\b|[\d[{-])([^"\n]+?)("\s*[,\n}\]])/g,
    (_, colon, value, closingPart) => `${colon}"${value.trim()}${closingPart}`,
  );
  return JSON.parse(fixed);
}

function _repairCloseOpenBrackets(content) {
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
}

function _repairInsertMissingCommas(content) {
  // eslint-disable-next-line sonarjs/slow-regex -- best-effort JSON repair on AI output; on ReDoS-slow input this strategy simply fails and the next fallback strategy runs
  const fixed = content.replace(/\}\s*\n(\s*)\{/g, "},\n$1{");
  return JSON.parse(fixed);
}

function _repairStripPreamble(content) {
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
}

function _scanJsonCharForDepth(char, state) {
  if (state.escapeNext) {
    state.escapeNext = false;
    return;
  }

  if (char === "\\" && state.inString) {
    state.escapeNext = true;
    return;
  }

  if (char === '"' && !state.escapeNext) {
    state.inString = !state.inString;
    return;
  }

  if (!state.inString) {
    if (char === "{" || char === "[") state.depth++;
    if (char === "}" || char === "]") {
      state.depth--;
      if (state.depth === 0) state.lastCompleteIndex = state.index;
    }
  }
}

function _repairFindLastCompleteObject(content) {
  const state = {
    depth: 0,
    lastCompleteIndex: -1,
    inString: false,
    escapeNext: false,
    index: 0,
  };

  for (let i = 0; i < content.length; i++) {
    state.index = i;
    _scanJsonCharForDepth(content[i], state);
  }

  if (state.lastCompleteIndex > 0) {
    return JSON.parse(content.substring(0, state.lastCompleteIndex + 1));
  }
  return null;
}

function _repairSingleQuotes(content) {
  return JSON.parse(content.replace(/'/g, '"'));
}

function _repairUnquotedPropertyNames(content) {
  const fixed = content.replace(
    /([{,])\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g,
    '$1 "$2":',
  );
  return JSON.parse(fixed);
}

function _repairRegexFieldExtraction(content) {
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

  // Pull condition+likelihood pairs from any fragment of the response
  const claimRe =
    /"condition"\s*:\s*"([^"]+)"[^}]*?"likelihood"\s*:\s*"([^"]+)"/g;
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

  const hasServiceData = Object.values(result.servicePeriod).some(
    (v) => typeof v === "string" && v.trim() !== "",
  );
  if (result.potential_claims.length > 0 || hasServiceData) {
    // eslint-disable-next-line no-console
    console.log(
      `📝 Regex fallback: extracted ${result.potential_claims.length} claim(s) from truncated output`,
    );
    return result;
  }

  // Nothing recoverable from this malformed response. Return null (NOT an empty
  // template) so _parseChunkAiResponse re-throws, _runChunkWithRetries requests
  // a fresh response, and — only if the chunk stays unrecoverable across every
  // retry — it lands in failedChunks and fires the Partial-analysis banner.
  // Emitting an empty template here would silently drop the chunk's pages with
  // no signal, the one failure this pipeline must never hide. A genuinely empty
  // administrative page returns VALID empty JSON that parses without ever
  // reaching this last-resort strategy, so this cannot suppress real empties.
  // eslint-disable-next-line no-console
  console.warn(
    `📝 Regex fallback: no structured data extractable — signalling failure so the chunk retries instead of dropping`,
  );
  return null;
}

function _repairTruncateBeforeOpenString(content) {
  // Walk the content with proper escape/string-boundary tracking to find the
  // last structural separator (comma or closing bracket) that is OUTSIDE any
  // open string. When the model runs out of tokens mid-value — especially
  // values that contain embedded escaped quotes, which defeat the simpler
  // [^"]* regex in _repairCloseOpenBrackets — we end up inside an unclosed
  // string. Truncate at the last safe structural position, remove any trailing
  // comma, then close remaining open brackets with a count-based pass.
  let inStr = false;
  let esc = false;
  let lastStructuralPos = -1;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\" && inStr) {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (!inStr && (c === "," || c === "}" || c === "]")) {
      lastStructuralPos = i;
    }
  }

  // Only valuable when we end inside an unclosed string — other strategies
  // already handle content that ends outside a string.
  if (!inStr || lastStructuralPos === -1) return null;

  let truncated = content.slice(0, lastStructuralPos + 1).replace(/,\s*$/, "");

  // Close open brackets. Count-based is safe here because the truncation
  // point is a structural separator (not inside a string), so the remaining
  // open structure is predictable. Unbalanced braces inside string LITERALS
  // in the retained portion are still present but cancel out in the count.
  const ob = (truncated.match(/{/g) || []).length;
  const cb = (truncated.match(/}/g) || []).length;
  const oB = (truncated.match(/\[/g) || []).length;
  const cB = (truncated.match(/]/g) || []).length;
  for (let i = 0; i < oB - cB; i++) truncated += "]";
  for (let i = 0; i < ob - cb; i++) truncated += "}";

  return JSON.parse(truncated);
}

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
    _repairNormalizeControlChars,
    // Strategy 0b: Fix missing OPENING quote on string values.
    // Model sometimes writes  "key": The text here."  instead of  "key": "The text here."
    // Match: colon, not-a-quote (not already quoted / not null/true/false/number),
    // any non-quote non-newline chars, then a closing quote before a JSON separator.
    _repairMissingOpeningQuote,
    // Strategy 1: Close all open brackets/braces
    _repairCloseOpenBrackets,
    // Strategy 1b: Insert missing commas between consecutive array elements.
    // Model sometimes emits [{...} {...}] without the separating comma.
    // The pattern only appears at array-element boundaries in our schema output;
    // it does not occur inside quoted string values (which never contain bare `}{`).
    _repairInsertMissingCommas,
    // Strategy 1c: Strip text preamble before the first '{', then close brackets.
    // Model sometimes outputs explanatory prose before the JSON object, e.g.
    // "Based on the records: {..." — all prior strategies fail because the
    // non-JSON prefix makes the string unparseable from position 0.
    _repairStripPreamble,
    // Strategy 1d: Truncate at the last structural separator outside any open
    // string, then close remaining brackets. Handles the case where the model
    // runs out of tokens mid-string-value when the value contains embedded
    // escaped quotes — the simple [^"]* regex in Strategy 1 cannot find the
    // match in that case, but a proper escape-aware scan can.
    _repairTruncateBeforeOpenString,
    // Strategy 2: Find last complete object at top level
    _repairFindLastCompleteObject,
    // Strategy 2b: Single-quote normalization.
    // Local models occasionally emit valid-JS but invalid-JSON single-quoted output:
    // {'condition': 'PTSD', 'likelihood': 'high'}. Simple global replace works when
    // field values contain no apostrophes; the try/catch discards it otherwise.
    _repairSingleQuotes,
    // Strategy 3: Fix unquoted property names (JSON5-style output from the model)
    // e.g.  {summary: "...", timeline: [...]} → {"summary": "...", "timeline": [...]}
    // Applies the substitution only at structural positions ({, or ,) to avoid
    // touching identifier-like text inside string values.
    _repairUnquotedPropertyNames,
    // Strategy 4: Regex field extraction — last-resort for badly truncated output.
    // Extracts individual condition names and servicePeriod fields even when the
    // surrounding JSON structure is unrecoverable. Works with the slim 3-field
    // schema (no summary field) unlike the previous summary-only fallback.
    _repairRegexFieldExtraction,
  ];

  for (const strategy of strategies) {
    try {
      const result = strategy(content);
      if (result && typeof result === "object") {
        return result;
      }
    } catch {
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
function _parsePageMarkers(fullText) {
  const pageMarkerRegex = /--- PAGE (\d+) ---/g;
  const pages = [];
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
  }

  return pages;
}

// Greedily packs pages into chunks under maxCharsPerChunk, starting a new
// chunk once the current one would overflow (and has enough pages to be
// worth splitting), carrying CHUNK_OVERLAP_PAGES of context into the next.
function _buildTextChunks(fullText, pages, maxCharsPerChunk) {
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

  return chunks;
}

function splitIntoChunks(fullText, aiMode) {
  const maxCharsPerChunk = getMaxCharsPerChunk(aiMode);
  const pages = _parsePageMarkers(fullText);

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

  const chunks = _buildTextChunks(fullText, pages, maxCharsPerChunk);

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
  // eslint-disable-next-line sonarjs/slow-regex -- bounded [^\n]* between literal markers we generate ourselves, not exponential backtracking
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
  let baseTimePerChunk;
  if (aiMode === AI_MODES.CLOUD) {
    baseTimePerChunk = 30;
  } else if (aiMode === AI_MODES.SWARM) {
    baseTimePerChunk = localRate;
  } else {
    baseTimePerChunk = 45;
  }

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
function _mergeServicePeriod(merged, chunkResults) {
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
}

function _mergeTimeline(merged, chunkResults) {
  // Merge timelines and sort chronologically
  for (const result of chunkResults) {
    if (result.timeline && Array.isArray(result.timeline)) {
      merged.timeline.push(...result.timeline);
    }
  }
  merged.timeline = deduplicateTimeline(merged.timeline);
  merged.timeline.sort(compareDates);
}

function _mergePotentialClaims(merged, chunkResults) {
  // Merge potential claims with deduplication by condition name
  for (const result of chunkResults) {
    if (result.potential_claims && Array.isArray(result.potential_claims)) {
      merged.potential_claims.push(...result.potential_claims);
    }
  }
  merged.potential_claims = deduplicateClaims(merged.potential_claims);
}

function _mergeExposures(merged, chunkResults) {
  // Merge exposures with deduplication
  for (const result of chunkResults) {
    if (result.exposures && Array.isArray(result.exposures)) {
      merged.exposures.push(...result.exposures);
    }
  }
  merged.exposures = deduplicateByField(merged.exposures, "type");
}

function _mergeCombatIndicators(merged, chunkResults) {
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
}

function _mergeMentalHealth(merged, chunkResults) {
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
}

function _mergeRedFlags(merged, chunkResults) {
  // Merge red flags
  for (const result of chunkResults) {
    if (result.redFlags && Array.isArray(result.redFlags)) {
      merged.redFlags.push(...result.redFlags);
    }
  }
  merged.redFlags = deduplicateByField(merged.redFlags, "issue");
}

function _mergeActionItems(merged, chunkResults) {
  // Merge action items (deduplicate similar items)
  const allActions = [];
  for (const result of chunkResults) {
    if (result.actionItems && Array.isArray(result.actionItems)) {
      allActions.push(...result.actionItems);
    }
  }
  merged.actionItems = deduplicateActionItems(allActions);
}

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

  _mergeServicePeriod(merged, chunkResults);

  _mergeTimeline(merged, chunkResults);

  _mergePotentialClaims(merged, chunkResults);

  _mergeExposures(merged, chunkResults);

  _mergeCombatIndicators(merged, chunkResults);

  _mergeMentalHealth(merged, chunkResults);

  _mergeRedFlags(merged, chunkResults);

  _mergeActionItems(merged, chunkResults);

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
function _findMonthNameMatch(str, monthNames) {
  for (let i = 0; i < monthNames.length; i++) {
    if (str.includes(monthNames[i])) return i + 1;
  }
  return 0;
}

function _extractNumericMonthDay(str) {
  const ymd = str.match(/\b\d{4}-(\d{1,2})(?:-(\d{1,2}))?/);
  if (ymd) {
    return {
      month: parseInt(ymd[1], 10),
      day: ymd[2] ? parseInt(ymd[2], 10) : 0,
    };
  }
  const mdy = str.match(/\b(\d{1,2})\/(?:(\d{1,2})\/)?\d{4}/);
  if (mdy) {
    return {
      month: parseInt(mdy[1], 10),
      day: mdy[2] ? parseInt(mdy[2], 10) : 0,
    };
  }
  return { month: 0, day: 0 };
}

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

  let month = _findMonthNameMatch(str, monthNames);
  let day = 0;

  if (month) {
    const dayMatch = str.match(/\b(\d{1,2})\b/);
    if (dayMatch) day = parseInt(dayMatch[1], 10);
  } else {
    const numeric = _extractNumericMonthDay(str);
    month = numeric.month;
    day = numeric.day;
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
// GROUNDED-TERM SAFETY NET (recall floor)
// ============================================================================

// A handful of explicit, unambiguous ratable diagnoses that are frequently
// documented exactly ONCE — as a single checkbox line on a dense full-body
// exam form (e.g. the FEET section of a DD Form 2808) — and therefore lose to
// louder findings under the compact chunk prompt's "max 3 claims per chunk"
// cap. Each entry pairs the canonical condition name with a tight regex that
// matches the literal clinical term (with minimal OCR/spelling tolerance).
//
// This is grounded extraction, NOT fabrication: a condition is surfaced only
// when its exact name is literally present in the veteran's own records. Each
// carries its CANONICAL 38 CFR Part 4 diagnostic code — a deterministic
// condition→code mapping verified against disabilityData.json, not a model
// guess — so enforceValidDiagnosticCodes accepts it and the veteran sees a
// real, correct DC. The nearest preceding page marker is attached as evidence
// so the finding is auditable. `dc` MUST exist in disabilityData.json or the
// hallucination gate would null it (defeating the badge); verified by the
// surfaceDocumentedConditions unit tests.
const DOCUMENTED_CONDITION_TERMS = [
  { name: "Pes Planus", dc: "5276", pattern: /\bpes\s+planus\b/i }, // 5276 Flatfoot, acquired
  { name: "Pes Cavus", dc: "5278", pattern: /\bpes\s+cavus\b/i }, // 5278 Claw foot (pes cavus)
  {
    name: "Plantar Fasciitis",
    dc: "5269", // 5269 Plantar fasciitis
    pattern: /\bplantar\s+fasci(itis|it[iy]s)?\b/i,
  },
  { name: "Hallux Valgus", dc: "5280", pattern: /\bhallux\s+valgus\b/i }, // 5280 Hallux valgus
];

// Nearest "--- PAGE N ---" marker at or before a character index, so a
// grounded finding can cite the page it was read from.
function _pageNumberAtIndex(fullText, idx) {
  const re = /--- PAGE (\d+)/g;
  let page = null;
  let m;
  while ((m = re.exec(fullText)) !== null && m.index <= idx) {
    page = Number.parseInt(m[1], 10);
  }
  return page;
}

/**
 * Ensure explicit, literally-documented diagnoses that the model under-recalled
 * still reach the veteran. Mutates merged.potential_claims in place. A term is
 * added only when (a) it is present in the raw C-File text AND (b) no existing
 * claim already names it (including inside a comma-joined condition string).
 */
export function surfaceDocumentedConditions(merged, fullText) {
  if (!fullText || !merged || !Array.isArray(merged.potential_claims)) {
    return [];
  }
  const added = [];
  for (const { name, dc, pattern } of DOCUMENTED_CONDITION_TERMS) {
    const match = pattern.exec(fullText);
    if (!match) continue;
    const already = merged.potential_claims.some(
      (c) => c && pattern.test(c.condition || ""),
    );
    if (already) continue;
    const pageNum = _pageNumberAtIndex(fullText, match.index);
    const pageCite = pageNum ? ` (see page ${pageNum})` : "";
    merged.potential_claims.push({
      condition: name,
      diagnosticCode: dc,
      likelihood: "medium",
      inServiceEvent: "",
      currentDiagnosis: "unclear",
      nexusStrength: "unclear",
      missing_element:
        "Auto-surfaced from an explicit mention in your records — confirm the diagnosis and its service connection.",
      evidence_pages: pageNum ? [pageNum] : [],
      recommendation: `"${name}" is named in your records${pageCite}. Verify it against your exam findings and file if applicable.`,
      source: "documented-term-scan",
    });
    added.push(name);
  }
  if (added.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `🔎 Grounded-term safety net surfaced ${added.length} documented condition(s): ${added.join(", ")}`,
    );
  }
  return added;
}

/**
 * Fill diagnostic codes for model-extracted claims that arrive without one.
 * The compact chunk prompt (CFILE_SYSTEM_PROMPT_COMPACT) omits the
 * diagnosticCode field to save decode tokens, so every LLM claim is code-less
 * and renders no DC badge. This restores a code ONLY via a grounded,
 * normalized-exact name match against the 38 CFR Part 4 schedule
 * (lookupDiagnosticCodeByName) — never a fuzzy guess: a claim with no confident
 * match, or a multi-condition free-text list, keeps its null code.
 * enforceValidDiagnosticCodes still runs afterward as the final gate, so even a
 * theoretically bad code cannot reach the veteran. Mutates in place; returns
 * the count enriched.
 */
export function enrichClaimsWithDiagnosticCodes(analysis) {
  if (!analysis || !Array.isArray(analysis.potential_claims)) return 0;
  let enriched = 0;
  for (const claim of analysis.potential_claims) {
    if (!claim || claim.diagnosticCode) continue;
    const code = lookupDiagnosticCodeByName(claim.condition);
    if (code) {
      claim.diagnosticCode = code;
      enriched++;
    }
  }
  if (enriched > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `🔖 Enriched ${enriched} extracted condition(s) with grounded diagnostic codes`,
    );
  }
  return enriched;
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
function _buildSemanticOpts(onProgress, abortController, options) {
  // S24 semantic-index options. `buildSemanticIndex` defaults ON in the app;
  // tests disable it (or inject `semanticEmbed`/`semanticStore`) to avoid the
  // real embedder + IndexedDB. `semanticSessionKey` namespaces this document's
  // vectors so the results UI can search them afterward.
  const {
    buildSemanticIndex = true,
    semanticSessionKey = `cfile_sem_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    semanticEmbed,
    semanticStore,
  } = options;
  return {
    sessionKey: semanticSessionKey,
    onProgress,
    signal: abortController?.signal,
    embed: semanticEmbed,
    store: semanticStore,
    enabled: buildSemanticIndex,
  };
}

async function _determineAiModeAndChunks(fullText, onProgress) {
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
  // NOTE: _analyzePageByPage exists but is NOT used yet — WebLLM's ~14 s fixed
  // overhead per call × 1755 page calls = 12+ hours vs chunk-based ~260 min.
  // The right future path is page-level parsing + small-batch AI (3-5 pages).
  const isLocalAIMode = [
    AI_MODES.LOCAL,
    AI_MODES.SWARM,
    AI_MODES.WLLAMA,
    AI_MODES.LOCAL_SERVER,
  ].includes(aiMode);

  const screened = screenRelevantPages(fullText);
  const analysisText = screened.text;
  const skippedPages = screened.skippedPages;
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

  // eslint-disable-next-line no-console
  console.log(
    `📊 Analysis plan: ${chunks.length} chunk(s), AI mode: ${aiMode}`,
  );

  return { aiMode, isLocalAIMode, chunks, skippedPages };
}

async function _analyzeSingleChunkPath(
  chunks,
  aiMode,
  fullText,
  skippedPages,
  semanticOpts,
  onProgress,
) {
  // Single chunk - process normally
  onProgress("Sending to AI for analysis...", {
    phase: "analyze",
    current: 1,
    total: 1,
  });
  const result = await analyzeChunk(chunks[0], 1, 1, onProgress);
  surfaceDocumentedConditions(result, fullText);
  enrichClaimsWithDiagnosticCodes(result);
  const rejectedCodes = enforceValidDiagnosticCodes(result);
  result.failedChunks = [];

  // BGE WASM semantic index deferred: running it inline (even fire-and-forget)
  // consumes enough memory over ~39 min on large docs to OOM-crash Chrome.
  // Built on-demand when the user triggers semantic search instead.
  const semanticIndex = {
    indexed: false,
    reason: "deferred",
    sessionKey: semanticOpts.sessionKey,
  };

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
      pagesExcludedFromAI: 0,
      chunksExcludedFromAI: 0,
      semanticIndex,
      rejectedDiagnosticCodes: rejectedCodes,
    },
  };
}

function _buildMultiChunkState(
  chunks,
  fullText,
  aiMode,
  isLocalAIMode,
  onProgress,
) {
  const totalChunks = chunks.length;
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

  // Pre-flight: score every chunk before the loop so the cap selects the
  // highest-value chunks rather than the first N by page order.
  const chunkScores = isLocalAIMode
    ? chunks.map((c) => scoreChunkRelevance(c.text))
    : null;
  // S24: compute cap (Gate 4) + floor (Gate 3) exclusions up front. This is the
  // single source of truth both for the loop's skip decisions and for the
  // user-visible "N pages excluded from AI analysis" count — the two can't drift.
  const { floorIndices, capIndices } =
    isLocalAIMode && chunkScores
      ? computeAiExclusion(chunkScores, {
          maxAiChunks: MAX_WEBGPU_AI_CHUNKS,
          minClaimsScore: MIN_CLAIMS_SCORE,
        })
      : { floorIndices: new Set(), capIndices: new Set() };
  if (capIndices.size > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `📊 Chunk cap: top ${MAX_WEBGPU_AI_CHUNKS}/${chunkScores.length} chunks by score run the AI pass; ${capIndices.size} excluded (still indexed for semantic search)`,
    );
  }

  return {
    totalChunks,
    isLocalAIMode,
    chunkScores,
    floorIndices,
    capIndices,
    chunkResults: [],
    failedChunks: [],
    skippedLowScore: 0,
    // S24: which real pages the AI actually read vs. were excluded by the score
    // cap/floor, so the results UI can surface how much of the document the slow
    // AI pass skipped — while the semantic index (below) still covers all of it.
    aiAnalyzedPages: new Set(),
    aiExcludedPages: new Set(),
    chunksExcludedFromAI: 0,
    recordPages: (set, chunk) => {
      const from = chunk.startPage || 0;
      const to = chunk.endPage || from;
      for (let p = from; p <= to; p++) set.add(p);
    },
    onProgress,
  };
}

function _evaluatePreflightGates(chunk, i, chunkNum, ctx) {
  // --- Gate 1: low-content skip ---
  // Near-blank pages: cover sheets, index separators, blank pages.
  // Conservative thresholds — both conditions must hold.
  const alphaCount = (chunk.text.match(/[a-zA-Z]/g) || []).length;
  if (chunk.text.trim().length < 250 || alphaCount < 120) {
    // eslint-disable-next-line no-console
    console.log(
      `⏭️ Chunk ${chunkNum}/${ctx.totalChunks} skipped (low-content: ${chunk.text.trim().length} chars, ${alphaCount} alpha)`,
    );
    ctx.chunkResults.push(createEmptyChunkResult());
    return true;
  }

  // --- Gate 2: medical content pre-filter ---
  // Text-heavy but purely administrative pages (routing slips, consent forms,
  // SF authorization sheets, index pages) have none of: dates, medical terms,
  // VA/claims language, or body-part references. Any ONE signal → send to LLM.
  if (!chunkHasMedicalContent(chunk.text)) {
    // eslint-disable-next-line no-console
    console.log(
      `⏭️ Chunk ${chunkNum}/${ctx.totalChunks} skipped (no medical signals: ${chunk.text.trim().length} chars)`,
    );
    ctx.chunkResults.push(createEmptyChunkResult());
    return true;
  }

  // --- Gate 3: pre-flight relevance score ---
  // Coarser than Gate 2 (which fires on any medical term); this gate requires
  // at least MIN_CLAIMS_SCORE condition/claims keywords. Catches admin-heavy
  // chunks that passed Gate 2 on a single generic medical term (e.g. "clinic").
  if (ctx.isLocalAIMode && ctx.floorIndices.has(i)) {
    ctx.skippedLowScore++;
    ctx.chunksExcludedFromAI++;
    ctx.recordPages(ctx.aiExcludedPages, chunk);
    // eslint-disable-next-line no-console
    console.log(
      `⏭️ Chunk ${chunkNum}/${ctx.totalChunks} skipped (relevance score ${ctx.chunkScores[i]} < ${MIN_CLAIMS_SCORE})`,
    );
    ctx.chunkResults.push(createEmptyChunkResult());
    return true;
  }

  // --- Gate 4: priority-ordered chunk cap ---
  // Only the top MAX_WEBGPU_AI_CHUNKS chunks by score are processed. Skipped
  // chunks push createEmptyChunkResult() (not failedChunks) so no "Partial Analysis"
  // banner fires — these are intentional skips, not errors. The excluded pages
  // are still fully covered by the semantic index built below.
  if (ctx.isLocalAIMode && ctx.capIndices.has(i)) {
    ctx.chunksExcludedFromAI++;
    ctx.recordPages(ctx.aiExcludedPages, chunk);
    ctx.chunkResults.push(createEmptyChunkResult());
    return true;
  }

  // This chunk clears every gate — the AI actually reads these pages.
  ctx.recordPages(ctx.aiAnalyzedPages, chunk);
  return false;
}

// Classify a chunk-analysis failure and perform its recovery side effects.
// Returns a directive the retry loop acts on, keeping _runChunkWithRetries
// under the cognitive-complexity limit:
//   "retry-free" — recovered (circuit cooldown or GPU rebuild); retry the SAME
//                  chunk WITHOUT consuming a content retry
//   "empty"      — deterministic context-window overflow; record an empty
//                  result (not a failedChunk) and stop retrying
//   "retry"      — ordinary malformed-output error; let the loop consume a retry
// Throws to abort the whole run (GPU recovery exhausted, or user cancellation).
async function _handleChunkFailure(error, chunk, chunkNum, ctx, state) {
  // Message inlined in the string: the console capture wrapper only records the
  // first argument, so a bare error object logs as blank.
  console.error(
    `Error analyzing chunk ${chunkNum} (attempt ${state.attempt + 1}): ${error?.message || error}`,
  );

  if (error.message?.includes("AI_CIRCUIT_OPEN") && state.circuitWaits < 3) {
    state.circuitWaits++;
    ctx.onProgress(
      `AI engine paused after repeated failures — waiting 30s before resuming chunk ${chunkNum}/${ctx.totalChunks}...`,
      { phase: "circuit-wait", current: chunkNum, total: ctx.totalChunks },
    );
    await new Promise((resolve) => setTimeout(resolve, 31000));
    resetAICircuitBreaker();
    return "retry-free";
  }

  // Context window errors are deterministic — retrying cannot help.
  // unifiedAIService transforms the raw ContextWindowSizeExceededError into
  // "📏 Document is too large for Local AI" before it reaches this catch, so
  // the check covers both forms. Use an empty result (not a failedChunks entry)
  // so the Partial Analysis banner does not fire for this skip, and the circuit
  // breaker does not open on a single overflowing chunk.
  if (
    error.message?.includes("context window") ||
    error.message?.includes("ContextWindowSizeExceededError") ||
    error.message?.includes("too large for Local AI")
  ) {
    return "empty";
  }

  // GPU-level hang: the WebGPU compute pipeline stopped signalling completion
  // and the Promise.race timeout fired. The engine's GPU device is now in a
  // degraded state, so every subsequent chunk would hang the same way. We MUST
  // NOT skip this chunk — its pages may hold claim-critical evidence. Rebuild
  // the engine on a fresh GPU adapter, then retry the SAME chunk without
  // consuming a normal retry. Bounded so a physically dead GPU still aborts
  // loudly (a false "analysis complete" on missing data is worse than a hard
  // failure the veteran can see and re-run).
  if (error.message?.includes("timed out")) {
    if (state.gpuRecoveries < MAX_GPU_RECOVERIES) {
      state.gpuRecoveries++;
      ctx.onProgress(
        `GPU stalled on chunk ${chunkNum}/${ctx.totalChunks} — rebuilding the AI engine and retrying (recovery ${state.gpuRecoveries}/${MAX_GPU_RECOVERIES})…`,
        { phase: "gpu-recovery", current: chunkNum, total: ctx.totalChunks },
      );
      await reloadSwarmEngine();
      return "retry-free";
    }
    throw new Error(
      `GPU could not process chunk ${chunkNum}/${ctx.totalChunks} (pages ${chunk.startPage}-${chunk.endPage}) after ${MAX_GPU_RECOVERIES} engine rebuilds. Analysis aborted to avoid silently dropping medical evidence.`,
    );
  }

  if (error.message === "Analysis cancelled by user") {
    throw error;
  }

  return "retry";
}

async function _runChunkWithRetries(chunk, chunkNum, ctx, abortController) {
  let result = null;
  let lastError = null;
  // circuitWaits: the circuit breaker protects interactive callers, but this
  // batch loop is the legitimate retry owner — wait out the cooldown and resume
  // instead of failing every remaining chunk. gpuRecoveries: a stalled GPU is
  // an environmental fault, tracked apart from content retries so recovering it
  // never burns the retries reserved for genuinely malformed model output.
  const state = { attempt: 0, circuitWaits: 0, gpuRecoveries: 0 };

  for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    state.attempt = attempt;
    if (abortController?.signal.aborted) {
      throw new Error("Analysis cancelled by user");
    }

    try {
      if (attempt > 0) {
        ctx.onProgress(
          `Retrying chunk ${chunkNum}/${ctx.totalChunks} (attempt ${attempt + 1} of ${MAX_CHUNK_RETRIES + 1})...`,
          {
            phase: "chunk-retry",
            current: chunkNum,
            total: ctx.totalChunks,
            attempt: attempt + 1,
          },
        );
        await new Promise((resolve) =>
          setTimeout(resolve, CHUNK_RETRY_BACKOFF_MS * attempt),
        );
      }

      result = await analyzeChunk(
        chunk,
        chunkNum,
        ctx.totalChunks,
        ctx.onProgress,
        attempt,
      );
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const directive = await _handleChunkFailure(
        error,
        chunk,
        chunkNum,
        ctx,
        state,
      );
      if (directive === "retry-free") {
        attempt--; // recovery does not consume a content retry
      } else if (directive === "empty") {
        result = createEmptyChunkResult();
        break;
      }
      // "retry" → fall through; the loop consumes an ordinary content retry.
    }
  }

  return { result, lastError };
}

async function _processOneChunk(chunk, i, ctx, abortController) {
  if (abortController?.signal.aborted) {
    throw new Error("Analysis cancelled by user");
  }

  const chunkNum = i + 1;

  if (_evaluatePreflightGates(chunk, i, chunkNum, ctx)) {
    return;
  }

  ctx.onProgress(
    `Analyzing chunk ${chunkNum} of ${ctx.totalChunks} (pages ${chunk.startPage}-${chunk.endPage})...`,
    {
      phase: "analyze",
      current: chunkNum,
      total: ctx.totalChunks,
      startPage: chunk.startPage,
      endPage: chunk.endPage,
    },
  );

  const { result, lastError } = await _runChunkWithRetries(
    chunk,
    chunkNum,
    ctx,
    abortController,
  );

  if (result) {
    ctx.chunkResults.push(result);

    ctx.onProgress(`Chunk ${chunkNum}/${ctx.totalChunks} complete`, {
      phase: "chunk-complete",
      current: chunkNum,
      total: ctx.totalChunks,
    });
  } else {
    // Record the failure so the final result can show what's missing,
    // then continue — one bad chunk must not abort the run
    ctx.failedChunks.push({
      chunkIndex: i,
      startPage: chunk.startPage,
      endPage: chunk.endPage,
      error: lastError?.message || "Unknown error",
    });

    ctx.onProgress(
      `⚠️ Chunk ${chunkNum} failed after ${MAX_CHUNK_RETRIES + 1} attempts, continuing...`,
      {
        phase: "chunk-error",
        current: chunkNum,
        total: ctx.totalChunks,
        error: lastError?.message,
      },
    );
  }

  // No inter-chunk sleep: local WebGPU AI has no rate limiting.
}

async function _finalizeMultiChunkResult(
  ctx,
  fullText,
  aiMode,
  skippedPages,
  semanticOpts,
) {
  if (ctx.skippedLowScore > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `📊 Pre-flight skipped ${ctx.skippedLowScore} low-relevance chunks (score < ${MIN_CLAIMS_SCORE})`,
    );
  }

  if (ctx.chunkResults.length === 0) {
    throw new Error(
      "All chunks failed to process. Please try again or use a smaller file.",
    );
  }

  // Merge all results
  ctx.onProgress("Merging analysis results...", { phase: "merge" });
  const mergedResult = mergeChunkResults(ctx.chunkResults);

  // Recall floor: re-surface explicit diagnoses the model under-recalled (a
  // faint, single-mention finding on a dense exam form loses to the compact
  // prompt's 3-claims-per-chunk cap). Grounded — only names literally present
  // in the text, with null DC — so it runs BEFORE the hallucination gate.
  surfaceDocumentedConditions(mergedResult, fullText);

  // Restore diagnostic codes the compact chunk prompt strips from LLM claims —
  // grounded, normalized-exact schedule matches only (no guessing).
  enrichClaimsWithDiagnosticCodes(mergedResult);

  // Anti-hallucination gate on the MERGED result: any diagnostic code not in
  // the 38 CFR Part 4 database is stripped before the veteran ever sees it
  const rejectedCodes = enforceValidDiagnosticCodes(mergedResult);
  mergedResult.failedChunks = ctx.failedChunks;

  // S24: distinct real pages the AI never read because of the score cap/floor
  // (pages that appear in an analyzed chunk via overlap don't count as excluded).
  const pagesExcludedFromAI = [...ctx.aiExcludedPages].filter(
    (p) => !ctx.aiAnalyzedPages.has(p),
  ).length;

  // BGE WASM semantic index deferred: running it inline (even fire-and-forget)
  // consumes enough memory over ~39 min on large docs to OOM-crash Chrome.
  // Built on-demand when the user triggers semantic search instead.
  const semanticIndex = {
    indexed: false,
    reason: "deferred",
    sessionKey: semanticOpts.sessionKey,
  };

  ctx.onProgress("Analysis complete!", { phase: "complete" });

  return {
    success: true,
    analysis: mergedResult,
    metadata: {
      analyzedAt: new Date().toISOString(),
      textLength: fullText.length,
      aiMode: aiMode,
      chunksProcessed: ctx.chunkResults.length,
      totalChunks: ctx.totalChunks,
      failedChunkCount: ctx.failedChunks.length,
      boilerplatePagesSkipped: skippedPages,
      pagesExcludedFromAI,
      chunksExcludedFromAI: ctx.chunksExcludedFromAI,
      semanticIndex,
      rejectedDiagnosticCodes: rejectedCodes,
    },
  };
}

export async function analyzeCFile(
  apiKey,
  fullText,
  onProgress = () => {},
  abortController = null,
  options = {},
) {
  const semanticOpts = _buildSemanticOpts(onProgress, abortController, options);

  // Check if ANY AI is available (Cloud or Local)
  if (!isAnyAIAvailable()) {
    throw new Error(
      "No AI available. Please set up an API key or enable Local AI.",
    );
  }

  if (!fullText || fullText.trim().length < 100) {
    throw new Error("Insufficient text content to analyze");
  }

  const { aiMode, isLocalAIMode, chunks, skippedPages } =
    await _determineAiModeAndChunks(fullText, onProgress);
  const totalChunks = chunks.length;

  if (totalChunks === 1) {
    return await _analyzeSingleChunkPath(
      chunks,
      aiMode,
      fullText,
      skippedPages,
      semanticOpts,
      onProgress,
    );
  }

  // Multi-chunk processing
  const ctx = _buildMultiChunkState(
    chunks,
    fullText,
    aiMode,
    isLocalAIMode,
    onProgress,
  );

  for (let i = 0; i < chunks.length; i++) {
    await _processOneChunk(chunks[i], i, ctx, abortController);
  }

  return await _finalizeMultiChunkResult(
    ctx,
    fullText,
    aiMode,
    skippedPages,
    semanticOpts,
  );
}

// Slim system prompt for local AI (3 fields: servicePeriod, potential_claims, timeline).
// Secondary fields (summary, exposures, combatIndicators, mentalHealth, redFlags,
// actionItems) are intentionally omitted — analyzeChunk sanitization and
// mergeChunkResults handle absent fields gracefully as empty arrays/strings.
// Omitting 6 fields reduces decode from ~800-1500 to ~150-500 tokens/chunk.
// potential_claims before timeline preserves priority within the 1024-token budget.
const CFILE_SYSTEM_PROMPT_COMPACT = `You are a VA Claims Auditor. Analyze C-File medical records. Output ONLY valid JSON: {"servicePeriod":{"branch":"","entryDate":"","separationDate":"","mos":""},"potential_claims":[{"condition":"","likelihood":"high|medium|low","inServiceEvent":"","currentDiagnosis":"yes|no|unclear","missing_element":""}],"timeline":[{"date":"","page_number":0,"category":"","description":"","significance":"high|medium|low"}]}. Rules: every string MUST be quoted; no newlines in values; values under 8 words; max 3 items in potential_claims array; max 1 item in timeline array; ALWAYS put a comma between array elements; omit fields where nothing found; only report findings present in the text.`;

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
// Security review note: these are relevance-filtering word lists (skip vs. send-to-LLM),
// not PII extraction — a false negative just means a page gets sent to the LLM anyway
// (conservative fallback), so mechanical complexity-reduction is lower-risk here than in
// the field-extraction parsers, but splitting ~20-word alternations into equivalent
// smaller regexes still deserves fixture testing rather than a same-session rewrite.
/* eslint-disable sonarjs/regex-complexity */
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
/* eslint-enable sonarjs/regex-complexity */

function chunkHasMedicalContent(text) {
  return MEDICAL_SIGNAL_PATTERNS.some((p) => p.test(text));
}

// Returns a claims-relevance score for a chunk of text (0–N, higher = more relevant).
// Runs in <1 ms per chunk; used for priority-ordering before the AI cap is applied.
const CHUNK_SCORE_HIGH_TERMS = [
  "ptsd",
  "post-traumatic",
  "tinnitus",
  "radiculopathy",
  "pes planus",
  "plantar fasci",
  "sleep apnea",
  "migraine",
  "nexus",
  "service connection",
  "service-connected",
  "in-service",
  "dbq",
  "disability benefits questionnaire",
  "c&p exam",
  "rating decision",
  "service treatment record",
  "traumatic brain",
  "tbi",
  "burn pit",
  "agent orange",
  "pact act",
];

const CHUNK_SCORE_MED_TERMS = [
  "diagnosis",
  "diagnosed",
  "chronic",
  "bilateral",
  "aggravated",
  "secondary to",
  "hypertension",
  "diabetes",
  "depression",
  "anxiety",
  "neuropathy",
  "degenerative",
  "lumbar",
  "cervical",
  "sciatica",
  "carpal tunnel",
  "hearing loss",
  "knee",
  "shoulder",
  "hip",
  "ankle",
  "back pain",
  "deployed",
  "combat",
  "active duty",
  "discharge",
  "dd-214",
  "dd214",
  "va medical",
  "vamc",
  "progress note",
  "treatment",
  "prescribed",
  "etiology",
  "prognosis",
  "pathology",
  "biopsy",
  "specimen",
  "laboratory",
  "radiology",
  "consultation",
  "referred to",
  "presented with",
  "complaints of",
  "history of",
  "chronic condition",
];

const CHUNK_SCORE_ADMIN_TERMS = [
  "please deliver to",
  "fax transmittal",
  "routing slip",
  "authorization to release",
  "cover sheet",
  "sign here",
  "signature required",
  "this form is",
  "table of contents",
  "page intentionally left blank",
];

function scoreChunkRelevance(text) {
  const t = text.toLowerCase();
  let score = 0;

  // ICD-10 codes (A00–Z99 with optional decimal) are a definitive clinical signal —
  // any page with one is a medical record regardless of condition name.
  if (/\b[A-Z]\d{2}\.?\d{0,4}\b/.test(text)) score += 3;

  // Clinical note structure headers (SOAP, radiology, pathology) — present in every
  // encounter note even when the condition name is rare or unlisted below.
  if (/\b(assessment|impression|findings|diagnosis|plan)\s*:/i.test(text))
    score += 2;

  for (const s of CHUNK_SCORE_HIGH_TERMS) {
    if (t.includes(s)) score += 2;
  }

  for (const s of CHUNK_SCORE_MED_TERMS) {
    if (t.includes(s)) score += 1;
  }

  for (const s of CHUNK_SCORE_ADMIN_TERMS) {
    if (t.includes(s)) score -= 2;
  }

  return Math.max(0, score);
}

async function _requestChunkAnalysis(
  chunk,
  chunkNum,
  totalChunks,
  onProgress,
  attempt = 0,
) {
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

  // Local AI: allow up to the device profile's maxOutputTokens (2048 on desktop-high).
  // The former Math.min(..., 1024) cap was added for decode speed but caused truncation
  // on complex chunks (many conditions, long summaries), defeating the repair cascade.
  // stream:false batch readback at 30+ tok/s keeps the decode time proportional to
  // actual output length rather than a fixed ceiling.
  // Per-retry escalation: a JSON that truncated at the ceiling on the previous
  // attempt is the top cause of an unrecoverable chunk, so grant each retry more
  // room to finish the object instead of re-truncating. +2048/attempt reaches a
  // 6144 ceiling by the last of the 3 circuit-safe attempts (2048→4096→6144 on
  // desktop-high); attempt 0 keeps the fast base.
  const baseMaxTokens = getCachedDeviceProfile()?.maxOutputTokens ?? 1024;
  const localMaxTokens = isLocalAI
    ? Math.min(baseMaxTokens + attempt * 2048, 6144)
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

  return typeof content === "string" ? content : JSON.stringify(content);
}

function _parseChunkAiResponse(contentStr) {
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

  try {
    return JSON.parse(cleanContent);
  } catch (parseError) {
    console.error("JSON Parse Error:", parseError);
    console.error("Content to parse:", cleanContent.substring(0, 500));

    // Attempt to repair truncated JSON
    const repaired = attemptJSONRepair(cleanContent);
    if (repaired) {
      // eslint-disable-next-line no-console
      console.log("✅ Successfully repaired truncated JSON response");
      return repaired;
    }
    if (!cleanContent.includes("{")) {
      // Model returned plain text with no JSON structure at all — it found nothing
      // to report (e.g. "This page contains administrative records."). Treat as an
      // empty-but-successful chunk so it never lands in failedChunks. Returning {}
      // here is equivalent to createEmptyChunkResult(): every field below defaults
      // the same way whether analysisResult is {} or genuinely absent.
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️ Non-JSON model response (no '{' found) — treating as empty chunk: "${cleanContent.substring(0, 80)}"`,
      );
      return {};
    }
    throw new Error(
      `Failed to parse AI response as JSON. The AI may have returned an invalid response. Please try again. Error: ${parseError.message}`,
    );
  }
}

/**
 * Analyze a single chunk of text
 */
async function analyzeChunk(
  chunk,
  chunkNum,
  totalChunks,
  onProgress,
  attempt = 0,
) {
  const contentStr = await _requestChunkAnalysis(
    chunk,
    chunkNum,
    totalChunks,
    onProgress,
    attempt,
  );
  const analysisResult = _parseChunkAiResponse(contentStr);

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
  // eslint-disable-next-line sonarjs/slow-regex -- bounded [^\n]* between literal markers we generate ourselves, not exponential backtracking
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
async function _requestPageAnalysis(pageText, pageNum, totalPages, onProgress) {
  const status = getAIStatus();
  const effectiveMode = status.effectiveMode || status.mode;
  const isLocalAI = [
    AI_MODES.LOCAL,
    AI_MODES.SWARM,
    AI_MODES.WLLAMA,
    AI_MODES.LOCAL_SERVER,
  ].includes(effectiveMode);

  // PI-02: spotlight the untrusted page text (treat-as-data delimiters).
  const pageLabel = `C-FILE PAGE ${pageNum}`;
  const userPrompt = `${untrustedSection(pageLabel, pageText)}\n\nExtract findings from this page only. Return ONLY the JSON object.`;

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

  return typeof response?.text === "string"
    ? response.text
    : String(response || "");
}

function _parsePageAiResponse(raw, pageNum) {
  let clean = raw.trim();
  if (clean.startsWith("```json")) clean = clean.slice(7);
  if (clean.startsWith("```")) clean = clean.slice(3);
  if (clean.endsWith("```")) clean = clean.slice(0, -3);
  clean = clean.trim();

  try {
    return JSON.parse(clean);
  } catch {
    const repaired = attemptJSONRepair(clean);
    if (repaired) return repaired;
    throw new Error(`Page ${pageNum}: failed to parse AI response as JSON`);
  }
}

// Map page-level schema → chunk-compatible schema expected by mergeChunkResults
function _mapPageResultToChunkSchema(pr, pageNum) {
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

async function analyzePage(pageText, pageNum, totalPages, onProgress) {
  const raw = await _requestPageAnalysis(
    pageText,
    pageNum,
    totalPages,
    onProgress,
  );
  const pr = _parsePageAiResponse(raw, pageNum);
  return _mapPageResultToChunkSchema(pr, pageNum);
}

function _prepareMedicalPages(fullText, onProgress) {
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

  return { medicalPages, skippedPages };
}

async function _runPageWithRetries(text, pageNum, i, ctx, abortController) {
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
      result = await analyzePage(text, pageNum, ctx.totalPages, ctx.onProgress);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      console.error(
        `Error on page ${pageNum} (attempt ${attempt + 1}): ${error?.message}`,
      );

      if (error.message?.includes("AI_CIRCUIT_OPEN") && circuitWaits < 3) {
        circuitWaits++;
        ctx.onProgress(
          `AI engine paused — waiting 30s before page ${pageNum}…`,
          {
            phase: "circuit-wait",
            current: i + 1,
            total: ctx.totalPages,
          },
        );
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

  return { result, lastError };
}

async function _processOnePage(pageEntry, i, ctx, abortController) {
  if (abortController?.signal.aborted) {
    throw new Error("Analysis cancelled by user");
  }

  const { pageNum, text } = pageEntry;

  // Gate: near-blank pages (should be rare after classifyPage, but defensive)
  const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
  if (text.trim().length < 100 || alphaCount < 50) {
    ctx.pageResults.push(createEmptyChunkResult());
    return;
  }

  ctx.onProgress(`Analyzing page ${pageNum} (${i + 1} of ${ctx.totalPages})…`, {
    phase: "analyze",
    current: i + 1,
    total: ctx.totalPages,
    startPage: pageNum,
    endPage: pageNum,
  });

  const { result, lastError } = await _runPageWithRetries(
    text,
    pageNum,
    i,
    ctx,
    abortController,
  );

  if (result) {
    ctx.pageResults.push(result);
    ctx.onProgress(`Page ${pageNum} complete (${i + 1}/${ctx.totalPages})`, {
      phase: "chunk-complete",
      current: i + 1,
      total: ctx.totalPages,
    });
  } else {
    ctx.failedPages.push({
      pageNum,
      error: lastError?.message || "Unknown error",
    });
  }
}

function _finalizePageByPageResult(ctx, fullText, aiMode, skippedPages) {
  if (ctx.pageResults.length === 0) {
    throw new Error(
      "All pages failed to process. Please try again or check AI model status.",
    );
  }

  ctx.onProgress("Merging analysis results…", { phase: "merge" });
  const mergedResult = mergeChunkResults(ctx.pageResults);
  const rejectedCodes = enforceValidDiagnosticCodes(mergedResult);
  mergedResult.failedChunks = ctx.failedPages;

  ctx.onProgress("Analysis complete!", { phase: "complete" });

  return {
    success: true,
    analysis: mergedResult,
    metadata: {
      analyzedAt: new Date().toISOString(),
      textLength: fullText.length,
      aiMode,
      chunksProcessed: ctx.pageResults.length,
      totalChunks: ctx.totalPages,
      failedChunkCount: ctx.failedPages.length,
      boilerplatePagesSkipped: skippedPages,
      rejectedDiagnosticCodes: rejectedCodes,
      processingMode: "page-by-page",
    },
  };
}

/**
 * Page-by-page orchestrator for local AI modes.
 * Replaces screenRelevantPages + splitIntoChunks + chunk loop for LOCAL/SWARM/WLLAMA.
 * Each page is analyzed individually — smaller prefill, better focus, no overlap waste.
 */
async function _analyzePageByPage(
  fullText,
  aiMode,
  onProgress,
  abortController,
) {
  const { medicalPages, skippedPages } = _prepareMedicalPages(
    fullText,
    onProgress,
  );

  const ctx = {
    pageResults: [],
    failedPages: [],
    totalPages: medicalPages.length,
    onProgress,
  };

  for (let i = 0; i < medicalPages.length; i++) {
    await _processOnePage(medicalPages[i], i, ctx, abortController);
  }

  return _finalizePageByPageResult(ctx, fullText, aiMode, skippedPages);
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
