/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * The Tribunal - Mock Hearing Simulator
 * Voice-interactive coaching with AI Veterans Law Judge
 * Prepares veterans for Higher Level Reviews and Board Appeals
 */

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";
import { getSavedClaims } from "../utils/claimsStorage";
import { generateAI, getAIStatus } from "../utils/unifiedAIService";
import { AIStatusBadge } from "./AIModeSelector";
import ReportBugLink from "./ReportBugLink";
import { getVeteranAIContext } from "../utils/veteranContextProvider";

// BVA Judge personalities and response patterns
const JUDGE_PERSONAS = {
  skeptical: {
    name: "Judge Thompson",
    style: "Skeptical but fair - will challenge weak arguments",
    tone: "direct",
    avatar: "⚖️",
  },
  supportive: {
    name: "Judge Martinez",
    style: "Supportive - guides you to correct answers",
    tone: "encouraging",
    avatar: "👨‍⚖️",
  },
  strict: {
    name: "Judge Harrison",
    style: "Strict - expects perfect legal arguments",
    tone: "formal",
    avatar: "👩‍⚖️",
  },
};

const TRIBUNAL_QUESTIONS = [
  {
    id: "nexus",
    category: "Medical Connection",
    question:
      "You claim your {condition} is service-connected. However, the VA examiner noted no contemporaneous evidence during service. What is your argument?",
    goodAnswers: [
      "lay evidence",
      "continuity of symptomatology",
      "buddy statements",
      "service treatment records",
    ],
    feedback:
      "Good. Remember to cite Layno v. Brown - lay evidence of in-service incurrence can be sufficient for non-complex conditions.",
    correction:
      "You need to establish either: 1) Evidence of in-service occurrence, OR 2) Continuity of symptomatology post-service.",
  },
  {
    id: "secondary",
    category: "Secondary Connection",
    question:
      "You argue {secondary} is secondary to your service-connected {primary}. The medical literature does not show a direct causal link. Explain the connection.",
    goodAnswers: [
      "aggravation",
      "intermediate step",
      "proximate cause",
      "obesity",
      "medication side effect",
    ],
    feedback:
      "Excellent. You're using the 'intermediate step' argument from Walsh v. Wilkie. That's exactly what I needed to hear.",
    correction:
      "Reframe your argument. Say: 'My {primary} caused [intermediate condition], which in turn caused {secondary}.' This is legally sufficient per Allen v. Brown.",
  },
  {
    id: "severity",
    category: "Rating Percentage",
    question:
      "You believe you deserve a {rating}% rating. However, the VA rated you at {current}%. On what diagnostic criteria do you base your argument?",
    goodAnswers: [
      "frequency",
      "duration",
      "severity",
      "occupational impact",
      "diagnostic code",
      "analogous rating",
    ],
    feedback:
      "Correct. Always tie your argument to specific language in 38 CFR Part 4. Numbers matter.",
    correction:
      "You're speaking in generalizations. I need you to cite the exact rating criteria. For example: '38 CFR 4.130 states...'",
  },
  {
    id: "credibility",
    category: "Lay Evidence",
    question:
      "The VA questions the credibility of your lay statements. You said the pain is 'constant' but your medical records show you went to work every day. How do you reconcile this?",
    goodAnswers: [
      "flare-ups",
      "good days and bad days",
      "presenteeism",
      "accommodation",
      "medication management",
    ],
    feedback:
      "Good distinction. You're allowed to have fluctuating symptoms. That's Esteban v. Brown - lay testimony of pain is credible even if you remain employed.",
    correction:
      "You're contradicting yourself. Either clarify that symptoms fluctuate, or explain how you managed to work despite pain. The VA will deny based on this inconsistency.",
  },
];

// Chat bubble color for a conversation message, based on speaker and correctness
function getMessageBubbleClass(message) {
  if (message.speaker !== "judge") {
    return "bg-blue-600 text-white shadow-md";
  }
  if (message.isCorrect === true) {
    return "bg-green-100 dark:bg-green-900/30 border-l-4 border-green-600";
  }
  if (message.isCorrect === false) {
    return "bg-red-100 dark:bg-red-900/30 border-l-4 border-red-600";
  }
  return "bg-white dark:bg-gray-800 shadow-md";
}

export default function TheTribunal({
  onClose,
  onReportBug,
  onOpenAISettings,
}) {
  const { _t } = useLanguage();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [_transcript, setTranscript] = useState("");
  const [conversation, setConversation] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedPersona, setSelectedPersona] = useState("skeptical");
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
  const [captionText, setCaptionText] = useState(""); // Live caption of the current judge utterance
  const [micSupported, setMicSupported] = useState(true);
  const [_hearingStarted, setHearingStarted] = useState(false); // Whether to auto-play speech
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

  // Load veteran context from VKB for realistic mock hearings
  const [veteranVKBContext, setVeteranVKBContext] = useState("");
  useEffect(() => {
    getVeteranAIContext({ maxPacketTokens: 500 })
      .then((ctx) => setVeteranVKBContext(ctx))
      .catch(() => {});
  }, []);

  // AI Judge prompts for different scenarios
  const AI_JUDGE_SYSTEM_PROMPT = `You are an AI Veterans Law Judge conducting a mock Board of Veterans' Appeals (BVA) hearing. Your role is to:

1. EVALUATE the veteran's responses for legal accuracy and persuasiveness
2. CHALLENGE weak arguments as a real judge would
3. EDUCATE by providing specific legal citations and guidance
4. MAINTAIN the persona of ${JUDGE_PERSONAS[selectedPersona]?.name || "Judge Thompson"} who is ${JUDGE_PERSONAS[selectedPersona]?.style || "skeptical but fair"}

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
      const claimContext =
        userClaims.length > 0
          ? `Veteran's claimed conditions: ${userClaims.map((c) => c.conditionName).join(", ")}`
          : "No specific claims provided";

      const vkbBlock = veteranVKBContext
        ? `\nVETERAN CASE DATA (use to ask pointed questions about their actual service/conditions):\n${veteranVKBContext}\n`
        : "";

      const prompt = `${AI_JUDGE_SYSTEM_PROMPT}

CURRENT HEARING CONTEXT:
${claimContext}
${vkbBlock}Judge Persona: ${judge.name} - ${judge.style}

QUESTION BEING ANSWERED:
Category: ${questionContext?.category || "General"}
Question: ${questionContext?.question || "Opening statement"}
Good answers would include: ${questionContext?.goodAnswers?.join(", ") || "Clear, organized arguments with legal citations"}

VETERAN'S RESPONSE:
"${veteranResponse}"

CONVERSATION HISTORY:
${conversation
  .slice(-4)
  .map((m) => `${m.speaker === "judge" ? "JUDGE" : "VETERAN"}: ${m.text}`)
  .join("\n")}

As ${judge.name}, evaluate this response. Was it legally sound? What specific feedback should you give? Keep it brief and conversational.`;

      const response = await generateAI(prompt);
      setIsAIProcessing(false);
      // generateAI returns { text, mode } object - extract the text content
      const text = response?.text || response;
      return typeof text === "string" ? text : JSON.stringify(text);
    } catch (error) {
      console.error("AI Judge error:", error);
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
      const claimContext =
        userClaims.length > 0
          ? `Veteran's conditions: ${userClaims.map((c) => c.conditionName).join(", ")}`
          : "General BVA hearing practice";

      const vkbBlock = veteranVKBContext
        ? `\nVETERAN CASE DATA:\n${veteranVKBContext}\n`
        : "";

      const prompt = `${AI_JUDGE_SYSTEM_PROMPT}

As ${judge.name}, generate the next hearing question for this veteran.
${claimContext}
${vkbBlock}

Session progress: ${sessionScore.total} questions asked, ${sessionScore.correct} answered well.

CONVERSATION SO FAR:
${conversation
  .slice(-6)
  .map((m) => `${m.speaker === "judge" ? "JUDGE" : "VETERAN"}: ${m.text}`)
  .join("\n")}

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
      return typeof text === "string" ? text : JSON.stringify(text);
    } catch (error) {
      console.error("AI Question error:", error);
      setIsAIProcessing(false);
      return null;
    }
  };

  // Initialize speech synthesis voices
  useEffect(() => {
    if ("speechSynthesis" in window) {
      // Force load voices (Chrome needs this)
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          voicesLoadedRef.current = true;
          // eslint-disable-next-line no-console
          console.log("Tribunal: Loaded", voices.length, "voices");
        }
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      // Chrome workaround: trigger voices to load by speaking empty string
      const warmUp = new SpeechSynthesisUtterance("");
      warmUp.volume = 0;
      window.speechSynthesis.speak(warmUp);
    }
  }, []);

  // Initialize speech recognition. Voice input is optional — the hearing
  // (captions + typed responses) must work even when the browser has no
  // SpeechRecognition (e.g. Firefox).
  useEffect(() => {
    setIsInitialized(true);

    // Load user claims for context
    const claims = getSavedClaims();
    setUserClaims(claims);

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicSupported(false);
      return () => {
        window.speechSynthesis?.cancel();
      };
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      handleUserResponse(text);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get a suitable voice for the judge
  const getJudgeVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    // Prefer a deep, authoritative English voice
    const preferredVoices = [
      "Google US English",
      "Microsoft David",
      "Alex",
      "Daniel",
    ];
    for (const name of preferredVoices) {
      const voice = voices.find((v) => v.name.includes(name));
      if (voice) return voice;
    }
    // Fallback to any English voice
    const englishVoice = voices.find((v) => v.lang.startsWith("en"));
    return englishVoice || voices[0];
  };

  // Stop any ongoing speech synthesis safely
  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      // Detach the cancelled utterance's handlers so its flow callback
      // (next question / auto mic start) doesn't fire after a deliberate
      // interruption such as typing a response mid-speech.
      if (synthesisRef.current) {
        synthesisRef.current.onend = null;
        synthesisRef.current.onerror = null;
      }
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

    if (!("speechSynthesis" in window)) {
      // Speech synthesis not supported, just call callback
      if (callback) callback();
      return;
    }

    // Safely stop any current speech first
    stopSpeaking();

    const handleUtteranceStart = () => {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      setCaptionText(text);
    };

    const handleUtteranceEnd = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      if (callback) callback();
    };

    const handleUtteranceError = (event) => {
      // Only log actual errors, not 'interrupted' which is expected
      if (event.error !== "interrupted") {
        console.error("Speech synthesis error:", event.error);
      }
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      if (callback) callback();
    };

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

      utterance.onstart = handleUtteranceStart;
      utterance.onend = handleUtteranceEnd;
      utterance.onerror = handleUtteranceError;

      synthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };

    // Small delay to ensure previous speech is fully cancelled
    setTimeout(() => {
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

  // Play the last judge message
  const speakLastJudgeMessage = () => {
    const lastJudgeMessage = [...conversation]
      .reverse()
      .find((m) => m.speaker === "judge");
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

    setConversation([
      {
        speaker: "judge",
        text: opening,
        timestamp: new Date(),
      },
    ]);

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
    const question =
      TRIBUNAL_QUESTIONS[Math.floor(Math.random() * TRIBUNAL_QUESTIONS.length)];

    // Personalize with user's actual claims if available
    let personalizedQuestion = question.question;
    if (userClaims.length > 0) {
      const claim = userClaims[0];
      personalizedQuestion = personalizedQuestion
        .replace("{condition}", claim.conditionName || "condition")
        .replace("{secondary}", "secondary condition")
        .replace("{primary}", claim.conditionName || "primary condition")
        .replace("{rating}", "50")
        .replace("{current}", "30");
    }

    setCurrentQuestion(question);

    setConversation((prev) => [
      ...prev,
      {
        speaker: "judge",
        text: personalizedQuestion,
        category: question.category,
        timestamp: new Date(),
      },
    ]);

    speak(personalizedQuestion, () => {
      setTimeout(startListening, 1000);
    });
  };

  // Determine if an AI judge response reads as approval, for scoring
  const isAIResponsePositive = (aiResponse) => {
    const lowerResponse = aiResponse.toLowerCase();
    return (
      lowerResponse.includes("good") ||
      lowerResponse.includes("correct") ||
      lowerResponse.includes("excellent") ||
      lowerResponse.includes("exactly") ||
      lowerResponse.includes("well done")
    );
  };

  // Generate the next AI follow-up question after an AI judge reply, or fall
  // back to a preset question if AI generation fails
  const runAIFollowUpQuestion = async () => {
    const aiQuestion = await generateAIQuestion();
    if (aiQuestion) {
      setCurrentQuestion({
        category: "AI Generated",
        question: aiQuestion,
        goodAnswers: [
          "lay evidence",
          "nexus",
          "service treatment records",
          "aggravation",
          "diagnostic code",
        ],
      });
      setConversation((prev) => [
        ...prev,
        {
          speaker: "judge",
          text: aiQuestion,
          category: "AI Generated",
          timestamp: new Date(),
        },
      ]);
      speak(aiQuestion, () => {
        setTimeout(startListening, 1000);
      });
    } else {
      askQuestion();
    }
  };

  // Record and speak the AI judge's reply to the veteran's response
  const handleAIJudgeReply = (aiResponse) => {
    const isCorrect = isAIResponsePositive(aiResponse);

    if (currentQuestion) {
      setSessionScore((prev) => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));
    }

    setConversation((prev) => [
      ...prev,
      {
        speaker: "judge",
        text: aiResponse,
        isCorrect: isCorrect,
        isAI: true,
        timestamp: new Date(),
      },
    ]);

    speak(aiResponse, () => {
      // Generate AI follow-up question or use preset
      setTimeout(runAIFollowUpQuestion, 2000);
    });
  };

  // Score and speak a preset judge response when AI is unavailable/disabled
  const handlePresetResponse = (text) => {
    if (currentQuestion) {
      const lowerText = text.toLowerCase();
      const hasGoodAnswer = currentQuestion.goodAnswers.some((answer) =>
        lowerText.includes(answer.toLowerCase()),
      );

      let judgeResponse;
      let isCorrect = false;

      if (hasGoodAnswer) {
        judgeResponse = currentQuestion.feedback;
        isCorrect = true;
        setSessionScore((prev) => ({
          correct: prev.correct + 1,
          total: prev.total + 1,
        }));
      } else {
        judgeResponse = currentQuestion.correction;
        setSessionScore((prev) => ({ ...prev, total: prev.total + 1 }));
      }

      setConversation((prev) => [
        ...prev,
        {
          speaker: "judge",
          text: judgeResponse,
          isCorrect: isCorrect,
          timestamp: new Date(),
        },
      ]);

      speak(judgeResponse, () => {
        // Ask next question after a pause
        setTimeout(askQuestion, 2000);
      });
    } else {
      // Initial response - ask first question
      const acknowledgment =
        "I see. Let me ask you some specific questions about your claim.";
      setConversation((prev) => [
        ...prev,
        {
          speaker: "judge",
          text: acknowledgment,
          timestamp: new Date(),
        },
      ]);

      speak(acknowledgment, () => {
        setTimeout(askQuestion, 1500);
      });
    }
  };

  // Handle user response
  const handleUserResponse = async (text) => {
    setConversation((prev) => [
      ...prev,
      {
        speaker: "user",
        text: text,
        timestamp: new Date(),
      },
    ]);

    // Try AI response first
    if (useAI && aiAvailable) {
      const aiResponse = await generateAIJudgeResponse(text, currentQuestion);

      if (aiResponse) {
        handleAIJudgeReply(aiResponse);
        return;
      }
    }

    // Fallback to preset responses
    handlePresetResponse(text);
  };

  // End hearing
  const endHearing = () => {
    const percentage =
      sessionScore.total > 0
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

    setConversation((prev) => [
      ...prev,
      {
        speaker: "judge",
        text: closingStatement,
        isFinal: true,
        timestamp: new Date(),
      },
    ]);

    speak(closingStatement);
  };

  // Manual text input fallback
  const handleManualInput = (e) => {
    e.preventDefault();
    const input = e.target.elements.manualText.value.trim();
    if (input) {
      stopSpeaking();
      handleUserResponse(input);
      e.target.reset();
    }
  };

  if (!isInitialized) {
    return (
      <ResponsiveModal isOpen onClose={onClose} title="The Tribunal" size="sm">
        <p className="py-8 text-center text-gray-800 dark:text-white">
          Initializing speech recognition...
        </p>
      </ResponsiveModal>
    );
  }

  const exitCourtroom = () => {
    stopSpeaking();
    stopListening();
    setShowInstructions(true);
    setHearingStarted(false);
    setConversation([]);
    setSessionScore({ correct: 0, total: 0 });
    setCurrentQuestion(null);
    setPendingSpeech(null);
  };

  const header = (
    <TribunalHeader
      sessionScore={sessionScore}
      onClose={onClose}
      onReportBug={onReportBug}
      onOpenAISettings={onOpenAISettings}
    />
  );

  const instructionsFooter = (
    <InstructionsFooter
      startHearing={startHearing}
      acknowledgedWarning={acknowledgedWarning}
    />
  );

  const hearingFooter = (
    <HearingFooter
      isSpeaking={isSpeaking}
      captionText={captionText}
      isListening={isListening}
      speechEnabled={speechEnabled}
      setSpeechEnabled={setSpeechEnabled}
      speakLastJudgeMessage={speakLastJudgeMessage}
      conversation={conversation}
      pendingSpeech={pendingSpeech}
      stopSpeaking={stopSpeaking}
      micSupported={micSupported}
      isAIProcessing={isAIProcessing}
      startListening={startListening}
      stopListening={stopListening}
      handleManualInput={handleManualInput}
      onExitCourtroom={exitCourtroom}
    />
  );

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      header={header}
      footer={showInstructions ? instructionsFooter : hearingFooter}
      labelledBy="the-tribunal-title"
      size="2xl"
    >
      {/* Instructions */}
      {showInstructions && (
        <PreHearingInstructions
          aiAvailable={aiAvailable}
          useAI={useAI}
          setUseAI={setUseAI}
          selectedPersona={selectedPersona}
          setSelectedPersona={setSelectedPersona}
          acknowledgedWarning={acknowledgedWarning}
          setAcknowledgedWarning={setAcknowledgedWarning}
        />
      )}

      {/* Conversation Area */}
      {!showInstructions && (
        <ConversationLog
          conversation={conversation}
          selectedPersona={selectedPersona}
          isAIProcessing={isAIProcessing}
        />
      )}
    </ResponsiveModal>
  );
}

/**
 * Modal header: title, score display, and top-right action buttons
 */
function TribunalHeader({ sessionScore, onClose, onReportBug, onOpenAISettings }) {
  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-4 text-white sm:px-6 sm:py-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 sm:mb-2">
            <h2
              id="the-tribunal-title"
              className="flex items-center gap-2 text-xl font-bold sm:text-3xl"
            >
              ⚖️ The Tribunal
              <span className="rounded bg-gray-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                AI
              </span>
              <span className="rounded bg-amber-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                BETA
              </span>
            </h2>
          </div>
          <p className="truncate text-sm text-gray-300">
            Mock Board of Veterans&apos; Appeals Hearing
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
          {onReportBug && (
            <ReportBugLink
              onClick={onReportBug}
              variant="light"
              moduleName="The Tribunal"
            />
          )}
          <button
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-lg text-2xl font-bold text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Score Display */}
      {sessionScore.total > 0 && (
        <div className="mt-4 rounded-lg bg-white/10 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Performance:</span>
            <span className="font-bold">
              {sessionScore.correct} / {sessionScore.total} correct (
              {Math.round((sessionScore.correct / sessionScore.total) * 100)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Footer shown on the pre-hearing instructions screen
 */
function InstructionsFooter({ startHearing, acknowledgedWarning }) {
  return (
    <button
      onClick={startHearing}
      disabled={!acknowledgedWarning}
      className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
    >
      {acknowledgedWarning
        ? "Enter the Courtroom →"
        : "Please acknowledge the notice above"}
    </button>
  );
}

/**
 * Footer shown during an active hearing: captions, voice controls, and
 * manual text input
 */
function HearingFooter({
  isSpeaking,
  captionText,
  isListening,
  speechEnabled,
  setSpeechEnabled,
  speakLastJudgeMessage,
  conversation,
  pendingSpeech,
  stopSpeaking,
  micSupported,
  isAIProcessing,
  startListening,
  stopListening,
  handleManualInput,
  onExitCourtroom,
}) {
  return (
    <div>
      {/* Live Captions — real-time text of the judge's voice (WCAG 1.2.x) */}
      <div className="mb-3 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">
            💬 Live Captions
          </span>
          {isSpeaking && (
            <span className="animate-pulse rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
              Judge Speaking
            </span>
          )}
        </div>
        <p
          data-testid="tribunal-captions"
          aria-live="polite"
          aria-atomic="true"
          className="text-sm font-medium text-white"
        >
          {captionText ||
            "Captions of the judge's voice appear here when audio plays."}
        </p>
      </div>

      {/* Voice Status Indicators */}
      <div className="mb-3 hidden items-center justify-center gap-6 sm:flex">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isListening ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full ${isListening ? "bg-red-500 animate-pulse" : "bg-gray-400"}`}
          />
          <span className="text-sm font-medium">
            🎤 {isListening ? "Recording" : "Mic Off"}
          </span>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isSpeaking ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full ${isSpeaking ? "bg-blue-500 animate-pulse" : "bg-gray-400"}`}
          />
          <span className="text-sm font-medium">
            🔊 {isSpeaking ? "Judge Speaking" : "Silent"}
          </span>
        </div>
      </div>

      {/* Two-Column Control Panel */}
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Judge Speaker Controls */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              ⚖️ Judge&apos;s Voice
            </span>
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                speechEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
              }`}
              aria-label={
                speechEnabled ? "Disable judge audio" : "Enable judge audio"
              }
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  speechEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={speakLastJudgeMessage}
              disabled={
                isSpeaking ||
                conversation.filter((m) => m.speaker === "judge").length === 0
              }
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {pendingSpeech ? "Play Opening" : "Replay"}
            </button>
            <button
              onClick={stopSpeaking}
              disabled={!isSpeaking}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
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
              disabled={
                !micSupported || isListening || isSpeaking || isAIProcessing
              }
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93V7h2v1c0 2.76 2.24 5 5 5s5-2.24 5-5V7h2v1c0 4.08-3.06 7.44-7 7.93V18h4v2H8v-2h4v-2.07z" />
              </svg>
              {isListening ? "Recording..." : "Start Recording"}
            </button>
            <button
              onClick={stopListening}
              disabled={!isListening}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
              Stop
            </button>
          </div>
          {!micSupported && (
            <p className="mt-2 text-xs text-red-800 dark:text-red-300">
              Voice input isn&apos;t supported in this browser — type your
              response below instead.
            </p>
          )}
        </div>
      </div>

      {/* Manual Text Input — always available, even while the judge speaks.
          Submitting mid-speech cancels the judge's audio (the captions and
          transcript keep the text). */}
      <form onSubmit={handleManualInput} className="mb-3 flex gap-2">
        <input
          type="text"
          name="manualText"
          aria-label="Type your response"
          placeholder="Or type your response here..."
          disabled={isAIProcessing}
          className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isAIProcessing}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
        >
          Send
        </button>
      </form>

      {/* Tips & Help */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          💡 Tip: Cite &quot;38 CFR...&quot;, &quot;per case law...&quot;,
          &quot;medical nexus...&quot;
        </span>
        <button
          onClick={onExitCourtroom}
          className="text-red-500 hover:text-red-600 font-medium"
        >
          ← Exit Courtroom
        </button>
      </div>
    </div>
  );
}

/**
 * Pre-hearing instructions: AI mode toggle, judge persona picker, and the
 * required speech-technology disclosure/acknowledgement
 */
function PreHearingInstructions({
  aiAvailable,
  useAI,
  setUseAI,
  selectedPersona,
  setSelectedPersona,
  acknowledgedWarning,
  setAcknowledgedWarning,
}) {
  return (
    <div className="-m-4 bg-blue-50 p-4 dark:bg-blue-900/20 sm:p-6">
      <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-3">
        📋 Before You Begin:
      </h3>

      {/* AI Required Warning */}
      {!aiAvailable && (
        <div className="mb-4 p-4 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-400 dark:border-amber-600/50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="font-bold text-amber-900 dark:text-amber-300">
                AI Required for Analysis
              </h3>
              <p className="text-amber-800 dark:text-amber-200 text-sm mt-1">
                Click the <strong>AI Status button</strong> in the header
                above to load your secure Local AI (100% private) or enter
                your Gemini API key.
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
              <div className="font-semibold text-purple-900 dark:text-purple-200">
                AI-Powered Judge
              </div>
              <p className="text-xs text-purple-700 dark:text-purple-300">
                {aiAvailable
                  ? "Intelligent responses based on VA law and your claims"
                  : "AI unavailable - using preset questions"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setUseAI(!useAI)}
            disabled={!aiAvailable}
            aria-label={useAI ? "Disable AI judges" : "Enable AI judges"}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              useAI && aiAvailable
                ? "bg-purple-600"
                : "bg-gray-300 dark:bg-gray-600"
            } ${!aiAvailable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                useAI && aiAvailable ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {useAI && aiAvailable && (
          <p className="mt-2 text-xs text-purple-700 dark:text-purple-300 bg-purple-200/50 dark:bg-purple-900/50 rounded p-2">
            ✨ AI judges will evaluate your arguments using real veterans law
            principles, cite relevant case law, and provide personalized
            coaching.
          </p>
        )}
      </div>

      {/* Persona Selection */}
      <div className="mb-4">
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Select Your Judge:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(JUDGE_PERSONAS).map(([key, persona]) => (
            <button
              key={key}
              onClick={() => setSelectedPersona(key)}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedPersona === key
                  ? "border-blue-600 bg-blue-100 dark:bg-blue-900"
                  : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
              }`}
            >
              <div className="text-3xl mb-1">{persona.avatar}</div>
              <div className="font-semibold text-sm">{persona.name}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {persona.style}
              </div>
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300 mb-4">
        <li>• This is practice - your responses are not recorded</li>
        <li>• Speak clearly and use legal terms when possible</li>
        <li>• The judge will challenge you - that&apos;s their job</li>
        <li>• Cite regulations (38 CFR) and case law when you can</li>
        <li>
          • If you don&apos;t know the answer, say &quot;I would consult my
          representative&quot;
        </li>
      </ul>

      {/* RT9-2: UPL / 38 C.F.R. 14.629 self-help disclaimer */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>Educational self-help only.</strong> The Tribunal is a
          practice tool, not legal representation. Vet-Rate.org does not
          prepare or present claims to the VA on your behalf and is not an
          accredited claims agent or attorney (38 C.F.R. § 14.629). For
          complex claims or appeals, consult an accredited VSO, claims agent,
          or attorney.
        </p>
      </div>

      {/* Speech/Hearing Technology Warning */}
      <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border-2 border-amber-300 dark:border-amber-700">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h4 className="font-bold text-amber-900 dark:text-amber-200 mb-1">
              Audio Technology Notice
            </h4>
            <p className="text-sm text-amber-800 dark:text-amber-300 mb-2">
              This feature can use <strong>speech synthesis</strong>{" "}
              (text-to-speech) and <strong>speech recognition</strong>{" "}
              (microphone input). Both are optional — every word the judge
              says is also shown as text.
            </p>
            <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <li>
                💬 <strong>Live captions:</strong> Everything the judge says
                appears in the on-screen caption panel and transcript — no
                audio needed.
              </li>
              <li>
                🔊 <strong>Speakers/Headphones (optional):</strong> The AI
                judge can speak aloud. Voice can be turned off at any time.
              </li>
              <li>
                🎤 <strong>Microphone (optional):</strong> Grant microphone
                permission only if you want to answer by voice.
              </li>
              <li>
                ⌨️ <strong>Typing always works:</strong> The text box stays
                active at all times — even while the judge is speaking.
              </li>
              <li>
                🔒 <strong>Privacy:</strong> Voice data is processed locally
                by your browser and is NOT recorded or stored.
              </li>
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
    </div>
  );
}

/**
 * Conversation transcript: judge/veteran message bubbles plus the AI
 * "thinking" indicator
 */
function ConversationLog({ conversation, selectedPersona, isAIProcessing }) {
  return (
    <div className="-m-4 space-y-4 bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
      {conversation.map((message, index) => (
        <div
          key={index}
          className={`flex ${message.speaker === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-4 ${getMessageBubbleClass(message)}`}
          >
            {message.speaker === "judge" && (
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
            <p
              className={`${message.speaker === "user" ? "text-white" : "text-gray-800 dark:text-gray-200"}`}
            >
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
        <AIProcessingIndicator selectedPersona={selectedPersona} />
      )}
    </div>
  );
}

/**
 * "Judge is thinking" indicator shown while an AI response is generating
 */
function AIProcessingIndicator({ selectedPersona }) {
  return (
    <div className="flex justify-start">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 max-w-[85%] sm:max-w-[80%]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">
            {JUDGE_PERSONAS[selectedPersona].avatar}
          </span>
          <span className="font-bold text-sm">
            {JUDGE_PERSONAS[selectedPersona].name}
          </span>
          <span className="text-xs bg-purple-200 dark:bg-purple-700 text-purple-800 dark:text-purple-200 px-2 py-1 rounded flex items-center gap-1">
            🤖 AI
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <div className="flex space-x-1">
            <div
              className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            ></div>
            <div
              className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            ></div>
            <div
              className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            ></div>
          </div>
          <span className="text-sm">
            Judge is considering your response...
          </span>
        </div>
      </div>
    </div>
  );
}
