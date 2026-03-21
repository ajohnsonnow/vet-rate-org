/**
 * Vet-Rate RAG (Retrieval-Augmented Generation) Integration
 * Uses existing knowledge base for instant VA claims assistance
 */

class VetRateRAG {
  constructor() {
    this.knowledgeBase = null;
    this.embeddings = new Map();
  }

  async loadKnowledgeBase() {
    // Load from training data
    const response = await fetch("/data/vet_rate_knowledge.json");
    this.knowledgeBase = await response.json();
    console.log(`Loaded ${this.knowledgeBase.length} knowledge entries`);
  }

  // Simple TF-IDF style matching
  findRelevant(query, topK = 5) {
    const queryTerms = query.toLowerCase().split(/\s+/);

    const scored = this.knowledgeBase.map((item) => {
      const text = `${item.instruction} ${item.output}`.toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        if (text.includes(term)) {
          score += 1;
          // Boost for exact diagnostic code matches
          if (term.match(/^\d{4}$/) && text.includes(`dc ${term}`)) {
            score += 5;
          }
        }
      }

      return { item, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.item);
  }

  async answer(query) {
    const relevant = this.findRelevant(query);

    if (relevant.length === 0) {
      return {
        answer:
          "I couldn't find specific information. Please try rephrasing your question about VA disability claims.",
        sources: [],
      };
    }

    // Combine relevant knowledge
    const context = relevant.map((r) => r.output).join("\n\n");

    return {
      answer: context,
      sources: relevant.map((r) => ({
        citation: r.metadata?.citation || "VA Knowledge Base",
        source: r.metadata?.source || "Unknown",
      })),
    };
  }
}

export default VetRateRAG;
