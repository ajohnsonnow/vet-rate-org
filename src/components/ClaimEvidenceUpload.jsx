/**
 * Claim Evidence Upload Component
 *
 * Allows veterans to upload completed DBQs, Nexus Letters, and other
 * supporting evidence directly to their active VA claims.
 *
 * Features:
 * - Drag & drop file upload
 * - PDF validation
 * - Document type selection (DBQ, Nexus Letter, Buddy Statement, etc.)
 * - Direct upload via VA Claims API
 * - Progress tracking
 *
 * @see https://developer.va.gov/explore/benefits/docs/claims
 */

import React, { useState, useCallback, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Info,
  Trash2,
  X,
  File,
  FileCheck,
  Shield,
  Sparkles,
} from "lucide-react";
import { uploadClaimDocument } from "../api/va";

// Document types that can be uploaded
const DOCUMENT_TYPES = [
  {
    id: "L049",
    label: "DBQ (Disability Benefits Questionnaire)",
    description: "Official VA medical form filled out by your private doctor",
    icon: "📋",
    recommended: true,
  },
  {
    id: "L229",
    label: "Nexus Letter / IMO",
    description: "Independent medical opinion linking condition to service",
    icon: "📝",
    recommended: true,
  },
  {
    id: "L034",
    label: "Buddy Statement / Lay Statement",
    description: "Witness statements from fellow service members or family",
    icon: "👥",
  },
  {
    id: "L015",
    label: "Medical Records",
    description: "Private or military treatment records",
    icon: "🏥",
  },
  {
    id: "L107",
    label: "Service Records",
    description: "DD-214, personnel records, deployment orders",
    icon: "🎖️",
  },
  {
    id: "L023",
    label: "Other Evidence",
    description: "Any other supporting documentation",
    icon: "📎",
  },
];

// Max file size (25MB - VA limit)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Accepted file types
const ACCEPTED_TYPES = [".pdf", "application/pdf"];

const ClaimEvidenceUpload = ({
  claimId,
  accessToken,
  onUploadSuccess,
  onClose,
  claimDetails = null,
}) => {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState("L049"); // Default to DBQ
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success' | 'error' | null
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Validate file before upload
  const validateFile = (file) => {
    // Check file type
    if (
      !file.type.includes("pdf") &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return { valid: false, error: "Only PDF files are accepted" };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File too large. Maximum size is 25MB (your file: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
      };
    }

    return { valid: true };
  };

  // Handle file selection
  const handleFileSelect = useCallback((file) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      setUploadStatus("error");
      return;
    }

    setSelectedFile(file);
    setUploadStatus(null);
    setErrorMessage("");
  }, []);

  // Handle file input change
  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag events
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  // Upload file to VA
  const handleUpload = async () => {
    if (!selectedFile || !claimId || !accessToken) {
      setErrorMessage("Missing required data for upload");
      setUploadStatus("error");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage("");

    try {
      // Simulate progress (actual progress would come from fetch events)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await uploadClaimDocument(
        accessToken,
        claimId,
        selectedFile,
        documentType,
      );

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus("success");

      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err) {
      console.error("[Evidence Upload] Error:", err);
      setErrorMessage(err.message || "Upload failed. Please try again.");
      setUploadStatus("error");
    } finally {
      setIsUploading(false);
    }
  };

  // Clear selected file
  const clearFile = () => {
    setSelectedFile(null);
    setUploadStatus(null);
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Get selected document type info
  const selectedDocType = DOCUMENT_TYPES.find((d) => d.id === documentType);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Upload Evidence</h2>
              <p className="text-blue-100 text-sm">
                Add supporting documents to your claim
              </p>
            </div>
          </div>

          {claimDetails && (
            <div className="mt-3 bg-white/10 rounded-lg p-3">
              <p className="text-sm text-blue-100">
                <strong>Claim:</strong>{" "}
                {claimDetails.type || "Disability Compensation"} •
                <strong> ID:</strong> {claimId}
              </p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Privacy Notice */}
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-green-800 dark:text-green-200 mb-1">
                  Secure Upload
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Documents are uploaded directly to the VA Claims system via
                  their official API. Files are encrypted in transit and never
                  stored on our servers.
                </p>
              </div>
            </div>
          </div>

          {/* Success State */}
          {uploadStatus === "success" && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl p-6 mb-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">
                Upload Successful!
              </h3>
              <p className="text-green-700 dark:text-green-300 mb-4">
                Your document has been submitted to the VA and attached to your
                claim.
              </p>
              <button
                onClick={() => {
                  clearFile();
                  setUploadStatus(null);
                }}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Upload Another Document
              </button>
            </div>
          )}

          {/* Upload Interface */}
          {uploadStatus !== "success" && (
            <>
              {/* Document Type Selection */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                  1. Select Document Type
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {DOCUMENT_TYPES.map((docType) => (
                    <button
                      key={docType.id}
                      onClick={() => setDocumentType(docType.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-colors ${
                        documentType === docType.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{docType.icon}</span>
                        <span
                          className={`font-medium ${
                            documentType === docType.id
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {docType.label}
                        </span>
                        {docType.recommended && (
                          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded">
                            ⭐
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 pl-7">
                        {docType.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* File Upload Zone */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                  2. Upload PDF File
                </h3>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleInputChange}
                  className="hidden"
                  id="evidence-file-input"
                />

                {!selectedFile ? (
                  <label
                    htmlFor="evidence-file-input"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      isDragOver
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                        : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                  >
                    <Upload
                      className={`w-12 h-12 mx-auto mb-4 ${
                        isDragOver ? "text-blue-500" : "text-gray-400"
                      }`}
                    />
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isDragOver
                        ? "Drop file here"
                        : "Drag & drop your PDF here"}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      or click to browse
                    </p>
                    <span className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                      Select PDF File
                    </span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                      Maximum file size: 25MB • PDF format only
                    </p>
                  </label>
                ) : (
                  <div className="border-2 border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/30 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                          <FileCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedFile.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB •
                            PDF
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={clearFile}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Remove file"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 dark:text-red-300">
                    {errorMessage}
                  </p>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Uploading...
                    </span>
                    <span className="text-sm text-gray-500">
                      {uploadProgress}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading to VA...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Submit to VA Claim
                  </>
                )}
              </button>

              {/* Info */}
              <div className="mt-4 flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  Your document will be submitted directly to the VA and
                  attached to claim #{claimId}. Processing typically takes 24-48
                  hours to appear in your claim status.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900 flex justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Sparkles className="w-4 h-4" />
            <span>Skip the mailroom • Direct digital submission</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClaimEvidenceUpload;
