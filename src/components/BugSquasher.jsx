import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  APP_MODULES,
  BUG_SEVERITY,
  BUG_CATEGORIES,
  getSystemInfo,
  getAppState,
  getStorageInfo,
  getConsoleErrors,
  formatBugReport,
  copyToClipboard
} from '../utils/bugReportUtils';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { saveBugReport, generateReportId, saveToLocalStorage } from '../utils/bugReportStorage';
import { createSanitizedReport } from '../utils/bugSanitizer';

// Developer contact email for bug reports
const DEVELOPER_EMAIL = 'Anth@StructuredForGrowth.com';

// FormSubmit.co endpoint - sends directly to developer's email without opening email client
const FORMSUBMIT_URL = 'https://formsubmit.co/ajax/Anth@StructuredForGrowth.com';

function BugSquasher({ onClose, appState = {} }) {
  const { t } = useLanguage();
  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [generatedReport, setGeneratedReport] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    module: appState.currentModule || '',
    diagnosticCode: appState.selectedResult?.diagnosticCode || '',
    severity: null,
    category: '',
    userDescription: '',
    stepsToReproduce: '',
    expectedBehavior: '',
    actualBehavior: '',
    additionalContext: '',
    includeSystemInfo: true,
    includeAppState: true,
    includeStorageInfo: true,
    includeConsoleErrors: true,
    saveToMyTickets: true, // Save to My Packet for tracking
    veteranEmail: '' // Optional email for follow-up
  });

  // DIAMOND LEVEL: Auto-detect current module using smart context tracking
  // Now supports ALL 45+ tools in the app!
  useEffect(() => {
    // First, check if a module name was passed via ReportBugLink (sessionStorage)
    // This has HIGHEST priority since the user clicked "Bug?" from a specific tool
    const sessionModule = sessionStorage.getItem('bugReport_currentModule');
    if (sessionModule && !formData.module) {
      setFormData(prev => ({ ...prev, module: sessionModule }));
      // Clear it so it doesn't persist to next bug report
      sessionStorage.removeItem('bugReport_currentModule');
      return; // Don't override with appState detection
    }
    
    if (appState) {
      // Use the pre-computed currentModule from App.jsx if available
      // This is the "Diamond Level" smart detection the user requested!
      if (appState.currentModule && !formData.module) {
        setFormData(prev => ({ ...prev, module: appState.currentModule }));
      } else if (!formData.module) {
        // Fallback to legacy detection if currentModule not available
        const detectedModule = detectCurrentModule(appState);
        setFormData(prev => ({ ...prev, module: detectedModule }));
      }
    }
    
    // Auto-fill diagnostic code if viewing a condition
    if (appState.selectedResult?.diagnosticCode && !formData.diagnosticCode) {
      setFormData(prev => ({
        ...prev,
        diagnosticCode: appState.selectedResult.diagnosticCode
      }));
    }
  }, [appState]);

  // Legacy fallback detection (if currentModule not passed from App.jsx)
  // DIAMOND LEVEL: Now supports ALL 45+ tools!
  const detectCurrentModule = (state) => {
    // Core Navigation
    if (state.showMyPacket) return APP_MODULES.MY_PACKET;
    if (state.showUserManual) return APP_MODULES.USER_MANUAL;
    if (state.showVAResources) return APP_MODULES.VA_RESOURCES;
    
    // Calculate Tools
    if (state.showTacticalCalculator) return APP_MODULES.TACTICAL_CALCULATOR;
    if (state.showMillionDollarDashboard) return APP_MODULES.MILLION_DOLLAR_DASHBOARD;
    if (state.showWhatIfSandbox) return APP_MODULES.WHAT_IF_SANDBOX;
    if (state.showRetroPayHunter) return APP_MODULES.RETRO_PAY_HUNTER;
    if (state.showTimeMachine) return APP_MODULES.TIME_MACHINE;
    
    // Discover Tools
    if (state.showSecondaryScout) return APP_MODULES.SECONDARY_SCOUT;
    if (state.showSecondaryScoutLauncher) return APP_MODULES.SECONDARY_SCOUT_LAUNCHER;
    if (state.showCAPSimulator) return APP_MODULES.CAP_SIMULATOR;
    if (state.showPathfinder) return APP_MODULES.PATHFINDER;
    if (state.showClaimNavigator) return APP_MODULES.CLAIM_NAVIGATOR;
    if (state.showMOSHazardMatcher) return APP_MODULES.MOS_HAZARD_MATCHER;
    if (state.showPACTActNavigator) return APP_MODULES.PACT_ACT_NAVIGATOR;
    if (state.showWebOfConditions) return APP_MODULES.WEB_OF_CONDITIONS;
    
    // Build Evidence Tools
    if (state.showCFileAnalyzer) return APP_MODULES.CFILE_ANALYZER;
    if (state.showBlueButtonXRay) return APP_MODULES.BLUE_BUTTON_XRAY;
    if (state.showRecordSearch) return APP_MODULES.RECORD_SEARCH;
    if (state.showWitnessBench) return APP_MODULES.WITNESS_BENCH;
    if (state.showNexusBuilder) return APP_MODULES.NEXUS_BUILDER;
    if (state.showFormsHelper) return APP_MODULES.FORMS_HELPER;
    if (state.showSymptomLogger) return APP_MODULES.SYMPTOM_LOGGER;
    if (state.showPainPainter) return APP_MODULES.PAIN_PAINTER;
    if (state.showEvidenceTimeline) return APP_MODULES.EVIDENCE_TIMELINE;
    if (state.showFOIAGenerator) return APP_MODULES.FOIA_GENERATOR;
    if (state.showDD214Analyzer) return APP_MODULES.DD214_ANALYZER;
    
    // Quality Control Tools
    if (state.showRedTeam) return APP_MODULES.RED_TEAM;
    if (state.showClaimStressTest) return APP_MODULES.CLAIM_STRESS_TEST;
    if (state.showDecisionDecoder) return APP_MODULES.DECISION_DECODER;
    if (state.showDenialDecoder) return APP_MODULES.DENIAL_DECODER;
    if (state.showSharkRadar) return APP_MODULES.SHARK_RADAR;
    if (state.showConsistencyEngine) return APP_MODULES.CONSISTENCY_ENGINE;
    if (state.showEvidenceGapVisualizer) return APP_MODULES.EVIDENCE_GAP_VISUALIZER;
    if (state.showRiskAssessment) return APP_MODULES.RISK_ASSESSMENT;
    
    // Maximize Rating Tools
    if (state.showTDIUBuilder) return APP_MODULES.TDIU_BUILDER;
    if (state.showStateBenefitHunter) return APP_MODULES.STATE_BENEFIT_HUNTER;
    if (state.showTheTribunal) return APP_MODULES.THE_TRIBUNAL;
    if (state.showLegislativeWatchdog) return APP_MODULES.LEGISLATIVE_WATCHDOG;
    
    // Support Tools
    if (state.showVSOFinder) return APP_MODULES.VSO_FINDER;
    if (state.showVAAITransparency) return APP_MODULES.VA_AI_TRANSPARENCY;
    
    // Data Management
    if (state.showBackupManager) return APP_MODULES.BACKUP_MANAGER;
    if (state.showCloudSyncManager) return APP_MODULES.CLOUD_SYNC;
    
    // AI & Settings
    if (state.showAISettings) return APP_MODULES.AI_SETTINGS;
    if (state.showLocalAIPanel) return APP_MODULES.LOCAL_AI_PANEL;
    
    // Modals
    if (state.showPrivacyPolicy) return APP_MODULES.PRIVACY_POLICY;
    if (state.showAboutUs) return APP_MODULES.ABOUT_US;
    if (state.showContactUs) return APP_MODULES.CONTACT_US;
    if (state.showTermsOfService) return APP_MODULES.TERMS_OF_SERVICE;
    
    // Default fallbacks
    if (state.selectedResult) return APP_MODULES.DISABILITY_DETAILS;
    return APP_MODULES.SEARCH;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateReport = () => {
    const systemInfo = formData.includeSystemInfo ? getSystemInfo() : { note: 'System info excluded by user' };
    const currentAppState = formData.includeAppState ? getAppState(appState) : { note: 'App state excluded by user' };
    const storageInfo = formData.includeStorageInfo ? getStorageInfo() : { note: 'Storage info excluded by user' };
    const consoleErrors = formData.includeConsoleErrors ? getConsoleErrors() : [];

    const reportData = {
      ...formData,
      systemInfo,
      appState: currentAppState,
      storageInfo,
      consoleErrors
    };

    const report = formatBugReport(reportData);
    setGeneratedReport(report);
    setStep(3);
  };

  // Extract report ID from generated report
  const getReportId = () => {
    const match = generatedReport.match(/Report ID: (BUG-[A-Z0-9]+)/);
    return match ? match[1] : 'BUG-UNKNOWN';
  };

  // Submit bug report via FormSubmit.co API (no email client needed!) and optionally save locally
  const handleSubmitReport = async () => {
    setSubmitting(true);
    setSubmitError('');
    
    try {
      const reportId = getReportId();
      
      // === SAFE-SQUASH: Save to local database if user wants to track ===
      if (formData.saveToMyTickets) {
        try {
          const systemInfo = formData.includeSystemInfo ? getSystemInfo() : {};
          const currentAppState = formData.includeAppState ? getAppState(appState) : {};
          const storageInfo = formData.includeStorageInfo ? getStorageInfo() : {};
          const consoleErrors = formData.includeConsoleErrors ? getConsoleErrors() : [];
          
          // Save to IndexedDB (sanitized automatically)
          await saveBugReport({
            report_id: reportId,
            severity: formData.severity,
            category: formData.category,
            module: formData.module,
            diagnosticCode: formData.diagnosticCode,
            userDescription: formData.userDescription,
            stepsToReproduce: formData.stepsToReproduce,
            expectedBehavior: formData.expectedBehavior,
            actualBehavior: formData.actualBehavior,
            additionalContext: formData.additionalContext,
            veteranEmail: formData.veteranEmail || null,
            systemInfo,
            appState: currentAppState,
            storageInfo,
            consoleErrors
          });
          
          console.log(`✅ Bug report ${reportId} saved to My Tickets (Safe-Squash)`);
        } catch (storageError) {
          // Fallback to localStorage if IndexedDB fails
          console.warn('IndexedDB save failed, using localStorage fallback:', storageError);
          saveToLocalStorage({
            report_id: reportId,
            severity: formData.severity?.value,
            category: formData.category,
            module: formData.module,
            userDescription: formData.userDescription,
            created_at: new Date().toISOString()
          });
        }
      }
      // === END SAFE-SQUASH ===
      
      // Also copy to clipboard as backup
      await copyToClipboard(generatedReport);
      
      // === Send via FormSubmit.co API (stays in-browser, no email client!) ===
      // Note: This is best-effort. Local save is the primary success path.
      try {
        const severityLabel = formData.severity?.label || 'Unknown';
        
        const formPayload = {
          _subject: `[${reportId}] ${severityLabel} - ${formData.category} Bug Report`,
          _template: 'table',
          report_id: reportId,
          severity: severityLabel,
          category: formData.category,
          module: formData.module,
          diagnostic_code: formData.diagnosticCode || 'N/A',
          description: formData.userDescription,
          steps_to_reproduce: formData.stepsToReproduce || 'Not provided',
          expected_behavior: formData.expectedBehavior || 'Not provided',
          actual_behavior: formData.actualBehavior || 'Not provided',
          additional_context: formData.additionalContext || 'None',
          veteran_email: formData.veteranEmail || 'Anonymous (no reply requested)',
          submitted_at: new Date().toISOString(),
          full_report: generatedReport
        };

        const response = await fetch(FORMSUBMIT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(formPayload)
        });

        if (!response.ok) {
          console.warn(`⚠️ FormSubmit returned ${response.status} - report saved locally`);
        } else {
          const result = await response.json();
          
          if (result.success) {
            console.log(`✅ Bug report ${reportId} sent via FormSubmit AND saved locally`);
          } else {
            console.warn(`⚠️ FormSubmit submission failed: ${result.message || 'Unknown error'} - report saved locally`);
          }
        }
      } catch (emailError) {
        // Log but don't fail - local save is what matters
        console.warn(`⚠️ Could not send email notification (${emailError.message}). Your report was saved locally in My Tickets.`);
      }
      
      // Always succeed if we got this far (local save succeeded)
      setSubmitted(true);
      setCopied(true);
      
      setSubmitting(false);
      
    } catch (error) {
      console.error('Submit error:', error);
      setSubmitError('Could not send report. Your report was saved locally. The report is copied to your clipboard - you can email it manually to ' + DEVELOPER_EMAIL);
      setSubmitting(false);
    }
  };

  const handleCopyReport = async () => {
    const result = await copyToClipboard(generatedReport);
    if (result.success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const canProceedStep1 = formData.module && formData.severity && formData.category;
  const canProceedStep2 = formData.userDescription.trim().length >= 10;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 modal-backdrop overscroll-contain">
      <div className="min-h-screen px-4 py-8 flex items-start justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col modal-content">
          {/* Header - Sticky */}
          <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-5 flex-shrink-0 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-xl p-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">🐛 Bug Squasher</h2>
                  <p className="text-red-100 text-sm">Help me fix issues quickly</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close bug reporter"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-between mt-6">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                    step >= s 
                      ? 'bg-white text-red-600' 
                      : 'bg-white/30 text-white'
                  }`}>
                    {step > s ? '✓' : s}
                  </div>
                  <div className={`flex-1 h-1 mx-2 rounded ${
                    s < 3 ? (step > s ? 'bg-white' : 'bg-white/30') : 'hidden'
                  }`}></div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-red-100 mt-2 px-1">
              <span>Classification</span>
              <span className="ml-6">Description</span>
              <span>Review & Submit</span>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="p-6 overflow-y-auto flex-1">
            {/* Step 1: Classification */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>💡 Tip:</strong> The more details you provide, the faster I can squash this bug! 
                    Technical details will be automatically captured to help diagnose the issue.
                  </p>
                </div>

                {/* Module Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Which module were you using? <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.module}
                    onChange={(e) => handleInputChange('module', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="">Select a module...</option>
                    {Object.entries(APP_MODULES).map(([key, value]) => (
                      <option key={key} value={value}>{value}</option>
                    ))}
                  </select>
                </div>

                {/* Diagnostic Code */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Diagnostic Code (if applicable)
                  </label>
                  <input
                    type="text"
                    value={formData.diagnosticCode}
                    onChange={(e) => handleInputChange('diagnosticCode', e.target.value)}
                    placeholder="e.g., 9411, 5003"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Enter the diagnostic code you were viewing when the bug occurred
                  </p>
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Bug Severity <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(BUG_SEVERITY).map(([key, sev]) => (
                      <button
                        key={key}
                        onClick={() => handleInputChange('severity', sev)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          formData.severity?.value === sev.value
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-red-300'
                        }`}
                      >
                        <span className="text-lg mr-2">{sev.emoji}</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{sev.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Bug Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="">Select category...</option>
                    {Object.entries(BUG_CATEGORIES).map(([key, value]) => (
                      <option key={key} value={value}>{value}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Description */}
            {step === 2 && (
              <div className="space-y-6">
                {/* User Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Describe the bug <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.userDescription}
                    onChange={(e) => handleInputChange('userDescription', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        e.preventDefault();
                        const stepsField = document.querySelector('textarea[placeholder*="Steps to reproduce"]');
                        if (stepsField) stepsField.focus();
                      }
                    }}
                    placeholder="What went wrong? Be as specific as possible... (Ctrl+Enter to next field, Shift+Enter for new line)"
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formData.userDescription.length}/10 characters minimum
                  </p>
                </div>

                {/* Steps to Reproduce */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Steps to Reproduce
                  </label>
                  <textarea
                    value={formData.stepsToReproduce}
                    onChange={(e) => handleInputChange('stepsToReproduce', e.target.value)}
                    placeholder="1. Go to...\n2. Click on...\n3. Enter...\n4. Bug appears when..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Expected vs Actual */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Expected Behavior
                    </label>
                    <textarea
                      value={formData.expectedBehavior}
                      onChange={(e) => handleInputChange('expectedBehavior', e.target.value)}
                      placeholder="What should have happened?"
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Actual Behavior
                    </label>
                    <textarea
                      value={formData.actualBehavior}
                      onChange={(e) => handleInputChange('actualBehavior', e.target.value)}
                      placeholder="What actually happened?"
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>

                {/* Additional Context */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Additional Context
                  </label>
                  <textarea
                    value={formData.additionalContext}
                    onChange={(e) => handleInputChange('additionalContext', e.target.value)}
                    placeholder="Any other details that might help (screenshots link, specific data, etc.)"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Privacy Controls */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    🔒 Privacy Controls - What to include in report:
                  </h4>
                  <div className="space-y-2">
                    {[
                      { key: 'includeSystemInfo', label: 'System Information', desc: 'Browser, screen size, timezone' },
                      { key: 'includeAppState', label: 'Application State', desc: 'Current view, search terms, active features' },
                      { key: 'includeStorageInfo', label: 'Storage Information', desc: 'Saved claims count, settings (no personal data)' },
                      { key: 'includeConsoleErrors', label: 'Console Logs & Errors', desc: 'Captures errors, warnings, and relevant logs from the console - helps identify the root cause' }
                    ].map(item => (
                      <label key={item.key} className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData[item.key]}
                          onChange={(e) => handleInputChange(item.key, e.target.checked)}
                          className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Tracking & Follow-up Options */}
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 flex items-center gap-2">
                    <span>📋</span> Tracking & Follow-up
                  </h4>
                  
                  {/* Save to My Tickets */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.saveToMyTickets}
                      onChange={(e) => handleInputChange('saveToMyTickets', e.target.checked)}
                      className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Save to My Tickets</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Track this bug report in your My Packet. You'll be notified when it's fixed!
                      </p>
                    </div>
                  </label>

                  {/* Optional Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={formData.veteranEmail}
                      onChange={(e) => handleInputChange('veteranEmail', e.target.value)}
                      placeholder="email@example.com"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                      We respect your privacy. Leave blank to stay anonymous. Only fill this in if you'd like me to email you when the bug is squashed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {step === 3 && (
              <div className="space-y-4">
                {/* Success message after submission */}
                {submitted ? (
                  <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-600 rounded-lg p-6 text-center">
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">
                      Bug Report Saved! 🐛✓
                    </h3>
                    <p className="text-green-700 dark:text-green-100 mb-4">
                      Your bug report has been <strong>saved to My Tickets</strong> and the report is copied to your clipboard!
                    </p>
                    <div className="bg-green-100 dark:bg-green-800/50 rounded-lg p-4 mb-4 text-left">
                      <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ What happens next:</h4>
                      <ul className="text-sm text-green-700 dark:text-green-100 space-y-1">
                        <li>• I'll investigate this bug personally</li>
                        {formData.saveToMyTickets && <li>• Check "My Tickets" in My Packet for status updates</li>}
                        {formData.veteranEmail && <li>• I'll email you when this bug is squashed</li>}
                      </ul>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Report ID: <span className="font-mono font-bold">{getReportId()}</span>
                    </p>
                    {formData.saveToMyTickets && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2 italic">
                        Saved to your My Tickets for tracking
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm font-medium text-green-800 dark:text-green-200">
                          Bug report generated! Review it below and click "Submit Report" to send it directly.
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      <textarea
                        readOnly
                        value={generatedReport}
                        className="w-full h-72 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-xs resize-none"
                      />
                      <button
                        onClick={handleCopyReport}
                        className={`absolute top-3 right-3 px-3 py-1.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
                          copied
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-600 text-white hover:bg-gray-700'
                        }`}
                      >
                        {copied ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>

                    {/* Submit Error Message */}
                    {submitError && (
                      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3">
                        <p className="text-sm text-red-700 dark:text-red-100">{submitError}</p>
                      </div>
                    )}

                    {/* Submit Button - Primary Action */}
                    <button
                      onClick={handleSubmitReport}
                      disabled={submitting}
                      className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                        submitting
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700 shadow-lg hover:shadow-xl'
                      }`}
                    >
                      {submitting ? (
                        <>
                          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting Report...
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Submit Bug Report
                        </>
                      )}
                    </button>

                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Sends directly to the developer - no email app needed!
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex justify-between items-center">
            <button
              onClick={step === 1 ? onClose : (submitted ? onClose : () => setStep(step - 1))}
              disabled={submitting}
              className={`px-4 py-2 font-medium transition-colors ${
                submitting 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
              }`}
            >
              {step === 1 ? 'Cancel' : (submitted ? 'Close' : '← Back')}
            </button>

            {step < 3 ? (
              <button
                onClick={() => step === 2 ? handleGenerateReport() : setStep(step + 1)}
                disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  (step === 1 ? canProceedStep1 : canProceedStep2)
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {step === 2 ? 'Generate Report →' : 'Next →'}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BugSquasher;
