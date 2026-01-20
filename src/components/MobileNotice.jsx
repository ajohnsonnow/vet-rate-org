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
    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 text-center relative shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-3 pr-10">
        <span className="text-2xl" role="img" aria-label="Mobile optimized">📱</span>
        <div className="text-left flex-1">
          <p className="text-sm font-bold">
            Mobile-Optimized Experience!
          </p>
          <p className="text-xs opacity-90 mt-0.5">
            90% of veterans use mobile - this app is built for you ✨
          </p>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/20 rounded-full transition-colors"
        aria-label="Dismiss notice"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default MobileNotice;
