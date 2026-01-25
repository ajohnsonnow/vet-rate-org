import React, { useState, useMemo } from 'react';
import { Search, AlertCircle, CheckCircle2, X } from 'lucide-react';
import separationCodesDB from '../data/separation_codes_db.json';

/**
 * Manual Data Entry Component
 * "The Crumpled Paper" Solution
 * 
 * Purpose: Provide manual override when OCR fails on old/damaged DD-214s.
 * 
 * The Problem:
 * OCR is not magic. A coffee-stained DD-214 from 1985 will return garbage.
 * If the parser fails, the user is stuck at a dead end.
 * 
 * The Fix:
 * Clean form to input Box 26 (Separation Code) and Box 13 (Medals) manually.
 * Never leave veterans stranded.
 * 
 * @param {Function} onSubmit - Callback when manual data is complete
 * @param {Function} onCancel - Callback to return to upload mode
 */
const ManualDataEntry = ({ onSubmit, onCancel }) => {
  const [spnCode, setSpnCode] = useState('');
  const [selectedMedals, setSelectedMedals] = useState([]);
  const [medalSearchQuery, setMedalSearchQuery] = useState('');
  const [characterOfService, setCharacterOfService] = useState('');
  const [serviceStartDate, setServiceStartDate] = useState('');
  const [serviceEndDate, setServiceEndDate] = useState('');
  const [showMedalDropdown, setShowMedalDropdown] = useState(false);

  // ========================================
  // SEPARATION CODE LOOKUP
  // ========================================
  const spnCodeInfo = useMemo(() => {
    const normalizedCode = spnCode.toUpperCase().trim();
    if (normalizedCode.length === 3) {
      return separationCodesDB.codes.find(c => c.code === normalizedCode);
    }
    return null;
  }, [spnCode]);

  // ========================================
  // MEDAL SEARCH (Campaign Medals Database)
  // ========================================
  
  // Mock medal database (replace with campaign_medals_db.json when implemented)
  const CAMPAIGN_MEDALS = [
    { id: 'swasm', name: 'Southwest Asia Service Medal', pactEligible: true, era: 'Gulf War' },
    { id: 'acm', name: 'Afghanistan Campaign Medal', pactEligible: true, era: 'Post-9/11' },
    { id: 'icm', name: 'Iraq Campaign Medal', pactEligible: true, era: 'Post-9/11' },
    { id: 'gwot_e', name: 'Global War on Terrorism Expeditionary Medal', pactEligible: true, era: 'Post-9/11' },
    { id: 'gwot_s', name: 'Global War on Terrorism Service Medal', pactEligible: false, era: 'Post-9/11' },
    { id: 'vcsm', name: 'Vietnam Campaign Medal', pactEligible: false, era: 'Vietnam' },
    { id: 'vsm', name: 'Vietnam Service Medal', pactEligible: false, era: 'Vietnam' },
    { id: 'ndsm', name: 'National Defense Service Medal', pactEligible: false, era: 'Multiple' },
    { id: 'cam', name: 'Combat Action Medal (CAM)', combatIndicator: true, pactEligible: false },
    { id: 'cab', name: 'Combat Action Badge (CAB)', combatIndicator: true, pactEligible: false },
    { id: 'car', name: 'Combat Action Ribbon (CAR)', combatIndicator: true, pactEligible: false },
    { id: 'ph', name: 'Purple Heart', combatIndicator: true, pactEligible: false },
    { id: 'bsv', name: 'Bronze Star (with V device)', combatIndicator: true, pactEligible: false }
  ];

  const filteredMedals = useMemo(() => {
    if (!medalSearchQuery) return CAMPAIGN_MEDALS;
    
    const query = medalSearchQuery.toLowerCase();
    return CAMPAIGN_MEDALS.filter(medal => 
      medal.name.toLowerCase().includes(query) ||
      medal.era?.toLowerCase().includes(query)
    );
  }, [medalSearchQuery]);

  const toggleMedal = (medal) => {
    setSelectedMedals(prev => {
      const exists = prev.find(m => m.id === medal.id);
      if (exists) {
        return prev.filter(m => m.id !== medal.id);
      } else {
        return [...prev, medal];
      }
    });
  };

  // ========================================
  // VALIDATION & SUBMISSION
  // ========================================
  const isValid = useMemo(() => {
    return spnCode.trim().length === 3 || selectedMedals.length > 0 || characterOfService;
  }, [spnCode, selectedMedals, characterOfService]);

  const handleSubmit = () => {
    // Generate tags from manual entry
    const tags = [];
    
    if (spnCodeInfo?.strategic_implications?.suggested_actions) {
      spnCodeInfo.strategic_implications.suggested_actions.forEach(action => {
        if (action.includes('PACT')) tags.push('PACT_CANDIDATE');
        if (action.includes('Combat')) tags.push('COMBAT_STRESSOR');
      });
    }

    selectedMedals.forEach(medal => {
      if (medal.pactEligible) {
        if (medal.era === 'Gulf War') tags.push('PACT_GULF');
        if (medal.era === 'Post-9/11') tags.push('PACT_POST_911');
        if (medal.era === 'Vietnam') tags.push('PACT_VIETNAM');
      }
      if (medal.combatIndicator) tags.push('COMBAT_STRESSOR');
    });

    const manualData = {
      spnCode: spnCode.toUpperCase().trim() || null,
      spnCodeInfo: spnCodeInfo || null,
      medals: selectedMedals,
      characterOfService: characterOfService || 'Honorable',
      serviceStartDate: serviceStartDate || null,
      serviceEndDate: serviceEndDate || null,
      tags: [...new Set(tags)], // Deduplicate
      source: 'MANUAL_ENTRY'
    };

    onSubmit(manualData);
  };

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="bg-slate-800 rounded-lg shadow-xl max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-t-lg relative">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              ✍️ Manual Entry (OCR Bypass)
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              Enter your DD-214 data manually. We'll decode it for you.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-white hover:text-blue-200 transition-colors"
            aria-label="Cancel manual entry"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Why This Exists */}
        <div className="bg-blue-900/30 border border-blue-500/50 rounded p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200">
            <strong>Why Manual Entry?</strong> Old or damaged DD-214s don't always scan perfectly. 
            Enter your key data manually and we'll analyze it just like an uploaded document.
          </div>
        </div>

        {/* Box 26: Separation Code */}
        <div>
          <label className="block text-slate-300 text-sm font-bold mb-2">
            Box 26: Separation Program Number (SPN Code)
            <span className="text-slate-500 font-normal ml-2">Optional</span>
          </label>
          <input
            type="text"
            maxLength={3}
            value={spnCode}
            onChange={(e) => setSpnCode(e.target.value.toUpperCase())}
            className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white uppercase font-mono text-lg focus:border-blue-500 focus:outline-none"
            placeholder="e.g., JFX, MBK, JHJ"
            aria-describedby="spn-help"
          />
          <p id="spn-help" className="text-xs text-slate-500 mt-1">
            3-letter code from Box 26 of your DD-214 (e.g., "JFX" for personality disorder separation)
          </p>

          {/* SPN Code Feedback */}
          {spnCodeInfo && (
            <div className="mt-3 bg-green-900/30 border border-green-500/50 rounded p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-300 font-bold">{spnCodeInfo.code}: {spnCodeInfo.description}</p>
                  <p className="text-sm text-green-200/80 mt-1">{spnCodeInfo.narrative}</p>
                  {spnCodeInfo.strategic_implications?.red_team_flag && (
                    <p className="text-xs text-amber-300 mt-2">
                      ⚠️ {spnCodeInfo.strategic_implications.red_team_flag}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {spnCode.length === 3 && !spnCodeInfo && (
            <div className="mt-3 bg-amber-900/30 border border-amber-500/50 rounded p-3">
              <p className="text-amber-300 text-sm">
                ⚠️ Code "{spnCode}" not found in our database. You can still submit-we'll flag it for review.
              </p>
            </div>
          )}
        </div>

        {/* Box 13: Campaign Medals */}
        <div>
          <label className="block text-slate-300 text-sm font-bold mb-2">
            Box 13: Campaign Medals & Decorations
            <span className="text-slate-500 font-normal ml-2">Optional</span>
          </label>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={medalSearchQuery}
              onChange={(e) => {
                setMedalSearchQuery(e.target.value);
                setShowMedalDropdown(true);
              }}
              onFocus={() => setShowMedalDropdown(true)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 pl-10 text-white focus:border-blue-500 focus:outline-none"
              placeholder="Search medals (e.g., 'Southwest Asia', 'Combat Action')"
              aria-describedby="medal-help"
            />
          </div>
          <p id="medal-help" className="text-xs text-slate-500 mt-1">
            Type to search for medals from your DD-214. Select all that apply.
          </p>

          {/* Dropdown Results */}
          {showMedalDropdown && filteredMedals.length > 0 && (
            <div className="mt-2 bg-slate-900 border border-slate-700 rounded max-h-64 overflow-y-auto">
              {filteredMedals.map(medal => (
                <button
                  key={medal.id}
                  onClick={() => toggleMedal(medal)}
                  className={`w-full text-left p-3 hover:bg-slate-800 transition-colors border-b border-slate-700 last:border-b-0 ${
                    selectedMedals.find(m => m.id === medal.id) ? 'bg-blue-900/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white font-medium">{medal.name}</p>
                      <div className="flex gap-2 mt-1">
                        {medal.era && (
                          <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                            {medal.era}
                          </span>
                        )}
                        {medal.pactEligible && (
                          <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">
                            PACT Act Eligible
                          </span>
                        )}
                        {medal.combatIndicator && (
                          <span className="text-xs px-2 py-0.5 bg-red-900/50 text-red-300 rounded">
                            Combat Verification
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedMedals.find(m => m.id === medal.id) && (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected Medals Pills */}
          {selectedMedals.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedMedals.map(medal => (
                <span
                  key={medal.id}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-blue-900/50 border border-blue-500/50 rounded text-sm text-blue-200"
                >
                  {medal.name}
                  <button
                    onClick={() => toggleMedal(medal)}
                    className="hover:text-white transition-colors"
                    aria-label={`Remove ${medal.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Box 24: Character of Service */}
        <div>
          <label className="block text-slate-300 text-sm font-bold mb-2">
            Box 24: Character of Service
          </label>
          <select
            value={characterOfService}
            onChange={(e) => setCharacterOfService(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select...</option>
            <option value="Honorable">Honorable</option>
            <option value="General">General (Under Honorable Conditions)</option>
            <option value="OTH">Other Than Honorable (OTH)</option>
            <option value="Bad Conduct">Bad Conduct</option>
            <option value="Dishonorable">Dishonorable</option>
          </select>
        </div>

        {/* Service Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 text-sm font-bold mb-2">
              Service Start Date
              <span className="text-slate-500 font-normal ml-2">Optional</span>
            </label>
            <input
              type="date"
              value={serviceStartDate}
              onChange={(e) => setServiceStartDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-bold mb-2">
              Service End Date
              <span className="text-slate-500 font-normal ml-2">Optional</span>
            </label>
            <input
              type="date"
              value={serviceEndDate}
              onChange={(e) => setServiceEndDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`flex-1 py-3 px-6 rounded font-bold transition-colors ${
              isValid
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            Analyze My Data
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-bold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualDataEntry;
