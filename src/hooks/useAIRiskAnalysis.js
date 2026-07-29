/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * AI Strategic Analysis hook for the "Poke the Bear" Risk Assessment tool.
 * Owns the AI status/analysis/error state, the AI-status polling effect, and
 * the async call that turns a computed risk assessment into AI strategic
 * advice. Extracted from RiskAssessment.jsx to keep the component focused on
 * rendering.
 */

import { useState, useEffect } from "react";
import {
  generateAI,
  isAnyAIAvailable,
  getAIStatus,
} from "../utils/unifiedAIService";
import { getVeteranAIContext } from "../utils/veteranContextProvider";

function buildRiskAnalysisPrompt({
  contextBlock,
  currentRating,
  ratingDate,
  riskAssessment,
  isPermanentTotal,
  currentConditions,
  proposedClaim,
}) {
  return `You are a VA disability claims expert analyzing the risk of a veteran filing a new claim. Analyze this situation and provide strategic advice.
${contextBlock}

VETERAN'S SITUATION:
- Current Combined Rating: ${currentRating}%
- Rating Effective Date: ${ratingDate}
- Years Rated: ${riskAssessment.yearsRated.toFixed(1)} years
- Permanent & Total (P&T): ${isPermanentTotal ? "Yes" : "No"}
- Age: ${riskAssessment.age || "Not provided"}
- Current Rated Conditions: ${currentConditions || "Not specified"}
- Proposed New Claim: ${proposedClaim || "Not specified"}

LEGAL PROTECTIONS IDENTIFIED:
${riskAssessment.protections.map((p) => `- ${p.rule.name}: ${p.message}`).join("\n") || "None identified"}

WARNINGS:
${riskAssessment.warnings.map((w) => `- ${w.severity}: ${w.message}`).join("\n") || "None"}

RULES TO CONSIDER:
- 5-Year Rule (38 CFR § 3.344(c)): Ratings under 5 years not stabilized
- 10-Year Rule (38 CFR § 3.957): Service connection protected after 10 years
- 20-Year Rule (38 CFR § 3.951(b)): Ratings cannot be reduced after 20 years
- P&T: Filing can trigger review of ALL conditions
- 55+ Age: Generally exempt from routine exams

Please provide:
1. A risk summary (2-3 sentences)
2. Specific strategic recommendations (3-5 bullet points)
3. If a new claim is proposed, potential secondary conditions or angles to strengthen it
4. Any timing considerations (should they wait?)

Respond in this JSON format:
{
  "riskSummary": "Your summary here",
  "recommendations": ["Rec 1", "Rec 2", "Rec 3"],
  "strengthenClaim": ["Angle 1", "Angle 2"],
  "timingAdvice": "Advice about timing",
  "overallVerdict": "PROCEED" | "CAUTION" | "WAIT" | "DO NOT FILE"
}`;
}

function extractJSONBlock(textStr) {
  const firstBrace = textStr.indexOf("{");
  const lastBrace = textStr.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) return null;
  return textStr.slice(firstBrace, lastBrace + 1);
}

export function useAIRiskAnalysis({
  currentRating,
  ratingDate,
  isPermanentTotal,
  currentConditions,
  proposedClaim,
  riskAssessment,
}) {
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  const [aiAnalysis, setAIAnalysis] = useState(null);
  const [isAnalyzingWithAI, setIsAnalyzingWithAI] = useState(false);
  const [aiError, setAIError] = useState(null);

  // Monitor AI status changes
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Generate AI risk analysis
   */
  const generateAIRiskAnalysis = async () => {
    if (!isAnyAIAvailable()) {
      setAIError(
        "AI is not available. Please configure your API key in settings.",
      );
      return;
    }

    setIsAnalyzingWithAI(true);
    setAIError(null);

    // Load veteran context for better risk analysis
    const veteranContext = await getVeteranAIContext({
      maxPacketTokens: 500,
    }).catch(() => "");
    const contextBlock = veteranContext
      ? `\nVETERAN CASE DATA (use for comprehensive risk assessment):\n${veteranContext}\n`
      : "";

    const prompt = buildRiskAnalysisPrompt({
      contextBlock,
      currentRating,
      ratingDate,
      riskAssessment,
      isPermanentTotal,
      currentConditions,
      proposedClaim,
    });

    try {
      const response = await generateAI(prompt, {
        temperature: 0.4,
        maxTokens: 1024,
        expectJSON: true,
      });

      // generateAI returns { text, mode } object - extract the text content
      const aiText = response?.text || response;
      const textStr =
        typeof aiText === "string" ? aiText : JSON.stringify(aiText);

      // Extract JSON from response
      const jsonBlock = extractJSONBlock(textStr);
      if (jsonBlock) {
        const analysis = JSON.parse(jsonBlock);
        setAIAnalysis(analysis);
      } else {
        throw new Error("Could not parse AI response");
      }
    } catch (err) {
      console.error("AI analysis error:", err);
      setAIError("Failed to generate AI analysis. Please try again.");
    } finally {
      setIsAnalyzingWithAI(false);
    }
  };

  return {
    aiStatus,
    aiAnalysis,
    isAnalyzingWithAI,
    aiError,
    generateAIRiskAnalysis,
    setAIAnalysis,
    setAIError,
  };
}

export default useAIRiskAnalysis;
