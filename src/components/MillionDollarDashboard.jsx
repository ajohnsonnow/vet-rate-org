/**
 * Vet-Rate.org - The Million Dollar Dashboard
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "The Whoa Factor" - Lifetime Value Financial Projector
 * Shows veterans the TRUE generational wealth of their VA rating
 * 
 * Most veterans see "$3,000 a month." They don't realize that a 
 * 100% P&T rating is actually a $2.5 MILLION asset.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import BuyMeCoffee from './BuyMeCoffee';
import { FocusToggle } from '../contexts/FocusModeContext';
import { getMyRatings, hasMyRatings } from '../utils/veteranProfile';
import { calculateVARating } from '../utils/vaCalculator';
import ReportBugLink from './ReportBugLink';

/**
 * 2026 VA Disability Pay Rates (Monthly)
 * Source: VA.gov - Updated annually with COLA
 */
const VA_PAY_RATES_2026 = {
  single: {
    10: 175.51, 20: 346.99, 30: 537.24, 40: 773.82, 50: 1101.97,
    60: 1394.89, 70: 1758.27, 80: 2044.16, 90: 2297.31, 100: 3832.65
  },
  withSpouse: {
    30: 600.24, 40: 859.82, 50: 1211.97, 60: 1528.89, 70: 1916.27,
    80: 2226.16, 90: 2503.31, 100: 4063.65
  },
  withSpouseAnd1Child: {
    30: 651.24, 40: 925.82, 50: 1292.97, 60: 1624.89, 70: 2027.27,
    80: 2352.16, 90: 2644.31, 100: 4204.65
  },
  withSpouseAnd2Children: {
    30: 702.24, 40: 991.82, 50: 1373.97, 60: 1720.89, 70: 2138.27,
    80: 2478.16, 90: 2785.31, 100: 4345.65
  },
  perAdditionalChild: {
    30: 51, 40: 66, 50: 81, 60: 96, 70: 111, 80: 126, 90: 141, 100: 141
  }
};

/**
 * State Property Tax Exemptions for 100% Disabled Veterans
 * Annual savings estimate
 */
const STATE_PROPERTY_TAX_EXEMPTIONS = {
  'Alabama': { exemption: 'Full', annualValue: 2500 },
  'Alaska': { exemption: 'First $150k', annualValue: 3000 },
  'Arizona': { exemption: 'First $4,117', annualValue: 600 },
  'Arkansas': { exemption: 'Full', annualValue: 2000 },
  'California': { exemption: 'Up to $150k', annualValue: 1500 },
  'Colorado': { exemption: '50%', annualValue: 2500 },
  'Connecticut': { exemption: 'Up to $1,500', annualValue: 1500 },
  'Delaware': { exemption: 'Full', annualValue: 1500 },
  'Florida': { exemption: 'Full', annualValue: 5000 },
  'Georgia': { exemption: 'Full', annualValue: 3000 },
  'Hawaii': { exemption: 'Full', annualValue: 4000 },
  'Idaho': { exemption: 'Up to $100k', annualValue: 1500 },
  'Illinois': { exemption: 'Up to $100k', annualValue: 2500 },
  'Indiana': { exemption: 'Full', annualValue: 2000 },
  'Iowa': { exemption: 'Full', annualValue: 3000 },
  'Kansas': { exemption: 'Full', annualValue: 2500 },
  'Kentucky': { exemption: 'Full', annualValue: 1800 },
  'Louisiana': { exemption: 'First $75k', annualValue: 1200 },
  'Maine': { exemption: 'Up to $6k', annualValue: 6000 },
  'Maryland': { exemption: 'Full', annualValue: 3500 },
  'Massachusetts': { exemption: 'Up to $1k', annualValue: 1000 },
  'Michigan': { exemption: 'Full', annualValue: 2500 },
  'Minnesota': { exemption: 'Up to $300k', annualValue: 4000 },
  'Mississippi': { exemption: 'Full', annualValue: 1500 },
  'Missouri': { exemption: 'Full', annualValue: 2000 },
  'Montana': { exemption: 'Full', annualValue: 2000 },
  'Nebraska': { exemption: 'Full', annualValue: 3500 },
  'Nevada': { exemption: 'Full', annualValue: 4000 },
  'New Hampshire': { exemption: 'Full', annualValue: 5500 },
  'New Jersey': { exemption: 'Full', annualValue: 8000 },
  'New Mexico': { exemption: 'Full', annualValue: 2000 },
  'New York': { exemption: 'Partial', annualValue: 3000 },
  'North Carolina': { exemption: 'First $45k', annualValue: 800 },
  'North Dakota': { exemption: 'Full', annualValue: 2500 },
  'Ohio': { exemption: 'Partial (Homestead Exemption up to $50k)', annualValue: 700 },
  'Oklahoma': { exemption: 'Full', annualValue: 2000 },
  'Oregon': { exemption: 'Up to $24k', annualValue: 3500 },
  'Pennsylvania': { exemption: 'Full', annualValue: 3000 },
  'Rhode Island': { exemption: 'Full', annualValue: 4500 },
  'South Carolina': { exemption: 'Full', annualValue: 2500 },
  'South Dakota': { exemption: 'Full', annualValue: 2500 },
  'Tennessee': { exemption: 'Full', annualValue: 1500 },
  'Texas': { exemption: 'Full', annualValue: 6000 },
  'Utah': { exemption: 'Up to $283k', annualValue: 3000 },
  'Vermont': { exemption: 'Up to $10k', annualValue: 2000 },
  'Virginia': { exemption: 'Full', annualValue: 3500 },
  'Washington': { exemption: 'Partial', annualValue: 3000 },
  'West Virginia': { exemption: 'Full', annualValue: 1500 },
  'Wisconsin': { exemption: 'Full', annualValue: 4500 },
  'Wyoming': { exemption: 'Full', annualValue: 2000 },
  'District of Columbia': { exemption: 'Full', annualValue: 5000 }
};

/**
 * Chapter 35 DEA (Dependents Education Assistance)
 * Available for dependents of 100% P&T veterans
 */
const CHAPTER_35_DEA = {
  monthlyBenefit: 1488, // Monthly payment
  maxMonths: 36, // Maximum months of eligibility
  totalValue: 1488 * 36 // $53,568 per eligible dependent
};

/**
 * CHAMPVA Healthcare Value Estimate
 * Annual premium savings for family coverage
 */
const CHAMPVA_ANNUAL_VALUE = 12000; // Conservative estimate for family healthcare

/**
 * Average life expectancy data
 */
const LIFE_EXPECTANCY = 85; // Used for projection endpoint

/**
 * COLA (Cost of Living Adjustment) estimate
 */
const ESTIMATED_COLA_RATE = 0.025; // 2.5% annual increase

/**
 * Format large numbers with commas
 */
const formatCurrency = (num) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

/**
 * Calculate monthly VA pay based on rating and dependents
 */
const calculateMonthlyPay = (rating, hasSpouse, numChildren) => {
  if (rating < 30) {
    return VA_PAY_RATES_2026.single[rating] || 0;
  }
  
  if (!hasSpouse && numChildren === 0) {
    return VA_PAY_RATES_2026.single[rating] || 0;
  }
  
  let basePay;
  if (hasSpouse && numChildren === 0) {
    basePay = VA_PAY_RATES_2026.withSpouse[rating] || 0;
  } else if (hasSpouse && numChildren === 1) {
    basePay = VA_PAY_RATES_2026.withSpouseAnd1Child[rating] || 0;
  } else if (hasSpouse && numChildren >= 2) {
    basePay = VA_PAY_RATES_2026.withSpouseAnd2Children[rating] || 0;
    // Add for additional children beyond 2
    if (numChildren > 2) {
      basePay += VA_PAY_RATES_2026.perAdditionalChild[rating] * (numChildren - 2);
    }
  } else if (!hasSpouse && numChildren > 0) {
    // Single with children - approximate by taking single + child additions
    basePay = VA_PAY_RATES_2026.single[rating] || 0;
    if (rating >= 30) {
      basePay += VA_PAY_RATES_2026.perAdditionalChild[rating] * numChildren;
    }
  }
  
  return basePay || VA_PAY_RATES_2026.single[rating] || 0;
};

/**
 * Calculate lifetime value with COLA
 */
const calculateLifetimeValue = (currentAge, rating, hasSpouse, numChildren, state) => {
  const yearsRemaining = Math.max(0, LIFE_EXPECTANCY - currentAge);
  const monthlyPay = calculateMonthlyPay(rating, hasSpouse, numChildren);
  
  // Calculate VA Pay with COLA compounding
  let totalVAPay = 0;
  let currentAnnualPay = monthlyPay * 12;
  const yearlyPayments = [];
  
  for (let year = 0; year < yearsRemaining; year++) {
    totalVAPay += currentAnnualPay;
    yearlyPayments.push({
      year: currentAge + year,
      vaPay: totalVAPay,
      annualPay: currentAnnualPay
    });
    currentAnnualPay *= (1 + ESTIMATED_COLA_RATE); // Apply COLA
  }
  
  // Property Tax Exemption (100% only)
  let propertyTaxSavings = 0;
  if (rating === 100 && state && STATE_PROPERTY_TAX_EXEMPTIONS[state]) {
    propertyTaxSavings = STATE_PROPERTY_TAX_EXEMPTIONS[state].annualValue * yearsRemaining;
  }
  
  // Chapter 35 DEA (100% P&T only)
  let educationValue = 0;
  const eligibleDependents = numChildren + (hasSpouse ? 1 : 0);
  if (rating === 100) {
    educationValue = CHAPTER_35_DEA.totalValue * eligibleDependents;
  }
  
  // CHAMPVA Healthcare (100% P&T only)
  let healthcareValue = 0;
  if (rating === 100 && (hasSpouse || numChildren > 0)) {
    healthcareValue = CHAMPVA_ANNUAL_VALUE * yearsRemaining;
  }
  
  // SMC-S (Housebound) - if applicable at 100%
  const smcSMonthly = 459.21; // Additional SMC-S payment
  
  return {
    yearsRemaining,
    monthlyPay,
    annualPay: monthlyPay * 12,
    totalVAPay: Math.round(totalVAPay),
    propertyTaxSavings: Math.round(propertyTaxSavings),
    educationValue: Math.round(educationValue),
    healthcareValue: Math.round(healthcareValue),
    grandTotal: Math.round(totalVAPay + propertyTaxSavings + educationValue + healthcareValue),
    yearlyPayments
  };
};

export default function MillionDollarDashboard({ onClose, onReportBug }) {
  useBodyScrollLock(true);
  
  // Input state
  const [currentAge, setCurrentAge] = useState(40);
  const [ageInputValue, setAgeInputValue] = useState('40');
  const [rating, setRating] = useState(100);
  const [hasSpouse, setHasSpouse] = useState(true);
  const [numChildren, setNumChildren] = useState(2);
  const [state, setState] = useState('Texas');
  const [isPermanentTotal, setIsPermanentTotal] = useState(true);
  
  // Animation state
  const [animatedTotal, setAnimatedTotal] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  
  // Auto-load rating from veteranProfile on mount
  useEffect(() => {
    const savedRatings = getMyRatings();
    if (savedRatings && savedRatings.length > 0) {
      const result = calculateVARating(savedRatings);
      setRating(result.combinedRating);
    }
  }, []);
  
  // Manual load handler
  const handleLoadMyRatings = () => {
    const savedRatings = getMyRatings();
    if (savedRatings && savedRatings.length > 0) {
      const result = calculateVARating(savedRatings);
      setRating(result.combinedRating);
    } else {
      alert('No saved ratings found. Use Secondary Scout to import your VA ratings first.');
    }
  };
  
  // Calculate values
  const calculation = useMemo(() => 
    calculateLifetimeValue(currentAge, rating, hasSpouse, numChildren, state),
    [currentAge, rating, hasSpouse, numChildren, state]
  );
  
  // Animate the total counter
  useEffect(() => {
    const target = calculation.grandTotal;
    const duration = 2000; // 2 seconds
    const steps = 60;
    const stepValue = target / steps;
    let current = 0;
    let step = 0;
    
    const timer = setInterval(() => {
      step++;
      current = Math.min(stepValue * step, target);
      setAnimatedTotal(Math.round(current));
      
      if (step >= steps) {
        clearInterval(timer);
        setShowBreakdown(true);
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [calculation.grandTotal]);
  
  // Generate chart data points
  const chartData = useMemo(() => {
    const points = [];
    let cumulative = 0;
    const startYear = currentAge;
    const yearsToShow = Math.min(calculation.yearsRemaining, 50);
    
    for (let i = 0; i <= yearsToShow; i += 5) {
      const yearData = calculation.yearlyPayments[i] || { vaPay: 0 };
      // Add proportional benefits
      const propertyPerYear = calculation.propertyTaxSavings / calculation.yearsRemaining;
      const healthcarePerYear = calculation.healthcareValue / calculation.yearsRemaining;
      const total = yearData.vaPay + (propertyPerYear * i) + (healthcarePerYear * i);
      
      points.push({
        age: startYear + i,
        value: Math.round(total)
      });
    }
    
    return points;
  }, [calculation, currentAge]);
  
  // SVG Chart dimensions
  const chartWidth = 600;
  const chartHeight = 200;
  const padding = 40;
  
  // Generate SVG path for chart
  const generateChartPath = () => {
    if (chartData.length < 2) return '';
    
    const maxValue = Math.max(...chartData.map(d => d.value));
    const minAge = chartData[0].age;
    const maxAge = chartData[chartData.length - 1].age;
    
    const xScale = (age) => padding + ((age - minAge) / (maxAge - minAge)) * (chartWidth - padding * 2);
    const yScale = (value) => chartHeight - padding - (value / maxValue) * (chartHeight - padding * 2);
    
    const pathPoints = chartData.map(d => `${xScale(d.age)},${yScale(d.value)}`);
    return `M ${pathPoints.join(' L ')}`;
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="million-dollar-dashboard-title"
    >
      <div className="min-h-screen px-4 py-8 flex items-start justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header - Sticky */}
          <div className="bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 text-white px-6 py-6 rounded-t-lg relative overflow-hidden flex-shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-3xl">💰</span>
                </div>
                <div>
                  <h2 id="million-dollar-dashboard-title" className="text-2xl sm:text-3xl font-bold text-black">
                    Million Dollar Dashboard
                  </h2>
                  <p className="text-yellow-800 text-sm sm:text-base mt-1">
                    Lifetime Value Financial Projector
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="dark" moduleName="Million Dollar Dashboard" />}
                <button
                  onClick={onClose}
                  className="p-2 text-black hover:bg-black/10 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Content - Scrollable */}
          <div className="p-6 space-y-6 bg-gray-900 overflow-y-auto flex-1 rounded-b-lg">
            {/* THE BIG NUMBER */}
            <div className="text-center py-8">
              <p className="text-gray-400 text-lg mb-2">Your Claim's Total Lifetime Value</p>
              <div className="relative">
                <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 animate-pulse">
                  {formatCurrency(animatedTotal)}
                </h1>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 via-transparent to-yellow-400/20 blur-3xl -z-10"></div>
              </div>
              <p className="text-gray-500 text-sm mt-4">
                *Projected value from age {currentAge} to {LIFE_EXPECTANCY} with {(ESTIMATED_COLA_RATE * 100).toFixed(1)}% annual COLA
              </p>
            </div>
            
            {/* Input Controls */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">📊 Your Profile</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Age */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Current Age</label>
                  <input
                    type="number"
                    value={ageInputValue}
                    onChange={(e) => {
                      setAgeInputValue(e.target.value);
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 18 && val <= 80) {
                        setCurrentAge(val);
                      }
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (isNaN(val) || val < 18 || val > 80) {
                        setAgeInputValue('40');
                        setCurrentAge(40);
                      } else {
                        setAgeInputValue(val.toString());
                        setCurrentAge(val);
                      }
                    }}
                    min="18"
                    max="80"
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white text-center text-lg font-bold"
                  />
                </div>
                
                {/* Rating with Load Button */}
                <div className="col-span-2 md:col-span-1">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm text-gray-400">VA Rating %</label>
                    {hasMyRatings() && (
                      <button
                        onClick={handleLoadMyRatings}
                        className="text-xs px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                        title="Calculate from your saved ratings"
                      >
                        📊 Load
                      </button>
                    )}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={rating}
                    onChange={(e) => setRating(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-center text-2xl font-bold text-white mt-2">
                    {rating}%
                  </div>
                </div>
                
                {/* Rating */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">VA Rating %</label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(parseInt(e.target.value))}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white text-center text-lg font-bold"
                  >
                    {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map(r => (
                      <option key={r} value={r}>{r}%</option>
                    ))}
                  </select>
                </div>
                
                {/* State */}
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">State (for Property Tax)</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white"
                  >
                    {Object.keys(STATE_PROPERTY_TAX_EXEMPTIONS).sort().map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-4">
                {/* Spouse */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Spouse?</label>
                  <button
                    onClick={() => setHasSpouse(!hasSpouse)}
                    className={`w-full p-3 rounded-xl font-bold transition-all ${
                      hasSpouse 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-700 text-gray-400 border border-gray-600'
                    }`}
                  >
                    {hasSpouse ? '✓ Yes' : 'No'}
                  </button>
                </div>
                
                {/* Children */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1"># Children</label>
                  <input
                    type="number"
                    value={numChildren}
                    onChange={(e) => setNumChildren(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-xl text-white text-center text-lg font-bold"
                  />
                </div>
                
                {/* P&T */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">P&T?</label>
                  <button
                    onClick={() => setIsPermanentTotal(!isPermanentTotal)}
                    className={`w-full p-3 rounded-xl font-bold transition-all ${
                      isPermanentTotal 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-700 text-gray-400 border border-gray-600'
                    }`}
                  >
                    {isPermanentTotal ? '✓ P&T' : 'No'}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Value Growth Chart */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">📈 Cumulative Value Growth</h3>
              <div className="overflow-x-auto">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full max-w-2xl mx-auto">
                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                    <line
                      key={i}
                      x1={padding}
                      y1={chartHeight - padding - pct * (chartHeight - padding * 2)}
                      x2={chartWidth - padding}
                      y2={chartHeight - padding - pct * (chartHeight - padding * 2)}
                      stroke="#374151"
                      strokeDasharray="4"
                    />
                  ))}
                  
                  {/* Value line */}
                  <path
                    d={generateChartPath()}
                    fill="none"
                    stroke="url(#goldGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  
                  {/* Area fill */}
                  <path
                    d={`${generateChartPath()} L ${chartWidth - padding},${chartHeight - padding} L ${padding},${chartHeight - padding} Z`}
                    fill="url(#goldGradientFill)"
                    opacity="0.3"
                  />
                  
                  {/* Data points */}
                  {chartData.map((d, i) => {
                    const maxValue = Math.max(...chartData.map(p => p.value));
                    const minAge = chartData[0].age;
                    const maxAge = chartData[chartData.length - 1].age;
                    const x = padding + ((d.age - minAge) / (maxAge - minAge)) * (chartWidth - padding * 2);
                    const y = chartHeight - padding - (d.value / maxValue) * (chartHeight - padding * 2);
                    
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="4" fill="#fbbf24" />
                        <text x={x} y={chartHeight - 10} textAnchor="middle" fill="#9ca3af" fontSize="10">
                          {d.age}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Gradients */}
                  <defs>
                    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="50%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                    <linearGradient id="goldGradientFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#1f2937" />
                    </linearGradient>
                  </defs>
                  
                  {/* Axis labels */}
                  <text x={chartWidth / 2} y={chartHeight - 2} textAnchor="middle" fill="#9ca3af" fontSize="11">
                    Age
                  </text>
                </svg>
              </div>
            </div>
            
            {/* Breakdown Cards */}
            {showBreakdown && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* VA Disability Pay */}
                <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/30 rounded-2xl p-6 border border-green-700/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-green-600 rounded-full p-2">
                      <span className="text-2xl">💵</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-green-300">VA Disability Pay</h4>
                      <p className="text-xs text-green-400/70">Monthly payments with 2.5% COLA</p>
                    </div>
                  </div>
                  <p className="text-3xl font-black text-green-400">{formatCurrency(calculation.totalVAPay)}</p>
                  <p className="text-sm text-green-300/70 mt-2">
                    {formatCurrency(calculation.monthlyPay)}/mo × {calculation.yearsRemaining} years
                  </p>
                </div>
                
                {/* Property Tax Savings */}
                <div className={`rounded-2xl p-6 border ${
                  rating === 100 
                    ? 'bg-gradient-to-br from-blue-900/50 to-indigo-900/30 border-blue-700/50'
                    : 'bg-gray-800/30 border-gray-700/50 opacity-50'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`rounded-full p-2 ${rating === 100 ? 'bg-blue-600' : 'bg-gray-600'}`}>
                      <span className="text-2xl">🏠</span>
                    </div>
                    <div>
                      <h4 className={`font-bold ${rating === 100 ? 'text-blue-300' : 'text-gray-400'}`}>
                        Property Tax Exemption
                      </h4>
                      <p className={`text-xs ${rating === 100 ? 'text-blue-400/70' : 'text-gray-500'}`}>
                        {state}: {STATE_PROPERTY_TAX_EXEMPTIONS[state]?.exemption || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <p className={`text-3xl font-black ${rating === 100 ? 'text-blue-400' : 'text-gray-500'}`}>
                    {formatCurrency(calculation.propertyTaxSavings)}
                  </p>
                  {rating !== 100 && (
                    <p className="text-xs text-gray-500 mt-2">*Requires 100% rating</p>
                  )}
                </div>
                
                {/* Chapter 35 DEA */}
                <div className={`rounded-2xl p-6 border ${
                  rating === 100 && (hasSpouse || numChildren > 0)
                    ? 'bg-gradient-to-br from-purple-900/50 to-violet-900/30 border-purple-700/50'
                    : 'bg-gray-800/30 border-gray-700/50 opacity-50'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`rounded-full p-2 ${rating === 100 ? 'bg-purple-600' : 'bg-gray-600'}`}>
                      <span className="text-2xl">🎓</span>
                    </div>
                    <div>
                      <h4 className={`font-bold ${rating === 100 ? 'text-purple-300' : 'text-gray-400'}`}>
                        Chapter 35 DEA Education
                      </h4>
                      <p className={`text-xs ${rating === 100 ? 'text-purple-400/70' : 'text-gray-500'}`}>
                        For spouse & children (100% P&T)
                      </p>
                    </div>
                  </div>
                  <p className={`text-3xl font-black ${rating === 100 ? 'text-purple-400' : 'text-gray-500'}`}>
                    {formatCurrency(calculation.educationValue)}
                  </p>
                  <p className={`text-sm mt-2 ${rating === 100 ? 'text-purple-300/70' : 'text-gray-500'}`}>
                    {hasSpouse || numChildren > 0 
                      ? `${formatCurrency(CHAPTER_35_DEA.totalValue)} × ${hasSpouse ? numChildren + 1 : numChildren} dependents`
                      : 'Add dependents to qualify'
                    }
                  </p>
                </div>
                
                {/* CHAMPVA Healthcare */}
                <div className={`rounded-2xl p-6 border ${
                  rating === 100 && (hasSpouse || numChildren > 0)
                    ? 'bg-gradient-to-br from-red-900/50 to-rose-900/30 border-red-700/50'
                    : 'bg-gray-800/30 border-gray-700/50 opacity-50'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`rounded-full p-2 ${rating === 100 ? 'bg-red-600' : 'bg-gray-600'}`}>
                      <span className="text-2xl">🏥</span>
                    </div>
                    <div>
                      <h4 className={`font-bold ${rating === 100 ? 'text-red-300' : 'text-gray-400'}`}>
                        CHAMPVA Healthcare
                      </h4>
                      <p className={`text-xs ${rating === 100 ? 'text-red-400/70' : 'text-gray-500'}`}>
                        Family healthcare coverage value
                      </p>
                    </div>
                  </div>
                  <p className={`text-3xl font-black ${rating === 100 ? 'text-red-400' : 'text-gray-500'}`}>
                    {formatCurrency(calculation.healthcareValue)}
                  </p>
                  <p className={`text-sm mt-2 ${rating === 100 ? 'text-red-300/70' : 'text-gray-500'}`}>
                    ~{formatCurrency(CHAMPVA_ANNUAL_VALUE)}/year premium savings
                  </p>
                </div>
              </div>
            )}
            
            {/* Motivational Message */}
            <div className="bg-gradient-to-r from-amber-900/30 via-yellow-900/30 to-amber-900/30 rounded-2xl p-6 border border-amber-700/50 text-center">
              <p className="text-xl text-amber-200 font-semibold mb-2">
                "You aren't fighting for pocket change."
              </p>
              <p className="text-amber-300/70">
                You're fighting for your family's <span className="font-bold text-amber-200">generational wealth</span>.
              </p>
            </div>
            
            {/* Disclaimer */}
            <div className="bg-gray-800/30 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500">
                ⚠️ These are estimates for educational purposes only. Actual values depend on individual circumstances, 
                VA policy changes, state laws, and other factors. COLA rates vary annually. Consult a financial advisor 
                for personal planning. Property tax exemptions vary by state and locality.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                <strong>Note:</strong> This calculator shows base VA compensation rates. Veterans receiving Special Monthly Compensation (SMC) 
                at any level (SMC-K, SMC-L, SMC-S, etc.) will have higher lifetime values not reflected here.
              </p>
            </div>
            
            {/* Support CTA - contextual */}
            <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 rounded-2xl p-6 border border-emerald-700/50">
              <div className="flex items-center gap-4">
                <img 
                  src="/images/Anth.jpg" 
                  alt="Anthony - Vet-Rate Developer"
                  className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 shadow-lg flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="text-emerald-200 font-semibold mb-1">
                    💚 Did this open your eyes?
                  </p>
                  <p className="text-emerald-300/70 text-sm">
                    Most vets never see these numbers. This calculator took months to build - 
                    property tax data for all 50 states, COLA projections, education benefits. 
                    Help keep it free for every veteran who needs to see their true worth.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* BuyMeCoffee - shows after viewing total */}
      <BuyMeCoffee 
        show={animatedTotal > 0} 
        trigger="million-dollar" 
        context={{ total: `$${Math.round(calculation.grandTotal).toLocaleString()}` }}
      />
    </div>
  );
}
