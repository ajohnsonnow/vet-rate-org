/**
 * Bug Report Utility Functions
 * Collects comprehensive diagnostic information for bug reports
 * Privacy-focused: User controls what data is included
 */

// Application modules/features - DIAMOND LEVEL: All 45+ tools tracked!
export const APP_MODULES = {
  // Core Navigation
  SEARCH: 'Disability Search',
  DISABILITY_DETAILS: 'Disability Details View',
  MY_PACKET: 'My Packet',
  USER_MANUAL: 'Field Manual',
  
  // Calculate Tools
  TACTICAL_CALCULATOR: 'Tactical Calculator (Rating)',
  MILLION_DOLLAR_DASHBOARD: 'Million Dollar Dashboard',
  WHAT_IF_SANDBOX: 'What-If Sandbox',
  RETRO_PAY_HUNTER: 'Retro Pay Hunter',
  TIME_MACHINE: 'Time Machine (ITF Tracker)',
  
  // Discover Tools
  SECONDARY_SCOUT: 'Secondary Scout',
  SECONDARY_SCOUT_LAUNCHER: 'Secondary Scout Launcher',
  CAP_SIMULATOR: 'C&P Exam Simulator',
  PATHFINDER: 'Pathfinder (AI Strategy)',
  CLAIM_NAVIGATOR: 'Claim Navigator',
  MOS_HAZARD_MATCHER: 'MOS Hazard Matcher',
  PACT_ACT_NAVIGATOR: 'PACT Act Navigator',
  WEB_OF_CONDITIONS: 'Web of Conditions',
  
  // Build Evidence Tools
  CFILE_ANALYZER: 'C-File Analyzer',
  BLUE_BUTTON_XRAY: 'Blue Button X-Ray',
  RECORD_SEARCH: 'Record Search',
  WITNESS_BENCH: 'Witness Bench (Buddy Letters)',
  NEXUS_BUILDER: 'Nexus Builder',
  FORMS_HELPER: 'Forms Helper',
  SYMPTOM_LOGGER: 'Symptom Logger',
  PAIN_PAINTER: 'Pain Painter (Body Map)',
  EVIDENCE_TIMELINE: 'Evidence Timeline',
  FOIA_GENERATOR: 'FOIA Generator (Keysmith)',
  DD214_ANALYZER: 'DD214 Analyzer',
  
  // Quality Control Tools
  RED_TEAM: 'Red Team (Statement Stress Test)',
  CLAIM_STRESS_TEST: 'Claim Stress Test (War Game)',
  DECISION_DECODER: 'Decision Decoder',
  DENIAL_DECODER: 'Denial Decoder',
  SHARK_RADAR: 'Shark Radar (Scam Detector)',
  CONSISTENCY_ENGINE: 'Consistency Engine',
  EVIDENCE_GAP_VISUALIZER: 'Evidence Gap Visualizer',
  RISK_ASSESSMENT: 'Risk Assessment (Poke the Bear)',
  
  // Maximize Rating Tools
  TDIU_BUILDER: 'TDIU Builder',
  STATE_BENEFIT_HUNTER: 'State Benefit Hunter',
  THE_TRIBUNAL: 'The Tribunal (Mock Hearing)',
  LEGISLATIVE_WATCHDOG: 'Legislative Watchdog',
  
  // Support & Resources
  VSO_FINDER: 'VSO Finder',
  VA_RESOURCES: 'VA Resources Hub',
  VA_AI_TRANSPARENCY: 'VA AI Transparency',
  
  // Data Management
  BACKUP_MANAGER: 'Backup Manager',
  CLOUD_SYNC: 'Cloud Sync Manager',
  
  // AI & Settings
  AI_SETTINGS: 'AI Settings',
  LOCAL_AI_PANEL: 'Local AI Panel',
  AI_ASSISTANT: 'AI Navigator',
  
  // Modals & System
  PRIVACY_POLICY: 'Privacy Policy Modal',
  ABOUT_US: 'About Us Modal',
  CONTACT_US: 'Contact Us Modal',
  TERMS_OF_SERVICE: 'Terms of Service',
  HEADER_NAV: 'Header Navigation',
  FOOTER: 'Footer',
  ACCESSIBILITY_MENU: 'Accessibility Menu',
  PDF_GENERATOR: 'PDF Generator',
  
  // Catch-all
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
 * Get list of active modals - DIAMOND LEVEL: All 45+ tools tracked!
 */
const getActiveModals = (appState) => {
  const modals = [];
  
  // Core Navigation
  if (appState.showMyPacket) modals.push('MyPacket');
  if (appState.showUserManual) modals.push('UserManual');
  if (appState.showVAResources) modals.push('VAResources');
  
  // Calculate Tools
  if (appState.showTacticalCalculator) modals.push('TacticalCalculator');
  if (appState.showMillionDollarDashboard) modals.push('MillionDollarDashboard');
  if (appState.showWhatIfSandbox) modals.push('WhatIfSandbox');
  if (appState.showRetroPayHunter) modals.push('RetroPayHunter');
  if (appState.showTimeMachine) modals.push('TimeMachine');
  
  // Discover Tools
  if (appState.showSecondaryScoutLauncher) modals.push('SecondaryScoutLauncher');
  if (appState.showSecondaryScout) modals.push('SecondaryScout');
  if (appState.showCAPSimulator) modals.push('CAPSimulator');
  if (appState.showPathfinder) modals.push('Pathfinder');
  if (appState.showClaimNavigator) modals.push('ClaimNavigator');
  if (appState.showMOSHazardMatcher) modals.push('MOSHazardMatcher');
  if (appState.showPACTActNavigator) modals.push('PACTActNavigator');
  if (appState.showWebOfConditions) modals.push('WebOfConditions');
  
  // Build Evidence Tools
  if (appState.showCFileAnalyzer) modals.push('CFileAnalyzer');
  if (appState.showBlueButtonXRay) modals.push('BlueButtonXRay');
  if (appState.showRecordSearch) modals.push('RecordSearch');
  if (appState.showWitnessBench) modals.push('WitnessBench');
  if (appState.showNexusBuilder) modals.push('NexusBuilder');
  if (appState.showFormsHelper) modals.push('FormsHelper');
  if (appState.showSymptomLogger) modals.push('SymptomLogger');
  if (appState.showPainPainter) modals.push('PainPainter');
  if (appState.showEvidenceTimeline) modals.push('EvidenceTimeline');
  if (appState.showFOIAGenerator) modals.push('FOIAGenerator');
  if (appState.showDD214Analyzer) modals.push('DD214Analyzer');
  
  // Quality Control Tools
  if (appState.showRedTeam) modals.push('RedTeam');
  if (appState.showClaimStressTest) modals.push('ClaimStressTest');
  if (appState.showDecisionDecoder) modals.push('DecisionDecoder');
  if (appState.showDenialDecoder) modals.push('DenialDecoder');
  if (appState.showSharkRadar) modals.push('SharkRadar');
  if (appState.showConsistencyEngine) modals.push('ConsistencyEngine');
  if (appState.showEvidenceGapVisualizer) modals.push('EvidenceGapVisualizer');
  if (appState.showRiskAssessment) modals.push('RiskAssessment');
  
  // Maximize Rating Tools
  if (appState.showTDIUBuilder) modals.push('TDIUBuilder');
  if (appState.showStateBenefitHunter) modals.push('StateBenefitHunter');
  if (appState.showTheTribunal) modals.push('TheTribunal');
  if (appState.showLegislativeWatchdog) modals.push('LegislativeWatchdog');
  
  // Support Tools
  if (appState.showVSOFinder) modals.push('VSOFinder');
  if (appState.showVAAITransparency) modals.push('VAAITransparency');
  
  // Data Management
  if (appState.showBackupManager) modals.push('BackupManager');
  if (appState.showCloudSyncManager) modals.push('CloudSyncManager');
  
  // AI & Settings
  if (appState.showAISettings) modals.push('AISettings');
  if (appState.showLocalAIPanel) modals.push('LocalAIPanel');
  
  // System Modals
  if (appState.showPrivacyPolicy) modals.push('PrivacyPolicy');
  if (appState.showAboutUs) modals.push('AboutUs');
  if (appState.showContactUs) modals.push('ContactUs');
  if (appState.showTermsOfService) modals.push('TermsOfService');
  
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
 * Capture console messages (errors, warnings, logs) for bug reports
 * DIAMOND LEVEL: Captures ALL console activity with context
 */
export const getConsoleErrors = () => {
  try {
    const logs = sessionStorage.getItem('vet_rate_console_logs');
    return logs ? JSON.parse(logs) : [];
  } catch {
    return [];
  }
};

/**
 * Log console message for bug reports
 * ENHANCED: Now captures errors, warnings, logs, and info
 */
export const logConsoleError = (entry) => {
  try {
    const logs = getConsoleErrors();
    
    // Create structured entry
    const logEntry = {
      type: entry.type || 'error', // 'error', 'warn', 'log', 'info'
      message: entry.message || String(entry),
      stack: entry.stack || null,
      timestamp: new Date().toISOString(),
      url: entry.url || window.location.href,
      lineNumber: entry.lineno || null,
      columnNumber: entry.colno || null,
      userAgent: navigator.userAgent
    };
    
    logs.push(logEntry);
    
    // Keep only last 50 messages (increased from 10)
    const recentLogs = logs.slice(-50);
    sessionStorage.setItem('vet_rate_console_logs', JSON.stringify(recentLogs));
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
    // Group by type for better readability
    const errorTypes = {
      error: consoleErrors.filter(e => e.type === 'error'),
      warn: consoleErrors.filter(e => e.type === 'warn'),
      log: consoleErrors.filter(e => e.type === 'log'),
      info: consoleErrors.filter(e => e.type === 'info')
    };
    
    report += `
${divider}
🔍 CONSOLE LOGS (Last ${consoleErrors.length} entries)
${divider}
`;
    
    if (errorTypes.error.length > 0) {
      report += `
❌ ERRORS (${errorTypes.error.length}):
${errorTypes.error.map((err, i) => `
[${i + 1}] ${err.timestamp}
    Message: ${err.message}
    URL: ${err.url}${err.lineNumber ? `\n    Line: ${err.lineNumber}:${err.columnNumber}` : ''}
    ${err.stack ? `Stack: ${err.stack.split('\n').slice(0, 3).join('\n    ')}` : ''}
`).join('')}
`;
    }
    
    if (errorTypes.warn.length > 0) {
      report += `
⚠️ WARNINGS (${errorTypes.warn.length}):
${errorTypes.warn.map((warn, i) => `
[${i + 1}] ${warn.timestamp}
    Message: ${warn.message}
    URL: ${warn.url}
`).join('')}
`;
    }
    
    if (errorTypes.log.length > 0) {
      report += `
📝 LOGS (${errorTypes.log.length}):
${errorTypes.log.map((log, i) => `
[${i + 1}] ${log.timestamp} - ${log.message}
`).join('')}
`;
    }
    
    if (errorTypes.info.length > 0) {
      report += `
ℹ️ INFO (${errorTypes.info.length}):
${errorTypes.info.map((info, i) => `
[${i + 1}] ${info.timestamp} - ${info.message}
`).join('')}
`;
    }
  } else {
    report += `
${divider}
🔍 CONSOLE LOGS
${divider}
No console messages captured. (Console monitoring may not be active)
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
 * DIAMOND LEVEL: Captures ALL console activity (errors, warnings, logs, info)
 */
export const initializeErrorCapture = () => {
  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    logConsoleError({
      type: 'error',
      message: event.message,
      stack: event.error?.stack,
      url: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logConsoleError({
      type: 'error',
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: event.reason?.stack
    });
  });
  
  // Intercept console methods to capture logs
  const originalConsole = {
    error: console.error,
    warn: console.warn,
    log: console.log,
    info: console.info
  };
  
  // Intercept console.error
  console.error = function(...args) {
    logConsoleError({
      type: 'error',
      message: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '),
      stack: new Error().stack
    });
    originalConsole.error.apply(console, args);
  };
  
  // Intercept console.warn
  console.warn = function(...args) {
    logConsoleError({
      type: 'warn',
      message: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
    });
    originalConsole.warn.apply(console, args);
  };
  
  // Intercept console.log (capture only important logs to avoid spam)
  console.log = function(...args) {
    // Only capture logs that might be relevant to bugs
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Filter: only capture logs with keywords that indicate issues
    const keywords = ['error', 'fail', 'invalid', 'undefined', 'null', 'not found', 'missing', 'warning'];
    if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
      logConsoleError({
        type: 'log',
        message: message
      });
    }
    
    originalConsole.log.apply(console, args);
  };
  
  // Intercept console.info
  console.info = function(...args) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Only capture info messages with relevant keywords
    const keywords = ['loaded', 'initialized', 'ready', 'completed', 'started'];
    if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
      logConsoleError({
        type: 'info',
        message: message
      });
    }
    
    originalConsole.info.apply(console, args);
  };
};
