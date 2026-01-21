/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * 
 * CHANGELOG GENERATOR
 * 
 * Dynamically generates changelog data from README.md
 * This ensures the What's New modal always reflects the current features
 */

import { APP_VERSION } from './version';
import { getSquashedBugsForChangelog, getSquashedBugCount, getRecentSquashedBugs } from '../data/squashedBugs';
import { PROJECT_STATS, getTotalToolCount } from '../data/projectStats';

/**
 * Parse the README.md file and extract features organized by section
 * @param {string} readmeContent - The raw README.md content
 * @returns {Array} - Array of changelog items
 */
export function parseReadmeForChangelog(readmeContent) {
  const changelog = [];
  
  // Feature patterns to extract from README
  const sectionPatterns = [
    { 
      regex: /###\s*🔍[-\s]*Core Intelligence Tools([\s\S]*?)(?=###|\n##|$)/i,
      type: 'feature',
      category: 'Core Intelligence'
    },
    { 
      regex: /###\s*💰[-\s]*Rating & Benefits Calculators([\s\S]*?)(?=###|\n##|$)/i,
      type: 'feature',
      category: 'Calculators'
    },
    { 
      regex: /###\s*🔍[-\s]*Discovery & Research Tools([\s\S]*?)(?=###|\n##|$)/i,
      type: 'feature',
      category: 'Discovery'
    },
    { 
      regex: /###\s*📝[-\s]*Evidence Building Suite([\s\S]*?)(?=###|\n##|$)/i,
      type: 'feature',
      category: 'Evidence Building'
    },
    { 
      regex: /###\s*🎯[-\s]*Quality Control Tools([\s\S]*?)(?=###|\n##|$)/i,
      type: 'improvement',
      category: 'Quality Control'
    },
    { 
      regex: /###\s*⚡[-\s]*Advanced Strategy Tools([\s\S]*?)(?=###|\n##|$)/i,
      type: 'feature',
      category: 'Strategy'
    },
    { 
      regex: /###\s*🤝[-\s]*Support & Resources([\s\S]*?)(?=###|\n##|$)/i,
      type: 'feature',
      category: 'Support'
    },
    { 
      regex: /###\s*Privacy & Security([\s\S]*?)(?=###|\n##|$)/i,
      type: 'security',
      category: 'Security'
    }
  ];

  // Extract features from each section
  sectionPatterns.forEach(({ regex, type, category }) => {
    const match = readmeContent.match(regex);
    if (match) {
      const sectionContent = match[1];
      
      // Extract bullet points with ** bold titles **
      const featureRegex = /-\s*\*\*([^*]+)\*\*[:\s]*(.+?)(?=\n-|\n\n|$)/g;
      let featureMatch;
      
      while ((featureMatch = featureRegex.exec(sectionContent)) !== null) {
        const title = featureMatch[1].trim();
        const description = featureMatch[2].trim()
          .replace(/\*\*/g, '') // Remove remaining bold markers
          .replace(/\s+/g, ' '); // Normalize whitespace
        
        // Check for NEW tag
        const isNew = title.includes('🆕') || description.includes('🆕');
        
        changelog.push({
          type: isNew ? 'feature' : type,
          title: title.replace(/🆕/g, '').trim(),
          description: description.replace(/🆕/g, '').trim(),
          category,
          isNew
        });
      }
    }
  });

  return changelog;
}

/**
 * Get highlighted features for What's New modal
 * Prioritizes new features and important updates
 * @param {Array} allChangelog - Full changelog array
 * @param {number} limit - Maximum items to show
 * @returns {Array} - Curated changelog items
 */
export function getHighlightedChangelog(allChangelog, limit = 10) {
  // Prioritize NEW features first
  const newFeatures = allChangelog.filter(item => item.isNew);
  const otherFeatures = allChangelog.filter(item => !item.isNew);
  
  // Sort others by type priority: security > feature > improvement
  const typePriority = { security: 0, feature: 1, improvement: 2, change: 3 };
  otherFeatures.sort((a, b) => (typePriority[a.type] || 3) - (typePriority[b.type] || 3));
  
  // Combine and limit
  return [...newFeatures, ...otherFeatures].slice(0, limit);
}

/**
 * Generate a curated What's New changelog
 * This is the main function to call for the modal
 * @returns {Object} - Object with version and changelog array
 */
export function generateWhatsNewChangelog() {
  // Curated changelog highlighting the most important features
  // This is manually curated for the best user experience
  // Update this array when deploying new features
  
  const curatedChangelog = [
    // v1.4.1 - LOCAL AI EXPANSION + SMART LLM RECOMMENDATIONS
    {
      type: 'feature',
      title: '🤖 17 Local AI Models - 100% Private',
      description: 'Expanded from 8 to 17 local AI models! DeepSeek R1, Qwen 3, SmolLM2, Hermes 3, and Phi 3.5 Vision now available. Your data NEVER leaves your device.',
      isNew: true
    },
    {
      type: 'feature',
      title: '💡 Smart LLM Recommendations',
      description: 'Each AI tool now shows the BEST model for that task! Document parsing? DeepSeek R1. Writing nexus letters? Qwen 3 8B. Scanned images? Phi 3.5 Vision.',
      isNew: true
    },
    {
      type: 'feature',
      title: '👁️ Phi 3.5 Vision - Read Images Directly',
      description: 'NEW vision model can analyze scanned DD214s and documents without OCR! The only local model that can "see" images.',
      isNew: true
    },
    {
      type: 'feature',
      title: '🧠 DeepSeek R1 - Reasoning Powerhouse',
      description: 'Chain-of-thought reasoning models excel at complex claim analysis. Think like a VA rater to stress-test your claim.',
      isNew: true
    },
    // v1.4.0 - CRASH-PROOF STORAGE SYSTEM "The Bunker" + GPU SELECTION
    {
      type: 'security',
      title: '🛡️ CRASH-PROOF STORAGE - "The Bunker"',
      description: 'Your data now survives browser crashes, cache clears, and power outages! Click "💾 Save My Packet" in My Packet to create a crash-proof file on your device.',
      isNew: true
    },
    {
      type: 'feature',
      title: '🎮 GPU Selection for Dual-GPU Systems',
      description: 'Laptops with dual GPUs (integrated + discrete) can now choose which GPU runs Local AI! Force "High Performance" for speed or "Power Saver" for battery life.',
      isNew: true
    },
    {
      type: 'feature',
      title: 'Save-As-You-Go Protocol',
      description: 'Every form field, every claim, every statement now auto-saves within 1.5 seconds. Your work is protected as you type!',
      isNew: true
    },
    {
      type: 'feature',
      title: '📂 Resume Packet Feature',
      description: 'Coming back tomorrow? Click "Resume Packet" to load your saved file and pick up exactly where you left off.',
      isNew: true
    },
    {
      type: 'feature',
      title: 'Mobile Backup Reminders',
      description: 'On mobile devices, we\'ll remind you to download backups before closing to ensure your data is safe.',
      isNew: true
    },
    // Previous NEW FEATURES
    {
      type: 'feature',
      title: 'Retro Pay Hunter',
      description: 'Find missed backpay using historical VA pay rates from 2020-2026 with CUE pattern detection',
      isNew: false
    },
    {
      type: 'feature',
      title: 'Time Machine',
      description: 'Intent to File countdown tracker with backpay projections',
      isNew: false
    },
    {
      type: 'feature',
      title: 'The Tribunal',
      description: 'Voice-interactive mock BVA hearing simulator with real-time feedback',
      isNew: false
    },
    {
      type: 'feature',
      title: 'The Bunker',
      description: 'Export/import all your data with optional encrypted Google Drive sync',
      isNew: true
    },
    {
      type: 'improvement',
      title: 'Dynamic Stats System',
      description: 'All stats (tools count, conditions count) now update automatically across the entire app',
      isNew: true
    },
    
    // EXISTING HIGHLIGHTS
    {
      type: 'feature',
      title: `${getTotalToolCount()} Professional Tools`,
      description: 'Complete VA claims arsenal - C-File Analyzer, C&P Simulator, Secondary Scout, and more'
    },
    {
      type: 'feature',
      title: `${PROJECT_STATS.disabilitiesValidated} Validated Conditions`,
      description: 'Every condition from 38 CFR Part 4 with detailed rating criteria and diagnostic codes'
    },
    {
      type: 'feature',
      title: 'AI-Powered Analysis',
      description: 'Optional Google Gemini/Anthropic integration for statement enhancement, with explicit consent'
    },
    {
      type: 'security',
      title: '100% Client-Side Processing',
      description: 'All processing happens in YOUR browser. No accounts, no tracking, no PII storage'
    },
    {
      type: 'feature',
      title: 'Secondary Scout',
      description: 'Discover 500+ medically-recognized secondary conditions with probability ratings'
    },
    {
      type: 'feature',
      title: 'Million Dollar Dashboard',
      description: 'Calculate lifetime benefit value and retirement projections with 2026 pay rates'
    }
  ];

  // Add recent squashed bugs to changelog
  const recentBugFixes = getSquashedBugsForChangelog(5);

  return {
    version: APP_VERSION,
    date: new Date().toISOString().split('T')[0],
    changelog: curatedChangelog,
    bugFixes: recentBugFixes,
    totalBugsSquashed: getSquashedBugCount()
  };
}

/**
 * Check if user should see What's New modal
 * @param {string} lastSeenVersion - Version last seen by user
 * @returns {boolean} - True if should show modal
 */
export function shouldShowWhatsNew(lastSeenVersion) {
  if (!lastSeenVersion) return true;
  return lastSeenVersion !== APP_VERSION;
}

export default {
  parseReadmeForChangelog,
  getHighlightedChangelog,
  generateWhatsNewChangelog,
  shouldShowWhatsNew,
  getSquashedBugsForChangelog,
  getSquashedBugCount
};
