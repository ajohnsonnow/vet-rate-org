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

import { generateAI, isAnyAIAvailable, getAIStatus, AI_MODES } from './unifiedAIService';

// ============================================================================
// CONFIGURATION - Token limits and chunking settings
// ============================================================================

// Conservative token limits (leaving room for system prompt + response)
const TOKEN_LIMITS = {
  GEMINI: 800000,      // 800K tokens (conservative for 1M context)
  LOCAL: 1500,         // 1.5K tokens (VERY conservative for 4K context - system prompt is ~1K)
};

// Approximate chars per token (English text averages ~4 chars/token)
const CHARS_PER_TOKEN = 4;

// Maximum characters per chunk based on AI mode
const getMaxCharsPerChunk = (aiMode) => {
  if (aiMode === AI_MODES.LOCAL || aiMode === AI_MODES.SWARM || 
      aiMode === AI_MODES.WLLAMA || aiMode === AI_MODES.LOCAL_SERVER) {
    return TOKEN_LIMITS.LOCAL * CHARS_PER_TOKEN; // ~12,000 chars for local
  }
  return TOKEN_LIMITS.GEMINI * CHARS_PER_TOKEN; // ~3.2M chars for cloud
};

// Overlap between chunks (in pages) to catch context that spans boundaries
const CHUNK_OVERLAP_PAGES = 5;

// Minimum pages per chunk (don't create tiny chunks)
const MIN_PAGES_PER_CHUNK = 10;

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
const CHUNK_PROMPT_PREFIX = `IMPORTANT: This is CHUNK {chunkNum} of {totalChunks} from a large C-File.
Pages in this chunk: {startPage} to {endPage}.
Focus on extracting findings from THIS chunk only. Findings will be merged with other chunks.

`;

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
      endIndex: fullText.length // Will be updated on next iteration
    });
    lastIndex = match.index;
  }
  
  // If no page markers found, treat as single chunk
  if (pages.length === 0) {
    console.warn('No page markers found in text, treating as single chunk');
    return [{
      text: fullText,
      startPage: 1,
      endPage: 1,
      chunkIndex: 0
    }];
  }
  
  console.log(`📄 Found ${pages.length} pages in document`);
  
  // If total text fits in one chunk, return as-is
  if (fullText.length <= maxCharsPerChunk) {
    console.log(`✅ Document fits in single chunk (${fullText.length} chars <= ${maxCharsPerChunk} max)`);
    return [{
      text: fullText,
      startPage: pages[0].pageNum,
      endPage: pages[pages.length - 1].pageNum,
      chunkIndex: 0
    }];
  }
  
  // Need to split into multiple chunks
  console.log(`📦 Document too large (${fullText.length} chars > ${maxCharsPerChunk} max), splitting into chunks...`);
  
  const chunks = [];
  let currentChunkStart = 0;
  let currentChunkPages = [];
  let currentChunkSize = 0;
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageText = fullText.slice(page.startIndex, page.endIndex);
    const pageSize = pageText.length;
    
    // Check if adding this page would exceed the limit
    if (currentChunkSize + pageSize > maxCharsPerChunk && currentChunkPages.length >= MIN_PAGES_PER_CHUNK) {
      // Save current chunk
      const chunkEndIndex = pages[i - 1].endIndex;
      chunks.push({
        text: fullText.slice(currentChunkStart, chunkEndIndex),
        startPage: currentChunkPages[0],
        endPage: currentChunkPages[currentChunkPages.length - 1],
        chunkIndex: chunks.length
      });
      
      // Start new chunk with overlap
      const overlapStartIndex = Math.max(0, i - CHUNK_OVERLAP_PAGES);
      currentChunkStart = pages[overlapStartIndex].startIndex;
      currentChunkPages = pages.slice(overlapStartIndex, i + 1).map(p => p.pageNum);
      currentChunkSize = fullText.slice(currentChunkStart, page.endIndex).length;
    } else {
      currentChunkPages.push(page.pageNum);
      currentChunkSize = fullText.slice(currentChunkStart, page.endIndex).length;
    }
  }
  
  // Don't forget the last chunk
  if (currentChunkPages.length > 0) {
    chunks.push({
      text: fullText.slice(currentChunkStart),
      startPage: currentChunkPages[0],
      endPage: currentChunkPages[currentChunkPages.length - 1],
      chunkIndex: chunks.length
    });
  }
  
  console.log(`📦 Split into ${chunks.length} chunks`);
  chunks.forEach((chunk, i) => {
    console.log(`  Chunk ${i + 1}: Pages ${chunk.startPage}-${chunk.endPage}, ${chunk.text.length} chars`);
  });
  
  return chunks;
}

/**
 * Estimate how long processing will take based on file size and chunk count
 */
function estimateProcessingTime(textLength, chunkCount, aiMode) {
  // Base time per chunk (seconds)
  const baseTimePerChunk = aiMode === AI_MODES.CLOUD ? 30 : 60; // Cloud is faster
  
  // Additional time based on text size
  const sizeMultiplier = Math.max(1, textLength / 100000);
  
  const totalSeconds = chunkCount * baseTimePerChunk * sizeMultiplier;
  
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
    throw new Error('No chunk results to merge');
  }
  
  if (chunkResults.length === 1) {
    return chunkResults[0];
  }
  
  console.log(`🔀 Merging ${chunkResults.length} chunk results...`);
  
  // Initialize merged result with first chunk's service period (usually most reliable)
  const merged = {
    summary: '',
    servicePeriod: chunkResults[0].servicePeriod || {},
    timeline: [],
    potential_claims: [],
    exposures: [],
    combatIndicators: [],
    mentalHealth: {
      indicators: [],
      diagnoses: [],
      stressors: [],
      pages: []
    },
    redFlags: [],
    actionItems: []
  };
  
  // Collect all summaries and create a meta-summary
  const summaries = chunkResults
    .filter(r => r.summary)
    .map(r => r.summary);
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
      if (!merged.servicePeriod.separationDate && result.servicePeriod.separationDate) {
        merged.servicePeriod.separationDate = result.servicePeriod.separationDate;
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
  merged.exposures = deduplicateByField(merged.exposures, 'type');
  
  // Merge combat indicators
  for (const result of chunkResults) {
    if (result.combatIndicators && Array.isArray(result.combatIndicators)) {
      merged.combatIndicators.push(...result.combatIndicators);
    }
  }
  merged.combatIndicators = deduplicateByField(merged.combatIndicators, 'indicator');
  
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
  merged.mentalHealth.pages = [...new Set(merged.mentalHealth.pages)].sort((a, b) => a - b);
  
  // Merge red flags
  for (const result of chunkResults) {
    if (result.redFlags && Array.isArray(result.redFlags)) {
      merged.redFlags.push(...result.redFlags);
    }
  }
  merged.redFlags = deduplicateByField(merged.redFlags, 'issue');
  
  // Merge action items (deduplicate similar items)
  const allActions = [];
  for (const result of chunkResults) {
    if (result.actionItems && Array.isArray(result.actionItems)) {
      allActions.push(...result.actionItems);
    }
  }
  merged.actionItems = deduplicateActionItems(allActions);
  
  console.log(`✅ Merged results: ${merged.timeline.length} timeline events, ${merged.potential_claims.length} claims, ${merged.exposures.length} exposures`);
  
  return merged;
}

/**
 * Create a meta-summary from multiple chunk summaries
 */
function createMetaSummary(summaries) {
  if (summaries.length === 0) return 'Analysis complete.';
  if (summaries.length === 1) return summaries[0];
  
  // For multiple summaries, try to combine the key points
  // This is a simple approach - could be enhanced with AI summary
  const combined = summaries.join(' ');
  
  // If combined is reasonable length, use it
  if (combined.length <= 500) {
    return combined;
  }
  
  // Otherwise, take key sentences from each
  const sentences = [];
  for (const summary of summaries) {
    const firstSentence = summary.split(/[.!?]/)[0];
    if (firstSentence && !sentences.some(s => s.toLowerCase() === firstSentence.toLowerCase())) {
      sentences.push(firstSentence.trim());
    }
  }
  
  return sentences.join('. ') + '.';
}

/**
 * Deduplicate timeline entries by page number and description similarity
 */
function deduplicateTimeline(timeline) {
  const seen = new Map();
  
  for (const event of timeline) {
    const key = `${event.page_number || 0}_${(event.body_part || '').toLowerCase()}_${(event.category || '')}`;
    
    if (!seen.has(key)) {
      seen.set(key, event);
    } else {
      // Merge evidence pages if same event found in multiple chunks
      const existing = seen.get(key);
      if (event.quote && (!existing.quote || event.quote.length > existing.quote.length)) {
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
    const key = (claim.condition || '').toLowerCase().trim();
    
    if (!claimMap.has(key)) {
      claimMap.set(key, { ...claim, evidence_pages: [...(claim.evidence_pages || [])] });
    } else {
      // Merge evidence pages
      const existing = claimMap.get(key);
      const newPages = claim.evidence_pages || [];
      existing.evidence_pages = [...new Set([...existing.evidence_pages, ...newPages])].sort((a, b) => a - b);
      
      // Keep strongest likelihood/nexus
      if (strengthRank(claim.likelihood) > strengthRank(existing.likelihood)) {
        existing.likelihood = claim.likelihood;
      }
      if (strengthRank(claim.nexusStrength) > strengthRank(existing.nexusStrength)) {
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
  const ranks = { high: 3, strong: 3, medium: 2, moderate: 2, low: 1, weak: 1, missing: 0 };
  return ranks[strength?.toLowerCase()] || 0;
}

/**
 * Deduplicate array of objects by a specific field
 */
function deduplicateByField(items, field) {
  const seen = new Map();
  
  for (const item of items) {
    const key = (item[field] || '').toLowerCase().trim();
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
    const isDuplicate = unique.some(existing => {
      const existingNorm = existing.toLowerCase().trim();
      // Check for substantial overlap
      return existingNorm.includes(normalized) || 
             normalized.includes(existingNorm) ||
             calculateSimilarity(existingNorm, normalized) > 0.7;
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
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
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
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
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
export async function analyzeCFile(apiKey, fullText, onProgress = () => {}, abortController = null) {
  // Check if ANY AI is available (Cloud or Local)
  if (!isAnyAIAvailable()) {
    throw new Error('No AI available. Please set up an API key or enable Local AI.');
  }
  
  if (!fullText || fullText.trim().length < 100) {
    throw new Error('Insufficient text content to analyze');
  }
  
  const aiStatus = getAIStatus();
  const aiMode = aiStatus.effectiveMode;
  
  // Special check for Diamond Swarm mode - ensure model is fully loaded
  if (aiMode === 'swarm') {
    const { hasWebLLMEngine } = await import('./diamondSwarm');
    if (!hasWebLLMEngine()) {
      throw new Error('Diamond Swarm mode selected but model is still loading. Please wait for the model download to complete (check Local AI panel), or switch to Cloud AI in settings.');
    }
  }
  
  onProgress('Analyzing document size...', { phase: 'prepare' });
  
  // Split into chunks based on AI context limits
  const chunks = splitIntoChunks(fullText, aiMode);
  const totalChunks = chunks.length;
  
  console.log(`📊 Analysis plan: ${totalChunks} chunk(s), AI mode: ${aiMode}`);
  
  if (totalChunks === 1) {
    // Single chunk - process normally
    onProgress('Sending to AI for analysis...', { phase: 'analyze', current: 1, total: 1 });
    const result = await analyzeChunk(chunks[0], 1, 1, onProgress);
    
    onProgress('Analysis complete!', { phase: 'complete' });
    
    return {
      success: true,
      analysis: result,
      metadata: {
        analyzedAt: new Date().toISOString(),
        textLength: fullText.length,
        aiMode: aiMode,
        chunksProcessed: 1
      }
    };
  }
  
  // Multi-chunk processing
  const estimatedTime = estimateProcessingTime(fullText.length, totalChunks, aiMode);
  onProgress(`Processing ${totalChunks} chunks (estimated: ${estimatedTime})`, { 
    phase: 'multi-chunk', 
    current: 0, 
    total: totalChunks 
  });
  
  const chunkResults = [];
  
  for (let i = 0; i < chunks.length; i++) {
    // Check if aborted
    if (abortController?.signal.aborted) {
      throw new Error('Analysis cancelled by user');
    }
    
    const chunk = chunks[i];
    const chunkNum = i + 1;
    
    onProgress(`Analyzing chunk ${chunkNum} of ${totalChunks} (pages ${chunk.startPage}-${chunk.endPage})...`, {
      phase: 'analyze',
      current: chunkNum,
      total: totalChunks,
      startPage: chunk.startPage,
      endPage: chunk.endPage
    });
    
    try {
      const result = await analyzeChunk(chunk, chunkNum, totalChunks, onProgress);
      chunkResults.push(result);
      
      onProgress(`Chunk ${chunkNum}/${totalChunks} complete`, {
        phase: 'chunk-complete',
        current: chunkNum,
        total: totalChunks
      });
    } catch (error) {
      console.error(`Error analyzing chunk ${chunkNum}:`, error);
      
      // Special handling for context window errors
      if (error.message?.includes('context window') || error.message?.includes('ContextWindowSizeExceededError')) {
        throw new Error(`Context window exceeded. This document is too large for the current AI model. Try using Cloud AI (Gemini) instead, or split your document into smaller files.`);
      }
      
      // Continue with other chunks even if one fails
      onProgress(`⚠️ Chunk ${chunkNum} failed, continuing...`, {
        phase: 'chunk-error',
        current: chunkNum,
        total: totalChunks,
        error: error.message
      });
    }
    
    // Small delay between chunks to avoid rate limiting
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  if (chunkResults.length === 0) {
    throw new Error('All chunks failed to process. Please try again or use a smaller file.');
  }
  
  // Merge all results
  onProgress('Merging analysis results...', { phase: 'merge' });
  const mergedResult = mergeChunkResults(chunkResults);
  
  onProgress('Analysis complete!', { phase: 'complete' });
  
  return {
    success: true,
    analysis: mergedResult,
    metadata: {
      analyzedAt: new Date().toISOString(),
      textLength: fullText.length,
      aiMode: aiMode,
      chunksProcessed: chunkResults.length,
      totalChunks: totalChunks,
      failedChunks: totalChunks - chunkResults.length
    }
  };
}

/**
 * Analyze a single chunk of text
 */
async function analyzeChunk(chunk, chunkNum, totalChunks, onProgress) {
  // Build prompt with chunk context
  let prompt = CFILE_SYSTEM_PROMPT;
  
  if (totalChunks > 1) {
    prompt = CHUNK_PROMPT_PREFIX
      .replace('{chunkNum}', chunkNum.toString())
      .replace('{totalChunks}', totalChunks.toString())
      .replace('{startPage}', chunk.startPage.toString())
      .replace('{endPage}', chunk.endPage.toString()) + prompt;
  }
  
  const userPrompt = `${prompt}\n\n--- BEGIN C-FILE TEXT ---\n\n${chunk.text}\n\n--- END C-FILE TEXT ---\n\nAnalyze this C-File and return ONLY the JSON object as specified. No additional text or formatting.`;
  
  const response = await generateAI(userPrompt, {
    temperature: 0.2,
    maxTokens: 32768,
    expectJSON: true,
    skipCrisisCheck: true, // C-Files contain clinical records
    skipHallucinationCheck: true, // C-File analysis has different JSON structure (potential_claims), trap expects conditions array
    toolContext: 'C-File Analyzer'
  });
  
  const content = response?.text || response;
  
  if (!content) {
    throw new Error('No analysis content received from AI');
  }
  
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  
  // Parse JSON response
  let cleanContent = contentStr.trim();
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.slice(7);
  }
  if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.slice(3);
  }
  if (cleanContent.endsWith('```')) {
    cleanContent = cleanContent.slice(0, -3);
  }
  cleanContent = cleanContent.trim();
  
  // Check for placeholder/loading responses
  if (cleanContent.includes('[Diamond Swarm') || cleanContent.includes('model is still loading')) {
    throw new Error('Local AI model is still loading. Please wait for the model to fully download before analyzing documents.');
  }
  
  let analysisResult;
  try {
    analysisResult = JSON.parse(cleanContent);
  } catch (parseError) {
    console.error('JSON Parse Error:', parseError);
    console.error('Content to parse:', cleanContent.substring(0, 500));
    throw new Error(`Failed to parse AI response as JSON. The AI may have returned an invalid response. Please try again. Error: ${parseError.message}`);
  }
  
  // Sanitize result
  return {
    summary: analysisResult.summary || '',
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
    }
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Validate a Gemini API key by making a simple test request
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateApiKey(apiKey) {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, error: 'API key is too short' };
  }
  
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(endpoint);
    
    if (response.ok) {
      return { valid: true };
    }
    
    if (response.status === 400 || response.status === 403) {
      return { valid: false, error: 'Invalid API key' };
    }
    
    return { valid: false, error: `Validation failed (${response.status})` };
  } catch (error) {
    return { valid: false, error: 'Network error during validation' };
  }
}

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
  
  if (aiMode === AI_MODES.LOCAL || aiMode === AI_MODES.SWARM || 
      aiMode === AI_MODES.WLLAMA || aiMode === AI_MODES.LOCAL_SERVER) {
    return {
      mode: 'Local AI',
      tokenLimit: TOKEN_LIMITS.LOCAL,
      charLimit: TOKEN_LIMITS.LOCAL * CHARS_PER_TOKEN,
      pagesPerChunk: '~8 pages',
      supportsLargeFiles: true,
      note: 'Large files automatically split into chunks'
    };
  }
  
  return {
    mode: 'Cloud AI (Gemini)',
    tokenLimit: TOKEN_LIMITS.GEMINI,
    charLimit: TOKEN_LIMITS.GEMINI * CHARS_PER_TOKEN,
    pagesPerChunk: '~2,000 pages',
    supportsLargeFiles: true,
    note: 'Very large files (300MB+) split into chunks automatically'
  };
}

/**
 * Get the privacy disclosure for C-File analysis
 * Now AI-mode aware - shows different info for Cloud vs Local
 * @returns {string}
 */
export function getCFilePrivacyDisclosure() {
  const status = getAIStatus();
  
  if (status.effectiveMode === AI_MODES.LOCAL || status.effectiveMode === AI_MODES.SWARM) {
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
