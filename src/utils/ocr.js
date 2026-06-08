/**
 * Vet-Rate.org - Local OCR Engine (Legacy Wrapper)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * Wrapper for advanced OCR system - maintains backward compatibility
 */

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

export async function analyzeImage(file, _onProgress = () => {}) {
  // For image files, wrap them in a single-page PDF-like result
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const img = new Image();
        img.onload = () => {
          resolve({
            text: "", // Images require OCR processing
            method: "image",
            confidence: 0,
            pageCount: 1,
            processingTime: 0,
            metadata: {
              width: img.width,
              height: img.height,
              filename: file.name,
              size: file.size,
            },
          });
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target.result;
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
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
