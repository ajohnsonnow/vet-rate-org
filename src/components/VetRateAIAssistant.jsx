/**
 * Vet-Rate AI Assistant Component
 * RAG-based VA claims assistance with 1,496 knowledge entries
 */

import React, { useState, useRef, useEffect } from 'react';
import { useVetRateAI } from '../hooks/useVetRateAI';
import { 
  Bot, 
  Send, 
  Sparkles, 
  FileText, 
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  BookOpen
} from 'lucide-react';

const VetRateAIAssistant = ({ isOpen, onClose }) => {
  const { isReady, isLoading, ask, knowledgeCount } = useVetRateAI();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showSources, setShowSources] = useState({});
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message
  useEffect(() => {
    if (isReady && messages.length === 0) {
      setMessages([{
        type: 'assistant',
        content: `Welcome to the Vet-Rate AI Assistant! I have access to ${knowledgeCount.toLocaleString()} knowledge entries about VA disability claims.

You can ask me about:
• **Diagnostic codes** (e.g., "What is DC 9411?")
• **Secondary conditions** (e.g., "Can sleep apnea be secondary to PTSD?")
• **Rating criteria** (e.g., "What are the rating criteria for tinnitus?")
• **PACT Act** presumptive conditions

How can I help you today?`,
        sources: []
      }]);
    }
  }, [isReady, knowledgeCount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);

    // Get AI response
    const response = await ask(userMessage);

    // Add assistant response
    const msgId = Date.now();
    setMessages(prev => [...prev, {
      id: msgId,
      type: 'assistant',
      content: response.answer,
      sources: response.sources || [],
      suggestions: response.suggestions || [],
      matchCount: response.matchCount
    }]);
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
  };

  const toggleSources = (msgId) => {
    setShowSources(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Vet-Rate AI</h2>
              <p className="text-xs text-slate-400">
                {isReady ? (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    {knowledgeCount.toLocaleString()} knowledge entries loaded
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading knowledge base...
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="text-slate-400 text-xl">&times;</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 ${
                  msg.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-100'
                }`}
              >
                {msg.type === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2 text-blue-400 text-sm">
                    <Sparkles className="w-4 h-4" />
                    <span>AI Assistant</span>
                    {msg.matchCount && (
                      <span className="text-slate-500">
                        ({msg.matchCount} relevant sources)
                      </span>
                    )}
                  </div>
                )}
                
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content}
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <button
                      onClick={() => toggleSources(msg.id)}
                      className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Sources ({msg.sources.length})</span>
                      {showSources[msg.id] ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                    
                    {showSources[msg.id] && (
                      <div className="mt-2 space-y-1">
                        {msg.sources.map((src, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs text-slate-500"
                          >
                            <FileText className="w-3 h-3" />
                            <span>{src.citation}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              src.source === '38CFR' ? 'bg-red-900/50 text-red-300' :
                              src.source === '38CFR_3.310' ? 'bg-purple-900/50 text-purple-300' :
                              src.source === 'PACT_ACT' ? 'bg-green-900/50 text-green-300' :
                              'bg-slate-700 text-slate-400'
                            }`}>
                              {src.source}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Suggestions */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.suggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(sug)}
                        className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300 transition-colors"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-2xl p-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span className="text-sm text-slate-400">Searching knowledge base...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about VA disability claims..."
              disabled={!isReady || isLoading}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!isReady || isLoading || !input.trim()}
              className="px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <AlertCircle className="w-3 h-3" />
            <span>100% local - your questions never leave your device</span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VetRateAIAssistant;
