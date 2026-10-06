/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Shown where a writing tool would offer AI rewording, while a small
 * on-device model is the one that would answer. The tool offers no button
 * in that state, so the veteran is never asked to consent to something
 * that will not happen. `text` is smallModelCaveat.rewordingOff in the
 * veteran's language.
 */
export default function RewordingOffNote({ text, className = "" }) {
  return (
    <p
      role="note"
      aria-label="About AI wording"
      className={`text-sm text-gray-900 dark:text-gray-100 ${className}`}
    >
      {text}
    </p>
  );
}
