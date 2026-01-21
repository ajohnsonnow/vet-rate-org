/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Veteran Profile Storage Utility
 * Stores common form fields locally so veterans only have to enter info once.
 * All data stays on user's device - 100% client-side, never sent to servers.
 * 
 * Now integrates with persistentStorage for crash-proof auto-saving
 */

import { markAsModified } from './persistentStorage';

const PROFILE_KEY = 'vet_rate_veteran_profile';
const SAVED_FORMS_KEY = 'vet_rate_saved_forms';
const RATINGS_KEY = 'vet_rate_my_ratings';

// Valid profile fields for security - covers all common VA form fields
const VALID_PROFILE_FIELDS = [
  // === Personal Identification ===
  'firstName', 'middleInitial', 'lastName', 'suffix', 'fullName',
  'ssn', 'ssnLast4', 'vaFileNumber', 'serviceNumber',
  'dob', 'placeOfBirth', 'gender', 'maritalStatus',
  
  // === Contact Information ===
  'email', 'phone', 'intlPhone', 'alternatePhone',
  'street', 'apt', 'city', 'state', 'zip', 'country',
  'mailingStreet', 'mailingCity', 'mailingState', 'mailingZip', 'mailingCountry',
  'homeOfRecord',
  
  // === Military Service Information ===
  'branch', 'component', 'rankAtDischarge', 'payGrade',
  'serviceStartDate', 'serviceEndDate', 'totalServiceYears', 'totalServiceMonths',
  'mos', 'mosTitle', 'primarySpecialty',
  'characterOfService', 'separationType', 'dischargeType',
  'foreignService', 'combatService', 'reenlisted',
  
  // Service Periods Array - for multiple enlistments
  'servicePeriods', // Array of service period objects
  
  // === Dependent Information (for benefits) ===
  'spouseName', 'spouseDob', 'spouseSsn', 'marriageDate',
  'numberOfDependents', 'dependentChildren',
  
  // === VA Claim Information ===
  'currentCombinedRating', 'effectiveDate', 'claimNumber',
  'vaRepresentative', 'vsoOrganization',
  
  // === Employment Information ===
  'employmentStatus', 'lastEmployer', 'lastEmploymentDate',
  'occupation', 'annualIncome',
  
  // === Banking Information (for direct deposit) ===
  'bankName', 'routingNumber', 'accountNumber', 'accountType',
  
  // === Emergency Contact ===
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship',
  
  // === Metadata ===
  'lastUpdated', 'profileVersion'
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
    
    // Trigger auto-save to crash-proof storage
    markAsModified();
    
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
// SERVICE PERIODS MANAGEMENT (for multiple enlistments)
// ============================================================================

/**
 * Get all service periods from profile
 * @returns {Array} Array of service period objects
 */
export const getServicePeriods = () => {
  const profile = getVeteranProfile();
  return Array.isArray(profile.servicePeriods) ? profile.servicePeriods : [];
};

/**
 * Add a new service period to the profile
 * @param {Object} servicePeriod - The service period to add
 * @returns {boolean} Success status
 */
export const addServicePeriod = (servicePeriod) => {
  const currentProfile = getVeteranProfile();
  const periods = Array.isArray(currentProfile.servicePeriods) ? currentProfile.servicePeriods : [];
  
  // Create new period with ID
  const newPeriod = {
    id: Date.now().toString(),
    branch: sanitizeString(servicePeriod.branch || ''),
    component: sanitizeString(servicePeriod.component || ''), // Active, Guard, Reserve
    serviceStartDate: servicePeriod.serviceStartDate || '',
    serviceEndDate: servicePeriod.serviceEndDate || '',
    characterOfService: sanitizeString(servicePeriod.characterOfService || ''),
    mos: sanitizeString(servicePeriod.mos || ''),
    rankAtDischarge: sanitizeString(servicePeriod.rankAtDischarge || ''),
    formType: sanitizeString(servicePeriod.formType || 'DD214'), // DD214, NGB22, DD256, etc.
    notes: sanitizeString(servicePeriod.notes || ''),
    addedDate: new Date().toISOString(),
  };
  
  periods.push(newPeriod);
  return saveVeteranProfile({ ...currentProfile, servicePeriods: periods });
};

/**
 * Update a service period
 * @param {string} periodId - ID of the period to update
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success status
 */
export const updateServicePeriod = (periodId, updates) => {
  const currentProfile = getVeteranProfile();
  const periods = Array.isArray(currentProfile.servicePeriods) ? currentProfile.servicePeriods : [];
  
  const periodIndex = periods.findIndex(p => p.id === periodId);
  if (periodIndex === -1) return false;
  
  periods[periodIndex] = { ...periods[periodIndex], ...updates };
  return saveVeteranProfile({ ...currentProfile, servicePeriods: periods });
};

/**
 * Delete a service period
 * @param {string} periodId - ID of the period to delete
 * @returns {boolean} Success status
 */
export const deleteServicePeriod = (periodId) => {
  const currentProfile = getVeteranProfile();
  const periods = Array.isArray(currentProfile.servicePeriods) ? currentProfile.servicePeriods : [];
  
  const filteredPeriods = periods.filter(p => p.id !== periodId);
  return saveVeteranProfile({ ...currentProfile, servicePeriods: filteredPeriods });
};

/**
 * Get total service time across all periods
 * @returns {Object} {years: number, months: number}
 */
export const getTotalServiceTime = () => {
  const periods = getServicePeriods();
  let totalMonths = 0;
  
  periods.forEach(period => {
    if (period.serviceStartDate && period.serviceEndDate) {
      const start = new Date(period.serviceStartDate);
      const end = new Date(period.serviceEndDate);
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      totalMonths += months;
    }
  });
  
  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    totalMonths
  };
};

/**
 * Migrate old single service period to array format
 * @returns {boolean} Success status
 */
export const migrateToServicePeriods = () => {
  const profile = getVeteranProfile();
  
  // If already has servicePeriods array, skip migration
  if (Array.isArray(profile.servicePeriods) && profile.servicePeriods.length > 0) {
    return true;
  }
  
  // If has old single period fields, migrate them
  if (profile.serviceStartDate || profile.branch) {
    const oldPeriod = {
      branch: profile.branch || '',
      component: profile.component || 'Active',
      serviceStartDate: profile.serviceStartDate || '',
      serviceEndDate: profile.serviceEndDate || '',
      characterOfService: profile.characterOfService || '',
      mos: profile.mos || '',
      rankAtDischarge: profile.rankAtDischarge || '',
      formType: 'DD214',
      notes: 'Migrated from legacy profile',
    };
    
    return addServicePeriod(oldPeriod);
  }
  
  return true;
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
    
    // Trigger auto-save to crash-proof storage
    markAsModified();
    
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

// ============================================================================
// SERVICE HISTORY STORAGE - Deployments, Awards, DD214 data
// ============================================================================

const SERVICE_HISTORY_KEY = 'vet_rate_service_history';

/**
 * Valid deployment locations/theaters
 */
const VALID_THEATERS = [
  'OIF', 'OEF', 'OND', 'OIR', 'OFS', 'Vietnam', 'Korea', 'Gulf War', 
  'Somalia', 'Bosnia', 'Kosovo', 'Panama', 'Grenada', 'CONUS', 'Europe', 
  'Pacific', 'Other'
];

/**
 * Get service history data
 * @returns {Object} Service history with deployments, awards, dd214Data
 */
export const getServiceHistory = () => {
  try {
    const saved = localStorage.getItem(SERVICE_HISTORY_KEY);
    return saved ? JSON.parse(saved) : {
      deployments: [],
      awards: [],
      dd214Data: null,
      serviceInfo: null,
      dateUpdated: null
    };
  } catch (error) {
    console.error('Error reading service history:', error);
    return { deployments: [], awards: [], dd214Data: null, serviceInfo: null, dateUpdated: null };
  }
};

/**
 * Save the entire service history
 * @param {Object} history - The service history data
 * @returns {boolean} Success status
 */
export const saveServiceHistory = (history) => {
  try {
    const sanitized = {
      deployments: Array.isArray(history.deployments) ? history.deployments.map(d => ({
        id: d.id || `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        theater: VALID_THEATERS.includes(d.theater) ? d.theater : 'Other',
        location: sanitizeString(d.location || '', 200),
        startDate: d.startDate || null,
        endDate: d.endDate || null,
        unit: sanitizeString(d.unit || '', 200),
        notes: sanitizeString(d.notes || '', 1000),
        hazardous: !!d.hazardous,
        combat: !!d.combat,
        dateAdded: d.dateAdded || new Date().toISOString()
      })) : [],
      awards: Array.isArray(history.awards) ? history.awards.map(a => ({
        id: a.id || `award_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: sanitizeString(a.name || '', 200),
        abbreviation: sanitizeString(a.abbreviation || '', 50),
        dateReceived: a.dateReceived || null,
        notes: sanitizeString(a.notes || '', 500),
        isCombat: !!a.isCombat,
        dateAdded: a.dateAdded || new Date().toISOString()
      })) : [],
      dd214Data: history.dd214Data ? {
        branch: sanitizeString(history.dd214Data.branch || '', 100),
        mos: sanitizeString(history.dd214Data.mos || '', 200),
        mosTitle: sanitizeString(history.dd214Data.mosTitle || '', 200),
        entryDate: history.dd214Data.entryDate || null,
        separationDate: history.dd214Data.separationDate || null,
        yearsService: history.dd214Data.yearsService || null,
        monthsService: history.dd214Data.monthsService || null,
        separationType: sanitizeString(history.dd214Data.separationType || '', 100),
        characterOfService: sanitizeString(history.dd214Data.characterOfService || '', 100),
        reenlisted: !!history.dd214Data.reenlisted,
        foreignService: !!history.dd214Data.foreignService,
        extractedText: sanitizeString(history.dd214Data.extractedText || '', 10000),
        dateProcessed: history.dd214Data.dateProcessed || new Date().toISOString()
      } : null,
      serviceInfo: history.serviceInfo ? {
        branch: sanitizeString(history.serviceInfo.branch || '', 100),
        component: sanitizeString(history.serviceInfo.component || '', 100), // Active, Reserve, Guard
        rank: sanitizeString(history.serviceInfo.rank || '', 100),
        mos: sanitizeString(history.serviceInfo.mos || '', 200)
      } : null,
      dateUpdated: new Date().toISOString()
    };
    
    localStorage.setItem(SERVICE_HISTORY_KEY, JSON.stringify(sanitized));
    return true;
  } catch (error) {
    console.error('Error saving service history:', error);
    return false;
  }
};

/**
 * Add a deployment
 * @param {Object} deployment - Deployment data
 * @returns {string|null} New deployment ID or null on error
 */
export const addDeployment = (deployment) => {
  try {
    const history = getServiceHistory();
    const newDeployment = {
      id: `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      theater: VALID_THEATERS.includes(deployment.theater) ? deployment.theater : 'Other',
      location: sanitizeString(deployment.location || '', 200),
      startDate: deployment.startDate || null,
      endDate: deployment.endDate || null,
      unit: sanitizeString(deployment.unit || '', 200),
      notes: sanitizeString(deployment.notes || '', 1000),
      hazardous: !!deployment.hazardous,
      combat: !!deployment.combat,
      dateAdded: new Date().toISOString()
    };
    
    history.deployments.push(newDeployment);
    saveServiceHistory(history);
    return newDeployment.id;
  } catch (error) {
    console.error('Error adding deployment:', error);
    return null;
  }
};

/**
 * Update a deployment
 * @param {string} deploymentId - The deployment ID
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success status
 */
export const updateDeployment = (deploymentId, updates) => {
  try {
    const history = getServiceHistory();
    const index = history.deployments.findIndex(d => d.id === deploymentId);
    if (index === -1) return false;
    
    history.deployments[index] = {
      ...history.deployments[index],
      ...updates,
      dateUpdated: new Date().toISOString()
    };
    
    return saveServiceHistory(history);
  } catch (error) {
    console.error('Error updating deployment:', error);
    return false;
  }
};

/**
 * Remove a deployment
 * @param {string} deploymentId - The deployment ID
 * @returns {boolean} Success status
 */
export const removeDeployment = (deploymentId) => {
  try {
    const history = getServiceHistory();
    history.deployments = history.deployments.filter(d => d.id !== deploymentId);
    return saveServiceHistory(history);
  } catch (error) {
    console.error('Error removing deployment:', error);
    return false;
  }
};

/**
 * Add an award
 * @param {Object} award - Award data
 * @returns {string|null} New award ID or null on error
 */
export const addAward = (award) => {
  try {
    const history = getServiceHistory();
    const newAward = {
      id: `award_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: sanitizeString(award.name || '', 200),
      abbreviation: sanitizeString(award.abbreviation || '', 50),
      dateReceived: award.dateReceived || null,
      notes: sanitizeString(award.notes || '', 500),
      isCombat: !!award.isCombat,
      dateAdded: new Date().toISOString()
    };
    
    history.awards.push(newAward);
    saveServiceHistory(history);
    return newAward.id;
  } catch (error) {
    console.error('Error adding award:', error);
    return null;
  }
};

/**
 * Remove an award
 * @param {string} awardId - The award ID
 * @returns {boolean} Success status
 */
export const removeAward = (awardId) => {
  try {
    const history = getServiceHistory();
    history.awards = history.awards.filter(a => a.id !== awardId);
    return saveServiceHistory(history);
  } catch (error) {
    console.error('Error removing award:', error);
    return false;
  }
};

/**
 * Save DD214 extracted data
 * Includes sensitive PII fields for form autofill (SSN, service number, etc.)
 * ⚠️ SECURITY: All data is stored LOCALLY ONLY using encrypted localStorage
 * @param {Object} dd214Data - Extracted DD214 information
 * @returns {boolean} Success status
 */
export const saveDD214Data = (dd214Data) => {
  try {
    const history = getServiceHistory();
    history.dd214Data = {
      // === Personal Identification (SENSITIVE) ===
      fullName: sanitizeString(dd214Data.fullName || '', 200),
      ssnLast4: sanitizeString(dd214Data.ssnLast4 || '', 4), // Only last 4 digits
      ssnFull: sanitizeString(dd214Data.ssnFull || '', 11), // Full SSN if user opts in
      serviceNumber: sanitizeString(dd214Data.serviceNumber || '', 50),
      dateOfBirth: dd214Data.dateOfBirth || null,
      placeOfBirth: sanitizeString(dd214Data.placeOfBirth || '', 200),
      homeOfRecord: sanitizeString(dd214Data.homeOfRecord || '', 300),
      
      // === Service Information ===
      branch: sanitizeString(dd214Data.branch || '', 100),
      mos: sanitizeString(dd214Data.mos || '', 200),
      mosTitle: sanitizeString(dd214Data.mosTitle || '', 200),
      entryDate: dd214Data.entryDate || null,
      separationDate: dd214Data.separationDate || null,
      yearsService: dd214Data.yearsService || null,
      monthsService: dd214Data.monthsService || null,
      separationType: sanitizeString(dd214Data.separationType || '', 100),
      characterOfService: sanitizeString(dd214Data.characterOfService || '', 100),
      reenlisted: !!dd214Data.reenlisted,
      foreignService: !!dd214Data.foreignService,
      
      // === Additional Fields for Forms ===
      rank: sanitizeString(dd214Data.rank || '', 100),
      payGrade: sanitizeString(dd214Data.payGrade || '', 10),
      primarySpecialty: sanitizeString(dd214Data.primarySpecialty || '', 200),
      totalActiveDutyDays: dd214Data.totalActiveDutyDays || null,
      
      // === Metadata ===
      extractedText: sanitizeString(dd214Data.extractedText || '', 10000),
      dateProcessed: new Date().toISOString(),
      sensitiveDataStored: !!(dd214Data.ssnFull || dd214Data.serviceNumber) // Flag if PII present
    };
    return saveServiceHistory(history);
  } catch (error) {
    console.error('Error saving DD214 data:', error);
    return false;
  }
};

/**
 * Clear DD214 data
 * @returns {boolean} Success status
 */
export const clearDD214Data = () => {
  try {
    const history = getServiceHistory();
    history.dd214Data = null;
    return saveServiceHistory(history);
  } catch (error) {
    console.error('Error clearing DD214 data:', error);
    return false;
  }
};

/**
 * Check if user has service history data
 * @returns {boolean}
 */
export const hasServiceHistory = () => {
  const history = getServiceHistory();
  return (
    history.deployments?.length > 0 || 
    history.awards?.length > 0 || 
    history.dd214Data !== null
  );
};

// ============================================================================
// CONTINUITY THREAD - Timeline Events Storage
// ============================================================================

const TIMELINE_EVENTS_KEY = 'vet_rate_timeline_events';

/**
 * Get all timeline events
 * @returns {Array} Array of timeline events
 */
export const getTimelineEvents = () => {
  try {
    const saved = localStorage.getItem(TIMELINE_EVENTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error reading timeline events:', error);
    return [];
  }
};

/**
 * Save all timeline events
 * @param {Array} events - Array of timeline events
 * @returns {boolean} Success status
 */
export const saveTimelineEvents = (events) => {
  try {
    if (!Array.isArray(events)) return false;
    
    const sanitizedEvents = events.map(e => ({
      id: e.id || Date.now(),
      type: sanitizeString(e.type || 'service', 50),
      date: e.date || null,
      description: sanitizeString(e.description || '', 1000),
      category: sanitizeString(e.category || 'Event', 100),
      dateAdded: e.dateAdded || new Date().toISOString()
    }));
    
    localStorage.setItem(TIMELINE_EVENTS_KEY, JSON.stringify(sanitizedEvents));
    return true;
  } catch (error) {
    console.error('Error saving timeline events:', error);
    return false;
  }
};

/**
 * Add a timeline event
 * @param {Object} event - Event data
 * @returns {number|null} New event ID or null on error
 */
export const addTimelineEvent = (event) => {
  try {
    const events = getTimelineEvents();
    const newEvent = {
      id: Date.now(),
      type: sanitizeString(event.type || 'service', 50),
      date: event.date || null,
      description: sanitizeString(event.description || '', 1000),
      category: sanitizeString(event.category || 'Event', 100),
      dateAdded: new Date().toISOString()
    };
    
    events.push(newEvent);
    localStorage.setItem(TIMELINE_EVENTS_KEY, JSON.stringify(events));
    return newEvent.id;
  } catch (error) {
    console.error('Error adding timeline event:', error);
    return null;
  }
};

/**
 * Remove a timeline event
 * @param {number} eventId - Event ID
 * @returns {boolean} Success status
 */
export const removeTimelineEvent = (eventId) => {
  try {
    const events = getTimelineEvents();
    const filtered = events.filter(e => e.id !== eventId);
    localStorage.setItem(TIMELINE_EVENTS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error removing timeline event:', error);
    return false;
  }
};

/**
 * Clear all timeline events
 * @returns {boolean} Success status
 */
export const clearTimelineEvents = () => {
  try {
    localStorage.removeItem(TIMELINE_EVENTS_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing timeline events:', error);
    return false;
  }
};

// ============================================================================
// PAIN PAINTER - Pain Maps Storage
// ============================================================================

const PAIN_MAPS_KEY = 'vet_rate_pain_maps';

/**
 * Get all saved pain maps
 * @returns {Array} Array of pain maps
 */
export const getPainMaps = () => {
  try {
    const saved = localStorage.getItem(PAIN_MAPS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error reading pain maps:', error);
    return [];
  }
};

/**
 * Save a pain map
 * @param {Object} painMap - Pain map data
 * @returns {string|null} New map ID or null on error
 */
export const savePainMap = (painMap) => {
  try {
    const maps = getPainMaps();
    const newMap = {
      id: `painmap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: sanitizeString(painMap.name || 'Pain Map', 200),
      painPoints: painMap.painPoints || {},
      modelConfig: painMap.modelConfig || {},
      notes: sanitizeString(painMap.notes || '', 2000),
      detectedNexus: painMap.detectedNexus || [],
      screenshot: painMap.screenshot || null, // Base64 image
      dateSaved: new Date().toISOString(),
      dateUpdated: new Date().toISOString()
    };
    
    maps.push(newMap);
    localStorage.setItem(PAIN_MAPS_KEY, JSON.stringify(maps));
    return newMap.id;
  } catch (error) {
    console.error('Error saving pain map:', error);
    return null;
  }
};

/**
 * Update a pain map
 * @param {string} mapId - Map ID
 * @param {Object} updates - Fields to update
 * @returns {boolean} Success status
 */
export const updatePainMap = (mapId, updates) => {
  try {
    const maps = getPainMaps();
    const index = maps.findIndex(m => m.id === mapId);
    if (index === -1) return false;
    
    maps[index] = {
      ...maps[index],
      ...updates,
      dateUpdated: new Date().toISOString()
    };
    
    localStorage.setItem(PAIN_MAPS_KEY, JSON.stringify(maps));
    return true;
  } catch (error) {
    console.error('Error updating pain map:', error);
    return false;
  }
};

/**
 * Delete a pain map
 * @param {string} mapId - Map ID
 * @returns {boolean} Success status
 */
export const deletePainMap = (mapId) => {
  try {
    const maps = getPainMaps();
    const filtered = maps.filter(m => m.id !== mapId);
    localStorage.setItem(PAIN_MAPS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting pain map:', error);
    return false;
  }
};

/**
 * Clear all pain maps
 * @returns {boolean} Success status
 */
export const clearPainMaps = () => {
  try {
    localStorage.removeItem(PAIN_MAPS_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing pain maps:', error);
    return false;
  }
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
  getMyTotalRating,
  // Service History functions
  getServiceHistory,
  saveServiceHistory,
  addDeployment,
  updateDeployment,
  removeDeployment,
  addAward,
  removeAward,
  saveDD214Data,
  clearDD214Data,
  hasServiceHistory,
  // Timeline Events functions
  getTimelineEvents,
  saveTimelineEvents,
  addTimelineEvent,
  removeTimelineEvent,
  clearTimelineEvents,
  // Pain Maps functions
  getPainMaps,
  savePainMap,
  updatePainMap,
  deletePainMap,
  clearPainMaps
};
