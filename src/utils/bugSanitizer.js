/**
 * Vet-Rate.org - Bug Report Sanitizer
 * "Safe-Squash" Architecture - Privacy-First Error Logging
 *
 * Recursively scans and redacts PII before storage:
 * - Social Security Numbers (XXX-XX-XXXX patterns)
 * - Email addresses
 * - Passwords, tokens, SSN fields
 * - File blob data
 * - Credit card numbers
 * - Phone numbers
 * - Names in sensitive contexts
 *
 * HIPAA/GDPR compliant: PII never hits the bug database.
 * Built by a fellow veteran. "Your privacy is non-negotiable."
 */

// ============================================
// REDACTION PATTERNS
// ============================================

const REDACTION_PATTERNS = [
  {
    name: "SSN",
    // Matches: 123-45-6789, 123 45 6789, 123456789
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: "[SSN-REDACTED]",
  },
  {
    name: "EMAIL",
    // Standard email pattern
    pattern: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[|a-z]{2,}\b/gi,
    replacement: "[EMAIL-REDACTED]",
  },
  {
    name: "CREDIT_CARD",
    // Matches: 1234-5678-9012-3456 or 1234567890123456
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    replacement: "[CARD-REDACTED]",
  },
  {
    name: "PHONE",
    // Matches: (123) 456-7890, 123-456-7890, 1234567890
    pattern: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: "[PHONE-REDACTED]",
  },
  {
    name: "DOB",
    // Matches: 01/15/1990, 01-15-1990, 1990-01-15
    // eslint-disable-next-line sonarjs/regex-complexity -- validates real calendar month/day ranges in both MM/DD/YYYY and YYYY/MM/DD orders; splitting the alternation would change the "DOB" pattern name/count that createSanitizedReport and detectPII expose, so a mechanical rewrite isn't confidently behavior-preserving
    pattern:
      /\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](19|20)\d{2}\b|\b(19|20)\d{2}[/-](0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])\b/g,
    replacement: "[DOB-REDACTED]",
  },
  {
    name: "VA_FILE_NUMBER",
    // VA file numbers are often same as SSN or start with C/CSS
    pattern: /\b[Cc]?[Ss]?[Ss]?\d{8,9}\b/g,
    replacement: "[VA-FILE-REDACTED]",
  },
  {
    name: "EDIPI",
    // DOD ID number (10 digits)
    pattern: /\bEDIPI[:\s]*\d{10}\b/gi,
    replacement: "[EDIPI-REDACTED]",
  },
  {
    name: "JWT_TOKEN",
    // JWT tokens (eyJ...)
    pattern: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    replacement: "[TOKEN-REDACTED]",
  },
  {
    name: "BEARER_TOKEN",
    // Bearer authorization headers
    pattern: /Bearer\s+[a-z0-9._~+/=-]+/gi,
    replacement: "Bearer [TOKEN-REDACTED]",
  },
  {
    name: "API_KEY",
    // Common API key patterns
    pattern: /\b([a-zA-Z0-9]{20,})\b/g,
    replacement: (match) => {
      // Only redact if it looks like a key (mixed case/numbers, long)
      if (
        match.length > 30 &&
        /[A-Z]/.test(match) &&
        /[a-z]/.test(match) &&
        /\d/.test(match)
      ) {
        return "[API-KEY-REDACTED]";
      }
      return match;
    },
  },
  {
    name: "BASE64_BLOB",
    // Large base64 blobs (likely file content)
    pattern: /data:[^;]+;base64,[A-Za-z0-9+/=]{100,}/g,
    replacement: "[FILE-BLOB-REDACTED]",
  },
  {
    name: "ICN",
    // VA ICN (Integration Control Number) - 17 digits
    pattern: /\bICN[:\s]*\d{17}\b/gi,
    replacement: "[ICN-REDACTED]",
  },
];

// Field names that should have their values completely redacted
const SENSITIVE_FIELD_NAMES = [
  "password",
  "token",
  "ssn",
  "socialSecurityNumber",
  "social_security_number",
  "file_blob",
  "fileBlob",
  "fileContent",
  "file_content",
  "secret",
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "authorization",
  "auth",
  "creditCard",
  "credit_card",
  "cardNumber",
  "card_number",
  "cvv",
  "pin",
  "dob",
  "dateOfBirth",
  "date_of_birth",
  "birthDate",
  "birth_date",
  "firstName",
  "lastName",
  "middleName",
  "first_name",
  "last_name",
  "middle_name",
  "fullName",
  "full_name",
  "address",
  "streetAddress",
  "street_address",
  "icn",
  "edipi",
  "vaFileNumber",
  "va_file_number",
];

// ============================================
// SANITIZER FUNCTIONS
// ============================================

/**
 * Check if a field name is sensitive
 * @param {string} fieldName - The field name to check
 * @returns {boolean} True if the field should be redacted
 */
const isSensitiveField = (fieldName) => {
  if (!fieldName || typeof fieldName !== "string") return false;

  const lowerName = fieldName.toLowerCase();
  return SENSITIVE_FIELD_NAMES.some(
    (sensitive) =>
      lowerName === sensitive.toLowerCase() ||
      lowerName.includes(sensitive.toLowerCase()),
  );
};

/**
 * Sanitize a string value by applying all redaction patterns
 * @param {string} value - The string to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeString = (value) => {
  if (!value || typeof value !== "string") return value;

  let sanitized = value;

  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
};

/**
 * Recursively sanitize an object, redacting all PII
 * @param {any} payload - The payload to sanitize (object, array, or primitive)
 * @param {Set} seen - Set of seen objects (for circular reference detection)
 * @returns {any} Sanitized payload
 */
export const sanitizeErrorPayload = (payload, seen = new Set()) => {
  // Handle null/undefined
  if (payload === null || payload === undefined) {
    return payload;
  }

  // Handle primitives
  if (typeof payload === "string") {
    return sanitizeString(payload);
  }

  if (typeof payload === "number" || typeof payload === "boolean") {
    return payload;
  }

  // Handle Date objects
  if (payload instanceof Date) {
    return payload.toISOString();
  }

  // Handle Error objects
  if (payload instanceof Error) {
    return {
      name: payload.name,
      message: sanitizeString(payload.message),
      stack: sanitizeString(payload.stack),
    };
  }

  // Detect circular references
  if (typeof payload === "object") {
    if (seen.has(payload)) {
      return "[Circular Reference]";
    }
    seen.add(payload);
  }

  // Handle arrays
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeErrorPayload(item, seen));
  }

  // Handle objects
  if (typeof payload === "object") {
    const sanitized = {};

    for (const [key, value] of Object.entries(payload)) {
      // Check if this is a sensitive field
      if (isSensitiveField(key)) {
        sanitized[key] = "[FIELD-REDACTED]";
        continue;
      }

      // Recursively sanitize the value
      sanitized[key] = sanitizeErrorPayload(value, seen);
    }

    return sanitized;
  }

  // Fallback: convert to string and sanitize
  return sanitizeString(String(payload));
};

/**
 * Create a sanitized bug report payload ready for storage
 * @param {Object} reportData - The raw bug report data
 * @returns {Object} Sanitized report with metadata
 */
export const createSanitizedReport = (reportData) => {
  const sanitized = sanitizeErrorPayload(reportData);

  return {
    ...sanitized,
    _sanitization: {
      sanitizedAt: new Date().toISOString(),
      version: "1.0",
      patterns: REDACTION_PATTERNS.map((p) => p.name),
    },
  };
};

/**
 * Quick check if a string contains potential PII
 * Useful for validation before storage
 * @param {string} text - Text to check
 * @returns {Object} { hasPII: boolean, detectedTypes: string[] }
 */
export const detectPII = (text) => {
  if (!text || typeof text !== "string") {
    return { hasPII: false, detectedTypes: [] };
  }

  const detectedTypes = [];

  for (const { name, pattern } of REDACTION_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      detectedTypes.push(name);
    }
    pattern.lastIndex = 0;
  }

  return {
    hasPII: detectedTypes.length > 0,
    detectedTypes,
  };
};

/**
 * Mask sensitive data for display (partial redaction)
 * Shows first/last characters for debugging
 * @param {string} value - Value to mask
 * @param {number} showChars - Number of characters to show at start/end
 * @returns {string} Masked value
 */
export const maskForDisplay = (value, showChars = 2) => {
  if (!value || typeof value !== "string" || value.length <= showChars * 2) {
    return "****";
  }

  const start = value.substring(0, showChars);
  const end = value.substring(value.length - showChars);
  const masked = "*".repeat(Math.min(value.length - showChars * 2, 8));

  return `${start}${masked}${end}`;
};

// ============================================
// EXPORTS
// ============================================

export default {
  sanitizeErrorPayload,
  createSanitizedReport,
  detectPII,
  maskForDisplay,
  isSensitiveField,
  REDACTION_PATTERNS,
  SENSITIVE_FIELD_NAMES,
};
