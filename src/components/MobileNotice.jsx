/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 */

import React, { useState, useEffect } from "react";

/**
 * Detect if device is a tablet
 */
const isTablet = () => {
  const ua = navigator.userAgent;

  // iPad detection (including iPadOS 13+ which reports as Mac)
  const isIPad =
    /iPad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // Android tablet detection (Android without "Mobile" keyword)
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);

  // Surface/Windows tablet detection
  const isSurfaceTablet = /Windows.*Touch/i.test(ua);

  // Screen size check for tablets (768px-1366px typical range)
  const screenWidth = Math.max(window.screen.width, window.screen.height);
  const isTabletScreenSize = screenWidth >= 768 && screenWidth <= 1366;

  return (
    isIPad ||
    isAndroidTablet ||
    isSurfaceTablet ||
    (navigator.maxTouchPoints > 2 && isTabletScreenSize)
  );
};

/**
 * MobileNotice Component
 *
 * Displays a friendly, dismissible notice to mobile/tablet users.
 * Shows different messages for phones vs tablets.
 * Remembers dismissal for the session.
 */
const MobileNotice = () => {
  const [dismissed, setDismissed] = useState(false);
  const [deviceType, setDeviceType] = useState(null); // 'tablet' or null

  useEffect(() => {
    // Check if already dismissed this session
    const wasDismissed =
      sessionStorage.getItem("vetrate-mobile-notice-dismissed") === "true";
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Tablet-only notice. The phone branch was removed in S10 — its
    // "optimized for mobile" copy contradicted SmallScreenWarning. Small-screen
    // messaging stays owned by SmallScreenWarning until the mobile suite is green
    // across the top-20 surfaces (docs/SPRINT_PLAN_S9-S17.md, S10).
    const checkDevice = () => {
      setDeviceType(isTablet() ? "tablet" : null);
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("vetrate-mobile-notice-dismissed", "true");
  };

  if (dismissed || !deviceType) return null;

  return (
    <div className="text-white px-4 py-3 text-center relative shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-3 pr-10">
        <span className="text-2xl" role="img" aria-label="Tablet optimized">
          📱💻
        </span>
        <div className="text-left flex-1">
          <p className="text-sm font-bold">
            Tablet Mode - Perfect for Detailed Work!
          </p>
          <p className="text-xs opacity-90 mt-0.5">
            Great choice! Tablet screens are ideal for reviewing claims &
            building your packet 📋
          </p>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/20 rounded-full transition-colors"
        aria-label="Dismiss notice"
      >
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};

export default MobileNotice;
