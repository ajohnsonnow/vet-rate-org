/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 */

import React, { useState, useEffect } from 'react';
import { findSecondaryClaims, getSecondaryClaimsSummary, filterByProbability } from '../utils/secondaryClaimsEngine.js';
import { saveClaim, isClaimSaved } from '../utils/claimsStorage.js';
import BuyMeCoffee from './BuyMeCoffee';
import DoctorsPacket from './DoctorsPacket';

/**
 * SecondaryScout Component
 * Main UI for the Secondary Conditions Scout module
 * Displays potential secondary claims based on user's service-connected disabilities
 */
const SecondaryScout = ({ userDisabilities = [], onLearnHow, onViewPacket }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [probabilityFilter, setProbabilityFilter] = useState('Medium'); // 'High' or 'Medium'
  const [savedClaims, setSavedClaims] = useState(new Set());
  const [selectedForPacket, setSelectedForPacket] = useState(new Set());
  // Doctor's Packet modal state
  const [showDoctorsPacket, setShowDoctorsPacket] = useState(false);
  const [packetPrimary, setPacketPrimary] = useState('');
  const [packetSecondary, setPacketSecondary] = useState('');

  useEffect(() => {
    if (userDisabilities && userDisabilities.length > 0) {
      const results = findSecondaryClaims(userDisabilities);
      setSuggestions(results);
      setFilteredSuggestions(filterByProbability(results, probabilityFilter));
      setSummary(getSecondaryClaimsSummary(results));
      
      // Check which claims are already saved
      const saved = new Set();
      results.forEach(suggestion => {
        if (isClaimSaved(suggestion.secondaryCondition, suggestion.primaryCondition)) {
          saved.add(`${suggestion.secondaryCondition}-${suggestion.primaryCondition}`);
        }
      });
      setSavedClaims(saved);
    } else {
      setSuggestions([]);
      setFilteredSuggestions([]);
      setSummary(null);
    }
  }, [userDisabilities]);

  useEffect(() => {
    setFilteredSuggestions(filterByProbability(suggestions, probabilityFilter));
  }, [probabilityFilter, suggestions]);

  const handleSaveClaim = (suggestion) => {
    const claimKey = `${suggestion.secondaryCondition}-${suggestion.primaryCondition}`;
    
    if (!savedClaims.has(claimKey)) {
      const saved = saveClaim({
        conditionName: suggestion.secondaryCondition,
        parentCondition: suggestion.primaryCondition,
        probability: suggestion.probability,
        mechanism: suggestion.mechanism,
        nexusTheory: suggestion.nexusTheory,
        medicalCitations: suggestion.medicalCitations,
        status: 'Drafting'
      });
      
      if (saved) {
        setSavedClaims(prev => new Set([...prev, claimKey]));
      }
    }
  };

  const handleLearnHow = (suggestion) => {
    // Save the claim first if not already saved
    handleSaveClaim(suggestion);
    // Then open the Nexus Builder
    if (onLearnHow) {
      onLearnHow(suggestion);
    }
  };

  const isClaimAlreadySaved = (suggestion) => {
    return savedClaims.has(`${suggestion.secondaryCondition}-${suggestion.primaryCondition}`);
  };

  // Selection handlers for bulk add to packet
  const toggleSelectForPacket = (suggestion) => {
    const claimKey = `${suggestion.secondaryCondition}-${suggestion.primaryCondition}`;
    setSelectedForPacket(prev => {
      const newSet = new Set(prev);
      if (newSet.has(claimKey)) {
        newSet.delete(claimKey);
      } else {
        newSet.add(claimKey);
      }
      return newSet;
    });
  };

  const isSelectedForPacket = (suggestion) => {
    return selectedForPacket.has(`${suggestion.secondaryCondition}-${suggestion.primaryCondition}`);
  };

  const selectAllFiltered = () => {
    const newSet = new Set(selectedForPacket);
    filteredSuggestions.forEach(suggestion => {
      const claimKey = `${suggestion.secondaryCondition}-${suggestion.primaryCondition}`;
      // Only select if not already saved
      if (!savedClaims.has(claimKey)) {
        newSet.add(claimKey);
      }
    });
    setSelectedForPacket(newSet);
  };

  const clearSelection = () => {
    setSelectedForPacket(new Set());
  };

  const addSelectedToPacket = () => {
    let addedCount = 0;
    filteredSuggestions.forEach(suggestion => {
      const claimKey = `${suggestion.secondaryCondition}-${suggestion.primaryCondition}`;
      if (selectedForPacket.has(claimKey) && !savedClaims.has(claimKey)) {
        const saved = saveClaim({
          conditionName: suggestion.secondaryCondition,
          parentCondition: suggestion.primaryCondition,
          probability: suggestion.probability,
          mechanism: suggestion.mechanism,
          nexusTheory: suggestion.nexusTheory,
          medicalCitations: suggestion.medicalCitations,
          status: 'Drafting'
        });
        if (saved) {
          addedCount++;
        }
      }
    });
    
    // Update saved claims state
    const newSavedClaims = new Set(savedClaims);
    selectedForPacket.forEach(key => newSavedClaims.add(key));
    setSavedClaims(newSavedClaims);
    
    // Clear selection
    setSelectedForPacket(new Set());
    
    // Show success message
    if (addedCount > 0) {
      alert(`Successfully added ${addedCount} claim${addedCount > 1 ? 's' : ''} to My Packet!`);
    }
  };

  // Count how many selected are not already saved
  const getUnsavedSelectedCount = () => {
    let count = 0;
    selectedForPacket.forEach(key => {
      if (!savedClaims.has(key)) count++;
    });
    return count;
  };

  const getMechanismBadgeColor = (mechanism) => {
    switch (mechanism) {
      case 'Direct':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Medication':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Altered Gait':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getProbabilityBadgeColor = (probability) => {
    switch (probability) {
      case 'High':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (!userDisabilities || userDisabilities.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                Enter your current service-connected disabilities to discover potential secondary claims you may be eligible for under 38 CFR § 3.310.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🔍 Secondary Scout</h1>
        <p className="text-gray-600">
          Potential secondary claims based on your service-connected disabilities (38 CFR § 3.310)
        </p>
      </div>

      {/* Summary Statistics */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-2xl font-bold text-gray-900">{summary.totalSuggestions}</div>
            <div className="text-sm text-gray-600">📊 Total Suggestions</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="text-2xl font-bold text-gray-900">{summary.highProbability}</div>
            <div className="text-sm text-gray-600">🔥 High Probability</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="text-2xl font-bold text-gray-900">{summary.byMechanism.medication}</div>
            <div className="text-sm text-gray-600">💊 Medication-Related</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-2xl font-bold text-gray-900">{summary.byMechanism.alteredGait}</div>
            <div className="text-sm text-gray-600">🚶 Biomechanical</div>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter by Probability:</label>
            <div className="flex gap-2">
              <button
                onClick={() => setProbabilityFilter('High')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  probabilityFilter === 'High'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                High Only
              </button>
              <button
                onClick={() => setProbabilityFilter('Medium')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  probabilityFilter === 'Medium'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                High & Medium
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAllFiltered}
              className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              Select All
            </button>
            {selectedForPacket.size > 0 && (
              <button
                onClick={clearSelection}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                Clear Selection
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Suggestions Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredSuggestions.map((suggestion, index) => (
          <SecondaryConditionCard
            key={index}
            suggestion={suggestion}
            isExpanded={selectedCondition === index}
            onToggle={() => setSelectedCondition(selectedCondition === index ? null : index)}
            getMechanismBadgeColor={getMechanismBadgeColor}
            getProbabilityBadgeColor={getProbabilityBadgeColor}
            onLearnHow={() => handleLearnHow(suggestion)}
            onSave={() => handleSaveClaim(suggestion)}
            isSaved={isClaimAlreadySaved(suggestion)}
            onViewPacket={onViewPacket}
            isSelected={isSelectedForPacket(suggestion)}
            onToggleSelect={() => toggleSelectForPacket(suggestion)}
            onGetDoctorsPacket={() => {
              setPacketPrimary(suggestion.primaryCondition);
              setPacketSecondary(suggestion.secondaryCondition);
              setShowDoctorsPacket(true);
            }}
          />
        ))}
      </div>

      {/* Floating Action Bar for Selected Items */}
      {selectedForPacket.size > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-2 right-2 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-40">
          <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-3 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="font-semibold text-sm sm:text-base">
                {selectedForPacket.size} claim{selectedForPacket.size > 1 ? 's' : ''} selected
              </span>
              {getUnsavedSelectedCount() < selectedForPacket.size && (
                <span className="text-blue-200 text-xs sm:text-sm hidden sm:inline">
                  ({selectedForPacket.size - getUnsavedSelectedCount()} saved)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={addSelectedToPacket}
                disabled={getUnsavedSelectedCount() === 0}
                className="flex-1 sm:flex-none bg-white text-blue-600 px-3 sm:px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="hidden xs:inline">Add to </span>Packet
              </button>
              <button
                onClick={clearSelection}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                title="Clear selection"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredSuggestions.length === 0 && suggestions.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          No suggestions match the current filter. Try selecting "High & Medium".
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              <strong>Important:</strong> These suggestions are educational tools based on 38 CFR § 3.310 principles. 
              Consult with a VA-accredited representative or medical professional before filing a secondary claim. 
              A medical nexus opinion from a qualified physician is required to establish service connection.
            </p>
          </div>
        </div>
      </div>

      {/* Buy Me a Coffee - shows when results found */}
      <BuyMeCoffee 
        show={filteredSuggestions.length > 0} 
        trigger="secondary-scout"
        context={{ count: filteredSuggestions.length }}
      />
      
      {/* Doctor's Packet Modal */}
      <DoctorsPacket 
        isOpen={showDoctorsPacket}
        onClose={() => setShowDoctorsPacket(false)}
        primaryCondition={packetPrimary}
        secondaryCondition={packetSecondary}
      />
    </div>
  );
};

/**
 * Individual Secondary Condition Card Component
 */
const SecondaryConditionCard = ({ 
  suggestion, 
  isExpanded, 
  onToggle, 
  getMechanismBadgeColor, 
  getProbabilityBadgeColor,
  onLearnHow,
  onSave,
  isSaved,
  onViewPacket,
  isSelected,
  onToggleSelect,
  onGetDoctorsPacket
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md border-2 overflow-hidden transition-all hover:shadow-lg ${
      isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200'
    }`}>
      {/* Card Header */}
      <div 
        className="p-6 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          {/* Selection Checkbox */}
          <div 
            className="mr-4 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
          >
            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${
              isSaved 
                ? 'bg-green-100 border-green-500' 
                : isSelected 
                  ? 'bg-blue-600 border-blue-600' 
                  : 'border-gray-300 hover:border-blue-400'
            }`}>
              {isSaved ? (
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : isSelected ? (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
            </div>
            {isSaved && (
              <span className="text-xs text-green-600 font-medium mt-1 block">Saved</span>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {suggestion.secondaryCondition}
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Secondary to: <span className="font-medium text-gray-800">{suggestion.primaryCondition}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getProbabilityBadgeColor(suggestion.probability)}`}>
                {suggestion.probability} Probability
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getMechanismBadgeColor(suggestion.mechanism)}`}>
                {suggestion.mechanism}
              </span>
              {suggestion.warning && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                  ⚠️ Medication-Related
                </span>
              )}
            </div>
          </div>
          <button className="ml-4 text-gray-400 hover:text-gray-600">
            <svg 
              className={`w-6 h-6 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-200 pt-4">
          {/* Medical Theory Section */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Medical Nexus Theory
            </h4>
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
              <p className="text-sm text-gray-800 leading-relaxed">
                {suggestion.nexusTheory}
              </p>
            </div>
          </div>

          {/* Mechanism Explanation */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Connection Type</h4>
            <MechanismExplanation mechanism={suggestion.mechanism} />
          </div>

          {/* Warning if applicable */}
          {suggestion.warning && (
            <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> {suggestion.warning}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Medical Citations */}
          {suggestion.medicalCitations && suggestion.medicalCitations.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Medical Literature Support</h4>
              <ul className="space-y-2">
                {suggestion.medicalCitations.map((citation, idx) => (
                  <li key={idx} className="flex items-start text-sm text-gray-700">
                    <svg className="w-4 h-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{citation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onLearnHow();
              }}
              className="flex-1 min-w-[200px] bg-green-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Build Statement (VA Form 21-4138)
            </button>
            
            {/* Doctor's Packet Button - AI-powered nexus research */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onGetDoctorsPacket();
              }}
              className="flex-1 min-w-[200px] bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-md font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Get Doctor's Packet (AI)
            </button>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (isSaved && onViewPacket) {
                  onViewPacket();
                } else {
                  onSave();
                }
              }}
              className={`px-6 py-3 rounded-md font-semibold border-2 transition-colors flex items-center gap-2 ${
                isSaved
                  ? 'border-green-600 text-green-600 bg-green-50'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {isSaved ? (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Saved (View Packet)
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Save for Later
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Mechanism Explanation Component
 */
const MechanismExplanation = ({ mechanism }) => {
  const explanations = {
    'Direct': {
      icon: '🎯',
      title: 'Direct Causation',
      description: 'The primary service-connected condition directly causes the secondary condition through physiological or psychological mechanisms. This is the most straightforward type of secondary connection.',
      example: 'Example: PTSD directly causes anxiety through chronic stress responses and hyperarousal.'
    },
    'Medication': {
      icon: '💊',
      title: 'Iatrogenic (Medication-Induced)',
      description: 'The medications or treatments necessary to manage the primary service-connected condition cause the secondary condition as a side effect. This is also called "proximate cause via treatment."',
      example: 'Example: NSAIDs taken for back pain cause GERD by disrupting the gastric mucosal barrier.'
    },
    'Altered Gait': {
      icon: '🚶',
      title: 'Biomechanical Compensation',
      description: 'The primary condition requires altered movement patterns, posture, or gait that place abnormal stress on other body parts, causing or aggravating secondary conditions. This is part of the "kinetic chain" concept.',
      example: 'Example: A right knee injury causes altered gait, placing excess stress on the left knee and lumbar spine.'
    }
  };

  const info = explanations[mechanism] || explanations['Direct'];

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex items-start">
        <span className="text-3xl mr-3">{info.icon}</span>
        <div>
          <h5 className="font-semibold text-gray-900 mb-1">{info.title}</h5>
          <p className="text-sm text-gray-700 mb-2">{info.description}</p>
          <p className="text-sm text-gray-600 italic">{info.example}</p>
        </div>
      </div>
    </div>
  );
};

export default SecondaryScout;
