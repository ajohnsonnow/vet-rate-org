/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See COPYRIGHT.js for full license terms.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { checkSystemCapabilities, renderBrowserWarning } from './utils/systemCapabilityCheck';
import './index.css';

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
  
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
}
