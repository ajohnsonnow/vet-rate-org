/**
 * SupplyLocker.org - C-File PDF Text Extraction Utility
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Client-side PDF text extraction using pdf.js
 * Converts large PDF files to searchable text without uploading to servers
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure pdf.js worker - use bundled worker from npm package for version compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Standard fonts CDN path (suppresses font warnings)
const STANDARD_FONT_DATA_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/standard_fonts/';

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
      standardFontDataUrl: STANDARD_FONT_DATA_URL 
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
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        totalCharacters += pageText.length;
        
        // Add page marker for AI citation (CRITICAL for source tracking)
        fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
        
        // Report progress
        onProgress(i, numPages);
        
        // Yield to browser to prevent UI freezing on large files
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
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
      totalCharacters
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
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
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
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
  
  if (totalMinutes < 1) return 'Less than 1 minute';
  if (totalMinutes === 1) return 'About 1 minute';
  if (totalMinutes < 5) return `About ${totalMinutes} minutes`;
  return `${totalMinutes}-${totalMinutes + 2} minutes`;
}

/**
 * Chunk text for API limits if needed
 * Gemini 1.5 Flash has 1M token context, so this is rarely needed
 * @param {string} text - Full text
 * @param {number} maxChars - Maximum characters per chunk (default ~800K to be safe)
 * @returns {string[]}
 */
export function chunkText(text, maxChars = 800000) {
  if (text.length <= maxChars) {
    return [text];
  }
  
  const chunks = [];
  const pages = text.split(/--- PAGE \d+ ---/);
  let currentChunk = '';
  let currentPageNum = 0;
  
  for (const pageText of pages) {
    currentPageNum++;
    const pageWithMarker = `--- PAGE ${currentPageNum} ---\n${pageText}\n`;
    
    if (currentChunk.length + pageWithMarker.length > maxChars) {
      chunks.push(currentChunk);
      currentChunk = pageWithMarker;
    } else {
      currentChunk += pageWithMarker;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}
