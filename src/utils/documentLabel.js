/**
 * Vet-Rate.org - Neutral document label
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * A veteran chooses their own file names, and they often carry a name, a file
 * number or a date of birth. Anything written to the browser console ends up
 * in bug reports and screenshots, so import logging refers to a document by
 * its type and position in the queue only - never by file name.
 */

export const neutralDocumentLabel = (type, index) => {
  const position = Number.isInteger(index) && index >= 0 ? index + 1 : "?";
  return `document ${position} (${type || "UNKNOWN"})`;
};
