/**
 * SupplyLocker.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Session Lock Component
 * "Dead Man's Switch" - Auto-lock after inactivity to protect veteran data
 */

import React, { useEffect, useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before lock

const SessionLock = ({ 
  isEnabled = true,
  onLockRequired,
  onActivityDetected,
  customTimeout
}) => {
  const { t } = useLanguage();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const inactivityTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const countdownIntervalRef = useRef(null);

  const timeout = customTimeout || INACTIVITY_TIMEOUT;

  // Reset inactivity timer
  const resetTimer = () => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    
    // Clear existing timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    if (!isEnabled) return;

    // Set warning timer (shows 2 minutes before lock)
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setTimeRemaining(WARNING_TIME);
      
      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1000) {
            clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }, timeout - WARNING_TIME);

    // Set lock timer
    inactivityTimerRef.current = setTimeout(() => {
      handleLock();
    }, timeout);

    if (onActivityDetected) {
      onActivityDetected();
    }
  };

  // Handle screen lock
  const handleLock = () => {
    setShowWarning(false);
    if (onLockRequired) {
      onLockRequired();
    }
  };

  // Handle stay active
  const handleStayActive = () => {
    resetTimer();
  };

  // Activity event listeners
  useEffect(() => {
    if (!isEnabled) return;

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Throttle activity detection to avoid excessive timer resets
    let throttleTimeout = null;
    const handleActivity = () => {
      if (throttleTimeout) return;
      
      throttleTimeout = setTimeout(() => {
        resetTimer();
        throttleTimeout = null;
      }, 1000);
    };

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [isEnabled, timeout]);

  // Format time remaining
  const formatTime = (ms) => {
    const seconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9998]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-pulse-slow">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-6">
          <div className="flex items-center gap-3 text-white">
            <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="text-xl font-bold">Session Timeout Warning</h2>
              <p className="text-yellow-100 text-sm mt-1">Your session will lock soon</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Warning Message */}
          <div className="text-center">
            <div className="text-6xl font-bold text-orange-500 dark:text-orange-400 mb-4">
              {formatTime(timeRemaining)}
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Your session will lock due to inactivity
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This protects your sensitive information when using shared or public computers
            </p>
          </div>

          {/* Security Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Security Feature Active:</strong> After 15 minutes of inactivity, your data is automatically locked.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleStayActive}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg 
                       hover:bg-blue-700 transition-colors font-medium
                       shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              I'm Still Here
            </button>
            <button
              onClick={handleLock}
              className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                       rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 
                       transition-colors font-medium"
            >
              Lock Now
            </button>
          </div>

          {/* Tip */}
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
            💡 Tip: Move your mouse or press any key to stay active
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionLock;
