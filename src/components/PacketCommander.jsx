/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 *
 * PacketCommander Component
 * User interface for generating claim cover sheets / table of contents
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { generateCoverSheet, generateCoverSheetHTML, autoDetectDocuments, downloadCoverSheet } from '../utils/packetCommander';
import { getSavedForms, getVeteranProfile } from '../utils/veteranProfile';

const PacketCommander = ({ onClose }) => {
  const { t } = useLanguage();
  
  // Lock background scroll when modal is open
  useBodyScrollLock(true);
  
  const [veteranProfile, setVeteranProfile] = useState({});
  const [documents, setDocuments] = useState([]);
  const [claimType, setClaimType] = useState('Initial Disability Claim');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHTML, setPreviewHTML] = useState('');

  // Load veteran profile and auto-detect documents
  useEffect(() => {
    const profile = getVeteranProfile();
    setVeteranProfile(profile);

    const saved = getSavedForms();
    const detected = autoDetectDocuments(saved);
    setDocuments(detected);
  }, []);

  const handleAddDocument = () => {
    const newDoc = {
      name: '',
      pages: 1,
      startPage: documents.length > 0 ? documents[documents.length - 1].endPage + 1 : 1,
      endPage: documents.length > 0 ? documents[documents.length - 1].endPage + 1 : 1,
      description: ''
    };
    setDocuments([...documents, newDoc]);
  };

  const handleUpdateDocument = (index, field, value) => {
    const updated = [...documents];
    updated[index][field] = value;
    
    // Auto-calculate endPage when pages changes
    if (field === 'pages') {
      const numPages = parseInt(value) || 1;
      updated[index].endPage = updated[index].startPage + numPages - 1;
    }
    
    // Recalculate page numbers for subsequent documents
    if (field === 'pages' || field === 'startPage') {
      for (let i = index + 1; i < updated.length; i++) {
        updated[i].startPage = updated[i - 1].endPage + 1;
        updated[i].endPage = updated[i].startPage + (updated[i].pages || 1) - 1;
      }
    }
    
    setDocuments(updated);
  };

  const handleRemoveDocument = (index) => {
    const updated = documents.filter((_, i) => i !== index);
    
    // Recalculate page numbers
    for (let i = 0; i < updated.length; i++) {
      if (i === 0) {
        updated[i].startPage = 1;
      } else {
        updated[i].startPage = updated[i - 1].endPage + 1;
      }
      updated[i].endPage = updated[i].startPage + (updated[i].pages || 1) - 1;
    }
    
    setDocuments(updated);
  };

  const handlePreview = () => {
    const veteranName = [
      veteranProfile.firstName,
      veteranProfile.middleInitial,
      veteranProfile.lastName,
      veteranProfile.suffix
    ].filter(Boolean).join(' ') || 'Veteran Name';

    const html = generateCoverSheetHTML({
      veteranName,
      ssn: veteranProfile.ssn || '',
      documents,
      claimType
    });

    setPreviewHTML(html);
    setShowPreview(true);
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const veteranName = [
        veteranProfile.firstName,
        veteranProfile.middleInitial,
        veteranProfile.lastName,
        veteranProfile.suffix
      ].filter(Boolean).join(' ') || 'Veteran Name';

      const pdfBytes = await generateCoverSheet({
        veteranName,
        ssn: veteranProfile.ssn || '',
        documents,
        claimType
      });

      downloadCoverSheet(pdfBytes, `Claim_Cover_Sheet_${new Date().toISOString().split('T')[0]}`);
    } catch (error) {
      console.error('Error generating cover sheet:', error);
      alert('Error generating cover sheet. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (showPreview) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cover Sheet Preview</h2>
            <button
              onClick={() => setShowPreview(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4">
            <iframe
              srcDoc={previewHTML}
              className="w-full h-full border-0 rounded bg-white"
              title="Cover Sheet Preview"
            />
          </div>
          
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowPreview(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
            >
              ← Back to Editor
            </button>
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="px-6 py-2 bg-va-blue hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-va-blue to-blue-800 dark:from-gray-800 dark:to-gray-900 text-white px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <h2 className="text-xl font-bold">Packet Commander <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">BETA</span></h2>
                <p className="text-blue-100 text-sm">Generate Claim Cover Sheet / Table of Contents</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  📑 Why Use a Cover Sheet?
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  VA raters review hundreds of claims. A professional Table of Contents helps them quickly navigate your evidence, 
                  increasing the chance of a favorable decision. <strong>An organized rater approves. A confused rater denies.</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Claim Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Claim Type
            </label>
            <select
              value={claimType}
              onChange={(e) => setClaimType(e.target.value)}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm"
            >
              <option value="Initial Disability Claim">Initial Disability Claim</option>
              <option value="Supplemental Claim">Supplemental Claim</option>
              <option value="Higher-Level Review">Higher-Level Review</option>
              <option value="Board Appeal">Board Appeal</option>
              <option value="Increase Claim">Claim for Increase</option>
              <option value="Secondary Service Connection">Secondary Service Connection</option>
            </select>
          </div>

          {/* Documents List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Documents in Your Packet ({documents.length} {documents.length === 1 ? 'item' : 'items'})
              </label>
              <button
                onClick={handleAddDocument}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Document
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400 mb-2">No documents added yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Click "Add Document" to start building your packet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map((doc, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-va-blue text-white rounded-lg flex items-center justify-center font-bold">
                        {String.fromCharCode(65 + index)}
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Document Name</label>
                            <input
                              type="text"
                              value={doc.name}
                              onChange={(e) => handleUpdateDocument(index, 'name', e.target.value)}
                              placeholder="e.g., Personal Statement"
                              className="w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Number of Pages</label>
                            <input
                              type="number"
                              value={doc.pages}
                              onChange={(e) => handleUpdateDocument(index, 'pages', parseInt(e.target.value) || 1)}
                              min="1"
                              className="w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Description (Optional)
                          </label>
                          <input
                            type="text"
                            value={doc.description || ''}
                            onChange={(e) => handleUpdateDocument(index, 'description', e.target.value)}
                            placeholder="e.g., Details service connection for knee injury"
                            className="w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>Pages {doc.startPage} - {doc.endPage}</span>
                          <button
                            onClick={() => handleRemoveDocument(index)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handlePreview}
              disabled={documents.length === 0}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview Cover Sheet
            </button>
            <button
              onClick={handleDownload}
              disabled={documents.length === 0 || isGenerating}
              className="flex-1 px-4 py-3 bg-va-blue hover:bg-blue-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PacketCommander;
