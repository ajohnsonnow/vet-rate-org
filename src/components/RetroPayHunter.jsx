/**
 * Vet-Rate.org - Retroactive Pay Hunter
 * "The Time Machine: Found Money Edition"
 * 
 * This tool analyzes a veteran's rating history to find potential underpayments.
 * Nothing is more exciting than "The VA owes you money."
 * 
 * Features:
 * - Compare historical ratings against correct pay tables
 * - Detect missing bilateral factor application
 * - Identify potential Clear and Unmistakable Errors (CUE)
 * - Calculate total missed compensation
 * - AI-powered analysis for action recommendations
 */

import React, { useState, useEffect, useCallback } from 'react';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import ToolCardButton from './ToolCardButton';
import { getMyRatings } from '../utils/veteranProfile';
import { generateAI } from '../utils/unifiedAIService';
import { isAIAvailable } from '../utils/aiStatementHelper';
import { getAIStatus, AI_MODES } from '../utils/unifiedAIService';
import { AIStatusBadge } from './AIModeSelector';
import { LLMRecommendationBadge } from './LLMRecommendation';
import {
  VA_PAY_RATES_HISTORICAL,
  getHistoricalRate,
  analyzeRetroactivePay,
  checkBilateralFactorCompliance,
  CUE_PATTERNS,
} from '../data/vaPayRatesHistorical';

const STORAGE_KEY = 'vet_rate_retro_pay_history';

const RetroPayHunter = ({ onClose, onReportBug, onAISettingsClick }) => {
  useBodyScrollLock(true);
  
  // Rating history state
  const [ratingHistory, setRatingHistory] = useState([]);
  const [newEntry, setNewEntry] = useState({
    effectiveDate: '',
    rating: 30,
    married: false,
    childrenUnder18: 0,
    childrenSchool: 0,
    dependentParents: 0,
  });
  
  // Analysis state
  const [analysis, setAnalysis] = useState(null);
  const [cueAlerts, setCueAlerts] = useState([]);
  const [showCuePatterns, setShowCuePatterns] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Conditions for bilateral check
  const [conditions, setConditions] = useState([]);
  const [bilateralCheck, setBilateralCheck] = useState(null);
  
  // AI Analysis state
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiAnalysis, setAIAnalysis] = useState('');
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  
  // Monitor AI status changes
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load saved history
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setRatingHistory(data.history || []);
        setConditions(data.conditions || []);
      } catch (e) {
        console.error('Failed to load retro pay history:', e);
      }
    }
    
    // Load conditions from My Ratings
    loadConditionsFromMyRatings();
  }, []);
  
  // Load conditions from My Ratings
  const loadConditionsFromMyRatings = () => {
    try {
      const myRatings = getMyRatings();
      if (myRatings && myRatings.length > 0) {
        const conditionsList = myRatings.map(r => ({
          name: r.name,
          bodyPart: r.bodyPart || 'other',
          side: r.side || 'none',
          rating: r.rating || 0,
          effectiveDate: r.effectiveDate
        }));
        setConditions(conditionsList);
      }
    } catch (e) {
      console.error('Failed to load My Ratings:', e);
    }
  };
  
  // AI Analysis Handler
  const handleAIAnalysis = async () => {
    if (!analysis || !isAIAvailable()) return;
    
    setIsAIThinking(true);
    setAIAnalysis('');
    
    try {
      const prompt = `You are a VA benefits expert analyzing retroactive payment findings for a veteran.

**Analysis Summary:**
- Total Months Analyzed: ${analysis.totalMonths}
- Total Should Have Been Paid: $${calculateTotals().total.toLocaleString()}
- Number of Rating Periods: ${ratingHistory.length}

**Rating History:**
${ratingHistory.map(p => `• ${new Date(p.effectiveDate).toLocaleDateString()}: ${p.rating}% ${p.dependents?.married ? 'with spouse' : ''} ${p.dependents?.childrenUnder18 ? `${p.dependents.childrenUnder18} children` : ''}`).join('\n')}

${bilateralCheck?.applicable ? `\n**Bilateral Factor Issue Detected:**\nPaired body parts: ${bilateralCheck.pairedParts.join(', ')}\nThe 10% bilateral factor may not have been applied correctly.` : ''}

${cueAlerts.length > 0 ? `\n**Potential CUE Issues:**\n${cueAlerts.map(a => `• ${a.message}`).join('\n')}` : ''}

Provide a veteran-focused analysis covering:

1. **What This Means**: Explain the findings in plain language - no VA jargon
2. **Action Steps**: What should the veteran do NEXT? (File CUE claim, request payment review, etc.)
3. **Timeline**: How long does the process typically take?
4. **Documentation Needed**: What evidence should they gather?
5. **Cautions**: Common mistakes to avoid when filing for retroactive pay

Be direct, practical, and emphasize that retroactive pay claims have specific time limits and procedures.`;

      const response = await generateAI(prompt);
      // generateAI returns { text, mode } object - extract the text content
      const aiText = response?.text || response;
      setAIAnalysis(typeof aiText === 'string' ? aiText : JSON.stringify(aiText));
      setShowAIAnalysis(true);
    } catch (error) {
      console.error('AI analysis error:', error);
      setAIAnalysis('Unable to generate AI analysis. The calculations above show what you should have been paid.');
    } finally {
      setIsAIThinking(false);
    }
  };

  // Save history
  const saveHistory = useCallback((history, conds) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      history: history || ratingHistory,
      conditions: conds || conditions,
    }));
  }, [ratingHistory, conditions]);

  // Add new rating period
  const handleAddPeriod = () => {
    if (!newEntry.effectiveDate) {
      alert('Please enter an effective date');
      return;
    }
    
    const entry = {
      id: Date.now(),
      ...newEntry,
      dependents: {
        married: newEntry.married,
        childrenUnder18: parseInt(newEntry.childrenUnder18) || 0,
        childrenSchool: parseInt(newEntry.childrenSchool) || 0,
        dependentParents: parseInt(newEntry.dependentParents) || 0,
      },
    };
    
    const updated = [...ratingHistory, entry].sort((a, b) => 
      new Date(a.effectiveDate) - new Date(b.effectiveDate)
    );
    
    setRatingHistory(updated);
    saveHistory(updated, conditions);
    
    // Reset form but keep dependents
    setNewEntry({
      effectiveDate: '',
      rating: 30,
      married: newEntry.married,
      childrenUnder18: newEntry.childrenUnder18,
      childrenSchool: newEntry.childrenSchool,
      dependentParents: newEntry.dependentParents,
    });
  };

  // Remove rating period
  const handleRemovePeriod = (id) => {
    const updated = ratingHistory.filter(p => p.id !== id);
    setRatingHistory(updated);
    saveHistory(updated, conditions);
  };

  // Run analysis
  const runAnalysis = useCallback(() => {
    if (ratingHistory.length === 0) {
      alert('Add at least one rating period to analyze');
      return;
    }
    
    setIsAnalyzing(true);
    
    // Simulate analysis time for effect
    setTimeout(() => {
      // Run retroactive pay analysis
      const result = analyzeRetroactivePay(ratingHistory);
      setAnalysis(result);
      
      // Check bilateral factor
      if (conditions.length > 0) {
        const bilateral = checkBilateralFactorCompliance(conditions);
        setBilateralCheck(bilateral);
      }
      
      // Generate CUE alerts based on patterns
      const alerts = [];
      
      // Check for bilateral factor issues
      if (bilateralCheck?.applicable) {
        alerts.push({
          pattern: CUE_PATTERNS.find(p => p.id === 'bilateral_not_applied'),
          severity: 'high',
          message: `You have bilateral conditions (${bilateralCheck.pairedParts.join(', ')}). Verify the 10% bilateral factor was applied.`,
        });
      }
      
      // Check for effective date issues
      ratingHistory.forEach(period => {
        const effectiveDate = new Date(period.effectiveDate);
        const dayOfMonth = effectiveDate.getDate();
        
        // If not the first of the month, might be missing days
        // NOTE: Effective date is when entitlement began (decision date)
        // Payment starts first of FOLLOWING month per 38 CFR § 3.400
        if (dayOfMonth !== 1) {
          alerts.push({
            pattern: CUE_PATTERNS.find(p => p.id === 'effective_date_wrong'),
            severity: 'medium',
            message: `Effective date (decision date) ${period.effectiveDate} is not the 1st of the month. Note: Payments begin first of FOLLOWING month per 38 CFR § 3.400. Consider if an earlier effective date was warranted.`,
          });
        }
      });
      
      setCueAlerts(alerts);
      setIsAnalyzing(false);
    }, 1500);
  }, [ratingHistory, conditions, bilateralCheck]);

  // Calculate total should have been paid
  const calculateTotals = () => {
    if (!analysis) return { total: 0, yearlyBreakdown: [] };
    
    const yearlyBreakdown = analysis.summary || [];
    const total = yearlyBreakdown.reduce((sum, year) => sum + year.totalShouldPaid, 0);
    
    return { total, yearlyBreakdown };
  };

  const totals = analysis ? calculateTotals() : { total: 0, yearlyBreakdown: [] };

  // Render timeline visualization
  const renderTimeline = () => {
    if (ratingHistory.length === 0) return null;
    
    return (
      <div className="bg-gray-800/30 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>📊</span> Your Rating Timeline
        </h3>
        
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-700" />
          
          {/* Timeline entries */}
          <div className="space-y-6">
            {ratingHistory.map((period, index) => (
              <div key={period.id} className="relative flex items-start gap-4 pl-16">
                {/* Timeline dot */}
                <div className={`absolute left-4 w-5 h-5 rounded-full border-2 ${
                  period.rating >= 70 ? 'bg-green-500 border-green-400' :
                  period.rating >= 50 ? 'bg-yellow-500 border-yellow-400' :
                  period.rating >= 30 ? 'bg-orange-500 border-orange-400' :
                  'bg-gray-500 border-gray-400'
                }`} />
                
                {/* Content */}
                <div className="flex-1 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">
                      {new Date(period.effectiveDate).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                    <button
                      onClick={() => handleRemovePeriod(period.id)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className={`text-3xl font-bold ${
                      period.rating >= 70 ? 'text-green-400' :
                      period.rating >= 50 ? 'text-yellow-400' :
                      period.rating >= 30 ? 'text-orange-400' :
                      'text-gray-400'
                    }`}>
                      {period.rating}%
                    </div>
                    
                    <div className="flex flex-wrap gap-2 text-xs">
                      {period.dependents?.married && (
                        <span className="px-2 py-1 bg-pink-500/20 text-pink-300 rounded">👫 Spouse</span>
                      )}
                      {period.dependents?.childrenUnder18 > 0 && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                          👶 {period.dependents.childrenUnder18} child{period.dependents.childrenUnder18 > 1 ? 'ren' : ''}
                        </span>
                      )}
                      {period.dependents?.childrenSchool > 0 && (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                          🎓 {period.dependents.childrenSchool} in school
                        </span>
                      )}
                      {period.dependents?.dependentParents > 0 && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded">
                          👴 {period.dependents.dependentParents} parent{period.dependents.dependentParents > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render analysis results
  const renderAnalysisResults = () => {
    if (!analysis) return null;
    
    return (
      <div className="space-y-6">
        {/* Found Money Banner */}
        <div className="bg-gradient-to-r from-amber-900/50 to-yellow-900/50 border-2 border-amber-500 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full -translate-y-20 translate-x-20" />
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">💰</span>
              <h3 className="text-2xl font-bold text-green-400">Payment Analysis Complete</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Total Months Analyzed</p>
                <p className="text-3xl font-bold text-white">{analysis.totalMonths}</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Total Should Have Received</p>
                <p className="text-3xl font-bold text-green-400">
                  ${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Yearly Breakdown */}
        <div className="bg-gray-800/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">📈 Yearly Breakdown</h3>
          
          <div className="space-y-3">
            {totals.yearlyBreakdown.map(year => (
              <div key={year.year} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">{year.year}</span>
                  <span className="text-sm text-gray-500">({year.months} months)</span>
                </div>
                <span className="text-green-400 font-bold">
                  ${year.totalShouldPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CUE Alerts */}
        {cueAlerts.length > 0 && (
          <div className="bg-yellow-900/30 border-2 border-yellow-500/50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-yellow-400">Potential Issues Detected</h3>
            </div>
            
            <div className="space-y-3">
              {cueAlerts.map((alert, index) => (
                <div key={index} className={`p-4 rounded-lg ${
                  alert.severity === 'high' 
                    ? 'bg-red-900/30 border border-red-500/50'
                    : 'bg-yellow-900/30 border border-yellow-500/30'
                }`}>
                  <div className="flex items-start gap-3">
                    <span className={`${
                      alert.severity === 'high' ? 'text-red-500' : 'text-yellow-500'
                    }`}>
                      {alert.severity === 'high' ? '🚨' : '⚡'}
                    </span>
                    <div>
                      <p className={`font-semibold ${
                        alert.severity === 'high' ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        {alert.pattern?.name}
                      </p>
                      <p className="text-gray-300 text-sm mt-1">{alert.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bilateral Check */}
        {bilateralCheck && (
          <div className={`rounded-xl p-6 ${
            bilateralCheck.applicable
              ? 'bg-blue-900/30 border-2 border-blue-500/50'
              : 'bg-gray-800/30 border border-gray-700'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">🦾</span>
              <h3 className="text-lg font-bold text-blue-400">Bilateral Factor Analysis</h3>
            </div>
            <p className="text-gray-300">{bilateralCheck.message}</p>
            {bilateralCheck.applicable && (
              <p className="text-blue-300/80 text-sm mt-2">
                💡 {bilateralCheck.potentialBonus}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="min-h-screen px-4 py-8">
        <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl shadow-2xl max-w-4xl mx-auto border border-gray-700">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 text-white px-6 py-6 rounded-t-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full" />
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-4xl">💸</span>
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                    Retroactive Pay Hunter
                    <span className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur text-white text-xs font-bold rounded-full">AI</span>
                    <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">BETA</span>
                  </h2>
                  <p className="text-yellow-100 mt-1">
                    "You Owe Me Money" - Find Missed Payments
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Retroactive Pay Hunter" />}
                <button
                  onClick={onClose}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* AI Mode Section */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LLMRecommendationBadge toolId="retro-pay-hunter" />
                  <AIStatusBadge showLabel={true} onClick={onAISettingsClick} />
                  <span className="text-sm text-gray-400">
                    {aiStatus.effectiveMode === AI_MODES.LOCAL 
                      ? '🔒 100% Private - runs on your device'
                      : '☁️ Cloud AI - fast & powerful'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">Click badge to configure</span>
              </div>
            </div>
            
            {/* Date Terminology Info Box */}
            <div className="bg-blue-900/30 border-2 border-blue-500 rounded-xl p-4">
              <h4 className="font-bold text-blue-300 mb-2 flex items-center gap-2">
                <span>📅</span> Understanding VA Payment Dates
              </h4>
              <div className="text-sm text-blue-200 space-y-1">
                <p><strong>Effective Date:</strong> When your entitlement began (the decision date on your VA letter)</p>
                <p><strong>Payment Effective Date:</strong> When payments actually start = <strong>first day of month FOLLOWING</strong> effective date</p>
                <p className="text-xs text-blue-400 mt-2 italic">Per 38 CFR § 3.400: "Payment shall commence on the first day of the month following the month in which the effective date falls."</p>
                <p className="text-xs text-amber-300 mt-2">💡 Example: Decision effective Jan 15, 2024 → Payments start Feb 1, 2024 (not Jan 15)</p>
              </div>
            </div>

            {/* Add Rating Period Form */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>➕</span> Add Rating Period
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                    Effective Date *
                    <span className="group relative">
                      <span className="text-blue-400 cursor-help text-xs">ℹ️</span>
                      <span className="invisible group-hover:visible absolute z-10 w-72 p-3 text-xs bg-gray-900 border border-gray-700 rounded-lg shadow-xl -left-16 top-6">
                        <strong className="text-amber-400">Effective Date vs Payment Date:</strong>
                        <br/>• <strong>Effective Date:</strong> When entitlement began (decision date)
                        <br/>• <strong>Payment Start:</strong> First of FOLLOWING month (38 CFR § 3.400)
                        <br/><br/>
                        <em className="text-gray-400">Example: Effective date Feb 15, 2024 → Payments start Mar 1, 2024</em>
                      </span>
                    </span>
                  </label>
                  <input
                    type="date"
                    value={newEntry.effectiveDate}
                    onChange={(e) => setNewEntry({ ...newEntry, effectiveDate: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  <p className="text-xs text-gray-500 mt-1">This is the decision effective date (when entitlement began)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Combined Rating *
                  </label>
                  <select
                    value={newEntry.rating}
                    onChange={(e) => setNewEntry({ ...newEntry, rating: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  >
                    {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(r => (
                      <option key={r} value={r}>{r}%</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Dependents */}
              <div className="mt-4 p-4 bg-gray-900/50 rounded-lg">
                <p className="text-sm text-gray-400 mb-3">Dependents (for pay calculation)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEntry.married}
                      onChange={(e) => setNewEntry({ ...newEntry, married: e.target.checked })}
                      className="w-4 h-4 text-amber-500 rounded bg-gray-700 border-gray-600"
                    />
                    Married
                  </label>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={newEntry.childrenUnder18}
                      onChange={(e) => setNewEntry({ ...newEntry, childrenUnder18: e.target.value })}
                      className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                    />
                    <span className="text-sm text-gray-400">Children &lt;18</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={newEntry.childrenSchool}
                      onChange={(e) => setNewEntry({ ...newEntry, childrenSchool: e.target.value })}
                      className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                    />
                    <span className="text-sm text-gray-400">In School 18+</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="2"
                      value={newEntry.dependentParents}
                      onChange={(e) => setNewEntry({ ...newEntry, dependentParents: e.target.value })}
                      className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                    />
                    <span className="text-sm text-gray-400">Parents</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleAddPeriod}
                className="mt-4 w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Rating Period
              </button>
              
              {conditions.length > 0 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">📋</span>
                    <p className="text-purple-200 font-semibold">
                      Loaded from My Packet
                    </p>
                  </div>
                  <p className="text-purple-300 text-sm">
                    {conditions.length} condition{conditions.length !== 1 ? 's' : ''} detected for bilateral factor analysis.
                    {conditions.filter(c => c.side === 'bilateral' || c.side === 'left' || c.side === 'right').length > 0 && (
                      <span className="block mt-1 text-purple-400">
                        ⚠️ Paired body parts found - bilateral factor may apply!
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Timeline */}
            {renderTimeline()}

            {/* Analyze Button */}
            {ratingHistory.length > 0 && !analysis && (
              <ToolCardButton className="w-full" type="button" onClick={runAnalysis} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span> Analyzing Pay Records...
                  </>
                ) : (
                  <>Analyze Pay Records</>
                )}
              </ToolCardButton>
            )}

            {/* Analysis Results */}
            {renderAnalysisResults()}
            
            {/* AI Analysis Section */}
            {analysis && isAIAvailable() && (
              <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🤖</span>
                    <h3 className="text-lg font-bold text-purple-100">AI Expert Analysis</h3>
                  </div>
                  {!showAIAnalysis && (
                    <button
                      onClick={handleAIAnalysis}
                      disabled={isAIThinking}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isAIThinking ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          🔍 Get AI Analysis
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {showAIAnalysis && aiAnalysis && (
                  <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-purple-600/30">
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-purple-100 prose-p:text-gray-300">
                      <div className="whitespace-pre-wrap">{aiAnalysis}</div>
                    </div>
                  </div>
                )}
                
                {!showAIAnalysis && (
                  <p className="text-purple-300 text-sm">
                    Get an AI-powered analysis that explains your findings in plain language, recommends next steps, 
                    and warns you about common mistakes when filing retroactive pay claims.
                  </p>
                )}
              </div>
            )}

            {/* CUE Patterns Reference */}
            <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
              <button
                onClick={() => setShowCuePatterns(!showCuePatterns)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📚</span>
                  <h3 className="text-lg font-bold text-white">Common CUE Patterns</h3>
                </div>
                <span className="text-gray-400">{showCuePatterns ? '−' : '+'}</span>
              </button>
              
              {showCuePatterns && (
                <div className="mt-4 space-y-3">
                  {CUE_PATTERNS.map(pattern => (
                    <div key={pattern.id} className={`p-4 rounded-lg ${
                      pattern.severity === 'high' 
                        ? 'bg-red-900/20 border border-red-500/30'
                        : 'bg-yellow-900/20 border border-yellow-500/30'
                    }`}>
                      <div className="flex items-start gap-3">
                        <span className={`${
                          pattern.severity === 'high' ? 'text-red-500' : 'text-yellow-500'
                        }`}>
                          {pattern.severity === 'high' ? '🔴' : '🟡'}
                        </span>
                        <div>
                          <p className="font-semibold text-white">{pattern.name}</p>
                          <p className="text-gray-400 text-sm mt-1">{pattern.description}</p>
                          <p className="text-gray-500 text-xs mt-2">
                            💡 Detection: {pattern.detection}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-800/50 rounded-b-2xl border-t border-gray-700">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-500 text-center sm:text-left">
                ⚠️ This tool provides estimates only. Consult with a VSO or attorney for official payment disputes.
              </p>
              <BuyMeCoffee variant="compact" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetroPayHunter;
