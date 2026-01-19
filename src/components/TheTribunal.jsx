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

export default function TheTribunal({ onClose }) {
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
  
  const recognitionRef = useRef(null);
  const synthesisRef = useRef(null);

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

  // Speak text using Text-to-Speech
  const speak = (text, callback) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (callback) callback();
      };
      
      window.speechSynthesis.speak(utterance);
      synthesisRef.current = utterance;
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

  // Start the hearing
  const startHearing = () => {
    setShowInstructions(false);
    const judge = JUDGE_PERSONAS[selectedPersona];
    
    const opening = `Good morning. I am ${judge.name}, and I will be conducting your hearing today. I have reviewed your file. Let's begin with your primary contentions. Please state your main argument clearly and concisely.`;
    
    setConversation([{
      speaker: 'judge',
      text: opening,
      timestamp: new Date()
    }]);
    
    speak(opening, () => {
      // After judge speaks, prompt user to respond
      setTimeout(startListening, 1000);
    });
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
  const handleUserResponse = (text) => {
    setConversation(prev => [...prev, {
      speaker: 'user',
      text: text,
      timestamp: new Date()
    }]);

    // Analyze response
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold mb-2">⚖️ The Tribunal</h2>
              <p className="text-gray-300">
                Mock Board of Veterans' Appeals Hearing
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
              aria-label="Close"
            >
              ×
            </button>
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

            <button
              onClick={startHearing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Enter the Courtroom →
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
          </div>
        )}

        {/* Control Panel */}
        {!showInstructions && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
            {/* Voice Status */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className={`flex items-center gap-2 ${isListening ? 'text-red-600' : 'text-gray-400'}`}>
                <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-600 animate-pulse' : 'bg-gray-400'}`} />
                {isListening ? 'Listening...' : 'Not listening'}
              </div>
              <div className={`flex items-center gap-2 ${isSpeaking ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-blue-600 animate-pulse' : 'bg-gray-400'}`} />
                {isSpeaking ? 'Judge speaking...' : 'Judge silent'}
              </div>
            </div>

            {/* Voice Controls */}
            <div className="flex gap-4 mb-4">
              <button
                onClick={startListening}
                disabled={isListening || isSpeaking}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                🎤 {isListening ? 'Listening...' : 'Push to Speak'}
              </button>
              <button
                onClick={stopListening}
                disabled={!isListening}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
              >
                Stop
              </button>
            </div>

            {/* Manual Text Input Fallback */}
            <form onSubmit={handleManualInput} className="flex gap-2">
              <input
                type="text"
                name="manualText"
                placeholder="Or type your response here..."
                className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                Send
              </button>
            </form>

            {/* Tips */}
            <div className="mt-4 text-xs text-gray-600 dark:text-gray-400 text-center">
              💡 Tip: Use phrases like "38 CFR states...", "per case law...", "medical nexus shows..."
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
