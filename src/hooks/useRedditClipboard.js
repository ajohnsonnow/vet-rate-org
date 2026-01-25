/**
 * SupplyLocker.org - useRedditClipboard Hook
 * "The Squared Away Standard" Edition
 * 
 * Features:
 * 1. Reddit Markdown Formatting (Double spacing, lists, tables)
 * 2. "Mic Drop Linker": Auto-links 38 CFR and Diagnostic Codes to official eCFR.gov
 * 3. "PERSEC Shield": Auto-redacts dates, SSNs, and PII patterns
 * 
 * @author SupplyLocker.org Development Team
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';

/**
 * "The Squared Away Standard" Clipboard Hook
 * 
 * @param {number} resetDuration - Time in ms to show the "Copied!" state (default: 2000)
 * @returns {Object} { isCopied, copyToClipboard, formatForReddit }
 */
export const useRedditClipboard = (resetDuration = 2000) => {
  const [isCopied, setIsCopied] = useState(false);

  // --- 1. The "Mic Drop" Linker Logic ---
  const linkCitations = useCallback((text) => {
    if (!text) return text;

    // Base URLs for eCFR
    const ECFR_PART3 = "https://www.ecfr.gov/current/title-38/chapter-I/part-3";
    const ECFR_PART4 = "https://www.ecfr.gov/current/title-38/chapter-I/part-4";
    const KNOWVA_M21 = "https://www.knowva.ebenefits.va.gov/system/templates/selfservice/va_ssnew/help/customer/locale/en-US/portal/554400000001018";

    return text
      // Pattern A: Part 3 Regulations (e.g., "38 CFR 3.310" or "§ 3.310")
      .replace(
        /(?:38\s*CFR\s*|§\s*)?(3\.\d+[a-z]?)/gi,
        (match, section) => `[${match}](${ECFR_PART3}/section-${section})`
      )
      
      // Pattern B: Part 4 Regulations (e.g., "38 CFR 4.71a" or "§ 4.130")
      .replace(
        /(?:38\s*CFR\s*|§\s*)?(4\.\d+[a-z]?)/gi,
        (match, section) => `[${match}](${ECFR_PART4}/subpart-B/section-${section})`
      )
      
      // Pattern C: Diagnostic Codes (e.g., "DC 5237" or "Diagnostic Code 8100")
      // Links to the general Part 4 since specific anchors are unstable
      .replace(
        /(?:Diagnostic Code|DC)\s*(\d{4})/gi,
        (match) => `[${match}](${ECFR_PART4})`
      )
      
      // Pattern D: M21-1 Manual References (e.g., "M21-1 V.ii.3")
      .replace(
        /\b(M21-1(?:\s+[IVX\.]+\w+)?)/gi,
        (match) => `[${match}](${KNOWVA_M21})`
      )
      
      // Pattern E: General CFR references without part number
      .replace(
        /38\s*CFR\s*(?![\d§])/gi,
        '[38 CFR](https://www.ecfr.gov/current/title-38)'
      );
  }, []);

  // --- 2. The "PERSEC" Shield Logic ---
  const sanitizeText = useCallback((text) => {
    if (!text) return text;

    return text
      // Redact specific dates (YYYY-MM-DD format)
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[DATE REDACTED]')
      
      // Redact dates (MM/DD/YYYY or M/D/YY format)
      .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '[DATE REDACTED]')
      
      // Redact dates (Month Day, Year format)
      .replace(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi, '[DATE REDACTED]')
      
      // Redact SSNs (XXX-XX-XXXX format)
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN REDACTED]')
      
      // Redact SSNs (last 4 mentioned, e.g., "SSN ending in 1234")
      .replace(/SSN\s*(?:ending\s*(?:in\s*)?)?(?::\s*)?\d{4}\b/gi, 'SSN [REDACTED]')
      
      // Redact VA File Numbers (usually 9 digits)
      .replace(/(?:File\s*#?\s*|VA\s*File\s*(?:Number\s*)?)\d{7,10}\b/gi, 'File #[REDACTED]')
      
      // Redact claim numbers
      .replace(/(?:Claim\s*(?:Number|#|ID)\s*:?\s*)\d+/gi, 'Claim #[REDACTED]')
      
      // Redact email addresses
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL REDACTED]')
      
      // Redact phone numbers
      .replace(/\b(?:\+1\s*)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g, '[PHONE REDACTED]')
      
      // Redact specific doctor names (Dr. LastName pattern)
      .replace(/\bDr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, '[DOCTOR]');
  }, []);

  // --- 3. Reddit Formatting Logic ---
  const formatForReddit = useCallback((text, options = {}) => {
    if (!text) return '';

    const {
      linkCitations: shouldLinkCitations = true,
      sanitize = true
    } = options;

    let processed = text;

    // A. Apply Privacy Shield (Default: ON)
    if (sanitize) {
      processed = sanitizeText(processed);
    }

    // B. Apply Mic Drop Links (Default: ON)
    if (shouldLinkCitations) {
      processed = linkCitations(processed);
    }

    // C. Apply Markdown Fixes for Reddit
    return processed
      // Fix lists: ensure space after bullets/asterisks
      .replace(/^(\*|-)(?=[^\s])/gm, '$1 ')
      
      // Fix blockquotes: ensure space after >
      .replace(/^>(?=[^\s])/gm, '> ')
      
      // Fix paragraphs: Reddit needs 2 newlines for paragraph break
      // This converts single newlines to double (except in code blocks, lists, or tables)
      .replace(/([^\n])\n([^\n\*#>\|`-])/g, '$1\n\n$2')
      
      // Ensure tables render by forcing newline before table headers
      .replace(/([^\n])\n(\|.*\|)/g, '$1\n\n$2')
      
      // Clean up excessive newlines (3+ becomes 2)
      .replace(/\n{3,}/g, '\n\n')
      
      // Trim trailing/leading whitespace
      .trim();
  }, [linkCitations, sanitizeText]);

  // --- 4. The Main Copy Action ---
  const copyToClipboard = useCallback(async (text, options = {}) => {
    const {
      linkCitations: shouldLinkCitations = true,
      sanitize = true,
      raw = false // If true, skip all formatting
    } = options;

    try {
      const textToCopy = raw 
        ? text 
        : formatForReddit(text, { linkCitations: shouldLinkCitations, sanitize });
      
      // Use modern clipboard API
      await navigator.clipboard.writeText(textToCopy);
      
      setIsCopied(true);
      
      // Reset the "Copied" state after duration
      setTimeout(() => {
        setIsCopied(false);
      }, resetDuration);
      
      console.log('📋 Copied to clipboard (Reddit formatted)');
      return true;
      
    } catch (err) {
      console.error('❌ Failed to copy to clipboard:', err);
      
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = raw ? text : formatForReddit(text, { linkCitations: shouldLinkCitations, sanitize });
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), resetDuration);
        return true;
      } catch (fallbackErr) {
        console.error('❌ Fallback copy also failed:', fallbackErr);
        return false;
      }
    }
  }, [formatForReddit, resetDuration]);

  return { 
    isCopied, 
    copyToClipboard, 
    formatForReddit,
    // Expose helpers for advanced usage
    linkCitations,
    sanitizeText
  };
};

export default useRedditClipboard;
