/**
 * Vet-Rate.org - Muster Call Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Mass document ingestion system for veteran claim files.
 * Handles 300+ MB of documents, auto-populates entire profile,
 * and generates comprehensive LLM-powered recommendations.
 * 
 * "Answer the Muster Call" - Drop your entire VA file and let
 * the system analyze everything automatically.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import {
  processMusterCallBatch,
  autoPopulateProfile,
  generateMusterCallReport,
  validateFilesBatch,
  PROCESSING_STATES,
  formatFileSize
} from '../utils/musterCallProcessor';
import { DOCUMENT_TYPES, getDocumentTypeLabel } from '../utils/documentClassifier';
import { isAnyAIAvailable, getAIStatus } from '../utils/unifiedAIService';
import ReportBugLink from './ReportBugLink';
import ReactMarkdown from 'react-markdown';

/**
 * Muster Call - Mass Document Processor
 */
export default function MusterCall({ isOpen, onClose, onProcessComplete }) {
  const { t } = useLanguage();
  useBodyScrollLock(isOpen);

  // State management
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processingState, setProcessingState] = useState(PROCESSING_STATES.IDLE);
  const [progress, setProgress] = useState({ completed: 0, total: 0, processing: 0 });
  const [fileProgress, setFileProgress] = useState({});
  const [results, setResults] = useState(null);
  const [report, setReport] = useState(null);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState(null);
  const [showReport, setShowReport] = useState(false);

  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback((selectedFiles) => {
    const fileArray = Array.from(selectedFiles);
    
    // Validate files
    const validationResult = validateFilesBatch(fileArray);
    setValidation(validationResult);

    if (validationResult.valid.length > 0) {
      setFiles(fileArray);
      setError(null);
    } else {
      setError('No valid files selected. Please select PDF, DOCX, or TXT files.');
    }
  }, []);

  /**
   * Handle drag and drop
   */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
    }

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles);
    }
  }, [handleFileSelect]);

  /**
   * Start processing files
   */
  const handleStartProcessing = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setProcessingState(PROCESSING_STATES.VALIDATING);
    setResults(null);
    setReport(null);
    setError(null);
    setShowReport(false);

    try {
      // Process all files
      const result = await processMusterCallBatch(files, {
        onProgress: (progressData) => {
          if (progressData.state) {
            setProcessingState(progressData.state);
          }
          if (progressData.filename) {
            setFileProgress(prev => ({
              ...prev,
              [progressData.filename]: {
                state: progressData.state,
                progress: progressData.progress || 0,
                error: progressData.error
              }
            }));
          }
          if (progressData.total !== undefined) {
            setProgress({
              total: progressData.total,
              completed: progressData.completed,
              processing: progressData.processing
            });
          }
        },
        onComplete: async (completeData) => {
          setResults(completeData);
          setProcessingState(PROCESSING_STATES.POPULATING);
          
          // Auto-populate profile
          const populateResult = await autoPopulateProfile(completeData.results);
          
          if (populateResult.success) {
            console.log(`✅ Auto-populated ${populateResult.count} profile fields`);
          }

          // Generate LLM report
          if (isAnyAIAvailable()) {
            setProcessingState(PROCESSING_STATES.ANALYZING);
            const reportResult = await generateMusterCallReport(
              completeData.results,
              completeData.classified
            );
            
            if (reportResult.success) {
              setReport(reportResult.report);
            }
          }

          setProcessingState(PROCESSING_STATES.COMPLETE);
          
          // Trigger Intelligence Briefing if callback provided
          if (onProcessComplete && completeData && completeData.results) {
            onProcessComplete(completeData.results);
          }
        }
      });

      if (!result.success) {
        throw new Error(result.validation.errors[0] || 'Processing failed');
      }

    } catch (err) {
      console.error('Muster Call processing error:', err);
      setError(err.message);
      setProcessingState(PROCESSING_STATES.ERROR);
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Reset to initial state
   */
  const handleReset = () => {
    setFiles([]);
    setProcessing(false);
    setProcessingState(PROCESSING_STATES.IDLE);
    setProgress({ completed: 0, total: 0, processing: 0 });
    setFileProgress({});
    setResults(null);
    setReport(null);
    setValidation(null);
    setError(null);
    setShowReport(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                <span className="text-4xl">📋</span>
                Muster Call
              </h2>
              <p className="text-blue-100 text-sm max-w-2xl">
                Drop your entire VA file - claim letters, C-Files, DD214s. We'll analyze everything and build your complete profile automatically.
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={processing}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* File Drop Zone */}
          {processingState === PROCESSING_STATES.IDLE && (
            <>
              <div
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="border-3 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center transition-all duration-200 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
              >
                <div className="text-6xl mb-4">📁</div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  Drop Your Files Here
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  or click to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.txt,.rtf"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  id="muster-call-files"
                />
                <label
                  htmlFor="muster-call-files"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  Select Files
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  Supports: PDF, DOCX, TXT • Up to 500MB total
                </p>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="mt-6 bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Selected Files ({files.length})
                    </h3>
                    <button
                      onClick={handleReset}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Validation Messages */}
                  {validation && (
                    <>
                      {validation.warnings.length > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-4">
                          <div className="flex">
                            <div className="text-xl mr-3">⚠️</div>
                            <div className="text-sm text-yellow-800 dark:text-yellow-200">
                              <p className="font-semibold mb-2">Warnings:</p>
                              {validation.warnings.map((warning, idx) => (
                                <p key={idx}>• {warning.message}</p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {validation.invalid.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 mb-4">
                          <div className="flex">
                            <div className="text-xl mr-3">❌</div>
                            <div className="text-sm text-red-800 dark:text-red-200">
                              <p className="font-semibold mb-2">Invalid Files:</p>
                              {validation.invalid.map((invalid, idx) => (
                                <p key={idx}>• {invalid.file.name}: {invalid.reason}</p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* File List */}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-2xl">📄</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Size */}
                  {validation && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Total: {formatFileSize(validation.totalSize)} • {validation.valid.length} valid files
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Processing View */}
          {processing && processingState !== PROCESSING_STATES.IDLE && (
            <div className="space-y-6">
              {/* Overall Progress */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {getStateLabel(processingState)}
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {progress.completed} / {progress.total} files
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Individual File Progress */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  File Progress:
                </h4>
                {Object.entries(fileProgress).map(([filename, fileData]) => (
                  <div
                    key={filename}
                    className="bg-white dark:bg-gray-800 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                        {filename}
                      </p>
                      <span className="text-xs text-gray-500 ml-2">
                        {fileData.progress?.toFixed(0) || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          fileData.error ? 'bg-red-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${fileData.progress || 0}%` }}
                      />
                    </div>
                    {fileData.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {fileData.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Processing Animation */}
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
              </div>
            </div>
          )}

          {/* Results View */}
          {processingState === PROCESSING_STATES.COMPLETE && results && (
            <div className="space-y-6">
              {/* Success Banner */}
              <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 p-6 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">✅</span>
                  <div>
                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                      Muster Call Complete!
                    </h3>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Processed {results.summary.successful} files in {(results.summary.processingTime / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>
              </div>

              {/* Document Breakdown */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Discovered Documents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(results.classified.grouped).map(([type, docs]) => (
                    <div
                      key={type}
                      className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500"
                    >
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {getDocumentTypeLabel(type)}
                      </h4>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {docs.length}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {docs.length === 1 ? 'document' : 'documents'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* LLM Report */}
              {report && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-blue-500">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="text-2xl">🤖</span>
                      AI Analysis & Recommendations
                    </h3>
                    <button
                      onClick={() => setShowReport(!showReport)}
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {showReport ? 'Hide' : 'Show'} Report
                    </button>
                  </div>
                  {showReport && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{report}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error View */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-6 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-3xl">❌</span>
                <div>
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
                    Processing Error
                  </h3>
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {processingState === PROCESSING_STATES.IDLE && files.length > 0 && (
                <button
                  onClick={handleStartProcessing}
                  disabled={!validation || validation.valid.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Muster Call
                </button>
              )}
              {processingState === PROCESSING_STATES.COMPLETE && (
                <button
                  onClick={handleReset}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  Process More Files
                </button>
              )}
            </div>
            <ReportBugLink feature="muster-call" />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Get human-readable label for processing state
 */
function getStateLabel(state) {
  const labels = {
    [PROCESSING_STATES.IDLE]: 'Ready',
    [PROCESSING_STATES.VALIDATING]: 'Validating Files...',
    [PROCESSING_STATES.LOADING]: 'Loading Documents...',
    [PROCESSING_STATES.EXTRACTING]: 'Extracting Text...',
    [PROCESSING_STATES.CLASSIFYING]: 'Classifying Documents...',
    [PROCESSING_STATES.ANALYZING]: 'Analyzing with AI...',
    [PROCESSING_STATES.POPULATING]: 'Auto-Filling Profile...',
    [PROCESSING_STATES.COMPLETE]: 'Complete',
    [PROCESSING_STATES.ERROR]: 'Error'
  };
  return labels[state] || 'Processing...';
}
