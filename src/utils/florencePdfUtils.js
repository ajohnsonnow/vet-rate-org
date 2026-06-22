/**
 * Vet-Rate.org - High-Resolution PDF Utilities for Vision OCR
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * PURPOSE: Convert PDF pages to high-resolution images for Florence-2 VLM
 *
 * KEY INSIGHT: Most "OCR failed" errors are actually "resolution too low" errors.
 * DD214s often have tiny text (service numbers, dates) that need 200+ DPI.
 *
 * RESOLUTION STRATEGY:
 * - Scale 1.0 = 72 DPI (PDF default) - Too blurry for AI
 * - Scale 2.0 = 144 DPI - Minimum acceptable
 * - Scale 3.0 = 216 DPI - Sweet spot for documents (DEFAULT)
 * - Scale 4.0 = 288 DPI - For severely degraded scans
 */

import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Standard fonts CDN for PDF.js text rendering
const STANDARD_FONT_DATA_URL =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;

/**
 * PDF conversion configuration
 */
export const PDF_CONFIG = {
  // Resolution scales
  SCALE_NORMAL: 2.0, // 144 DPI - Quick preview
  SCALE_HIGH: 3.0, // 216 DPI - Default for OCR
  SCALE_ULTRA: 4.0, // 288 DPI - Degraded documents
  SCALE_EXTREME: 5.0, // 360 DPI - Very poor quality originals

  // Output format
  OUTPUT_FORMAT: "image/png", // PNG for lossless quality
  OUTPUT_QUALITY: 1.0, // Max quality

  // Processing limits
  MAX_PAGES: 10, // Safety limit
  MAX_DIMENSION: 4096, // Max canvas dimension (WebGL limit)
};

/**
 * Convert a single PDF page to a high-resolution image blob
 *
 * @param {File|ArrayBuffer|Uint8Array} pdfInput - PDF file or data
 * @param {number} pageNum - Page number (1-indexed)
 * @param {number} scale - Render scale (default: 3.0 for 216 DPI)
 * @returns {Promise<Blob>} PNG image blob
 */
export async function convertPdfPageToBlob(
  pdfInput,
  pageNum = 1,
  scale = PDF_CONFIG.SCALE_HIGH,
) {
  // Handle different input types
  let pdfData;
  if (pdfInput instanceof File) {
    pdfData = await pdfInput.arrayBuffer();
  } else if (pdfInput instanceof ArrayBuffer) {
    pdfData = pdfInput;
  } else if (pdfInput instanceof Uint8Array) {
    pdfData = pdfInput.buffer;
  } else {
    throw new Error("Invalid PDF input type");
  }

  // Load PDF document
  const loadingTask = pdfjsLib.getDocument({
    data: pdfData,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;

  // Validate page number
  if (pageNum < 1 || pageNum > pdf.numPages) {
    throw new Error(
      `Invalid page number: ${pageNum}. PDF has ${pdf.numPages} pages.`,
    );
  }

  const page = await pdf.getPage(pageNum);

  // Calculate viewport with scale
  let viewport = page.getViewport({ scale });

  // Safety check: limit dimensions to prevent WebGL crashes
  if (
    viewport.width > PDF_CONFIG.MAX_DIMENSION ||
    viewport.height > PDF_CONFIG.MAX_DIMENSION
  ) {
    const reductionFactor =
      PDF_CONFIG.MAX_DIMENSION / Math.max(viewport.width, viewport.height);
    const adjustedScale = scale * reductionFactor;
    viewport = page.getViewport({ scale: adjustedScale });
    console.warn(
      `[PDF] Reduced scale to ${adjustedScale.toFixed(2)} to fit canvas limits`,
    );
  }

  // Create off-screen canvas
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext("2d", {
    alpha: false, // No transparency needed
    willReadFrequently: false, // Optimize for write-heavy usage
  });

  // White background (essential for OCR - removes transparency artifacts)
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Render PDF page to canvas
  await page.render({
    canvasContext: context,
    viewport: viewport,
    intent: "print", // Higher quality rendering mode
  }).promise;

  // Convert canvas to PNG blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas toBlob failed"));
        }
      },
      PDF_CONFIG.OUTPUT_FORMAT,
      PDF_CONFIG.OUTPUT_QUALITY,
    );
  });
}

/**
 * Get PDF metadata (page count, dimensions, etc.)
 *
 * @param {File|ArrayBuffer} pdfInput - PDF file or data
 * @returns {Promise<Object>} PDF metadata
 */
export async function getPdfMetadata(pdfInput) {
  let pdfData;
  if (pdfInput instanceof File) {
    pdfData = await pdfInput.arrayBuffer();
  } else {
    pdfData = pdfInput;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: pdfData,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });

  const pdf = await loadingTask.promise;
  const metadata = await pdf.getMetadata().catch(() => ({}));

  // Get first page dimensions
  const firstPage = await pdf.getPage(1);
  const viewport = firstPage.getViewport({ scale: 1.0 });

  return {
    numPages: pdf.numPages,
    pageWidth: viewport.width,
    pageHeight: viewport.height,
    title: metadata?.info?.Title || null,
    author: metadata?.info?.Author || null,
    creator: metadata?.info?.Creator || null,
    producer: metadata?.info?.Producer || null,
    creationDate: metadata?.info?.CreationDate || null,
    modDate: metadata?.info?.ModDate || null,
  };
}

/**
 * Check if a file is a valid PDF
 *
 * @param {File} file - File to check
 * @returns {boolean} True if PDF
 */
export function isPdfFile(file) {
  if (!file) return false;

  // Check MIME type
  if (file.type === "application/pdf") return true;

  // Check extension
  if (file.name.toLowerCase().endsWith(".pdf")) return true;

  return false;
}

/**
 * Check if a file is an image
 *
 * @param {File} file - File to check
 * @returns {boolean} True if image
 */
export function isImageFile(file) {
  if (!file) return false;

  const imageTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/bmp",
  ];
  return imageTypes.includes(file.type);
}

/**
 * Convert image file to blob (for consistency with PDF handling)
 *
 * @param {File} imageFile - Image file
 * @returns {Promise<Blob>} Image as blob
 */
export async function imageFileToBlob(imageFile) {
  return new Blob([await imageFile.arrayBuffer()], { type: imageFile.type });
}

/**
 * Automatically select optimal scale based on PDF characteristics
 *
 * @param {Object} metadata - PDF metadata from getPdfMetadata
 * @returns {number} Recommended scale
 */
export function getOptimalScale(metadata) {
  // Small pages (likely scanned at low DPI) need higher scale
  const smallDimension = Math.min(metadata.pageWidth, metadata.pageHeight);

  if (smallDimension < 400) {
    return PDF_CONFIG.SCALE_EXTREME; // Very small original
  } else if (smallDimension < 500) {
    return PDF_CONFIG.SCALE_ULTRA; // Small original
  } else if (smallDimension < 600) {
    return PDF_CONFIG.SCALE_HIGH; // Standard
  } else {
    return PDF_CONFIG.SCALE_NORMAL; // Large/high-quality original
  }
}
