/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * DBQ PDF Form Filler Utility
 * Uses pdf-lib to fill DBQ forms and add watermarks for draft documents
 * Enables veterans to pre-fill subjective information before doctor visits
 */

import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { getCachedDbq } from "./dbqOfflineStorage";
import { triggerBlobDownload } from "./sanitize";

// ============================================================================
// WATERMARK CONFIGURATION
// ============================================================================

const WATERMARK_CONFIG = {
  // Red semi-transparent watermark
  text: "PATIENT DRAFT - FOR PHYSICIAN REVIEW",
  color: rgb(1, 0, 0), // Red
  opacity: 0.15,
  fontSize: 48,
  rotation: -45, // Degrees
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Load a DBQ PDF from cache or network
 * @param {string} formId - The DBQ form ID
 * @param {string} fallbackPath - Path to fetch if not cached
 * @returns {Promise<PDFDocument|null>}
 */
export async function loadDbqPdf(formId, fallbackPath = null) {
  try {
    // Try to get from cache first
    let pdfBytes;
    const cached = await getCachedDbq(formId);

    if (cached) {
      pdfBytes = await cached.arrayBuffer();
    } else if (fallbackPath) {
      // Fall back to network
      const response = await fetch(fallbackPath);
      if (!response.ok) throw new Error("Could not fetch PDF");
      pdfBytes = await response.arrayBuffer();
    } else {
      // Try default path
      const defaultPath = `/forms/${formId}.pdf`;
      const response = await fetch(defaultPath);
      if (!response.ok) throw new Error("Could not fetch PDF");
      pdfBytes = await response.arrayBuffer();
    }

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true, // VA forms may have some encryption flags
    });

    return pdfDoc;
  } catch (error) {
    console.error("Error loading DBQ PDF:", error);
    return null;
  }
}

/**
 * Add a watermark to all pages of a PDF
 * @param {PDFDocument} pdfDoc - The PDF document
 * @param {string} watermarkText - Custom watermark text (optional)
 * @returns {Promise<PDFDocument>}
 */
export async function addWatermark(pdfDoc, watermarkText = null) {
  try {
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const text = watermarkText || WATERMARK_CONFIG.text;

    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, WATERMARK_CONFIG.fontSize);

      // Calculate center position
      const x = width / 2;
      const y = height / 2;

      // Draw watermark diagonally across the page
      page.drawText(text, {
        x: x - textWidth / 2,
        y: y,
        size: WATERMARK_CONFIG.fontSize,
        font,
        color: WATERMARK_CONFIG.color,
        opacity: WATERMARK_CONFIG.opacity,
        rotate: degrees(WATERMARK_CONFIG.rotation),
      });
    }

    return pdfDoc;
  } catch (error) {
    console.error("Error adding watermark:", error);
    return pdfDoc;
  }
}

/**
 * Add a header banner to the first page
 * @param {PDFDocument} pdfDoc - The PDF document
 * @param {string} bannerText - Text for the banner
 * @returns {Promise<PDFDocument>}
 */
// eslint-disable-next-line sonarjs/no-invariant-returns -- always returns pdfDoc (mutated on success, unchanged on early-exit/error) so callers can safely chain regardless of outcome
export async function addHeaderBanner(
  pdfDoc,
  bannerText = "DRAFT COPY - FOR PHYSICIAN REVIEW ONLY",
) {
  try {
    const pages = pdfDoc.getPages();
    if (pages.length === 0) return pdfDoc;

    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const bannerHeight = 30;
    const fontSize = 12;

    // Draw red banner at the top
    firstPage.drawRectangle({
      x: 0,
      y: height - bannerHeight,
      width,
      height: bannerHeight,
      color: rgb(0.9, 0.1, 0.1),
      opacity: 0.9,
    });

    // Draw white text on the banner
    const textWidth = font.widthOfTextAtSize(bannerText, fontSize);
    firstPage.drawText(bannerText, {
      x: (width - textWidth) / 2,
      y: height - bannerHeight + 10,
      size: fontSize,
      font,
      color: rgb(1, 1, 1),
    });

    return pdfDoc;
  } catch (error) {
    console.error("Error adding header banner:", error);
    return pdfDoc;
  }
}

/**
 * Try to fill form fields if the PDF has them
 * @param {PDFDocument} pdfDoc - The PDF document
 * @param {object} formData - Key-value pairs of field names to values
 * @returns {Promise<{filled: number, skipped: number}>}
 */
export async function fillFormFields(pdfDoc, formData) {
  const results = { filled: 0, skipped: 0 };

  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    for (const [fieldName, value] of Object.entries(formData)) {
      try {
        // Try to find matching field
        const field = fields.find(
          (f) =>
            f.getName().toLowerCase().includes(fieldName.toLowerCase()) ||
            fieldName.toLowerCase().includes(f.getName().toLowerCase()),
        );

        if (field) {
          const fieldType = field.constructor.name;

          if (fieldType === "PDFTextField") {
            field.setText(String(value));
            results.filled++;
          } else if (fieldType === "PDFCheckBox" && value) {
            field.check();
            results.filled++;
          } else if (fieldType === "PDFRadioGroup" && value) {
            field.select(String(value));
            results.filled++;
          }
        } else {
          results.skipped++;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.debug(`Skipping field "${fieldName}":`, e.message);
        results.skipped++;
      }
    }
  } catch (error) {
    // PDF may not have form fields - that's okay
    // eslint-disable-next-line no-console
    console.log(
      "PDF does not have fillable form fields or error occurred:",
      error.message,
    );
  }

  return results;
}

// ============================================================================
// DBQ-SPECIFIC FIELD MAPPINGS
// ============================================================================

/**
 * Known DBQ form field locations for text overlay
 * These are approximate positions for common DBQ sections
 */
const _DBQ_FIELD_POSITIONS = {
  // Subjective sections that veterans can fill out
  subjectiveHistory: {
    page: 1,
    x: 50,
    y: 600, // Varies by form
  },
  symptomsFrequency: {
    page: 1,
    x: 50,
    y: 500,
  },
  flareUps: {
    page: 1,
    x: 50,
    y: 400,
  },
  functionalImpact: {
    page: 2,
    x: 50,
    y: 700,
  },
};

/**
 * Generate a draft DBQ with veteran's subjective information
 * @param {string} formId - The DBQ form ID (e.g., "Knee-Lower-Leg")
 * @param {object} veteranInput - Veteran's answers
 * @param {object} options - { includeWatermark, includeBanner }
 * @returns {Promise<Blob|null>}
 */
export async function generateDraftDbq(formId, veteranInput, options = {}) {
  try {
    const { includeWatermark = true, includeBanner = true } = options;

    // Load the PDF
    let pdfDoc = await loadDbqPdf(formId);
    if (!pdfDoc) {
      throw new Error("Could not load DBQ PDF");
    }

    // Try to fill form fields first
    if (veteranInput && Object.keys(veteranInput).length > 0) {
      await fillFormFields(pdfDoc, veteranInput);
    }

    // Add watermark if requested
    if (includeWatermark) {
      pdfDoc = await addWatermark(pdfDoc);
    }

    // Add header banner if requested
    if (includeBanner) {
      pdfDoc = await addHeaderBanner(pdfDoc);
    }

    // Save and return as blob
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: "application/pdf" });
  } catch (error) {
    console.error("Error generating draft DBQ:", error);
    return null;
  }
}

// ============================================================================
// DOWNLOAD & SHARE UTILITIES
// ============================================================================

/**
 * Download a PDF blob as a file
 * @param {Blob} blob - The PDF blob
 * @param {string} filename - The filename to use
 */
export function downloadPdfBlob(blob, filename) {
  triggerBlobDownload(blob, String(filename || "download"));
}

/**
 * Bundle the PDF + a doctor README into a standard (unencrypted) .zip.
 * This is a convenience bundle, NOT an encrypted container — JSZip cannot
 * encrypt, so the contents are plaintext. Callers must not present this as
 * password-protected or "safe to email"; treat email as an insecure channel.
 * @param {Blob} pdfBlob - The PDF blob
 * @param {string} filename - The PDF filename
 * @returns {Promise<Blob|null>}
 */
export async function createDocumentZip(pdfBlob, filename) {
  try {
    // Dynamically import JSZip
    const JSZip = (await import("jszip")).default;

    const zip = new JSZip();

    // Add the PDF to the zip
    zip.file(filename, pdfBlob);

    // Add instructions file
    const instructions = `
MEDICAL DOCUMENT PACKAGE (DRAFT)
================================

This ZIP file contains a DRAFT medical document prepared with Vet-Rate.org.

CONTENTS:
- ${filename}

NOT ENCRYPTED:
This .zip is a plain (unencrypted) bundle. It is NOT password-protected.
Anyone who obtains the file can open it. For sensitive medical records,
share it over a secure channel — your VA patient portal / secure messaging,
or hand it off in person — rather than ordinary email.

ABOUT THIS DOCUMENT:
This is a DRAFT for physician review. The veteran has pre-filled subjective
information to assist the physician in completing the official Disability
Benefits Questionnaire (DBQ).

USAGE:
1. Extract the PDF file
2. Review the veteran's responses
3. Complete the medical examination sections
4. Sign and date the form
5. Return to the veteran or submit directly to the VA

Generated: ${new Date().toLocaleString()}
Source: Vet-Rate.org
`;
    zip.file("README.txt", instructions);

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    return zipBlob;
  } catch (error) {
    console.error("Error creating ZIP:", error);
    return null;
  }
}

/**
 * Use the Web Share API to share the PDF (for mobile)
 * @param {Blob} pdfBlob - The PDF blob
 * @param {string} filename - The filename
 * @param {string} title - Share title
 * @returns {Promise<{success: boolean, method: string, error?: string}>}
 */
export async function sharePdfNatively(
  pdfBlob,
  filename,
  title = "Draft DBQ for Review",
) {
  try {
    // Check if Web Share API is available
    if (!navigator.share) {
      return {
        success: false,
        method: "not-supported",
        error: "Web Share API not supported on this device/browser",
      };
    }

    // Check if file sharing is supported
    const file = new File([pdfBlob], filename, { type: "application/pdf" });

    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return {
        success: false,
        method: "files-not-supported",
        error: "File sharing not supported on this device/browser",
      };
    }

    // Attempt to share
    await navigator.share({
      title,
      text: "Draft DBQ prepared with Vet-Rate.org - For Physician Review",
      files: [file],
    });

    return { success: true, method: "native-share" };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        success: false,
        method: "cancelled",
        error: "Share cancelled by user",
      };
    }
    return { success: false, method: "error", error: error.message };
  }
}

/**
 * Copy DBQ content summary to clipboard (fallback for non-share devices)
 * @param {object} veteranInput - The veteran's input data
 * @returns {Promise<boolean>}
 */
export async function copyDbqSummaryToClipboard(veteranInput) {
  try {
    let summary = `DBQ DRAFT SUMMARY\n`;
    summary += `Generated: ${new Date().toLocaleString()}\n`;
    summary += `Source: Vet-Rate.org\n`;
    summary += `======================\n\n`;

    for (const [key, value] of Object.entries(veteranInput)) {
      if (value) {
        const label = key.replace(/([A-Z])/g, " $1").trim();
        summary += `${label}:\n${value}\n\n`;
      }
    }

    summary += `======================\n`;
    summary += `This is a DRAFT for physician review.\n`;
    summary += `The physician must complete all objective findings.\n`;

    await navigator.clipboard.writeText(summary);
    return true;
  } catch (error) {
    console.error("Error copying to clipboard:", error);
    return false;
  }
}

// ============================================================================
// CONDITION-SPECIFIC QUESTION MAPPINGS
// ============================================================================

// Default questions applicable to most DBQs
const DEFAULT_SUBJECTIVE_QUESTIONS = [
  {
    id: "symptomOnset",
    label: "When did your symptoms first begin?",
    type: "text",
    hint: 'Example: "Symptoms began during deployment in 2015"',
  },
  {
    id: "symptomFrequency",
    label: "How often do you experience symptoms?",
    type: "text",
    hint: 'Example: "Daily pain, worse in the morning"',
  },
  {
    id: "flareUps",
    label: "Describe any flare-ups (when symptoms get worse)",
    type: "textarea",
    hint: "Include how often, how long they last, and what causes them",
  },
  {
    id: "dailyImpact",
    label: "How does this condition affect your daily life?",
    type: "textarea",
    hint: "Work, household chores, sleep, hobbies, etc.",
  },
  {
    id: "treatments",
    label: "What treatments have you tried?",
    type: "textarea",
    hint: "Medications, physical therapy, surgeries, etc.",
  },
  {
    id: "additionalNotes",
    label: "Anything else your doctor should know?",
    type: "textarea",
    hint: "Service connection details, specific incidents, etc.",
  },
];

// Condition-specific questions based on form type
const CONDITION_SPECIFIC_SUBJECTIVE_QUESTIONS = {
  "Knee-Lower-Leg": [
    {
      id: "givingWay",
      label: 'Does your knee ever "give way" or buckle?',
      type: "text",
      hint: "How often and in what situations?",
    },
    {
      id: "instability",
      label: "Do you use a brace, cane, or other assistive device?",
      type: "text",
    },
  ],
  "Back-Thoracolumbar": [
    {
      id: "radiatingPain",
      label: "Does pain radiate to your legs?",
      type: "text",
      hint: "Describe the pattern and which leg(s)",
    },
    {
      id: "incapacitatingEpisodes",
      label: "Have you had bed rest prescribed by a doctor?",
      type: "text",
      hint: "How many times in the past 12 months and for how long?",
    },
  ],
  "PTSD-Review": [
    {
      id: "stressorEvents",
      label: "Briefly describe the traumatic event(s)",
      type: "textarea",
      hint: "Do not include classified details - general description only",
    },
    {
      id: "currentSymptoms",
      label: "What symptoms do you currently experience?",
      type: "textarea",
      hint: "Nightmares, flashbacks, avoidance, hypervigilance, etc.",
    },
  ],
  "Mental-Disorders": [
    {
      id: "socialFunctioning",
      label: "How does this affect your relationships?",
      type: "textarea",
    },
    {
      id: "occupationalFunctioning",
      label: "How does this affect your ability to work?",
      type: "textarea",
    },
  ],
  "Sleep-Apnea": [
    {
      id: "cpapUsage",
      label: "Do you use a CPAP machine?",
      type: "text",
      hint: "How often and for how long each night?",
    },
    {
      id: "daytimeSleepiness",
      label: "Describe your daytime sleepiness",
      type: "textarea",
    },
  ],
  Headaches: [
    {
      id: "frequency",
      label: "How many headaches do you have per month?",
      type: "text",
    },
    {
      id: "prostrating",
      label: "Do headaches force you to lie down or miss work?",
      type: "textarea",
      hint: "How often and for how long?",
    },
  ],
};

/**
 * Get relevant questions for a specific DBQ type
 * These are SUBJECTIVE questions that veterans can safely answer
 * @param {string} formId - The DBQ form ID
 * @returns {Array<{id: string, label: string, type: string, hint?: string}>}
 */
export function getSubjectiveQuestions(formId) {
  const specific = CONDITION_SPECIFIC_SUBJECTIVE_QUESTIONS[formId] || [];
  return [...DEFAULT_SUBJECTIVE_QUESTIONS, ...specific];
}

export default {
  loadDbqPdf,
  addWatermark,
  addHeaderBanner,
  fillFormFields,
  generateDraftDbq,
  downloadPdfBlob,
  createDocumentZip,
  sharePdfNatively,
  copyDbqSummaryToClipboard,
  getSubjectiveQuestions,
};
