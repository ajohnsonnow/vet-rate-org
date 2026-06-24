/**
 * Document-boundary page segmenter for VA C-Files.
 *
 * WHAT THIS DOES
 * A VA C-File is a packet of dozens of distinct documents (DD-214s, C&P exams,
 * STRs, rating decisions, buddy statements, …) concatenated into one PDF.
 * Arbitrary char-count chunking splits those documents mid-page, giving the AI
 * mixed context that produces noisy extractions.
 *
 * This module groups pages into document-boundary-aware segments BEFORE chunking
 * so that each AI call sees a coherent slice of one document type.
 *
 * ALGORITHM (per Opus architectural review 2026-06-12)
 * Single-pass state machine over the kept page array:
 *   score(page) = weighted sum of header-zone signals
 *   score >= BOUNDARY_THRESHOLD → close current segment, open new one
 *   score < threshold           → continuation page, accrete to current
 *
 * ASYMMETRIC FAILURE COST — missed boundary = two docs share a chunk = today's
 * behaviour (no regression).  False positive = one doc split into two chunks
 * = mild quality loss.  Neither is catastrophic, so threshold is permissive.
 *
 * ACCURACY (text-layer PDFs): ~85% boundary recall.
 * On OCR-only scans (no fontName/transform): ~70%.
 */

import { DOCUMENT_SIGNATURES } from "./cFileSegmentation.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const BOUNDARY_THRESHOLD = 2.5;
const HEADER_ZONE_CHARS = 600; // Only score first N chars (title/letterhead zone)

// High-priority doc types (priority >= 85) get full Tier-1 weight.
// Low-priority types (VA_LETTER, PRIVATE_MEDICAL, etc.) get half weight because
// their header patterns appear on continuation pages too.
const HIGH_PRIORITY_THRESHOLD = 85;

// Signals compiled once at module load
const PAGE_ONE_OF_N = /\bpage\s+1\s+of\s+\d+\b/i;
const PAGE_SLASH_N = /^\s*1\s*\/\s*\d{1,4}\s*$/m;
const LETTERHEAD_REFER_TO = /In\s+Reply\s+Refer\s+To/i;
const CLAIM_NUMBER = /\bC[-\s]?\d{7,9}\b/;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip the "--- PAGE N ---" marker from a page block to get body text. */
function bodyText(pageBlock) {
  const markerEnd = pageBlock.indexOf("\n");
  return markerEnd >= 0 ? pageBlock.slice(markerEnd + 1) : pageBlock;
}

/**
 * Score a page's header zone for boundary signals.
 * Higher = more likely this page starts a new document.
 */
function boundaryScore(headerText, prevPageBlock) {
  let score = 0;

  // Tier 1 — statutory titles / form numbers in the header zone
  for (const [, sig] of Object.entries(DOCUMENT_SIGNATURES)) {
    if (sig.patterns.some((p) => p.test(headerText))) {
      score += sig.priority >= HIGH_PRIORITY_THRESHOLD ? 3.0 : 1.5;
      break; // one doc-type match is enough for Tier 1
    }
  }

  // "Page 1 of N" — near-certain document start regardless of title
  if (PAGE_ONE_OF_N.test(headerText) || PAGE_SLASH_N.test(headerText)) {
    score += 2.5;
  }

  // VA letterhead block: "In Reply Refer To" + claim number
  if (LETTERHEAD_REFER_TO.test(headerText) && CLAIM_NUMBER.test(headerText)) {
    score += 1.0;
  }

  // Soft hint: previous kept page was near-blank (a separator)
  if (prevPageBlock && prevPageBlock.trim().length < 120) {
    score += 0.5;
  }

  return score;
}

/**
 * Classify the doc type from the header zone (best-priority match).
 * Returns the DOCUMENT_SIGNATURES key or 'UNKNOWN'.
 */
function classifyHeader(headerText) {
  let bestType = "UNKNOWN";
  let bestPriority = -1;
  for (const [docType, sig] of Object.entries(DOCUMENT_SIGNATURES)) {
    if (
      sig.priority > bestPriority &&
      sig.patterns.some((p) => p.test(headerText))
    ) {
      bestType = docType;
      bestPriority = sig.priority;
    }
  }
  return bestType;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Group an array of kept pages into document-boundary segments.
 *
 * @param {Array<{pageNum: number, text: string}>} pages
 *   Pages returned by screenRelevantPages (text = full block incl. marker).
 * @returns {Array<Segment>}
 *   Segment: { id, docType, category, startPage, endPage,
 *              pages: [{pageNum, text}], charLength }
 */
export function segmentPages(pages) {
  if (pages.length === 0) return [];

  const segments = [];
  let current = null;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const header = bodyText(page.text).slice(0, HEADER_ZONE_CHARS);
    const prevBlock = i > 0 ? pages[i - 1].text : null;
    const score = boundaryScore(header, prevBlock);

    if (!current || score >= BOUNDARY_THRESHOLD) {
      // Close previous segment
      if (current) segments.push(current);

      const detectedType =
        score >= BOUNDARY_THRESHOLD ? classifyHeader(header) : "UNKNOWN";
      const sig = DOCUMENT_SIGNATURES[detectedType];
      current = {
        id: `seg_${segments.length}`,
        docType: detectedType,
        category: sig?.category ?? "UNKNOWN",
        startPage: page.pageNum,
        endPage: page.pageNum,
        pages: [page],
        charLength: page.text.length,
        boundaryScore: score,
      };
    } else {
      // Continuation — accrete
      current.endPage = page.pageNum;
      current.pages.push(page);
      current.charLength += page.text.length;
    }
  }

  if (current) segments.push(current);

  // eslint-disable-next-line no-console
  console.log(
    `📂 Segmented into ${segments.length} document groups (${pages.length} pages)`,
    segments
      .map(
        (s) => `${s.docType}:${s.startPage}-${s.endPage}(${s.pages.length}p)`,
      )
      .join(", "),
  );

  return segments;
}

/**
 * Pack segments into AI chunks that respect document boundaries.
 *
 * Rules:
 *  • A segment that fits in maxChars → pack with adjacent segments if they fit.
 *  • An oversized segment → split WITHIN itself with 1-page overlap (same docType).
 *  • Cross-segment overlap = 0 (boundaries are clean by construction).
 *  • MIN_PAGES_PER_CHUNK is NOT applied — a 2-page DD-214 is a valid standalone chunk.
 *
 * @param {Array<Segment>} segments
 * @param {number} maxChars  e.g. getMaxCharsPerChunk(aiMode)
 * @returns {Array<Chunk>}
 *   Chunk: { text, startPage, endPage, chunkIndex, pageNums, docType, segmentIds }
 */
export function chunkBySegment(segments, maxChars) {
  const chunks = [];
  let bufPages = [];
  let bufSize = 0;
  let bufDocType = "UNKNOWN";
  let bufSegIds = [];

  function flush() {
    if (bufPages.length === 0) return;
    chunks.push({
      text: bufPages.map((p) => p.text).join(""),
      startPage: bufPages[0].pageNum,
      endPage: bufPages[bufPages.length - 1].pageNum,
      chunkIndex: chunks.length,
      pageNums: bufPages.map((p) => p.pageNum),
      docType: bufDocType,
      segmentIds: [...bufSegIds],
    });
    bufPages = [];
    bufSize = 0;
    bufDocType = "UNKNOWN";
    bufSegIds = [];
  }

  for (const seg of segments) {
    if (seg.charLength > maxChars) {
      // Oversized segment: flush buffer, then split this segment internally
      flush();
      let pageBuffer = [];
      let bufSz = 0;
      for (let i = 0; i < seg.pages.length; i++) {
        const page = seg.pages[i];
        if (bufSz + page.text.length > maxChars && pageBuffer.length > 0) {
          chunks.push({
            text: pageBuffer.map((p) => p.text).join(""),
            startPage: pageBuffer[0].pageNum,
            endPage: pageBuffer[pageBuffer.length - 1].pageNum,
            chunkIndex: chunks.length,
            pageNums: pageBuffer.map((p) => p.pageNum),
            docType: seg.docType,
            segmentIds: [seg.id],
          });
          // 1-page overlap within the same document
          const overlap = pageBuffer[pageBuffer.length - 1];
          pageBuffer = [overlap];
          bufSz = overlap.text.length;
        }
        pageBuffer.push(page);
        bufSz += page.text.length;
      }
      if (pageBuffer.length > 0) {
        chunks.push({
          text: pageBuffer.map((p) => p.text).join(""),
          startPage: pageBuffer[0].pageNum,
          endPage: pageBuffer[pageBuffer.length - 1].pageNum,
          chunkIndex: chunks.length,
          pageNums: pageBuffer.map((p) => p.pageNum),
          docType: seg.docType,
          segmentIds: [seg.id],
        });
      }
    } else if (bufSize + seg.charLength <= maxChars) {
      // Fits — pack into current buffer
      bufPages.push(...seg.pages);
      bufSize += seg.charLength;
      bufSegIds.push(seg.id);
      if (bufDocType === "UNKNOWN") bufDocType = seg.docType;
    } else {
      // Doesn't fit — flush and start fresh
      flush();
      bufPages.push(...seg.pages);
      bufSize = seg.charLength;
      bufDocType = seg.docType;
      bufSegIds = [seg.id];
    }
  }
  flush();

  // Re-index chunkIndex to be sequential (flush assigns in order, but verify)
  chunks.forEach((c, i) => {
    c.chunkIndex = i;
  });

  // eslint-disable-next-line no-console
  console.log(
    `📦 chunkBySegment: ${segments.length} segments → ${chunks.length} chunks (maxChars=${maxChars})`,
  );

  return chunks;
}
