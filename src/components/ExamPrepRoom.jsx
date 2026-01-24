/**
 * Vet-Rate.org - The Exam Prep Room Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "The Open Book Test" - Show veterans the actual DBQ before the C&P exam
 * 
 * The Reality: C&P examiners are literally checking boxes on a standardized form.
 * The Fix: Show veterans exactly what questions will be asked and how to answer strategically.
 * 
 * This isn't gaming the system-it's transparency. The veteran deserves to see the playbook.
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import dbqLogicMap from '../data/dbq_logic_map.json';
import disabilityData from '../data/disabilityData.json';

/**
 * Strategic tips for specific DBQ question types
 */
const STRATEGIC_TIPS = {
  prostrating: {
    title: "What 'Prostrating' Really Means",
    content: "The CFR defines 'prostrating' as attacks so severe you MUST stop all activity and lie down, usually in a dark/quiet room. If you can 'power through' the pain, it's NOT prostrating. Be honest-if you sometimes have to lie down, say that specifically."
  },
  rom: {
    title: "Range of Motion (ROM) Testing",
    content: "Stop moving EXACTLY when you first feel pain or discomfort. Do NOT push past the pain to show the examiner you're 'trying.' If you demonstrate a full range of motion, they will mark you as 'Normal' regardless of how much it hurts."
  },
  flare_ups: {
    title: "Flare-Ups Matter More Than You Think",
    content: "The VA rates you based on your WORST flare-ups, not your average day. If your back 'locks up' 3-4 times per year requiring bed rest, that's a flare-up. Document the frequency, duration, and what triggers them."
  },
  social_impairment: {
    title: "Occupational and Social Impairment Keywords",
    content: "For mental health claims, use these specific terms if they apply to you: 'panic attacks,' 'memory loss,' 'difficulty concentrating,' 'suicidal ideation,' 'neglecting hygiene,' 'inability to establish relationships.' These are the exact phrases in the rating criteria."
  },
  medication_side_effects: {
    title: "Medication Side Effects Count",
    content: "The medications you take for your service-connected condition can affect your rating. Mention side effects like: drowsiness affecting work, weight gain, sexual dysfunction, GI distress. These are 'residuals of treatment' and factor into your rating."
  },
  sleep_disturbance: {
    title: "Sleep Issues Are Powerful Evidence",
    content: "Chronic sleep impairment affects nearly every condition rating. Be specific: How many hours do you sleep? Do you wake up? How often? Do you have nightmares? Sleep separately from your spouse? This impacts both mental and physical ratings."
  },
  frequency: {
    title: "Frequency Determines Your Rating",
    content: "Don't just say 'often' or 'sometimes.' The examiner needs specifics: 'Once per month,' 'Three times per week,' '10-15 episodes per year.' Keep a symptom log for 30 days before your exam if possible."
  },
  loss_of_use: {
    title: "Loss of Use = Higher Rating",
    content: "If you can't perform a specific function (e.g., can't grip tools, can't squat, can't climb stairs), say that explicitly. Partial loss of use still qualifies. Example: 'I can no longer tie my shoes without assistance' is more powerful than 'My hands hurt.'"
  }
};

/**
 * Map condition types to relevant strategic tips
 */
const getTipsForCondition = (conditionType) => {
  const tipMap = {
    migraines: ['prostrating', 'frequency', 'medication_side_effects', 'social_impairment'],
    mental_health: ['social_impairment', 'sleep_disturbance', 'frequency', 'medication_side_effects'],
    musculoskeletal: ['rom', 'flare_ups', 'loss_of_use', 'frequency'],
    back: ['rom', 'flare_ups', 'loss_of_use', 'frequency'],
    knee: ['rom', 'flare_ups', 'loss_of_use'],
    tbi: ['social_impairment', 'sleep_disturbance', 'frequency', 'medication_side_effects'],
    default: ['frequency', 'medication_side_effects', 'sleep_disturbance']
  };

  return tipMap[conditionType] || tipMap.default;
};

/**
 * Main ExamPrepRoom Component
 */
const ExamPrepRoom = ({ onClose, preselectedCondition = null }) => {
  const { t } = useLanguage();
  useBodyScrollLock(true);

  const [selectedCondition, setSelectedCondition] = useState(preselectedCondition);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentDBQ, setCurrentDBQ] = useState(null);
  const [relevantTips, setRelevantTips] = useState([]);
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  // Get available conditions from DBQ map
  const availableConditions = Object.keys(dbqLogicMap).map(key => ({
    key,
    ...dbqLogicMap[key]
  }));

  // Filter conditions based on search
  const filteredConditions = availableConditions.filter(cond => 
    cond.condition_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cond.diagnostic_code.includes(searchTerm)
  );

  // Load DBQ when condition selected
  useEffect(() => {
    if (selectedCondition) {
      const dbq = dbqLogicMap[selectedCondition];
      setCurrentDBQ(dbq);
      
      // Determine relevant tips based on condition type
      const tips = getTipsForCondition(selectedCondition);
      setRelevantTips(tips.map(tipKey => ({ key: tipKey, ...STRATEGIC_TIPS[tipKey] })));
    } else {
      setCurrentDBQ(null);
      setRelevantTips([]);
    }
  }, [selectedCondition]);

  const handleConditionSelect = (conditionKey) => {
    setSelectedCondition(conditionKey);
  };

  const handleBack = () => {
    setSelectedCondition(null);
    setExpandedQuestion(null);
  };

  const toggleQuestion = (questionId) => {
    setExpandedQuestion(expandedQuestion === questionId ? null : questionId);
  };

  // Render the Condition Selection Screen
  const renderConditionSelector = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-400/30 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl">📋</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-cyan-300 mb-2">
              The Open Book Test
            </h2>
            <p className="text-gray-300 text-lg mb-4">
              Your C&P examiner isn't improvising-they're checking boxes on a standardized form called a{' '}
              <span className="font-bold text-white">Disability Benefits Questionnaire (DBQ)</span>.
            </p>
            <p className="text-gray-300">
              This tool shows you the <span className="font-bold text-cyan-300">exact questions</span> they'll ask 
              and <span className="font-bold text-cyan-300">strategic tips</span> on how to answer honestly without 
              underselling your symptoms.
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          Search for your condition:
        </label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="e.g., PTSD, Knee, Tinnitus, Migraine..."
          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
      </div>

      {/* Condition List */}
      <div>
        <h3 className="text-lg font-bold text-gray-200 mb-3">
          Select a condition ({filteredConditions.length} available):
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {filteredConditions.map((cond) => (
            <button
              key={cond.key}
              onClick={() => handleConditionSelect(cond.key)}
              className="text-left p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-cyan-500 rounded-lg transition-all group"
            >
              <div className="font-semibold text-white group-hover:text-cyan-300">
                {cond.condition_name}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                DC {cond.diagnostic_code} • {cond.cfr_reference}
              </div>
            </button>
          ))}
        </div>
      </div>

      {filteredConditions.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-4">🔍</div>
          <p>No conditions found matching "{searchTerm}"</p>
          <p className="text-sm mt-2">Try a different search term or browse all conditions above.</p>
        </div>
      )}
    </div>
  );

  // Render the DBQ Questions Screen
  const renderDBQQuestions = () => {
    if (!currentDBQ) return null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <button
              onClick={handleBack}
              className="text-cyan-400 hover:text-cyan-300 text-sm mb-2 flex items-center gap-2"
            >
              ← Back to condition list
            </button>
            <h2 className="text-2xl font-bold text-white mb-1">
              {currentDBQ.condition_name} <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">BETA</span>
            </h2>
            <p className="text-sm text-gray-400">
              Diagnostic Code: {currentDBQ.diagnostic_code} • {currentDBQ.cfr_reference}
            </p>
          </div>
        </div>

        {/* Strategic Tips Section */}
        {relevantTips.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-400/30 rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-3xl">💡</div>
              <div>
                <h3 className="text-xl font-bold text-yellow-300 mb-2">
                  Strategic Tips for This Condition
                </h3>
                <p className="text-gray-300 text-sm">
                  These tips help you answer honestly while ensuring the examiner understands the full impact of your condition.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {relevantTips.map((tip) => (
                <div key={tip.key} className="bg-gray-900/50 rounded-lg p-4">
                  <h4 className="font-bold text-yellow-200 mb-2">
                    ⚠️ {tip.title}
                  </h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {tip.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tipping Points Section */}
        {currentDBQ.tipping_points && currentDBQ.tipping_points.length > 0 && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-cyan-300 mb-4">
              📋 Questions the Examiner Will Ask
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              These are the actual questions from the DBQ form. Click each one to see what the examiner is really looking for.
            </p>
            <div className="space-y-3">
              {currentDBQ.tipping_points.map((q, index) => (
                <div
                  key={q.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleQuestion(q.id)}
                    className="w-full text-left p-4 flex items-start justify-between hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <span className="text-cyan-400 font-bold shrink-0">Q{index + 1}.</span>
                        <span className="text-white font-medium">{q.question}</span>
                      </div>
                      {q.required && (
                        <span className="inline-block mt-2 text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">
                          Required Question
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 text-xl ml-4">
                      {expandedQuestion === q.id ? '−' : '+'}
                    </span>
                  </button>

                  {expandedQuestion === q.id && (
                    <div className="border-t border-gray-700 p-4 bg-gray-900/50 space-y-4">
                      {/* Intent */}
                      <div>
                        <h4 className="text-sm font-bold text-yellow-300 mb-2">
                          🎯 What They're Really Looking For:
                        </h4>
                        <p className="text-gray-300 text-sm leading-relaxed">
                          {q.intent}
                        </p>
                      </div>

                      {/* Definition */}
                      {q.definition && (
                        <div>
                          <h4 className="text-sm font-bold text-blue-300 mb-2">
                            📖 Official Definition:
                          </h4>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {q.definition}
                          </p>
                        </div>
                      )}

                      {/* Answer Options */}
                      {q.options && q.options.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-green-300 mb-2">
                            ✅ Possible Answers:
                          </h4>
                          <div className="space-y-2">
                            {q.options.map((opt, i) => (
                              <div
                                key={i}
                                className="bg-gray-800 border border-gray-600 rounded p-3 flex items-start gap-3"
                              >
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                    opt.weight >= 3
                                      ? 'bg-red-500/20 text-red-300'
                                      : opt.weight >= 2
                                      ? 'bg-yellow-500/20 text-yellow-300'
                                      : 'bg-green-500/20 text-green-300'
                                  }`}
                                >
                                  {opt.weight >= 3 ? '⚠️' : opt.weight >= 2 ? '⚡' : '✓'}
                                </div>
                                <div className="flex-1">
                                  <p className="text-white font-medium">{opt.label}</p>
                                  {opt.weight > 0 && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      Impact level: {opt.weight}/3
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Notes Section */}
        {currentDBQ.notes && (
          <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
            <h4 className="font-bold text-blue-300 mb-2">📝 Important Notes:</h4>
            <p className="text-gray-300 text-sm">{currentDBQ.notes}</p>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-400/30 rounded-lg p-6">
          <h3 className="text-lg font-bold text-cyan-300 mb-3">
            Ready for Your Exam
          </h3>
          <p className="text-gray-300 mb-4">
            Now you know exactly what questions are coming. Walk in prepared, answer honestly, and don't undersell 
            your symptoms. The examiner is checking boxes-make sure they check the right ones.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              ← View Another Condition
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-colors"
            >
              Close Prep Room
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-cyan-500/30">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">📋</div>
            <div>
              <h1 className="text-xl font-bold text-white">
                Exam Prep Room
              </h1>
              <p className="text-cyan-100 text-sm">
                See the DBQ before the examiner does
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-cyan-200 transition-colors text-2xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {!selectedCondition ? renderConditionSelector() : renderDBQQuestions()}
        </div>
      </div>
    </div>
  );
};

export default ExamPrepRoom;
