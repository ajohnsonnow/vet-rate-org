/**
 * Vet-Rate.org - Warrant Council Agent Recommendations
 * 🎖️ "The Warrant Standard" - Specialized Agents for Each Task
 *
 * This utility maps each tool to the appropriate Warrant Council agent:
 * - AUDITOR: Document analysis, claim review, compliance checking
 * - WRITER: Personal statements, nexus letters, buddy statements
 * - RATER: Rating calculations, bilateral factor, TDIU assessment
 *
 * All agents are fine-tuned on official VA regulations and procedures.
 */

import { PROJECT_STATS } from "../data/projectStats";

/**
 * Tool categories and their AI requirements
 */
export const TOOL_CATEGORIES = {
  DOCUMENT_PARSING: {
    id: "document-parsing",
    label: "Document Analysis",
    description:
      "Parsing and extracting information from military/medical documents",
    requirements: ["accuracy", "context-understanding", "structured-output"],
    icon: "📄",
    swarmAgent: "auditor",
  },
  CREATIVE_WRITING: {
    id: "creative-writing",
    label: "Statement Writing",
    description: "Generating persuasive, human-sounding narratives",
    requirements: ["fluency", "empathy", "natural-language"],
    icon: "✍️",
    swarmAgent: "writer",
  },
  LEGAL_ANALYSIS: {
    id: "legal-analysis",
    label: "Legal/Regulatory",
    description: "Interpreting VA regulations and procedures",
    requirements: ["precision", "accuracy", "zero-hallucination"],
    icon: "⚖️",
    swarmAgent: "auditor",
  },
  ADVERSARIAL: {
    id: "adversarial",
    label: "Adversarial Analysis",
    description: "Critical evaluation and stress-testing claims",
    requirements: ["reasoning", "critical-thinking", "thoroughness"],
    icon: "🎯",
    swarmAgent: "auditor",
  },
  RATING: {
    id: "rating",
    label: "Rating Calculations",
    description: "VA disability rating calculations and bilateral factor",
    requirements: ["precision", "math", "regulatory-compliance"],
    icon: "🧮",
    swarmAgent: "rater",
  },
  QUICK_TASK: {
    id: "quick-task",
    label: "Quick Tasks",
    description: "Fast responses for simple queries",
    requirements: ["speed", "efficiency"],
    icon: "⚡",
    swarmAgent: "auditor",
  },
  VISION: {
    id: "vision",
    label: "Image Analysis",
    description: "Reading scanned documents and images",
    requirements: ["vision", "ocr", "image-understanding"],
    icon: "👁️",
    swarmAgent: "auditor",
  },
};

/**
 * Tool-specific Warrant Council agent recommendations
 * Each tool maps to the best agent with explanations
 */
export const TOOL_LLM_RECOMMENDATIONS = {
  // === Document Parsing Tools - AUDITOR ===
  "dd214-analyzer": {
    name: "DD214 Analyzer",
    category: TOOL_CATEGORIES.DOCUMENT_PARSING,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason:
        "Specialized agent trained to extract service dates, MOS codes, and discharge info with high accuracy.",
      badge: "🎖️ Warrant",
    },
    alternatives: [
      {
        modelId: "diamond-auditor",
        modelName: "🎖️ CW5 Auditor",
        reason:
          "Best for DD214 analysis - trained on official military document formats",
      },
    ],
    tips: [
      "🎖️ CW5 Auditor is optimized for military document parsing",
      "Agent automatically validates extracted data against known formats",
      "Supports both text PDFs and OCR results from scanned images",
    ],
  },

  "cfile-analyzer": {
    name: "C-File Analyzer",
    category: TOOL_CATEGORIES.DOCUMENT_PARSING,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason:
        "Specialized for complex multi-page VA claim files with regulatory compliance checking",
      badge: "🎖️ Warrant",
    },
    alternatives: [
      {
        modelId: "diamond-auditor",
        modelName: "🎖️ CW5 Auditor",
        reason: "Trained on C-File formats and VA procedures",
      },
    ],
    tips: [
      "🎖️ CW5 Auditor handles 100+ page C-Files efficiently",
      "Agent identifies missing evidence and compliance issues",
      "Automatically cross-references with 38 CFR regulations",
    ],
  },

  "blue-button": {
    name: "Blue Button X-Ray",
    category: TOOL_CATEGORIES.DOCUMENT_PARSING,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason:
        "Expert at parsing medical records and identifying service-connected conditions",
      badge: "🎖️ Warrant",
    },
    alternatives: [
      {
        modelId: "diamond-auditor",
        modelName: "🎖️ CW5 Auditor",
        reason: "Trained on medical terminology and VA health records",
      },
    ],
    tips: [
      "🎖️ CW5 Auditor understands medical terminology",
      "Agent extracts condition diagnoses and treatment history",
      "Identifies potential secondary conditions automatically",
    ],
  },

  // === Creative Writing Tools - WRITER ===
  "nexus-builder": {
    name: "Nexus Builder",
    category: TOOL_CATEGORIES.CREATIVE_WRITING,
    primary: {
      modelId: "diamond-writer",
      modelName: "🎖️ CW4 Writer",
      reason:
        "Specialized for nexus letters balancing medical accuracy with persuasive writing",
      badge: "🎖️ Warrant",
    },
    alternatives: [
      {
        modelId: "diamond-writer",
        modelName: "🎖️ CW4 Writer",
        reason: "Fine-tuned on successful VA nexus letter formats",
      },
    ],
    tips: [
      "🎖️ CW4 Writer creates medically accurate, persuasive nexus letters",
      'Agent understands the "at least as likely as not" standard',
      "Review AI output carefully - nexus letters are critical documents",
    ],
  },

  "witness-bench": {
    name: "Witness Bench",
    category: TOOL_CATEGORIES.CREATIVE_WRITING,
    primary: {
      modelId: "diamond-writer",
      modelName: "🎖️ CW4 Writer",
      reason:
        "Generates empathetic witness statement templates and interview guides",
      badge: "🎖️ Warrant",
    },
    alternatives: [
      {
        modelId: "diamond-writer",
        modelName: "🎖️ CW4 Writer",
        reason: "Trained on effective buddy/witness statement formats",
      },
    ],
    tips: [
      "🎖️ CW4 Writer creates emotionally resonant statements",
      "Agent focuses on observable behaviors and specific incidents",
      "Templates guide witnesses on what details to include",
    ],
  },

  "personal-statement": {
    name: "Personal Statement Helper",
    category: TOOL_CATEGORIES.CREATIVE_WRITING,
    primary: {
      modelId: "diamond-writer",
      modelName: "🎖️ CW4 Writer",
      reason:
        "Creates compelling personal narratives with proper VA formatting",
      badge: "🎖️ Warrant",
    },
    alternatives: [
      {
        modelId: "diamond-writer",
        modelName: "🎖️ CW4 Writer",
        reason: "Specialized for first-person veteran narratives",
      },
    ],
    tips: [
      "🎖️ CW4 Writer creates authentic, powerful personal statements",
      "Agent connects symptoms to daily life impact",
      "Use AI as a starting point - customize with your own voice",
    ],
  },

  // === Legal/Regulatory Tools - AUDITOR ===
  "decision-decoder": {
    name: "Decision Decoder",
    category: TOOL_CATEGORIES.LEGAL_ANALYSIS,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason:
        "Specialized agent for breaking down VA decision logic and regulatory language",
      badge: "🎖️ Warrant",
    },
    alternatives: [
      {
        modelId: "diamond-rater",
        modelName: "🎖️ CW3 Rater",
        reason:
          "Best if the decision involves combined-rating or bilateral factor math",
      },
    ],
    tips: [
      "VA decisions follow specific regulatory frameworks",
      "🎖️ CW5 Auditor traces the logic chain used by raters",
      "Always verify cited regulations against current 38 CFR",
    ],
  },

  "pact-act": {
    name: "PACT Act Navigator",
    category: TOOL_CATEGORIES.LEGAL_ANALYSIS,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason: "Precise interpretation of PACT Act eligibility rules",
      badge: "📋 Regulatory",
    },
    alternatives: [],
    tips: [
      "PACT Act has specific presumptive conditions lists",
      "🎖️ CW5 Auditor is fine-tuned on official VA regulations",
      "Date-of-service windows are critical - verify AI outputs",
    ],
  },

  "tdiu-builder": {
    name: "TDIU Builder",
    category: TOOL_CATEGORIES.LEGAL_ANALYSIS,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason: "Professional-grade reasoning for unemployability arguments",
      badge: "💼 Employment",
    },
    alternatives: [
      {
        modelId: "diamond-rater",
        modelName: "🎖️ CW3 Rater",
        reason:
          "Useful for the schedular §4.16(a) rating-threshold math behind TDIU",
      },
    ],
    tips: [
      'TDIU requires demonstrating "substantially gainful employment" barriers',
      "The agent needs to connect disabilities to specific job limitations",
      "🎖️ CW5 Auditor handles complex multi-condition TDIU claims",
    ],
  },

  // === Adversarial/Analysis Tools ===
  "war-room": {
    name: "War Room",
    category: TOOL_CATEGORIES.ADVERSARIAL,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason: "Chain-of-thought reasoning for thorough claim stress-testing",
      badge: "⚔️ Battle-Tested",
    },
    alternatives: [],
    tips: [
      'War Room needs an agent that can "think like a VA rater"',
      "🎖️ CW5 Auditor excels at finding claim weaknesses",
      "Use the strongest agent available for adversarial analysis",
    ],
  },

  "red-team": {
    name: "Red Team Simulator",
    category: TOOL_CATEGORIES.ADVERSARIAL,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason:
        "Deliberately adversarial reasoning to find claim vulnerabilities",
      badge: "🔴 Red Team",
    },
    alternatives: [],
    tips: [
      "Red teaming requires thinking like a skeptical examiner",
      "🎖️ CW5 Auditor is trained on official VA regulations and procedures",
      "Use the output to strengthen weak points in your claim",
    ],
  },

  tribunal: {
    name: "The Tribunal",
    category: TOOL_CATEGORIES.ADVERSARIAL,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason: "Simulates BVA hearing questions with realistic complexity",
      badge: "⚖️ Hearing Prep",
    },
    alternatives: [],
    tips: [
      "BVA hearings involve both factual and procedural questions",
      "🎖️ CW5 Auditor can ask probing follow-up questions",
      "The Tribunal helps you prepare for tough examiner queries",
    ],
  },

  "risk-assessment": {
    name: "Risk Assessment",
    category: TOOL_CATEGORIES.ADVERSARIAL,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason: "Systematic evaluation of claim strengths and weaknesses",
      badge: "📊 Analysis",
    },
    alternatives: [],
    tips: [
      "Risk assessment needs objective, critical analysis",
      "🎖️ CW5 Auditor can identify non-obvious vulnerabilities",
      "Use findings to prioritize evidence gathering",
    ],
  },

  // === Quick Task Tools ===
  "secondary-scout": {
    name: "Secondary Scout",
    category: TOOL_CATEGORIES.QUICK_TASK,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason:
        "Fast, regulation-grounded lookups for secondary condition connections",
      badge: "⚡ Fast",
    },
    alternatives: [],
    tips: [
      "Secondary Scout queries are typically short",
      "The database does the heavy lifting - AI just enhances results",
      "🎖️ CW5 Auditor stays grounded in verified diagnostic codes",
    ],
  },

  "smart-search": {
    name: "Smart Search",
    category: TOOL_CATEGORIES.QUICK_TASK,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason: "Search enhancement and suggestions grounded in VA regulations",
      badge: "🔍 Search",
    },
    alternatives: [],
    tips: [
      "AI enhances search but the database is the source of truth",
      "🎖️ CW5 Auditor avoids hallucinating diagnostic codes",
    ],
  },

  calculator: {
    name: "Tactical Calculator",
    category: TOOL_CATEGORIES.QUICK_TASK,
    primary: {
      modelId: "diamond-rater",
      modelName: "🎖️ CW3 Rater",
      reason:
        "Explains VA math and rating combinations - trained on the combined ratings table",
      badge: "🧮 Calculator",
    },
    alternatives: [],
    tips: [
      "VA combined rating math follows specific formulas",
      'The agent explains the "why" behind calculations',
      "Calculations are done by the app - AI just assists",
    ],
  },

  // === Vision Tools ===
  "document-scanner": {
    name: "Document Scanner",
    category: TOOL_CATEGORIES.VISION,
    primary: {
      modelId: "Vet-Rate-Vision-Phi-Float32",
      modelName: "Vet-Rate Vision Phi",
      reason:
        "✅ Custom Float32 build - works in standard Chrome/Edge! No experimental flags needed.",
      badge: "👁️ Vision",
    },
    alternatives: [
      {
        modelId: "Vet-Rate-Vision-Phi-q4f32_1",
        modelName: "Vet-Rate Vision Phi (Legacy)",
        reason:
          "⚠️ Legacy version - requires Chrome Canary with experimental flags",
      },
    ],
    tips: [
      "Phi 3.5 Vision Float32 works in any modern browser with WebGPU",
      "Text-based documents can use 🎖️ CW5 Auditor after OCR",
      "Cloud AI (Gemini) also has vision capabilities",
    ],
  },

  // === Additional Tools ===
  "denial-decoder": {
    name: "Denial Decoder",
    category: TOOL_CATEGORIES.LEGAL_ANALYSIS,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason:
        "Translates VA legalese to plain English with regulation-grounded reasoning",
      badge: "📖 Translation",
    },
    alternatives: [],
    tips: [
      "Denial letters use specific legal terminology",
      'The agent explains the "why" behind decisions',
      "Always read the original letter alongside AI analysis",
    ],
  },

  "forms-helper": {
    name: "VA Forms Helper",
    category: TOOL_CATEGORIES.CREATIVE_WRITING,
    primary: {
      modelId: "diamond-writer",
      modelName: "🎖️ CW4 Writer",
      reason:
        "Fast, accurate guidance for filling VA forms in the veteran's own voice",
      badge: "📋 Forms",
    },
    alternatives: [],
    tips: [
      "Form fields have specific length limits",
      "Review AI suggestions for accuracy before submitting",
    ],
  },

  "doctors-packet": {
    name: "Doctor's Packet Generator",
    category: TOOL_CATEGORIES.CREATIVE_WRITING,
    primary: {
      modelId: "diamond-writer",
      modelName: "🎖️ CW4 Writer",
      reason: "Creates comprehensive research packets for physicians",
      badge: "🩺 Medical",
    },
    alternatives: [],
    tips: [
      "Doctor packets need medical accuracy",
      "Include peer-reviewed sources when possible",
    ],
  },

  "legislative-watchdog": {
    name: "Legislative Watchdog",
    category: TOOL_CATEGORIES.LEGAL_ANALYSIS,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason: "Regulation-grounded analysis of legislative updates",
      badge: "📰 News",
    },
    alternatives: [],
    tips: [
      "Legislative changes are time-sensitive",
      "Always verify changes against official sources",
    ],
  },

  pathfinder: {
    name: "The Pathfinder",
    category: TOOL_CATEGORIES.ADVERSARIAL,
    primary: {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason: "Strategic analysis to find high-probability secondary claims",
      badge: "🧭 Strategy",
    },
    alternatives: [],
    tips: [
      "Pathfinder needs to understand medical relationships",
      "🎖️ CW5 Auditor excels at finding non-obvious connections",
      "Use results as a starting point for deeper research",
    ],
  },

  "retro-pay-hunter": {
    name: "Retro Pay Hunter",
    category: TOOL_CATEGORIES.LEGAL_ANALYSIS,
    primary: {
      modelId: "diamond-rater",
      modelName: "🎖️ CW3 Rater",
      reason:
        "Systematic analysis to find potential underpayments using VA pay tables",
      badge: "💰 Financial",
    },
    alternatives: [
      {
        modelId: "diamond-auditor",
        modelName: "🎖️ CW5 Auditor",
        reason: "Better for CUE/regulatory analysis of the underlying decision",
      },
    ],
    tips: [
      "Retro pay calculations involve specific VA pay tables",
      "🎖️ CW3 Rater catches errors in payment history",
      "Always verify AI findings with official VA records",
    ],
  },
};

/**
 * Get recommendation for a specific tool
 * @param {string} toolId - The tool identifier
 * @returns {object|null} Recommendation object or null if not found
 */
export const getToolRecommendation = (toolId) => {
  return TOOL_LLM_RECOMMENDATIONS[toolId] || null;
};

/**
 * Get all tools in a specific category
 * @param {string} categoryId - The category identifier
 * @returns {array} Array of tools in that category
 */
export const getToolsByCategory = (categoryId) => {
  return Object.entries(TOOL_LLM_RECOMMENDATIONS)
    .filter(([_, tool]) => tool.category.id === categoryId)
    .map(([id, tool]) => ({ id, ...tool }));
};

/**
 * Get the best model for a user's VRAM constraint
 * @param {string} toolId - The tool being used
 * @param {number} availableVRAM - User's available VRAM in GB
 * @returns {object} Best model recommendation within VRAM constraint
 */
export const getModelForVRAM = (toolId, availableVRAM) => {
  const tool = TOOL_LLM_RECOMMENDATIONS[toolId];
  if (!tool) return null;

  // VRAM requirements for models. All three Warrant Council agents (the
  // only locally-loadable models — legacy generic WebLLM models were
  // removed) require the same 6GB; the vision models are separate.
  const vramMap = {
    "diamond-auditor": 6,
    "diamond-writer": 6,
    "diamond-rater": 6,
    "Vet-Rate-Vision-Phi-Float32": 6,
    "Vet-Rate-Vision-Phi-q4f32_1": 6,
  };

  // Check primary first (with null safety)
  if (!tool?.primary?.modelId) {
    // Tool doesn't have proper primary config, return minimal fallback
    return {
      modelId: "diamond-auditor",
      modelName: "🎖️ CW5 Auditor",
      reason: "Default agent (tool config missing)",
      fits: true,
      isMinimal: true,
    };
  }

  const primaryVRAM = vramMap[tool.primary.modelId] || 6;
  if (availableVRAM >= primaryVRAM) {
    return { ...tool.primary, fits: true };
  }

  // Check alternatives in order
  for (const alt of tool.alternatives) {
    const altVRAM = vramMap[alt.modelId] || 6;
    if (availableVRAM >= altVRAM) {
      return { ...alt, fits: true, wasFallback: true };
    }
  }

  // No local agent fits — Cloud AI (Gemini) has no VRAM requirement.
  return {
    modelId: null,
    modelName: "Cloud AI (Gemini)",
    reason:
      "Your device doesn't have enough VRAM for a local Warrant Council agent - use Cloud AI instead.",
    fits: false,
    isMinimal: true,
    isCloudFallback: true,
  };
};

/**
 * Check if user's current model is optimal for a tool
 * @param {string} toolId - The tool being used
 * @param {string} currentModelId - Currently loaded model ID
 * @returns {object} Analysis of current model suitability
 */
export const analyzeCurrentModel = (toolId, currentModelId) => {
  const tool = TOOL_LLM_RECOMMENDATIONS[toolId];
  if (!tool || !currentModelId) {
    return { isOptimal: true, suggestion: null };
  }

  // Null safety: ensure tool.primary exists
  if (!tool.primary || !tool.primary.modelId) {
    return { isOptimal: true, suggestion: null };
  }

  // Check if current model is primary
  if (currentModelId === tool.primary.modelId) {
    return {
      isOptimal: true,
      isPrimary: true,
      message: `✅ You're using the recommended model for ${tool.name}`,
    };
  }

  // Check if current model is an alternative
  const altMatch = tool.alternatives.find((a) => a.modelId === currentModelId);
  if (altMatch) {
    return {
      isOptimal: true,
      isAlternative: true,
      message: `✓ Good choice! ${altMatch.reason}`,
      suggestion: {
        model: tool.primary,
        reason: `For best results, consider ${tool.primary.modelName}`,
      },
    };
  }

  // Current model is not recommended
  return {
    isOptimal: false,
    message: `Your current model may not be ideal for ${tool.name}`,
    suggestion: {
      model: tool.primary,
      reason: tool.primary.reason,
    },
  };
};

/**
 * Get summary stats for display
 */
export const getLLMStats = () => {
  const toolCount = Object.keys(TOOL_LLM_RECOMMENDATIONS).length;
  const categoryCount = Object.keys(TOOL_CATEGORIES).length;
  const uniqueModels = new Set();

  Object.values(TOOL_LLM_RECOMMENDATIONS).forEach((tool) => {
    // Null safety checks
    if (tool?.primary?.modelId) {
      uniqueModels.add(tool.primary.modelId);
    }
    if (tool?.alternatives) {
      tool.alternatives.forEach((alt) => {
        if (alt?.modelId) uniqueModels.add(alt.modelId);
      });
    }
  });

  return {
    toolsWithRecommendations: toolCount,
    categories: categoryCount,
    uniqueModelsRecommended: uniqueModels.size,
    totalLocalModels: PROJECT_STATS.localAIModels, // From projectStats
  };
};

export default {
  TOOL_CATEGORIES,
  TOOL_LLM_RECOMMENDATIONS,
  getToolRecommendation,
  getToolsByCategory,
  getModelForVRAM,
  analyzeCurrentModel,
  getLLMStats,
};
