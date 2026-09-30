/**
 * Vet-Rate.org - Local OCR Engine (Legacy Wrapper)
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Wrapper for advanced OCR system - maintains backward compatibility
 */

import { createWorker } from "tesseract.js";
import advancedPDFAnalysis from "./advancedOCR";
export {
  ADVANCED_OCR_CONFIG as OCR_CONFIG,
  PREPROCESS_STRATEGIES,
} from "./advancedOCR";
export { formatFileSize } from "./pdfExtractor";

export const OCR_STATES = {
  IDLE: "idle",
  LOADING: "loading",
  EXTRACTING_TEXT: "extracting_text",
  SCANNING_DOCUMENT: "scanning_document",
  OCR_IN_PROGRESS: "ocr_in_progress",
  COMPLETE: "complete",
  ERROR: "error",
};

/**
 * Utility Functions
 */
export function isImageFile(filename) {
  const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i;
  return imageExtensions.test(filename);
}

export function isPDFFile(filename) {
  return /\.pdf$/i.test(filename);
}

function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

// D19-1: this used to always resolve `text: ""` without ever running OCR -
// every dropped image showed "No text extracted" no matter what it
// contained. Reuses the same working call sequence DenialDecoder.jsx's
// handleImageSelect already runs against tesseract.js directly
// (createWorker -> recognize(file) -> terminate) rather than a second,
// separate OCR implementation.
export async function analyzeImage(file, onProgress = () => {}) {
  const { width, height } = await readImageDimensions(file);

  const startTime = Date.now();
  onProgress({
    state: OCR_STATES.LOADING,
    progress: 0,
    message: "Loading OCR engine...",
  });

  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        onProgress({
          state: OCR_STATES.OCR_IN_PROGRESS,
          progress: Math.round(m.progress * 100),
          message: "Reading image...",
        });
      }
    },
  });

  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(file);

    onProgress({
      state: OCR_STATES.COMPLETE,
      progress: 100,
      message: "Text extraction complete",
    });

    return {
      text: text || "",
      method: "tesseract",
      confidence: confidence ?? 0,
      pageCount: 1,
      processingTime: Date.now() - startTime,
      metadata: { width, height, filename: file.name, size: file.size },
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Main PDF Analysis Function
 */
export async function analyzePDF(file, onProgress = () => {}) {
  // eslint-disable-next-line no-console
  console.log("🔬 Starting PDF analysis with advanced OCR system...");

  try {
    const result = await advancedPDFAnalysis(file, {}, (progress) => {
      const state = mapProgressState(progress.stage);
      onProgress({
        state,
        progress: progress.progress || 0,
        message: progress.message || "",
        currentPage: progress.currentPage,
        totalPages: progress.totalPages,
      });
    });

    // eslint-disable-next-line no-console
    console.log(
      `✅ OCR complete: ${result.method}, ${result.confidence.toFixed(0)}% confidence, ${result.processingTime}ms`,
    );
    return result;
  } catch (error) {
    console.error("❌ PDF analysis failed:", error);
    onProgress({
      state: OCR_STATES.ERROR,
      progress: 0,
      message: error.message || "OCR failed",
    });
    throw error;
  }
}

function mapProgressState(stage) {
  const mapping = {
    loading: OCR_STATES.LOADING,
    analyzing: OCR_STATES.EXTRACTING_TEXT,
    extracting: OCR_STATES.EXTRACTING_TEXT,
    ocr: OCR_STATES.OCR_IN_PROGRESS,
    complete: OCR_STATES.COMPLETE,
    error: OCR_STATES.ERROR,
  };
  return mapping[stage] || OCR_STATES.IDLE;
}

export function getProgressStyling(progress) {
  switch (progress.state) {
    case OCR_STATES.LOADING:
      return {
        barColor: "bg-blue-500",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        textColor: "text-blue-700 dark:text-blue-300",
        icon: "📥",
      };
    case OCR_STATES.EXTRACTING_TEXT:
      return {
        barColor: "bg-green-500",
        bgColor: "bg-green-100 dark:bg-green-900/30",
        textColor: "text-green-700 dark:text-green-300",
        icon: "📄",
      };
    case OCR_STATES.OCR_IN_PROGRESS:
      return {
        barColor: "bg-purple-500",
        bgColor: "bg-purple-100 dark:bg-purple-900/30",
        textColor: "text-purple-700 dark:text-purple-300",
        icon: "🔬",
      };
    case OCR_STATES.COMPLETE:
      return {
        barColor: "bg-green-600",
        bgColor: "bg-green-100 dark:bg-green-900/30",
        textColor: "text-green-700 dark:text-green-300",
        icon: "✅",
      };
    case OCR_STATES.ERROR:
      return {
        barColor: "bg-red-500",
        bgColor: "bg-red-100 dark:bg-red-900/30",
        textColor: "text-red-700 dark:text-red-300",
        icon: "❌",
      };
    default:
      return {
        barColor: "bg-gray-400",
        bgColor: "bg-gray-100 dark:bg-gray-900/30",
        textColor: "text-gray-700 dark:text-gray-300",
        icon: "⏳",
      };
  }
}
