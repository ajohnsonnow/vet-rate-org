/**
 * AI-Powered Funding Message Generator
 * "The Gratitude Engine" - Generates kind, contextual funding messages
 * 
 * When AI is available (Local or Gemini), generates personalized,
 * heartfelt messages based on what the user just accomplished.
 * Falls back to static messages when AI isn't available.
 * 
 * Philosophy: Be grateful, specific, and never guilt-trip. Focus on
 * what the tool helped them accomplish, not what we need.
 */

import { isAnyAIAvailable, getAIMode, AI_MODES, generateAI } from './unifiedAIService';

// Cache for generated messages to avoid repeated AI calls
const messageCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Lightweight prompt for generating funding messages
const FUNDING_MESSAGE_PROMPT = `You are writing a brief, kind funding message for Vet-Rate.org, a free tool built by a veteran developer to help fellow veterans with their VA disability claims.

Context about what the user just did:
{{CONTEXT}}

Generate a SHORT (2-3 sentences max) message that:
1. Celebrates what they accomplished with the tool
2. Is warm, grateful, and genuinely kind - never guilt-trippy
3. Mentions that "$5 or $10 helps keep this free" in a natural way
4. Uses a conversational, veteran-to-veteran tone
5. Never uses phrases like "please donate" or "we need your help"

Good examples of tone:
- "You just saved hours of research. A coffee-sized donation ($5-10) helps keep this free for the next veteran."
- "That's real progress on your claim. If this helped, $5 or $10 keeps Luna happy and Midnight powered for more features."

Context: Luna is the developer's dog who loves treats and toys. Midnight is the developer's computer used for all coding work.

Bad examples (avoid):
- "Please consider donating to support our mission"
- "We desperately need your help to continue"
- "Without your donation, this tool may not exist"

Respond with ONLY the message text, nothing else.`;

/**
 * Context descriptions for different triggers
 */
const CONTEXT_TEMPLATES = {
  'search': (ctx) => `User searched for VA disability information${ctx.query ? ` about "${ctx.query}"` : ''} and found ${ctx.count || 'relevant'} results. This research would have taken hours manually.`,
  
  'secondary-scout': (ctx) => `User discovered ${ctx.count || 'potential'} secondary conditions they can claim. A claims consultant charges $100+ for this same research.`,
  
  'cap-sim': (ctx) => `User completed C&P exam preparation${ctx.conditionName ? ` for ${ctx.conditionName}` : ''}${ctx.rating ? ` (potential ${ctx.rating}% rating)` : ''}. Walking into the exam prepared could mean hundreds more per month in benefits.`,
  
  'cap-sim-complete': (ctx) => `User finished a full C&P exam simulation${ctx.conditionName ? ` for ${ctx.conditionName}` : ''}${ctx.score ? ` with ${ctx.score}% confidence` : ''}. This exam prep most veterans never get.`,
  
  'packet': (ctx) => `User organized ${ctx.count || 'their'} claim${ctx.count > 1 ? 's' : ''} in their packet. No VSO fees, no lawyer cuts, no data sold.`,
  
  'pdf': (ctx) => `User downloaded a comprehensive PDF guide${ctx.conditionName ? ` for ${ctx.conditionName}` : ''}. These reports take significant resources to create and host.`,
  
  'save': (ctx) => `User saved evidence to their claim packet. Their data stays 100% private on their device.`,
  
  'nexus': (ctx) => `User generated a nexus letter template${ctx.conditionName ? ` for ${ctx.conditionName}` : ''}. This template would cost $50-100 from a paid service.`,
  
  'export': (ctx) => `User created a secure backup of ${ctx.count || 'their'} claim${ctx.count > 1 ? 's' : ''}. No cloud fees, no subscriptions.`,
  
  'million-dollar': (ctx) => `User discovered their VA rating is worth ${ctx.total || 'hundreds of thousands'} lifetime. Most veterans never realize they're fighting for this much.`,
  
  'dbq-library': (ctx) => {
    if (ctx.action === 'bulk-download') {
      return `User downloaded ${ctx.count || 'all'} official VA DBQ forms for offline access. No internet needed at their doctor's office.`;
    } else if (ctx.action === 'pre-fill') {
      return `User pre-filled their subjective information${ctx.formName ? ` on ${ctx.formName}` : ''} for a doctor visit. Walking in prepared means better documentation.`;
    }
    return `User saved a DBQ form${ctx.formName ? ` (${ctx.formName})` : ''} for offline use.`;
  },
  
  'blue-button': (ctx) => `User analyzed ${ctx.count || 'their'} medical records using AI. This analysis would cost hundreds at a legal firm.`,
  
  'witness-bench': (ctx) => `User created a professional buddy statement${ctx.witness ? ` from ${ctx.witness}` : ''}. Claims attorneys charge $150+ for witness preparation.`,
  
  'risk-assessment': (ctx) => `User identified ${ctx.risks || 'potential'} risk${ctx.risks > 1 ? 's' : ''} in their claim before the VA could use them. This protection is priceless.`,
  
  'tdiu': (ctx) => `User built a TDIU impact statement. A vocational expert charges $500+ for this type of assessment.`,
  
  'pact-act': (ctx) => `User found presumptive conditions${ctx.condition ? ` including ${ctx.condition}` : ''} under the PACT Act. No nexus letter needed - that's $1,500+ saved per condition.`,
  
  'default': (ctx) => `User accomplished something valuable with Vet-Rate.org's free tools. This tool exists because veterans help veterans.`
};

/**
 * Generate a funding message using AI
 * @param {string} trigger - What action triggered this
 * @param {object} context - Context about the action
 * @returns {Promise<string|null>} Generated message or null if AI unavailable
 */
async function generateAIMessage(trigger, context) {
  // Check cache first
  const cacheKey = `${trigger}-${JSON.stringify(context)}`;
  const cached = messageCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.message;
  }
  
  // Check if AI is available
  const aiAvailable = isAnyAIAvailable();
  if (!aiAvailable) {
    return null;
  }
  
  // Build context description
  const contextTemplate = CONTEXT_TEMPLATES[trigger] || CONTEXT_TEMPLATES['default'];
  const contextDescription = typeof contextTemplate === 'function' 
    ? contextTemplate(context) 
    : contextTemplate;
  
  const prompt = FUNDING_MESSAGE_PROMPT.replace('{{CONTEXT}}', contextDescription);
  
  try {
    const result = await generateAI(prompt, {
      maxTokens: 150,
      temperature: 0.8, // Slightly creative for natural variation
    });
    
    if (result && result.trim()) {
      // Cache the result
      messageCache.set(cacheKey, {
        message: result.trim(),
        timestamp: Date.now()
      });
      return result.trim();
    }
  } catch (error) {
    console.log('AI funding message generation skipped:', error.message);
  }
  
  return null;
}

/**
 * Static fallback messages with $5/$10 mentions
 * These are used when AI isn't available
 */
const STATIC_MESSAGES = {
  'search': {
    headline: "Found what you needed! 🎯",
    body: "That research would've taken hours. A quick $5 or $10 helps keep this free for the next veteran.",
    cta: "Keep It Free"
  },
  'secondary-scout': {
    headline: "Claims unlocked! 💡",
    body: "You just discovered potential secondary claims worth researching. If this helped, $5-10 keeps development going.",
    cta: "Worth a Coffee?"
  },
  'cap-sim': {
    headline: "You're prepared! 📋",
    body: "Walking into your C&P exam ready could mean hundreds more per month. A $5 or $10 coffee helps keep this tool free.",
    cta: "Pay It Forward"
  },
  'cap-sim-complete': {
    headline: "Simulation complete! 🏆",
    body: "That's exam prep most veterans never get. If this gave you confidence, $5-10 helps build more features.",
    cta: "Back a Fellow Vet"
  },
  'packet': {
    headline: "Packet building! 📁",
    body: "No VSO fees, no lawyer cuts, no data sold - just one vet helping another. A $5 or $10 donation goes a long way.",
    cta: "Support the Mission"
  },
  'nexus': {
    headline: "Nexus drafted! 📝",
    body: "That template would cost $50-100 from a paid service. A $5 or $10 contribution helps keep this free for everyone.",
    cta: "Worth It?"
  },
  'export': {
    headline: "Backup created! 💾",
    body: "Your claim data is safe and private. No cloud fees, no subscriptions - $5 or $10 keeps Luna happy and Midnight coding.",
    cta: "Back the Builder"
  },
  'dbq-library': {
    headline: "DBQs ready! 📋",
    body: "Official VA forms saved for offline use - no internet needed at your doctor's. A $5-10 coffee keeps this running.",
    cta: "Buy Me a Coffee"
  },
  'blue-button': {
    headline: "Records analyzed! 🩺",
    body: "This AI analysis would cost hundreds at a legal firm. A $5 or $10 keeps Luna in treats and Midnight building new features.",
    cta: "Back the Tech"
  },
  'million-dollar': {
    headline: "That's YOUR money! 💰",
    body: "You just saw your rating's true lifetime value. If this tool helped, $5 or $10 helps us reach more veterans.",
    cta: "Share the Wealth"
  },
  'default': {
    headline: "Mission accomplished! 🎖️",
    body: "You just used a tool built by a veteran, for veterans. If it helped, $5 or $10 keeps development going.",
    cta: "Support the Mission"
  }
};

/**
 * Get a funding message - AI-generated if available, static fallback otherwise
 * @param {string} trigger - What action triggered this
 * @param {object} context - Context about the action
 * @returns {Promise<{headline: string, body: string, cta: string, isAI: boolean}>}
 */
export async function getFundingMessage(trigger, context = {}) {
  // Try AI generation first (non-blocking)
  const aiMessage = await generateAIMessage(trigger, context);
  
  if (aiMessage) {
    // AI generated a custom body message
    const staticMsg = STATIC_MESSAGES[trigger] || STATIC_MESSAGES['default'];
    return {
      headline: staticMsg.headline,
      body: aiMessage,
      cta: staticMsg.cta,
      isAI: true
    };
  }
  
  // Fall back to static message
  const msg = STATIC_MESSAGES[trigger] || STATIC_MESSAGES['default'];
  return {
    ...msg,
    isAI: false
  };
}

/**
 * Synchronously get a static message (for immediate display)
 * @param {string} trigger 
 * @param {object} context 
 * @returns {{headline: string, body: string, cta: string}}
 */
export function getStaticFundingMessage(trigger, context = {}) {
  return STATIC_MESSAGES[trigger] || STATIC_MESSAGES['default'];
}

/**
 * Clear the message cache (useful for testing)
 */
export function clearMessageCache() {
  messageCache.clear();
}

export default getFundingMessage;
