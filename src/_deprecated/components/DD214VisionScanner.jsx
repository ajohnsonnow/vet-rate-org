/**
 * Vet-Rate.org - DD214 Vision Scanner Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * PURPOSE: Drag-and-drop DD214 scanner using Florence-2 Vision LLM
 * 
 * FEATURES:
 * - WebGPU-accelerated Florence-2 for document reading
 * - High-resolution PDF rendering (216 DPI)
 * - Privacy-first design (SSN masking, client-side only)
 * - Real-time progress tracking with status messages
 * - Graceful fallback for unsupported browsers
 * 
 * PRIVACY: 100% client-side. NO DATA LEAVES THE BROWSER.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Upload,
  Eye,
  EyeOff,
  RefreshCw,
  Cpu,
  Zap,
  AlertTriangle,
  Info,
  Download
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { 
  convertPdfPageToBlob, 
  getPdfMetadata, 
  isPdfFile, 
  isImageFile, 
  imageFileToBlob,
  getOptimalScale,
  PDF_CONFIG 
} from '../utils/florencePdfUtils';
import { parseDD214Text } from '../utils/dd214VisionParser';

/**
 * Status states for the scanner
 */
const STATUS = {
  IDLE: 'idle',
  CHECKING: 'checking',      // Checking WebGPU support
  BOOTING: 'booting',        // Loading AI model
  READY: 'ready',            // Model loaded, ready to scan
  RASTERIZING: 'rasterizing', // Converting PDF to image
  SCANNING: 'scanning',      // AI reading document
  PARSING: 'parsing',        // Parsing extracted text
  COMPLETE: 'complete',      // Scan complete
  ERROR: 'error',            // Error occurred
  UNSUPPORTED: 'unsupported', // WebGPU not supported
};

/**
 * Main DD214 Vision Scanner Component
 */
export default function DD214VisionScanner({ 
  onDataExtracted = null,   // Callback with extracted data
  onRawText = null,         // Callback with raw OCR text
  className = '',
  compact = false,          // Compact mode for embedding
}) {
  // === STATE ===
  const [status, setStatus] = useState(STATUS.CHECKING);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Checking browser compatibility...');
  const [extractedData, setExtractedData] = useState(null);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [pageInfo, setPageInfo] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  
  // Worker reference
  const workerRef = useRef(null);
  const isInitialized = useRef(false);

  // === WEBGPU CHECK ===
  useEffect(() => {
    // Only initialize once
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Check WebGPU support first
    if (!navigator.gpu) {
      setStatus(STATUS.UNSUPPORTED);
      setStatusMsg('WebGPU is not supported on this device.');
      setErrorDetails({
        type: 'webgpu',
        message: 'WebGPU is required for Vision AI. Please use Chrome 113+, Edge 113+, or Arc browser on a desktop computer.',
        canRetry: false,
      });
      return;
    }

    // Initialize worker
    initializeWorker();

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // === WORKER INITIALIZATION ===
  const initializeWorker = useCallback(() => {
    try {
      // Create worker from bundled source
      workerRef.current = new Worker(
        new URL('../workers/florence-ocr-worker.js', import.meta.url),
        { type: 'module' }
      );

      // Message handler
      workerRef.current.onmessage = handleWorkerMessage;

      // Error handler
      workerRef.current.onerror = (error) => {
        console.error('[VisionScanner] Worker error:', error);
        setStatus(STATUS.ERROR);
        setStatusMsg('Vision engine failed to initialize');
        setErrorDetails({
          type: 'worker',
          message: error.message || 'Unknown worker error',
          canRetry: true,
        });
      };

      // Trigger model preload
      setStatus(STATUS.BOOTING);
      setStatusMsg('Loading Florence-2 Vision Engine...');
      workerRef.current.postMessage({ type: 'LOAD' });

    } catch (err) {
      console.error('[VisionScanner] Failed to create worker:', err);
      setStatus(STATUS.ERROR);
      setStatusMsg('Failed to initialize vision engine');
      setErrorDetails({
        type: 'init',
        message: err.message,
        canRetry: true,
      });
    }
  }, []);

  // === WORKER MESSAGE HANDLER ===
  const handleWorkerMessage = useCallback((e) => {
    const { status: workerStatus, progress: workerProgress, message, text, error, errorType } = e.data;

    switch (workerStatus) {
      case 'loading':
        setStatus(STATUS.BOOTING);
        setProgress(workerProgress || 0);
        setStatusMsg(message || 'Loading AI model...');
        break;

      case 'ready':
        setStatus(STATUS.READY);
        setProgress(100);
        setStatusMsg('Vision AI ready. Drop a DD214 to scan.');
        break;

      case 'processing':
        setStatus(STATUS.SCANNING);
        setStatusMsg(message || 'AI reading document...');
        break;

      case 'complete':
        // Parse the extracted text
        setStatus(STATUS.PARSING);
        setStatusMsg('Parsing military records data...');
        
        const rawOcrText = typeof text === 'string' ? text : JSON.stringify(text);
        setRawText(rawOcrText);
        
        // Call raw text callback
        if (onRawText) {
          onRawText(rawOcrText);
        }

        // Parse into structured data
        const parsed = parseDD214Text(rawOcrText);
        setExtractedData(parsed.fields);
        
        // Call data callback
        if (onDataExtracted) {
          onDataExtracted(parsed);
        }

        setStatus(STATUS.COMPLETE);
        setStatusMsg('Scan complete!');
        break;

      case 'error':
        console.error('[VisionScanner] Worker error:', error);
        setStatus(STATUS.ERROR);
        setStatusMsg(error || 'Analysis failed');
        setErrorDetails({
          type: errorType || 'analysis',
          message: error,
          canRetry: true,
        });
        break;

      default:
        console.log('[VisionScanner] Unknown message:', e.data);
    }
  }, [onDataExtracted, onRawText]);

  // === FILE DROP HANDLER ===
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    if (!isPdfFile(file) && !isImageFile(file)) {
      setStatus(STATUS.ERROR);
      setStatusMsg('Unsupported file type. Please upload a PDF or image.');
      return;
    }

    // Reset state
    setFileName(file.name);
    setExtractedData(null);
    setRawText('');
    setErrorDetails(null);

    try {
      let imageBlob;

      if (isPdfFile(file)) {
        // === PDF PROCESSING ===
        setStatus(STATUS.RASTERIZING);
        setStatusMsg('Rasterizing PDF at 216 DPI...');

        // Get metadata
        const metadata = await getPdfMetadata(file);
        setPageInfo({
          totalPages: metadata.numPages,
          currentPage: 1,
        });

        // Determine optimal scale
        const optimalScale = getOptimalScale(metadata);
        setStatusMsg(`Rendering page 1/${metadata.numPages} at ${Math.round(optimalScale * 72)} DPI...`);

        // Convert first page to high-res image
        imageBlob = await convertPdfPageToBlob(file, 1, optimalScale);

      } else {
        // === IMAGE PROCESSING ===
        setStatus(STATUS.RASTERIZING);
        setStatusMsg('Preparing image for analysis...');
        imageBlob = await imageFileToBlob(file);
      }

      // Send to vision AI
      setStatus(STATUS.SCANNING);
      setStatusMsg('Florence-2 AI reading document...');
      
      workerRef.current.postMessage({
        type: 'ANALYZE',
        payload: { imageBlob },
      });

    } catch (err) {
      console.error('[VisionScanner] Processing error:', err);
      setStatus(STATUS.ERROR);
      setStatusMsg(`Processing failed: ${err.message}`);
      setErrorDetails({
        type: 'processing',
        message: err.message,
        canRetry: true,
      });
    }
  }, []);

  // === DROPZONE SETUP ===
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    multiple: false,
    disabled: status === STATUS.SCANNING || status === STATUS.UNSUPPORTED,
  });

  // === RETRY HANDLER ===
  const handleRetry = useCallback(() => {
    setErrorDetails(null);
    setStatus(STATUS.CHECKING);
    isInitialized.current = false;
    
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    
    // Re-check and initialize
    if (!navigator.gpu) {
      setStatus(STATUS.UNSUPPORTED);
      setStatusMsg('WebGPU is not supported on this device.');
    } else {
      initializeWorker();
    }
  }, [initializeWorker]);

  // === RENDER ===
  return (
    <div className={`max-w-2xl mx-auto ${className}`}>
      {/* Header with Privacy Badge */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-600" />
          DD214 Vision Scanner
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Florence-2)</span>
        </h2>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium border border-green-100 dark:border-green-800">
          <ShieldCheck size={14} />
          <span>100% Client-Side</span>
        </div>
      </div>

      {/* WebGPU Status Indicator */}
      {status === STATUS.BOOTING && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <Zap className="w-4 h-4 animate-pulse" />
            <span>WebGPU Accelerated • {progress}% loaded</span>
          </div>
          <div className="mt-2 w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">{statusMsg}</p>
        </div>
      )}

      {/* Unsupported Browser Warning */}
      {status === STATUS.UNSUPPORTED && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">Browser Not Supported</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Vision AI requires WebGPU, which is not available in your current browser.
              </p>
              <ul className="mt-2 text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                <li>Use Chrome 113+ or Edge 113+</li>
                <li>Use a desktop computer (not mobile)</li>
                <li>Enable hardware acceleration in browser settings</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }
          ${status === STATUS.SCANNING || status === STATUS.RASTERIZING 
            ? 'pointer-events-none opacity-60' 
            : 'cursor-pointer'
          }
          ${status === STATUS.UNSUPPORTED ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        {/* Idle / Ready State */}
        {(status === STATUS.IDLE || status === STATUS.READY || status === STATUS.CHECKING) && (
          <div className="space-y-3">
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mx-auto">
              <Upload size={28} />
            </div>
            <div>
              <p className="text-gray-700 dark:text-gray-200 font-medium">
                {isDragActive ? 'Drop your DD214 here' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Supports PDF, PNG, JPG • High-res scans recommended
              </p>
            </div>
            {status === STATUS.READY && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                <CheckCircle size={12} />
                Vision AI Ready
              </div>
            )}
          </div>
        )}

        {/* Processing States */}
        {(status === STATUS.RASTERIZING || status === STATUS.SCANNING || status === STATUS.PARSING) && (
          <div className="space-y-4 py-4">
            <Loader2 className="animate-spin w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto" />
            <div>
              <p className="text-blue-600 dark:text-blue-400 font-medium animate-pulse">{statusMsg}</p>
              {fileName && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{fileName}</p>
              )}
              {pageInfo && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Page {pageInfo.currentPage} of {pageInfo.totalPages}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Complete State */}
        {status === STATUS.COMPLETE && (
          <div className="space-y-2">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center mx-auto">
              <CheckCircle size={28} />
            </div>
            <p className="text-green-700 dark:text-green-300 font-medium">Scan Complete!</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Drop a new file to scan again</p>
          </div>
        )}

        {/* Error State */}
        {status === STATUS.ERROR && (
          <div className="space-y-3">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center mx-auto">
              <AlertCircle size={28} />
            </div>
            <p className="text-red-600 dark:text-red-400 font-medium">{statusMsg}</p>
            {errorDetails?.canRetry && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRetry();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results Display */}
      {extractedData && (
        <div className="mt-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Results Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2">
              <FileText size={16} />
              Extracted Data
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{fileName}</span>
              {extractedData.overallConfidence && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  extractedData.overallConfidence >= 75 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : extractedData.overallConfidence >= 50
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {extractedData.overallConfidence}% confidence
                </span>
              )}
            </div>
          </div>

          {/* Results Grid */}
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <ResultField label="Veteran Name" value={extractedData.name} />
            <ResultField label="Branch" value={extractedData.branch} />
            <ResultField label="Component" value={extractedData.component} />
            <ResultField label="Rank / Pay Grade" value={`${extractedData.rank || '—'} (${extractedData.payGrade || '—'})`} />
            <ResultField label="MOS/Rating" value={extractedData.mos} highlight />
            <ResultField label="MOS Title" value={extractedData.mosTitle} />

            {/* SSN - Privacy Protected */}
            <div className="col-span-1 md:col-span-2">
              <ResultField label="SSN" value={extractedData.ssn} sensitive />
            </div>

            <ResultField label="Entry Date" value={extractedData.entryDateFormatted} />
            <ResultField label="Separation Date" value={extractedData.separationDateFormatted} />
            
            {extractedData.yearsService !== null && (
              <ResultField 
                label="Time in Service" 
                value={`${extractedData.yearsService} years, ${extractedData.monthsService} months`} 
              />
            )}
            
            <ResultField label="Character of Service" value={extractedData.characterOfService} highlight />
            <ResultField label="Separation Code" value={extractedData.separationCode} />
            <ResultField label="Reentry Code" value={extractedData.reentryCode} />

            {/* Combat Service Indicators */}
            {extractedData.combatService?.hasVerifiedCombat && (
              <div className="col-span-1 md:col-span-2">
                <ResultField 
                  label="Combat Service" 
                  value={extractedData.combatService.indicators.join(', ')} 
                  highlight 
                />
              </div>
            )}

            {/* Awards Summary */}
            {extractedData.awards && extractedData.awards.length > 0 && (
              <div className="col-span-1 md:col-span-2">
                <ResultField 
                  label={`Awards & Decorations (${extractedData.awardCount})`}
                  value={extractedData.awards.map(a => a.abbreviation || a.name).join(', ')} 
                />
              </div>
            )}
          </div>

          {/* Verification Notice */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-800 dark:text-yellow-200 border-t border-yellow-100 dark:border-yellow-800 flex items-start gap-2">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>Important:</strong> Always verify AI extraction against the original document. 
              Vision AI may misread degraded or handwritten text.
            </span>
          </div>
        </div>
      )}

      {/* Raw Text Toggle (Debug) */}
      {rawText && process.env.NODE_ENV === 'development' && (
        <details className="mt-4">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Show Raw OCR Text
          </summary>
          <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs overflow-auto max-h-64">
            {rawText}
          </pre>
        </details>
      )}
    </div>
  );
}

// === RESULT FIELD COMPONENT ===
function ResultField({ label, value, sensitive = false, highlight = false }) {
  const [revealed, setRevealed] = useState(!sensitive);

  const hasValue = value !== null && value !== undefined && value !== '';

  return (
    <div className={`p-3 rounded-lg border ${
      highlight 
        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
        : 'bg-white dark:bg-gray-900/50 border-gray-100 dark:border-gray-700'
    }`}>
      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 font-medium">
        {label}
      </div>
      <div className="font-mono text-gray-800 dark:text-gray-100 font-medium flex justify-between items-center">
        <span className={`${!hasValue ? 'text-gray-400 dark:text-gray-500 italic font-normal' : ''}`}>
          {hasValue 
            ? (revealed ? value : '•••-••-••••') 
            : 'Not Found'
          }
        </span>
        {sensitive && hasValue && (
          <button
            onClick={() => setRevealed(!revealed)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 ml-2"
            title={revealed ? 'Hide SSN' : 'Show SSN'}
          >
            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
            {revealed ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </div>
  );
}

// Export for named import
export { DD214VisionScanner };
