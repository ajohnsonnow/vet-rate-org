/**
 * VA Form Validator - Hallucination Prevention System
 *
 * Scans AI outputs for VA form references and validates them against
 * an official allowlist. Prevents the AI from inventing fake forms
 * like the "27-0820" incident identified in community feedback.
 *
 * Note: Form 27-0820/27-0820a ARE real forms (Report of First Notice of Death),
 * but this validator ensures ALL form references are legitimate.
 *
 * @see https://www.va.gov/find-forms/ - Official VA Forms Database
 */

import validFormsData from "../data/validVAForms.json";

// Build flat Set of all valid form numbers for O(1) lookup
const VALID_FORMS = new Set();
const DBQ_PREFIXES = validFormsData.dbqPrefixes || ["21-0960", "DBQ"];

// Flatten all form categories into a single Set
Object.values(validFormsData.forms || {}).forEach((category) => {
  if (category.forms && Array.isArray(category.forms)) {
    category.forms.forEach((form) => VALID_FORMS.add(form.toUpperCase()));
  }
});

// Also add lowercase versions for case-insensitive matching
const VALID_FORMS_LOWER = new Set([...VALID_FORMS].map((f) => f.toLowerCase()));

/**
 * Regex patterns for detecting VA form references in text
 * Matches patterns like: 21-526EZ, 20-0995, VA Form 21-4138, etc.
 */
const FORM_PATTERNS = [
  // Standard VA form pattern: 2 digits + hyphen + 3-5 alphanumerics
  // (case-insensitive /i flag already covers A-Z via a-z, so only one case is listed)
  /\b(\d{2}-\d{3,5}[a-z0-9-]*)\b/gi,
  // SF forms: SF-180, SF-15
  /\b(SF-\d{2,4})\b/gi,
  // Explicit "VA Form" references
  /VA\s+Form\s+(\d{2}-?\d{3,5}[a-z0-9-]*)/gi,
  // SGLV insurance forms
  /\b(SGLV-\d{4})\b/gi,
];

/**
 * Extract all form-like references from text
 * @param {string} text - Text to scan
 * @returns {string[]} Array of form references found
 */
const extractFormReferences = (text) => {
  if (!text || typeof text !== "string") return [];

  const foundForms = new Set();

  FORM_PATTERNS.forEach((pattern) => {
    const matches = text.matchAll(new RegExp(pattern));
    for (const match of matches) {
      // Get the captured group (form number) or full match
      const formRef = (match[1] || match[0]).trim();
      if (formRef) {
        foundForms.add(formRef);
      }
    }
  });

  return [...foundForms];
};

/**
 * Check if a form number is valid
 * @param {string} formNumber - Form number to validate
 * @returns {boolean} True if valid
 */
const isValidForm = (formNumber) => {
  if (!formNumber) return false;

  const normalized = formNumber.toUpperCase().trim();
  const normalizedLower = formNumber.toLowerCase().trim();

  // Exact match in allowlist
  if (VALID_FORMS.has(normalized) || VALID_FORMS_LOWER.has(normalizedLower)) {
    return true;
  }

  // DBQ series exception: 21-0960M-15, 21-0960P-3, etc.
  for (const prefix of DBQ_PREFIXES) {
    if (normalized.startsWith(prefix.toUpperCase())) {
      return true;
    }
  }

  // SF forms are generally valid federal forms
  if (normalized.startsWith("SF-")) {
    return true;
  }

  return false;
};

/**
 * Validate all VA form references in AI-generated text
 *
 * @param {string} text - AI response text to validate
 * @returns {Object} Validation result
 * @returns {boolean} .isValid - True if all forms are valid
 * @returns {string[]} .validForms - List of valid forms found
 * @returns {string[]} .invalidForms - List of hallucinated/fake forms
 * @returns {string} .error - Error message if invalid forms found
 */
export const validateVAForms = (text) => {
  const foundForms = extractFormReferences(text);

  if (foundForms.length === 0) {
    return {
      isValid: true,
      validForms: [],
      invalidForms: [],
      scanned: true,
      message: "No form references detected",
    };
  }

  const validForms = [];
  const invalidForms = [];

  foundForms.forEach((form) => {
    if (isValidForm(form)) {
      validForms.push(form);
    } else {
      invalidForms.push(form);
    }
  });

  const isValid = invalidForms.length === 0;

  return {
    isValid,
    validForms: [...new Set(validForms)],
    invalidForms: [...new Set(invalidForms)],
    scanned: true,
    ...(isValid
      ? {}
      : {
          error: `⚠️ **Safety System Block**\n\nThe AI attempted to reference VA form(s) that do not exist in our validated database: **${invalidForms.join(", ")}**.\n\nTo protect your claim from procedural errors, this response requires review. The forms may be:\n- Typos (check the exact form number)\n- Obsolete forms (some forms are periodically retired)\n- Internal VA forms not available to the public\n\nPlease verify any form numbers at [VA.gov Forms](https://www.va.gov/find-forms/) before using them.`,
        }),
  };
};

/**
 * Wrapper that blocks responses with invalid forms
 * Use this as post-processing on AI outputs
 *
 * @param {string} aiResponse - The AI generated response
 * @returns {Object} { success: boolean, text: string, blocked: boolean }
 */
export const safeFormResponse = (aiResponse) => {
  const validation = validateVAForms(aiResponse);

  if (!validation.isValid) {
    console.error("🚨 Form Hallucination Blocked:", validation.invalidForms);
    return {
      success: false,
      text: validation.error,
      blocked: true,
      invalidForms: validation.invalidForms,
      originalResponse: aiResponse, // Keep for debugging, don't show to user
    };
  }

  return {
    success: true,
    text: aiResponse,
    blocked: false,
    validForms: validation.validForms,
  };
};

/**
 * Get database statistics
 * @returns {Object} Stats about the form database
 */
export const getFormDatabaseStats = () => {
  const categories = Object.keys(validFormsData.forms || {});
  let totalForms = 0;

  categories.forEach((cat) => {
    totalForms += (validFormsData.forms[cat]?.forms || []).length;
  });

  return {
    totalForms,
    categories: categories.length,
    dbqPrefixes: DBQ_PREFIXES,
    lastUpdated: validFormsData._metadata?.lastUpdated || "Unknown",
  };
};

/**
 * Search for a form by partial name/number
 * @param {string} query - Search term
 * @returns {string[]} Matching forms
 */
export const searchForms = (query) => {
  if (!query || typeof query !== "string") return [];

  const normalized = query.toLowerCase().trim();
  const matches = [];

  VALID_FORMS.forEach((form) => {
    if (form.toLowerCase().includes(normalized)) {
      matches.push(form);
    }
  });

  return matches.slice(0, 10); // Limit results
};

export default {
  validateVAForms,
  safeFormResponse,
  getFormDatabaseStats,
  searchForms,
  isValidForm,
  VALID_FORMS,
};
