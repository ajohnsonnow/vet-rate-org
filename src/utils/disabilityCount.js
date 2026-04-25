/**
 * Dynamic Disability Count Utility
 *
 * NEVER HARDCODE CONDITION COUNTS!
 * This utility provides a single source of truth for the number of VA disabilities
 * in the system, dynamically computed from actual data.
 *
 * Diamond Standard: Data drives documentation, not the other way around.
 */

import disabilityDataJson from "../data/disabilityData.json";

/**
 * Get the actual count of disabilities in the system
 * @returns {number} The real count from disabilityData.json
 */
export function getDisabilityCount() {
  // Handle both array format and object with disabilities property
  if (Array.isArray(disabilityDataJson)) {
    return disabilityDataJson.length;
  }
  if (
    disabilityDataJson.disabilities &&
    Array.isArray(disabilityDataJson.disabilities)
  ) {
    return disabilityDataJson.disabilities.length;
  }

  console.error(
    "[disabilityCount] Unable to determine disability count - data format unexpected",
  );
  return 0;
}

/**
 * Get formatted disability count for display (e.g., "748" or "748 conditions")
 * @param {boolean} includeLabel - Whether to include "conditions" label
 * @returns {string} Formatted count
 */
export function getFormattedDisabilityCount(includeLabel = false) {
  const count = getDisabilityCount();
  return includeLabel ? `${count} conditions` : `${count}`;
}

// Last full eCFR re-validation of all 748 conditions in disabilityData.json
// against 38 CFR Part 4. POLICY: bump this date only after running the full
// validation pipeline (scripts/validate-disabilities.js). Quarterly re-runs
// are tracked in projectStats.json `last_updated`. This timestamp is what is
// surfaced to users in About / Field Manual; do not bump cosmetically.
export const DISABILITY_VALIDATION_DATE = "2026-01-15";

/**
 * Get disability count with validation status
 * @returns {Object} { count, validated, validationDate, source }
 */
export function getDisabilityCountWithValidation() {
  return {
    count: getDisabilityCount(),
    validated: true,
    validationDate: DISABILITY_VALIDATION_DATE,
    source: "38 CFR Part 4",
  };
}

// Export the raw data array for components that need it
export const disabilityDataArray =
  disabilityDataJson.disabilities || disabilityDataJson || [];

export default {
  getDisabilityCount,
  getFormattedDisabilityCount,
  getDisabilityCountWithValidation,
  disabilityDataArray,
};
