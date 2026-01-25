/**
 * SupplyLocker Diamond Swarm Integration
 * 💎 Client-side AI inference using specialized agents
 * 
 * This service replaces the old WebLLM integration with the Diamond Swarm
 * architecture - 3 specialized agents for VA claim processing.
 */

import {
  SWARM_AGENTS,
  getAgentForTool,
  initializeSwarm,
  switchAgent,
  generateWithSwarm,
  isSwarmReady,
  getCurrentAgent,
  unloadSwarm
} from '../utils/diamondSwarm';

class VetRateDiamondSwarm {
  constructor() {
    this.currentAgent = null;
    this.systemPrompt = `You are a Diamond Standard VA Claims Assistant helping veterans.
Your specialized training includes:
- 38 CFR regulations and diagnostic codes
- Secondary service connection under 38 CFR § 3.310
- Rating criteria and schedules per 38 CFR Part 4
- PACT Act presumptive conditions
- Bilateral factor calculations

Always cite specific regulations. Accuracy is paramount.`;
  }

  async initialize(agentId = 'auditor', onProgress) {
    try {
      await initializeSwarm(agentId, {
        onProgress: (status) => {
          if (onProgress) {
            onProgress({
              progress: status.progress / 100,
              text: status.message
            });
          }
          console.log(`💎 Loading: ${status.message}`);
        },
        onComplete: () => {
          this.currentAgent = agentId;
          console.log(`💎 Diamond Swarm initialized with ${agentId.toUpperCase()} agent`);
        },
        onError: (err) => {
          console.error('💎 Diamond Swarm initialization failed:', err);
        }
      });
      return true;
    } catch (error) {
      console.error('Diamond Swarm initialization error:', error);
      throw error;
    }
  }

  async switchToAgent(agentId) {
    await switchAgent(agentId);
    this.currentAgent = agentId;
    console.log(`💎 Switched to ${agentId.toUpperCase()} agent`);
  }

  async chat(userMessage, options = {}) {
    if (!isSwarmReady()) {
      throw new Error("Diamond Swarm not initialized. Call initialize() first.");
    }

    const {
      knowledgeContext = "",
      toolId = null,
      agentId = this.currentAgent || 'auditor'
    } = options;

    // Build enhanced prompt with knowledge context
    let enhancedPrompt = userMessage;
    if (knowledgeContext) {
      enhancedPrompt = `Relevant VA regulations:\n${knowledgeContext}\n\nUser question: ${userMessage}`;
    }

    const result = await generateWithSwarm(enhancedPrompt, {
      agentId: toolId ? getAgentForTool(toolId)?.id || agentId : agentId,
      toolId,
      systemPrompt: this.systemPrompt,
      maxTokens: 2048,
      temperature: 0.7
    });

    return result.text;
  }

  getAgentInfo(agentId) {
    return SWARM_AGENTS[agentId?.toUpperCase()];
  }

  getCurrentAgentInfo() {
    return this.getAgentInfo(this.currentAgent);
  }

  isReady() {
    return isSwarmReady();
  }

  async unload() {
    await unloadSwarm();
    this.currentAgent = null;
    console.log('💎 Diamond Swarm unloaded');
  }
}

// Singleton instance
const vetRateDiamondSwarm = new VetRateDiamondSwarm();

export default vetRateDiamondSwarm;
export { VetRateDiamondSwarm, SWARM_AGENTS };
