import React, { useState } from 'react';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { searchStateBenefits, isAIAvailable } from '../utils/aiStatementHelper';
import { generateAI } from '../utils/unifiedAIService';
import { AIStatusBadge } from './AIModeSelector';

/**
 * StateBenefitHunter Component
 * "Money on the Table" - Finds state-specific veteran benefits
 * Uses Gemini AI to act as a dynamic database of state laws
 * 
 * This tool helps veterans discover benefits that "Claim Sharks" usually ignore:
 * - Property tax exemptions
 * - Free license plates
 * - Education benefits
 * - Recreation benefits (hunting/fishing licenses)
 * - Employment preferences
 * - And more...
 */

// All 50 US states plus DC
const US_STATES = [
  { value: '', label: 'Select your state...' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' }
];

// Rating levels for selection
const RATING_LEVELS = [
  { value: 0, label: '0%' },
  { value: 10, label: '10%' },
  { value: 20, label: '20%' },
  { value: 30, label: '30%' },
  { value: 40, label: '40%' },
  { value: 50, label: '50%' },
  { value: 60, label: '60%' },
  { value: 70, label: '70%' },
  { value: 80, label: '80%' },
  { value: 90, label: '90%' },
  { value: 100, label: '100%' },
  { value: '100-PT', label: '100% P&T (Permanent & Total)' }
];

// Category icons and colors for benefit cards
const CATEGORY_CONFIG = {
  'Property Tax': {
    icon: '🏠',
    color: 'from-green-500 to-emerald-600',
    bgLight: 'bg-green-50 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-700',
    textColor: 'text-green-700 dark:text-green-300',
    badge: 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200',
    highlight: true // Money saved!
  },
  'Tax': {
    icon: '💵',
    color: 'from-green-500 to-emerald-600',
    bgLight: 'bg-green-50 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-700',
    textColor: 'text-green-700 dark:text-green-300',
    badge: 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200',
    highlight: true
  },
  'Vehicle': {
    icon: '🚗',
    color: 'from-blue-500 to-indigo-600',
    bgLight: 'bg-blue-50 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-700',
    textColor: 'text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
  },
  'Education': {
    icon: '🎓',
    color: 'from-purple-500 to-violet-600',
    bgLight: 'bg-purple-50 dark:bg-purple-900/30',
    borderColor: 'border-purple-200 dark:border-purple-700',
    textColor: 'text-purple-700 dark:text-purple-300',
    badge: 'bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200'
  },
  'Recreation': {
    icon: '🎣',
    color: 'from-cyan-500 to-sky-600',
    bgLight: 'bg-cyan-50 dark:bg-cyan-900/30',
    borderColor: 'border-cyan-200 dark:border-cyan-700',
    textColor: 'text-cyan-700 dark:text-cyan-300',
    badge: 'bg-cyan-100 dark:bg-cyan-800 text-cyan-800 dark:text-cyan-200',
    lifestyle: true // Lifestyle benefit!
  },
  'Employment': {
    icon: '💼',
    color: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50 dark:bg-amber-900/30',
    borderColor: 'border-amber-200 dark:border-amber-700',
    textColor: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
  },
  'Healthcare': {
    icon: '🏥',
    color: 'from-red-500 to-rose-600',
    bgLight: 'bg-red-50 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-700',
    textColor: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200'
  },
  'Housing': {
    icon: '🏡',
    color: 'from-teal-500 to-green-600',
    bgLight: 'bg-teal-50 dark:bg-teal-900/30',
    borderColor: 'border-teal-200 dark:border-teal-700',
    textColor: 'text-teal-700 dark:text-teal-300',
    badge: 'bg-teal-100 dark:bg-teal-800 text-teal-800 dark:text-teal-200',
    highlight: true
  },
  'default': {
    icon: '⭐',
    color: 'from-gray-500 to-slate-600',
    bgLight: 'bg-gray-50 dark:bg-gray-900/30',
    borderColor: 'border-gray-200 dark:border-gray-700',
    textColor: 'text-gray-700 dark:text-gray-300',
    badge: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
  }
};

const StateBenefitHunter = ({ onClose, onReportBug }) => {
  useBodyScrollLock(true);
  
  const [selectedState, setSelectedState] = useState('');
  const [selectedRating, setSelectedRating] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPermanentTotal, setIsPermanentTotal] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showAIConsultation, setShowAIConsultation] = useState(false);
  const [aiQuestion, setAIQuestion] = useState('');
  const [aiAdvice, setAIAdvice] = useState(null);
  const [isAIThinking, setIsAIThinking] = useState(false);

  const getStateName = (stateCode) => {
    const state = US_STATES.find(s => s.value === stateCode);
    return state ? state.label : stateCode;
  };

  const getRatingDisplay = () => {
    if (selectedRating === '100-PT') {
      return '100% P&T';
    }
    return `${selectedRating}%`;
  };

  const handleSearch = async () => {
    if (!selectedState || selectedRating === '') {
      setError('Please select both a state and your combined rating.');
      return;
    }

    if (!isAIAvailable()) {
      setError('AI features are not available. Please add your Gemini API key in Settings to use this feature.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const stateName = getStateName(selectedState);
      const ratingStr = selectedRating === '100-PT' ? '100% P&T' : `${selectedRating}%`;
      
      const response = await searchStateBenefits(stateName, ratingStr);
      
      if (response.success) {
        setResults(response.data);
      } else {
        setError(response.error || 'Failed to retrieve state benefits. Please try again.');
      }
    } catch (err) {
      console.error('State benefits search error:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIConsultation = async () => {
    if (!aiQuestion.trim()) return;
    
    if (!isAIAvailable()) {
      setError('AI features require an API key. Please configure AI in Settings.');
      return;
    }

    setIsAIThinking(true);
    setAIAdvice(null);

    try {
      const prompt = `You are a state veteran benefits expert helping veterans understand and maximize their state-level benefits.

Veteran's Question: "${aiQuestion}"
${selectedState ? `State Context: ${getStateName(selectedState)}` : ''}
${selectedRating ? `VA Rating: ${getRatingDisplay()}` : ''}

Provide helpful, specific advice about:
- State-specific veteran benefits (property tax, vehicle registration, education, recreation)
- Eligibility requirements for different rating levels
- How to apply for these benefits
- Common mistakes veterans make in missing out on state benefits
- Priority benefits that save the most money
- Documentation typically needed

Be practical, encouraging, and emphasize these are benefits that "claim sharks" never tell veterans about.`;

      const response = await generateAI(prompt);
      
      // generateAI returns { text, mode } object - extract the text content
      const aiText = response?.text || response;
      if (aiText) {
        setAIAdvice(typeof aiText === 'string' ? aiText : JSON.stringify(aiText));
      } else {
        setAIAdvice('Failed to get AI advice. Please try again.');
      }
    } catch (err) {
      console.error('AI consultation error:', err);
      setError('An error occurred during AI consultation.');
    } finally {
      setIsAIThinking(false);
    }
  };

  const getCategoryConfig = (category) => {
    // Check for partial matches
    for (const key of Object.keys(CATEGORY_CONFIG)) {
      if (category.toLowerCase().includes(key.toLowerCase())) {
        return CATEGORY_CONFIG[key];
      }
    }
    return CATEGORY_CONFIG.default;
  };

  const groupBenefitsByCategory = (benefits) => {
    if (!benefits || !Array.isArray(benefits)) return {};
    
    const grouped = {};
    benefits.forEach(benefit => {
      const cat = benefit.category || 'Other';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(benefit);
    });
    return grouped;
  };

  const renderBenefitCard = (benefit, index) => {
    const config = getCategoryConfig(benefit.category);
    
    return (
      <div 
        key={index}
        className={`${config.bgLight} ${config.borderColor} border rounded-xl p-4 transition-all hover:shadow-lg hover:-translate-y-0.5`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center text-xl shadow-sm`}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {benefit.benefit_name}
              </h4>
              {config.highlight && (
                <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse">
                  💰 MONEY SAVED
                </span>
              )}
              {config.lifestyle && (
                <span className="px-2 py-0.5 bg-cyan-500 text-white text-xs font-bold rounded-full">
                  🎯 LIFESTYLE
                </span>
              )}
            </div>
            <p className={`text-sm ${config.textColor} mt-1 font-medium`}>
              {benefit.value}
            </p>
            {benefit.requirement && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                <span className="font-medium">Requirement:</span> {benefit.requirement}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="state-benefit-hunter-title"
    >
      <div className="min-h-screen px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white px-6 py-6 rounded-t-lg relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-3xl">💰</span>
                </div>
                <div>
                  <h2 id="state-benefit-hunter-title" className="text-2xl sm:text-3xl font-bold">
                    State Benefit Hunter <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">BETA</span>
                  </h2>
                  <p className="text-green-100 text-sm sm:text-base mt-1">
                    Find the money you're leaving on the table
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="State Benefit Hunter" />}
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

          {/* Content */}
          <div className="p-6">
            {/* Info Banner */}
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border border-amber-200 dark:border-amber-700 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">Did you know?</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Many veterans miss out on <strong>thousands of dollars</strong> in state benefits each year. 
                    These include property tax exemptions, free vehicle registration, hunting/fishing licenses, 
                    and education benefits that "Claim Sharks" never tell you about.
                  </p>
                </div>
              </div>
            </div>

            {/* Selection Form */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Enter Your Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* State Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your State
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {US_STATES.map(state => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rating Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Combined VA Rating
                  </label>
                  <select
                    value={selectedRating}
                    onChange={(e) => {
                      setSelectedRating(e.target.value);
                      setIsPermanentTotal(e.target.value === '100-PT');
                    }}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select your rating...</option>
                    {RATING_LEVELS.map(rating => (
                      <option key={rating.value} value={rating.value}>
                        {rating.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* P&T Checkbox for non-100% */}
              {selectedRating && selectedRating !== '100-PT' && parseInt(selectedRating) >= 70 && (
                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPermanentTotal}
                      onChange={(e) => setIsPermanentTotal(e.target.checked)}
                      className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                    />
                    <span>I have a <strong>Permanent & Total (P&T)</strong> designation</span>
                  </label>
                </div>
              )}

              {/* Search Button */}
              <button
                onClick={handleSearch}
                disabled={isLoading || !selectedState || selectedRating === ''}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                {isLoading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span>Hunting for Benefits...</span>
                  </>
                ) : (
                  <>
                    <span>🎯</span>
                    <span>Find My State Benefits</span>
                  </>
                )}
              </button>
            </div>

            {/* AI Benefits Consultation */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 mb-6 border border-purple-200 dark:border-purple-700">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    AI Benefits Advisor
                  </h3>
                  <AIStatusBadge onClick={() => setShowAISettings(!showAISettings)} className="mt-1" />
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Have questions about state benefits, eligibility, or how to apply? Get personalized AI guidance.
              </p>
              
              <div className="space-y-3">
                <textarea
                  value={aiQuestion}
                  onChange={(e) => setAIQuestion(e.target.value)}
                  placeholder="Example: What property tax exemptions am I eligible for with my rating? How do I apply?"
                  className="w-full px-4 py-3 rounded-lg border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={3}
                />
                <button
                  onClick={handleAIConsultation}
                  disabled={isAIThinking || !aiQuestion.trim()}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAIThinking ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span>AI Consulting...</span>
                    </>
                  ) : (
                    <>
                      <span>💬</span>
                      <span>Get AI Advice</span>
                    </>
                  )}
                </button>

                {aiAdvice && (
                  <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-xl">💡</span>
                      <h4 className="font-semibold text-gray-900 dark:text-white">Benefits Advisor:</h4>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {aiAdvice}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-700 dark:text-red-300">{error}</span>
                </div>
              </div>
            )}

            {/* Results Display */}
            {results && (
              <div className="space-y-6">
                {/* Results Header */}
                <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 rounded-xl p-4 border border-green-200 dark:border-green-700">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🎉</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Benefits for {results.state}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {results.summary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Benefits Grid */}
                {results.benefits && results.benefits.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="text-xl">📋</span>
                      Your Eligible Benefits
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 text-sm rounded-full">
                        {results.benefits.length} found
                      </span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {results.benefits.map((benefit, index) => renderBenefitCard(benefit, index))}
                    </div>
                  </div>
                )}

                {/* Official Link */}
                {results.link && (
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🔗</span>
                        <div>
                          <p className="font-medium text-blue-800 dark:text-blue-200">Official State Website</p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">Verify these benefits on the official state page</p>
                        </div>
                      </div>
                      <a
                        href={results.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <span>Visit Official Site</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <strong>⚠️ Disclaimer:</strong> This information is provided for educational purposes and may not reflect the most current state laws. 
                    Benefits and eligibility requirements can change. Always verify with your state's official veterans affairs office before applying.
                    This tool uses AI to compile publicly available information and may contain inaccuracies.
                  </p>
                </div>
              </div>
            )}

            {/* No Results State */}
            {!results && !isLoading && !error && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">🗺️</div>
                <p className="text-lg">Select your state and rating to discover your benefits</p>
                <p className="text-sm mt-2">We'll search for property tax exemptions, vehicle registration benefits, education grants, and more!</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <BuyMeCoffee show={results !== null} trigger="state-benefits" />
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StateBenefitHunter;
