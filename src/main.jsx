/*
 * Vet-Rate.org - VA Disability Claims Command Center
 * Copyright (C) 2024-2026 Anthony Johnson
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { VaAuthProvider } from './contexts/VaAuthContext';
import VaAuthCallback from './auth/VaAuthCallback';
import VaSandboxTest from './components/debug/VaSandboxTest';
import { checkSystemCapabilities, renderBrowserWarning } from './utils/systemCapabilityCheck';
import './index.css';

// ═══════════════════════════════════════════════════════════════════════════════
// Suppress Browser Extension Errors
// Filter out common extension-related console errors that don't affect the app
// ═══════════════════════════════════════════════════════════════════════════════
const originalError = console.error;
console.error = (...args) => {
  const errorMessage = args[0]?.toString() || '';
  
  // Filter out known extension-related errors
  if (
    errorMessage.includes('message channel closed') ||
    errorMessage.includes('Extension context invalidated') ||
    errorMessage.includes('asynchronous response')
  ) {
    return; // Suppress these errors - they're from browser extensions, not our code
  }
  
  // Log all other errors normally
  originalError.apply(console, args);
};

// ═══════════════════════════════════════════════════════════════════════════════
// TECH CHECK - Browser Capability Guard
// Ensures browser supports Crypto API, IndexedDB, and modern JS before loading app
// ═══════════════════════════════════════════════════════════════════════════════
const capabilityResults = checkSystemCapabilities();

if (!capabilityResults.passed) {
  // Browser doesn't meet minimum requirements - show friendly upgrade page
  console.warn('[Tech Check] Browser missing required capabilities:', capabilityResults.failedTests);
  renderBrowserWarning(capabilityResults);
} else {
  // All systems go - render the app
  console.log('[Tech Check] ✓ All browser capabilities verified');
  
  // Check if this is an OAuth callback or sandbox test route
  const pathname = window.location.pathname;
  const isOAuthCallback = pathname === '/callback';
  const isSandboxTest = pathname === '/sandbox-test';
  
  // Helper to render the appropriate component based on route
  const renderRoute = () => {
    if (isOAuthCallback) return <VaAuthCallback />;
    if (isSandboxTest) return <VaSandboxTest />;
    return <App />;
  };
  
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ThemeProvider>
        <VaAuthProvider>
          {renderRoute()}
        </VaAuthProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
}
