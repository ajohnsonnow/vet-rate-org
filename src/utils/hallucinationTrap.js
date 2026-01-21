/**
 * Hallucination Trap - AI Output Validator
 * Prevents fake diagnostic codes from being displayed to users
 * 
 * This validator cross-references AI-generated diagnostic codes
 * against the official 38 CFR Part 4 database to ensure accuracy
 */

import disabilityDataJson from '../data/disabilityData.json';

// Extract the disabilities array from the JSON structure
const disabilityData = disabilityDataJson.disabilities || [];

// Build lookup table for O(1) access
const VALID_CODES = new Set(
  disabilityData.map(d => String(d.diagnosticCode))
);

// Build name-to-code mapping for fuzzy matching
const NAME_TO_CODE = new Map();
disabilityData.forEach(d => {
  const normalizedName = d.conditionName.toLowerCase().trim();
  NAME_TO_CODE.set(normalizedName, String(d.diagnosticCode));
});

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
      reason: 'Empty or invalid code'
    };
  }

  const isValid = VALID_CODES.has(codeStr);
  
  if (isValid) {
    // Find the official record
    const official = disabilityData.find(d => String(d.diagnosticCode) === codeStr);
    return {
      isValid: true,
      code: codeStr,
      officialName: official?.conditionName,
      bodySystem: official?.bodySystem,
      officialRecord: official
    };
  }

  return {
    isValid: false,
    code: codeStr,
    reason: 'Code not found in 38 CFR Part 4 database',
    suggestion: findSimilarCodes(codeStr)
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
    .filter(d => {
      const dCode = parseInt(d.diagnosticCode, 10);
      return Math.abs(dCode - codeNum) <= 10;
    })
    .slice(0, 3)
    .map(d => ({
      code: d.diagnosticCode,
      name: d.conditionName
    }));

  return similar;
};

/**
 * Validate an AI-generated condition object
 * @param {Object} condition - Condition from AI
 * @returns {Object} Validation result
 */
export const validateCondition = (condition) => {
  if (!condition || typeof condition !== 'object') {
    return {
      isValid: false,
      reason: 'Invalid condition object',
      original: condition
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
          original: condition
        };
      }
    }

    return {
      isValid: false,
      reason: 'No diagnostic code provided',
      original: condition
    };
  }

  const validation = validateDiagnosticCode(code);
  
  return {
    ...validation,
    original: condition,
    // Override AI's name with official name if code is valid
    ...(validation.isValid && { 
      correctedName: validation.officialName,
      aiName: condition.name
    })
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
      error: 'Input must be an array of conditions',
      safeData: [],
      rejected: []
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
        aiName: condition.name !== validation.officialName ? condition.name : undefined,
        bodySystem: validation.bodySystem,
        validated: true,
        validatedAt: new Date().toISOString()
      });

      // Warn if AI used different name
      if (condition.name && condition.name !== validation.officialName) {
        warnings.push({
          index,
          type: 'name_mismatch',
          aiName: condition.name,
          officialName: validation.officialName,
          code: validation.code
        });
      }
    } else {
      rejected.push({
        ...condition,
        index,
        reason: validation.reason,
        suggestion: validation.suggestion,
        rejectedAt: new Date().toISOString()
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
      successRate: conditions.length > 0 
        ? Math.round((safeData.length / conditions.length) * 100) 
        : 0
    }
  };
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
    if (typeof aiResponse === 'string') {
      // Remove markdown code blocks if present
      const cleaned = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      try {
        data = JSON.parse(cleaned);
      } catch (e) {
        return {
          success: false,
          error: 'Failed to parse AI response as JSON',
          details: e.message,
          safeData: [],
          rejected: []
        };
      }
    }

    // Handle different response formats
    let conditions = [];
    
    if (Array.isArray(data)) {
      conditions = data;
    } else if (data.conditions && Array.isArray(data.conditions)) {
      conditions = data.conditions;
    } else if (data.results && Array.isArray(data.results)) {
      conditions = data.results;
    } else if (typeof data === 'object') {
      // Single condition object
      conditions = [data];
    } else {
      return {
        success: false,
        error: 'Unrecognized AI response format',
        safeData: [],
        rejected: []
      };
    }

    return validateConditions(conditions);

  } catch (error) {
    return {
      success: false,
      error: 'Failed to validate AI response',
      details: error.message,
      safeData: [],
      rejected: []
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
    bodySystems: [...new Set(disabilityData.map(d => d.bodySystem))].length,
    codeRange: {
      min: Math.min(...disabilityData.map(d => parseInt(d.diagnosticCode, 10))),
      max: Math.max(...disabilityData.map(d => parseInt(d.diagnosticCode, 10)))
    }
  };
};

/**
 * Search for conditions by name or code
 * @param {string} query - Search query
 * @param {number} limit - Maximum results
 * @returns {Array} Matching conditions
 */
export const searchConditions = (query, limit = 10) => {
  if (!query || typeof query !== 'string') return [];

  const normalizedQuery = query.toLowerCase().trim();
  const matches = [];

  // Exact code match
  if (VALID_CODES.has(query)) {
    const exact = disabilityData.find(d => String(d.diagnosticCode) === query);
    if (exact) matches.push({ ...exact, matchType: 'exact_code' });
  }

  // Name contains query
  disabilityData.forEach(d => {
    if (matches.length >= limit) return;
    
    const name = d.conditionName.toLowerCase();
    if (name.includes(normalizedQuery) && !matches.some(m => m.diagnosticCode === d.diagnosticCode)) {
      matches.push({ ...d, matchType: 'name_contains' });
    }
  });

  return matches.slice(0, limit);
};

export default {
  validateDiagnosticCode,
  validateCondition,
  validateConditions,
  validateAIResponse,
  getDatabaseStats,
  searchConditions,
  VALID_CODES
};
