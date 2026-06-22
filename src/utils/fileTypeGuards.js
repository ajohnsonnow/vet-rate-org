/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Pure file-type guards with no pdf.js / OCR dependencies, so they can be
 * imported (and unit-tested) without pulling in the heavy document-analysis
 * worker chain.
 */

/**
 * Get the lowercased file extension (including the dot), or "" if none.
 * @param {string} filename
 * @returns {string}
 */
export const getFileExtension = (filename) => {
  const match = String(filename || "").match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : "";
};

/**
 * Accept a file as a PDF for C-file ingest.
 *
 * The VA — and many operating systems and cloud downloads — ship PDFs with an
 * empty or `application/octet-stream` MIME type, so exact-MIME matching
 * (`type === "application/pdf"` only) wrongly rejects valid files. Accept on a
 * `.pdf` extension or a pdf MIME, and reject empty (0-byte) files up front. The
 * parser confirms the `%PDF-` magic bytes downstream.
 *
 * @param {File} file
 * @returns {boolean}
 */
export const isPdfFile = (file) => {
  if (!file?.size) return false;
  const ext = getFileExtension(file.name);
  const mime = (file.type || "").toLowerCase();
  return (
    ext === ".pdf" || mime === "application/pdf" || mime === "application/x-pdf"
  );
};

/**
 * Map a pdf.js load error to user-facing, actionable copy.
 *
 * The VA ships C-files as password-protected PDFs; pdf.js rejects those with a
 * `PasswordException`. Return a specific Error (tagged `code:
 * "PDF_PASSWORD_REQUIRED"`) for that case so callers can show actionable copy
 * instead of a generic "Failed to read PDF". Returns null for any other error.
 *
 * @param {unknown} error
 * @returns {Error|null}
 */
export const describePdfPasswordError = (error) => {
  const isPasswordIssue =
    error?.name === "PasswordException" ||
    error?.code === "PDF_PASSWORD_REQUIRED";
  if (!isPasswordIssue) return null;
  const e = new Error(
    "This PDF is password-protected. Enter the correct password when prompted, or remove the protection (open it, then re-save or print to PDF) and upload again.",
  );
  e.code = "PDF_PASSWORD_REQUIRED";
  return e;
};
