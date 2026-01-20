/**
 * Vet-Rate.org - C-File Analyzer Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * The "Kill Shot" feature - Client-side C-File analysis that competitors charge $500+ for
 * Analyzes veteran claims files locally using AI to identify evidence and claim opportunities
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ripTextFromPdf, readFileAsArrayBuffer, formatFileSize, estimateProcessingTime } from '../utils/pdfExtractor';
import { analyzeCFile, getCFilePrivacyDisclosure } from '../utils/cfileAnalyzer';
import { isAnyAIAvailable, getAIStatus, AI_MODES } from '../utils/unifiedAIService';
import { AIStatusBadge } from './AIModeSelector';

// Sub-components for the dashboard
import CFileTimeline from './CFileTimeline';
import CFileClaimsCards from './CFileClaimsCards';

export default function CFileAnalyzer({ onClose, onOpenAISettings }) {
  // File upload state
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  
  // AI status state (unified AI service handles API keys internally)
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);
  
  // Consent state
  const [showPrivacyConsent, setShowPrivacyConsent] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  
  // Results state
  const [analysisResult, setAnalysisResult] = useState(null);
  const [extractedText, setExtractedText] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  
  // Monitor AI status
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Handle file drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      if (droppedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        return;
      }
      setFile(droppedFile);
      setError(null);
      setAnalysisResult(null);
    }
  }, []);
  
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleFileSelect = useCallback((e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setAnalysisResult(null);
    }
  }, []);
  
  // Start analysis process
  const handleStartAnalysis = useCallback(() => {
    if (!file) {
      setError('Please upload a file first.');
      return;
    }
    
    // Check if ANY AI is available (Cloud or Local)
    if (!isAnyAIAvailable()) {
      setError('No AI available. Please set up an API key or enable Local AI in settings.');
      setShowAISettings(true);
      return;
    }
    
    setShowPrivacyConsent(true);
  }, [file]);
  
  // Process the file after consent
  const handleConsentAndProcess = useCallback(async () => {
    setHasConsented(true);
    setShowPrivacyConsent(false);
    setIsProcessing(true);
    setError(null);
    
    try {
      // Stage 1: Read the file
      setProcessingStage('Reading PDF file...');
      const arrayBuffer = await readFileAsArrayBuffer(file);
      
      // Stage 2: Extract text
      setProcessingStage('Extracting text from PDF...');
      const extractionResult = await ripTextFromPdf(
        arrayBuffer,
        (current, total) => setExtractionProgress({ current, total })
      );
      
      // Check if the PDF has actual text
      if (!extractionResult.hasText) {
        setError(
          `This PDF appears to be a scanned image with minimal text (${extractionResult.avgCharsPerPage} characters per page average). ` +
          'Please use OCR software (like Adobe Acrobat "Recognize Text" or a free online OCR tool) to make it searchable first, then re-upload.'
        );
        setIsProcessing(false);
        return;
      }
      
      setExtractedText(extractionResult);
      
      // Stage 3: Analyze with AI (uses unified AI service - no API key needed here)
      setProcessingStage('Analyzing with AI...');
      const result = await analyzeCFile(
        null, // API key handled by unified AI service
        extractionResult.text,
        (status) => setProcessingStage(status)
      );
      
      setAnalysisResult(result.analysis);
      setProcessingStage('');
      
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setIsProcessing(false);
    }
  }, [file]);
  
  // Reset to start over
  const handleReset = useCallback(() => {
    setFile(null);
    setAnalysisResult(null);
    setExtractedText(null);
    setError(null);
    setProcessingStage('');
    setExtractionProgress({ current: 0, total: 0 });
    setHasConsented(false);
  }, []);
  
  // Render the upload form
  const renderUploadForm = () => (
    <div className="max-w-4xl mx-auto">
      {/* Warning Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-bold text-amber-800 dark:text-amber-200">Security Notice</h3>
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              Your C-File contains highly sensitive information. This tool processes everything locally in your browser.
              Only the extracted text is sent to Google's AI service using YOUR API key. We never see or store your data.
            </p>
          </div>
        </div>
      </div>
      
      {/* AI Tip - Compact */}
      {isAnyAIAvailable() && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
            <span>💡</span>
            <span><strong>Tip:</strong> Large C-Files work great! Gemini can process up to 2,000 pages in one pass.</span>
          </div>
        </div>
      )}
      
      {/* Drop Zone */}
      <div
        className={`border-3 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
            : file
            ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {file ? (
          <div className="space-y-3">
            <div className="text-5xl">📄</div>
            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              {file.name}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {formatFileSize(file.size)}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
            >
              Remove and choose different file
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-5xl">📁</div>
            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Drop your C-File PDF here
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              or click to browse
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-500">
              Supports PDF files up to 500MB
            </div>
          </div>
        )}
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="mt-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">❌</span>
            <div className="text-red-700 dark:text-red-300">{error}</div>
          </div>
        </div>
      )}
      
      {/* AI Status Warning */}
      {!isAnyAIAvailable() && (
        <div className="mt-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="text-amber-800 dark:text-amber-200">
              <p className="font-semibold">AI Required</p>
              <p className="text-sm mt-1">
                Click the <strong>AI button</strong> in the header above to load your secure Local AI 
                or enter your Gemini API key to analyze your C-File.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Analyze Button */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={handleStartAnalysis}
          disabled={!file || !isAnyAIAvailable()}
          className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${file && isAnyAIAvailable()
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1'
              : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
        >
          🔍 Analyze My C-File
        </button>
      </div>
      
      {file && (
        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Estimated processing time: {estimateProcessingTime(Math.ceil(file.size / 5000))}
        </div>
      )}
    </div>
  );
  
  // Render privacy consent modal
  const renderPrivacyConsent = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            🔒 Privacy & Data Handling
          </h2>
          
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
              {getCFilePrivacyDisclosure()}
            </pre>
          </div>
          
          <div className="mt-6 flex gap-4">
            <button
              onClick={() => setShowPrivacyConsent(false)}
              className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConsentAndProcess}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              I Understand - Start Analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Render processing state
  const renderProcessing = () => (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="mb-8">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
      </div>
      
      <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
        Analyzing Your C-File...
      </h3>
      
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
        {processingStage}
      </p>
      
      {extractionProgress.total > 0 && processingStage.includes('Extracting') && (
        <div className="max-w-md mx-auto">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${(extractionProgress.current / extractionProgress.total) * 100}%` }}
            ></div>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Page {extractionProgress.current} of {extractionProgress.total}
          </p>
        </div>
      )}
      
      <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
        ⚡ Large files may take several minutes. Please keep this tab open.
      </div>
    </div>
  );
  
  // Render the analysis dashboard
  const renderDashboard = () => (
    <div className="max-w-7xl mx-auto">
      {/* Header with file info */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              ✅ Analysis Complete
            </h2>
            <p className="mt-1 opacity-90">
              {file?.name} • {extractedText?.pageCount} pages analyzed • {extractedText?.totalCharacters?.toLocaleString()} characters extracted
            </p>
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
          >
            Analyze Another File
          </button>
        </div>
      </div>
      
      {/* Executive Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
          📋 Executive Summary
        </h3>
        <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
          {analysisResult.summary}
        </p>
        
        {analysisResult.servicePeriod && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {analysisResult.servicePeriod.branch && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">Branch</div>
                <div className="font-semibold text-gray-800 dark:text-gray-200">{analysisResult.servicePeriod.branch}</div>
              </div>
            )}
            {analysisResult.servicePeriod.mos && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">MOS</div>
                <div className="font-semibold text-gray-800 dark:text-gray-200">{analysisResult.servicePeriod.mos}</div>
              </div>
            )}
            {analysisResult.servicePeriod.entryDate && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">Entry Date</div>
                <div className="font-semibold text-gray-800 dark:text-gray-200">{analysisResult.servicePeriod.entryDate}</div>
              </div>
            )}
            {analysisResult.servicePeriod.separationDate && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">Separation Date</div>
                <div className="font-semibold text-gray-800 dark:text-gray-200">{analysisResult.servicePeriod.separationDate}</div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'claims', label: '🎯 Potential Claims', count: analysisResult.potential_claims?.length },
          { id: 'timeline', label: '📅 Timeline', count: analysisResult.timeline?.length },
          { id: 'exposures', label: '☢️ Exposures', count: analysisResult.exposures?.length },
          { id: 'mental', label: '🧠 Mental Health' },
          { id: 'actions', label: '✅ Action Items', count: analysisResult.actionItems?.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {activeTab === 'claims' && (
          <CFileClaimsCards claims={analysisResult.potential_claims || []} />
        )}
        
        {activeTab === 'timeline' && (
          <CFileTimeline events={analysisResult.timeline || []} />
        )}
        
        {activeTab === 'exposures' && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Toxic Exposures & Presumptive Conditions</h3>
            {analysisResult.exposures?.length > 0 ? (
              <div className="space-y-4">
                {analysisResult.exposures.map((exposure, idx) => (
                  <div key={idx} className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-orange-800 dark:text-orange-200">{exposure.type}</h4>
                        {exposure.location && <p className="text-sm text-orange-700 dark:text-orange-300">📍 {exposure.location}</p>}
                        {exposure.timeframe && <p className="text-sm text-orange-700 dark:text-orange-300">📅 {exposure.timeframe}</p>}
                      </div>
                      {exposure.page_number && (
                        <span className="text-xs bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-2 py-1 rounded">
                          Page {exposure.page_number}
                        </span>
                      )}
                    </div>
                    {exposure.presumptive_conditions?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-orange-800 dark:text-orange-200 mb-1">Presumptive Conditions:</p>
                        <div className="flex flex-wrap gap-1">
                          {exposure.presumptive_conditions.map((condition, i) => (
                            <span key={i} className="text-xs bg-orange-100 dark:bg-orange-800/50 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">
                              {condition}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No toxic exposures identified in the records.</p>
            )}
          </div>
        )}
        
        {activeTab === 'mental' && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Mental Health Indicators</h3>
            {analysisResult.mentalHealth && (
              <div className="space-y-4">
                {analysisResult.mentalHealth.diagnoses?.length > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <h4 className="font-bold text-purple-800 dark:text-purple-200 mb-2">Diagnoses Found</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.mentalHealth.diagnoses.map((dx, i) => (
                        <span key={i} className="bg-purple-100 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-sm">
                          {dx}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {analysisResult.mentalHealth.indicators?.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-2">Indicators</h4>
                    <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 text-sm space-y-1">
                      {analysisResult.mentalHealth.indicators.map((indicator, i) => (
                        <li key={i}>{indicator}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {analysisResult.mentalHealth.stressors?.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-2">Documented Stressors</h4>
                    <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 text-sm space-y-1">
                      {analysisResult.mentalHealth.stressors.map((stressor, i) => (
                        <li key={i}>{stressor}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {analysisResult.mentalHealth.pages?.length > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    📄 See pages: {analysisResult.mentalHealth.pages.join(', ')}
                  </p>
                )}
              </div>
            )}
            {(!analysisResult.mentalHealth || 
              (!analysisResult.mentalHealth.diagnoses?.length && 
               !analysisResult.mentalHealth.indicators?.length)) && (
              <p className="text-gray-500 dark:text-gray-400">No mental health indicators identified in the records.</p>
            )}
          </div>
        )}
        
        {activeTab === 'actions' && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Recommended Next Steps</h3>
            {analysisResult.actionItems?.length > 0 ? (
              <div className="space-y-3">
                {analysisResult.actionItems.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-green-500 text-white rounded-full font-bold text-sm">
                      {idx + 1}
                    </span>
                    <p className="text-green-800 dark:text-green-200">{action}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No specific action items identified.</p>
            )}
          </div>
        )}
      </div>
      
      {/* Red Flags Section */}
      {analysisResult.redFlags?.length > 0 && (
        <div className="mt-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-red-800 dark:text-red-200 mb-4 flex items-center gap-2">
            🚨 Attention Needed
          </h3>
          <div className="space-y-3">
            {analysisResult.redFlags.map((flag, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-700">
                <div className="flex items-start justify-between">
                  <p className="font-medium text-red-800 dark:text-red-200">{flag.issue}</p>
                  {flag.page_number && (
                    <span className="text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 px-2 py-1 rounded">
                      Page {flag.page_number}
                    </span>
                  )}
                </div>
                {flag.suggestion && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    💡 {flag.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Combat Indicators */}
      {analysisResult.combatIndicators?.length > 0 && (
        <div className="mt-6 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-indigo-800 dark:text-indigo-200 mb-4 flex items-center gap-2">
            🎖️ Combat Indicators Found
          </h3>
          <div className="space-y-3">
            {analysisResult.combatIndicators.map((indicator, idx) => (
              <div key={idx} className="flex items-start justify-between bg-white dark:bg-gray-800 rounded-lg p-4 border border-indigo-200 dark:border-indigo-700">
                <div>
                  <p className="font-medium text-indigo-800 dark:text-indigo-200">{indicator.indicator}</p>
                  {indicator.significance && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{indicator.significance}</p>
                  )}
                </div>
                {indicator.page_number && (
                  <span className="text-xs bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 px-2 py-1 rounded">
                    Page {indicator.page_number}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto modal-backdrop overscroll-contain"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto relative modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-violet-600 to-purple-600 border-b border-violet-500 shadow-sm rounded-t-xl">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔬</span>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  C-File Analyzer
                </h1>
                <p className="text-sm text-violet-100">
                  AI-powered claims evidence discovery
                </p>
              </div>
              <span className="ml-2 px-2 py-1 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold rounded-full">
                BETA
              </span>
              <span className="ml-1 px-2 py-1 bg-blue-500/90 text-white text-xs font-semibold rounded-full flex items-center gap-1" title="VA also uses AI for document classification in claims processing">
                🤖 VA Uses Similar AI
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* AI Status Badge - Fully Functional from Main Header */}
              <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                aria-label="Close C-File Analyzer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="p-4">
        {showPrivacyConsent && renderPrivacyConsent()}
        
        {isProcessing ? (
          renderProcessing()
        ) : analysisResult ? (
          renderDashboard()
        ) : (
          renderUploadForm()
        )}
        </div>
        
        {/* Footer Disclaimer */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-4">
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 max-w-4xl mx-auto">
            ⚠️ This tool provides general information only and is not legal or medical advice. 
            AI analysis may contain errors. Always verify findings with your official records and consult with a 
            VA-accredited representative for claims decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
