/**
 * Vet-Rate.org - Plain messages for a document that could not be read
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The document is named by its neutral label (its type and place in the
 * queue), never by file name or by the browser's technical error text.
 */

/**
 * @param {string} label Neutral label such as "document 3 (DD214)".
 * @param {{canRetry: boolean, fileGone: boolean}} state `fileGone`: the file
 *   can no longer be read at all, so only adding it again can help.
 */
export const describeReadFailure = (label, { canRetry, fileGone }) => {
  if (fileGone) {
    return (
      `We could not read ${label} because the file is no longer available. ` +
      "Nothing you imported was lost. Add the file again to finish it."
    );
  }
  if (canRetry) {
    return (
      `We could not read ${label}. Nothing you imported was lost. ` +
      "Choose Retry to read it again."
    );
  }
  return (
    `We still could not read ${label} after several tries. ` +
    "Nothing you imported was lost. Add the file again to finish it."
  );
};
