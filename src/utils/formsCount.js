/**
 * Forms Count Utility
 * 
 * Dynamically computes the number of VA forms supported in FormsHelper
 * Never hardcode "16 forms" - let the data drive it!
 */

// Import the forms data from FormsHelper
// This would ideally be in a shared data file, but for now we'll define it here

export const VA_FORMS_LIST = [
  '21-526EZ', // Disability Compensation
  '21-0966',  // Intent to File
  '21-4138',  // Statement in Support of Claim
  '21-0781',  // PTSD Statement (Combat)
  '21-0781a', // PTSD Statement (Non-Combat)
  '21-8940',  // Unemployability (TDIU)
  '21-4192',  // Request for Employment Information (TDIU)
  '21-2680',  // Buddy Statement
  '21-10210', // Lay/Witness Statement
  '21-4142',  // Medical Records Authorization
  '21-4502',  // Vehicle Allowance
  '21-686c',  // Dependent Status
  '21-674',   // School Attendance (Dependents)
  '21-0845',  // Power of Attorney
  '10-10EZ',  // Healthcare Enrollment
  '10-5345',  // Request for Medical Records (FOIA)
];

/**
 * Get the actual count of supported VA forms
 * @returns {number}
 */
export function getFormsCount() {
  return VA_FORMS_LIST.length;
}

/**
 * Get formatted forms count for display
 * @param {boolean} includeLabel - Whether to include "FORMS" label
 * @returns {string}
 */
export function getFormattedFormsCount(includeLabel = true) {
  const count = getFormsCount();
  return includeLabel ? `${count} FORMS` : `${count}`;
}

/**
 * Check if a specific form is supported
 * @param {string} formId - VA form ID (e.g., "21-526EZ")
 * @returns {boolean}
 */
export function isFormSupported(formId) {
  return VA_FORMS_LIST.includes(formId);
}

export default {
  getFormsCount,
  getFormattedFormsCount,
  isFormSupported,
  VA_FORMS_LIST
};
