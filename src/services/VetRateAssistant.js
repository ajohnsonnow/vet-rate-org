/**
 * SupplyLocker Combined Assistant
 * RAG + WebLLM for best accuracy
 */

import VetRateRAG from "./VetRateRAG.js";
import VetRateWebLLM from "./VetRateWebLLM.js";

class VetRateAssistant {
  constructor() {
    this.rag = new VetRateRAG();
    this.llm = new VetRateWebLLM();
    this.useWebLLM = false; // Start with RAG only
  }

  async initialize(options = {}) {
    // Always load RAG (instant)
    await this.rag.loadKnowledgeBase();
    console.log("RAG knowledge base loaded");

    // Optionally load WebLLM (requires WebGPU)
    if (options.enableWebLLM !== false) {
      try {
        if (navigator.gpu) {
          await this.llm.initialize(options.onProgress);
          this.useWebLLM = true;
          console.log("WebLLM initialized with WebGPU");
        } else {
          console.log("WebGPU not available - using RAG only");
        }
      } catch (e) {
        console.warn("WebLLM init failed:", e);
      }
    }
  }

  async ask(question) {
    // Step 1: Find relevant knowledge with RAG
    const ragResult = await this.rag.answer(question);
    
    // Step 2: If WebLLM available, enhance with LLM
    if (this.useWebLLM && ragResult.sources.length > 0) {
      const context = ragResult.answer;
      const llmResponse = await this.llm.chat(question, context);
      
      return {
        answer: llmResponse,
        sources: ragResult.sources,
        method: "RAG + WebLLM"
      };
    }
    
    // Fallback to RAG only
    return {
      ...ragResult,
      method: "RAG only"
    };
  }
}

export default VetRateAssistant;
