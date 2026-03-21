/**
 * Vet-Rate.org - C-File PDF Text Extraction Utility
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * Client-side PDF text extraction using pdf.js
 * Converts large PDF files to searchable text without uploading to servers
 */

import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure pdf.js worker - use bundled worker from npm package for version compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Standard fonts CDN path (suppresses font warnings)
const STANDARD_FONT_DATA_URL =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/standard_fonts/";

/**
 * Extract text from a PDF file client-side
 * @param {ArrayBuffer} fileData - The PDF file as an ArrayBuffer
 * @param {Function} onProgress - Progress callback (currentPage, totalPages)
 * @returns {Promise<{text: string, pageCount: number, hasText: boolean}>}
 */
export async function ripTextFromPdf(fileData, onProgress = () => {}) {
  try {
    const pdf = await pdfjsLib.getDocument({
      data: fileData,
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
    }).promise;
    const numPages = pdf.numPages;
    let fullText = "";
    let totalCharacters = 0;

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
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
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

/**
 * Process a large PDF file using streaming (range requests) to avoid loading
 * the entire file into RAM.  Suitable for C-files (100MB–400MB).
 *
 * Strategy: load first `headPages` + last `tailPages` to capture both the
 * clinical narrative (front) and the Code Sheet / current ratings (back).
 *
 * @param {File} file - The large PDF File object (browser File API)
 * @param {Object} options
 * @param {number}   [options.headPages=100]   Pages to read from the start
 * @param {number}   [options.tailPages=100]   Pages to read from the end
 * @param {number}   [options.batchSize=20]    Pages per batch
 * @param {Function} [options.onBatch]         Callback(batchResult) after each batch
 * @param {Function} [options.onProgress]      Callback(currentPage, totalPages)
 * @returns {Promise<{text, pageCount, processedPages, skippedPages, hasScannedSections}>}
 */
export async function processLargePDF(file, options = {}) {
  const {
    headPages = 100,
    tailPages = 100,
    batchSize = 20,
    onBatch = null,
    onProgress = () => {},
  } = options;

  // Stream the PDF via object URL so pdfjs can range-request pages on demand
  const objectUrl = URL.createObjectURL(file);

  try {
    const pdf = await pdfjsLib.getDocument({
      url: objectUrl,
      rangeChunkSize: 65536, // 64 KB chunks — enables HTTP range streaming
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
      disableAutoFetch: false,
      disableStream: false,
    }).promise;

    const numPages = pdf.numPages;

    // Build the set of page numbers to process (1-indexed, no duplicates)
    const head = Math.min(headPages, numPages);
    const tailStart = Math.max(numPages - tailPages + 1, head + 1);
    const pagesToProcess = [];

    for (let p = 1; p <= head; p++) pagesToProcess.push(p);
    for (let p = tailStart; p <= numPages; p++) pagesToProcess.push(p);

    let fullText = "";
    let pagesWithText = 0;
    let pagesEmpty = 0;
    let processedCount = 0;

    // Process in batches
    for (
      let batchStart = 0;
      batchStart < pagesToProcess.length;
      batchStart += batchSize
    ) {
      const batch = pagesToProcess.slice(batchStart, batchStart + batchSize);
      let batchText = "";
      const batchPageStats = [];

      for (const pageNum of batch) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => item.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

          const chars = pageText.length;
          batchText += `--- PAGE ${pageNum} ---\n${pageText}\n\n`;
          batchPageStats.push({ pageNum, chars });

          if (chars >= 50) pagesWithText++;
          else pagesEmpty++;
        } catch (pageErr) {
          console.warn(
            `processLargePDF: error on page ${pageNum}:`,
            pageErr.message,
          );
          batchText += `--- PAGE ${pageNum} ---\n[extraction error]\n\n`;
          batchPageStats.push({ pageNum, chars: 0, error: pageErr.message });
          pagesEmpty++;
        }

        processedCount++;
        onProgress(processedCount, pagesToProcess.length);
      }

      fullText += batchText;

      if (onBatch) {
        onBatch({
          batchIndex: Math.floor(batchStart / batchSize),
          pagesInBatch: batch,
          batchText,
          batchPageStats,
          totalProcessedSoFar: processedCount,
        });
      }

      // Yield to browser between batches to keep UI responsive
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const skippedPages = numPages - pagesToProcess.length;
    const hasScannedSections = pagesEmpty > pagesToProcess.length * 0.3;

    return {
      text: fullText,
      pageCount: numPages,
      processedPages: processedCount,
      skippedPages,
      hasScannedSections,
      pagesWithText,
      pagesEmpty,
      method: "streaming",
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
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
