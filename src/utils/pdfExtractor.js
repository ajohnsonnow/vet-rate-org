/**
 * Vet-Rate.org - C-File PDF Text Extraction Utility
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Client-side PDF text extraction using pdf.js
 * Converts large PDF files to searchable text without uploading to servers
 */

import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { describePdfPasswordError } from "./fileTypeGuards";

/**
 * Wire pdf.js's onPassword callback to a prompt+retry. The VA ships encrypted
 * C-files; without this, getDocument() rejects with a PasswordException.
 * @param {object} loadingTask - pdf.js PDFDocumentLoadingTask
 * @param {Function} [getPassword] - async (reason) => string|null; defaults to window.prompt
 */
function attachPdfPasswordPrompt(loadingTask, getPassword) {
  loadingTask.onPassword = (updatePassword, reason) => {
    const ask =
      getPassword ||
      ((r) =>
        window.prompt(
          // reason 2 = INCORRECT_PASSWORD (pdfjsLib.PasswordResponses)
          r === 2
            ? "Incorrect password. Re-enter the password for this PDF:"
            : "This PDF is password-protected. Enter its password to read it:",
        ));
    Promise.resolve(ask(reason)).then((pw) => {
      if (pw) updatePassword(pw);
      else loadingTask.destroy();
    });
  };
}

// Configure pdf.js worker - use bundled worker from npm package for version compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Standard fonts CDN path (suppresses font warnings)
const STANDARD_FONT_DATA_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;

/**
 * Extract text from a PDF file client-side
 * @param {ArrayBuffer} fileData - The PDF file as an ArrayBuffer
 * @param {Function} onProgress - Progress callback (currentPage, totalPages)
 * @returns {Promise<{text: string, pageCount: number, hasText: boolean}>}
 */
export async function ripTextFromPdf(
  fileData,
  onProgress = () => {},
  options = {},
) {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: fileData,
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
    });
    attachPdfPasswordPrompt(loadingTask, options.getPassword);
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    let fullText = "";
    let totalCharacters = 0;
    let failedPages = 0;

    // Loop through all pages
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Extract text items and join with proper spacing
        const pageText = textContent.items
          .map((item) => item.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        totalCharacters += pageText.length;

        // Add page marker for AI citation (CRITICAL for source tracking)
        fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;

        // Report progress
        onProgress(i, numPages);

        // Yield to browser to prevent UI freezing on large files
        if (i % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } catch (pageError) {
        failedPages++;
        console.warn(`Error extracting page ${i}:`, pageError);
        fullText += `--- PAGE ${i} ---\n[Page extraction error]\n\n`;
        onProgress(i, numPages);
      }
    }

    // Determine if the PDF actually has text (vs scanned images)
    const avgCharsPerPage = totalCharacters / numPages;
    const hasText = avgCharsPerPage > 50; // If less than 50 chars/page, likely scanned images

    return {
      text: fullText,
      pageCount: numPages,
      hasText,
      avgCharsPerPage: Math.round(avgCharsPerPage),
      totalCharacters,
      // RT7-5: surface partial-read failures so the UI can warn "N of M pages
      // could not be read" instead of silently returning placeholder text.
      failedPages,
      pagesRead: numPages - failedPages,
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
    const pwError = describePdfPasswordError(error);
    if (pwError) throw pwError;
    throw new Error(`Failed to read PDF: ${error.message}`);
  }
}

/**
 * Read a File object into an ArrayBuffer
 * @param {File} file - The file to read
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

// ============================================================
// C-FILE STREAMING STORAGE (IndexedDB)
// Batches written to IDB as they complete so RAM stays flat
// regardless of document size.
// ============================================================
const CFILE_DB_NAME = "VetRate_CFileStream";
const CFILE_DB_VERSION = 1;
const CFILE_STORE = "page_batches";

function openCFileDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CFILE_DB_NAME, CFILE_DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CFILE_STORE)) {
        db.createObjectStore(CFILE_STORE, { keyPath: "batchKey" });
      }
    };
  });
}

function writeBatchToDB(db, sessionKey, batchIndex, batchText, stats) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CFILE_STORE, "readwrite");
    const store = tx.objectStore(CFILE_STORE);
    const req = store.put({
      batchKey: `${sessionKey}:${batchIndex}`,
      sessionKey,
      batchIndex,
      text: batchText,
      stats,
      savedAt: Date.now(),
    });
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
  });
}

async function readAllBatchesFromDB(db, sessionKey) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CFILE_STORE, "readonly");
    const store = tx.objectStore(CFILE_STORE);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const all = (req.result || [])
        .filter((r) => r.sessionKey === sessionKey)
        .sort((a, b) => a.batchIndex - b.batchIndex);
      resolve(all);
    };
  });
}

async function clearSessionBatches(db, sessionKey) {
  return new Promise((resolve) => {
    const tx = db.transaction(CFILE_STORE, "readwrite");
    const store = tx.objectStore(CFILE_STORE);
    const reqAll = store.getAll();
    reqAll.onsuccess = () => {
      const keys = (reqAll.result || [])
        .filter((r) => r.sessionKey === sessionKey)
        .map((r) => r.batchKey);
      for (const k of keys) store.delete(k);
    };
    tx.oncomplete = () => resolve();
  });
}

/**
 * Update the running "scanned page" run-length tracking for a single page's
 * character count, mutating pageState in place.
 */
function trackPageStats(chars, pageNum, pageState) {
  if (chars >= 50) {
    pageState.pagesWithText++;
    if (pageState.currentEmptyRun) {
      pageState.scannedRanges.push({ ...pageState.currentEmptyRun });
      pageState.currentEmptyRun = null;
    }
    return;
  }

  pageState.pagesEmpty++;
  if (!pageState.currentEmptyRun)
    pageState.currentEmptyRun = { start: pageNum, end: pageNum };
  else pageState.currentEmptyRun.end = pageNum;
}

/**
 * Extract the text of a single PDF page and update pageState's running
 * counters, returning the batch text block + stats entry for that page.
 */
async function extractPageAndTrack(pdf, pageNum, pageState) {
  try {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const chars = pageText.length;
    trackPageStats(chars, pageNum, pageState);

    return {
      textBlock: `--- PAGE ${pageNum} ---\n${pageText}\n\n`,
      stat: { pageNum, chars },
    };
  } catch (pageErr) {
    console.warn(`processLargePDF: page ${pageNum} error:`, pageErr.message);
    pageState.pagesEmpty++;
    return {
      textBlock: `--- PAGE ${pageNum} ---\n[extraction error]\n\n`,
      stat: { pageNum, chars: 0, error: pageErr.message },
    };
  }
}

/**
 * Extract + persist one batch of pages, reporting progress along the way.
 * Returns the updated processedCount after the batch completes.
 */
async function processBatch({
  pdf,
  db,
  sessionKey,
  startPage,
  endPage,
  batchSize,
  numPages,
  pageState,
  processedCount,
  onProgress,
  onBatch,
}) {
  let batchText = "";
  const batchStats = [];

  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    const { textBlock, stat } = await extractPageAndTrack(
      pdf,
      pageNum,
      pageState,
    );
    batchText += textBlock;
    batchStats.push(stat);

    processedCount++;
    onProgress(
      processedCount,
      numPages,
      Math.round((processedCount / numPages) * 100),
    );
  }

  // Write batch to IDB, then let it be garbage-collected
  const batchIndex = Math.floor((startPage - 1) / batchSize);
  await writeBatchToDB(db, sessionKey, batchIndex, batchText, batchStats);

  if (onBatch) {
    onBatch({
      batchIndex,
      startPage,
      endPage,
      totalPages: numPages,
      batchStats,
      processedSoFar: processedCount,
      pct: Math.round((processedCount / numPages) * 100),
    });
  }

  // Yield to browser to keep UI responsive
  await new Promise((resolve) => setTimeout(resolve, 0));

  return processedCount;
}

/**
 * Process ALL pages of a large PDF file in streaming batches.
 *
 * Uses URL.createObjectURL + rangeChunkSize so pdfjs fetches pages
 * on-demand without loading the entire file into RAM at once.
 * Each batch is written to IndexedDB immediately after extraction
 * and discarded from the JS heap, keeping memory usage flat for
 * documents of any size (300+ MB / 5000+ pages).
 *
 * @param {File} file - The PDF File object (browser File API)
 * @param {Object} options
 * @param {number}   [options.batchSize=20]      Pages extracted per batch
 * @param {Function} [options.onBatch]           Called after each batch with progress info
 * @param {Function} [options.onProgress]        Called as (currentPage, totalPages, pct)
 * @param {string}   [options.sessionKey]        Unique IDB namespace key (auto-generated)
 * @param {boolean}  [options.keepInIDB=false]   Leave batches in IDB after completion
 * @returns {Promise<{text, pageCount, processedPages, pagesWithText, pagesEmpty,
 *                    hasScannedSections, scannedPageRanges, method}>}
 */
export async function processLargePDF(file, options = {}) {
  const {
    batchSize = 20,
    onBatch = null,
    onProgress = () => {},
    sessionKey = `cfile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    keepInIDB = false,
  } = options;

  const db = await openCFileDB();
  const objectUrl = URL.createObjectURL(file);

  try {
    const loadingTask = pdfjsLib.getDocument({
      url: objectUrl,
      rangeChunkSize: 65536, // 64 KB per HTTP range chunk — enables streaming
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
      disableAutoFetch: false,
      disableStream: false,
    });
    attachPdfPasswordPrompt(loadingTask, options.getPassword);
    const pdf = await loadingTask.promise;

    const numPages = pdf.numPages;
    let processedCount = 0;
    const pageState = {
      pagesWithText: 0,
      pagesEmpty: 0,
      scannedRanges: [],
      currentEmptyRun: null,
    };

    // Process ALL pages sequentially in batches
    for (let startPage = 1; startPage <= numPages; startPage += batchSize) {
      const endPage = Math.min(startPage + batchSize - 1, numPages);
      processedCount = await processBatch({
        pdf,
        db,
        sessionKey,
        startPage,
        endPage,
        batchSize,
        numPages,
        pageState,
        processedCount,
        onProgress,
        onBatch,
      });
    }

    if (pageState.currentEmptyRun)
      pageState.scannedRanges.push({ ...pageState.currentEmptyRun });

    // Reassemble full text from IDB in page order
    const batches = await readAllBatchesFromDB(db, sessionKey);
    const fullText = batches.map((b) => b.text).join("");

    if (!keepInIDB) await clearSessionBatches(db, sessionKey);

    return {
      text: fullText,
      pageCount: numPages,
      processedPages: processedCount,
      pagesWithText: pageState.pagesWithText,
      pagesEmpty: pageState.pagesEmpty,
      hasScannedSections: pageState.pagesEmpty > numPages * 0.1,
      scannedPageRanges: pageState.scannedRanges,
      method: "streaming_all_pages",
    };
  } catch (error) {
    const pwError = describePdfPasswordError(error);
    if (pwError) throw pwError;
    throw error;
  } finally {
    URL.revokeObjectURL(objectUrl);
    db.close();
  }
}

/**
 * Estimate processing time based on page count
 * @param {number} pageCount - Number of pages
 * @returns {string}
 */
export function estimateProcessingTime(pageCount) {
  // Rough estimate: ~50ms per page for extraction + ~1 second per 100 pages for AI
  const extractionMinutes = Math.ceil((pageCount * 50) / 60000);
  const aiMinutes = Math.ceil(pageCount / 100);
  const totalMinutes = extractionMinutes + aiMinutes;

  if (totalMinutes < 1) return "Less than 1 minute";
  if (totalMinutes === 1) return "About 1 minute";
  if (totalMinutes < 5) return `About ${totalMinutes} minutes`;
  return `${totalMinutes}-${totalMinutes + 2} minutes`;
}
