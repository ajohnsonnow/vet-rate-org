/**
 * Vet-Rate.org - DD214 Information Analyzer
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Intelligent DD214 analyzer with:
 * - Local OCR support for scanned PDFs
 * - Multi-DD214 cumulative logic (prevents double-counting awards)
 * - AI-powered extraction with diagnostic status
 */

import React, { useState, useEffect, useRef } from 'react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { generateAI, getAIStatus, isAnyAIAvailable, isLocalAIReady } from '../utils/unifiedAIService';
import { AIStatusBadge } from './AIModeSelector';
import { LLMRecommendationBadge } from './LLMRecommendation';
import ReportBugLink from './ReportBugLink';
import { analyzeDocument, OCR_STATES, getProgressStyling, formatFileSize, isFileSupported, getFileTypeLabel, getAcceptString } from '../utils/documentAnalyzer';
import { saveDD214Data, getServiceHistory, addAward, getVeteranProfile, updateVeteranProfile } from '../utils/veteranProfile';
import { parseDD214Text } from '../utils/ribbonRackData';
import ProfileImportConfirmModal from './ProfileImportConfirmModal';

/**
 * System Prompt for Multi-Document Cumulative Analysis
 * Supports: DD214 (Active), NGB 22 (Guard), DD256/DD257 (Reserve)
 * Implements the "Master Record" protocol to prevent double-counting
 */
const DD214_ANALYSIS_SYSTEM_PROMPT = `You are a military records analyst specializing in discharge document interpretation.

SUPPORTED DISCHARGE DOCUMENTS:
- DD Form 214: Active Duty Separation (Certificate of Release or Discharge from Active Duty)
- NGB Form 22: National Guard Discharge (Report of Separation and Record of Service)
- DD Form 256: Reserve Discharge (Honorable Discharge - Reserve Components)
- DD Form 257: Reserve Discharge (General Discharge - Reserve Components)
- DD Form 2586: AGR Verification (Active Guard/Reserve)

ANALYSIS PROTOCOL FOR MULTIPLE DISCHARGE DOCUMENTS:
When you receive text from multiple discharge documents (DD214s, NGB 22s, DD256/257, etc.), follow this STRICT protocol:

1. IDENTIFY DOCUMENTS: Look for form identifiers and separation dates.
   - DD214: Look for "DD FORM 214" or "CERTIFICATE OF RELEASE"
   - NGB 22: Look for "NGB FORM 22" or "REPORT OF SEPARATION" + "NATIONAL GUARD"
   - DD256/257: Look for "DD FORM 256" or "DD FORM 257" + "RESERVE"
   - Extract the date in a standardized format
   - Note which pages belong to which document
   - Note component: Active Duty, National Guard, Reserve, AGR

2. DESIGNATE MASTER RECORD: The document with the LATEST separation date is the "Master Record"
   - The final discharge typically consolidates all prior service
   - HOWEVER: National Guard members may have BOTH DD214 (Active/Title 10) AND NGB 22 (State/Title 32)
   - BOTH are valid and paint a complete picture of Guard service

3. EXTRACTION ORDER:
   a) Extract ALL awards/decorations from the Master Record (Block 13 or equivalent) FIRST
   b) Check if Block 13 ends with "SEE REMARKS", "CONT", "CONTINUED", or similar
   c) If continuation exists, IMMEDIATELY append text from Block 18 (Remarks) or equivalent
   d) Only THEN review older documents
   e) Check for service periods NOT covered by Master Record

4. DEDUPLICATION RULE: When reviewing older documents:
   - ONLY add an award if it is DISTINCTLY DIFFERENT from those already captured
   - "Purple Heart" on DD214 #1 and "Purple Heart" on NGB 22 = COUNT ONCE
   - "Purple Heart" and "Purple Heart w/1 OLC" = COUNT THE ONE WITH DEVICES (more specific)
   - Different campaigns (Afghanistan vs Iraq) = COUNT BOTH

5. NATIONAL GUARD SPECIFICS:
   - NGB 22 shows Title 32 (state) service and State Active Duty
   - DD214 from Guard shows Title 10 (federal/active) deployments/mobilizations
   - BOTH documents together paint complete service picture
   - Total service time = AGR + SAD + Federal Active Duty time
   - Awards may appear on BOTH forms - use deduplication rules

6. RESERVE SPECIFICS:
   - DD256/257 shows drilling reserve time and training
   - Separate DD214 for any active duty tours/mobilizations
   - "Good Year" = year with 50+ retirement points
   - Reserve retirement points DO NOT equal active duty time
   - Be careful not to confuse points with days

7. OVERFLOW HANDLING (CRITICAL):
   - Block 13 has limited space. Long award lists ALWAYS overflow to Block 18/Remarks
   - Search Block 18 for: "CONTINUATION OF BLOCK 13", "AWARDS CONTINUED", "DECORATIONS:", etc.
   - This is where combat badges, campaign stars, and V devices are often listed

OUTPUT FORMAT:
Return a JSON object with this EXACT structure:
{
  "documentCount": number,
  "documentTypes": ["DD214", "NGB22", "DD256"],
  "masterRecordDate": "YYYY-MM-DD",
  "masterRecordType": "DD214|NGB22|DD256|DD257",
  "component": "Active|Guard|Reserve|AGR",
  "branch": "Army|Navy|Air Force|Marines|Coast Guard|Space Force|Army National Guard|Air National Guard",
  "mos": "Primary MOS/Rating code",
  "mosTitle": "Job title",
  "entryDate": "YYYY-MM-DD or null",
  "separationDate": "YYYY-MM-DD (from Master Record)",
  "yearsService": number,
  "monthsService": number,
  "separationType": "Retirement|ETS|Medical|etc",
  "characterOfService": "Honorable|General|etc",
  "reenlisted": true/false,
  "foreignService": true/false,
  "awards": [
    {
      "name": "Full award name",
      "abbreviation": "Common abbreviation",
      "devices": ["Oak Leaf Cluster", "V Device", "Bronze Service Star"],
      "deviceCount": number,
      "isCombat": true/false,
      "sourceDocument": "Master Record|DD214 #1|NGB 22|DD256|etc"
    }
  ],
  "combatService": {
    "hasVerifiedCombat": true/false,
    "indicators": ["Combat Action Badge", "Purple Heart", "Iraq Campaign Medal", etc]
  },
  "specialQualifications": ["Airborne", "Ranger", "etc"],
  "extractionNotes": ["Any issues or ambiguities found"]
}

RETURN ONLY THE JSON. No explanations, no markdown.`;

/**
 * DiagnosticStatus Component - Shows AI readiness in modal footer
 */
const DiagnosticStatus = ({ aiStatus, isGenerating }) => {
  if (isGenerating) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-sm">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        <span>🟡 Analyzing...</span>
      </div>
    );
  }

  if (!aiStatus.available) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm">
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span>🔴 AI Offline (Load Model First)</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      <span>🟢 AI Ready {aiStatus.isPrivate ? '(Local - 100% Private)' : '(Cloud)'}</span>
    </div>
  );
};

/**
 * OCR Progress Bar Component
 */
const OCRProgressBar = ({ progress }) => {
  const styling = getProgressStyling(progress);
  
  return (
    <div className={`p-4 rounded-xl ${styling.bgColor} border border-current/20`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${styling.textColor}`}>
          {styling.icon} {progress.message}
        </span>
        <span className={`text-sm font-bold ${styling.textColor}`}>
          {progress.progress}%
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full ${styling.barColor} transition-all duration-300 ease-out`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>
      {progress.currentPage && progress.totalPages && (
        <p className={`text-xs ${styling.textColor} mt-1`}>
          Page {progress.currentPage} of {progress.totalPages}
        </p>
      )}
    </div>
  );
};

/**
 * Main DD214 Analyzer Component
 */
const DD214Analyzer = ({ onClose, onReportBug, onOpenAISettings, onSaveResults }) => {
  useBodyScrollLock(true);

  // State
  const [aiStatus, setAIStatus] = useState({ available: false });
  const [inputMethod, setInputMethod] = useState('paste'); // 'paste' | 'upload'
  const [pastedText, setPastedText] = useState('');
  const [droppedFiles, setDroppedFiles] = useState([]);
  const [extractedTexts, setExtractedTexts] = useState([]);
  const [ocrProgress, setOcrProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Profile import confirmation modal
  const [showProfileImportModal, setShowProfileImportModal] = useState(false);
  const [extractedProfileData, setExtractedProfileData] = useState(null);
  
  const fileInputRef = useRef(null);

  // Check AI status on mount and periodically
  useEffect(() => {
    const checkStatus = () => setAIStatus(getAIStatus());
    checkStatus();
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Drag and Drop Handlers
   */
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(f => isFileSupported(f));
    if (files.length === 0) {
      setError('Please drop supported files: PDF, Word (.docx), Text (.txt), or RTF');
      return;
    }
    
    await processFiles(files);
  };

  /**
   * Process dropped in or selected files
   */
  const processFiles = async (files) => {
    if (files.length === 0) return;

    setError(null);
    setDroppedFiles(prev => [...prev, ...files]);
    
    // Process each file
    for (const file of files) {
      if (!isFileSupported(file)) {
        setError(`${file.name} is not a supported format. Use PDF, DOCX, TXT, or RTF.`);
        continue;
      }

      setIsProcessing(true);
      setOcrProgress({
        state: OCR_STATES.LOADING,
        progress: 0,
        message: `Loading ${file.name}...`,
      });

      try {
        const result = await analyzeDocument(file, setOcrProgress);
        
        setExtractedTexts(prev => [...prev, {
          filename: file.name,
          text: result.text,
          pageCount: result.pageCount,
          method: result.method,
          fileType: result.fileType,
          ocrUsed: result.ocrUsed,
        }]);
        
      } catch (err) {
        console.error('File processing error:', err);
        setError(`Failed to process ${file.name}: ${err.message}`);
      }
    }
    
    setIsProcessing(false);
    setOcrProgress(null);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle file selection via input
   */
  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    await processFiles(files);
  };

  /**
   * Remove a dropped in file
   */
  const handleRemoveFile = (index) => {
    setDroppedFiles(prev => prev.filter((_, i) => i !== index));
    setExtractedTexts(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Combine all input sources into analysis text
   */
  const getCombinedText = () => {
    let combined = '';
    
    // Add pasted text if present
    if (pastedText.trim()) {
      combined += `=== PASTED DD214 TEXT ===\n${pastedText.trim()}\n\n`;
    }
    
    // Add extracted texts from dropped in files
    extractedTexts.forEach((item, idx) => {
      combined += `=== DD214 DOCUMENT ${idx + 1}: ${item.filename} ===\n`;
      combined += `(File type: ${item.fileType || 'PDF'}, Method: ${item.method}, Pages: ${item.pageCount})\n\n`;
      combined += item.text;
      combined += '\n\n';
    });
    
    return combined.trim();
  };

  /**
   * Main Analysis Handler - THE BUTTON
   */
  const handleAnalyzeWithAI = async () => {
    const combinedText = getCombinedText();
    
    if (!combinedText) {
      setError('Please paste DD214 text or drop in PDF files first');
      return;
    }

    if (!aiStatus.available) {
      setError('AI is not available. Please configure AI settings first.');
      return;
    }

    setError(null);
    setIsGenerating(true);
    setAnalysisResult(null);

    try {
      // Call the unified AI service with our specialized system prompt
      const response = await generateAI(
        `${DD214_ANALYSIS_SYSTEM_PROMPT}\n\nDD214 DOCUMENT(S) TO ANALYZE:\n\n${combinedText}`,
        {
          temperature: 0.2, // Lower temperature for more consistent JSON output
          maxTokens: 4096,
          expectJSON: true,
          systemPrompt: DD214_ANALYSIS_SYSTEM_PROMPT,
        }
      );

      // Extract text from response
      const content = response?.text || response;
      if (!content) {
        throw new Error('No response received from AI');
      }

      // Parse JSON from response
      let data;
      try {
        let cleanContent = typeof content === 'string' ? content.trim() : JSON.stringify(content);
        
        // Remove markdown code fences if present
        if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
        if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
        if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);
        
        data = JSON.parse(cleanContent.trim());
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Content:', content);
        throw new Error('Could not parse AI response. Please try again.');
      }

      setAnalysisResult(data);
      
      // Automatically trigger the save flow to show import confirmation
      // This provides immediate feedback to the user
      setTimeout(() => {
        handleSaveResultsAfterAnalysis(data);
      }, 500);

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Save results after analysis (automatic trigger)
   */
  const handleSaveResultsAfterAnalysis = (result) => {
    if (!result) return;

    try {
      // Prepare extracted profile data for review
      const profileData = {
        branch: result.branch,
        mos: result.mos,
        mosTitle: result.mosTitle,
        serviceStartDate: result.entryDate,
        entryDate: result.entryDate,
        serviceEndDate: result.separationDate,
        separationDate: result.separationDate,
        separationType: result.separationType,
        characterOfService: result.characterOfService,
        reenlisted: result.reenlisted,
        foreignService: result.foreignService,
        yearsService: result.yearsService,
        monthsService: result.monthsService,
      };

      // Show confirmation modal automatically
      setExtractedProfileData(profileData);
      setShowProfileImportModal(true);
      
    } catch (err) {
      console.error('Auto-save prep error:', err);
      // Don't show error, user can still click manual save button
    }
  };

  /**
   * Save results to veteran profile - Shows confirmation modal first
   */
  const handleSaveResults = () => {
    if (!analysisResult) return;

    try {
      // Prepare extracted profile data for review
      const profileData = {
        // Map DD214 fields to profile fields
        branch: analysisResult.branch,
        mos: analysisResult.mos,
        mosTitle: analysisResult.mosTitle,
        serviceStartDate: analysisResult.entryDate,
        entryDate: analysisResult.entryDate,
        serviceEndDate: analysisResult.separationDate,
        separationDate: analysisResult.separationDate,
        separationType: analysisResult.separationType,
        characterOfService: analysisResult.characterOfService,
        reenlisted: analysisResult.reenlisted,
        foreignService: analysisResult.foreignService,
        // Metadata
        yearsService: analysisResult.yearsService,
        monthsService: analysisResult.monthsService,
      };

      // Show confirmation modal
      setExtractedProfileData(profileData);
      setShowProfileImportModal(true);
      
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to prepare data for import. Please try again.');
    }
  };

  /**
   * Confirm and save profile data after user review
   */
  const handleConfirmProfileImport = (selectedFields) => {
    try {
      // Save DD214 data to service history (includes all fields)
      saveDD214Data({
        branch: analysisResult.branch,
        mos: analysisResult.mos,
        mosTitle: analysisResult.mosTitle,
        entryDate: analysisResult.entryDate,
        separationDate: analysisResult.separationDate,
        yearsService: analysisResult.yearsService,
        monthsService: analysisResult.monthsService,
        separationType: analysisResult.separationType,
        characterOfService: analysisResult.characterOfService,
        reenlisted: analysisResult.reenlisted,
        foreignService: analysisResult.foreignService,
        extractedText: getCombinedText().substring(0, 10000),
        dd214Count: analysisResult.dd214Count,
        combatService: analysisResult.combatService,
        specialQualifications: analysisResult.specialQualifications,
      });

      // Save awards to profile
      if (analysisResult.awards && Array.isArray(analysisResult.awards)) {
        analysisResult.awards.forEach(award => {
          addAward({
            name: award.name,
            abbreviation: award.abbreviation,
            dateReceived: null,
            notes: award.devices?.join(', ') || '',
            isCombat: award.isCombat || false,
            sourceDD214: award.sourceDD214,
          });
        });
      }

      // Update veteran profile with selected fields only
      if (selectedFields && Object.keys(selectedFields).length > 0) {
        updateVeteranProfile(selectedFields);
      }

      // Callback if provided
      if (onSaveResults) {
        onSaveResults(analysisResult);
      }

      // Close modal
      setShowProfileImportModal(false);
      setExtractedProfileData(null);

      // Success message
      const fieldCount = Object.keys(selectedFields).length;
      alert(`✅ DD214 data saved!\n• Service history updated\n• ${analysisResult.awards?.length || 0} awards recorded\n• ${fieldCount} profile field${fieldCount !== 1 ? 's' : ''} imported`);
      
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save results. Please try again.');
      setShowProfileImportModal(false);
    }
  };

  /**
   * Cancel profile import
   */
  const handleCancelProfileImport = () => {
    setShowProfileImportModal(false);
    setExtractedProfileData(null);
  };

  /**
   * Clear all inputs
   */
  const handleClearAll = () => {
    setPastedText('');
    setDroppedFiles([]);
    setExtractedTexts([]);
    setAnalysisResult(null);
    setError(null);
  };

  const hasInput = pastedText.trim() || extractedTexts.length > 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📜</span>
            <div>
              <h2 className="text-xl font-bold text-white">DD214 Analyzer</h2>
              <p className="text-sm text-blue-200">Extract & analyze your service records</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LLMRecommendationBadge toolId="dd214-analyzer" />
            <AIStatusBadge onClick={onOpenAISettings} />
            {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="DD214 Analyzer" />}
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Privacy Notice */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">100% Private Processing</h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {aiStatus.isPrivate 
                    ? "Your DD214 is processed entirely on your device. Nothing is sent to external servers."
                    : "Using Cloud AI - your data is sent to Google's servers for processing. For maximum privacy, switch to Local AI in settings."}
                </p>
              </div>
            </div>
          </div>

          {/* Input Method Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setInputMethod('paste')}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                inputMethod === 'paste'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              📋 Paste Text
            </button>
            <button
              onClick={() => setInputMethod('upload')}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                inputMethod === 'upload'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              📄 Drop In PDF {extractedTexts.length > 0 && `(${extractedTexts.length})`}
            </button>
          </div>

          {/* Paste Input */}
          {inputMethod === 'paste' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Paste your DD214 text below:
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Copy text from your DD214 PDF and paste here...&#10;&#10;Tip: If you have multiple DD214s (re-enlistments), paste them all together. The AI will identify and consolidate them."
                rows={10}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ⚠️ Your DD214 contains sensitive PII. Data stays on your device only.
              </p>
            </div>
          )}

          {/* Upload Input */}
          {inputMethod === 'upload' && (
            <div className="space-y-4">
              {/* Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/30 scale-105'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-gray-600 dark:text-gray-400 font-medium">
                  {isDragging ? '📥 Drop PDF files here' : '📄 Drag & drop DD214 PDFs or click to browse'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Supports PDF, Word (.docx), Text, RTF • Scanned PDFs auto-OCR • Multiple files OK
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={getAcceptString()}
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* OCR Progress */}
              {ocrProgress && (
                <OCRProgressBar progress={ocrProgress} />
              )}

              {/* Processed Files List */}
              {extractedTexts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">Processed Files:</h4>
                  {extractedTexts.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📄</span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{item.filename}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {item.pageCount} pages • {item.method === 'ocr' ? '🔍 OCR' : item.method === 'hybrid' ? '🔍 Hybrid' : '📝 Text'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(idx)}
                        className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-200">Error</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Analysis Results */}
          {analysisResult && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                  ✅ Analysis Complete
                  {analysisResult.dd214Count > 1 && (
                    <span className="text-xs bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded-full">
                      {analysisResult.dd214Count} DD214s consolidated
                    </span>
                  )}
                </h3>
              </div>

              {/* Service Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Branch</p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{analysisResult.branch || 'N/A'}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">MOS</p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{analysisResult.mos || 'N/A'}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Time in Service</p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {analysisResult.yearsService ? `${analysisResult.yearsService}y ${analysisResult.monthsService || 0}m` : 'N/A'}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Separation</p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">{analysisResult.separationDate || 'N/A'}</p>
                </div>
              </div>

              {/* Combat Service */}
              {analysisResult.combatService?.hasVerifiedCombat && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                  <h4 className="font-bold text-red-800 dark:text-red-200 flex items-center gap-2 mb-2">
                    ⚔️ Combat Service Verified
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.combatService.indicators?.map((indicator, idx) => (
                      <span key={idx} className="px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-sm rounded-full">
                        {indicator}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Awards */}
              {analysisResult.awards && analysisResult.awards.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3">
                    🎖️ Awards & Decorations ({analysisResult.awards.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {analysisResult.awards.map((award, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg text-sm ${
                          award.isCombat
                            ? 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {award.isCombat && '⚔️ '}{award.name}
                        </p>
                        {award.devices && award.devices.length > 0 && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            w/ {award.devices.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extraction Notes */}
              {analysisResult.extractionNotes && analysisResult.extractionNotes.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 text-sm mb-1">📝 Notes</h4>
                  <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                    {analysisResult.extractionNotes.map((note, idx) => (
                      <li key={idx}>• {note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-2xl bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
          {/* Diagnostic Status */}
          <DiagnosticStatus aiStatus={aiStatus} isGenerating={isGenerating} />
          
          {/* Actions */}
          <div className="flex items-center gap-3">
            {hasInput && (
              <button
                onClick={handleClearAll}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
              >
                Clear All
              </button>
            )}
            
            {analysisResult && (
              <button
                onClick={handleSaveResults}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                💾 Save to Profile
              </button>
            )}
            
            <button
              onClick={handleAnalyzeWithAI}
              disabled={!hasInput || !aiStatus.available || isGenerating || isProcessing}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  🤖 Analyze with AI
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Profile Import Confirmation Modal */}
      {showProfileImportModal && extractedProfileData && (
        <ProfileImportConfirmModal
          extractedData={extractedProfileData}
          currentProfile={getVeteranProfile()}
          onConfirm={handleConfirmProfileImport}
          onCancel={handleCancelProfileImport}
        />
      )}
    </div>
  );
};

export default DD214Analyzer;
