/**
 * Vet-Rate.org - DD214 Form Builder
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Manual DD214 entry form - allows veterans to type/paste DD214 information
 * into structured fields and save multiple DD214s to My Packet
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { saveDD214Data, getServiceHistory, getVeteranProfile } from '../utils/veteranProfile';

// DD214 Block field definitions with tooltips
const DD214_FIELDS = {
  personal: {
    title: 'Personal Information (Blocks 1-3)',
    fields: [
      { id: 'fullName', label: 'Name', block: '1', placeholder: 'Last, First, Middle', required: true },
      { id: 'ssnLast4', label: 'SSN (Last 4)', block: '2', placeholder: 'XXXX', maxLength: 4 },
      { id: 'dateOfBirth', label: 'Date of Birth', block: '3a', type: 'date' },
      { id: 'placeOfBirth', label: 'Place of Birth', block: '3b', placeholder: 'City, State' },
      { id: 'homeOfRecord', label: 'Home of Record', block: '3c', placeholder: 'City, State' }
    ]
  },
  service: {
    title: 'Service Information (Blocks 4-10)',
    fields: [
      { id: 'branch', label: 'Branch of Service', block: '4', type: 'select', options: ['Army', 'Navy', 'Air Force', 'Marines', 'Coast Guard', 'Space Force'], required: true },
      { id: 'rank', label: 'Grade/Rank', block: '4a', placeholder: 'E-5, O-3, etc.' },
      { id: 'payGrade', label: 'Pay Grade', block: '4a', placeholder: 'E-5' },
      { id: 'mos', label: 'MOS/AFSC/Rating', block: '4b/5', placeholder: '11B, 0311, HM, etc.', required: true },
      { id: 'mosTitle', label: 'Primary Specialty', block: '11', placeholder: 'Infantry, Corpsman, etc.' },
      { id: 'serviceNumber', label: 'Service Number', block: '6', placeholder: 'Optional' }
    ]
  },
  dates: {
    title: 'Service Dates (Blocks 12-14)',
    fields: [
      { id: 'entryDate', label: 'Date Entered Active Duty', block: '12a', type: 'date', required: true },
      { id: 'separationDate', label: 'Separation Date', block: '12b', type: 'date', required: true },
      { id: 'yearsService', label: 'Years of Service', block: '12c', type: 'number', placeholder: '0' },
      { id: 'monthsService', label: 'Months of Service', block: '12c', type: 'number', placeholder: '0' },
      { id: 'totalActiveDutyDays', label: 'Total Active Service', block: '12d', type: 'number', placeholder: 'Days' }
    ]
  },
  awards: {
    title: 'Awards & Decorations (Block 13)',
    fields: [
      { id: 'awards', label: 'Awards and Decorations', block: '13', type: 'textarea', placeholder: 'List all awards, medals, and decorations (one per line or comma-separated)', rows: 6 }
    ]
  },
  separation: {
    title: 'Separation Details (Blocks 23-28)',
    fields: [
      { id: 'characterOfService', label: 'Character of Service', block: '24', type: 'select', options: ['Honorable', 'General (Under Honorable)', 'Other Than Honorable', 'Bad Conduct', 'Dishonorable'], required: true },
      { id: 'separationType', label: 'Type of Separation', block: '25/26', type: 'select', options: ['Retirement', 'ETS (Expiration of Service)', 'Medical Retirement', 'Medical Separation', 'Hardship', 'Disability', 'Voluntary', 'Involuntary', 'Other'] },
      { id: 'reenlisted', label: 'Reenlisted', block: '27', type: 'checkbox' },
      { id: 'foreignService', label: 'Foreign Service', block: '20', type: 'checkbox' }
    ]
  },
  remarks: {
    title: 'Remarks & Additional Information (Block 18)',
    fields: [
      { id: 'remarks', label: 'Remarks', block: '18', type: 'textarea', placeholder: 'Additional service details, awards continuation, special qualifications, etc.', rows: 4 }
    ]
  }
};

/**
 * DD214 Form Builder Component
 */
const DD214FormBuilder = ({ onClose, onSave }) => {
  useBodyScrollLock(true);

  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentSection, setCurrentSection] = useState('personal');
  const [savedDD214s, setSavedDD214s] = useState([]);

  // Load existing DD214s from service history
  useEffect(() => {
    const history = getServiceHistory();
    const dd214s = history.dd214s || [];
    setSavedDD214s(dd214s);
  }, []);

  // Auto-calculate service time when dates change
  useEffect(() => {
    if (formData.entryDate && formData.separationDate) {
      const entry = new Date(formData.entryDate);
      const sep = new Date(formData.separationDate);
      const diffTime = Math.abs(sep - entry);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      
      setFormData(prev => ({
        ...prev,
        yearsService: years,
        monthsService: months,
        totalActiveDutyDays: diffDays
      }));
    }
  }, [formData.entryDate, formData.separationDate]);

  const handleInputChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSave = async () => {
    // Validate required fields
    const requiredFields = [];
    Object.values(DD214_FIELDS).forEach(section => {
      section.fields.forEach(field => {
        if (field.required && !formData[field.id]) {
          requiredFields.push(field.label);
        }
      });
    });

    if (requiredFields.length > 0) {
      alert(`Please fill in required fields:\n- ${requiredFields.join('\n- ')}`);
      return;
    }

    setIsSaving(true);
    try {
      // Save to service history
      const history = getServiceHistory();
      
      // Initialize dd214s array if it doesn't exist
      if (!history.dd214s) {
        history.dd214s = [];
      }

      // Create DD214 entry with timestamp
      const dd214Entry = {
        ...formData,
        id: `dd214_${Date.now()}`,
        dateAdded: new Date().toISOString(),
        source: 'manual-entry',
        formName: `DD214 - ${formData.fullName || 'Untitled'} (${formData.separationDate || 'No date'})`
      };

      // Add to array
      history.dd214s.push(dd214Entry);

      // Also save the most recent one as the primary dd214Data (for backwards compatibility)
      if (!history.dd214Data || new Date(formData.separationDate) > new Date(history.dd214Data.separationDate)) {
        history.dd214Data = dd214Entry;
      }

      // Save to localStorage
      localStorage.setItem('veteranProfile', JSON.stringify({ serviceHistory: history }));

      setSaveSuccess(true);
      setSavedDD214s(history.dd214s);

      if (onSave) {
        onSave(dd214Entry);
      }

      // Reset form after 2 seconds
      setTimeout(() => {
        setFormData({});
        setSaveSuccess(false);
        setCurrentSection('personal');
      }, 2000);

    } catch (error) {
      console.error('Error saving DD214:', error);
      alert('Error saving DD214. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (field) => {
    const value = formData[field.id] || '';

    if (field.type === 'select') {
      return (
        <select
          value={value}
          onChange={(e) => handleInputChange(field.id, e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select {field.label}</option>
          {field.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => handleInputChange(field.id, e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
        </label>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          value={value}
          onChange={(e) => handleInputChange(field.id, e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows || 3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none"
        />
      );
    }

    // Default: text/date/number input
    return (
      <input
        type={field.type || 'text'}
        value={value}
        onChange={(e) => handleInputChange(field.id, e.target.value)}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
      />
    );
  };

  const sections = Object.keys(DD214_FIELDS);
  const currentSectionIndex = sections.indexOf(currentSection);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📋 Build My DD214
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manually enter your DD214 information • {savedDD214s.length} DD214{savedDD214s.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {sections.map((section, index) => (
              <React.Fragment key={section}>
                <button
                  onClick={() => setCurrentSection(section)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                    currentSection === section
                      ? 'bg-blue-600 text-white'
                      : index < currentSectionIndex
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {DD214_FIELDS[section].title.split(' ')[0]}
                </button>
                {index < sections.length - 1 && (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="mx-6 mt-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-semibold">DD214 saved to My Packet!</span>
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {DD214_FIELDS[currentSection].title}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Enter information as it appears on your DD214. <span className="text-red-500">*</span> = Required field
            </p>
          </div>

          <div className="space-y-4">
            {DD214_FIELDS[currentSection].fields.map(field => (
              <div key={field.id}>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                  {field.block && (
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                      (Block {field.block})
                    </span>
                  )}
                </label>
                {renderField(field)}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex gap-2">
            {currentSectionIndex > 0 && (
              <button
                onClick={() => setCurrentSection(sections[currentSectionIndex - 1])}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
              >
                ← Previous
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {currentSectionIndex < sections.length - 1 ? (
              <button
                onClick={() => setCurrentSection(sections[currentSectionIndex + 1])}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : '💾 Save to My Packet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DD214FormBuilder;
