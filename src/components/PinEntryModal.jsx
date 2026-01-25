/**
 * SupplyLocker.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * PIN Entry Modal Component
 * Secure authentication interface for The Vault encryption system
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

const PinEntryModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  mode = 'verify', // 'verify', 'setup', 'change'
  title,
  subtitle,
  error: externalError
}) => {
  const { t } = useLanguage();
  
  // Lock background scroll when modal is open
  useBodyScrollLock(isOpen);
  
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setError(externalError || '');
  }, [externalError]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Validate PIN format
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    if (pin.length > 8) {
      setError('PIN must be 8 digits or less');
      return;
    }

    // Setup mode: require confirmation
    if (mode === 'setup' && pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    // Change mode: require old PIN
    if (mode === 'change') {
      if (!oldPin) {
        setError('Current PIN is required');
        return;
      }
      if (pin !== confirmPin) {
        setError('New PINs do not match');
        return;
      }
      onSubmit(pin, oldPin);
    } else {
      onSubmit(pin);
    }
  };

  const handleCancel = () => {
    setPin('');
    setConfirmPin('');
    setOldPin('');
    setError('');
    setShowPin(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
          <div className="flex items-center gap-3 text-white">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <h2 className="text-xl font-bold">
                {title || (mode === 'setup' ? 'Setup Security PIN' : mode === 'change' ? 'Change PIN' : 'Enter PIN')}
              </h2>
              {subtitle && (
                <p className="text-blue-100 text-sm mt-1">{subtitle}</p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Security Notice */}
          {mode === 'setup' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 text-sm text-blue-700 dark:text-blue-300">
                  Your data will be encrypted with military-grade AES-256 encryption. 
                  <strong className="block mt-1">Choose a PIN you'll remember - it cannot be recovered if lost.</strong>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 text-sm text-red-700 dark:text-red-300">{error}</div>
              </div>
            </div>
          )}

          {/* Old PIN (for change mode) */}
          {mode === 'change' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current PIN
              </label>
              <input
                type={showPin ? 'text' : 'password'}
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         text-center text-2xl tracking-widest"
                maxLength={8}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>
          )}

          {/* PIN Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {mode === 'change' ? 'New PIN' : 'PIN'} (4-8 digits)
            </label>
            <input
              ref={inputRef}
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       text-center text-2xl tracking-widest"
              maxLength={8}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              autoFocus
            />
          </div>

          {/* Confirm PIN (for setup/change mode) */}
          {(mode === 'setup' || mode === 'change') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm {mode === 'change' ? 'New ' : ''}PIN
              </label>
              <input
                type={showPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         text-center text-2xl tracking-widest"
                maxLength={8}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
              />
            </div>
          )}

          {/* Show/Hide Toggle */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showPin"
              checked={showPin}
              onChange={(e) => setShowPin(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="showPin" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              Show PIN
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                       rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 
                       transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg 
                       hover:bg-blue-700 transition-colors font-medium
                       disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !pin || 
                pin.length < 4 || 
                ((mode === 'setup' || mode === 'change') && !confirmPin) ||
                (mode === 'change' && !oldPin)
              }
            >
              {mode === 'setup' ? 'Setup Encryption' : mode === 'change' ? 'Change PIN' : 'Unlock'}
            </button>
          </div>

          {/* Security Info */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <p>
                Your PIN never leaves your device. All encryption happens in your browser using Web Crypto API.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PinEntryModal;
