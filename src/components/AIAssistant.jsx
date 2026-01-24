/**
 * Vet-Rate.org AI Assistant - "The Navigator"
 * 
 * An intelligent AI guide that helps veterans and their families navigate
 * the complex VA claims process using natural language conversation.
 * 
 * Features:
 * - Context-aware help (knows what page/tool user is on)
 * - Conversational interface (ask anything)
 * - Uses LEGAL preset for accurate regulatory guidance
 * - Can launch specific tools and explain how to use them
 * - Explains VA terminology in plain English
 * - Provides step-by-step guidance for claims process
 */

import React, { useState, useEffect, useRef } from 'react';
import { generateAI } from '../utils/unifiedAIService';
import { useHelperMode } from '../contexts/HelperModeContext';
import { getTotalToolCount } from '../data/toolkitData';
import { AIStatusBadge } from './AIModeSelector';
import VoiceInputButton from './VoiceInput';

const AIAssistant = ({ currentTool = 'Home', onClose, onOpenAISettings }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('vet_rate_navigator_position');
    return saved ? JSON.parse(saved) : { 
      x: (window.innerWidth - 384) / 2, // Centered horizontally (w-96 = 384px)
      y: (window.innerHeight - 600) / 2 // Centered vertically
    };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const { isHelperMode } = useHelperMode();

  // Save position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('vet_rate_navigator_position', JSON.stringify(position));
  }, [position]);

  // Drag handlers
  const handleMouseDown = (e) => {
    // Allow dragging from header (full view) or the entire minimized button
    if (isMinimized || e.target.closest('.drag-handle')) {
      e.preventDefault();
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep within viewport bounds - use smaller bounds for minimized button
      const width = isMinimized ? 72 : 384; // p-4 rounded-full ~= 72px, w-96 = 384px
      const height = isMinimized ? 72 : 600;
      const maxX = window.innerWidth - width;
      const maxY = window.innerHeight - height;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add/remove mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset, position]);

  // Listen for tour start event to close Navigator (prevents blocking tour elements)
  useEffect(() => {
    const handleCloseNavigator = () => {
      if (onClose) {
        onClose();
      }
    };
    
    window.addEventListener('closeNavigator', handleCloseNavigator);
    return () => window.removeEventListener('closeNavigator', handleCloseNavigator);
  }, [onClose]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('vet_rate_ai_assistant_welcomed');
    
    if (!hasSeenWelcome) {
      setMessages([{
        role: 'assistant',
        content: `👋 **Welcome to The Navigator!**

💡 **TIP:** Grab the header to drag me anywhere on your screen!

I'm your AI guide for Vet-Rate.org and the VA claims process. I can help you:

• **Explain any VA term or acronym** - Just ask "What is TDIU?" or "Explain service connection"
• **Guide you through tools** - "How do I use the Rating Calculator?"
• **Answer claims questions** - "What evidence do I need for PTSD?"
• **Recommend next steps** - "What should I do after my C&P exam?"
• **Find the right tool** - "I need help with a nexus letter"

**Try asking me anything!** I use VA regulations (38 CFR) to give accurate answers.`,
        timestamp: new Date()
      }]);
      localStorage.setItem('vet_rate_ai_assistant_welcomed', 'true');
    }
  }, []);

  // Build context-aware system prompt
  const buildSystemPrompt = () => {
    const basePrompt = `You are "The Navigator", an expert AI assistant for Vet-Rate.org - a comprehensive VA disability claims toolkit.

YOUR ROLE:
- Help veterans and their families navigate the VA claims process
- Explain VA regulations, terminology, and procedures in ${isHelperMode ? 'simple, caregiver-friendly language' : 'clear language'}
- Guide users through the ${getTotalToolCount()}+ tools available on Vet-Rate.org
- Provide accurate information based on 38 CFR (VA regulations)
- Be empathetic, patient, and supportive

IMPORTANT - eCFR INTEGRATION:
Vet-Rate.org is FULLY INTEGRATED with the official eCFR (Electronic Code of Federal Regulations):
- All 751 VA disabilities are validated against official eCFR diagnostic codes
- Direct links to eCFR sections are provided throughout the application
- Rating criteria comes directly from 38 CFR Part 4 (validated January 2026)
- Eligibility rules come from 38 CFR Part 3
- The Legislative Watchdog monitors Federal Register for 38 CFR changes in real-time
- Source URLs: 
  * eCFR Part 3: https://www.ecfr.gov/current/title-38/chapter-I/part-3
  * eCFR Part 4: https://www.ecfr.gov/current/title-38/chapter-I/part-4

CURRENT CONTEXT:
- User is currently on: ${currentTool}
- Helper Mode (for caregivers): ${isHelperMode ? 'ENABLED - Use simplified language' : 'Disabled'}

AVAILABLE TOOLS ON VET-RATE.ORG:
1. **Disability Search** - Search 751 VA conditions with ratings (eCFR validated)
2. **Rating Calculator** - Calculate combined disability rating using 38 CFR § 4.25
3. **Secondary Scout** - Find conditions caused by existing disabilities (38 CFR § 3.310)
4. **C-File Analyzer** - AI analysis of VA claims files
5. **Nexus Builder** - Generate medical nexus letters
6. **PACT Act Navigator** - Toxic exposure presumptives (38 CFR § 3.320)
7. **TDIU Builder** - Individual Unemployability (38 CFR § 4.16)
8. **DBQ Filler** - Complete Disability Benefit Questionnaires
9. **C&P Simulator** - Practice for Compensation & Pension exams
10. **Witness Bench** - Write buddy/lay statements
11. **Forms Helper** - VA form assistance
12. **Evidence Timeline** - Organize medical evidence chronologically
13. **State Benefits** - Tax exemptions and state-level benefits
14. **The War Game** - Red Team adversarial claim testing
15. **My Packet** - Personal claims toolkit
16. **Legislative Watchdog** - Monitor Federal Register for 38 CFR changes
... and 25+ more tools

GUIDELINES:
- Always cite 38 CFR sections when discussing ratings (e.g., "Per 38 CFR § 4.71a")
- If uncertain, say so and recommend consulting a VSO (free!)
- Keep responses concise (2-4 paragraphs max)
- Use bullet points for lists
- If asked how to use a specific tool, explain step-by-step
- Don't make up diagnostic codes - only use real ones from eCFR
- Emphasize that this is educational, not legal advice

TONE: ${isHelperMode ? 'Extra supportive and patient - user may be a caregiver unfamiliar with VA processes' : 'Professional but warm and empathetic'}`;

    return basePrompt;
  };

  // Handle sending a message
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await generateAI(input.trim(), {
        preset: 'LEGAL', // Use LEGAL preset for accurate regulatory guidance
        maxTokens: 2048,
        temperature: 0.3, // Slightly more flexible than pure LEGAL but still precise
        systemPrompt: buildSystemPrompt(),
        taskType: 'assistant',
        context: {
          currentTool,
          isHelperMode,
          conversationHistory: messages.slice(-4) // Last 2 exchanges for context
        }
      });

      // Validate we got a meaningful response
      const responseText = result?.text?.trim();
      if (!responseText) {
        throw new Error('AI returned an empty response. Please try again or rephrase your question.');
      }

      const assistantMessage = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        mode: result.mode
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Navigator AI error:', error);
      let errorMessage = 'I encountered an error. Please try again.';
      
      if (error.message === 'CRISIS_DETECTED') {
        errorMessage = '⚠️ I detected language that may indicate distress. Please reach out to the Veterans Crisis Line: **Call 988, Press 1** or text 838255. You can also chat at VeteransCrisisLine.net. Help is available 24/7.';
      } else if (error.message.includes('No AI available')) {
        errorMessage = '⚠️ AI is not configured. Please set up Cloud AI (Gemini API key) or Local AI in Settings.';
      } else if (error.message.includes('temporarily disabled')) {
        errorMessage = '⚠️ AI features are temporarily unavailable. Please try again later.';
      } else if (error.message.includes('empty response')) {
        errorMessage = '⚠️ AI returned an empty response. This can happen with Local AI sometimes. Please try:\n• Rephrasing your question\n• Using a shorter prompt\n• Checking if the model is fully loaded';
      } else if (error.message.includes('not initialized') || error.message.includes('not loaded')) {
        errorMessage = '⚠️ Local AI is not ready yet. Please wait for the model to finish loading, or configure Cloud AI in Settings.';
      } else if (error.message) {
        errorMessage = `⚠️ ${error.message}`;
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick question suggestions based on current tool
  const getQuickQuestions = () => {
    const questions = {
      'Home': [
        'What should I do first to file a claim?',
        'How does the VA rating system work?',
        'What tools should I use for a PTSD claim?'
      ],
      'Disability Search': [
        'How do I find the right diagnostic code?',
        'What does "bilateral factor" mean?',
        'Can you explain how ratings are assigned?'
      ],
      'Rating Calculator': [
        'How does VA math work?',
        'What is the bilateral factor?',
        'Can I get 100% with multiple conditions?'
      ],
      'Secondary Scout': [
        'What are secondary conditions?',
        'How do I prove a condition is secondary?',
        'What evidence do I need for secondary claims?'
      ],
      'C-File Analyzer': [
        'How do I get my C-File?',
        'What should I look for in my C-File?',
        'Can you help me analyze a denial?'
      ],
      'Nexus Builder': [
        'What is a nexus letter?',
        'What should a nexus letter include?',
        'Do I need a doctor to write this?'
      ],
      'PACT Act Navigator': [
        'Am I covered under the PACT Act?',
        'What are presumptive conditions?',
        'How do I file a PACT Act claim?'
      ],
      'TDIU Builder': [
        'What is TDIU?',
        'Do I qualify for TDIU?',
        'What evidence do I need for TDIU?'
      ]
    };

    return questions[currentTool] || questions['Home'];
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // When minimized, position it at bottom-left corner by default
  useEffect(() => {
    if (isMinimized) {
      // Position at bottom-left corner (matching the launcher button position)
      setPosition({
        x: 16, // left-4 = 16px
        y: window.innerHeight - 72 - 16 // bottom-4 = 16px, button height ~72px
      });
    } else {
      // When expanding, reposition so the Navigator appears above the button
      // Navigator height is 600px, so position it anchored at the bottom
      setPosition(prev => ({
        x: 16, // Keep at left edge
        y: Math.max(16, window.innerHeight - 600 - 16) // Anchor at bottom with 16px margin, but not above viewport
      }));
    }
  }, [isMinimized]);

  if (isMinimized) {
    return (
      <button
        onClick={(e) => {
          // Only restore if not dragging
          if (!isDragging) {
            setIsMinimized(false);
          }
        }}
        onMouseDown={handleMouseDown}
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        className="fixed z-50 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full p-4 shadow-2xl transition-all hover:scale-110 group cursor-move"
        title="Drag to move • Click to open AI Navigator"
      >
        <div className="relative pointer-events-none">
          <span className="text-2xl">🧭</span>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
        </div>
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Click to expand Navigator 💬
        </div>
      </button>
    );
  }

  return (
    <div 
      id="tour-ai-navigator-expanded"
      ref={containerRef}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-50 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col"
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="drag-handle bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-xl flex items-center justify-between cursor-move select-none">
        <div className="flex items-center gap-3 pointer-events-none">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🧭</span>
          </div>
          <div>
            <h3 className="font-bold text-lg">The Navigator</h3>
            <p className="text-xs text-blue-100 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
              </svg>
              Drag to move anywhere
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* AI Status Button */}
          {onOpenAISettings && (
            <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <AIStatusBadge 
                onClick={onOpenAISettings} 
                className="text-xs"
                showLabel={false}
              />
            </div>
          )}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title="Minimize"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : msg.isError
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }`}
            >
              {/* Markdown-style formatting */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {msg.content.split('\n').map((line, i) => {
                  // Bold
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={i} className="font-bold mb-1">{line.slice(2, -2)}</p>;
                  }
                  // Bullet point
                  if (line.startsWith('• ') || line.startsWith('- ')) {
                    return <li key={i} className="ml-4">{line.slice(2)}</li>;
                  }
                  // Regular text
                  if (line.trim()) {
                    return <p key={i} className="mb-1">{line}</p>;
                  }
                  return <br key={i} />;
                })}
              </div>
              
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20 dark:border-gray-600">
                <span className="text-xs opacity-70">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.mode && (
                  <span className="text-xs opacity-70">
                    {msg.mode === 'local' ? '🔒 Local' : '☁️ Cloud'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 flex items-center gap-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Analyzing...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length <= 1 && !isLoading && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Quick questions:</p>
          <div className="space-y-1">
            {getQuickQuestions().map((q, idx) => (
              <button
                key={idx}
                onClick={() => setInput(q)}
                className="w-full text-left text-xs px-2 py-1.5 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded border border-gray-200 dark:border-gray-700 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isHelperMode ? "Ask me anything about VA claims... or tap the mic" : "Ask me anything... or tap the mic"}
              className="w-full px-3 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              disabled={isLoading}
            />
            <div className="absolute right-2 top-2">
              <VoiceInputButton
                onTranscript={(text) => setInput(prev => prev ? `${prev} ${text}` : text)}
                size="sm"
                disabled={isLoading}
              />
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors self-end"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Press Enter to send • 🎤 Tap mic to speak {isHelperMode && '• 💝 Helper Mode Active'}
        </p>
      </div>
    </div>
  );
};

export default AIAssistant;
