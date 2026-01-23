/**
 * Vet-Rate AI Assistant Component
 * 💎 DIAMOND Knowledge Base (DKB) - Official sources only
 * CKB (Community) is separate and NOT used for AI responses
 * RAG-based VA claims assistance with official sources only
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
  BookOpen,
  Shield,
  Gem,
  Clock
} from 'lucide-react';

const VetRateAIAssistant = ({ isOpen, onClose }) => {
  const { isReady, isLoading, ask, knowledgeCount, metadata, sourceColors, isDiamond, bvaApiPending } = useVetRateAI();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showSources, setShowSources] = useState({});
  const [showKBInfo, setShowKBInfo] = useState(false);
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
        content: `Welcome to the Vet-Rate AI Assistant! 💎 **Diamond Knowledge Base (DKB)** with ${knowledgeCount.toLocaleString()} official entries.

**Official Sources Include:**
• 🔴 **38 CFR Part 4** - Rating Schedule (1,070 entries)
• 🟣 **OGC Precedent Opinions** - Binding legal interpretations (49 entries)
• 🟢 **PACT Act** - Presumptive conditions (28 entries)
• 🔵 **Secondary Conditions Matrix** - 234 nexus relationships
• 🟠 **Federal Register** - Recent VA rules (15 entries)
• 📘 **M21-1 Manual** - VA procedures

⚠️ **Note:** Community Knowledge (CKB) is maintained separately and is not used for AI responses.

**Ask me about:**
• Diagnostic codes (e.g., "What is DC 9411?")
• Secondary connections (e.g., "sleep apnea secondary to PTSD")
• OGC opinions (e.g., "OGC precedent on TDIU")
• PACT Act presumptives (e.g., "hypertension PACT Act")
• Rating criteria (e.g., "rating criteria for tinnitus")

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

  // Get source color info (DKB sources only - no community)
  const getSourceStyle = (source) => {
    const styles = {
      'eCFR_OFFICIAL': { bg: 'bg-red-900/50', text: 'text-red-300', label: '38 CFR' },
      'FEDERAL_REGISTER_OFFICIAL': { bg: 'bg-orange-900/50', text: 'text-orange-300', label: 'Fed Register' },
      'OGC_PRECEDENT_OPINION': { bg: 'bg-purple-900/50', text: 'text-purple-300', label: 'OGC' },
      'BVA_DECISIONS': { bg: 'bg-purple-900/50', text: 'text-purple-300', label: 'BVA' },
      'BVA_REPORTS_OFFICIAL': { bg: 'bg-purple-900/50', text: 'text-purple-300', label: 'BVA Reports' },
      'M21-1_OFFICIAL': { bg: 'bg-blue-900/50', text: 'text-blue-300', label: 'M21-1' },
      'PACT_ACT_OFFICIAL': { bg: 'bg-green-900/50', text: 'text-green-300', label: 'PACT Act' },
      'VA_OFFICIAL': { bg: 'bg-slate-700/50', text: 'text-slate-300', label: 'VA Official' },
      'SECONDARY_CONDITIONS_MATRIX': { bg: 'bg-cyan-900/50', text: 'text-cyan-300', label: 'Secondary' },
      'EAJA_STATISTICS_OFFICIAL': { bg: 'bg-yellow-900/50', text: 'text-yellow-300', label: 'EAJA' },
      // NOTE: COMMUNITY_PROVIDED not included - CKB is separate
    };
    return styles[source] || { bg: 'bg-slate-700', text: 'text-slate-400', label: source };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl relative">
              <Bot className="w-6 h-6 text-white" />
              {isDiamond && (
                <Gem className="w-3 h-3 text-cyan-400 absolute -top-1 -right-1" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Vet-Rate AI
                {isDiamond && (
                  <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-full text-cyan-400 flex items-center gap-1">
                    <Gem className="w-3 h-3" />
                    DIAMOND
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                {isReady ? (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    {knowledgeCount.toLocaleString()} verified entries
                    <button 
                      onClick={() => setShowKBInfo(!showKBInfo)}
                      className="ml-1 text-blue-400 hover:text-blue-300 underline"
                    >
                      (info)
                    </button>
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

        {/* KB Info Panel - DKB only (no community) */}
        {showKBInfo && (
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-emerald-300 font-medium">💎 Diamond Knowledge Base (DKB) - Official Sources Only</span>
              <button onClick={() => setShowKBInfo(false)} className="text-slate-500 hover:text-slate-300">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="text-slate-400">38 CFR: 1,070</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                <span className="text-slate-400">Secondary Matrix: 234</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
                <span className="text-slate-400">VA Official: 159</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span className="text-slate-400">OGC Opinions: 49</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-slate-400">PACT Act: 28</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                <span className="text-slate-400">Fed Register: 15</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-amber-400/80 bg-amber-900/20 px-2 py-1 rounded">
              <Clock className="w-3 h-3" />
              <span>👥 CKB (Community): Separate - not used for AI training</span>
            </div>
            {bvaApiPending && (
              <div className="mt-2 flex items-center gap-2 text-amber-400/80 bg-amber-900/20 px-2 py-1 rounded">
                <Clock className="w-3 h-3" />
                <span>BVA Full Decisions: Pending API access from data.va.gov</span>
              </div>
            )}
          </div>
        )}

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
                        {msg.sources.map((src, i) => {
                          const style = getSourceStyle(src.source);
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-xs text-slate-400"
                            >
                              <FileText className="w-3 h-3" />
                              <span className="truncate flex-1">{src.citation}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${style.bg} ${style.text}`}>
                                {style.label}
                              </span>
                            </div>
                          );
                        })}
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
          
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Shield className="w-3 h-3" />
              <span>100% local - your questions never leave your device</span>
            </div>
            <div className="flex items-center gap-1 text-cyan-400/70">
              <Gem className="w-3 h-3" />
              <span>Diamond KB v2.0</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VetRateAIAssistant;
