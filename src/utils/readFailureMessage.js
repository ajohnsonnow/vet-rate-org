/**
 * Vet-Rate.org - Plain messages for a document that could not be processed
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The document is named by its plain type and place in the queue, never by
 * file name, internal label or the browser's technical error text.
 */

import { FAILURE_KINDS } from "./fileReadFailure";

const TYPE_NAMES = {
  DD214: "DD214",
  DD215: "DD215",
  NGB22: "NGB 22",
  DBQ: "DBQ",
  C_FILE_MEDICAL: "C-file medical record",
};

export const typeName = (type) => {
  if (!type || type === "UNKNOWN") return null;
  return TYPE_NAMES[type] ?? type.toLowerCase().replaceAll("_", " ");
};

/**
 * @returns {string} "document 3" when the type is not known, otherwise
 *   "the claim letter (document 3)".
 */
export const plainDocumentLabel = (type, index) => {
  const position = Number.isInteger(index) && index >= 0 ? index + 1 : null;
  const place = position ? `document ${position}` : "this document";
  const name = typeName(type);
  if (!name) return place;
  return position ? `the ${name} (${place})` : `the ${name}`;
};

const CAUSES = {
  [FAILURE_KINDS.READ]: "the file could not be read",
  [FAILURE_KINDS.READER_UNAVAILABLE]: "the document reader did not start",
  [FAILURE_KINDS.TIMEOUT]: "it took too long",
  [FAILURE_KINDS.MEMORY]: "it needs more memory than this device has free",
  [FAILURE_KINDS.UNKNOWN]: "something went wrong while reading it",
};

// For a failure reported before the document's place in the queue is known.
export const describeFailureKind = (kind) =>
  `This document could not be processed because ${CAUSES[kind] ?? CAUSES[FAILURE_KINDS.UNKNOWN]}.`;

/**
 * @param {string} label From plainDocumentLabel.
 * @param {{kind?: string, canRetry: boolean, fileGone: boolean}} state
 *   `fileGone`: the file can no longer be read at all, so only adding it
 *   again can help. `detail`: a message already written for the veteran,
 *   shown in place of the generic cause. `reloaded`: the page was reloaded since, which dropped
 *   the file reference.
 */
export const describeDocumentFailure = (
  label,
  {
    kind = FAILURE_KINDS.READ,
    detail,
    detailComplete = false,
    canRetry,
    fileGone,
    reloaded = false,
  },
) => {
  if (reloaded && kind !== FAILURE_KINDS.READ) {
    return `We could not finish ${label} before the page was reloaded, so add the file again to finish it.`;
  }
  if (fileGone) {
    return (
      `We could not read ${label} because the file is no longer available, ` +
      "so add it again to finish it."
    );
  }
  if (detail) {
    const sentence = /[.!?]$/.test(detail) ? detail : `${detail}.`;
    let next = " Add the file again to finish it.";
    if (canRetry) next = " Choose Retry to try again.";
    if (detailComplete) next = "";
    return `We could not finish ${label}. ${sentence}${next}`;
  }
  const cause = CAUSES[kind] ?? CAUSES[FAILURE_KINDS.UNKNOWN];
  if (kind === FAILURE_KINDS.READER_UNAVAILABLE) {
    return `We could not finish ${label} because ${cause}. Reload this page, then add the file again to finish it.`;
  }
  if (canRetry) {
    return `We could not finish ${label} because ${cause}, so choose Retry to try again.`;
  }
  return (
    `We still could not finish ${label} because ${cause}, even after several tries, ` +
    "so add the file again to finish it."
  );
};
