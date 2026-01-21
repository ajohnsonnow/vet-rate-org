/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import jsPDF from 'jspdf';
import { FocusToggle } from '../contexts/FocusModeContext';
import ShareButton, { PIISensitive } from './ShareButton';
import VAGovRatingPaster from './VAGovRatingPaster';
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
import { getSavedForms, deleteSavedForm, getVeteranProfile, getMyRatings, removeRating, updateRating, clearMyRatings, addRating, getServiceHistory, addDeployment, removeDeployment, addAward, removeAward, saveDD214Data, clearDD214Data, getTimelineEvents, saveTimelineEvents, clearTimelineEvents, getPainMaps, deletePainMap, clearPainMaps } from '../utils/veteranProfile';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import BuyMeCoffee from './BuyMeCoffee';
import ReportBugLink from './ReportBugLink';
import DraftWatermark from './DraftWatermark';
import CertificationCheckbox from './CertificationCheckbox';
import NexusDisclaimerFooter from './NexusDisclaimerFooter';
import ClaimProgress from './ClaimProgress';
import { generateAI, getAIStatus, isAnyAIAvailable } from '../utils/unifiedAIService';
import { AIStatusBadge, AIModeSelector } from './AIModeSelector';

const MyPacket = ({ onResume, onClose, onReportBug, onAnalyzeStrategy, onOpenGoogleDriveSync, onOpenAISettings, onOpenDD214Analyzer }) => {
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({ total: 0, drafting: 0, statementGenerated: 0, filed: 0 });
  const [viewingStatement, setViewingStatement] = useState(null);
  const [viewingClaimId, setViewingClaimId] = useState(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [showImportConfirm, setShowImportConfirm] = useState(null);
  const [backupCreated, setBackupCreated] = useState(false);
  const [isCertified, setIsCertified] = useState(false); // Certification for downloads
  const fileInputRef = useRef(null);
  const packetContentRef = useRef(null);
  
  // Tab state for Claims vs Forms vs Ratings view
  const [activeTab, setActiveTab] = useState('claims');
  const [savedForms, setSavedForms] = useState([]);
  const [viewingForm, setViewingForm] = useState(null);
  const [myRatings, setMyRatings] = useState([]);
  const [editingRating, setEditingRating] = useState(null);
  const [showVAGovPaster, setShowVAGovPaster] = useState(false);
  
  // Veteran Profile state
  const [veteranProfile, setVeteranProfile] = useState({});
  
  // Service History state
  const [serviceHistory, setServiceHistory] = useState({ deployments: [], awards: [], dd214Data: null });
  const [showDeploymentForm, setShowDeploymentForm] = useState(false);
  const [showAwardForm, setShowAwardForm] = useState(false);
  const [showDD214Processor, setShowDD214Processor] = useState(false);
  const [newDeployment, setNewDeployment] = useState({ theater: '', location: '', startDate: '', endDate: '', unit: '', notes: '', hazardous: false, combat: false });
  const [newAward, setNewAward] = useState({ name: '', abbreviation: '', dateReceived: '', notes: '', isCombat: false });
  const [dd214Text, setDD214Text] = useState('');
  const [isProcessingDD214, setIsProcessingDD214] = useState(false);
  const [aiStatus, setAIStatus] = useState({ available: false });
  const [isDraggingDD214, setIsDraggingDD214] = useState(false);
  const dd214FileInputRef = useRef(null);
  
  // Timeline Events state (Continuity Thread)
  const [timelineEvents, setTimelineEvents] = useState([]);
  
  // Pain Maps state
  const [painMaps, setPainMaps] = useState([]);
  const [viewingPainMap, setViewingPainMap] = useState(null);

  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  useEffect(() => {
    loadClaims();
    loadSavedForms();
    loadMyRatings();
    loadServiceHistory();
    loadTimelineEvents();
    loadPainMaps();
    loadVeteranProfile();
    checkAIStatus();
  }, []);
  
  const loadVeteranProfile = () => {
    const profile = getVeteranProfile();
    // Initialize servicePeriods array if it doesn't exist
    if (!Array.isArray(profile.servicePeriods)) {
      profile.servicePeriods = [];
    }
    setVeteranProfile(profile || {});
  };
  
  const checkAIStatus = async () => {
    const status = await getAIStatus();
    setAIStatus(status);
  };
  
  const loadServiceHistory = () => {
    const history = getServiceHistory();
    setServiceHistory(history);
  };
  
  const loadTimelineEvents = () => {
    const events = getTimelineEvents();
    setTimelineEvents(events);
  };
  
  const loadPainMaps = () => {
    const maps = getPainMaps();
    setPainMaps(maps);
  };
  
  const handleDeletePainMap = (mapId) => {
    if (window.confirm('Delete this pain map?')) {
      deletePainMap(mapId);
      loadPainMaps();
    }
  };
  
  const handleClearTimelineEvents = () => {
    if (window.confirm('Clear all timeline events? This cannot be undone.')) {
      clearTimelineEvents();
      loadTimelineEvents();
    }
  };
  
  const loadSavedForms = () => {
    const forms = getSavedForms();
    setSavedForms(forms);
  };
  
  const loadMyRatings = () => {
    const ratings = getMyRatings();
    setMyRatings(ratings);
  };
  
  const handleRemoveForm = (formId) => {
    if (window.confirm('Are you sure you want to remove this form from your packet?')) {
      deleteSavedForm(formId);
      loadSavedForms();
    }
  };
  
  const handleRemoveRating = (ratingId) => {
    if (window.confirm('Are you sure you want to remove this rating?')) {
      removeRating(ratingId);
      loadMyRatings();
    }
  };
  
  const handleUpdateRating = (ratingId, updates) => {
    updateRating(ratingId, updates);
    loadMyRatings();
    setEditingRating(null);
  };
  
  const handleClearAllRatings = () => {
    if (window.confirm('Are you sure you want to clear all saved ratings? This cannot be undone.')) {
      clearMyRatings();
      loadMyRatings();
    }
  };
  
  const handlePastedRatings = (parsedRatings) => {
    // Save each rating to veteranProfile
    parsedRatings.forEach(rating => {
      addRating(rating);
    });
    loadMyRatings();
    setShowVAGovPaster(false);
  };
  
  // Service History handlers
  const handleAddDeployment = () => {
    if (!newDeployment.theater || !newDeployment.location) {
      alert('Please enter at least theater and location');
      return;
    }
    addDeployment(newDeployment);
    loadServiceHistory();
    setNewDeployment({ theater: '', location: '', startDate: '', endDate: '', unit: '', notes: '', hazardous: false, combat: false });
    setShowDeploymentForm(false);
  };
  
  const handleRemoveDeployment = (depId) => {
    if (window.confirm('Remove this deployment from your service history?')) {
      removeDeployment(depId);
      loadServiceHistory();
    }
  };
  
  const handleAddAward = () => {
    if (!newAward.name) {
      alert('Please enter the award name');
      return;
    }
    addAward(newAward);
    loadServiceHistory();
    setNewAward({ name: '', abbreviation: '', dateReceived: '', notes: '', isCombat: false });
    setShowAwardForm(false);
  };
  
  const handleRemoveAward = (awardId) => {
    if (window.confirm('Remove this award from your service history?')) {
      removeAward(awardId);
      loadServiceHistory();
    }
  };
  
  const handleProcessDD214 = async () => {
    if (!dd214Text.trim()) {
      alert('Please paste your DD214 text first');
      return;
    }
    
    if (!aiStatus.available) {
      alert('AI is not configured. Please set up AI in settings to process DD214 automatically.');
      return;
    }
    
    setIsProcessingDD214(true);
    
    try {
      const response = await generateAI(
        `Extract key information from this DD214 text. Return ONLY a valid JSON object with these fields:
{
  "branch": "Army/Navy/Air Force/Marines/Coast Guard/Space Force",
  "mos": "Primary MOS code",
  "mosTitle": "MOS job title",
  "entryDate": "YYYY-MM-DD or null",
  "separationDate": "YYYY-MM-DD or null",
  "yearsService": number or null,
  "monthsService": number or null,
  "separationType": "Honorable/General/Other Than Honorable/etc",
  "characterOfService": "Honorable/General/etc",
  "reenlisted": true/false,
  "foreignService": true/false
}

DD214 TEXT:
${dd214Text}

Return ONLY the JSON object, no explanation.`,
        {
          temperature: 0.3,
          maxTokens: 512,
          expectJSON: true
        }
      );
      
      // generateAI returns { text, mode } object - extract the text content
      const content = response?.text || response;
      if (content) {
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
        // Parse JSON from response
        let data;
        try {
          let cleanContent = contentStr.trim();
          if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
          if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
          if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);
          data = JSON.parse(cleanContent.trim());
        } catch (parseError) {
          console.error('Parse error:', parseError);
          throw new Error('Could not parse DD214 data');
        }
        
        saveDD214Data({
          ...data,
          extractedText: dd214Text.substring(0, 5000) // Store first 5000 chars
        });
        loadServiceHistory();
        setDD214Text('');
        setShowDD214Processor(false);
        alert('DD214 information extracted and saved successfully!');
      } else {
        alert('Could not extract DD214 information. Please try again or enter manually.');
      }
    } catch (error) {
      console.error('Error processing DD214:', error);
      alert('Error processing DD214. Please try again.');
    } finally {
      setIsProcessingDD214(false);
    }
  };
  
  const handleClearDD214 = () => {
    if (window.confirm('Clear all DD214 extracted data?')) {
      clearDD214Data();
      loadServiceHistory();
    }
  };

  // DD214 Drag and Drop handlers - connects to DD214 Analyzer
  const handleDD214DragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDD214(true);
  };

  const handleDD214DragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDD214(false);
  };

  const handleDD214Drop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDD214(false);
    
    const files = Array.from(e.dataTransfer?.files || []);
    const pdfFile = files.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFile) {
      // Open DD214 Analyzer with the dropped file
      // Store the file temporarily and open analyzer
      if (onOpenDD214Analyzer) {
        onOpenDD214Analyzer();
      }
    } else {
      alert('Please drop a PDF file (DD214 document).');
    }
  };

  const handleDD214FileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Open DD214 Analyzer
        if (onOpenDD214Analyzer) {
          onOpenDD214Analyzer();
        }
      } else {
        alert('Please select a PDF file.');
      }
    }
    // Reset input
    if (dd214FileInputRef.current) {
      dd214FileInputRef.current.value = '';
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
      <div className="min-h-screen px-4 py-8 flex items-start justify-center">
        <div ref={packetContentRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col modal-content">
          {/* Header - Sticky */}
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4 sm:px-6 py-4 sm:py-6 rounded-t-lg flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 id="my-packet-title" className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">📁 My Claim Packet</h2>
                <p className="text-indigo-100 text-sm sm:text-base">
                  Manage your saved claims and generated statements
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <ShareButton 
                  targetRef={packetContentRef}
                  filename="my-claim-packet"
                  variant="icon"
                />
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
                Local Backup
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
              {onOpenGoogleDriveSync && (
                <button
                  onClick={onOpenGoogleDriveSync}
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 transition-all text-xs sm:text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.71 3.5L1.15 15l4.58 7.5h13.54l4.58-7.5L17.29 3.5H7.71zm-.71 1h10l5.15 10H2.85l5.15-10zm.71 11h8.58l2.29 4.5H5.42l2.29-4.5z"/>
                  </svg>
                  Google Drive
                </button>
              )}
              {onAnalyzeStrategy && (
                <button
                  onClick={onAnalyzeStrategy}
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-indigo-700 transition-all text-xs sm:text-sm"
                >
                  <span>🧭</span>
                  Analyze Strategy
                </button>
              )}
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
              💡 Use Google Drive for automatic cloud backup
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

          {/* Tab Navigation - Organized by category */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 bg-white dark:bg-gray-800 sticky top-0 z-10 flex-shrink-0">
            <nav className="flex gap-1 overflow-x-auto pb-px scrollbar-hide" aria-label="Tabs">
              {/* Primary Data */}
              <button
                onClick={() => setActiveTab('claims')}
                className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'claims'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                📋 <span className="hidden sm:inline">Claims</span>
                <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs px-1.5 py-0.5 rounded-full">{claims.length}</span>
              </button>
              
              <button
                onClick={() => setActiveTab('ratings')}
                className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'ratings'
                    ? 'border-green-600 text-green-600 dark:border-green-400 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                📊 <span className="hidden sm:inline">Ratings</span>
                <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs px-1.5 py-0.5 rounded-full">{myRatings.length}</span>
              </button>
              
              <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1 my-2"></div>
              
              {/* Service & History */}
              <button
                onClick={() => setActiveTab('service')}
                className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'service'
                    ? 'border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                🎖️ <span className="hidden sm:inline">Service</span>
                <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs px-1.5 py-0.5 rounded-full">{serviceHistory.deployments.length + serviceHistory.awards.length}</span>
              </button>
              
              <button
                onClick={() => setActiveTab('timeline')}
                className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'timeline'
                    ? 'border-slate-600 text-slate-600 dark:border-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/20 rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                🧵 <span className="hidden sm:inline">Timeline</span>
                <span className="bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 text-xs px-1.5 py-0.5 rounded-full">{timelineEvents.length}</span>
              </button>
              
              <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1 my-2"></div>
              
              {/* Evidence & Docs */}
              <button
                onClick={() => setActiveTab('painmaps')}
                className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'painmaps'
                    ? 'border-red-600 text-red-600 dark:border-red-400 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                🎨 <span className="hidden sm:inline">Pain Maps</span>
                <span className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs px-1.5 py-0.5 rounded-full">{painMaps.length}</span>
              </button>
              
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'profile'
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                ✍️ <span className="hidden sm:inline">Profile</span>
              </button>
              
              <button
                onClick={() => setActiveTab('forms')}
                className={`py-2.5 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'forms'
                    ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                📄 <span className="hidden sm:inline">Forms</span>
                <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs px-1.5 py-0.5 rounded-full">{savedForms.length}</span>
              </button>
            </nav>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {/* MY RATINGS TAB */}
            {activeTab === 'ratings' && (
              <>
                {myRatings.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">📊 No Saved Ratings</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Import your VA ratings to save them here for use across all tools!
                    </p>
                    <button
                      onClick={() => setShowVAGovPaster(true)}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Import from VA.gov
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex justify-between items-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {myRatings.length} rating{myRatings.length !== 1 ? 's' : ''} saved
                      </p>
                      <button
                        onClick={handleClearAllRatings}
                        className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="space-y-3">
                      {myRatings.map((rating) => (
                        <div
                          key={rating.id}
                          className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-500 transition-all"
                        >
                          {editingRating?.id === rating.id ? (
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={editingRating.name}
                                onChange={(e) => setEditingRating({...editingRating, name: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                placeholder="Condition name"
                              />
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="10"
                                  value={editingRating.rating}
                                  onChange={(e) => setEditingRating({...editingRating, rating: parseInt(e.target.value) || 0})}
                                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                                <button
                                  onClick={() => handleUpdateRating(rating.id, {name: editingRating.name, rating: editingRating.rating})}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingRating(null)}
                                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    {rating.name || rating.condition}
                                  </h3>
                                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                    rating.rating >= 70 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                    rating.rating >= 50 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                                    rating.rating >= 30 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                  }`}>
                                    {rating.rating}%
                                  </span>
                                </div>
                                {rating.effectiveDate && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Effective: {new Date(rating.effectiveDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingRating({...rating})}
                                  className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleRemoveRating(rating.id)}
                                  className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* VETERAN PROFILE TAB */}
            {activeTab === 'profile' && (
              <>
                <div className="mb-6">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-3xl">✍️</span>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Veteran Profile</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Save your information once, and it'll automatically fill VA forms throughout the app. All data stays on your device.
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="text-sm">
                        <p className="font-semibold text-indigo-900 dark:text-indigo-100 mb-1">Privacy First</p>
                        <p className="text-indigo-800 dark:text-indigo-200">
                          • All information is stored <strong>only on your device</strong><br />
                          • Never sent to any server or database<br />
                          • Only you can see this data<br />
                          • Clear it anytime from The Bunker
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile Form */}
                <div className="space-y-6">
                  {/* Personal Information Section */}
                  <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      👤 Personal Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">First Name</label>
                        <input
                          type="text"
                          value={veteranProfile.firstName || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, firstName: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Last Name</label>
                        <input
                          type="text"
                          value={veteranProfile.lastName || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, lastName: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                          placeholder="Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Middle Initial</label>
                        <input
                          type="text"
                          maxLength={1}
                          value={veteranProfile.middleInitial || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, middleInitial: e.target.value.toUpperCase() })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                          placeholder="M"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date of Birth</label>
                        <input
                          type="date"
                          value={veteranProfile.dob || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, dob: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">SSN (Last 4 Digits)</label>
                        <input
                          type="text"
                          maxLength={4}
                          value={veteranProfile.ssnLast4 || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, ssnLast4: e.target.value.replace(/\D/g, '') })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                          placeholder="1234"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">VA File Number</label>
                        <input
                          type="text"
                          value={veteranProfile.vaFileNumber || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, vaFileNumber: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                          placeholder="C-12345678"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Information Section */}
                  <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      📞 Contact Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                        <input
                          type="email"
                          value={veteranProfile.email || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, email: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                          placeholder="veteran@email.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone</label>
                        <input
                          type="tel"
                          value={veteranProfile.phone || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, phone: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Alternate Phone</label>
                        <input
                          type="tel"
                          value={veteranProfile.alternatePhone || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, alternatePhone: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                          placeholder="(555) 987-6543"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Street Address</label>
                        <input
                          type="text"
                          value={veteranProfile.street || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, street: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                          placeholder="123 Main Street"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">City</label>
                        <input
                          type="text"
                          value={veteranProfile.city || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, city: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                          placeholder="Springfield"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">State</label>
                        <input
                          type="text"
                          maxLength={2}
                          value={veteranProfile.state || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, state: e.target.value.toUpperCase() })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                          placeholder="IL"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ZIP Code</label>
                        <input
                          type="text"
                          maxLength={10}
                          value={veteranProfile.zip || ''}
                          onChange={(e) => setVeteranProfile({ ...veteranProfile, zip: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                          placeholder="62701"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Service Information Section - Now supports multiple periods */}
                  <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        🎖️ Service Periods
                      </h4>
                      <button
                        onClick={() => {
                          const newPeriod = {
                            id: `temp-${Date.now()}`,
                            branch: '',
                            component: 'Active',
                            serviceStartDate: '',
                            serviceEndDate: '',
                            characterOfService: '',
                            mos: '',
                            rankAtDischarge: '',
                            formType: 'DD214',
                            notes: '',
                            isNew: true,
                          };
                          setVeteranProfile({
                            ...veteranProfile,
                            servicePeriods: [...(veteranProfile.servicePeriods || []), newPeriod]
                          });
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                      >
                        <span>+</span> Add Service Period
                      </button>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Add all your service periods including Active Duty, Guard, and Reserve time. Each DD214 or NGB 22 is a separate period.
                    </p>
                    
                    {/* Service Periods List */}
                    {veteranProfile.servicePeriods && veteranProfile.servicePeriods.length > 0 ? (
                      <div className="space-y-4">
                        {veteranProfile.servicePeriods.map((period, idx) => (
                          <div key={period.id || idx} className="border-2 border-indigo-200 dark:border-indigo-800 rounded-lg p-4 bg-indigo-50 dark:bg-indigo-900/20">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-semibold text-gray-900 dark:text-gray-100">
                                Period #{idx + 1}
                              </h5>
                              <button
                                onClick={() => {
                                  const newPeriods = veteranProfile.servicePeriods.filter((_, i) => i !== idx);
                                  setVeteranProfile({ ...veteranProfile, servicePeriods: newPeriods });
                                }}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-semibold"
                              >
                                🗑️ Remove
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branch</label>
                                <select
                                  value={period.branch || ''}
                                  onChange={(e) => {
                                    const newPeriods = [...veteranProfile.servicePeriods];
                                    newPeriods[idx] = { ...newPeriods[idx], branch: e.target.value };
                                    setVeteranProfile({ ...veteranProfile, servicePeriods: newPeriods });
                                  }}
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
                                >
                                  <option value="">Select...</option>
                                  <option value="Army">Army</option>
                                  <option value="Navy">Navy</option>
                                  <option value="Air Force">Air Force</option>
                                  <option value="Marines">Marines</option>
                                  <option value="Coast Guard">Coast Guard</option>
                                  <option value="Space Force">Space Force</option>
                                  <option value="Army National Guard">Army National Guard</option>
                                  <option value="Air National Guard">Air National Guard</option>
                                </select>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Component</label>
                                <select
                                  value={period.component || 'Active'}
                                  onChange={(e) => {
                                    const newPeriods = [...veteranProfile.servicePeriods];
                                    newPeriods[idx] = { ...newPeriods[idx], component: e.target.value };
                                    setVeteranProfile({ ...veteranProfile, servicePeriods: newPeriods });
                                  }}
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
                                >
                                  <option value="Active">Active Duty</option>
                                  <option value="Guard">National Guard</option>
                                  <option value="Reserve">Reserve</option>
                                </select>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                                <input
                                  type="date"
                                  value={period.serviceStartDate || ''}
                                  onChange={(e) => {
                                    const newPeriods = [...veteranProfile.servicePeriods];
                                    newPeriods[idx] = { ...newPeriods[idx], serviceStartDate: e.target.value };
                                    setVeteranProfile({ ...veteranProfile, servicePeriods: newPeriods });
                                  }}
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                                <input
                                  type="date"
                                  value={period.serviceEndDate || ''}
                                  onChange={(e) => {
                                    const newPeriods = [...veteranProfile.servicePeriods];
                                    newPeriods[idx] = { ...newPeriods[idx], serviceEndDate: e.target.value };
                                    setVeteranProfile({ ...veteranProfile, servicePeriods: newPeriods });
                                  }}
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discharge Type</label>
                                <select
                                  value={period.characterOfService || ''}
                                  onChange={(e) => {
                                    const newPeriods = [...veteranProfile.servicePeriods];
                                    newPeriods[idx] = { ...newPeriods[idx], characterOfService: e.target.value };
                                    setVeteranProfile({ ...veteranProfile, servicePeriods: newPeriods });
                                  }}
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
                                >
                                  <option value="">Select...</option>
                                  <option value="Honorable">Honorable</option>
                                  <option value="General Under Honorable">General Under Honorable</option>
                                  <option value="Other Than Honorable">Other Than Honorable</option>
                                  <option value="Medical">Medical</option>
                                </select>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Form Type</label>
                                <select
                                  value={period.formType || 'DD214'}
                                  onChange={(e) => {
                                    const newPeriods = [...veteranProfile.servicePeriods];
                                    newPeriods[idx] = { ...newPeriods[idx], formType: e.target.value };
                                    setVeteranProfile({ ...veteranProfile, servicePeriods: newPeriods });
                                  }}
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
                                >
                                  <option value="DD214">DD214 (Active Duty)</option>
                                  <option value="NGB22">NGB 22 (National Guard)</option>
                                  <option value="DD256">DD256 (Reserve)</option>
                                  <option value="Other">Other</option>
                                </select>
                              </div>
                              
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">MOS / Rank (optional)</label>
                                <input
                                  type="text"
                                  value={period.mos || ''}
                                  onChange={(e) => {
                                    const newPeriods = [...veteranProfile.servicePeriods];
                                    newPeriods[idx] = { ...newPeriods[idx], mos: e.target.value };
                                    setVeteranProfile({ ...veteranProfile, servicePeriods: newPeriods });
                                  }}
                                  placeholder="E.g., 11B Infantry, E-5 Sergeant"
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
                                />
                              </div>
                              
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
                                <input
                                  type="text"
                                  value={period.notes || ''}
                                  onChange={(e) => {
                                    const newPeriods = [...veteranProfile.servicePeriods];
                                    newPeriods[idx] = { ...newPeriods[idx], notes: e.target.value };
                                    setVeteranProfile({ ...veteranProfile, servicePeriods: newPeriods });
                                  }}
                                  placeholder="E.g., Deployed to Iraq 2008-2009"
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p className="text-sm">No service periods added yet.</p>
                        <p className="text-xs mt-1">Click "Add Service Period" to add your military service history.</p>
                      </div>
                    )}
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        localStorage.setItem('vet_rate_veteran_profile', JSON.stringify(veteranProfile));
                        alert('✅ Veteran Profile saved! This information will now auto-fill VA forms.');
                      }}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      💾 Save Profile
                    </button>
                  </div>
                </div>
              </>
            )}

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

            {/* SERVICE HISTORY TAB */}
            {activeTab === 'service' && (
              <div className="space-y-6">
                {/* DD214 Section */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                      📜 DD214 Information
                      {aiStatus.available && <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">AI Ready</span>}
                    </h3>
                    {!showDD214Processor && !serviceHistory.dd214Data && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowDD214Processor(true)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          📝 Paste Text
                        </button>
                        <button
                          onClick={onOpenDD214Analyzer}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                          title="Open full DD214 Analyzer with OCR support"
                        >
                          📄 Full Analyzer
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Drop Zone for DD214 - when no data and not processing */}
                  {!serviceHistory.dd214Data && !showDD214Processor && (
                    <div className="space-y-4">
                      {/* Drag & Drop Zone */}
                      <div
                        onClick={() => dd214FileInputRef.current?.click()}
                        onDragOver={handleDD214DragOver}
                        onDragLeave={handleDD214DragLeave}
                        onDrop={handleDD214Drop}
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                          isDraggingDD214
                            ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/40 scale-[1.02]'
                            : 'border-blue-300 dark:border-blue-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                        }`}
                      >
                        <input
                          ref={dd214FileInputRef}
                          type="file"
                          accept="application/pdf,.pdf"
                          onChange={handleDD214FileSelect}
                          className="hidden"
                        />
                        <svg className="w-12 h-12 text-blue-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">
                          {isDraggingDD214 ? '📥 Drop your DD214 here!' : '📄 Drag & Drop DD214 PDF'}
                        </p>
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          or click to browse • Opens in DD214 Analyzer with full OCR support
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
                          🔒 Your DD214 stays 100% private - processed locally on your device
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex-1 border-t border-blue-200 dark:border-blue-700"></div>
                        <span className="text-sm text-blue-600 dark:text-blue-400">or</span>
                        <div className="flex-1 border-t border-blue-200 dark:border-blue-700"></div>
                      </div>
                      
                      <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                        Use the buttons above to paste text manually or open the full DD214 Analyzer for advanced processing.
                      </p>
                    </div>
                  )}
                  
                  {showDD214Processor && (
                    <div className="space-y-4">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Paste the text from your DD214 below. AI will extract key information automatically.
                        <br/><span className="text-xs text-blue-600 dark:text-blue-400">⚠️ Your DD214 contains sensitive information - data stays on your device only.</span>
                      </p>
                      <textarea
                        value={dd214Text}
                        onChange={(e) => setDD214Text(e.target.value)}
                        placeholder="Paste your DD214 text here (copy from PDF or scanned document)..."
                        rows={6}
                        className="w-full px-4 py-3 border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleProcessDD214}
                          disabled={isProcessingDD214 || !aiStatus.available}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {isProcessingDD214 ? (
                            <>
                              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                              Processing...
                            </>
                          ) : (
                            <>🤖 Extract with AI</>
                          )}
                        </button>
                        <button
                          onClick={onOpenDD214Analyzer}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                          title="Open full DD214 Analyzer with PDF upload & OCR"
                        >
                          📄 Use Full Analyzer
                        </button>
                        <button
                          onClick={onOpenAISettings}
                          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                          title="Open Faraday Cage - AI Settings"
                        >
                          ⚙️ AI Settings
                        </button>
                        <button
                          onClick={() => { setShowDD214Processor(false); setDD214Text(''); }}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                      {!aiStatus.available && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          ⚠️ Configure AI in settings to enable automatic extraction
                        </p>
                      )}
                    </div>
                  )}
                  
                  {serviceHistory.dd214Data && !showDD214Processor && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Branch</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{serviceHistory.dd214Data.branch || 'N/A'}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400">MOS</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{serviceHistory.dd214Data.mos || 'N/A'}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400">MOS Title</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{serviceHistory.dd214Data.mosTitle || 'N/A'}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Entry Date</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{serviceHistory.dd214Data.entryDate || 'N/A'}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Separation Date</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{serviceHistory.dd214Data.separationDate || 'N/A'}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Time in Service</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {serviceHistory.dd214Data.yearsService ? `${serviceHistory.dd214Data.yearsService}y ${serviceHistory.dd214Data.monthsService || 0}m` : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Character of Service</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{serviceHistory.dd214Data.characterOfService || 'N/A'}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Foreign Service</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{serviceHistory.dd214Data.foreignService ? 'Yes' : 'No'}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          onClick={() => setShowDD214Processor(true)}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          🔄 Re-process DD214
                        </button>
                        <button
                          onClick={onOpenDD214Analyzer}
                          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          📄 Open Full Analyzer
                        </button>
                        <button
                          onClick={handleClearDD214}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline"
                        >
                          🗑️ Clear DD214 Data
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Deployments Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      🌍 Deployments
                    </h3>
                    {!showDeploymentForm && (
                      <button
                        onClick={() => setShowDeploymentForm(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        ➕ Add Deployment
                      </button>
                    )}
                  </div>
                  
                  {showDeploymentForm && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Theater/Operation *</label>
                          <select
                            value={newDeployment.theater}
                            onChange={(e) => setNewDeployment(prev => ({ ...prev, theater: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          >
                            <option value="">Select...</option>
                            <option value="OIF">OIF - Operation Iraqi Freedom</option>
                            <option value="OEF">OEF - Operation Enduring Freedom</option>
                            <option value="OND">OND - Operation New Dawn</option>
                            <option value="OIR">OIR - Operation Inherent Resolve</option>
                            <option value="OFS">OFS - Operation Freedom's Sentinel</option>
                            <option value="Gulf War">Gulf War</option>
                            <option value="Vietnam">Vietnam</option>
                            <option value="Korea">Korea</option>
                            <option value="Somalia">Somalia</option>
                            <option value="Bosnia">Bosnia</option>
                            <option value="Kosovo">Kosovo</option>
                            <option value="Europe">Europe (Other)</option>
                            <option value="Pacific">Pacific</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location *</label>
                          <input
                            type="text"
                            value={newDeployment.location}
                            onChange={(e) => setNewDeployment(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="e.g., Baghdad, Iraq"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                          <input
                            type="date"
                            value={newDeployment.startDate}
                            onChange={(e) => setNewDeployment(prev => ({ ...prev, startDate: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                          <input
                            type="date"
                            value={newDeployment.endDate}
                            onChange={(e) => setNewDeployment(prev => ({ ...prev, endDate: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                          <input
                            type="text"
                            value={newDeployment.unit}
                            onChange={(e) => setNewDeployment(prev => ({ ...prev, unit: e.target.value }))}
                            placeholder="e.g., 1st Infantry Division"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newDeployment.combat}
                            onChange={(e) => setNewDeployment(prev => ({ ...prev, combat: e.target.checked }))}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Combat Zone</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newDeployment.hazardous}
                            onChange={(e) => setNewDeployment(prev => ({ ...prev, hazardous: e.target.checked }))}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Hazardous Duty</span>
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddDeployment}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                        >
                          Save Deployment
                        </button>
                        <button
                          onClick={() => { setShowDeploymentForm(false); setNewDeployment({ theater: '', location: '', startDate: '', endDate: '', unit: '', notes: '', hazardous: false, combat: false }); }}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {serviceHistory.deployments.length === 0 && !showDeploymentForm ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No deployments added yet. Add your deployments for PACT Act eligibility and exposure tracking.</p>
                  ) : (
                    <div className="space-y-3">
                      {serviceHistory.deployments.map(dep => (
                        <div key={dep.id} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">{dep.theater}</span>
                              {dep.combat && <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">Combat</span>}
                              {dep.hazardous && <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">Hazardous</span>}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{dep.location}</p>
                            {(dep.startDate || dep.endDate) && (
                              <p className="text-xs text-gray-500 dark:text-gray-500">
                                {dep.startDate || '?'} - {dep.endDate || 'Present'}
                              </p>
                            )}
                            {dep.unit && <p className="text-xs text-gray-500 dark:text-gray-500">{dep.unit}</p>}
                          </div>
                          <button
                            onClick={() => handleRemoveDeployment(dep.id)}
                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Awards Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      🎖️ Awards & Decorations
                    </h3>
                    {!showAwardForm && (
                      <button
                        onClick={() => setShowAwardForm(true)}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                      >
                        ➕ Add Award
                      </button>
                    )}
                  </div>
                  
                  {showAwardForm && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Award Name *</label>
                          <input
                            type="text"
                            value={newAward.name}
                            onChange={(e) => setNewAward(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Purple Heart"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Abbreviation</label>
                          <input
                            type="text"
                            value={newAward.abbreviation}
                            onChange={(e) => setNewAward(prev => ({ ...prev, abbreviation: e.target.value }))}
                            placeholder="e.g., PH"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Received</label>
                          <input
                            type="date"
                            value={newAward.dateReceived}
                            onChange={(e) => setNewAward(prev => ({ ...prev, dateReceived: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div className="flex items-end pb-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={newAward.isCombat}
                              onChange={(e) => setNewAward(prev => ({ ...prev, isCombat: e.target.checked }))}
                              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Combat-Related Award</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddAward}
                          className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
                        >
                          Save Award
                        </button>
                        <button
                          onClick={() => { setShowAwardForm(false); setNewAward({ name: '', abbreviation: '', dateReceived: '', notes: '', isCombat: false }); }}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {serviceHistory.awards.length === 0 && !showAwardForm ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No awards added yet. Add your awards and decorations for documentation purposes.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {serviceHistory.awards.map(award => (
                        <div key={award.id} className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <span className="text-amber-700 dark:text-amber-300 font-medium">
                            🎖️ {award.abbreviation || award.name}
                          </span>
                          {award.isCombat && <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">Combat</span>}
                          <button
                            onClick={() => handleRemoveAward(award.id)}
                            className="text-red-400 hover:text-red-600 text-sm"
                            title={`Remove ${award.name}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Info Banner */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    💡 <strong>Why track this?</strong> Your service history, deployments, and awards can be used by the PACT Act Navigator to determine toxic exposure eligibility, 
                    and by other tools for auto-filling forms and strengthening your claims.
                  </p>
                </div>
              </div>
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
                          
                          {/* The Readiness Gauge - Claim Completeness Tracker */}
                          <div className="my-3">
                            <ClaimProgress
                              conditionCode={claim.diagnosticCode}
                              conditionName={claim.conditionName}
                            />
                          </div>
                          
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
                                disabled={!isCertified}
                                title={!isCertified ? 'Please open and certify the statement before downloading' : ''}
                                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Download
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              
                              {showDownloadMenu === claim.id && isCertified && (
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

            {/* TIMELINE EVENTS TAB */}
            {activeTab === 'timeline' && (
              <>
                {timelineEvents.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">🧵 No Timeline Events</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                      Use the <strong>Continuity Thread</strong> tool to map your evidence timeline and track treatment gaps. Events you save there will appear here.
                    </p>
                    <button
                      onClick={onClose}
                      className="px-6 py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors inline-flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Go to Continuity Thread
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex justify-between items-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {timelineEvents.length} event{timelineEvents.length !== 1 ? 's' : ''} tracked
                      </p>
                      <button
                        onClick={handleClearTimelineEvents}
                        className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                    
                    {/* Timeline Visual */}
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-400 via-slate-300 to-slate-200 dark:from-slate-500 dark:via-slate-600 dark:to-slate-700"></div>
                      
                      <div className="space-y-4">
                        {timelineEvents
                          .sort((a, b) => new Date(b.date) - new Date(a.date))
                          .map((event, index) => (
                            <div key={event.id} className="relative flex items-start gap-4 pl-10">
                              {/* Timeline dot */}
                              <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                                event.type === 'treatment' ? 'bg-blue-500' :
                                event.type === 'diagnosis' ? 'bg-green-500' :
                                event.type === 'military' ? 'bg-amber-500' :
                                event.type === 'symptom' ? 'bg-red-500' :
                                event.type === 'hospitalization' ? 'bg-purple-500' :
                                'bg-gray-400'
                              }`}></div>
                              
                              <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                        event.type === 'treatment' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                                        event.type === 'diagnosis' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                                        event.type === 'military' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                                        event.type === 'symptom' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
                                        event.type === 'hospitalization' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' :
                                        'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                      }`}>
                                        {event.type?.charAt(0).toUpperCase() + event.type?.slice(1) || 'Event'}
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        {new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{event.title}</h4>
                                    {event.description && (
                                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{event.description}</p>
                                    )}
                                    {event.condition && (
                                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                                        Related to: {event.condition}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => {
                                      const updated = timelineEvents.filter(e => e.id !== event.id);
                                      setTimelineEvents(updated);
                                      import('../utils/veteranProfile').then(m => m.saveTimelineEvents(updated));
                                    }}
                                    className="text-red-400 hover:text-red-600 transition-colors p-1"
                                    title="Remove event"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                    
                    {/* Info Banner */}
                    <div className="mt-6 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        💡 <strong>Why track this?</strong> A continuous timeline of treatment and symptoms helps establish service connection and proves your condition has persisted since service. Use Continuity Thread to identify gaps in your evidence.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            {/* PAIN MAPS TAB */}
            {activeTab === 'painmaps' && (
              <>
                {painMaps.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">🎨 No Pain Maps Saved</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                      Use the <strong>Pain Painter</strong> tool to visually document your pain locations and generate condition-specific nexus language. Maps you save there will appear here.
                    </p>
                    <button
                      onClick={onClose}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors inline-flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Go to Pain Painter
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex justify-between items-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {painMaps.length} pain map{painMaps.length !== 1 ? 's' : ''} saved
                      </p>
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to clear all pain maps? This cannot be undone.')) {
                            setPainMaps([]);
                            import('../utils/veteranProfile').then(m => m.clearPainMaps());
                          }
                        }}
                        className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {painMaps.map((map) => (
                        <div
                          key={map.id}
                          className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-red-300 dark:hover:border-red-500 transition-all cursor-pointer group"
                          onClick={() => setViewingPainMap(map)}
                        >
                          {/* Map Preview */}
                          <div className="aspect-[3/4] bg-gradient-to-b from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/40 relative flex items-center justify-center">
                            {map.thumbnail ? (
                              <img src={map.thumbnail} alt={map.name} className="w-full h-full object-contain" />
                            ) : (
                              <div className="text-center p-4">
                                <span className="text-4xl">🎨</span>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{map.painPoints?.length || 0} pain points</p>
                              </div>
                            )}
                            
                            {/* Overlay on hover */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white font-semibold">View Details</span>
                            </div>
                          </div>
                          
                          {/* Map Info */}
                          <div className="p-3">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{map.name || 'Untitled Pain Map'}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(map.savedAt || map.createdAt).toLocaleDateString()}
                            </p>
                            {map.conditions && map.conditions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {map.conditions.slice(0, 2).map((cond, idx) => (
                                  <span key={idx} className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                                    {cond}
                                  </span>
                                ))}
                                {map.conditions.length > 2 && (
                                  <span className="text-xs text-gray-500">+{map.conditions.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Delete button */}
                          <div className="px-3 pb-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePainMap(map.id);
                              }}
                              className="w-full px-3 py-1.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Info Banner */}
                    <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <p className="text-sm text-red-700 dark:text-red-300">
                        💡 <strong>Why track this?</strong> Pain maps help visualize your symptoms for C&P exams and provide specific location data that supports accurate diagnostic coding. Each map generates nexus language you can use in your claims.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Pain Map Detail Modal */}
            {viewingPainMap && (
              <div className="fixed inset-0 bg-black bg-opacity-70 z-60 overflow-y-auto">
                <div className="min-h-screen px-4 py-8">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl mx-auto">
                    <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold">{viewingPainMap.name || 'Pain Map Details'}</h3>
                        <p className="text-red-100 text-sm">
                          Saved: {new Date(viewingPainMap.savedAt || viewingPainMap.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => setViewingPainMap(null)}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="p-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Pain Map Image */}
                        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 flex items-center justify-center">
                          {viewingPainMap.thumbnail ? (
                            <img src={viewingPainMap.thumbnail} alt="Pain Map" className="max-w-full max-h-[400px] object-contain" />
                          ) : (
                            <div className="text-center py-12">
                              <span className="text-6xl">🎨</span>
                              <p className="text-gray-500 dark:text-gray-400 mt-2">No preview available</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Pain Points List */}
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Pain Points ({viewingPainMap.painPoints?.length || 0})</h4>
                          {viewingPainMap.painPoints && viewingPainMap.painPoints.length > 0 ? (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {viewingPainMap.painPoints.map((point, idx) => (
                                <div key={idx} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${
                                      point.severity === 'severe' ? 'bg-red-500' :
                                      point.severity === 'moderate' ? 'bg-orange-500' :
                                      'bg-yellow-500'
                                    }`}></span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{point.region || point.bodyPart}</span>
                                  </div>
                                  {point.type && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Type: {point.type}</p>
                                  )}
                                  {point.notes && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">"{point.notes}"</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 dark:text-gray-400">No pain points recorded</p>
                          )}
                          
                          {/* Generated Nexus Language */}
                          {viewingPainMap.nexusLanguage && (
                            <div className="mt-4">
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Nexus Language</h4>
                              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                                <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">{viewingPainMap.nexusLanguage}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-3 mt-6">
                        <button
                          onClick={() => {
                            handleDeletePainMap(viewingPainMap.id);
                            setViewingPainMap(null);
                          }}
                          className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                          Delete Map
                        </button>
                        <button
                          onClick={() => setViewingPainMap(null)}
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

            {/* Form Viewer Modal */}
            {viewingForm && (
              <div className="fixed inset-0 bg-black bg-opacity-70 z-60 overflow-y-auto">
                <div className="min-h-screen px-4 py-8">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl mx-auto">
                    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold">{viewingForm.title || viewingForm.formName}</h3>
                        <p className="text-blue-100 text-sm">{viewingForm.formNumber}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingForm(null)}
                          className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
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
                {/* Draft Watermark */}
                <DraftWatermark variant="banner" />
                
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
                  
                  {/* Medical Disclaimer Footer */}
                  <NexusDisclaimerFooter className="mt-4" />
                </div>
                
                {/* Certification Checkbox before download */}
                <div className="border-t pt-4">
                  <CertificationCheckbox 
                    checked={isCertified}
                    onChange={setIsCertified}
                  />
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
      
      {/* VA.gov Rating Paster Modal */}
      {showVAGovPaster && (
        <VAGovRatingPaster
          onRatingsParsed={handlePastedRatings}
          onClose={() => setShowVAGovPaster(false)}
        />
      )}
    </div>
  );
};

export default MyPacket;
