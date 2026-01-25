/**
 * SupplyLocker AI Assistant Hook
 * 💎 DIAMOND Knowledge Base (DKB) - Official sources only
 * CKB (Community) is NOT loaded here - not approved for training
 * Provides RAG-based VA claims assistance with official sources only
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// Singleton instance for the knowledge base (DKB only)
let knowledgeBase = null;
let loadingPromise = null;
let kbMetadata = null;

// Source color mapping for UI display (DKB sources only)
const SOURCE_COLORS = {
  'eCFR_OFFICIAL': { color: 'text-red-400', bg: 'bg-red-900/30', label: '38 CFR' },
  'FEDERAL_REGISTER_OFFICIAL': { color: 'text-orange-400', bg: 'bg-orange-900/30', label: 'Fed Register' },
  'OGC_PRECEDENT_OPINION': { color: 'text-purple-400', bg: 'bg-purple-900/30', label: 'OGC Opinion' },
  'BVA_DECISIONS': { color: 'text-purple-400', bg: 'bg-purple-900/30', label: 'BVA' },
  'BVA_REPORTS_OFFICIAL': { color: 'text-purple-400', bg: 'bg-purple-900/30', label: 'BVA Reports' },
  'M21-1_OFFICIAL': { color: 'text-blue-400', bg: 'bg-blue-900/30', label: 'M21-1' },
  'PACT_ACT_OFFICIAL': { color: 'text-green-400', bg: 'bg-green-900/30', label: 'PACT Act' },
  'VA_OFFICIAL': { color: 'text-slate-400', bg: 'bg-slate-700/50', label: 'VA Official' },
  'SECONDARY_CONDITIONS_MATRIX': { color: 'text-cyan-400', bg: 'bg-cyan-900/30', label: 'Secondary' },
  'EAJA_STATISTICS_OFFICIAL': { color: 'text-yellow-400', bg: 'bg-yellow-900/30', label: 'EAJA Stats' },
  // NOTE: COMMUNITY_PROVIDED is NOT included - CKB is separate and not for training
};

async function loadKnowledgeBase() {
  if (knowledgeBase) return knowledgeBase;
  if (loadingPromise) return loadingPromise;
  
  // Load DKB only (official sources) - CKB is NOT loaded for AI training
  loadingPromise = fetch('/data/vet_rate_knowledge.json')
    .then(res => res.json())
    .then(data => {
      // Filter to ensure only DKB sources (no community content)
      knowledgeBase = data.filter(entry => {
        const source = entry.metadata?.source || '';
        // Exclude community sources - only official DKB sources allowed
        return source !== 'COMMUNITY_PROVIDED';
      });
      
      // Calculate metadata
      const sourceCounts = {};
      const typeCounts = {};
      knowledgeBase.forEach(entry => {
        const source = entry.metadata?.source || 'Unknown';
        const type = entry.metadata?.type || 'general';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
      
      kbMetadata = {
        total: knowledgeBase.length,
        sources: sourceCounts,
        types: typeCounts,
        status: 'DIAMOND',
        ckbSeparate: true, // CKB is separate and not used for AI
        bvaApiPending: true // BVA full data awaiting API token
      };
      
      console.log(`[VetRate AI] 💎 DKB Loaded: ${knowledgeBase.length} official entries`);
      console.log(`[VetRate AI] Sources:`, Object.entries(sourceCounts).map(([k,v]) => `${k}: ${v}`).join(', '));
      console.log(`[VetRate AI] ⚠️ CKB (Community) is separate - not loaded for AI training`);
      return knowledgeBase;
    })
    .catch(err => {
      console.error('[VetRate AI] Failed to load knowledge base:', err);
      knowledgeBase = [];
      return [];
    });
  
  return loadingPromise;
}

// Enhanced TF-IDF style matching with source boosting
function findRelevant(query, kb, topK = 7) {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const queryLower = query.toLowerCase();
  
  // Check for specific query types
  const isSecondaryQuery = queryLower.includes('secondary') || queryLower.includes('nexus');
  const isPresumptiveQuery = queryLower.includes('presumptive') || queryLower.includes('pact');
  const isOGCQuery = queryLower.includes('ogc') || queryLower.includes('precedent') || queryLower.includes('opinion');
  
  const scored = kb.map(item => {
    const text = `${item.instruction || ''} ${item.output || ''} ${item.title || ''} ${item.content || ''}`.toLowerCase();
    const source = item.metadata?.source || '';
    const type = item.metadata?.type || '';
    let score = 0;
    
    for (const term of queryTerms) {
      if (text.includes(term)) {
        score += 1;
        // Boost for exact diagnostic code matches
        if (term.match(/^\d{4}$/) && (text.includes(`dc ${term}`) || text.includes(`code ${term}`))) {
          score += 5;
        }
        // Boost for condition name matches
        if (term.length > 3 && text.includes(term)) {
          score += 0.5;
        }
      }
    }
    
    // Boost official sources
    if (source.includes('OFFICIAL') || source.includes('eCFR')) score *= 1.2;
    if (source === 'OGC_PRECEDENT_OPINION') score *= 1.3;
    
    // Context-specific boosting
    if (isSecondaryQuery && (source === 'SECONDARY_CONDITIONS_MATRIX' || type.includes('secondary'))) {
      score *= 2;
    }
    if (isPresumptiveQuery && (source === 'PACT_ACT_OFFICIAL' || type.includes('presumptive'))) {
      score *= 2;
    }
    if (isOGCQuery && source === 'OGC_PRECEDENT_OPINION') {
      score *= 2;
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
  const [metadata, setMetadata] = useState(null);
  const kbRef = useRef(null);

  useEffect(() => {
    loadKnowledgeBase()
      .then(kb => {
        kbRef.current = kb;
        setMetadata(kbMetadata);
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
      const relevant = findRelevant(question, kbRef.current, 7);
      
      if (relevant.length === 0) {
        setIsLoading(false);
        return {
          answer: "I couldn't find specific information about that. Try asking about:\n- Specific diagnostic codes (e.g., 'DC 9411 PTSD')\n- Secondary conditions (e.g., 'sleep apnea secondary to PTSD')\n- Rating criteria (e.g., 'rating criteria for tinnitus')\n- OGC precedent opinions (e.g., 'OGC opinion on TDIU')\n- Presumptive conditions (e.g., 'PACT Act conditions')",
          sources: [],
          suggestions: [
            "What is diagnostic code 9411?",
            "Can sleep apnea be secondary to PTSD?",
            "What are the rating criteria for tinnitus?",
            "Is hypertension presumptive under PACT Act?",
            "What is OGC precedent opinion on secondary connection?",
            "What conditions are secondary to diabetes?"
          ]
        };
      }

      // Combine relevant knowledge - use content OR output field
      const answer = relevant.map(r => r.output || r.content || '').filter(Boolean).join('\n\n---\n\n');
      const sources = relevant.map(r => ({
        citation: r.metadata?.citation || r.title || 'VA Knowledge Base',
        source: r.metadata?.source || 'Unknown',
        type: r.metadata?.type || 'general',
        sourceInfo: SOURCE_COLORS[r.metadata?.source] || { color: 'text-slate-400', bg: 'bg-slate-700/50', label: 'VA' }
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

  const searchOGCOpinion = useCallback((topic) => {
    return ask(`OGC precedent opinion ${topic}`);
  }, [ask]);

  const searchPresumptive = useCallback((condition) => {
    return ask(`presumptive ${condition} PACT Act`);
  }, [ask]);

  return {
    isReady,
    isLoading,
    error,
    ask,
    searchDiagnosticCode,
    searchSecondaryCondition,
    searchRatingCriteria,
    searchOGCOpinion,
    searchPresumptive,
    knowledgeCount: kbRef.current?.length || 0,
    metadata,
    sourceColors: SOURCE_COLORS,
    isDiamond: true, // Diamond KB status
    bvaApiPending: true // BVA full decisions pending API token
  };
}

export default useVetRateAI;
