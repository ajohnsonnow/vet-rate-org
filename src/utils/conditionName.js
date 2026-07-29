/**
 * Vet-Rate.org - Condition name normalization (shared leaf module)
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * A single, dependency-free normalizer so the VKB write path
 * (veteranKnowledgeBase) and the read path (veteranContextProvider) dedup
 * condition names identically. Kept here — not in either of those modules —
 * so both can import it without a circular dependency, and so the
 * claims-sensitive dedup logic can never drift between writer and reader.
 */

/**
 * Normalize a condition name for duplicate detection.
 * "Tinnitus (Service Connected)" / "TINNITUS" / " tinnitus. " all collapse
 * to "tinnitus" so analyzer output, saved claims, and manual entries merge
 * instead of stacking duplicates.
 */
export const normalizeConditionName = (name) => {
  if (typeof name !== "string") return "";
  return (
    name
      .toLowerCase()
      // eslint-disable-next-line sonarjs/slow-regex -- single negated character class, standard linear-time pattern
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
};
