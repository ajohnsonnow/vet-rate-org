/**
 * Vet-Rate.org - Local OCR Engine for Scanned PDF Support
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * This utility enables local, privacy-first OCR processing of scanned PDFs
 * using Tesseract.js (OCR) and pdfjs-dist (PDF rendering).
 * 
 * ARCHITECTURE:
 * 1. Fast Path: Attempt standard text extraction first
 * 2. OCR Fallback: If text is sparse (<50 chars avg/page), switch to OCR mode
 * 3. Everything runs 100% client-side - no data leaves the browser
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Tesseract from 'tesseract.js';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// OCR Configuration
const OCR_CONFIG = {
  MIN_CHARS_PER_PAGE: 50, // Below this threshold, we assume scanned/image PDF
  MAX_OCR_PAGES: 4,       // Max pages to OCR (first pages have critical info)
  CANVAS_SCALE: 2.0,      // Higher = better OCR but slower
  LANGUAGES: 'eng',       // English for DD214s
};

/**
 * OCR Progress States
 */
export const OCR_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  EXTRACTING_TEXT: 'extracting_text',
  SCANNING_DOCUMENT: 'scanning_document',
  OCR_IN_PROGRESS: 'ocr_in_progress',
  COMPLETE: 'complete',
  ERROR: 'error',
};

/**
 * Progress callback type
 * @typedef {Object} OCRProgress
 * @property {string} state - Current state from OCR_STATES
 * @property {number} progress - 0-100 percentage
 * @property {string} message - Human-readable status message
 * @property {number} [currentPage] - Current page being processed
 * @property {number} [totalPages] - Total pages in document
 */

/**
 * Main PDF Analysis Function
 * Intelligently extracts text from PDFs, with automatic OCR fallback for scanned documents
 * 
 * @param {File} file - PDF file to analyze
 * @param {Function} onProgress - Progress callback: (progress: OCRProgress) => void
 * @returns {Promise<{text: string, pageCount: number, method: 'text'|'ocr'|'hybrid', ocrUsed: boolean}>}
 */
export async function analyzePDF(file, onProgress = () => {}) {
  // Validate input
  if (!file) {
    throw new Error('No file provided');
  }
  
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('File must be a PDF document');
  }

  // Report initial state
  onProgress({
    state: OCR_STATES.LOADING,
    progress: 0,
    message: 'Loading document...',
  });

  try {
    // Read file into ArrayBuffer
    const arrayBuffer = await readFileAsArrayBuffer(file);
    
    // Load PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    
    onProgress({
      state: OCR_STATES.EXTRACTING_TEXT,
      progress: 5,
      message: `Analyzing ${numPages} page${numPages > 1 ? 's' : ''}...`,
      totalPages: numPages,
    });

    // STEP A: Try standard text extraction first (fast path)
    const textResult = await extractTextFromPDF(pdf, numPages, (current, total) => {
      const progress = 5 + (current / total) * 40; // 5-45%
      onProgress({
        state: OCR_STATES.EXTRACTING_TEXT,
        progress: Math.round(progress),
        message: `Extracting text: page ${current} of ${total}`,
        currentPage: current,
        totalPages: total,
      });
    });

    // STEP B: Check if text extraction yielded sufficient content
    const avgCharsPerPage = textResult.totalCharacters / numPages;
    const hasAdequateText = avgCharsPerPage >= OCR_CONFIG.MIN_CHARS_PER_PAGE;

    if (hasAdequateText) {
      // Text extraction was successful - return results
      onProgress({
        state: OCR_STATES.COMPLETE,
        progress: 100,
        message: 'Document processed successfully',
        totalPages: numPages,
      });

      return {
        text: textResult.text,
        pageCount: numPages,
        method: 'text',
        ocrUsed: false,
        avgCharsPerPage: Math.round(avgCharsPerPage),
      };
    }

    // STEP C: Text is sparse - switch to OCR mode
    console.log(`Sparse text detected (${Math.round(avgCharsPerPage)} chars/page avg). Switching to OCR mode...`);
    
    onProgress({
      state: OCR_STATES.SCANNING_DOCUMENT,
      progress: 50,
      message: 'Scanned document detected. Starting OCR analysis...',
      totalPages: numPages,
    });

    // Determine pages to OCR (first N pages contain critical DD214 info)
    const pagesToOCR = Math.min(numPages, OCR_CONFIG.MAX_OCR_PAGES);
    
    // Run OCR on the pages
    const ocrText = await runOCROnPDF(pdf, pagesToOCR, (current, total, ocrProgress) => {
      const baseProgress = 50 + (current / total) * 45; // 50-95%
      const pageProgress = ocrProgress || 0;
      const finalProgress = baseProgress + (pageProgress / 100) * (45 / total);
      
      onProgress({
        state: OCR_STATES.OCR_IN_PROGRESS,
        progress: Math.round(Math.min(finalProgress, 95)),
        message: `Scanning page ${current} of ${total}... ${Math.round(pageProgress)}%`,
        currentPage: current,
        totalPages: total,
      });
    });

    // Combine any extracted text with OCR results
    // OCR takes precedence for the pages we scanned
    let finalText = ocrText;
    
    // If there are more pages than we OCR'd, append the (sparse) text extraction
    if (numPages > pagesToOCR) {
      const remainingPages = textResult.pageTexts.slice(pagesToOCR);
      remainingPages.forEach((pageText, idx) => {
        const pageNum = pagesToOCR + idx + 1;
        finalText += `\n--- PAGE ${pageNum} ---\n${pageText}\n`;
      });
    }

    onProgress({
      state: OCR_STATES.COMPLETE,
      progress: 100,
      message: `Document scanned successfully (${pagesToOCR} page${pagesToOCR > 1 ? 's' : ''} via OCR)`,
      totalPages: numPages,
    });

    return {
      text: finalText,
      pageCount: numPages,
      method: numPages > pagesToOCR ? 'hybrid' : 'ocr',
      ocrUsed: true,
      pagesOCRd: pagesToOCR,
      avgCharsPerPage: Math.round(avgCharsPerPage),
    };

  } catch (error) {
    onProgress({
      state: OCR_STATES.ERROR,
      progress: 0,
      message: `Error: ${error.message}`,
    });
    throw error;
  }
}

/**
 * Extract text from PDF using pdfjs-dist (fast method)
 * @private
 */
async function extractTextFromPDF(pdf, numPages, onProgress) {
  let fullText = '';
  let totalCharacters = 0;
  const pageTexts = [];

  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      pageTexts.push(pageText);
      totalCharacters += pageText.length;
      fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
      
      onProgress(i, numPages);
      
      // Yield to browser every 5 pages
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } catch (pageError) {
      console.warn(`Error extracting page ${i}:`, pageError);
      pageTexts.push('');
      fullText += `--- PAGE ${i} ---\n[Page extraction error]\n\n`;
      onProgress(i, numPages);
    }
  }

  return {
    text: fullText,
    totalCharacters,
    pageTexts,
  };
}

/**
 * Run OCR on PDF pages using Tesseract.js
 * @private
 */
async function runOCROnPDF(pdf, pagesToOCR, onProgress) {
  let ocrText = '';
  let currentPage = 1;
  
  // Initialize Tesseract worker once for all pages (more efficient)
  // Progress is handled via the logger callback during worker creation
  const worker = await Tesseract.createWorker(OCR_CONFIG.LANGUAGES, 1, {
    logger: (m) => {
      // Only report progress during recognition phase
      if (m.status === 'recognizing text' && m.progress !== undefined) {
        onProgress(currentPage, pagesToOCR, m.progress * 100);
      }
    },
  });

  try {
    for (let i = 1; i <= pagesToOCR; i++) {
      currentPage = i;
      
      // Render page to canvas
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: OCR_CONFIG.CANVAS_SCALE });
      
      // Create off-screen canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      // Get canvas data URL for Tesseract
      const imageData = canvas.toDataURL('image/png');
      
      // Run OCR - progress is reported via the logger callback set during worker creation
      const result = await worker.recognize(imageData);
      
      // Add page text to results
      const pageText = result.data.text.trim();
      ocrText += `--- PAGE ${i} (OCR) ---\n${pageText}\n\n`;
      
      // Cleanup
      canvas.remove();
      
      // Report page complete
      onProgress(i, pagesToOCR, 100);
    }
  } finally {
    // Always terminate worker to free memory
    await worker.terminate();
  }
  
  return ocrText;
}

/**
 * Read File to ArrayBuffer
 * @param {File} file 
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * OCR Progress Bar Component Helper
 * Returns styling classes and message based on OCR state
 * @param {OCRProgress} progress 
 * @returns {{barColor: string, bgColor: string, textColor: string, icon: string}}
 */
export function getProgressStyling(progress) {
  switch (progress.state) {
    case OCR_STATES.LOADING:
      return {
        barColor: 'bg-blue-500',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-700 dark:text-blue-300',
        icon: '📥',
      };
    case OCR_STATES.EXTRACTING_TEXT:
      return {
        barColor: 'bg-green-500',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-300',
        icon: '📄',
      };
    case OCR_STATES.SCANNING_DOCUMENT:
    case OCR_STATES.OCR_IN_PROGRESS:
      return {
        barColor: 'bg-amber-500',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        textColor: 'text-amber-700 dark:text-amber-300',
        icon: '🔍',
      };
    case OCR_STATES.COMPLETE:
      return {
        barColor: 'bg-green-500',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-300',
        icon: '✅',
      };
    case OCR_STATES.ERROR:
      return {
        barColor: 'bg-red-500',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        textColor: 'text-red-700 dark:text-red-300',
        icon: '❌',
      };
    default:
      return {
        barColor: 'bg-gray-500',
        bgColor: 'bg-gray-100 dark:bg-gray-900/30',
        textColor: 'text-gray-700 dark:text-gray-300',
        icon: '⏳',
      };
  }
}

/**
 * Format file size for display
 * @param {number} bytes 
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Estimate processing time based on file size and page count
 * @param {File} file
 * @param {number} pageCount 
 * @returns {string}
 */
export function estimateOCRTime(file, pageCount = 1) {
  const sizeMB = file.size / (1024 * 1024);
  
  // Text extraction: ~50ms per page
  // OCR: ~5-15 seconds per page depending on complexity
  const textTime = pageCount * 0.05; // seconds
  const ocrTime = Math.min(pageCount, OCR_CONFIG.MAX_OCR_PAGES) * 10; // ~10s per page
  
  // Estimate based on file size (larger = more likely scanned)
  const estimatedSeconds = sizeMB > 2 ? textTime + ocrTime : textTime;
  
  if (estimatedSeconds < 5) return 'A few seconds';
  if (estimatedSeconds < 30) return 'Under 30 seconds';
  if (estimatedSeconds < 60) return 'About 1 minute';
  return `${Math.ceil(estimatedSeconds / 60)}-${Math.ceil(estimatedSeconds / 60) + 1} minutes`;
}

export default analyzePDF;
