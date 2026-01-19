/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * SESSION GUARDIAN - "Dead Man's Switch"
 * Auto-lock screen with PIN entry after 15 minutes of inactivity
 * Full-screen black overlay with integrated authentication
 */

import React, { useEffect, useState, useRef } from 'react';
import { verifyPin } from '../utils/secureStorage';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_TIME = 2 * 60 * 1000; // Warning 2 minutes before lock
const THROTTLE_INTERVAL = 1000; // 1 second throttle on activity detection

const SessionGuardian = ({ 
  isEnabled = true,
  onUnlock,
  requirePin = true
}) => {
  // State
  const [isLocked, setIsLocked] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  
  // Refs
  const inactivityTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const throttleTimeoutRef = useRef(null);
  const pinInputRef = useRef(null);

  // Reset inactivity timer
  const resetTimer = () => {
    if (!isEnabled || isLocked) return;

    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setTimeRemaining(0);
    
    // Clear existing timers
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    // Set warning timer
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
    }, INACTIVITY_TIMEOUT - WARNING_TIME);

    // Set lock timer
    inactivityTimerRef.current = setTimeout(() => {
      handleLock();
    }, INACTIVITY_TIMEOUT);
  };

  // Handle screen lock
  const handleLock = () => {
    setIsLocked(true);
    setShowWarning(false);
    setPin('');
    setError('');
    
    // Clear all timers
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    console.log('🔒 Session locked due to inactivity');
  };

  // Handle PIN submission
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    try {
      if (requirePin) {
        // Verify PIN against vault
        const isValid = await verifyPin(pin);
        
        if (isValid) {
          // Correct PIN - unlock
          setIsLocked(false);
          setPin('');
          setError('');
          resetTimer();
          
          if (onUnlock) {
            onUnlock();
          }
          
          console.log('✅ Session unlocked');
        } else {
          // Wrong PIN - shake animation
          setError('Incorrect PIN');
          setIsShaking(true);
          setPin('');
          
          setTimeout(() => setIsShaking(false), 500);
          
          if (pinInputRef.current) {
            pinInputRef.current.focus();
          }
        }
      } else {
        // No PIN required, just unlock
        setIsLocked(false);
        setPin('');
        resetTimer();
        
        if (onUnlock) {
          onUnlock();
        }
      }
    } catch (error) {
      console.error('PIN verification failed:', error);
      setError('Verification failed. Please try again.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  // Stay active (dismiss warning)
  const handleStayActive = () => {
    resetTimer();
  };

  // Activity event listener (throttled)
  useEffect(() => {
    if (!isEnabled || isLocked) return;

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    const handleActivity = () => {
      // Throttle: only reset timer once per second
      if (throttleTimeoutRef.current) return;
      
      throttleTimeoutRef.current = setTimeout(() => {
        resetTimer();
        throttleTimeoutRef.current = null;
      }, THROTTLE_INTERVAL);
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
      
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (throttleTimeoutRef.current) clearTimeout(throttleTimeoutRef.current);
    };
  }, [isEnabled, isLocked]);

  // Auto-focus PIN input when locked
  useEffect(() => {
    if (isLocked && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [isLocked]);

  // Format time remaining
  const formatTime = (ms) => {
    const seconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Don't render if disabled
  if (!isEnabled) return null;

  // Lock Screen Overlay
  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-black z-[10000] flex items-center justify-center">
        <div 
          className={`
            bg-gray-900 rounded-lg shadow-2xl max-w-md w-full mx-4 overflow-hidden
            ${isShaking ? 'animate-shake' : ''}
          `}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6">
            <div className="flex items-center gap-3 text-white">
              <svg className="w-10 h-10 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h2 className="text-2xl font-bold">🔒 Session Locked</h2>
                <p className="text-red-100 text-sm mt-1">Enter your PIN to resume</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handlePinSubmit} className="p-6 space-y-4">
            {/* Security Message */}
            <div className="bg-gray-800 border-l-4 border-orange-500 p-4 rounded">
              <p className="text-gray-200 text-sm">
                <strong className="text-orange-400">Security Feature Active:</strong> Your session was automatically 
                locked after 15 minutes of inactivity to protect your sensitive information.
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-900/50 border-l-4 border-red-500 p-4 rounded animate-fade-in">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-red-300 text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* PIN Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Enter Your PIN
              </label>
              <input
                ref={pinInputRef}
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg 
                         text-white text-center text-2xl tracking-widest
                         focus:ring-2 focus:ring-orange-500 focus:border-transparent
                         placeholder-gray-500"
                maxLength={8}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                autoFocus
                placeholder="••••"
              />
            </div>

            {/* Unlock Button */}
            <button
              type="submit"
              disabled={!pin || pin.length < 4}
              className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 
                       text-white rounded-lg hover:from-orange-600 hover:to-red-600
                       transition-all font-medium text-lg shadow-lg
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transform hover:scale-105"
            >
              🔓 Unlock Session
            </button>

            {/* Help Text */}
            <div className="pt-2 border-t border-gray-700">
              <div className="flex items-start gap-2 text-xs text-gray-400">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p>
                  This is the same PIN you use to encrypt your data. If you've forgotten it, 
                  you'll need to refresh the page and clear your data.
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Keyboard hint */}
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 text-gray-500 text-xs">
          Press Enter to submit
        </div>
      </div>
    );
  }

  // Warning Overlay
  if (showWarning) {
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
                <h2 className="text-xl font-bold">⚠️ Session Timeout Warning</h2>
                <p className="text-yellow-100 text-sm mt-1">Your session will lock soon</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Countdown */}
            <div className="text-center">
              <div className="text-6xl font-bold text-orange-500 dark:text-orange-400 mb-4">
                {formatTime(timeRemaining)}
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Your session will lock due to inactivity
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This protects your sensitive information on shared or public computers
              </p>
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
  }

  return null;
};

// Add shake animation to global CSS
const shakeAnimation = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
  20%, 40%, 60%, 80% { transform: translateX(10px); }
}

.animate-shake {
  animation: shake 0.5s;
}
`;

export default SessionGuardian;
