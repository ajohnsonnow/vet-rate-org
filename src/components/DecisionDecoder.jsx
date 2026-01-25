import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import useAutoInitAI from '../hooks/useAutoInitAI';
import { decodeDecision, isAIAvailable } from '../utils/aiStatementHelper';
import { getAIStatus, AI_MODES, isAnyAIAvailable } from '../utils/unifiedAIService';
import { AIStatusBadge, AIModeSelector } from './AIModeSelector';
import { LLMRecommendationBadge } from './LLMRecommendation';
import AIModelQuickLoad from './AIModelQuickLoad';
import { useVaBenefitsRef, CLAIM_PHASES } from '../hooks/useVaBenefitsRef';
import { analyzePDF, analyzeImage, OCR_STATES, formatFileSize, isImageFile, isPDFFile } from '../utils/ocr';

/**
 * DecisionDecoder Component - "The Denial Translator"
 * 
 * WHY: VA denial letters are written in legalese. A veteran reads:
 * "The evidence does not establish a nexus between your current condition 
 * and your service-connected disability."
 * And thinks: "WTF does that mean?"
 * 
 * THIS TOOL: Translates it into:
 * - PLAIN ENGLISH: "They're saying your doctor didn't explicitly say 'X caused Y.'"
 * - MISSING ELEMENT: "A Nexus Letter from a doctor."
 * - ACTION PLAN: "Get a Nexus Letter from a private physician, or request an Independent Medical Opinion."
 */

const DecisionDecoder = ({ onClose, onReportBug, onOpenAISettings }) => {
  const { t } = useLanguage();
  useBodyScrollLock(true);
  
  // Auto-initialize AI when component mounts
  const { aiReady, aiInitializing, initProgress, initMessage } = useAutoInitAI('decision-decoder', 'auditor');
  
  const [denialText, setDenialText] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  const [showPhaseExplainer, setShowPhaseExplainer] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [inputMethod, setInputMethod] = useState('paste'); // 'paste' or 'file'
  
  // File Drop-In state (PDF or Image) - supports MULTIPLE files
  const [uploadedFiles, setUploadedFiles] = useState([]); // Array of { file, fileType, preview, extractedText, error }
  const [ocrProgress, setOcrProgress] = useState(null);
  const [currentProcessingFile, setCurrentProcessingFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);
  
  // Benefits Reference hook for claim phase explanations
  const { getClaimPhaseInfo, getAllClaimPhases } = useVaBenefitsRef();
  
  // Monitor AI status changes
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // File Drop-In handlers (PDF or Image)
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
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await processMultipleFiles(Array.from(files));
    }
  };

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processMultipleFiles(Array.from(files));
    }
  };

  // Process multiple files sequentially
  const processMultipleFiles = async (files) => {
    setFileError(null);
    
    for (const file of files) {
      // Check for duplicates
      const isDuplicate = uploadedFiles.some(f => f.file.name === file.name && f.file.size === file.size);
      if (isDuplicate) {
        continue; // Skip duplicates
      }
      
      await processFile(file);
    }
  };

  const processFile = async (file) => {
    // Determine file type
    let fileType = null;
    if (isPDFFile(file)) {
      fileType = 'pdf';
    } else if (isImageFile(file)) {
      fileType = 'image';
    } else {
      setFileError(`Unsupported file: ${file.name}. Use PDF or image (PNG, JPG, JPEG, GIF, BMP, WEBP).`);
      return;
    }
    
    // Create file entry with pending status
    const fileId = `${file.name}-${Date.now()}`;
    const newFileEntry = {
      id: fileId,
      file,
      fileType,
      preview: null,
      extractedText: '',
      error: null,
      processing: true
    };
    
    // Add to list immediately (shows processing state)
    setUploadedFiles(prev => [...prev, newFileEntry]);
    setCurrentProcessingFile(file.name);
    
    try {
      let extractedText = '';
      let preview = null;
      
      if (fileType === 'pdf') {
        const result = await analyzePDF(file, (progress) => {
          setOcrProgress(progress);
        });
        extractedText = result.text || '';
      } else {
        // Create preview for images
        preview = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(file);
        });
        
        const result = await analyzeImage(file, (progress) => {
          setOcrProgress(progress);
        });
        extractedText = result.success ? result.text || '' : '';
        if (!result.success) {
          newFileEntry.error = result.error || 'Failed to extract text';
        }
      }
      
      // Update file entry with results
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, extractedText, preview, processing: false, error: extractedText ? null : 'No text extracted' }
          : f
      ));
      
      // Update combined denial text
      updateCombinedText();
      
    } catch (err) {
      console.error('File processing error:', err);
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, processing: false, error: 'Failed to process file' }
          : f
      ));
    }
    
    setOcrProgress(null);
    setCurrentProcessingFile(null);
  };

  // Combine text from all successfully processed files
  const updateCombinedText = () => {
    setUploadedFiles(prev => {
      const combinedText = prev
        .filter(f => f.extractedText)
        .map((f, idx) => `--- Document ${idx + 1}: ${f.file.name} ---\n${f.extractedText}`)
        .join('\n\n');
      
      // Use setTimeout to avoid state update during render
      setTimeout(() => {
        if (combinedText) {
          setDenialText(combinedText);
        }
      }, 0);
      
      return prev;
    });
  };

  // Effect to update combined text when files change
  useEffect(() => {
    const combinedText = uploadedFiles
      .filter(f => f.extractedText && !f.processing)
      .map((f, idx) => `--- Document ${idx + 1}: ${f.file.name} ---\n${f.extractedText}`)
      .join('\n\n');
    
    if (combinedText && uploadedFiles.some(f => !f.processing)) {
      setDenialText(combinedText);
    }
  }, [uploadedFiles]);

  const handleRemoveFile = (fileId) => {
    setUploadedFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      // Update combined text after removal
      const combinedText = updated
        .filter(f => f.extractedText)
        .map((f, idx) => `--- Document ${idx + 1}: ${f.file.name} ---\n${f.extractedText}`)
        .join('\n\n');
      
      setTimeout(() => setDenialText(combinedText), 0);
      return updated;
    });
  };

  const handleClearAllFiles = () => {
    setUploadedFiles([]);
    setOcrProgress(null);
    setDenialText('');
    setFileError(null);
    setCurrentProcessingFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDecode = async () => {
    if (!denialText.trim()) {
      setError('Please paste your denial letter or decision text first.');
      return;
    }

    if (denialText.trim().length < 50) {
      setError('The text seems too short. Please paste more of the denial letter.');
      return;
    }

    if (!isAIAvailable()) {
      setError('AI features are not available. Please add your Gemini API key in Settings to use the Decision Decoder.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    // Create a timeout promise to prevent infinite loading
    const TIMEOUT_MS = 90000; // 90 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS);
    });

    try {
      console.log('[DecisionDecoder] Starting AI decode with', denialText.length, 'characters');
      
      // Race between the actual call and timeout
      const response = await Promise.race([
        decodeDecision(denialText),
        timeoutPromise
      ]);
      
      console.log('[DecisionDecoder] AI response:', response);
      
      if (response.success) {
        setResults({
          ...response.data,
          // Pass through fallback info to show helpful notice
          _usedFallback: response.usedFallback,
          _fallbackReason: response.fallbackReason,
          _fallbackNote: response.fallbackNote,
          // Pass through truncation info to show helpful notice
          _wasTruncated: response.wasTruncated,
          _truncationNote: response.truncationNote
        });
      } else {
        // Check for context overflow error - show helpful message
        if (response.isContextOverflow) {
          setError(response.error);
        } else {
          setError(response.error || 'Failed to decode decision. Please try again.');
        }
      }
    } catch (err) {
      console.error('[DecisionDecoder] Decode error:', err);
      if (err.message === 'TIMEOUT') {
        setError('The AI request timed out after 90 seconds. This can happen if the AI is overloaded. Please try again, or try with a shorter excerpt of your decision letter.');
      } else {
        setError('An error occurred during decoding: ' + (err.message || 'Please try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getDecisionTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'full denial':
        return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700';
      case 'partial denial':
        return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700';
      case 'reduction':
        return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700';
      case 'deferred':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      case 'granted':
        return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700';
      default:
        return 'bg-gray-100 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="decoder-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-rose-600 via-red-600 to-rose-600 text-white px-6 py-6 rounded-t-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <span className="text-3xl">🔓</span>
              </div>
              <div>
                <h2 id="decoder-title" className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  Decision Decoder
                  <span className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur text-white text-xs font-bold rounded-full">AI</span>
                  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">BETA</span>
                </h2>
                <p className="text-rose-100 text-sm sm:text-base mt-1">
                  The Denial Translator • VA Legalese → Plain English
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LLMRecommendationBadge toolId="decision-decoder" />
              <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
              {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Decision Decoder" />}
              <button
                onClick={onClose}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto flex-1 p-6">
            {/* Info Banner */}
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📬</span>
                <div>
                  <h3 className="font-bold text-amber-800 dark:text-amber-200">Got a Confusing VA Letter?</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    VA decisions are written in complex legal language. Paste the key paragraphs below 
                    and we'll translate what they're <em>actually</em> saying, what's missing from your claim, 
                    and exactly what you need to do next.
                  </p>
                </div>
              </div>
            </div>

            {/* AI Model Quick Load */}
            {!isAnyAIAvailable() && (
              <div className="mb-6">
                <AIModelQuickLoad 
                  toolId="decision-decoder"
                  onLoadComplete={(agent) => console.log('AI loaded for Decision Decoder:', agent.name)}
                  compact={false}
                  showFullDropdown={true}
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <div>
                {/* Input Method Tabs */}
                <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setInputMethod('paste')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      inputMethod === 'paste'
                        ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-600 dark:border-amber-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    📋 Paste Text
                  </button>
                  <button
                    onClick={() => setInputMethod('file')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      inputMethod === 'file'
                        ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    📷 Drop-In File
                  </button>
                </div>

                {/* Paste Text Input */}
                {inputMethod === 'paste' && (
                  <>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      📄 Paste Your VA Decision Letter
                    </label>
                    <textarea
                      value={denialText}
                      onChange={(e) => setDenialText(e.target.value)}
                      placeholder={`Paste the relevant paragraphs from your VA decision letter here...

Example: "The evidence does not establish a nexus between your current lumbar spine condition and your service-connected right knee disability. While the medical evidence shows a current diagnosis of lumbar degenerative disc disease, there is no competent medical evidence linking this condition to your service or to your service-connected disabilities."`}
                      rows={14}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none font-mono text-sm"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {denialText.length} characters
                      </span>
                      <button
                        onClick={() => setDenialText('')}
                        className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      >
                        Clear
                      </button>
                    </div>
                  </>
                )}

                {/* File Drop-In (PDF or Image) - MULTI-FILE SUPPORT */}
                {inputMethod === 'file' && (
                  <div>
                    {/* Drop Zone - always visible for adding more files */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                        isDragging
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.gif,.bmp,.webp,image/*"
                        onChange={handleFileChange}
                        multiple
                        className="hidden"
                      />
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-gray-700 dark:text-gray-200">
                            Drop files here or{' '}
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="text-purple-600 dark:text-purple-400 hover:underline"
                            >
                              browse
                            </button>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            📄 PDFs • 📷 Images • 📸 Screenshots - <strong>Multiple files supported!</strong>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Global Error */}
                    {fileError && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-red-700 dark:text-red-300">{fileError}</p>
                        </div>
                      </div>
                    )}

                    {/* OCR Progress (while processing) */}
                    {ocrProgress && currentProcessingFile && (
                      <div className="mt-3 border border-purple-200 dark:border-purple-700 rounded-xl p-4 bg-purple-50 dark:bg-purple-900/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent"></div>
                          <span className="font-medium text-purple-800 dark:text-purple-200 text-sm">
                            Processing: {currentProcessingFile}
                          </span>
                        </div>
                        <p className="text-xs text-purple-600 dark:text-purple-400 mb-2">
                          {ocrProgress.state === OCR_STATES.LOADING ? 'Loading file...' :
                           ocrProgress.state === OCR_STATES.EXTRACTING_TEXT ? 'Extracting text...' :
                           ocrProgress.state === OCR_STATES.OCR_IN_PROGRESS ? 'Running OCR...' :
                           ocrProgress.message || 'Processing...'}
                        </p>
                        {ocrProgress.progress > 0 && (
                          <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-1.5">
                            <div
                              className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${ocrProgress.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Uploaded Files List */}
                    {uploadedFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            📁 Uploaded Files ({uploadedFiles.length})
                          </span>
                          <button
                            onClick={handleClearAllFiles}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                          >
                            Clear all
                          </button>
                        </div>
                        
                        {uploadedFiles.map((fileEntry) => (
                          <div
                            key={fileEntry.id}
                            className={`border rounded-lg p-3 bg-white dark:bg-gray-800 ${
                              fileEntry.error
                                ? 'border-red-200 dark:border-red-700'
                                : fileEntry.extractedText
                                  ? 'border-green-200 dark:border-green-700'
                                  : 'border-purple-200 dark:border-purple-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  fileEntry.processing
                                    ? 'bg-purple-100 dark:bg-purple-800'
                                    : fileEntry.error
                                      ? 'bg-red-100 dark:bg-red-800'
                                      : 'bg-green-100 dark:bg-green-800'
                                }`}>
                                  {fileEntry.processing ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
                                  ) : fileEntry.fileType === 'pdf' ? (
                                    <span className="text-sm">📄</span>
                                  ) : (
                                    <span className="text-sm">📷</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                    {fileEntry.file.name}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatFileSize(fileEntry.file.size)}
                                    {fileEntry.extractedText && !fileEntry.error && (
                                      <span className="text-green-600 dark:text-green-400 ml-2">
                                        ✓ {fileEntry.extractedText.length} chars
                                      </span>
                                    )}
                                    {fileEntry.error && (
                                      <span className="text-red-600 dark:text-red-400 ml-2">
                                        ✗ {fileEntry.error}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveFile(fileEntry.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
                                title="Remove file"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            
                            {/* Image Preview (collapsed) */}
                            {fileEntry.fileType === 'image' && fileEntry.preview && (
                              <div className="mt-2 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
                                <img
                                  src={fileEntry.preview}
                                  alt="Preview"
                                  className="max-h-24 w-full object-contain bg-gray-50 dark:bg-gray-900"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {/* Combined Text Summary */}
                        {denialText && uploadedFiles.some(f => f.extractedText) && (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                              <span className="text-green-500">✓</span>
                              <span className="text-sm font-medium">
                                Combined text ready - {denialText.length} total characters from {uploadedFiles.filter(f => f.extractedText).length} file(s)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Privacy Note */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                      🔒 All files processed locally in your browser - nothing is sent to any server.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleDecode}
                  disabled={isLoading || !denialText.trim()}
                  className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold text-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span>Decoding...</span>
                    </>
                  ) : (
                    <>
                      <span>🔓</span>
                      <span>Decode This Decision</span>
                    </>
                  )}
                </button>

                {/* Privacy Note */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                  🔒 Your decision letter is processed securely and never stored on our servers.
                </p>
              </div>

              {/* Results Section */}
              <div>
                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-red-700 dark:text-red-300">{error}</span>
                    </div>
                  </div>
                )}

                {results && (
                  <div className="space-y-4">
                    {/* Cloud AI Fallback Notice (when document was too large for Local AI) */}
                    {results._usedFallback && results._fallbackReason === 'context_overflow' && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-blue-500">☁️</span>
                          <div>
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                              Processed with Cloud AI
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              {results._fallbackNote || 'Your document was too large for Local AI (4096 tokens). Cloud AI with 1M token context was used instead.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Document Truncation Notice (when document was trimmed to fit Local AI) */}
                    {results._wasTruncated && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-amber-500">✂️</span>
                          <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                              Large Document Trimmed
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              {results._truncationNote || 'Your document was condensed to fit within AI limits. The beginning and end were analyzed (where key decisions are usually found).'}
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              💡 Tip: For more complete analysis, paste only the "Reasons for Decision" section.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Decision Type Badge */}
                    {results.decision_type && (
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm border ${getDecisionTypeColor(results.decision_type)}`}>
                        {results.decision_type === 'Full Denial' && '❌'}
                        {results.decision_type === 'Partial Denial' && '⚠️'}
                        {results.decision_type === 'Reduction' && '📉'}
                        {results.decision_type === 'Deferred' && '⏳'}
                        {results.decision_type === 'Granted' && '✅'}
                        {results.decision_type}
                      </div>
                    )}

                    {/* Plain English Translation */}
                    {results.plain_english && (
                      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2 mb-2">
                          <span>💬</span> In Plain English
                        </h4>
                        <p className="text-blue-700 dark:text-blue-300">
                          {results.plain_english}
                        </p>
                      </div>
                    )}

                    {/* VA's Reasoning */}
                    {results.va_reasoning && (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-2">
                          <span>🏛️</span> Why the VA Made This Decision
                        </h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {results.va_reasoning}
                        </p>
                      </div>
                    )}

                    {/* Missing Elements */}
                    {results.missing_elements && results.missing_elements.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-700">
                        <h4 className="font-semibold text-red-800 dark:text-red-200 flex items-center gap-2 mb-3">
                          <span>🚨</span> What's Missing From Your Claim
                        </h4>
                        <ul className="space-y-2">
                          {results.missing_elements.map((element, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-red-500 mt-0.5">•</span>
                              <span className="text-sm text-red-700 dark:text-red-300">{element}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Plan */}
                    {results.action_plan && results.action_plan.length > 0 && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
                        <h4 className="font-semibold text-green-800 dark:text-green-200 flex items-center gap-2 mb-3">
                          <span>✅</span> Your Action Plan
                        </h4>
                        <ol className="space-y-3">
                          {results.action_plan.map((step, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                {index + 1}
                              </span>
                              <span className="text-sm text-green-700 dark:text-green-300">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Appeal Options */}
                    {results.appeal_options && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
                        <h4 className="font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2 mb-3">
                          <span>⚖️</span> Appeal Options
                        </h4>
                        <div className="space-y-2 text-sm text-purple-700 dark:text-purple-300">
                          {typeof results.appeal_options === 'string' ? (
                            <p>{results.appeal_options}</p>
                          ) : (
                            results.appeal_options.map((option, index) => (
                              <div key={index} className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                                {option}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Deadline Warning */}
                    {results.deadline_warning && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-xl p-4 border-2 border-yellow-400 dark:border-yellow-600">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">⏰</span>
                          <div>
                            <h4 className="font-bold text-yellow-800 dark:text-yellow-200">
                              Important Deadline
                            </h4>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                              {results.deadline_warning}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Loading State - Shows progress while AI is working */}
                {isLoading && (
                  <div className="h-full flex items-center justify-center py-12 text-center">
                    <div className="max-w-sm">
                      <div className="relative mb-6">
                        <div className="text-6xl animate-pulse">🔓</div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-20 h-20 border-4 border-amber-200 dark:border-amber-800 border-t-amber-500 rounded-full animate-spin"></div>
                        </div>
                      </div>
                      <p className="text-lg font-medium text-amber-700 dark:text-amber-300">
                        AI is analyzing your decision...
                      </p>
                      <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                        Translating VA legalese into plain English
                      </p>
                      <div className="mt-4 space-y-2 text-xs text-gray-500 dark:text-gray-500">
                        <p className="flex items-center justify-center gap-2">
                          <span className="animate-pulse">📝</span> Identifying decision type...
                        </p>
                        <p className="flex items-center justify-center gap-2">
                          <span className="animate-pulse">🔍</span> Finding missing elements...
                        </p>
                        <p className="flex items-center justify-center gap-2">
                          <span className="animate-pulse">📋</span> Building your action plan...
                        </p>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-4">
                        This usually takes 10-30 seconds
                      </p>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!results && !isLoading && !error && (
                  <div className="h-full flex items-center justify-center py-12 text-center text-gray-500 dark:text-gray-400">
                    <div>
                      <div className="text-6xl mb-4">🔓</div>
                      <p className="text-lg font-medium">Ready to Decode</p>
                      <p className="text-sm mt-2">
                        Paste your VA decision letter and click "Decode" to translate
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Common Denial Reasons Reference */}
            <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-xl">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <span>📚</span> Common VA Denial Language
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 font-medium mb-1">"No nexus established"</p>
                  <p className="text-gray-600 dark:text-gray-400">= They need a doctor's letter connecting your condition to service</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 font-medium mb-1">"Not incurred in service"</p>
                  <p className="text-gray-600 dark:text-gray-400">= They didn't find evidence in your service records</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 font-medium mb-1">"No current disability"</p>
                  <p className="text-gray-600 dark:text-gray-400">= Need a current diagnosis from a doctor</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 font-medium mb-1">"Not at least as likely as not"</p>
                  <p className="text-gray-600 dark:text-gray-400">= The examiner said less than 50% chance of connection</p>
                </div>
              </div>
            </div>
            
            {/* Claim Phase Explainer - Powered by Benefits Reference Data */}
            <div className="mt-6 p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/30 rounded-xl border border-teal-200 dark:border-teal-700">
              <button 
                onClick={() => setShowPhaseExplainer(!showPhaseExplainer)}
                className="w-full flex items-center justify-between"
              >
                <h4 className="font-semibold text-teal-800 dark:text-teal-200 flex items-center gap-2">
                  <span>📊</span> Claim Status Phase Explainer
                  <span className="text-xs bg-teal-200 dark:bg-teal-800 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full">
                    VA Reference Data
                  </span>
                </h4>
                <svg 
                  className={`w-5 h-5 text-teal-600 dark:text-teal-400 transition-transform ${showPhaseExplainer ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showPhaseExplainer && (
                <div className="mt-4">
                  <p className="text-sm text-teal-700 dark:text-teal-300 mb-4">
                    Wondering what your claim status means? Click a phase to learn what the VA is doing and what you should expect.
                  </p>
                  
                  {/* Phase Timeline */}
                  <div className="relative mb-6">
                    <div className="absolute top-4 left-0 right-0 h-1 bg-teal-200 dark:bg-teal-800 rounded"></div>
                    <div className="flex justify-between relative">
                      {getAllClaimPhases().map((phase, idx) => (
                        <button
                          key={phase.key}
                          onClick={() => setSelectedPhase(selectedPhase?.key === phase.key ? null : phase)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all ${
                            selectedPhase?.key === phase.key
                              ? 'bg-teal-600 text-white ring-4 ring-teal-300 dark:ring-teal-700 scale-110'
                              : 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 border-2 border-teal-300 dark:border-teal-600 hover:bg-teal-100 dark:hover:bg-teal-900'
                          }`}
                          title={phase.name}
                        >
                          {phase.phase}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Selected Phase Details */}
                  {selectedPhase && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-teal-200 dark:border-teal-700 animate-fadeIn">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h5 className="font-bold text-teal-800 dark:text-teal-200 text-lg">
                            Phase {selectedPhase.phase}: {selectedPhase.name}
                          </h5>
                          <p className="text-teal-600 dark:text-teal-400 text-sm">
                            {selectedPhase.shortDesc}
                          </p>
                        </div>
                        <span className="bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-xs px-2 py-1 rounded-full">
                          ⏱️ {selectedPhase.avgDays}
                        </span>
                      </div>
                      
                      <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
                        {selectedPhase.longDesc}
                      </p>
                      
                      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mb-3">
                        <h6 className="font-semibold text-blue-800 dark:text-blue-200 text-sm mb-1">
                          🎯 What You Should Do
                        </h6>
                        <p className="text-blue-700 dark:text-blue-300 text-sm">
                          {selectedPhase.whatNext}
                        </p>
                      </div>
                      
                      {selectedPhase.tips && selectedPhase.tips.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3">
                          <h6 className="font-semibold text-amber-800 dark:text-amber-200 text-sm mb-2">
                            💡 Pro Tips
                          </h6>
                          <ul className="space-y-1">
                            {selectedPhase.tips.map((tip, i) => (
                              <li key={i} className="text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
                                <span>•</span> {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!selectedPhase && (
                    <p className="text-center text-teal-600 dark:text-teal-400 text-sm py-4">
                      👆 Click a phase number above to see detailed information
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <BuyMeCoffee show={results !== null} trigger="decision-decoder" />
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DecisionDecoder;
