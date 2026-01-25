/**
 * SupplyLocker.org - File Nomenclature Utility
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "The Quartermaster" - Automatic file renaming to VA standards
 * 
 * The Problem: Veterans upload files named "Scan_2024.jpeg" and the VA loses them.
 * The Fix: Standardized naming convention that tells the VA Rater exactly what the file is.
 * 
 * Format: [YYYY-MM-DD]_[VeteranName]_[DocType]_[Condition].pdf
 * Example: 2026-01-18_JohnDoe_PersonalStatement_Tinnitus.pdf
 */

/**
 * Document types recognized by the VA
 */
export const DOC_TYPES = {
  PERSONAL_STATEMENT: 'PersonalStatement',
  BUDDY_STATEMENT: 'BuddyStatement',
  NEXUS_LETTER: 'NexusLetter',
  MEDICAL_RECORD: 'MedicalRecord',
  PRESCRIPTION: 'Prescription',
  LAB_RESULT: 'LabResult',
  XRAY_IMAGING: 'XrayImaging',
  DIAGNOSIS: 'Diagnosis',
  TREATMENT_RECORD: 'TreatmentRecord',
  SERVICE_RECORD: 'ServiceRecord',
  DD214: 'DD214',
  VA_FORM: 'VAForm',
  DBQ: 'DBQ',
  RATING_DECISION: 'RatingDecision',
  DENIAL_LETTER: 'DenialLetter',
  APPEAL: 'Appeal',
  EMPLOYMENT_RECORD: 'EmploymentRecord',
  OTHER: 'Other'
};

/**
 * Clean a filename for safe filesystem use
 * Removes special characters, normalizes spaces
 */
const sanitizeFilename = (text) => {
  if (!text) return 'Unknown';
  
  return text
    .trim()
    .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special chars except space, dash, underscore
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Trim leading/trailing underscores
    .substring(0, 50); // Limit length to prevent overly long filenames
};

/**
 * Format date to YYYY-MM-DD
 */
const formatDate = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get file extension from filename or default to pdf
 */
const getFileExtension = (filename) => {
  if (!filename) return 'pdf';
  const ext = filename.split('.').pop()?.toLowerCase();
  const validExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'tif', 'tiff'];
  return validExtensions.includes(ext) ? ext : 'pdf';
};

/**
 * Generate a standardized VA-friendly filename
 * 
 * @param {Object} options - Configuration object
 * @param {string} options.veteranName - Veteran's name (first and last)
 * @param {string} options.docType - Document type (use DOC_TYPES constants)
 * @param {string} options.condition - Condition name (e.g., "Tinnitus", "PTSD")
 * @param {Date|string} options.date - Date for the file (defaults to today)
 * @param {string} options.originalFilename - Original filename (for preserving extension)
 * @param {string} options.suffix - Optional suffix for versioning (e.g., "v2", "Revised")
 * @returns {string} Standardized filename
 * 
 * @example
 * generateVAFilename({
 *   veteranName: "John Doe",
 *   docType: DOC_TYPES.PERSONAL_STATEMENT,
 *   condition: "Tinnitus",
 *   originalFilename: "my-file.pdf"
 * })
 * // Returns: "2026-01-18_JohnDoe_PersonalStatement_Tinnitus.pdf"
 */
export const generateVAFilename = (options) => {
  const {
    veteranName = 'Veteran',
    docType = DOC_TYPES.OTHER,
    condition = '',
    date = new Date(),
    originalFilename = '',
    suffix = ''
  } = options;

  // Build filename parts
  const parts = [
    formatDate(date),
    sanitizeFilename(veteranName),
    docType
  ];

  // Add condition if provided
  if (condition && condition.trim()) {
    parts.push(sanitizeFilename(condition));
  }

  // Add suffix if provided
  if (suffix && suffix.trim()) {
    parts.push(sanitizeFilename(suffix));
  }

  // Get extension
  const extension = getFileExtension(originalFilename);

  // Join with underscores
  return `${parts.join('_')}.${extension}`;
};

/**
 * Rename a File object with VA-standard naming
 * Returns a new File object with the standardized name
 * 
 * @param {File} file - Original file object
 * @param {Object} options - Same options as generateVAFilename
 * @returns {File} New File object with standardized name
 */
export const renameFile = (file, options) => {
  if (!file) return null;

  const newFilename = generateVAFilename({
    ...options,
    originalFilename: file.name
  });

  // Create new File object with same content but new name
  return new File([file], newFilename, {
    type: file.type,
    lastModified: file.lastModified
  });
};

/**
 * Batch rename multiple files
 * Useful for renaming all documents in a packet at once
 * 
 * @param {Array<{file: File, options: Object}>} filesWithOptions - Array of file/options pairs
 * @returns {Array<File>} Array of renamed files
 */
export const batchRenameFiles = (filesWithOptions) => {
  return filesWithOptions.map(({ file, options }) => renameFile(file, options));
};

/**
 * Generate a suggested filename based on context
 * Attempts to intelligently determine docType and condition from existing data
 * 
 * @param {File} file - Original file
 * @param {Object} context - Context object
 * @param {string} context.veteranName - Veteran's name
 * @param {string} context.currentCondition - Currently selected condition
 * @param {string} context.statementType - Type of statement being generated
 * @returns {string} Suggested filename
 */
export const suggestFilename = (file, context = {}) => {
  const {
    veteranName,
    currentCondition,
    statementType
  } = context;

  // Try to detect document type from filename or context
  let docType = DOC_TYPES.OTHER;
  const lowerName = file.name.toLowerCase();

  if (lowerName.includes('nexus') || lowerName.includes('imr') || lowerName.includes('imo')) {
    docType = DOC_TYPES.NEXUS_LETTER;
  } else if (lowerName.includes('buddy') || lowerName.includes('witness') || lowerName.includes('lay')) {
    docType = DOC_TYPES.BUDDY_STATEMENT;
  } else if (lowerName.includes('statement') || statementType === 'personal') {
    docType = DOC_TYPES.PERSONAL_STATEMENT;
  } else if (lowerName.includes('dd214') || lowerName.includes('dd-214')) {
    docType = DOC_TYPES.DD214;
  } else if (lowerName.includes('rating') || lowerName.includes('decision')) {
    docType = DOC_TYPES.RATING_DECISION;
  } else if (lowerName.includes('medical') || lowerName.includes('record')) {
    docType = DOC_TYPES.MEDICAL_RECORD;
  } else if (lowerName.includes('xray') || lowerName.includes('x-ray') || lowerName.includes('mri') || lowerName.includes('ct')) {
    docType = DOC_TYPES.XRAY_IMAGING;
  } else if (lowerName.includes('prescription') || lowerName.includes('rx')) {
    docType = DOC_TYPES.PRESCRIPTION;
  }

  return generateVAFilename({
    veteranName,
    docType,
    condition: currentCondition,
    originalFilename: file.name
  });
};

/**
 * Parse a VA-standard filename back into its components
 * Useful for understanding what a file contains without opening it
 * 
 * @param {string} filename - VA-standard filename
 * @returns {Object|null} Parsed components or null if not in standard format
 */
export const parseVAFilename = (filename) => {
  // Expected format: YYYY-MM-DD_VeteranName_DocType_Condition_Suffix.ext
  const withoutExt = filename.split('.')[0];
  const parts = withoutExt.split('_');

  if (parts.length < 3) {
    return null; // Not in standard format
  }

  const [date, veteranName, docType, ...rest] = parts;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  return {
    date,
    veteranName,
    docType,
    condition: rest.length > 0 ? rest.slice(0, -1).join('_') : null,
    suffix: rest.length > 1 ? rest[rest.length - 1] : null,
    extension: filename.split('.').pop()
  };
};

/**
 * Check if a filename follows VA standard format
 * 
 * @param {string} filename - Filename to check
 * @returns {boolean} True if follows standard format
 */
export const isStandardVAFilename = (filename) => {
  return parseVAFilename(filename) !== null;
};

/**
 * Generate a download filename for in-app generated documents
 * Convenience wrapper that handles common use cases
 * 
 * @param {string} documentType - Type of document (statement, nexus, buddy, etc)
 * @param {Object} claimData - Claim data object
 * @returns {string} Standardized filename
 */
export const generateDownloadFilename = (documentType, claimData = {}) => {
  const { conditionName, veteranName, claimType } = claimData;

  const typeMap = {
    personal: DOC_TYPES.PERSONAL_STATEMENT,
    buddy: DOC_TYPES.BUDDY_STATEMENT,
    witness: DOC_TYPES.BUDDY_STATEMENT,
    nexus: DOC_TYPES.NEXUS_LETTER,
    medical: DOC_TYPES.MEDICAL_RECORD,
    packet: DOC_TYPES.OTHER
  };

  const docType = typeMap[documentType?.toLowerCase()] || DOC_TYPES.OTHER;

  return generateVAFilename({
    veteranName: veteranName || 'Veteran',
    docType,
    condition: conditionName,
    suffix: claimType
  });
};

/**
 * Add versioning to an existing filename
 * If file exists, append v2, v3, etc.
 * 
 * @param {string} baseFilename - Base filename
 * @param {number} version - Version number
 * @returns {string} Versioned filename
 */
export const addVersionToFilename = (baseFilename, version = 2) => {
  const parsed = parseVAFilename(baseFilename);
  
  if (!parsed) {
    // Not in standard format, just append version before extension
    const parts = baseFilename.split('.');
    const ext = parts.pop();
    return `${parts.join('.')}_v${version}.${ext}`;
  }

  // Rebuild with version suffix
  return generateVAFilename({
    veteranName: parsed.veteranName,
    docType: parsed.docType,
    condition: parsed.condition,
    date: parsed.date,
    suffix: `v${version}`,
    originalFilename: baseFilename
  });
};

/**
 * Hook into PDF/Word export functions
 * This function can be called before triggering a download
 * 
 * @param {Blob} blob - Document blob
 * @param {string} suggestedName - Original suggested filename
 * @param {Object} context - Document context
 * @returns {Object} { blob, filename } ready for download
 */
export const prepareDocumentForDownload = (blob, suggestedName, context = {}) => {
  const filename = context.useStandard !== false 
    ? generateDownloadFilename(context.documentType, context.claimData)
    : suggestedName;

  return { blob, filename };
};

export default {
  DOC_TYPES,
  generateVAFilename,
  renameFile,
  batchRenameFiles,
  suggestFilename,
  parseVAFilename,
  isStandardVAFilename,
  generateDownloadFilename,
  addVersionToFilename,
  prepareDocumentForDownload
};
