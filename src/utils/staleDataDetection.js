/**
 * SupplyLocker.org - Stale Data Detection Utility
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Detects outdated rating criteria that need verification
 * Helps prevent submitting claims based on old VASRD data
 */

/**
 * Check if a disability data item is stale (needs verification)
 * @param {Object} disability - Disability object from disabilityData.json
 * @returns {boolean} - True if data is stale (>365 days old or no verification date)
 */
export function isStaleData(disability) {
  if (!disability.lastVerifiedDate) {
    // If no verification date, consider it stale
    return true;
  }
  
  try {
    const verifiedDate = new Date(disability.lastVerifiedDate);
    const currentDate = new Date();
    const daysDifference = Math.floor((currentDate - verifiedDate) / (1000 * 60 * 60 * 24));
    
    // Consider stale if more than 365 days old
    return daysDifference > 365;
  } catch (error) {
    // If date parsing fails, consider it stale
    return true;
  }
}

/**
 * Get the age of the data in days
 * @param {Object} disability - Disability object from disabilityData.json
 * @returns {number} - Age in days, or Infinity if no date
 */
export function getDataAgeDays(disability) {
  if (!disability.lastVerifiedDate) {
    return Infinity;
  }
  
  try {
    const verifiedDate = new Date(disability.lastVerifiedDate);
    const currentDate = new Date();
    return Math.floor((currentDate - verifiedDate) / (1000 * 60 * 60 * 24));
  } catch (error) {
    return Infinity;
  }
}

/**
 * Get a human-readable description of how old the data is
 * @param {Object} disability - Disability object from disabilityData.json
 * @returns {string} - Human-readable age description
 */
export function getDataAgeDescription(disability) {
  const ageDays = getDataAgeDays(disability);
  
  if (ageDays === Infinity) {
    return 'Never verified';
  }
  
  if (ageDays < 30) {
    return `Verified ${ageDays} days ago`;
  }
  
  const ageMonths = Math.floor(ageDays / 30);
  if (ageMonths < 12) {
    return `Verified ${ageMonths} month${ageMonths > 1 ? 's' : ''} ago`;
  }
  
  const ageYears = Math.floor(ageDays / 365);
  return `Verified ${ageYears} year${ageYears > 1 ? 's' : ''} ago`;
}

/**
 * Generate a mailto link for reporting outdated information
 * @param {Object} disability - Disability object from disabilityData.json
 * @returns {string} - Mailto URL
 */
export function generateReportOutdatedLink(disability) {
  const subject = encodeURIComponent(`Report Outdated Rating Criteria - ${disability.conditionName}`);
  const body = encodeURIComponent(
    `I'd like to report that the rating criteria for the following condition may be outdated:\n\n` +
    `Condition: ${disability.conditionName}\n` +
    `Diagnostic Code: ${disability.diagnosticCode}\n` +
    `Last Verified: ${disability.lastVerifiedDate || 'Never'}\n\n` +
    `Details/Changes I've observed:\n` +
    `[Please describe what you believe has changed or why this needs updating]\n\n` +
    `Source (if any):\n` +
    `[URL or reference to updated VA regulations]\n\n` +
    `Thank you for helping keep SupplyLocker.org accurate!`
  );
  
  return `mailto:support@SupplyLocker.org?subject=${subject}&body=${body}`;
}

/**
 * Get the stale data status with visual indicator details
 * @param {Object} disability - Disability object from disabilityData.json
 * @returns {Object} - Status object with isStale, severity, icon, color, message
 */
export function getStaleDataStatus(disability) {
  const stale = isStaleData(disability);
  const ageDays = getDataAgeDays(disability);
  
  if (!stale) {
    return {
      isStale: false,
      severity: 'current',
      icon: '✓',
      color: 'green',
      message: 'Recently verified',
      showWarning: false
    };
  }
  
  // Critical: Never verified or extremely old (>2 years)
  if (ageDays === Infinity || ageDays > 730) {
    return {
      isStale: true,
      severity: 'critical',
      icon: '⚠️',
      color: 'red',
      message: 'Rating criteria verification needed',
      showWarning: true,
      description: getDataAgeDescription(disability)
    };
  }
  
  // Warning: 1-2 years old
  return {
    isStale: true,
    severity: 'warning',
    icon: '⚠',
    color: 'yellow',
    message: 'Rating criteria may be outdated',
    showWarning: true,
    description: getDataAgeDescription(disability)
  };
}
