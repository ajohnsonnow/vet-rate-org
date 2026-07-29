/**
 * Vet-Rate.org - Global Command Search (CMD+K)
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

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";
import useFocusTrap from "../hooks/useFocusTrap";
import { getAllConditions } from "../services/knowledgeQuery";

// Extract diagnostic codes from disability data for quick search
const diagnosticCodes = getAllConditions().map((d) => ({
  code: d.diagnosticCode,
  name: d.conditionName,
  aliases: d.aliases || [],
  searchTerms: d.searchTerms || [],
}));

// Tool definitions for quick access
const TOOLS = [
  {
    id: "tactical-calculator",
    name: "Tactical Calculator",
    keywords: ["calculate", "rating", "combined", "math"],
    icon: "🧮",
    category: "Calculate",
  },
  {
    id: "my-packet",
    name: "My Packet",
    keywords: ["saved", "conditions", "claims", "packet"],
    icon: "📁",
    category: "Core",
  },
  {
    id: "cfile-analyzer",
    name: "C-File AI Analyzer",
    keywords: ["cfile", "claims file", "ai", "analyze", "pdf"],
    icon: "📋",
    category: "Evidence",
  },
  {
    id: "blue-button",
    name: "Blue Button X-Ray",
    keywords: ["health records", "medical", "va", "blue button"],
    icon: "💙",
    category: "Evidence",
  },
  {
    id: "nexus-builder",
    name: "Nexus Builder",
    keywords: ["nexus", "connection", "link", "medical opinion"],
    icon: "🔗",
    category: "Evidence",
  },
  {
    id: "secondary-scout",
    name: "Secondary Scout",
    keywords: ["secondary", "related", "conditions"],
    icon: "🔍",
    category: "Discovery",
  },
  {
    id: "pact-act",
    name: "PACT Act Navigator",
    keywords: ["pact", "toxic", "burn pit", "presumptive"],
    icon: "⚠️",
    category: "Discovery",
  },
  {
    id: "cap-simulator",
    name: "C&P Exam Simulator",
    keywords: ["cap", "exam", "compensation", "pension", "practice"],
    icon: "🎯",
    category: "Prepare",
  },
  {
    id: "red-team",
    name: "The War Game",
    keywords: ["red team", "va rater", "challenge", "stress test"],
    icon: "♟️",
    category: "Verify",
  },
  {
    id: "witness-bench",
    name: "Witness Bench",
    keywords: ["buddy", "statement", "witness", "lay"],
    icon: "✍️",
    category: "Evidence",
  },
  {
    id: "forms-helper",
    name: "Forms Helper",
    keywords: ["forms", "21-526ez", "va form", "pdf"],
    icon: "📝",
    category: "Support",
  },
  {
    id: "ask-the-regs",
    name: "Ask the Regs",
    keywords: ["legal", "regulation", "cfr", "question", "ask", "citation"],
    icon: "⚖️",
    category: "Support",
  },
  {
    id: "million-dollar",
    name: "Million Dollar Dashboard",
    keywords: ["lifetime", "benefits", "value", "money"],
    icon: "💰",
    category: "Calculate",
  },
  {
    id: "retro-pay",
    name: "Retro Pay Hunter",
    keywords: ["back pay", "retro", "retroactive"],
    icon: "💵",
    category: "Calculate",
  },
  {
    id: "tdiu-builder",
    name: "TDIU Builder",
    keywords: ["tdiu", "unemployability", "individual"],
    icon: "📊",
    category: "Calculate",
  },
  {
    id: "denial-decoder",
    name: "Denial Decoder",
    keywords: ["denial", "denied", "decision", "letter"],
    icon: "📖",
    category: "Verify",
  },
  {
    id: "vso-finder",
    name: "VSO Finder",
    keywords: ["vso", "service officer", "help", "representative"],
    icon: "👥",
    category: "Support",
  },
  {
    id: "state-benefits",
    name: "State Benefits",
    keywords: ["state", "benefits", "local"],
    icon: "🏛️",
    category: "Support",
  },
  {
    id: "backup-manager",
    name: "The Bunker",
    keywords: ["backup", "save", "export", "sync"],
    icon: "💾",
    category: "Core",
  },
  {
    id: "web-of-conditions",
    name: "Web of Conditions",
    keywords: ["web", "graph", "relationships", "visual"],
    icon: "🕸️",
    category: "Discovery",
  },
  {
    id: "symptom-logger",
    name: "Symptom Logger",
    keywords: ["symptoms", "log", "track", "daily"],
    icon: "📝",
    category: "Evidence",
  },
  {
    id: "dd214-analyzer",
    name: "DD214 Analyzer",
    keywords: ["dd214", "discharge", "service record"],
    icon: "📜",
    category: "Evidence",
  },
  {
    id: "bdd-builder",
    name: "BDD Builder",
    keywords: [
      "bdd",
      "discharge",
      "active duty",
      "pre-discharge",
      "transition",
      "separation",
      "ets",
      "benefits delivery",
    ],
    icon: "🎖️",
    category: "Discovery",
  },
  {
    id: "workflow-guide",
    name: "Mission Roadmap",
    keywords: ["guide", "workflow", "mission", "steps"],
    icon: "🗺️",
    category: "Core",
  },
  {
    id: "user-manual",
    name: "User Manual",
    keywords: ["help", "manual", "instructions", "how to"],
    icon: "❓",
    category: "Support",
  },
];

// Same on/off classes for a selected vs. unselected result row, regardless
// of theme. Extracted to avoid a nested ternary in the render below.
function getResultButtonClasses(isSelected, isDarkTheme) {
  if (isSelected) {
    return isDarkTheme
      ? "bg-blue-900/50 text-blue-300"
      : "bg-blue-50 text-blue-900";
  }
  return isDarkTheme
    ? "hover:bg-gray-800 text-gray-300"
    : "hover:bg-slate-50 text-slate-700";
}

function CommandSearchInputBar({
  inputRef,
  query,
  onQueryChange,
  onKeyDown,
  isDark,
  isTbiComfort,
}) {
  return (
    <div
      className={`flex items-center gap-3 p-4 border-b ${isDark || isTbiComfort ? "border-gray-700" : "border-slate-200"}`}
    >
      <svg
        className={`w-5 h-5 ${isDark || isTbiComfort ? "text-gray-500" : "text-slate-400"}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search tools, conditions, or diagnostic codes (e.g., 5237)"
        className={`
          flex-1 bg-transparent text-lg outline-none
          ${isDark || isTbiComfort ? "text-white placeholder-gray-500" : "text-slate-900 placeholder-slate-400"}
        `}
        aria-label="Search query"
      />
      <kbd
        className={`hidden sm:inline-block px-2 py-1 text-xs font-mono rounded ${isDark || isTbiComfort ? "bg-gray-800 text-gray-400" : "bg-slate-100 text-slate-500"}`}
      >
        ESC
      </kbd>
    </div>
  );
}

function ToolResultsSection({
  tools,
  selectedIndex,
  isDark,
  isTbiComfort,
  onSelect,
}) {
  if (tools.length === 0) return null;

  return (
    <div className="p-2">
      <p
        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${isDark || isTbiComfort ? "text-gray-500" : "text-slate-400"}`}
      >
        Tools
      </p>
      {tools.map((tool, index) => (
        <button
          key={tool.id}
          onClick={() => onSelect(index)}
          className={`
            w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors
            ${getResultButtonClasses(index === selectedIndex, isDark || isTbiComfort)}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
          `}
        >
          <span className="text-2xl" aria-hidden="true">
            {tool.icon}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{tool.name}</p>
            <p
              className={`text-xs ${isDark || isTbiComfort ? "text-gray-500" : "text-slate-500"}`}
            >
              {tool.category}
            </p>
          </div>
          {index === selectedIndex && (
            <kbd
              className={`px-2 py-1 text-xs font-mono rounded ${isDark || isTbiComfort ? "bg-gray-700 text-gray-400" : "bg-slate-200 text-slate-500"}`}
            >
              ↵
            </kbd>
          )}
        </button>
      ))}
    </div>
  );
}

function ConditionResultsSection({
  conditions,
  toolsCount,
  selectedIndex,
  isDark,
  isTbiComfort,
  onSelect,
}) {
  if (conditions.length === 0) return null;

  return (
    <div className="p-2">
      <p
        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${isDark || isTbiComfort ? "text-gray-500" : "text-slate-400"}`}
      >
        Diagnostic Codes
      </p>
      {conditions.map((condition, idx) => {
        const index = toolsCount + idx;
        return (
          <button
            key={condition.code}
            onClick={() => onSelect(index)}
            className={`
              w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors
              ${getResultButtonClasses(index === selectedIndex, isDark || isTbiComfort)}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
            `}
          >
            <span
              className={`font-mono text-sm font-bold px-2 py-1 rounded ${isDark || isTbiComfort ? "bg-gray-800 text-amber-400" : "bg-amber-100 text-amber-800"}`}
            >
              {condition.code}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{condition.name}</p>
              <p
                className={`text-xs ${isDark || isTbiComfort ? "text-gray-500" : "text-slate-500"}`}
              >
                {condition.category}
              </p>
            </div>
            {index === selectedIndex && (
              <kbd
                className={`px-2 py-1 text-xs font-mono rounded ${isDark || isTbiComfort ? "bg-gray-700 text-gray-400" : "bg-slate-200 text-slate-500"}`}
              >
                ↵
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CommandSearchFooter({ isDark, isTbiComfort }) {
  return (
    <div
      className={`px-4 py-3 border-t ${isDark || isTbiComfort ? "border-gray-700 bg-gray-800/50" : "border-slate-200 bg-slate-50"}`}
    >
      <div className="flex items-center justify-between text-xs">
        <div
          className={`flex items-center gap-4 ${isDark || isTbiComfort ? "text-gray-500" : "text-slate-500"}`}
        >
          <span>
            <kbd className="font-mono">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> Select
          </span>
          <span>
            <kbd className="font-mono">ESC</kbd> Close
          </span>
        </div>
        <span
          className={`${isDark || isTbiComfort ? "text-gray-600" : "text-slate-400"}`}
        >
          Powered by Local Search
        </span>
      </div>
    </div>
  );
}

function _performCommandSearch(searchQuery, setResults, setSelectedIndex) {
  if (!searchQuery.trim()) {
    // Show popular tools when empty
    setResults({
      tools: TOOLS.slice(0, 6),
      conditions: [],
    });
    return;
  }

  const q = searchQuery.toLowerCase().trim();

  // Search tools
  const matchedTools = TOOLS.filter(
    (tool) =>
      tool.name.toLowerCase().includes(q) ||
      tool.keywords.some((kw) => kw.includes(q)) ||
      tool.category.toLowerCase().includes(q),
  ).slice(0, 5);

  // Search diagnostic codes (if it looks like a code number)
  let matchedConditions = [];
  if (/^\d+/.test(q)) {
    // Search by diagnostic code value (RT10-2: was Object.entries on array → keyed by index)
    matchedConditions = diagnosticCodes
      .filter((d) => d.code != null && String(d.code).startsWith(q))
      .map((d) => ({
        code: d.code,
        name: d.name || "Unknown",
        category: "Diagnostic Code",
      }))
      .slice(0, 5);
  } else {
    // Search by condition name
    matchedConditions = diagnosticCodes
      .filter((d) => {
        const name = (d.name || "").toLowerCase();
        const aliases = (d.aliases || []).join(" ").toLowerCase();
        const terms = (d.searchTerms || []).join(" ").toLowerCase();
        return name.includes(q) || aliases.includes(q) || terms.includes(q);
      })
      .map((d) => ({
        code: d.code,
        name: d.name || "Unknown",
        category: "Diagnostic Code",
      }))
      .slice(0, 5);
  }

  setResults({ tools: matchedTools, conditions: matchedConditions });
  setSelectedIndex(0);
}

function _selectSearchResult(
  index,
  results,
  onToolSelect,
  onConditionSelect,
  onClose,
) {
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
}

function _handleCommandSearchKeyDown(e, ctx) {
  const { results, selectedIndex, setSelectedIndex, onSelect } = ctx;
  const totalResults = results.tools.length + results.conditions.length;

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalResults));
      break;
    case "ArrowUp":
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + totalResults) % Math.max(1, totalResults),
      );
      break;
    case "Enter":
      e.preventDefault();
      onSelect(selectedIndex);
      break;
    // Escape is handled by useFocusTrap (onEscape) so it also closes the
    // palette when focus has moved off the input to a result row.
  }
}

function NoSearchResults({ isDark, isTbiComfort }) {
  return (
    <div
      className={`p-8 text-center ${isDark || isTbiComfort ? "text-gray-500" : "text-slate-400"}`}
    >
      <p className="text-lg">No results found</p>
      <p className="text-sm mt-1">
        Try searching for a tool name or diagnostic code
      </p>
    </div>
  );
}

function SearchResultsList({
  resultsRef,
  results,
  query,
  selectedIndex,
  isDark,
  isTbiComfort,
  onSelect,
}) {
  const isEmpty = results.tools.length === 0 && results.conditions.length === 0;

  return (
    <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto">
      <ToolResultsSection
        tools={results.tools}
        selectedIndex={selectedIndex}
        isDark={isDark}
        isTbiComfort={isTbiComfort}
        onSelect={onSelect}
      />

      <ConditionResultsSection
        conditions={results.conditions}
        toolsCount={results.tools.length}
        selectedIndex={selectedIndex}
        isDark={isDark}
        isTbiComfort={isTbiComfort}
        onSelect={onSelect}
      />

      {isEmpty && query && (
        <NoSearchResults isDark={isDark} isTbiComfort={isTbiComfort} />
      )}
    </div>
  );
}

function GlobalCommandSearchPalette({
  isDark,
  isTbiComfort,
  isAaaContrast,
  query,
  setQuery,
  results,
  selectedIndex,
  setSelectedIndex,
  inputRef,
  resultsRef,
  dialogRef,
  onClose,
  onToolSelect,
  onConditionSelect,
}) {
  const handleSelect = (index) => {
    _selectSearchResult(
      index,
      results,
      onToolSelect,
      onConditionSelect,
      onClose,
    );
  };

  const handleKeyDown = (e) => {
    _handleCommandSearchKeyDown(e, {
      results,
      selectedIndex,
      setSelectedIndex,
      onSelect: handleSelect,
    });
  };

  return (
    <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Search Modal */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        className={`
          relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden
          ${isDark || isTbiComfort ? "bg-gray-900 border border-gray-700" : "bg-white border border-slate-200"}
          ${isAaaContrast ? "border-2 border-white" : ""}
        `}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick search"
      >
        {/* Search Input */}
        <CommandSearchInputBar
          inputRef={inputRef}
          query={query}
          onQueryChange={setQuery}
          onKeyDown={handleKeyDown}
          isDark={isDark}
          isTbiComfort={isTbiComfort}
        />

        {/* Results */}
        <SearchResultsList
          resultsRef={resultsRef}
          results={results}
          query={query}
          selectedIndex={selectedIndex}
          isDark={isDark}
          isTbiComfort={isTbiComfort}
          onSelect={handleSelect}
        />

        {/* Footer */}
        <CommandSearchFooter isDark={isDark} isTbiComfort={isTbiComfort} />
      </div>
    </div>
  );
}

export default function GlobalCommandSearch({
  isOpen,
  onClose,
  onToolSelect,
  onConditionSelect,
}) {
  const { isDark, isTbiComfort, isAaaContrast } = useTheme();

  // Lock background scroll when modal is open
  useBodyScrollLock(isOpen);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ tools: [], conditions: [] });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const dialogRef = useRef(null);

  // Trap Tab focus inside the palette and restore it to the opener on close.
  // Declared before the input-focus effect below so it captures the opener as
  // the restore target. autoFocus is off — the effect below owns initial focus
  // (the search input); ESC routes through here so it works from any result row.
  useFocusTrap(dialogRef, {
    active: isOpen,
    autoFocus: false,
    onEscape: onClose,
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search function
  const performSearch = useCallback((searchQuery) => {
    _performCommandSearch(searchQuery, setResults, setSelectedIndex);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 150);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  if (!isOpen) return null;

  return (
    <GlobalCommandSearchPalette
      isDark={isDark}
      isTbiComfort={isTbiComfort}
      isAaaContrast={isAaaContrast}
      query={query}
      setQuery={setQuery}
      results={results}
      selectedIndex={selectedIndex}
      setSelectedIndex={setSelectedIndex}
      inputRef={inputRef}
      resultsRef={resultsRef}
      dialogRef={dialogRef}
      onClose={onClose}
      onToolSelect={onToolSelect}
      onConditionSelect={onConditionSelect}
    />
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
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}
