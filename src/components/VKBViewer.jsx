/**
 * Vet-Rate.org - Veteran Knowledge Base Viewer
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Visual interface for the Veteran Knowledge Base - shows all extracted
 * knowledge in an organized, editable format.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { useLanguage } from '../contexts/LanguageContext';
import {
  loadVKB,
  saveVKB,
  generateLLMContext,
  exportVKB,
  clearVKB,
} from '../utils/veteranKnowledgeBase';

const VKBViewer = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  useBodyScrollLock(isOpen);
  
  const [vkb, setVkb] = useState(null);
  const [activeSection, setActiveSection] = useState('personal');
  const [showLLMContext, setShowLLMContext] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      const loaded = loadVKB();
      setVkb(loaded);
    }
  }, [isOpen]);
  
  if (!isOpen || !vkb) return null;
  
  const handleSave = () => {
    const result = saveVKB(vkb);
    if (result.success) {
      setEditMode(false);
    }
  };
  
  const handleExport = () => {
    exportVKB();
  };
  
  const handleClear = () => {
    if (confirm('⚠️ This will delete your entire Knowledge Base. Are you sure?')) {
      const newVKB = clearVKB();
      setVkb(newVKB);
    }
  };
  
  const sections = [
    { id: 'personal', label: 'Personal Info', icon: '👤' },
    { id: 'service', label: 'Service History', icon: '🎖️' },
    { id: 'conditions', label: 'Medical Conditions', icon: '🏥' },
    { id: 'medications', label: 'Medications', icon: '💊' },
    { id: 'treatments', label: 'Treatments', icon: '🩺' },
    { id: 'evidence', label: 'Evidence Timeline', icon: '📅' },
    { id: 'documentation', label: 'Documents', icon: '📄' },
    { id: 'insights', label: 'AI Insights', icon: '🤖' },
  ];
  
  const renderPersonalSection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={vkb.personal.fullName || ''}
            onChange={(e) => setVkb({...vkb, personal: {...vkb.personal, fullName: e.target.value}})}
            disabled={!editMode}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date of Birth
          </label>
          <input
            type="date"
            value={vkb.personal.dateOfBirth || ''}
            onChange={(e) => setVkb({...vkb, personal: {...vkb.personal, dateOfBirth: e.target.value}})}
            disabled={!editMode}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            value={vkb.personal.email || ''}
            onChange={(e) => setVkb({...vkb, personal: {...vkb.personal, email: e.target.value}})}
            disabled={!editMode}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={vkb.personal.phone || ''}
            onChange={(e) => setVkb({...vkb, personal: {...vkb.personal, phone: e.target.value}})}
            disabled={!editMode}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
  
  const renderServiceSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Branch
          </label>
          <select
            value={vkb.serviceHistory.branch || ''}
            onChange={(e) => setVkb({...vkb, serviceHistory: {...vkb.serviceHistory, branch: e.target.value}})}
            disabled={!editMode}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:opacity-50"
          >
            <option value="">Select...</option>
            <option value="Army">Army</option>
            <option value="Navy">Navy</option>
            <option value="Air Force">Air Force</option>
            <option value="Marines">Marines</option>
            <option value="Coast Guard">Coast Guard</option>
            <option value="Space Force">Space Force</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Character of Service
          </label>
          <select
            value={vkb.serviceHistory.characterOfService || ''}
            onChange={(e) => setVkb({...vkb, serviceHistory: {...vkb.serviceHistory, characterOfService: e.target.value}})}
            disabled={!editMode}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:opacity-50"
          >
            <option value="">Select...</option>
            <option value="Honorable">Honorable</option>
            <option value="General Under Honorable Conditions">General Under Honorable Conditions</option>
            <option value="Other Than Honorable">Other Than Honorable</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Entry Date
          </label>
          <input
            type="date"
            value={vkb.serviceHistory.entryDate || ''}
            onChange={(e) => setVkb({...vkb, serviceHistory: {...vkb.serviceHistory, entryDate: e.target.value}})}
            disabled={!editMode}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Separation Date
          </label>
          <input
            type="date"
            value={vkb.serviceHistory.separationDate || ''}
            onChange={(e) => setVkb({...vkb, serviceHistory: {...vkb.serviceHistory, separationDate: e.target.value}})}
            disabled={!editMode}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:opacity-50"
          />
        </div>
      </div>
      
      {/* MOS List */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Military Occupational Specialties (MOS)
        </h4>
        {vkb.serviceHistory.mos.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 italic">No MOS records yet</p>
        ) : (
          <div className="space-y-2">
            {vkb.serviceHistory.mos.map((mos, idx) => (
              <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="font-semibold">{mos.code} - {mos.title}</div>
                {mos.hazards && mos.hazards.length > 0 && (
                  <div className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                    ⚠️ Hazards: {mos.hazards.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Awards */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Awards & Decorations
        </h4>
        {vkb.serviceHistory.awards.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 italic">No awards recorded yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {vkb.serviceHistory.awards.map((award, idx) => (
              <div key={idx} className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="font-medium">{award.name}</span>
                {award.isCombat && <span className="ml-2 text-red-600 dark:text-red-400">🎖️ Combat</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
  
  const renderConditionsSection = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Current Conditions
        </h4>
        {vkb.medicalConditions.current.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 italic">No conditions recorded yet</p>
        ) : (
          <div className="space-y-3">
            {vkb.medicalConditions.current.map((condition, idx) => (
              <div key={idx} className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-semibold text-gray-900 dark:text-gray-100">{condition.name}</h5>
                    {condition.diagnosisDate && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Diagnosed: {condition.diagnosisDate}
                      </p>
                    )}
                    {condition.ratedPercentage && (
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-1">
                        Rated: {condition.ratedPercentage}%
                      </p>
                    )}
                    {condition.source && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Source: {condition.source}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div>
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Secondary Conditions
        </h4>
        {vkb.medicalConditions.secondary.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 italic">No secondary conditions yet</p>
        ) : (
          <div className="space-y-2">
            {vkb.medicalConditions.secondary.map((sec, idx) => (
              <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="font-medium">{sec.condition}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Secondary to: {sec.primaryCondition}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
  
  const renderDocumentationSection = () => {
    const totalDocs = vkb.documentation.dd214s.length +
                      vkb.documentation.blueButtonReports.length +
                      vkb.documentation.cFiles.length +
                      vkb.documentation.privateRecords.length +
                      vkb.documentation.otherEvidence.length;
    
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalDocs}</div>
          <div className="text-sm text-blue-700 dark:text-blue-300">Documents in Knowledge Base</div>
        </div>
        
        {vkb.documentation.dd214s.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">DD-214s ({vkb.documentation.dd214s.length})</h4>
            <div className="space-y-2">
              {vkb.documentation.dd214s.map((doc, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{doc.fileName}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(doc.uploadDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {vkb.documentation.blueButtonReports.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Blue Button Reports ({vkb.documentation.blueButtonReports.length})
            </h4>
            <div className="space-y-2">
              {vkb.documentation.blueButtonReports.map((doc, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{doc.recordCount} medical records</span>
                    <span className="text-sm text-gray-500">
                      {new Date(doc.uploadDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const renderInsightsSection = () => (
    <div className="space-y-6">
      {vkb.aiInsights.strengthsOfClaim.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-3">
            ✅ Strengths of Your Claim
          </h4>
          <div className="space-y-2">
            {vkb.aiInsights.strengthsOfClaim.map((strength, idx) => (
              <div key={idx} className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="font-semibold">{strength.condition}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{strength.reasons.join(', ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {vkb.aiInsights.missingEvidence.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-amber-700 dark:text-amber-400 mb-3">
            ⚠️ Missing Evidence
          </h4>
          <div className="space-y-2">
            {vkb.aiInsights.missingEvidence.map((missing, idx) => (
              <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="font-semibold">{missing.condition}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Need: {missing.evidenceType}
                </div>
                {missing.howToObtain && (
                  <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    How: {missing.howToObtain}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {vkb.aiInsights.suggestedSecondaries.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-purple-700 dark:text-purple-400 mb-3">
            💡 Suggested Secondary Conditions
          </h4>
          <div className="space-y-2">
            {vkb.aiInsights.suggestedSecondaries.map((suggestion, idx) => (
              <div key={idx} className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="font-semibold">{suggestion.secondaryCondition}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Secondary to: {suggestion.primaryCondition}
                </div>
                {suggestion.rationale && (
                  <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    {suggestion.rationale}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {vkb.aiInsights.strengthsOfClaim.length === 0 &&
       vkb.aiInsights.missingEvidence.length === 0 &&
       vkb.aiInsights.suggestedSecondaries.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-4">🤖</div>
          <p className="text-lg font-medium mb-2">No AI Insights Yet</p>
          <p className="text-sm">
            Upload documents and use AI tools to generate personalized insights
          </p>
        </div>
      )}
    </div>
  );
  
  const renderSection = () => {
    switch (activeSection) {
      case 'personal': return renderPersonalSection();
      case 'service': return renderServiceSection();
      case 'conditions': return renderConditionsSection();
      case 'documentation': return renderDocumentationSection();
      case 'insights': return renderInsightsSection();
      default: return <div>Section not implemented yet</div>;
    }
  };
  
  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              📚 Veteran Knowledge Base
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Completeness: {vkb.metadata.completeness}% • {vkb.metadata.documentCount} documents
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  💾 Save
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                ✏️ Edit
              </button>
            )}
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              📥 Export
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar Navigation */}
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-r-2 border-blue-600'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-xl">{section.icon}</span>
                <span className="font-medium">{section.label}</span>
              </button>
            ))}
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderSection()}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {vkb.metadata.lastUpdated ? new Date(vkb.metadata.lastUpdated).toLocaleString() : 'Never'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLLMContext(!showLLMContext)}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {showLLMContext ? 'Hide' : 'Show'} LLM Context
            </button>
            <button
              onClick={handleClear}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Clear All Data
            </button>
          </div>
        </div>
        
        {/* LLM Context Preview Modal */}
        {showLLMContext && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">LLM Context String</h3>
                <button
                  onClick={() => setShowLLMContext(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-xs overflow-x-auto">
                {generateLLMContext(vkb)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default VKBViewer;
