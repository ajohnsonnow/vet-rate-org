import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { jsPDF } from 'jspdf';
import { FocusToggle } from '../contexts/FocusModeContext';
import ShareButton from './ShareButton';
import { generateAI, getAIStatus, AI_MODES, isAnyAIAvailable } from '../utils/unifiedAIService';
import { AIStatusBadge, AIModeSelector } from './AIModeSelector';

/**
 * SymptomLogger Component - "The 50% Maker"
 * 
 * WHY: Migraines and IBS are rated on FREQUENCY. 50% migraines need "prostrating attacks 
 * averaging one per month over the last several months."
 * 
 * PROBLEM: At a C&P exam, veterans are asked "How often do you get migraines?" 
 * and they say "Um... I dunno, a lot?" That's not evidence.
 * 
 * THIS FIX: A simple, LOCAL log that tracks:
 * - Date of attack
 * - Severity (1-10)
 * - Duration
 * - Did you have to stop your activity? (Prostrating = yes)
 * 
 * CLIENT-SIDE ONLY: Uses localStorage. No database needed.
 */

const STORAGE_KEY = 'vetrate_symptom_logs';

// Symptom type configurations
const SYMPTOM_TYPES = {
  migraine: {
    label: 'Migraine',
    emoji: '🤕',
    color: 'purple',
    ratingCriteria: [
      { rating: 50, description: 'Prostrating attacks occurring on average once a month' },
      { rating: 30, description: 'Prostrating attacks averaging once every 2 months' },
      { rating: 10, description: 'Prostrating attacks averaging one in 2 months' },
      { rating: 0, description: 'Less frequent attacks' },
    ],
    durationOptions: [
      '< 1 hour',
      '1-4 hours',
      '4-12 hours',
      '12-24 hours',
      '24-48 hours',
      '48+ hours',
    ],
    questions: {
      prostrating: 'Did you have to stop what you were doing?',
      medication: 'Did you take medication?',
      triggers: 'What triggered it?',
    },
  },
  ibs: {
    label: 'IBS Episode',
    emoji: '🚽',
    color: 'blue',
    ratingCriteria: [
      { rating: 30, description: 'Severe; diarrhea or alternating with constipation, with more or less constant abdominal distress' },
      { rating: 10, description: 'Moderate; frequent episodes of bowel disturbance with abdominal distress' },
      { rating: 0, description: 'Mild; disturbances of bowel function with occasional episodes of abdominal distress' },
    ],
    durationOptions: [
      '< 1 hour',
      '1-4 hours',
      '4-12 hours',
      '12-24 hours',
      'All day',
    ],
    questions: {
      prostrating: 'Did it prevent you from working/activities?',
      medication: 'Did you take medication?',
      triggers: 'What triggered it?',
    },
  },
  pain: {
    label: 'Pain Flare-Up',
    emoji: '⚡',
    color: 'red',
    ratingCriteria: [
      { rating: 40, description: 'Constant or near-constant pain with severe functional impairment' },
      { rating: 20, description: 'Frequent episodes with moderate functional impairment' },
      { rating: 10, description: 'Intermittent pain with mild functional impairment' },
      { rating: 0, description: 'Occasional pain not requiring frequent treatment' },
    ],
    durationOptions: [
      '< 1 hour',
      '1-4 hours',
      '4-8 hours',
      '8-12 hours',
      '12-24 hours',
      'Multiple days',
      'Constant',
    ],
    questions: {
      prostrating: 'Did the pain prevent normal activities?',
      medication: 'Did you take pain medication?',
      triggers: 'What triggered the pain?',
    },
  },
  fatigue: {
    label: 'Fatigue Episode',
    emoji: '😴',
    color: 'orange',
    ratingCriteria: [
      { rating: 100, description: 'Bed/couch-bound, unable to perform basic self-care' },
      { rating: 60, description: 'Severely limited activity, frequent rest periods required' },
      { rating: 40, description: 'Moderate limitation, reduced work capacity' },
      { rating: 10, description: 'Mild fatigue with minimal impact' },
    ],
    durationOptions: [
      'Few hours',
      'Half day',
      'Full day',
      'Multiple days',
      'Week or more',
    ],
    questions: {
      prostrating: 'Were you unable to complete normal activities?',
      medication: 'Did you take any medication/supplements?',
      triggers: 'What preceded this fatigue?',
    },
  },
  sleep: {
    label: 'Sleep Disorder',
    emoji: '😵',
    color: 'indigo',
    ratingCriteria: [
      { rating: 50, description: 'Chronic sleep impairment with total occupational and social impairment' },
      { rating: 30, description: 'Persistent difficulty falling or staying asleep affecting daily function' },
      { rating: 10, description: 'Occasional sleep disturbance with mild impairment' },
      { rating: 0, description: 'Rare sleep issues' },
    ],
    durationOptions: [
      'One night',
      'Few nights',
      'Full week',
      'Multiple weeks',
      'Chronic/ongoing',
    ],
    questions: {
      prostrating: 'Did lack of sleep impair your next-day function?',
      medication: 'Did you use sleep aids?',
      triggers: 'What affected your sleep?',
    },
  },
  digestive: {
    label: 'Digestive Issue',
    emoji: '🫃',
    color: 'amber',
    ratingCriteria: [
      { rating: 30, description: 'Severe/constant distress requiring frequent medical management' },
      { rating: 10, description: 'Frequent episodes requiring dietary restrictions' },
      { rating: 0, description: 'Occasional episodes with mild symptoms' },
    ],
    durationOptions: [
      '< 1 hour',
      '1-4 hours',
      '4-12 hours',
      'Full day',
      'Multiple days',
    ],
    questions: {
      prostrating: 'Did it prevent work/normal activities?',
      medication: 'Did you take medication for relief?',
      triggers: 'Food/stress/other triggers?',
    },
  },
  mental: {
    label: 'Mental Health Episode',
    emoji: '🧠',
    color: 'teal',
    ratingCriteria: [
      { rating: 70, description: 'Severe impairment in most areas of life' },
      { rating: 50, description: 'Significant impairment in work and social functioning' },
      { rating: 30, description: 'Moderate symptoms with occasional impairment' },
      { rating: 10, description: 'Mild symptoms with minimal impairment' },
    ],
    durationOptions: [
      'Few hours',
      'Half day',
      'Full day',
      'Multiple days',
      'Week or more',
    ],
    questions: {
      prostrating: 'Were you unable to function normally?',
      medication: 'Did you take medication as needed?',
      triggers: 'What triggered this episode?',
    },
  },
  general: {
    label: 'Body Issue/Symptom',
    emoji: '📍',
    color: 'slate',
    ratingCriteria: [
      { rating: 'varies', description: 'Track any symptoms to document frequency and severity patterns' },
    ],
    durationOptions: [
      'Brief (< 1 hour)',
      'Few hours',
      'Half day',
      'Full day',
      'Multiple days',
      'Ongoing',
    ],
    questions: {
      prostrating: 'Did it limit your normal activities?',
      medication: 'Did you take any medication?',
      triggers: 'What might have caused this?',
    },
  },
};

const SymptomLogger = ({ onClose, onReportBug }) => {
  useBodyScrollLock(true);
  
  const symptomLoggerContentRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('log'); // 'log', 'history', 'export'
  const [symptomType, setSymptomType] = useState('migraine');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  
  // AI State
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiStatus, setAIStatus] = useState({ available: false });
  const [isAIGenerating, setIsAIGenerating] = useState(null); // null or field name being generated
  const [aiError, setAIError] = useState('');
  
  // Form state for new log
  const [newLog, setNewLog] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    severity: 5,
    duration: '',
    bodyLocation: '', // NEW: Track where the symptom occurred
    painScale: 5, // NEW: For pain-specific tracking (0-10)
    activityImpact: '', // NEW: What activities were affected
    prostrating: false,
    medication: false,
    triggers: '',
    weather: '', // NEW: Weather conditions
    stressLevel: 5, // NEW: Stress level (0-10)
    notes: '',
  });
  
  // Check AI status on mount
  useEffect(() => {
    const checkAI = async () => {
      const status = await getAIStatus();
      setAIStatus(status);
    };
    checkAI();
  }, []);

  // Load logs from localStorage on mount
  useEffect(() => {
    const savedLogs = localStorage.getItem(STORAGE_KEY);
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error('Failed to parse symptom logs:', e);
        setLogs([]);
      }
    }
    
    // Check for prefilled data from Somatic Target
    const prefillData = localStorage.getItem('vetrate_symptom_prefill');
    if (prefillData) {
      try {
        const data = JSON.parse(prefillData);
        // Set the symptom type and prefill form
        if (data.type) setSymptomType(data.type);
        setNewLog(prev => ({
          ...prev,
          bodyLocation: data.bodyPart || '',
          notes: data.notes || '',
        }));
        // Clear the prefill data after using it
        localStorage.removeItem('vetrate_symptom_prefill');
        // Switch to log tab to show the prefilled form
        setActiveTab('log');
      } catch (e) {
        console.error('Failed to parse prefill data:', e);
      }
    }
  }, []);

  // Save logs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }, [logs]);

  // Calculate statistics
  const stats = useMemo(() => {
    const filteredLogs = logs.filter(log => log.type === symptomType);
    const now = new Date();
    
    // Last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last30Days = filteredLogs.filter(log => new Date(log.date) >= thirtyDaysAgo);
    
    // Last 90 days
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const last90Days = filteredLogs.filter(log => new Date(log.date) >= ninetyDaysAgo);
    
    // Prostrating attacks
    const prostratingLast30 = last30Days.filter(log => log.prostrating).length;
    const prostratingLast90 = last90Days.filter(log => log.prostrating).length;
    
    // Average severity
    const avgSeverity = last30Days.length > 0
      ? (last30Days.reduce((sum, log) => sum + log.severity, 0) / last30Days.length).toFixed(1)
      : 0;
    
    // Suggested rating based on frequency
    let suggestedRating = 0;
    const avgPerMonth = prostratingLast90 / 3;
    
    if (symptomType === 'migraine') {
      if (avgPerMonth >= 1) suggestedRating = 50;
      else if (avgPerMonth >= 0.5) suggestedRating = 30;
      else if (avgPerMonth > 0) suggestedRating = 10;
    } else if (symptomType === 'ibs') {
      if (prostratingLast30 >= 10) suggestedRating = 30;
      else if (prostratingLast30 >= 4) suggestedRating = 10;
    }
    
    return {
      total: filteredLogs.length,
      last30Days: last30Days.length,
      last90Days: last90Days.length,
      prostratingLast30,
      prostratingLast90,
      avgSeverity,
      avgPerMonth: avgPerMonth.toFixed(1),
      suggestedRating,
    };
  }, [logs, symptomType]);

  const handleAddLog = () => {
    if (!newLog.duration) {
      alert('Please select a duration.');
      return;
    }

    const logEntry = {
      id: Date.now().toString(),
      type: symptomType,
      ...newLog,
      createdAt: new Date().toISOString(),
    };

    setLogs(prev => [logEntry, ...prev]);
    
    // Reset form
    setNewLog({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      severity: 5,
      duration: '',
      bodyLocation: '',
      painScale: 5,
      activityImpact: '',
      prostrating: false,
      medication: false,
      triggers: '',
      weather: '',
      stressLevel: 5,
      notes: '',
    });
    
    // Switch to history tab to show new entry
    setActiveTab('history');
  };

  const handleDeleteLog = (logId) => {
    setLogs(prev => prev.filter(log => log.id !== logId));
    setShowDeleteConfirm(null);
  };
  
  // AI Suggestion Prompts for each symptom type and field
  const getAISuggestionPrompt = (field) => {
    const config = SYMPTOM_TYPES[symptomType];
    const contextData = {
      symptomType: config.label,
      severity: newLog.severity,
      duration: newLog.duration,
      bodyLocation: newLog.bodyLocation,
      weather: newLog.weather,
      stressLevel: newLog.stressLevel,
      prostrating: newLog.prostrating,
      medication: newLog.medication,
    };
    
    const symptomPrompts = {
      migraine: {
        triggers: `Help a veteran document migraine triggers for VA disability evidence. Current context: severity ${contextData.severity}/10, duration: ${contextData.duration || 'not specified'}, weather: ${contextData.weather || 'not specified'}, stress level: ${contextData.stressLevel}/10.
        
Generate 5-7 common migraine triggers relevant to this context. Format as a brief comma-separated list the veteran can select from or use as inspiration. Include triggers like: bright lights, loud noises, strong smells, weather changes, stress, lack of sleep, certain foods, dehydration, screen time, hormonal changes.`,
        
        activityImpact: `Help a veteran document how a migraine affected their daily activities for VA disability evidence. Severity: ${contextData.severity}/10, Duration: ${contextData.duration || 'unknown'}, Prostrating: ${contextData.prostrating ? 'Yes - had to stop activities' : 'No'}.
        
Generate a brief description of activities typically affected by a migraine of this severity. Focus on work impact, daily tasks, and social activities. Write 2-3 sentences that the veteran can customize.`,
        
        notes: `Help a veteran write clinical notes for a migraine episode for VA disability documentation. Context:
- Severity: ${contextData.severity}/10
- Duration: ${contextData.duration || 'not specified'}
- Location: ${contextData.bodyLocation || 'head'}
- Weather: ${contextData.weather || 'not noted'}
- Stress: ${contextData.stressLevel}/10
- Prostrating: ${contextData.prostrating ? 'Yes' : 'No'}
- Medication: ${contextData.medication ? 'Yes' : 'No'}

Write a 2-3 sentence clinical-style note describing this episode. Include sensory symptoms (light/sound sensitivity, aura), physical symptoms (nausea, vision changes), and functional impact. Use language suitable for medical documentation.`,
      },
      
      ibs: {
        triggers: `Help a veteran document IBS triggers for VA disability evidence. Context: severity ${contextData.severity}/10, duration: ${contextData.duration || 'not specified'}, stress level: ${contextData.stressLevel}/10.
        
Generate 5-7 common IBS triggers. Include: specific foods (dairy, gluten, caffeine, spicy foods), stress, anxiety, lack of sleep, irregular eating schedule, medications.`,
        
        activityImpact: `Help a veteran document how an IBS episode affected their daily activities for VA disability evidence. Severity: ${contextData.severity}/10, Duration: ${contextData.duration || 'unknown'}, Prostrating: ${contextData.prostrating ? 'Yes - prevented normal activities' : 'No'}.
        
Generate a brief description of activities typically affected. Focus on work interruptions, inability to leave home/bathroom access needs, social/travel limitations. Write 2-3 sentences the veteran can customize.`,
        
        notes: `Help a veteran write clinical notes for an IBS episode for VA disability documentation. Context:
- Severity: ${contextData.severity}/10
- Duration: ${contextData.duration || 'not specified'}
- Stress: ${contextData.stressLevel}/10
- Prostrating: ${contextData.prostrating ? 'Yes' : 'No'}
- Medication: ${contextData.medication ? 'Yes' : 'No'}

Write a 2-3 sentence clinical-style note. Include symptoms (cramping, bloating, urgency, frequency), impact on ability to work/function, and any relief measures. Use medical documentation language.`,
      },
      
      pain: {
        triggers: `Help a veteran document pain flare-up triggers for VA disability evidence. Context: pain scale ${contextData.painScale || contextData.severity}/10, location: ${contextData.bodyLocation || 'not specified'}, weather: ${contextData.weather || 'not specified'}.
        
Generate 5-7 common pain triggers relevant to this context. Include: physical activity, prolonged sitting/standing, weather changes, lifting, repetitive motions, stress, poor sleep.`,
        
        activityImpact: `Help a veteran document how a pain flare-up affected their daily activities for VA disability evidence. Pain: ${contextData.painScale || contextData.severity}/10, Location: ${contextData.bodyLocation || 'not specified'}, Duration: ${contextData.duration || 'unknown'}, Prostrating: ${contextData.prostrating ? 'Yes' : 'No'}.
        
Generate a description of functional limitations. Include specific activities that were difficult/impossible, mobility issues, work impact. Write 2-3 sentences.`,
        
        notes: `Help a veteran write clinical notes for a pain flare-up for VA disability documentation. Context:
- Pain Level: ${contextData.painScale || contextData.severity}/10
- Location: ${contextData.bodyLocation || 'not specified'}
- Duration: ${contextData.duration || 'not specified'}
- Weather: ${contextData.weather || 'not noted'}
- Prostrating: ${contextData.prostrating ? 'Yes' : 'No'}
- Medication: ${contextData.medication ? 'Yes' : 'No'}

Write a 2-3 sentence clinical note describing the pain quality (sharp, dull, radiating, burning), functional limitations, and impact on daily activities. Use medical terminology.`,
      },
      
      mental: {
        triggers: `Help a veteran document mental health episode triggers for VA disability evidence. Context: severity ${contextData.severity}/10, stress level: ${contextData.stressLevel}/10.
        
Generate 5-7 common mental health triggers. Include: specific stressors, anniversary reactions, crowds, loud noises, sleep disturbance, isolation, reminders of service, work stress, family conflict.`,
        
        activityImpact: `Help a veteran document how a mental health episode affected their daily activities for VA disability evidence. Severity: ${contextData.severity}/10, Duration: ${contextData.duration || 'unknown'}, Unable to function normally: ${contextData.prostrating ? 'Yes' : 'No'}.
        
Generate a description of functional impact. Include work/social impairment, isolation, inability to complete tasks, relationship effects. Write 2-3 sentences.`,
        
        notes: `Help a veteran write clinical notes for a mental health episode for VA disability documentation. Context:
- Severity: ${contextData.severity}/10
- Duration: ${contextData.duration || 'not specified'}
- Stress Level: ${contextData.stressLevel}/10
- Unable to function: ${contextData.prostrating ? 'Yes' : 'No'}
- Medication: ${contextData.medication ? 'Yes' : 'No'}

Write a 2-3 sentence clinical note describing symptoms (anxiety, depression, hypervigilance, avoidance, intrusive thoughts), behavioral changes, and occupational/social impact. Use appropriate clinical language.`,
      },
      
      fatigue: {
        triggers: `Help a veteran document fatigue episode triggers for VA disability evidence. Context: severity ${contextData.severity}/10, duration: ${contextData.duration || 'not specified'}.
        
Generate 5-7 common fatigue triggers. Include: poor sleep, physical exertion, stress, medications, weather, chronic pain flares, mental health symptoms.`,
        
        activityImpact: `Help a veteran document how fatigue affected their daily activities for VA disability evidence. Severity: ${contextData.severity}/10, Duration: ${contextData.duration || 'unknown'}, Unable to function: ${contextData.prostrating ? 'Yes' : 'No'}.
        
Generate a description of functional limitations. Include inability to work, rest requirements, cognitive effects, self-care difficulties. Write 2-3 sentences.`,
        
        notes: `Help a veteran write clinical notes for a fatigue episode for VA disability documentation. Context:
- Severity: ${contextData.severity}/10
- Duration: ${contextData.duration || 'not specified'}
- Unable to function: ${contextData.prostrating ? 'Yes' : 'No'}

Write a 2-3 sentence clinical note describing fatigue severity, physical/cognitive symptoms, rest requirements, and impact on daily functioning.`,
      },
      
      sleep: {
        triggers: `Help a veteran document sleep disorder triggers for VA disability evidence. Context: severity ${contextData.severity}/10, stress level: ${contextData.stressLevel}/10.
        
Generate 5-7 common sleep disruption triggers. Include: nightmares, pain, anxiety, medications, caffeine, irregular schedule, environmental factors, sleep apnea symptoms.`,
        
        activityImpact: `Help a veteran document how sleep problems affected their next-day activities for VA disability evidence. Severity: ${contextData.severity}/10, Duration: ${contextData.duration || 'unknown'}, Impaired next-day function: ${contextData.prostrating ? 'Yes' : 'No'}.
        
Generate a description of daytime impairment. Include work performance, cognitive function, safety concerns, mood effects. Write 2-3 sentences.`,
        
        notes: `Help a veteran write clinical notes for sleep disturbance for VA disability documentation. Context:
- Severity: ${contextData.severity}/10
- Duration: ${contextData.duration || 'not specified'}
- Impaired function: ${contextData.prostrating ? 'Yes' : 'No'}

Write a 2-3 sentence clinical note describing sleep quality, disturbances (insomnia, nightmares, apnea), and impact on daytime functioning.`,
      },
    };
    
    // Default prompts for symptom types not specifically defined
    const defaultPrompts = {
      triggers: `Help a veteran document ${config.label.toLowerCase()} triggers for VA disability evidence. Severity: ${contextData.severity}/10.
      
Generate 5-7 potential triggers or contributing factors that the veteran can select from or customize.`,
      
      activityImpact: `Help a veteran document how ${config.label.toLowerCase()} affected their daily activities. Severity: ${contextData.severity}/10, Prostrating: ${contextData.prostrating ? 'Yes' : 'No'}.
      
Generate 2-3 sentences describing typical activity limitations for documentation purposes.`,
      
      notes: `Help a veteran write clinical notes for a ${config.label.toLowerCase()} episode. Severity: ${contextData.severity}/10, Duration: ${contextData.duration || 'unknown'}, Prostrating: ${contextData.prostrating ? 'Yes' : 'No'}.
      
Write a 2-3 sentence clinical-style note suitable for VA disability documentation.`,
    };
    
    return symptomPrompts[symptomType]?.[field] || defaultPrompts[field];
  };
  
  // Generate AI suggestion for a field
  const generateAISuggestion = async (field) => {
    if (!aiStatus.available) {
      setAIError('Please configure AI in settings first');
      return;
    }
    
    setIsAIGenerating(field);
    setAIError('');
    
    try {
      const prompt = getAISuggestionPrompt(field);
      
      const response = await generateAI(
        `${prompt}

IMPORTANT: Respond with ONLY the requested text, no explanations or prefixes. Keep it concise and directly usable.`,
        {
          temperature: 0.7,
          maxTokens: 300,
          systemPrompt: 'You are a VA disability documentation assistant helping veterans create accurate, clinical-quality symptom logs. Provide concise, directly usable text that veterans can customize. Use appropriate medical terminology when relevant.'
        }
      );
      
      // generateAI returns { text, mode } object - extract the text content
      const text = response?.text || response;
      if (text) {
        const textStr = typeof text === 'string' ? text : JSON.stringify(text);
        setNewLog(prev => ({
          ...prev,
          [field]: prev[field] ? `${prev[field]} ${textStr}` : textStr
        }));
      } else {
        setAIError('Failed to generate suggestion');
      }
    } catch (error) {
      setAIError('AI generation failed. Please try again.');
    } finally {
      setIsAIGenerating(null);
    }
  };

  const handleExportPDF = () => {
    const config = SYMPTOM_TYPES[symptomType];
    const filteredLogs = logs.filter(log => log.type === symptomType);
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;
    
    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(`${config.label} Symptom Log`, margin, y);
    y += 10;
    
    // Subtitle with date range
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Total Entries: ${filteredLogs.length}`, margin, y);
    y += 15;
    
    // Statistics Box
    doc.setDrawColor(66, 66, 66);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 45, 3, 3, 'FD');
    y += 8;
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text('FREQUENCY SUMMARY (VA Rating Evidence)', margin + 5, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`• Prostrating attacks in last 30 days: ${stats.prostratingLast30}`, margin + 5, y);
    y += 6;
    doc.text(`• Prostrating attacks in last 90 days: ${stats.prostratingLast90}`, margin + 5, y);
    y += 6;
    doc.text(`• Average prostrating attacks per month (90-day): ${stats.avgPerMonth}`, margin + 5, y);
    y += 6;
    doc.text(`• Average severity: ${stats.avgSeverity}/10`, margin + 5, y);
    y += 6;
    
    doc.setFont(undefined, 'bold');
    doc.text(`• Suggested VA Rating: ${stats.suggestedRating}%`, margin + 5, y);
    y += 15;
    
    // Rating criteria reference
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(100);
    doc.text(`${config.label} Rating Criteria Reference:`, margin, y);
    y += 5;
    config.ratingCriteria.forEach(criteria => {
      doc.text(`${criteria.rating}%: ${criteria.description}`, margin + 5, y);
      y += 4;
    });
    y += 10;
    
    // Log entries header
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text('DETAILED LOG ENTRIES', margin, y);
    y += 8;
    
    // Log entries
    doc.setFontSize(9);
    filteredLogs.forEach((log, index) => {
      // Check if we need a new page
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${log.date} at ${log.time}`, margin, y);
      y += 5;
      
      doc.setFont(undefined, 'normal');
      doc.text(`   Severity: ${log.severity}/10 | Duration: ${log.duration} | Prostrating: ${log.prostrating ? 'YES' : 'No'}`, margin, y);
      y += 5;
      
      if (log.bodyLocation) {
        doc.text(`   Body Location: ${log.bodyLocation}`, margin, y);
        y += 5;
      }
      
      if (log.activityImpact) {
        doc.text(`   Activities Affected: ${log.activityImpact}`, margin, y);
        y += 5;
      }
      
      if (log.weather || log.stressLevel !== undefined) {
        let envInfo = '   Environmental: ';
        if (log.weather) envInfo += `Weather: ${log.weather} | `;
        if (log.stressLevel !== undefined) envInfo += `Stress Level: ${log.stressLevel}/10`;
        doc.text(envInfo, margin, y);
        y += 5;
      }
      
      if (log.triggers) {
        doc.text(`   Triggers: ${log.triggers}`, margin, y);
        y += 5;
      }
      
      if (log.notes) {
        const noteLines = doc.splitTextToSize(`   Notes: ${log.notes}`, pageWidth - margin * 2 - 10);
        noteLines.forEach(line => {
          doc.text(line, margin, y);
          y += 4;
        });
      }
      
      y += 5;
    });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Generated by Vet-Rate.org Symptom Logger', margin, 285);
    doc.text('This log is veteran-generated evidence for VA disability claims.', margin, 289);
    
    // Save PDF
    doc.save(`${symptomType}_log_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const config = SYMPTOM_TYPES[symptomType];
  const colorClasses = {
    purple: {
      bg: 'bg-purple-600',
      bgLight: 'bg-purple-50 dark:bg-purple-900/30',
      border: 'border-purple-200 dark:border-purple-700',
      text: 'text-purple-700 dark:text-purple-300',
    },
    blue: {
      bg: 'bg-blue-600',
      bgLight: 'bg-blue-50 dark:bg-blue-900/30',
      border: 'border-blue-200 dark:border-blue-700',
      text: 'text-blue-700 dark:text-blue-300',
    },
    red: {
      bg: 'bg-red-600',
      bgLight: 'bg-red-50 dark:bg-red-900/30',
      border: 'border-red-200 dark:border-red-700',
      text: 'text-red-700 dark:text-red-300',
    },
    orange: {
      bg: 'bg-orange-600',
      bgLight: 'bg-orange-50 dark:bg-orange-900/30',
      border: 'border-orange-200 dark:border-orange-700',
      text: 'text-orange-700 dark:text-orange-300',
    },
    indigo: {
      bg: 'bg-indigo-600',
      bgLight: 'bg-indigo-50 dark:bg-indigo-900/30',
      border: 'border-indigo-200 dark:border-indigo-700',
      text: 'text-indigo-700 dark:text-indigo-300',
    },
    amber: {
      bg: 'bg-amber-600',
      bgLight: 'bg-amber-50 dark:bg-amber-900/30',
      border: 'border-amber-200 dark:border-amber-700',
      text: 'text-amber-700 dark:text-amber-300',
    },
    teal: {
      bg: 'bg-teal-600',
      bgLight: 'bg-teal-50 dark:bg-teal-900/30',
      border: 'border-teal-200 dark:border-teal-700',
      text: 'text-teal-700 dark:text-teal-300',
    },
    slate: {
      bg: 'bg-slate-600',
      bgLight: 'bg-slate-50 dark:bg-slate-900/30',
      border: 'border-slate-200 dark:border-slate-700',
      text: 'text-slate-700 dark:text-slate-300',
    },
  };
  const colors = colorClasses[config.color];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="symptom-logger-title"
    >
      <div ref={symptomLoggerContentRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white px-6 py-6 rounded-t-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <span className="text-3xl">{config.emoji}</span>
              </div>
              <div>
                <h2 id="symptom-logger-title" className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  Symptom Logger
                  <AIStatusBadge status={aiStatus} />
                  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">BETA</span>
                </h2>
                <p className="text-white/80 text-sm sm:text-base mt-1">
                  The 50% Maker • Track Frequency for VA Ratings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAISettings(!showAISettings)}
                className={`p-2 rounded-lg transition-colors ${
                  showAISettings ? 'bg-white/30 text-white' : 'hover:bg-white/20 text-white/80'
                }`}
                title="AI Settings"
              >
                <span className="text-xl">🤖</span>
              </button>
              <ShareButton 
                targetRef={symptomLoggerContentRef}
                filename="symptom-log"
                variant="icon"
              />
              {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Symptom Logger" />}
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
          
          {/* AI Settings Panel */}
          {showAISettings && (
            <div className="mt-4 p-4 bg-white/10 backdrop-blur rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">🤖 AI Assistant</span>
                <span className="text-sm text-white/70">
                  {aiStatus.available ? `Using ${aiStatus.mode}` : 'Not configured'}
                </span>
              </div>
              <AIModeSelector 
                onModeChange={async () => {
                  const status = await getAIStatus();
                  setAIStatus(status);
                }}
              />
              <p className="text-xs text-white/70 mt-2">
                ✨ AI can help suggest triggers, activity impact, and clinical-style notes for your symptom entries.
              </p>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          {/* Symptom Type Selector */}
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {Object.entries(SYMPTOM_TYPES).map(([key, typeConfig]) => {
                const isActive = symptomType === key;
                const colorMap = {
                  migraine: 'bg-purple-600',
                  ibs: 'bg-blue-600',
                  pain: 'bg-red-600',
                  fatigue: 'bg-orange-600',
                  sleep: 'bg-indigo-600',
                  digestive: 'bg-amber-600',
                  mental: 'bg-teal-600',
                  general: 'bg-slate-600',
                };
                return (
                  <button
                    key={key}
                    onClick={() => setSymptomType(key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      isActive
                        ? `${colorMap[key]} text-white shadow-lg`
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span>{typeConfig.emoji}</span>
                    <span className="whitespace-nowrap">{typeConfig.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 pt-4 border-b dark:border-gray-700">
            <nav className="flex gap-1">
              {[
                { id: 'log', label: '➕ Log Attack', icon: '📝' },
                { id: 'history', label: `📋 History (${logs.filter(l => l.type === symptomType).length})`, icon: '📋' },
                { id: 'export', label: '📊 Stats & Export', icon: '📊' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.id
                      ? `${colors.bg} text-white`
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Log Attack Tab */}
            {activeTab === 'log' && (
              <div className="space-y-6">
                <div className={`p-4 ${colors.bgLight} ${colors.border} border rounded-xl`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{config.emoji}</span>
                    <div>
                      <h3 className={`font-bold ${colors.text}`}>Why Track Frequency?</h3>
                      <p className={`text-sm ${colors.text} mt-1`}>
                        The VA rates {config.label.toLowerCase()}s on <strong>frequency</strong>, not just severity. 
                        Having a documented log showing "X prostrating attacks per month" is powerful evidence.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Date & Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      📅 Date
                    </label>
                    <input
                      type="date"
                      value={newLog.date}
                      onChange={(e) => setNewLog(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ⏰ Time
                    </label>
                    <input
                      type="time"
                      value={newLog.time}
                      onChange={(e) => setNewLog(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Severity */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      💢 Severity: {newLog.severity}/10
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={newLog.severity}
                      onChange={(e) => setNewLog(prev => ({ ...prev, severity: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1 - Mild</span>
                      <span>5 - Moderate</span>
                      <span>10 - Severe</span>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ⏱️ Duration
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {config.durationOptions.map(option => (
                        <button
                          key={option}
                          onClick={() => setNewLog(prev => ({ ...prev, duration: option }))}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            newLog.duration === option
                              ? `${colors.bg} text-white`
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Body Location - NEW FIELD */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      📍 Body Location (optional)
                    </label>
                    <input
                      type="text"
                      value={newLog.bodyLocation}
                      onChange={(e) => setNewLog(prev => ({ ...prev, bodyLocation: e.target.value }))}
                      placeholder="e.g., Lower back, Left knee, Head/neck, Stomach..."
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      💡 Tip: Use the Somatic Target tool to select precise body locations
                    </p>
                  </div>

                  {/* Pain Scale - Show for pain type */}
                  {symptomType === 'pain' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        🔥 Pain Scale: {newLog.painScale}/10
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={newLog.painScale}
                        onChange={(e) => setNewLog(prev => ({ ...prev, painScale: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0 - No pain</span>
                        <span>5 - Moderate</span>
                        <span>10 - Worst possible</span>
                      </div>
                    </div>
                  )}

                  {/* Activity Impact - NEW FIELD */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      🎯 Activities Affected (optional)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newLog.activityImpact}
                        onChange={(e) => setNewLog(prev => ({ ...prev, activityImpact: e.target.value }))}
                        placeholder="e.g., Couldn't work, Missed gym, Cancelled plans, Had to rest..."
                        className="w-full px-4 py-3 pr-24 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                      />
                      {aiStatus.available && (
                        <button
                          onClick={() => generateAISuggestion('activityImpact')}
                          disabled={isAIGenerating === 'activityImpact'}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50"
                        >
                          {isAIGenerating === 'activityImpact' ? '...' : '✨ AI'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Weather Conditions - NEW FIELD */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      🌤️ Weather (optional)
                    </label>
                    <select
                      value={newLog.weather}
                      onChange={(e) => setNewLog(prev => ({ ...prev, weather: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select weather</option>
                      <option value="Clear/Sunny">Clear/Sunny</option>
                      <option value="Cloudy">Cloudy</option>
                      <option value="Rainy">Rainy</option>
                      <option value="Stormy">Stormy</option>
                      <option value="Hot">Hot</option>
                      <option value="Cold">Cold</option>
                      <option value="Humid">Humid</option>
                      <option value="Windy">Windy</option>
                      <option value="Pressure Change">Barometric Pressure Change</option>
                    </select>
                  </div>

                  {/* Stress Level - NEW FIELD */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      😰 Stress Level: {newLog.stressLevel}/10
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={newLog.stressLevel}
                      onChange={(e) => setNewLog(prev => ({ ...prev, stressLevel: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0 - Calm</span>
                      <span>5 - Moderate</span>
                      <span>10 - Extreme</span>
                    </div>
                  </div>

                  {/* Prostrating */}
                  <div>
                    <label className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={newLog.prostrating}
                        onChange={(e) => setNewLog(prev => ({ ...prev, prostrating: e.target.checked }))}
                        className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <div>
                        <span className="font-medium text-red-800 dark:text-red-200">
                          🛑 {config.questions.prostrating}
                        </span>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          "Prostrating" = had to stop activities. This is KEY for higher ratings!
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Medication */}
                  <div>
                    <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <input
                        type="checkbox"
                        checked={newLog.medication}
                        onChange={(e) => setNewLog(prev => ({ ...prev, medication: e.target.checked }))}
                        className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          💊 {config.questions.medication}
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Triggers */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ⚡ {config.questions.triggers}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newLog.triggers}
                        onChange={(e) => setNewLog(prev => ({ ...prev, triggers: e.target.value }))}
                        placeholder="e.g., stress, weather, certain foods, loud noise..."
                        className="w-full px-4 py-3 pr-24 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                      />
                      {aiStatus.available && (
                        <button
                          onClick={() => generateAISuggestion('triggers')}
                          disabled={isAIGenerating === 'triggers'}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50"
                        >
                          {isAIGenerating === 'triggers' ? '...' : '✨ AI'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      📝 Additional Notes
                    </label>
                    <div className="relative">
                      <textarea
                        value={newLog.notes}
                        onChange={(e) => setNewLog(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Describe what happened, impact on your day, etc."
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 resize-none"
                      />
                      {aiStatus.available && (
                        <button
                          onClick={() => generateAISuggestion('notes')}
                          disabled={isAIGenerating === 'notes'}
                          className="absolute right-2 top-2 px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50"
                        >
                          {isAIGenerating === 'notes' ? '...' : '✨ AI Notes'}
                        </button>
                      )}
                    </div>
                    {aiError && (
                      <p className="text-xs text-red-500 mt-1">{aiError}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleAddLog}
                  className={`w-full py-4 ${colors.bg} text-white rounded-lg font-bold text-lg hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2`}
                >
                  <span>➕</span>
                  <span>Log This Attack</span>
                </button>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {logs.filter(log => log.type === symptomType).length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <div className="text-6xl mb-4">{config.emoji}</div>
                    <p className="text-lg font-medium">No entries yet</p>
                    <p className="text-sm mt-2">
                      Start logging your {config.label.toLowerCase()} attacks to build evidence for your claim.
                    </p>
                    <button
                      onClick={() => setActiveTab('log')}
                      className={`mt-4 px-6 py-2 ${colors.bg} text-white rounded-lg font-medium`}
                    >
                      Log Your First Attack
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {logs
                      .filter(log => log.type === symptomType)
                      .map(log => (
                        <div 
                          key={log.id}
                          className={`p-4 ${colors.bgLight} ${colors.border} border rounded-lg`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                                  {new Date(log.date).toLocaleDateString('en-US', { 
                                    weekday: 'short', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  at {log.time}
                                </span>
                                {log.prostrating && (
                                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold rounded-full">
                                    PROSTRATING
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                <span className={colors.text}>
                                  Severity: <strong>{log.severity}/10</strong>
                                </span>
                                <span className={colors.text}>
                                  Duration: <strong>{log.duration}</strong>
                                </span>
                                {log.medication && (
                                  <span className="text-gray-500 dark:text-gray-400">💊 Medication</span>
                                )}
                              </div>
                              {log.bodyLocation && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                  <strong>📍 Location:</strong> {log.bodyLocation}
                                </p>
                              )}
                              {log.activityImpact && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  <strong>🎯 Activities Affected:</strong> {log.activityImpact}
                                </p>
                              )}
                              {(log.weather || log.stressLevel !== undefined) && (
                                <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400 mt-2">
                                  {log.weather && <span>🌤️ {log.weather}</span>}
                                  {log.stressLevel !== undefined && <span>😰 Stress: {log.stressLevel}/10</span>}
                                </div>
                              )}
                              {log.triggers && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                  <strong>⚡ Triggers:</strong> {log.triggers}
                                </p>
                              )}
                              {log.notes && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  <strong>📝 Notes:</strong> {log.notes}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => setShowDeleteConfirm(log.id)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                              aria-label="Delete entry"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          
                          {/* Delete Confirmation */}
                          {showDeleteConfirm === log.id && (
                            <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/50 rounded-lg flex items-center justify-between">
                              <span className="text-sm text-red-700 dark:text-red-300">Delete this entry?</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDeleteLog(log.id)}
                                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(null)}
                                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Stats & Export Tab */}
            {activeTab === 'export' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                      {stats.prostratingLast30}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Prostrating<br />Last 30 Days
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                      {stats.avgPerMonth}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Avg/Month<br />(90-day)
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                      {stats.avgSeverity}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Avg Severity<br />/10
                    </div>
                  </div>
                  <div className={`rounded-xl p-4 text-center ${stats.suggestedRating >= 30 ? 'bg-green-100 dark:bg-green-900/50' : 'bg-gray-50 dark:bg-gray-900'}`}>
                    <div className={`text-3xl font-bold ${stats.suggestedRating >= 30 ? 'text-green-700 dark:text-green-300' : 'text-gray-800 dark:text-gray-200'}`}>
                      {stats.suggestedRating}%
                    </div>
                    <div className={`text-xs mt-1 ${stats.suggestedRating >= 30 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      Suggested<br />VA Rating
                    </div>
                  </div>
                </div>

                {/* Rating Criteria Reference */}
                <div className={`p-4 ${colors.bgLight} ${colors.border} border rounded-xl`}>
                  <h4 className={`font-semibold ${colors.text} mb-3`}>
                    📋 VA Rating Criteria for {config.label}
                  </h4>
                  <div className="space-y-2">
                    {config.ratingCriteria.map(criteria => (
                      <div 
                        key={criteria.rating}
                        className={`flex items-center gap-3 p-2 rounded-lg ${
                          stats.suggestedRating === criteria.rating 
                            ? 'bg-white dark:bg-gray-800 border-2 border-green-500'
                            : ''
                        }`}
                      >
                        <span className="w-12 h-12 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg font-bold text-lg">
                          {criteria.rating}%
                        </span>
                        <span className={`text-sm ${colors.text}`}>{criteria.description}</span>
                        {stats.suggestedRating === criteria.rating && (
                          <span className="ml-auto text-green-600 dark:text-green-400 text-sm font-medium">
                            ← Your Data
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Export Button */}
                <button
                  onClick={handleExportPDF}
                  disabled={logs.filter(l => l.type === symptomType).length === 0}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <span>📄</span>
                  <span>Export PDF for C&P Exam</span>
                </button>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  Print this and bring it to your C&P exam as documented frequency evidence
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <BuyMeCoffee show={logs.length > 0} trigger="symptom-logger" />
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
  );
};

export default SymptomLogger;
