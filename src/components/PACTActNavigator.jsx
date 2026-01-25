/**
 * SupplyLocker.org - PACT Act Navigator
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * HARD-CODED presumptive condition logic tree
 * NO AI - Pure rule-based matching for accuracy
 * 
 * Covers:
 * - Vietnam/Agent Orange Era (1962-1975)
 * - Gulf War Era (1990-present)
 * - Post-9/11 / Burn Pits (2001-present)
 * 
 * The PACT Act (Promise to Address Comprehensive Toxics Act of 2022)
 * is the largest expansion of VA healthcare and benefits in 30 years.
 */

import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import BuyMeCoffee from './BuyMeCoffee';
import { FocusToggle } from '../contexts/FocusModeContext';
import ReportBugLink from './ReportBugLink';

/**
 * COMPREHENSIVE PACT ACT DATA
 * Based on 38 CFR and PACT Act of 2022
 */
const PACT_ACT_DATA = {
  // AGENT ORANGE / HERBICIDE EXPOSURE
  agentOrange: {
    name: 'Agent Orange / Herbicide Exposure',
    icon: '🌿',
    description: 'Veterans exposed to Agent Orange or other tactical herbicides during military service',
    locations: [
      { name: 'Vietnam', dates: '1962-1975', description: 'Republic of Vietnam, including waters offshore and airspace' },
      { name: 'Korean DMZ', dates: '1968-1971', description: 'Demilitarized Zone in Korea' },
      { name: 'Thailand (U.S. Military Bases)', dates: '1962-1975', description: 'Royal Thai Air Force Bases: U-Tapao, Korat, Nakhon Phanom, Udorn, Takhli, Don Muang' },
      { name: 'Laos', dates: '1965-1975', description: 'Secret War operations' },
      { name: 'Cambodia', dates: '1969-1975', description: 'Border operations and incursions' },
      { name: 'Guam', dates: '1962-1975', description: 'Andersen Air Force Base (storing/testing)' },
      { name: 'American Samoa', dates: '1962-1975', description: 'Testing and storage areas' },
      { name: 'Johnston Atoll', dates: '1972-1977', description: 'Herbicide destruction operations' },
    ],
    conditions: [
      { name: 'AL Amyloidosis', presumptive: true },
      { name: 'Bladder Cancer', presumptive: true, pactAdded: true },
      { name: 'Chronic B-cell Leukemias', presumptive: true },
      { name: 'Chloracne', presumptive: true, notes: 'Must manifest within 1 year of exposure' },
      { name: 'Diabetes Mellitus Type 2', presumptive: true },
      { name: 'High Blood Pressure (Hypertension)', presumptive: true, pactAdded: true },
      { name: 'Hodgkin\'s Disease', presumptive: true },
      { name: 'Hypothyroidism', presumptive: true, pactAdded: true },
      { name: 'Ischemic Heart Disease', presumptive: true },
      { name: 'Monoclonal Gammopathy of Undetermined Significance (MGUS)', presumptive: true, pactAdded: true },
      { name: 'Multiple Myeloma', presumptive: true },
      { name: 'Non-Hodgkin\'s Lymphoma', presumptive: true },
      { name: 'Parkinson\'s Disease', presumptive: true },
      { name: 'Parkinsonism', presumptive: true, pactAdded: true },
      { name: 'Peripheral Neuropathy (Early Onset)', presumptive: true },
      { name: 'Porphyria Cutanea Tarda', presumptive: true, notes: 'Must manifest within 1 year of exposure' },
      { name: 'Prostate Cancer', presumptive: true },
      { name: 'Respiratory Cancers', presumptive: true, notes: 'Lung, bronchus, larynx, trachea' },
      { name: 'Soft Tissue Sarcomas', presumptive: true },
    ]
  },
  
  // GULF WAR PRESUMPTIVES
  gulfWar: {
    name: 'Gulf War Illness',
    icon: '🏜️',
    description: 'Veterans who served in Southwest Asia during the Gulf War era',
    locations: [
      { name: 'Iraq', dates: '1990-present', description: 'All areas including airspace' },
      { name: 'Kuwait', dates: '1990-present', description: 'Including airspace' },
      { name: 'Saudi Arabia', dates: '1990-present', description: 'Including airspace' },
      { name: 'Bahrain', dates: '1990-present', description: 'Including waters and airspace' },
      { name: 'Qatar', dates: '1990-present', description: 'Including airspace' },
      { name: 'United Arab Emirates', dates: '1990-present', description: 'Including airspace' },
      { name: 'Oman', dates: '1990-present', description: 'Including airspace' },
      { name: 'Persian Gulf', dates: '1990-present', description: 'Waters of the Persian Gulf' },
      { name: 'Gulf of Aden', dates: '1990-present', description: 'Waters of the Gulf of Aden' },
      { name: 'Gulf of Oman', dates: '1990-present', description: 'Waters of the Gulf of Oman' },
      { name: 'Red Sea', dates: '1990-present', description: 'Waters of the Red Sea' },
      { name: 'Arabian Sea', dates: '1990-present', description: 'Waters of the Arabian Sea' },
    ],
    conditions: [
      { name: 'Chronic Fatigue Syndrome', presumptive: true },
      { name: 'Fibromyalgia', presumptive: true },
      { name: 'Functional Gastrointestinal Disorders', presumptive: true, notes: 'IBS, functional dyspepsia, etc.' },
      { name: 'Undiagnosed Illnesses', presumptive: true, notes: 'Medically unexplained chronic multi-symptom illness' },
      { name: 'Infectious Diseases', presumptive: true, notes: 'Including brucellosis, malaria, leishmaniasis, tuberculosis, West Nile virus, and others acquired in Southwest Asia' },
    ]
  },
  
  // BURN PIT / POST-9/11 PRESUMPTIVES (PACT ACT MAIN FOCUS)
  burnPit: {
    name: 'Burn Pit / Toxic Exposure',
    icon: '🔥',
    description: 'Veterans exposed to burn pits or other toxic exposures post-9/11',
    locations: [
      { name: 'Afghanistan', dates: '2001-present', description: 'All areas including airspace' },
      { name: 'Iraq', dates: '2003-present', description: 'All areas including airspace' },
      { name: 'Syria', dates: '2014-present', description: 'All areas including airspace' },
      { name: 'Jordan', dates: '2001-present', description: 'Including airspace' },
      { name: 'Egypt', dates: '2001-present', description: 'Including airspace' },
      { name: 'Lebanon', dates: '2001-present', description: 'Including airspace' },
      { name: 'Yemen', dates: '2001-present', description: 'Including airspace' },
      { name: 'Djibouti', dates: '2001-present', description: 'Including Camp Lemonnier' },
      { name: 'Uzbekistan', dates: '2001-2005', description: 'Karshi-Khanabad (K2) Air Base' },
      { name: 'Somalia', dates: '2001-present', description: 'Including airspace' },
      { name: 'Other Southwest Asia', dates: '2001-present', description: 'Various operations' },
    ],
    conditions: [
      // Respiratory Conditions - PACT Act Added
      { name: 'Asthma (diagnosed during or after service)', presumptive: true, pactAdded: true },
      { name: 'Rhinitis', presumptive: true, pactAdded: true },
      { name: 'Sinusitis', presumptive: true, pactAdded: true },
      { name: 'Constrictive Bronchiolitis', presumptive: true, pactAdded: true },
      { name: 'Interstitial Lung Disease', presumptive: true, pactAdded: true },
      { name: 'Pleuritis', presumptive: true, pactAdded: true },
      { name: 'Pulmonary Fibrosis', presumptive: true, pactAdded: true },
      { name: 'Sarcoidosis', presumptive: true, pactAdded: true },
      { name: 'Chronic Obstructive Pulmonary Disease (COPD)', presumptive: true, pactAdded: true },
      { name: 'Bronchiectasis', presumptive: true, pactAdded: true },
      { name: 'Chronic Rhinosinusitis', presumptive: true, pactAdded: true },
      { name: 'Granulomatous Disease', presumptive: true, pactAdded: true },
      
      // Cancers - PACT Act Added
      { name: 'Head Cancer (of any type)', presumptive: true, pactAdded: true },
      { name: 'Neck Cancer (of any type)', presumptive: true, pactAdded: true },
      { name: 'Respiratory Cancer', presumptive: true, pactAdded: true },
      { name: 'Gastrointestinal Cancer (of any type)', presumptive: true, pactAdded: true },
      { name: 'Reproductive Cancer (of any type)', presumptive: true, pactAdded: true },
      { name: 'Lymphoma (of any type)', presumptive: true, pactAdded: true },
      { name: 'Lymphomatic Cancer (of any type)', presumptive: true, pactAdded: true },
      { name: 'Kidney Cancer', presumptive: true, pactAdded: true },
      { name: 'Brain Cancer', presumptive: true, pactAdded: true },
      { name: 'Melanoma', presumptive: true, pactAdded: true },
      { name: 'Pancreatic Cancer', presumptive: true, pactAdded: true },
      { name: 'Glioblastoma', presumptive: true, pactAdded: true },
    ]
  },
  
  // RADIATION EXPOSURE
  radiation: {
    name: 'Radiation Exposure',
    icon: '☢️',
    description: 'Veterans exposed to ionizing radiation during military service',
    locations: [
      { name: 'Hiroshima/Nagasaki', dates: '1945-1946', description: 'Occupation of Japan after WWII' },
      { name: 'Nevada Test Site', dates: '1945-1962', description: 'Atmospheric nuclear testing' },
      { name: 'Pacific Proving Grounds', dates: '1946-1958', description: 'Marshall Islands testing' },
      { name: 'Enewetak Atoll', dates: '1977-1980', description: 'Cleanup operations' },
      { name: 'Various Nuclear Facilities', dates: '1942-present', description: 'Certain DOE facilities, longshore workers loading nuclear materials' },
    ],
    conditions: [
      { name: 'All Cancers', presumptive: true, notes: 'All forms of cancer for radiation-exposed veterans' },
      { name: 'Leukemia', presumptive: true },
      { name: 'Multiple Myeloma', presumptive: true },
      { name: 'Lymphomas', presumptive: true },
      { name: 'Primary Liver Cancer', presumptive: true },
      { name: 'Thyroid Cancer', presumptive: true },
      { name: 'Bone Cancer', presumptive: true },
      { name: 'Breast Cancer', presumptive: true },
    ]
  },
  
  // CAMP LEJEUNE WATER CONTAMINATION
  campLejeune: {
    name: 'Camp Lejeune Water Contamination',
    icon: '💧',
    description: 'Veterans and family members exposed to contaminated water at Camp Lejeune',
    locations: [
      { name: 'Camp Lejeune, NC', dates: '1953-1987', description: 'Must have resided or worked at Camp Lejeune for at least 30 cumulative days' },
      { name: 'MCAS New River, NC', dates: '1953-1987', description: 'Adjacent Marine Corps Air Station' },
    ],
    conditions: [
      { name: 'Adult Leukemia', presumptive: true },
      { name: 'Aplastic Anemia and Other Myelodysplastic Syndromes', presumptive: true },
      { name: 'Bladder Cancer', presumptive: true },
      { name: 'Kidney Cancer', presumptive: true },
      { name: 'Liver Cancer', presumptive: true },
      { name: 'Multiple Myeloma', presumptive: true },
      { name: 'Non-Hodgkin\'s Lymphoma', presumptive: true },
      { name: 'Parkinson\'s Disease', presumptive: true },
    ]
  }
};

/**
 * Check if a condition is presumptive for given exposure and location
 */
const checkPresumptiveStatus = (exposureType, location, condition) => {
  const exposure = PACT_ACT_DATA[exposureType];
  if (!exposure) return null;
  
  // Check if location qualifies
  const locationMatch = exposure.locations.find(l => l.name === location);
  if (!locationMatch) return null;
  
  // Check if condition is presumptive
  const conditionMatch = exposure.conditions.find(c => 
    c.name.toLowerCase() === condition.toLowerCase() ||
    c.name.toLowerCase().includes(condition.toLowerCase()) ||
    condition.toLowerCase().includes(c.name.toLowerCase())
  );
  
  return conditionMatch || null;
};

export default function PACTActNavigator({ onClose, onReportBug }) {
  const { t } = useLanguage();
  // Lock body scroll when modal is open
  useBodyScrollLock(true);
  
  // Navigation state
  const [step, setStep] = useState(1);
  const [selectedExposure, setSelectedExposure] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [serviceDates, setServiceDates] = useState({ start: '', end: '' });
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Results
  const [results, setResults] = useState(null);
  
  /**
   * Get exposure data
   */
  const getExposureData = () => PACT_ACT_DATA[selectedExposure];
  
  /**
   * Filter conditions based on search
   */
  const getFilteredConditions = () => {
    if (!selectedExposure) return [];
    const conditions = PACT_ACT_DATA[selectedExposure].conditions;
    if (!searchQuery.trim()) return conditions;
    
    return conditions.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };
  
  /**
   * Toggle condition selection
   */
  const toggleCondition = (condition) => {
    setSelectedConditions(prev => 
      prev.includes(condition)
        ? prev.filter(c => c !== condition)
        : [...prev, condition]
    );
  };
  
  /**
   * Analyze presumptive status
   */
  const analyzeResults = () => {
    const exposure = PACT_ACT_DATA[selectedExposure];
    const locationData = exposure.locations.find(l => l.name === selectedLocation);
    
    const conditionResults = selectedConditions.map(condName => {
      const condData = exposure.conditions.find(c => c.name === condName);
      return {
        name: condName,
        presumptive: condData?.presumptive || false,
        pactAdded: condData?.pactAdded || false,
        notes: condData?.notes || null
      };
    });
    
    setResults({
      exposure: exposure.name,
      location: selectedLocation,
      locationDates: locationData?.dates,
      locationDescription: locationData?.description,
      serviceDates,
      conditions: conditionResults,
      presumptiveCount: conditionResults.filter(c => c.presumptive).length,
      totalConditions: conditionResults.length
    });
    
    setStep(4);
  };
  
  /**
   * Render Step 1: Exposure Type Selection
   */
  const renderExposureSelection = () => (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* What is PACT Act */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📜</span>
          <div>
            <h3 className="font-bold text-blue-800 dark:text-blue-200">What is the PACT Act?</h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
              The <strong>Promise to Address Comprehensive Toxics Act of 2022</strong> is the largest expansion of VA healthcare 
              and benefits in 30 years. It creates <strong>presumptive service connection</strong> for many conditions - meaning 
              you don't have to prove your illness is connected to service, the VA presumes it.
            </p>
          </div>
        </div>
      </div>
      
      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
        What type of exposure did you experience?
      </h3>
      
      <div className="grid gap-4">
        {Object.entries(PACT_ACT_DATA).map(([key, data]) => (
          <button
            key={key}
            onClick={() => { setSelectedExposure(key); setStep(2); }}
            className={`text-left p-6 rounded-xl border-2 transition-all hover:shadow-lg ${
              selectedExposure === key
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-start gap-4">
              <span className="text-4xl">{data.icon}</span>
              <div>
                <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100">{data.name}</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">{data.description}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                    {data.locations.length} locations
                  </span>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs rounded">
                    {data.conditions.length} presumptive conditions
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
  
  /**
   * Render Step 2: Location Selection
   */
  const renderLocationSelection = () => {
    const exposure = getExposureData();
    
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
          <button onClick={() => setStep(1)} className="hover:text-blue-500">Exposure Type</button>
          <span>→</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">Location</span>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{exposure.icon}</span>
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{exposure.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Select where you served</p>
            </div>
          </div>
          
          <div className="grid gap-3">
            {exposure.locations.map(loc => (
              <button
                key={loc.name}
                onClick={() => { setSelectedLocation(loc.name); setStep(3); }}
                className={`text-left p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                  selectedLocation === loc.name
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{loc.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{loc.description}</p>
                  </div>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                    {loc.dates}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
        
        <button
          onClick={() => setStep(1)}
          className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          ← Back to Exposure Selection
        </button>
      </div>
    );
  };
  
  /**
   * Render Step 3: Condition Selection
   */
  const renderConditionSelection = () => {
    const exposure = getExposureData();
    const locationData = exposure.locations.find(l => l.name === selectedLocation);
    const filteredConditions = getFilteredConditions();
    
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
          <button onClick={() => setStep(1)} className="hover:text-blue-500">Exposure Type</button>
          <span>→</span>
          <button onClick={() => setStep(2)} className="hover:text-blue-500">Location</button>
          <span>→</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">Conditions</span>
        </div>
        
        {/* Selected Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-4">
            <span className="text-3xl">{exposure.icon}</span>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100">{exposure.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                📍 {selectedLocation} • {locationData?.dates}
              </p>
            </div>
          </div>
        </div>
        
        {/* Service Dates (Optional) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
          <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">
            When did you serve there? (Optional)
          </h4>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">From</label>
              <input
                type="month"
                value={serviceDates.start}
                onChange={(e) => setServiceDates(prev => ({ ...prev, start: e.target.value }))}
                className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">To</label>
              <input
                type="month"
                value={serviceDates.end}
                onChange={(e) => setServiceDates(prev => ({ ...prev, end: e.target.value }))}
                className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        </div>
        
        {/* Condition Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">
              What conditions do you have? (Select all that apply)
            </h4>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conditions..."
              className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            />
          </div>
          
          <div className="max-h-96 overflow-y-auto p-4 space-y-2">
            {filteredConditions.map(cond => (
              <button
                key={cond.name}
                onClick={() => toggleCondition(cond.name)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                  selectedConditions.includes(cond.name)
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 dark:text-gray-100">
                      {selectedConditions.includes(cond.name) ? '✓ ' : ''}{cond.name}
                    </p>
                    {cond.notes && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{cond.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-1 text-xs rounded ${
                      cond.presumptive 
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {cond.presumptive ? '✓ Presumptive' : 'Not Presumptive'}
                    </span>
                    {cond.pactAdded && (
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs rounded">
                        🆕 PACT Act
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Selected Summary */}
        {selectedConditions.length > 0 && (
          <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4 rounded-r-lg">
            <p className="font-semibold text-green-800 dark:text-green-200">
              {selectedConditions.length} condition{selectedConditions.length > 1 ? 's' : ''} selected
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              {selectedConditions.slice(0, 3).join(', ')}{selectedConditions.length > 3 ? '...' : ''}
            </p>
          </div>
        )}
        
        {/* Navigation */}
        <div className="flex gap-4">
          <button
            onClick={() => setStep(2)}
            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={analyzeResults}
            disabled={selectedConditions.length === 0}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Check Presumptive Status →
          </button>
        </div>
      </div>
    );
  };
  
  /**
   * Render Step 4: Results
   */
  const renderResults = () => {
    if (!results) return null;
    
    const presumptiveConditions = results.conditions.filter(c => c.presumptive);
    const nonPresumptiveConditions = results.conditions.filter(c => !c.presumptive);
    const pactAddedConditions = results.conditions.filter(c => c.pactAdded);
    
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Success/Status Banner */}
        <div className={`rounded-xl p-6 text-white shadow-lg ${
          results.presumptiveCount > 0 
            ? 'bg-gradient-to-r from-green-500 to-emerald-600'
            : 'bg-gradient-to-r from-amber-500 to-orange-500'
        }`}>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 rounded-full p-3">
              <span className="text-4xl">{results.presumptiveCount > 0 ? '✅' : '⚠️'}</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold">
                {results.presumptiveCount > 0 
                  ? `${results.presumptiveCount} Presumptive Condition${results.presumptiveCount > 1 ? 's' : ''} Found!`
                  : 'No Presumptive Conditions Found'
                }
              </h3>
              <p className="text-white/90">
                {results.presumptiveCount > 0 
                  ? 'You may qualify for expedited service connection under the PACT Act'
                  : 'You may still qualify on a direct connection basis'
                }
              </p>
            </div>
          </div>
        </div>
        
        {/* Exposure Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-4">📋 Your Exposure Profile</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Exposure Type</p>
              <p className="font-medium text-gray-800 dark:text-gray-100">{results.exposure}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
              <p className="font-medium text-gray-800 dark:text-gray-100">{results.location}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Qualifying Dates</p>
              <p className="font-medium text-gray-800 dark:text-gray-100">{results.locationDates}</p>
            </div>
            {results.serviceDates.start && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Your Service Dates</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">
                  {results.serviceDates.start} to {results.serviceDates.end || 'present'}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Presumptive Conditions */}
        {presumptiveConditions.length > 0 && (
          <div className="bg-green-50 dark:bg-green-900/30 rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 bg-green-100 dark:bg-green-900/50 border-b border-green-200 dark:border-green-700">
              <h4 className="font-bold text-green-800 dark:text-green-200 flex items-center gap-2">
                ✅ Presumptive Conditions ({presumptiveConditions.length})
              </h4>
              <p className="text-sm text-green-600 dark:text-green-400">
                VA will presume these are related to your service - no nexus letter required!
              </p>
            </div>
            <div className="divide-y divide-green-200 dark:divide-green-700">
              {presumptiveConditions.map(cond => (
                <div key={cond.name} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">{cond.name}</p>
                      {cond.notes && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">{cond.notes}</p>
                      )}
                    </div>
                    {cond.pactAdded && (
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs rounded font-medium">
                        🆕 PACT Act Added
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Non-Presumptive Conditions */}
        {nonPresumptiveConditions.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 bg-amber-100 dark:bg-amber-900/50 border-b border-amber-200 dark:border-amber-700">
              <h4 className="font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                ⚠️ Not Currently Presumptive ({nonPresumptiveConditions.length})
              </h4>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                You can still claim these conditions but will need medical evidence/nexus
              </p>
            </div>
            <div className="divide-y divide-amber-200 dark:divide-amber-700">
              {nonPresumptiveConditions.map(cond => (
                <div key={cond.name} className="p-4">
                  <p className="font-medium text-amber-800 dark:text-amber-200">{cond.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* PACT Act Info */}
        {pactAddedConditions.length > 0 && (
          <div className="bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-500 p-4 rounded-r-lg">
            <h4 className="font-bold text-purple-800 dark:text-purple-200 mb-2">🆕 New Under PACT Act</h4>
            <p className="text-purple-700 dark:text-purple-300 text-sm">
              {pactAddedConditions.length} of your conditions were added as presumptive by the PACT Act in 2022. 
              These claims are now much easier to win!
            </p>
          </div>
        )}
        
        {/* Next Steps */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-3">📋 Next Steps</h4>
          <ol className="text-blue-700 dark:text-blue-300 text-sm space-y-2 list-decimal list-inside">
            {presumptiveConditions.length > 0 ? (
              <>
                <li>Gather proof you served in the qualifying location (DD-214, orders, personnel records)</li>
                <li>Get a current diagnosis for each condition from your doctor</li>
                <li>File your claim on VA.gov or eBenefits - select the presumptive exposure</li>
                <li><strong>No nexus letter needed</strong> for presumptive conditions!</li>
              </>
            ) : (
              <>
                <li>Gather proof you served in the qualifying location</li>
                <li>Get a current diagnosis for each condition</li>
                <li>Obtain a nexus letter from a doctor linking your condition to service</li>
                <li>File your claim with supporting evidence</li>
              </>
            )}
          </ol>
        </div>
        
        {/* CFR Reference */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
          <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2">📚 Legal References</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>• PACT Act of 2022 (Public Law 117-168)</li>
            <li>• 38 CFR § 3.309 - Presumptive service connection</li>
            <li>• 38 CFR § 3.317 - Gulf War presumptives</li>
            <li>• 38 CFR § 3.311 - Radiation exposure</li>
          </ul>
        </div>
        
        {/* Start Over */}
        <button
          onClick={() => {
            setStep(1);
            setSelectedExposure(null);
            setSelectedLocation(null);
            setSelectedConditions([]);
            setServiceDates({ start: '', end: '' });
            setSearchQuery('');
            setResults(null);
          }}
          className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          🔄 Check Another Exposure
        </button>
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
        <div className="flex-shrink-0 bg-gradient-to-r from-amber-600 to-orange-600 p-4 shadow-lg rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔥</span>
              <div>
                <h2 className="text-xl font-bold text-white">PACT Act Navigator</h2>
                <p className="text-sm text-amber-100">Presumptive Condition Checker</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="PACT Act Navigator" />}
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
        <div className="overflow-y-auto flex-1 p-4">
          {/* Progress Steps */}
          <div className="max-w-4xl mx-auto px-2 pt-2">
            <div className="flex items-center justify-center gap-4 mb-6">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {step > s ? '✓' : s}
                  </div>
                  {s < 4 && (
                    <div className={`w-12 h-1 ${step > s ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-6">
              <span className={step === 1 ? 'font-bold text-blue-600' : ''}>Exposure</span>
              <span className={step === 2 ? 'font-bold text-blue-600' : ''}>Location</span>
              <span className={step === 3 ? 'font-bold text-blue-600' : ''}>Conditions</span>
              <span className={step === 4 ? 'font-bold text-blue-600' : ''}>Results</span>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="max-w-4xl mx-auto p-6 pt-0">
            {step === 1 && renderExposureSelection()}
            {step === 2 && renderLocationSelection()}
            {step === 3 && renderConditionSelection()}
            {step === 4 && renderResults()}
            
            {/* Support CTA on results page */}
            {step === 4 && results && results?.presumptive?.length > 0 && (
              <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 rounded-2xl p-6 border border-blue-700/50 mt-6">
                <div className="flex items-center gap-4">
                  <img 
                    src="/images/Anth.jpg" 
                    alt="Anthony - SupplyLocker Developer"
                    className="w-14 h-14 rounded-full object-cover border-2 border-blue-500 shadow-lg flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-blue-200 font-semibold mb-1">
                      🔥 You just saved $1,500+ on nexus letters
                    </p>
                    <p className="text-blue-300/70 text-sm">
                      Presumptive conditions don't require expensive medical nexus letters - the VA MUST 
                      grant them if you served in the right place at the right time. This database 
                      took months to compile from 38 CFR and the PACT Act. Keep it free.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* BuyMeCoffee - shows on results page */}
        <BuyMeCoffee 
          show={step === 4 && results?.presumptive?.length > 0} 
          trigger="pact-act" 
          context={{ condition: results?.presumptive?.[0]?.name }}
        />
      </div>
    </div>
  );
}
