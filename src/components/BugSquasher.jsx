import React, { useState, useEffect } from 'react';
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

function BugSquasher({ onClose, appState = {} }) {
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
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
    includeConsoleErrors: true
  });

  // Auto-detect current module based on app state
  useEffect(() => {
    if (!formData.module && appState) {
      const detectedModule = detectCurrentModule(appState);
      setFormData(prev => ({ ...prev, module: detectedModule }));
    }
    
    // Auto-fill diagnostic code if viewing a condition
    if (appState.selectedResult?.diagnosticCode && !formData.diagnosticCode) {
      setFormData(prev => ({ 
        ...prev, 
        diagnosticCode: appState.selectedResult.diagnosticCode 
      }));
    }
  }, [appState]);

  const detectCurrentModule = (state) => {
    if (state.showCAPSimulator) return APP_MODULES.CAP_SIMULATOR;
    if (state.showNexusBuilder) return APP_MODULES.NEXUS_BUILDER;
    if (state.showMyPacket) return APP_MODULES.MY_PACKET;
    if (state.showSecondaryScout) return APP_MODULES.SECONDARY_SCOUT;
    if (state.showSecondaryScoutLauncher) return APP_MODULES.SECONDARY_SCOUT_LAUNCHER;
    if (state.showVAResources) return APP_MODULES.VA_RESOURCES;
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
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] overflow-y-auto">
      <div className="min-h-screen px-4 py-8 flex items-start justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-xl p-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">🐛 Bug Squasher</h2>
                  <p className="text-red-100 text-sm">Help us fix issues quickly</p>
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
              <span>Review & Copy</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Step 1: Classification */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>💡 Tip:</strong> The more details you provide, the faster we can squash this bug! 
                    We'll automatically capture technical details to help diagnose the issue.
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
                    placeholder="What went wrong? Be as specific as possible..."
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
                      { key: 'includeConsoleErrors', label: 'Console Errors', desc: 'Technical error messages if any' }
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
              </div>
            )}

            {/* Step 3: Review & Copy */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      Bug report generated! Copy it below and send to the development team.
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    readOnly
                    value={generatedReport}
                    className="w-full h-96 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-xs resize-none"
                  />
                  <button
                    onClick={handleCopyReport}
                    className={`absolute top-3 right-3 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {copied ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy Report
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
                    📋 How to Submit This Bug Report:
                  </h4>
                  <ol className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-decimal list-inside">
                    <li>Click "Copy Report" above</li>
                    <li>Paste the report into your preferred communication channel</li>
                    <li>The development team will use this detailed info to investigate and fix the issue</li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex justify-between items-center">
            <button
              onClick={step === 1 ? onClose : () => setStep(step - 1)}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 font-medium transition-colors"
            >
              {step === 1 ? 'Cancel' : '← Back'}
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
