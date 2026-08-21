/**
 * Vet-Rate.org - Florence-2 Vision OCR Service
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PURPOSE: High-level service wrapper for Florence-2 Vision LLM
 *
 * USAGE:
 * ```javascript
 * import { florenceOCRService } from '../utils/florenceOCRService';
 *
 * // Initialize (preload model)
 * await florenceOCRService.initialize();
 *
 * // Process a PDF file
 * const { text, parsedData } = await florenceOCRService.processDocument(file);
 *
 * // Ask a specific question about a document
 * const answer = await florenceOCRService.askQuestion(file, "What is the separation date?");
 * ```
 *
 * FEATURES:
 * - Automatic WebGPU detection
 * - Model preloading with progress tracking
 * - High-resolution PDF rendering (216 DPI)
 * - Structured DD214 parsing
 * - Document VQA (Visual Question Answering)
 *
 * PRIVACY: 100% client-side. NO DATA LEAVES BROWSER.
 */

import {
  convertPdfPageToBlob,
  getPdfMetadata,
  getOptimalScale,
  isPdfFile,
  isImageFile,
  imageFileToBlob,
} from "./florencePdfUtils";
import { parseDD214Text } from "./dd214VisionParser";

/**
 * Service state
 */
let worker = null;
let isInitializing = false;
let isReady = false;
let lastError = null;

// Watchdog for worker requests - a hung WebGPU worker never replies, so
// without this the whole ingestion pipeline stalls silently
const WORKER_WATCHDOG_MS = 120000;

/**
 * Event callbacks
 */
const eventListeners = {
  progress: [],
  ready: [],
  error: [],
};

/**
 * Check if WebGPU is available
 */
export function isWebGPUSupported() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

/**
 * Get current service status
 */
export function getStatus() {
  return {
    isSupported: isWebGPUSupported(),
    isInitializing,
    isReady,
    lastError,
  };
}

/**
 * Add event listener
 */
export function addEventListener(event, callback) {
  if (eventListeners[event]) {
    eventListeners[event].push(callback);
  }
}

/**
 * Remove event listener
 */
export function removeEventListener(event, callback) {
  if (eventListeners[event]) {
    eventListeners[event] = eventListeners[event].filter(
      (cb) => cb !== callback,
    );
  }
}

/**
 * Emit event to listeners
 */
function emit(event, data) {
  if (eventListeners[event]) {
    eventListeners[event].forEach((cb) => cb(data));
  }
}

/**
 * Initialize the Florence-2 Vision engine
 * Call this early (e.g., on page load) to preload the model
 *
 * @returns {Promise<boolean>} True if initialization successful
 */
export async function initialize() {
  // Already initialized
  if (isReady) {
    return true;
  }

  // Already initializing
  if (isInitializing) {
    return new Promise((resolve) => {
      addEventListener("ready", () => resolve(true));
      addEventListener("error", () => resolve(false));
    });
  }

  // Check WebGPU support
  if (!isWebGPUSupported()) {
    lastError = "WebGPU is not supported in this browser";
    emit("error", { error: lastError });
    return false;
  }

  isInitializing = true;
  lastError = null;

  return new Promise((resolve) => {
    try {
      // Create worker
      worker = new Worker(
        new URL("../workers/florence-ocr-worker.js", import.meta.url),
        { type: "module" },
      );

      // Message handler
      worker.onmessage = (e) => {
        const { status, progress, message, error, errorType } = e.data;

        switch (status) {
          case "loading":
            emit("progress", { progress, message });
            break;

          case "ready":
            isReady = true;
            isInitializing = false;
            emit("ready", {});
            resolve(true);
            break;

          case "error":
            lastError = error;
            isInitializing = false;
            emit("error", { error, errorType });
            resolve(false);
            break;
        }
      };

      worker.onerror = (err) => {
        lastError = err.message;
        isInitializing = false;
        emit("error", { error: err.message });
        resolve(false);
      };

      // Start model loading
      worker.postMessage({ type: "LOAD" });
    } catch (err) {
      lastError = err.message;
      isInitializing = false;
      emit("error", { error: err.message });
      resolve(false);
    }
  });
}

/**
 * Resolve a file (PDF page or image) to an image blob for the worker
 */
async function resolveImageBlob(file, pageNumber, scale) {
  let imageBlob;

  if (isPdfFile(file)) {
    // Get optimal scale if not specified
    let renderScale = scale;
    if (!renderScale) {
      const metadata = await getPdfMetadata(file);
      renderScale = getOptimalScale(metadata);
    }

    imageBlob = await convertPdfPageToBlob(file, pageNumber, renderScale);
  } else if (isImageFile(file)) {
    imageBlob = await imageFileToBlob(file);
  } else {
    throw new Error("Unsupported file type. Use PDF or image files.");
  }

  return imageBlob;
}

/**
 * Process a document (PDF or image) and extract text
 *
 * @param {File} file - PDF or image file
 * @param {Object} options - Processing options
 * @param {number} options.pageNumber - Page to process (default: 1)
 * @param {number} options.scale - Render scale (default: auto-detect)
 * @param {boolean} options.parseDD214 - Parse as DD214 (default: true)
 * @returns {Promise<{text: string, parsedData?: Object}>}
 */
export async function processDocument(file, options = {}) {
  const { pageNumber = 1, scale, parseDD214: shouldParse = true } = options;

  // Ensure initialized
  if (!isReady) {
    const success = await initialize();
    if (!success) {
      throw new Error(lastError || "Failed to initialize vision engine");
    }
  }

  // Convert file to image blob
  const imageBlob = await resolveImageBlob(file, pageNumber, scale);

  // Send to worker and wait for result
  return new Promise((resolve, reject) => {
    const activeWorker = worker;

    const watchdog = setTimeout(() => {
      activeWorker.removeEventListener("message", messageHandler);
      activeWorker.terminate();
      // Null the worker so the next call recreates it from scratch
      if (worker === activeWorker) {
        worker = null;
        isReady = false;
      }
      reject(
        new Error(
          `FLORENCE_WORKER_TIMEOUT: Vision OCR did not respond within ${WORKER_WATCHDOG_MS / 1000}s. The vision worker was restarted - retry, or processing will fall back to standard OCR.`,
        ),
      );
    }, WORKER_WATCHDOG_MS);

    const messageHandler = (e) => {
      const { status, text, error } = e.data;

      if (status === "complete") {
        clearTimeout(watchdog);
        activeWorker.removeEventListener("message", messageHandler);

        // Debug: Log raw Florence output to understand format
        // eslint-disable-next-line no-console
        console.log("🔍 [FlorenceOCR] Raw worker response:", e.data);
        // eslint-disable-next-line no-console
        console.log("🔍 [FlorenceOCR] Text type:", typeof text);
        // eslint-disable-next-line no-console
        console.log("🔍 [FlorenceOCR] Text content:", text);

        // Extract text from result - handle various Florence output formats
        let extractedText;
        if (typeof text === "string") {
          extractedText = text;
        } else if (text && typeof text === "object") {
          // Florence may return { '<OCR>': 'text' } or similar
          extractedText =
            text["<OCR>"] || text.text || text.ocr || JSON.stringify(text);
        } else {
          extractedText = String(text || "");
        }

        // eslint-disable-next-line no-console
        console.log(
          "🔍 [FlorenceOCR] Extracted text (first 500 chars):",
          extractedText?.substring(0, 500),
        );

        // Parse as DD214 if requested
        let parsedData = null;
        if (shouldParse) {
          parsedData = parseDD214Text(extractedText);
          // eslint-disable-next-line no-console
          console.log(
            "🔍 [FlorenceOCR] Parsed DD214 data:",
            parsedData?.fields
              ? Object.keys(parsedData.fields).filter(
                  (k) => parsedData.fields[k],
                )
              : "no fields",
          );
        }

        resolve({ text: extractedText, parsedData });
      }

      if (status === "error") {
        clearTimeout(watchdog);
        activeWorker.removeEventListener("message", messageHandler);
        reject(new Error(error));
      }
    };

    activeWorker.addEventListener("message", messageHandler);
    activeWorker.postMessage({ type: "ANALYZE", payload: { imageBlob } });

    // Debug logging
    // eslint-disable-next-line no-console
    console.log("🔍 [FlorenceOCR] Sent image to worker for analysis...");
  });
}

/**
 * Ask a specific question about a document (Document VQA)
 *
 * @param {File} file - PDF or image file
 * @param {string} question - Question to ask about the document
 * @param {Object} options - Processing options
 * @returns {Promise<string>} Answer to the question
 */
export async function askQuestion(file, question, options = {}) {
  const { pageNumber = 1, scale } = options;

  // Ensure initialized
  if (!isReady) {
    const success = await initialize();
    if (!success) {
      throw new Error(lastError || "Failed to initialize vision engine");
    }
  }

  // Convert file to image blob
  let imageBlob;

  if (isPdfFile(file)) {
    let renderScale = scale;
    if (!renderScale) {
      const metadata = await getPdfMetadata(file);
      renderScale = getOptimalScale(metadata);
    }
    imageBlob = await convertPdfPageToBlob(file, pageNumber, renderScale);
  } else if (isImageFile(file)) {
    imageBlob = await imageFileToBlob(file);
  } else {
    throw new Error("Unsupported file type. Use PDF or image files.");
  }

  // Send to worker
  return new Promise((resolve, reject) => {
    const messageHandler = (e) => {
      const { status, answer, error } = e.data;

      if (status === "complete") {
        worker.removeEventListener("message", messageHandler);
        resolve(answer);
      }

      if (status === "error") {
        worker.removeEventListener("message", messageHandler);
        reject(new Error(error));
      }
    };

    worker.addEventListener("message", messageHandler);
    worker.postMessage({
      type: "DOC_VQA",
      payload: { imageBlob, question },
    });
  });
}

/**
 * Process multiple pages from a PDF
 *
 * @param {File} file - PDF file
 * @param {Object} options - Processing options
 * @param {number[]} options.pages - Page numbers to process (default: all)
 * @param {number} options.maxPages - Maximum pages to process (default: 10)
 * @param {Function} options.onPageComplete - Callback after each page
 * @returns {Promise<{pages: Array, combinedText: string, parsedData?: Object}>}
 */
export async function processMultiplePages(file, options = {}) {
  const { pages, maxPages = 10, onPageComplete } = options;

  if (!isPdfFile(file)) {
    throw new Error("Multi-page processing only supports PDF files");
  }

  const metadata = await getPdfMetadata(file);
  const pagesToProcess =
    pages ||
    Array.from(
      { length: Math.min(metadata.numPages, maxPages) },
      (_, i) => i + 1,
    );

  const results = [];
  const scale = getOptimalScale(metadata);

  for (const pageNum of pagesToProcess) {
    const result = await processDocument(file, {
      pageNumber: pageNum,
      scale,
      parseDD214: false,
    });

    results.push({ pageNumber: pageNum, text: result.text });

    if (onPageComplete) {
      onPageComplete(pageNum, pagesToProcess.length, result);
    }
  }

  // Combine all text
  const combinedText = results
    .map((r) => r.text)
    .join("\n\n--- Page Break ---\n\n");

  // Parse combined text
  const parsedData = parseDD214Text(combinedText);

  return {
    pages: results,
    combinedText,
    parsedData,
    totalPages: metadata.numPages,
    processedPages: pagesToProcess.length,
  };
}

/**
 * Shutdown the worker and free resources
 */
export function shutdown() {
  if (worker) {
    worker.postMessage({ type: "UNLOAD" });
    worker.terminate();
    worker = null;
  }

  isReady = false;
  isInitializing = false;
  lastError = null;
}

/**
 * Export service object for convenient access
 */
export const florenceOCRService = {
  isWebGPUSupported,
  getStatus,
  addEventListener,
  removeEventListener,
  initialize,
  processDocument,
  askQuestion,
  processMultiplePages,
  shutdown,
};

export default florenceOCRService;
