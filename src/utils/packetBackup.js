/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Secure Packet Backup Utility
 * Handles secure export/import of claim packet data with validation
 * to prevent code injection and ensure data integrity.
 */

// Valid field names that can exist in a claim object
const VALID_CLAIM_FIELDS = [
  'id', 'conditionName', 'parentCondition', 'dateSaved', 'dateUpdated',
  'status', 'diagnosticCode', 'selectedRating', 'claimType', 'notes'
];

// Valid field names for statement objects
const VALID_STATEMENT_FIELDS = [
  'statement', 'doctorNote', 'savedDate', 'conditionName', 'claimType'
];

// Valid status values
const VALID_STATUSES = ['Drafting', 'Statement Generated', 'Filed'];

// Max string lengths for security
const MAX_STRING_LENGTH = 50000;
const MAX_CONDITION_NAME = 500;
const MAX_ID_LENGTH = 100;

/**
 * Sanitize a string to prevent XSS and injection attacks
 * @param {string} str - The string to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized string
 */
const sanitizeString = (str, maxLength = MAX_STRING_LENGTH) => {
  if (typeof str !== 'string') return '';
  
  // Truncate to max length
  let sanitized = str.slice(0, maxLength);
  
  // Remove potential script tags and event handlers
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, 'data-blocked:');
  
  // Remove null bytes and control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
};

/**
 * Validate and sanitize a claim object
 * @param {Object} claim - The claim object to validate
 * @returns {Object|null} - Sanitized claim or null if invalid
 */
const validateClaim = (claim) => {
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
    return null;
  }

  // Require conditionName
  if (!claim.conditionName || typeof claim.conditionName !== 'string') {
    return null;
  }

  const sanitizedClaim = {};

  // Only copy valid fields
  for (const field of VALID_CLAIM_FIELDS) {
    if (claim.hasOwnProperty(field)) {
      const value = claim[field];
      
      if (field === 'id') {
        sanitizedClaim[field] = sanitizeString(String(value), MAX_ID_LENGTH);
      } else if (field === 'conditionName' || field === 'parentCondition') {
        sanitizedClaim[field] = value ? sanitizeString(String(value), MAX_CONDITION_NAME) : null;
      } else if (field === 'status') {
        // Validate status is a valid value
        sanitizedClaim[field] = VALID_STATUSES.includes(value) ? value : 'Drafting';
      } else if (field === 'dateSaved' || field === 'dateUpdated') {
        // Validate date format
        const date = new Date(value);
        sanitizedClaim[field] = isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
      } else if (field === 'diagnosticCode' || field === 'selectedRating') {
        // Numbers only
        const num = parseInt(value, 10);
        if (!isNaN(num) && num >= 0 && num <= 99999) {
          sanitizedClaim[field] = num;
        }
      } else if (field === 'notes') {
        sanitizedClaim[field] = sanitizeString(String(value || ''), MAX_STRING_LENGTH);
      } else if (typeof value === 'string') {
        sanitizedClaim[field] = sanitizeString(value);
      }
    }
  }

  // Ensure required fields exist
  if (!sanitizedClaim.id) {
    sanitizedClaim.id = `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  if (!sanitizedClaim.dateSaved) {
    sanitizedClaim.dateSaved = new Date().toISOString();
  }
  if (!sanitizedClaim.status) {
    sanitizedClaim.status = 'Drafting';
  }

  return sanitizedClaim;
};

/**
 * Validate and sanitize a statement object
 * @param {Object} statement - The statement object to validate
 * @returns {Object|null} - Sanitized statement or null if invalid
 */
const validateStatement = (statement) => {
  if (!statement || typeof statement !== 'object' || Array.isArray(statement)) {
    return null;
  }

  const sanitizedStatement = {};

  for (const field of VALID_STATEMENT_FIELDS) {
    if (statement.hasOwnProperty(field)) {
      const value = statement[field];
      
      if (field === 'savedDate') {
        const date = new Date(value);
        sanitizedStatement[field] = isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
      } else if (typeof value === 'string') {
        sanitizedStatement[field] = sanitizeString(value, MAX_STRING_LENGTH);
      }
    }
  }

  // Statement must have content
  if (!sanitizedStatement.statement && !sanitizedStatement.doctorNote) {
    return null;
  }

  return sanitizedStatement;
};

/**
 * Export packet data to a secure JSON format
 * @param {Array} claims - Array of claim objects
 * @param {Object} statements - Object mapping claim IDs to statements
 * @returns {Object} - Export object with metadata
 */
export const exportPacketData = (claims, statements) => {
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    source: 'Vet-Rate.org',
    disclaimer: 'This backup contains personal claim data. Keep it secure and private.',
    data: {
      claims: claims.map(claim => validateClaim(claim)).filter(Boolean),
      statements: {}
    }
  };

  // Validate each statement
  for (const [claimId, statement] of Object.entries(statements || {})) {
    const sanitizedId = sanitizeString(String(claimId), MAX_ID_LENGTH);
    const validatedStatement = validateStatement(statement);
    if (validatedStatement) {
      exportData.data.statements[sanitizedId] = validatedStatement;
    }
  }

  return exportData;
};

/**
 * Parse and validate imported packet data
 * @param {string} jsonString - The JSON string to parse
 * @returns {Object} - Result object with success flag, data or error
 */
export const importPacketData = (jsonString) => {
  // Security check: limit input size (5MB max)
  if (!jsonString || typeof jsonString !== 'string') {
    return { success: false, error: 'Invalid input: expected string data' };
  }
  
  if (jsonString.length > 5 * 1024 * 1024) {
    return { success: false, error: 'File too large: maximum size is 5MB' };
  }

  // Check for suspicious patterns before parsing
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /__proto__/i,
    /constructor\s*\(/i,
    /prototype/i,
    /eval\s*\(/i,
    /Function\s*\(/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(jsonString)) {
      return { success: false, error: 'Security violation: potentially malicious content detected' };
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    return { success: false, error: 'Invalid JSON format: unable to parse file' };
  }

  // Validate structure
  if (!parsed || typeof parsed !== 'object') {
    return { success: false, error: 'Invalid format: expected object structure' };
  }

  // Check for Vet-Rate format
  if (parsed.source !== 'Vet-Rate.org') {
    return { success: false, error: 'Invalid backup file: not a Vet-Rate.org backup' };
  }

  if (!parsed.data || typeof parsed.data !== 'object') {
    return { success: false, error: 'Invalid format: missing data section' };
  }

  // Validate and sanitize claims
  const claims = [];
  if (Array.isArray(parsed.data.claims)) {
    for (const claim of parsed.data.claims) {
      const validated = validateClaim(claim);
      if (validated) {
        claims.push(validated);
      }
    }
  }

  // Validate and sanitize statements
  const statements = {};
  if (parsed.data.statements && typeof parsed.data.statements === 'object') {
    for (const [claimId, statement] of Object.entries(parsed.data.statements)) {
      const sanitizedId = sanitizeString(String(claimId), MAX_ID_LENGTH);
      const validated = validateStatement(statement);
      if (validated) {
        statements[sanitizedId] = validated;
      }
    }
  }

  return {
    success: true,
    data: {
      claims,
      statements
    },
    meta: {
      version: parsed.version || '1.0',
      exportDate: parsed.exportDate,
      claimCount: claims.length,
      statementCount: Object.keys(statements).length
    }
  };
};

/**
 * Download packet data as a JSON file
 * @param {Object} exportData - The export data object
 * @param {string} filename - Optional custom filename
 */
export const downloadPacketBackup = (exportData, filename = null) => {
  const date = new Date().toISOString().split('T')[0];
  const defaultFilename = `vet-rate-packet-backup-${date}.json`;
  
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Export COMPLETE packet with veteran profile and saved forms
 * This is the comprehensive backup that includes everything
 * @param {Array} claims - Array of claim objects
 * @param {Object} statements - Object mapping claim IDs to statements
 * @param {Object} veteranProfile - Veteran profile data
 * @param {Array} savedForms - Array of saved forms
 * @returns {Object} - Complete export object
 */
export const exportCompletePacket = (claims, statements, veteranProfile = null, savedForms = []) => {
  const exportData = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    source: 'Vet-Rate.org',
    disclaimer: 'This backup contains personal claim data and sensitive information. Keep it secure and private. NEVER share this file.',
    data: {
      claims: claims.map(claim => validateClaim(claim)).filter(Boolean),
      statements: {},
      veteranProfile: veteranProfile || null,
      savedForms: savedForms || []
    }
  };

  // Validate each statement
  for (const [claimId, statement] of Object.entries(statements || {})) {
    const sanitizedId = sanitizeString(String(claimId), MAX_ID_LENGTH);
    const validatedStatement = validateStatement(statement);
    if (validatedStatement) {
      exportData.data.statements[sanitizedId] = validatedStatement;
    }
  }

  return exportData;
};

/**
 * Import complete packet including veteran profile and saved forms
 * @param {string} jsonString - The JSON string to parse
 * @returns {Object} - Result object with success flag, data or error
 */
export const importCompletePacket = (jsonString) => {
  // First use standard validation
  const baseResult = importPacketData(jsonString);
  
  if (!baseResult.success) {
    return baseResult;
  }

  // Parse again to get additional fields
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    return baseResult; // Return basic result if can't parse again
  }

  // Add veteranProfile if present
  if (parsed.data?.veteranProfile && typeof parsed.data.veteranProfile === 'object') {
    baseResult.data.veteranProfile = parsed.data.veteranProfile;
    baseResult.meta.hasProfile = true;
  }

  // Add savedForms if present
  if (parsed.data?.savedForms && Array.isArray(parsed.data.savedForms)) {
    baseResult.data.savedForms = parsed.data.savedForms;
    baseResult.meta.savedFormsCount = parsed.data.savedForms.length;
  }

  return baseResult;
};

export default {
  exportPacketData,
  importPacketData,
  downloadPacketBackup,
  exportCompletePacket,
  importCompletePacket
};
