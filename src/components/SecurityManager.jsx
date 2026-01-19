/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Security Manager Component
 * Orchestrates all security features: Vault, Session Lock, PIN Management
 */

import React, { useState, useEffect, useCallback } from 'react';
import PinEntryModal from './PinEntryModal';
import SessionGuardian from './SessionGuardian';
import PanicButton from './PanicButton';
import { 
  hasExistingPin, 
  needsMigration, 
  migrateLegacyData,
  completeMigrationCleanup,
  verifyPin,
  initializeVault,
  changePin,
  getVaultStatus,
  isCryptoAvailable
} from '../utils/secureStorage';

const STORAGE_KEY_VAULT_ENABLED = 'vet-rate-vault-enabled';
const STORAGE_KEY_SESSION_LOCK_ENABLED = 'vet-rate-session-lock-enabled';

const SecurityManager = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pinMode, setPinMode] = useState('verify'); // 'verify', 'setup', 'change'
  const [pinError, setPinError] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [vaultEnabled, setVaultEnabled] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_VAULT_ENABLED) === 'true';
  });
  const [sessionLockEnabled, setSessionLockEnabled] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_SESSION_LOCK_ENABLED) !== 'false'; // Default true
  });
  const [panicButtonEnabled, setPanicButtonEnabled] = useState(() => {
    return localStorage.getItem('vet-rate-panic-button-enabled') !== 'false'; // Default true
  });
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Check if we need to show setup or migration on mount
  useEffect(() => {
    if (!isCryptoAvailable()) {
      console.warn('Web Crypto API not available - encryption disabled');
      return;
    }

    // Check if user needs to set up vault for the first time
    if (vaultEnabled && !hasExistingPin() && needsMigration()) {
      setShowMigrationPrompt(true);
    } else if (vaultEnabled && hasExistingPin()) {
      // User has vault enabled, show unlock
      setPinMode('verify');
      setShowPinEntry(true);
    }
  }, [vaultEnabled]);

  // Handle PIN submission
  const handlePinSubmit = async (pin, oldPin = null) => {
    setPinError('');

    try {
      if (pinMode === 'setup') {
        // Setup new vault
        const success = await initializeVault(pin);
        if (success) {
          setCurrentPin(pin);
          setIsUnlocked(true);
          setShowPinEntry(false);
          
          // If we have legacy data, migrate it
          if (needsMigration()) {
            setIsMigrating(true);
            await migrateLegacyData(pin);
            completeMigrationCleanup();
            setIsMigrating(false);
          }
          
          localStorage.setItem(STORAGE_KEY_VAULT_ENABLED, 'true');
          setVaultEnabled(true);
        } else {
          setPinError('Failed to setup vault. Please try again.');
        }
      } else if (pinMode === 'verify') {
        // Verify existing PIN
        const isValid = await verifyPin(pin);
        if (isValid) {
          setCurrentPin(pin);
          setIsUnlocked(true);
          setShowPinEntry(false);
        } else {
          setPinError('Incorrect PIN. Please try again.');
        }
      } else if (pinMode === 'change') {
        // Change PIN
        const success = await changePin(oldPin, pin);
        if (success) {
          setCurrentPin(pin);
          setShowPinEntry(false);
        } else {
          setPinError('Failed to change PIN. Please verify your current PIN.');
        }
      }
    } catch (error) {
      console.error('PIN operation failed:', error);
      setPinError('An error occurred. Please try again.');
    }
  };

  // Handle session lock
  const handleLockRequired = useCallback(() => {
    if (vaultEnabled) {
      setIsUnlocked(false);
      setCurrentPin('');
      setPinMode('verify');
      setShowPinEntry(true);
    }
  }, [vaultEnabled]);

  // Handle migration acceptance
  const handleAcceptMigration = () => {
    setShowMigrationPrompt(false);
    setPinMode('setup');
    setShowPinEntry(true);
  };

  // Handle migration decline
  const handleDeclineMigration = () => {
    setShowMigrationPrompt(false);
    localStorage.setItem(STORAGE_KEY_VAULT_ENABLED, 'false');
    setVaultEnabled(false);
    setIsUnlocked(true); // Allow access without encryption
  };

  // Public API for components to request vault operations
  const requestPinChange = () => {
    setPinMode('change');
    setShowPinEntry(true);
  };

  const enableVault = () => {
    if (!hasExistingPin()) {
      setPinMode('setup');
      setShowPinEntry(true);
    }
  };

  const disableVault = () => {
    if (confirm('⚠️ Warning: This will disable encryption and clear all encrypted data. Are you sure?')) {
      // Clear vault data
      localStorage.removeItem(STORAGE_KEY_VAULT_ENABLED);
      setVaultEnabled(false);
      setIsUnlocked(true);
      setCurrentPin('');
    }
  };

  const toggleSessionLock = () => {
    const newState = !sessionLockEnabled;
    setSessionLockEnabled(newState);
    localStorage.setItem(STORAGE_KEY_SESSION_LOCK_ENABLED, newState.toString());
  };

  const togglePanicButton = () => {
    const newState = !panicButtonEnabled;
    setPanicButtonEnabled(newState);
    localStorage.setItem('vet-rate-panic-button-enabled', newState.toString());
  };

  // Provide security context to children
  const securityContext = {
    isVaultEnabled: vaultEnabled,
    isUnlocked,
    currentPin,
    enableVault,
    disableVault,
    requestPinChange,
    isSessionLockEnabled: sessionLockEnabled,
    toggleSessionLock,
    isPanicButtonEnabled: panicButtonEnabled,
    togglePanicButton,
    vaultStatus: getVaultStatus()
  };

  return (
    <>
      {/* Migration Prompt */}
      {showMigrationPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
              <div className="flex items-center gap-3 text-white">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <h2 className="text-xl font-bold">🛡️ Security Upgrade Available</h2>
                  <p className="text-blue-100 text-sm mt-1">Protect your data with encryption</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Why This Matters
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Right now, your data is stored in plain text. If you're using a shared or public computer, 
                  anyone with access to your browser could read your trauma history, medical conditions, and personal statements.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  ✅ What You Get:
                </h3>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 ml-4">
                  <li>• <strong>Military-grade AES-256 encryption</strong> for all your data</li>
                  <li>• <strong>PIN protection</strong> - only you can access your information</li>
                  <li>• <strong>Auto-lock after 15 minutes</strong> of inactivity</li>
                  <li>• <strong>Zero server uploads</strong> - everything stays on your device</li>
                </ul>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>⚠️ Important:</strong> Choose a PIN you'll remember. If you forget it, 
                  your encrypted data cannot be recovered.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleDeclineMigration}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                           rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Not Now
                </button>
                <button
                  onClick={handleAcceptMigration}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg 
                           hover:bg-blue-700 transition-colors font-medium shadow-lg"
                >
                  Setup Encryption
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Entry Modal */}
      <PinEntryModal
        isOpen={showPinEntry}
        onClose={() => {
          setShowPinEntry(false);
          setPinError('');
        }}
        onSubmit={handlePinSubmit}
        mode={pinMode}
        error={pinError}
      />

      {/* Session Guardian (replaces SessionLock) */}
      {vaultEnabled && isUnlocked && (
        <SessionGuardian
          isEnabled={sessionLockEnabled}
          onUnlock={() => {
            console.log('Session unlocked');
          }}
          requirePin={true}
        />
      )}

      {/* Panic Button */}
      <PanicButton
        isEnabled={panicButtonEnabled}
        coverType="google" // or 'excel', 'blank', 'news'
      />

      {/* Migrating Overlay */}
      {isMigrating && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md mx-4">
            <div className="text-center">
              <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Encrypting Your Data...
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please wait while we secure your information. This will only take a moment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Render children with security context */}
      {React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child, { securityContext })
          : child
      )}
    </>
  );
};

export default SecurityManager;

// Hook for components to access security context
export const useSecurity = () => {
  const context = React.useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within SecurityManager');
  }
  return context;
};

const SecurityContext = React.createContext(null);
