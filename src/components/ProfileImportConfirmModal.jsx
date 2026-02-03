/**
 * Vet-Rate.org - Profile Import Confirmation Modal
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Shows extracted DD214/PDF data before auto-filling Veteran Profile
 * Prevents accidental overwriting of existing information
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

/**
 * Profile Import Confirmation Modal
 * Shows extracted data with side-by-side comparison and selective import
 */
const ProfileImportConfirmModal = ({ 
  extractedData, 
  currentProfile, 
  onConfirm, 
  onCancel 
}) => {
  const { t } = useLanguage();
  useBodyScrollLock(true);
  
  const [editableData, setEditableData] = useState({});
  const [selectedFields, setSelectedFields] = useState({});

  // Initialize with extracted data
  useEffect(() => {
    if (extractedData) {
      setEditableData({ ...extractedData });
      
      // Auto-select fields that are new or different
      const autoSelected = {};
      Object.keys(extractedData).forEach(key => {
        // Select if current profile doesn't have this field, or if values differ
        if (!currentProfile[key] || currentProfile[key] !== extractedData[key]) {
          autoSelected[key] = true;
        }
      });
      setSelectedFields(autoSelected);
    }
  }, [extractedData, currentProfile]);

  /**
   * Update a field value
   */
  const handleFieldChange = (field, value) => {
    setEditableData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Toggle field selection
   */
  const handleFieldToggle = (field) => {
    setSelectedFields(prev => ({ 
      ...prev, 
      [field]: prev[field] === true ? false : true 
    }));
  };

  /**
   * Select all fields
   */
  const handleSelectAll = () => {
    const allSelected = {};
    Object.keys(editableData).forEach(key => {
      allSelected[key] = true;
    });
    setSelectedFields(allSelected);
  };

  /**
   * Deselect all fields
   */
  const handleSelectNone = () => {
    setSelectedFields({});
  };

  /**
   * Confirm import - only save selected fields
   */
  const handleConfirm = () => {
    const fieldsToImport = {};
    Object.keys(selectedFields).forEach(key => {
      if (selectedFields[key] && editableData[key]) {
        fieldsToImport[key] = editableData[key];
      }
    });
    onConfirm(fieldsToImport);
  };

  // Field labels for display
  const fieldLabels = {
    // Personal Information (Blocks 1-7)
    firstName: 'First Name',
    middleInitial: 'Middle Initial',
    middleName: 'Middle Name',
    lastName: 'Last Name',
    fullName: 'Full Name',
    dob: 'Date of Birth',
    dateOfBirth: 'Date of Birth',
    ssnLast4: 'SSN (Last 4)',
    ssnFull: 'SSN (Full)',
    serviceNumber: 'Service Number',
    vaFileNumber: 'VA File Number',
    placeOfBirth: 'Place of Birth',
    homeOfRecord: 'Home of Record',
    
    // Service Information (Blocks 2, 4a-4c, 17)
    branch: 'Branch of Service',
    component: 'Component',
    componentFull: 'Component (Full Name)',
    rank: 'Rank',
    payGrade: 'Pay Grade',
    dateOfRank: 'Date of Rank',
    
    // MOS & Assignments (Blocks 4b, 8, 9, 11)
    mos: 'MOS/Rating',
    mosTitle: 'MOS Title',
    primarySpecialty: 'Primary Specialty',
    lastDutyAssignment: 'Last Duty Assignment',
    commandTransferredTo: 'Command Transferred To',
    
    // Service Dates (Blocks 12a-12e)
    serviceStartDate: 'Service Start Date',
    entryDate: 'Entry Date',
    serviceEndDate: 'Separation Date',
    separationDate: 'Separation Date',
    netActiveService: 'Net Active Service',
    totalPriorActiveService: 'Total Prior Active Service',
    totalPriorInactiveService: 'Total Prior Inactive Service',
    yearsService: 'Years of Service',
    monthsService: 'Months of Service',
    daysService: 'Days of Service',
    totalActiveDutyDays: 'Total Active Duty Days',
    
    // Benefits & Obligations (Blocks 10, 26-29)
    sglCoverage: 'SGLI Coverage',
    giBlStatus: 'Post-9/11 GI Bill Status',
    reserveObligationDate: 'Reserve Obligation End Date',
    daysLost: 'Days Lost',
    foreignService: 'Foreign Service',
    foreignServiceDetails: 'Foreign Service Details',
    seaService: 'Sea Service',
    
    // Separation Info (Blocks 19-25)
    separationAuthority: 'Separation Authority',
    separationCode: 'Separation Code (SPD/SPN)',
    reentryCode: 'Reentry Code (RE)',
    separationProgramDesignator: 'Separation Program Designator',
    separationType: 'Type of Separation',
    characterOfService: 'Character of Service',
    narrativeReason: 'Narrative Reason for Separation',
    
    // Education & Training (Blocks 14, 15)
    militaryEducation: 'Military Education',
    memberRequests: 'Member Requests',
    
    // Contact (Block 30)
    homeAddress: 'Home Address at Separation',
    email: 'Email',
    phone: 'Phone',
    alternatePhone: 'Alternate Phone',
    street: 'Street Address',
    city: 'City',
    state: 'State',
    zip: 'ZIP Code',
    
    // Combat & Qualifications
    specialQualifications: 'Special Qualifications',
    securityClearance: 'Security Clearance',
    
    // Legacy
    reenlisted: 'Re-enlisted',
  };

  /**
   * Get field label
   */
  const getFieldLabel = (field) => {
    return fieldLabels[field] || field.replace(/([A-Z])/g, ' $1').trim();
  };

  /**
   * Format field value for display
   */
  const formatValue = (field, value) => {
    if (value === null || value === undefined || value === '') return '(empty)';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    
    // Handle service time objects
    if (typeof value === 'object' && value.years !== undefined) {
      const years = value.years || 0;
      const months = value.months || 0;
      const days = value.days || 0;
      return `${years}y ${months}m ${days}d`;
    }
    
    // Handle arrays (like militaryEducation)
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : '(none)';
    }
    
    return String(value);
  };

  /**
   * Categorize fields
   */
  const categorizeFields = () => {
    const categories = {
      personal: [],
      service: [],
      contact: [],
      other: []
    };

    const personalFields = [
      'firstName', 'middleInitial', 'middleName', 'lastName', 'fullName', 
      'dob', 'dateOfBirth', 'ssnLast4', 'ssnFull', 'serviceNumber', 'vaFileNumber', 
      'placeOfBirth', 'homeOfRecord'
    ];
    const serviceFields = [
      'branch', 'component', 'componentFull', 'rank', 'payGrade', 'dateOfRank',
      'mos', 'mosTitle', 'primarySpecialty', 'lastDutyAssignment', 'commandTransferredTo',
      'serviceStartDate', 'entryDate', 'serviceEndDate', 'separationDate',
      'netActiveService', 'totalPriorActiveService', 'totalPriorInactiveService',
      'yearsService', 'monthsService', 'daysService', 'totalActiveDutyDays',
      'sglCoverage', 'giBlStatus', 'reserveObligationDate', 'daysLost', 
      'foreignService', 'foreignServiceDetails', 'seaService',
      'separationAuthority', 'separationCode', 'reentryCode', 
      'separationProgramDesignator', 'separationType', 'characterOfService', 'narrativeReason',
      'militaryEducation', 'memberRequests',
      'specialQualifications', 'securityClearance', 'reenlisted'
    ];
    const contactFields = ['homeAddress', 'email', 'phone', 'alternatePhone', 'street', 'city', 'state', 'zip'];

    Object.keys(editableData).forEach(field => {
      if (personalFields.includes(field)) {
        categories.personal.push(field);
      } else if (serviceFields.includes(field)) {
        categories.service.push(field);
      } else if (contactFields.includes(field)) {
        categories.contact.push(field);
      } else {
        categories.other.push(field);
      }
    });

    return categories;
  };

  const categories = categorizeFields();
  const selectedCount = Object.values(selectedFields).filter(Boolean).length;
  const totalCount = Object.keys(editableData).length;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📋 Review Imported Profile Data
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Review and edit information before saving to your Veteran Profile
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Warning Banner */}
        <div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <span>
              <strong>Important:</strong> Review the extracted information below. Uncheck any fields you don't want to update. 
              Fields already in your profile that differ from the imported data are pre-selected for your review.
            </span>
          </p>
        </div>

        {/* Selection Controls */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <strong className="text-gray-900 dark:text-white">{selectedCount}</strong> of <strong className="text-gray-900 dark:text-white">{totalCount}</strong> fields selected for import
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/70 rounded transition-colors"
            >
              ✓ Select All
            </button>
            <button
              onClick={handleSelectNone}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 rounded transition-colors"
            >
              ✗ Select None
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Personal Information */}
          {categories.personal.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                👤 Personal Information
              </h3>
              <div className="space-y-3">
                {categories.personal.map(field => (
                  <FieldRow
                    key={field}
                    field={field}
                    label={getFieldLabel(field)}
                    currentValue={formatValue(field, currentProfile[field])}
                    importedValue={editableData[field]}
                    isSelected={selectedFields[field]}
                    onToggle={() => handleFieldToggle(field)}
                    onChange={(value) => handleFieldChange(field, value)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Service Information */}
          {categories.service.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                🎖️ Service Information
              </h3>
              <div className="space-y-3">
                {categories.service.map(field => (
                  <FieldRow
                    key={field}
                    field={field}
                    label={getFieldLabel(field)}
                    currentValue={formatValue(field, currentProfile[field])}
                    importedValue={editableData[field]}
                    isSelected={selectedFields[field]}
                    onToggle={() => handleFieldToggle(field)}
                    onChange={(value) => handleFieldChange(field, value)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Contact Information */}
          {categories.contact.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                📞 Contact Information
              </h3>
              <div className="space-y-3">
                {categories.contact.map(field => (
                  <FieldRow
                    key={field}
                    field={field}
                    label={getFieldLabel(field)}
                    currentValue={formatValue(field, currentProfile[field])}
                    importedValue={editableData[field]}
                    isSelected={selectedFields[field]}
                    onToggle={() => handleFieldToggle(field)}
                    onChange={(value) => handleFieldChange(field, value)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Fields */}
          {categories.other.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                📝 Other Information
              </h3>
              <div className="space-y-3">
                {categories.other.map(field => (
                  <FieldRow
                    key={field}
                    field={field}
                    label={getFieldLabel(field)}
                    currentValue={formatValue(field, currentProfile[field])}
                    importedValue={editableData[field]}
                    isSelected={selectedFields[field]}
                    onToggle={() => handleFieldToggle(field)}
                    onChange={(value) => handleFieldChange(field, value)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors"
          >
            ✗ Cancel Import
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedCount === 0 ? (
                <span className="text-red-600 dark:text-red-400 font-semibold">⚠️ No fields selected</span>
              ) : (
                <span>Ready to import {selectedCount} field{selectedCount !== 1 ? 's' : ''}</span>
              )}
            </span>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className={`px-6 py-2.5 font-semibold rounded-lg transition-colors ${
                selectedCount === 0
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              ✓ Import Selected Fields
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Field Row Component - Shows current vs imported value with checkbox
 */
const FieldRow = ({ field, label, currentValue, importedValue, isSelected, onToggle, onChange }) => {
  // Helper function must be defined before use
  const formatValue = (field, value) => {
    if (value === null || value === undefined || value === '') return '(empty)';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  const hasChange = currentValue !== formatValue(field, importedValue) && currentValue !== '(empty)';
  const isBooleanField = typeof importedValue === 'boolean';

  return (
    <div className={`p-3 rounded-lg border ${
      isSelected 
        ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    } transition-all`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className="pt-1">
          <input
            type="checkbox"
            checked={isSelected === true}
            onChange={onToggle}
            className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        {/* Field Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <label className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {label}
              {hasChange && (
                <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded">
                  Changed
                </span>
              )}
            </label>
          </div>

          {/* Value Comparison */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Value:</div>
              <div className="px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 break-words">
                {currentValue}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Imported Value:</div>
              {isBooleanField ? (
                <select
                  value={importedValue ? 'true' : 'false'}
                  onChange={(e) => onChange(e.target.value === 'true')}
                  disabled={!isSelected}
                  className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white disabled:opacity-50"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={importedValue || ''}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={!isSelected}
                  className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white disabled:opacity-50"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileImportConfirmModal;
