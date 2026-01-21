/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * The Tribunal - Mock Hearing Simulator
 * Voice-interactive coaching with AI Veterans Law Judge
 * Prepares veterans for Higher Level Reviews and Board Appeals
 */

import React, { useState, useEffect, useRef } from 'react';
import { getVeteranProfile } from '../utils/veteranProfile';
import { getSavedClaims } from '../utils/claimsStorage';
import { generateAI, getAIStatus } from '../utils/unifiedAIService';
import { AIStatusBadge } from './AIModeSelector';
import ReportBugLink from './ReportBugLink';

// BVA Judge personalities and response patterns
const JUDGE_PERSONAS = {
  skeptical: {
    name: "Judge Thompson",
    style: "Skeptical but fair - will challenge weak arguments",
    tone: "direct",
    avatar: "⚖️"
  },
  supportive: {
    name: "Judge Martinez",
    style: "Supportive - guides you to correct answers",
    tone: "encouraging",
    avatar: "👨‍⚖️"
  },
  strict: {
    name: "Judge Harrison",
    style: "Strict - expects perfect legal arguments",
    tone: "formal",
    avatar: "👩‍⚖️"
  }
};

const TRIBUNAL_QUESTIONS = [
  {
    id: "nexus",
    category: "Medical Connection",
    question: "You claim your {condition} is service-connected. However, the VA examiner noted no contemporaneous evidence during service. What is your argument?",
    goodAnswers: ["lay evidence", "continuity of symptomatology", "buddy statements", "service treatment records"],
    feedback: "Good. Remember to cite Layno v. Brown - lay evidence of in-service incurrence can be sufficient for non-complex conditions.",
    correction: "You need to establish either: 1) Evidence of in-service occurrence, OR 2) Continuity of symptomatology post-service."
  },
  {
    id: "secondary",
    category: "Secondary Connection",
    question: "You argue {secondary} is secondary to your service-connected {primary}. The medical literature does not show a direct causal link. Explain the connection.",
    goodAnswers: ["aggravation", "intermediate step", "proximate cause", "obesity", "medication side effect"],
    feedback: "Excellent. You're using the 'intermediate step' argument from Walsh v. Wilkie. That's exactly what I needed to hear.",
    correction: "Reframe your argument. Say: 'My {primary} caused [intermediate condition], which in turn caused {secondary}.' This is legally sufficient per Allen v. Brown."
  },
  {
    id: "severity",
    category: "Rating Percentage",
    question: "You believe you deserve a {rating}% rating. However, the VA rated you at {current}%. On what diagnostic criteria do you base your argument?",
    goodAnswers: ["frequency", "duration", "severity", "occupational impact", "diagnostic code", "analogous rating"],
    feedback: "Correct. Always tie your argument to specific language in 38 CFR Part 4. Numbers matter.",
    correction: "You're speaking in generalizations. I need you to cite the exact rating criteria. For example: '38 CFR 4.130 states...'"
  },
  {
    id: "credibility",
    category: "Lay Evidence",
    question: "The VA questions the credibility of your lay statements. You said the pain is 'constant' but your medical records show you went to work every day. How do you reconcile this?",
    goodAnswers: ["flare-ups", "good days and bad days", "presenteeism", "accommodation", "medication management"],
    feedback: "Good distinction. You're allowed to have fluctuating symptoms. That's Esteban v. Brown - lay testimony of pain is credible even if you remain employed.",
    correction: "You're contradicting yourself. Either clarify that symptoms fluctuate, or explain how you managed to work despite pain. The VA will deny based on this inconsistency."
  }
];

export default function TheTribunal({ onClose, onReportBug }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedPersona, setSelectedPersona] = useState('skeptical');
  const [userClaims, setUserClaims] = useState([]);
  const [sessionScore, setSessionScore] = useState({ correct: 0, total: 0 });
  const [showInstructions, setShowInstructions] = useState(true);
  
  // AI state
  const [useAI, setUseAI] = useState(true);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiAvailable, setAIAvailable] = useState(false);
  
  // Speech control state
  const [speechEnabled, setSpeechEnabled] = useState(true); // Judge TTS enabled
  const [pendingSpeech, setPendingSpeech] = useState(null); // Queued speech to play
  const [hearingStarted, setHearingStarted] = useState(false); // Whether to auto-play speech
  const [acknowledgedWarning, setAcknowledgedWarning] = useState(false);
  
  const recognitionRef = useRef(null);
  const synthesisRef = useRef(null);
  const voicesLoadedRef = useRef(false);
  const isSpeakingRef = useRef(false); // Track speaking state to avoid race conditions
  
  // Check AI availability on mount
  useEffect(() => {
    const checkAI = async () => {
      const status = await getAIStatus();
      setAIAvailable(status.available);
    };
    checkAI();
  }, []);
  
  // AI Judge prompts for different scenarios
  const AI_JUDGE_SYSTEM_PROMPT = `You are an AI Veterans Law Judge conducting a mock Board of Veterans' Appeals (BVA) hearing. Your role is to:

1. EVALUATE the veteran's responses for legal accuracy and persuasiveness
2. CHALLENGE weak arguments as a real judge would
3. EDUCATE by providing specific legal citations and guidance
4. MAINTAIN the persona of ${JUDGE_PERSONAS[selectedPersona]?.name || 'Judge Thompson'} who is ${JUDGE_PERSONAS[selectedPersona]?.style || 'skeptical but fair'}

KEY LEGAL CONCEPTS YOU MUST KNOW:
- Service Connection requires: (1) current disability, (2) in-service incurrence or aggravation, (3) medical nexus
- Secondary Service Connection: Condition caused OR aggravated by service-connected disability (Allen v. Brown)
- Lay Evidence: Veterans CAN testify about observable symptoms (Layno v. Brown, Jandreau v. Nicholson)
- Continuity of Symptomatology: Can establish nexus for chronic conditions listed in 38 CFR 3.309(a)
- Benefit of the Doubt: When evidence is in equipoise, decide in veteran's favor (38 USC 5107)
- Rating Criteria: Always cite specific 38 CFR Part 4 diagnostic codes

RESPONSE FORMAT:
- Keep responses under 3 sentences for natural conversation flow
- Be direct and authoritative but not cruel
- If veteran gives a good answer, acknowledge it briefly and move on
- If veteran gives a weak answer, explain WHY it's weak and what they SHOULD say
- Always cite specific case law or regulations when correcting`;

  // Generate AI judge response
  const generateAIJudgeResponse = async (veteranResponse, questionContext) => {
    if (!aiAvailable || !useAI) return null;
    
    setIsAIProcessing(true);
    
    try {
      const judge = JUDGE_PERSONAS[selectedPersona];
      const claimContext = userClaims.length > 0 
        ? `Veteran's claimed conditions: ${userClaims.map(c => c.conditionName).join(', ')}`
        : 'No specific claims provided';
      
      const prompt = `${AI_JUDGE_SYSTEM_PROMPT}

CURRENT HEARING CONTEXT:
${claimContext}
Judge Persona: ${judge.name} - ${judge.style}

QUESTION BEING ANSWERED:
Category: ${questionContext?.category || 'General'}
Question: ${questionContext?.question || 'Opening statement'}
Good answers would include: ${questionContext?.goodAnswers?.join(', ') || 'Clear, organized arguments with legal citations'}

VETERAN'S RESPONSE:
"${veteranResponse}"

CONVERSATION HISTORY:
${conversation.slice(-4).map(m => `${m.speaker === 'judge' ? 'JUDGE' : 'VETERAN'}: ${m.text}`).join('\n')}

As ${judge.name}, evaluate this response. Was it legally sound? What specific feedback should you give? Keep it brief and conversational.`;

      const response = await generateAI(prompt);
      setIsAIProcessing(false);
      // generateAI returns { text, mode } object - extract the text content
      const text = response?.text || response;
      return typeof text === 'string' ? text : JSON.stringify(text);
    } catch (error) {
      console.error('AI Judge error:', error);
      setIsAIProcessing(false);
      return null;
    }
  };

  // Generate AI-powered follow-up question
  const generateAIQuestion = async () => {
    if (!aiAvailable || !useAI) return null;
    
    setIsAIProcessing(true);
    
    try {
      const judge = JUDGE_PERSONAS[selectedPersona];
      const claimContext = userClaims.length > 0 
        ? `Veteran's conditions: ${userClaims.map(c => c.conditionName).join(', ')}`
        : 'General BVA hearing practice';
      
      const prompt = `${AI_JUDGE_SYSTEM_PROMPT}

As ${judge.name}, generate the next hearing question for this veteran.
${claimContext}

Session progress: ${sessionScore.total} questions asked, ${sessionScore.correct} answered well.

CONVERSATION SO FAR:
${conversation.slice(-6).map(m => `${m.speaker === 'judge' ? 'JUDGE' : 'VETERAN'}: ${m.text}`).join('\n')}

Generate a challenging but fair question about one of these topics:
- Medical nexus (connecting condition to service)
- Lay evidence credibility
- Rating criteria and percentages
- Secondary service connection
- Aggravation vs direct causation

Format: Just the question, as if speaking directly to the veteran. 1-2 sentences max.`;

      const response = await generateAI(prompt);
      setIsAIProcessing(false);
      // generateAI returns { text, mode } object - extract the text content
      const text = response?.text || response;
      return typeof text === 'string' ? text : JSON.stringify(text);
    } catch (error) {
      console.error('AI Question error:', error);
      setIsAIProcessing(false);
      return null;
    }
  };

  // Initialize speech synthesis voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Force load voices (Chrome needs this)
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          voicesLoadedRef.current = true;
          console.log('Tribunal: Loaded', voices.length, 'voices');
        }
      };
      
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      
      // Chrome workaround: trigger voices to load by speaking empty string
      const warmUp = new SpeechSynthesisUtterance('');
      warmUp.volume = 0;
      window.speechSynthesis.speak(warmUp);
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech Recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      handleUserResponse(text);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsInitialized(true);

    // Load user claims for context
    const claims = getSavedClaims();
    setUserClaims(claims);

    return () => {
      if (recognition) {
        recognition.abort();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  // Get a suitable voice for the judge
  const getJudgeVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    // Prefer a deep, authoritative English voice
    const preferredVoices = ['Google US English', 'Microsoft David', 'Alex', 'Daniel'];
    for (const name of preferredVoices) {
      const voice = voices.find(v => v.name.includes(name));
      if (voice) return voice;
    }
    // Fallback to any English voice
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    return englishVoice || voices[0];
  };

  // Stop any ongoing speech synthesis safely
  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      // Only cancel if actually speaking to avoid 'interrupted' error
      if (isSpeakingRef.current || window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  };

  // Speak text using Text-to-Speech
  const speak = (text, callback, forceSpeak = false) => {
    // If speech is disabled and not forced, queue it instead
    if (!speechEnabled && !forceSpeak) {
      setPendingSpeech({ text, callback });
      if (callback) callback(); // Still trigger callback for flow
      return;
    }
    
    if (!('speechSynthesis' in window)) {
      // Speech synthesis not supported, just call callback
      if (callback) callback();
      return;
    }
    
    // Safely stop any current speech first
    stopSpeaking();
    
    // Small delay to ensure previous speech is fully cancelled
    setTimeout(() => {
      const attemptSpeak = () => {
        // Double-check we're not already speaking
        if (isSpeakingRef.current) {
          stopSpeaking();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 0.9; // Slightly lower for authoritative judge voice
        utterance.volume = 1.0;
        
        // Try to get a good voice
        const voice = getJudgeVoice();
        if (voice) {
          utterance.voice = voice;
        }
        
        utterance.onstart = () => {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
        };
        
        utterance.onend = () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          if (callback) callback();
        };
        
        utterance.onerror = (event) => {
          // Only log actual errors, not 'interrupted' which is expected
          if (event.error !== 'interrupted') {
            console.error('Speech synthesis error:', event.error);
          }
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          if (callback) callback();
        };
        
        synthesisRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      };

      // Chrome needs voices to load first
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          attemptSpeak();
        };
        // Also try immediately in case voices are already loaded
        setTimeout(attemptSpeak, 100);
      } else {
        attemptSpeak();
      }
    }, 50); // Small delay to prevent 'interrupted' errors
  };
  
  // Play pending speech manually
  const playPendingSpeech = () => {
    if (pendingSpeech) {
      speak(pendingSpeech.text, pendingSpeech.callback, true);
      setPendingSpeech(null);
    }
  };
  
  // Play the last judge message
  const speakLastJudgeMessage = () => {
    const lastJudgeMessage = [...conversation].reverse().find(m => m.speaker === 'judge');
    if (lastJudgeMessage) {
      speak(lastJudgeMessage.text, null, true);
    }
  };

  // Start listening
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Start the hearing (enters courtroom but doesn't auto-start speech)
  const startHearing = () => {
    setShowInstructions(false);
    setHearingStarted(true);
    const judge = JUDGE_PERSONAS[selectedPersona];
    
    const opening = `Good morning. I am ${judge.name}, and I will be conducting your hearing today. I have reviewed your file. Let's begin with your primary contentions. Please state your main argument clearly and concisely.`;
    
    setConversation([{
      speaker: 'judge',
      text: opening,
      timestamp: new Date()
    }]);
    
    // Don't auto-speak - user must press button to hear judge
    // Queue it as pending speech if speech is enabled
    if (speechEnabled) {
      setPendingSpeech({ text: opening, callback: null });
    }
  };

  // Ask a question
  const askQuestion = () => {
    if (TRIBUNAL_QUESTIONS.length === 0) {
      endHearing();
      return;
    }

    // Pick a random question
    const question = TRIBUNAL_QUESTIONS[Math.floor(Math.random() * TRIBUNAL_QUESTIONS.length)];
    
    // Personalize with user's actual claims if available
    let personalizedQuestion = question.question;
    if (userClaims.length > 0) {
      const claim = userClaims[0];
      personalizedQuestion = personalizedQuestion
        .replace('{condition}', claim.conditionName || 'condition')
        .replace('{secondary}', 'secondary condition')
        .replace('{primary}', claim.conditionName || 'primary condition')
        .replace('{rating}', '50')
        .replace('{current}', '30');
    }

    setCurrentQuestion(question);
    
    setConversation(prev => [...prev, {
      speaker: 'judge',
      text: personalizedQuestion,
      category: question.category,
      timestamp: new Date()
    }]);
    
    speak(personalizedQuestion, () => {
      setTimeout(startListening, 1000);
    });
  };

  // Handle user response
  const handleUserResponse = async (text) => {
    setConversation(prev => [...prev, {
      speaker: 'user',
      text: text,
      timestamp: new Date()
    }]);

    // Try AI response first
    if (useAI && aiAvailable) {
      const aiResponse = await generateAIJudgeResponse(text, currentQuestion);
      
      if (aiResponse) {
        // Determine if it was a good answer based on AI response tone
        const lowerResponse = aiResponse.toLowerCase();
        const isCorrect = lowerResponse.includes('good') || 
                         lowerResponse.includes('correct') || 
                         lowerResponse.includes('excellent') ||
                         lowerResponse.includes('exactly') ||
                         lowerResponse.includes('well done');
        
        if (currentQuestion) {
          setSessionScore(prev => ({ 
            correct: prev.correct + (isCorrect ? 1 : 0), 
            total: prev.total + 1 
          }));
        }
        
        setConversation(prev => [...prev, {
          speaker: 'judge',
          text: aiResponse,
          isCorrect: isCorrect,
          isAI: true,
          timestamp: new Date()
        }]);
        
        speak(aiResponse, () => {
          // Generate AI follow-up question or use preset
          setTimeout(async () => {
            const aiQuestion = await generateAIQuestion();
            if (aiQuestion) {
              setCurrentQuestion({ 
                category: 'AI Generated', 
                question: aiQuestion,
                goodAnswers: ['lay evidence', 'nexus', 'service treatment records', 'aggravation', 'diagnostic code']
              });
              setConversation(prev => [...prev, {
                speaker: 'judge',
                text: aiQuestion,
                category: 'AI Generated',
                timestamp: new Date()
              }]);
              speak(aiQuestion, () => {
                setTimeout(startListening, 1000);
              });
            } else {
              askQuestion();
            }
          }, 2000);
        });
        return;
      }
    }

    // Fallback to preset responses
    if (currentQuestion) {
      const lowerText = text.toLowerCase();
      const hasGoodAnswer = currentQuestion.goodAnswers.some(answer => 
        lowerText.includes(answer.toLowerCase())
      );

      let judgeResponse;
      let isCorrect = false;

      if (hasGoodAnswer) {
        judgeResponse = currentQuestion.feedback;
        isCorrect = true;
        setSessionScore(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
      } else {
        judgeResponse = currentQuestion.correction;
        setSessionScore(prev => ({ ...prev, total: prev.total + 1 }));
      }

      setConversation(prev => [...prev, {
        speaker: 'judge',
        text: judgeResponse,
        isCorrect: isCorrect,
        timestamp: new Date()
      }]);

      speak(judgeResponse, () => {
        // Ask next question after a pause
        setTimeout(askQuestion, 2000);
      });
    } else {
      // Initial response - ask first question
      const acknowledgment = "I see. Let me ask you some specific questions about your claim.";
      setConversation(prev => [...prev, {
        speaker: 'judge',
        text: acknowledgment,
        timestamp: new Date()
      }]);
      
      speak(acknowledgment, () => {
        setTimeout(askQuestion, 1500);
      });
    }
  };

  // End hearing
  const endHearing = () => {
    const percentage = sessionScore.total > 0 
      ? Math.round((sessionScore.correct / sessionScore.total) * 100)
      : 0;
    
    let closingStatement;
    if (percentage >= 80) {
      closingStatement = `Excellent performance. You answered ${sessionScore.correct} out of ${sessionScore.total} questions correctly. You are well-prepared for your hearing. This hearing is adjourned.`;
    } else if (percentage >= 60) {
      closingStatement = `Adequate performance. You answered ${sessionScore.correct} out of ${sessionScore.total} questions correctly. I recommend more preparation on medical nexus arguments. This hearing is adjourned.`;
    } else {
      closingStatement = `I have concerns about your preparation. You answered only ${sessionScore.correct} out of ${sessionScore.total} questions correctly. I strongly recommend working with a representative before your actual hearing. This hearing is adjourned.`;
    }

    setConversation(prev => [...prev, {
      speaker: 'judge',
      text: closingStatement,
      isFinal: true,
      timestamp: new Date()
    }]);

    speak(closingStatement);
  };

  // Manual text input fallback
  const handleManualInput = (e) => {
    e.preventDefault();
    const input = e.target.elements.manualText.value.trim();
    if (input) {
      handleUserResponse(input);
      e.target.reset();
    }
  };

  if (!isInitialized) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md text-center">
          <p className="text-gray-800 dark:text-white">Initializing speech recognition...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-backdrop overscroll-contain">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-bold flex items-center gap-2">
                  ⚖️ The Tribunal
                  <span className="px-1.5 py-0.5 bg-gray-500 text-white text-[10px] font-bold rounded">AI</span>
                </h2>
              </div>
              <p className="text-gray-300">
                Mock Board of Veterans' Appeals Hearing
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
              {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="The Tribunal" />}
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 text-2xl font-bold"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
          
          {/* Score Display */}
          {sessionScore.total > 0 && (
            <div className="mt-4 bg-white/10 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Performance:</span>
                <span className="font-bold">
                  {sessionScore.correct} / {sessionScore.total} correct
                  ({Math.round((sessionScore.correct / sessionScore.total) * 100)}%)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        {showInstructions && (
          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
            <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-3">
              📋 Before You Begin:
            </h3>
            
            {/* AI Required Warning */}
            {!aiAvailable && (
              <div className="mb-4 p-4 bg-amber-900/30 rounded-lg border border-amber-600/50">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div>
                    <h3 className="font-bold text-amber-300">AI Required for Analysis</h3>
                    <p className="text-amber-200 text-sm mt-1">
                      Click the <strong>AI Status button</strong> in the header above to load your secure Local AI 
                      (100% private) or enter your Gemini API key.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* AI Mode Toggle */}
            <div className="mb-4 p-4 bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🤖</span>
                  <div>
                    <div className="font-semibold text-purple-900 dark:text-purple-200">AI-Powered Judge</div>
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      {aiAvailable 
                        ? 'Intelligent responses based on VA law and your claims' 
                        : 'AI unavailable - using preset questions'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setUseAI(!useAI)}
                  disabled={!aiAvailable}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useAI && aiAvailable
                      ? 'bg-purple-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  } ${!aiAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useAI && aiAvailable ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {useAI && aiAvailable && (
                <p className="mt-2 text-xs text-purple-700 dark:text-purple-300 bg-purple-200/50 dark:bg-purple-900/50 rounded p-2">
                  ✨ AI judges will evaluate your arguments using real veterans law principles, cite relevant case law, and provide personalized coaching.
                </p>
              )}
            </div>
            
            {/* Persona Selection */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Select Your Judge:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(JUDGE_PERSONAS).map(([key, persona]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPersona(key)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPersona === key
                        ? 'border-blue-600 bg-blue-100 dark:bg-blue-900'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}
                  >
                    <div className="text-3xl mb-1">{persona.avatar}</div>
                    <div className="font-semibold text-sm">{persona.name}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{persona.style}</div>
                  </button>
                ))}
              </div>
            </div>

            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300 mb-4">
              <li>• This is practice - your responses are not recorded</li>
              <li>• Speak clearly and use legal terms when possible</li>
              <li>• The judge will challenge you - that's their job</li>
              <li>• Cite regulations (38 CFR) and case law when you can</li>
              <li>• If you don't know the answer, say "I would consult my representative"</li>
            </ul>
            
            {/* Speech/Hearing Technology Warning */}
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border-2 border-amber-300 dark:border-amber-700">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h4 className="font-bold text-amber-900 dark:text-amber-200 mb-1">Audio Technology Notice</h4>
                  <p className="text-sm text-amber-800 dark:text-amber-300 mb-2">
                    This feature uses <strong>speech synthesis</strong> (text-to-speech) and <strong>speech recognition</strong> (microphone input) for an interactive hearing simulation.
                  </p>
                  <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
                    <li>🔊 <strong>Speakers/Headphones:</strong> The AI judge will speak aloud. Ensure your volume is appropriate.</li>
                    <li>🎤 <strong>Microphone:</strong> You'll need to grant microphone permissions to respond by voice.</li>
                    <li>⌨️ <strong>Alternative:</strong> You can also type responses if you prefer not to use voice.</li>
                    <li>🔒 <strong>Privacy:</strong> Voice data is processed locally by your browser and is NOT recorded or stored.</li>
                  </ul>
                  <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={acknowledgedWarning}
                      onChange={(e) => setAcknowledgedWarning(e.target.checked)}
                      className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      I understand this uses speech technology
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={startHearing}
              disabled={!acknowledgedWarning}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              {acknowledgedWarning ? 'Enter the Courtroom →' : 'Please acknowledge the notice above'}
            </button>
          </div>
        )}

        {/* Conversation Area */}
        {!showInstructions && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900">
            {conversation.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.speaker === 'judge'
                      ? message.isCorrect === true
                        ? 'bg-green-100 dark:bg-green-900/30 border-l-4 border-green-600'
                        : message.isCorrect === false
                        ? 'bg-red-100 dark:bg-red-900/30 border-l-4 border-red-600'
                        : 'bg-white dark:bg-gray-800 shadow-md'
                      : 'bg-blue-600 text-white shadow-md'
                  }`}
                >
                  {message.speaker === 'judge' && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">
                        {JUDGE_PERSONAS[selectedPersona].avatar}
                      </span>
                      <span className="font-bold text-sm">
                        {JUDGE_PERSONAS[selectedPersona].name}
                      </span>
                      {message.category && (
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                          {message.category}
                        </span>
                      )}
                      {message.isAI && (
                        <span className="text-xs bg-purple-200 dark:bg-purple-700 text-purple-800 dark:text-purple-200 px-2 py-1 rounded flex items-center gap-1">
                          🤖 AI
                        </span>
                      )}
                    </div>
                  )}
                  <p className={`${message.speaker === 'user' ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                    {message.text}
                  </p>
                  <p className="text-xs opacity-75 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            
            {/* AI Processing Indicator */}
            {isAIProcessing && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 max-w-[80%]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{JUDGE_PERSONAS[selectedPersona].avatar}</span>
                    <span className="font-bold text-sm">{JUDGE_PERSONAS[selectedPersona].name}</span>
                    <span className="text-xs bg-purple-200 dark:bg-purple-700 text-purple-800 dark:text-purple-200 px-2 py-1 rounded flex items-center gap-1">
                      🤖 AI
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-sm">Judge is considering your response...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Control Panel */}
        {!showInstructions && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
            {/* Voice Status Indicators */}
            <div className="flex items-center justify-center gap-6 mb-4">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isListening ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-sm font-medium">🎤 {isListening ? 'Recording' : 'Mic Off'}</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isSpeaking ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${isSpeaking ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-sm font-medium">🔊 {isSpeaking ? 'Judge Speaking' : 'Silent'}</span>
              </div>
            </div>

            {/* Two-Column Control Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Judge Speaker Controls */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    ⚖️ Judge's Voice
                  </span>
                  <button
                    onClick={() => setSpeechEnabled(!speechEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      speechEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    title={speechEnabled ? 'Disable judge audio' : 'Enable judge audio'}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      speechEnabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={speakLastJudgeMessage}
                    disabled={isSpeaking || conversation.filter(m => m.speaker === 'judge').length === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    {pendingSpeech ? 'Play Opening' : 'Replay'}
                  </button>
                  <button
                    onClick={stopSpeaking}
                    disabled={!isSpeaking}
                    className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>
                    Stop
                  </button>
                </div>
              </div>
              
              {/* Veteran Microphone Controls */}
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-red-900 dark:text-red-200 flex items-center gap-2">
                    🎤 Your Microphone
                  </span>
                  {isListening && (
                    <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                      ● LIVE
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={startListening}
                    disabled={isListening || isSpeaking || isAIProcessing}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93V7h2v1c0 2.76 2.24 5 5 5s5-2.24 5-5V7h2v1c0 4.08-3.06 7.44-7 7.93V18h4v2H8v-2h4v-2.07z"/></svg>
                    {isListening ? 'Recording...' : 'Start Recording'}
                  </button>
                  <button
                    onClick={stopListening}
                    disabled={!isListening}
                    className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>
                    Stop
                  </button>
                </div>
              </div>
            </div>

            {/* Manual Text Input Fallback */}
            <form onSubmit={handleManualInput} className="flex gap-2 mb-3">
              <input
                type="text"
                name="manualText"
                placeholder="Or type your response here..."
                disabled={isAIProcessing || isSpeaking}
                className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isAIProcessing || isSpeaking}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
              >
                Send
              </button>
            </form>

            {/* Tips & Help */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>💡 Tip: Cite "38 CFR...", "per case law...", "medical nexus..."</span>
              <button
                onClick={() => {
                  stopSpeaking();
                  stopListening();
                  setShowInstructions(true);
                  setHearingStarted(false);
                  setConversation([]);
                  setSessionScore({ correct: 0, total: 0 });
                  setCurrentQuestion(null);
                  setPendingSpeech(null);
                }}
                className="text-red-500 hover:text-red-600 font-medium"
              >
                ← Exit Courtroom
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
