/**
 * Vet-Rate.org - Doctor's Packet Generator Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Generates comprehensive research packets to help veterans
 * get nexus letters from their private physicians.
 */

import React, { useState, useEffect } from 'react';
import { 
  generateDoctorsPacket, 
  formatDoctorLetter,
  getNexusLogicPrivacyDisclosure 
} from '../utils/nexusLogicGenerator';

// Icons
const BrainIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const PrintIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const InfoIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const LinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

/**
 * Strength badge colors
 */
const getStrengthColor = (strength) => {
  switch (strength?.toLowerCase()) {
    case 'strong': return 'bg-green-500/20 text-green-300 border-green-500/30';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    case 'weak': return 'bg-red-500/20 text-red-300 border-red-500/30';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  }
};

/**
 * Doctor's Packet Generator Modal/Component
 */
export default function DoctorsPacket({ 
  isOpen, 
  onClose, 
  primaryCondition: initialPrimary = '',
  secondaryCondition: initialSecondary = '',
  existingMechanism = null,
  existingCitations = null
}) {
  // State
  const [step, setStep] = useState('consent'); // consent, input, loading, result, error
  const [primaryCondition, setPrimaryCondition] = useState(initialPrimary);
  const [secondaryCondition, setSecondaryCondition] = useState(initialSecondary);
  const [packetData, setPacketData] = useState(null);
  const [error, setError] = useState(null);
  const [hasConsented, setHasConsented] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [apiKey, setApiKey] = useState('');
  
  // Load API key and set initial values
  useEffect(() => {
    const storedKey = localStorage.getItem('vetrate_gemini_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
    
    // Check for existing consent
    const consent = localStorage.getItem('vetrate_ai_consent');
    if (consent === 'true') {
      setHasConsented(true);
      if (initialPrimary && initialSecondary) {
        setStep('input');
      }
    }
  }, [initialPrimary, initialSecondary]);
  
  // Update conditions when props change
  useEffect(() => {
    if (initialPrimary) setPrimaryCondition(initialPrimary);
    if (initialSecondary) setSecondaryCondition(initialSecondary);
  }, [initialPrimary, initialSecondary]);
  
  // Handle consent
  const handleConsent = () => {
    localStorage.setItem('vetrate_ai_consent', 'true');
    setHasConsented(true);
    setStep('input');
  };
  
  // Save API key
  const handleSaveKey = (key) => {
    localStorage.setItem('vetrate_gemini_key', key);
    setApiKey(key);
  };
  
  // Generate the packet
  const handleGenerate = async () => {
    if (!primaryCondition.trim() || !secondaryCondition.trim()) {
      setError('Please enter both conditions');
      return;
    }
    
    if (!apiKey) {
      setError('Please enter your Gemini API key');
      return;
    }
    
    setStep('loading');
    setError(null);
    
    try {
      const result = await generateDoctorsPacket(apiKey, primaryCondition, secondaryCondition);
      
      if (result.success) {
        setPacketData(result);
        setStep('result');
      } else if (result.noLink) {
        setError(result.error);
        setStep('error');
      } else {
        setError('Failed to generate packet. Please try again.');
        setStep('error');
      }
    } catch (err) {
      setError(err.message);
      setStep('error');
    }
  };
  
  // Download as TXT
  const handleDownloadTxt = () => {
    if (!packetData) return;
    
    const letterText = formatDoctorLetter(packetData.data, primaryCondition, secondaryCondition);
    
    const fullContent = `DOCTOR'S PACKET - MEDICAL NEXUS RESEARCH BRIEF
Generated by Vet-Rate.org
${'='.repeat(60)}

PRIMARY CONDITION: ${primaryCondition}
SECONDARY CONDITION: ${secondaryCondition}
CONNECTION STRENGTH: ${packetData.data.strength?.toUpperCase() || 'UNKNOWN'}

${'='.repeat(60)}
MEDICAL MECHANISM SUMMARY
${'='.repeat(60)}

${packetData.data.mechanism_summary}

${'='.repeat(60)}
KEY PATHOPHYSIOLOGICAL PATHWAYS
${'='.repeat(60)}

${packetData.data.key_pathways?.map((p, i) => `${i + 1}. ${p}`).join('\n\n') || 'None provided'}

${'='.repeat(60)}
SUPPORTING LITERATURE TOPICS
${'='.repeat(60)}

${packetData.data.literature_topics?.map((l, i) => `${i + 1}. ${l}`).join('\n\n') || 'None provided'}

${'='.repeat(60)}
RISK FACTORS
${'='.repeat(60)}

${packetData.data.risk_factors?.map((r, i) => `• ${r}`).join('\n') || 'None provided'}

${'='.repeat(60)}
PHYSICIAN TEMPLATE LETTER
${'='.repeat(60)}

${letterText}

${'='.repeat(60)}
IMPORTANT NOTES
${'='.repeat(60)}

${packetData.data.notes || 'No additional notes.'}

${'='.repeat(60)}
DISCLAIMER
${'='.repeat(60)}

This document is provided for informational purposes only and does not constitute 
medical advice, diagnosis, or treatment. A qualified physician must review this 
information and make their own independent medical determination.

Generated: ${new Date().toLocaleString()}
Vet-Rate.org - Helping Veterans Win Claims`;
    
    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Doctors_Packet_${secondaryCondition.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Print handler
  const handlePrint = () => {
    window.print();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-purple-500/20">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-purple-900/30 to-indigo-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <SparklesIcon />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Doctor's Packet Generator</h2>
              <p className="text-sm text-gray-400">AI-powered medical nexus research</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Step: Consent */}
          {step === 'consent' && (
            <div className="space-y-6">
              <div className="p-4 bg-purple-900/20 rounded-xl border border-purple-500/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg mt-1">
                    <BrainIcon />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">What This Tool Does</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      The Doctor's Packet Generator uses AI to research the <span className="text-purple-300 font-medium">medical mechanism</span> linking 
                      your service-connected condition to a claimed secondary condition. It creates a comprehensive 
                      research brief that you can present to your private physician.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-900/20 rounded-xl border border-green-500/20">
                  <h4 className="font-semibold text-green-300 flex items-center gap-2 mb-3">
                    <CheckIcon /> Includes
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-1">•</span>
                      Medical mechanism explanation
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-1">•</span>
                      Pathophysiological pathways
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-1">•</span>
                      Literature/study references
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-1">•</span>
                      Physician template letter
                    </li>
                  </ul>
                </div>
                
                <div className="p-4 bg-amber-900/20 rounded-xl border border-amber-500/20">
                  <h4 className="font-semibold text-amber-300 flex items-center gap-2 mb-3">
                    <AlertIcon /> Important Notes
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      This is <strong>research</strong>, not a diagnosis
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      Doctor must review and sign
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      Uses your free Gemini API key
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      No personal data is sent
                    </li>
                  </ul>
                </div>
              </div>
              
              <button
                onClick={() => setShowPrivacy(!showPrivacy)}
                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-2"
              >
                <InfoIcon /> {showPrivacy ? 'Hide' : 'View'} Privacy Details
              </button>
              
              {showPrivacy && (
                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-600 text-sm text-gray-300 whitespace-pre-wrap">
                  {getNexusLogicPrivacyDisclosure()}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConsent}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                >
                  <CheckIcon /> I Understand, Continue
                </button>
              </div>
            </div>
          )}
          
          {/* Step: Input */}
          {step === 'input' && (
            <div className="space-y-6">
              {/* API Key */}
              {!apiKey && (
                <div className="p-4 bg-amber-900/20 rounded-xl border border-amber-500/20">
                  <h4 className="font-semibold text-amber-300 mb-3">API Key Required</h4>
                  <p className="text-sm text-gray-300 mb-3">
                    Get your free Gemini API key from{' '}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">
                      Google AI Studio
                    </a>
                  </p>
                  <input
                    type="password"
                    placeholder="Paste your Gemini API key..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    onChange={(e) => handleSaveKey(e.target.value)}
                  />
                </div>
              )}
              
              {apiKey && (
                <div className="p-4 bg-green-900/20 rounded-xl border border-green-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-300">
                    <CheckIcon /> API Key saved
                  </div>
                  <button
                    onClick={() => { localStorage.removeItem('vetrate_gemini_key'); setApiKey(''); }}
                    className="text-xs text-gray-400 hover:text-gray-300"
                  >
                    Change key
                  </button>
                </div>
              )}
              
              {/* Conditions */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Primary Condition (Service-Connected)
                </label>
                <input
                  type="text"
                  value={primaryCondition}
                  onChange={(e) => setPrimaryCondition(e.target.value)}
                  placeholder="e.g., PTSD, Lumbar Strain, Diabetes Type II"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-purple-400">
                  <LinkIcon />
                  <span className="text-sm">causes or aggravates</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Secondary Condition (Claimed)
                </label>
                <input
                  type="text"
                  value={secondaryCondition}
                  onChange={(e) => setSecondaryCondition(e.target.value)}
                  placeholder="e.g., Sleep Apnea, Radiculopathy, Hypertension"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              {error && (
                <div className="p-4 bg-red-900/20 rounded-xl border border-red-500/20 text-red-300 text-sm">
                  {error}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!apiKey || !primaryCondition.trim() || !secondaryCondition.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SparklesIcon /> Generate Doctor's Packet
                </button>
              </div>
            </div>
          )}
          
          {/* Step: Loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-purple-500/20 rounded-full animate-spin">
                  <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-purple-500 rounded-full"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <BrainIcon />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-2">Researching Medical Connection...</h3>
                <p className="text-gray-400 text-sm">
                  Analyzing pathophysiological pathways between<br />
                  <span className="text-purple-300">{primaryCondition}</span> and <span className="text-purple-300">{secondaryCondition}</span>
                </p>
              </div>
            </div>
          )}
          
          {/* Step: Error */}
          {step === 'error' && (
            <div className="space-y-6">
              <div className="p-6 bg-red-900/20 rounded-xl border border-red-500/20 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                  <AlertIcon />
                </div>
                <h3 className="text-xl font-semibold text-red-300 mb-2">No Medical Link Found</h3>
                <p className="text-gray-300 text-sm">{error}</p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => { setError(null); setStep('input'); }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-medium transition-all"
                >
                  Try Different Conditions
                </button>
              </div>
            </div>
          )}
          
          {/* Step: Result */}
          {step === 'result' && packetData && (
            <div className="space-y-6 print:text-black print:bg-white">
              {/* Success Header */}
              <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getStrengthColor(packetData.data.strength)}`}>
                    {packetData.data.strength?.toUpperCase()} LINK
                  </div>
                  <span className="text-gray-400 text-sm">
                    Generated {new Date().toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                  >
                    <PrintIcon /> Print
                  </button>
                  <button
                    onClick={handleDownloadTxt}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                  >
                    <DownloadIcon /> Download TXT
                  </button>
                </div>
              </div>
              
              {/* Conditions Summary */}
              <div className="p-4 bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-xl border border-purple-500/20 print:border-black print:border print:bg-gray-100">
                <div className="flex items-center gap-4 text-center">
                  <div className="flex-1 p-3 bg-gray-800/50 rounded-lg print:bg-gray-200">
                    <div className="text-xs text-gray-400 print:text-gray-600 mb-1">Primary (Service-Connected)</div>
                    <div className="font-semibold text-white print:text-black">{primaryCondition}</div>
                  </div>
                  <div className="text-purple-400 print:text-black">
                    <LinkIcon />
                  </div>
                  <div className="flex-1 p-3 bg-gray-800/50 rounded-lg print:bg-gray-200">
                    <div className="text-xs text-gray-400 print:text-gray-600 mb-1">Secondary (Claimed)</div>
                    <div className="font-semibold text-white print:text-black">{secondaryCondition}</div>
                  </div>
                </div>
              </div>
              
              {/* Mechanism Summary */}
              <div className="p-5 bg-gray-800/50 rounded-xl border border-gray-600 print:bg-gray-100 print:border-black">
                <h3 className="font-semibold text-white print:text-black mb-3 flex items-center gap-2">
                  <BrainIcon /> Medical Mechanism
                </h3>
                <p className="text-gray-300 print:text-black leading-relaxed">
                  {packetData.data.mechanism_summary}
                </p>
              </div>
              
              {/* Key Pathways */}
              {packetData.data.key_pathways?.length > 0 && (
                <div className="p-5 bg-gray-800/50 rounded-xl border border-gray-600 print:bg-gray-100 print:border-black">
                  <h3 className="font-semibold text-white print:text-black mb-3">Pathophysiological Pathways</h3>
                  <ul className="space-y-3">
                    {packetData.data.key_pathways.map((pathway, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-300 print:text-black">
                        <span className="flex-shrink-0 w-6 h-6 bg-purple-500/20 print:bg-gray-200 rounded-full flex items-center justify-center text-purple-300 print:text-black text-sm font-medium">
                          {i + 1}
                        </span>
                        {pathway}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Literature Topics */}
              {packetData.data.literature_topics?.length > 0 && (
                <div className="p-5 bg-gray-800/50 rounded-xl border border-gray-600 print:bg-gray-100 print:border-black">
                  <h3 className="font-semibold text-white print:text-black mb-3">Supporting Medical Literature</h3>
                  <ul className="space-y-2">
                    {packetData.data.literature_topics.map((topic, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300 print:text-black text-sm">
                        <DocumentIcon />
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Risk Factors */}
              {packetData.data.risk_factors?.length > 0 && (
                <div className="p-5 bg-amber-900/20 rounded-xl border border-amber-500/20 print:bg-gray-100 print:border-black">
                  <h3 className="font-semibold text-amber-300 print:text-black mb-3">Relevant Risk Factors</h3>
                  <ul className="space-y-2">
                    {packetData.data.risk_factors.map((factor, i) => (
                      <li key={i} className="text-gray-300 print:text-black text-sm flex items-start gap-2">
                        <span className="text-amber-400 print:text-black">•</span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Doctor's Template */}
              <div className="p-5 bg-green-900/20 rounded-xl border border-green-500/20 print:bg-gray-100 print:border-black">
                <h3 className="font-semibold text-green-300 print:text-black mb-3 flex items-center gap-2">
                  <DocumentIcon /> Physician Template Letter
                </h3>
                <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 print:bg-white print:border-black font-mono text-sm text-gray-200 print:text-black whitespace-pre-wrap">
                  {formatDoctorLetter(packetData.data, primaryCondition, secondaryCondition)}
                </div>
              </div>
              
              {/* Notes */}
              {packetData.data.notes && (
                <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-600 print:bg-gray-100 print:border-black">
                  <h4 className="font-semibold text-white print:text-black mb-2 flex items-center gap-2">
                    <InfoIcon /> Important Notes
                  </h4>
                  <p className="text-gray-300 print:text-black text-sm">{packetData.data.notes}</p>
                </div>
              )}
              
              {/* Disclaimer */}
              <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700 text-xs text-gray-400 print:text-gray-600 print:border-black">
                <strong>Disclaimer:</strong> This document is provided for informational purposes only and does not constitute 
                medical advice, diagnosis, or treatment. A qualified physician must review this information and make their 
                own independent medical determination. Generated by Vet-Rate.org.
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 print:hidden">
                <button
                  onClick={onClose}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => { setPacketData(null); setStep('input'); }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-medium transition-all"
                >
                  Generate Another Packet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
