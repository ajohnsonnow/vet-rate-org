/**
 * Vet-Rate AI Assistant Hook
 * Provides RAG-based VA claims assistance
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// Singleton instance for the knowledge base
let knowledgeBase = null;
let loadingPromise = null;

async function loadKnowledgeBase() {
  if (knowledgeBase) return knowledgeBase;
  if (loadingPromise) return loadingPromise;
  
  loadingPromise = fetch('/data/vet_rate_knowledge.json')
    .then(res => res.json())
    .then(data => {
      knowledgeBase = data;
      console.log(`[VetRate AI] Loaded ${data.length} knowledge entries`);
      return data;
    })
    .catch(err => {
      console.error('[VetRate AI] Failed to load knowledge base:', err);
      knowledgeBase = [];
      return [];
    });
  
  return loadingPromise;
}

// Simple TF-IDF style matching
function findRelevant(query, kb, topK = 5) {
  const queryTerms = query.toLowerCase().split(/\s+/);
  
  const scored = kb.map(item => {
    const text = `${item.instruction || ''} ${item.output || ''}`.toLowerCase();
    let score = 0;
    
    for (const term of queryTerms) {
      if (text.includes(term)) {
        score += 1;
        // Boost for exact diagnostic code matches
        if (term.match(/^\d{4}$/) && text.includes(`dc ${term}`)) {
          score += 5;
        }
        // Boost for condition name matches
        if (term.length > 3 && text.includes(term)) {
          score += 0.5;
        }
      }
    }
    
    return { item, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.item);
}

export function useVetRateAI() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const kbRef = useRef(null);

  useEffect(() => {
    loadKnowledgeBase()
      .then(kb => {
        kbRef.current = kb;
        setIsReady(true);
      })
      .catch(err => {
        setError(err.message);
      });
  }, []);

  const ask = useCallback(async (question) => {
    if (!kbRef.current || kbRef.current.length === 0) {
      return {
        answer: "Knowledge base not loaded. Please try again.",
        sources: [],
        error: true
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      const relevant = findRelevant(question, kbRef.current, 5);
      
      if (relevant.length === 0) {
        setIsLoading(false);
        return {
          answer: "I couldn't find specific information about that. Try asking about:\n- Specific diagnostic codes (e.g., 'DC 9411 PTSD')\n- Secondary conditions (e.g., 'sleep apnea secondary to PTSD')\n- Rating criteria (e.g., 'rating criteria for tinnitus')",
          sources: [],
          suggestions: [
            "What is diagnostic code 9411?",
            "Can sleep apnea be secondary to PTSD?",
            "What are the rating criteria for tinnitus?",
            "Is hypertension presumptive under PACT Act?"
          ]
        };
      }

      // Combine relevant knowledge
      const answer = relevant.map(r => r.output).join('\n\n---\n\n');
      const sources = relevant.map(r => ({
        citation: r.metadata?.citation || 'VA Knowledge Base',
        source: r.metadata?.source || 'Unknown',
        type: r.metadata?.type || 'general'
      }));

      setIsLoading(false);
      return {
        answer,
        sources,
        matchCount: relevant.length
      };

    } catch (err) {
      setIsLoading(false);
      setError(err.message);
      return {
        answer: "An error occurred while searching the knowledge base.",
        sources: [],
        error: true
      };
    }
  }, []);

  const searchDiagnosticCode = useCallback((code) => {
    return ask(`diagnostic code ${code}`);
  }, [ask]);

  const searchSecondaryCondition = useCallback((primary, secondary) => {
    return ask(`${secondary} secondary to ${primary}`);
  }, [ask]);

  const searchRatingCriteria = useCallback((condition) => {
    return ask(`rating criteria for ${condition}`);
  }, [ask]);

  return {
    isReady,
    isLoading,
    error,
    ask,
    searchDiagnosticCode,
    searchSecondaryCondition,
    searchRatingCriteria,
    knowledgeCount: kbRef.current?.length || 0
  };
}

export default useVetRateAI;
