/**
 * SupplyLocker.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Data Backup Utility - "The Bunker"
 * Complete export/import system for all localStorage data
 * Prevents data loss from cache clearing or device changes
 */

// Schema version for future compatibility
const SCHEMA_VERSION = '1.0.0';

// All localStorage keys used by SupplyLocker.org
const STORAGE_KEYS = [
  'vet_rate_saved_claims',
  'vet_rate_statements',
  'vet_rate_veteran_profile',
  'vet_rate_saved_forms',
  'vet_rate_my_ratings',
  'vetrate-helper-mode',
  'vetrate-helper-tooltips',
  'vetrate-disclaimer-acknowledged',
  'SupplyLocker-theme',
  'SupplyLocker-color-blind-mode',
  'SupplyLocker-reduced-motion',
  'SupplyLocker-font-size',
  'vetrate-mobile-notice-dismissed'
];

/**
 * Export all localStorage data to a JSON object
 * @returns {Object} Complete backup object with version and timestamp
 */
export const exportData = () => {
  try {
    const backup = {
      schemaVersion: SCHEMA_VERSION,
      exportDate: new Date().toISOString(),
      appVersion: '1.0',
      data: {}
    };

    // Collect all data from localStorage
    STORAGE_KEYS.forEach(key => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        backup.data[key] = value;
      }
    });

    // Add metadata
    backup.metadata = {
      totalKeys: Object.keys(backup.data).length,
      browser: navigator.userAgent,
      platform: navigator.platform
    };

    return backup;
  } catch (error) {
    console.error('Error exporting data:', error);
    throw new Error('Failed to export data. Please try again.');
  }
};

/**
 * Download backup as a JSON file
 * @param {Object} backupData - The backup object to download
 * @param {string} filename - Optional custom filename
 */
export const downloadBackup = (backupData, filename = null) => {
  try {
    const date = new Date().toISOString().split('T')[0];
    const defaultFilename = `SupplyLocker-bunker-backup-${date}.json`;
    const finalFilename = filename || defaultFilename;

    const json = JSON.stringify(backupData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Error downloading backup:', error);
    throw new Error('Failed to download backup file.');
  }
};

/**
 * Validate backup data structure
 * @param {Object} backupData - The backup object to validate
 * @returns {Object} Validation result with success flag and message
 */
export const validateBackup = (backupData) => {
  try {
    // Check if it's valid JSON object
    if (!backupData || typeof backupData !== 'object') {
      return {
        success: false,
        message: 'Invalid backup file format. Please select a valid SupplyLocker backup file.'
      };
    }

    // Check for required fields
    if (!backupData.schemaVersion) {
      return {
        success: false,
        message: 'This file is missing version information. It may not be a valid SupplyLocker backup.'
      };
    }

    if (!backupData.data || typeof backupData.data !== 'object') {
      return {
        success: false,
        message: 'Backup file is corrupted or incomplete.'
      };
    }

    // Version compatibility check
    const [majorVersion] = backupData.schemaVersion.split('.');
    const [currentMajorVersion] = SCHEMA_VERSION.split('.');

    if (majorVersion !== currentMajorVersion) {
      return {
        success: false,
        message: `This backup is from an incompatible version (${backupData.schemaVersion}). Current version: ${SCHEMA_VERSION}`
      };
    }

    return {
      success: true,
      message: 'Backup file is valid',
      metadata: backupData.metadata
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error validating backup file: ' + error.message
    };
  }
};

/**
 * Import data from backup object
 * @param {Object} backupData - The backup object to import
 * @param {boolean} merge - If true, merge with existing data. If false, replace.
 * @returns {Object} Import result with success flag and stats
 */
export const importData = (backupData, merge = false) => {
  try {
    // Validate first
    const validation = validateBackup(backupData);
    if (!validation.success) {
      throw new Error(validation.message);
    }

    let importedKeys = 0;
    let skippedKeys = 0;

    // Import each key
    Object.entries(backupData.data).forEach(([key, value]) => {
      try {
        if (merge) {
          // In merge mode, only import if key doesn't exist
          if (localStorage.getItem(key) === null) {
            localStorage.setItem(key, value);
            importedKeys++;
          } else {
            skippedKeys++;
          }
        } else {
          // In replace mode, overwrite everything
          localStorage.setItem(key, value);
          importedKeys++;
        }
      } catch (error) {
        console.error(`Error importing key ${key}:`, error);
        skippedKeys++;
      }
    });

    return {
      success: true,
      importedKeys,
      skippedKeys,
      totalKeys: Object.keys(backupData.data).length,
      exportDate: backupData.exportDate,
      message: merge 
        ? `Successfully imported ${importedKeys} items (${skippedKeys} skipped due to existing data).`
        : `Successfully imported ${importedKeys} items.`
    };
  } catch (error) {
    console.error('Error importing data:', error);
    return {
      success: false,
      message: error.message || 'Failed to import backup data.'
    };
  }
};

/**
 * Parse uploaded file and return backup object
 * @param {File} file - The uploaded file
 * @returns {Promise<Object>} The parsed backup object
 */
export const parseBackupFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const backup = JSON.parse(text);
        resolve(backup);
      } catch (error) {
        reject(new Error('Failed to parse backup file. Please ensure it is a valid JSON file.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read backup file.'));
    };

    reader.readAsText(file);
  });
};

/**
 * Clear all SupplyLocker data from localStorage (nuclear option)
 * @returns {number} Number of keys cleared
 */
export const clearAllData = () => {
  let clearedKeys = 0;
  
  STORAGE_KEYS.forEach(key => {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      clearedKeys++;
    }
  });

  return clearedKeys;
};

/**
 * Get storage statistics
 * @returns {Object} Statistics about current localStorage usage
 */
export const getStorageStats = () => {
  try {
    let totalSize = 0;
    const keyStats = [];

    STORAGE_KEYS.forEach(key => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        const size = new Blob([value]).size;
        totalSize += size;
        keyStats.push({
          key,
          size,
          sizeKB: (size / 1024).toFixed(2)
        });
      }
    });

    return {
      totalKeys: keyStats.length,
      totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      keys: keyStats.sort((a, b) => b.size - a.size) // Sort by size descending
    };
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return null;
  }
};
