/**
 * Vet-Rate.org - Sanitize & Share Button
 * "The Reddit Protocol" - Screenshot with automatic PII redaction
 *
 * Veterans constantly share screenshots on r/VeteransBenefits, Facebook groups,
 * and Discord - often accidentally exposing PII. This component solves that.
 *
 * Features:
 * - Auto-detects and redacts .pii-sensitive elements
 * - Adds Vet-Rate.org watermark (free marketing!)
 * - One-click download or clipboard copy
 * - Multiple export formats for different platforms
 */

import { useState, useCallback } from "react";
import { useScreenshot } from "../hooks/useScreenshot";
import ResponsiveModal from "./common/ResponsiveModal";

const PreviewModalHeader = ({ onClose }) => (
  <div className="flex items-center justify-between bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
    <div className="flex items-center gap-3">
      <span className="text-2xl">📸</span>
      <div>
        <h3 id="share-preview-title" className="text-lg font-bold text-white">
          Screenshot Preview
        </h3>
        <p className="text-sm text-green-200">PII automatically redacted</p>
      </div>
    </div>
    <button
      onClick={onClose}
      aria-label="Close dialog"
      className="rounded-lg p-2 text-white/80 hover:bg-white/20 hover:text-white"
    >
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
);

const PreviewDownloadButton = ({
  previewUrl,
  getFilename,
  downloadSuccess,
  setDownloadSuccess,
}) => (
  <button
    onClick={async () => {
      const link = document.createElement("a");
      link.href = previewUrl;
      link.download = getFilename();
      link.click();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    }}
    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
  >
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
    {downloadSuccess ? "✓ Downloaded!" : "Download PNG"}
  </button>
);

const PreviewCopyButton = ({ previewUrl, copySuccess, setCopySuccess }) => (
  <button
    onClick={async () => {
      try {
        const response = await fetch(previewUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    }}
    className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-purple-700"
  >
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
      />
    </svg>
    {copySuccess ? "✓ Copied!" : "Copy to Clipboard"}
  </button>
);

const PreviewModalFooter = ({
  previewUrl,
  getFilename,
  downloadSuccess,
  setDownloadSuccess,
  copySuccess,
  setCopySuccess,
  onClose,
}) => (
  <div>
    <div className="flex flex-wrap justify-center gap-3">
      <PreviewDownloadButton
        previewUrl={previewUrl}
        getFilename={getFilename}
        downloadSuccess={downloadSuccess}
        setDownloadSuccess={setDownloadSuccess}
      />
      <PreviewCopyButton
        previewUrl={previewUrl}
        copySuccess={copySuccess}
        setCopySuccess={setCopySuccess}
      />
      <button
        onClick={onClose}
        className="flex items-center gap-2 rounded-lg bg-gray-200 px-5 py-3 font-semibold text-gray-800 transition-colors hover:bg-gray-300 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-700"
      >
        Close
      </button>
    </div>

    <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
      🔒 All sensitive information has been automatically redacted for safe
      sharing
    </p>
  </div>
);

// Screenshot preview/edit modal, shared across all ShareButton variants
const SharePreviewModal = ({
  showPreview,
  previewUrl,
  onClose,
  getFilename,
  downloadSuccess,
  setDownloadSuccess,
  copySuccess,
  setCopySuccess,
}) => {
  if (!showPreview || !previewUrl) return null;

  return (
    <ResponsiveModal
      isOpen={showPreview}
      onClose={onClose}
      header={<PreviewModalHeader onClose={onClose} />}
      labelledBy="share-preview-title"
      size="xl"
      zIndex={100}
      footer={
        <PreviewModalFooter
          previewUrl={previewUrl}
          getFilename={getFilename}
          downloadSuccess={downloadSuccess}
          setDownloadSuccess={setDownloadSuccess}
          copySuccess={copySuccess}
          setCopySuccess={setCopySuccess}
          onClose={onClose}
        />
      }
      className="border border-gray-200 dark:border-gray-700"
    >
      <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-950">
        <img
          src={previewUrl}
          alt="Screenshot preview"
          className="mx-auto max-w-full rounded-lg border border-gray-200 shadow-lg dark:border-gray-700"
        />
      </div>
    </ResponsiveModal>
  );
};

const ShareDropdownMenu = ({ handlePreview, handleDownload, handleCopy }) => (
  <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
    <div className="py-2">
      <button
        onClick={handlePreview}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
      >
        <span className="text-xl">👁️</span>
        <div>
          <div className="font-semibold">Preview & Edit</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            See before sharing
          </div>
        </div>
      </button>
      <button
        onClick={handleDownload}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
      >
        <span className="text-xl">💾</span>
        <div>
          <div className="font-semibold">Download PNG</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Save to device
          </div>
        </div>
      </button>
      <button
        onClick={handleCopy}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
      >
        <span className="text-xl">📋</span>
        <div>
          <div className="font-semibold">Copy to Clipboard</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Paste anywhere
          </div>
        </div>
      </button>
    </div>
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
      <p className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-500">
        <span>🔒</span> PII auto-redacted for safety
      </p>
    </div>
  </div>
);

const ShareButtonDefault = ({
  className,
  isCapturing,
  showMenu,
  setShowMenu,
  handlePreview,
  handleDownload,
  handleCopy,
  previewModalProps,
}) => (
  <>
    <div className="relative inline-block">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isCapturing}
        className={`flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 ${className}`}
      >
        {isCapturing ? (
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
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Capturing...
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Share
          </>
        )}
      </button>
      {/* Dropdown Menu */}
      {showMenu && (
        <ShareDropdownMenu
          handlePreview={handlePreview}
          handleDownload={handleDownload}
          handleCopy={handleCopy}
        />
      )}
    </div>
    {/* Click outside to close */}
    {showMenu && (
      <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
        className="fixed inset-0 z-40"
        onClick={() => setShowMenu(false)}
      />
    )}
    <SharePreviewModal {...previewModalProps} />
  </>
);

const ShareButtonIcon = ({
  className,
  isCapturing,
  handlePreview,
  previewModalProps,
}) => (
  <>
    <button
      onClick={handlePreview}
      disabled={isCapturing}
      aria-label="Export for Reddit (PII Protected)"
      className={`rounded-lg p-2 text-gray-600 transition-colors hover:bg-green-100 hover:text-green-600 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-green-500/10 dark:hover:text-green-400 ${className}`}
    >
      {isCapturing ? (
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
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
      )}
    </button>
    <SharePreviewModal {...previewModalProps} />
  </>
);

const ShareButtonFloating = ({
  className,
  isCapturing,
  handlePreview,
  previewModalProps,
}) => (
  <>
    <button
      onClick={handlePreview}
      disabled={isCapturing}
      className={`fixed bottom-20 right-4 z-40 p-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-full shadow-2xl hover:scale-110 transition-transform disabled:opacity-50 ${className}`}
      aria-label="Export for Reddit (PII Protected)"
    >
      {isCapturing ? (
        <svg
          className="w-6 h-6 animate-spin"
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
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
      )}
    </button>
    <SharePreviewModal {...previewModalProps} />
  </>
);

// Preview/download/copy click handlers shared by every ShareButton variant
function useShareActions({
  targetRef,
  captureScreenshot,
  downloadScreenshot,
  copyToClipboard,
  getFilename,
  onCapture,
  setPreviewUrl,
  setShowPreview,
  setShowMenu,
  setDownloadSuccess,
  setCopySuccess,
}) {
  const handlePreview = useCallback(async () => {
    if (!targetRef?.current) return;

    try {
      const result = await captureScreenshot(targetRef);
      setPreviewUrl(result.dataUrl);
      setShowPreview(true);
      setShowMenu(false);
      onCapture?.(result);
    } catch (err) {
      console.error("Preview error:", err);
    }
  }, [
    targetRef,
    captureScreenshot,
    onCapture,
    setPreviewUrl,
    setShowPreview,
    setShowMenu,
  ]);

  const handleDownload = useCallback(async () => {
    if (!targetRef?.current) return;

    try {
      await downloadScreenshot(targetRef, getFilename());
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
      setShowMenu(false);
    } catch (err) {
      console.error("Download error:", err);
    }
  }, [
    targetRef,
    downloadScreenshot,
    getFilename,
    setDownloadSuccess,
    setShowMenu,
  ]);

  const handleCopy = useCallback(async () => {
    if (!targetRef?.current) return;

    try {
      await copyToClipboard(targetRef);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      setShowMenu(false);
    } catch (err) {
      console.error("Copy error:", err);
    }
  }, [targetRef, copyToClipboard, setCopySuccess, setShowMenu]);

  return { handlePreview, handleDownload, handleCopy };
}

// All state, screenshot wiring, and derived props shared by every ShareButton variant
function useShareButtonState({ targetRef, filename, onCapture }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const {
    captureScreenshot,
    downloadScreenshot,
    copyToClipboard,
    isCapturing,
    _error,
  } = useScreenshot({
    watermarkText: "Generated by Vet-Rate.org • Privacy Protected",
  });

  // Generate timestamped filename
  const getFilename = useCallback(() => {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${filename}-${timestamp}.png`;
  }, [filename]);

  const { handlePreview, handleDownload, handleCopy } = useShareActions({
    targetRef,
    captureScreenshot,
    downloadScreenshot,
    copyToClipboard,
    getFilename,
    onCapture,
    setPreviewUrl,
    setShowPreview,
    setShowMenu,
    setDownloadSuccess,
    setCopySuccess,
  });

  const previewModalProps = {
    showPreview,
    previewUrl,
    onClose: () => setShowPreview(false),
    getFilename,
    downloadSuccess,
    setDownloadSuccess,
    copySuccess,
    setCopySuccess,
  };

  return {
    isCapturing,
    showMenu,
    setShowMenu,
    handlePreview,
    handleDownload,
    handleCopy,
    previewModalProps,
  };
}

/**
 * ShareButton Component
 *
 * @param {Object} props
 * @param {React.RefObject} props.targetRef - Ref to the element to capture
 * @param {string} props.filename - Suggested filename for download
 * @param {string} props.variant - 'button' | 'icon' | 'floating'
 * @param {string} props.className - Additional CSS classes
 */
const ShareButton = ({
  targetRef,
  filename = "vet-rate-share",
  variant = "button",
  className = "",
  onCapture,
}) => {
  const {
    isCapturing,
    showMenu,
    setShowMenu,
    handlePreview,
    handleDownload,
    handleCopy,
    previewModalProps,
  } = useShareButtonState({ targetRef, filename, onCapture });

  // Button variant
  if (variant === "button") {
    return (
      <ShareButtonDefault
        className={className}
        isCapturing={isCapturing}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        handlePreview={handlePreview}
        handleDownload={handleDownload}
        handleCopy={handleCopy}
        previewModalProps={previewModalProps}
      />
    );
  }

  // Icon variant (compact)
  if (variant === "icon") {
    return (
      <ShareButtonIcon
        className={className}
        isCapturing={isCapturing}
        handlePreview={handlePreview}
        previewModalProps={previewModalProps}
      />
    );
  }

  // Floating variant
  if (variant === "floating") {
    return (
      <ShareButtonFloating
        className={className}
        isCapturing={isCapturing}
        handlePreview={handlePreview}
        previewModalProps={previewModalProps}
      />
    );
  }

  return null;
};

/**
 * PIISensitive wrapper component
 * Wrap any content containing PII with this to auto-redact in screenshots
 */
export const PIISensitive = ({ children, className = "" }) => (
  <span className={`pii-sensitive ${className}`} data-pii="true">
    {children}
  </span>
);

export default ShareButton;
