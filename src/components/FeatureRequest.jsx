/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * 
 * FeatureRequest Component
 * Modal to capture feature ideas and suggestions from veterans
 * Uses the same infrastructure as BugSquasher for reliable storage and notification
 * 
 * Built by a fellow veteran. "Your ideas make us stronger."
 */

import React, { useState, useEffect } from 'react';
import {
  getSystemInfo,
  getAppState,
  copyToClipboard
} from '../utils/bugReportUtils';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { saveFeatureRequest, generateFeatureId, saveFeatureToLocalStorage } from '../utils/featureRequestStorage';

// Developer contact email for feature requests
const DEVELOPER_EMAIL = 'Anth@StructuredForGrowth.com';

// FormSubmit.co endpoint - sends directly to developer's email without opening email client
const FORMSUBMIT_URL = 'https://formsubmit.co/ajax/Anth@StructuredForGrowth.com';

// Feature request categories
const FEATURE_CATEGORIES = {
  NEW_TOOL: 'New Tool/Feature',
  ENHANCEMENT: 'Improvement to Existing Tool',
  UI_UX: 'User Interface/Experience',
  ACCESSIBILITY: 'Accessibility',
  INTEGRATION: 'VA Integration/API',
  MOBILE: 'Mobile Experience',
  DATA: 'Data/Calculations',
  DOCUMENTATION: 'Documentation/Help',
  OTHER: 'Other'
};

// Priority levels
const PRIORITY_LEVELS = {
  CRITICAL: { value: 'critical', label: 'Critical Need', emoji: '🔥', desc: 'Missing feature blocking my claim process' },
  HIGH: { value: 'high', label: 'High Priority', emoji: '⚡', desc: 'Would significantly improve my workflow' },
  MEDIUM: { value: 'medium', label: 'Medium Priority', emoji: '💡', desc: 'Nice to have, would make things easier' },
  LOW: { value: 'low', label: 'Low Priority', emoji: '💭', desc: 'Idea for the future, no rush' }
};

// Modules for context
const APP_MODULES = {
  SEARCH: 'Search / Condition Lookup',
  CAP_SIMULATOR: 'C&P Exam Simulator',
  NEXUS_BUILDER: 'Nexus Letter Builder',
  MY_PACKET: 'My Packet',
  SECONDARY_SCOUT: 'Secondary Scout',
  TACTICAL_CALCULATOR: 'Tactical Calculator',
  CFILE_ANALYZER: 'C-File Analyzer',
  FORMS_HELPER: 'Forms Helper',
  VSO_FINDER: 'VSO Finder',
  GENERAL: 'General / Site-wide',
  OTHER: 'Other'
};

function FeatureRequest({ onClose, appState = {} }) {
  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [generatedReport, setGeneratedReport] = useState('');
  const [featureId, setFeatureId] = useState('');
  const [emailError, setEmailError] = useState('');
  
  // Strict email validation regex
  const isValidEmail = (email) => {
    if (!email || email.trim() === '') return true; // Empty is OK (optional field)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  };
  
  // Form state
  const [formData, setFormData] = useState({
    module: appState.currentModule || 'GENERAL',
    category: '',
    priority: null,
    title: '',
    description: '',
    problemSolved: '',
    proposedSolution: '',
    alternativesConsidered: '',
    additionalContext: '',
    saveToMyTickets: true, // Save to My Packet for tracking
    veteranEmail: '' // Optional email for follow-up
  });

  // Generate feature ID on mount
  useEffect(() => {
    setFeatureId(generateFeatureId());
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Validate email when it changes
    if (field === 'veteranEmail') {
      if (value && value.trim() !== '' && !isValidEmail(value)) {
        setEmailError('Please enter a valid email address (e.g., name@example.com)');
      } else {
        setEmailError('');
      }
    }
  };

  const formatFeatureRequest = () => {
    const systemInfo = getSystemInfo();
    const timestamp = new Date().toISOString();
    
    return `
╔══════════════════════════════════════════════════════════════╗
║              💡 VET-RATE.ORG FEATURE REQUEST                 ║
╠══════════════════════════════════════════════════════════════╣
║  Request ID: ${featureId}
║  Submitted: ${timestamp}
╚══════════════════════════════════════════════════════════════╝

📋 REQUEST DETAILS
───────────────────────────────────────────────────────────────
Title: ${formData.title}
Category: ${formData.category}
Priority: ${formData.priority?.label || 'Not specified'} ${formData.priority?.emoji || ''}
Related Module: ${formData.module}

📝 DESCRIPTION
───────────────────────────────────────────────────────────────
${formData.description}

🎯 PROBLEM THIS WOULD SOLVE
───────────────────────────────────────────────────────────────
${formData.problemSolved || 'Not specified'}

💭 PROPOSED SOLUTION
───────────────────────────────────────────────────────────────
${formData.proposedSolution || 'Not specified'}

🔄 ALTERNATIVES CONSIDERED
───────────────────────────────────────────────────────────────
${formData.alternativesConsidered || 'None mentioned'}

📎 ADDITIONAL CONTEXT
───────────────────────────────────────────────────────────────
${formData.additionalContext || 'None'}

🖥️ SYSTEM INFO
───────────────────────────────────────────────────────────────
Browser: ${systemInfo.browser}
Screen: ${systemInfo.screenResolution}
App Version: ${systemInfo.appVersion}

📎 END OF FEATURE REQUEST
───────────────────────────────────────────────────────────────
Thank you for helping make Vet-Rate.org better for all veterans!
`.trim();
  };

  const handleGenerateReport = () => {
    const report = formatFeatureRequest();
    setGeneratedReport(report);
    setStep(3);
  };

  // Submit feature request via FormSubmit.co API (no email client needed!) and optionally save locally
  const handleSubmitRequest = async () => {
    setSubmitting(true);
    setSubmitError('');
    
    try {
      // === Save to local database if user wants to track ===
      if (formData.saveToMyTickets) {
        try {
          const systemInfo = getSystemInfo();
          
          await saveFeatureRequest({
            request_id: featureId,
            priority: formData.priority?.value || 'medium',
            category: formData.category,
            module: formData.module,
            title: formData.title,
            description: formData.description,
            problemSolved: formData.problemSolved,
            proposedSolution: formData.proposedSolution,
            alternativesConsidered: formData.alternativesConsidered,
            additionalContext: formData.additionalContext,
            veteranEmail: formData.veteranEmail || null,
            systemInfo
          });
          
          console.log(`✅ Feature request ${featureId} saved to My Tickets`);
        } catch (storageError) {
          // Fallback to localStorage if IndexedDB fails
          console.warn('IndexedDB save failed, using localStorage fallback:', storageError);
          saveFeatureToLocalStorage({
            request_id: featureId,
            priority: formData.priority?.value,
            category: formData.category,
            module: formData.module,
            title: formData.title,
            description: formData.description,
            created_at: new Date().toISOString()
          });
        }
      }
      
      // Also copy to clipboard as backup
      await copyToClipboard(generatedReport);
      
      // === Send via FormSubmit.co API (stays in-browser, no email client!) ===
      const priorityLabel = formData.priority?.label || 'Feature';
      
      const formPayload = {
        _subject: `[${featureId}] ${priorityLabel} - ${formData.title}`,
        _template: 'table',
        request_id: featureId,
        title: formData.title,
        category: formData.category,
        priority: priorityLabel,
        module: formData.module,
        description: formData.description,
        problem_solved: formData.problemSolved || 'Not specified',
        proposed_solution: formData.proposedSolution || 'Not specified',
        alternatives: formData.alternativesConsidered || 'None mentioned',
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
        throw new Error(`FormSubmit returned ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Feature request ${featureId} sent successfully via FormSubmit`);
        setSubmitted(true);
        setCopied(true);
      } else {
        throw new Error(result.message || 'FormSubmit submission failed');
      }
      
      setSubmitting(false);
      
    } catch (error) {
      console.error('Submit error:', error);
      setSubmitError('Could not send request. Your request was saved locally. The report is copied to your clipboard - you can email it manually to ' + DEVELOPER_EMAIL);
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

  const canProceedStep1 = formData.category && formData.priority;
  const canProceedStep2 = formData.title.trim().length >= 5 && formData.description.trim().length >= 20 && isValidEmail(formData.veteranEmail);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 modal-backdrop overscroll-contain">
      <div className="min-h-screen px-4 py-8 flex items-start justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col modal-content">
          {/* Header - Sticky */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-5 flex-shrink-0 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-xl p-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">💡 Feature Request</h2>
                  <p className="text-purple-100 text-sm">Share your ideas to make Vet-Rate.org better</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close feature request"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center mt-6">
              {[1, 2, 3].map((s, index) => (
                <div key={s} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0 ${
                    step >= s 
                      ? 'bg-white text-purple-600' 
                      : 'bg-white/30 text-white'
                  }`}>
                    {step > s ? '✓' : s}
                  </div>
                  {index < 2 && (
                    <div className={`flex-1 h-1 mx-2 rounded ${
                      step > s ? 'bg-white' : 'bg-white/30'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex text-xs text-purple-100 mt-2">
              <span className="flex-1 text-center">Category & Priority</span>
              <span className="flex-1 text-center">Your Idea</span>
              <span className="flex-1 text-center">Review & Submit</span>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="p-6 overflow-y-auto flex-1">
            {/* Step 1: Category & Priority */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    <strong>💡 Your ideas matter!</strong> Every feature on Vet-Rate.org came from veteran feedback. 
                    Share your idea and help me build tools that make a difference.
                  </p>
                </div>

                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Feature Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select a category...</option>
                    {Object.entries(FEATURE_CATEGORIES).map(([key, value]) => (
                      <option key={key} value={value}>{value}</option>
                    ))}
                  </select>
                </div>

                {/* Related Module */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Related Module (optional)
                  </label>
                  <select
                    value={formData.module}
                    onChange={(e) => handleInputChange('module', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {Object.entries(APP_MODULES).map(([key, value]) => (
                      <option key={key} value={value}>{value}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    How important is this to you? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(PRIORITY_LEVELS).map(([key, priority]) => (
                      <button
                        key={key}
                        onClick={() => handleInputChange('priority', priority)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          formData.priority?.value === priority.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{priority.emoji}</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{priority.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{priority.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Feature Details */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Feature Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Feature Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Brief title for your feature idea..."
                    maxLength={100}
                    className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      formData.title.trim().length > 0 && formData.title.trim().length < 5
                        ? 'border-red-400 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  <p className={`text-xs mt-1 ${
                    formData.title.trim().length >= 5 
                      ? 'text-green-600 dark:text-green-400' 
                      : formData.title.trim().length > 0 
                        ? 'text-red-500 dark:text-red-400' 
                        : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formData.title.trim().length >= 5 
                      ? `✓ ${formData.title.length}/100 characters` 
                      : `${formData.title.trim().length}/5 minimum characters required`}
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Describe Your Idea <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Explain your feature idea in detail. What would it do? How would it work?"
                    rows={4}
                    className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${
                      formData.description.trim().length > 0 && formData.description.trim().length < 20
                        ? 'border-red-400 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  <p className={`text-xs mt-1 ${
                    formData.description.trim().length >= 20 
                      ? 'text-green-600 dark:text-green-400' 
                      : formData.description.trim().length > 0 
                        ? 'text-red-500 dark:text-red-400' 
                        : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formData.description.trim().length >= 20 
                      ? `✓ ${formData.description.trim().length} characters` 
                      : `${formData.description.trim().length}/20 minimum characters required`}
                  </p>
                </div>

                {/* Problem Solved */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    What problem would this solve?
                  </label>
                  <textarea
                    value={formData.problemSolved}
                    onChange={(e) => handleInputChange('problemSolved', e.target.value)}
                    placeholder="What pain point or challenge would this feature address?"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Proposed Solution */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Your Proposed Solution (optional)
                  </label>
                  <textarea
                    value={formData.proposedSolution}
                    onChange={(e) => handleInputChange('proposedSolution', e.target.value)}
                    placeholder="If you have specific ideas for how this could be implemented..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Alternatives Considered */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Alternatives You've Considered (optional)
                  </label>
                  <textarea
                    value={formData.alternativesConsidered}
                    onChange={(e) => handleInputChange('alternativesConsidered', e.target.value)}
                    placeholder="Have you tried any workarounds? What other solutions have you considered?"
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Additional Context */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Additional Context
                  </label>
                  <textarea
                    value={formData.additionalContext}
                    onChange={(e) => handleInputChange('additionalContext', e.target.value)}
                    placeholder="Any other details, screenshots links, or examples that would help explain your idea?"
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Privacy & Tracking Options */}
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2">
                    <span>🔒</span> Privacy & Tracking Options
                  </h4>
                  
                  {/* Save to My Tickets */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.saveToMyTickets}
                      onChange={(e) => handleInputChange('saveToMyTickets', e.target.checked)}
                      className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Save to My Tickets</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Track this request in your My Packet. You'll be notified when it's implemented!
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
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm ${
                        emailError 
                          ? 'border-red-500 dark:border-red-400' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                    {emailError ? (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                        <span>⚠️</span> {emailError}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                        We respect your privacy. Leave blank to stay anonymous. Only fill this in if you'd like me to email you when the feature is added.
                      </p>
                    )}
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
                      Request Sent Successfully! 🎉
                    </h3>
                    <p className="text-green-700 dark:text-green-100 mb-4">
                      Your feature request has been <strong>sent directly</strong> - no email app needed!
                    </p>
                    <div className="bg-green-100 dark:bg-green-800/50 rounded-lg p-4 mb-4 text-left">
                      <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ What happens next:</h4>
                      <ul className="text-sm text-green-700 dark:text-green-100 space-y-1">
                        <li>• I'll review your idea personally</li>
                        {formData.saveToMyTickets && <li>• Check "My Tickets" in My Packet for status updates</li>}
                        {formData.veteranEmail && <li>• I'll email you when this feature is implemented</li>}
                      </ul>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Request ID: <span className="font-mono font-bold">{featureId}</span>
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
                          Feature request ready! Review it below and click "Submit Request" to send it directly.
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

                    {/* Submit Button */}
                    <button
                      onClick={handleSubmitRequest}
                      disabled={submitting}
                      className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                        submitting
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                      }`}
                    >
                      {submitting ? (
                        <>
                          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting Request...
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Submit Request
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
          <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex justify-between items-center rounded-b-2xl">
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
              <div className="flex flex-col items-end gap-1">
                {step === 2 && !canProceedStep2 && (
                  <p className="text-xs text-red-500 dark:text-red-400">
                    {formData.title.trim().length < 5 && formData.description.trim().length < 20
                      ? '⚠️ Title (5+ chars) and description (20+ chars) required'
                      : formData.title.trim().length < 5
                        ? '⚠️ Title needs at least 5 characters'
                        : formData.description.trim().length < 20
                          ? '⚠️ Description needs at least 20 characters'
                          : emailError
                            ? '⚠️ Fix email format to continue'
                            : ''}
                  </p>
                )}
                <button
                  onClick={() => step === 2 ? handleGenerateReport() : setStep(step + 1)}
                  disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                  className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                    (step === 1 ? canProceedStep1 : canProceedStep2)
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {step === 2 ? 'Generate Request →' : 'Next →'}
                </button>
              </div>
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

export default FeatureRequest;
