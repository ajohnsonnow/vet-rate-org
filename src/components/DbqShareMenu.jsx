/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * DbqShareMenu Component
 * "Document Exchange" - Three-tab sharing interface
 * Tab 1: Direct Download (Standard)
 * Tab 2: Email Bundle (.zip - NOT encrypted)
 * Tab 3: Mobile Handoff (AirDrop/Share)
 */

import { useState, useEffect } from "react";
import {
  generateDraftDbq,
  downloadPdfBlob,
  createDocumentZip,
  sharePdfNatively,
  copyDbqSummaryToClipboard,
} from "../utils/pdfDbqFiller";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";

const STATUS_MESSAGE_CLASSES = {
  success:
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  error: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
};
const DEFAULT_STATUS_MESSAGE_CLASSES =
  "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200";

function buildDraftFilename(formId) {
  const date = new Date().toISOString().split("T")[0];
  return `DRAFT_DBQ_${formId}_${date}.pdf`;
}

// Tab 1: Direct Download
async function downloadDirectDbq(formId, formData, deps) {
  const { setIsGenerating, setStatus } = deps;
  setIsGenerating(true);
  setStatus({ type: "info", message: "Generating draft DBQ..." });

  try {
    // deepcode ignore javascript/DOMXSS: downloadPdfBlob delegates to triggerBlobDownload which reconstructs the blob URL from UUID regex - a.href is literal 'blob:' + origin + '/' + UUID, never raw blob content
    const pdfBlob = await generateDraftDbq(formId, formData, {
      includeWatermark: true,
      includeBanner: true,
    });

    if (!pdfBlob) {
      throw new Error("Failed to generate PDF");
    }

    downloadPdfBlob(pdfBlob, buildDraftFilename(formId));
    setStatus({ type: "success", message: "Draft DBQ downloaded!" });
  } catch (error) {
    const safeMsg = (error.message || "Unknown error").replace(/[<>&"']/g, "");
    setStatus({ type: "error", message: `❌ Error: ${safeMsg}` });
  } finally {
    setIsGenerating(false);
  }
}

// Tab 2: Email Bundle (.zip - NOT encrypted)
async function downloadZipBundle(formId, formData, deps) {
  const { setIsGenerating, setStatus } = deps;
  setIsGenerating(true);
  setStatus({ type: "info", message: "Generating ZIP bundle..." });

  try {
    const pdfBlob = await generateDraftDbq(formId, formData, {
      includeWatermark: true,
      includeBanner: true,
    });

    if (!pdfBlob) {
      throw new Error("Failed to generate PDF");
    }

    const zipBlob = await createDocumentZip(
      pdfBlob,
      buildDraftFilename(formId),
    );

    if (!zipBlob) {
      throw new Error("Failed to create ZIP");
    }

    const date = new Date().toISOString().split("T")[0];
    downloadPdfBlob(zipBlob, `DBQ_Package_${date}.zip`);

    setStatus({
      type: "success",
      message:
        "✅ ZIP bundle downloaded. It is not encrypted - send it over a secure channel (VA portal / in person), not ordinary email.",
    });
  } catch (error) {
    setStatus({ type: "error", message: `❌ Error: ${error.message}` });
  } finally {
    setIsGenerating(false);
  }
}

// Tab 3: Mobile Share
async function shareNativeDbq(formId, formData, formTitle, deps) {
  const { setIsGenerating, setStatus } = deps;
  setIsGenerating(true);
  setStatus({ type: "info", message: "Preparing to share..." });

  try {
    const pdfBlob = await generateDraftDbq(formId, formData, {
      includeWatermark: true,
      includeBanner: true,
    });

    if (!pdfBlob) {
      throw new Error("Failed to generate PDF");
    }

    const result = await sharePdfNatively(
      pdfBlob,
      buildDraftFilename(formId),
      `Draft DBQ: ${formTitle}`,
    );

    if (result.success) {
      setStatus({ type: "success", message: "✅ Shared successfully!" });
    } else if (result.method === "cancelled") {
      setStatus({ type: "info", message: "Share cancelled" });
    } else {
      throw new Error(result.error || "Share failed");
    }
  } catch (error) {
    setStatus({ type: "error", message: `❌ Error: ${error.message}` });
  } finally {
    setIsGenerating(false);
  }
}

// Fallback: Copy to clipboard
async function copyDbqSummary(formData, deps) {
  const { setIsGenerating, setStatus } = deps;
  setIsGenerating(true);

  try {
    const success = await copyDbqSummaryToClipboard(formData);

    if (success) {
      setStatus({
        type: "success",
        message: "✅ Summary copied to clipboard!",
      });
    } else {
      throw new Error("Failed to copy");
    }
  } catch (error) {
    setStatus({ type: "error", message: `❌ Error: ${error.message}` });
  } finally {
    setIsGenerating(false);
  }
}

function ShareMenuHeader({ onClose }) {
  return (
    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4">
      <div className="flex justify-between items-start">
        <div>
          <h3
            id="dbq-share-title"
            className="text-lg font-bold flex items-center gap-2"
          >
            🔒 Secure Document Exchange
          </h3>
          <p className="text-emerald-100 text-sm mt-1">
            Share your draft DBQ securely with your doctor
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white text-xl font-bold"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function DbqInfoBanner({ formTitle, formId }) {
  return (
    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        <span className="font-semibold">Form:</span> {formTitle || formId}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        ⚠️ All documents include &quot;DRAFT&quot; watermark for physician
        review
      </p>
    </div>
  );
}

function TabNav({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex border-b border-gray-200 dark:border-gray-600">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function StatusMessage({ status }) {
  if (!status) return null;

  const classes =
    STATUS_MESSAGE_CLASSES[status.type] || DEFAULT_STATUS_MESSAGE_CLASSES;

  return (
    <div className={`mb-4 p-3 rounded-lg text-sm ${classes}`}>
      {status.message}
    </div>
  );
}

function DownloadTabContent({ isGenerating, onDownload }) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <h4 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
          📥 Direct Download
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Download the draft DBQ as a PDF file. Perfect for printing or saving
          to your records before your appointment.
        </p>
        <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-4">
          <li>✓ Includes &quot;DRAFT&quot; watermark on all pages</li>
          <li>✓ Red banner: &quot;For Physician Review Only&quot;</li>
          <li>✓ Your responses pre-filled in subjective sections</li>
        </ul>
      </div>

      <button
        onClick={onDownload}
        disabled={isGenerating}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <span className="animate-spin">⏳</span> Generating...
          </>
        ) : (
          <>📄 Download Draft PDF</>
        )}
      </button>
    </div>
  );
}

function EmailZipTabContent({ isGenerating, onDownload }) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <h4 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
          📧 Email Bundle (.zip)
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Bundle the draft DBQ into a single .zip with a short README for your
          doctor - handy as an email attachment.
        </p>
        <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <li>✓ One file: the DBQ PDF + instructions for your doctor</li>
          <li>✓ Opens with any standard zip tool</li>
        </ul>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          ⚠️ This ZIP is <strong>not encrypted or password-protected</strong>.
          Ordinary email is not secure. For your medical records, send it
          through your VA patient portal / secure messaging, or hand it off in
          person.
        </p>
      </div>

      <button
        onClick={onDownload}
        disabled={isGenerating}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <span className="animate-spin">⏳</span> Creating Bundle...
          </>
        ) : (
          <>📦 Create ZIP Bundle</>
        )}
      </button>
    </div>
  );
}

function MobileShareTabContent({
  canNativeShare,
  isGenerating,
  onShare,
  onCopy,
  onDownload,
}) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <h4 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
          📲 Mobile Handoff
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {canNativeShare
            ? "Share directly to your doctor's device via AirDrop, text, or any app."
            : "Copy your responses to paste into a patient portal or message."}
        </p>
        {canNativeShare && (
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <li>✓ Perfect for in-person appointments</li>
            <li>✓ AirDrop to doctor&apos;s iPad instantly</li>
            <li>✓ Or send via text/email from your phone</li>
          </ul>
        )}
      </div>

      {canNativeShare ? (
        <button
          onClick={onShare}
          disabled={isGenerating}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <span className="animate-spin">⏳</span> Preparing...
            </>
          ) : (
            <>📲 Open Share Sheet</>
          )}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              📱 Native sharing requires a mobile device with iOS/Android. Use
              the options below instead:
            </p>
          </div>

          <button
            onClick={onCopy}
            disabled={isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-lg font-semibold transition-colors"
          >
            📋 Copy Summary to Clipboard
          </button>

          <button
            onClick={onDownload}
            disabled={isGenerating}
            className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold transition-colors"
          >
            📄 Download PDF Instead
          </button>
        </div>
      )}
    </div>
  );
}

async function checkNativeShareSupport(setCanNativeShare) {
  if (!navigator.share) return;
  // Create a test file to check if file sharing is supported
  const testBlob = new Blob(["test"], { type: "application/pdf" });
  const testFile = new File([testBlob], "test.pdf", {
    type: "application/pdf",
  });

  if (navigator.canShare && navigator.canShare({ files: [testFile] })) {
    setCanNativeShare(true);
  }
}

const SHARE_TABS = [
  { id: "download", label: "📥 Download", icon: "📥" },
  { id: "encrypt", label: "📧 Email Zip", icon: "📧" },
  { id: "share", label: "📲 Share", icon: "📲" },
];

function ShareMenuFooter() {
  return (
    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        🔒 Your data never leaves your device. Vet-Rate.org processes everything
        locally.
      </p>
    </div>
  );
}

/**
 * DbqShareMenu - Secure sharing interface for draft DBQs
 * @param {object} props
 * @param {string} props.formId - The DBQ form ID (e.g., "Knee-Lower-Leg")
 * @param {string} props.formTitle - The DBQ title for display
 * @param {object} props.formData - User's answers to subjective questions
 * @param {function} props.onClose - Callback when menu is closed
 */
export default function DbqShareMenu({ formId, formTitle, formData, onClose }) {
  const { _t } = useLanguage();
  const [activeTab, setActiveTab] = useState("download");
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState(null);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // Check for native share support on mount
  useEffect(() => {
    checkNativeShareSupport(setCanNativeShare);
  }, []);

  const genDeps = { setIsGenerating, setStatus };
  const handleDirectDownload = () =>
    downloadDirectDbq(formId, formData, genDeps);
  const handleZipDownload = () => downloadZipBundle(formId, formData, genDeps);
  const handleNativeShare = () =>
    shareNativeDbq(formId, formData, formTitle, genDeps);
  const handleCopyToClipboard = () => copyDbqSummary(formData, genDeps);

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="md"
      zIndex={80}
      labelledBy="dbq-share-title"
      header={<ShareMenuHeader onClose={onClose} />}
    >
      <div className="-mx-4 -my-4">
        {/* DBQ Info */}
        <DbqInfoBanner formTitle={formTitle} formId={formId} />

        {/* Tab Navigation */}
        <TabNav
          tabs={SHARE_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Tab Content */}
        <div className="p-4">
          {/* Status Message */}
          <StatusMessage status={status} />

          {/* Tab 1: Direct Download */}
          {activeTab === "download" && (
            <DownloadTabContent
              isGenerating={isGenerating}
              onDownload={handleDirectDownload}
            />
          )}

          {/* Tab 2: Email Bundle (.zip - NOT encrypted) */}
          {activeTab === "encrypt" && (
            <EmailZipTabContent
              isGenerating={isGenerating}
              onDownload={handleZipDownload}
            />
          )}

          {/* Tab 3: Mobile Share */}
          {activeTab === "share" && (
            <MobileShareTabContent
              canNativeShare={canNativeShare}
              isGenerating={isGenerating}
              onShare={handleNativeShare}
              onCopy={handleCopyToClipboard}
              onDownload={handleDirectDownload}
            />
          )}
        </div>

        {/* Footer */}
        <ShareMenuFooter />
      </div>
    </ResponsiveModal>
  );
}
