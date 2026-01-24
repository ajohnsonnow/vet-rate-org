/**
 * Vet-Rate.org - AI Consistency Analyzer
 * "The Cross-Examination" - AI-powered contradiction detection
 * 
 * This component provides a "split view" interface where veterans can:
 * 1. Paste medical records/evidence on the left
 * 2. Paste their personal statement on the right
 * 3. Get AI-powered analysis of contradictions
 * 
 * Uses DiffHighlighter to visually show problem areas.
 * 
 * @author Vet-Rate.org Development Team
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { generateAI, isAnyAIAvailable } from '../utils/unifiedAIService';
import { CONSISTENCY_CHECK_PROMPT, SOLO_STATEMENT_ANALYSIS_PROMPT } from '../utils/consistencyPrompts';
import DiffHighlighter, { IssueCard } from './common/DiffHighlighter';
import RedditCopyButton from './common/RedditCopyButton';

/**
 * AIConsistencyAnalyzer - The Cross-Examination Tool
 */
const AIConsistencyAnalyzer = ({ onBack }) => {
  const [referenceText, setReferenceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('compare'); // 'compare' or 'solo'

  const aiAvailable = isAnyAIAvailable();

  /**
   * Run the AI consistency check
   */
  const runConsistencyCheck = async () => {
    if (mode === 'compare' && (!referenceText || !targetText)) {
      setError('Please provide both reference evidence and your statement.');
      return;
    }
    if (mode === 'solo' && !targetText) {
      setError('Please provide a statement to analyze.');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      // Select the right prompt based on mode
      const prompt = mode === 'compare' 
        ? CONSISTENCY_CHECK_PROMPT(referenceText, targetText)
        : SOLO_STATEMENT_ANALYSIS_PROMPT(targetText);

      const response = await generateAI(prompt, {
        systemPrompt: "You are a JSON-only output machine. Return ONLY valid JSON, no markdown, no explanation.",
        taskType: 'analysis',
        maxTokens: 2000,
        temperature: 0.2 // Low temp for consistent structured output
      });

      // Extract text from response (handle both string and object returns)
      const responseText = typeof response === 'object' ? response.text : response;
      
      // Parse the JSON response
      // Try to extract JSON from the response (handle potential markdown wrapping)
      let jsonText = responseText;
      
      // Remove markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }
      
      // Find JSON object in the text
      const startIdx = jsonText.indexOf('{');
      const endIdx = jsonText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonText = jsonText.substring(startIdx, endIdx + 1);
      }

      const result = JSON.parse(jsonText);
      setAnalysis(result);
      
    } catch (err) {
      console.error("AI Consistency Check Failed:", err);
      setError(`Analysis failed: ${err.message}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get score color based on credibility/alignment score
   */
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  /**
   * Get score label
   */
  const getScoreLabel = (score) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Fair';
    if (score >= 50) return 'Needs Work';
    return 'Critical Issues';
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span className="text-4xl">🔍</span>
              AI Cross-Examination
              <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded">AI BETA</span>
            </h1>
            <p className="text-gray-400 mt-2">
              The "Red Team" for your story. Find contradictions before the VA does.
            </p>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              ← Back to Rules Check
            </button>
          )}
        </div>
      </header>

      {/* AI Availability Warning */}
      {!aiAvailable && (
        <div className="bg-yellow-900/30 border border-yellow-600 text-yellow-200 p-4 rounded-lg">
          <p className="font-bold">⚠️ AI Not Available</p>
          <p className="text-sm mt-1">
            Please configure Cloud AI (Gemini) or initialize Local AI to use this feature.
          </p>
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setMode('compare')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            mode === 'compare' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          📋 Compare Mode
          <span className="block text-xs font-normal opacity-75">Evidence vs Statement</span>
        </button>
        <button
          onClick={() => setMode('solo')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            mode === 'solo' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          📝 Solo Mode
          <span className="block text-xs font-normal opacity-75">Statement Only</span>
        </button>
      </div>

      {/* Input Area */}
      <div className={`grid ${mode === 'compare' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-6`}>
        {/* Left: Reference Evidence (Compare mode only) */}
        {mode === 'compare' && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-blue-400 uppercase tracking-wide">
              📄 Reference Evidence
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Paste medical records, C-File extracts, or service documents here.
            </p>
            <textarea
              className="w-full h-64 bg-gray-900 border border-blue-900/50 rounded-lg p-4 text-sm text-gray-300 placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Example: 'MRI of Lumbar Spine (2024): Mild DDD at L4-L5, no radiculopathy noted. Patient ambulates with normal gait...'"
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        {/* Right: Target Statement */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-orange-400 uppercase tracking-wide">
            📝 Your Statement Draft
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Paste the personal statement or nexus letter you're working on.
          </p>
          <textarea
            className={`w-full ${mode === 'solo' ? 'h-48' : 'h-64'} bg-gray-900 border border-orange-900/50 rounded-lg p-4 text-sm text-gray-300 placeholder-gray-600 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none`}
            placeholder="Example: 'My back pain is severe and constant. It radiates down both legs every single day, preventing me from any physical activity...'"
            value={targetText}
            onChange={(e) => setTargetText(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/30 border border-red-600 text-red-200 p-4 rounded-lg">
          <p>{error}</p>
        </div>
      )}

      {/* Action Button */}
      <div className="flex justify-center">
        <button
          onClick={runConsistencyCheck}
          disabled={loading || !aiAvailable || (mode === 'compare' ? (!referenceText || !targetText) : !targetText)}
          className={`
            px-8 py-3 rounded-full font-bold text-lg transition-all shadow-lg
            ${loading 
              ? 'bg-gray-700 cursor-wait' 
              : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white transform hover:scale-105'
            }
            ${(!aiAvailable || (mode === 'compare' ? (!referenceText || !targetText) : !targetText)) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⚙️</span>
              Running Cross-Examination...
            </span>
          ) : (
            '🔍 Analyze Consistency'
          )}
        </button>
      </div>

      {/* Results Dashboard */}
      {analysis && (
        <div className="mt-8 space-y-6">
          {/* Score Header */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <div className="bg-gray-900 p-6 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">
                {mode === 'compare' ? '🎯 Cross-Examination Results' : '📊 Statement Analysis'}
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-sm text-gray-400">
                    {mode === 'compare' ? 'Credibility Score' : 'Quality Score'}
                  </span>
                  <div className={`text-3xl font-black ${getScoreColor(analysis.credibility_score || analysis.score || 0)}`}>
                    {analysis.credibility_score || analysis.score || 0}/100
                  </div>
                  <span className="text-xs text-gray-500">
                    {getScoreLabel(analysis.credibility_score || analysis.score || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Diff + Issue Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              {/* Left: Visual Diff */}
              <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                <div className="bg-gray-800 p-4 border-b border-gray-700">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <span>📝</span> Text Forensics
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Hover over highlighted sections to see why they were flagged.
                  </p>
                </div>
                <div className="p-6 bg-black/20 max-h-[600px] overflow-y-auto">
                  <DiffHighlighter 
                    text={targetText} 
                    issues={analysis.issues || []} 
                  />
                </div>
              </div>

              {/* Right: Issue Cards */}
              <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <span>⚠️</span> Issues Found ({analysis.issues?.length || 0})
                  </h3>
                  {analysis.issues?.length > 0 && (
                    <RedditCopyButton 
                      textContent={formatIssuesForReddit(analysis)}
                      variant="compact"
                    />
                  )}
                </div>
                <div className="p-4 max-h-[600px] overflow-y-auto space-y-4">
                  {(!analysis.issues || analysis.issues.length === 0) ? (
                    <div className="text-center py-8 text-green-400">
                      <p className="text-4xl mb-2">✅</p>
                      <p className="text-lg font-semibold">No issues detected!</p>
                      <p className="text-sm text-gray-400 mt-2">
                        Your statement appears consistent with the evidence.
                      </p>
                    </div>
                  ) : (
                    analysis.issues.map((issue, idx) => (
                      <IssueCard key={idx} issue={issue} index={idx} />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Strengths (Solo mode) */}
            {mode === 'solo' && analysis.strengths && analysis.strengths.length > 0 && (
              <div className="p-6 border-t border-gray-700">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <span>💪</span> Strengths
                </h3>
                <ul className="space-y-2">
                  {analysis.strengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-green-300 text-sm">
                      <span>✓</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Tips Box */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-6">
            <h4 className="font-bold text-blue-300 mb-3 flex items-center gap-2">
              <span>💡</span> Why This Matters
            </h4>
            <ul className="text-sm text-blue-200 space-y-2">
              <li>• VA raters are trained to find <strong>credibility issues</strong> as grounds for denial</li>
              <li>• Inconsistencies between your statement and medical records are automatic red flags</li>
              <li>• Words like "always" and "never" are hard to prove and invite scrutiny</li>
              <li>• Fix these issues <strong>before</strong> submission to strengthen your claim</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Format analysis results for Reddit sharing
 */
function formatIssuesForReddit(analysis) {
  const score = analysis.credibility_score || analysis.score || 0;
  let text = `**Consistency Check Results: ${score}/100**\n\n`;
  
  if (!analysis.issues || analysis.issues.length === 0) {
    text += '✅ No issues found! Statement appears internally consistent.\n';
    return text;
  }
  
  text += `Found **${analysis.issues.length}** potential issues:\n\n`;
  
  analysis.issues.forEach((issue, idx) => {
    text += `**${idx + 1}. ${issue.type}** (${issue.severity})\n`;
    if (issue.quote_target) {
      text += `> "${issue.quote_target}"\n`;
    }
    if (issue.explanation) {
      text += `${issue.explanation}\n`;
    }
    if (issue.fix_suggestion) {
      text += `💡 *Fix: ${issue.fix_suggestion}*\n`;
    }
    text += '\n';
  });
  
  text += '*Analyzed using Vet-Rate.org Consistency Engine*';
  return text;
}

export default AIConsistencyAnalyzer;
