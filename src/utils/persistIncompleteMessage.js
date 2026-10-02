/**
 * Vet-Rate.org - Plain message for a document whose save did not finish
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * @param {string} fileName
 * @param {string|null} [retryLabel] The control that finishes the save. Pass
 *   null where the screen has none, and the veteran is told to import the
 *   file again instead.
 * @param {{quotaExceeded?: boolean}} [options] A full device is named as
 *   such: waiting longer would not help, freeing space would.
 */
export const describePersistIncomplete = (
  fileName,
  retryLabel = "Retry",
  { quotaExceeded = false } = {},
) => {
  const cause = quotaExceeded
    ? "your device's storage is full"
    : "your device's storage did not respond in time";
  const advice = quotaExceeded
    ? " Export a backup and free up space first."
    : "";
  const next = retryLabel
    ? `Choose ${retryLabel} to finish saving it.`
    : "Import the file again to finish saving it.";
  return (
    `Saving "${fileName}" did not finish because ${cause}. ` +
    `Nothing you imported was lost.${advice} ${next}`
  );
};
