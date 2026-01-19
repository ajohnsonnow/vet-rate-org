/**
 * Vet-Rate.org - The Diplomat (Tone & Sentiment Analysis)
 * 
 * Helps veterans write clinical, objective statements instead of emotional ones.
 * Analyzes personal statements for hostile/subjective language and suggests
 * professional rewrites that are more likely to resonate with VA raters.
 * 
 * Built by a fellow veteran. "Clinical facts, not rage."
 */

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Check, Lightbulb, Brain } from 'lucide-react';

// The Diplomat's AI System Prompt
const TONE_ANALYSIS_PROMPT = `You are a clinical writing coach helping veterans write effective VA disability statements.

Your job is to identify emotional, hostile, or subjective language that could harm their claim and rewrite it professionally.

**RULES:**
1. Look for emotional/hostile language (anger, sarcasm, accusations, profanity)
2. Look for subjective/vague statements ("terrible", "horrible", "always", "never")
3. Look for VA criticism or blame language
4. Rewrite sentences to be:
   - Clinical and objective
   - Factual with measurable details
   - Professional but not cold
   - Focused on symptoms and impacts, not emotions

**INPUT FORMAT:**
You will receive a personal statement text.

**OUTPUT FORMAT:**
Return ONLY valid JSON (no markdown, no code fences). If NO issues found, return empty array.
If issues found, return array of objects:

[
  {
    "original": "exact sentence from their text",
    "rewrite": "clinical version",
    "reason": "short explanation (1 sentence)",
    "severity": "high|medium|low"
  }
]

**EXAMPLES:**

Original: "The VA is a joke and they ignored me for years!"
Rewrite: "I have experienced significant delays in receiving medical care, which has exacerbated my condition."
Reason: "Removes hostility; focuses on factual impact"
Severity: "high"

Original: "My back hurts like hell every single day."
Rewrite: "I experience chronic daily lumbar pain with an intensity of 7-8/10 on most days."
Reason: "Replaces subjective language with clinical description"
Severity: "medium"

Original: "I can't do anything anymore because of this."
Rewrite: "My condition limits my ability to perform daily activities including [specific examples]."
Reason: "Changes vague statement to specific, measurable impact"
Severity: "low"

Now analyze this statement:`;

const StatementAnalyzer = ({ text, onApplySuggestion, className = '' }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [appliedIndices, setAppliedIndices] = useState(new Set());
  const debounceTimer = useRef(null);
  const lastAnalyzedText = useRef('');

  // Auto-analyze after 2 seconds of inactivity
  useEffect(() => {
    // Don't analyze empty text or unchanged text
    if (!text || text.trim().length < 20 || text === lastAnalyzedText.current) {
      return;
    }

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      analyzeStatement();
    }, 2000);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [text]);

  const analyzeStatement = async () => {
    // Check if AI is available
    const apiKey = getApiKey();
    if (!apiKey) {
      return; // Silently skip if no API key
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: TONE_ANALYSIS_PROMPT + '\n\n' + text
              }]
            }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2000,
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to analyze statement');
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse the AI response (should be JSON)
      let parsedSuggestions = [];
      try {
        // Remove markdown code fences if present
        const cleanedResponse = aiResponse
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        parsedSuggestions = JSON.parse(cleanedResponse);
        
        // Ensure it's an array
        if (!Array.isArray(parsedSuggestions)) {
          parsedSuggestions = [];
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        parsedSuggestions = [];
      }

      setSuggestions(parsedSuggestions);
      lastAnalyzedText.current = text;
      setAppliedIndices(new Set()); // Reset applied tracking when new analysis

    } catch (err) {
      console.error('Tone analysis error:', err);
      setError('Could not analyze statement. Check your internet connection.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplySuggestion = (suggestion, index) => {
    if (onApplySuggestion) {
      onApplySuggestion(suggestion.original, suggestion.rewrite);
      
      // Mark as applied
      setAppliedIndices(prev => new Set([...prev, index]));
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-300 text-red-900';
      case 'medium':
        return 'bg-yellow-50 border-yellow-300 text-yellow-900';
      case 'low':
        return 'bg-blue-50 border-blue-300 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-300 text-gray-900';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'medium':
        return <Lightbulb className="w-4 h-4 text-yellow-600" />;
      case 'low':
        return <Brain className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  // Get API key from localStorage (BYOK)
  const getApiKey = () => {
    return localStorage.getItem('vetrate_gemini_key') || 
           import.meta.env.VITE_GEMINI_API_KEY || '';
  };

  // Don't show component if no API key
  if (!getApiKey()) {
    return null;
  }

  return (
    <div className={`statement-analyzer ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">The Diplomat</h3>
          {isAnalyzing && (
            <span className="text-sm text-gray-500 italic">Analyzing tone...</span>
          )}
        </div>
        {suggestions.length > 0 && (
          <span className="text-sm text-gray-600">
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} found
          </span>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`border rounded-lg p-4 transition-all ${
                appliedIndices.has(index)
                  ? 'bg-green-50 border-green-300 opacity-60'
                  : getSeverityColor(suggestion.severity)
              }`}
            >
              {/* Header with severity */}
              <div className="flex items-start gap-2 mb-2">
                {getSeverityIcon(suggestion.severity)}
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-70">
                    {appliedIndices.has(index) ? 'Applied' : 'Suggestion'}
                  </p>
                </div>
                {appliedIndices.has(index) && (
                  <Check className="w-5 h-5 text-green-600" />
                )}
              </div>

              {/* Original text */}
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  Original:
                </p>
                <p className="text-sm font-mono bg-white bg-opacity-50 p-2 rounded border border-current border-opacity-20">
                  {suggestion.original}
                </p>
              </div>

              {/* Suggested rewrite */}
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  Clinical Version:
                </p>
                <p className="text-sm font-mono bg-white bg-opacity-50 p-2 rounded border border-current border-opacity-20">
                  {suggestion.rewrite}
                </p>
              </div>

              {/* Reason */}
              <div className="mb-3">
                <p className="text-xs italic opacity-80">
                  <strong>Why:</strong> {suggestion.reason}
                </p>
              </div>

              {/* Apply button */}
              {!appliedIndices.has(index) && (
                <button
                  onClick={() => handleApplySuggestion(suggestion, index)}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 px-4 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold text-sm shadow-md hover:shadow-lg"
                >
                  Apply This Change
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No Issues Found */}
      {!isAnalyzing && suggestions.length === 0 && text && text.length > 20 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <p className="text-sm text-green-800 font-semibold">
            Statement looks professional
          </p>
          <p className="text-xs text-green-700 mt-1">
            No tone issues detected. Your statement is clinical and objective.
          </p>
        </div>
      )}

      {/* Helper text */}
      {!isAnalyzing && suggestions.length === 0 && (!text || text.length < 20) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>The Diplomat</strong> helps you write clinical, professional statements
            that resonate with VA raters. Start typing your statement, and I'll analyze
            the tone automatically.
          </p>
          <p className="text-xs text-blue-700 mt-2">
            💡 Tip: Avoid emotional language. Focus on facts, measurements, and specific impacts.
          </p>
        </div>
      )}
    </div>
  );
};

export default StatementAnalyzer;
