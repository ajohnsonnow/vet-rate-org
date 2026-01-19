/**
 * Vet-Rate.org - The Witness Bench Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "Buddy Letter Wizard" - AI-powered interview for spouses, family members, and battle buddies
 * Generates VA Form 21-10210 (Lay/Witness Statement) focusing on observable behaviors
 * 
 * The key insight: Veterans downplay their symptoms. Witnesses see the truth.
 * This tool asks the RIGHT questions to get powerful buddy statements.
 */

import React, { useState, useCallback } from 'react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import jsPDF from 'jspdf';
import { isAIAvailable } from '../utils/aiStatementHelper';
import { saveClaim, generateId } from '../utils/claimsStorage';

// API endpoint for Gemini
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// LocalStorage key for BYOK (Bring Your Own Key)
const STORAGE_KEY = 'vetrate_gemini_key';

/**
 * Get the configured API key (localStorage takes priority)
 */
const getApiKey = () => {
  const storedKey = localStorage.getItem(STORAGE_KEY);
  if (storedKey && storedKey.length > 0) return storedKey;
  return import.meta.env.VITE_GEMINI_API_KEY || '';
};

/**
 * Relationship types that affect the interview questions
 */
const RELATIONSHIP_TYPES = [
  { value: 'spouse', label: 'Spouse / Partner', icon: '💑' },
  { value: 'parent', label: 'Parent', icon: '👨‍👩‍👧' },
  { value: 'child', label: 'Adult Child', icon: '👨‍👧' },
  { value: 'sibling', label: 'Sibling', icon: '👫' },
  { value: 'friend', label: 'Close Friend', icon: '🤝' },
  { value: 'buddy', label: 'Battle Buddy / Fellow Veteran', icon: '🎖️' },
  { value: 'coworker', label: 'Coworker / Supervisor', icon: '💼' },
  { value: 'neighbor', label: 'Neighbor', icon: '🏠' },
];

/**
 * Common condition categories for tailored questions
 */
const CONDITION_CATEGORIES = {
  mental: {
    label: 'Mental Health (PTSD, Depression, Anxiety)',
    conditions: ['ptsd', 'depression', 'anxiety', 'bipolar', 'panic', 'sleep', 'insomnia', 'nightmare']
  },
  physical: {
    label: 'Musculoskeletal / Pain (Back, Knee, Neck)',
    conditions: ['back', 'spine', 'knee', 'shoulder', 'neck', 'arthritis', 'pain', 'mobility', 'fibromyalgia']
  },
  neurological: {
    label: 'Neurological (TBI, Headaches, Neuropathy)',
    conditions: ['tbi', 'headache', 'migraine', 'neuropathy', 'tremor', 'memory', 'cognitive']
  },
  hearing: {
    label: 'Hearing / Tinnitus',
    conditions: ['hearing', 'tinnitus', 'deaf', 'ear']
  },
  respiratory: {
    label: 'Respiratory (Asthma, Sleep Apnea, COPD)',
    conditions: ['asthma', 'breathing', 'sleep apnea', 'copd', 'lung']
  },
  other: {
    label: 'Other Condition',
    conditions: []
  }
};

/**
 * Base interview questions by relationship and condition type
 * These are the "good" questions that elicit observable behaviors
 */
const getBaseQuestions = (relationship, conditionCategory) => {
  const questions = [];
  
  // Universal opening question
  questions.push({
    id: 'relationship_context',
    question: `How long have you known the veteran, and in what capacity? (living together, see each other daily, etc.)`,
    placeholder: 'Example: "I have been married to [Veteran] for 15 years and we live together."'
  });
  
  // Mental health specific questions
  if (conditionCategory === 'mental') {
    if (['spouse', 'parent', 'child', 'sibling'].includes(relationship)) {
      questions.push({
        id: 'sleep_behavior',
        question: `Describe the veteran's sleep behavior. Do they have nightmares? Do they talk or scream in their sleep? Do they sleep separately from others?`,
        placeholder: 'Example: "He often wakes up drenched in sweat, yelling. I sleep in a separate room now because he once struck out in his sleep."'
      });
      questions.push({
        id: 'social_withdrawal',
        question: `Tell me about a time you had to cancel plans or leave a social event because of the veteran's condition. Does the veteran avoid crowds or public places?`,
        placeholder: 'Example: "We haven\'t been to a restaurant in 3 years. Last time we tried, he became agitated when seated with his back to the door."'
      });
      questions.push({
        id: 'emotional_changes',
        question: `How has the veteran's personality changed since their service? Are there hobbies or activities they used to enjoy but stopped doing?`,
        placeholder: 'Example: "He used to love coaching our kids\' baseball team. Now he won\'t go near the field because he says the loud noises trigger him."'
      });
    }
    
    if (relationship === 'buddy') {
      questions.push({
        id: 'service_comparison',
        question: `How was the veteran during your time serving together? How is that different from how they are now?`,
        placeholder: 'Example: "In country, he was sharp, always on point. Now when we meet up, he seems distant, jumpy at loud noises."'
      });
    }
    
    questions.push({
      id: 'anger_irritability',
      question: `Have you witnessed outbursts of anger, irritability, or emotional reactions that seem out of proportion? Describe a specific incident.`,
      placeholder: 'Example: "Last month, when a car backfired, he dropped to the ground and it took 10 minutes to calm him down."'
    });
  }
  
  // Physical / musculoskeletal questions
  if (conditionCategory === 'physical') {
    questions.push({
      id: 'daily_tasks',
      question: `What everyday tasks have you observed the veteran struggling with? Does the veteran need help with things like putting on socks, tying shoes, or getting out of bed?`,
      placeholder: 'Example: "I have to help him put on his socks every morning because he cannot bend over. He uses a grabber tool for anything on the floor."'
    });
    questions.push({
      id: 'mobility_changes',
      question: `How has the veteran's ability to move around changed? Do they use any assistive devices? How far can they walk before needing to rest?`,
      placeholder: 'Example: "He used to run marathons. Now he uses a cane and can only walk about 100 yards before his back seizes up."'
    });
    questions.push({
      id: 'pain_observations',
      question: `Describe how you can tell when the veteran is in pain. What does their body language look like? Do they take medications frequently?`,
      placeholder: 'Example: "He grimaces when getting up from chairs. I see him reach for his back constantly. He takes ibuprofen like candy."'
    });
    questions.push({
      id: 'activity_limitations',
      question: `What activities has the veteran had to give up because of their physical condition? What do they avoid doing?`,
      placeholder: 'Example: "He can no longer play with our grandchildren on the floor. He avoids stairs and hasn\'t been able to mow the lawn in 3 years."'
    });
  }
  
  // Neurological questions
  if (conditionCategory === 'neurological') {
    questions.push({
      id: 'memory_issues',
      question: `Have you noticed memory problems? Does the veteran forget conversations, appointments, or important dates? Give a specific example.`,
      placeholder: 'Example: "He forgot our daughter\'s birthday last year. He often repeats the same story in a single conversation without realizing it."'
    });
    questions.push({
      id: 'headache_frequency',
      question: `How often do you see the veteran suffering from headaches or migraines? What do they do when they have one?`,
      placeholder: 'Example: "At least 3-4 times a week, he goes to a dark room for hours. He can\'t tolerate any light or noise during these episodes."'
    });
    questions.push({
      id: 'cognitive_changes',
      question: `Have you noticed changes in the veteran's ability to concentrate, make decisions, or process information?`,
      placeholder: 'Example: "He used to be so sharp with finances. Now I handle all the bills because he gets confused and overwhelmed."'
    });
  }
  
  // Hearing / Tinnitus questions
  if (conditionCategory === 'hearing') {
    questions.push({
      id: 'communication_struggles',
      question: `How does the veteran's hearing affect your daily communication? Do they ask you to repeat yourself? Do you have to face them when speaking?`,
      placeholder: 'Example: "I have to tap his shoulder before speaking and face him directly. He misses phone calls constantly."'
    });
    questions.push({
      id: 'tinnitus_impact',
      question: `If they have tinnitus (ringing in ears), how does it affect them? Do they need background noise to sleep? Do they seem distracted by it?`,
      placeholder: 'Example: "He sleeps with a fan on full blast. In quiet rooms, I see him rubbing his ears and looking distressed."'
    });
  }
  
  // Respiratory questions
  if (conditionCategory === 'respiratory') {
    questions.push({
      id: 'breathing_observations',
      question: `Describe the veteran's breathing difficulties you have witnessed. When do they occur? What does it look like?`,
      placeholder: 'Example: "He gets winded just walking up the stairs. I hear him wheezing at night even with his CPAP machine."'
    });
  }
  
  // Universal closing questions
  questions.push({
    id: 'work_impact',
    question: `How has the veteran's condition affected their ability to work? Have they missed work, been written up, or lost jobs?`,
    placeholder: 'Example: "He\'s lost two jobs in the past year. He can\'t sit for long periods and has to call out frequently for medical appointments."'
  });
  
  questions.push({
    id: 'overall_impact',
    question: `In your own words, how has this condition changed the veteran's quality of life? What is the one thing you most want the VA to understand?`,
    placeholder: 'Example: "He is not the same person who left for deployment. The strong, confident man I married now barely leaves the house."'
  });
  
  return questions;
};

/**
 * Generate interview questions using AI based on relationship and condition
 */
const generateAIQuestions = async (relationship, condition, conditionCategory) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No API key configured');
  }
  
  const relationshipLabel = RELATIONSHIP_TYPES.find(r => r.value === relationship)?.label || relationship;
  
  const prompt = `You are a Gentle Interviewer helping a veteran's family member write a "Lay Statement" (VA Form 21-10210).

CONTEXT:
- Relationship to veteran: ${relationshipLabel}
- Condition being claimed: ${condition}
- Condition category: ${conditionCategory}

YOUR GOAL:
Generate 4 specific, probing interview questions to help this ${relationshipLabel.toLowerCase()} describe how the veteran's ${condition} affects daily life. 

RULES:
1. Ask for STORIES and SPECIFIC EXAMPLES, not yes/no questions
2. Focus on OBSERVABLE behaviors and changes (what they can SEE, HEAR, WITNESS)
3. DO NOT ask for medical opinions or diagnoses
4. Ask about things that would be powerful evidence for the VA

BAD QUESTION: "Is the veteran depressed?"
GOOD QUESTION: "Does the veteran have hobbies they used to love but stopped doing? Tell me about that change."

BAD QUESTION: "Is their back pain severe?"
GOOD QUESTION: "Describe a time you saw the veteran struggle with a simple task like putting on shoes or picking something up from the floor."

Return EXACTLY 4 questions in this JSON format:
{
  "questions": [
    {"id": "q1", "question": "Question text here", "placeholder": "Example response here"},
    {"id": "q2", "question": "Question text here", "placeholder": "Example response here"},
    {"id": "q3", "question": "Question text here", "placeholder": "Example response here"},
    {"id": "q4", "question": "Question text here", "placeholder": "Example response here"}
  ]
}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024
      }
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to generate questions');
  }
  
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid response format');
  }
  
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.questions;
};

/**
 * Compile answers into a formal buddy statement using AI
 */
const compileStatementWithAI = async (relationship, condition, answers) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No API key configured');
  }
  
  const relationshipLabel = RELATIONSHIP_TYPES.find(r => r.value === relationship)?.label || relationship;
  
  // Format answers for the prompt
  const answersText = Object.entries(answers)
    .filter(([_, value]) => value && value.trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n\n');
  
  const prompt = `You are drafting a Buddy/Lay Statement (VA Form 21-10210) for a veteran's ${relationshipLabel.toLowerCase()}.

CONDITION BEING CLAIMED: ${condition}

WITNESS RESPONSES TO INTERVIEW QUESTIONS:
${answersText}

INSTRUCTIONS:
1. Write a first-person narrative from the WITNESS's perspective (use "I have observed..." not "The veteran...")
2. Use the specific details and stories provided - DO NOT invent new facts
3. Focus on OBSERVABLE behaviors, not medical opinions
4. Be sincere and factual, not dramatic or exaggerated
5. Include specific examples when provided
6. Do NOT include names, addresses, or dates (use [Veteran], [Date], etc.)
7. Format as 3-4 coherent paragraphs
8. End with an attestation: "I certify that the statements above are true and correct to the best of my knowledge and belief."

Write the complete buddy statement now:`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 2048
      }
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to generate statement');
  }
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

/**
 * Generate statement without AI (template-based)
 */
const compileStatementWithoutAI = (relationship, condition, answers) => {
  const relationshipLabel = RELATIONSHIP_TYPES.find(r => r.value === relationship)?.label || relationship;
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  let statement = `STATEMENT IN SUPPORT OF CLAIM (VA FORM 21-10210)\n`;
  statement += `Witness Type: ${relationshipLabel}\n`;
  statement += `Regarding: ${condition}\n`;
  statement += `Date: ${currentDate}\n\n`;
  statement += `---\n\n`;
  
  if (answers.relationship_context) {
    statement += `${answers.relationship_context}\n\n`;
  }
  
  statement += `I am writing to provide my personal observations regarding [Veteran]'s ${condition}.\n\n`;
  
  // Add all answered questions
  const observationParts = [];
  
  Object.entries(answers).forEach(([key, value]) => {
    if (value && value.trim() && key !== 'relationship_context') {
      observationParts.push(value.trim());
    }
  });
  
  if (observationParts.length > 0) {
    statement += `Based on my direct observations:\n\n`;
    observationParts.forEach(part => {
      statement += `${part}\n\n`;
    });
  }
  
  statement += `I certify that the statements above are true and correct to the best of my knowledge and belief.\n\n`;
  statement += `Respectfully submitted,\n\n`;
  statement += `_______________________________\n`;
  statement += `[Witness Signature]\n\n`;
  statement += `_______________________________\n`;
  statement += `[Witness Printed Name]\n\n`;
  statement += `_______________________________\n`;
  statement += `[Date]\n\n`;
  statement += `Contact Information:\n`;
  statement += `Phone: ___________________\n`;
  statement += `Email: ___________________\n`;
  
  return statement;
};

export default function WitnessBench({ onClose, onReportBug }) {
  // Lock body scroll when modal is open
  useBodyScrollLock(true);
  
  // Wizard state
  const [step, setStep] = useState(1);
  const [relationship, setRelationship] = useState('');
  const [condition, setCondition] = useState('');
  const [conditionCategory, setConditionCategory] = useState('');
  const [witnessName, setWitnessName] = useState('');
  
  // Interview state
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // AI state
  const [useAI, setUseAI] = useState(true);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isGeneratingStatement, setIsGeneratingStatement] = useState(false);
  const [error, setError] = useState(null);
  
  // Output state
  const [generatedStatement, setGeneratedStatement] = useState('');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [savedToPacket, setSavedToPacket] = useState(false);
  
  /**
   * Save buddy statement to My Packet
   */
  const saveToMyPacket = () => {
    try {
      const claim = {
        conditionName: condition,
        status: 'Evidence Gathered',
        evidence: [{
          type: 'Buddy Statement',
          description: `Lay/Witness Statement (Form 21-10210) from ${RELATIONSHIP_TYPES.find(r => r.value === relationship)?.label}`,
          statement: generatedStatement,
          relationship: relationship,
          witness: witnessName,
          dateSaved: new Date().toISOString()
        }],
        notes: `Buddy statement from ${RELATIONSHIP_TYPES.find(r => r.value === relationship)?.label} regarding observable behaviors and functional impacts.`
      };
      
      const success = saveClaim(claim);
      if (success) {
        setSavedToPacket(true);
        setTimeout(() => setSavedToPacket(false), 3000); // Reset after 3 seconds
      }
    } catch (error) {
      console.error('Error saving to My Packet:', error);
    }
  };
  
  /**
   * Determine condition category from condition name
   */
  const detectConditionCategory = useCallback((conditionName) => {
    const lowerCondition = conditionName.toLowerCase();
    
    for (const [category, data] of Object.entries(CONDITION_CATEGORIES)) {
      if (data.conditions.some(c => lowerCondition.includes(c))) {
        return category;
      }
    }
    return 'other';
  }, []);
  
  /**
   * Move to interview step - load questions
   */
  const startInterview = useCallback(async () => {
    if (!relationship || !condition) {
      setError('Please select a relationship and enter the condition.');
      return;
    }
    
    setError(null);
    const category = detectConditionCategory(condition);
    setConditionCategory(category);
    
    // Try AI questions first if available
    if (useAI && isAIAvailable()) {
      setIsLoadingQuestions(true);
      try {
        const aiQuestions = await generateAIQuestions(relationship, condition, category);
        
        // Combine AI questions with base questions
        const baseQuestions = getBaseQuestions(relationship, category);
        const combinedQuestions = [
          baseQuestions[0], // Always start with relationship context
          ...aiQuestions,
          ...baseQuestions.slice(-2) // Always end with work impact and overall impact
        ];
        
        setQuestions(combinedQuestions);
        setStep(2);
      } catch (err) {
        console.error('AI question generation failed:', err);
        // Fall back to base questions
        setQuestions(getBaseQuestions(relationship, category));
        setStep(2);
      } finally {
        setIsLoadingQuestions(false);
      }
    } else {
      // Use base questions without AI
      setQuestions(getBaseQuestions(relationship, category));
      setStep(2);
    }
  }, [relationship, condition, useAI, detectConditionCategory]);
  
  /**
   * Update answer for current question
   */
  const updateAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };
  
  /**
   * Generate the final statement
   */
  const generateStatement = useCallback(async () => {
    setError(null);
    setIsGeneratingStatement(true);
    
    try {
      let statement;
      
      if (useAI && isAIAvailable()) {
        statement = await compileStatementWithAI(relationship, condition, answers);
      } else {
        statement = compileStatementWithoutAI(relationship, condition, answers);
      }
      
      setGeneratedStatement(statement);
      setStep(3);
    } catch (err) {
      console.error('Statement generation failed:', err);
      // Fall back to template
      const statement = compileStatementWithoutAI(relationship, condition, answers);
      setGeneratedStatement(statement);
      setStep(3);
    } finally {
      setIsGeneratingStatement(false);
    }
  }, [relationship, condition, answers, useAI]);
  
  /**
   * Download as PDF
   */
  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Lay/Witness Statement (VA Form 21-10210)', margin, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const lines = doc.splitTextToSize(generatedStatement, maxWidth);
    let yPosition = 35;
    
    lines.forEach(line => {
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, margin, yPosition);
      yPosition += 5;
    });
    
    doc.save(`Buddy_Statement_${condition.replace(/\s+/g, '_')}.pdf`);
  };
  
  /**
   * Download as DOCX
   */
  const downloadDOCX = async () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Lay/Witness Statement (VA Form 21-10210)',
                bold: true,
                size: 28
              })
            ],
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ text: '' }),
          ...generatedStatement.split('\n').map(line => 
            new Paragraph({
              children: [new TextRun({ text: line, size: 24 })],
              spacing: { after: 120 }
            })
          )
        ]
      }]
    });
    
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Buddy_Statement_${condition.replace(/\s+/g, '_')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  /**
   * Copy to clipboard
   */
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedStatement);
      alert('Statement copied to clipboard!');
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };
  
  /**
   * Render Step 1: Setup
   */
  const renderSetupStep = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Who is writing this? */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          Step 1: Who is writing this statement?
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {RELATIONSHIP_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setRelationship(type.value)}
              className={`p-4 rounded-xl border-2 transition-all text-center ${
                relationship === type.value
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                  : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700'
              }`}
            >
              <span className="text-2xl block mb-1">{type.icon}</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{type.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* What condition? */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          Step 2: What condition is the veteran claiming?
        </h3>
        <input
          type="text"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder="e.g., PTSD, Lower Back Pain, Tinnitus, Sleep Apnea"
          className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 outline-none transition-all"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Enter the specific condition or disability being claimed
        </p>
      </div>
      
      {/* Witness Name */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          Step 3: Witness Name
        </h3>
        <input
          type="text"
          value={witnessName}
          onChange={(e) => setWitnessName(e.target.value)}
          placeholder="e.g., Jane Smith, John Doe"
          className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 outline-none transition-all"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Full name of the person providing this witness statement
        </p>
      </div>
      
      {/* AI Toggle */}
      {isAIAvailable() && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                🤖 AI-Powered Interview
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Generate custom interview questions tailored to the relationship and condition
              </p>
            </div>
            <button
              onClick={() => setUseAI(!useAI)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                useAI ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                useAI ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-r-lg">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      
      {/* Start Button */}
      <button
        onClick={startInterview}
        disabled={!relationship || !condition || !witnessName || isLoadingQuestions}
        className="w-full px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoadingQuestions ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            <span>Preparing Interview...</span>
          </>
        ) : (
          <>
            <span>📝</span>
            <span>Start Interview</span>
          </>
        )}
      </button>
    </div>
  );
  
  /**
   * Render Step 2: Interview
   */
  const renderInterviewStep = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const answeredCount = Object.values(answers).filter(a => a && a.trim()).length;
    const progress = (currentQuestionIndex / questions.length) * 100;
    
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Progress Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {answeredCount} answered
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-violet-600 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
        
        {/* Current Question */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl">💬</span>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {currentQuestion.question}
            </h3>
          </div>
          
          <textarea
            value={answers[currentQuestion.id] || ''}
            onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
            placeholder={currentQuestion.placeholder}
            rows={6}
            className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 outline-none transition-all resize-none"
          />
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            💡 <strong>Tip:</strong> Be specific! Include exact examples, times, and details you have personally witnessed.
          </p>
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          
          {currentQuestionIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
              className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={generateStatement}
              disabled={answeredCount < 3 || isGeneratingStatement}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGeneratingStatement ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <span>📄</span>
                  <span>Generate Statement</span>
                </>
              )}
            </button>
          )}
        </div>
        
        {/* Question Navigator */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">Jump to question:</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                  index === currentQuestionIndex
                    ? 'bg-purple-600 text-white'
                    : answers[q.id]
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };
  
  /**
   * Render Step 3: Output
   */
  const renderOutputStep = () => (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Success Banner */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 rounded-full p-3">
            <span className="text-4xl">✅</span>
          </div>
          <div>
            <h3 className="text-2xl font-bold">Statement Generated!</h3>
            <p className="text-green-100">
              Review, edit if needed, then download for VA Form 21-10210
            </p>
          </div>
        </div>
      </div>
      
      {/* Statement Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            📄 Your Buddy Statement
          </h3>
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              📋 Copy
            </button>
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
              >
                📥 Download
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showDownloadMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 z-10">
                  <button
                    onClick={() => { saveToMyPacket(); setShowDownloadMenu(false); }}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors rounded-t-lg ${
                      savedToPacket 
                        ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30' 
                        : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {savedToPacket ? '✅ Saved to My Packet' : '📁 Save to My Packet'}
                  </button>
                  <button
                    onClick={() => { downloadPDF(); setShowDownloadMenu(false); }}
                    className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    📑 Download as PDF
                  </button>
                  <button
                    onClick={() => { downloadDOCX(); setShowDownloadMenu(false); }}
                    className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-lg transition-colors"
                  >
                    📝 Download as DOCX
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <textarea
            value={generatedStatement}
            onChange={(e) => setGeneratedStatement(e.target.value)}
            rows={20}
            className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 outline-none transition-all resize-none"
          />
        </div>
      </div>
      
      {/* Next Steps */}
      <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 rounded-r-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h3 className="font-bold text-amber-800 dark:text-amber-200">Next Steps:</h3>
            <ol className="text-amber-700 dark:text-amber-300 text-sm mt-2 list-decimal list-inside space-y-1">
              <li>Review and edit the statement for accuracy</li>
              <li>Have the witness read and approve the final version</li>
              <li>Witness signs and dates the statement</li>
              <li>Submit with your VA claim as supporting evidence</li>
            </ol>
          </div>
        </div>
      </div>
      
      {/* Start Over Button */}
      <button
        onClick={() => {
          setStep(1);
          setRelationship('');
          setCondition('');
          setQuestions([]);
          setAnswers({});
          setCurrentQuestionIndex(0);
          setGeneratedStatement('');
        }}
        className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        🔄 Start New Statement
      </button>
    </div>
  );
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto modal-backdrop overscroll-contain"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto relative modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-violet-600 to-purple-600 p-4 shadow-lg rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👥</span>
              <div>
                <h2 className="text-xl font-bold text-white">The Witness Bench</h2>
                <p className="text-sm text-violet-100">Buddy Letter Wizard (VA Form 21-10210)</p>
              </div>
            </div>
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
        
        <div className="p-4">
          {/* Main Content */}
          <div className="max-w-4xl mx-auto">{/* Info Banner */}
            <div className="bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-500 p-4 mb-6 rounded-r-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <h3 className="font-bold text-purple-800 dark:text-purple-200">Why Buddy Statements Matter</h3>
                  <p className="text-purple-700 dark:text-purple-300 text-sm mt-1">
                    Veterans often <strong>downplay their symptoms</strong>. A spouse who sees them scream in their sleep, 
                    or a friend who watches them struggle to walk, provides <strong>powerful third-party evidence</strong> the VA takes seriously.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Step Content */}
            {step === 1 && renderSetupStep()}
            {step === 2 && renderInterviewStep()}
            {step === 3 && renderOutputStep()}
          </div>
        </div>
      </div>
    </div>
  );
}
