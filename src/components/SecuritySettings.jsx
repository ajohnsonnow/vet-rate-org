/**
 * SupplyLocker.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Security Settings Panel
 * User control center for all security features
 */

import React, { useState, useEffect } from 'react';
import { RedactionToggle } from './RedactionMode';
import { getVaultStatus } from '../utils/secureStorage';
import ZonkButton from './ZonkButton';
import { useLanguage } from '../contexts/LanguageContext';

const SecuritySettings = ({ 
  isOpen, 
  onClose,
  securityContext 
}) => {
  const { t } = useLanguage();
  const [vaultStatus, setVaultStatus] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const status = getVaultStatus();
      setVaultStatus(status);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const {
    isVaultEnabled,
    enableVault,
    disableVault,
    requestPinChange,
    isSessionLockEnabled,
    toggleSessionLock
  } = securityContext || {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 sticky top-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <h2 className="text-xl font-bold">Security & Privacy Settings</h2>
                <p className="text-blue-100 text-sm">Protect your sensitive veteran data</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* The Vault */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    The Vault
                  </h3>
                  {isVaultEnabled && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Military-grade AES-256 encryption protects all your data with a personal PIN
                </p>
                
                {vaultStatus && showDetails && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {vaultStatus.isInitialized ? '✅ Initialized' : '⚠️ Not Setup'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Encrypted Items:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {vaultStatus.encryptedItemCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Migration:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {vaultStatus.hasMigrated ? '✅ Complete' : vaultStatus.needsMigration ? '⏳ Pending' : 'N/A'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 ml-4">
                {isVaultEnabled ? (
                  <>
                    <button
                      onClick={requestPinChange}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Change PIN
                    </button>
                    <button
                      onClick={disableVault}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      Disable
                    </button>
                  </>
                ) : (
                  <button
                    onClick={enableVault}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    Enable Vault
                  </button>
                )}
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="px-4 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-xs"
                >
                  {showDetails ? 'Hide' : 'Show'} Details
                </button>
              </div>
            </div>
          </div>

          {/* Dead Man's Switch */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Dead Man's Switch
                  </h3>
                  {isSessionLockEnabled && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Auto-lock screen after 15 minutes of inactivity (2-minute warning)
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                  💡 Protects your data if you walk away from a public/shared computer
                </p>
              </div>
              <div className="ml-4">
                <button
                  onClick={toggleSessionLock}
                  className={`
                    relative inline-flex h-8 w-14 items-center rounded-full transition-colors
                    ${isSessionLockEnabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-6 w-6 transform rounded-full bg-white transition-transform
                      ${isSessionLockEnabled ? 'translate-x-7' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* The Redactor */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    The Redactor
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Blur personal info (name, SSN, address) for safe screenshots
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                  💡 Share screenshots with VSOs or buddies without exposing sensitive data
                </p>
              </div>
              <div className="ml-4">
                <RedactionToggle className="scale-90" />
              </div>
            </div>
          </div>

          {/* The Scribe */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    The Scribe
                  </h3>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs font-medium rounded-full">
                    Always Available
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Voice-to-text dictation for any text input (hands-free)
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                  💡 Look for the 🎤 microphone icon in text fields
                </p>
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                  <p className="text-blue-800 dark:text-blue-300">
                    <strong>Accessibility Feature:</strong> Built for veterans with hand tremors, 
                    nerve damage, or mobility issues. Click and speak - your words appear automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* The Shield */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    The Shield
                  </h3>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded-full">
                    Always Active
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Content Security Policy blocks XSS attacks and malicious scripts
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                  💡 Runs automatically - no configuration needed
                </p>
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded text-xs">
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>Protection Level:</strong> Blocks 99% of cross-site scripting (XSS) attacks, 
                    prompt injection, and unauthorized API calls. Only trusted sources can execute code.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Panic Button */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Panic Button
                  </h3>
                  {securityContext?.isPanicButtonEnabled && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Instantly hide the app with <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">ESC</kbd> x3 
                  or <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">Ctrl+Space</kbd>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                  💡 Boss coming? Hit the panic button to hide the app instantly (shows fake Google homepage)
                </p>
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs">
                  <p className="text-yellow-800 dark:text-yellow-300">
                    <strong>Privacy Feature:</strong> Replaces your screen with a harmless cover page. 
                    Press the same key combo again to restore the app.
                  </p>
                </div>
              </div>
              <div className="ml-4">
                <button
                  onClick={securityContext?.togglePanicButton}
                  className={`
                    relative inline-flex h-8 w-14 items-center rounded-full transition-colors
                    ${securityContext?.isPanicButtonEnabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-6 w-6 transform rounded-full bg-white transition-transform
                      ${securityContext?.isPanicButtonEnabled ? 'translate-x-7' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Your Privacy Promise
                </p>
                <ul className="text-blue-800 dark:text-blue-200 space-y-1 text-xs">
                  <li>✅ All data stored locally on YOUR device</li>
                  <li>✅ Nothing uploaded to our servers</li>
                  <li>✅ Encrypted with keys only YOU have</li>
                  <li>✅ Delete anytime with one click</li>
                  <li>✅ Built by a veteran, for veterans</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Easter Egg: Zonk Button */}
          <div className="border border-purple-200 dark:border-purple-700 rounded-lg p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              🎖️ Veteran's Morale Boost
              <span className="px-2 py-1 bg-purple-500 text-white text-xs font-bold rounded">EASTER EGG</span>
            </h3>
            <ZonkButton />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Security Architecture v1.0 - January 2026
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings;
