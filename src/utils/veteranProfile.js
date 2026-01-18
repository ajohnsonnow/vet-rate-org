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
const RATINGS_KEY = 'vet_rate_my_ratings';

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

// ============================================================================
// MY RATINGS STORAGE - User's actual VA disability ratings
// ============================================================================

/**
 * Valid body parts for ratings
 */
const VALID_BODY_PARTS = [
  'shoulder', 'arm', 'elbow', 'forearm', 'wrist', 'hand', 'fingers',
  'hip', 'thigh', 'knee', 'leg', 'ankle', 'foot', 'toes',
  'head', 'eye', 'ear', 'nose', 'mouth', 'neck', 'back', 'chest',
  'heart', 'lungs', 'digestive', 'kidney', 'bladder', 'reproductive',
  'skin', 'mental', 'tbi', 'diabetes', 'migraines', 'other'
];

/**
 * Get all saved ratings
 * @returns {Array} Array of {id, name, bodyPart, rating, side, effectiveDate}
 */
export const getMyRatings = () => {
  try {
    const saved = localStorage.getItem(RATINGS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error reading ratings:', error);
    return [];
  }
};

/**
 * Save/replace all ratings
 * @param {Array} ratings - Array of rating objects
 * @returns {boolean} Success status
 */
export const saveMyRatings = (ratings) => {
  try {
    if (!Array.isArray(ratings)) return false;
    
    // Validate and sanitize each rating
    const sanitizedRatings = ratings.map(r => ({
      id: r.id || `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: sanitizeString(r.name || '', 200),
      bodyPart: VALID_BODY_PARTS.includes(r.bodyPart) ? r.bodyPart : 'other',
      rating: Math.max(0, Math.min(100, parseInt(r.rating) || 0)),
      side: ['left', 'right', 'bilateral', 'none'].includes(r.side) ? r.side : 'none',
      effectiveDate: r.effectiveDate || null,
      dateAdded: r.dateAdded || new Date().toISOString(),
      dateUpdated: new Date().toISOString()
    }));
    
    localStorage.setItem(RATINGS_KEY, JSON.stringify(sanitizedRatings));
    return true;
  } catch (error) {
    console.error('Error saving ratings:', error);
    return false;
  }
};

/**
 * Add a new rating
 * @param {Object} rating - The rating to add
 * @returns {string|null} The new rating ID or null on error
 */
export const addRating = (rating) => {
  try {
    const ratings = getMyRatings();
    
    const newRating = {
      id: `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: sanitizeString(rating.name || '', 200),
      bodyPart: VALID_BODY_PARTS.includes(rating.bodyPart) ? rating.bodyPart : 'other',
      rating: Math.max(0, Math.min(100, parseInt(rating.rating) || 0)),
      side: ['left', 'right', 'bilateral', 'none'].includes(rating.side) ? rating.side : 'none',
      effectiveDate: rating.effectiveDate || null,
      dateAdded: new Date().toISOString(),
      dateUpdated: new Date().toISOString()
    };
    
    ratings.push(newRating);
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
    
    return newRating.id;
  } catch (error) {
    console.error('Error adding rating:', error);
    return null;
  }
};

/**
 * Update an existing rating
 * @param {string} ratingId - The rating ID to update
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success status
 */
export const updateRating = (ratingId, updates) => {
  try {
    const ratings = getMyRatings();
    const index = ratings.findIndex(r => r.id === ratingId);
    
    if (index === -1) return false;
    
    ratings[index] = {
      ...ratings[index],
      ...updates,
      dateUpdated: new Date().toISOString()
    };
    
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
    return true;
  } catch (error) {
    console.error('Error updating rating:', error);
    return false;
  }
};

/**
 * Remove a rating
 * @param {string} ratingId - The rating ID to remove
 * @returns {boolean} Success status
 */
export const removeRating = (ratingId) => {
  try {
    const ratings = getMyRatings();
    const filtered = ratings.filter(r => r.id !== ratingId);
    localStorage.setItem(RATINGS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error removing rating:', error);
    return false;
  }
};

/**
 * Clear all ratings
 * @returns {boolean} Success status
 */
export const clearMyRatings = () => {
  try {
    localStorage.removeItem(RATINGS_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing ratings:', error);
    return false;
  }
};

/**
 * Check if user has saved ratings
 * @returns {boolean}
 */
export const hasMyRatings = () => {
  const ratings = getMyRatings();
  return ratings.length > 0;
};

/**
 * Get the user's current combined VA rating (requires vaCalculator)
 * @returns {number} Combined rating percentage
 */
export const getMyTotalRating = () => {
  const ratings = getMyRatings();
  if (ratings.length === 0) return 0;
  
  // VA math: combine ratings using efficiency formula
  // Formula: A + B(1-A) = combined, then round to nearest 10%
  const sortedRatings = ratings.map(r => r.rating).sort((a, b) => b - a);
  
  let combined = 0;
  for (const rating of sortedRatings) {
    const ratingDecimal = rating / 100;
    const combinedDecimal = combined / 100;
    combined = Math.round((combinedDecimal + ratingDecimal * (1 - combinedDecimal)) * 100);
  }
  
  // Round to nearest 10%
  return Math.round(combined / 10) * 10;
};

// Default export - must be at the end after all functions are defined
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
  importVeteranData,
  // Ratings functions
  getMyRatings,
  saveMyRatings,
  addRating,
  updateRating,
  removeRating,
  clearMyRatings,
  hasMyRatings,
  getMyTotalRating
};
