/**
 * SupplyLocker.org - Intelligence Briefing (Field Review)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Post-document-drop review modal where veterans review ALL extracted
 * information before it's committed to My Packet. Think of it as the
 * "Intel Brief" before the mission - one last chance to verify, edit,
 * and resolve discrepancies.
 * 
 * Military Term: "Intelligence Briefing" - Pre-mission review of all intel
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import {
  loadVKB,
  saveVKB,
  mergeMusterCallIntoVKB,
} from '../utils/veteranKnowledgeBase';

/**
 * Intelligence Briefing - Field Review Modal
 * Shows all extracted data from Muster Call for review/editing
 * 
 * @param {boolean} isOpen - Whether modal is visible
 * @param {function} onClose - Callback when modal closes
 * @param {object} extractedData - All data extracted from documents
 * @param {function} onConfirm - Callback when veteran confirms data (commits to My Packet)
 * @param {function} onEdit - Callback when veteran edits a field
 */
export default function IntelligenceBriefing({ 
  isOpen, 
  onClose, 
  extractedData = {},
  onConfirm,
  onEdit
}) {
  const { t } = useLanguage();
  useBodyScrollLock(isOpen);

  const [editableData, setEditableData] = useState(extractedData);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [activeSection, setActiveSection] = useState('personal');
  const [showDiscardWarning, setShowDiscardWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEditableData(extractedData);
      // Analyze for discrepancies
      const found = findDiscrepancies(extractedData);
      setDiscrepancies(found);
    }
  }, [isOpen, extractedData]);

  /**
   * Find discrepancies in extracted data
   * (e.g., conflicting dates, multiple values for same field)
   */
  const findDiscrepancies = (data) => {
    const issues = [];
    
    // Check for multiple DOBs
    if (data.dob && Array.isArray(data.dob) && data.dob.length > 1) {
      issues.push({
        field: 'dob',
        type: 'multiple_values',
        values: data.dob,
        message: 'Found multiple dates of birth in documents'
      });
    }

    // Check for multiple service dates
    if (data.serviceStart && Array.isArray(data.serviceStart) && data.serviceStart.length > 1) {
      issues.push({
        field: 'serviceStart',
        type: 'multiple_values',
        values: data.serviceStart,
        message: 'Multiple service start dates detected'
      });
    }

    // Check for conflicting disability ratings
    if (data.conditions && Array.isArray(data.conditions)) {
      const ratingConflicts = {};
      data.conditions.forEach(cond => {
        if (cond.rating && ratingConflicts[cond.name]) {
          if (ratingConflicts[cond.name] !== cond.rating) {
            issues.push({
              field: `condition_${cond.name}`,
              type: 'conflicting_ratings',
              values: [ratingConflicts[cond.name], cond.rating],
              message: `"${cond.name}" has conflicting ratings`
            });
          }
        }
        if (cond.rating) ratingConflicts[cond.name] = cond.rating;
      });
    }

    return issues;
  };

  /**
   * Handle field edit
   */
  const handleFieldEdit = (section, field, value) => {
    const updated = { ...editableData };
    if (!updated[section]) updated[section] = {};
    updated[section][field] = value;
    setEditableData(updated);
    
    if (onEdit) {
      onEdit(section, field, value);
    }
  };

  /**
   * Handle resolving a discrepancy
   */
  const resolveDiscrepancy = (discrepancy, chosenValue) => {
    const updated = { ...editableData };
    updated[discrepancy.field] = chosenValue;
    setEditableData(updated);
    
    // Remove from discrepancies list
    setDiscrepancies(prev => prev.filter(d => d.field !== discrepancy.field));
  };

  /**
   * Confirm and commit to My Packet
   */
  const handleConfirm = () => {
    if (discrepancies.length > 0) {
      const proceed = window.confirm(
        `⚠️ You have ${discrepancies.length} unresolved discrepancy(ies). Proceed anyway?`
      );
      if (!proceed) return;
    }

    // Build Veteran Knowledge Base from extracted data
    try {
      let vkb = loadVKB();
      vkb = mergeMusterCallIntoVKB(vkb, editableData);
      saveVKB(vkb);
      console.log('✅ VKB updated with Muster Call data');
    } catch (err) {
      console.error('Error updating VKB:', err);
      // Don't block confirmation if VKB fails
    }

    if (onConfirm) {
      onConfirm(editableData);
    }
  };

  /**
   * Sections for the briefing
   */
  const sections = [
    { id: 'personal', label: '👤 Personal Info', icon: '🪪' },
    { id: 'service', label: '🎖️ Service History', icon: '🎖️' },
    { id: 'conditions', label: '🏥 Conditions', icon: '🏥' },
    { id: 'medical', label: '📋 Medical Records', icon: '📋' },
    { id: 'documents', label: '📄 Documents', icon: '📄' },
  ];

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border-2 border-amber-500/30">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <span className="text-4xl">📋</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Intelligence Briefing
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded uppercase">CLASSIFIED</span>
              </h2>
              <p className="text-amber-100 text-sm">
                Review all extracted data before committing to your packet
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowDiscardWarning(true)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Discrepancies Warning */}
        {discrepancies.length > 0 && (
          <div className="bg-red-900/30 border-b-2 border-red-500 px-6 py-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-pulse">⚠️</span>
              <div>
                <p className="font-bold text-red-200">
                  {discrepancies.length} Discrepancy(ies) Detected
                </p>
                <p className="text-sm text-red-300">
                  Multiple values found for some fields. Review and select the correct one.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex h-[calc(90vh-180px)]">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-slate-800/50 border-r border-slate-700 p-4 overflow-y-auto">
            <p className="text-xs text-slate-400 uppercase font-bold mb-3">Briefing Sections</p>
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-3 rounded-lg mb-2 transition-all flex items-center gap-3 ${
                  activeSection === section.id
                    ? 'bg-amber-500 text-white font-bold'
                    : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <span className="text-xl">{section.icon}</span>
                <span className="text-sm">{section.label}</span>
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-slate-900/30">
            {/* Discrepancies Section */}
            {discrepancies.length > 0 && (
              <div className="mb-6 p-4 bg-red-900/20 border-2 border-red-500/50 rounded-xl">
                <h3 className="text-lg font-bold text-red-200 mb-3">
                  🚨 Resolve Discrepancies First
                </h3>
                {discrepancies.map((disc, idx) => (
                  <div key={idx} className="mb-4 p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-sm font-bold text-white mb-2">{disc.message}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {disc.values.map((value, vIdx) => (
                        <button
                          key={vIdx}
                          onClick={() => resolveDiscrepancy(disc, value)}
                          className="p-3 bg-slate-700 hover:bg-amber-500 text-white rounded-lg text-left transition-all"
                        >
                          <p className="font-mono text-sm">{value}</p>
                          <p className="text-xs text-slate-400 mt-1">Click to select</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dynamic content based on active section */}
            {activeSection === 'personal' && (
              <div>
                <h3 className="text-xl font-bold text-white mb-4">👤 Personal Information</h3>
                <div className="space-y-4">
                  <Field
                    label="Full Name"
                    value={editableData.fullName || ''}
                    onChange={(val) => handleFieldEdit('personal', 'fullName', val)}
                  />
                  <Field
                    label="Date of Birth"
                    value={editableData.dob || ''}
                    onChange={(val) => handleFieldEdit('personal', 'dob', val)}
                    type="date"
                  />
                  <Field
                    label="SSN (Last 4)"
                    value={editableData.ssnLast4 || ''}
                    onChange={(val) => handleFieldEdit('personal', 'ssnLast4', val)}
                    maxLength={4}
                  />
                  <Field
                    label="VA File Number"
                    value={editableData.vaFileNumber || ''}
                    onChange={(val) => handleFieldEdit('personal', 'vaFileNumber', val)}
                  />
                </div>
              </div>
            )}

            {activeSection === 'service' && (
              <div>
                <h3 className="text-xl font-bold text-white mb-4">🎖️ Service History</h3>
                <div className="space-y-4">
                  <Field
                    label="Branch"
                    value={editableData.branch || ''}
                    onChange={(val) => handleFieldEdit('service', 'branch', val)}
                  />
                  <Field
                    label="Service Start Date"
                    value={editableData.serviceStart || ''}
                    onChange={(val) => handleFieldEdit('service', 'serviceStart', val)}
                    type="date"
                  />
                  <Field
                    label="Service End Date"
                    value={editableData.serviceEnd || ''}
                    onChange={(val) => handleFieldEdit('service', 'serviceEnd', val)}
                    type="date"
                  />
                  <Field
                    label="Character of Service"
                    value={editableData.characterOfService || ''}
                    onChange={(val) => handleFieldEdit('service', 'characterOfService', val)}
                  />
                </div>
              </div>
            )}

            {activeSection === 'conditions' && (
              <div>
                <h3 className="text-xl font-bold text-white mb-4">🏥 Service-Connected Conditions</h3>
                {editableData.conditions && editableData.conditions.length > 0 ? (
                  <div className="space-y-3">
                    {editableData.conditions.map((condition, idx) => (
                      <div key={idx} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-bold text-white">{condition.name}</p>
                            <p className="text-sm text-slate-400">{condition.diagnosticCode || 'No code'}</p>
                          </div>
                          <span className="px-3 py-1 bg-blue-500 text-white font-bold rounded-full">
                            {condition.rating}%
                          </span>
                        </div>
                        {condition.effectiveDate && (
                          <p className="text-xs text-slate-400">Effective: {condition.effectiveDate}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No conditions extracted from documents</p>
                )}
              </div>
            )}

            {/* Add more sections as needed */}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 border-t border-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <p className="text-sm font-bold text-white">
                {Object.keys(editableData).length} Fields Extracted
              </p>
              <p className="text-xs text-slate-400">
                {discrepancies.length > 0 
                  ? `${discrepancies.length} discrepancies remaining`
                  : 'All clear - ready to commit'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDiscardWarning(true)}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <span>✅</span>
              <span>Commit to My Packet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Discard Warning Modal */}
      {showDiscardWarning && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md border-2 border-red-500">
            <h3 className="text-xl font-bold text-white mb-3">⚠️ Discard Changes?</h3>
            <p className="text-slate-300 mb-4">
              You haven't committed this data to your packet yet. If you close now, 
              all extracted information will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDiscardWarning(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Keep Editing
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
              >
                Discard & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}

/**
 * Reusable field component
 */
function Field({ label, value, onChange, type = 'text', maxLength }) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className="w-full px-4 py-2 bg-slate-800 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    </div>
  );
}
