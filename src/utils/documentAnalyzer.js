/**
 * Vet-Rate.org - Universal Document Analyzer
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * Supports multiple file formats for veteran document uploads:
 * - PDF (text + OCR for scanned)
 * - DOCX (Word documents)
 * - TXT (plain text)
 * - RTF (rich text format)
 *
 * All processing is 100% client-side for maximum privacy.
 */

import mammoth from "mammoth";
import {
  analyzePDF,
  OCR_STATES,
  getProgressStyling as getOCRProgressStyling,
} from "./ocr";

// Re-export for convenience
export { OCR_STATES };
export const getProgressStyling = getOCRProgressStyling;

/**
 * Supported file types and their MIME types
 */
export const SUPPORTED_FILE_TYPES = {
  PDF: {
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
    label: "PDF Documents",
  },
  DOCX: {
    extensions: [".docx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    label: "Word Documents",
  },
  DOC: {
    extensions: [".doc"],
    mimeTypes: ["application/msword"],
    label: "Word Documents (Legacy)",
  },
  TXT: {
    extensions: [".txt"],
    mimeTypes: ["text/plain"],
    label: "Text Files",
  },
  RTF: {
    extensions: [".rtf"],
    mimeTypes: ["text/rtf", "application/rtf"],
    label: "Rich Text Format",
  },
};

/**
 * Get file extension from filename
 */
const getFileExtension = (filename) => {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : "";
};

/**
 * Validate file type
 */
export const isFileSupported = (file) => {
  if (!file) return false;

  const ext = getFileExtension(file.name);
  const allExtensions = Object.values(SUPPORTED_FILE_TYPES).flatMap(
    (type) => type.extensions,
  );

  return allExtensions.includes(ext);
};

/**
 * Get file type label
 */
export const getFileTypeLabel = (file) => {
  if (!file) return "Unknown";

  const ext = getFileExtension(file.name);

  for (const type of Object.values(SUPPORTED_FILE_TYPES)) {
    if (type.extensions.includes(ext)) {
      return type.label;
    }
  }

  return "Unknown Format";
};

/**
 * Get accept attribute for file input
 */
export const getAcceptString = () => {
  return Object.values(SUPPORTED_FILE_TYPES)
    .flatMap((type) => [...type.extensions, ...type.mimeTypes])
    .join(",");
};

/**
 * Read file as ArrayBuffer
 */
const readFileAsArrayBuffer = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Read file as text
 */
const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
};

/**
 * Analyze PDF file
 */
async function analyzePDFDocument(file, onProgress) {
  const result = await analyzePDF(file, onProgress);
  return {
    text: result.text,
    pageCount: result.pageCount || 1,
    method: result.method,
    fileType: "PDF",
    ocrUsed: result.ocrUsed,
  };
}

/**
 * Analyze DOCX file (Word document)
 */
async function analyzeDOCXDocument(file, onProgress) {
  onProgress({
    state: OCR_STATES.LOADING,
    progress: 10,
    message: "Reading Word document...",
  });

  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);

    onProgress({
      state: OCR_STATES.EXTRACTING_TEXT,
      progress: 50,
      message: "Extracting text from Word document...",
    });

    // Use mammoth to extract text from .docx
    const result = await mammoth.extractRawText({ arrayBuffer });

    onProgress({
      state: OCR_STATES.COMPLETE,
      progress: 100,
      message: "Word document processed successfully",
    });

    return {
      text: result.value || "",
      pageCount: 1,
      method: "docx",
      fileType: "DOCX",
      ocrUsed: false,
      warnings: result.messages || [],
    };
  } catch (error) {
    throw new Error(`Failed to read Word document: ${error.message}`);
  }
}

/**
 * Analyze TXT file (plain text)
 */
async function analyzeTXTDocument(file, onProgress) {
  onProgress({
    state: OCR_STATES.LOADING,
    progress: 10,
    message: "Reading text file...",
  });

  try {
    const text = await readFileAsText(file);

    onProgress({
      state: OCR_STATES.COMPLETE,
      progress: 100,
      message: "Text file loaded successfully",
    });

    return {
      text: text || "",
      pageCount: 1,
      method: "text",
      fileType: "TXT",
      ocrUsed: false,
    };
  } catch (error) {
    throw new Error(`Failed to read text file: ${error.message}`);
  }
}

/**
 * Analyze RTF file (rich text format)
 */
async function analyzeRTFDocument(file, onProgress) {
  onProgress({
    state: OCR_STATES.LOADING,
    progress: 10,
    message: "Reading RTF file...",
  });

  try {
    const text = await readFileAsText(file);

    onProgress({
      state: OCR_STATES.EXTRACTING_TEXT,
      progress: 50,
      message: "Stripping RTF formatting...",
    });

    // Basic RTF to plain text conversion
    // Remove RTF control sequences
    let plainText = text
      .replace(/\\[a-z]+[-]?\d*[ ]?/g, "") // Remove RTF commands
      .replace(/[{}]/g, "") // Remove braces
      .replace(/\\'[0-9a-f]{2}/g, " ") // Remove escaped chars
      .replace(/\\\*/g, "") // Remove escaped asterisks
      .replace(/\\~/g, " ") // Non-breaking spaces
      .replace(/\\_/g, "-") // Non-breaking hyphens
      .replace(/\n{3,}/g, "\n\n") // Normalize line breaks
      .trim();

    onProgress({
      state: OCR_STATES.COMPLETE,
      progress: 100,
      message: "RTF file processed successfully",
    });

    return {
      text: plainText || "",
      pageCount: 1,
      method: "rtf",
      fileType: "RTF",
      ocrUsed: false,
    };
  } catch (error) {
    throw new Error(`Failed to read RTF file: ${error.message}`);
  }
}

/**
 * Analyze DOC file (legacy Word format)
 * Note: Full .doc parsing requires server-side conversion or complex libraries.
 * This provides a basic attempt, but users should convert to .docx for best results.
 */
async function analyzeDOCDocument(file, onProgress) {
  onProgress({
    state: OCR_STATES.LOADING,
    progress: 10,
    message: "Reading legacy Word document...",
  });

  onProgress({
    state: OCR_STATES.ERROR,
    progress: 0,
    message: "Legacy .doc format not fully supported",
  });

  throw new Error(
    "Legacy .doc format is not supported. Please save your document as .docx (Word 2007+) or .txt format and try again.",
  );
}

/**
 * Universal Document Analyzer
 * Automatically detects file type and uses appropriate parser
 *
 * @param {File} file - Document file to analyze
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{text: string, pageCount: number, method: string, fileType: string, ocrUsed: boolean}>}
 */
export async function analyzeDocument(file, onProgress = () => {}) {
  // Validate file
  if (!file) {
    throw new Error("No file provided");
  }

  if (!isFileSupported(file)) {
    const ext = getFileExtension(file.name);
    throw new Error(
      `Unsupported file type: ${ext}. Supported formats: PDF, DOCX, TXT, RTF`,
    );
  }

  // Get file extension
  const ext = getFileExtension(file.name);

  // Route to appropriate analyzer
  switch (ext) {
    case ".pdf":
      return await analyzePDFDocument(file, onProgress);

    case ".docx":
      return await analyzeDOCXDocument(file, onProgress);

    case ".doc":
      return await analyzeDOCDocument(file, onProgress);

    case ".txt":
      return await analyzeTXTDocument(file, onProgress);

    case ".rtf":
      return await analyzeRTFDocument(file, onProgress);

    default:
      throw new Error(`Unsupported file extension: ${ext}`);
  }
}

/**
 * Get file size in human-readable format
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Render PDF pages to images for vision model input
 * This bypasses OCR and sends actual images to vision-language models
 *
 * @param {File} file - PDF file to render
 * @param {Object} options - Rendering options
 * @param {number} options.maxPages - Maximum pages to render (default: 4)
 * @param {number} options.scale - Render scale (default: 1.5 for balance of quality/size)
 * @param {string} options.format - Output format 'jpeg' or 'png' (default: 'jpeg')
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.85)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{images: string[], pageCount: number, renderedPages: number}>}
 */
export async function renderPDFToImages(
  file,
  options = {},
  onProgress = () => {},
) {
  const {
    maxPages = 4,
    scale = 1.5, // Balance between quality and context window size
    format = "jpeg",
    quality = 0.85,
  } = options;

  // Validate input
  if (!file) {
    throw new Error("No file provided");
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("File must be a PDF document");
  }

  // Dynamically import pdfjs-dist
  const pdfjsLib = await import("pdfjs-dist");
  const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;

  const STANDARD_FONT_DATA_URL =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/standard_fonts/";

  onProgress({
    state: OCR_STATES.LOADING,
    progress: 0,
    message: "Loading PDF for vision analysis...",
  });

  try {
    // Read file into ArrayBuffer
    const arrayBuffer = await readFileAsArrayBuffer(file);

    // Load PDF document
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
    }).promise;
    const numPages = pdf.numPages;
    const pagesToRender = Math.min(numPages, maxPages);

    onProgress({
      state: OCR_STATES.EXTRACTING_TEXT,
      progress: 10,
      message: `Rendering ${pagesToRender} page(s) for vision model...`,
      totalPages: pagesToRender,
    });

    const images = [];

    for (let i = 1; i <= pagesToRender; i++) {
      const progress = 10 + ((i - 1) / pagesToRender) * 80;
      onProgress({
        state: OCR_STATES.OCR_IN_PROGRESS,
        progress: Math.round(progress),
        message: `Rendering page ${i} of ${pagesToRender}...`,
        currentPage: i,
        totalPages: pagesToRender,
      });

      // Get page
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });

      // Create canvas
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Convert to data URL
      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(mimeType, quality);
      images.push(dataUrl);

      // Clean up
      canvas.width = 0;
      canvas.height = 0;
    }

    onProgress({
      state: OCR_STATES.COMPLETE,
      progress: 100,
      message: `Rendered ${pagesToRender} page(s) for vision analysis`,
      totalPages: pagesToRender,
    });

    // eslint-disable-next-line no-console
    console.log(
      `📷 Rendered ${images.length} PDF pages as images for vision model`,
    );

    return {
      images,
      pageCount: numPages,
      renderedPages: pagesToRender,
    };
  } catch (error) {
    console.error("Error rendering PDF to images:", error);
    throw new Error(`Failed to render PDF: ${error.message}`);
  }
}
