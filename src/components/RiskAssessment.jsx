/**
 * Vet-Rate.org - Poke the Bear Calculator (Risk Assessment)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "Risk Assessment" - The single most important DEFENSIVE tool
 * Prevents veterans from losing their ratings by filing unnecessary claims
 * 
 * Key Protection Rules:
 * - 5-Year Rule: Rating not stabilized - high risk of reduction
 * - 20-Year Rule: Rating protected by law (38 CFR 3.951)
 * - 100% P&T: Filing can trigger review of ALL conditions
 * - 55+ Age: VA generally exempts from future exams
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { generateAI, isAnyAIAvailable, getAIStatus, AI_MODES } from '../utils/unifiedAIService';
import { AIStatusBadge, AIModeSelector } from './AIModeSelector';
import { getMyRatings } from '../utils/veteranProfile';
import ReportBugLink from './ReportBugLink';

/**
 * VA Protection Rules per 38 CFR
 */
const PROTECTION_RULES = {
  // 38 CFR 3.344 - Stabilization of disability evaluations
  FIVE_YEAR: {
    id: 'five_year',
    name: '5-Year Rule',
    cfr: '38 CFR § 3.344(c)',
    description: 'Ratings in effect for 5+ years cannot be reduced unless sustained improvement is shown under ordinary conditions of life.',
    yearsRequired: 5
  },
  // 38 CFR 3.951 - Preservation of disability ratings
  TEN_YEAR: {
    id: 'ten_year',
    name: '10-Year Rule',
    cfr: '38 CFR § 3.957',
    description: 'Service connection cannot be severed after 10 years unless fraud is proven.',
    yearsRequired: 10
  },
  // 38 CFR 3.951(b)
  TWENTY_YEAR: {
    id: 'twenty_year',
    name: '20-Year Rule',
    cfr: '38 CFR § 3.951(b)',
    description: 'Ratings in effect for 20+ years are protected from reduction to any lower level.',
    yearsRequired: 20
  },
  // Age 55+ exam exemption
  AGE_55: {
    id: 'age_55',
    name: '55+ Age Protection',
    cfr: 'VA Policy',
    description: 'Veterans 55 and older are generally exempt from routine future examinations.',
    ageRequired: 55
  },
  // 100% P&T
  PERMANENT_TOTAL: {
    id: 'pt',
    name: 'Permanent & Total (P&T)',
    cfr: '38 CFR § 3.340',
    description: 'P&T status indicates no future exams scheduled. Filing new claims can potentially trigger review.'
  }
};

/**
 * Risk Levels
 */
const RISK_LEVELS = {
  CRITICAL: {
    level: 'CRITICAL',
    color: 'red',
    bgClass: 'from-red-600 to-red-700',
    textClass: 'text-red-700 dark:text-red-300',
    borderClass: 'border-red-500',
    bgLightClass: 'bg-red-50 dark:bg-red-900/30',
    icon: '🚨',
    recommendation: 'DO NOT FILE unless absolutely necessary'
  },
  HIGH: {
    level: 'HIGH',
    color: 'orange',
    bgClass: 'from-orange-500 to-red-500',
    textClass: 'text-orange-700 dark:text-orange-300',
    borderClass: 'border-orange-500',
    bgLightClass: 'bg-orange-50 dark:bg-orange-900/30',
    icon: '⚠️',
    recommendation: 'Proceed with caution - consult a VSO first'
  },
  MODERATE: {
    level: 'MODERATE',
    color: 'yellow',
    bgClass: 'from-yellow-500 to-orange-500',
    textClass: 'text-yellow-700 dark:text-yellow-300',
    borderClass: 'border-yellow-500',
    bgLightClass: 'bg-yellow-50 dark:bg-yellow-900/30',
    icon: '⚡',
    recommendation: 'Some risk exists - document everything thoroughly'
  },
  LOW: {
    level: 'LOW',
    color: 'green',
    bgClass: 'from-green-500 to-emerald-500',
    textClass: 'text-green-700 dark:text-green-300',
    borderClass: 'border-green-500',
    bgLightClass: 'bg-green-50 dark:bg-green-900/30',
    icon: '✅',
    recommendation: 'Lower risk - proceed with standard preparation'
  },
  SAFE: {
    level: 'PROTECTED',
    color: 'blue',
    bgClass: 'from-blue-500 to-indigo-500',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-500',
    bgLightClass: 'bg-blue-50 dark:bg-blue-900/30',
    icon: '🛡️',
    recommendation: 'You have legal protections - filing is relatively safe'
  }
};

/**
 * Calculate years from a date
 */
const calculateYearsFromDate = (dateString) => {
  if (!dateString) return 0;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now - date;
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
  return Math.floor(diffYears * 10) / 10; // Round to 1 decimal
};

/**
 * Calculate age from birth year
 */
const calculateAge = (birthYear) => {
  if (!birthYear) return 0;
  const currentYear = new Date().getFullYear();
  return currentYear - birthYear;
};

export default function RiskAssessment({ onClose, onReportBug }) {
  // Lock body scroll when modal is open
  useBodyScrollLock(true);
  
  // Input state
  const [currentRating, setCurrentRating] = useState('');
  const [ratingDate, setRatingDate] = useState('');
  const [isPermanentTotal, setIsPermanentTotal] = useState(false);
  const [birthYear, setBirthYear] = useState('');
  const [proposedClaim, setProposedClaim] = useState('');
  const [currentConditions, setCurrentConditions] = useState('');
  
  // Result state
  const [showResults, setShowResults] = useState(false);
  
  // AI state
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  const [aiAnalysis, setAIAnalysis] = useState(null);
  const [isAnalyzingWithAI, setIsAnalyzingWithAI] = useState(false);
  const [aiError, setAIError] = useState(null);
  
  // My Packet integration - load saved rated conditions
  const [savedRatings, setSavedRatings] = useState([]);
  const [usePacketRatings, setUsePacketRatings] = useState(false);
  
  // Load saved ratings from My Packet on mount
  useEffect(() => {
    const ratings = getMyRatings();
    setSavedRatings(ratings || []);
    // Auto-populate current conditions if available
    if (ratings && ratings.length > 0 && !currentConditions) {
      const conditionsList = ratings.map(r => `${r.name || r.bodyPart} ${r.rating}%`).join(', ');
      setCurrentConditions(conditionsList);
    }
  }, []);
  
  // Monitor AI status changes
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  /**
   * Calculate risk assessment based on inputs
   */
  const riskAssessment = useMemo(() => {
    const yearsRated = calculateYearsFromDate(ratingDate);
    const age = calculateAge(parseInt(birthYear));
    const rating = parseInt(currentRating) || 0;
    
    const protections = [];
    const warnings = [];
    const factors = [];
    let riskLevel = RISK_LEVELS.LOW;
    let financialGain = 0;
    
    // Calculate potential financial gain (rough estimate)
    // If at 100%, there's essentially no gain from additional ratings
    if (rating >= 100) {
      financialGain = 0;
      factors.push({
        type: 'info',
        text: 'You are already at 100%. Additional claims provide $0 in additional monthly compensation.'
      });
    } else {
      // Very rough estimate - actual depends on dependents
      const baseRates = { 90: 2241, 80: 1995, 70: 1716, 60: 1361, 50: 1075, 40: 773, 30: 524, 20: 338, 10: 175 };
      const currentPay = baseRates[rating] || 0;
      const nextPay = baseRates[Math.min(100, rating + 10)] || 0;
      financialGain = nextPay - currentPay;
    }
    
    // Rule 1: P&T Check (HIGHEST PRIORITY)
    if (isPermanentTotal) {
      warnings.push({
        severity: 'critical',
        rule: PROTECTION_RULES.PERMANENT_TOTAL,
        message: `You are Permanent & Total (P&T). Filing new claims can trigger a REVIEW OF ALL YOUR CONDITIONS. Unless you have a severe new condition, the risk far outweighs any potential benefit.`,
        action: 'Only file if you have a new serious condition that significantly impacts your quality of life.'
      });
      riskLevel = RISK_LEVELS.CRITICAL;
      
      if (rating >= 100) {
        factors.push({
          type: 'critical',
          text: `Financial gain: $0/month. Risk: Total loss of P&T status and potential reduction in ratings.`
        });
      }
    }
    
    // Rule 2: 20-Year Rule (Full Protection)
    if (yearsRated >= 20) {
      protections.push({
        rule: PROTECTION_RULES.TWENTY_YEAR,
        message: `Your rating has been in effect for ${yearsRated.toFixed(1)} years. Under 38 CFR § 3.951(b), your rating CANNOT be reduced to any lower level.`,
        status: 'PROTECTED'
      });
      
      // If not P&T, 20-year protection makes filing safer
      if (!isPermanentTotal) {
        riskLevel = RISK_LEVELS.SAFE;
      }
    }
    // Rule 3: 10-Year Rule (Service Connection Protected)
    else if (yearsRated >= 10) {
      protections.push({
        rule: PROTECTION_RULES.TEN_YEAR,
        message: `Your service connection has been in effect for ${yearsRated.toFixed(1)} years. Under 38 CFR § 3.957, service connection cannot be severed unless fraud is proven.`,
        status: 'PROTECTED'
      });
      
      if (!isPermanentTotal) {
        riskLevel = yearsRated >= 5 ? RISK_LEVELS.MODERATE : RISK_LEVELS.HIGH;
      }
      
      factors.push({
        type: 'info',
        text: 'Your service connection is protected, but the rating percentage can still be reduced.'
      });
    }
    // Rule 4: 5-Year Rule
    else if (yearsRated >= 5) {
      protections.push({
        rule: PROTECTION_RULES.FIVE_YEAR,
        message: `Your rating has been in effect for ${yearsRated.toFixed(1)} years. Under 38 CFR § 3.344(c), reduction requires sustained improvement shown under ordinary conditions of life.`,
        status: 'PARTIAL'
      });
      
      if (!isPermanentTotal) {
        riskLevel = RISK_LEVELS.MODERATE;
      }
    }
    // Under 5 years - highest reduction risk
    else {
      warnings.push({
        severity: 'high',
        rule: PROTECTION_RULES.FIVE_YEAR,
        message: `Your rating has only been in effect for ${yearsRated.toFixed(1)} years. Ratings under 5 years are NOT stabilized and can be reduced with a single C&P exam showing improvement.`,
        action: `Wait ${(5 - yearsRated).toFixed(1)} more years for 5-year protection if possible.`
      });
      
      if (!isPermanentTotal) {
        riskLevel = RISK_LEVELS.HIGH;
      }
    }
    
    // Rule 5: Age 55+ Protection
    if (age >= 55) {
      protections.push({
        rule: PROTECTION_RULES.AGE_55,
        message: `At ${age} years old, you are generally exempt from routine future examinations under VA policy.`,
        status: 'PROTECTED'
      });
      
      // Age 55+ reduces risk somewhat
      if (riskLevel === RISK_LEVELS.HIGH && !isPermanentTotal) {
        riskLevel = RISK_LEVELS.MODERATE;
      }
    } else if (age > 0 && age < 55) {
      factors.push({
        type: 'info',
        text: `At ${age} years old, you are ${55 - age} years from age-based exam exemption.`
      });
    }
    
    // High rating specific warnings
    if (rating >= 70 && !isPermanentTotal && yearsRated < 5) {
      warnings.push({
        severity: 'high',
        rule: null,
        message: `Your ${rating}% rating is significant but not stabilized. Filing a new claim triggers a review that could result in reduction.`,
        action: 'Ensure any new claim is well-documented with strong medical evidence.'
      });
    }
    
    // TDIU warning
    if (rating >= 70 && rating < 100) {
      factors.push({
        type: 'tip',
        text: 'If you cannot work due to your disabilities, consider TDIU (Total Disability Individual Unemployability) instead of filing for more conditions.'
      });
    }
    
    return {
      riskLevel,
      protections,
      warnings,
      factors,
      financialGain,
      yearsRated,
      age,
      rating
    };
  }, [currentRating, ratingDate, isPermanentTotal, birthYear]);
  
  /**
   * Generate AI risk analysis
   */
  const generateAIRiskAnalysis = async () => {
    if (!isAnyAIAvailable()) {
      setAIError('AI is not available. Please configure your API key in settings.');
      return;
    }
    
    setIsAnalyzingWithAI(true);
    setAIError(null);
    
    const prompt = `You are a VA disability claims expert analyzing the risk of a veteran filing a new claim. Analyze this situation and provide strategic advice.

VETERAN'S SITUATION:
- Current Combined Rating: ${currentRating}%
- Rating Effective Date: ${ratingDate}
- Years Rated: ${riskAssessment.yearsRated.toFixed(1)} years
- Permanent & Total (P&T): ${isPermanentTotal ? 'Yes' : 'No'}
- Age: ${riskAssessment.age || 'Not provided'}
- Current Rated Conditions: ${currentConditions || 'Not specified'}
- Proposed New Claim: ${proposedClaim || 'Not specified'}

LEGAL PROTECTIONS IDENTIFIED:
${riskAssessment.protections.map(p => `- ${p.rule.name}: ${p.message}`).join('\n') || 'None identified'}

WARNINGS:
${riskAssessment.warnings.map(w => `- ${w.severity}: ${w.message}`).join('\n') || 'None'}

RULES TO CONSIDER:
- 5-Year Rule (38 CFR § 3.344(c)): Ratings under 5 years not stabilized
- 10-Year Rule (38 CFR § 3.957): Service connection protected after 10 years
- 20-Year Rule (38 CFR § 3.951(b)): Ratings cannot be reduced after 20 years
- P&T: Filing can trigger review of ALL conditions
- 55+ Age: Generally exempt from routine exams

Please provide:
1. A risk summary (2-3 sentences)
2. Specific strategic recommendations (3-5 bullet points)
3. If a new claim is proposed, potential secondary conditions or angles to strengthen it
4. Any timing considerations (should they wait?)

Respond in this JSON format:
{
  "riskSummary": "Your summary here",
  "recommendations": ["Rec 1", "Rec 2", "Rec 3"],
  "strengthenClaim": ["Angle 1", "Angle 2"],
  "timingAdvice": "Advice about timing",
  "overallVerdict": "PROCEED" | "CAUTION" | "WAIT" | "DO NOT FILE"
}`;

    try {
      const response = await generateAI(prompt, {
        temperature: 0.4,
        maxTokens: 1024,
        expectJSON: true
      });
      
      // generateAI returns { text, mode } object - extract the text content
      const aiText = response?.text || response;
      const textStr = typeof aiText === 'string' ? aiText : JSON.stringify(aiText);
      
      // Extract JSON from response
      const jsonMatch = textStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        setAIAnalysis(analysis);
      } else {
        throw new Error('Could not parse AI response');
      }
    } catch (err) {
      console.error('AI analysis error:', err);
      setAIError('Failed to generate AI analysis. Please try again.');
    } finally {
      setIsAnalyzingWithAI(false);
    }
  };
  
  /**
   * Handle form submission
   */
  const handleAnalyze = () => {
    if (!currentRating || !ratingDate) {
      return;
    }
    setShowResults(true);
    setAIAnalysis(null); // Reset AI analysis for new assessment
  };
  
  /**
   * Reset form
   */
  const handleReset = () => {
    setCurrentRating('');
    setRatingDate('');
    setIsPermanentTotal(false);
    setBirthYear('');
    setProposedClaim('');
    setCurrentConditions('');
    setShowResults(false);
    setAIAnalysis(null);
    setAIError(null);
  };
  
  /**
   * Render the risk meter visualization
   */
  const renderRiskMeter = () => {
    const { riskLevel } = riskAssessment;
    
    // Calculate meter position (0-100)
    const positions = {
      'PROTECTED': 10,
      'LOW': 30,
      'MODERATE': 50,
      'HIGH': 70,
      'CRITICAL': 90
    };
    const position = positions[riskLevel.level] || 50;
    
    return (
      <div className="relative pt-8 pb-4">
        {/* Meter Background */}
        <div className="h-8 rounded-full bg-gradient-to-r from-blue-500 via-green-500 via-yellow-500 via-orange-500 to-red-600 relative overflow-hidden">
          {/* Segments */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 border-r border-white/30"></div>
            <div className="flex-1 border-r border-white/30"></div>
            <div className="flex-1 border-r border-white/30"></div>
            <div className="flex-1 border-r border-white/30"></div>
            <div className="flex-1"></div>
          </div>
        </div>
        
        {/* Needle/Indicator */}
        <div 
          className="absolute top-4 w-1 h-12 bg-gray-800 dark:bg-white rounded-full shadow-lg transition-all duration-500"
          style={{ left: `calc(${position}% - 2px)` }}
        >
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
            <span className="text-2xl">{riskLevel.icon}</span>
          </div>
        </div>
        
        {/* Labels */}
        <div className="flex justify-between mt-2 text-xs text-gray-600 dark:text-gray-400">
          <span>Protected</span>
          <span>Low</span>
          <span>Moderate</span>
          <span>High</span>
          <span>Critical</span>
        </div>
      </div>
    );
  };
  
  /**
   * Render input form
   */
  const renderInputForm = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Warning Banner */}
      <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-r-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🐻</span>
          <div>
            <h3 className="font-bold text-red-800 dark:text-red-200">Don't Poke the Bear!</h3>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">
              <strong>Predatory "consultants"</strong> push veterans at 90% to file frivolous claims for 10%, 
              triggering re-evaluations that can <strong>DROP their rating to 70% or lower</strong>. 
              This tool helps you understand the REAL risks before filing.
            </p>
          </div>
        </div>
      </div>
      
      {/* Current Rating */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          📊 Your Current VA Rating
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Combined Rating Percentage *
            </label>
            <select
              value={currentRating}
              onChange={(e) => setCurrentRating(e.target.value)}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 outline-none"
            >
              <option value="">Select rating...</option>
              {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map(r => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date Rating Awarded *
            </label>
            <input
              type="date"
              value={ratingDate}
              onChange={(e) => setRatingDate(e.target.value)}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 outline-none"
            />
          </div>
        </div>
        
        {/* P&T Status */}
        <div className="mt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
              isPermanentTotal
                ? 'bg-orange-600 border-orange-600 text-white'
                : 'border-gray-300 dark:border-gray-600'
            }`}>
              {isPermanentTotal && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <span className="font-medium text-gray-800 dark:text-gray-100">I am Permanent & Total (P&T)</span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Check your Rating Decision letter for "Total and Permanent" or "No future exams scheduled"
              </p>
            </div>
          </label>
          <button
            onClick={() => setIsPermanentTotal(!isPermanentTotal)}
            className="sr-only"
          >
            Toggle P&T status
          </button>
        </div>
      </div>
      
      {/* Optional Information */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          📋 Additional Information (Optional)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Birth Year
            </label>
            <input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="e.g., 1975"
              min="1940"
              max="2010"
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 outline-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              For 55+ age protection check
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Proposed New Claim
            </label>
            <input
              type="text"
              value={proposedClaim}
              onChange={(e) => setProposedClaim(e.target.value)}
              placeholder="e.g., Toe Pain, Tinnitus"
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 outline-none"
            />
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Service-Connected Conditions
          </label>
          <textarea
            value={currentConditions}
            onChange={(e) => setCurrentConditions(e.target.value)}
            placeholder="List your current rated conditions (e.g., PTSD 70%, Lower Back 20%, Tinnitus 10%)"
            rows={3}
            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 outline-none resize-none"
          />
        </div>
      </div>
      
      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={!currentRating || !ratingDate}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
      >
        <span>🎯</span>
        <span>Analyze My Risk</span>
      </button>
    </div>
  );
  
  /**
   * Render results
   */
  const renderResults = () => {
    const { riskLevel, protections, warnings, factors, financialGain, yearsRated, rating } = riskAssessment;
    
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Risk Level Card */}
        <div className={`bg-gradient-to-r ${riskLevel.bgClass} rounded-xl p-6 text-white shadow-lg`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{riskLevel.icon}</span>
              <div>
                <p className="text-sm opacity-80">Risk Assessment</p>
                <h2 className="text-3xl font-bold">{riskLevel.level}</h2>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">Potential Monthly Gain</p>
              <p className="text-2xl font-bold">${financialGain}</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-lg font-medium">{riskLevel.recommendation}</p>
          </div>
        </div>
        
        {/* Risk Meter */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Risk Meter</h3>
          {renderRiskMeter()}
        </div>
        
        {/* Critical Warnings */}
        {warnings.filter(w => w.severity === 'critical').map((warning, i) => (
          <div key={i} className="bg-red-50 dark:bg-red-900/30 border-2 border-red-500 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🚨</span>
              <div>
                <h3 className="text-lg font-bold text-red-800 dark:text-red-200">
                  {warning.rule?.name || 'CRITICAL WARNING'}
                </h3>
                {warning.rule?.cfr && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-2">{warning.rule.cfr}</p>
                )}
                <p className="text-red-700 dark:text-red-300">{warning.message}</p>
                {warning.action && (
                  <p className="mt-2 text-red-800 dark:text-red-200 font-medium">
                    ➜ {warning.action}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* High Warnings */}
        {warnings.filter(w => w.severity === 'high').map((warning, i) => (
          <div key={i} className="bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-500 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="text-lg font-bold text-orange-800 dark:text-orange-200">
                  {warning.rule?.name || 'HIGH RISK'}
                </h3>
                {warning.rule?.cfr && (
                  <p className="text-sm text-orange-600 dark:text-orange-400 mb-2">{warning.rule.cfr}</p>
                )}
                <p className="text-orange-700 dark:text-orange-300">{warning.message}</p>
                {warning.action && (
                  <p className="mt-2 text-orange-800 dark:text-orange-200 font-medium">
                    ➜ {warning.action}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Protections */}
        {protections.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-700">
              <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                🛡️ Your Protections
              </h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {protections.map((protection, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className={`px-2 py-1 text-xs font-bold rounded ${
                      protection.status === 'PROTECTED' 
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                    }`}>
                      {protection.status}
                    </span>
                    <div>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100">
                        {protection.rule.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{protection.rule.cfr}</p>
                      <p className="text-gray-600 dark:text-gray-300 mt-1">{protection.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Additional Factors */}
        {factors.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
              📌 Additional Considerations
            </h3>
            <div className="space-y-3">
              {factors.map((factor, i) => (
                <div 
                  key={i} 
                  className={`p-3 rounded-lg ${
                    factor.type === 'critical' 
                      ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : factor.type === 'tip'
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <p>{factor.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Summary Card */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">📊 Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Rating</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{rating}%</p>
            </div>
            <div className="bg-white dark:bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Years Rated</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{yearsRated.toFixed(1)}</p>
            </div>
            <div className="bg-white dark:bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">P&T Status</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{isPermanentTotal ? 'Yes' : 'No'}</p>
            </div>
            <div className="bg-white dark:bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Potential Gain</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">${financialGain}/mo</p>
            </div>
          </div>
        </div>
        
        {/* AI Strategic Analysis */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-purple-800 dark:text-purple-200 flex items-center gap-2">
              🤖 AI Strategic Analysis
            </h3>
            {!aiAnalysis && !isAnalyzingWithAI && aiStatus?.available && (
              <button
                onClick={generateAIRiskAnalysis}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                ✨ Get AI Analysis
              </button>
            )}
          </div>
          
          {!aiStatus?.available && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              <p>Configure AI in settings to get strategic analysis</p>
            </div>
          )}
          
          {isAnalyzingWithAI && (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full"></div>
              <span className="text-purple-600 dark:text-purple-400 font-medium">Analyzing risk factors...</span>
            </div>
          )}
          
          {aiError && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-300 text-sm">{aiError}</p>
              <button
                onClick={generateAIRiskAnalysis}
                className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Try again
              </button>
            </div>
          )}
          
          {aiAnalysis && (
            <div className="space-y-4">
              {/* Overall Verdict */}
              <div className={`p-4 rounded-lg ${
                aiAnalysis.overallVerdict?.toLowerCase().includes('proceed') 
                  ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                  : aiAnalysis.overallVerdict?.toLowerCase().includes('caution')
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700'
                  : 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
              }`}>
                <p className="font-bold text-lg">{aiAnalysis.overallVerdict}</p>
              </div>
              
              {/* Risk Summary */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">📋 Risk Assessment</h4>
                <p className="text-gray-600 dark:text-gray-300">{aiAnalysis.riskSummary}</p>
              </div>
              
              {/* Recommendations */}
              {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">💡 Recommendations</h4>
                  <ul className="space-y-2">
                    {aiAnalysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                        <span className="text-purple-500 mt-1">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Strengthen Your Claim */}
              {aiAnalysis.strengthenClaim && aiAnalysis.strengthenClaim.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">💪 Strengthen Your Case</h4>
                  <ul className="space-y-2">
                    {aiAnalysis.strengthenClaim.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                        <span className="text-green-500 mt-1">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Timing Advice */}
              {aiAnalysis.timingAdvice && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">⏰ Timing Considerations</h4>
                  <p className="text-gray-600 dark:text-gray-300">{aiAnalysis.timingAdvice}</p>
                </div>
              )}
              
              {/* Regenerate Button */}
              <div className="text-center pt-2">
                <button
                  onClick={generateAIRiskAnalysis}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                  🔄 Regenerate Analysis
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Final Warning for P&T with 100% */}
        {isPermanentTotal && rating >= 100 && (
          <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-6 text-white">
            <div className="flex items-start gap-4">
              <span className="text-4xl">⛔</span>
              <div>
                <h3 className="text-xl font-bold mb-2">STRONG RECOMMENDATION: DO NOT FILE</h3>
                <p className="text-red-100">
                  You are at 100% Permanent & Total. Filing for "{proposedClaim || 'a new condition'}" 
                  provides <strong>$0 in additional monthly compensation</strong> but risks triggering 
                  a review of ALL your conditions. The financial gain is zero, but the risk is total.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            🔄 Start Over
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            🖨️ Print Results
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col relative modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-orange-600 to-red-600 p-4 shadow-lg rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🐻</span>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Poke the Bear Calculator
                  <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded">AI</span>
                  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">BETA</span>
                </h2>
                <p className="text-sm text-orange-100">Risk Assessment Before Filing</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
              {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Risk Assessment (Poke the Bear)" />}
              <button
                onClick={onClose}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* Educational Banner */}
          {!showResults && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📚</span>
                <div>
                  <h3 className="font-bold text-amber-800 dark:text-amber-200">Know Your Rights</h3>
                  <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                    VA ratings have legal protections under <strong>38 CFR</strong>. The longer your rating has been 
                    in effect, the harder it is to reduce. This tool checks your protection status before you file.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* AI Required Warning */}
          {!isAnyAIAvailable() && !showResults && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <h3 className="font-bold text-amber-800 dark:text-amber-200">AI Required for Analysis</h3>
                  <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                    Click the <strong>AI Status button</strong> in the header above to load your secure Local AI 
                    (100% private) or enter your Gemini API key.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* My Packet Integration */}
          {savedRatings.length > 0 && !showResults && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📦</span>
                <div className="flex-1">
                  <h3 className="font-bold text-blue-800 dark:text-blue-200">Loaded from My Packet</h3>
                  <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                    Found {savedRatings.length} saved ratings. Your conditions have been auto-populated below.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {savedRatings.slice(0, 5).map((r, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs rounded">
                        {r.name || r.bodyPart} {r.rating}%
                      </span>
                    ))}
                    {savedRatings.length > 5 && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs rounded">
                        +{savedRatings.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
            
          {/* Content */}
          {showResults ? renderResults() : renderInputForm()}
        </div>
      </div>
    </div>
  );
}
