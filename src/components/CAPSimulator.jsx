/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 */

import React, { useState, useEffect } from 'react';
import { X, ClipboardList, BookOpen, AlertCircle, ChevronRight, ChevronLeft, ChevronDown, HelpCircle, Search, FileText } from 'lucide-react';
import SimulatorFeedback from './SimulatorFeedback';
import BuyMeCoffee from './BuyMeCoffee';
import ReportBugLink from './ReportBugLink';
import { getCalculatorFunction } from '../utils/capSimulatorLogic';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import dbqLogicMap from '../data/dbq_logic_map.json';
import disabilityDataFile from '../data/disabilityData.json';

/**
 * Strategic tips for specific DBQ question types (from ExamPrepRoom)
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
 * CAPSimulator Component
 * 
 * The C&P Exam Simulator - prepares veterans for their Compensation & Pension exam
 * by simulating the specific questions based on the Rating Schedule (38 CFR Part 4).
 * 
 * Features:
 * - Condition selection from saved packet
 * - "Tipping point" questions that determine rating differences
 * - Educational flashcard mode for terminology
 * - Exam Prep mode to view DBQ questions before exam
 * - Gap analysis showing what's needed for higher ratings
 * - Integration with nexus narratives to pre-fill relevant data
 * 
 * CRITICAL: All criteria based on verbatim 38 CFR Part 4 requirements.
 */
const CAPSimulator = ({ onClose, onReportBug, onSendToCalculator }) => {
  const [mode, setMode] = useState('intro'); // intro, select-condition, flashcard, simulation, results, exam-prep, exam-prep-detail
  const [selectedConditionKey, setSelectedConditionKey] = useState(null);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [simulationResult, setSimulationResult] = useState(null);
  const [savedPacket, setSavedPacket] = useState([]);
  const [flashcardTerm, setFlashcardTerm] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [allConditions, setAllConditions] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});
  
  // Exam Prep mode state
  const [examPrepCondition, setExamPrepCondition] = useState(null);
  const [examPrepDBQ, setExamPrepDBQ] = useState(null);
  const [examPrepTips, setExamPrepTips] = useState([]);
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  // Load saved packet and all conditions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('vet_rate_saved_claims');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSavedPacket(parsed);
      } catch (e) {
        console.error('Error loading saved packet:', e);
      }
    }
    
    // Load all conditions from disabilityData
    if (disabilityDataFile && disabilityDataFile.disabilities) {
      setAllConditions(disabilityDataFile.disabilities);
    }
  }, []);

  // Determine body system from diagnostic code or rating schedule
  const getBodySystem = (condition) => {
    const code = parseInt(condition.diagnosticCode);
    const schedule = condition.ratingSchedule || '';
    
    // Musculoskeletal (5000-5999 or 4.71a)
    if ((code >= 5000 && code < 6000) || schedule.includes('4.71a')) return 'musculoskeletal';
    // Organs of Special Sense - Eyes (6000-6099 or 4.79)
    if ((code >= 6000 && code < 6100) || schedule.includes('4.79')) return 'eye';
    // Ears (6100-6299 or 4.85-4.87)
    if ((code >= 6100 && code < 6300) || schedule.includes('4.85') || schedule.includes('4.86') || schedule.includes('4.87')) return 'ear';
    // Respiratory (6500-6899 or 4.97)
    if ((code >= 6500 && code < 6900) || schedule.includes('4.97')) return 'respiratory';
    // Cardiovascular (7000-7199 or 4.104)
    if ((code >= 7000 && code < 7200) || schedule.includes('4.104')) return 'cardiovascular';
    // Digestive (7200-7399 or 4.114)
    if ((code >= 7200 && code < 7400) || schedule.includes('4.114')) return 'digestive';
    // Genitourinary (7500-7599 or 4.115)
    if ((code >= 7500 && code < 7600) || schedule.includes('4.115')) return 'genitourinary';
    // Gynecological (7610-7699 or 4.116)
    if ((code >= 7610 && code < 7700) || schedule.includes('4.116')) return 'gynecological';
    // Hemic/Lymphatic (7700-7799 or 4.117)
    if ((code >= 7700 && code < 7800) || schedule.includes('4.117')) return 'hemic';
    // Skin (7800-7899 or 4.118)
    if ((code >= 7800 && code < 7900) || schedule.includes('4.118')) return 'skin';
    // Endocrine (7900-7999 or 4.119)
    if ((code >= 7900 && code < 8000) || schedule.includes('4.119')) return 'endocrine';
    // Neurological (8000-8999 or 4.124a)
    if ((code >= 8000 && code < 9000) || schedule.includes('4.124a')) return 'neurological';
    // Mental Health (9200-9499 or 4.130)
    if ((code >= 9200 && code < 9500) || schedule.includes('4.130')) return 'mental';
    // Dental (9900-9999 or 4.150)
    if ((code >= 9900 && code < 10000) || schedule.includes('4.150')) return 'dental';
    // Infectious (6300-6399 or 4.88)
    if ((code >= 6300 && code < 6400) || schedule.includes('4.88')) return 'infectious';
    
    return 'general';
  };

  // Generate DBQ-based questions specific to the condition and body system
  const generateGenericQuestions = (condition) => {
    const ratings = condition.ratingCriteria?.ratings || {};
    const ratingKeys = Object.keys(ratings).sort((a, b) => parseInt(b) - parseInt(a));
    const bodySystem = getBodySystem(condition);
    const conditionName = condition.conditionName;
    
    // Parse rating criteria to extract key terms that matter for this condition
    const allCriteriaText = Object.values(ratings).join(' ').toLowerCase();
    
    // Build questions based on body system and rating criteria keywords
    let questions = [];
    
    // === MUSCULOSKELETAL CONDITIONS ===
    if (bodySystem === 'musculoskeletal') {
      // Check if ROM-based (most spine/joint conditions)
      const hasROM = allCriteriaText.includes('range of motion') || allCriteriaText.includes('flexion') || 
                     allCriteriaText.includes('extension') || allCriteriaText.includes('degrees');
      const hasAnkylosis = allCriteriaText.includes('ankylosis');
      const hasPain = allCriteriaText.includes('pain') || allCriteriaText.includes('painful');
      const hasIncapacitating = allCriteriaText.includes('incapacitating');
      
      if (hasROM) {
        questions.push({
          id: 'q_rom',
          question: `How limited is your range of motion for ${conditionName}?`,
          intent: 'Range of motion (ROM) is measured in degrees and is a primary rating factor for musculoskeletal conditions per 38 CFR § 4.71a.',
          definition: 'The examiner will use a goniometer to measure your active and passive range of motion. Loss of motion directly affects your rating percentage.',
          options: [
            { value: 'severe', label: 'Severely limited - less than half of normal motion', weight: 4 },
            { value: 'moderate', label: 'Moderately limited - about half of normal motion', weight: 3 },
            { value: 'mild', label: 'Mildly limited - more than half of normal motion', weight: 2 },
            { value: 'minimal', label: 'Minimally limited - nearly full motion', weight: 1 },
            { value: 'normal', label: 'Normal or near-normal range of motion', weight: 0 }
          ],
          required: true
        });
      }
      
      if (hasPain) {
        questions.push({
          id: 'q_pain_motion',
          question: 'Does pain further limit your motion or function?',
          intent: 'Per DeLuca v. Brown and 38 CFR § 4.40, functional loss due to pain must be considered even if ROM appears adequate.',
          definition: 'Functional loss includes pain on movement, weakness, fatigability, and incoordination. The examiner should document where pain begins during ROM testing.',
          options: [
            { value: 'severe', label: 'Yes - significant additional limitation with pain (pain starts early in motion)', weight: 4 },
            { value: 'moderate', label: 'Yes - moderate additional limitation with pain', weight: 3 },
            { value: 'mild', label: 'Yes - mild additional limitation with pain (pain at end of motion)', weight: 2 },
            { value: 'minimal', label: 'Minimal pain that does not limit function', weight: 1 },
            { value: 'none', label: 'No pain with motion', weight: 0 }
          ],
          required: true
        });
      }
      
      questions.push({
        id: 'q_flareups',
        question: 'Do you experience flare-ups that cause additional functional loss?',
        intent: 'Flare-ups are critical - the examiner MUST estimate additional ROM loss during flare-ups per Sharp v. Shulkin.',
        definition: 'Flare-ups: Periods where symptoms are significantly worse than baseline. The examiner should estimate in degrees how much additional motion is lost during flare-ups.',
        options: [
          { value: 'severe', label: 'Yes - severe flare-ups that significantly worsen function (weekly or more)', weight: 4 },
          { value: 'moderate', label: 'Yes - moderate flare-ups (several times per month)', weight: 3 },
          { value: 'mild', label: 'Yes - occasional flare-ups (few times per month)', weight: 2 },
          { value: 'rare', label: 'Rare flare-ups (few times per year)', weight: 1 },
          { value: 'none', label: 'No significant flare-ups', weight: 0 }
        ],
        required: true
      });
      
      if (hasAnkylosis) {
        questions.push({
          id: 'q_ankylosis',
          question: 'Is the affected joint fixed in position (ankylosis)?',
          intent: 'Ankylosis (joint fused/fixed) warrants higher ratings per 38 CFR § 4.71a.',
          definition: 'Ankylosis: Complete fixation of a joint in one position, either favorable (functional position) or unfavorable (non-functional position).',
          options: [
            { value: 'unfavorable', label: 'Yes - joint is fixed in an unfavorable/non-functional position', weight: 4 },
            { value: 'favorable', label: 'Yes - joint is fixed but in a favorable/functional position', weight: 3 },
            { value: 'no', label: 'No - the joint still moves, even if limited', weight: 0 }
          ],
          required: true
        });
      }
      
      if (hasIncapacitating || allCriteriaText.includes('bed rest') || allCriteriaText.includes('physician')) {
        questions.push({
          id: 'q_incapacitating',
          question: 'Have you had incapacitating episodes requiring bed rest prescribed by a physician?',
          intent: 'Incapacitating episodes (bed rest prescribed by doctor) are a separate rating pathway for spine conditions with IVDS.',
          definition: 'Incapacitating Episode: A period of acute signs/symptoms requiring bed rest PRESCRIBED BY A PHYSICIAN and treatment by a physician.',
          options: [
            { value: '6_weeks', label: 'Yes - at least 6 weeks total in the past 12 months', weight: 4 },
            { value: '4_weeks', label: 'Yes - at least 4 but less than 6 weeks total', weight: 3 },
            { value: '2_weeks', label: 'Yes - at least 2 but less than 4 weeks total', weight: 2 },
            { value: '1_week', label: 'Yes - at least 1 but less than 2 weeks total', weight: 1 },
            { value: 'none', label: 'No prescribed bed rest', weight: 0 }
          ],
          required: true
        });
      }
    }
    
    // === MENTAL HEALTH CONDITIONS ===
    else if (bodySystem === 'mental') {
      questions = [
        {
          id: 'q_occupational',
          question: 'How do your symptoms affect your ability to work?',
          intent: 'Occupational impairment is a key factor in mental health ratings per 38 CFR § 4.130.',
          definition: 'Ranges from occasional decrease in work efficiency (30%) to total occupational impairment (100%).',
          options: [
            { value: 'total', label: 'Total - cannot work at all due to symptoms', weight: 4 },
            { value: 'severe', label: 'Severe - can rarely sustain employment, major deficiencies', weight: 3 },
            { value: 'reduced', label: 'Reduced reliability - frequent missed work, poor performance', weight: 2 },
            { value: 'occasional', label: 'Occasional decrease in work efficiency', weight: 1 },
            { value: 'minimal', label: 'Minimal impact on work', weight: 0 }
          ],
          required: true
        },
        {
          id: 'q_social',
          question: 'How do your symptoms affect your social relationships?',
          intent: 'Social impairment is equally important - includes family, friends, and community interactions.',
          definition: 'Ranges from occasional difficulty adapting (30%) to near-total social isolation (100%).',
          options: [
            { value: 'total', label: 'Near-total isolation - no meaningful relationships', weight: 4 },
            { value: 'severe', label: 'Severe - avoid most social contact, few or no close relationships', weight: 3 },
            { value: 'moderate', label: 'Difficulty maintaining relationships, frequent conflicts', weight: 2 },
            { value: 'mild', label: 'Some difficulty in social situations', weight: 1 },
            { value: 'normal', label: 'Normal social functioning', weight: 0 }
          ],
          required: true
        },
        {
          id: 'q_symptoms',
          question: 'Which of these symptoms do you experience? (Select the most severe that applies)',
          intent: 'Specific symptoms determine rating tiers per 38 CFR § 4.130 criteria.',
          definition: 'Higher ratings require more severe symptoms like persistent hallucinations (70%), gross impairment in thought processes (100%).',
          options: [
            { value: 'gross', label: 'Gross impairment in thought/communication, persistent danger to self/others', weight: 4 },
            { value: 'severe', label: 'Suicidal ideation, obsessional rituals, impaired impulse control', weight: 3 },
            { value: 'moderate', label: 'Panic attacks (weekly+), difficulty understanding complex commands', weight: 2 },
            { value: 'mild', label: 'Depressed mood, anxiety, mild memory loss, sleep disturbance', weight: 1 },
            { value: 'minimal', label: 'Symptoms controlled with medication, minimal impairment', weight: 0 }
          ],
          required: true
        },
        {
          id: 'q_gaf',
          question: 'How would you describe your overall level of functioning?',
          intent: 'Global Assessment of Functioning helps correlate symptom severity with functional impairment.',
          definition: 'Consider your ability to handle routine daily activities, maintain hygiene, manage finances, and make decisions.',
          options: [
            { value: 'gross', label: 'Cannot perform basic self-care or activities of daily living', weight: 4 },
            { value: 'major', label: 'Major impairment - neglect hygiene, unable to manage affairs', weight: 3 },
            { value: 'serious', label: 'Serious impairment - difficulty with routine tasks', weight: 2 },
            { value: 'moderate', label: 'Some difficulty but generally functioning', weight: 1 },
            { value: 'good', label: 'Generally good functioning with mild symptoms', weight: 0 }
          ],
          required: true
        }
      ];
    }
    
    // === RESPIRATORY CONDITIONS ===
    else if (bodySystem === 'respiratory') {
      const hasPFT = allCriteriaText.includes('fev') || allCriteriaText.includes('fvc') || allCriteriaText.includes('dlco');
      
      questions = [
        {
          id: 'q_breathing',
          question: 'How severely does your breathing affect your daily activities?',
          intent: 'Functional impairment from respiratory conditions is assessed alongside PFT results.',
          definition: 'Consider walking, climbing stairs, exercise tolerance, and activities that require exertion.',
          options: [
            { value: 'severe', label: 'Severe - dyspnea at rest or with minimal exertion', weight: 4 },
            { value: 'marked', label: 'Marked - significant dyspnea with light activity (walking short distances)', weight: 3 },
            { value: 'moderate', label: 'Moderate - dyspnea with moderate exertion (climbing stairs)', weight: 2 },
            { value: 'mild', label: 'Mild - dyspnea only with significant exertion', weight: 1 },
            { value: 'minimal', label: 'Minimal breathing issues', weight: 0 }
          ],
          required: true
        }
      ];
      
      if (hasPFT) {
        questions.push({
          id: 'q_pft',
          question: 'What were your most recent pulmonary function test (PFT) results?',
          intent: 'PFT values (FEV-1, FVC, FEV-1/FVC, DLCO) determine rating per 38 CFR § 4.97.',
          definition: 'FEV-1 less than 40% predicted = 100%. FEV-1 40-55% = 60%. FEV-1 56-70% = 30%. FEV-1 71-80% = 10%.',
          options: [
            { value: 'severe', label: 'FEV-1 less than 40% predicted (or equivalent severe restriction)', weight: 4 },
            { value: 'moderate_severe', label: 'FEV-1 40-55% predicted', weight: 3 },
            { value: 'moderate', label: 'FEV-1 56-70% predicted', weight: 2 },
            { value: 'mild', label: 'FEV-1 71-80% predicted', weight: 1 },
            { value: 'normal', label: 'FEV-1 greater than 80% or no PFT results available', weight: 0 }
          ],
          required: true
        });
      }
      
      if (allCriteriaText.includes('oxygen') || allCriteriaText.includes('cor pulmonale')) {
        questions.push({
          id: 'q_oxygen',
          question: 'Do you require supplemental oxygen or have cardiac complications?',
          intent: 'Oxygen dependence and cor pulmonale (right heart failure) indicate severe impairment.',
          definition: 'Cor pulmonale: Right-sided heart failure caused by chronic lung disease. Requires 100% rating.',
          options: [
            { value: 'cor_pulmonale', label: 'Yes - cor pulmonale (right heart failure) diagnosed', weight: 4 },
            { value: 'continuous_o2', label: 'Yes - require continuous supplemental oxygen', weight: 3 },
            { value: 'intermittent_o2', label: 'Yes - require intermittent supplemental oxygen', weight: 2 },
            { value: 'no', label: 'No supplemental oxygen needed', weight: 0 }
          ],
          required: true
        });
      }
    }
    
    // === NEUROLOGICAL CONDITIONS ===
    else if (bodySystem === 'neurological') {
      const hasParalysis = allCriteriaText.includes('paralysis') || allCriteriaText.includes('incomplete') || allCriteriaText.includes('complete');
      
      questions = [
        {
          id: 'q_nerve_function',
          question: 'What level of nerve impairment do you have?',
          intent: 'Neurological ratings are based on completeness of paralysis per 38 CFR § 4.124a.',
          definition: 'Complete paralysis = total loss of function. Incomplete = partial function remains (mild, moderate, or severe).',
          options: [
            { value: 'complete', label: 'Complete paralysis - total loss of function in affected area', weight: 4 },
            { value: 'severe', label: 'Severe incomplete - marked impairment, minimal function', weight: 3 },
            { value: 'moderate', label: 'Moderate incomplete - noticeable impairment but some function', weight: 2 },
            { value: 'mild', label: 'Mild incomplete - slight impairment', weight: 1 },
            { value: 'none', label: 'No paralysis - normal function', weight: 0 }
          ],
          required: true
        },
        {
          id: 'q_symptoms_neuro',
          question: 'Which symptoms do you experience?',
          intent: 'Document specific neurological symptoms for accurate assessment.',
          definition: 'Common symptoms include numbness, tingling, weakness, pain radiating along nerve path, and loss of reflexes.',
          options: [
            { value: 'severe', label: 'Multiple severe symptoms - significant weakness, constant pain, loss of reflexes', weight: 4 },
            { value: 'moderate', label: 'Moderate symptoms - weakness, frequent numbness/tingling, intermittent pain', weight: 3 },
            { value: 'mild', label: 'Mild symptoms - occasional numbness/tingling', weight: 2 },
            { value: 'minimal', label: 'Minimal symptoms', weight: 1 },
            { value: 'none', label: 'No neurological symptoms', weight: 0 }
          ],
          required: true
        }
      ];
      
      // For headache conditions
      if (allCriteriaText.includes('prostrating') || conditionName.toLowerCase().includes('headache') || conditionName.toLowerCase().includes('migraine')) {
        questions = [
          {
            id: 'q_prostrating',
            question: 'When you have an attack, do you have to stop all activity and lie down?',
            intent: '"Prostrating" attacks are key to ratings - requires stopping activity and lying down in dark/quiet room.',
            definition: 'Prostrating: So severe that normal physical activity must stop. The veteran must lie down.',
            options: [
              { value: 'always', label: 'Yes - always have to stop everything and lie down', weight: 4 },
              { value: 'usually', label: 'Usually have to lie down', weight: 3 },
              { value: 'sometimes', label: 'Sometimes have to lie down', weight: 2 },
              { value: 'rarely', label: 'Rarely need to lie down', weight: 1 },
              { value: 'never', label: 'Can power through without lying down', weight: 0 }
            ],
            required: true
          },
          {
            id: 'q_frequency_headache',
            question: 'How often do you have PROSTRATING attacks?',
            intent: 'Frequency determines rating: 10% = 1 per 2 months. 30% = 1 per month. 50% = very frequent.',
            definition: 'Count only attacks severe enough to be prostrating (must stop activity and lie down).',
            options: [
              { value: 'very_frequent', label: 'More than once per month', weight: 4 },
              { value: 'monthly', label: 'About once per month', weight: 3 },
              { value: 'bi_monthly', label: 'About once every 2 months', weight: 2 },
              { value: 'less', label: 'Less than once every 2 months', weight: 1 },
              { value: 'none', label: 'No prostrating attacks', weight: 0 }
            ],
            required: true
          },
          {
            id: 'q_economic',
            question: 'Do these attacks cause you to miss work or affect your income?',
            intent: '"Economic inadaptability" is required for 50% rating - attacks prevent gainful employment.',
            definition: 'Economic inadaptability: Missing work, losing jobs, or inability to maintain employment due to attacks.',
            options: [
              { value: 'severe', label: 'Yes - frequently miss work or lost jobs due to attacks', weight: 4 },
              { value: 'moderate', label: 'Yes - occasionally miss work', weight: 2 },
              { value: 'minimal', label: 'Rarely affects work', weight: 1 },
              { value: 'none', label: 'No impact on work', weight: 0 }
            ],
            required: true
          }
        ];
      }
    }
    
    // === CARDIOVASCULAR CONDITIONS ===
    else if (bodySystem === 'cardiovascular') {
      const hasMETs = allCriteriaText.includes('met') || allCriteriaText.includes('workload');
      const hasEF = allCriteriaText.includes('ejection fraction');
      
      questions = [
        {
          id: 'q_exercise',
          question: 'What level of physical activity causes symptoms (fatigue, shortness of breath, chest pain)?',
          intent: 'Exercise tolerance measured in METs is primary rating criteria per 38 CFR § 4.104.',
          definition: 'METs (metabolic equivalents): 1-3 METs = activities like dressing. 3-5 METs = light housework. 5-7 METs = yard work. 7+ METs = jogging.',
          options: [
            { value: '1_3', label: 'Symptoms with minimal activity (1-3 METs) - dressing, eating, walking indoors', weight: 4 },
            { value: '3_5', label: 'Symptoms with light activity (3-5 METs) - light housework, slow walking', weight: 3 },
            { value: '5_7', label: 'Symptoms with moderate activity (5-7 METs) - yard work, climbing stairs', weight: 2 },
            { value: '7_10', label: 'Symptoms only with heavy exertion (7-10 METs) - jogging, heavy labor', weight: 1 },
            { value: '10+', label: 'No symptoms even with heavy exertion', weight: 0 }
          ],
          required: true
        }
      ];
      
      if (hasEF) {
        questions.push({
          id: 'q_ef',
          question: 'What is your Left Ventricular Ejection Fraction (LVEF)?',
          intent: 'LVEF is a key objective measure for heart conditions.',
          definition: 'Normal LVEF is 55-70%. Lower values indicate heart failure. LVEF under 30% typically warrants 100% rating.',
          options: [
            { value: 'under_30', label: 'LVEF less than 30%', weight: 4 },
            { value: '30_50', label: 'LVEF 30-50%', weight: 3 },
            { value: '50_55', label: 'LVEF 50-55%', weight: 2 },
            { value: 'normal', label: 'LVEF 55% or higher (normal)', weight: 0 },
            { value: 'unknown', label: 'Unknown/not tested', weight: 1 }
          ],
          required: true
        });
      }
      
      if (allCriteriaText.includes('congestive') || allCriteriaText.includes('heart failure')) {
        questions.push({
          id: 'q_chf',
          question: 'Have you experienced congestive heart failure?',
          intent: 'CHF episodes are significant and warrant higher ratings.',
          definition: 'Congestive heart failure: Heart cannot pump blood effectively, causing fluid buildup in lungs/body.',
          options: [
            { value: 'chronic', label: 'Yes - chronic/ongoing heart failure', weight: 4 },
            { value: 'recent', label: 'Yes - episode within the past year', weight: 3 },
            { value: 'history', label: 'Yes - history of CHF but controlled now', weight: 2 },
            { value: 'no', label: 'No history of CHF', weight: 0 }
          ],
          required: true
        });
      }
    }
    
    // === DIGESTIVE CONDITIONS ===
    else if (bodySystem === 'digestive') {
      questions = [
        {
          id: 'q_symptoms_gi',
          question: 'How severe are your digestive symptoms?',
          intent: 'Digestive ratings depend on symptom severity and nutritional impact.',
          definition: 'Consider pain, nausea, vomiting, diarrhea, constipation, and how symptoms affect eating and nutrition.',
          options: [
            { value: 'severe', label: 'Severe - constant symptoms, significant weight loss, malnutrition concerns', weight: 4 },
            { value: 'considerable', label: 'Considerable - frequent symptoms affecting diet and daily life', weight: 3 },
            { value: 'moderate', label: 'Moderate - regular symptoms requiring medication/diet changes', weight: 2 },
            { value: 'mild', label: 'Mild - occasional symptoms, well controlled', weight: 1 },
            { value: 'minimal', label: 'Minimal symptoms', weight: 0 }
          ],
          required: true
        },
        {
          id: 'q_nutrition',
          question: 'Has your condition affected your nutrition or weight?',
          intent: 'Nutritional impact and weight loss are key factors in digestive ratings.',
          definition: 'Definite impairment of health, anemia, and weight loss indicate severe digestive conditions.',
          options: [
            { value: 'marked', label: 'Yes - marked malnutrition, significant anemia, or substantial weight loss', weight: 4 },
            { value: 'impaired', label: 'Yes - definite impairment of health or moderate weight loss', weight: 3 },
            { value: 'minor', label: 'Yes - minor weight changes or dietary restrictions', weight: 2 },
            { value: 'stable', label: 'Weight stable with dietary management', weight: 1 },
            { value: 'normal', label: 'No nutritional impact', weight: 0 }
          ],
          required: true
        }
      ];
      
      if (allCriteriaText.includes('epigastric') || allCriteriaText.includes('substernal') || conditionName.toLowerCase().includes('gerd')) {
        questions.push({
          id: 'q_gerd',
          question: 'How often do you experience reflux symptoms?',
          intent: 'GERD ratings based on frequency of symptoms and associated complications.',
          definition: 'Symptoms include heartburn, regurgitation, epigastric/substernal pain, dysphagia.',
          options: [
            { value: 'persistent', label: 'Persistent - symptoms despite medication, with complications', weight: 4 },
            { value: 'considerable', label: 'Considerable - frequent symptoms (multiple times weekly)', weight: 3 },
            { value: 'moderate', label: 'Moderate - regular symptoms requiring daily medication', weight: 2 },
            { value: 'mild', label: 'Mild - occasional symptoms', weight: 1 },
            { value: 'rare', label: 'Rare symptoms', weight: 0 }
          ],
          required: true
        });
      }
    }
    
    // === SKIN CONDITIONS ===
    else if (bodySystem === 'skin') {
      questions = [
        {
          id: 'q_body_area',
          question: 'What percentage of your body or exposed areas are affected?',
          intent: 'Skin ratings often based on percentage of body affected per 38 CFR § 4.118.',
          definition: 'Exposed areas: head, face, neck, hands. Total body area considers all skin involvement.',
          options: [
            { value: 'more_40', label: 'More than 40% of entire body OR exposed areas affected', weight: 4 },
            { value: '20_40', label: '20-40% of entire body OR exposed areas affected', weight: 3 },
            { value: '5_20', label: '5-20% of entire body OR exposed areas affected', weight: 2 },
            { value: 'less_5', label: 'Less than 5% of body affected', weight: 1 },
            { value: 'minimal', label: 'Minimal or no visible involvement', weight: 0 }
          ],
          required: true
        },
        {
          id: 'q_treatment_skin',
          question: 'What treatment does your condition require?',
          intent: 'Treatment type (systemic vs topical) is a key rating factor for skin conditions.',
          definition: 'Systemic therapy: oral or injected medications. Topical: creams/ointments applied to skin.',
          options: [
            { value: 'constant_systemic', label: 'Constant or near-constant systemic therapy (immunosuppressives, etc.)', weight: 4 },
            { value: 'intermittent_systemic', label: 'Intermittent systemic therapy during the past 12-month period', weight: 3 },
            { value: 'topical', label: 'Topical therapy only', weight: 2 },
            { value: 'minimal', label: 'Minimal treatment needed', weight: 1 },
            { value: 'none', label: 'No treatment', weight: 0 }
          ],
          required: true
        }
      ];
    }
    
    // === EAR/HEARING CONDITIONS ===
    else if (bodySystem === 'ear') {
      if (conditionName.toLowerCase().includes('tinnitus')) {
        questions = [
          {
            id: 'q_tinnitus',
            question: 'Is your tinnitus constant or intermittent?',
            intent: 'Tinnitus is rated at maximum 10% regardless of whether unilateral or bilateral.',
            definition: 'Tinnitus: Ringing, buzzing, or other sounds in the ears. Recurrent tinnitus warrants 10%.',
            options: [
              { value: 'constant', label: 'Constant/continuous ringing', weight: 2 },
              { value: 'recurrent', label: 'Recurrent (comes and goes but frequent)', weight: 2 },
              { value: 'occasional', label: 'Occasional', weight: 1 },
              { value: 'rare', label: 'Rare', weight: 0 }
            ],
            required: true
          },
          {
            id: 'q_tinnitus_impact',
            question: 'How does tinnitus affect your daily life?',
            intent: 'Document functional impact for potential secondary conditions (anxiety, sleep problems).',
            definition: 'While tinnitus itself maxes at 10%, related conditions may be separately compensable.',
            options: [
              { value: 'severe', label: 'Severely affects sleep, concentration, and mental health', weight: 3 },
              { value: 'moderate', label: 'Moderately affects daily functioning', weight: 2 },
              { value: 'mild', label: 'Mildly annoying but manageable', weight: 1 },
              { value: 'minimal', label: 'Minimal impact', weight: 0 }
            ],
            required: true
          }
        ];
      } else {
        questions = [
          {
            id: 'q_hearing',
            question: 'Have you had an audiometry test? What were your results?',
            intent: 'Hearing loss is rated based on audiometry (pure tone thresholds and speech discrimination).',
            definition: 'Rating is determined by Tables VI, VIA, and VII in 38 CFR § 4.85-4.86 using audiometry results.',
            options: [
              { value: 'profound', label: 'Profound hearing loss - 91+ dB average or cannot hear speech', weight: 4 },
              { value: 'severe', label: 'Severe hearing loss - 71-90 dB average', weight: 3 },
              { value: 'moderate_severe', label: 'Moderately severe - 56-70 dB average', weight: 2 },
              { value: 'moderate', label: 'Moderate - 41-55 dB average', weight: 1 },
              { value: 'mild', label: 'Mild or normal hearing - 0-40 dB average', weight: 0 }
            ],
            required: true
          },
          {
            id: 'q_speech',
            question: 'What is your speech discrimination (word recognition) score?',
            intent: 'Speech discrimination is combined with pure tone average for rating calculation.',
            definition: 'Using Maryland CNC test: scores determine Roman numeral designation per Table VI.',
            options: [
              { value: 'under_52', label: 'Less than 52%', weight: 4 },
              { value: '52_66', label: '52-66%', weight: 3 },
              { value: '68_82', label: '68-82%', weight: 2 },
              { value: '84_92', label: '84-92%', weight: 1 },
              { value: '94_100', label: '94-100% (normal)', weight: 0 }
            ],
            required: true
          }
        ];
      }
    }
    
    // === DEFAULT/GENERAL QUESTIONS ===
    // If no body system matched or we need more questions, add general ones
    if (questions.length < 3) {
      const generalQuestions = [
        {
          id: 'q_severity_gen',
          question: `How severe are your symptoms from ${conditionName}?`,
          intent: 'Overall severity assessment based on how condition affects daily life.',
          definition: 'Consider all symptoms and their combined impact on your functioning.',
          options: [
            { value: 'very_severe', label: 'Very severe - significantly limits daily activities', weight: 4 },
            { value: 'severe', label: 'Severe - noticeable impact on daily activities', weight: 3 },
            { value: 'moderate', label: 'Moderate - some limitations', weight: 2 },
            { value: 'mild', label: 'Mild - minimal limitations', weight: 1 },
            { value: 'minimal', label: 'Minimal symptoms', weight: 0 }
          ],
          required: true
        },
        {
          id: 'q_frequency_gen',
          question: 'How often do you experience symptoms?',
          intent: 'Symptom frequency is a key factor in VA ratings.',
          definition: 'Consider how often symptoms occur and their consistency.',
          options: [
            { value: 'constant', label: 'Constant or nearly constant', weight: 4 },
            { value: 'daily', label: 'Daily', weight: 3 },
            { value: 'weekly', label: 'Several times per week', weight: 2 },
            { value: 'monthly', label: 'A few times per month', weight: 1 },
            { value: 'rarely', label: 'Rarely', weight: 0 }
          ],
          required: true
        },
        {
          id: 'q_work_gen',
          question: 'How do symptoms affect your ability to work?',
          intent: 'Occupational impairment is often a critical rating factor.',
          definition: 'Consider missed work, reduced productivity, and ability to perform job duties.',
          options: [
            { value: 'total', label: 'Cannot work due to condition', weight: 4 },
            { value: 'major', label: 'Significant work impairment - miss work frequently', weight: 3 },
            { value: 'moderate', label: 'Moderate - occasional absences or reduced efficiency', weight: 2 },
            { value: 'minor', label: 'Minor impact on work', weight: 1 },
            { value: 'none', label: 'No impact on work', weight: 0 }
          ],
          required: true
        },
        {
          id: 'q_treatment_gen',
          question: 'What level of treatment do you require?',
          intent: 'Treatment intensity often correlates with condition severity.',
          definition: 'Higher ratings often require more intensive ongoing treatment.',
          options: [
            { value: 'intensive', label: 'Intensive - hospitalizations, surgery, or continuous therapy', weight: 4 },
            { value: 'regular', label: 'Regular specialist care and multiple medications', weight: 3 },
            { value: 'moderate', label: 'Regular medication and periodic doctor visits', weight: 2 },
            { value: 'minimal', label: 'Minimal treatment', weight: 1 },
            { value: 'none', label: 'No treatment needed', weight: 0 }
          ],
          required: true
        }
      ];
      
      // Add general questions we don't already have
      generalQuestions.forEach(gq => {
        if (!questions.find(q => q.id === gq.id)) {
          questions.push(gq);
        }
      });
    }
    
    // Limit to 5 questions maximum for better UX
    return questions.slice(0, 5);
  };

  // Generic rating calculator for conditions without specific logic
  const calculateGenericRating = (answers, condition) => {
    const totalWeight = Object.values(answers).reduce((sum, val) => {
      const weight = parseInt(val) || 0;
      return sum + weight;
    }, 0);
    
    const avgWeight = totalWeight / Object.keys(answers).length;
    const ratings = condition.ratingCriteria?.ratings || {};
    const ratingKeys = Object.keys(ratings).map(k => parseInt(k)).filter(k => !isNaN(k)).sort((a, b) => b - a);
    const conditionNameLower = (condition.conditionName || condition.condition_name || '').toLowerCase();
    
    // Map average weight to rating - handle different numbers of rating levels
    let predictedRating = 0;
    
    // Special case: Tinnitus is always max 10% per 38 CFR § 4.87a
    if (conditionNameLower.includes('tinnitus')) {
      // If any answer indicates recurrent tinnitus, it's 10%; otherwise 0%
      const hasTinnitus = Object.values(answers).some(v => 
        v === 'constant' || v === 'recurrent' || v === 'severe' || v === 'moderate'
      );
      predictedRating = hasTinnitus ? 10 : 0;
    } else if (ratingKeys.length === 0) {
      // No ratings defined - fall back to generic scale
      if (avgWeight >= 3.5) predictedRating = 100;
      else if (avgWeight >= 2.5) predictedRating = 50;
      else if (avgWeight >= 1.5) predictedRating = 30;
      else if (avgWeight >= 0.5) predictedRating = 10;
    } else if (ratingKeys.length === 1) {
      // Only one rating level available
      predictedRating = avgWeight >= 1 ? ratingKeys[0] : 0;
    } else {
      // Multiple rating levels - distribute based on weight
      // avgWeight ranges from 0-4, map to available rating levels
      const numLevels = ratingKeys.length;
      const percentile = avgWeight / 4; // 0 to 1 scale (0=lowest severity, 1=highest)
      const levelIndex = Math.min(
        Math.floor((1 - percentile) * numLevels), 
        numLevels - 1
      );
      predictedRating = ratingKeys[levelIndex] || 0;
    }
    
    const ratingText = ratings[predictedRating] || 'Condition present';
    
    // Build comprehensive gap analysis
    const gaps = [];
    const higherRatings = ratingKeys.filter(r => r > predictedRating);
    
    if (higherRatings.length > 0) {
      gaps.push('**Understanding the Gap to Higher Ratings:**');
      gaps.push('Your current answers suggest symptom severity at the ' + predictedRating + '% level. To qualify for a higher rating, the VA requires documented evidence of more severe impairment.');
      gaps.push('');
      
      // Only show next 1-2 higher ratings (most actionable)
      const relevantHigherRatings = higherRatings.slice(-2).reverse();
      
      relevantHigherRatings.forEach(higherRating => {
        const higherCriteria = ratings[higherRating] || '';
        gaps.push(`**What ${higherRating}% Requires:**`);
        gaps.push(higherCriteria);
        gaps.push('');
        
        // Add specific actionable guidance based on the rating difference
        if (higherRating >= 70) {
          gaps.push('• This rating level typically requires evidence of severe occupational impairment - document any job losses, demotions, or inability to work');
          gaps.push('• Gather statements from employers, coworkers, or supervisors about work limitations');
          gaps.push('• Document any hospitalizations, emergency visits, or intensive treatments');
        } else if (higherRating >= 50) {
          gaps.push('• This rating level requires more than occasional symptoms - document frequency and duration of flare-ups');
          gaps.push('• Track days missed from work or activities you can no longer perform');
          gaps.push('• Bring treatment records showing regular/ongoing medical care');
        } else if (higherRating >= 30) {
          gaps.push('• This rating level requires regular impairment - keep a symptom diary showing daily or weekly impact');
          gaps.push('• Document how the condition affects routine daily activities');
          gaps.push('• Note any assistive devices, medications, or accommodations you need');
        }
        gaps.push('');
      });
      
      gaps.push('**Key Questions to Ask Yourself:**');
      gaps.push('• Are my symptoms worse on "bad days" than what I described? If so, describe your WORST days to the examiner');
      gaps.push('• Do I have additional symptoms I didn\'t mention? List ALL symptoms, even ones you think are minor');
      gaps.push('• Is my condition getting worse over time? Document any progression of symptoms');
    } else {
      // At max rating
      gaps.push('**You are at the maximum rating for this condition.**');
      gaps.push('Your answers align with the highest available rating. Focus on maintaining documentation of your condition\'s severity and any secondary conditions that may have developed.');
    }
    
    // Build comprehensive, actionable items specific to the condition type
    const actionItems = [];
    
    // Generic high-value action items
    actionItems.push('Request and bring copies of ALL medical records related to this condition (treatment notes, imaging, lab results)');
    actionItems.push('Prepare a written "bad day" statement describing your symptoms at their WORST - give this to the examiner');
    actionItems.push('List all medications you take for this condition and note any side effects');
    
    // Add condition-type specific guidance
    if (conditionNameLower.includes('pain') || conditionNameLower.includes('arthritis') || conditionNameLower.includes('joint')) {
      actionItems.push('During ROM testing: STOP at the point of pain - do NOT push through to show effort');
      actionItems.push('Mention morning stiffness: how long until you can move normally?');
      actionItems.push('Bring any assistive devices you use (brace, cane, walker)');
    } else if (conditionNameLower.includes('mental') || conditionNameLower.includes('ptsd') || conditionNameLower.includes('depression') || conditionNameLower.includes('anxiety')) {
      actionItems.push('Bring buddy statements from family/friends who witness your symptoms');
      actionItems.push('Document any work problems: missed days, poor reviews, conflicts with coworkers');
      actionItems.push('Mention any suicidal thoughts, panic attacks, or isolation behaviors - these are key criteria');
    } else if (conditionNameLower.includes('respiratory') || conditionNameLower.includes('lung') || conditionNameLower.includes('asthma')) {
      actionItems.push('Bring pulmonary function test (PFT) results if available');
      actionItems.push('Document use of inhalers, nebulizers, or supplemental oxygen');
      actionItems.push('Note any hospitalizations or ER visits for breathing issues');
    } else if (conditionNameLower.includes('heart') || conditionNameLower.includes('cardiac')) {
      actionItems.push('Bring any cardiac testing results (EKG, echocardiogram, stress test)');
      actionItems.push('Document your exercise tolerance in METs if known');
      actionItems.push('Note any work restrictions from your cardiologist');
    } else if (conditionNameLower.includes('diabetes')) {
      actionItems.push('Document your A1C levels over the past year');
      actionItems.push('List all medications including insulin dosages');
      actionItems.push('Note any secondary complications (neuropathy, retinopathy, nephropathy)');
    } else if (conditionNameLower.includes('sleep') || conditionNameLower.includes('apnea')) {
      actionItems.push('Bring your sleep study results');
      actionItems.push('Document CPAP compliance data if available');
      actionItems.push('Note daytime symptoms: fatigue, concentration problems, falling asleep inappropriately');
    }
    
    // Always add these universal items
    actionItems.push('Write down your questions before the exam - you may forget in the moment');
    actionItems.push('If today is a "good day," tell the examiner and describe what a typical or bad day is like');
    
    // Build condition-specific warnings using actual data
    const diagnosticCode = condition.diagnosticCode || '';
    const ratingSchedule = condition.ratingSchedule || '38 CFR Part 4';
    const conditionName = condition.conditionName || condition.condition_name || 'this condition';
    
    const warnings = [
      `Rating based on ${ratingSchedule}, Diagnostic Code ${diagnosticCode} (${conditionName}).`,
      'Your actual rating will depend on the C&P examiner\'s objective medical findings and ALL evidence in your claim file.',
      'Consider requesting a copy of your C&P exam report after the exam to verify accuracy.'
    ];
    
    // Add any condition-specific notes from the data
    if (condition.ratingCriteria?.notes && condition.ratingCriteria.notes.length > 0) {
      warnings.push(`CFR Note: ${condition.ratingCriteria.notes[0]}`);
    }
    
    return {
      predictedRating,
      ratingRationale: `Based on your responses, your symptoms align with a ${predictedRating}% rating under ${ratingSchedule}, DC ${diagnosticCode}. Rating criteria: ${ratingText}`,
      gaps,
      actionItems,
      warnings
    };
  };

  // Filter conditions based on search
  const filteredConditions = allConditions.filter(c => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    return (
      c.conditionName?.toLowerCase().includes(search) ||
      c.diagnosticCode?.includes(search) ||
      c.aliases?.some(a => a.toLowerCase().includes(search)) ||
      c.searchTerms?.some(t => t.toLowerCase().includes(search))
    );
  });

  const availableConditions = Object.keys(dbqLogicMap);
  const currentCondition = selectedConditionKey ? dbqLogicMap[selectedConditionKey] : null;
  const currentQuestions = currentCondition?.tipping_points || (selectedCondition ? generateGenericQuestions(selectedCondition) : []);
  const currentQuestion = currentQuestions[currentQuestionIndex];

  // Handle condition selection
  const handleSelectCondition = (condition) => {
    // Check if condition has specific DBQ logic
    const dbqKey = Object.keys(dbqLogicMap).find(
      key => dbqLogicMap[key].diagnostic_code === condition.diagnosticCode
    );
    
    setSelectedCondition(condition);
    setSelectedConditionKey(dbqKey || null);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setMode('simulation');
  };

  // Handle answer selection
  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // Navigate to next question
  const handleNext = () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      calculateResults();
    }
  };

  // Navigate to previous question
  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  // Calculate rating results
  const calculateResults = () => {
    if (!currentCondition && !selectedCondition) return;

    let result;
    if (currentCondition) {
      // Use specific DBQ calculator
      const calculatorName = currentCondition.rating_calculator;
      const calculatorFunc = getCalculatorFunction(calculatorName);
      
      if (!calculatorFunc) {
        console.error(`Calculator function ${calculatorName} not found`);
        return;
      }
      result = calculatorFunc(answers);
    } else if (selectedCondition) {
      // Use generic calculator
      result = calculateGenericRating(answers, selectedCondition);
    }

    setSimulationResult(result);
    setMode('results');
  };

  // Restart simulation
  const handleRestart = () => {
    setSelectedConditionKey(null);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setSimulationResult(null);
    setMode('intro');
  };

  // Show flashcard for a term
  const showFlashcard = (term) => {
    setFlashcardTerm(term);
  };

  // Get progress percentage
  const getProgress = () => {
    if (!currentQuestions.length) return 0;
    return ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
  };

  // Intro screen
  if (mode === 'intro') {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cap-simulator-title"
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col modal-content">
          {/* Header - Fixed at top */}
          <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 text-white p-4 sm:p-6 rounded-t-lg relative flex-shrink-0">
            <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex items-center gap-2">
              {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="C&P Exam Simulator" />}
              <button
                onClick={onClose}
                className="p-1 text-white hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close C&P Simulator"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 mb-2 pr-16 sm:pr-20">
              <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" />
              <h2 id="cap-simulator-title" className="text-xl sm:text-3xl font-bold">
                C&P Exam Simulator
              </h2>
            </div>
            <p className="text-emerald-100 text-sm sm:text-lg pr-8">
              Turn the "Black Box" of the C&P Exam into an Open-Book Test
            </p>
          </div>

          {/* Content - Scrollable */}
          <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-900">
            <div className="bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-700 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                What is the C&P Exam Simulator?
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                The Compensation & Pension (C&P) exam can feel like a mystery. You walk in not knowing what the doctor will ask, and you walk out not knowing if you said the "right" things. <strong>This tool removes that mystery.</strong>
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                This simulator uses the <strong>exact rating criteria from 38 CFR Part 4</strong> for your specific condition to present the "tipping point" questions - the questions that determine whether you get 10%, 30%, 50%, or higher.
              </p>
            </div>

            {/* PRIMARY ACTION BUTTONS - Prominently placed after intro */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 border-2 border-emerald-300 dark:border-emerald-700 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
                🎯 Choose Your Mode
              </h3>
              <div className="flex flex-wrap gap-4 justify-center">
                <button
                  onClick={() => setMode('select-condition')}
                  className="px-6 py-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-bold rounded-xl hover:from-teal-700 hover:to-teal-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center gap-3 min-w-[200px] justify-center"
                >
                  <ClipboardList className="h-6 w-6" />
                  <div className="text-left">
                    <div>Start Simulation</div>
                    <div className="text-xs font-normal text-teal-200">Practice DBQ questions</div>
                  </div>
                </button>
                <button
                  onClick={() => setMode('exam-prep')}
                  className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center gap-3 min-w-[200px] justify-center"
                >
                  <FileText className="h-6 w-6" />
                  <div className="text-left">
                    <div>Exam Prep</div>
                    <div className="text-xs font-normal text-emerald-200">See actual DBQ questions</div>
                  </div>
                </button>
                <button
                  onClick={() => setMode('flashcard')}
                  className="px-6 py-4 bg-gradient-to-r from-cyan-600 to-cyan-700 text-white font-bold rounded-xl hover:from-cyan-700 hover:to-cyan-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center gap-3 min-w-[200px] justify-center"
                >
                  <BookOpen className="h-6 w-6" />
                  <div className="text-left">
                    <div>Learn Terminology</div>
                    <div className="text-xs font-normal text-cyan-200">Key terms & definitions</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 border-2 border-teal-200 dark:border-teal-700 rounded-lg p-5">
                <div className="text-teal-600 dark:text-teal-400 mb-3">
                  <ClipboardList className="h-8 w-8" />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
                  1. Simulation
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Answer condition-specific questions based on actual DBQ criteria
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 border-2 border-emerald-200 dark:border-emerald-700 rounded-lg p-5">
                <div className="text-emerald-600 dark:text-emerald-400 mb-3">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
                  2. Gap Analysis
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  See exactly what rating your answers align with and what's needed for higher ratings
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 border-2 border-cyan-200 dark:border-cyan-700 rounded-lg p-5">
                <div className="text-cyan-600 dark:text-cyan-400 mb-3">
                  <BookOpen className="h-8 w-8" />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
                  3. Preparation
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Get specific action items: what documents to bring, what to say, what NOT to say
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-400 dark:border-amber-500 p-5">
              <div className="flex gap-3">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-900 dark:text-amber-200 mb-2">
                    The "Stop When It Hurts" Principle
                  </h4>
                  <p className="text-amber-800 dark:text-amber-100 text-sm">
                    For conditions like back pain or knee pain, the simulator will teach you the most important exam tip: <strong>Range of Motion is measured to the point where pain STOPS you</strong> - not where you can force yourself to go. Many veterans unknowingly lower their ratings by "pushing through" during ROM testing.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
                Comprehensive Condition Coverage:
              </h3>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{allConditions.length}</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">Conditions with Simulations</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">15+</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">Body Systems Covered</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">All 38 CFR Part 4 Subpart B</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">100%</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">FREE</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Always, no premium tiers</div>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Body System-Specific Questions:</strong> Each simulation generates questions tailored to the specific body system (musculoskeletal, mental health, respiratory, neurological, etc.) based on actual DBQ criteria and 38 CFR Part 4 rating schedules. Questions target the specific symptoms, measurements, and functional limitations examiners assess for your condition.
              </p>
            </div>

            {/* Disclaimer */}
            <div className="bg-gray-100 dark:bg-gray-800 border-l-4 border-gray-400 dark:border-gray-600 p-4 rounded">
              <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                <strong>Disclaimer:</strong> This is a training tool, not legal advice. Always tell the truth during your exam. The C&P examiner's job is to document your condition accurately - be honest about your worst days, not just your best days. This tool is based on 38 CFR Part 4 as of January 2026.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Exam Prep Mode - Condition Selection
  if (mode === 'exam-prep') {
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
    
    const handleExamPrepConditionSelect = (conditionKey) => {
      const dbq = dbqLogicMap[conditionKey];
      setExamPrepCondition(conditionKey);
      setExamPrepDBQ(dbq);
      
      // Determine relevant tips based on condition type
      const tips = getTipsForCondition(conditionKey);
      setExamPrepTips(tips.map(tipKey => ({ key: tipKey, ...STRATEGIC_TIPS[tipKey] })));
      setMode('exam-prep-detail');
    };
    
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-prep-title"
      >
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-cyan-500/30">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMode('intro')}
                className="text-white hover:text-cyan-200 transition-colors"
                aria-label="Go back"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <FileText className="h-8 w-8 text-white" />
              <div>
                <h1 id="exam-prep-title" className="text-xl font-bold text-white">
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

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-400/30 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">📋</div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-cyan-300 mb-2">
                      The Open Book Test
                    </h2>
                    <p className="text-gray-300 text-lg mb-4">
                      Your C&P examiner isn't improvising - they're checking boxes on a standardized form called a{' '}
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
                      onClick={() => handleExamPrepConditionSelect(cond.key)}
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
          </div>
        </div>
      </div>
    );
  }

  // Exam Prep Detail View - Shows DBQ questions and tips
  if (mode === 'exam-prep-detail' && examPrepDBQ) {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-prep-detail-title"
      >
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-cyan-500/30">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setMode('exam-prep');
                  setExpandedQuestion(null);
                }}
                className="text-white hover:text-cyan-200 transition-colors"
                aria-label="Go back"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <FileText className="h-8 w-8 text-white" />
              <div>
                <h1 id="exam-prep-detail-title" className="text-xl font-bold text-white">
                  {examPrepDBQ.condition_name}
                </h1>
                <p className="text-cyan-100 text-sm">
                  DC {examPrepDBQ.diagnostic_code} • {examPrepDBQ.cfr_reference}
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

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            <div className="space-y-6">
              {/* Strategic Tips Section */}
              {examPrepTips.length > 0 && (
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
                    {examPrepTips.map((tip) => (
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

              {/* Tipping Points / DBQ Questions Section */}
              {examPrepDBQ.tipping_points && examPrepDBQ.tipping_points.length > 0 && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-cyan-300 mb-4">
                    📋 Questions the Examiner Will Ask
                  </h3>
                  <p className="text-gray-400 text-sm mb-6">
                    These are the actual questions from the DBQ form. Click each one to see what the examiner is really looking for.
                  </p>
                  <div className="space-y-3">
                    {examPrepDBQ.tipping_points.map((q, index) => (
                      <div
                        key={q.id}
                        className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedQuestion(expandedQuestion === q.id ? null : q.id)}
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
                                            Impact level: {opt.weight}/4
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
              {examPrepDBQ.notes && (
                <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
                  <h4 className="font-bold text-blue-300 mb-2">📝 Important Notes:</h4>
                  <p className="text-gray-300 text-sm">{examPrepDBQ.notes}</p>
                </div>
              )}

              {/* Bottom CTA */}
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-400/30 rounded-lg p-6">
                <h3 className="text-lg font-bold text-cyan-300 mb-3">
                  Ready for Your Exam
                </h3>
                <p className="text-gray-300 mb-4">
                  Now you know exactly what questions are coming. Walk in prepared, answer honestly, and don't undersell 
                  your symptoms. The examiner is checking boxes - make sure they check the right ones.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      setMode('exam-prep');
                      setExpandedQuestion(null);
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    ← View Another Condition
                  </button>
                  <button
                    onClick={() => setMode('intro')}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-colors"
                  >
                    Back to Main
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Condition selection screen
  if (mode === 'select-condition') {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cap-condition-select-title"
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modal-content overscroll-contain">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 text-white p-6 rounded-t-lg relative">
            <button
              onClick={() => setMode('intro')}
              className="absolute top-4 left-4 text-white hover:text-gray-200"
              aria-label="Go back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:text-gray-200"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
            <h2 id="cap-condition-select-title" className="text-2xl font-bold text-center mb-4">
              Select a Condition to Simulate
            </h2>
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-emerald-200" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by condition name or diagnostic code..."
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/20 text-white placeholder-emerald-200 border border-emerald-400 focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 bg-gray-50 dark:bg-gray-900">
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredConditions.length} of {allConditions.length} conditions
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredConditions.slice(0, 100).map(condition => {
                const dbqKey = Object.keys(dbqLogicMap).find(
                  key => dbqLogicMap[key].diagnostic_code === condition.diagnosticCode
                );
                const isPremium = !!dbqKey;
                
                return (
                  <button
                    key={condition.id}
                    onClick={() => handleSelectCondition(condition)}
                    className="w-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-teal-500 dark:hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-teal-700 dark:group-hover:text-teal-400">
                            {condition.conditionName}
                          </h3>
                          {isPremium && (
                            <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full font-bold">
                              DBQ-SPECIFIC
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          DC {condition.diagnosticCode} • {condition.ratingSchedule || '38 CFR § 4'}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
            {filteredConditions.length > 100 && (
              <p className="text-sm text-gray-500 text-center mt-4">
                Showing first 100 results. Use search to narrow down.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Flashcard mode screen
  if (mode === 'flashcard') {
    const termCategories = [
      {
        category: 'Rating & Exam Fundamentals',
        icon: '📋',
        terms: [
          {
            term: 'C&P Exam (Compensation & Pension Examination)',
            definition: 'A medical examination conducted by a VA or contracted examiner to evaluate the severity of your claimed conditions. The examiner\'s findings directly impact your disability rating. Also called a "comp and pen" exam.',
            example: 'I have a C&P exam scheduled for my back condition next Tuesday. The examiner will measure my range of motion and document my symptoms.'
          },
          {
            term: 'DBQ (Disability Benefits Questionnaire)',
            definition: 'A standardized form examiners use to document your condition. Each condition has a specific DBQ with required measurements and questions. Veterans can have private doctors complete DBQs to support claims.',
            example: 'My private orthopedist completed the "Back (Thoracolumbar Spine) Conditions DBQ" documenting my limited flexion and pain levels.'
          },
          {
            term: 'Rating Decision',
            definition: 'The official VA document that explains the decision on your claim, including assigned percentages, effective dates, and reasoning. This is what you appeal if you disagree.',
            example: 'My rating decision granted 20% for my back but denied my sleep apnea claim, citing lack of nexus to service.'
          },
          {
            term: 'Combined Rating',
            definition: 'How VA calculates total disability when you have multiple conditions. NOT simple addition - uses "whole person theory" where each additional rating applies to remaining non-disabled percentage. 50% + 30% = 65%, not 80%.',
            example: 'I have 50% for PTSD and 30% for back pain. My combined rating is 65% (50% + 30% of remaining 50% = 50% + 15% = 65%).'
          },
          {
            term: 'Bilateral Factor',
            definition: 'A 10% bonus added to combined ratings when you have the same type of condition affecting paired body parts (both knees, both arms, both ears). Applied before combining with other ratings.',
            example: 'I have 10% for my right knee and 10% for my left knee. With the bilateral factor, these combine to 21% before adding my other conditions.'
          },
          {
            term: 'Effective Date',
            definition: 'The date your disability rating begins, which determines when back-pay starts. Usually the date VA received your claim, or date of increase if filing for higher rating.',
            example: 'My effective date is March 15, 2024 - the day I filed my intent to file. I received 8 months of back-pay.'
          },
          {
            term: 'Intent to File (ITF)',
            definition: 'A submission that reserves your effective date for up to one year while you gather evidence. Crucial for protecting back-pay. Must be followed by actual claim within 12 months.',
            example: 'I submitted an Intent to File on January 1st. Even though I did not file my full claim until June, my effective date will be January 1st.'
          }
        ]
      },
      {
        category: 'Service Connection',
        icon: '🔗',
        terms: [
          {
            term: 'Service Connection',
            definition: 'The legal link between a current disability and military service. Required for any VA compensation. Can be direct (happened in service), secondary (caused by service-connected condition), or presumptive.',
            example: 'The VA granted service connection for my hearing loss because my audiograms show worsening during service and my MOS involved noise exposure.'
          },
          {
            term: 'Direct Service Connection',
            definition: 'When a condition was directly caused by an event, injury, or illness during military service. Requires: current diagnosis, in-service event, and nexus linking them.',
            example: 'I hurt my back during a training exercise in 2010. My medical records show treatment in service. This is direct service connection.'
          },
          {
            term: 'Secondary Service Connection',
            definition: 'When an already service-connected condition causes or aggravates a new condition. Does NOT require the new condition to have occurred during service.',
            example: 'My service-connected right knee injury caused me to walk with a limp, which led to left hip arthritis. The hip condition is secondary to the knee.'
          },
          {
            term: 'Presumptive Service Connection',
            definition: 'Conditions the VA presumes are connected to service based on when/where you served, without requiring individual proof. Includes Agent Orange conditions, Gulf War illnesses, Camp Lejeune diseases, and chronic diseases appearing within one year of discharge.',
            example: 'As a Vietnam veteran with Type 2 diabetes, I qualify for presumptive service connection due to Agent Orange exposure - I did not need to prove the specific exposure.'
          },
          {
            term: 'Aggravation',
            definition: 'When service permanently worsened a pre-existing condition beyond its natural progression. The VA must rate the degree of aggravation, not the entire condition.',
            example: 'I had mild asthma before service, but exposure to burn pits made it severe. The VA rated the aggravation - the worsening beyond what would have happened naturally.'
          },
          {
            term: 'Nexus',
            definition: 'The medical link connecting your current disability to military service. Often requires a medical opinion stating the condition is "at least as likely as not" (50% or greater probability) related to service.',
            example: 'My doctor wrote a nexus letter stating my sleep apnea is at least as likely as not caused by my service-connected PTSD, citing medical literature on the connection.'
          },
          {
            term: 'Nexus Letter',
            definition: 'A written medical opinion from a doctor establishing the connection between your condition and service. Should include rationale, cite medical evidence, and use the "at least as likely as not" standard.',
            example: 'My nexus letter states: "It is my medical opinion that the veteran\'s current lumbar degenerative disc disease is at least as likely as not related to the documented in-service back injury in 2008."'
          }
        ]
      },
      {
        category: 'Medical & Exam Terminology',
        icon: '🏥',
        terms: [
          {
            term: 'Range of Motion (ROM)',
            definition: 'How far a joint can move, measured in degrees. Primary rating factor for spine and joint conditions. CRITICAL: Measured to the point where pain STOPS you, not where you can force yourself to go.',
            example: 'When bending forward, I can only reach about knee-level before sharp back pain forces me to stop - that is about 60 degrees of flexion. Normal is 90 degrees.'
          },
          {
            term: 'Flexion',
            definition: 'Bending movement that decreases the angle between body parts. For the spine, this is bending forward. For the knee, this is bending the leg back.',
            example: 'My lumbar flexion is limited to 45 degrees due to pain, where normal is 90 degrees. This limitation affects my 20% spine rating.'
          },
          {
            term: 'Extension',
            definition: 'Straightening movement that increases the angle between body parts. For the spine, this is bending backward. Limited extension affects ratings.',
            example: 'I can barely extend my back at all - only about 10 degrees before severe pain. Normal extension is 30 degrees.'
          },
          {
            term: 'Ankylosis',
            definition: 'Complete fixation of a joint in one position - the joint cannot move at all. Can be "favorable" (functional position) or "unfavorable" (non-functional). Warrants highest ratings.',
            example: 'My cervical spine is ankylosed in a forward-flexed position - I cannot look straight ahead. This unfavorable ankylosis warrants a 40% rating.'
          },
          {
            term: 'Flare-ups',
            definition: 'Periods when symptoms are significantly worse than baseline. Per Sharp v. Shulkin, examiners MUST estimate additional functional loss during flare-ups, even if not occurring during the exam.',
            example: 'During flare-ups, which happen 2-3 times per month, my back pain increases from 5/10 to 9/10 and I lose an additional 20 degrees of flexion.'
          },
          {
            term: 'Functional Loss',
            definition: 'Impairment beyond just limited motion - includes pain, weakness, fatigability, incoordination, and lack of endurance. Per DeLuca v. Brown, must be considered even if ROM appears adequate.',
            example: 'Even though my knee bends to 120 degrees, I have significant functional loss due to pain, giving way, and inability to stand for more than 10 minutes.'
          },
          {
            term: 'Prostrating',
            definition: 'So severe that physical activity must stop and the person must lie down, usually in a dark, quiet room. Used in migraine ratings - the CFR requires attacks to be "completely prostrating" for 30% or higher.',
            example: 'When I have a prostrating migraine, I cannot work, drive, or do anything except lie in bed with the lights off for 4-8 hours.'
          },
          {
            term: 'Incapacitating Episodes',
            definition: 'For IVDS and some other conditions: periods requiring bed rest PRESCRIBED BY A PHYSICIAN. The VA specifically requires doctor-prescribed bed rest, not just self-imposed rest.',
            example: 'My doctor has prescribed bed rest for my back 4 times this year, totaling about 5 weeks. This qualifies me for a 40% IVDS rating.'
          },
          {
            term: 'Radiculopathy',
            definition: 'Nerve root damage causing pain, numbness, tingling, or weakness along a nerve pathway. Often radiates from spine down an arm or leg. Can be rated SEPARATELY from the spine condition causing it.',
            example: 'I have radiculopathy from my lumbar disc herniation - shooting pain and numbness from my lower back down to my right foot, with weakness lifting my toes.'
          },
          {
            term: 'Intervertebral Disc Syndrome (IVDS)',
            definition: 'Condition involving spinal disc damage causing neurological symptoms and incapacitating episodes. Can be rated under ROM criteria OR incapacitating episode criteria - whichever is higher.',
            example: 'My IVDS is rated at 40% based on incapacitating episodes totaling 4-6 weeks per year, which is higher than my ROM-based rating would be.'
          },
          {
            term: 'Peripheral Neuropathy',
            definition: 'Nerve damage in the extremities causing numbness, tingling, burning, or weakness. Common in diabetics and toxic exposure veterans. Rated based on severity: mild, moderate, or severe incomplete paralysis.',
            example: 'I have moderate peripheral neuropathy in both feet from Agent Orange exposure - constant numbness and burning that affects my balance.'
          },
          {
            term: 'METs (Metabolic Equivalents)',
            definition: 'Measure of exercise capacity used for heart condition ratings. 1 MET = sitting quietly. 3-5 METs = light housework. 7-10 METs = jogging. Lower METs = higher rating.',
            example: 'My stress test showed I can only achieve 4 METs before symptoms - I get short of breath just doing light housework. This supports a 60% heart rating.'
          }
        ]
      },
      {
        category: 'Mental Health Terms',
        icon: '🧠',
        terms: [
          {
            term: 'Occupational Impairment',
            definition: 'How mental health symptoms affect ability to work. Key factor in ratings. Ranges from "occasional decrease in work efficiency" (10-30%) to "total occupational impairment" (100%).',
            example: 'My PTSD causes me to miss work 2-3 days per month, reduced productivity, conflicts with supervisors, and I have been demoted twice. This is significant occupational impairment.'
          },
          {
            term: 'Social Impairment',
            definition: 'How mental health symptoms affect relationships and social functioning. Rated alongside occupational impairment. Includes family relationships, friendships, and community involvement.',
            example: 'I avoid all social gatherings, have no close friends, and my marriage nearly ended due to my irritability and isolation from PTSD.'
          },
          {
            term: 'GAF Score (Global Assessment of Functioning)',
            definition: 'A 0-100 scale previously used to rate overall psychological functioning. Though officially discontinued, still appears in older records. Lower scores = more severe impairment.',
            example: 'My psychiatrist assigned a GAF of 45, indicating serious symptoms like suicidal ideation and major impairment in work and relationships.'
          },
          {
            term: 'Suicidal Ideation',
            definition: 'Thoughts about suicide, ranging from passive ("I wish I was not alive") to active with a plan. A key symptom in 70% and 100% mental health ratings. Must be documented to count.',
            example: 'I have passive suicidal ideation - I sometimes think my family would be better off without me, though I have no specific plan.'
          },
          {
            term: 'Hypervigilance',
            definition: 'A state of elevated alertness and scanning for threats, common in PTSD. Causes exhaustion, anxiety, and difficulty relaxing even in safe environments.',
            example: 'I cannot sit with my back to a door in restaurants. I constantly scan for exits and threats. I have not slept more than 4 hours straight since deployment.'
          },
          {
            term: 'Intrusive Thoughts',
            definition: 'Unwanted, distressing thoughts or memories that enter the mind involuntarily. In PTSD, often involves reliving traumatic events. Different from flashbacks.',
            example: 'Multiple times daily, I am suddenly overwhelmed by memories of the IED attack. I can be in the middle of a work meeting and suddenly I am back there.'
          },
          {
            term: 'Flashbacks',
            definition: 'Dissociative episodes where the person feels or acts as if the traumatic event is happening again. More severe than intrusive thoughts - involves temporarily losing awareness of present surroundings.',
            example: 'Loud noises trigger flashbacks where I actually believe I am back in combat. I have hit the ground in public parking lots when cars backfire.'
          },
          {
            term: 'Avoidance Behaviors',
            definition: 'Deliberate efforts to avoid reminders of trauma - places, people, activities, thoughts. A core PTSD symptom that significantly impacts functioning.',
            example: 'I cannot watch war movies, avoid crowded places, no longer attend fireworks events with my kids, and cut off contact with military friends.'
          },
          {
            term: 'Panic Attacks',
            definition: 'Sudden episodes of intense fear with physical symptoms: racing heart, sweating, trembling, shortness of breath. For 50% or higher MH ratings, should occur weekly or more.',
            example: 'I have panic attacks 2-3 times per week, usually triggered by crowds. My heart races, I cannot breathe, and I have to leave immediately.'
          },
          {
            term: 'Impaired Impulse Control',
            definition: 'Difficulty controlling behaviors or emotional reactions. Can manifest as unprovoked irritability, angry outbursts, or reckless behavior. Listed in 70% MH rating criteria.',
            example: 'I have thrown objects during arguments, punched walls, and have received warnings at work for angry outbursts at coworkers over minor issues.'
          }
        ]
      },
      {
        category: 'Legal Standards & Evidence',
        icon: '⚖️',
        terms: [
          {
            term: 'At Least As Likely As Not',
            definition: 'The legal standard for service connection - means 50% or greater probability. If medical evidence shows your condition is "at least as likely as not" related to service, the VA must grant service connection.',
            example: 'My doctor\'s nexus letter states my sleep apnea is "at least as likely as not" caused by my PTSD. This meets the legal standard for secondary service connection.'
          },
          {
            term: 'Benefit of the Doubt',
            definition: 'When evidence is in "approximate balance" (roughly 50-50), the VA must decide in the veteran\'s favor. You do not need to prove your case beyond doubt - just reach equipoise.',
            example: 'Even though the evidence was not overwhelming, it was about 50-50 on whether my condition was service-related, so the benefit of the doubt rule worked in my favor.'
          },
          {
            term: 'Competent Evidence',
            definition: 'Evidence from a qualified source. Medical diagnoses require medical professionals. But veterans are competent to report symptoms they personally experience (pain, difficulty sleeping, etc.).',
            example: 'I am competent to state that I have had knee pain since service - I do not need a doctor to say I feel pain. But diagnosing the cause requires medical evidence.'
          },
          {
            term: 'Credible Evidence',
            definition: 'Evidence that is believable and consistent. Your statements must be internally consistent and consistent with other evidence. Inconsistencies harm credibility.',
            example: 'My buddy statements, service records, and personal testimony all consistently describe my back injury during training - this consistent story is credible evidence.'
          },
          {
            term: 'Lay Evidence',
            definition: 'Non-medical evidence from the veteran or others. Includes your own statements about symptoms, buddy statements from fellow service members, and family observations. Valuable for continuity.',
            example: 'My wife submitted a lay statement describing how my sleep apnea symptoms started right after I returned from deployment and have continued since.'
          },
          {
            term: 'Buddy Statement',
            definition: 'A written statement from someone who witnessed your condition or injury, usually a fellow service member. Very valuable for documenting in-service events when official records are incomplete.',
            example: 'My buddy wrote a statement describing how he witnessed me fall during the training exercise and helped carry me to medical - this corroborates my claim.'
          },
          {
            term: 'Medical Opinion',
            definition: 'A healthcare provider\'s professional judgment about diagnosis, causation, or severity. Should include rationale based on examination, medical records, and accepted medical principles.',
            example: 'The C&P examiner\'s medical opinion stated my tinnitus is less likely than not related to service because there was no documented noise exposure - I need to rebut this.'
          },
          {
            term: 'Adequate Rationale',
            definition: 'A medical opinion must explain WHY the examiner reached their conclusion. An opinion without explanation ("it is not related to service") has little value and can be challenged.',
            example: 'The examiner\'s opinion lacked adequate rationale - he just checked "not related" without explaining why. This gives me grounds to request a new exam.'
          }
        ]
      },
      {
        category: 'Claims & Appeals',
        icon: '📑',
        terms: [
          {
            term: 'Supplemental Claim',
            definition: 'A claim filed after a denial that includes new and relevant evidence not previously considered. Best path when you have new medical evidence or nexus letters.',
            example: 'After my denial, I got a nexus letter from a private doctor. I filed a supplemental claim with this new evidence and was granted service connection.'
          },
          {
            term: 'Higher-Level Review (HLR)',
            definition: 'Request for a senior VA employee to review a decision for clear and obvious errors. No new evidence allowed - just a fresh look at existing evidence. Good for examiner errors.',
            example: 'The examiner ignored my documented in-service injury. I requested an HLR arguing there was clear error, and they granted my claim.'
          },
          {
            term: 'Board Appeal (BVA)',
            definition: 'Appeal to the Board of Veterans Appeals. Options: direct review, evidence submission, or hearing with a Veterans Law Judge. Takes longer but can add new evidence.',
            example: 'After exhausting other options, I appealed to the Board and requested a hearing. The judge understood my case and granted my appeal.'
          },
          {
            term: 'Clear and Unmistakable Error (CUE)',
            definition: 'A very high standard for correcting final decisions. Must show the correct facts were known but the law was incorrectly applied, and the outcome would definitely have been different.',
            example: 'The VA failed to apply the bilateral factor to my knees in 2018. This is CUE because the law clearly requires it and it definitely changed my rating.'
          },
          {
            term: 'Deferred',
            definition: 'When VA postpones a decision on part of your claim, usually pending additional evidence or examination. Your other claims may be decided while deferred claims wait.',
            example: 'My PTSD claim was granted, but my sleep apnea claim was deferred pending a nexus opinion from a specialist.'
          },
          {
            term: 'Duty to Assist',
            definition: 'VA\'s legal obligation to help you develop your claim by obtaining relevant records, scheduling exams, and notifying you of evidence needed. But you must cooperate.',
            example: 'Under duty to assist, the VA obtained my military personnel records and scheduled a C&P exam. I did not have to pay for any of this.'
          },
          {
            term: 'TDIU (Total Disability Individual Unemployability)',
            definition: 'A 100% payment rate for veterans whose service-connected conditions prevent substantial gainful employment, even if combined rating is less than 100%. Requires one condition at 60% or combined 70%.',
            example: 'My combined rating is 80%, but my PTSD makes it impossible to hold a job. I applied for TDIU and now receive compensation at the 100% rate.'
          },
          {
            term: 'Special Monthly Compensation (SMC)',
            definition: 'Additional compensation beyond schedular ratings for specific circumstances: loss of limbs, blindness, need for aid and attendance, housebound status, or having multiple 100% ratings.',
            example: 'I receive SMC(s) because I need my wife\'s help with bathing and dressing due to my service-connected conditions.'
          }
        ]
      },
      {
        category: 'Specific Rating Criteria',
        icon: '📊',
        terms: [
          {
            term: 'Economic Inadaptability',
            definition: 'For 50% migraine rating: attacks are so severe and frequent they prevent maintaining employment or cause significant income loss. Must show actual work impact, not just severe headaches.',
            example: 'I have missed so much work due to migraines that I was placed on a performance improvement plan and fear losing my job.'
          },
          {
            term: 'Characteristic Prostrating Attacks',
            definition: 'Migraine term: attacks so severe you must stop all activity and lie down. For 30% rating, need these monthly. For 50%, need them to be "very frequent" AND cause economic inadaptability.',
            example: 'I have characteristic prostrating attacks about twice per month - each time I must leave work and lie in a dark room for hours.'
          },
          {
            term: 'Guarding',
            definition: 'For spine ratings: muscle spasm or guarding severe enough to result in abnormal gait or abnormal spinal contour. Required for 20% lumbosacral rating with normal ROM.',
            example: 'My back muscles spasm so badly that my spine curves to one side and I walk bent forward. This guarding affects my posture and gait.'
          },
          {
            term: 'Abnormal Spinal Contour',
            definition: 'Visible abnormality in spinal curvature - scoliosis, reversed lordosis, abnormal kyphosis. Can result from muscle spasm/guarding. Relevant to spine ratings.',
            example: 'X-rays show I have reversed lordosis in my lumbar spine - it curves the wrong direction due to muscle spasm. This is abnormal spinal contour.'
          },
          {
            term: 'Painful Motion',
            definition: 'Per 38 CFR 4.59, joints that are actually painful, unstable, or misaligned due to healed injury warrant at least the minimum compensable rating. Pain itself can support 10%.',
            example: 'Even though my knee has full range of motion, I have constant pain with movement. Under 4.59, this painful motion supports at least a 10% rating.'
          },
          {
            term: 'Recurrent Subluxation/Instability',
            definition: 'For knee ratings: knee giving way or partially dislocating. Rated separately from limitation of motion - can have both ratings for the same knee.',
            example: 'My knee gives out unexpectedly 2-3 times per week, especially on stairs. This instability is rated at 20% separately from my flexion limitation.'
          },
          {
            term: 'Degenerative Arthritis (DJD)',
            definition: 'Arthritis from wear and tear, confirmed by X-ray. If ROM is not compensable, rate at 10% per major joint group with X-ray evidence. Higher if motion is limited.',
            example: 'My X-rays show bone-on-bone arthritis in my knee. Even with good ROM, the X-ray-confirmed arthritis warrants at least 10%.'
          },
          {
            term: 'Complete vs Incomplete Paralysis',
            definition: 'For nerve conditions: complete paralysis means total loss of function. Incomplete paralysis has grades: mild, moderate, moderately severe, and severe. Rating depends on which nerve and degree.',
            example: 'I have moderate incomplete paralysis of the sciatic nerve - significant weakness and numbness but not total loss of function. This rates at 20%.'
          }
        ]
      },
      {
        category: 'Presumptive Conditions',
        icon: '☢️',
        terms: [
          {
            term: 'Agent Orange Presumptives',
            definition: 'Conditions presumed connected to herbicide exposure in Vietnam, Thailand, Korea DMZ, and certain C-123 aircraft. Includes Type 2 diabetes, ischemic heart disease, Parkinson\'s, and multiple cancers.',
            example: 'As a Vietnam veteran, my Type 2 diabetes is presumptively service-connected. I did not have to prove exactly when or how I was exposed to Agent Orange.'
          },
          {
            term: 'Gulf War Presumptives',
            definition: 'Undiagnosed illnesses and medically unexplained chronic multi-symptom illnesses in Gulf War veterans. Includes chronic fatigue, fibromyalgia, IBS, and functional GI disorders.',
            example: 'My chronic fatigue syndrome is presumptively connected to my Gulf War service even though doctors cannot explain what caused it.'
          },
          {
            term: 'PACT Act Presumptives',
            definition: 'Conditions added by the 2022 PACT Act related to toxic exposures: burn pit exposure, radiation, Agent Orange (expanded), and more. Created many new presumptive conditions.',
            example: 'Under the PACT Act, my constrictive bronchiolitis from burn pit exposure is now presumptive. I deployed to Iraq and have the diagnosis.'
          },
          {
            term: 'Camp Lejeune Presumptives',
            definition: 'Conditions linked to contaminated water at Camp Lejeune (1953-1987). Includes multiple cancers, Parkinson\'s, kidney disease, and other conditions for those who served 30+ days.',
            example: 'I was stationed at Camp Lejeune for 2 years in the 1970s. My bladder cancer is presumptively connected to the water contamination.'
          },
          {
            term: 'Chronic Disease Presumption',
            definition: 'Certain chronic diseases (arthritis, heart disease, diabetes, etc.) are presumptively connected if they manifest to 10% degree within one year of discharge.',
            example: 'My arthritis was diagnosed 8 months after discharge. Because it\'s a chronic disease that manifested within one year, it\'s presumptively connected.'
          },
          {
            term: 'Combat Presumption (1154(b))',
            definition: 'For combat veterans, satisfactory lay evidence of injury/disease is accepted even without official records if consistent with combat circumstances. Lowers the evidence burden.',
            example: 'I have no medical records of my shoulder injury during combat, but my account is consistent with combat circumstances. Under 1154(b), this is accepted as evidence.'
          }
        ]
      },
      {
        category: '38 CFR Part 3 - Claims Regulations',
        icon: '📜',
        terms: [
          {
            term: 'Benefit of the Doubt (§3.102)',
            definition: 'When evidence is in approximate balance (50/50), VA must decide in the veteran\'s favor. You do NOT need to prove your case beyond reasonable doubt - just reach equipoise (50% probability).',
            example: 'My doctor said my condition was "at least as likely as not" related to service. Even though the C&P examiner disagreed, the evidence was roughly equal, so under §3.102, I should win.'
          },
          {
            term: 'Duty to Assist (§3.159)',
            definition: 'VA\'s legal obligation to help develop your claim: obtain service records, VA records, and private records (with authorization), schedule C&P exams, and notify you of needed evidence.',
            example: 'VA denied my claim without getting my service treatment records. They violated their duty to assist under §3.159. I appealed citing this failure.'
          },
          {
            term: 'Intent to File (§3.155(b))',
            definition: 'A submission that reserves your effective date for up to 1 year while you gather evidence. Can be filed electronically, on VA Form 21-0966, or verbally to VA. Preserves back-pay rights.',
            example: 'I filed an Intent to File on January 1st. Even though my full claim wasn\'t ready until June, my effective date will be January 1st - preserving 5 months of back-pay.'
          },
          {
            term: 'Complete Claim (§3.160)',
            definition: 'A claim with all required elements: claimant\'s name, service information, signature, benefit sought, and condition description. Incomplete claims cause delays.',
            example: 'My claim was returned as incomplete because I forgot to sign it. Always double-check you\'ve provided everything required.'
          },
          {
            term: 'Favorable Findings (§3.104(c))',
            definition: 'Any favorable finding by a VA adjudicator is binding on all future adjudicators unless clear and unmistakable error is shown. Past favorable findings carry forward.',
            example: 'In 2018, VA acknowledged my in-service back injury even though they denied service connection then. That finding is binding - new adjudicators cannot reverse it.'
          },
          {
            term: 'Rating Stabilization (§3.344)',
            definition: 'Ratings in effect 5+ years cannot be reduced unless sustained improvement under ordinary conditions of life is shown. After 20 years, ratings are essentially permanent.',
            example: 'I\'ve had 70% for PTSD for 8 years. VA can\'t reduce it just because one exam looked better - they must show sustained improvement in my daily life.'
          },
          {
            term: 'Clear and Unmistakable Error (CUE) (§3.105)',
            definition: 'A high standard for correcting final decisions. Must show correct facts were known but law was incorrectly applied, and outcome would undoubtedly have been different. Can recover decades of back-pay.',
            example: 'VA failed to apply the bilateral factor to my knees in 2010. This is CUE because the law clearly requires it. I filed a CUE claim and got 15 years of back-pay.'
          },
          {
            term: 'Effective Date Rules (§3.400)',
            definition: 'When benefits start. Usually date VA received claim OR date entitlement arose, whichever is LATER. Can be earlier with Intent to File or claim within 1 year of discharge.',
            example: 'I filed within 1 year of discharge, so my effective date is the day after discharge. Veterans who wait lose months or years of back-pay.'
          },
          {
            term: 'Review Options (§3.2500)',
            definition: 'After a decision, you have 1 year to choose: Supplemental Claim (add evidence), Higher-Level Review (error review), or Board Appeal. Each preserves different rights.',
            example: 'I got denied and had new evidence, so I filed a Supplemental Claim within 1 year. My original effective date was preserved when I won.'
          },
          {
            term: 'Secondary Service Connection (§3.310)',
            definition: 'A disability caused OR aggravated by an already service-connected condition. Does NOT need to occur during service. Medical evidence must show the connection.',
            example: 'My service-connected diabetes caused peripheral neuropathy in my feet. Under §3.310, the neuropathy is secondary service-connected.'
          },
          {
            term: 'Special Monthly Compensation (§3.350)',
            definition: 'Additional compensation beyond schedular ratings for: loss of use of limbs/organs, blindness, deafness, being housebound, or needing aid and attendance.',
            example: 'I qualify for SMC(s) because I have 100% for PTSD plus 60% for other conditions that are separate and distinct. That\'s an extra ~$400/month.'
          },
          {
            term: 'Procedural Due Process (§3.103)',
            definition: 'Your rights as a claimant: written notice of decisions, right to a hearing, right to representation. VA must assist you and grant every benefit supported by law.',
            example: 'VA decided my claim without telling me what evidence I needed. They violated my due process rights under §3.103. I appealed based on this procedural error.'
          }
        ]
      },
      {
        category: 'Board of Veterans Appeals (Parts 19 & 20)',
        icon: '⚖️',
        terms: [
          {
            term: 'Notice of Disagreement (NOD)',
            definition: 'The form (VA Form 10182) you file to appeal a VA decision to the Board of Veterans\' Appeals. Must be filed within 1 year of the decision. You must choose one of three dockets.',
            example: 'VA denied my claim, and I believe they misread the evidence. I filed a Notice of Disagreement within the 1-year deadline to take my case to the Board.'
          },
          {
            term: 'Direct Review Docket',
            definition: 'One of three BVA docket options. The Board reviews your existing record without new evidence or a hearing. Fastest option - typically under 1 year wait time.',
            example: 'My evidence was strong but the regional office misapplied the law. I chose Direct Review because I didn\'t need to add anything - just needed a fresh look.'
          },
          {
            term: 'Evidence Submission Docket',
            definition: 'One of three BVA docket options. You can submit new evidence within 90 days of filing, but no hearing. Wait time typically 1-2 years.',
            example: 'I got a new nexus letter after my denial. I chose Evidence Submission docket so I could add this new evidence to my appeal.'
          },
          {
            term: 'Hearing Request Docket',
            definition: 'One of three BVA docket options. You testify before a Veterans Law Judge and can submit evidence at the hearing. Longest wait (2-4 years) but most comprehensive.',
            example: 'My case is complex and I want to explain my symptoms directly to the judge. I chose Hearing Request even though it takes longer.'
          },
          {
            term: 'Veterans Law Judge (VLJ)',
            definition: 'An attorney appointed by the VA Secretary who decides Board appeals. VLJs are required to be experienced in veterans law and conduct hearings.',
            example: 'At my Board hearing, the Veterans Law Judge asked clarifying questions and really seemed to understand my condition.'
          },
          {
            term: 'Remand',
            definition: 'When the Board sends your case back to the regional office for additional development (like a new exam) or to fix errors. NOT a denial - often leads to a grant.',
            example: 'The Board remanded my case because VA never got my private treatment records. After the remand, the regional office got the records and granted my claim.'
          },
          {
            term: 'CAVC (Court of Appeals for Veterans Claims)',
            definition: 'The federal court that reviews BVA decisions. You have ONLY 120 days to appeal to CAVC after a Board denial. This deadline is absolute with almost no exceptions.',
            example: 'The Board denied me and I believed they made a legal error. I filed a Notice of Appeal to CAVC within the strict 120-day deadline.'
          },
          {
            term: 'Joint Motion for Remand (JMR)',
            definition: 'An agreement between the veteran and VA at CAVC to send the case back to the Board. Most CAVC cases settle this way rather than going to full court decision.',
            example: 'At CAVC, VA agreed they made an error. We filed a Joint Motion for Remand, and the court sent my case back to the Board with instructions.'
          },
          {
            term: 'VA Pension',
            definition: 'A needs-based benefit for wartime veterans who are 65+ or permanently disabled (not from service) with limited income. Different from disability compensation - does NOT require service connection.',
            example: 'I\'m a Vietnam-era veteran with heart disease that isn\'t service-connected. Since I\'m 70 with limited income, I qualified for VA Pension.'
          },
          {
            term: 'Aid and Attendance (A&A)',
            definition: 'An enhanced pension rate for veterans who need help with daily activities like bathing, dressing, or eating. Can add over $1,000/month to pension.',
            example: 'My father is a wartime veteran on pension who now needs help bathing and dressing. Adding Aid and Attendance increased his monthly benefit significantly.'
          }
        ]
      }
    ];

    // Helper to check if category is expanded - defaults to false (collapsed) for cleaner initial view
    const isCategoryExpanded = (categoryName) => {
      return expandedCategories[categoryName] === true;
    };

    const toggleCategory = (category) => {
      setExpandedCategories(prev => ({
        ...prev,
        [category]: !isCategoryExpanded(category)
      }));
    };

    const expandAll = () => {
      setExpandedCategories(termCategories.reduce((acc, cat) => ({ ...acc, [cat.category]: true }), {}));
    };

    const collapseAll = () => {
      setExpandedCategories(termCategories.reduce((acc, cat) => ({ ...acc, [cat.category]: false }), {}));
    };

    // Filter terms based on search
    const filteredCategories = termCategories.map(cat => ({
      ...cat,
      terms: cat.terms.filter(term =>
        searchTerm === '' ||
        term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
        term.definition.toLowerCase().includes(searchTerm.toLowerCase())
      )
    })).filter(cat => cat.terms.length > 0);

    const totalTerms = termCategories.reduce((sum, cat) => sum + cat.terms.length, 0);
    const filteredTermsCount = filteredCategories.reduce((sum, cat) => sum + cat.terms.length, 0);

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cap-terminology-title"
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col modal-content">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 text-white p-6 relative flex-shrink-0">
            <button
              onClick={() => setMode('intro')}
              className="absolute top-4 left-4 text-white hover:text-gray-200"
              aria-label="Go back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:text-gray-200"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-3 justify-center">
              <BookOpen className="h-8 w-8" />
              <h2 id="cap-terminology-title" className="text-2xl font-bold">
                VA Claims Terminology
              </h2>
            </div>
            <p className="text-emerald-100 text-center mt-2">
              {totalTerms} essential terms from 38 CFR Part 4 and VA claims process
            </p>
            
            {/* Search */}
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-emerald-200" />
              <input
                type="text"
                placeholder="Search terms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/20 text-white placeholder-emerald-200 border border-emerald-400 focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
            
            {/* Expand/Collapse buttons */}
            <div className="flex justify-center gap-4 mt-3">
              <button
                onClick={expandAll}
                className="text-sm text-emerald-200 hover:text-white flex items-center gap-1"
              >
                <ChevronDown className="h-4 w-4" /> Expand All
              </button>
              <button
                onClick={collapseAll}
                className="text-sm text-emerald-200 hover:text-white flex items-center gap-1"
              >
                <ChevronRight className="h-4 w-4" /> Collapse All
              </button>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-900">
            {searchTerm && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Showing {filteredTermsCount} of {totalTerms} terms matching "{searchTerm}"
              </div>
            )}

            {filteredCategories.map((category, catIndex) => (
              <div key={catIndex} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category.category)}
                  className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <span className="font-bold text-gray-800 dark:text-gray-100">{category.category}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">({category.terms.length} terms)</span>
                  </div>
                  {isCategoryExpanded(category.category) ? (
                    <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  )}
                </button>
                
                {isCategoryExpanded(category.category) && (
                  <div className="p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
                    {category.terms.map((item, index) => (
                      <div key={index} className="bg-white dark:bg-gray-800 border-2 border-teal-200 dark:border-teal-700 rounded-lg p-5">
                        <h3 className="text-lg font-bold text-teal-700 dark:text-teal-300 mb-3 flex items-center gap-2">
                          <BookOpen className="h-5 w-5 flex-shrink-0" />
                          {item.term}
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">Definition:</h4>
                            <p className="text-gray-700 dark:text-gray-200">{item.definition}</p>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">Example:</h4>
                            <p className="text-gray-600 dark:text-gray-400 italic">"{item.example}"</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-5 mt-6">
              <p className="text-blue-900 dark:text-blue-100 text-sm">
                <strong>💡 Pro Tip:</strong> Using the exact terminology from the CFR during your C&P exam helps ensure the examiner documents your condition correctly. For example, saying "I have prostrating migraines that cause economic inadaptability" is much more precise than "I have really bad headaches that make me miss work."
              </p>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700 rounded-lg p-5">
              <p className="text-emerald-900 dark:text-emerald-100 text-sm">
                <strong>📚 Study Tip:</strong> Focus on terms relevant to YOUR conditions first. If you have a back condition, master ROM, flexion, flare-ups, and functional loss. If you have PTSD, focus on occupational/social impairment and the specific symptoms in the rating criteria.
              </p>
            </div>
          </div>
        </div>
        
        {/* Buy Me a Coffee - terminology studied */}
        <BuyMeCoffee 
          show={true} 
          trigger="terminology"
          context={{ term: flashcardTerm }}
          componentKey="cap-simulator"
        />
      </div>
    );
  }

  // Simulation screen (questions)
  if (mode === 'simulation' && (currentCondition || selectedCondition) && currentQuestion) {
    const isLastQuestion = currentQuestionIndex === currentQuestions.length - 1;
    const currentAnswer = answers[currentQuestion.id];
    const canProceed = currentQuestion.required ? !!currentAnswer : true;
    const conditionName = currentCondition?.condition_name || selectedCondition?.conditionName;

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cap-question-title"
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto modal-content overscroll-contain">
          {/* Header with Progress */}
          <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 text-white p-6 rounded-t-lg relative">
            <button
              onClick={() => setMode('select-condition')}
              className="absolute top-4 left-4 text-white hover:text-gray-200"
              aria-label="Go back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:text-gray-200"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="text-center mb-4">
              <h2 id="cap-question-title" className="text-2xl font-bold mb-1">
                {conditionName}
              </h2>
              <p className="text-emerald-100 text-sm">
                Question {currentQuestionIndex + 1} of {currentQuestions.length}
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-emerald-900/50 rounded-full h-2">
              <div
                className="bg-white rounded-full h-2 transition-all duration-300"
                style={{ width: `${getProgress()}%` }}
              />
            </div>
          </div>

          {/* Question Content */}
          <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900">
            {/* Question */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border-2 border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                {currentQuestion.question}
              </h3>
              
              {/* Intent explanation */}
              <div className="bg-teal-50 dark:bg-teal-900/30 border-l-4 border-teal-400 dark:border-teal-500 p-4 mb-4">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-5 w-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-teal-900 dark:text-teal-200 text-sm mb-1">
                      Why this question matters:
                    </h4>
                    <p className="text-teal-800 dark:text-teal-100 text-sm">
                      {currentQuestion.intent}
                    </p>
                  </div>
                </div>
              </div>

              {/* Definition (if available) */}
              {currentQuestion.definition && (
                <div className="bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-400 dark:border-purple-500 p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-purple-900 dark:text-purple-200 text-sm mb-1">
                        CFR Definition:
                      </h4>
                      <p className="text-purple-800 dark:text-purple-100 text-sm">
                        {currentQuestion.definition}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Answer Options */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Select your answer:</h4>
              {currentQuestion.options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(currentQuestion.id, option.value)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${
                    currentAnswer === option.value
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-teal-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                      currentAnswer === option.value
                        ? 'border-teal-500 bg-teal-500'
                        : 'border-gray-300 dark:border-gray-500'
                    }`}>
                      {currentAnswer === option.value && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                    <span className="text-gray-700 dark:text-gray-200 font-medium">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-4 justify-between pt-4">
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className={`px-6 py-2 rounded-lg font-semibold flex items-center gap-2 ${
                  currentQuestionIndex === 0
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              <button
                onClick={handleNext}
                disabled={!canProceed}
                className={`px-6 py-2 rounded-lg font-semibold flex items-center gap-2 ${
                  !canProceed
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-teal-600 text-white hover:bg-teal-700'
                }`}
              >
                {isLastQuestion ? 'Get Results' : 'Next'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results screen
  if (mode === 'results' && simulationResult) {
    const conditionName = currentCondition?.condition_name || selectedCondition?.conditionName;
    const diagnosticCode = currentCondition?.diagnostic_code || selectedCondition?.diagnosticCode;
    
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
        role="dialog"
        aria-modal="true"
        aria-label="C&P Exam Simulation Results"
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto modal-content overscroll-contain relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white z-10"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          
          <div className="p-6">
            <SimulatorFeedback
              result={simulationResult}
              conditionName={conditionName}
              diagnosticCode={diagnosticCode}
              answers={answers}
              questions={currentQuestions}
              onRestart={handleRestart}
              onClose={onClose}
              onSendToCalculator={onSendToCalculator ? () => onSendToCalculator(simulationResult, conditionName, diagnosticCode) : null}
            />
          </div>
        </div>
        
        {/* Buy Me a Coffee - simulation completed */}
        <BuyMeCoffee 
          show={true} 
          trigger="cap-sim"
          context={{ 
            rating: simulationResult?.predictedRating,
            conditionName: conditionName
          }}
          componentKey="cap-simulator"
        />
      </div>
    );
  }

  return null;
};

export default CAPSimulator;
