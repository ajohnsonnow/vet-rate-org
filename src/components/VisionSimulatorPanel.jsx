/**
 * VisionSimulatorPanel.jsx
 *
 * A UI component that provides vision-like document analysis using
 * the OCR + Canvas API approach (no u8 shaders required!)
 *
 * This is the PRACTICAL solution while we wait for MLC-AI to fix
 * the WebGPU u8 shader compatibility issue.
 */

import React, { useState, useCallback, useRef } from "react";
import { VisionSimulator } from "../utils/visionSimulator";
import { useLanguage } from "../contexts/LanguageContext";

const VisionSimulatorPanel = ({ onAnalysisComplete, textLLMCallback }) => {
  const { t } = useLanguage();
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const simulatorRef = useRef(new VisionSimulator());

  // Handle file selection
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, etc.)");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setError(null);
    setSelectedImage(file);
    setAnalysisResult(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith("image/")) {
        const event = { target: { files: [file] } };
        handleFileSelect(event);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Perform analysis
  const handleAnalyze = useCallback(async () => {
    if (!selectedImage) {
      setError("Please select an image first");
      return;
    }

    if (!userQuery.trim()) {
      setError("Please enter a question about the document");
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      const result = await simulatorRef.current.analyzeImage(
        selectedImage,
        userQuery,
        (progress) => setAnalysisProgress(progress),
      );

      if (result.success) {
        setAnalysisResult(result);

        // If a text LLM callback is provided, send the prompt for completion
        if (textLLMCallback && result.llmPrompt) {
          onAnalysisComplete?.(result);
        }
      } else {
        setError(result.error || "Analysis failed");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedImage, userQuery, textLLMCallback, onAnalysisComplete]);

  // Quick DD214 check
  const handleQuickCheck = useCallback(async () => {
    if (!selectedImage) {
      setError("Please select an image first");
      return;
    }

    setError(null);
    setIsAnalyzing(true);

    try {
      const result = await simulatorRef.current.quickDD214Check(selectedImage);
      setAnalysisResult({
        quickCheck: result,
        isQuickCheck: true,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedImage]);

  // Get capabilities info
  const capabilities = VisionSimulator.getCapabilities();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
          <svg
            className="w-6 h-6 text-purple-600 dark:text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Document Vision Simulator
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            OCR + AI analysis (works in all browsers!)
          </p>
        </div>
        <span className="ml-auto px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded">
          No Special Flags Required
        </span>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg
            className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <strong>How it works:</strong> This uses OCR (Tesseract.js) to
            extract text from your document, then combines it with AI analysis.
            While not as powerful as a true vision model, it works great for
            text-heavy documents like DD214s, medical records, and VA forms.
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          imagePreview
            ? "border-green-500 bg-green-50 dark:bg-green-900/20"
            : "border-gray-300 dark:border-gray-600 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {imagePreview ? (
          <div className="space-y-2">
            <img
              src={imagePreview}
              alt="Selected document"
              className="max-h-48 mx-auto rounded-lg shadow-md"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedImage?.name} ({(selectedImage?.size / 1024).toFixed(1)}{" "}
              KB)
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(null);
                setImagePreview(null);
                setAnalysisResult(null);
              }}
              className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
            >
              Remove image
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <svg
              className="w-12 h-12 mx-auto text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-gray-600 dark:text-gray-400">
              Drop your document image here, or click to browse
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Supports PNG, JPG, WEBP up to 10MB
            </p>
          </div>
        )}
      </div>

      {/* Query Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          What would you like to know about this document?
        </label>
        <textarea
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="e.g., 'What is the character of service?' or 'Extract all service dates'"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          rows={2}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !selectedImage || !userQuery.trim()}
          className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Analyzing... {analysisProgress}%
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Analyze Document
            </>
          )}
        </button>

        <button
          onClick={handleQuickCheck}
          disabled={isAnalyzing || !selectedImage}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          title="Quick check if this is a DD214"
        >
          🎖️ DD214?
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Progress Bar */}
      {isAnalyzing && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${analysisProgress}%` }}
          />
        </div>
      )}

      {/* Results Display */}
      {analysisResult && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Analysis Results
          </h4>

          {analysisResult.isQuickCheck ? (
            // Quick DD214 check results
            <div
              className={`p-3 rounded-lg ${
                analysisResult.quickCheck.isLikely
                  ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800"
                  : "bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800"
              }`}
            >
              <p className="font-medium">
                {analysisResult.quickCheck.isLikely
                  ? "✅ This appears to be a DD214!"
                  : "⚠️ May not be a DD214"}
              </p>
              <p className="text-sm mt-1">
                Confidence: {analysisResult.quickCheck.confidence?.toFixed(0)}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {analysisResult.quickCheck.reason}
              </p>
            </div>
          ) : (
            // Full analysis results
            <>
              {/* Document Structure */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Document Type
                </p>
                <p className="text-gray-900 dark:text-white">
                  {analysisResult.structureInfo?.estimatedType}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {analysisResult.structureInfo?.width} ×{" "}
                  {analysisResult.structureInfo?.height} px | Text Density:{" "}
                  {analysisResult.structureInfo?.textDensityScore}
                </p>
              </div>

              {/* OCR Stats */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Text Extraction
                </p>
                <p className="text-gray-900 dark:text-white">
                  {analysisResult.ocrResult?.words} words,{" "}
                  {analysisResult.ocrResult?.lines} lines
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  OCR Confidence:{" "}
                  {analysisResult.ocrResult?.confidence?.toFixed(0)}%
                </p>
              </div>

              {/* DD214 Detection */}
              {analysisResult.dd214Elements?.isLikelyDD214 && (
                <div className="bg-green-50 dark:bg-green-900/30 rounded p-3 border border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    🎖️ DD214 Detected!
                  </p>
                  {analysisResult.dd214Elements.characterOfService && (
                    <p className="text-sm">
                      Character:{" "}
                      <strong>
                        {analysisResult.dd214Elements.characterOfService}
                      </strong>
                    </p>
                  )}
                  {analysisResult.dd214Elements.serviceInfo?.branch && (
                    <p className="text-sm">
                      Branch:{" "}
                      <strong>
                        {analysisResult.dd214Elements.serviceInfo.branch}
                      </strong>
                    </p>
                  )}
                </div>
              )}

              {/* Extracted Text Preview */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Extracted Text Preview
                </p>
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
                  {analysisResult.ocrResult?.text?.substring(0, 500)}
                  {analysisResult.ocrResult?.text?.length > 500 && "..."}
                </pre>
              </div>

              {/* LLM Prompt (for debugging/transparency) */}
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  View generated AI prompt
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {analysisResult.llmPrompt}
                </pre>
              </details>
            </>
          )}
        </div>
      )}

      {/* Capabilities Footer */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          What can this tool do?
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">
              ✅ Capabilities
            </p>
            <ul className="text-gray-600 dark:text-gray-400 space-y-1 mt-1">
              {capabilities.capabilities.map((cap, i) => (
                <li key={i}>{cap.replace("✅ ", "")}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">
              ⚠️ Limitations
            </p>
            <ul className="text-gray-600 dark:text-gray-400 space-y-1 mt-1">
              {capabilities.limitations.map((lim, i) => (
                <li key={i}>{lim.replace("⚠️ ", "")}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
};

export default VisionSimulatorPanel;
