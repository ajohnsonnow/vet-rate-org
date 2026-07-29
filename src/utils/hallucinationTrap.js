/**
 * Hallucination Trap - AI Output Validator
 * Prevents fake diagnostic codes AND fake VA forms from being displayed to users
 *
 * This validator cross-references AI-generated outputs against:
 * - Official 38 CFR Part 4 diagnostic codes database
 * - Official VA Forms allowlist (added Jan 2026 per community feedback)
 *
 * Why: Community feedback on r/VAClaims identified that AI can "hallucinate"
 * fake form numbers (like "27-0820" used incorrectly) leading to procedural errors.
 */

import { getAllConditions } from "../services/knowledgeQuery";
import { validateVAForms, safeFormResponse } from "./formValidator";

// Re-export form validation for convenience
export { validateVAForms, safeFormResponse };

// Disabilities array, sourced through the unified KB access layer (S30)
const disabilityData = getAllConditions();

// Build lookup table for O(1) access
const VALID_CODES = new Set(
  disabilityData.map((d) => String(d.diagnosticCode)),
);

// Build name-to-code mapping for fuzzy matching
const NAME_TO_CODE = new Map();
disabilityData.forEach((d) => {
  const normalizedName = d.conditionName.toLowerCase().trim();
  NAME_TO_CODE.set(normalizedName, String(d.diagnosticCode));
});

// Fold case, surrounding punctuation, internal whitespace, and a single
// trailing plural "s" so "Tinnitus"/"tinnitus" and "Migraine"/"Migraines"
// resolve to the same key for grounded name→code lookup.
const _normalizeConditionName = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/s$/, "");

// Normalized-name → code index. A key that two DIFFERENT codes normalize to is
// stored as null (ambiguous) so enrichment never guesses which condition an
// extracted name meant.
const NORMALIZED_NAME_TO_CODE = (() => {
  const map = new Map();
  for (const d of disabilityData) {
    const key = _normalizeConditionName(d.conditionName);
    if (!key) continue;
    const code = String(d.diagnosticCode);
    if (map.has(key)) {
      if (map.get(key) !== code) map.set(key, null); // ambiguous
    } else {
      map.set(key, code);
    }
  }
  return map;
})();

/**
 * Grounded exact-name → diagnostic code lookup for enriching model-extracted
 * conditions that carry no code. Returns the DC string ONLY for an unambiguous,
 * normalized-exact match to a 38 CFR Part 4 condition name. Returns null for no
 * match, an ambiguous match, or a multi-condition free-text value (comma /
 * slash / " and " separated list). A wrong code is a hallucination, so anything
 * short of a confident exact match yields null — never a guess.
 * @param {string} name
 * @returns {string|null}
 */
export const lookupDiagnosticCodeByName = (name) => {
  const raw = String(name || "").trim();
  if (!raw) return null;
  // List-form values must never be force-mapped to a single code.
  if (/[,/]|\sand\s/i.test(raw)) return null;
  return NORMALIZED_NAME_TO_CODE.get(_normalizeConditionName(raw)) || null;
};

/**
 * Validate a single diagnostic code
 * @param {string|number} code - Diagnostic code to validate
 * @returns {Object} Validation result
 */
export const validateDiagnosticCode = (code) => {
  const codeStr = String(code).trim();

  if (!codeStr) {
    return {
      isValid: false,
      code: codeStr,
      reason: "Empty or invalid code",
    };
  }

  const isValid = VALID_CODES.has(codeStr);

  if (isValid) {
    // Find the official record
    const official = disabilityData.find(
      (d) => String(d.diagnosticCode) === codeStr,
    );
    return {
      isValid: true,
      code: codeStr,
      officialName: official?.conditionName,
      bodySystem: official?.bodySystem,
      officialRecord: official,
    };
  }

  return {
    isValid: false,
    code: codeStr,
    reason: "Code not found in 38 CFR Part 4 database",
    suggestion: findSimilarCodes(codeStr),
  };
};

/**
 * Find similar diagnostic codes (for typos or close matches)
 * @param {string} code - Input code
 * @returns {Array} Similar codes
 */
const findSimilarCodes = (code) => {
  const codeStr = String(code);
  const codeNum = parseInt(codeStr, 10);

  if (isNaN(codeNum)) return [];

  // Find codes within ±10
  const similar = disabilityData
    .filter((d) => {
      const dCode = parseInt(d.diagnosticCode, 10);
      return Math.abs(dCode - codeNum) <= 10;
    })
    .slice(0, 3)
    .map((d) => ({
      code: d.diagnosticCode,
      name: d.conditionName,
    }));

  return similar;
};

/**
 * Validate an AI-generated condition object
 * @param {Object} condition - Condition from AI
 * @returns {Object} Validation result
 */
export const validateCondition = (condition) => {
  if (!condition || typeof condition !== "object") {
    return {
      isValid: false,
      reason: "Invalid condition object",
      original: condition,
    };
  }

  // Extract diagnostic code (could be in different fields)
  const code = condition.diagnosticCode || condition.code || condition.dc;

  if (!code) {
    // Try to find by name
    if (condition.name) {
      const normalizedName = condition.name.toLowerCase().trim();
      const matchedCode = NAME_TO_CODE.get(normalizedName);

      if (matchedCode) {
        const validation = validateDiagnosticCode(matchedCode);
        return {
          ...validation,
          aiProvidedCode: false,
          inferredFromName: true,
          original: condition,
        };
      }
    }

    return {
      isValid: false,
      reason: "No diagnostic code provided",
      original: condition,
    };
  }

  const validation = validateDiagnosticCode(code);

  return {
    ...validation,
    original: condition,
    // Override AI's name with official name if code is valid
    ...(validation.isValid && {
      correctedName: validation.officialName,
      aiName: condition.name,
    }),
  };
};

/**
 * Validate an array of conditions
 * @param {Array} conditions - Array of conditions from AI
 * @returns {Object} Validation results with safe and rejected items
 */
export const validateConditions = (conditions) => {
  if (!Array.isArray(conditions)) {
    return {
      success: false,
      error: "Input must be an array of conditions",
      safeData: [],
      rejected: [],
    };
  }

  const safeData = [];
  const rejected = [];
  const warnings = [];

  conditions.forEach((condition, index) => {
    const validation = validateCondition(condition);

    if (validation.isValid) {
      safeData.push({
        ...condition,
        diagnosticCode: validation.code,
        // Use official name instead of AI's potentially incorrect name
        name: validation.officialName || condition.name,
        aiName:
          condition.name !== validation.officialName
            ? condition.name
            : undefined,
        bodySystem: validation.bodySystem,
        validated: true,
        validatedAt: new Date().toISOString(),
      });

      // Warn if AI used different name
      if (condition.name && condition.name !== validation.officialName) {
        warnings.push({
          index,
          type: "name_mismatch",
          aiName: condition.name,
          officialName: validation.officialName,
          code: validation.code,
        });
      }
    } else {
      rejected.push({
        ...condition,
        index,
        reason: validation.reason,
        suggestion: validation.suggestion,
        rejectedAt: new Date().toISOString(),
      });
    }
  });

  return {
    success: true,
    safeData,
    rejected,
    warnings,
    stats: {
      total: conditions.length,
      valid: safeData.length,
      invalid: rejected.length,
      successRate:
        conditions.length > 0
          ? Math.round((safeData.length / conditions.length) * 100)
          : 0,
    },
  };
};

/**
 * Annotate AI-extracted conditions with a verification flag against the official
 * 38 CFR diagnostic-code DB, WITHOUT dropping any (unlike validateConditions,
 * which splits safe/rejected). Used for Blue Button report parsing (D-H09): the
 * AI can hallucinate diagnoses, but a real condition that simply isn't in our
 * curated name→code map must still surface — flagged "unverified" — so AI output
 * is never presented to the veteran as VA-confirmed fact. Reads the condition
 * name from `name` or `standardizedName`.
 * @param {Array} conditions - [{ name | standardizedName, ... }]
 * @returns {Array} same objects with { verified: boolean, officialName: string|null }
 */
export const annotateConditionVerification = (conditions) => {
  if (!Array.isArray(conditions)) return [];
  return conditions.map((condition) => {
    const name = condition?.name ?? condition?.standardizedName;
    const validation = validateCondition({ ...condition, name });
    return {
      ...condition,
      verified: validation.isValid === true,
      officialName: validation.isValid ? validation.officialName : null,
    };
  });
};

/**
 * Parse and validate AI response (handles JSON strings or objects)
 * @param {string|Object} aiResponse - Response from AI
 * @returns {Object} Validation results
 */
export const validateAIResponse = (aiResponse) => {
  try {
    let data = aiResponse;

    // If string, try to parse as JSON
    if (typeof aiResponse === "string") {
      // Remove markdown code blocks if present
      const cleaned = aiResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      try {
        data = JSON.parse(cleaned);
      } catch (e) {
        return {
          success: false,
          error: "Failed to parse AI response as JSON",
          details: e.message,
          safeData: [],
          rejected: [],
        };
      }
    }

    // Handle different response formats
    let conditions = [];

    if (Array.isArray(data)) {
      // Check if this array contains condition-like objects (with diagnostic codes)
      // If not, skip validation (e.g., arrays of strings, action items, etc.)
      const hasConditionObjects = data.some(
        (item) =>
          item &&
          typeof item === "object" &&
          (item.diagnosticCode || item.code || item.dc || item.diagnostic_code),
      );

      if (hasConditionObjects || data.length === 0) {
        conditions = data;
      } else {
        // Array doesn't contain diagnostic code objects - pass through unchanged
        return {
          success: true,
          safeData: data,
          rejected: [],
          skipped: true,
          stats: { total: 0, valid: 0, invalid: 0, successRate: 100 },
        };
      }
    } else if (data.conditions && Array.isArray(data.conditions)) {
      conditions = data.conditions;
    } else if (data.results && Array.isArray(data.results)) {
      conditions = data.results;
    } else if (data.potential_claims && Array.isArray(data.potential_claims)) {
      // C-File analyzer format
      conditions = data.potential_claims;
    } else if (typeof data === "object") {
      // Check if this looks like a condition object (has diagnosticCode, code, or dc)
      // If not, it's probably a different response format (like DecisionDecoder)
      // and we should skip validation
      const hasConditionFields =
        data.diagnosticCode || data.code || data.dc || data.diagnostic_code;
      if (hasConditionFields) {
        conditions = [data];
      } else {
        // Not a diagnostic code response - pass through unchanged
        return {
          success: true,
          safeData: data,
          rejected: [],
          skipped: true, // Indicate we skipped validation for non-condition response
          stats: { total: 0, valid: 0, invalid: 0, successRate: 100 },
        };
      }
    } else {
      return {
        success: false,
        error: "Unrecognized AI response format",
        safeData: [],
        rejected: [],
      };
    }

    return validateConditions(conditions);
  } catch (error) {
    return {
      success: false,
      error: "Failed to validate AI response",
      details: error.message,
      safeData: [],
      rejected: [],
    };
  }
};

/**
 * Get statistics about the validation database
 * @returns {Object} Database stats
 */
export const getDatabaseStats = () => {
  return {
    totalCodes: VALID_CODES.size,
    bodySystems: [...new Set(disabilityData.map((d) => d.bodySystem))].length,
    codeRange: {
      min: Math.min(
        ...disabilityData.map((d) => parseInt(d.diagnosticCode, 10)),
      ),
      max: Math.max(
        ...disabilityData.map((d) => parseInt(d.diagnosticCode, 10)),
      ),
    },
  };
};

/**
 * Search for conditions by name or code
 * @param {string} query - Search query
 * @param {number} limit - Maximum results
 * @returns {Array} Matching conditions
 */
export const searchConditions = (query, limit = 10) => {
  if (!query || typeof query !== "string") return [];

  const normalizedQuery = query.toLowerCase().trim();
  const matches = [];

  // Exact code match
  if (VALID_CODES.has(query)) {
    const exact = disabilityData.find(
      (d) => String(d.diagnosticCode) === query,
    );
    if (exact) matches.push({ ...exact, matchType: "exact_code" });
  }

  // Name contains query
  disabilityData.forEach((d) => {
    if (matches.length >= limit) return;

    const name = d.conditionName.toLowerCase();
    if (
      name.includes(normalizedQuery) &&
      !matches.some((m) => m.diagnosticCode === d.diagnosticCode)
    ) {
      matches.push({ ...d, matchType: "name_contains" });
    }
  });

  return matches.slice(0, limit);
};

export default {
  validateDiagnosticCode,
  validateCondition,
  validateConditions,
  annotateConditionVerification,
  validateAIResponse,
  getDatabaseStats,
  searchConditions,
  validateVAForms,
  safeFormResponse,
  VALID_CODES,
};
