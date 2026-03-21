/**
 * PII Scrubber - Client-Side Privacy Firewall
 * Removes personally identifiable information before data leaves the browser
 *
 * This runs 100% locally - nothing is sent to any server for analysis
 */

// Regex patterns for common PII
const PII_PATTERNS = {
  // SSN patterns (XXX-XX-XXXX or XXXXXXXXX)
  ssn: [/\b\d{3}-\d{2}-\d{4}\b/g, /\b\d{9}\b/g],

  // Phone numbers (various formats)
  phone: [
    /\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  ],

  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Credit card numbers (basic pattern)
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

  // Dates of birth (various formats)
  dob: [
    /\b(0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])[/-](\d{2}|\d{4})\b/g,
    /\b(0[1-9]|[12]\d|3[01])[/-](0[1-9]|1[0-2])[/-](\d{2}|\d{4})\b/g,
  ],

  // EDIPI / DOD ID numbers (10 digits)
  edipi: /\b\d{10}\b/g,

  // Full addresses (basic pattern - street numbers and names)
  address:
    /\b\d+\s+[A-Za-z0-9\s]+\b(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Plaza|Place|Pl)\b/gi,
};

/**
 * Scrub PII from text
 * @param {string} text - Input text to scrub
 * @param {Object} options - Configuration options
 * @returns {Object} { scrubbedText: string, piiFound: boolean, details: Array }
 */
export const scrubPII = (text, options = {}) => {
  if (!text || typeof text !== "string") {
    return { scrubbedText: text, piiFound: false, details: [] };
  }

  const {
    aggressive = false, // If true, also scrubs potential DOB and addresses
    preservePartial = false, // If true, shows last 4 digits of SSN/phone
    customPatterns = [], // Additional regex patterns to check
  } = options;

  let scrubbed = text;
  const details = [];
  let piiFound = false;

  // SSN Scrubbing
  PII_PATTERNS.ssn.forEach((pattern) => {
    const matches = scrubbed.match(pattern);
    if (matches) {
      piiFound = true;
      details.push({ type: "SSN", count: matches.length });
      if (preservePartial) {
        scrubbed = scrubbed.replace(pattern, (match) => {
          const digits = match.replace(/\D/g, "");
          return `XXX-XX-${digits.slice(-4)}`;
        });
      } else {
        scrubbed = scrubbed.replace(pattern, "[REDACTED_SSN]");
      }
    }
  });

  // Phone Number Scrubbing
  PII_PATTERNS.phone.forEach((pattern) => {
    const matches = scrubbed.match(pattern);
    if (matches) {
      piiFound = true;
      details.push({ type: "Phone", count: matches.length });
      if (preservePartial) {
        scrubbed = scrubbed.replace(pattern, (match) => {
          const digits = match.replace(/\D/g, "");
          return `XXX-XXX-${digits.slice(-4)}`;
        });
      } else {
        scrubbed = scrubbed.replace(pattern, "[REDACTED_PHONE]");
      }
    }
  });

  // Email Scrubbing
  const emailMatches = scrubbed.match(PII_PATTERNS.email);
  if (emailMatches) {
    piiFound = true;
    details.push({ type: "Email", count: emailMatches.length });
    if (preservePartial) {
      scrubbed = scrubbed.replace(PII_PATTERNS.email, (match) => {
        const [user, domain] = match.split("@");
        return `${user[0]}***@${domain}`;
      });
    } else {
      scrubbed = scrubbed.replace(PII_PATTERNS.email, "[REDACTED_EMAIL]");
    }
  }

  // Credit Card Scrubbing
  const ccMatches = scrubbed.match(PII_PATTERNS.creditCard);
  if (ccMatches) {
    piiFound = true;
    details.push({ type: "Credit Card", count: ccMatches.length });
    scrubbed = scrubbed.replace(PII_PATTERNS.creditCard, "[REDACTED_CC]");
  }

  // EDIPI Scrubbing (only if aggressive mode)
  if (aggressive) {
    const edipiMatches = scrubbed.match(PII_PATTERNS.edipi);
    if (edipiMatches) {
      piiFound = true;
      details.push({ type: "EDIPI/DOD ID", count: edipiMatches.length });
      scrubbed = scrubbed.replace(PII_PATTERNS.edipi, "[REDACTED_ID]");
    }
  }

  // DOB Scrubbing (only if aggressive mode)
  if (aggressive) {
    PII_PATTERNS.dob.forEach((pattern) => {
      const matches = scrubbed.match(pattern);
      if (matches) {
        piiFound = true;
        details.push({ type: "Date of Birth", count: matches.length });
        scrubbed = scrubbed.replace(pattern, "[REDACTED_DOB]");
      }
    });
  }

  // Address Scrubbing (only if aggressive mode)
  if (aggressive) {
    const addressMatches = scrubbed.match(PII_PATTERNS.address);
    if (addressMatches) {
      piiFound = true;
      details.push({ type: "Address", count: addressMatches.length });
      scrubbed = scrubbed.replace(PII_PATTERNS.address, "[REDACTED_ADDRESS]");
    }
  }

  // Custom patterns
  customPatterns.forEach(({ pattern, label }) => {
    const matches = scrubbed.match(pattern);
    if (matches) {
      piiFound = true;
      details.push({ type: label || "Custom", count: matches.length });
      scrubbed = scrubbed.replace(
        pattern,
        `[REDACTED_${label?.toUpperCase() || "INFO"}]`,
      );
    }
  });

  return {
    scrubbedText: scrubbed,
    piiFound,
    details,
    originalLength: text.length,
    scrubbedLength: scrubbed.length,
  };
};

/**
 * Quick check if text contains PII without scrubbing
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export const containsPII = (text) => {
  if (!text || typeof text !== "string") return false;

  // Check SSN
  if (PII_PATTERNS.ssn.some((pattern) => pattern.test(text))) return true;

  // Check Phone
  if (PII_PATTERNS.phone.some((pattern) => pattern.test(text))) return true;

  // Check Email
  if (PII_PATTERNS.email.test(text)) return true;

  // Check Credit Card
  if (PII_PATTERNS.creditCard.test(text)) return true;

  return false;
};

/**
 * Analyze text for PII without modifying it
 * @param {string} text - Text to analyze
 * @returns {Object} Analysis results
 */
export const analyzePII = (text) => {
  if (!text || typeof text !== "string") {
    return { hasPII: false, types: [], score: 0 };
  }

  const types = [];
  let score = 0;

  // Check each pattern
  if (PII_PATTERNS.ssn.some((p) => p.test(text))) {
    types.push("SSN");
    score += 10; // Highest risk
  }

  if (PII_PATTERNS.phone.some((p) => p.test(text))) {
    types.push("Phone");
    score += 5;
  }

  if (PII_PATTERNS.email.test(text)) {
    types.push("Email");
    score += 3;
  }

  if (PII_PATTERNS.creditCard.test(text)) {
    types.push("Credit Card");
    score += 10;
  }

  if (PII_PATTERNS.edipi.test(text)) {
    types.push("DOD ID");
    score += 7;
  }

  return {
    hasPII: types.length > 0,
    types,
    score, // 0 = clean, 10+ = high risk
    riskLevel:
      score === 0 ? "none" : score < 5 ? "low" : score < 10 ? "medium" : "high",
  };
};

export default {
  scrubPII,
  containsPII,
  analyzePII,
};
