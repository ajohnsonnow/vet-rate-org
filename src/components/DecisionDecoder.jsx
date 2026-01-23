import React, { useState, useEffect, useRef } from 'react';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { decodeDecision, isAIAvailable } from '../utils/aiStatementHelper';
import { getAIStatus, AI_MODES, isAnyAIAvailable } from '../utils/unifiedAIService';
import { AIStatusBadge, AIModeSelector } from './AIModeSelector';
import { LLMRecommendationBadge } from './LLMRecommendation';
import { useVaBenefitsRef, CLAIM_PHASES } from '../hooks/useVaBenefitsRef';
import { analyzePDF, OCR_STATES, formatFileSize } from '../utils/ocr';

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

const DecisionDecoder = ({ onClose, onReportBug }) => {
  useBodyScrollLock(true);
  
  const [denialText, setDenialText] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  const [showPhaseExplainer, setShowPhaseExplainer] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [inputMethod, setInputMethod] = useState('paste'); // 'paste' or 'pdf'
  
  // PDF Drop-In state
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfOcrProgress, setPdfOcrProgress] = useState(null);
  const [pdfIsDragging, setPdfIsDragging] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const pdfFileInputRef = useRef(null);
  
  // Benefits Reference hook for claim phase explanations
  const { getClaimPhaseInfo, getAllClaimPhases } = useVaBenefitsRef();
  
  // Monitor AI status changes
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // PDF Drop-In handlers
  const handlePdfDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfIsDragging(true);
  };

  const handlePdfDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfIsDragging(false);
  };

  const handlePdfDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfIsDragging(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        await processPdfFile(file);
      } else {
        setPdfError('Please drop a PDF file (VA decision letter, denial letter, etc.)');
      }
    }
  };

  const handlePdfFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await processPdfFile(file);
    }
  };

  const processPdfFile = async (file) => {
    setPdfFile(file);
    setPdfError(null);
    setDenialText('');
    
    try {
      const result = await analyzePDF(file, (progress) => {
        setPdfOcrProgress(progress);
      });
      
      if (result.success && result.text) {
        setDenialText(result.text);
      } else {
        setPdfError(result.error || 'Failed to extract text from PDF');
      }
    } catch (err) {
      console.error('PDF processing error:', err);
      setPdfError('Failed to process PDF. Please try again or paste the text manually.');
    }
    
    setPdfOcrProgress(null);
  };

  const handleRemovePdf = () => {
    setPdfFile(null);
    setPdfOcrProgress(null);
    setDenialText('');
    setPdfError(null);
    if (pdfFileInputRef.current) {
      pdfFileInputRef.current.value = '';
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

    try {
      const response = await decodeDecision(denialText);
      
      if (response.success) {
        setResults(response.data);
      } else {
        setError(response.error || 'Failed to decode decision. Please try again.');
      }
    } catch (err) {
      console.error('Decode error:', err);
      setError('An error occurred during decoding. Please try again.');
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

            {/* AI Required Warning */}
            {!isAnyAIAvailable() && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div>
                    <h3 className="font-bold text-amber-800 dark:text-amber-200">AI Required for Analysis</h3>
                    <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                      Click the <strong>AI Status button</strong> in the header above to load your secure Local AI 
                      (100% private) or enter your Gemini API key.
                    </p>
                  </div>
                </div>
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
                    onClick={() => setInputMethod('pdf')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      inputMethod === 'pdf'
                        ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    📄 Drop-In PDF
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

                {/* PDF Drop-In */}
                {inputMethod === 'pdf' && (
                  <div>
                    {/* Drop Zone - only show if no file */}
                    {!pdfFile && !pdfOcrProgress && (
                      <div
                        onDragOver={handlePdfDragOver}
                        onDragLeave={handlePdfDragLeave}
                        onDrop={handlePdfDrop}
                        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                          pdfIsDragging
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10'
                        }`}
                      >
                        <input
                          ref={pdfFileInputRef}
                          type="file"
                          accept=".pdf"
                          onChange={handlePdfFileChange}
                          className="hidden"
                        />
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                              Drop your PDF here
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              or{' '}
                              <button
                                onClick={() => pdfFileInputRef.current?.click()}
                                className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                              >
                                browse to select
                              </button>
                            </p>
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                            Supports: VA Decision Letter, Denial Letter, Rating Decision (PDF)
                          </div>
                        </div>
                      </div>
                    )}

                    {/* OCR Progress */}
                    {pdfOcrProgress && (
                      <div className="border border-purple-200 dark:border-purple-700 rounded-xl p-6 bg-purple-50 dark:bg-purple-900/20">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent"></div>
                          <span className="font-medium text-purple-800 dark:text-purple-200">
                            {pdfOcrProgress.state === OCR_STATES.LOADING ? 'Loading PDF...' :
                             pdfOcrProgress.state === OCR_STATES.EXTRACTING ? 'Extracting text...' :
                             pdfOcrProgress.state === OCR_STATES.OCR_PROCESSING ? 'Running OCR on scanned pages...' :
                             'Processing...'}
                          </span>
                        </div>
                        {pdfOcrProgress.progress > 0 && (
                          <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${pdfOcrProgress.progress}%` }}
                            />
                          </div>
                        )}
                        {pdfOcrProgress.message && (
                          <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">{pdfOcrProgress.message}</p>
                        )}
                      </div>
                    )}

                    {/* File Selected */}
                    {pdfFile && !pdfOcrProgress && (
                      <div className="border border-purple-200 dark:border-purple-700 rounded-xl p-4 bg-white dark:bg-gray-800">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-800 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white truncate max-w-xs">{pdfFile.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(pdfFile.size)}</p>
                            </div>
                          </div>
                          <button
                            onClick={handleRemovePdf}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove file"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        {/* Error Display */}
                        {pdfError && (
                          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                            <div className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm text-red-700 dark:text-red-300">{pdfError}</p>
                            </div>
                          </div>
                        )}

                        {/* Success - text extracted */}
                        {denialText && !pdfError && (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                              <span className="text-green-500">✓</span>
                              <span className="text-sm font-medium">Text extracted - {denialText.length} characters</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Privacy Note */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                      🔒 Your PDF is processed locally in your browser - nothing is sent to any server.
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
