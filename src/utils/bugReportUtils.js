/**
 * Bug Report Utility Functions
 * Collects comprehensive diagnostic information for bug reports
 * Privacy-focused: User controls what data is included
 */

// Application modules/features
export const APP_MODULES = {
  SEARCH: 'Disability Search',
  DISABILITY_DETAILS: 'Disability Details View',
  SECONDARY_SCOUT: 'Secondary Scout',
  SECONDARY_SCOUT_LAUNCHER: 'Secondary Scout Launcher',
  NEXUS_BUILDER: 'Nexus Builder',
  MY_PACKET: 'My Packet',
  CAP_SIMULATOR: 'C&P Exam Simulator',
  VA_RESOURCES: 'VA Resources Hub',
  PDF_GENERATOR: 'PDF Generator',
  HEADER_NAV: 'Header Navigation',
  FOOTER: 'Footer',
  ACCESSIBILITY_MENU: 'Accessibility Menu',
  PRIVACY_POLICY: 'Privacy Policy Modal',
  ABOUT_US: 'About Us Modal',
  CONTACT_US: 'Contact Us Modal',
  OTHER: 'Other/General'
};

// Bug severity levels
export const BUG_SEVERITY = {
  CRITICAL: { label: 'Critical - App crashes or data loss', value: 'critical', emoji: '🔴' },
  HIGH: { label: 'High - Feature completely broken', value: 'high', emoji: '🟠' },
  MEDIUM: { label: 'Medium - Feature partially works', value: 'medium', emoji: '🟡' },
  LOW: { label: 'Low - Minor issue or cosmetic', value: 'low', emoji: '🟢' }
};

// Bug categories
export const BUG_CATEGORIES = {
  UI_DISPLAY: 'UI/Display Issue',
  DATA_INCORRECT: 'Incorrect Data/Information',
  FEATURE_BROKEN: 'Feature Not Working',
  NAVIGATION: 'Navigation/Routing Problem',
  PERFORMANCE: 'Performance/Speed Issue',
  ACCESSIBILITY: 'Accessibility Issue',
  MOBILE: 'Mobile/Responsive Issue',
  SEARCH: 'Search Not Finding Results',
  PDF: 'PDF Generation Problem',
  SAVE_LOAD: 'Save/Load Data Issue',
  OTHER: 'Other'
};

/**
 * Gather browser and system information
 */
export const getSystemInfo = () => {
  const nav = navigator;
  const screen = window.screen;
  
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    language: nav.language,
    cookiesEnabled: nav.cookieEnabled,
    onLine: nav.onLine,
    screenResolution: `${screen.width}x${screen.height}`,
    windowSize: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    colorDepth: screen.colorDepth,
    touchSupport: 'ontouchstart' in window || nav.maxTouchPoints > 0,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: new Date().toISOString()
  };
};

/**
 * Gather application state information
 */
export const getAppState = (appState = {}) => {
  const {
    searchTerm = '',
    results = [],
    selectedResult = null,
    hasSearched = false,
    showSecondaryScout = false,
    showSecondaryScoutLauncher = false,
    showNexusBuilder = false,
    showMyPacket = false,
    showCAPSimulator = false,
    showVAResources = false,
    userConditions = [],
    nexusBuilderData = null,
    error = null
  } = appState;

  return {
    currentView: determineCurrentView(appState),
    searchTerm: searchTerm ? `"${searchTerm}"` : '(none)',
    resultCount: results.length,
    selectedCondition: selectedResult ? {
      name: selectedResult.conditionName,
      diagnosticCode: selectedResult.diagnosticCode,
      ratingSchedule: selectedResult.ratingSchedule
    } : null,
    activeModals: getActiveModals(appState),
    userConditionsCount: userConditions.length,
    nexusBuilderActive: showNexusBuilder,
    nexusBuilderCondition: nexusBuilderData?.condition || null,
    hasError: !!error,
    errorMessage: error || null
  };
};

/**
 * Determine the current active view/module
 */
const determineCurrentView = (appState) => {
  const {
    showSecondaryScout,
    showSecondaryScoutLauncher,
    showNexusBuilder,
    showMyPacket,
    showCAPSimulator,
    showVAResources,
    showPrivacyPolicy,
    showAboutUs,
    showContactUs,
    selectedResult
  } = appState;

  if (showCAPSimulator) return APP_MODULES.CAP_SIMULATOR;
  if (showNexusBuilder) return APP_MODULES.NEXUS_BUILDER;
  if (showMyPacket) return APP_MODULES.MY_PACKET;
  if (showSecondaryScout) return APP_MODULES.SECONDARY_SCOUT;
  if (showSecondaryScoutLauncher) return APP_MODULES.SECONDARY_SCOUT_LAUNCHER;
  if (showVAResources) return APP_MODULES.VA_RESOURCES;
  if (showPrivacyPolicy) return APP_MODULES.PRIVACY_POLICY;
  if (showAboutUs) return APP_MODULES.ABOUT_US;
  if (showContactUs) return APP_MODULES.CONTACT_US;
  if (selectedResult) return APP_MODULES.DISABILITY_DETAILS;
  return APP_MODULES.SEARCH;
};

/**
 * Get list of active modals
 */
const getActiveModals = (appState) => {
  const modals = [];
  if (appState.showSecondaryScoutLauncher) modals.push('SecondaryScoutLauncher');
  if (appState.showSecondaryScout) modals.push('SecondaryScout');
  if (appState.showNexusBuilder) modals.push('NexusBuilder');
  if (appState.showMyPacket) modals.push('MyPacket');
  if (appState.showCAPSimulator) modals.push('CAPSimulator');
  if (appState.showVAResources) modals.push('VAResources');
  if (appState.showPrivacyPolicy) modals.push('PrivacyPolicy');
  if (appState.showAboutUs) modals.push('AboutUs');
  if (appState.showContactUs) modals.push('ContactUs');
  return modals;
};

/**
 * Get localStorage diagnostic info (sanitized)
 */
export const getStorageInfo = () => {
  try {
    const savedClaims = localStorage.getItem('vet_rate_saved_claims');
    const statements = localStorage.getItem('vet_rate_statements');
    const themePreference = localStorage.getItem('vet_rate_theme');
    
    const claimsData = savedClaims ? JSON.parse(savedClaims) : [];
    const statementsData = statements ? JSON.parse(statements) : {};
    
    return {
      savedClaimsCount: claimsData.length,
      savedClaimConditions: claimsData.map(c => ({
        condition: c.conditionName,
        hasParent: !!c.parentCondition,
        status: c.status
      })),
      statementsCount: Object.keys(statementsData).length,
      themePreference: themePreference || 'system',
      localStorageAvailable: true
    };
  } catch (error) {
    return {
      localStorageAvailable: false,
      error: error.message
    };
  }
};

/**
 * Capture console errors (if any were logged)
 */
export const getConsoleErrors = () => {
  // This would need to be set up with a global error handler
  // For now, return any errors stored in sessionStorage
  try {
    const errors = sessionStorage.getItem('vet_rate_console_errors');
    return errors ? JSON.parse(errors) : [];
  } catch {
    return [];
  }
};

/**
 * Log console error for bug reports
 */
export const logConsoleError = (error) => {
  try {
    const errors = getConsoleErrors();
    errors.push({
      message: error.message || String(error),
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    // Keep only last 10 errors
    const recentErrors = errors.slice(-10);
    sessionStorage.setItem('vet_rate_console_errors', JSON.stringify(recentErrors));
  } catch {
    // Silently fail if sessionStorage is unavailable
  }
};

/**
 * Format the complete bug report for clipboard/display
 */
export const formatBugReport = (reportData) => {
  const {
    userDescription,
    stepsToReproduce,
    expectedBehavior,
    actualBehavior,
    module,
    diagnosticCode,
    severity,
    category,
    systemInfo,
    appState,
    storageInfo,
    consoleErrors,
    additionalContext
  } = reportData;

  const divider = '─'.repeat(60);
  const timestamp = new Date().toISOString();
  const reportId = `BUG-${Date.now().toString(36).toUpperCase()}`;

  let report = `Squash this Bug:

╔══════════════════════════════════════════════════════════════╗
║              🐛 VET-RATE.ORG BUG REPORT                      ║
║              Generated: ${timestamp.split('T')[0]}                       ║
╚══════════════════════════════════════════════════════════════╝
Report ID: ${reportId}

${divider}
📋 BUG SUMMARY
${divider}
Severity: ${severity.emoji} ${severity.label}
Category: ${category}
Module: ${module}
${diagnosticCode ? `Diagnostic Code: ${diagnosticCode}` : ''}

${divider}
📝 USER DESCRIPTION
${divider}
${userDescription || '(No description provided)'}

${divider}
🔄 STEPS TO REPRODUCE
${divider}
${stepsToReproduce || '(No steps provided)'}

${divider}
✅ EXPECTED BEHAVIOR
${divider}
${expectedBehavior || '(Not specified)'}

${divider}
❌ ACTUAL BEHAVIOR
${divider}
${actualBehavior || '(Not specified)'}
`;

  if (additionalContext) {
    report += `
${divider}
💬 ADDITIONAL CONTEXT
${divider}
${additionalContext}
`;
  }

  report += `
${divider}
🖥️ SYSTEM INFORMATION
${divider}
• Browser/User Agent: ${systemInfo.userAgent}
• Platform: ${systemInfo.platform}
• Screen Resolution: ${systemInfo.screenResolution}
• Window Size: ${systemInfo.windowSize}
• Device Pixel Ratio: ${systemInfo.devicePixelRatio}
• Touch Support: ${systemInfo.touchSupport ? 'Yes' : 'No'}
• Online Status: ${systemInfo.onLine ? 'Online' : 'Offline'}
• Timezone: ${systemInfo.timezone}
• Language: ${systemInfo.language}
• Timestamp: ${systemInfo.timestamp}
`;

  report += `
${divider}
📱 APPLICATION STATE
${divider}
• Current View: ${appState.currentView}
• Search Term: ${appState.searchTerm}
• Results Count: ${appState.resultCount}
• Active Modals: ${appState.activeModals.length > 0 ? appState.activeModals.join(', ') : 'None'}
${appState.selectedCondition ? `
• Selected Condition:
  - Name: ${appState.selectedCondition.name}
  - Diagnostic Code: ${appState.selectedCondition.diagnosticCode}
  - Rating Schedule: ${appState.selectedCondition.ratingSchedule}
` : '• Selected Condition: None'}
• User Conditions Count: ${appState.userConditionsCount}
• Nexus Builder Active: ${appState.nexusBuilderActive ? 'Yes' : 'No'}
${appState.nexusBuilderCondition ? `• Nexus Builder Condition: ${appState.nexusBuilderCondition}` : ''}
${appState.hasError ? `• Error Present: Yes\n• Error Message: ${appState.errorMessage}` : '• Error Present: No'}
`;

  report += `
${divider}
💾 STORAGE INFORMATION
${divider}
• LocalStorage Available: ${storageInfo.localStorageAvailable ? 'Yes' : 'No'}
${storageInfo.localStorageAvailable ? `• Saved Claims: ${storageInfo.savedClaimsCount}
• Saved Statements: ${storageInfo.statementsCount}
• Theme Preference: ${storageInfo.themePreference}` : `• Storage Error: ${storageInfo.error}`}
`;

  if (storageInfo.savedClaimConditions && storageInfo.savedClaimConditions.length > 0) {
    report += `
• Saved Claim Details:
${storageInfo.savedClaimConditions.map((c, i) => `  ${i + 1}. ${c.condition} (${c.status})${c.hasParent ? ' [Secondary]' : ''}`).join('\n')}
`;
  }

  if (consoleErrors && consoleErrors.length > 0) {
    report += `
${divider}
⚠️ CONSOLE ERRORS (Last ${consoleErrors.length})
${divider}
${consoleErrors.map((err, i) => `
[${i + 1}] ${err.timestamp}
Message: ${err.message}
${err.stack ? `Stack: ${err.stack.split('\n').slice(0, 3).join('\n')}` : ''}
`).join('\n')}
`;
  }

  report += `
${divider}
📎 END OF BUG REPORT
${divider}
Generated by Vet-Rate.org Bug Squasher v1.0
`;

  return report;
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return { success: true };
  } catch (error) {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return { success: true };
    } catch (fallbackError) {
      return { success: false, error: fallbackError.message };
    }
  }
};

/**
 * Initialize global error handler for capturing runtime errors
 */
export const initializeErrorCapture = () => {
  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    logConsoleError({
      message: event.message,
      stack: event.error?.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logConsoleError({
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: event.reason?.stack
    });
  });
};
