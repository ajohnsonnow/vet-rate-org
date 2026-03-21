/**
 * Vet-Rate WebLLM Integration
 * Client-side LLM inference using WebGPU
 */

import * as webllm from "@mlc-ai/web-llm";

class VetRateWebLLM {
  constructor() {
    this.engine = null;
    this.modelId = "Llama-3.2-3B-Instruct-q4f16_1-MLC";
    this.systemPrompt = `You are a VA Claims Assistant helping veterans understand their disability benefits.
You specialize in:
- 38 CFR regulations and diagnostic codes
- Secondary service connection under 38 CFR � 3.310
- Rating criteria and schedules
- PACT Act presumptive conditions

Always cite specific regulations when possible. Be accurate and helpful.`;
  }

  async initialize(onProgress) {
    this.engine = await webllm.CreateMLCEngine(this.modelId, {
      initProgressCallback:
        onProgress ||
        ((progress) => {
          console.log(`Loading: ${(progress.progress * 100).toFixed(1)}%`);
        }),
    });
    console.log("WebLLM engine initialized");
  }

  async chat(userMessage, knowledgeContext = "") {
    if (!this.engine) {
      throw new Error("Engine not initialized. Call initialize() first.");
    }

    const messages = [{ role: "system", content: this.systemPrompt }];

    if (knowledgeContext) {
      messages.push({
        role: "system",
        content: `Relevant VA regulations:\n${knowledgeContext}`,
      });
    }

    messages.push({ role: "user", content: userMessage });

    const response = await this.engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 512,
    });

    return response.choices[0].message.content;
  }

  async chatStream(userMessage, knowledgeContext = "", onChunk) {
    if (!this.engine) {
      throw new Error("Engine not initialized");
    }

    const messages = [{ role: "system", content: this.systemPrompt }];

    if (knowledgeContext) {
      messages.push({
        role: "system",
        content: `Relevant VA regulations:\n${knowledgeContext}`,
      });
    }

    messages.push({ role: "user", content: userMessage });

    const stream = await this.engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 512,
      stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullResponse += content;
      if (onChunk) onChunk(content);
    }

    return fullResponse;
  }
}

export default VetRateWebLLM;
