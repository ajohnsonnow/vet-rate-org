/**
 * Vet-Rate.org - Certification Checkbox Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Legal certification checkbox that gates download/print functionality
 * Ensures user acknowledges they have reviewed AI-generated content
 */

import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const CertificationCheckbox = ({ 
  checked, 
  onChange, 
  disabled = false,
  className = '' 
}) => {
  const { t } = useLanguage();
  return (
    <div className={`bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 ${className}`}>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="mt-1 w-5 h-5 text-blue-600 border-2 border-blue-400 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex-1">
          <p className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-1">
            ✓ Required Certification
          </p>
          <p className="text-xs text-blue-800 dark:text-blue-300">
            I certify that I have reviewed this document and it reflects my own testimony and truth. 
            I understand this is an educational tool and I am responsible for verifying all information 
            before submitting to the VA.
          </p>
        </div>
      </label>
    </div>
  );
};

export default CertificationCheckbox;
