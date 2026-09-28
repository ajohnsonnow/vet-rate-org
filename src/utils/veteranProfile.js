/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Veteran Profile Storage Utility
 * Stores common form fields locally so veterans only have to enter info once.
 * All data stays on user's device - 100% client-side, never sent to servers.
 *
 * Now integrates with persistentStorage for crash-proof auto-saving
 */

import {
  isSameServicePeriod,
  formatLocalDate,
  isSameDate,
  parseExplicitDate,
} from "./dateUtils";
import { markAsModified } from "./persistentStorage";
import { _isLaterRecord, parsePayGrade } from "./veteranKnowledgeBase";
import {
  pickServiceEntry,
  periodStartSource,
  documentSources,
  isStableSourceDocument,
  isSameCalendarDay,
  SOURCE_RANK,
  START_SOURCES,
} from "./serviceEntryDate";

// ADR-007: servicePeriods[] is the one authoritative store for the service
// entry date - every write to a period's start date goes through
// setServiceEntryDate/updateServicePeriod/addServicePeriod (veteran
// corrections), or the ingest merge path (_mergeIncomingStart), or this
// one-time migration (legacy_*). Nothing else may claim provenance 'veteran'.
export const SERVICE_ENTRY_VIAS = [
  // Editors
  "muster_review",
  "vkb_viewer",
  "my_packet",
  "forms_helper",
  "dd214_import",
  // Migration
  "legacy_edit",
  "legacy_muster_review",
  "legacy_profile",
  "legacy_dd214",
  "legacy_vkb_viewer",
];

const PROFILE_KEY = "vet_rate_veteran_profile";
const SAVED_FORMS_KEY = "vet_rate_saved_forms";
const RATINGS_KEY = "vet_rate_my_ratings";

// Valid profile fields for security - covers all common VA form fields
const VALID_PROFILE_FIELDS = [
  // === Personal Identification ===
  "firstName",
  "middleInitial",
  "middleName",
  "lastName",
  "suffix",
  "fullName",
  "ssn",
  "ssnLast4",
  "vaFileNumber",
  "serviceNumber",
  "dob",
  "placeOfBirth",
  "gender",
  "maritalStatus",

  // === Contact Information ===
  "email",
  "phone",
  "intlPhone",
  "alternatePhone",
  "street",
  "apt",
  "city",
  "state",
  "zip",
  "country",
  "mailingStreet",
  "mailingCity",
  "mailingState",
  "mailingZip",
  "mailingCountry",
  "homeOfRecord",

  // === Military Service Information ===
  "branch",
  "component",
  "rankAtDischarge",
  "payGrade",
  "serviceStartDate",
  // D-C (final10 QA, 2026-09-25): whether serviceStartDate was calculated
  // (separation date minus net service) rather than printed on the
  // document it came from - see musterCallProcessor.js's
  // applyServiceRecordToProfileUpdates.
  "serviceStartDateDerived",
  "serviceEndDate",
  "totalServiceYears",
  "totalServiceMonths",
  "mos",
  "mosTitle",
  "primarySpecialty",
  "characterOfService",
  "separationType",
  "dischargeType",
  "foreignService",
  "combatService",
  "reenlisted",

  // Service Periods Array - for multiple enlistments
  "servicePeriods", // Array of service period objects

  // === Dependent Information (for benefits) ===
  "spouseName",
  "spouseDob",
  "spouseSsn",
  "marriageDate",
  "numberOfDependents",
  "dependentChildren",

  // === VA Claim Information ===
  "currentCombinedRating",
  "effectiveDate",
  "claimNumber",
  "vaRepresentative",
  "vsoOrganization",

  // === Employment Information ===
  "employmentStatus",
  "lastEmployer",
  "lastEmploymentDate",
  "occupation",
  "annualIncome",

  // === Banking Information (for direct deposit) ===
  "bankName",
  "routingNumber",
  "accountNumber",
  "accountType",

  // === Emergency Contact ===
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelationship",

  // === Metadata ===
  "lastUpdated",
  "profileVersion",
  // FIX-9: per-field provenance ({fieldName: "user"|"document"}) so
  // auto-populate from a newly-imported document can tell a manually
  // corrected field apart from one it filled in itself, and never
  // silently overwrite the former.
  "profileFieldSources",
  // Array of { field, profileValue, documentValue, source } -- a
  // re-imported document disagreed with a manually-edited field.
  // autoPopulateProfile (musterCallProcessor.js) never overwrites the
  // manual edit, but appends here so the Profile tab can show the veteran
  // what disagreed instead of leaving the conflict invisible.
  "pendingProfileConflicts",

  // === Display Preferences ===
  "showStateAwards",
];

// Max lengths for security
const MAX_STRING_LENGTH = 500;
// Real VA letters name re-characterized conditions in full, with a rename
// and a "(claimed as ...)" qualifier both in play ("lumbosacral strain,
// degenerative disc disease ... (previously rated as lumbago) (claimed as
// ...)"); 200 truncated real names mid-word. packetSummary.js's own
// LONG_VA_CONDITION_MAX (400) is the same real-name-length ceiling.
const RATING_NAME_MAX_LENGTH = 400;

/**
 * Sanitize string input
 */
const sanitizeString = (str, maxLength = MAX_STRING_LENGTH) => {
  if (typeof str !== "string") return "";
  let sanitized = str.slice(0, maxLength);
  sanitized = sanitized.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  sanitized = sanitized.replace(/on\w+\s*=/gi, "");
  sanitized = sanitized.replace(/javascript:/gi, "");
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return sanitized.trim();
};

/**
 * Get the veteran profile from localStorage
 * @returns {Object} The veteran profile or empty object
 */
export const getVeteranProfile = () => {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error("Error reading veteran profile:", error);
    return {};
  }
};

// Sanitize a single profile field value based on its runtime type.
// Arrays/objects/booleans/numbers are stored as-is (already validated on
// write); everything else is coerced to a sanitized string.
function _sanitizeProfileFieldValue(value) {
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return value;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  return sanitizeString(String(value));
}

/**
 * Save/update the veteran profile
 * @param {Object} profile - The profile data to save
 * @returns {boolean} Success status
 */
// ADR-007 chokepoint: while a canonical period backs the service entry
// date, this is the ONLY place the flat serviceStartDate/
// serviceStartDateDerived/profileFieldSources.serviceStartDate mirror is
// ever written (alongside setServiceEntryDate's own flat-mode branch and
// saveServiceHistory's _projectProfileMirror) - a stale caller (My Packet's
// Save Profile re-submitting component state captured before a period
// edit) can never revert the projection, because its payload values for
// those three fields are replaced here before the whitelist even runs. No
// console warning is emitted for the same reason ADR-007 §2.5 names: any
// future write path must route through setServiceEntryDate, enforced by
// the boundary test, not by a runtime log nobody reads.
export const saveVeteranProfile = (profile) => {
  try {
    if (!profile || typeof profile !== "object") {
      return false;
    }

    const payload = { ...profile };
    // Reading servicePeriods[] may run the one-time v3 migration - safe
    // here: the migration's own save projects the mirror with a raw
    // localStorage write, never by calling back into this function.
    let entry = pickServiceEntry(getServiceHistory().servicePeriods);
    if (entry.periodId) {
      const stored = getVeteranProfile();
      if (
        stored.serviceStartDate &&
        !stored.serviceStartDateDerived &&
        !isKnownServiceEntryDate(stored.serviceStartDate)
      ) {
        // The value currently on disk isn't derivable from anything the
        // projection already knows about - give saveServiceHistory's
        // section 11.2 guard a chance to preserve it (as a correction or a
        // recorded disagreement) before it gets silently overwritten below.
        saveServiceHistory(getServiceHistory());
        entry = pickServiceEntry(getServiceHistory().servicePeriods);
      }
      payload.serviceStartDate = entry.date;
      payload.serviceStartDateDerived = entry.derived;
      payload.profileFieldSources = {
        ...(payload.profileFieldSources || {}),
        serviceStartDate: entry.source === "veteran" ? "user" : "document",
      };
    }

    const sanitizedProfile = {};

    // Only save valid fields
    for (const field of VALID_PROFILE_FIELDS) {
      if (
        Object.prototype.hasOwnProperty.call(payload, field) &&
        payload[field] !== undefined &&
        payload[field] !== ""
      ) {
        sanitizedProfile[field] = _sanitizeProfileFieldValue(payload[field]);
      }
    }

    sanitizedProfile.lastUpdated = new Date().toISOString();

    localStorage.setItem(PROFILE_KEY, JSON.stringify(sanitizedProfile));

    // Trigger auto-save to crash-proof storage
    markAsModified();

    return true;
  } catch (error) {
    if (error?.name === "QuotaExceededError") {
      console.error(
        "Veteran profile NOT saved - browser storage is full. Export a backup and free up space, then try again.",
      );
    } else {
      console.error("Error saving veteran profile:", error);
    }
    return false;
  }
};

/**
 * Update specific fields in the profile
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success status
 */
export const updateVeteranProfile = (updates) => {
  const currentProfile = getVeteranProfile();
  return saveVeteranProfile({ ...currentProfile, ...updates });
};

/**
 * Clear the veteran profile
 * @returns {boolean} Success status
 */
export const clearVeteranProfile = () => {
  try {
    localStorage.removeItem(PROFILE_KEY);
    return true;
  } catch (error) {
    console.error("Error clearing veteran profile:", error);
    return false;
  }
};

/**
 * Check if a profile exists
 * @returns {boolean}
 */
export const hasVeteranProfile = () => {
  const profile = getVeteranProfile();
  // Must have at least a name to be considered valid
  return !!(profile.firstName || profile.lastName);
};

/**
 * Get full name from profile
 * @returns {string}
 */
export const getFullName = () => {
  const profile = getVeteranProfile();
  const parts = [
    profile.firstName,
    profile.middleInitial,
    profile.lastName,
    profile.suffix,
  ].filter(Boolean);
  return parts.join(" ");
};

/**
 * Whether state-scoped National Guard awards should render in the ribbon
 * rack. Defaults to true (opt-out setting) -- `?? true` (not `|| true`) so
 * an explicitly persisted `false` is never coerced back to true.
 * @returns {boolean}
 */
export const getShowStateAwards = () => {
  const profile = getVeteranProfile();
  return profile.showStateAwards ?? true;
};

/**
 * Persist the veteran's state-awards display preference.
 * @param {boolean} value
 * @returns {boolean} Success status
 */
export const setShowStateAwards = (value) => {
  return updateVeteranProfile({ showStateAwards: !!value });
};

// ============================================================================
// SAVED FORMS MANAGEMENT
// ============================================================================

/**
 * Valid form types
 */
const VALID_FORM_TYPES = [
  "buddy-statement",
  "personal-statement",
  "ptsd-stressor",
  "intent-to-file",
  "medical-release",
  "priority-processing",
  "vso-appointment",
  "vso-appointment-individual",
];

/**
 * Get all saved forms
 * @returns {Array} Array of saved forms
 */
export const getSavedForms = () => {
  try {
    const saved = localStorage.getItem(SAVED_FORMS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Error reading saved forms:", error);
    return [];
  }
};

/**
 * Save a generated form
 * @param {Object} form - The form data to save
 * @returns {string|null} The saved form ID or null on error
 */
export const saveForm = (form) => {
  try {
    if (!form?.formType || !VALID_FORM_TYPES.includes(form.formType)) {
      console.error("Invalid form type:", form?.formType);
      return null;
    }

    const forms = getSavedForms();

    const newForm = {
      id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      formType: form.formType,
      formNumber: form.formNumber || "",
      formName: form.formName || "",
      title: sanitizeString(
        form.title || form.conditionName || "Untitled Form",
        200,
      ),
      formData: form.formData || {},
      generatedContent: sanitizeString(form.generatedContent || "", 100000),
      pdfBytes: form.pdfBytes || null, // Base64 encoded PDF
      dateSaved: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
      status: form.status || "Draft",
    };

    forms.push(newForm);
    localStorage.setItem(SAVED_FORMS_KEY, JSON.stringify(forms));

    // Trigger auto-save to crash-proof storage
    markAsModified();

    return newForm.id;
  } catch (error) {
    console.error("Error saving form:", error);
    return null;
  }
};

/**
 * Update an existing saved form
 * @param {string} formId - The form ID to update
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success status
 */
export const updateSavedForm = (formId, updates) => {
  try {
    const forms = getSavedForms();
    const index = forms.findIndex((f) => f.id === formId);

    if (index === -1) return false;

    forms[index] = {
      ...forms[index],
      ...updates,
      dateUpdated: new Date().toISOString(),
    };

    localStorage.setItem(SAVED_FORMS_KEY, JSON.stringify(forms));
    return true;
  } catch (error) {
    console.error("Error updating form:", error);
    return false;
  }
};

/**
 * Get a specific saved form
 * @param {string} formId - The form ID
 * @returns {Object|null} The form or null if not found
 */
export const getSavedForm = (formId) => {
  const forms = getSavedForms();
  return forms.find((f) => f.id === formId) || null;
};

/**
 * Delete a saved form
 * @param {string} formId - The form ID to delete
 * @returns {boolean} Success status
 */
export const deleteSavedForm = (formId) => {
  try {
    const forms = getSavedForms();
    const filtered = forms.filter((f) => f.id !== formId);
    localStorage.setItem(SAVED_FORMS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error("Error deleting form:", error);
    return false;
  }
};

/**
 * Get forms by type
 * @param {string} formType - The form type to filter by
 * @returns {Array} Matching forms
 */
export const getFormsByType = (formType) => {
  const forms = getSavedForms();
  return forms.filter((f) => f.formType === formType);
};

/**
 * Clear all saved forms
 * @returns {boolean} Success status
 */
export const clearAllForms = () => {
  try {
    localStorage.removeItem(SAVED_FORMS_KEY);
    return true;
  } catch (error) {
    console.error("Error clearing forms:", error);
    return false;
  }
};

/**
 * Get form statistics
 * @returns {Object} Statistics about saved forms
 */
export const getFormStats = () => {
  const forms = getSavedForms();
  return {
    total: forms.length,
    byType: VALID_FORM_TYPES.reduce((acc, type) => {
      acc[type] = forms.filter((f) => f.formType === type).length;
      return acc;
    }, {}),
    draft: forms.filter((f) => f.status === "Draft").length,
    completed: forms.filter((f) => f.status === "Completed").length,
    submitted: forms.filter((f) => f.status === "Submitted").length,
  };
};

// ============================================================================
// EXPORT/IMPORT FOR BACKUP
// ============================================================================

/**
 * Export all veteran data for backup
 * @returns {Object} All exportable data
 */
export const exportAllVeteranData = () => {
  return {
    profile: getVeteranProfile(),
    forms: getSavedForms(),
    exportDate: new Date().toISOString(),
    version: "1.0",
  };
};

/**
 * Import veteran data from backup
 * @param {Object} data - The backup data
 * @param {string} mode - 'replace' or 'merge'
 * @returns {Object} Result with success status and message
 */
function _importProfile(data, mode) {
  if (!data.profile || typeof data.profile !== "object") return null;

  // ADR-007 §11.5/W12: a restored backup's flat serviceStartDate is about
  // to be overwritten by saveVeteranProfile's own chokepoint (once a
  // period backs the entry) - record it as a disagreement first so an
  // older, non-derived value the backup remembers is never silently lost.
  if (
    data.profile.serviceStartDate &&
    !data.profile.serviceStartDateDerived &&
    hasPeriodBackedServiceEntry() &&
    !isKnownServiceEntryDate(data.profile.serviceStartDate)
  ) {
    recordServiceEntryDisagreement(
      data.profile.serviceStartDate,
      "Restored backup",
    );
  }

  const profileSaved =
    mode === "replace"
      ? saveVeteranProfile(data.profile)
      : saveVeteranProfile({ ...getVeteranProfile(), ...data.profile });

  if (!profileSaved) {
    return {
      success: false,
      message:
        "Your profile could not be saved - your device storage may be full. Free up space and try the import again.",
    };
  }
  return null;
}

function _importForms(data, mode) {
  if (!data.forms || !Array.isArray(data.forms)) return;

  if (mode === "replace") {
    localStorage.setItem(SAVED_FORMS_KEY, JSON.stringify(data.forms));
    return;
  }

  const currentForms = getSavedForms();
  const mergedForms = [...currentForms];

  for (const form of data.forms) {
    const existingIndex = currentForms.findIndex((f) => f.id === form.id);
    if (existingIndex === -1) {
      mergedForms.push(form);
    }
  }

  localStorage.setItem(SAVED_FORMS_KEY, JSON.stringify(mergedForms));
}

export const importVeteranData = (data, mode = "replace") => {
  try {
    if (!data || typeof data !== "object") {
      return { success: false, message: "Invalid backup data" };
    }

    const profileError = _importProfile(data, mode);
    if (profileError) return profileError;

    _importForms(data, mode);

    return {
      success: true,
      message: `Successfully ${mode === "replace" ? "restored" : "merged"} data`,
      profileImported: !!data.profile,
      formsImported: data.forms?.length || 0,
    };
  } catch (error) {
    console.error("Error importing veteran data:", error);
    return { success: false, message: "Import failed: " + error.message };
  }
};

// ============================================================================
// MY RATINGS STORAGE - User's actual VA disability ratings
// ============================================================================

/**
 * Valid body parts for ratings
 */
const VALID_BODY_PARTS = new Set([
  "shoulder",
  "arm",
  "elbow",
  "forearm",
  "wrist",
  "hand",
  "fingers",
  "hip",
  "thigh",
  "knee",
  "leg",
  "ankle",
  "foot",
  "toes",
  "head",
  "eye",
  "ear",
  "nose",
  "mouth",
  "neck",
  "back",
  "chest",
  "heart",
  "lungs",
  "digestive",
  "kidney",
  "bladder",
  "reproductive",
  "skin",
  "mental",
  "tbi",
  "diabetes",
  "migraines",
  "other",
]);

/**
 * Get all saved ratings
 * @returns {Array} Array of {id, name, bodyPart, rating, side, effectiveDate}
 */
export const getMyRatings = () => {
  try {
    const saved = localStorage.getItem(RATINGS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Error reading ratings:", error);
    return [];
  }
};

/**
 * Save/replace all ratings
 * @param {Array} ratings - Array of rating objects
 * @returns {boolean} Success status
 */
export const saveMyRatings = (ratings) => {
  try {
    if (!Array.isArray(ratings)) return false;

    // Validate and sanitize each rating
    const sanitizedRatings = ratings.map((r) => ({
      id:
        r.id ||
        `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: sanitizeString(r.name || "", RATING_NAME_MAX_LENGTH),
      bodyPart: VALID_BODY_PARTS.has(r.bodyPart) ? r.bodyPart : "other",
      rating: Math.max(0, Math.min(100, Number.parseInt(r.rating) || 0)),
      side: ["left", "right", "bilateral", "none"].includes(r.side)
        ? r.side
        : "none",
      effectiveDate: r.effectiveDate || null,
      dateAdded: r.dateAdded || new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
    }));

    localStorage.setItem(RATINGS_KEY, JSON.stringify(sanitizedRatings));
    return true;
  } catch (error) {
    console.error("Error saving ratings:", error);
    return false;
  }
};

/**
 * Add a new rating
 * @param {Object} rating - The rating to add
 * @returns {string|null} The new rating ID or null on error
 */
export const addRating = (rating) => {
  try {
    const ratings = getMyRatings();

    const newRating = {
      id: `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: sanitizeString(rating.name || "", RATING_NAME_MAX_LENGTH),
      bodyPart: VALID_BODY_PARTS.has(rating.bodyPart)
        ? rating.bodyPart
        : "other",
      rating: Math.max(0, Math.min(100, Number.parseInt(rating.rating) || 0)),
      side: ["left", "right", "bilateral", "none"].includes(rating.side)
        ? rating.side
        : "none",
      effectiveDate: rating.effectiveDate || null,
      dateAdded: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
    };

    ratings.push(newRating);
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));

    return newRating.id;
  } catch (error) {
    console.error("Error adding rating:", error);
    return null;
  }
};

/**
 * Update an existing rating
 * @param {string} ratingId - The rating ID to update
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success status
 */
export const updateRating = (ratingId, updates) => {
  try {
    const ratings = getMyRatings();
    const index = ratings.findIndex((r) => r.id === ratingId);

    if (index === -1) return false;

    ratings[index] = {
      ...ratings[index],
      ...updates,
      dateUpdated: new Date().toISOString(),
    };

    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
    return true;
  } catch (error) {
    console.error("Error updating rating:", error);
    return false;
  }
};

/**
 * Remove a rating
 * @param {string} ratingId - The rating ID to remove
 * @returns {boolean} Success status
 */
export const removeRating = (ratingId) => {
  try {
    const ratings = getMyRatings();
    const filtered = ratings.filter((r) => r.id !== ratingId);
    localStorage.setItem(RATINGS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error("Error removing rating:", error);
    return false;
  }
};

/**
 * Clear all ratings
 * @returns {boolean} Success status
 */
export const clearMyRatings = () => {
  try {
    localStorage.removeItem(RATINGS_KEY);
    return true;
  } catch (error) {
    console.error("Error clearing ratings:", error);
    return false;
  }
};

/**
 * Check if user has saved ratings
 * @returns {boolean}
 */
export const hasMyRatings = () => {
  const ratings = getMyRatings();
  return ratings.length > 0;
};

// ============================================================================
// SERVICE HISTORY STORAGE - Deployments, Awards, DD214 data
// ============================================================================

const SERVICE_HISTORY_KEY = "vet_rate_service_history";

// D-A (final10 QA, 2026-09-25): schema version for one-time service-history
// migrations - bumped to 1 for the Box-18-contamination repair
// (_repairContaminatedWindowPeriods) below, so it runs exactly once per
// veteran instead of re-fingerprinting (and risking a false positive on)
// every single read. A history saved before this field existed has no
// `schemaVersion` at all, which getServiceHistory normalizes to 0.
// Bumped to 2 for _repairStaleCodeSheetDerivedFlag below (D11-1 follow-up):
// a code-sheet-corrected period saved before _mergeExistingServicePeriod's
// authoritativeDates bypass existed can still carry a stale
// serviceStartDateDerived: true, which reads VA's own printed date as
// "calculated from net service".
// Bumped to 3 for ADR-007: infers serviceStartDateSource/startDateCorrection
// on every period that predates those fields (_inferStartDateProvenance),
// then folds the legacy >7-day-correction duplicate pairs D12-2 left behind
// (_mergeReviewCorrectionDuplicates). Each step is gated on its OWN prior
// version (v<1, v<2, v<3), not just "below current", so a v1 history never
// re-runs the v1 repair and a v2 history never re-runs the v2 one.
const SERVICE_HISTORY_SCHEMA_VERSION = 3;

/**
 * Valid deployment locations/theaters
 */
const VALID_THEATERS = new Set([
  "OIF",
  "OEF",
  "OND",
  "OIR",
  "OFS",
  "Vietnam",
  "Korea",
  "Gulf War",
  "Somalia",
  "Bosnia",
  "Kosovo",
  "Panama",
  "Grenada",
  "CONUS",
  "Europe",
  "Pacific",
  // Country-name theaters musterCallProcessor.js's DD214 Box 18 deployment
  // extraction can now produce directly (its own DESIGNATED_COMBAT_ZONES
  // list, sourced from the IRS combat-zone designations) - without these, a
  // document-ingested deployment to any of them collapsed to "Other" here
  // and lost the real location entirely.
  "Afghanistan",
  "Iraq",
  "Kuwait",
  "Saudi Arabia",
  "Bahrain",
  "Qatar",
  "UAE",
  "Oman",
  "Syria",
  "Sinai",
  "Other",
]);

/**
 * Get service history data
 * @returns {Object} Service history with deployments, awards, dd214Data
 */
export const getServiceHistory = () => {
  try {
    const saved = localStorage.getItem(SERVICE_HISTORY_KEY);
    if (!saved) {
      return {
        deployments: [],
        awards: [],
        dd214Data: null,
        serviceInfo: null,
        servicePeriods: [],
        unmatchedServiceRecords: [],
        dutyStations: [],
        documentPeriodCounts: {},
        // Nothing to migrate for a brand-new history.
        schemaVersion: SERVICE_HISTORY_SCHEMA_VERSION,
        dateUpdated: null,
      };
    }
    const parsed = JSON.parse(saved);
    // Data saved before servicePeriods[]/dutyStations[]/
    // unmatchedServiceRecords[] existed won't have the key - normalize so
    // every caller can rely on it being an array.
    parsed.servicePeriods = Array.isArray(parsed.servicePeriods)
      ? parsed.servicePeriods
      : [];
    parsed.unmatchedServiceRecords = Array.isArray(
      parsed.unmatchedServiceRecords,
    )
      ? parsed.unmatchedServiceRecords
      : [];
    parsed.dutyStations = Array.isArray(parsed.dutyStations)
      ? parsed.dutyStations
      : [];
    // N9b: how many periods each document has ever produced - persisted
    // (not recomputed from current state) so a later merge that adds a
    // second document to a period's `sources` can never retroactively
    // change the first document's own count.
    parsed.documentPeriodCounts =
      parsed.documentPeriodCounts &&
      typeof parsed.documentPeriodCounts === "object"
        ? parsed.documentPeriodCounts
        : {};
    // N9a: seed `sources` on read too (not just on the next save) so
    // _hasProvenLink sees real provenance immediately, even before
    // anything has re-saved this data under the new shape.
    parsed.servicePeriods = parsed.servicePeriods.map(_seedSourcesIfMissing);
    parsed.unmatchedServiceRecords = parsed.unmatchedServiceRecords.map(
      _seedSourcesIfMissing,
    );
    // D-A: one-time, versioned migration - a history already at (or past)
    // the current schema version has already had this repair applied (or
    // never needed it), so it never runs a second time and can never
    // re-fingerprint a period a user or a later document has since
    // legitimately changed.
    parsed.schemaVersion =
      typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : 0;
    if (parsed.schemaVersion < SERVICE_HISTORY_SCHEMA_VERSION) {
      if (parsed.schemaVersion < 1) {
        _repairContaminatedWindowPeriods(parsed);
      }
      if (parsed.schemaVersion < 2) {
        _repairStaleCodeSheetDerivedFlag(parsed);
      }
      if (parsed.schemaVersion < 3) {
        _inferStartDateProvenance(parsed);
        _mergeReviewCorrectionDuplicates(parsed);
      }
      parsed.schemaVersion = SERVICE_HISTORY_SCHEMA_VERSION;
      saveServiceHistory(parsed);
    }
    return parsed;
  } catch (error) {
    console.error("Error reading service history:", error);
    return {
      deployments: [],
      awards: [],
      dd214Data: null,
      serviceInfo: null,
      servicePeriods: [],
      unmatchedServiceRecords: [],
      dutyStations: [],
      documentPeriodCounts: {},
      schemaVersion: SERVICE_HISTORY_SCHEMA_VERSION,
      dateUpdated: null,
    };
  }
};

/**
 * Save the entire service history
 * @param {Object} history - The service history data
 * @returns {boolean} Success status
 */
function _sanitizeDeployments(deployments) {
  if (!Array.isArray(deployments)) return [];
  return deployments.map((d) => ({
    id: d.id || `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    theater: VALID_THEATERS.has(d.theater) ? d.theater : "Other",
    location: sanitizeString(d.location || "", 200),
    startDate: d.startDate || null,
    endDate: d.endDate || null,
    unit: sanitizeString(d.unit || "", 200),
    notes: sanitizeString(d.notes || "", 1000),
    hazardous: !!d.hazardous,
    combat: !!d.combat,
    dateAdded: d.dateAdded || new Date().toISOString(),
    // Reference (not nesting) into servicePeriods[] - null means
    // career-level/unassigned. Hook for a future locations-timeline
    // feature; no such feature is built this pass.
    periodId: d.periodId || null,
  }));
}

/**
 * Sanitize a single lat/lon coordinate: must be finite and within
 * [-limit, limit], else null (out-of-range/NaN/Infinity all collapse to
 * "unknown", not a clamped or silently-wrong value).
 */
function sanitizeCoordinate(value, limit) {
  const num = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(num) || Math.abs(num) > limit) return null;
  return num;
}

/**
 * Duty stations - user-entered, one-to-many by reference into
 * servicePeriods[] via periodId (same reference pattern as deployments
 * above, not nesting). No cascade-delete: a station whose period is later
 * removed just becomes unassigned (periodId still points at a now-missing
 * id, which every reader treats the same as null).
 */
const MAX_DUTY_STATIONS = 100;

function _sanitizeDutyStations(dutyStations) {
  if (!Array.isArray(dutyStations)) return [];
  return dutyStations.slice(0, MAX_DUTY_STATIONS).map((s) => ({
    id: s.id || `duty_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    periodId: s.periodId || null,
    name: sanitizeString(s.name || "", 200),
    country: sanitizeString(s.country || "", 100),
    latitude: sanitizeCoordinate(s.latitude, 90),
    longitude: sanitizeCoordinate(s.longitude, 180),
    startDate: s.startDate || null,
    endDate: s.endDate || null,
    notes: sanitizeString(s.notes || "", 1000),
    dateAdded: s.dateAdded || new Date().toISOString(),
  }));
}

/**
 * Sanitize a device object attached to an award. FIX-4: devices must stay
 * structured {type, position} objects end-to-end - VisualRibbon switches
 * on device.type, so flattening to a display-name string breaks rendering.
 */
function _sanitizeDevice(device) {
  if (!device || typeof device !== "object") return null;
  if (!device.type) return null;
  return {
    type: sanitizeString(String(device.type), 50),
    position:
      typeof device.position === "number"
        ? device.position
        : sanitizeString(String(device.position ?? ""), 20),
  };
}

function _sanitizeDeviceList(devices) {
  if (!Array.isArray(devices)) return [];
  return devices.map(_sanitizeDevice).filter(Boolean);
}

function _sanitizeAwards(awards) {
  if (!Array.isArray(awards)) return [];
  return awards.map((a) => ({
    id:
      a.id || `award_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: sanitizeString(a.name || "", 200),
    abbreviation: sanitizeString(a.abbreviation || "", 50),
    dateReceived: a.dateReceived || null,
    notes: sanitizeString(a.notes || "", 500),
    isCombat: !!a.isCombat,
    // FIX-4: structured {type, position} objects, NOT flattened display
    // name strings.
    devices: _sanitizeDeviceList(a.devices),
    dateAdded: a.dateAdded || new Date().toISOString(),
  }));
}

function _sanitizeDd214DataCore(dd214Data) {
  return {
    branch: sanitizeString(dd214Data.branch || "", 100),
    mos: sanitizeString(dd214Data.mos || "", 200),
    mosTitle: sanitizeString(dd214Data.mosTitle || "", 200),
    entryDate: dd214Data.entryDate || null,
    // D-C (final10 QA, 2026-09-25): whether entryDate was calculated
    // (NGB-22 separation date minus net service) rather than printed on
    // the source document - see musterCallProcessor.js's
    // _extractNGB22PrimaryPeriodDates.
    entryDateDerived: !!dd214Data.entryDateDerived,
    separationDate: dd214Data.separationDate || null,
    yearsService: dd214Data.yearsService || null,
    monthsService: dd214Data.monthsService || null,
    separationType: sanitizeString(dd214Data.separationType || "", 100),
    characterOfService: sanitizeString(dd214Data.characterOfService || "", 100),
    reenlisted: !!dd214Data.reenlisted,
    // Tri-state: keep "not extracted" (null) distinct from a confirmed
    // "no" (false) instead of coercing both to false.
    foreignService:
      typeof dd214Data.foreignService === "boolean"
        ? dd214Data.foreignService
        : null,
    extractedText: sanitizeString(dd214Data.extractedText || "", 10000),
    dateProcessed: dd214Data.dateProcessed || new Date().toISOString(),
    confidence:
      typeof dd214Data.confidence === "number" ? dd214Data.confidence : 0,
  };
}

// Q1 whitelist expansion (2026-07-30, Anth-authorized): exactly these 9
// fields, no more. ssnFull and serviceNumber are DELIBERATELY excluded -
// do not add them here without explicit re-authorization.
// FIX-17 (2026-08-03, Anth-authorized): lastName/firstName/middleName added
// to the same whitelist. Same privacy posture as the Q1 expansion above
// (name is already displayed elsewhere in the app, unlike
// ssnFull/serviceNumber which stay excluded) - buildDD214ProfileUpdate
// already supplied these fields, but this whitelist silently dropped them
// on every write. Split into its own function (alongside
// _sanitizeDd214DataCore) purely to keep cyclomatic complexity under the
// repo's lint ceiling - every branch here is a field default.
function _sanitizeDd214DataWhitelisted(dd214Data) {
  return {
    fullName: sanitizeString(dd214Data.fullName || "", 200),
    // FIX-19 (2026-08-04): which form type (DD214/NGB22/DD256/DD257)
    // actually supplied fullName - not a document filename or any other
    // identifying detail, just the form-type marker musterCallProcessor.js
    // already carries on every extraction. Lets the Service tab's Name card
    // show a real source instead of a hardcoded "DD-214, Block 1" claim.
    fullNameSourceForm: sanitizeString(dd214Data.fullNameSourceForm || "", 20),
    lastName: sanitizeString(dd214Data.lastName || "", 100),
    firstName: sanitizeString(dd214Data.firstName || "", 100),
    middleName: sanitizeString(dd214Data.middleName || "", 100),
    rank: sanitizeString(dd214Data.rank || "", 100),
    payGrade: sanitizeString(dd214Data.payGrade || "", 10),
    dateOfBirth: dd214Data.dateOfBirth || null,
    separationAuthority: sanitizeString(
      dd214Data.separationAuthority || "",
      200,
    ),
    separationCode: sanitizeString(dd214Data.separationCode || "", 50),
    reentryCode: sanitizeString(dd214Data.reentryCode || "", 50),
    narrativeReason: sanitizeString(dd214Data.narrativeReason || "", 500),
    militaryEducation: Array.isArray(dd214Data.militaryEducation)
      ? dd214Data.militaryEducation
          .map((m) => sanitizeString(String(m), 200))
          .slice(0, 20)
      : sanitizeString(dd214Data.militaryEducation || "", 500),
  };
}

function _sanitizeDd214Data(dd214Data) {
  if (!dd214Data) return null;
  return {
    ..._sanitizeDd214DataCore(dd214Data),
    ..._sanitizeDd214DataWhitelisted(dd214Data),
  };
}

function _sanitizeServiceInfo(serviceInfo) {
  if (!serviceInfo) return null;
  return {
    branch: sanitizeString(serviceInfo.branch || "", 100),
    component: sanitizeString(serviceInfo.component || "", 100), // Active, Reserve, Guard
    rank: sanitizeString(serviceInfo.rank || "", 100),
    mos: sanitizeString(serviceInfo.mos || "", 200),
  };
}

// ============================================================================
// SERVICE PERIODS - canonical multi-period service history model.
//
// One entry per DD214/NGB22 (period-scoped fields, never merged across
// periods). Identity key is (serviceStartDate, serviceEndDate) - NOT
// filename - so a re-scan of the same document merges by confidence, but
// two genuinely different enlistment periods never collide.
//
// This is the canonical store: the Profile tab's manual editor and the
// Service tab's document-derived display both read/write this same array
// (Q4, 2026-07-30). `profile.servicePeriods` and `serviceHistory.dd214Data`
// remain in place, unread going forward, per the dual-read migration
// pattern.
// ============================================================================

const SERVICE_PERIOD_MERGE_FIELDS = [
  "branch",
  "component",
  "formType",
  "rank",
  "payGrade",
  "mos",
  "mosTitle",
  "unit",
  "characterOfService",
  "separationType",
  "separationAuthority",
  "separationCode",
  "reentryCode",
  "narrativeReason",
  "netActiveService",
  "yearsService",
  "monthsService",
  "daysService",
  "foreignService",
  "militaryEducation",
  "sourceDocument",
  "notes",
  // FIX-15: Box 7a/8 place-of-entry-or-home-of-record - real, extractable
  // duty/home location data, period-scoped (not identity-scoped) since it
  // isn't part of the (serviceStartDate, serviceEndDate) merge key.
  "placeOfEntry",
  // Low-confidence hedge flag for placeOfEntry (see
  // _isPlaceOfEntryLowConfidence, musterCallProcessor.js). Same
  // truthy-only merge caveat as the foreignService boolean above: a later
  // re-scan that resolves the flag to false can't clear a previously-set
  // true.
  "placeOfEntryLowConfidence",
  // The start date was calculated (separation date minus net service), not
  // printed on the form; net service excludes lost time, so it can be late.
  "serviceStartDateDerived",
];

// N9a: lightweight seed applied on every read (getServiceHistory), ahead
// of the full sanitize (_sanitizeSources) that only runs on the next save
// - so a proven-link check running before anything has re-saved this
// veteran's data still sees real provenance instead of an empty list.
//
// D-A (final10 QA correctness re-review, 2026-09-26): a fabricated,
// single-entry `sources` built here from `sourceDocument` alone proves
// nothing about how many documents actually contributed historically -
// `sourceDocument` is routinely REASSIGNED by an ordinary higher-confidence
// merge (see _mergeExistingServicePeriod), so a period two real documents
// built together looks identical, at read time, to one only a single
// document ever touched. `__seededSources` marks that distinction so
// _hasNoOtherContributor (below) can tell a fabricated guess apart from
// `sources` this app's own merge code actually accumulated.
function _seedSourcesIfMissing(p) {
  if (Array.isArray(p.sources) && p.sources.length > 0) return p;
  if (!p.sourceDocument) return p;
  return {
    ...p,
    sources: [{ sourceDocument: p.sourceDocument, formType: p.formType || "" }],
    __seededSources: true,
  };
}

// N9e (final9 QA, 2026-09-25): one-time repair, applied on every read, for
// periods saved before N9's (a)-(c) fixes below, where an NGB-22's
// undated enlistment-level record was wrongly absorbed into one of its
// own Box 18 training/activation windows (_absorbUnmatchedRecords, before
// this fix). Traced by structural impossibility, never guessed: these are
// exactly the fields _saveNGB22AdditionalPeriods's own upsert payload
// (musterCallProcessor.js) can never set directly - only branch,
// component, formType, rank, sourceDocument and notes are legitimately
// its own. component/rank are deliberately left alone even on a
// contaminated period: Box 18 legitimately sets both on some of its own
// periods, and an already-overwritten `component` can't be safely
// un-corrupted without guessing what it used to say - the honest fallback
// for those two fields is simply not making them worse. Idempotent: once
// repaired, the fingerprint (the exact Box-18 notes boilerplate plus any
// of these fields) no longer matches.
const NGB22_BOX18_NOTES =
  "Date range from NGB-22 Box 18 remarks (no location listed on the document).";

const BOX18_IMPOSSIBLE_FIELD_DEFAULTS = {
  payGrade: "",
  mos: "",
  mosTitle: "",
  unit: "",
  characterOfService: "",
  separationType: "",
  separationAuthority: "",
  separationCode: "",
  reentryCode: "",
  narrativeReason: "",
  netActiveService: "",
  yearsService: null,
  monthsService: null,
  daysService: null,
  foreignService: null,
  militaryEducation: "",
  placeOfEntry: "",
  placeOfEntryLowConfidence: false,
  serviceStartDateDerived: false,
};

// D-A (final10 QA, 2026-09-25; corrected in final10 QA's correctness
// re-review, 2026-09-26): the fingerprint above (formType + Box-18 notes
// boilerplate + an "impossible" field populated) also matches a period an
// ORDINARY, legitimate merge produced - a dated DD214 for that exact
// window saved before the NGB-22, whose Box 18 upsert is provenance-only
// (formType/notes/sourceDocument, all reassignable per the "Code Sheet"
// precedent) and never touches payGrade/mos/characterOfService/etc, so
// those fields staying populated after the merge is the DD214's real
// data, not contamination. Only a period whose provenance (`sources`)
// contains no document other than that one NGB-22 is provably the OLD
// bug's signature (the document's own undated primary record absorbed
// into its own window) - any other contributor proves these fields are
// real and must be left alone.
//
// The catch: `sources` didn't exist until 547bd981, and this repair's own
// target bug (the OLD _absorbUnmatchedRecords) predates that too - so
// EVERY period this repair could legitimately need to fix was ALSO saved
// before `sources` existed, and reads back with a single, fabricated
// entry (_seedSourcesIfMissing, `__seededSources: true`) built from
// `sourceDocument` alone. That fabricated entry looks identical to a real
// single-contributor history - it can't tell "only one document ever
// touched this" from "we simply never recorded who else did", and this
// exact shape is also precisely what a normal, never-contaminated
// pre-`sources` history (i.e. every deployed veteran's data, since neither
// `sources` nor the contamination bug ever shipped past this feature
// branch) looks like on read. Only a period whose `sources` this app's
// OWN merge code actually accumulated - never fabricated by the read-time
// seed - is real evidence of "no other contributor". A fabricated seed is
// treated as "we don't know", not as proof, so this repair now only ever
// fires on a fresh regression by CURRENT merge code (which always writes
// real `sources`), never on legacy or deployed data it can't safely
// evaluate.
function _hasNoOtherContributor(p) {
  if (p.__seededSources) return false;
  const sources = Array.isArray(p.sources) ? p.sources : [];
  return sources.every((s) => s.sourceDocument === p.sourceDocument);
}

function _isContaminatedBox18Period(p) {
  return (
    !p.userEdited &&
    p.formType === "NGB22" &&
    p.notes === NGB22_BOX18_NOTES &&
    _hasNoOtherContributor(p) &&
    Object.keys(BOX18_IMPOSSIBLE_FIELD_DEFAULTS).some((field) => p[field])
  );
}

function _recoverContaminatedFields(p) {
  const cleaned = { ...p };
  const recovered = {};
  Object.entries(BOX18_IMPOSSIBLE_FIELD_DEFAULTS).forEach(
    ([field, emptyValue]) => {
      if (cleaned[field]) {
        recovered[field] = cleaned[field];
        cleaned[field] = emptyValue;
      }
    },
  );
  return { cleaned, recovered };
}

function _repairContaminatedWindowPeriods(history) {
  const recovered = [];
  history.servicePeriods = history.servicePeriods.map((p) => {
    if (!_isContaminatedBox18Period(p)) return p;
    const { cleaned, recovered: recoveredFields } =
      _recoverContaminatedFields(p);
    recovered.push({
      id: `period_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userEdited: false,
      serviceStartDate: null,
      serviceEndDate: null,
      incomplete: true,
      branch: p.branch || "",
      formType: p.formType,
      sourceDocument: p.sourceDocument || "",
      sources: p.sources || [],
      confidence: p.confidence ?? null,
      ...recoveredFields,
    });
    return cleaned;
  });
  if (recovered.length > 0) {
    history.unmatchedServiceRecords = [
      ...history.unmatchedServiceRecords,
      ...recovered,
    ];
  }
}

// D11-1 follow-up: a period a code sheet has already contributed to is VA's
// own authoritative record for its dates (same reasoning
// _mergeExistingServicePeriod's authoritativeDates bypass already applies
// going forward) - it is never a calculated guess, regardless of what an
// earlier NGB-22/DD214 merge left on serviceStartDateDerived before that
// bypass existed. Idempotent: a period without this stale combination is
// returned unchanged, so this is safe to run on every migration pass.
function _isStaleCodeSheetDerivedPeriod(p) {
  if (!p.serviceStartDateDerived) return false;
  if (p.formType === "Code Sheet") return true;
  return (p.sources || []).some((s) => s.formType === "Code Sheet");
}

function _repairStaleCodeSheetDerivedFlag(history) {
  history.servicePeriods = history.servicePeriods.map((p) =>
    _isStaleCodeSheetDerivedPeriod(p)
      ? { ...p, serviceStartDateDerived: false }
      : p,
  );
}

function _hasCodeSheetContributor(p) {
  return (
    p.formType === "Code Sheet" ||
    (Array.isArray(p.sources) &&
      p.sources.some((s) => s?.formType === "Code Sheet"))
  );
}

// ADR-007 v3 migration, step 1: every period saved before
// serviceStartDateSource existed gets provenance inferred from what's
// already on it - never re-inferred once a valid explicit source is
// already stored (idempotent). userEdited alone is never enough to infer
// 'veteran' provenance for a DERIVED date (a MOS-only manual edit doesn't
// prove the veteran corrected the date too); it only matters for a
// non-derived date, where it's the strongest signal this codebase has ever
// recorded of a veteran-authored value.
function _inferPeriodStartProvenance(p, dateUpdated) {
  if (!p.serviceStartDate || START_SOURCES.includes(p.serviceStartDateSource)) {
    return p;
  }
  if (_hasCodeSheetContributor(p)) {
    return {
      ...p,
      serviceStartDateSource: "code_sheet",
      serviceStartDateDerived: false,
      startDateCorrection: null,
    };
  }
  if (p.serviceStartDateDerived) {
    return {
      ...p,
      serviceStartDateSource: "calculated",
      startDateCorrection: null,
    };
  }
  if (p.userEdited) {
    const hasDocs = documentSources(p).length > 0;
    return {
      ...p,
      serviceStartDateSource: "veteran",
      startDateCorrection: hasDocs
        ? {
            via: "legacy_edit",
            correctedAt: dateUpdated || new Date().toISOString(),
            documentDate: null,
            documentSource: null,
          }
        : null,
    };
  }
  if (documentSources(p).length === 0) {
    return {
      ...p,
      serviceStartDateSource: "veteran",
      startDateCorrection: null,
    };
  }
  return { ...p, serviceStartDateSource: "printed", startDateCorrection: null };
}

function _inferStartDateProvenance(history) {
  history.servicePeriods = history.servicePeriods.map((p) =>
    _inferPeriodStartProvenance(p, history.dateUpdated),
  );
  history.unmatchedServiceRecords = history.unmatchedServiceRecords.map((p) =>
    _inferPeriodStartProvenance(p, history.dateUpdated),
  );
}

// ADR-007 v3 migration, step 2 (D12-2 legacy repair): before this feature,
// a review correction more than isSameServicePeriod's 7-day tolerance away
// from the original calculated guess couldn't merge onto it, so both
// periods for the SAME real enlistment ended up stored side by side - the
// calculated one stayed on file forever, still feeding Service span/total
// time. A pair only qualifies when it's unambiguous: same document (or a
// code-sheet-only contributor on B), same end date, genuinely different
// starts, and each period appears in exactly one such pair.
function _reviewPairSharedSource(a, b) {
  const aSources = documentSources(a);
  const bEntries = Array.isArray(b.sources) ? b.sources : [];
  return aSources.find((s) => bEntries.some((e) => e.sourceDocument === s));
}

function _isReviewCorrectionPair(a, b) {
  if (a.periodScope === "window" || b.periodScope === "window") return null;
  if (a.userEdited || b.userEdited) return null;
  if (periodStartSource(a) !== "calculated") return null;
  if (periodStartSource(b) === "calculated") return null;
  const shared = _reviewPairSharedSource(a, b);
  if (!shared) return null;
  const bEntries = Array.isArray(b.sources) ? b.sources : [];
  const subsetOk = bEntries.every(
    (e) => e.sourceDocument === shared || e.formType === "Code Sheet",
  );
  if (!subsetOk) return null;
  if (!isSameCalendarDay(a.serviceEndDate, b.serviceEndDate)) return null;
  if (isSameDate(a.serviceStartDate, b.serviceStartDate)) return null;
  return { shared };
}

function _mergeReviewCorrectionDuplicates(history) {
  const periods = history.servicePeriods;
  const pairs = [];
  periods.forEach((a, aIndex) => {
    periods.forEach((b, bIndex) => {
      if (aIndex === bIndex) return;
      const match = _isReviewCorrectionPair(a, b);
      if (match) pairs.push({ aIndex, bIndex, shared: match.shared });
    });
  });
  if (pairs.length === 0) return;

  const involvedCounts = new Map();
  pairs.forEach(({ aIndex, bIndex }) => {
    involvedCounts.set(aIndex, (involvedCounts.get(aIndex) || 0) + 1);
    involvedCounts.set(bIndex, (involvedCounts.get(bIndex) || 0) + 1);
  });
  const validPairs = pairs.filter(
    ({ aIndex, bIndex }) =>
      involvedCounts.get(aIndex) === 1 && involvedCounts.get(bIndex) === 1,
  );
  if (validPairs.length === 0) return;

  const toRemove = new Set();
  validPairs.forEach(({ aIndex, bIndex, shared }) => {
    const a = periods[aIndex];
    const b = periods[bIndex];
    const bHasCodeSheet = (b.sources || []).some(
      (s) => s.formType === "Code Sheet",
    );
    let merged = _mergeExistingServicePeriod(a, b, {});
    merged.fieldConflicts = [
      ...(merged.fieldConflicts || []),
      ...(b.fieldConflicts || []),
    ];
    const combinedSources = [...(a.sources || [])];
    (b.sources || []).forEach((s) => {
      if (
        !combinedSources.some(
          (existing) => existing.sourceDocument === s.sourceDocument,
        )
      ) {
        combinedSources.push(s);
      }
    });
    merged.sources = combinedSources;
    merged = bHasCodeSheet
      ? _setPeriodStart(merged, b.serviceStartDate, "code_sheet", null)
      : _setPeriodStart(merged, b.serviceStartDate, "veteran", {
          via: "legacy_muster_review",
          correctedAt: history.dateUpdated || new Date().toISOString(),
          documentDate: a.serviceStartDate,
          documentSource: "calculated",
        });
    periods[aIndex] = { ...merged, id: a.id };

    history.deployments = (history.deployments || []).map((d) =>
      d.periodId === b.id ? { ...d, periodId: a.id } : d,
    );
    history.dutyStations = (history.dutyStations || []).map((s) =>
      s.periodId === b.id ? { ...s, periodId: a.id } : s,
    );
    if (shared) {
      history.documentPeriodCounts = {
        ...history.documentPeriodCounts,
        [shared]: Math.max(
          1,
          (history.documentPeriodCounts?.[shared] || 1) - 1,
        ),
      };
    }
    toRemove.add(bIndex);
  });
  history.servicePeriods = periods.filter((_, index) => !toRemove.has(index));
}

// ADR-007: serviceStartDateSource is now authoritative provenance for the
// period's own effective start - periodStartSource (serviceEntryDate.js)
// both validates an already-explicit source and infers one for data that
// doesn't have it yet (a writer that supplies only serviceStartDateDerived:
// true and no source keeps 'calculated' - never silently reset to false).
function _sanitizeServicePeriodIdentity(p) {
  const source = periodStartSource(p);
  return {
    id:
      p.id || `period_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    serviceStartDate: p.serviceStartDate || null,
    serviceEndDate: p.serviceEndDate || null,
    branch: sanitizeString(p.branch || "", 100),
    component: sanitizeString(p.component || "", 50),
    formType: sanitizeString(p.formType || "", 20),
    rank: sanitizeString(p.rank || "", 100),
    payGrade: sanitizeString(p.payGrade || "", 10),
    mos: sanitizeString(p.mos || "", 200),
    mosTitle: sanitizeString(p.mosTitle || "", 200),
    unit: sanitizeString(p.unit || "", 300),
    placeOfEntry: sanitizeString(p.placeOfEntry || "", 300),
    placeOfEntryLowConfidence: !!p.placeOfEntryLowConfidence,
    serviceStartDateSource: source,
    serviceStartDateDerived: source === "calculated",
  };
}

function _sanitizeServicePeriodSeparationAndTime(p) {
  return {
    characterOfService: sanitizeString(p.characterOfService || "", 100),
    separationType: sanitizeString(p.separationType || "", 100),
    separationAuthority: sanitizeString(p.separationAuthority || "", 200),
    separationCode: sanitizeString(p.separationCode || "", 50),
    reentryCode: sanitizeString(p.reentryCode || "", 50),
    narrativeReason: sanitizeString(p.narrativeReason || "", 500),
    netActiveService: sanitizeString(p.netActiveService || "", 100),
    yearsService: typeof p.yearsService === "number" ? p.yearsService : null,
    monthsService: typeof p.monthsService === "number" ? p.monthsService : null,
    daysService: typeof p.daysService === "number" ? p.daysService : null,
    // Tri-state: keep "not extracted" (null) distinct from a confirmed
    // "no" (false) instead of coercing both to false.
    foreignService:
      typeof p.foreignService === "boolean" ? p.foreignService : null,
    militaryEducation: Array.isArray(p.militaryEducation)
      ? p.militaryEducation
          .map((m) => sanitizeString(String(m), 200))
          .slice(0, 20)
      : sanitizeString(p.militaryEducation || "", 500),
  };
}

const MAX_FIELD_CONFLICTS = 20;

// N1b (final8 QA, 2026-09-24): a disagreement _mergeExistingServicePeriod
// found between this period's kept value and a different source
// document's conflicting one - kept (not the "existing"/"incoming" naming
// _mergeExistingServicePeriod itself uses) so the Service tab can display
// both sides with provenance instead of the conflict being silently lost.
function _sanitizeFieldConflict(c) {
  if (!c || typeof c !== "object") return null;
  return {
    field: sanitizeString(c.field || "", 50),
    keptValue: sanitizeString(String(c.keptValue ?? ""), 200),
    keptSourceDocument: sanitizeString(c.keptSourceDocument || "", 300),
    conflictingValue: sanitizeString(String(c.conflictingValue ?? ""), 200),
    conflictingSourceDocument: sanitizeString(
      c.conflictingSourceDocument || "",
      300,
    ),
    recordedAt: sanitizeString(c.recordedAt || "", 40),
  };
}

function _sanitizeFieldConflicts(conflicts) {
  if (!Array.isArray(conflicts)) return [];
  return conflicts
    .map(_sanitizeFieldConflict)
    .filter(Boolean)
    .slice(-MAX_FIELD_CONFLICTS);
}

const MAX_SOURCES = 20;

// N9a (final9 QA, 2026-09-25): every document that ever contributed to a
// period, additive-only - a merge (_mergeExistingServicePeriod) appends to
// this list but never removes or overwrites an entry, unlike the single
// `sourceDocument` field above (kept as-is for display/back-compat, and
// still legitimately reassigned by a higher-confidence merge). Doubles as
// the source of truth N9b's "did this document produce more than one
// period" check reads, since sourceDocument alone can no longer answer
// that once it's been reassigned.
function _sanitizeSource(s) {
  if (!s || typeof s !== "object") return null;
  const sourceDocument = sanitizeString(s.sourceDocument || "", 300);
  if (!sourceDocument) return null;
  return { sourceDocument, formType: sanitizeString(s.formType || "", 20) };
}

function _sanitizeSources(p) {
  const raw = Array.isArray(p.sources) ? p.sources : [];
  const sanitized = raw.map(_sanitizeSource).filter(Boolean);
  // Migration (N9a): data saved before `sources` existed only has the
  // single legacy `sourceDocument` field - seed the list from it so older
  // stored periods get the same provenance tracking going forward.
  if (sanitized.length === 0 && p.sourceDocument) {
    sanitized.push({
      sourceDocument: sanitizeString(p.sourceDocument, 300),
      formType: sanitizeString(p.formType || "", 20),
    });
  }
  const seen = new Set();
  return sanitized
    .filter((s) => {
      if (seen.has(s.sourceDocument)) return false;
      seen.add(s.sourceDocument);
      return true;
    })
    .slice(0, MAX_SOURCES);
}

// Obs 3 (final10 QA "tests" lens re-review, 2026-09-26): a field FILLED by
// a lower-confidence document (from "unknown" to "known") never recorded
// which document actually supplied it - only the period's single overall
// `sourceDocument` (whichever document happens to be the highest-
// confidence contributor), which may never have touched this field at
// all. A later conflict on that field then blamed the wrong document.
// Per-field, so each field's own fieldConflicts entry can cite the
// document that genuinely supplied its kept value.
function _sanitizeFieldSourceDocument(p) {
  const raw = p.fieldSourceDocument;
  if (!raw || typeof raw !== "object") return {};
  const sanitized = {};
  SERVICE_PERIOD_MERGE_FIELDS.forEach((field) => {
    if (raw[field]) sanitized[field] = sanitizeString(raw[field], 300);
  });
  return sanitized;
}

// ADR-007: the corrections layer for a period's start date. Only ever
// valid when the period's own (re-derived, not merely stored) provenance
// is 'veteran' - a period whose source has since changed (e.g. a code
// sheet superseded it) can never carry a stale correction pointing at a
// document that no longer decides the effective date.
function _sanitizeStartDateCorrection(p) {
  if (periodStartSource(p) !== "veteran") return null;
  const c = p.startDateCorrection;
  if (!c || typeof c !== "object") return null;
  if (!SERVICE_ENTRY_VIAS.includes(c.via)) return null;
  return {
    via: c.via,
    correctedAt: sanitizeString(c.correctedAt || "", 40),
    documentDate: parseExplicitDate(c.documentDate) || null,
    documentSource: ["code_sheet", "printed", "calculated"].includes(
      c.documentSource,
    )
      ? c.documentSource
      : null,
  };
}

function _sanitizeServicePeriodMetadata(p) {
  return {
    sourceDocument: sanitizeString(p.sourceDocument || "", 300),
    sources: _sanitizeSources(p),
    fieldSourceDocument: _sanitizeFieldSourceDocument(p),
    // N9c: "window" marks a period as a training/activation sub-period
    // (musterCallProcessor.js's NGB-22 Box 18 extraction) rather than an
    // enlistment-level record - see _hasProvenLink below for why that
    // distinction has to survive storage.
    periodScope: p.periodScope === "window" ? "window" : null,
    confidence: typeof p.confidence === "number" ? p.confidence : null,
    userEdited: !!p.userEdited,
    incomplete: !!p.incomplete,
    notes: sanitizeString(p.notes || "", 1000),
    fieldConflicts: _sanitizeFieldConflicts(p.fieldConflicts),
    startDateCorrection: _sanitizeStartDateCorrection(p),
  };
}

function _sanitizeServicePeriod(p) {
  if (!p || typeof p !== "object") return null;
  return {
    ..._sanitizeServicePeriodIdentity(p),
    ..._sanitizeServicePeriodSeparationAndTime(p),
    ..._sanitizeServicePeriodMetadata(p),
  };
}

function _sanitizeServicePeriods(periods) {
  if (!Array.isArray(periods)) return [];
  return periods.map(_sanitizeServicePeriod).filter(Boolean);
}

const MAX_DOCUMENT_PERIOD_COUNT_ENTRIES = 500;

// N9b: persisted ledger of how many periods each source document has ever
// produced - see _hasProvenLink for why "same document" alone can't prove
// a link once a document has produced more than one.
function _sanitizeDocumentPeriodCounts(counts) {
  if (!counts || typeof counts !== "object") return {};
  const sanitized = {};
  Object.entries(counts)
    .filter(([key, value]) => key && typeof value === "number" && value > 0)
    .slice(0, MAX_DOCUMENT_PERIOD_COUNT_ENTRIES)
    .forEach(([key, value]) => {
      sanitized[sanitizeString(key, 300)] = Math.floor(value);
    });
  return sanitized;
}

/**
 * Identity key for a service period: (serviceStartDate, serviceEndDate)
 * when both are known. If only one date was extractable, key on that date
 * plus sourceDocument so an incomplete period from one document never
 * collides with an incomplete period from a different document.
 */
function _servicePeriodKey(p) {
  if (p.serviceStartDate && p.serviceEndDate) {
    return `${p.serviceStartDate}|${p.serviceEndDate}`;
  }
  const singleDate = p.serviceStartDate || p.serviceEndDate || "";
  return `incomplete|${singleDate}|${p.sourceDocument || ""}`;
}

function _sameCalendarDay(a, b) {
  if (!a || !b) return false;
  const ta = formatLocalDate(a).getTime();
  const tb = formatLocalDate(b).getTime();
  return !Number.isNaN(ta) && !Number.isNaN(tb) && ta === tb;
}

function _periodHasSource(period, sourceDocument) {
  return Array.isArray(period.sources)
    ? period.sources.some((s) => s.sourceDocument === sourceDocument)
    : period.sourceDocument === sourceDocument;
}

/**
 * N1 (final8 QA, 2026-09-24): a shared branch+component "identity match"
 * used to also count here. Every mobilization DD214 for a Guard member
 * parses component "National Guard" (musterCallProcessor.js's
 * _resolveComponentFromDocument) - branch+component is then exactly as
 * weak a signal as branch alone, and it merged undated rows from several
 * genuinely different real periods into one. Proof of linkage is now only
 * ever:
 *  - the same source document (same physical form) - a garbled OCR pass
 *    that only recovered a separation date, an NGB-22 activation segment
 *    saved by the same call that already saved the primary period for
 *    that form, or a second scan of the same DD214 that recovered
 *    different fields than the first pass, or
 *  - the one known date landing on either boundary of an existing DATED
 *    period (most often the separation date) - meaningless against
 *    another incomplete period, which by definition has no boundary to
 *    land on.
 * Rank, pay grade and character of service are deliberately not part of
 * this check either way: a real re-scan of the very same period (same
 * source document) can legitimately disagree on them (a mid-tour
 * promotion, an OCR-garbled discharge characterization on one scan) -
 * requiring them all to agree would re-fragment exactly the rows this is
 * trying to consolidate. See _mergeExistingServicePeriod for how a
 * disagreement from a genuinely *different* source document is handled
 * once linkage is proven by one of the two rules above.
 *
 * N9 (final9 QA, 2026-09-25): "same document" stopped being reliable proof
 * once a period's `sourceDocument` could be reassigned by a later,
 * higher-confidence merge (a VA code sheet superseding an NGB-22, say) -
 * checking `sources` instead means a document's link to a period it once
 * contributed to is never lost that way. But a document that produced
 * MORE than one period (an NGB-22 with several Box 18 windows) proves
 * nothing by "same document" alone - `documentPeriodCounts` is the
 * (persisted, never-recomputed) count of exactly how many periods that
 * document has ever produced, and (b) only counts a same-document match
 * as proof when that count is exactly 1. (c) independently blocks a match
 * onto a "window" (training/activation sub-period): an enlistment-level
 * record must never merge into one of a document's own sub-periods, even
 * when that document happened to produce only one.
 */
function _hasProvenLink(period, incoming, documentPeriodCounts) {
  if (period.periodScope === "window") return false;
  const sameForm =
    !!incoming.sourceDocument &&
    _periodHasSource(period, incoming.sourceDocument) &&
    (documentPeriodCounts?.[incoming.sourceDocument] ?? 1) === 1;
  if (sameForm) return true;
  // Only a fully-dated period has a real boundary to land on - an
  // incomplete period can carry its OWN single known date, and that date
  // coincidentally equalling incoming's is not evidence they're the same
  // period (see "does not collide two different incomplete periods...").
  const singleDate = incoming.serviceStartDate || incoming.serviceEndDate;
  return (
    !period.incomplete &&
    !!singleDate &&
    (_sameCalendarDay(period.serviceStartDate, singleDate) ||
      _sameCalendarDay(period.serviceEndDate, singleDate))
  );
}

/**
 * Returns the indices of every existing period `incoming` has a proven
 * link to; the caller only merges when exactly one does, so an ambiguous
 * match never silently picks the wrong period - and never merges two
 * genuinely distinct dated periods, since a dated period is only ever a
 * match *target*, never itself re-matched here.
 */
function _matchIncompletePeriod(periods, incoming, documentPeriodCounts) {
  const matches = [];
  periods.forEach((p, index) => {
    if (_hasProvenLink(p, incoming, documentPeriodCounts)) matches.push(index);
  });
  return matches;
}

// Fields that make an incomplete row worth keeping as its own entry - every
// SERVICE_PERIOD_MERGE_FIELDS field except the three that are either always
// present regardless of extraction success (formType, sourceDocument - a
// document with nothing else recovered still gets a formType label) or
// generated boilerplate rather than extracted content (notes).
const INCOMPLETE_PERIOD_CONTENT_FIELDS = SERVICE_PERIOD_MERGE_FIELDS.filter(
  (field) => !["formType", "sourceDocument", "notes"].includes(field),
);

/**
 * A zero-signal incomplete row (no date, and nothing else recognizable
 * either - a scan that recovered nothing identifiable at all) has nothing
 * for a future document to ever match against, so letting it become its
 * own permanent "? - ?" row only inflates the period count. Its underlying
 * document still updates dd214Data via saveServiceRecordToProfile's
 * separate merge step - this only withholds it from becoming its own
 * servicePeriods[] entry.
 */
function _incompletePeriodHasContent(incoming) {
  if (incoming.serviceStartDate || incoming.serviceEndDate) return true;
  return INCOMPLETE_PERIOD_CONTENT_FIELDS.some((field) => incoming[field]);
}

/**
 * Locates the existing period (if any) `incoming` should upsert onto: exact
 * (serviceStartDate, serviceEndDate) key match, a dated period within
 * isSameServicePeriod's tolerance, or - for an incomplete incoming row -
 * whatever _matchIncompletePeriod resolves to. `shouldDrop: true` means the
 * caller must return null without creating or merging anything (a
 * genuinely zero-signal row with nothing to attach to and nothing worth
 * keeping). `unmatched: true` means the row has real content but no proven
 * link (N1c, final8 QA, 2026-09-24) - it must be kept, but never counted
 * or displayed as a service period; the caller routes it to the separate
 * unmatchedServiceRecords[] store instead. Split out of upsertServicePeriod
 * purely to keep that function's line count/complexity under the repo's
 * lint ceiling - same behavior.
 */
// ADR-007 identity rule 2: a document re-scanned under a DIFFERENT
// (start, end) than its first pass - OCR correcting itself, or a review
// correction - is still the same physical form, proven by (a) a stable
// filename this exact document has already contributed to and (b) the
// SAME end date. Never keys on filename alone (two different files can
// share a name), and only ever fires when exactly one period matches -
// an ambiguous same-filename/same-end situation falls through to the
// weaker rules below rather than guessing.
function _findSameDocumentIndex(periods, incoming) {
  if (
    incoming.periodScope === "window" ||
    !isStableSourceDocument(incoming.sourceDocument) ||
    !incoming.serviceEndDate
  ) {
    return -1;
  }
  const matches = periods
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        p.periodScope !== "window" &&
        documentSources(p).includes(incoming.sourceDocument) &&
        isSameCalendarDay(p.serviceEndDate, incoming.serviceEndDate),
    );
  return matches.length === 1 ? matches[0].i : -1;
}

// ADR-007 identity rule 3: a period the veteran has corrected keys its
// identity match on the DOCUMENT's own date (startDateCorrection.documentDate)
// too, not just its current effective (corrected) start - so a later
// re-import of the same document's unedited data still finds this period
// instead of creating a duplicate.
function _findCorrectionAliasIndex(periods, incoming) {
  const incomingKey = _servicePeriodKey(incoming);
  return periods.findIndex((p) => {
    const doc = p.startDateCorrection?.documentDate;
    if (!doc) return false;
    if (`${doc}|${p.serviceEndDate}` === incomingKey) return true;
    return isSameServicePeriod(
      doc,
      p.serviceEndDate,
      incoming.serviceStartDate,
      incoming.serviceEndDate,
    );
  });
}

function _findDatedServicePeriodIndex(periods, incoming) {
  const incomingKey = _servicePeriodKey(incoming);
  let index = periods.findIndex((p) => _servicePeriodKey(p) === incomingKey);
  if (index !== -1 || incoming.incomplete) return index;

  index = _findSameDocumentIndex(periods, incoming);
  if (index !== -1) return index;

  index = _findCorrectionAliasIndex(periods, incoming);
  if (index !== -1) return index;

  return periods.findIndex((p) =>
    isSameServicePeriod(
      p.serviceStartDate,
      p.serviceEndDate,
      incoming.serviceStartDate,
      incoming.serviceEndDate,
    ),
  );
}

function _findExistingServicePeriodIndex(
  periods,
  incoming,
  documentPeriodCounts,
) {
  const index = _findDatedServicePeriodIndex(periods, incoming);
  if (index !== -1 || !incoming.incomplete) return { index };

  const matches = _matchIncompletePeriod(
    periods,
    incoming,
    documentPeriodCounts,
  );
  if (matches.length === 1) return { index: matches[0] };
  if (!_incompletePeriodHasContent(incoming)) {
    return { index: -1, shouldDrop: true };
  }
  const hasDate = !!(incoming.serviceStartDate || incoming.serviceEndDate);
  if (matches.length > 1 || !hasDate) {
    return { index: -1, unmatched: true };
  }
  return { index: -1 };
}

// N1b (final8 QA, 2026-09-24): formType/sourceDocument/notes are
// provenance/bookkeeping, not facts extracted about the veteran's service
// (same trio INCOMPLETE_PERIOD_CONTENT_FIELDS already excludes) - a code
// sheet legitimately re-labels which document is "authoritative" for a
// period (saveCodeSheetServicePeriodsToProfile), which the disagreement
// rule below must not block.
const SERVICE_PERIOD_PROVENANCE_FIELDS = new Set([
  "formType",
  "sourceDocument",
  "notes",
]);

// D-F (final10 QA, 2026-09-25; corrected in final10 QA's correctness
// re-review, 2026-09-26): shared by _valuesConflict here and
// summarizeServicePeriods' own characterOfService disagreement check below
// - normalizes case, whitespace, AND punctuation/hyphens, so an OCR
// artifact like "GENERAL - UNDER HONORABLE CONDITIONS" vs "GENERAL UNDER
// HONORABLE CONDITIONS" compares equal instead of flagging a disagreement
// between two records that say the same thing. Punctuation is REMOVED,
// not replaced with a space - a replace-with-space still left "E-5" ("e
// 5") distinct from "E5" ("e5"), so a hyphen the vision parser
// (dd214VisionParser.js) drops and the regex parser (musterCallProcessor.js)
// keeps - true for pay grade, RE code, and MOS alike - still "disagreed".
// Stripping every run of non-alphanumerics entirely still keeps genuinely
// different values distinct (e.g. "GENERAL" vs "GENERALUNDERHONORABLE...").
function _normalizeForComparison(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const _valuesConflict = (a, b) =>
  _normalizeForComparison(a) !== _normalizeForComparison(b);

// N9a: append-only - a document already in the list is never duplicated,
// and nothing already there is ever dropped or reordered.
function _addSource(existingSources, sourceDocument, formType) {
  const sources = Array.isArray(existingSources) ? existingSources : [];
  if (!sourceDocument || _periodHasSource({ sources }, sourceDocument)) {
    return sources;
  }
  return [...sources, { sourceDocument, formType: formType || "" }];
}

/**
 * Merges `incoming` onto an already-saved, non-userEdited `existing`
 * period: most fields by a confidence high-water-mark, rank by recency
 * (see upsertServicePeriod's own comment), and the code sheet's dates when
 * options.authoritativeDates says so.
 *
 * N1b (final8 QA, 2026-09-24): a field from a genuinely *different* source
 * document must never silently overwrite an existing non-empty value it
 * disagrees with (case-insensitively) - regardless of which side has
 * higher confidence. The existing value is kept and the disagreement is
 * recorded on merged.fieldConflicts with both sides' provenance, so the
 * Service tab can show it instead of losing it outright. A re-scan of the
 * SAME source document is a legitimate correction, not a disagreement
 * between two real records, so it still resolves by the confidence
 * high-water-mark as before. Split out for the same line-count/complexity
 * reason as _findExistingServicePeriodIndex above.
 */
// Obs 3 (final10 QA correctness re-review, 2026-09-26): "empty" must mean
// never-extracted, not merely falsy - `foreignService: false` (a confirmed
// "no"), `yearsService: 0` (a real, sub-one-year tour), and
// `serviceStartDateDerived: false` (a real, printed date) are all genuine
// values a different, lower-confidence document must never silently
// overwrite. Only null/undefined/"" mean the period never had a value at
// all for that field - matches musterCallProcessor.js's own
// _isEmptyDD214Value for the same distinction on the dd214Data merge.
function _isEmptyServicePeriodValue(value) {
  return value === null || value === undefined || value === "";
}

// ADR-007: the only function allowed to change a start date. Sets
// serviceStartDate/serviceStartDateSource/serviceStartDateDerived/
// startDateCorrection together so they can never drift out of sync -
// derived is always exactly (source === 'calculated'), and a correction
// is only ever kept when the resulting source is 'veteran'.
function _setPeriodStart(p, date, source, correction = null) {
  return {
    ...p,
    serviceStartDate: date,
    serviceStartDateSource: source,
    serviceStartDateDerived: source === "calculated",
    startDateCorrection: source === "veteran" ? correction : null,
  };
}

/**
 * ADR-007 §2.5: the one place a veteran's own edit to a period's start
 * date is applied - setServiceEntryDate's period-mode branch,
 * updateServicePeriod, and the migration's legacy-value adoption all
 * route through this. Editing back to the document's own value (or
 * clearing the field entirely, when the period never had a document of
 * its own) reverts the correction rather than creating an ever-growing
 * chain of them.
 */
function _applyStartCorrection(period, isoOrEmpty, via) {
  const currentSource = periodStartSource(period);
  const docDate =
    period.startDateCorrection?.documentDate ??
    (currentSource !== "veteran" ? period.serviceStartDate : null);
  const docSource =
    period.startDateCorrection?.documentSource ??
    (currentSource !== "veteran" ? currentSource : null);
  const hasDocs = documentSources(period).length > 0;

  if (!isoOrEmpty) {
    if (docDate) {
      return {
        period: _setPeriodStart(period, docDate, docSource, null),
        changed: true,
      };
    }
    if (!hasDocs) {
      return {
        period: _setPeriodStart(period, null, null, null),
        changed: true,
      };
    }
    return { period, changed: false, reason: "no_document_value" };
  }

  if (isSameCalendarDay(isoOrEmpty, docDate)) {
    return {
      period: _setPeriodStart(period, docDate, docSource, null),
      changed: true,
    };
  }

  if (!hasDocs) {
    return {
      period: _setPeriodStart(period, isoOrEmpty, "veteran", null),
      changed: true,
    };
  }

  return {
    period: _setPeriodStart(period, isoOrEmpty, "veteran", {
      via,
      correctedAt: new Date().toISOString(),
      documentDate: docDate,
      documentSource: docSource,
    }),
    changed: true,
  };
}

// Ingest can never claim provenance 'veteran' - options.authoritativeDates
// (the VA code sheet) is always 'code_sheet' regardless of what the
// incoming payload itself carries.
function _incomingStartSource(incoming, options) {
  if (options.authoritativeDates) return "code_sheet";
  if (
    ["printed", "calculated", "code_sheet"].includes(
      incoming.serviceStartDateSource,
    )
  ) {
    return incoming.serviceStartDateSource;
  }
  if (incoming.serviceStartDateDerived) return "calculated";
  if (incoming.formType === "Code Sheet") return "code_sheet";
  return "printed";
}

function _pushStartConflict(existing, merged, conflicts, incoming) {
  const conflict = {
    field: "serviceStartDate",
    keptValue: merged.serviceStartDate,
    keptSourceDocument: "Your correction",
    conflictingValue: incoming.serviceStartDate,
    conflictingSourceDocument: incoming.sourceDocument || "",
    recordedAt: new Date().toISOString(),
  };
  const alreadyRecorded = [
    ...(existing.fieldConflicts || []),
    ...conflicts,
  ].some(
    (c) =>
      c.field === "serviceStartDate" &&
      isSameCalendarDay(c.conflictingValue, conflict.conflictingValue) &&
      c.conflictingSourceDocument === conflict.conflictingSourceDocument,
  );
  if (!alreadyRecorded) conflicts.push(conflict);
}

// A veteran-corrected period's effective date never moves for ingest - it
// only ever refreshes what the document itself says (documentDate/
// documentSource, so reverting still lands on the latest document value),
// and surfaces a genuine printed/code-sheet disagreement as a conflict
// instead of silently discarding it (never a mere calculated re-guess,
// which is expected and uninteresting next to a veteran's own correction).
function _mergeIncomingStartOntoVeteranPeriod(
  merged,
  incoming,
  inSrc,
  conflicts,
  existing,
) {
  const correction = merged.startDateCorrection;
  if (
    correction &&
    (!correction.documentSource ||
      SOURCE_RANK[inSrc] >= SOURCE_RANK[correction.documentSource])
  ) {
    merged.startDateCorrection = {
      ...correction,
      documentDate: parseExplicitDate(incoming.serviceStartDate),
      documentSource: inSrc,
    };
  }
  if (
    (inSrc === "printed" || inSrc === "code_sheet") &&
    !isSameCalendarDay(incoming.serviceStartDate, merged.serviceStartDate)
  ) {
    _pushStartConflict(existing, merged, conflicts, incoming);
  }
}

/**
 * ADR-007 §2.2: the ONE place ingest decides a period's start date.
 * Precedence within one enlistment is veteran > code_sheet > printed >
 * calculated - a 'veteran' start is never moved, only annotated
 * (documentDate/documentSource, and a fieldConflicts entry for a genuine
 * printed/code-sheet disagreement). Mutates `merged` and `conflicts`
 * in place; returns nothing.
 */
function _mergeIncomingStart(merged, existing, incoming, options, conflicts) {
  if (!incoming.serviceStartDate) return;
  const exSrc = periodStartSource(existing);
  const inSrc = _incomingStartSource(incoming, options);

  if (!existing.serviceStartDate) {
    Object.assign(
      merged,
      _setPeriodStart(merged, incoming.serviceStartDate, inSrc),
    );
    return;
  }

  if (exSrc === "veteran") {
    _mergeIncomingStartOntoVeteranPeriod(
      merged,
      incoming,
      inSrc,
      conflicts,
      existing,
    );
    return;
  }

  const sameRank = SOURCE_RANK[inSrc] === SOURCE_RANK[exSrc];
  const shouldReplace =
    SOURCE_RANK[inSrc] > SOURCE_RANK[exSrc] ||
    (sameRank &&
      _periodHasSource(existing, incoming.sourceDocument) &&
      (incoming.confidence ?? 0) >= (existing.confidence ?? 0)) ||
    (sameRank && inSrc === "code_sheet" && exSrc === "code_sheet");
  if (shouldReplace) {
    Object.assign(
      merged,
      _setPeriodStart(merged, incoming.serviceStartDate, inSrc),
    );
  }
}

function _mergeExistingServicePeriod(existing, incoming, options) {
  const incomingConfidence = incoming.confidence ?? 0;
  const existingConfidence = existing.confidence ?? 0;
  const sameSource =
    !!existing.sourceDocument &&
    existing.sourceDocument === incoming.sourceDocument;
  const merged = { ...existing };
  const fieldSourceDocument = { ...(existing.fieldSourceDocument || {}) };
  const conflicts = [];
  SERVICE_PERIOD_MERGE_FIELDS.forEach((field) => {
    // Rank has its own recency-based tiebreak just below - OCR confidence
    // says nothing about which document's rank is more CURRENT (a clean
    // scan of an early enlistment isn't "later" than a garbled scan of the
    // discharge that followed it).
    if (field === "rank") return;
    // serviceStartDateDerived describes serviceStartDate itself, not an
    // independent fact (same pairing veteranKnowledgeBase.js's
    // entryDate/entryDateDerived already uses) - it only ever changes
    // alongside serviceStartDate, in the authoritativeDates bypass below.
    // Treating it as an ordinary field here flagged a code sheet's real
    // printed date (serviceStartDateDerived: false) as disagreeing with an
    // existing calculated guess (true) instead of simply superseding it,
    // so the calculated marker survived a code-sheet correction.
    if (field === "serviceStartDateDerived") return;
    if (_isEmptyServicePeriodValue(incoming[field])) return;
    const existingIsEmpty = _isEmptyServicePeriodValue(existing[field]);
    const isDisagreement =
      !SERVICE_PERIOD_PROVENANCE_FIELDS.has(field) &&
      !sameSource &&
      !existingIsEmpty &&
      _valuesConflict(existing[field], incoming[field]);
    if (isDisagreement) {
      conflicts.push({
        field,
        keptValue: existing[field],
        // Obs 3 (final10 QA "tests" lens re-review, 2026-09-26): the
        // document that actually supplied the KEPT value, not necessarily
        // whichever document is this period's current overall
        // sourceDocument - a field can be filled by a lower-confidence
        // document while a different, higher-confidence document keeps
        // the period's top-level label. Falls back to the period's own
        // sourceDocument only for data saved before this tracking existed.
        keptSourceDocument:
          fieldSourceDocument[field] || existing.sourceDocument || null,
        conflictingValue: incoming[field],
        conflictingSourceDocument: incoming.sourceDocument || null,
        recordedAt: new Date().toISOString(),
      });
      return;
    }
    // Observation 3 (adv11b, final10 QA, 2026-09-25): a lower-confidence
    // document filling a field the existing period never had a value for
    // at all is not a correction that needs to out-rank anything - it's
    // simply the only fact recorded for that field so far. The confidence
    // gate below only decides which VALUE wins between two records that
    // both HAVE one; it never applies to going from "unknown" to "known".
    if (existingIsEmpty || incomingConfidence >= existingConfidence) {
      merged[field] = incoming[field];
      fieldSourceDocument[field] = incoming.sourceDocument || null;
    }
  });
  merged.fieldSourceDocument = fieldSourceDocument;
  // A later record's rank wins - "later" by the period's own end date when
  // both sides have one, else by pay grade (same rule
  // veteranKnowledgeBase.js's mergeDD214RankAndCharacter already uses for
  // the Service tab's single discharge-rank field).
  if (incoming.rank) {
    const incomingIsLater = _isLaterRecord(
      incoming.serviceEndDate,
      existing.serviceEndDate,
      parsePayGrade(incoming.payGrade),
      parsePayGrade(existing.payGrade),
    );
    if (!existing.rank || incomingIsLater) {
      merged.rank = incoming.rank;
    }
  }
  // VA's own record (the code sheet) settles the end date of two
  // near-identical dates; the START date is now decided by
  // _mergeIncomingStart's own precedence, below, which folds
  // authoritativeDates into _incomingStartSource instead.
  if (options.authoritativeDates && !incoming.incomplete) {
    merged.serviceEndDate = incoming.serviceEndDate;
  }
  _mergeIncomingStart(merged, existing, incoming, options, conflicts);
  if (conflicts.length > 0) {
    merged.fieldConflicts = [...(existing.fieldConflicts || []), ...conflicts];
  }
  merged.confidence = Math.max(incomingConfidence, existingConfidence);
  merged.incomplete = incoming.incomplete && existing.incomplete;
  // N9a: additive, unlike sourceDocument above - a merge adds the
  // incoming document to provenance, never drops an earlier contributor
  // just because a later document became the authoritative sourceDocument.
  merged.sources = _addSource(
    existing.sources,
    incoming.sourceDocument,
    incoming.formType,
  );
  // N9c: once a period is a "window" (a Box 18 training/activation
  // sub-period), it stays one - never flipped by whatever merges into it.
  merged.periodScope = existing.periodScope ?? incoming.periodScope ?? null;
  return merged;
}

export const getServicePeriods = () => getServiceHistory().servicePeriods;

// N1c (final8 QA, 2026-09-24): rows that carry real content (rank, pay
// grade, character of service, branch, ...) but have no proven link to any
// period. Kept in full - never dropped - but never counted or displayed as
// a service period; MyPacket's Service tab lists these separately ("Records
// we couldn't match to a date range").
export const getUnmatchedServiceRecords = () =>
  getServiceHistory().unmatchedServiceRecords;

function _upsertUnmatchedRecord(history, incoming) {
  const records = history.unmatchedServiceRecords;
  const existingIndex = records.findIndex(
    (r) =>
      !!incoming.sourceDocument && r.sourceDocument === incoming.sourceDocument,
  );
  if (existingIndex === -1) {
    const newRecord = {
      id: `period_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userEdited: false,
      ...incoming,
      sources: incoming.sourceDocument
        ? [
            {
              sourceDocument: incoming.sourceDocument,
              formType: incoming.formType || "",
            },
          ]
        : [],
    };
    records.push(newRecord);
    history.unmatchedServiceRecords = records;
    saveServiceHistory(history);
    return newRecord.id;
  }
  records[existingIndex] = _mergeExistingServicePeriod(
    records[existingIndex],
    incoming,
    {},
  );
  history.unmatchedServiceRecords = records;
  saveServiceHistory(history);
  return records[existingIndex].id;
}

/**
 * N8 (final8 QA, 2026-09-24): when the undated "twin" of a real period was
 * saved first (before anything dated existed for it to link to), it landed
 * in unmatchedServiceRecords and stayed there forever, even once the dated
 * period it actually belongs to showed up. Called after every successful
 * upsertServicePeriod call - re-checks every stored unmatched row against
 * the CURRENT servicePeriods array using the exact same proven-link and
 * ambiguity rules _findExistingServicePeriodIndex applies at ingest time
 * (_matchIncompletePeriod): only absorbed when exactly one period proves a
 * link. A single source document that legitimately produces more than one
 * dated period (an NGB-22's Box 18 IADT+AD breakdown) must never have an
 * undated row from that same document guessed onto whichever one happened
 * to be created first - staying in unmatchedServiceRecords is the honest
 * outcome once a second period from that document exists. Absorption
 * applies the same never-overwrite-a-disagreement merge rules as N1b.
 */
function _absorbUnmatchedRecords(history) {
  const records = history.unmatchedServiceRecords;
  if (!records || records.length === 0) return;
  const remaining = [];
  records.forEach((record) => {
    const matches = _matchIncompletePeriod(
      history.servicePeriods,
      record,
      history.documentPeriodCounts,
    );
    if (matches.length === 1) {
      const index = matches[0];
      history.servicePeriods[index] = _mergeExistingServicePeriod(
        history.servicePeriods[index],
        record,
        {},
      );
    } else {
      remaining.push(record);
    }
  });
  history.unmatchedServiceRecords = remaining;
}

// Obs 3 (final10 QA "tests" lens re-review, 2026-09-26): seeds per-field
// provenance for a brand-new period, same document for every field it
// arrives with - see _sanitizeFieldSourceDocument for why this can't just
// fall back to the period's own sourceDocument forever.
function _initialFieldSourceDocument(incoming) {
  const fieldSourceDocument = {};
  if (!incoming.sourceDocument) return fieldSourceDocument;
  SERVICE_PERIOD_MERGE_FIELDS.forEach((field) => {
    if (!_isEmptyServicePeriodValue(incoming[field])) {
      fieldSourceDocument[field] = incoming.sourceDocument;
    }
  });
  return fieldSourceDocument;
}

/**
 * Ingest-side upsert: merge a document-derived period into the canonical
 * array by (serviceStartDate, serviceEndDate) identity. Never overwrites a
 * period the user has manually edited (userEdited: true). When the period
 * already exists and isn't user-edited, period-scoped fields merge by a
 * confidence high-water-mark (same rule _mergeDD214Record already used).
 * An undated row with no proven link is stored (with all its fields) in
 * unmatchedServiceRecords instead of becoming its own period (N1c); a row
 * that upserts as a fully-dated period absorbs any unmatched rows that now
 * prove a link to it (N8).
 * @returns {string|null} The period's id, or null on error.
 */
export const upsertServicePeriod = (periodData, options = {}) => {
  try {
    const history = getServiceHistory();
    const periods = history.servicePeriods;

    const incoming = {
      ...periodData,
      sourceDocument: options.sourceDocument || periodData.sourceDocument || "",
      confidence:
        typeof options.confidence === "number"
          ? options.confidence
          : (periodData.confidence ?? null),
      incomplete: !(periodData.serviceStartDate && periodData.serviceEndDate),
    };
    // ADR-007 §2.2: ingest can never claim provenance 'veteran', and never
    // arrives with a corrections layer of its own - only
    // setServiceEntryDate/updateServicePeriod/addServicePeriod/the
    // migration ever write those.
    delete incoming.startDateCorrection;
    if (incoming.serviceStartDateSource === "veteran") {
      delete incoming.serviceStartDateSource;
    }

    const {
      index: existingIndex,
      shouldDrop,
      unmatched,
    } = _findExistingServicePeriodIndex(
      periods,
      incoming,
      history.documentPeriodCounts,
    );
    if (shouldDrop) return null;
    if (unmatched) return _upsertUnmatchedRecord(history, incoming);

    if (existingIndex === -1) {
      const newPeriod = {
        id: `period_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userEdited: false,
        ...incoming,
        serviceStartDateSource: incoming.serviceStartDate
          ? _incomingStartSource(incoming, options)
          : null,
        startDateCorrection: null,
        sources: incoming.sourceDocument
          ? [
              {
                sourceDocument: incoming.sourceDocument,
                formType: incoming.formType || "",
              },
            ]
          : [],
        fieldSourceDocument: _initialFieldSourceDocument(incoming),
      };
      periods.push(newPeriod);
      history.servicePeriods = periods;
      // N9b: this document just produced a genuinely NEW period - persist
      // that count now, at save time, rather than ever recomputing it from
      // current state (see _hasProvenLink).
      if (incoming.sourceDocument) {
        history.documentPeriodCounts = {
          ...history.documentPeriodCounts,
          [incoming.sourceDocument]:
            (history.documentPeriodCounts?.[incoming.sourceDocument] || 0) + 1,
        };
      }
      _absorbUnmatchedRecords(history);
      saveServiceHistory(history);
      return newPeriod.id;
    }

    const existing = periods[existingIndex];
    if (existing.userEdited) {
      // Never overwrite a period the user has manually edited.
      return existing.id;
    }

    periods[existingIndex] = _mergeExistingServicePeriod(
      existing,
      incoming,
      options,
    );
    history.servicePeriods = periods;
    _absorbUnmatchedRecords(history);
    saveServiceHistory(history);
    return existing.id;
  } catch (error) {
    console.error("Error upserting service period:", error);
    return null;
  }
};

/**
 * Manually add a service period (Profile tab editor). Always userEdited.
 * ADR-007: a supplied start date is always the veteran's own - saveServiceHistory's
 * own projection (not a mirror call here) keeps the flat profile/dd214Data
 * copies in sync.
 */
export const addServicePeriod = (period) => {
  try {
    const history = getServiceHistory();
    const iso = period.serviceStartDate
      ? parseExplicitDate(period.serviceStartDate)
      : null;
    const newPeriod = {
      id: `period_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userEdited: true,
      ...period,
      serviceStartDate: iso,
      serviceStartDateSource: iso ? "veteran" : null,
      serviceStartDateDerived: false,
      startDateCorrection: null,
    };
    history.servicePeriods.push(newPeriod);
    saveServiceHistory(history);
    return newPeriod.id;
  } catch (error) {
    console.error("Error adding service period:", error);
    return null;
  }
};

/**
 * Manually update a service period (Profile tab editor). Marks it
 * userEdited so ingest never overwrites it again. ADR-007: a start-date
 * edit routes through _applyStartCorrection (the same corrections layer
 * setServiceEntryDate uses) rather than being spread in generically, so it
 * always gets real provenance instead of silently becoming an unmarked
 * "printed" value.
 */
export const updateServicePeriod = (periodId, updates) => {
  try {
    const history = getServiceHistory();
    const index = history.servicePeriods.findIndex((p) => p.id === periodId);
    if (index === -1) return false;

    const { serviceStartDate, ...rest } = updates;
    delete rest.serviceStartDateDerived;
    delete rest.serviceStartDateSource;
    delete rest.startDateCorrection;

    let period = {
      ...history.servicePeriods[index],
      ...rest,
      userEdited: true,
    };
    let supersededValue;

    if ("serviceStartDate" in updates) {
      const currentEffective = history.servicePeriods[index].serviceStartDate;
      if (
        !serviceStartDate ||
        !isSameCalendarDay(serviceStartDate, currentEffective)
      ) {
        supersededValue = currentEffective;
        const result = _applyStartCorrection(
          period,
          serviceStartDate || "",
          "my_packet",
        );
        period = result.period;
      }
    }

    history.servicePeriods[index] = period;
    return saveServiceHistory(history, { supersededValue });
  } catch (error) {
    console.error("Error updating service period:", error);
    return false;
  }
};

// ADR-007 §11.2: removing a period can retarget the resolved entry onto a
// different, unrelated period. Without supersededValue, that surviving
// period's own flat-mirror/dd214Data projection (this save's own prior
// output, one cycle stale) reads back as unrecognized legacy data and rules
// A/B silently adopt the just-deleted date as a veteran correction.
export const removeServicePeriod = (periodId) => {
  try {
    const history = getServiceHistory();
    const supersededValue = pickServiceEntry(history.servicePeriods).date;
    history.servicePeriods = history.servicePeriods.filter(
      (p) => p.id !== periodId,
    );
    return saveServiceHistory(history, { supersededValue });
  } catch (error) {
    console.error("Error removing service period:", error);
    return false;
  }
};

export const clearServicePeriods = () => {
  try {
    const history = getServiceHistory();
    history.servicePeriods = [];
    return saveServiceHistory(history);
  } catch (error) {
    console.error("Error clearing service periods:", error);
    return false;
  }
};

const PAY_GRADE_CATEGORY_BASE = { E: 0, W: 100, O: 200 };

function _payGradeRank(payGrade) {
  if (!payGrade) return -1;
  const match = /([EOW])-?(\d+)/i.exec(String(payGrade));
  if (!match) return -1;
  const category = match[1].toUpperCase();
  const level = Number.parseInt(match[2], 10);
  return (PAY_GRADE_CATEGORY_BASE[category] ?? 0) + level;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// D-B (final10 QA correctness re-review, 2026-09-26): a DD214's own
// serviceEndDate is a day of service, not the day service stopped - a
// [start, end) interval treated it as excluded, so a single-day period
// (start === end) counted as zero-length, and two DD214s that legitimately
// chain (one ends the day before the next begins) each lost a real day
// instead of forming one continuous span. +1 day makes `end` exclusive of
// the day AFTER the printed end date instead, so the printed date itself
// is counted and two periods that chain end-to-start-next-day now touch
// (and merge) exactly like one continuous span would.
function _periodInterval(period) {
  if (!period.serviceStartDate || !period.serviceEndDate) return null;
  const start = new Date(`${period.serviceStartDate}T00:00:00`).getTime();
  const end =
    new Date(`${period.serviceEndDate}T00:00:00`).getTime() + MS_PER_DAY;
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return { start, end };
}

/**
 * D-B (final10 QA, 2026-09-25): summing every period's own duration
 * double-counts any time covered by more than one period at once - a
 * dated enclosing enlistment period plus its own Box 18 activation
 * windows, most visibly. Sorts periods by start date and merges any
 * overlapping or touching (adjacent) intervals before summing, so
 * overlapped time is only ever counted once no matter how many periods
 * describe it. A period with no start AND end date (or one whose dates
 * don't parse into a real positive-length interval) has nothing to place
 * on this timeline and is skipped entirely, not estimated from its own
 * self-reported yearsService/monthsService/daysService.
 */
function _unionDurationDays(periods) {
  const intervals = periods
    .map(_periodInterval)
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  let totalMs = 0;
  let current = null;
  intervals.forEach((interval) => {
    if (!current) {
      current = { ...interval };
    } else if (interval.start <= current.end) {
      current.end = Math.max(current.end, interval.end);
    } else {
      totalMs += current.end - current.start;
      current = { ...interval };
    }
  });
  if (current) totalMs += current.end - current.start;

  return totalMs / MS_PER_DAY;
}

function _formatDurationFromDays(totalDays) {
  const years = Math.floor(totalDays / 365.25);
  const remainderDays = totalDays - years * 365.25;
  const months = Math.floor(remainderDays / 30.44);
  const days = Math.round(remainderDays - months * 30.44);
  const parts = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (days > 0 || parts.length === 0) {
    parts.push(`${days} day${days === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

function _highestPayGradeAcross(sources) {
  return sources.filter(Boolean).reduce((best, pg) => {
    if (!best) return pg;
    return _payGradeRank(pg) > _payGradeRank(best) ? pg : best;
  }, null);
}

/**
 * Summary view computed from the canonical servicePeriods[] array (Q2):
 * branches served (deduped), Total time in service (SUM of each period's
 * own duration) AND Service span (earliest entry → latest separation),
 * shown separately since they answer different questions for a
 * multi-period veteran with a break in service. Also surfaces highest
 * pay grade, most recent rank, and character of service from the most
 * recent period (flagged if periods disagree).
 *
 * N3 (final8 QA, 2026-09-24): `extra.unmatchedRecords`/`extra.dd214Data`
 * feed Highest Pay Grade too - a pay grade that lived on a row merged away
 * (or one that only ever reached unmatchedServiceRecords/dd214Data, never
 * a period) must not show as N/A when it's really known.
 */
// ADR-007: the Service tab's span start is now the SAME resolver every
// other consumer uses (pickServiceEntry), so it can never disagree with the
// AI prompt/dossier/VKB over which period "when did service begin" actually
// is. pickServiceEntry excludes windows; only fall back to the old
// earliest-start-including-windows reduce when it has nothing at all (e.g.
// every period here is itself a window).
function _resolveSpanStart(list) {
  const entry = pickServiceEntry(list);
  if (entry.date) {
    return {
      start: entry.date,
      startDerived: entry.derived,
      startSource: entry.source,
    };
  }
  const startPeriod = list
    .filter((p) => p.serviceStartDate)
    .reduce(
      (earliest, p) =>
        !earliest || p.serviceStartDate < earliest.serviceStartDate
          ? p
          : earliest,
      null,
    );
  return {
    start: startPeriod?.serviceStartDate || null,
    startDerived: !!startPeriod?.serviceStartDateDerived,
    startSource: startPeriod ? periodStartSource(startPeriod) : null,
  };
}

export const summarizeServicePeriods = (periods, extra = {}) => {
  const { unmatchedRecords = [], dd214Data = null } = extra;
  const list = Array.isArray(periods) ? periods : [];
  const highestPayGrade = _highestPayGradeAcross([
    ...list.map((p) => p.payGrade),
    ...(Array.isArray(unmatchedRecords)
      ? unmatchedRecords.map((r) => r.payGrade)
      : []),
    dd214Data?.payGrade,
  ]);

  if (list.length === 0) {
    return {
      branches: [],
      totalTimeInService: null,
      serviceSpan: null,
      highestPayGrade,
      mostRecentRank: null,
      characterOfService: null,
      characterOfServiceDisagrees: false,
    };
  }

  const branches = [...new Set(list.map((p) => p.branch).filter(Boolean))];

  const totalDays = _unionDurationDays(list);
  const totalTimeInService =
    totalDays > 0 ? _formatDurationFromDays(totalDays) : null;

  const startDates = list.map((p) => p.serviceStartDate).filter(Boolean);
  const endDates = list.map((p) => p.serviceEndDate).filter(Boolean);
  const serviceSpan =
    startDates.length > 0 || endDates.length > 0
      ? {
          ..._resolveSpanStart(list),
          end: endDates.toSorted((a, b) => a.localeCompare(b)).at(-1) || null,
        }
      : null;

  // Most recent = latest serviceEndDate (fall back to latest
  // serviceStartDate for an open/incomplete final period).
  const sortedMostRecentFirst = [...list].sort((a, b) => {
    const aKey = a.serviceEndDate || a.serviceStartDate || "";
    const bKey = b.serviceEndDate || b.serviceStartDate || "";
    return bKey.localeCompare(aKey);
  });
  const mostRecentRank =
    sortedMostRecentFirst.find((p) => p.rank)?.rank || null;

  // N12 (final9 QA, 2026-09-25), extended by D-F (final10 QA, 2026-09-25):
  // two periods whose characterOfService only differs by case, incidental
  // whitespace, or punctuation/hyphenation ("GENERAL - UNDER..." vs
  // "GENERAL UNDER...") are the same real value, not a disagreement -
  // shares _normalizeForComparison with _mergeExistingServicePeriod's own
  // conflict check (_valuesConflict) so OCR noise can't manufacture a
  // second, distinct entry in the Set below.
  const charactersOfService = [
    ...new Set(
      list
        .map((p) => p.characterOfService)
        .filter(Boolean)
        .map(_normalizeForComparison),
    ),
  ];
  const characterOfService =
    sortedMostRecentFirst.find((p) => p.characterOfService)
      ?.characterOfService || null;
  // N1b: a same-row disagreement recorded by _mergeExistingServicePeriod
  // also counts, not just two different periods each with their own
  // characterOfService - both feed the same "Periods disagree" banner.
  const rowLevelCharacterConflict = list.some((p) =>
    (p.fieldConflicts || []).some((c) => c.field === "characterOfService"),
  );

  return {
    branches,
    totalTimeInService,
    serviceSpan,
    highestPayGrade,
    mostRecentRank,
    characterOfService,
    characterOfServiceDisagrees:
      charactersOfService.length > 1 || rowLevelCharacterConflict,
  };
};

/**
 * The single canonical source for "when did the veteran's service begin",
 * with provenance - see serviceEntryDate.js's pickServiceEntry for the
 * precedence rule (ADR-007). Reads getServiceHistory()'s canonical
 * servicePeriods[] first; falls back to a non-derived flat profile value
 * (a veteran who typed a correction that hasn't reached a period, e.g.
 * FormsHelper before it ever ran the migration/projection), then to the
 * legacy dd214Data.entryDate, then to any other flat value, only when no
 * period has ever been recorded at all.
 * @returns {import('./serviceEntryDate').ServiceEntry}
 */
export const getServiceEntry = () => {
  const history = getServiceHistory();
  const r = pickServiceEntry(history.servicePeriods);
  if (r.date) return r;

  const profile = getVeteranProfile();
  if (
    profile.serviceStartDate &&
    !profile.serviceStartDateDerived &&
    profile.profileFieldSources?.serviceStartDate !== "document" &&
    !isSameCalendarDay(profile.serviceStartDate, history.dd214Data?.entryDate)
  ) {
    return {
      date: profile.serviceStartDate,
      derived: false,
      source: "veteran",
      periodId: null,
    };
  }

  if (history.dd214Data?.entryDate) {
    const derived = !!history.dd214Data.entryDateDerived;
    return {
      date: history.dd214Data.entryDate,
      derived,
      source: derived ? "calculated" : "printed",
      periodId: null,
    };
  }

  if (profile.serviceStartDate) {
    const derived = !!profile.serviceStartDateDerived;
    return {
      date: profile.serviceStartDate,
      derived,
      source: derived ? "calculated" : "printed",
      periodId: null,
    };
  }

  return r;
};

function _isKnownServiceEntryDateIn(history, value) {
  if (!value) return false;
  const periods = [
    ...(history.servicePeriods || []),
    ...(history.unmatchedServiceRecords || []),
  ];
  if (periods.some((p) => isSameCalendarDay(p.serviceStartDate, value))) {
    return true;
  }
  if (
    periods.some((p) =>
      isSameCalendarDay(p.startDateCorrection?.documentDate, value),
    )
  ) {
    return true;
  }
  return periods.some((p) =>
    (p.fieldConflicts || [])
      .filter((c) => c.field === "serviceStartDate")
      .some(
        (c) =>
          isSameCalendarDay(c.keptValue, value) ||
          isSameCalendarDay(c.conflictingValue, value),
      ),
  );
}

function _recordEntryDisagreementInto(history, value, label) {
  const entry = pickServiceEntry(history.servicePeriods);
  if (!entry.periodId) return false;
  const index = history.servicePeriods.findIndex(
    (p) => p.id === entry.periodId,
  );
  if (index === -1) return false;
  const period = history.servicePeriods[index];
  const keptSourceDocument =
    entry.source === "veteran"
      ? "Your correction"
      : period.sourceDocument || "";
  const conflict = {
    field: "serviceStartDate",
    keptValue: period.serviceStartDate,
    keptSourceDocument,
    conflictingValue: value,
    conflictingSourceDocument: label,
    recordedAt: new Date().toISOString(),
  };
  const existing = period.fieldConflicts || [];
  const isDuplicate = existing.some(
    (c) =>
      c.field === "serviceStartDate" &&
      isSameCalendarDay(c.conflictingValue, value) &&
      c.conflictingSourceDocument === label,
  );
  if (isDuplicate) return false;
  history.servicePeriods[index] = {
    ...period,
    fieldConflicts: [...existing, conflict],
  };
  return true;
}

function _adoptLegacyValueOntoPeriod(history, period, iso, via) {
  const index = history.servicePeriods.findIndex((p) => p.id === period.id);
  if (index === -1) return;
  history.servicePeriods[index] = _setPeriodStart(period, iso, "veteran", {
    via,
    correctedAt: history.dateUpdated || new Date().toISOString(),
    documentDate: period.serviceStartDate,
    documentSource: periodStartSource(period),
  });
}

// ADR-007 §11.2, rules A and B: a legacy value (V1 = dd214Data.entryDate,
// V2 = the flat profile field) that predates servicePeriods[] carrying its
// own provenance. Rule A covers a D11-1-era correction that reached
// dd214Data/the flat field but never the period itself (same-document end
// match onto a still-calculated period). Rule B preserves ADR-005's old
// read-time override (a non-derived flat value beating an all-calculated
// history) by converting it into a real correction instead of a
// read-time-only guess. Anything else is recorded as a disagreement so the
// value is never silently dropped (invariant I5).
function _preserveOneLegacyValue(
  history,
  value,
  end,
  label,
  via,
  fieldSource,
  entry,
) {
  const iso = parseExplicitDate(value);
  if (!iso) {
    _recordEntryDisagreementInto(
      history,
      sanitizeString(String(value), 200),
      label,
    );
    return true;
  }

  if (end) {
    const matches = history.servicePeriods.filter(
      (p) =>
        p.periodScope !== "window" && isSameCalendarDay(p.serviceEndDate, end),
    );
    if (
      matches.length === 1 &&
      periodStartSource(matches[0]) === "calculated" &&
      new Date(iso) < new Date(matches[0].serviceEndDate)
    ) {
      _adoptLegacyValueOntoPeriod(history, matches[0], iso, via);
      return true;
    }
  }

  const dd214Entry = history.dd214Data?.entryDate;
  if (
    fieldSource !== "document" &&
    !isSameCalendarDay(value, dd214Entry) &&
    entry.periodId
  ) {
    const nonWindow = history.servicePeriods.filter(
      (p) => p.periodScope !== "window" && p.serviceStartDate,
    );
    const allCalculated =
      nonWindow.length > 0 &&
      nonWindow.every((p) => periodStartSource(p) === "calculated");
    const entryPeriod = history.servicePeriods.find(
      (p) => p.id === entry.periodId,
    );
    if (
      allCalculated &&
      entryPeriod?.serviceEndDate &&
      new Date(iso) < new Date(entryPeriod.serviceEndDate)
    ) {
      _adoptLegacyValueOntoPeriod(history, entryPeriod, iso, "legacy_profile");
      return true;
    }
  }

  _recordEntryDisagreementInto(history, iso, label);
  return true;
}

function _preserveLegacyValueIfUnknown(
  history,
  value,
  derived,
  end,
  label,
  via,
  fieldSource,
  entry,
  supersededValue,
) {
  if (!value || derived) return false;
  if (_isKnownServiceEntryDateIn(history, value)) return false;
  // A value this exact save is deliberately superseding (setServiceEntryDate/
  // updateServicePeriod applying a correction or a revert) is not orphaned
  // legacy data - it's the flat mirror's own last projection, one save-cycle
  // stale by construction (the mirror only catches up in this same call's
  // later _projectProfileMirror step). Without this, reverting a correction
  // would immediately "rediscover" the value it just superseded as an
  // unrecognized disagreement and silently re-apply it - undoing the revert.
  if (isSameCalendarDay(value, supersededValue)) return false;
  return _preserveOneLegacyValue(
    history,
    value,
    end,
    label,
    via,
    fieldSource,
    entry,
  );
}

function _preserveUnprojectedEntryValues(
  history,
  profile,
  entry,
  supersededValue,
) {
  const v1Changed = _preserveLegacyValueIfUnknown(
    history,
    history.dd214Data?.entryDate,
    !!history.dd214Data?.entryDateDerived,
    history.dd214Data?.separationDate,
    "Earlier DD-214 record",
    "legacy_dd214",
    undefined,
    entry,
    supersededValue,
  );
  const v2Changed = _preserveLegacyValueIfUnknown(
    history,
    profile?.serviceStartDate,
    !!profile?.serviceStartDateDerived,
    profile?.serviceEndDate,
    "Your profile (earlier entry)",
    "legacy_profile",
    profile?.profileFieldSources?.serviceStartDate,
    entry,
    supersededValue,
  );
  return v1Changed || v2Changed;
}

// ADR-007 §2.6: raw read-modify-write of the flat profile mirror, run from
// inside saveServiceHistory so every writer of servicePeriods[] converges
// the flat copy - never calls saveVeteranProfile (no recursion into its
// own chokepoint).
function _projectProfileMirror(entry) {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return;
    const profile = JSON.parse(raw);
    const nextSource = entry.source === "veteran" ? "user" : "document";
    const changed =
      profile.serviceStartDate !== entry.date ||
      !!profile.serviceStartDateDerived !== !!entry.derived ||
      profile.profileFieldSources?.serviceStartDate !== nextSource;
    if (!changed) return;
    profile.serviceStartDate = entry.date;
    profile.serviceStartDateDerived = entry.derived;
    profile.profileFieldSources = {
      ...(profile.profileFieldSources || {}),
      serviceStartDate: nextSource,
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    markAsModified();
  } catch (error) {
    console.error("Error projecting service entry into profile:", error);
  }
}

export const saveServiceHistory = (history, { supersededValue } = {}) => {
  try {
    const sanitized = {
      deployments: _sanitizeDeployments(history.deployments),
      awards: _sanitizeAwards(history.awards),
      dd214Data: _sanitizeDd214Data(history.dd214Data),
      serviceInfo: _sanitizeServiceInfo(history.serviceInfo),
      servicePeriods: _sanitizeServicePeriods(history.servicePeriods),
      // Same shape/sanitizer as servicePeriods[] - N1c (final8 QA,
      // 2026-09-24) rows that carry real content but have no proven link
      // to a period, kept in full but never counted/displayed as one.
      unmatchedServiceRecords: _sanitizeServicePeriods(
        history.unmatchedServiceRecords,
      ),
      dutyStations: _sanitizeDutyStations(history.dutyStations),
      documentPeriodCounts: _sanitizeDocumentPeriodCounts(
        history.documentPeriodCounts,
      ),
      // D-A: any regular save (always sourced from a prior getServiceHistory()
      // read) carries forward whatever version that read already resolved.
      // G9 (ADR-007): a save from outside a read (no schemaVersion at all)
      // stores 2, not the current version - the NEXT read then runs the
      // v<3 migration steps rather than silently skipping them.
      schemaVersion:
        typeof history.schemaVersion === "number" ? history.schemaVersion : 2,
      dateUpdated: new Date().toISOString(),
    };

    let entry = pickServiceEntry(sanitized.servicePeriods);
    if (entry.periodId) {
      const profile = getVeteranProfile();
      if (
        _preserveUnprojectedEntryValues(
          sanitized,
          profile,
          entry,
          supersededValue,
        )
      ) {
        entry = pickServiceEntry(sanitized.servicePeriods);
      }
      if (sanitized.dd214Data) {
        sanitized.dd214Data.entryDate = entry.date;
        sanitized.dd214Data.entryDateDerived = entry.derived;
      }
    }

    localStorage.setItem(SERVICE_HISTORY_KEY, JSON.stringify(sanitized));
    if (entry.periodId) {
      _projectProfileMirror(entry);
    }
    return true;
  } catch (error) {
    console.error("Error saving service history:", error);
    return false;
  }
};

/**
 * ADR-007 §2.5: the ONE write API every service-entry-date editor routes
 * through - the Muster Call review modal, the VKB viewer, My Packet, and
 * FormsHelper. Applies a veteran's own correction (or a revert, on an
 * empty value) to the period identified by periodId/sourceDocument/the
 * current entry, or to the flat profile field when no period exists yet.
 * @returns {{ok: boolean, periodId: string|null, reason?: string}}
 */
export const setServiceEntryDate = ({
  date,
  via,
  periodId,
  sourceDocument,
  documentStartDate,
  documentEndDate,
  noPeriod = false,
} = {}) => {
  if (!SERVICE_ENTRY_VIAS.includes(via)) {
    return { ok: false, periodId: null, reason: "invalid_via" };
  }

  const isRevert = date === "" || date === null || date === undefined;
  let iso = null;
  if (!isRevert) {
    iso = parseExplicitDate(date);
    if (!iso) return { ok: false, periodId: null, reason: "invalid_date" };
  }

  const history = getServiceHistory();
  const nonWindowPeriods = history.servicePeriods.filter(
    (p) => p.periodScope !== "window",
  );

  // noPeriod: an explicit "no period backs this edit" signal (e.g. a
  // DD214Analyzer import that wasn't eligible for a period). Without it,
  // the resolver's no-periodId/no-sourceDocument branch falls back to
  // whatever period the entry currently resolves to - fine for an editor
  // generically correcting "the" service entry, wrong for a document-scoped
  // edit that never proved a link to any existing period (standing
  // decision 3).
  const target = noPeriod
    ? { id: null }
    : _resolveServiceEntryTarget(history, nonWindowPeriods, {
        periodId,
        sourceDocument,
        documentStartDate,
        documentEndDate,
      });
  if (target.reason) return target;
  const targetId = target.id;

  if (!targetId) {
    const ok = updateVeteranProfile({
      serviceStartDate: iso || "",
      serviceStartDateDerived: false,
      profileFieldSources: {
        ...(getVeteranProfile().profileFieldSources || {}),
        serviceStartDate: "user",
      },
    });
    return { ok, periodId: null };
  }

  const index = history.servicePeriods.findIndex((p) => p.id === targetId);
  const supersededValue = history.servicePeriods[index].serviceStartDate;
  const { period, changed, reason } = _applyStartCorrection(
    history.servicePeriods[index],
    iso,
    via,
  );
  if (!changed) return { ok: false, periodId: targetId, reason };
  history.servicePeriods[index] = period;
  saveServiceHistory(history, { supersededValue });
  return { ok: true, periodId: targetId };
};

function _resolveServiceEntryTarget(
  history,
  nonWindowPeriods,
  { periodId, sourceDocument, documentStartDate, documentEndDate },
) {
  if (periodId) {
    const found = nonWindowPeriods.find((p) => p.id === periodId);
    return found
      ? { id: found.id }
      : { ok: false, periodId: null, reason: "period_not_found" };
  }
  if (sourceDocument) {
    let candidates = nonWindowPeriods.filter((p) =>
      documentSources(p).includes(sourceDocument),
    );
    if (documentStartDate || documentEndDate) {
      candidates = candidates.filter((p) => {
        const startMatches =
          !documentStartDate ||
          isSameCalendarDay(p.serviceStartDate, documentStartDate) ||
          isSameCalendarDay(
            p.startDateCorrection?.documentDate,
            documentStartDate,
          );
        const endMatches =
          !documentEndDate ||
          isSameCalendarDay(p.serviceEndDate, documentEndDate);
        return startMatches && endMatches;
      });
    }
    if (candidates.length !== 1) {
      return { ok: false, periodId: null, reason: "no_period_for_document" };
    }
    return { id: candidates[0].id };
  }
  return { id: pickServiceEntry(history.servicePeriods).periodId };
}

/**
 * Recorded when a document (or a restored backup) disagrees with the
 * canonical entry date without proof it's the same period - never silently
 * dropped (invariant I5), never applied as a correction. No-op when no
 * period backs the entry.
 */
export const recordServiceEntryDisagreement = (value, label) => {
  const history = getServiceHistory();
  const changed = _recordEntryDisagreementInto(history, value, label);
  if (changed) saveServiceHistory(history);
  return changed;
};

/**
 * True when `value` is already accounted for somewhere in the canonical
 * record - a period start, a correction's documentDate, or a recorded
 * fieldConflicts value - so a caller (the migration guard, VKB adoption)
 * never re-surfaces the same disagreement twice.
 */
export const isKnownServiceEntryDate = (value) =>
  _isKnownServiceEntryDateIn(getServiceHistory(), value);

export const hasPeriodBackedServiceEntry = () =>
  !!pickServiceEntry(getServiceHistory().servicePeriods).periodId;

/**
 * The entry date as recorded specifically by `fileName` - distinct from
 * getServiceEntry()'s overall winner, which may be a different enlistment
 * entirely. Returns null unless exactly one non-window period is proven to
 * come from this document (never guesses across an ambiguous match).
 */
export const getServiceEntryForDocument = (fileName) => {
  const periods = getServiceHistory().servicePeriods.filter(
    (p) => p.periodScope !== "window" && documentSources(p).includes(fileName),
  );
  if (periods.length !== 1) return null;
  const p = periods[0];
  const source = periodStartSource(p);
  return {
    date: p.serviceStartDate,
    derived: source === "calculated",
    source,
    periodId: p.id,
    documentDate: p.startDateCorrection?.documentDate ?? null,
    documentSource: p.startDateCorrection?.documentSource ?? null,
  };
};

/**
 * Add a deployment
 * @param {Object} deployment - Deployment data
 * @returns {string|null} New deployment ID or null on error
 */
export const addDeployment = (deployment) => {
  try {
    const history = getServiceHistory();
    const newDeployment = {
      id: `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      theater: VALID_THEATERS.has(deployment.theater)
        ? deployment.theater
        : "Other",
      location: sanitizeString(deployment.location || "", 200),
      startDate: deployment.startDate || null,
      endDate: deployment.endDate || null,
      unit: sanitizeString(deployment.unit || "", 200),
      notes: sanitizeString(deployment.notes || "", 1000),
      hazardous: !!deployment.hazardous,
      combat: !!deployment.combat,
      dateAdded: new Date().toISOString(),
      periodId: deployment.periodId || null,
    };

    history.deployments.push(newDeployment);
    saveServiceHistory(history);
    return newDeployment.id;
  } catch (error) {
    console.error("Error adding deployment:", error);
    return null;
  }
};

/**
 * Update a deployment
 * @param {string} deploymentId - The deployment ID
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success status
 */
export const updateDeployment = (deploymentId, updates) => {
  try {
    const history = getServiceHistory();
    const index = history.deployments.findIndex((d) => d.id === deploymentId);
    if (index === -1) return false;

    history.deployments[index] = {
      ...history.deployments[index],
      ...updates,
      dateUpdated: new Date().toISOString(),
    };

    return saveServiceHistory(history);
  } catch (error) {
    console.error("Error updating deployment:", error);
    return false;
  }
};

/**
 * Remove a deployment
 * @param {string} deploymentId - The deployment ID
 * @returns {boolean} Success status
 */
export const removeDeployment = (deploymentId) => {
  try {
    const history = getServiceHistory();
    history.deployments = history.deployments.filter(
      (d) => d.id !== deploymentId,
    );
    return saveServiceHistory(history);
  } catch (error) {
    console.error("Error removing deployment:", error);
    return false;
  }
};

// ============================================================================
// DUTY STATIONS - user-entered locations, one-to-many by reference into
// servicePeriods[] (periodId, null = unassigned). Mirrors the servicePeriods
// CRUD contract: fields aren't sanitized inline here, saveServiceHistory's
// _sanitizeDutyStations does that centrally on every write. No upsert - no
// document-ingest path writes duty stations, only the veteran does.
// ============================================================================

export const getDutyStations = () => getServiceHistory().dutyStations;

export const addDutyStation = (station) => {
  try {
    const history = getServiceHistory();
    // saveServiceHistory silently truncates to MAX_DUTY_STATIONS via
    // _sanitizeDutyStations, so a push past the cap would be discarded on
    // save while this function still reported success. Reject up front
    // instead.
    if (history.dutyStations.length >= MAX_DUTY_STATIONS) {
      console.error(
        `Cannot add duty station: limit of ${MAX_DUTY_STATIONS} reached`,
      );
      return null;
    }
    const newStation = {
      id: `duty_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dateAdded: new Date().toISOString(),
      ...station,
    };
    history.dutyStations.push(newStation);
    saveServiceHistory(history);
    return newStation.id;
  } catch (error) {
    console.error("Error adding duty station:", error);
    return null;
  }
};

export const updateDutyStation = (stationId, updates) => {
  try {
    const history = getServiceHistory();
    const index = history.dutyStations.findIndex((s) => s.id === stationId);
    if (index === -1) return false;

    history.dutyStations[index] = {
      ...history.dutyStations[index],
      ...updates,
    };
    return saveServiceHistory(history);
  } catch (error) {
    console.error("Error updating duty station:", error);
    return false;
  }
};

export const removeDutyStation = (stationId) => {
  try {
    const history = getServiceHistory();
    history.dutyStations = history.dutyStations.filter(
      (s) => s.id !== stationId,
    );
    return saveServiceHistory(history);
  } catch (error) {
    console.error("Error removing duty station:", error);
    return false;
  }
};

/**
 * Add an award
 * @param {Object} award - Award data
 * @returns {string|null} New award ID or null on error
 */
export const addAward = (award) => {
  try {
    const history = getServiceHistory();
    const normalizedName = (award.name || "").trim().toLowerCase();
    // Multiple source documents (e.g. several DD214 copies of the same
    // career) commonly describe the same award - dedupe by normalized name
    // instead of pushing a new entry every call, merging in whichever
    // fields the new call fills in that the existing entry was missing.
    const existing = history.awards.find(
      (a) => (a.name || "").trim().toLowerCase() === normalizedName,
    );

    if (existing) {
      existing.dateReceived =
        existing.dateReceived || award.dateReceived || null;
      existing.notes = existing.notes || sanitizeString(award.notes || "", 500);
      existing.isCombat = existing.isCombat || !!award.isCombat;
      // FIX-4: merge in any new structured devices, deduped by
      // type+position so multiple devices of the same type at different
      // positions (e.g. two bronze oak leaf clusters) aren't collapsed.
      if (Array.isArray(award.devices) && award.devices.length > 0) {
        const sanitizedNew = _sanitizeDeviceList(award.devices);
        const existingDevices = new Set(
          (existing.devices || []).map((d) => `${d.type}|${d.position}`),
        );
        sanitizedNew.forEach((d) => {
          const key = `${d.type}|${d.position}`;
          if (!existingDevices.has(key)) {
            existing.devices = existing.devices || [];
            existing.devices.push(d);
            existingDevices.add(key);
          }
        });
      }
      saveServiceHistory(history);
      return existing.id;
    }

    const newAward = {
      id: `award_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: sanitizeString(award.name || "", 200),
      abbreviation: sanitizeString(award.abbreviation || "", 50),
      dateReceived: award.dateReceived || null,
      notes: sanitizeString(award.notes || "", 500),
      isCombat: !!award.isCombat,
      // FIX-4: structured {type, position} objects, NOT flattened display
      // name strings - VisualRibbon switches on device.type.
      devices: _sanitizeDeviceList(award.devices),
      dateAdded: new Date().toISOString(),
    };

    history.awards.push(newAward);
    saveServiceHistory(history);
    return newAward.id;
  } catch (error) {
    console.error("Error adding award:", error);
    return null;
  }
};

/**
 * Remove an award
 * @param {string} awardId - The award ID
 * @returns {boolean} Success status
 */
export const removeAward = (awardId) => {
  try {
    const history = getServiceHistory();
    history.awards = history.awards.filter((a) => a.id !== awardId);
    return saveServiceHistory(history);
  } catch (error) {
    console.error("Error removing award:", error);
    return false;
  }
};

/**
 * Save DD214 extracted data
 * Includes sensitive PII fields for form autofill (SSN, service number, etc.)
 * ⚠️ SECURITY: All data is stored LOCALLY ONLY using encrypted localStorage
 * @param {Object} dd214Data - Extracted DD214 information
 * @returns {boolean} Success status
 */
function _dd214PersonalFields(d) {
  // === Personal Identification (SENSITIVE) ===
  return {
    fullName: sanitizeString(d.fullName || "", 200),
    // FIX-19 (2026-08-04): which form type (DD214/NGB22/DD256/DD257)
    // actually supplied fullName - see _sanitizeDd214DataWhitelisted's
    // matching field below (saveDD214Data's write path passes through
    // BOTH whitelists: this one via saveDD214Data itself, then
    // _sanitizeDd214Data again inside saveServiceHistory).
    fullNameSourceForm: sanitizeString(d.fullNameSourceForm || "", 20),
    lastName: sanitizeString(d.lastName || "", 100),
    firstName: sanitizeString(d.firstName || "", 100),
    middleName: sanitizeString(d.middleName || "", 100),
    ssnLast4: sanitizeString(d.ssnLast4 || "", 4), // Only last 4 digits
    ssnFull: sanitizeString(d.ssnFull || "", 11), // Full SSN if user opts in
    serviceNumber: sanitizeString(d.serviceNumber || "", 50),
    dateOfBirth: d.dateOfBirth || null,
    placeOfBirth: sanitizeString(d.placeOfBirth || "", 200),
    homeOfRecord: sanitizeString(d.homeOfRecord || "", 300),
  };
}

function _dd214ServiceFields(d) {
  // === Service Information ===
  return {
    branch: sanitizeString(d.branch || "", 100),
    component: sanitizeString(d.component || "", 50),
    componentFull: sanitizeString(d.componentFull || "", 100),
    rank: sanitizeString(d.rank || "", 100),
    payGrade: sanitizeString(d.payGrade || "", 10),
    dateOfRank: d.dateOfRank || null,
    mos: sanitizeString(d.mos || "", 200),
    mosTitle: sanitizeString(d.mosTitle || "", 200),
    primarySpecialty: sanitizeString(d.primarySpecialty || "", 200),
    lastDutyAssignment: sanitizeString(d.lastDutyAssignment || "", 500),
    commandTransferredTo: sanitizeString(d.commandTransferredTo || "", 500),
  };
}

function _dd214DateFields(d) {
  // === Dates and Service Time ===
  return {
    entryDate: d.entryDate || null,
    // D-C (final10 QA, 2026-09-25): see _sanitizeDd214DataCore's matching
    // field - saveDD214Data's write path passes through both sanitizers.
    entryDateDerived: !!d.entryDateDerived,
    separationDate: d.separationDate || null,
    netActiveService: d.netActiveService || null,
    totalPriorActiveService: d.totalPriorActiveService || null,
    totalPriorInactiveService: d.totalPriorInactiveService || null,
    yearsService: d.yearsService || null,
    monthsService: d.monthsService || null,
    daysService: d.daysService || null,
    totalActiveDutyDays: d.totalActiveDutyDays || null,
  };
}

function _dd214BenefitsFields(d) {
  // === Benefits & Obligations ===
  return {
    sglCoverage: sanitizeString(d.sglCoverage || "", 100),
    giBlStatus: sanitizeString(d.giBlStatus || "", 100),
    reserveObligationDate: d.reserveObligationDate || null,
    daysLost: d.daysLost || null,
    // Tri-state: keep "not extracted" (null) distinct from a confirmed
    // "no" (false) instead of coercing both to false.
    foreignService: d.foreignService ?? null,
    foreignServiceDetails: sanitizeString(d.foreignServiceDetails || "", 500),
    seaService: d.seaService || null,
  };
}

function _dd214SeparationFields(d) {
  // === Separation Info ===
  return {
    separationAuthority: sanitizeString(d.separationAuthority || "", 200),
    separationCode: sanitizeString(d.separationCode || "", 50),
    reentryCode: sanitizeString(d.reentryCode || "", 50),
    separationProgramDesignator: sanitizeString(
      d.separationProgramDesignator || "",
      50,
    ),
    separationType: sanitizeString(d.separationType || "", 100),
    characterOfService: sanitizeString(d.characterOfService || "", 100),
    narrativeReason: sanitizeString(d.narrativeReason || "", 500),
  };
}

function _dd214MiscFields(d) {
  return {
    // === Education & Training ===
    militaryEducation: Array.isArray(d.militaryEducation)
      ? d.militaryEducation
      : [],
    memberRequests: sanitizeString(d.memberRequests || "", 500),

    // === Contact ===
    homeAddress: sanitizeString(d.homeAddress || "", 500),

    // === Combat & Qualifications ===
    combatService: d.combatService || null,
    specialQualifications: Array.isArray(d.specialQualifications)
      ? d.specialQualifications
      : [],
    securityClearance: sanitizeString(d.securityClearance || "", 100),

    // === Legacy ===
    reenlisted: !!d.reenlisted,

    // === Metadata ===
    extractedText: sanitizeString(d.extractedText || "", 10000),
    dd214Count: d.dd214Count || 1,
    dateProcessed: new Date().toISOString(),
    sensitiveDataStored: !!(d.ssnFull || d.serviceNumber), // Flag if PII present
    confidence: typeof d.confidence === "number" ? d.confidence : 0,
  };
}

export const saveDD214Data = (dd214Data) => {
  try {
    const history = getServiceHistory();
    history.dd214Data = {
      ..._dd214PersonalFields(dd214Data),
      ..._dd214ServiceFields(dd214Data),
      ..._dd214DateFields(dd214Data),
      ..._dd214BenefitsFields(dd214Data),
      ..._dd214SeparationFields(dd214Data),
      ..._dd214MiscFields(dd214Data),
    };
    return saveServiceHistory(history);
  } catch (error) {
    console.error("Error saving DD214 data:", error);
    return false;
  }
};

/**
 * Clear DD214 data
 * @returns {boolean} Success status
 */
export const clearDD214Data = () => {
  try {
    const history = getServiceHistory();
    history.dd214Data = null;
    return saveServiceHistory(history);
  } catch (error) {
    console.error("Error clearing DD214 data:", error);
    return false;
  }
};

/**
 * Check if user has service history data
 * @returns {boolean}
 */
export const hasServiceHistory = () => {
  const history = getServiceHistory();
  return (
    history.deployments?.length > 0 ||
    history.awards?.length > 0 ||
    history.dd214Data !== null
  );
};

// ============================================================================
// CONTINUITY THREAD - Timeline Events Storage
// ============================================================================

const TIMELINE_EVENTS_KEY = "vet_rate_timeline_events";

/**
 * Get all timeline events
 * @returns {Array} Array of timeline events
 */
export const getTimelineEvents = () => {
  try {
    const saved = localStorage.getItem(TIMELINE_EVENTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Error reading timeline events:", error);
    return [];
  }
};

/**
 * Save all timeline events
 * @param {Array} events - Array of timeline events
 * @returns {boolean} Success status
 */
export const saveTimelineEvents = (events) => {
  try {
    if (!Array.isArray(events)) return false;

    const sanitizedEvents = events.map((e) => ({
      id: e.id || Date.now(),
      type: sanitizeString(e.type || "service", 50),
      date: e.date || null,
      title: sanitizeString(e.title || "", 200),
      description: sanitizeString(e.description || "", 1000),
      category: sanitizeString(e.category || "Event", 100),
      dateAdded: e.dateAdded || new Date().toISOString(),
      // D-C (final10 QA, 2026-09-25): a VKB-imported event's eventType
      // (e.g. "guard_enlistment") - EvidenceTimeline.jsx's own gap
      // detection needs it to survive a save/reload round-trip.
      eventType: e.eventType ? sanitizeString(e.eventType, 50) : null,
      // ADR-007: the VKB projection's projectionKey ('entry:<periodId>'),
      // if this local copy was imported from a projected VKB event -
      // EvidenceTimeline's re-import dedup needs it to survive a
      // save/reload round-trip too.
      sourceKey: e.sourceKey ? sanitizeString(e.sourceKey, 200) : null,
    }));

    localStorage.setItem(TIMELINE_EVENTS_KEY, JSON.stringify(sanitizedEvents));
    return true;
  } catch (error) {
    console.error("Error saving timeline events:", error);
    return false;
  }
};

/**
 * Add a timeline event
 * @param {Object} event - Event data
 * @returns {number|null} New event ID or null on error
 */
export const addTimelineEvent = (event) => {
  try {
    const events = getTimelineEvents();
    const newEvent = {
      id: Date.now(),
      type: sanitizeString(event.type || "service", 50),
      date: event.date || null,
      title: sanitizeString(event.title || "", 200),
      description: sanitizeString(event.description || "", 1000),
      category: sanitizeString(event.category || "Event", 100),
      dateAdded: new Date().toISOString(),
    };

    events.push(newEvent);
    localStorage.setItem(TIMELINE_EVENTS_KEY, JSON.stringify(events));
    return newEvent.id;
  } catch (error) {
    console.error("Error adding timeline event:", error);
    return null;
  }
};

/**
 * Remove a timeline event
 * @param {number} eventId - Event ID
 * @returns {boolean} Success status
 */
export const removeTimelineEvent = (eventId) => {
  try {
    const events = getTimelineEvents();
    const filtered = events.filter((e) => e.id !== eventId);
    localStorage.setItem(TIMELINE_EVENTS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error("Error removing timeline event:", error);
    return false;
  }
};

/**
 * Clear all timeline events
 * @returns {boolean} Success status
 */
export const clearTimelineEvents = () => {
  try {
    localStorage.removeItem(TIMELINE_EVENTS_KEY);
    return true;
  } catch (error) {
    console.error("Error clearing timeline events:", error);
    return false;
  }
};

// ============================================================================
// PAIN PAINTER - Pain Maps Storage
// ============================================================================

const PAIN_MAPS_KEY = "vet_rate_pain_maps";

/**
 * Get all saved pain maps
 * @returns {Array} Array of pain maps
 */
export const getPainMaps = () => {
  try {
    const saved = localStorage.getItem(PAIN_MAPS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Error reading pain maps:", error);
    return [];
  }
};

/**
 * Save a pain map
 * @param {Object} painMap - Pain map data
 * @returns {string|null} New map ID or null on error
 */
const MAX_PAIN_MAP_THUMBNAIL_CHARS = 500 * 1024; // ~500KB base64 data URL

function _sanitizePainMapThumbnail(thumbnail) {
  if (typeof thumbnail !== "string" || !thumbnail.startsWith("data:image/")) {
    return null;
  }
  // Truncating a base64 image mid-stream corrupts it - drop an oversized
  // thumbnail entirely rather than store an unusable partial image.
  if (thumbnail.length > MAX_PAIN_MAP_THUMBNAIL_CHARS) return null;
  return thumbnail;
}

export const savePainMap = (painMap) => {
  try {
    const maps = getPainMaps();
    const newMap = {
      id: `painmap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: sanitizeString(painMap.name || "Pain Map", 200),
      painPoints: painMap.painPoints || {},
      modelConfig: painMap.modelConfig || {},
      notes: sanitizeString(painMap.notes || "", 2000),
      // FIX-8: accept both the legacy field names already used by
      // previously-saved maps (screenshot, detectedNexus) AND the field
      // names PainPainter.jsx actually produces (thumbnail, conditions,
      // nexusLanguage, view, savedAt) - the whitelist previously silently
      // dropped all five of the latter.
      detectedNexus: painMap.detectedNexus || [],
      screenshot: painMap.screenshot || null, // Base64 image (legacy)
      thumbnail: _sanitizePainMapThumbnail(painMap.thumbnail),
      conditions: Array.isArray(painMap.conditions)
        ? painMap.conditions
            .map((c) => sanitizeString(String(c), 200))
            .slice(0, 50)
        : [],
      view: sanitizeString(painMap.view || "", 20),
      nexusLanguage: sanitizeString(painMap.nexusLanguage || "", 5000),
      savedAt: painMap.savedAt || new Date().toISOString(),
      dateSaved: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
    };

    maps.push(newMap);
    localStorage.setItem(PAIN_MAPS_KEY, JSON.stringify(maps));
    return newMap.id;
  } catch (error) {
    if (error?.name === "QuotaExceededError") {
      console.error(
        "Pain map NOT saved - browser storage is full. Export a backup and free up space, then try again.",
      );
    } else {
      console.error("Error saving pain map:", error);
    }
    return null;
  }
};

/**
 * Update a pain map
 * @param {string} mapId - Map ID
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success status
 */
export const updatePainMap = (mapId, updates) => {
  try {
    const maps = getPainMaps();
    const index = maps.findIndex((m) => m.id === mapId);
    if (index === -1) return false;

    maps[index] = {
      ...maps[index],
      ...updates,
      dateUpdated: new Date().toISOString(),
    };

    localStorage.setItem(PAIN_MAPS_KEY, JSON.stringify(maps));
    return true;
  } catch (error) {
    console.error("Error updating pain map:", error);
    return false;
  }
};

/**
 * Delete a pain map
 * @param {string} mapId - Map ID
 * @returns {boolean} Success status
 */
export const deletePainMap = (mapId) => {
  try {
    const maps = getPainMaps();
    const filtered = maps.filter((m) => m.id !== mapId);
    localStorage.setItem(PAIN_MAPS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error("Error deleting pain map:", error);
    return false;
  }
};

/**
 * Clear all pain maps
 * @returns {boolean} Success status
 */
export const clearPainMaps = () => {
  try {
    localStorage.removeItem(PAIN_MAPS_KEY);
    return true;
  } catch (error) {
    console.error("Error clearing pain maps:", error);
    return false;
  }
};

// Default export - must be at the end after all functions are defined
export default {
  // Profile functions
  getVeteranProfile,
  saveVeteranProfile,
  updateVeteranProfile,
  clearVeteranProfile,
  hasVeteranProfile,
  getFullName,
  getShowStateAwards,
  setShowStateAwards,
  // Form functions
  getSavedForms,
  saveForm,
  updateSavedForm,
  getSavedForm,
  deleteSavedForm,
  getFormsByType,
  clearAllForms,
  getFormStats,
  // Backup functions
  exportAllVeteranData,
  importVeteranData,
  // Ratings functions
  getMyRatings,
  saveMyRatings,
  addRating,
  updateRating,
  removeRating,
  clearMyRatings,
  hasMyRatings,
  // Service History functions
  getServiceHistory,
  saveServiceHistory,
  addDeployment,
  updateDeployment,
  removeDeployment,
  getDutyStations,
  addDutyStation,
  updateDutyStation,
  removeDutyStation,
  addAward,
  removeAward,
  saveDD214Data,
  clearDD214Data,
  hasServiceHistory,
  // Service Periods functions (canonical multi-period model)
  getServicePeriods,
  getUnmatchedServiceRecords,
  upsertServicePeriod,
  addServicePeriod,
  updateServicePeriod,
  removeServicePeriod,
  clearServicePeriods,
  summarizeServicePeriods,
  getServiceEntry,
  setServiceEntryDate,
  getServiceEntryForDocument,
  hasPeriodBackedServiceEntry,
  isKnownServiceEntryDate,
  recordServiceEntryDisagreement,
  // Timeline Events functions
  getTimelineEvents,
  saveTimelineEvents,
  addTimelineEvent,
  removeTimelineEvent,
  clearTimelineEvents,
  // Pain Maps functions
  getPainMaps,
  savePainMap,
  updatePainMap,
  deletePainMap,
  clearPainMaps,
};
