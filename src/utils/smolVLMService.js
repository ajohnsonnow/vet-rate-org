/**
 * Vet-Rate.org - SmolVLM Vision Service
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * High-level wrapper for the SmolVLM-256M vision worker.
 * Replaces the broken MLC WebLLM Phi-3.5-vision path with a fully functional
 * in-browser VLM backed by transformers.js v3 + WebGPU.
 *
 * USAGE:
 * ```js
 * import { smolVLMService, isSmolVLMSupported } from './smolVLMService';
 *
 * if (isSmolVLMSupported()) {
 *   await smolVLMService.initialize();
 *   const { text } = await smolVLMService.analyzeImage(pdfFile, {
 *     prompt: "Extract all information from this DD214 document as JSON.",
 *   });
 * }
 * ```
 */

import {
  convertPdfPageToBlob,
  getPdfMetadata,
  getOptimalScale,
  isPdfFile,
  isImageFile,
  imageFileToBlob,
} from "./florencePdfUtils";

// ── Service state ─────────────────────────────────────────────────────────────
let worker = null;
let isInitializing = false;
let isReady = false;
let lastError = null;

const eventListeners = { progress: [], ready: [], error: [] };

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check if SmolVLM can run in this browser (requires WebGPU).
 */
export function isSmolVLMSupported() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

/** Current service status snapshot */
export function getStatus() {
  return {
    isSupported: isSmolVLMSupported(),
    isInitializing,
    isReady,
    lastError,
  };
}

export function addEventListener(event, cb) {
  if (eventListeners[event]) eventListeners[event].push(cb);
}
export function removeEventListener(event, cb) {
  if (eventListeners[event])
    eventListeners[event] = eventListeners[event].filter((x) => x !== cb);
}
function emit(event, data) {
  (eventListeners[event] || []).forEach((cb) => cb(data));
}

/**
 * Initialize the SmolVLM engine (idempotent — safe to call multiple times).
 * @returns {Promise<boolean>}
 */
export async function initialize() {
  if (isReady) return true;
  if (isInitializing) {
    return new Promise((resolve) => {
      addEventListener("ready", () => resolve(true));
      addEventListener("error", () => resolve(false));
    });
  }
  if (!isSmolVLMSupported()) {
    lastError = "WebGPU is not supported in this browser";
    emit("error", { error: lastError });
    return false;
  }

  isInitializing = true;
  lastError = null;

  return new Promise((resolve) => {
    try {
      worker = new Worker(
        new URL("../workers/smolvlm-worker.js", import.meta.url),
        { type: "module" },
      );

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
 * Analyze a single page of a PDF or image file with a text prompt.
 *
 * @param {File} file  - PDF or image file
 * @param {Object} options
 * @param {string}   options.prompt       - Instruction sent to the model
 * @param {number}   options.pageNumber   - PDF page to process (default: 1)
 * @param {number}   options.scale        - Render scale override
 * @param {Function} options.onToken      - Called with each streamed token
 * @returns {Promise<{ text: string }>}
 */
export async function analyzeImage(file, options = {}) {
  const { prompt, pageNumber = 1, scale, onToken } = options;

  if (!isReady) {
    const ok = await initialize();
    if (!ok) throw new Error(lastError || "Failed to initialize SmolVLM");
  }

  let imageBlob;
  if (isPdfFile(file)) {
    const renderScale = scale ?? getOptimalScale(await getPdfMetadata(file));
    imageBlob = await convertPdfPageToBlob(file, pageNumber, renderScale);
  } else if (isImageFile(file)) {
    imageBlob = await imageFileToBlob(file);
  } else {
    throw new Error("Unsupported file type. Use PDF or image files.");
  }

  return new Promise((resolve, reject) => {
    const handler = (e) => {
      const { status, text, token, error } = e.data;
      if (status === "streaming" && onToken) onToken(token);
      if (status === "complete") {
        worker.removeEventListener("message", handler);
        resolve({ text });
      }
      if (status === "error") {
        worker.removeEventListener("message", handler);
        reject(new Error(error));
      }
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ type: "ANALYZE", payload: { imageBlob, prompt } });
  });
}

/**
 * Process multiple PDF pages and concatenate results.
 *
 * @param {File} file
 * @param {Object} options
 * @param {number[]} options.pages       - Explicit page list (default: all, up to maxPages)
 * @param {number}   options.maxPages    - Cap pages processed (default: 4)
 * @param {string}   options.prompt      - Prompt applied to each page
 * @param {Function} options.onPageComplete - Called after each page
 * @returns {Promise<{ combinedText: string, pages: Array, totalPages: number }>}
 */
export async function processMultiplePages(file, options = {}) {
  const { pages, maxPages = 4, prompt, onPageComplete } = options;

  if (!isPdfFile(file))
    throw new Error("Multi-page processing requires a PDF.");

  const metadata = await getPdfMetadata(file);
  const scale = getOptimalScale(metadata);
  const pagesToProcess =
    pages ??
    Array.from(
      { length: Math.min(metadata.numPages, maxPages) },
      (_, i) => i + 1,
    );

  const results = [];
  for (const pageNum of pagesToProcess) {
    const result = await analyzeImage(file, {
      prompt,
      pageNumber: pageNum,
      scale,
    });
    results.push({ pageNumber: pageNum, text: result.text });
    onPageComplete?.(pageNum, pagesToProcess.length, result);
  }

  const combinedText = results
    .map((r) => r.text)
    .join("\n\n--- Page Break ---\n\n");
  return {
    pages: results,
    combinedText,
    totalPages: metadata.numPages,
    processedPages: pagesToProcess.length,
  };
}

/**
 * Free GPU memory by unloading the model.
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

export const smolVLMService = {
  isSmolVLMSupported,
  getStatus,
  addEventListener,
  removeEventListener,
  initialize,
  analyzeImage,
  processMultiplePages,
  shutdown,
};

export default smolVLMService;
