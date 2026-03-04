/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * DbqShareMenu Component
 * "Secure Document Exchange" - Three-tab sharing interface
 * Tab 1: Direct Download (Standard)
 * Tab 2: Encrypted Package (For Email)
 * Tab 3: Mobile Handoff (AirDrop/Share)
 */

import React, { useState, useEffect } from 'react';
import {
  generateDraftDbq,
  downloadPdfBlob,
  createEncryptedZip,
  sharePdfNatively,
  copyDbqSummaryToClipboard,
  getSubjectiveQuestions,
} from '../utils/pdfDbqFiller';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * DbqShareMenu - Secure sharing interface for draft DBQs
 * @param {object} props
 * @param {string} props.formId - The DBQ form ID (e.g., "Knee-Lower-Leg")
 * @param {string} props.formTitle - The DBQ title for display
 * @param {object} props.formData - User's answers to subjective questions
 * @param {function} props.onClose - Callback when menu is closed
 */
export default function DbqShareMenu({ formId, formTitle, formData, onClose }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('download');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  
  // Check for native share support on mount
  useEffect(() => {
    const checkShareSupport = async () => {
      if (navigator.share) {
        // Create a test file to check if file sharing is supported
        const testBlob = new Blob(['test'], { type: 'application/pdf' });
        const testFile = new File([testBlob], 'test.pdf', { type: 'application/pdf' });
        
        if (navigator.canShare && navigator.canShare({ files: [testFile] })) {
          setCanNativeShare(true);
        }
      }
    };
    checkShareSupport();
  }, []);

  const getFilename = () => {
    const date = new Date().toISOString().split('T')[0];
    return `DRAFT_DBQ_${formId}_${date}.pdf`;
  };

  // Tab 1: Direct Download
  const handleDirectDownload = async () => {
    setIsGenerating(true);
    setStatus({ type: 'info', message: 'Generating draft DBQ...' });
    
    try {
      // deepcode ignore javascript/DOMXSS: downloadPdfBlob delegates to triggerBlobDownload which reconstructs the blob URL from UUID regex — a.href is literal 'blob:' + origin + '/' + UUID, never raw blob content
      const pdfBlob = await generateDraftDbq(formId, formData, {
        includeWatermark: true,
        includeBanner: true,
      });
      
      if (!pdfBlob) {
        throw new Error('Failed to generate PDF');
      }
      
      downloadPdfBlob(pdfBlob, getFilename());
      setStatus({ type: 'success', message: 'Draft DBQ downloaded!' });
    } catch (error) {
      const safeMsg = (error.message || 'Unknown error').replace(/[<>&"']/g, '');
      setStatus({ type: 'error', message: `❌ Error: ${safeMsg}` });
    } finally {
      setIsGenerating(false);
    }
  };

  // Tab 2: Encrypted ZIP
  const handleEncryptedDownload = async () => {
    if (!password || password.length < 4) {
      setStatus({ type: 'error', message: '❌ Please enter a password (at least 4 characters)' });
      return;
    }
    
    setIsGenerating(true);
    setStatus({ type: 'info', message: 'Generating secure package...' });
    
    try {
      const pdfBlob = await generateDraftDbq(formId, formData, {
        includeWatermark: true,
        includeBanner: true,
      });
      
      if (!pdfBlob) {
        throw new Error('Failed to generate PDF');
      }
      
      const zipBlob = await createEncryptedZip(pdfBlob, getFilename(), password);
      
      if (!zipBlob) {
        throw new Error('Failed to create ZIP');
      }
      
      const date = new Date().toISOString().split('T')[0];
      downloadPdfBlob(zipBlob, `Secure_DBQ_Package_${date}.zip`);
      
      setStatus({ 
        type: 'success', 
        message: '✅ Secure package downloaded! Share the password separately (call/text).' 
      });
    } catch (error) {
      setStatus({ type: 'error', message: `❌ Error: ${error.message}` });
    } finally {
      setIsGenerating(false);
    }
  };

  // Tab 3: Mobile Share
  const handleNativeShare = async () => {
    setIsGenerating(true);
    setStatus({ type: 'info', message: 'Preparing to share...' });
    
    try {
      const pdfBlob = await generateDraftDbq(formId, formData, {
        includeWatermark: true,
        includeBanner: true,
      });
      
      if (!pdfBlob) {
        throw new Error('Failed to generate PDF');
      }
      
      const result = await sharePdfNatively(pdfBlob, getFilename(), `Draft DBQ: ${formTitle}`);
      
      if (result.success) {
        setStatus({ type: 'success', message: '✅ Shared successfully!' });
      } else if (result.method === 'cancelled') {
        setStatus({ type: 'info', message: 'Share cancelled' });
      } else {
        throw new Error(result.error || 'Share failed');
      }
    } catch (error) {
      setStatus({ type: 'error', message: `❌ Error: ${error.message}` });
    } finally {
      setIsGenerating(false);
    }
  };

  // Fallback: Copy to clipboard
  const handleCopyToClipboard = async () => {
    setIsGenerating(true);
    
    try {
      const success = await copyDbqSummaryToClipboard(formData);
      
      if (success) {
        setStatus({ type: 'success', message: '✅ Summary copied to clipboard!' });
      } else {
        throw new Error('Failed to copy');
      }
    } catch (error) {
      setStatus({ type: 'error', message: `❌ Error: ${error.message}` });
    } finally {
      setIsGenerating(false);
    }
  };

  const tabs = [
    { id: 'download', label: '📥 Download', icon: '📥' },
    { id: 'encrypt', label: '🔐 Encrypt', icon: '🔐' },
    { id: 'share', label: '📲 Share', icon: '📲' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden max-w-lg w-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
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

      {/* DBQ Info */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-semibold">Form:</span> {formTitle || formId}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          ⚠️ All documents include "DRAFT" watermark for physician review
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-600">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* Status Message */}
        {status && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              status.type === 'success'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                : status.type === 'error'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
            }`}
          >
            {status.message}
          </div>
        )}

        {/* Tab 1: Direct Download */}
        {activeTab === 'download' && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                📥 Direct Download
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Download the draft DBQ as a PDF file. Perfect for printing or 
                saving to your records before your appointment.
              </p>
              <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-4">
                <li>✓ Includes "DRAFT" watermark on all pages</li>
                <li>✓ Red banner: "For Physician Review Only"</li>
                <li>✓ Your responses pre-filled in subjective sections</li>
              </ul>
            </div>
            
            <button
              onClick={handleDirectDownload}
              disabled={isGenerating}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin">⏳</span> Generating...
                </>
              ) : (
                <>
                  📄 Download Draft PDF
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 2: Encrypted ZIP */}
        {activeTab === 'encrypt' && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                🔐 Password-Protected Package
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Create a secure ZIP file to email to your doctor. Share the 
                password separately (call or text) for security.
              </p>
              <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <li>✓ Safe to send over email</li>
                <li>✓ Protected even if email is compromised</li>
                <li>✓ Includes instructions for your doctor</li>
              </ul>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Set a Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a password (min 4 characters)"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                💡 Tip: Use your birth year or last 4 of phone # - easy to share verbally
              </p>
            </div>
            
            <button
              onClick={handleEncryptedDownload}
              disabled={isGenerating || password.length < 4}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin">⏳</span> Creating Package...
                </>
              ) : (
                <>
                  🔒 Generate Secure ZIP
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 3: Mobile Share */}
        {activeTab === 'share' && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                📲 Mobile Handoff
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {canNativeShare
                  ? 'Share directly to your doctor\'s device via AirDrop, text, or any app.'
                  : 'Copy your responses to paste into a patient portal or message.'}
              </p>
              {canNativeShare && (
                <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <li>✓ Perfect for in-person appointments</li>
                  <li>✓ AirDrop to doctor's iPad instantly</li>
                  <li>✓ Or send via text/email from your phone</li>
                </ul>
              )}
            </div>
            
            {canNativeShare ? (
              <button
                onClick={handleNativeShare}
                disabled={isGenerating}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">⏳</span> Preparing...
                  </>
                ) : (
                  <>
                    📲 Open Share Sheet
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    📱 Native sharing requires a mobile device with iOS/Android.
                    Use the options below instead:
                  </p>
                </div>
                
                <button
                  onClick={handleCopyToClipboard}
                  disabled={isGenerating}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  📋 Copy Summary to Clipboard
                </button>
                
                <button
                  onClick={handleDirectDownload}
                  disabled={isGenerating}
                  className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  📄 Download PDF Instead
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          🔒 Your data never leaves your device. Vet-Rate.org processes everything locally.
        </p>
      </div>
    </div>
  );
}
