/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 */

import React, { useState, useEffect } from 'react';

/**
 * MobileNotice Component
 * 
 * Displays a friendly, dismissible notice to mobile users that the app
 * works best on larger screens. Remembers dismissal for the session.
 */
const MobileNotice = () => {
  const [dismissed, setDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if already dismissed this session
    const wasDismissed = sessionStorage.getItem('vetrate-mobile-notice-dismissed') === 'true';
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Check screen size
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('vetrate-mobile-notice-dismissed', 'true');
  };

  if (dismissed || !isMobile) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 text-center relative">
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 pr-8">
        <span className="text-lg">📱</span>
        <p className="text-sm font-medium">
          <span className="hidden sm:inline">Hey there! </span>
          This app works best on a larger screen (tablet or desktop) for the full experience!
        </p>
        <span className="text-lg hidden sm:inline">💻</span>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/20 rounded-full transition-colors"
        aria-label="Dismiss notice"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default MobileNotice;
