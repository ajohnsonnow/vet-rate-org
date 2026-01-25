/**
 * SupplyLocker.org - Global Command Search (CMD+K)
 * Copyright (c) 2024-2026 Anthony Johnson
 * 
 * AAAAA Design System - Quick Search Interface
 * 
 * Veterans often memorize diagnostic codes (e.g., "5237" for lumbosacral strain).
 * This provides instant access to tools and conditions via keyboard shortcuts.
 * 
 * Features:
 * - CMD+K / CTRL+K keyboard shortcut
 * - Search tools, conditions, and diagnostic codes
 * - Keyboard-navigable with roving tabindex
 * - AAA compliant focus indicators
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import disabilityData from '../data/disabilityData.json';

// Extract diagnostic codes from disability data for quick search
const diagnosticCodes = disabilityData.disabilities.map(d => ({
  code: d.diagnosticCode,
  name: d.conditionName,
  aliases: d.aliases || [],
  searchTerms: d.searchTerms || []
}));

// Tool definitions for quick access
const TOOLS = [
  { id: 'tactical-calc', name: 'Tactical Calculator', keywords: ['calculate', 'rating', 'combined', 'math'], icon: '🧮', category: 'Calculate' },
  { id: 'my-packet', name: 'My Packet', keywords: ['saved', 'conditions', 'claims', 'packet'], icon: '📁', category: 'Core' },
  { id: 'cfile-analyzer', name: 'C-File AI Analyzer', keywords: ['cfile', 'claims file', 'ai', 'analyze', 'pdf'], icon: '📋', category: 'Evidence' },
  { id: 'blue-button', name: 'Blue Button X-Ray', keywords: ['health records', 'medical', 'va', 'blue button'], icon: '💙', category: 'Evidence' },
  { id: 'nexus-builder', name: 'Nexus Builder', keywords: ['nexus', 'connection', 'link', 'medical opinion'], icon: '🔗', category: 'Evidence' },
  { id: 'secondary-scout', name: 'Secondary Scout', keywords: ['secondary', 'related', 'conditions'], icon: '🔍', category: 'Discovery' },
  { id: 'pact-navigator', name: 'PACT Act Navigator', keywords: ['pact', 'toxic', 'burn pit', 'presumptive'], icon: '⚠️', category: 'Discovery' },
  { id: 'cap-simulator', name: 'C&P Exam Simulator', keywords: ['cap', 'exam', 'compensation', 'pension', 'practice'], icon: '🎯', category: 'Prepare' },
  { id: 'red-team', name: 'The War Game', keywords: ['red team', 'va rater', 'challenge', 'stress test'], icon: '♟️', category: 'Verify' },
  { id: 'witness-bench', name: 'Witness Bench', keywords: ['buddy', 'statement', 'witness', 'lay'], icon: '✍️', category: 'Evidence' },
  { id: 'forms-helper', name: 'Forms Helper', keywords: ['forms', '21-526ez', 'va form', 'pdf'], icon: '📝', category: 'Support' },
  { id: 'million-dollar', name: 'Million Dollar Dashboard', keywords: ['lifetime', 'benefits', 'value', 'money'], icon: '💰', category: 'Calculate' },
  { id: 'retro-hunter', name: 'Retro Pay Hunter', keywords: ['back pay', 'retro', 'retroactive'], icon: '💵', category: 'Calculate' },
  { id: 'tdiu-builder', name: 'TDIU Builder', keywords: ['tdiu', 'unemployability', 'individual'], icon: '📊', category: 'Calculate' },
  { id: 'denial-decoder', name: 'Denial Decoder', keywords: ['denial', 'denied', 'decision', 'letter'], icon: '📖', category: 'Verify' },
  { id: 'vso-finder', name: 'VSO Finder', keywords: ['vso', 'service officer', 'help', 'representative'], icon: '👥', category: 'Support' },
  { id: 'state-benefits', name: 'State Benefits', keywords: ['state', 'benefits', 'local'], icon: '🏛️', category: 'Support' },
  { id: 'backup-manager', name: 'The Bunker', keywords: ['backup', 'save', 'export', 'sync'], icon: '💾', category: 'Core' },
  { id: 'web-conditions', name: 'Web of Conditions', keywords: ['web', 'graph', 'relationships', 'visual'], icon: '🕸️', category: 'Discovery' },
  { id: 'symptom-logger', name: 'Symptom Logger', keywords: ['symptoms', 'log', 'track', 'daily'], icon: '📝', category: 'Evidence' },
  { id: 'dd214-analyzer', name: 'DD214 Analyzer', keywords: ['dd214', 'discharge', 'service record'], icon: '📜', category: 'Evidence' },
  { id: 'workflow-guide', name: 'Mission Roadmap', keywords: ['guide', 'workflow', 'mission', 'steps'], icon: '🗺️', category: 'Core' },
  { id: 'user-manual', name: 'User Manual', keywords: ['help', 'manual', 'instructions', 'how to'], icon: '❓', category: 'Support' },
];

export default function GlobalCommandSearch({ isOpen, onClose, onToolSelect, onConditionSelect }) {
  const { isDark, isTbiComfort, isAaaContrast } = useTheme();
  
  // Lock background scroll when modal is open
  useBodyScrollLock(isOpen);
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ tools: [], conditions: [] });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  
  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);
  
  // Search function
  const performSearch = useCallback((searchQuery) => {
    if (!searchQuery.trim()) {
      // Show popular tools when empty
      setResults({
        tools: TOOLS.slice(0, 6),
        conditions: []
      });
      return;
    }
    
    const q = searchQuery.toLowerCase().trim();
    
    // Search tools
    const matchedTools = TOOLS.filter(tool => 
      tool.name.toLowerCase().includes(q) ||
      tool.keywords.some(kw => kw.includes(q)) ||
      tool.category.toLowerCase().includes(q)
    ).slice(0, 5);
    
    // Search diagnostic codes (if it looks like a code number)
    let matchedConditions = [];
    if (/^\d+/.test(q)) {
      // Search by diagnostic code
      matchedConditions = Object.entries(diagnosticCodes)
        .filter(([code]) => code.startsWith(q))
        .map(([code, data]) => ({
          code,
          name: data.name || data.condition || 'Unknown',
          category: data.category || 'General'
        }))
        .slice(0, 5);
    } else {
      // Search by condition name
      matchedConditions = Object.entries(diagnosticCodes)
        .filter(([code, data]) => {
          const name = (data.name || data.condition || '').toLowerCase();
          return name.includes(q);
        })
        .map(([code, data]) => ({
          code,
          name: data.name || data.condition || 'Unknown',
          category: data.category || 'General'
        }))
        .slice(0, 5);
    }
    
    setResults({ tools: matchedTools, conditions: matchedConditions });
    setSelectedIndex(0);
  }, []);
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 150);
    return () => clearTimeout(timer);
  }, [query, performSearch]);
  
  // Keyboard navigation
  const handleKeyDown = (e) => {
    const totalResults = results.tools.length + results.conditions.length;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, totalResults));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalResults) % Math.max(1, totalResults));
        break;
      case 'Enter':
        e.preventDefault();
        handleSelect(selectedIndex);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };
  
  const handleSelect = (index) => {
    const toolsCount = results.tools.length;
    
    if (index < toolsCount) {
      // Tool selected
      const tool = results.tools[index];
      if (onToolSelect) onToolSelect(tool.id);
    } else {
      // Condition selected
      const condition = results.conditions[index - toolsCount];
      if (onConditionSelect) onConditionSelect(condition);
    }
    
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Search Modal */}
      <div 
        className={`
          relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden
          ${isDark || isTbiComfort ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-slate-200'}
          ${isAaaContrast ? 'border-2 border-white' : ''}
        `}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick search"
      >
        {/* Search Input */}
        <div className={`flex items-center gap-3 p-4 border-b ${isDark || isTbiComfort ? 'border-gray-700' : 'border-slate-200'}`}>
          <svg className={`w-5 h-5 ${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tools, conditions, or diagnostic codes (e.g., 5237)"
            className={`
              flex-1 bg-transparent text-lg outline-none
              ${isDark || isTbiComfort ? 'text-white placeholder-gray-500' : 'text-slate-900 placeholder-slate-400'}
            `}
            aria-label="Search query"
          />
          <kbd className={`hidden sm:inline-block px-2 py-1 text-xs font-mono rounded ${isDark || isTbiComfort ? 'bg-gray-800 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>
            ESC
          </kbd>
        </div>
        
        {/* Results */}
        <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto">
          {/* Tools Section */}
          {results.tools.length > 0 && (
            <div className="p-2">
              <p className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-400'}`}>
                Tools
              </p>
              {results.tools.map((tool, index) => (
                <button
                  key={tool.id}
                  onClick={() => handleSelect(index)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors
                    ${index === selectedIndex 
                      ? `${isDark || isTbiComfort ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-50 text-blue-900'}` 
                      : `${isDark || isTbiComfort ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
                  `}
                >
                  <span className="text-2xl" aria-hidden="true">{tool.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{tool.name}</p>
                    <p className={`text-xs ${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-500'}`}>{tool.category}</p>
                  </div>
                  {index === selectedIndex && (
                    <kbd className={`px-2 py-1 text-xs font-mono rounded ${isDark || isTbiComfort ? 'bg-gray-700 text-gray-400' : 'bg-slate-200 text-slate-500'}`}>
                      ↵
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          )}
          
          {/* Conditions Section */}
          {results.conditions.length > 0 && (
            <div className="p-2">
              <p className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-400'}`}>
                Diagnostic Codes
              </p>
              {results.conditions.map((condition, idx) => {
                const index = results.tools.length + idx;
                return (
                  <button
                    key={condition.code}
                    onClick={() => handleSelect(index)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors
                      ${index === selectedIndex 
                        ? `${isDark || isTbiComfort ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-50 text-blue-900'}` 
                        : `${isDark || isTbiComfort ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
                    `}
                  >
                    <span className={`font-mono text-sm font-bold px-2 py-1 rounded ${isDark || isTbiComfort ? 'bg-gray-800 text-amber-400' : 'bg-amber-100 text-amber-800'}`}>
                      {condition.code}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{condition.name}</p>
                      <p className={`text-xs ${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-500'}`}>{condition.category}</p>
                    </div>
                    {index === selectedIndex && (
                      <kbd className={`px-2 py-1 text-xs font-mono rounded ${isDark || isTbiComfort ? 'bg-gray-700 text-gray-400' : 'bg-slate-200 text-slate-500'}`}>
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          
          {/* No Results */}
          {results.tools.length === 0 && results.conditions.length === 0 && query && (
            <div className={`p-8 text-center ${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-400'}`}>
              <p className="text-lg">No results found</p>
              <p className="text-sm mt-1">Try searching for a tool name or diagnostic code</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className={`px-4 py-3 border-t ${isDark || isTbiComfort ? 'border-gray-700 bg-gray-800/50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center justify-between text-xs">
            <div className={`flex items-center gap-4 ${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-500'}`}>
              <span><kbd className="font-mono">↑↓</kbd> Navigate</span>
              <span><kbd className="font-mono">↵</kbd> Select</span>
              <span><kbd className="font-mono">ESC</kbd> Close</span>
            </div>
            <span className={`${isDark || isTbiComfort ? 'text-gray-600' : 'text-slate-400'}`}>
              Powered by Local Search
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage global command search state
 */
export function useCommandSearch() {
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      // CMD+K or CTRL+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  };
}
