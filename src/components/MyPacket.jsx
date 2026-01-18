/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import jsPDF from 'jspdf';
import { 
  getSavedClaims, 
  removeClaim, 
  clearAllClaims, 
  updateClaimStatus,
  getStatement,
  getClaimStats,
  getAllStatements,
  importClaims,
  importStatements
} from '../utils/claimsStorage';
import { exportPacketData, importPacketData, downloadPacketBackup, exportCompletePacket, importCompletePacket } from '../utils/packetBackup';
import { getSavedForms, deleteSavedForm, getVeteranProfile } from '../utils/veteranProfile';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import BuyMeCoffee from './BuyMeCoffee';
import ReportBugLink from './ReportBugLink';

const MyPacket = ({ onResume, onClose, onReportBug }) => {
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({ total: 0, drafting: 0, statementGenerated: 0, filed: 0 });
  const [viewingStatement, setViewingStatement] = useState(null);
  const [viewingClaimId, setViewingClaimId] = useState(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [showImportConfirm, setShowImportConfirm] = useState(null);
  const [backupCreated, setBackupCreated] = useState(false);
  const fileInputRef = useRef(null);
  
  // Tab state for Claims vs Forms view
  const [activeTab, setActiveTab] = useState('claims');
  const [savedForms, setSavedForms] = useState([]);
  const [viewingForm, setViewingForm] = useState(null);

  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  useEffect(() => {
    loadClaims();
    loadSavedForms();
  }, []);
  
  const loadSavedForms = () => {
    const forms = getSavedForms();
    setSavedForms(forms);
  };
  
  const handleRemoveForm = (formId) => {
    if (window.confirm('Are you sure you want to remove this form from your packet?')) {
      deleteSavedForm(formId);
      loadSavedForms();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDownloadMenu && !event.target.closest('.relative')) {
        setShowDownloadMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDownloadMenu]);

  const loadClaims = () => {
    const savedClaims = getSavedClaims();
    setClaims(savedClaims);
    setStats(getClaimStats());
  };

  const handleRemove = (claimId) => {
    if (window.confirm('Are you sure you want to remove this claim from your packet?')) {
      removeClaim(claimId);
      loadClaims();
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all saved claims? This cannot be undone.')) {
      clearAllClaims();
      loadClaims();
    }
  };

  // Backup COMPLETE packet to JSON file (includes profile and forms)
  const handleBackupPacket = () => {
    const statements = getAllStatements();
    const veteranProfile = getVeteranProfile();
    const forms = getSavedForms();
    const exportData = exportCompletePacket(claims, statements, veteranProfile, forms);
    downloadPacketBackup(exportData, `vet-rate-complete-backup-${new Date().toISOString().split('T')[0]}.json`);
    setImportStatus({ type: 'success', message: `Complete backup created with ${claims.length} claims, ${forms.length} forms, and your profile` });
    setBackupCreated(true);
    setTimeout(() => setImportStatus(null), 4000);
  };

  // Trigger file input for restore
  const handleRestoreClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file selection for restore
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.json')) {
      setImportStatus({ type: 'error', message: 'Invalid file type. Please select a .json backup file.' });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setImportStatus({ type: 'error', message: 'File too large. Maximum size is 5MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      // Use complete import to handle profile and forms too
      const result = importCompletePacket(e.target.result);
      
      if (!result.success) {
        setImportStatus({ type: 'error', message: result.error });
        return;
      }

      // Show confirmation dialog with preview
      setShowImportConfirm({
        data: result.data,
        meta: result.meta
      });
    };
    
    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'Failed to read file.' });
    };
    
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  // Confirm and execute import (handles complete backups with profile and forms)
  const handleConfirmImport = (mergeMode) => {
    const { data } = showImportConfirm;
    
    const claimSuccess = importClaims(data.claims, mergeMode);
    const statementSuccess = importStatements(data.statements, mergeMode);
    
    // Import veteran profile if present
    if (data.veteranProfile && Object.keys(data.veteranProfile).length > 0) {
      try {
        localStorage.setItem('vet_rate_veteran_profile', JSON.stringify(data.veteranProfile));
      } catch (e) {
        console.error('Error importing profile:', e);
      }
    }
    
    // Import saved forms if present
    if (data.savedForms && Array.isArray(data.savedForms) && data.savedForms.length > 0) {
      try {
        if (mergeMode === 'merge') {
          const existingForms = getSavedForms();
          const existingIds = new Set(existingForms.map(f => f.id));
          const newForms = data.savedForms.filter(f => !existingIds.has(f.id));
          localStorage.setItem('vet_rate_saved_forms', JSON.stringify([...existingForms, ...newForms]));
        } else {
          localStorage.setItem('vet_rate_saved_forms', JSON.stringify(data.savedForms));
        }
        loadSavedForms();
      } catch (e) {
        console.error('Error importing forms:', e);
      }
    }
    
    if (claimSuccess && statementSuccess) {
      const parts = [`${data.claims.length} claims`];
      if (data.savedForms?.length) parts.push(`${data.savedForms.length} forms`);
      if (data.veteranProfile && Object.keys(data.veteranProfile).length > 0) parts.push('profile');
      
      setImportStatus({ 
        type: 'success', 
        message: `Successfully ${mergeMode === 'merge' ? 'merged' : 'restored'} ${parts.join(', ')}` 
      });
      loadClaims();
    } else {
      setImportStatus({ type: 'error', message: 'Import failed. Please try again.' });
    }
    
    setShowImportConfirm(null);
    setTimeout(() => setImportStatus(null), 4000);
  };

  const handleStatusChange = (claimId, newStatus) => {
    // Prevent changing to 'Statement Generated' if no statement exists
    if (newStatus === 'Statement Generated') {
      const statement = getStatement(claimId);
      if (!statement) {
        alert('Cannot mark as "Statement Generated" - no statement found. Please complete the Build Statement process first.');
        return;
      }
    }
    
    updateClaimStatus(claimId, newStatus);
    loadClaims();
  };

  const handleViewStatement = (claimId) => {
    const statement = getStatement(claimId);
    if (statement) {
      setViewingStatement(statement);
      setViewingClaimId(claimId);
    } else {
      alert('No statement found for this claim. Please build a statement first.');
    }
  };

  const handleDownloadStatement = (claim, format = 'txt') => {
    const statement = getStatement(claim.id);
    
    if (!statement) {
      alert('No statement found for this claim. Please build a statement first.');
      return;
    }

    const fileName = `VA-Statement-${claim.conditionName.replace(/\s+/g, '-')}`;
    
    switch (format) {
      case 'txt':
        downloadAsTxt(statement, fileName);
        break;
      case 'docx':
        downloadAsDocx(statement, fileName, claim);
        break;
      case 'pdf':
        downloadAsPdf(statement, fileName, claim);
        break;
      default:
        downloadAsTxt(statement, fileName);
    }
    
    setShowDownloadMenu(null);
  };

  const downloadAsTxt = (statement, fileName) => {
    const content = statement.statement + '\n\n---\n\nDOCTOR\'S CHEAT SHEET\n\n' + statement.doctorNote;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsDocx = async (statement, fileName, claim) => {
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: 'STATEMENT IN SUPPORT OF CLAIM',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            new Paragraph({
              text: `Condition: ${claim.conditionName}`,
              spacing: { after: 200 }
            }),
            ...statement.statement.split('\n').map(line => 
              new Paragraph({
                children: [new TextRun(line)],
                spacing: { after: 100 }
              })
            ),
            new Paragraph({
              text: '',
              spacing: { after: 400 }
            }),
            new Paragraph({
              text: 'DOCTOR\'S CHEAT SHEET',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            ...statement.doctorNote.split('\n').map(line => 
              new Paragraph({
                children: [new TextRun(line)],
                spacing: { after: 100 }
              })
            )
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating DOCX:', error);
      alert('Error generating Word document. Please try another format.');
    }
  };

  const downloadAsPdf = (statement, fileName, claim) => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const maxWidth = pageWidth - (margin * 2);
      let yPosition = 20;

      // Title
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('STATEMENT IN SUPPORT OF CLAIM', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Condition
      pdf.setFontSize(11);
      pdf.text(`Condition: ${claim.conditionName}`, margin, yPosition);
      yPosition += 10;

      // Statement content
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(10);
      const statementLines = pdf.splitTextToSize(statement.statement, maxWidth);
      statementLines.forEach(line => {
        if (yPosition > pdf.internal.pageSize.getHeight() - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });

      // Doctor's note section
      yPosition += 10;
      if (yPosition > pdf.internal.pageSize.getHeight() - 40) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text('DOCTOR\'S CHEAT SHEET', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(10);
      const doctorLines = pdf.splitTextToSize(statement.doctorNote, maxWidth);
      doctorLines.forEach(line => {
        if (yPosition > pdf.internal.pageSize.getHeight() - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });

      pdf.save(`${fileName}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try another format.');
    }
  };

  const handleEditStatement = () => {
    if (viewingClaimId) {
      const claim = claims.find(c => c.id === viewingClaimId);
      if (claim && onResume) {
        setViewingStatement(null);
        setViewingClaimId(null);
        onResume(claim);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Drafting':
        return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700';
      case 'Statement Generated':
        return 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-100 border-blue-300 dark:border-blue-700';
      case 'Filed':
        return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-100 border-green-300 dark:border-green-700';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="my-packet-title"
    >
      <div className="min-h-screen px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl mx-auto modal-content">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4 sm:px-6 py-4 sm:py-6 rounded-t-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 id="my-packet-title" className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">📁 My Claim Packet</h2>
                <p className="text-indigo-100 text-sm sm:text-base">
                  Manage your saved claims and generated statements
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="My Claim Packet" />}
                <button
                  onClick={onClose}
                  className="p-1 text-white hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Statistics Dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">📊 Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-yellow-600 dark:text-yellow-400">{stats.drafting}</div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">✏️ Drafting</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.statementGenerated}</div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">✅ Ready</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{stats.filed}</div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">🏆 Filed</div>
            </div>
          </div>

          {/* Backup/Restore Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-3 bg-gray-100 dark:bg-gray-850 border-b dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={handleBackupPacket}
                disabled={claims.length === 0}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Backup
              </button>
              <button
                onClick={handleRestoreClick}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-xs sm:text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Restore
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".json"
                className="hidden"
                aria-label="Select backup file"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center sm:text-right">
              💡 Backup to transfer between devices
            </p>
          </div>

          {/* Import Status Message */}
          {importStatus && (
            <div className={`mx-6 mt-4 px-4 py-3 rounded-lg flex items-center gap-2 ${
              importStatus.type === 'success' 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-100' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-100'
            }`}>
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                {importStatus.type === 'success' ? (
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                )}
              </svg>
              <span className="text-sm font-medium">{importStatus.message}</span>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6">
            <nav className="flex gap-4" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('claims')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'claims'
                    ? 'border-va-blue text-va-blue dark:border-va-gold dark:text-va-gold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  📋 Claims <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full">{claims.length}</span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('forms')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'forms'
                    ? 'border-va-blue text-va-blue dark:border-va-gold dark:text-va-gold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  📄 Saved Forms <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full">{savedForms.length}</span>
                </span>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* FORMS TAB */}
            {activeTab === 'forms' && (
              <>
                {savedForms.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">📄 No Saved Forms</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Use the Forms Helper to create and save VA forms like buddy statements, personal statements, and more!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedForms.map((form) => (
                      <div
                        key={form.id}
                        className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-5 hover:border-purple-300 dark:hover:border-purple-500 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">
                                {form.title || form.formName || 'Untitled Form'}
                              </h3>
                              <span className="px-2 sm:px-3 py-1 text-xs font-semibold rounded-full border bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-100 border-purple-300 dark:border-purple-700 whitespace-nowrap">
                                {form.formNumber || form.formType || 'Form'}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {form.formName}
                            </p>
                            
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Saved: {new Date(form.dateSaved).toLocaleDateString()}
                              {form.dateUpdated && ` • Updated: ${new Date(form.dateUpdated).toLocaleDateString()}`}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setViewingForm(form)}
                              className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleRemoveForm(form.id)}
                              className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* CLAIMS TAB */}
            {activeTab === 'claims' && (
              <>
                {claims.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">📂 No Saved Claims</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Start by exploring the Secondary Scout to find potential claims
                    </p>
                    <button
                      onClick={onClose}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      Explore Secondary Scout
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Claims List */}
                    <div className="space-y-4 mb-6">
                      {claims.map((claim) => (
                        <div
                      key={claim.id}
                      className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-5 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all overflow-hidden"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">
                              {claim.conditionName}
                            </h3>
                            <span className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${getStatusColor(claim.status)}`}>
                              {claim.status}
                            </span>
                          </div>
                          
                          {claim.parentCondition && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              Secondary to: <span className="font-semibold">{claim.parentCondition}</span>
                            </p>
                          )}
                          
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Saved: {new Date(claim.dateSaved).toLocaleDateString()}
                            {claim.dateUpdated && ` • Updated: ${new Date(claim.dateUpdated).toLocaleDateString()}`}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
                          {/* Status Dropdown */}
                          <select
                            value={claim.status}
                            onChange={(e) => handleStatusChange(claim.id, e.target.value)}
                            className="w-full sm:w-auto px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 col-span-2 sm:col-span-1"
                          >
                            <option value="Drafting">Drafting</option>
                            <option value="Statement Generated">Statement Generated</option>
                            <option value="Filed">Filed</option>
                          </select>

                          {/* Resume/View Statement Button */}
                          {claim.status === 'Drafting' ? (
                            <button
                              onClick={() => onResume(claim)}
                              className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-xs sm:text-sm"
                            >
                              Build Statement
                            </button>
                          ) : (
                            <button
                              onClick={() => handleViewStatement(claim.id)}
                              className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-xs sm:text-sm"
                            >
                              View Statement
                            </button>
                          )}

                          {/* Download Button with Format Options */}
                          {claim.status !== 'Drafting' && (
                            <div className="relative w-full sm:w-auto">
                              <button
                                onClick={() => setShowDownloadMenu(showDownloadMenu === claim.id ? null : claim.id)}
                                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2"
                              >
                                Download
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              
                              {showDownloadMenu === claim.id && (
                                <div className="absolute top-full mt-1 right-0 sm:left-0 sm:right-auto bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[160px]">
                                  <button
                                    onClick={() => handleDownloadStatement(claim, 'txt')}
                                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Text (.txt)
                                  </button>
                                  <button
                                    onClick={() => handleDownloadStatement(claim, 'docx')}
                                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    Word (.docx)
                                  </button>
                                  <button
                                    onClick={() => handleDownloadStatement(claim, 'pdf')}
                                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-b-lg flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    PDF (.pdf)
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Remove Button */}
                          <button
                            onClick={() => handleRemove(claim.id)}
                            className="w-full sm:w-auto px-3 sm:px-4 py-2 border-2 border-red-600 text-red-600 dark:text-red-400 dark:border-red-500 rounded-lg font-semibold hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-xs sm:text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Clear All Button */}
                <div className="flex justify-center pt-4 border-t dark:border-gray-700">
                  <button
                    onClick={handleClearAll}
                    className="px-6 py-3 border-2 border-red-500 text-red-500 dark:text-red-400 dark:border-red-500 rounded-lg font-semibold hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  >
                    Clear All Claims (Privacy Reset)
                  </button>
                </div>
                  </>
                )}
              </>
            )}

            {/* Form Viewer Modal */}
            {viewingForm && (
              <div className="fixed inset-0 bg-black bg-opacity-70 z-60 overflow-y-auto">
                <div className="min-h-screen px-4 py-8">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl mx-auto">
                    <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold">{viewingForm.title || viewingForm.formName}</h3>
                        <p className="text-purple-200 text-sm">{viewingForm.formNumber}</p>
                      </div>
                      <button
                        onClick={() => setViewingForm(null)}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="p-6">
                      {viewingForm.generatedContent && (
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 max-h-[60vh] overflow-auto">
                          <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                            {viewingForm.generatedContent}
                          </pre>
                        </div>
                      )}
                      
                      <div className="flex justify-end gap-3 mt-4">
                        <button
                          onClick={() => {
                            const blob = new Blob([viewingForm.generatedContent], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${viewingForm.formNumber || 'form'}-${viewingForm.title || 'draft'}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                        >
                          Download .TXT
                        </button>
                        <button
                          onClick={() => setViewingForm(null)}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statement Viewer Modal */}
      {viewingStatement && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-60 overflow-y-auto">
          <div className="min-h-screen px-4 py-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl mx-auto">
              <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                <h3 className="text-xl font-bold">Generated Statement</h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleEditStatement}
                    className="px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-sm"
                  >
                    Edit Statement
                  </button>
                  <button
                    onClick={() => {
                      setViewingStatement(null);
                      setViewingClaimId(null);
                    }}
                    className="text-white hover:text-gray-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Statement in Support of Claim</h4>
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans">
                    {viewingStatement.statement}
                  </pre>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Doctor's Cheat Sheet</h4>
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans">
                    {viewingStatement.doctorNote}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Confirmation Modal */}
      {showImportConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-60 overflow-y-auto">
          <div className="min-h-screen px-4 py-8 flex items-center justify-center">
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
              role="dialog"
              aria-modal="true"
              aria-labelledby="import-confirm-title"
            >
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-lg">
                <h3 id="import-confirm-title" className="text-xl font-bold">📥 Confirm Import</h3>
              </div>
              
              <div className="p-6">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Backup Details:</p>
                  <ul className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
                    <li>• <strong>{showImportConfirm.meta.claimCount}</strong> claims found</li>
                    <li>• <strong>{showImportConfirm.meta.statementCount}</strong> statements found</li>
                    {showImportConfirm.meta.exportDate && (
                      <li>• Backup date: {new Date(showImportConfirm.meta.exportDate).toLocaleDateString()}</li>
                    )}
                  </ul>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  How would you like to import this backup?
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => handleConfirmImport('replace')}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Replace All (Fresh Start)
                  </button>
                  <button
                    onClick={() => handleConfirmImport('merge')}
                    className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Merge (Add New Only)
                  </button>
                  <button
                    onClick={() => setShowImportConfirm(null)}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
                  ⚠️ "Replace All" will remove your current claims first
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buy Me a Coffee - shows when packet has claims */}
      <BuyMeCoffee 
        show={claims.length > 0 && !backupCreated} 
        trigger="packet"
        context={{ count: claims.length }}
      />
      
      {/* Buy Me a Coffee - shows after backup created */}
      <BuyMeCoffee 
        show={backupCreated} 
        trigger="export"
        context={{ count: claims.length }}
        onDismiss={() => setBackupCreated(false)}
      />
    </div>
  );
};

export default MyPacket;
