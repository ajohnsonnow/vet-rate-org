/**
 * SupplyLocker.org - Diamond Swarm Agent Recommendations
 * 💎 "The Diamond Standard" - Specialized Agents for Each Task
 * 
 * This utility maps each tool to the appropriate Diamond Swarm agent:
 * - AUDITOR: Document analysis, claim review, compliance checking
 * - WRITER: Personal statements, nexus letters, buddy statements  
 * - RATER: Rating calculations, bilateral factor, TDIU assessment
 * 
 * All agents are fine-tuned on official VA regulations and procedures.
 */

import { SWARM_AGENTS, TOOL_AGENT_MAP } from './diamondSwarm';
import { PROJECT_STATS } from '../data/projectStats';

/**
 * Tool categories and their AI requirements
 */
export const TOOL_CATEGORIES = {
  DOCUMENT_PARSING: {
    id: 'document-parsing',
    label: 'Document Analysis',
    description: 'Parsing and extracting information from military/medical documents',
    requirements: ['accuracy', 'context-understanding', 'structured-output'],
    icon: '📄',
    swarmAgent: 'auditor',
  },
  CREATIVE_WRITING: {
    id: 'creative-writing',
    label: 'Statement Writing',
    description: 'Generating persuasive, human-sounding narratives',
    requirements: ['fluency', 'empathy', 'natural-language'],
    icon: '✍️',
    swarmAgent: 'writer',
  },
  LEGAL_ANALYSIS: {
    id: 'legal-analysis',
    label: 'Legal/Regulatory',
    description: 'Interpreting VA regulations and procedures',
    requirements: ['precision', 'accuracy', 'zero-hallucination'],
    icon: '⚖️',
    swarmAgent: 'auditor',
  },
  ADVERSARIAL: {
    id: 'adversarial',
    label: 'Adversarial Analysis',
    description: 'Critical evaluation and stress-testing claims',
    requirements: ['reasoning', 'critical-thinking', 'thoroughness'],
    icon: '🎯',
    swarmAgent: 'auditor',
  },
  RATING: {
    id: 'rating',
    label: 'Rating Calculations',
    description: 'VA disability rating calculations and bilateral factor',
    requirements: ['precision', 'math', 'regulatory-compliance'],
    icon: '🧮',
    swarmAgent: 'rater',
  },
  QUICK_TASK: {
    id: 'quick-task',
    label: 'Quick Tasks',
    description: 'Fast responses for simple queries',
    requirements: ['speed', 'efficiency'],
    icon: '⚡',
    swarmAgent: 'auditor',
  },
  VISION: {
    id: 'vision',
    label: 'Image Analysis',
    description: 'Reading scanned documents and images',
    requirements: ['vision', 'ocr', 'image-understanding'],
    icon: '👁️',
    swarmAgent: 'auditor',
  },
};

/**
 * Tool-specific Diamond Swarm agent recommendations
 * Each tool maps to the best agent with explanations
 */
export const TOOL_LLM_RECOMMENDATIONS = {
  // === Document Parsing Tools - AUDITOR ===
  'dd214-analyzer': {
    name: 'DD214 Analyzer',
    category: TOOL_CATEGORIES.DOCUMENT_PARSING,
    primary: {
      modelId: 'diamond-auditor',
      modelName: '💎 Diamond Auditor',
      reason: 'Specialized agent trained to extract service dates, MOS codes, and discharge info with high accuracy.',
      badge: '💎 Diamond',
    },
    alternatives: [
      {
        modelId: 'diamond-auditor',
        modelName: '💎 Diamond Auditor',
        reason: 'Best for DD214 analysis - trained on official military document formats',
      },
    ],
    tips: [
      '💎 Diamond Auditor is optimized for military document parsing',
      'Agent automatically validates extracted data against known formats',
      'Supports both text PDFs and OCR results from scanned images',
    ],
  },
  
  'cfile-analyzer': {
    name: 'C-File Analyzer',
    category: TOOL_CATEGORIES.DOCUMENT_PARSING,
    primary: {
      modelId: 'diamond-auditor',
      modelName: '💎 Diamond Auditor',
      reason: 'Specialized for complex multi-page VA claim files with regulatory compliance checking',
      badge: '💎 Diamond',
    },
    alternatives: [
      {
        modelId: 'diamond-auditor',
        modelName: '💎 Diamond Auditor',
        reason: 'Trained on C-File formats and VA procedures',
      },
    ],
    tips: [
      '💎 Diamond Auditor handles 100+ page C-Files efficiently',
      'Agent identifies missing evidence and compliance issues',
      'Automatically cross-references with 38 CFR regulations',
    ],
  },
  
  'blue-button': {
    name: 'Blue Button X-Ray',
    category: TOOL_CATEGORIES.DOCUMENT_PARSING,
    primary: {
      modelId: 'diamond-auditor',
      modelName: '💎 Diamond Auditor',
      reason: 'Expert at parsing medical records and identifying service-connected conditions',
      badge: '💎 Diamond',
    },
    alternatives: [
      {
        modelId: 'diamond-auditor',
        modelName: '💎 Diamond Auditor',
        reason: 'Trained on medical terminology and VA health records',
      },
    ],
    tips: [
      '💎 Diamond Auditor understands medical terminology',
      'Agent extracts condition diagnoses and treatment history',
      'Identifies potential secondary conditions automatically',
    ],
  },
  
  // === Creative Writing Tools - WRITER ===
  'nexus-builder': {
    name: 'Nexus Builder',
    category: TOOL_CATEGORIES.CREATIVE_WRITING,
    primary: {
      modelId: 'diamond-writer',
      modelName: '💎 Diamond Writer',
      reason: 'Specialized for nexus letters balancing medical accuracy with persuasive writing',
      badge: '💎 Diamond',
    },
    alternatives: [
      {
        modelId: 'diamond-writer',
        modelName: '💎 Diamond Writer',
        reason: 'Fine-tuned on successful VA nexus letter formats',
      },
    ],
    tips: [
      '💎 Diamond Writer creates medically accurate, persuasive nexus letters',
      'Agent understands the "at least as likely as not" standard',
      'Review AI output carefully - nexus letters are critical documents',
    ],
  },
  
  'witness-bench': {
    name: 'Witness Bench',
    category: TOOL_CATEGORIES.CREATIVE_WRITING,
    primary: {
      modelId: 'diamond-writer',
      modelName: '💎 Diamond Writer',
      reason: 'Generates empathetic witness statement templates and interview guides',
      badge: '💎 Diamond',
    },
    alternatives: [
      {
        modelId: 'diamond-writer',
        modelName: '💎 Diamond Writer',
        reason: 'Trained on effective buddy/witness statement formats',
      },
    ],
    tips: [
      '💎 Diamond Writer creates emotionally resonant statements',
      'Agent focuses on observable behaviors and specific incidents',
      'Templates guide witnesses on what details to include',
    ],
  },
  
  'personal-statement': {
    name: 'Personal Statement Helper',
    category: TOOL_CATEGORIES.CREATIVE_WRITING,
    primary: {
      modelId: 'diamond-writer',
      modelName: '💎 Diamond Writer',
      reason: 'Creates compelling personal narratives with proper VA formatting',
      badge: '💎 Diamond',
    },
    alternatives: [
      {
        modelId: 'diamond-writer',
        modelName: '💎 Diamond Writer',
        reason: 'Specialized for first-person veteran narratives',
      },
    ],
    tips: [
      '💎 Diamond Writer creates authentic, powerful personal statements',
      'Agent connects symptoms to daily life impact',
      'Use AI as a starting point - customize with your own voice',
    ],
  },
  
  // === Legal/Regulatory Tools - AUDITOR ===
  'decision-decoder': {
    name: 'Decision Decoder',
    category: TOOL_CATEGORIES.LEGAL_ANALYSIS,
    primary: {
      modelId: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC',
      modelName: 'DeepSeek R1 7B',
      reason: 'Reasoning model excels at breaking down VA decision logic',
      badge: '🧠 Reasoning',
    },
    alternatives: [
      {
        modelId: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 7B',
        reason: 'Strong at identifying key decision points and rationale',
      },
      {
        modelId: 'Phi-3.5-mini-instruct-q4f32_1-MLC',
        modelName: 'Phi 3.5 Mini',
        reason: 'Microsoft model optimized for reasoning tasks',
      },
    ],
    tips: [
      'VA decisions follow specific regulatory frameworks',
      'Reasoning models can trace the logic chain used by raters',
      'Always verify cited regulations against current 38 CFR',
    ],
  },
  
  'pact-act': {
    name: 'PACT Act Navigator',
    category: TOOL_CATEGORIES.LEGAL_ANALYSIS,
    primary: {
      modelId: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
      modelName: 'Qwen 2.5 7B',
      reason: 'Precise interpretation of PACT Act eligibility rules',
      badge: '📋 Regulatory',
    },
    alternatives: [
      {
        modelId: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC',
        modelName: 'DeepSeek R1 7B',
        reason: 'Chain-of-thought for complex eligibility determinations',
      },
      {
        modelId: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
        modelName: 'Llama 3.2 3B',
        reason: 'Quick lookups for basic PACT Act questions',
      },
    ],
    tips: [
      'PACT Act has specific presumptive conditions lists',
      'Larger models better understand regulatory nuances',
      'Date-of-service windows are critical - verify AI outputs',
    ],
  },
  
  'tdiu-builder': {
    name: 'TDIU Builder',
    category: TOOL_CATEGORIES.LEGAL_ANALYSIS,
    primary: {
      modelId: 'DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC',
      modelName: 'DeepSeek R1 Llama 8B',
      reason: 'Professional-grade reasoning for unemployability arguments',
      badge: '💼 Employment',
    },
    alternatives: [
      {
        modelId: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 7B',
        reason: 'Strong at articulating vocational limitations',
      },
      {
        modelId: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 3B',
        reason: 'Balanced option for TDIU statement generation',
      },
    ],
    tips: [
      'TDIU requires demonstrating "substantially gainful employment" barriers',
      'The model needs to connect disabilities to specific job limitations',
      'Use reasoning models for complex multi-condition TDIU claims',
    ],
  },
  
  // === Adversarial/Analysis Tools ===
  'war-room': {
    name: 'War Room',
    category: TOOL_CATEGORIES.ADVERSARIAL,
    primary: {
      modelId: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC',
      modelName: 'DeepSeek R1 7B',
      reason: 'Chain-of-thought reasoning for thorough claim stress-testing',
      badge: '⚔️ Battle-Tested',
    },
    alternatives: [
      {
        modelId: 'Qwen3-8B-q4f32_1-MLC',
        modelName: 'Qwen 3 8B',
        reason: 'Latest generation with strong analytical capabilities',
      },
      {
        modelId: 'Mistral-7B-Instruct-v0.3-q4f32_1-MLC',
        modelName: 'Mistral 7B',
        reason: 'Critical evaluation with good coverage',
      },
    ],
    tips: [
      'War Room needs models that can "think like a VA rater"',
      'Reasoning models excel at finding claim weaknesses',
      'Use the strongest model available for adversarial analysis',
    ],
  },
  
  'red-team': {
    name: 'Red Team Simulator',
    category: TOOL_CATEGORIES.ADVERSARIAL,
    primary: {
      modelId: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC',
      modelName: 'DeepSeek R1 7B',
      reason: 'Deliberately adversarial reasoning to find claim vulnerabilities',
      badge: '🔴 Red Team',
    },
    alternatives: [
      {
        modelId: 'DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC',
        modelName: 'DeepSeek R1 Llama 8B',
        reason: 'Maximum reasoning power for comprehensive red-teaming',
      },
      {
        modelId: 'Phi-3.5-mini-instruct-q4f32_1-MLC',
        modelName: 'Phi 3.5 Mini',
        reason: 'Fast critical analysis for quick checks',
      },
    ],
    tips: [
      'Red teaming requires thinking like a skeptical examiner',
      'DeepSeek R1 models are specifically trained for reasoning',
      'Use the output to strengthen weak points in your claim',
    ],
  },
  
  'tribunal': {
    name: 'The Tribunal',
    category: TOOL_CATEGORIES.ADVERSARIAL,
    primary: {
      modelId: 'Qwen3-8B-q4f32_1-MLC',
      modelName: 'Qwen 3 8B',
      reason: 'Simulates BVA hearing questions with realistic complexity',
      badge: '⚖️ Hearing Prep',
    },
    alternatives: [
      {
        modelId: 'Mistral-7B-Instruct-v0.3-q4f32_1-MLC',
        modelName: 'Mistral 7B',
        reason: 'Natural conversational flow for mock hearings',
      },
      {
        modelId: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC',
        modelName: 'DeepSeek R1 7B',
        reason: 'Probing follow-up questions based on your answers',
      },
    ],
    tips: [
      'BVA hearings involve both factual and procedural questions',
      'Practice with models that can ask follow-up questions',
      'The Tribunal helps you prepare for tough examiner queries',
    ],
  },
  
  'risk-assessment': {
    name: 'Risk Assessment',
    category: TOOL_CATEGORIES.ADVERSARIAL,
    primary: {
      modelId: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC',
      modelName: 'DeepSeek R1 7B',
      reason: 'Systematic evaluation of claim strengths and weaknesses',
      badge: '📊 Analysis',
    },
    alternatives: [
      {
        modelId: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 7B',
        reason: 'Comprehensive risk factor identification',
      },
      {
        modelId: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 3B',
        reason: 'Quick risk overview for initial assessment',
      },
    ],
    tips: [
      'Risk assessment needs objective, critical analysis',
      'Reasoning models can identify non-obvious vulnerabilities',
      'Use findings to prioritize evidence gathering',
    ],
  },
  
  // === Quick Task Tools ===
  'secondary-scout': {
    name: 'Secondary Scout',
    category: TOOL_CATEGORIES.QUICK_TASK,
    primary: {
      modelId: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
      modelName: 'Llama 3.2 3B',
      reason: 'Fast lookups for secondary condition connections',
      badge: '⚡ Fast',
    },
    alternatives: [
      {
        modelId: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 3B',
        reason: 'Good medical knowledge for condition linking',
      },
      {
        modelId: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 1.5B',
        reason: 'Fastest option for simple lookups',
      },
    ],
    tips: [
      'Secondary Scout queries are typically short',
      'Speed is more important than raw power here',
      'The database does the heavy lifting - AI just enhances results',
    ],
  },
  
  'smart-search': {
    name: 'Smart Search',
    category: TOOL_CATEGORIES.QUICK_TASK,
    primary: {
      modelId: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
      modelName: 'Qwen 2.5 1.5B',
      reason: 'Lightning-fast search enhancement and suggestions',
      badge: '🔍 Search',
    },
    alternatives: [
      {
        modelId: 'SmolLM2-1.7B-Instruct-q4f32_1-MLC',
        modelName: 'SmolLM2 1.7B',
        reason: 'Efficient search query understanding',
      },
      {
        modelId: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
        modelName: 'Llama 3.2 1B',
        reason: 'Fastest possible search assistance',
      },
    ],
    tips: [
      'Search doesn\'t need large models - speed is key',
      'Smaller models respond nearly instantly',
      'AI enhances search but the database is the source of truth',
    ],
  },
  
  'calculator': {
    name: 'Tactical Calculator',
    category: TOOL_CATEGORIES.QUICK_TASK,
    primary: {
      modelId: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
      modelName: 'Llama 3.2 3B',
      reason: 'Quick explanations of VA math and rating combinations',
      badge: '🧮 Calculator',
    },
    alternatives: [
      {
        modelId: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 1.5B',
        reason: 'Fast for simple rating math questions',
      },
      {
        modelId: 'Phi-3.5-mini-instruct-q4f32_1-MLC',
        modelName: 'Phi 3.5 Mini',
        reason: 'Microsoft model good at math reasoning',
      },
    ],
    tips: [
      'VA combined rating math follows specific formulas',
      'AI explains the "why" behind calculations',
      'Calculations are done by the app - AI just assists',
    ],
  },
  
  // === Vision Tools ===
  'document-scanner': {
    name: 'Document Scanner',
    category: TOOL_CATEGORIES.VISION,
    primary: {
      modelId: 'SupplyLocker-Vision-Phi-Float32',
      modelName: 'SupplyLocker Vision Phi',
      reason: '✅ Custom Float32 build - works in standard Chrome/Edge! No experimental flags needed.',
      badge: '👁️ Vision',
    },
    alternatives: [
      {
        modelId: 'SupplyLocker-Vision-Phi-q4f32_1',
        modelName: 'SupplyLocker Vision Phi (Legacy)',
        reason: '⚠️ Legacy version - requires Chrome Canary with experimental flags',
      },
    ],
    tips: [
      'Phi 3.5 Vision Float32 works in any modern browser with WebGPU',
      'Text-based documents can use any model after OCR',
      'Cloud AI (Gemini) also has vision capabilities',
    ],
  },
  
  // === Additional Tools ===
  'denial-decoder': {
    name: 'Denial Decoder',
    category: TOOL_CATEGORIES.LEGAL_ANALYSIS,
    primary: {
      modelId: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC',
      modelName: 'DeepSeek R1 7B',
      reason: 'Reasoning model translates VA legalese to plain English',
      badge: '📖 Translation',
    },
    alternatives: [
      {
        modelId: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 7B',
        reason: 'Strong at explaining regulatory language',
      },
      {
        modelId: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 3B',
        reason: 'Quick translations for simple denial letters',
      },
    ],
    tips: [
      'Denial letters use specific legal terminology',
      'Reasoning models explain the "why" behind decisions',
      'Always read the original letter alongside AI analysis',
    ],
  },
  
  'forms-helper': {
    name: 'VA Forms Helper',
    category: TOOL_CATEGORIES.CREATIVE_WRITING,
    primary: {
      modelId: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
      modelName: 'Qwen 2.5 3B',
      reason: 'Fast, accurate guidance for filling VA forms',
      badge: '📋 Forms',
    },
    alternatives: [
      {
        modelId: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
        modelName: 'Llama 3.2 3B',
        reason: 'Quick form field suggestions',
      },
      {
        modelId: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 1.5B',
        reason: 'Fastest for simple form questions',
      },
    ],
    tips: [
      'Form fields have specific length limits',
      'Smaller models work well for concise responses',
      'Review AI suggestions for accuracy before submitting',
    ],
  },
  
  'doctors-packet': {
    name: "Doctor's Packet Generator",
    category: TOOL_CATEGORIES.CREATIVE_WRITING,
    primary: {
      modelId: 'Qwen3-8B-q4f32_1-MLC',
      modelName: 'Qwen 3 8B',
      reason: 'Creates comprehensive research packets for physicians',
      badge: '🩺 Medical',
    },
    alternatives: [
      {
        modelId: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 7B',
        reason: 'Strong medical knowledge base',
      },
      {
        modelId: 'Mistral-7B-Instruct-v0.3-q4f32_1-MLC',
        modelName: 'Mistral 7B',
        reason: 'Good at professional medical writing',
      },
    ],
    tips: [
      'Doctor packets need medical accuracy',
      'Larger models produce more thorough research',
      'Include peer-reviewed sources when possible',
    ],
  },
  
  'legislative-watchdog': {
    name: 'Legislative Watchdog',
    category: TOOL_CATEGORIES.LEGAL_ANALYSIS,
    primary: {
      modelId: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
      modelName: 'Qwen 2.5 3B',
      reason: 'Fast analysis of legislative updates',
      badge: '📰 News',
    },
    alternatives: [
      {
        modelId: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
        modelName: 'Llama 3.2 3B',
        reason: 'Quick summaries of rule changes',
      },
      {
        modelId: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 1.5B',
        reason: 'Fastest for simple updates',
      },
    ],
    tips: [
      'Legislative changes are time-sensitive',
      'Faster models help track multiple updates',
      'Always verify changes against official sources',
    ],
  },
  
  'pathfinder': {
    name: 'The Pathfinder',
    category: TOOL_CATEGORIES.ADVERSARIAL,
    primary: {
      modelId: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC',
      modelName: 'DeepSeek R1 7B',
      reason: 'Strategic analysis to find high-probability secondary claims',
      badge: '🧭 Strategy',
    },
    alternatives: [
      {
        modelId: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 7B',
        reason: 'Strong at identifying condition connections',
      },
      {
        modelId: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 3B',
        reason: 'Balanced analysis speed and quality',
      },
    ],
    tips: [
      'Pathfinder needs to understand medical relationships',
      'Reasoning models excel at finding non-obvious connections',
      'Use results as a starting point for deeper research',
    ],
  },
  
  'retro-pay-hunter': {
    name: 'Retro Pay Hunter',
    category: TOOL_CATEGORIES.LEGAL_ANALYSIS,
    primary: {
      modelId: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC',
      modelName: 'DeepSeek R1 7B',
      reason: 'Systematic analysis to find potential underpayments',
      badge: '💰 Financial',
    },
    alternatives: [
      {
        modelId: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
        modelName: 'Qwen 2.5 7B',
        reason: 'Strong at financial calculations',
      },
      {
        modelId: 'Phi-3.5-mini-instruct-q4f32_1-MLC',
        modelName: 'Phi 3.5 Mini',
        reason: 'Good at math-heavy reasoning',
      },
    ],
    tips: [
      'Retro pay calculations involve specific VA pay tables',
      'Reasoning models catch errors in payment history',
      'Always verify AI findings with official VA records',
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
  
  // VRAM requirements for models (approximate)
  const vramMap = {
    'SmolLM2-360M-Instruct-q4f32_1-MLC': 1,
    'Llama-3.2-1B-Instruct-q4f32_1-MLC': 2,
    'Qwen2.5-1.5B-Instruct-q4f32_1-MLC': 2,
    'SmolLM2-1.7B-Instruct-q4f32_1-MLC': 3,
    'Qwen3-1.7B-q4f32_1-MLC': 3,
    'gemma-2-2b-it-q4f32_1-MLC': 3,
    'Llama-3.2-3B-Instruct-q4f32_1-MLC': 4,
    'Hermes-3-Llama-3.2-3B-q4f32_1-MLC': 4,
    'Qwen2.5-3B-Instruct-q4f32_1-MLC': 4,
    'Phi-3.5-mini-instruct-q4f32_1-MLC': 4,
    'Qwen3-4B-q4f32_1-MLC': 4,
    'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC': 6,
    'DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC': 6,
    'SupplyLocker-Vision-Phi-q4f32_1': 6,
    'Phi-3.5-vision-instruct-q4f32_1-MLC': 6,
    'Qwen3-8B-q4f32_1-MLC': 7,
    'Mistral-7B-Instruct-v0.3-q4f32_1-MLC': 8,
    'Qwen2.5-7B-Instruct-q4f32_1-MLC': 8,
  };
  
  // Check primary first
  const primaryVRAM = vramMap[tool.primary.modelId] || 4;
  if (availableVRAM >= primaryVRAM) {
    return { ...tool.primary, fits: true };
  }
  
  // Check alternatives in order
  for (const alt of tool.alternatives) {
    const altVRAM = vramMap[alt.modelId] || 4;
    if (availableVRAM >= altVRAM) {
      return { ...alt, fits: true, wasFallback: true };
    }
  }
  
  // Return smallest model as last resort
  return {
    modelId: 'SmolLM2-360M-Instruct-q4f32_1-MLC',
    modelName: 'SmolLM2 360M',
    reason: 'Smallest model that fits your VRAM constraints',
    fits: false,
    isMinimal: true,
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
  
  // Check if current model is primary
  if (currentModelId === tool.primary.modelId) {
    return {
      isOptimal: true,
      isPrimary: true,
      message: `✅ You're using the recommended model for ${tool.name}`,
    };
  }
  
  // Check if current model is an alternative
  const altMatch = tool.alternatives.find(a => a.modelId === currentModelId);
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
  
  Object.values(TOOL_LLM_RECOMMENDATIONS).forEach(tool => {
    uniqueModels.add(tool.primary.modelId);
    tool.alternatives.forEach(alt => uniqueModels.add(alt.modelId));
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
