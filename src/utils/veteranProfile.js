/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Veteran Profile Storage Utility
 * Stores common form fields locally so veterans only have to enter info once.
 * All data stays on user's device - 100% client-side, never sent to servers.
 */

const PROFILE_KEY = 'vet_rate_veteran_profile';
const SAVED_FORMS_KEY = 'vet_rate_saved_forms';

// Valid profile fields for security
const VALID_PROFILE_FIELDS = [
  'firstName', 'middleInitial', 'lastName', 'suffix',
  'ssn', 'vaFileNumber', 'serviceNumber',
  'dob', 'email', 'phone', 'intlPhone',
  'street', 'apt', 'city', 'state', 'zip', 'country',
  'branch', 'rankAtDischarge', 'serviceStartDate', 'serviceEndDate',
  'lastUpdated'
];

// Max lengths for security
const MAX_STRING_LENGTH = 500;

/**
 * Sanitize string input
 */
const sanitizeString = (str, maxLength = MAX_STRING_LENGTH) => {
  if (typeof str !== 'string') return '';
  let sanitized = str.slice(0, maxLength);
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
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
    console.error('Error reading veteran profile:', error);
    return {};
  }
};

/**
 * Save/update the veteran profile
 * @param {Object} profile - The profile data to save
 * @returns {boolean} Success status
 */
export const saveVeteranProfile = (profile) => {
  try {
    if (!profile || typeof profile !== 'object') {
      return false;
    }

    const sanitizedProfile = {};
    
    // Only save valid fields
    for (const field of VALID_PROFILE_FIELDS) {
      if (profile.hasOwnProperty(field) && profile[field] !== undefined && profile[field] !== '') {
        sanitizedProfile[field] = sanitizeString(String(profile[field]));
      }
    }
    
    sanitizedProfile.lastUpdated = new Date().toISOString();
    
    localStorage.setItem(PROFILE_KEY, JSON.stringify(sanitizedProfile));
    return true;
  } catch (error) {
    console.error('Error saving veteran profile:', error);
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
    console.error('Error clearing veteran profile:', error);
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
  const parts = [profile.firstName, profile.middleInitial, profile.lastName, profile.suffix].filter(Boolean);
  return parts.join(' ');
};

// ============================================================================
// SAVED FORMS MANAGEMENT
// ============================================================================

/**
 * Valid form types
 */
const VALID_FORM_TYPES = [
  'buddy-statement', 'personal-statement', 'ptsd-stressor',
  'intent-to-file', 'medical-release', 'priority-processing',
  'vso-appointment', 'vso-appointment-individual'
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
    console.error('Error reading saved forms:', error);
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
    if (!form || !form.formType || !VALID_FORM_TYPES.includes(form.formType)) {
      console.error('Invalid form type:', form?.formType);
      return null;
    }

    const forms = getSavedForms();
    
    const newForm = {
      id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      formType: form.formType,
      formNumber: form.formNumber || '',
      formName: form.formName || '',
      title: sanitizeString(form.title || form.conditionName || 'Untitled Form', 200),
      formData: form.formData || {},
      generatedContent: sanitizeString(form.generatedContent || '', 100000),
      pdfBytes: form.pdfBytes || null, // Base64 encoded PDF
      dateSaved: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
      status: form.status || 'Draft'
    };
    
    forms.push(newForm);
    localStorage.setItem(SAVED_FORMS_KEY, JSON.stringify(forms));
    
    return newForm.id;
  } catch (error) {
    console.error('Error saving form:', error);
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
    const index = forms.findIndex(f => f.id === formId);
    
    if (index === -1) return false;
    
    forms[index] = {
      ...forms[index],
      ...updates,
      dateUpdated: new Date().toISOString()
    };
    
    localStorage.setItem(SAVED_FORMS_KEY, JSON.stringify(forms));
    return true;
  } catch (error) {
    console.error('Error updating form:', error);
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
  return forms.find(f => f.id === formId) || null;
};

/**
 * Delete a saved form
 * @param {string} formId - The form ID to delete
 * @returns {boolean} Success status
 */
export const deleteSavedForm = (formId) => {
  try {
    const forms = getSavedForms();
    const filtered = forms.filter(f => f.id !== formId);
    localStorage.setItem(SAVED_FORMS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting form:', error);
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
  return forms.filter(f => f.formType === formType);
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
    console.error('Error clearing forms:', error);
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
      acc[type] = forms.filter(f => f.formType === type).length;
      return acc;
    }, {}),
    draft: forms.filter(f => f.status === 'Draft').length,
    completed: forms.filter(f => f.status === 'Completed').length,
    submitted: forms.filter(f => f.status === 'Submitted').length
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
    version: '1.0'
  };
};

/**
 * Import veteran data from backup
 * @param {Object} data - The backup data
 * @param {string} mode - 'replace' or 'merge'
 * @returns {Object} Result with success status and message
 */
export const importVeteranData = (data, mode = 'replace') => {
  try {
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Invalid backup data' };
    }

    // Import profile
    if (data.profile && typeof data.profile === 'object') {
      if (mode === 'replace') {
        saveVeteranProfile(data.profile);
      } else {
        const current = getVeteranProfile();
        saveVeteranProfile({ ...current, ...data.profile });
      }
    }

    // Import forms
    if (data.forms && Array.isArray(data.forms)) {
      if (mode === 'replace') {
        localStorage.setItem(SAVED_FORMS_KEY, JSON.stringify(data.forms));
      } else {
        const currentForms = getSavedForms();
        const mergedForms = [...currentForms];
        
        for (const form of data.forms) {
          const existingIndex = currentForms.findIndex(f => f.id === form.id);
          if (existingIndex === -1) {
            mergedForms.push(form);
          }
        }
        
        localStorage.setItem(SAVED_FORMS_KEY, JSON.stringify(mergedForms));
      }
    }

    return { 
      success: true, 
      message: `Successfully ${mode === 'replace' ? 'restored' : 'merged'} data`,
      profileImported: !!data.profile,
      formsImported: data.forms?.length || 0
    };
  } catch (error) {
    console.error('Error importing veteran data:', error);
    return { success: false, message: 'Import failed: ' + error.message };
  }
};

export default {
  // Profile functions
  getVeteranProfile,
  saveVeteranProfile,
  updateVeteranProfile,
  clearVeteranProfile,
  hasVeteranProfile,
  getFullName,
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
  importVeteranData
};
