import React, { useState, useMemo } from 'react';
import disabilityData from '../data/disabilityData.json';
import { saveClaim, isClaimSaved } from '../utils/claimsStorage';

/**
 * QuickConditionPicker Component
 * A compact homepage widget to quickly select conditions and add them to My Packet
 * Dynamically loads all 748 conditions from disabilityData.json
 * Organized by body system per 38 CFR Part 4, Subpart B
 */
const QuickConditionPicker = ({ onAddToPacket, onViewPacket }) => {
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedSystems, setExpandedSystems] = useState(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  // Map rating schedules to user-friendly body system names with emojis
  const systemNameMap = {
    '38 CFR § 4.71a': '🦴 Musculoskeletal System (DC 5000-5299)',
    '38 CFR § 4.79': '👁️ Eyes (DC 6000-6091)',
    '38 CFR § 4.75-4.84': '👁️ Eyes - General (DC 6000-6091)',
    '38 CFR § 4.85': '👂 Ears - Hearing Loss (DC 6100-6260)',
    '38 CFR § 4.87': '👂 Ears - Other Conditions (DC 6200-6260)',
    '38 CFR § 4.87 or § 4.87a': '👂 Ears - Diseases (DC 6200-6260)',
    '38 CFR § 4.88': '🦠 Infectious Diseases - General',
    '38 CFR § 4.88b': '🦠 Infectious Diseases, Immune Disorders & Nutritional Deficiencies (DC 6300-6399)',
    '38 CFR § 4.97': '🫁 Respiratory System (DC 6502-6847)',
    '38 CFR § 4.104': '❤️ Cardiovascular System (DC 7000-7199)',
    '38 CFR § 4.114': '🍽️ Digestive System (DC 7200-7399)',
    '38 CFR § 4.115a': '🚽 Genitourinary System - Renal (DC 7500-7599)',
    '38 CFR § 4.115b': '🚽 Genitourinary System - Other (DC 7500-7599)',
    '38 CFR § 4.115a or § 4.115b': '🚽 Genitourinary System (DC 7500-7599)',
    '38 CFR § 4.116': '♀️ Gynecological Conditions (DC 7610-7699)',
    '38 CFR § 4.117': '🩸 Hemic & Lymphatic Systems (DC 7700-7799)',
    '38 CFR § 4.118': '🧴 Skin (DC 7800-7899)',
    '38 CFR § 4.119': '⚗️ Endocrine System (DC 7900-7999)',
    '38 CFR § 4.124a': '🧠 Neurological Conditions & Convulsive Disorders (DC 8000-8999)',
    '38 CFR § 4.130': '🧠 Mental Disorders (DC 9201-9499)',
    '38 CFR § 4.150': '🦷 Dental & Oral Conditions (DC 9900-9999)'
  };

  // Build conditions by system from disability data
  const conditionsBySystem = useMemo(() => {
    const systemMap = {};
    
    disabilityData.disabilities.forEach(disability => {
      const schedule = disability.ratingSchedule;
      const systemName = systemNameMap[schedule] || `📋 Other - ${schedule}`;
      
      if (!systemMap[systemName]) {
        systemMap[systemName] = [];
      }
      
      systemMap[systemName].push({
        name: disability.conditionName,
        diagnosticCode: disability.diagnosticCode,
        aliases: disability.aliases || []
      });
    });
    
    // Sort conditions within each system by diagnostic code
    Object.keys(systemMap).forEach(system => {
      systemMap[system].sort((a, b) => {
        const codeA = parseInt(a.diagnosticCode) || 0;
        const codeB = parseInt(b.diagnosticCode) || 0;
        return codeA - codeB;
      });
    });
    
    return systemMap;
  }, []);

  // Sort system names in a logical order
  const sortedSystemNames = useMemo(() => {
    const order = [
      '🦴 Musculoskeletal',
      '👁️ Eyes',
      '👂 Ears',
      '🦠 Infectious',
      '🫁 Respiratory',
      '❤️ Cardiovascular',
      '🍽️ Digestive',
      '🚽 Genitourinary',
      '♀️ Gynecological',
      '🩸 Hemic',
      '🧴 Skin',
      '⚗️ Endocrine',
      '🧠 Neurological',
      '🧠 Mental',
      '🦷 Dental'
    ];
    
    return Object.keys(conditionsBySystem).sort((a, b) => {
      const indexA = order.findIndex(prefix => a.startsWith(prefix));
      const indexB = order.findIndex(prefix => b.startsWith(prefix));
      
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [conditionsBySystem]);

  // Total condition count
  const totalConditions = useMemo(() => {
    return Object.values(conditionsBySystem).reduce((sum, arr) => sum + arr.length, 0);
  }, [conditionsBySystem]);

  // Filter conditions based on search
  const filteredSystems = useMemo(() => {
    if (!searchFilter.trim()) {
      return conditionsBySystem;
    }
    
    const filter = searchFilter.toLowerCase();
    const filtered = {};
    
    Object.entries(conditionsBySystem).forEach(([system, conditions]) => {
      const matchingConditions = conditions.filter(condition => 
        condition.name.toLowerCase().includes(filter) ||
        condition.diagnosticCode.includes(filter) ||
        condition.aliases.some(alias => alias.toLowerCase().includes(filter))
      );
      
      if (matchingConditions.length > 0) {
        filtered[system] = matchingConditions;
      }
    });
    
    return filtered;
  }, [conditionsBySystem, searchFilter]);

  // Count filtered conditions
  const filteredCount = useMemo(() => {
    return Object.values(filteredSystems).reduce((sum, arr) => sum + arr.length, 0);
  }, [filteredSystems]);

  const toggleSystem = (system) => {
    const newExpanded = new Set(expandedSystems);
    if (newExpanded.has(system)) {
      newExpanded.delete(system);
    } else {
      newExpanded.add(system);
    }
    setExpandedSystems(newExpanded);
  };

  const toggleCondition = (conditionName) => {
    setSelectedConditions(prev => 
      prev.includes(conditionName) 
        ? prev.filter(c => c !== conditionName)
        : [...prev, conditionName]
    );
  };

  const selectAllInSystem = (system) => {
    const conditions = filteredSystems[system] || [];
    const conditionNames = conditions.map(c => c.name);
    const allSelected = conditionNames.every(name => selectedConditions.includes(name));
    
    if (allSelected) {
      setSelectedConditions(prev => prev.filter(c => !conditionNames.includes(c)));
    } else {
      setSelectedConditions(prev => [...new Set([...prev, ...conditionNames])]);
    }
  };

  const clearAll = () => setSelectedConditions([]);

  const [addedCount, setAddedCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAddToPacket = () => {
    if (selectedConditions.length === 0) return;
    
    let added = 0;
    let skipped = 0;
    
    selectedConditions.forEach(conditionName => {
      // Check if already in packet
      if (!isClaimSaved(conditionName, null)) {
        // Find the full condition data for diagnostic code
        let diagnosticCode = null;
        for (const disabilities of Object.values(conditionsBySystem)) {
          const found = disabilities.find(d => d.name === conditionName);
          if (found) {
            diagnosticCode = found.diagnosticCode;
            break;
          }
        }
        
        saveClaim({
          conditionName,
          parentCondition: null, // Primary condition
          diagnosticCode,
          status: 'Drafting',
          source: 'Quick Condition Picker'
        });
        added++;
      } else {
        skipped++;
      }
    });
    
    setAddedCount(added);
    setShowSuccess(true);
    setSelectedConditions([]);
    
    // Auto-hide success message
    setTimeout(() => setShowSuccess(false), 5000);
    
    // Notify parent if callback provided
    if (onAddToPacket) {
      onAddToPacket(added, skipped);
    }
  };

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">📋</span>
        <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
          Quick Condition Picker
          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">NEW</span>
        </h3>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Select your service-connected conditions to add them to <strong>My Packet</strong> for evidence building. Browse all {totalConditions} VA-rated conditions organized by body system.
      </p>

      {/* Expand/Collapse Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors mb-3"
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {isExpanded ? 'Hide' : 'Show'} Condition List
          <span className="text-gray-500 dark:text-gray-400 ml-2">({totalConditions} conditions)</span>
        </span>
        <svg 
          className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-3">
          {/* Search Filter */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search conditions by name, code, or alias..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full px-3 py-2 pl-9 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchFilter && (
              <span className="absolute right-3 top-2.5 text-xs text-gray-500 dark:text-gray-400">
                {filteredCount} match{filteredCount !== 1 ? 'es' : ''}
              </span>
            )}
          </div>

          {/* Body Systems List */}
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {Object.keys(filteredSystems).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No conditions match your search
              </p>
            ) : (
              sortedSystemNames.filter(system => filteredSystems[system]).map((system) => {
                const conditions = filteredSystems[system];
                const isSystemExpanded = expandedSystems.has(system);
                const selectedInSystem = conditions.filter(c => selectedConditions.includes(c.name)).length;
                
                return (
                  <div key={system} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    {/* System Header */}
                    <button
                      onClick={() => toggleSystem(system)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-100 text-left">
                        {system}
                      </span>
                      <div className="flex items-center gap-2">
                        {selectedInSystem > 0 && (
                          <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                            {selectedInSystem}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {conditions.length}
                        </span>
                        <svg 
                          className={`w-4 h-4 text-gray-400 transition-transform ${isSystemExpanded ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    
                    {/* Conditions List */}
                    {isSystemExpanded && (
                      <div className="px-3 py-2 bg-white dark:bg-gray-800">
                        {/* Select All for System */}
                        <button
                          onClick={() => selectAllInSystem(system)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-2"
                        >
                          {conditions.every(c => selectedConditions.includes(c.name)) 
                            ? 'Deselect all' 
                            : 'Select all in this system'}
                        </button>
                        
                        {/* Two-column responsive grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                          {conditions.map((condition) => (
                            <label 
                              key={condition.diagnosticCode}
                              className="flex items-start text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 px-1 py-0.5 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedConditions.includes(condition.name)}
                                onChange={() => toggleCondition(condition.name)}
                                className="mr-2 mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-600 rounded focus:ring-blue-500"
                              />
                              <span className="break-words">
                                <span className="text-gray-400 dark:text-gray-500 mr-1">DC {condition.diagnosticCode}</span>
                                {condition.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Summary */}
          {selectedConditions.length > 0 && (
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                  {selectedConditions.length} condition{selectedConditions.length !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={clearAll}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                {selectedConditions.map((condition, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-1.5 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded-full"
                  >
                    {condition.length > 25 ? condition.substring(0, 25) + '...' : condition}
                    <button
                      onClick={() => toggleCondition(condition)}
                      className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success Message */}
      {showSuccess && (
        <div className="mt-3 p-3 bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
              <span className="text-sm text-green-800 dark:text-green-200">
                {addedCount} condition{addedCount !== 1 ? 's' : ''} added to My Packet!
              </span>
            </div>
            {onViewPacket && (
              <button
                onClick={onViewPacket}
                className="text-sm text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 font-medium underline"
              >
                View Packet →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add to Packet Button */}
      <button
        onClick={handleAddToPacket}
        disabled={selectedConditions.length === 0}
        className={`w-full mt-3 px-4 py-2.5 rounded-lg font-semibold transition-colors ${
          selectedConditions.length > 0
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
        }`}
      >
        {selectedConditions.length > 0 
          ? `📁 Add ${selectedConditions.length} to My Packet` 
          : '📋 Select conditions above to add to packet'}
      </button>
    </div>
  );
};

export default QuickConditionPicker;
