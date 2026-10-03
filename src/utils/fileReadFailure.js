/**
 * Vet-Rate.org - File read failures
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Reading a chosen file can fail after the browser handed over its reference
 * (the file was moved, renamed or deleted, or its drive went away). The
 * underlying errors are technical and some carry a blob: address, so a read
 * failure is turned into one plain error here and never shown or logged raw.
 */

export const FILE_READ_FAILED_MESSAGE = "This file could not be read.";

export const FILE_READ_LOG_PHRASE = "the file could not be read";

export class FileReadError extends Error {
  constructor() {
    super(FILE_READ_FAILED_MESSAGE);
    this.name = "FileReadError";
  }
}

const READ_ERROR_NAMES = new Set([
  "FileReadError",
  "NotReadableError",
  "NotFoundError",
  "UnexpectedResponseException",
]);

const READ_ERROR_MESSAGE =
  /unexpected server response|failed to read file|blob:/i;

export const isFileReadFailure = (error) =>
  READ_ERROR_NAMES.has(error?.name) ||
  READ_ERROR_MESSAGE.test(String(error?.message ?? ""));

// What may be written to the console for an error from reading a document.
export const forLog = (error) =>
  isFileReadFailure(error) ? FILE_READ_LOG_PHRASE : error;

// True when the file's first byte can still be read right now.
export async function isFileStillReadable(file) {
  try {
    await file.slice(0, 1).arrayBuffer();
    return true;
  } catch {
    return false;
  }
}
