/**
 * Vet-Rate.org - Conflict Detection System
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Detects conflicts between newly extracted data and existing VKB data.
 * Provides resolution strategies and context for user decision-making.
 */

import { getVeteranProfile } from "./veteranProfile";
import { getAllDocumentsFromVKB } from "./veteranKnowledgeBase";

/**
 * Conflict resolution strategies
 */
export const RESOLUTION_STRATEGIES = {
  USE_EXISTING: "use_existing", // Keep the existing value
  USE_NEW: "use_new", // Use the newly extracted value
  USE_MOST_RECENT: "use_most_recent", // Use value from most recent document
  ASK_USER: "ask_user", // Require user to manually resolve
  MERGE: "merge", // Merge arrays (for lists)
  IGNORE: "ignore", // Don't save this field (duplicate info)
};

/**
 * Conflict severity levels
 */
export const CONFLICT_SEVERITY = {
  CRITICAL: "critical", // Major discrepancy (e.g., different SSNs)
  HIGH: "high", // Important mismatch (e.g., service dates)
  MEDIUM: "medium", // Minor difference (e.g., spelling variations)
  LOW: "low", // Trivial (e.g., formatting differences)
  INFO: "info", // Not a conflict, just FYI
};

/**
 * Field comparison rules
 */
const FIELD_RULES = {
  // Identity fields - CRITICAL conflicts
  ssn: {
    severity: CONFLICT_SEVERITY.CRITICAL,
    strategy: RESOLUTION_STRATEGIES.ASK_USER,
    normalize: (val) => val?.replaceAll(/\D/g, ""), // Remove non-digits
    message: "⚠️ CRITICAL: Different SSNs detected. Verify carefully.",
  },

  veteranName: {
    severity: CONFLICT_SEVERITY.HIGH,
    strategy: RESOLUTION_STRATEGIES.ASK_USER,
    normalize: (val) => val?.toUpperCase().trim(),
    message: "Different name spellings detected. Which is correct?",
  },

  // Service dates - HIGH severity
  serviceStartDate: {
    severity: CONFLICT_SEVERITY.HIGH,
    strategy: RESOLUTION_STRATEGIES.USE_MOST_RECENT,
    normalize: (val) => val?.replaceAll(/\//g, "-"),
    message:
      "Service start dates differ. Most recent document usually more accurate.",
  },

  serviceEndDate: {
    severity: CONFLICT_SEVERITY.HIGH,
    strategy: RESOLUTION_STRATEGIES.USE_MOST_RECENT,
    normalize: (val) => val?.replaceAll(/\//g, "-"),
    message:
      "Service end dates differ. Most recent document usually more accurate.",
  },

  // Branch of service - HIGH severity
  branch: {
    severity: CONFLICT_SEVERITY.HIGH,
    strategy: RESOLUTION_STRATEGIES.ASK_USER,
    normalize: (val) => val?.toUpperCase().trim(),
    message:
      "Different branch of service. Verify which is correct (may have served in multiple).",
  },

  // Discharge type - HIGH severity
  dischargeType: {
    severity: CONFLICT_SEVERITY.HIGH,
    strategy: RESOLUTION_STRATEGIES.USE_MOST_RECENT,
    normalize: (val) => val?.toUpperCase().trim(),
    message:
      "Discharge characterization differs. Most recent is usually correct (upgrades possible).",
  },

  // Conditions - Use MERGE strategy. A decision letter yields condition
  // OBJECTS ({name, rating, effectiveDate, ...}); older callers pass plain
  // strings. Compare on the name either way.
  conditions: {
    severity: CONFLICT_SEVERITY.INFO,
    strategy: RESOLUTION_STRATEGIES.MERGE,
    normalize: (arr) =>
      arr?.map((c) =>
        (typeof c === "string" ? c : (c?.name ?? c?.condition ?? ""))
          .toLowerCase()
          .trim(),
      ),
    message: "Multiple conditions found across documents. All will be saved.",
  },

  // Rating percentages - Use most recent
  rating: {
    severity: CONFLICT_SEVERITY.MEDIUM,
    strategy: RESOLUTION_STRATEGIES.USE_MOST_RECENT,
    normalize: (val) =>
      Number.parseInt(val?.toString().replaceAll(/\D/g, ""), 10),
    message:
      "Rating percentage changed. Using most recent value (ratings can increase over time).",
  },

  // Contact info - Use most recent
  address: {
    severity: CONFLICT_SEVERITY.LOW,
    strategy: RESOLUTION_STRATEGIES.USE_MOST_RECENT,
    normalize: (val) => val?.toLowerCase().trim(),
    message: "Address differs. Using most recent (people move).",
  },

  phone: {
    severity: CONFLICT_SEVERITY.LOW,
    strategy: RESOLUTION_STRATEGIES.USE_MOST_RECENT,
    normalize: (val) => val?.replaceAll(/\D/g, ""),
    message: "Phone number differs. Using most recent.",
  },

  email: {
    severity: CONFLICT_SEVERITY.LOW,
    strategy: RESOLUTION_STRATEGIES.USE_MOST_RECENT,
    normalize: (val) => val?.toLowerCase().trim(),
    message: "Email differs. Using most recent.",
  },
};

/**
 * Per-document metadata/instance fields that must NEVER be cross-document
 * conflict-compared. These describe THIS document (its raw text, parse
 * status, per-claim details), not a fact about the veteran that should
 * stay consistent across documents. Without this exclusion, e.g. a claim
 * letter's `type: "claim_letter"` "conflicts" with a previously-saved
 * DD214's `type: "service_record"` on every single import.
 */
const NON_CONFLICTING_METADATA_FIELDS = new Set([
  "type",
  "raw",
  "error",
  "parseError",
  "parseFailedType",
  "extractedText",
  "sourcePages",
  "multiDocument",
  "documentIndex",
  "totalDocuments",
  "status", // per-document claim status, not a veteran-wide fact
  "claimNumber", // identifies a specific claim, not the veteran
  "claimDate", // per-claim filing/received date
  "letterDate", // date THIS letter was issued
  "decisions", // per-issue grant/deny outcomes on THIS letter
  "evidenceNeeded", // evidence requested on THIS letter
  "responseDeadlineDays", // response window for THIS letter
]);

/**
 * Detect conflicts between new data and existing data
 */
export async function detectConflicts(newData, documentType, filename) {
  const conflicts = [];

  if (!newData || typeof newData !== "object") {
    return conflicts;
  }

  // Get existing data from profile and VKB
  const profile = getVeteranProfile();
  const vkbDocs = await getAllDocumentsFromVKB();

  // Flatten VKB data for comparison. A reduce that spreads the accumulator
  // (`{...acc, ...doc.extractedData}`) copies the whole accumulated object
  // on every iteration — O(n^2) in field count over a large batch. Mutating
  // one accumulator via Object.assign is O(total fields).
  const vkbData = vkbDocs.reduce(
    (acc, doc) => Object.assign(acc, doc.extractedData),
    {},
  );

  // Compare each field in new data
  for (const [field, newValue] of Object.entries(newData)) {
    if (!newValue) continue; // Skip empty fields
    if (NON_CONFLICTING_METADATA_FIELDS.has(field)) continue;

    // Get existing value (check profile first, then VKB)
    const existingValue = profile[field] || vkbData[field];

    if (!existingValue) continue; // No conflict if no existing data

    // Get field rules (use defaults if not specified)
    const rules = FIELD_RULES[field] || {
      severity: CONFLICT_SEVERITY.MEDIUM,
      strategy: RESOLUTION_STRATEGIES.ASK_USER,
      normalize: (val) => val,
      message: "Values differ between documents.",
    };

    // Normalize values for comparison
    const normalizedExisting = rules.normalize(existingValue);
    const normalizedNew = rules.normalize(newValue);

    // Check for conflict
    const hasConflict = !valuesMatch(normalizedExisting, normalizedNew);

    if (hasConflict) {
      conflicts.push({
        field,
        fieldLabel: formatFieldLabel(field),
        existing: existingValue,
        newValue: newValue,
        normalizedExisting,
        normalizedNew,
        severity: rules.severity,
        strategy: rules.strategy,
        message: rules.message,
        documentType,
        filename,
        timestamp: Date.now(),
      });
    }
  }

  return conflicts;
}

/**
 * Check if two values match (handles arrays, objects, primitives)
 */
function valuesMatch(val1, val2) {
  // Handle null/undefined
  if (val1 == null && val2 == null) return true;
  if (val1 == null || val2 == null) return false;

  // Handle arrays
  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) return false;
    return val1.every((item, idx) => valuesMatch(item, val2[idx]));
  }

  // Handle objects
  if (typeof val1 === "object" && typeof val2 === "object") {
    const keys1 = Object.keys(val1);
    const keys2 = Object.keys(val2);
    if (keys1.length !== keys2.length) return false;
    return keys1.every((key) => valuesMatch(val1[key], val2[key]));
  }

  // Handle primitives
  return val1 === val2;
}

/**
 * Format field name for display
 */
function formatFieldLabel(field) {
  // Convert camelCase to Title Case
  return field
    .replaceAll(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
