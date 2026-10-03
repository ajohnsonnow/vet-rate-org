/**
 * Vet-Rate.org - Document failures
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Processing a document can fail in ways whose own text is technical: a file
 * that was moved or deleted after it was chosen (some errors carry a blob:
 * address), a PDF reader whose worker script cannot be loaded (the error names
 * a local address), a device that runs out of memory. Every failure is sorted
 * into one of five kinds here, and only the kind is ever shown or logged.
 */

export const FILE_READ_FAILED_MESSAGE = "This file could not be read.";

export class FileReadError extends Error {
  constructor() {
    super(FILE_READ_FAILED_MESSAGE);
    this.name = "FileReadError";
  }
}

export const FAILURE_KINDS = Object.freeze({
  READ: "read",
  READER_UNAVAILABLE: "reader_unavailable",
  TIMEOUT: "timeout",
  MEMORY: "memory",
  UNKNOWN: "unknown",
});

// A failure whose message was written for the veteran (never built from a
// file name, address or stack) and may be shown as it is.
export class PlainDocumentError extends Error {
  constructor(message, kind = FAILURE_KINDS.UNKNOWN, options) {
    super(message, options);
    this.name = "PlainDocumentError";
    this.kind = kind;
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

// Checked before READ_ERROR_MESSAGE: a worker script loaded from a blob:
// address is an unavailable reader, not an unreadable file.
const WORKER_ERROR_MESSAGE =
  /worker|dynamically imported module|module script|importscripts|loading chunk/i;

const TIMEOUT_ERROR_NAMES = new Set(["StepTimeoutError", "TimeoutError"]);

const TIMEOUT_ERROR_MESSAGE = /timed out|timeout|stalled/i;

const MEMORY_ERROR_MESSAGE =
  /out of memory|allocation failed|invalid (typed )?array length|memory access out of bounds/i;

export const classifyDocumentFailure = (error) => {
  if (error instanceof PlainDocumentError) return error.kind;
  const name = error?.name;
  const message = String(error?.message ?? "");
  if (READ_ERROR_NAMES.has(name)) return FAILURE_KINDS.READ;
  if (WORKER_ERROR_MESSAGE.test(message)) {
    return FAILURE_KINDS.READER_UNAVAILABLE;
  }
  if (READ_ERROR_MESSAGE.test(message)) return FAILURE_KINDS.READ;
  if (TIMEOUT_ERROR_NAMES.has(name) || TIMEOUT_ERROR_MESSAGE.test(message)) {
    return FAILURE_KINDS.TIMEOUT;
  }
  if (name === "RangeError" || MEMORY_ERROR_MESSAGE.test(message)) {
    return FAILURE_KINDS.MEMORY;
  }
  return FAILURE_KINDS.UNKNOWN;
};

export const isFileReadFailure = (error) =>
  classifyDocumentFailure(error) === FAILURE_KINDS.READ;

export const failureLogCode = (kind) => `document_failure:${kind}`;

// The only thing that may be written to the console for an error from
// processing a document: a neutral code, never the error itself.
export const forLog = (error) => failureLogCode(classifyDocumentFailure(error));

// True when the file's first byte can still be read right now.
export async function isFileStillReadable(file) {
  try {
    await file.slice(0, 1).arrayBuffer();
    return true;
  } catch {
    return false;
  }
}
